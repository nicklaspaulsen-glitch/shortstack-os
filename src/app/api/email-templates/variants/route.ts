import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase, createServiceClient } from "@/lib/supabase/server";
import { checkAiRateLimit } from "@/lib/api-rate-limit";
import {
  anthropic,
  MODEL_HAIKU,
  safeJsonParse,
  getResponseText,
} from "@/lib/ai/claude-helpers";

interface TemplateVariantsInput {
  template_body: string;
  count?: number;
}

interface TemplateVariant {
  subject: string;
  body: string;
  angle: string;
}

interface TemplateVariantsOutput {
  variants: TemplateVariant[];
}

const SYSTEM_PROMPT = `You are an A/B test strategist for email campaigns. You generate meaningfully distinct variants — each testing a different hypothesis — instead of trivial rewording.

VARIANT ANGLES TO CONSIDER
- benefit-led vs. problem-led opening
- social proof forward vs. promise forward
- scarcity / urgency vs. no-pressure
- story / anecdote vs. straight pitch
- question open vs. statement open
- short (under 100 words) vs. standard (100-180 words)

For each variant:
1. Keep the core message and CTA identical
2. Change the angle, subject, and body voicing
3. Subject line under 60 characters
4. Body written so it could be dropped in without touching merge tags

OUTPUT FORMAT
Respond with ONLY raw JSON (no markdown fences, no commentary):
{
  "variants": [
    {
      "subject": "<subject>",
      "body": "<body>",
      "angle": "<short label like 'social proof' or 'scarcity'>"
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

  let input: TemplateVariantsInput;
  try {
    input = (await request.json()) as TemplateVariantsInput;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!input.template_body?.trim()) {
    return NextResponse.json({ error: "template_body is required" }, { status: 400 });
  }

  const count = Math.max(2, Math.min(6, input.count ?? 3));

  const userPrompt = `Generate ${count} meaningfully distinct A/B variants of this template.

=== TEMPLATE ===
${input.template_body}
=== END ===

Each variant must test a different angle. JSON only.`;

  try {
    const response = await anthropic.messages.create({
      model: MODEL_HAIKU,
      max_tokens: 3000,
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
    const parsed = safeJsonParse<TemplateVariantsOutput>(text);

    if (!parsed || !Array.isArray(parsed.variants)) {
      return NextResponse.json(
        { error: "Claude returned an invalid response", raw: text.slice(0, 500) },
        { status: 502 }
      );
    }

    const variants: TemplateVariant[] = parsed.variants
      .filter(
        (v): v is TemplateVariant =>
          !!v &&
          typeof v.subject === "string" &&
          typeof v.body === "string"
      )
      .map((v) => ({
        subject: v.subject.trim(),
        body: v.body.trim(),
        angle: v.angle?.trim() || "variant",
      }))
      .slice(0, count);

    const serviceSupabase = createServiceClient();
    void serviceSupabase.from("trinity_log").insert({
      action_type: "ai_email_template_variants",
      description: `A/B variants generated (${variants.length})`,
      profile_id: user.id,
      status: "completed",
      result: {
        variant_count: variants.length,
        generated_at: new Date().toISOString(),
      },
    });

    return NextResponse.json({ variants });
  } catch (err) {
    console.error("[email-templates/variants] error", err);
    const message = err instanceof Error ? err.message : "Unknown Claude API error";
    return NextResponse.json(
      { error: "Failed to generate variants", detail: message },
      { status: 500 }
    );
  }
}
