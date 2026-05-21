/**
 * Page-level AI training config helpers.
 *
 * Reads an owner's saved training config for a specific feature page
 * and returns a formatted prompt fragment to inject into LLM system prompts.
 *
 * Usage:
 *   const hint = await getPageTrainingPrompt(supabase, userId, "social");
 *   if (hint) systemPrompt += `\n\n${hint}`;
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { getCreatorStyle } from "@/lib/ai/creator-styles";
import type { PageContext } from "@/lib/ai/creator-styles";

interface PageTrainingConfig {
  creator_style_id: string | null;
  custom_instructions: string | null;
  tone: string | null;
  example_outputs: string[];
  focus_topics: string[];
}

/**
 * Fetches the owner's training config for a page key and returns a formatted
 * system prompt fragment. Returns an empty string if no config is set.
 *
 * @param supabase  A server-side Supabase client (user-scoped or service).
 * @param ownerId   The agency owner's user ID (auth.uid()).
 * @param pageKey   One of the PageContext values, e.g. "social", "websites".
 */
export async function getPageTrainingPrompt(
  supabase: SupabaseClient,
  ownerId: string,
  pageKey: PageContext,
): Promise<string> {
  const { data } = await supabase
    .from("page_training_configs")
    .select(
      "creator_style_id, custom_instructions, tone, example_outputs, focus_topics",
    )
    .eq("owner_id", ownerId)
    .eq("page_key", pageKey)
    .single();

  if (!data) return "";

  const config = data as PageTrainingConfig;
  const parts: string[] = [];

  // Creator style DNA
  if (config.creator_style_id) {
    const style = getCreatorStyle(config.creator_style_id);
    if (style) {
      const contextHint = style.promptHints[pageKey] ?? "";
      parts.push(`## Creator Style: ${style.emoji} ${style.name}
Tone: ${style.tone}
Pacing: ${style.pacing}
Viral ingredients: ${style.viralIngredients.slice(0, 3).join(", ")}
${contextHint ? `Style guidance: ${contextHint}` : ""}`);
    }
  }

  // Tone override
  if (config.tone) {
    parts.push(`## Tone preference\nWrite in a ${config.tone} tone.`);
  }

  // Custom instructions
  if (config.custom_instructions?.trim()) {
    parts.push(
      `## User's custom instructions\n${config.custom_instructions.trim()}`,
    );
  }

  // Focus topics
  if (config.focus_topics && config.focus_topics.length > 0) {
    parts.push(
      `## Preferred topics / themes\nPrioritise: ${config.focus_topics.join(", ")}`,
    );
  }

  // Example outputs (up to 3)
  const examples = (config.example_outputs ?? []).slice(0, 3);
  if (examples.length > 0) {
    const exampleBlock = examples
      .map((ex, i) => `Example ${i + 1}:\n${ex}`)
      .join("\n\n");
    parts.push(
      `## Reference examples\nEmulate the style of these high-quality examples:\n${exampleBlock}`,
    );
  }

  return parts.length > 0
    ? `## Training preferences for this page\n${parts.join("\n\n")}`
    : "";
}

/**
 * Upserts a training config row. Intended for use in a settings API route.
 */
export async function savePageTrainingConfig(
  supabase: SupabaseClient,
  ownerId: string,
  pageKey: PageContext,
  patch: Partial<
    Pick<
      PageTrainingConfig,
      | "creator_style_id"
      | "custom_instructions"
      | "tone"
      | "example_outputs"
      | "focus_topics"
    >
  >,
): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from("page_training_configs")
    .upsert(
      { owner_id: ownerId, page_key: pageKey, ...patch },
      { onConflict: "owner_id,page_key" },
    );
  return { error: error?.message ?? null };
}
