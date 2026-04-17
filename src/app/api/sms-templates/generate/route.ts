import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase, createServiceClient } from "@/lib/supabase/server";
import { checkAiRateLimit } from "@/lib/api-rate-limit";
import {
  anthropic,
  MODEL_HAIKU,
  safeJsonParse,
  getResponseText,
} from "@/lib/ai/claude-helpers";

type SmsIntent =
  | "reminder"
  | "promo"
  | "confirmation"
  | "welcome"
  | "winback"
  | "abandon_cart"
  | "appointment"
  | "custom";

interface SmsGenerateInput {
  intent: SmsIntent;
  goal?: string;
  audience?: string;
  include_link?: boolean;
  tone?: string;
}

interface SmsMessage {
  text: string;
  char_count: number;
  segments: number;
  compliance_notes: string[];
  tone: string;
}

interface SmsGenerateOutput {
  messages: SmsMessage[];
}

const SYSTEM_PROMPT = `You are an SMS marketing specialist with deep expertise in TCPA, CTIA, and carrier compliance. You write messages that are concise, compliant, and drive action. You write SMS messages that feel personal, respect the 160-character limit, and always include compliance cues.

SMS PRINCIPLES
1. Under 160 characters per message (soft target — hard max 320 = 2 segments, avoid going over)
2. Every first-touch message includes opt-out ("Reply STOP") and business identifier
3. Use the recipient's first name when available via merge tag {first_name}
4. Include a link only if include_link is true. Use short placeholder like {link}.
5. No ALL CAPS, no more than one exclamation mark, no emojis overload.
6. Time-sensitive content gets a clear when/by-when anchor.
7. For carts, appointments, and confirmations: lead with the concrete detail, not a greeting.

SEGMENT CALCULATION
- 1-160 chars = 1 segment
- 161-306 chars = 2 segments
- 307-459 chars = 3 segments
(Using GSM-7 encoding. Assume no Unicode / emoji for this calc.)

COMPLIANCE NOTES (include 1-3 relevant items per message)
- "Includes STOP opt-out"
- "Identifies sending business"
- "Time-sensitive content has clear anchor"
- "First message of program: opt-out required"
- "No claims that require disclosure"
- "Within 8am-9pm recipient local time"

OUTPUT FORMAT
Respond with ONLY raw JSON (no markdown fences, no commentary):
{
  "messages": [
    {
      "text": "<SMS text>",
      "char_count": <number>,
      "segments": <number>,
      "compliance_notes": ["<note 1>", "<note 2>"],
      "tone": "<tone label>"
    }
  ]
}`;

function countSegments(text: string): number {
  const len = text.length;
  if (len === 0) return 0;
  if (len <= 160) return 1;
  return Math.ceil(len / 153);
}

export async function POST(request: NextRequest) {
  const authSupabase = createServerSupabase();
  const {
    data: { user },
  } = await authSupabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: profile } = await authSupabase
    .from("profiles")
    .select("plan_tier")
    .eq("id", user.id)
    .single();
  const limited = checkAiRateLimit(user.id, profile?.plan_tier);
  if (limited) return limited;

  let body: SmsGenerateInput;
  try {
    body = (await request.json()) as SmsGenerateInput;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const allowed: SmsIntent[] = [
    "reminder", "promo", "confirmation", "welcome", "winback", "abandon_cart", "appointment", "custom",
  ];
  if (!allowed.includes(body.intent)) {
    return NextResponse.json({ error: "Invalid intent" }, { status: 400 });
  }

  const userPrompt = `Generate 3 SMS message variants.

INTENT: ${body.intent}
GOAL: ${body.goal ?? "Drive the primary action for this intent"}
AUDIENCE: ${body.audience ?? "general customer audience"}
INCLUDE LINK: ${body.include_link ? "Yes — use {link} placeholder" : "No link"}
TONE: ${body.tone ?? "friendly and direct"}

Each must be under 160 characters. Include STOP opt-out on first-touch intents (welcome, promo, winback). JSON only.`;

  try {
    const response = await anthropic.messages.create({
      model: MODEL_HAIKU,
      max_tokens: 1500,
      system: [
        {
          type: "text",
          text: SYSTEM_PROMPT,
          cache_control: { type: "ephemeral" },
        },
      ],
      messages: [{ role: "user", content: userPrompt }],
    });

    const text = getResponseText(response);
    const parsed = safeJsonParse<SmsGenerateOutput>(text);

    if (!parsed || !Array.isArray(parsed.messages)) {
      return NextResponse.json(
        { error: "Claude returned an invalid response", raw: text.slice(0, 500) },
        { status: 502 }
      );
    }

    const messages: SmsMessage[] = parsed.messages
      .filter((m): m is SmsMessage => !!m && typeof m.text === "string")
      .slice(0, 5)
      .map((m) => {
        const trimmed = m.text.trim();
        return {
          text: trimmed,
          char_count: trimmed.length,
          segments: countSegments(trimmed),
          compliance_notes: Array.isArray(m.compliance_notes)
            ? m.compliance_notes.slice(0, 5).map((n) => String(n).trim()).filter(Boolean)
            : [],
          tone: m.tone?.trim() || body.tone || "friendly",
        };
      });

    const serviceSupabase = createServiceClient();
    void serviceSupabase.from("trinity_log").insert({
      action_type: "ai_sms_template_generate",
      description: `SMS templates (${messages.length}) — ${body.intent}`,
      profile_id: user.id,
      status: "completed",
      result: {
        intent: body.intent,
        goal: body.goal,
        audience: body.audience,
        count: messages.length,
        include_link: body.include_link ?? false,
        generated_at: new Date().toISOString(),
      },
    });

    return NextResponse.json({ messages });
  } catch (err) {
    console.error("[sms-templates/generate] error", err);
    const message = err instanceof Error ? err.message : "Unknown Claude API error";
    return NextResponse.json(
      { error: "Failed to generate SMS templates", detail: message },
      { status: 500 }
    );
  }
}
