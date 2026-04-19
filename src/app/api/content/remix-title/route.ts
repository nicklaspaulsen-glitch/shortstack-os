import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { anthropic, MODEL_HAIKU, safeJsonParse, getResponseText } from "@/lib/ai/claude-helpers";

/**
 * POST /api/content/remix-title
 *
 * "Find a better title" sparkle button. Takes the current platform title and
 * any file context, asks Claude Haiku for 3 higher-performing alternatives
 * tuned to the platform's norms. Returns { alternatives: string[] }.
 *
 * Body: { platform, current_title, file_context? }
 */
export async function POST(request: NextRequest) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: "AI not configured" }, { status: 500 });
  }

  const body = await request.json();
  const { platform, current_title, file_context } = body || {};

  if (!platform || !current_title) {
    return NextResponse.json({ error: "platform and current_title required" }, { status: 400 });
  }

  const platformHint = getPlatformHint(String(platform).toLowerCase());

  const systemPrompt = `You are a viral title specialist. For the platform "${platform}", you write titles that crush the algorithm while remaining honest and on-brand. ${platformHint} Return ONLY valid JSON with no markdown fences.`;

  const userPrompt = `Current title: "${current_title}"
Platform: ${platform}
${file_context ? `File context: ${typeof file_context === "string" ? file_context : JSON.stringify(file_context).slice(0, 1000)}` : ""}

Produce 3 alternative titles that would likely outperform the current one on ${platform}. Each should be distinct in angle (e.g. curiosity, bold claim, listicle, question). Do NOT repeat the current title.

Return JSON: { "alternatives": ["title 1", "title 2", "title 3"] }`;

  try {
    const response = await anthropic.messages.create({
      model: MODEL_HAIKU,
      max_tokens: 400,
      system: systemPrompt,
      messages: [{ role: "user", content: userPrompt }],
    });
    const raw = getResponseText(response);
    const parsed = safeJsonParse<{ alternatives?: unknown }>(raw);
    const alternatives = Array.isArray(parsed?.alternatives)
      ? (parsed!.alternatives as unknown[]).map((v) => String(v)).filter(Boolean).slice(0, 3)
      : [];

    if (alternatives.length === 0) {
      return NextResponse.json({ error: "AI returned no alternatives", raw }, { status: 502 });
    }

    return NextResponse.json({ success: true, alternatives });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}

function getPlatformHint(platform: string): string {
  switch (platform) {
    case "youtube":
      return "YouTube titles reward curiosity gaps, numbers, and benefit-driven clarity. Aim for 50-70 chars.";
    case "instagram":
      return "Instagram titles/hooks should be short, punchy, and emotional — under 60 chars.";
    case "tiktok":
      return "TikTok titles are scroll-stoppers — conversational, pattern-interrupt, often use POV / wait… / nobody talks about…";
    case "linkedin":
      return "LinkedIn titles are professional but bold — a controversial take or hard-won lesson works well.";
    case "twitter":
    case "x":
      return "Twitter/X titles are punchy one-liners, often hot takes or setups for a thread.";
    default:
      return "";
  }
}
