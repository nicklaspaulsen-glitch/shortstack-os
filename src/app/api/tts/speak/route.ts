import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

// Text-to-speech proxy. Tries providers in order of preference:
//   1. Runpod XTTS v2   — self-hosted, free, natural voice cloning
//   2. OpenAI TTS       — commercial, rock-solid, cheap ($0.015/1k chars)
//   3. ElevenLabs       — commercial, highest quality, paid per character
//   4. 501 (client picks a natural browser voice, not Microsoft David)
//
// Env vars:
//   RUNPOD_XTTS_URL + RUNPOD_API_KEY   — primary (free, needs worker)
//   OPENAI_API_KEY                     — secondary (reliable, cheap)
//   ELEVENLABS_API_KEY                 — tertiary
//   ELEVENLABS_VOICE_ID                — override voice (defaults to Charlotte)
//   OPENAI_TTS_VOICE                   — override OpenAI voice (defaults to nova)
//   TRINITY_TTS_PROVIDER               — force order: xtts | openai | elevenlabs

export const runtime = "nodejs";
export const maxDuration = 30;

const MAX_TEXT_LENGTH = 2000;
// Charlotte — calm, composed, British-accented female. Jarvis-but-female vibe.
const DEFAULT_ELEVENLABS_VOICE_ID = "XB0fDUnXU5powFXDhCwa";
// Nova — warm, soft-spoken, slightly British female. Closest OpenAI voice to Charlotte.
const DEFAULT_OPENAI_VOICE = "nova";
// Default voice pace. 1.0 = OpenAI natural pace (what we landed on after
// the user said 1.25 was "way too fast"). Snap back up via env
// TTS_DEFAULT_SPEED or body.speed per-request if anyone wants it snappier.
// Clamped to [0.7, 1.3] on both paths.
const DEFAULT_VOICE_SPEED = Number(process.env.TTS_DEFAULT_SPEED) || 1.0;

// ───────────────────────────────────────────────────────────────────
// Provider: Runpod XTTS v2 (self-hosted, free)
// ───────────────────────────────────────────────────────────────────
async function synthesizeViaRunpodXTTS(text: string): Promise<
  | { ok: true; audio: ArrayBuffer }
  | { ok: false; reason: string }
> {
  const url = process.env.RUNPOD_XTTS_URL;
  const key = process.env.RUNPOD_API_KEY;
  if (!url || !key) return { ok: false, reason: "not_configured" };

  try {
    // Runpod's runsync waits up to 90s. Short TTS finishes well under that.
    const res = await fetch(`${url}/runsync`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        input: {
          text,
          // XTTS v2 supports multiple languages + voice cloning. Without a
          // speaker_wav reference it uses the default pre-trained voice.
          language: "en",
          // speaker_wav can be added later for voice cloning.
        },
      }),
    });
    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      console.error("[tts/xtts] HTTP error:", res.status, errText.slice(0, 200));
      return { ok: false, reason: `http_${res.status}` };
    }
    const data = (await res.json()) as {
      status?: string;
      output?: unknown;
      error?: string;
    };
    if (data.status !== "COMPLETED" || !data.output) {
      console.error("[tts/xtts] bad job status:", data.status, data.error);
      return { ok: false, reason: `job_${data.status || "unknown"}` };
    }

    // XTTS workers commonly return one of:
    //   { audio_base64: "..." }
    //   { audio: "<base64>" }
    //   { output: { audio: "..." } }  (pass-through)
    //   { url: "https://.../audio.wav" }  (object storage)
    const output = data.output as Record<string, unknown> | string;
    let audio: ArrayBuffer | null = null;

    if (typeof output === "string") {
      // Assume base64
      audio = base64ToArrayBuffer(output);
    } else {
      const b64 =
        (output.audio_base64 as string | undefined) ||
        (output.audio as string | undefined) ||
        (output.audio_data as string | undefined);
      const remoteUrl = (output.url as string | undefined) || (output.audio_url as string | undefined);
      if (b64 && typeof b64 === "string") {
        audio = base64ToArrayBuffer(b64);
      } else if (remoteUrl) {
        const fetched = await fetch(remoteUrl);
        if (!fetched.ok) return { ok: false, reason: `fetch_url_${fetched.status}` };
        audio = await fetched.arrayBuffer();
      }
    }

    if (!audio) return { ok: false, reason: "no_audio_in_output" };
    return { ok: true, audio };
  } catch (err) {
    console.error("[tts/xtts] fetch failed:", err);
    return { ok: false, reason: "fetch_error" };
  }
}

// ───────────────────────────────────────────────────────────────────
// Provider: OpenAI TTS (tts-1, cheap + rock-solid)
// ───────────────────────────────────────────────────────────────────
async function synthesizeViaOpenAI(text: string, speed: number): Promise<
  | { ok: true; audio: ArrayBuffer }
  | { ok: false; reason: string; status?: number }
> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return { ok: false, reason: "not_configured" };

  const voice = process.env.OPENAI_TTS_VOICE || DEFAULT_OPENAI_VOICE;

  try {
    const res = await fetch("https://api.openai.com/v1/audio/speech", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "tts-1", // tts-1 optimizes for latency; tts-1-hd is slower
        voice, // alloy | echo | fable | onyx | nova | shimmer
        input: text,
        response_format: "mp3",
        speed, // snappier default — human tempo ≈ 1.15
      }),
    });
    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      console.error("[tts/openai]", res.status, errText.slice(0, 300));
      return { ok: false, reason: `http_${res.status}`, status: res.status };
    }
    const audio = await res.arrayBuffer();
    return { ok: true, audio };
  } catch (err) {
    console.error("[tts/openai] fetch failed:", err);
    return { ok: false, reason: "fetch_error" };
  }
}

