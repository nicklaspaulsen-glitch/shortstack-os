import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { anthropic, MODEL_HAIKU, getResponseText, safeJsonParse } from "@/lib/ai/claude-helpers";

/**
 * AI-generated follow-up questions for the website wizard.
 *
 * POST body: { answers: Record<string, unknown>, stage?: "value_prop" | "general" }
 * Returns:  { questions: Array<{ id, label, hint?, suggestions?: string[] }> }
 */

const CACHEABLE_SYSTEM = `You are a senior UX researcher interviewing a small-business owner to brief a website designer.

Given their answers so far, return 2-3 concise, specific follow-up questions that unlock conversion-critical detail (unique angle, proof, specific outcomes, objections, or CTAs). Prefer questions that can be answered in 1-2 sentences. For at least one question, also return 3-5 short tappable suggestion chips the user can click to auto-fill.

Output STRICT JSON only — no prose, no markdown:
{
  "questions": [
    { "id": "string", "label": "the question", "hint": "short helper text", "suggestions": ["chip1","chip2"] }
  ]
}`;

export async function POST(request: NextRequest) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const answers = (body?.answers ?? {}) as Record<string, unknown>;
  const stage = (body?.stage as string) || "general";

  if (!process.env.ANTHROPIC_API_KEY) {
    // Fallback static questions
    return NextResponse.json({
      questions: [
        {
          id: "unique_angle",
          label: "What makes you different from competitors?",
          hint: "1-2 sentences. Specific beats vague.",
          suggestions: ["Faster turnaround", "Family-owned 20+ years", "No contracts", "Money-back guarantee"],
        },
        {
          id: "ideal_customer",
          label: "Who is your absolute ideal customer right now?",
          suggestions: ["Local homeowners", "B2B SaaS founders", "Busy parents", "Small-business owners"],
        },
      ],
      source: "static",
    });
  }

  const userMsg = `Answers so far (JSON):
${JSON.stringify(answers, null, 2)}

Stage: ${stage}

Return 2-3 best follow-up questions for a conversion-focused website brief.`;

  try {
    const response = await anthropic.messages.create({
      model: MODEL_HAIKU,
      max_tokens: 800,
      system: [{
        type: "text",
        text: CACHEABLE_SYSTEM,
        cache_control: { type: "ephemeral" },
      }],
      messages: [{ role: "user", content: userMsg }],
    });

    const text = getResponseText(response);
    const parsed = safeJsonParse<{ questions: unknown[] }>(text);
    if (!parsed || !Array.isArray(parsed.questions)) {
      return NextResponse.json({
        questions: [],
        error: "Invalid AI response",
        raw: text.slice(0, 300),
      }, { status: 200 });
    }
    return NextResponse.json({ questions: parsed.questions, source: "ai" });
  } catch (err) {
    return NextResponse.json({ error: String(err), questions: [] }, { status: 500 });
  }
}
