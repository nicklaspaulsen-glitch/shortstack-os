import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { synthesizeVoice, type VoiceProvider } from "@/lib/voice";

// Text-to-speech proxy. Routes through the voice provider abstraction
// (`src/lib/voice/router.ts`) which picks the cheapest available provider
// by default and falls through gracefully on failure.
//
// Default order: RunPod XTTS → OpenAI TTS → ElevenLabs.
// Premium opt-in via body `premium: true` flips ElevenLabs to first.
//
// Env vars:
//   RUNPOD_XTTS_URL + RUNPOD_API_KEY   — primary (free, needs worker)
//   OPENAI_API_KEY                     — secondary (reliable, cheap)
//   ELEVENLABS_API_KEY                 — premium (highest quality)
//   ELEVENLABS_VOICE_ID                — override voice (defaults to Charlotte)
//   OPENAI_TTS_VOICE                   — override OpenAI voice (defaults to nova)
//   VOICE_PROVIDER_DEFAULT             — `runpod_xtts` | `openai_tts` | `elevenlabs`
//   VOICE_PROVIDER_PREMIUM             — provider when `premium=true` body flag is set
//   TRINITY_TTS_PROVIDER               — legacy alias preserved for back-compat

export const runtime = "nodejs";
export const maxDuration = 30;

const MAX_TEXT_LENGTH = 2000;
const DEFAULT_VOICE_SPEED = Number(process.env.TTS_DEFAULT_SPEED) || 1.0;

export async function POST(request: NextRequest) {
  const supabase = createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: {
    text?: unknown;
    voice_id?: unknown;
    speed?: unknown;
    premium?: unknown;
    provider?: unknown;
    context?: unknown;
  };
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
  // Voice speed: clamp to OpenAI's safe range [0.7, 1.3]. 1.0 default.
  const requestedSpeed =
    typeof body.speed === "number" ? body.speed : DEFAULT_VOICE_SPEED;
  const speed = Math.max(0.7, Math.min(1.3, requestedSpeed));
  const premium = body.premium === true;
  const explicitProvider =
    typeof body.provider === "string" &&
    (body.provider === "runpod_xtts" ||
      body.provider === "openai_tts" ||
      body.provider === "elevenlabs")
      ? (body.provider as VoiceProvider)
      : undefined;
  const context =
    typeof body.context === "string" && body.context ? body.context : "tts_speak";

  try {
    const result = await synthesizeVoice(
      {
        text,
        voiceId: overrideVoice,
        speed,
        userId: user.id,
        context,
      },
      { prefer: explicitProvider, premium },
    );

    return new NextResponse(new Uint8Array(result.audio), {
      status: 200,
      headers: {
        "Content-Type": result.contentType,
        "Cache-Control": "no-store",
        "X-TTS-Provider": result.provider,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "synthesis_failed";
    console.error("[tts/speak] all providers failed:", message);
    return NextResponse.json(
      {
        error: "No TTS provider available",
        detail: message,
        hint: "Set OPENAI_API_KEY (easy, $0.015/1k chars) or RUNPOD_XTTS_URL (free). ElevenLabs 402 = quota exhausted.",
      },
      { status: 502 },
    );
  }
}
