import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { anthropic, MODEL_HAIKU, safeJsonParse, getResponseText } from "@/lib/ai/claude-helpers";
import { checkAiRateLimit } from "@/lib/api-rate-limit";

/**
 * POST — AI Reply Drafter.
 * Given a received DM and context, returns 3 reply options with different tones.
 */

const SYSTEM_PROMPT = `You are an expert sales DM reply drafter for a digital-agency operator. Given an inbound DM and campaign context, craft 3 short, authentic reply drafts in different tones (friendly, direct, casual). Keep each reply under 280 characters, sound human, reference the prospect's reply specifically, and move the conversation toward a call or discovery question when natural.

Return strict JSON only:
{
  "replies": [
    { "tone": "friendly", "text": "string", "cta": "string" },
    { "tone": "direct", "text": "string", "cta": "string" },
    { "tone": "casual", "text": "string", "cta": "string" }
  ],
  "intent_detected": "interested" | "curious" | "objection" | "not_interested" | "ready_to_buy" | "needs_info",
  "suggested_next_step": "book_call" | "send_info" | "qualify" | "nurture" | "close" | "disqualify",
  "one_line_summary": "short summary of what they said"
}`;

export async function POST(req: NextRequest) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const limited = checkAiRateLimit(user.id);
  if (limited) return limited;

  const body = await req.json();
  const { inbound_message, platform, prospect_handle, business_name, original_message, brand_voice } = body as {
    inbound_message?: string;
    platform?: string;
    prospect_handle?: string;
    business_name?: string;
    original_message?: string;
    brand_voice?: string;
  };

  if (!inbound_message) return NextResponse.json({ error: "inbound_message required" }, { status: 400 });

  const userPrompt = `Draft 3 replies for this inbound DM.

PLATFORM: ${platform || "instagram"}
PROSPECT: ${prospect_handle || "unknown"}
BUSINESS: ${business_name || "unknown"}
BRAND VOICE: ${brand_voice || "warm, confident, low-pressure"}

OUR ORIGINAL DM:
"${original_message || "(not provided)"}"

THEIR REPLY:
"${inbound_message}"

Draft 3 reply options in JSON.`;

  try {
    const resp = await anthropic.messages.create({
      model: MODEL_HAIKU,
      max_tokens: 900,
      system: [{ type: "text", text: SYSTEM_PROMPT, cache_control: { type: "ephemeral" } }],
      messages: [{ role: "user", content: userPrompt }],
    });

    const text = getResponseText(resp);
    const parsed = safeJsonParse<{
      replies: { tone: string; text: string; cta: string }[];
      intent_detected: string;
      suggested_next_step: string;
      one_line_summary: string;
    }>(text);

    if (!parsed) return NextResponse.json({ error: "AI returned invalid format" }, { status: 502 });

    return NextResponse.json({ success: true, ...parsed });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed" }, { status: 500 });
  }
}
