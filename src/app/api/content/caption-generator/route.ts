import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

// AI Caption/Subtitle Generator — Creates timed captions from script or transcript
export async function POST(request: NextRequest) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { transcript, style, format } = await request.json();

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "AI not configured" }, { status: 500 });

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 3000,
      system: `You are a caption/subtitle specialist. Generate engaging, timed captions from transcripts. Style: ${style || "bold key words, viral TikTok style"}. Return valid JSON only.`,
      messages: [{ role: "user", content: `Generate captions from this transcript. Make them ${style || "punchy with emphasis on key words"}:

${transcript}

Return JSON with:
- captions: array of { start_time (e.g. "00:00:01"), end_time, text, emphasis_words: array (words to make BOLD/colored), animation: "pop" | "slide" | "fade" | "typewriter" }
- srt_content: full SRT subtitle file content as a string
- caption_style_guide: { font_recommendation, size, color, position, background }
- viral_hooks: array of 3 caption text options for the first 3 seconds` }],
    }),
  });

  const data = await res.json();
  const text = data.content?.[0]?.text || "{}";
  const cleaned = text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();

  try {
    const result = JSON.parse(cleaned);

    // If SRT format requested, return as downloadable file
    if (format === "srt" && result.srt_content) {
      return new NextResponse(result.srt_content, {
        headers: {
          "Content-Type": "text/plain",
          "Content-Disposition": 'attachment; filename="captions.srt"',
        },
      });
    }

    return NextResponse.json({ success: true, ...result });
  } catch {
    return NextResponse.json({ success: true, raw: text });
  }
}
