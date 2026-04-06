import { NextRequest, NextResponse } from "next/server";

// Text-to-Speech API — uses ElevenLabs for high-quality AI voice
// Falls back to 404 if not configured (browser TTS used instead)
export async function POST(request: NextRequest) {
  const { text } = await request.json();
  if (!text) return NextResponse.json({ error: "No text" }, { status: 400 });

  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "TTS not configured" }, { status: 404 });
  }

  // Default to a natural female voice (Rachel)
  const voiceId = process.env.ELEVENLABS_VOICE_ID || "21m00Tcm4TlvDq8ikWAM";

  try {
    const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "xi-api-key": apiKey,
      },
      body: JSON.stringify({
        text: text.substring(0, 1000), // Limit to 1000 chars
        model_id: "eleven_monolingual_v1",
        voice_settings: {
          stability: 0.5,
          similarity_boost: 0.75,
        },
      }),
    });

    if (!res.ok) {
      return NextResponse.json({ error: "TTS failed" }, { status: 500 });
    }

    const audioBuffer = await res.arrayBuffer();
    return new NextResponse(audioBuffer, {
      headers: {
        "Content-Type": "audio/mpeg",
        "Cache-Control": "public, max-age=3600",
      },
    });
  } catch {
    return NextResponse.json({ error: "TTS error" }, { status: 500 });
  }
}
