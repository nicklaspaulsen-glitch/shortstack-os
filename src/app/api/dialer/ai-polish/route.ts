import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { getEffectiveOwnerId } from "@/lib/security/require-owned-client";
import { anthropic, MODEL_HAIKU, getResponseText } from "@/lib/ai/claude-helpers";

interface PolishRequest {
  text: string;
  channel: "sms" | "dm";
  platform?: string;
  context?: string;
}

// POST /api/dialer/ai-polish
// One-shot Claude Haiku rewrite for the dialer's "Polish this SMS / DM"
// button. Cheap (Haiku ~$0.0002 per call), bounded by max_tokens=200, and
// gated behind auth. Returns { text } with the polished copy.
//
// Why a separate endpoint: lets us iterate on the system prompt + cap
// per-tenant calls in the future without touching the SMS send routes.
export async function POST(request: NextRequest) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const ownerId = await getEffectiveOwnerId(supabase, user.id);
  if (!ownerId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = (await request.json().catch(() => ({}))) as Partial<PolishRequest>;
  const text = (body.text || "").trim();
  if (!text) {
    return NextResponse.json({ error: "Empty text" }, { status: 400 });
  }
  if (text.length > 4000) {
    return NextResponse.json({ error: "Text too long (>4000 chars)" }, { status: 400 });
  }
  const channel = body.channel === "dm" ? "dm" : "sms";

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: "AI not configured" }, { status: 503 });
  }

  const charLimit = channel === "sms" ? 160 : 500;
  const platformNote = body.platform ? ` Platform: ${body.platform}.` : "";
  const ctxNote = body.context ? ` Recipient context: ${body.context}.` : "";

  try {
    const res = await anthropic.messages.create({
      model: MODEL_HAIKU,
      max_tokens: 200,
      system:
        channel === "sms"
          ? "You polish cold-outreach SMS messages. Keep them short, natural, conversational. No emojis. No marketing-speak. Output the polished SMS only — no preamble, no quotes."
          : "You polish cold-outreach direct messages. Keep them friendly, specific, low-pressure. No emojis. No spam phrases. Output the polished DM only — no preamble, no quotes.",
      messages: [
        {
          role: "user",
          content: `Rewrite this ${channel.toUpperCase()} to be more compelling and natural. Stay under ${charLimit} characters.${platformNote}${ctxNote}\n\nOriginal:\n${text}`,
        },
      ],
    });

    const polished = getResponseText(res).trim();
    if (!polished) {
      return NextResponse.json({ error: "AI returned empty response" }, { status: 502 });
    }

    return NextResponse.json({ text: polished });
  } catch (err) {
    console.error("[dialer/ai-polish] claude error:", err);
    return NextResponse.json({ error: "AI polish failed" }, { status: 502 });
  }
}
