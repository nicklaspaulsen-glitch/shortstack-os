import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

// Text-to-speech proxy that calls ElevenLabs and streams back MP3 audio.
// Used by the Trinity orb to speak replies with a natural voice instead of
// the browser's built-in SpeechSynthesis (which is robotic on most systems).
//
// Required env vars:
//   ELEVENLABS_API_KEY
//   ELEVENLABS_VOICE_ID (optional, defaults to Rachel — warm female voice)

export const runtime = "nodejs";
// ElevenLabs usually responds in <5s for short text; give ourselves room.
export const maxDuration = 30;

const MAX_TEXT_LENGTH = 2000;
// Charlotte — calm, composed, British-accented female. Closest match to
// a "Jarvis-but-female" vibe out of ElevenLabs' stock voices.
// Override per-deploy via ELEVENLABS_VOICE_ID.
const DEFAULT_VOICE_ID = "XB0fDUnXU5powFXDhCwa";

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

  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) {
    // Client falls back to browser SpeechSynthesis if we return 501.
    return NextResponse.json(
      { error: "TTS not configured — set ELEVENLABS_API_KEY." },
      { status: 501 },
    );
  }

  const voiceId =
    (typeof body.voice_id === "string" && body.voice_id) ||
    process.env.ELEVENLABS_VOICE_ID ||
    DEFAULT_VOICE_ID;

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
          // turbo v2_5 is fast + cheap + sounds good; flash_v2_5 is even faster
          // but slightly lower quality.
          model_id: "eleven_turbo_v2_5",
          // Tuned for a calm, composed "digital assistant" delivery —
          // higher stability for consistent prosody, lower style for neutral
          // affect, speaker-boost on for clarity.
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
      console.error("[tts/speak] ElevenLabs error:", res.status, errText.slice(0, 300));
      return NextResponse.json(
        { error: `ElevenLabs returned ${res.status}` },
        { status: 502 },
      );
    }

    const audio = await res.arrayBuffer();
    return new NextResponse(audio, {
      status: 200,
      headers: {
        "Content-Type": "audio/mpeg",
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    console.error("[tts/speak] fetch failed:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "TTS request failed" },
      { status: 502 },
    );
  }
}
