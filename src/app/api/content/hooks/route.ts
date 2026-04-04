import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

// AI Hook Generator — Creates viral hooks for any platform
export async function POST(request: NextRequest) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { topic, platform, industry, num_hooks } = await request.json();

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "AI not configured" }, { status: 500 });

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 2000,
      system: "You are a viral content hook specialist. Generate scroll-stopping hooks. Return valid JSON only.",
      messages: [{ role: "user", content: `Generate ${num_hooks || 20} viral hooks for ${platform || "TikTok/Reels"} about "${topic}" in the ${industry || "business"} niche.

Return JSON array of hooks, each with:
- hook: the full hook text (first 3 seconds)
- type: "question" | "bold_claim" | "story" | "controversy" | "tutorial" | "secret" | "challenge" | "before_after"
- platform_best: which platform this works best on
- estimated_engagement: "viral" | "high" | "medium"
- follow_up_line: what to say right after the hook
- why_it_works: psychology behind it` }],
    }),
  });

  const data = await res.json();
  const text = data.content?.[0]?.text || "[]";
  const cleaned = text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();

  try {
    return NextResponse.json({ success: true, hooks: JSON.parse(cleaned) });
  } catch {
    return NextResponse.json({ success: true, hooks: { raw: text } });
  }
}
