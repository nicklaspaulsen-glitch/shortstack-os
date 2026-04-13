import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

// Text-to-Speech API — uses ElevenLabs for high-quality AI voice
// TODO: Add rate limiting in production — TTS is expensive per request
export async function POST(request: NextRequest) {
  // Auth check — only authenticated users can use TTS
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { text } = await request.json();
  if (!text || typeof text !== "string") return NextResponse.json({ error: "No text" }, { status: 400 });

  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "TTS not configured" }, { status: 404 });
  }

  // Roger — Laid-back, casual, resonant male voice (great for assistant)
  const voiceId = process.env.ELEVENLABS_VOICE_ID || "CwhRBWXzGAHq8TQ4Fs17";

  try {
    const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "xi-api-key": apiKey,
      },
      body: JSON.stringify({
        text: text.substring(0, 1000),
        model_id: "eleven_flash_v2_5",
        voice_settings: {
          stability: 0.55,
          similarity_boost: 0.7,
          style: 0.3,
        },
      }),
    });

    if (!res.ok) {
      console.error("TTS failed:", await res.text());
      return NextResponse.json({ error: "Text-to-speech generation failed" }, { status: 500 });
    }

    const audioBuffer = await res.arrayBuffer();
    return new NextResponse(audioBuffer, {
      headers: {
        "Content-Type": "audio/mpeg",
        "Cache-Control": "public, max-age=3600",
      },
    });
  } catch (err) {
    console.error("TTS error:", err);
    return NextResponse.json({ error: "Text-to-speech service unavailable" }, { status: 500 });
  }
}