// ───────────────────────────────────────────────────────────────────
// Provider: ElevenLabs (commercial, paid)
// ───────────────────────────────────────────────────────────────────
async function synthesizeViaElevenLabs(
  text: string,
  overrideVoiceId?: string,
): Promise<
  | { ok: true; audio: ArrayBuffer }
  | { ok: false; reason: string; status?: number }
> {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) return { ok: false, reason: "not_configured" };

  const voiceId =
    overrideVoiceId || process.env.ELEVENLABS_VOICE_ID || DEFAULT_ELEVENLABS_VOICE_ID;

  try {
    const res = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}?output_format=mp3_44100_128`,
      {
        method: "POST",
        headers: {
          "xi-api-key": apiKey,
          "Content-Type": "application/json",
          Accept: "audio/mpeg",
        },
        body: JSON.stringify({
          text,
          model_id: "eleven_turbo_v2_5",
          voice_settings: {
            stability: 0.7,
            similarity_boost: 0.8,
            style: 0.0,
            use_speaker_boost: true,
          },
        }),
      },
    );

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      console.error("[tts/elevenlabs]", res.status, errText.slice(0, 300));
      return { ok: false, reason: `http_${res.status}`, status: res.status };
    }

    const audio = await res.arrayBuffer();
    return { ok: true, audio };
  } catch (err) {
    console.error("[tts/elevenlabs] fetch failed:", err);
    return { ok: false, reason: "fetch_error" };
  }
}

// ───────────────────────────────────────────────────────────────────
function base64ToArrayBuffer(b64: string): ArrayBuffer {
  // Strip data: prefix if present
  const cleaned = b64.replace(/^data:[^;]+;base64,/, "");
  const binary = Buffer.from(cleaned, "base64");
  return binary.buffer.slice(
    binary.byteOffset,
    binary.byteOffset + binary.byteLength,
  );
}

// ───────────────────────────────────────────────────────────────────
export async function POST(request: NextRequest) {
  const supabase = createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { text?: unknown; voice_id?: unknown; speed?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const text = typeof body.text === "string" ? body.text.trim() : "";
  if (!text) return NextResponse.json({ error: "text required" }, { status: 400 });
  if (text.length > MAX_TEXT_LENGTH) {
    return NextResponse.json(
      { error: `text too long (max ${MAX_TEXT_LENGTH} chars)` },
      { status: 400 },
    );
  }
  const overrideVoice =
    typeof body.voice_id === "string" && body.voice_id ? body.voice_id : undefined;
  // Voice speed: clamp to OpenAI's safe range [0.7, 1.3]. 1.15 default.
  const requestedSpeed = typeof body.speed === "number" ? body.speed : DEFAULT_VOICE_SPEED;
  const speed = Math.max(0.7, Math.min(1.3, requestedSpeed));

  // Provider order. Default: XTTS (free) → OpenAI (cheap+reliable) →
  // ElevenLabs (premium fallback). Override via TRINITY_TTS_PROVIDER.
  type Provider = "xtts" | "openai" | "elevenlabs";
  const forced = process.env.TRINITY_TTS_PROVIDER as Provider | undefined;
  const providers: Provider[] =
    forced === "elevenlabs"
      ? ["elevenlabs", "openai", "xtts"]
      : forced === "openai"
        ? ["openai", "xtts", "elevenlabs"]
        : forced === "xtts"
          ? ["xtts", "openai", "elevenlabs"]
          : ["xtts", "openai", "elevenlabs"];

  const attempts: Array<{ provider: string; reason: string; status?: number }> = [];

  for (const provider of providers) {
    const result =
      provider === "xtts"
        ? await synthesizeViaRunpodXTTS(text)
        : provider === "openai"
          ? await synthesizeViaOpenAI(text, speed)
          : await synthesizeViaElevenLabs(text, overrideVoice);

    if (result.ok) {
      console.warn(`[tts] served via ${provider} (${result.audio.byteLength} bytes)`);
      return new NextResponse(result.audio, {
        status: 200,
        headers: {
          "Content-Type": "audio/mpeg",
          "Cache-Control": "no-store",
          "X-TTS-Provider": provider,
        },
      });
    }
    const statusField =
      "status" in result && typeof result.status === "number" ? result.status : undefined;
    attempts.push({
      provider,
      reason: result.reason,
      status: statusField,
    });
    // Non-config failures: keep trying next provider.
    if (result.reason !== "not_configured") {
      console.warn(`[tts] ${provider} failed (${result.reason}), trying next`);
    }
  }

  // All providers failed. Client will fall back to browser SpeechSynthesis.
  return NextResponse.json(
    {
      error: "No TTS provider available",
      attempts,
      hint: "Set OPENAI_API_KEY (easy, $0.015/1k chars) or RUNPOD_XTTS_URL (free). ElevenLabs 402 = quota exhausted.",
    },
    { status: attempts.every((a) => a.reason === "not_configured") ? 501 : 502 },
  );
}
