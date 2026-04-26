import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { checkAiRateLimit } from "@/lib/api-rate-limit";
import { synthesizeVoice } from "@/lib/voice";

// Text-to-Speech API — routes through the voice provider abstraction.
// Default order: RunPod XTTS (free) → OpenAI TTS (cheap) → ElevenLabs (premium).
// See `src/lib/voice/router.ts` for the routing logic.
export async function POST(request: NextRequest) {
  const supabase = createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase
    .from("profiles")
    .select("plan_tier")
    .eq("id", user.id)
    .single();
  const limited = checkAiRateLimit(user.id, profile?.plan_tier);
  if (limited) return limited;

  const { text } = await request.json();
  if (!text || typeof text !== "string") {
    return NextResponse.json({ error: "No text" }, { status: 400 });
  }

  try {
    const result = await synthesizeVoice({
      text: text.substring(0, 1000),
      userId: user.id,
      context: "preview",
    });
    return new NextResponse(new Uint8Array(result.audio), {
      headers: {
        "Content-Type": result.contentType,
        "Cache-Control": "public, max-age=3600",
        "X-TTS-Provider": result.provider,
      },
    });
  } catch (err) {
    console.error("[tts] synthesis failed:", err);
    return NextResponse.json(
      { error: "Text-to-speech service unavailable" },
      { status: 502 },
    );
  }
}
