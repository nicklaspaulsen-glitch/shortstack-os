import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { checkAiRateLimit } from "@/lib/api-rate-limit";

// POST — Generate newsletter content (subject lines, section copy, full drafts)
export async function POST(request: NextRequest) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Rate limit
  const { data: profile } = await supabase
    .from("profiles")
    .select("plan_tier")
    .eq("id", user.id)
    .single();
  const limited = checkAiRateLimit(user.id, profile?.plan_tier);
  if (limited) return limited;

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "AI not configured" }, { status: 500 });

  try {
    const { type, context, tone, audience } = await request.json();

    const prompts: Record<string, string> = {
      subject_line: `Generate 5 compelling email newsletter subject lines for: "${context || "a newsletter"}". Target audience: ${audience || "subscribers"}. Tone: ${tone || "professional"}. Return JSON: { "subjects": ["subject1", ...] }`,
      section_copy: `Write newsletter section copy for: "${context || "a content section"}". Tone: ${tone || "professional"}. Target audience: ${audience || "subscribers"}. Keep it concise (2-3 paragraphs max). Return JSON: { "content": "the html content with <p>, <strong>, <a> tags" }`,
      full_draft: `Write a complete newsletter draft about: "${context || "agency update"}". Tone: ${tone || "professional"}. Target audience: ${audience || "subscribers"}. Include: greeting, main content (2-3 sections), call to action, sign-off. Return JSON: { "subject": "subject line", "headline": "main headline", "sections": [{ "heading": "...", "content": "html content" }], "cta_text": "button text", "cta_url": "#" }`,
      headline: `Generate 5 newsletter headlines for: "${context || "a newsletter"}". Tone: ${tone || "professional"}. Return JSON: { "headlines": ["h1", ...] }`,
    };

    const prompt = prompts[type] || prompts.section_copy;

    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 1500,
        system: "You are a professional newsletter copywriter for a digital marketing agency called ShortStack. Write engaging, conversion-focused content. Always return valid JSON as specified in the prompt.",
        messages: [{ role: "user", content: prompt }],
      }),
    });

    const data = await res.json();
    const text = data.content?.[0]?.text || "{}";
    const cleaned = text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();

    try {
      const result = JSON.parse(cleaned);
      return NextResponse.json({ success: true, result, type });
    } catch {
      return NextResponse.json({ success: true, result: { content: text }, type });
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
