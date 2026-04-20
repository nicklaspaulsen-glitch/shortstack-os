import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

// Text-to-speech proxy. Tries providers in order of preference:
//   1. Runpod XTTS v2   — self-hosted, free, natural voice cloning
//   2. ElevenLabs       — commercial, highest quality, paid per character
//   3. 501 (client falls back to browser SpeechSynthesis)
//
// Env vars:
//   RUNPOD_XTTS_URL + RUNPOD_API_KEY   — primary path
//   ELEVENLABS_API_KEY                 — secondary
//   ELEVENLABS_VOICE_ID                — override voice (defaults to Charlotte)
//   TRINITY_TTS_PROVIDER=elevenlabs    — force ElevenLabs first (dev/testing)

export const runtime = "nodejs";
export const maxDuration = 30;

const MAX_TEXT_LENGTH = 2000;
// Charlotte — calm, composed, British-accented female. Jarvis-but-female vibe.
const DEFAULT_ELEVENLABS_VOICE_ID = "XB0fDUnXU5powFXDhCwa";

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

  let body: { text?: unknown; voice_id?: unknown };
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

  // Provider order. Default: XTTS (free) → ElevenLabs (paid backup).
  // Override via TRINITY_TTS_PROVIDER=elevenlabs for testing.
  const preferElevenLabs = process.env.TRINITY_TTS_PROVIDER === "elevenlabs";
  const providers = preferElevenLabs
    ? ["elevenlabs" as const, "xtts" as const]
    : ["xtts" as const, "elevenlabs" as const];

  const attempts: Array<{ provider: string; reason: string; status?: number }> = [];

  for (const provider of providers) {
    const result =
      provider === "xtts"
        ? await synthesizeViaRunpodXTTS(text)
        : await synthesizeViaElevenLabs(text, overrideVoice);

    if (result.ok) {
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
      hint: "Check RUNPOD_XTTS_URL or ELEVENLABS_API_KEY. If ElevenLabs returned 402, your quota is exhausted.",
    },
    { status: attempts.every((a) => a.reason === "not_configured") ? 501 : 502 },
  );
}
