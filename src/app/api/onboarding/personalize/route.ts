import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { checkAiRateLimit } from "@/lib/api-rate-limit";
import {
  anthropic,
  MODEL_HAIKU,
  safeJsonParse,
  getResponseText,
} from "@/lib/ai/claude-helpers";

export const maxDuration = 30;

/**
 * POST /api/onboarding/personalize
 *
 * Generates 3-5 personalized follow-up questions based on the user's earlier
 * onboarding answers. Used as the final step of both agency and solo onboarding
 * to capture context that a generic form wouldn't ask for.
 */

interface RequestBody {
  business_name?: string;
  industry?: string;
  target_audience?: string;
  goals?: string;
  brand_voice?: string;
  user_type?: string;
}

interface PersonalizeQuestion {
  id: string;
  question: string;
  placeholder: string;
  help_text: string;
}

const SYSTEM_PROMPT = `You're an expert onboarding consultant for an agency marketing platform. Based on a user's answers so far, ask 3-5 SHORT, SPECIFIC follow-up questions that will help us personalize the platform + content generation for them.

Good questions probe the UNIQUE angle — things a generic onboarding wouldn't ask. Examples:
- "What's the #1 complaint your customers voice about your industry?"
- "What content format has performed best for you before (short video / long blog / carousel)?"
- "Who's your biggest competitor and why are you different?"
- "What's a customer win story you're most proud of?"
- "What's the one thing you wish more people knew about what you do?"

Return ONLY raw JSON (no markdown). Shape:
{
  "questions": [
    {
      "id": "snake_case_stable_id",
      "question": "The full question (under 120 chars)",
      "placeholder": "Hint / example answer format",
      "help_text": "One-line why-we're-asking (under 80 chars)"
    }
  ]
}

Rules:
- 3-5 questions. Never more.
- IDs must be unique, snake_case, stable.
- Questions should be open-ended (expecting a short paragraph).
- Avoid repeating things they already told us (business name, goals, audience, brand voice).
- Tailor to their industry and user_type.`;

export async function POST(req: NextRequest) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase
    .from("profiles")
    .select("plan_tier")
    .eq("id", user.id)
    .single();
  const limited = checkAiRateLimit(user.id, profile?.plan_tier);
  if (limited) return limited;

  let body: RequestBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const userContext = formatContext(body);

  try {
    const resp = await anthropic.messages.create({
      model: MODEL_HAIKU,
      max_tokens: 900,
      system: [
        {
          type: "text",
          text: SYSTEM_PROMPT,
          cache_control: { type: "ephemeral" },
        },
      ],
      messages: [
        {
          role: "user",
          content: `User context:\n${userContext}\n\nGenerate 3-5 personalized follow-up questions. Return JSON only.`,
        },
      ],
    });

    const raw = getResponseText(resp);
    const parsed = safeJsonParse<{ questions?: unknown }>(raw);
    const questions = Array.isArray(parsed?.questions)
      ? (parsed!.questions as unknown[])
          .map(normalizeQuestion)
          .filter((q): q is PersonalizeQuestion => q !== null)
          .slice(0, 5)
      : [];

    if (questions.length === 0) {
      return NextResponse.json({
        success: true,
        questions: fallbackQuestions(),
        fallback: true,
      });
    }

    return NextResponse.json({ success: true, questions });
  } catch (err) {
    console.error("[onboarding/personalize] failed:", err);
    return NextResponse.json({
      success: true,
      questions: fallbackQuestions(),
      fallback: true,
    });
  }
}

/* ─── Helpers ───────────────────────────────────────────────────────── */

function formatContext(body: RequestBody): string {
  const rows: string[] = [];
  if (body.business_name) rows.push(`- Business: ${body.business_name}`);
  if (body.industry) rows.push(`- Industry: ${body.industry}`);
  if (body.user_type) rows.push(`- User type: ${body.user_type}`);
  if (body.target_audience) rows.push(`- Target audience: ${body.target_audience}`);
  if (body.goals) rows.push(`- Goals: ${body.goals}`);
  if (body.brand_voice) rows.push(`- Brand voice: ${body.brand_voice}`);
  return rows.length > 0 ? rows.join("\n") : "(no context provided)";
}

function normalizeQuestion(raw: unknown): PersonalizeQuestion | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const id = typeof r.id === "string" && r.id.trim() ? r.id.trim() : "";
  const question = typeof r.question === "string" && r.question.trim() ? r.question.trim() : "";
  const placeholder = typeof r.placeholder === "string" ? r.placeholder : "";
  const help_text = typeof r.help_text === "string" ? r.help_text : "";
  if (!id || !question) return null;
  return { id, question, placeholder, help_text };
}

function fallbackQuestions(): PersonalizeQuestion[] {
  return [
    {
      id: "customer_complaint",
      question: "What's the #1 complaint customers voice about your industry?",
      placeholder: "e.g. Slow response times, hidden fees, pushy salespeople...",
      help_text: "Helps us write copy that addresses real pain.",
    },
    {
      id: "competitor_difference",
      question: "Who's your biggest competitor and why are you different?",
      placeholder: "e.g. Bigger agencies — we're faster and more hands-on.",
      help_text: "Shapes positioning in generated content.",
    },
    {
      id: "best_format",
      question: "What content format has performed best for you before?",
      placeholder: "e.g. Short video, long blog posts, carousels, email.",
      help_text: "We'll bias generated content toward what works.",
    },
    {
      id: "win_story",
      question: "What's a customer win story you're most proud of?",
      placeholder: "Quick anecdote — the result and why it matters.",
      help_text: "Case study material for your AI copilot.",
    },
  ];
}
