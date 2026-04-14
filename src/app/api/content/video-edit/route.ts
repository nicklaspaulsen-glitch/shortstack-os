import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { checkAiRateLimit } from "@/lib/api-rate-limit";

// AI Video Editing Assistant — Generates edit plans, captions, cut lists, VFX/SFX suggestions
export async function POST(request: NextRequest) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase.from("profiles").select("plan_tier").eq("id", user.id).single();
  const limited = checkAiRateLimit(user.id, profile?.plan_tier);
  if (limited) return limited;

  const { transcript, video_type, duration, client_name, topic, style } = await request.json();

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "AI not configured" }, { status: 500 });

  const isShortForm = video_type === "short_form" || (duration && duration < 90);

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: 4000,
      system: `You are a professional video editor and content strategist. You create viral ${isShortForm ? "short-form (30-60s)" : "long-form (8-15 min)"} video edit plans. Return valid JSON only.`,
      messages: [{ role: "user", content: `Create a complete video edit plan for ${client_name || "a client"}.
Topic: ${topic || "marketing tips"}
Style: ${style || "fast-paced, engaging, professional"}
Type: ${isShortForm ? "Short-form (TikTok/Reels/Shorts)" : "Long-form (YouTube)"}
${transcript ? `Transcript/Script:\n${transcript}` : ""}

Return JSON with:
- title: catchy title
- hook: first 3 seconds text (for short-form) or intro hook (for long-form)
- cut_list: array of {timestamp, action, description, duration_seconds} — specific cuts, transitions, zooms
- captions: array of {start_time, end_time, text, style} — full caption track with emphasis words in CAPS
- b_roll_suggestions: array of {timestamp, description, source_suggestion} — what b-roll to use and where
- vfx: array of {timestamp, effect, description} — visual effects (zoom, shake, blur, speed ramp, split screen, etc)
- sfx: array of {timestamp, sound, description} — sound effects (whoosh, pop, ding, bass drop, etc)
- music_suggestions: array of {section, mood, bpm_range, genre} — background music per section
- thumbnail: {text, visual_description, colors}
- export_settings: {resolution, fps, aspect_ratio, format}
- editing_notes: string — overall direction for the editor
${isShortForm ? "- trending_elements: array of trending TikTok/Reels elements to use (text styles, transitions, memes)" : "- chapters: array of {timestamp, title} for YouTube chapters"}` }],
    }),
  });

  const data = await res.json();
  const text = data.content?.[0]?.text || "{}";
  const cleaned = text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();

  try {
    const editPlan = JSON.parse(cleaned);

    // Save as content script
    await supabase.from("content_scripts").insert({
      title: editPlan.title || `${topic} — Edit Plan`,
      script_type: isShortForm ? "short_form" : "long_form",
      script_body: JSON.stringify(editPlan, null, 2),
      hook: editPlan.hook,
      outline: editPlan,
      thumbnail_idea: editPlan.thumbnail ? `${editPlan.thumbnail.text} — ${editPlan.thumbnail.visual_description}` : null,
      status: "editing",
    });

    return NextResponse.json({ success: true, editPlan });
  } catch {
    return NextResponse.json({ success: true, editPlan: { raw: text } });
  }
}
