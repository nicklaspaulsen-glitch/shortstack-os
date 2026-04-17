import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase, createServiceClient } from "@/lib/supabase/server";
import { checkAiRateLimit } from "@/lib/api-rate-limit";
import {
  anthropic,
  MODEL_HAIKU,
  safeJsonParse,
  getResponseText,
} from "@/lib/ai/claude-helpers";

type ComposeMode = "write" | "improve" | "shorten" | "lengthen" | "tone";
type ComposeTone = "professional" | "friendly" | "casual" | "urgent" | "persuasive";
type ComposeLength = "short" | "medium" | "long";

interface ComposeInput {
  mode: ComposeMode;
  prompt?: string;
  existing_email?: string;
  tone?: ComposeTone;
  audience?: string;
  length?: ComposeLength;
}

interface ComposeOutput {
  subject: string;
  body: string;
  cta?: string;
}

const SYSTEM_PROMPT = `You are an expert email copywriter with over a decade of experience driving measurable results for B2B and B2C clients. Generate compelling emails that drive action.

EMAIL PRINCIPLES
1. Subject line under 60 characters, specific, curiosity-driven, benefit-led
2. Open with a personalized hook — never "I hope this email finds you well"
3. Lead with value, not features. Address the reader's problem first.
4. Short paragraphs (1-3 sentences). Scannable on mobile.
5. One clear call to action. Remove every sentence that doesn't support it.
6. Conversational tone (unless "urgent" or "professional" is explicitly requested)
7. End with a specific next step, not "let me know"

MODE BEHAVIOR
- write: Generate a new email from the prompt
- improve: Rewrite the existing email to be stronger (clearer, tighter, more persuasive)
- shorten: Cut length by ~40% without losing the key message
- lengthen: Add context, proof, or detail to strengthen the email
- tone: Rewrite in the specified tone, keeping the message intact

OUTPUT FORMAT
Respond with ONLY raw JSON (no markdown fences, no commentary):
{
  "subject": "<subject line under 60 chars>",
  "body": "<email body as plain text with double line breaks between paragraphs>",
  "cta": "<call to action sentence, optional>"
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

  let body: ComposeInput;
  try {
    body = (await request.json()) as ComposeInput;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const mode = body.mode;
  if (!["write", "improve", "shorten", "lengthen", "tone"].includes(mode)) {
    return NextResponse.json(
      { error: "mode must be one of: write | improve | shorten | lengthen | tone" },
      { status: 400 }
    );
  }

  if (mode === "write" && !body.prompt?.trim()) {
    return NextResponse.json(
      { error: "prompt is required when mode is 'write'" },
      { status: 400 }
    );
  }

  if (mode !== "write" && !body.existing_email?.trim()) {
    return NextResponse.json(
      { error: "existing_email is required for improve / shorten / lengthen / tone modes" },
      { status: 400 }
    );
  }

  const toneHint = body.tone ?? "professional";
  const audienceHint = body.audience ?? "general business audience";
  const lengthHint = body.length ?? "medium";

  const userPrompt = (() => {
    switch (mode) {
      case "write":
        return `Write a new email.

REQUEST: ${body.prompt}
TONE: ${toneHint}
AUDIENCE: ${audienceHint}
TARGET LENGTH: ${lengthHint === "short" ? "under 80 words" : lengthHint === "long" ? "180-260 words" : "100-160 words"}

Compose it now. JSON only.`;
      case "improve":
        return `Rewrite the following email to be stronger — clearer, tighter, more persuasive.

TONE: ${toneHint}
AUDIENCE: ${audienceHint}

=== EXISTING EMAIL ===
${body.existing_email}
=== END ===

JSON only.`;
      case "shorten":
        return `Shorten this email by roughly 40% while preserving the core message and call to action.

=== EXISTING EMAIL ===
${body.existing_email}
=== END ===

JSON only.`;
      case "lengthen":
        return `Lengthen this email with additional context, social proof, or detail that strengthens the pitch.

TONE: ${toneHint}
AUDIENCE: ${audienceHint}

=== EXISTING EMAIL ===
${body.existing_email}
=== END ===

JSON only.`;
      case "tone":
        return `Rewrite this email in a ${toneHint} tone. Keep the message intact; change only the voice.

AUDIENCE: ${audienceHint}

=== EXISTING EMAIL ===
${body.existing_email}
=== END ===

JSON only.`;
    }
  })();

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
    const parsed = safeJsonParse<ComposeOutput>(text);

    if (!parsed || typeof parsed.subject !== "string" || typeof parsed.body !== "string") {
      return NextResponse.json(
        { error: "Claude returned an invalid response", raw: text.slice(0, 500) },
        { status: 502 }
      );
    }

    const out: ComposeOutput = {
      subject: parsed.subject.trim(),
      body: parsed.body.trim(),
      cta: parsed.cta?.trim() || undefined,
    };

    const serviceSupabase = createServiceClient();
    void serviceSupabase.from("trinity_log").insert({
      action_type: "ai_email_compose",
      description: `Email compose (${mode}): ${(body.prompt ?? body.existing_email ?? "").slice(0, 80)}`,
      profile_id: user.id,
      status: "completed",
      result: {
        mode,
        tone: body.tone,
        audience: body.audience,
        length: body.length,
        subject: out.subject,
        generated_at: new Date().toISOString(),
      },
    });

    return NextResponse.json(out);
  } catch (err) {
    console.error("[emails/compose] error", err);
    const message = err instanceof Error ? err.message : "Unknown Claude API error";
    return NextResponse.json(
      { error: "Failed to compose email", detail: message },
      { status: 500 }
    );
  }
}
