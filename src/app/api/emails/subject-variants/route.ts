import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase, createServiceClient } from "@/lib/supabase/server";
import { checkAiRateLimit } from "@/lib/api-rate-limit";
import {
  anthropic,
  MODEL_HAIKU,
  safeJsonParse,
  getResponseText,
} from "@/lib/ai/claude-helpers";

interface SubjectVariantsInput {
  body: string;
  audience?: string;
  count?: number;
}

interface SubjectVariant {
  subject: string;
  predicted_open_rate: number;
  reason: string;
}

interface SubjectVariantsOutput {
  variants: SubjectVariant[];
}

const SYSTEM_PROMPT = `You are a subject-line expert who has A/B tested tens of thousands of email subject lines for direct-response, SaaS, and lifecycle campaigns. You predict open rates with uncanny accuracy based on specificity, curiosity, length, personalization, and pattern interruption.

SUBJECT LINE PRINCIPLES
1. Under 60 characters (ideally under 50). Mobile inbox previews are ruthless.
2. Lead with a benefit, a question, a number, or a pattern-interrupt.
3. Specificity beats clever. "Save 23% on Q4 hiring" beats "A smart idea".
4. Avoid spam triggers: FREE, !!!, ALL CAPS, "guaranteed", etc.
5. Match the body's tone and promise — no clickbait that the email doesn't deliver.
6. Use numbers, brackets, or personalization tokens where they genuinely add clarity.

PREDICTED OPEN RATE
- Cold outreach floor: 18-22%
- Strong cold outreach: 28-45%
- Warm lists / existing audience: 35-55%
- Customer/transactional: 45-75%
Predict realistically based on the specific subject + body + audience combination.

OUTPUT FORMAT
Respond with ONLY raw JSON (no markdown fences, no commentary):
{
  "variants": [
    {
      "subject": "<subject line>",
      "predicted_open_rate": <number 0-100>,
      "reason": "<one sentence explaining why this subject will perform>"
    }
  ]
}

Rank variants from highest predicted open rate to lowest.`;

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

  let input: SubjectVariantsInput;
  try {
    input = (await request.json()) as SubjectVariantsInput;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!input.body?.trim()) {
    return NextResponse.json({ error: "body is required" }, { status: 400 });
  }

  const count = Math.max(1, Math.min(10, input.count ?? 5));

  const userPrompt = `Generate ${count} subject line variants for this email body.

AUDIENCE: ${input.audience ?? "general business audience"}

=== EMAIL BODY ===
${input.body}
=== END ===

Return exactly ${count} variants. JSON only.`;

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
    const parsed = safeJsonParse<SubjectVariantsOutput>(text);

    if (!parsed || !Array.isArray(parsed.variants)) {
      return NextResponse.json(
        { error: "Claude returned an invalid response", raw: text.slice(0, 500) },
        { status: 502 }
      );
    }

    const variants: SubjectVariant[] = parsed.variants
      .filter(
        (v): v is SubjectVariant =>
          !!v &&
          typeof v.subject === "string" &&
          typeof v.reason === "string"
      )
      .map((v) => ({
        subject: v.subject.trim(),
        predicted_open_rate: Math.max(
          0,
          Math.min(100, Number(v.predicted_open_rate) || 0)
        ),
        reason: v.reason.trim(),
      }))
      .sort((a, b) => b.predicted_open_rate - a.predicted_open_rate)
      .slice(0, count);

    const serviceSupabase = createServiceClient();
    void serviceSupabase.from("trinity_log").insert({
      action_type: "ai_email_subject_variants",
      description: `Subject variants (${variants.length}) for email`,
      profile_id: user.id,
      status: "completed",
      result: {
        variant_count: variants.length,
        top_predicted_rate: variants[0]?.predicted_open_rate ?? 0,
        audience: input.audience,
        generated_at: new Date().toISOString(),
      },
    });

    return NextResponse.json({ variants });
  } catch (err) {
    console.error("[emails/subject-variants] error", err);
    const message = err instanceof Error ? err.message : "Unknown Claude API error";
    return NextResponse.json(
      { error: "Failed to generate subject variants", detail: message },
      { status: 500 }
    );
  }
}
