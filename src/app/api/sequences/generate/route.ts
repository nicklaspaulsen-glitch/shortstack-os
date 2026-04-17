import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase, createServiceClient } from "@/lib/supabase/server";
import { checkAiRateLimit } from "@/lib/api-rate-limit";
import {
  anthropic,
  MODEL_SONNET,
  safeJsonParse,
  getResponseText,
} from "@/lib/ai/claude-helpers";

export const maxDuration = 60;

type SequenceChannel = "email" | "sms" | "dm";

interface SequenceGenerateInput {
  objective: string;
  audience: string;
  channels: SequenceChannel[];
  length_days?: number;
  tone?: string;
}

interface SequenceStep {
  step_number: number;
  delay_days: number;
  delay_hours: number;
  channel: string;
  subject?: string;
  message: string;
  condition?: string;
  goal: string;
}

interface SequenceGenerateOutput {
  name: string;
  description: string;
  steps: SequenceStep[];
}

const SYSTEM_PROMPT = `You are a B2B outreach sequence expert. You have built and optimized 1,000+ multi-touch sequences across email, SMS, and social DMs that consistently achieve 8-18% reply rates without being spammy. You design sequences that maximize response rates without being spammy.

SEQUENCE PRINCIPLES
1. Every touch should add new value — never just "bumping this to the top of your inbox"
2. Vary the channels to feel human, not automated
3. Space touches naturally: 1-3 days early, 3-7 days mid, 7-14 days late
4. Each message has a specific goal (introduce, give value, soft pitch, hard ask, break up)
5. Short messages outperform long ones, especially in SMS and DM
6. Use conditions to branch on engagement ("if no reply by step 3")
7. Include a credible break-up message at the end — it often gets the highest reply rate

CHANNEL RULES
- Email: subject line + 80-180 word body, mobile-friendly, one CTA
- SMS: under 160 characters total, include opt-out on first touch
- DM (LinkedIn / Instagram): 2-4 sentences, conversational, no links in first touch

STRUCTURE
- step_number: 1-indexed ordering
- delay_days / delay_hours: relative to the PREVIOUS step (step 1 is usually delay 0)
- channel: "email" | "sms" | "dm"
- subject: only for email
- message: the actual text of the touch
- condition: optional branching logic, e.g. "if no reply by step 3"
- goal: a short label of what this step achieves

OUTPUT FORMAT
Respond with ONLY raw JSON (no markdown fences, no commentary) matching:
{
  "name": "<short sequence name>",
  "description": "<one-sentence summary>",
  "steps": [
    {
      "step_number": 1,
      "delay_days": 0,
      "delay_hours": 0,
      "channel": "email",
      "subject": "<subject>",
      "message": "<body>",
      "condition": null,
      "goal": "introduce"
    }
  ]
}`;

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

  let body: SequenceGenerateInput;
  try {
    body = (await request.json()) as SequenceGenerateInput;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body.objective?.trim()) {
    return NextResponse.json({ error: "objective is required" }, { status: 400 });
  }
  if (!body.audience?.trim()) {
    return NextResponse.json({ error: "audience is required" }, { status: 400 });
  }
  if (!Array.isArray(body.channels) || body.channels.length === 0) {
    return NextResponse.json(
      { error: "channels must include at least one of 'email' | 'sms' | 'dm'" },
      { status: 400 }
    );
  }

  const validChannels = body.channels.filter((c) =>
    ["email", "sms", "dm"].includes(c)
  );
  if (validChannels.length === 0) {
    return NextResponse.json({ error: "No valid channels provided" }, { status: 400 });
  }

  const lengthDays = Math.max(1, Math.min(30, body.length_days ?? 7));

  const userPrompt = `Design a multi-touch outreach sequence.

OBJECTIVE: ${body.objective}
AUDIENCE: ${body.audience}
CHANNELS: ${validChannels.join(", ")}
LENGTH: ${lengthDays} days
TONE: ${body.tone ?? "professional but warm"}

Include a credible break-up message at the end. Use conditions where useful. JSON only.`;

  try {
    const response = await anthropic.messages.create({
      model: MODEL_SONNET,
      max_tokens: 4000,
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
    const parsed = safeJsonParse<SequenceGenerateOutput>(text);

    if (!parsed || !Array.isArray(parsed.steps) || parsed.steps.length === 0) {
      return NextResponse.json(
        { error: "Claude returned an invalid response", raw: text.slice(0, 500) },
        { status: 502 }
      );
    }

    const steps: SequenceStep[] = parsed.steps
      .filter(
        (s): s is SequenceStep =>
          !!s &&
          typeof s.message === "string" &&
          typeof s.channel === "string"
      )
      .map((s, i) => ({
        step_number: Number(s.step_number) || i + 1,
        delay_days: Math.max(0, Number(s.delay_days) || 0),
        delay_hours: Math.max(0, Number(s.delay_hours) || 0),
        channel: validChannels.includes(s.channel as SequenceChannel)
          ? s.channel
          : validChannels[0],
        subject: s.subject ? String(s.subject).trim() : undefined,
        message: s.message.trim(),
        condition: s.condition ? String(s.condition).trim() : undefined,
        goal: s.goal?.trim() || "engage",
      }));

    const out: SequenceGenerateOutput = {
      name: parsed.name?.trim() || `${body.objective.slice(0, 40)} Sequence`,
      description: parsed.description?.trim() || `${validChannels.join(" + ")} sequence`,
      steps,
    };

    const serviceSupabase = createServiceClient();
    void serviceSupabase.from("trinity_log").insert({
      action_type: "ai_sequence_generate",
      description: `Sequence generated: ${out.name}`,
      profile_id: user.id,
      status: "completed",
      result: {
        objective: body.objective,
        audience: body.audience,
        channels: validChannels,
        length_days: lengthDays,
        step_count: out.steps.length,
        generated_at: new Date().toISOString(),
      },
    });

    return NextResponse.json(out);
  } catch (err) {
    console.error("[sequences/generate] error", err);
    const message = err instanceof Error ? err.message : "Unknown Claude API error";
    return NextResponse.json(
      { error: "Failed to generate sequence", detail: message },
      { status: 500 }
    );
  }
}
