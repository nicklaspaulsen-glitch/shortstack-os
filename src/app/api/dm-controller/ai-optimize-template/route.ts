import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { anthropic, MODEL_HAIKU, safeJsonParse, getResponseText } from "@/lib/ai/claude-helpers";
import { checkAiRateLimit } from "@/lib/api-rate-limit";

/**
 * POST — AI Template Optimizer.
 * Takes a DM template + niche + brand voice and rewrites it for higher reply rate,
 * plus returns a "safety score" and predicted reply-rate lift.
 */

const SYSTEM_PROMPT = `You are an elite cold-DM copywriter. Improve cold DM templates for reply rate while keeping them compliant, human, and non-spammy. Follow these rules:
- Under 350 characters.
- Personalized opener that references the prospect.
- Specific value prop (no vague "grow your business").
- Soft CTA (a question beats a pitch).
- Use variables like {name}, {business_name}, {industry}, {city} where helpful.
- No emojis unless the tone truly calls for it.
- No exclamation stacks, ALL CAPS, or obvious sales-bot phrases.

Return strict JSON only:
{
  "optimized_template": "the rewritten DM",
  "variables_used": ["string"],
  "predicted_reply_lift_pct": 0 to 300,
  "safety_score": 0 to 100,
  "safety_rating": "green" | "amber" | "red",
  "improvements": ["bullet string"],
  "brand_voice_notes": "one-line voice summary",
  "alternate_hooks": ["string", "string"]
}`;

export async function POST(req: NextRequest) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const limited = checkAiRateLimit(user.id);
  if (limited) return limited;

  const body = await req.json();
  const { template, niche, service, tone, brand_voice, platform } = body as {
    template?: string;
    niche?: string;
    service?: string;
    tone?: string;
    brand_voice?: string;
    platform?: string;
  };

  if (!template) return NextResponse.json({ error: "template required" }, { status: 400 });

  const userPrompt = `Optimize this cold DM template.

PLATFORM: ${platform || "instagram"}
NICHE: ${niche || "general"}
SERVICE PITCHED: ${service || "unknown"}
TONE: ${tone || "friendly"}
BRAND VOICE: ${brand_voice || "warm, confident, low-pressure"}

ORIGINAL TEMPLATE:
"${template}"

Rewrite for higher reply rate and return JSON.`;

  try {
    const resp = await anthropic.messages.create({
      model: MODEL_HAIKU,
      max_tokens: 1100,
      system: [{ type: "text", text: SYSTEM_PROMPT, cache_control: { type: "ephemeral" } }],
      messages: [{ role: "user", content: userPrompt }],
    });

    const text = getResponseText(resp);
    const parsed = safeJsonParse<{
      optimized_template: string;
      variables_used: string[];
      predicted_reply_lift_pct: number;
      safety_score: number;
      safety_rating: string;
      improvements: string[];
      brand_voice_notes: string;
      alternate_hooks: string[];
    }>(text);

    if (!parsed) return NextResponse.json({ error: "AI returned invalid format" }, { status: 502 });

    return NextResponse.json({ success: true, ...parsed });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed" }, { status: 500 });
  }
}
