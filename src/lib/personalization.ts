import { createServiceClient } from "@/lib/supabase/server";

/**
 * Combined onboarding + AI personalization snapshot for a user.
 *
 * `onboarding_preferences` holds the structured answers captured by the 6 core
 * onboarding steps (business name, niche, pain points, goals, etc.).
 * `personalization.questions` + `personalization.answers` hold the open-ended
 * AI-generated follow-up Q&A from Step 5 "Personalize".
 * `ai_answers` is a free-form bucket for future AI-captured insights.
 *
 * Downstream consumers — feed this into:
 *   - Content generation prompts (so every generated post knows the brand voice,
 *     the target audience's top complaint, the customer win story, etc.)
 *   - Copywriter / ad prompts (so ad angles match their differentiators)
 *   - AI copilot system prompt (so the chat assistant feels like it actually
 *     knows the user instead of asking for context every turn)
 *
 * Typical call site:
 *   const p = await getUserPersonalization(user.id);
 *   const systemPrompt = buildSystemPrompt(p);
 */
export interface PersonalizeQA {
  id: string;
  question: string;
  placeholder?: string;
  help_text?: string;
}

export interface OnboardingPersonalization {
  questions?: PersonalizeQA[];
  answers?: Record<string, string>;
  completed_at?: string;
}

export interface UserPersonalization {
  user_type: string;
  onboarding_preferences: Record<string, unknown>;
  personalization: OnboardingPersonalization;
  ai_answers: Record<string, unknown>;
}

const EMPTY: UserPersonalization = {
  user_type: "agency",
  onboarding_preferences: {},
  personalization: {},
  ai_answers: {},
};

/**
 * Fetch the combined onboarding + AI personalization payload for a user.
 * Always resolves with an `UserPersonalization` object — returns `EMPTY`
 * (with safe defaults) when the user has no profile row yet.
 */
export async function getUserPersonalization(
  userId: string
): Promise<UserPersonalization> {
  if (!userId) return EMPTY;
  const service = createServiceClient();
  const { data, error } = await service
    .from("profiles")
    .select(
      "user_type, onboarding_preferences, onboarding_personalization, onboarding_ai_answers"
    )
    .eq("id", userId)
    .maybeSingle();

  if (error || !data) return EMPTY;

  return {
    user_type: (data.user_type as string) || "agency",
    onboarding_preferences:
      (data.onboarding_preferences as Record<string, unknown>) || {},
    personalization:
      (data.onboarding_personalization as OnboardingPersonalization) || {},
    ai_answers:
      (data.onboarding_ai_answers as Record<string, unknown>) || {},
  };
}

/**
 * Flatten a user's personalization into a plain-text block suitable for
 * injecting into an LLM system prompt. Skips empty values.
 *
 * Example:
 *   const context = formatPersonalizationForPrompt(await getUserPersonalization(uid));
 *   await anthropic.messages.create({
 *     system: `${BASE_SYSTEM}\n\nUser context:\n${context}`,
 *     ...
 *   });
 */
export function formatPersonalizationForPrompt(p: UserPersonalization): string {
  const lines: string[] = [];
  lines.push(`User type: ${p.user_type}`);

  const prefs = p.onboarding_preferences || {};
  for (const [k, v] of Object.entries(prefs)) {
    if (v && typeof v === "string") lines.push(`${k}: ${v}`);
  }

  const qs = p.personalization?.questions || [];
  const as = p.personalization?.answers || {};
  for (const q of qs) {
    const a = as[q.id];
    if (a && a.trim()) lines.push(`Q: ${q.question}\nA: ${a.trim()}`);
  }

  return lines.join("\n");
}
