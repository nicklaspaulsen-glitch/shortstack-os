/**
 * ai-edit-preferences.ts — Auto-Edit Engine preference learning loop.
 *
 * NOT a training-based ML pipeline. Instead we keep a running log of the
 * user's accept/reject decisions in `ai_edit_feedback` and replay the most
 * recent N back to Claude as a few-shot hint on every subsequent suggestion
 * call. Over a handful of edits the model reliably converges on the user's
 * taste (caption style, SFX flavour, transition family, colour grade) without
 * any fine-tuning.
 *
 * Tables / migration: `supabase/migrations/20260420_ai_edit_feedback.sql`.
 */
import { createServiceClient } from "@/lib/supabase/server";

export interface PreferenceExample {
  id: string;
  edit_type: string;
  input_context: Record<string, unknown>;
  suggested: Record<string, unknown>;
  accepted: boolean;
  created_at: string;
}

/**
 * Log a single accept/reject decision. Best-effort: never throws.
 *
 * Call AFTER the user has either clicked "Accept" or "Reject" on a suggestion,
 * or AFTER the auto-apply pipeline has written a suggestion into a timeline.
 */
export async function logFeedback(opts: {
  user_id: string;
  edit_type: string;
  input_context: Record<string, unknown>;
  suggested: Record<string, unknown>;
  accepted: boolean;
}): Promise<void> {
  if (!opts.user_id || !opts.edit_type) return;
  try {
    const db = createServiceClient();
    await db.from("ai_edit_feedback").insert({
      user_id: opts.user_id,
      edit_type: opts.edit_type,
      input_context: opts.input_context || {},
      suggested: opts.suggested || {},
      accepted: !!opts.accepted,
    });
  } catch {
    // Feedback logging must never break a user-facing request.
  }
}

/**
 * Return the user's most recent preference examples, optionally filtered to
 * a single edit_type. Ordered newest-first so the few-shot prompt leans on
 * fresh decisions.
 */
export async function getRecentPreferences(opts: {
  user_id: string;
  edit_type?: string;
  limit?: number;
}): Promise<PreferenceExample[]> {
  const limit = Math.max(1, Math.min(50, opts.limit ?? 20));
  if (!opts.user_id) return [];
  try {
    const db = createServiceClient();
    let q = db
      .from("ai_edit_feedback")
      .select("id, edit_type, input_context, suggested, accepted, created_at")
      .eq("user_id", opts.user_id)
      .order("created_at", { ascending: false })
      .limit(limit);
    if (opts.edit_type) q = q.eq("edit_type", opts.edit_type);
    const { data } = await q;
    return (data || []).map((r) => ({
      id: String((r as { id: string }).id),
      edit_type: String((r as { edit_type: string }).edit_type),
      input_context:
        ((r as { input_context?: Record<string, unknown> }).input_context &&
        typeof (r as { input_context?: unknown }).input_context === "object")
          ? ((r as { input_context: Record<string, unknown> }).input_context)
          : {},
      suggested:
        ((r as { suggested?: Record<string, unknown> }).suggested &&
        typeof (r as { suggested?: unknown }).suggested === "object")
          ? ((r as { suggested: Record<string, unknown> }).suggested)
          : {},
      accepted: !!(r as { accepted: boolean }).accepted,
      created_at: String((r as { created_at: string }).created_at),
    }));
  } catch {
    return [];
  }
}

// ──────────────────────────────────────────────────────────────────────
//  Few-shot formatting — turn examples into a tight Claude-friendly block.
// ──────────────────────────────────────────────────────────────────────

function summarizeContext(ctx: Record<string, unknown>): string {
  // Shorten common context keys into human phrases. Anything we don't know
  // we skip rather than echoing raw JSON — this keeps the prompt tight.
  const parts: string[] = [];
  const sceneType = typeof ctx.scene_type === "string" ? ctx.scene_type : null;
  const motion = typeof ctx.motion_level === "string" ? ctx.motion_level : null;
  const energy = typeof ctx.energy === "number" ? ctx.energy : null;
  const creatorPack = typeof ctx.creator_pack_id === "string" ? ctx.creator_pack_id : null;
  if (sceneType) parts.push(`${sceneType.replace(/_/g, " ")} scene`);
  if (motion) parts.push(`${motion} motion`);
  if (energy !== null) parts.push(`energy ${Math.round(energy)}`);
  if (creatorPack) parts.push(creatorPack);
  return parts.length ? parts.join(", ") : "general";
}

function summarizeSuggestion(s: Record<string, unknown>): string {
  // Try a few known shapes, otherwise just JSON-stringify a compact view.
  const type = typeof s.type === "string" ? s.type : null;
  const payload =
    s.payload && typeof s.payload === "object"
      ? (s.payload as Record<string, unknown>)
      : {};
  if (type === "sfx") {
    const cat = typeof payload.category === "string" ? payload.category : null;
    const sfxId = typeof payload.sfx_id === "string" ? payload.sfx_id : null;
    return `add SFX ${sfxId || cat || ""}`.trim();
  }
  if (type === "caption") {
    const style = typeof payload.style_id === "string" ? payload.style_id : null;
    return `add captions in ${style || "default"} style`;
  }
  if (type === "transition") {
    const tid = typeof payload.transition_id === "string" ? payload.transition_id : null;
    return `use transition ${tid || "default"}`;
  }
  if (type === "color_grade") {
    const fx = typeof payload.effect_id === "string" ? payload.effect_id : null;
    return `apply color grade ${fx || "default"}`;
  }
  if (type === "zoom") {
    const style = typeof payload.style === "string" ? payload.style : null;
    return `${style || "punch-in"} zoom`;
  }
  if (type === "broll_insert") {
    const q = typeof payload.query === "string" ? payload.query : null;
    return `insert B-roll (${q || "contextual"})`;
  }
  if (type === "music_cue") {
    const mood = typeof payload.mood === "string" ? payload.mood : null;
    return `music cue (${mood || "on beat"})`;
  }
  // Fallback — short JSON excerpt.
  try {
    const short = JSON.stringify(s);
    return short.length > 80 ? `${short.slice(0, 77)}…` : short;
  } catch {
    return "(suggestion)";
  }
}

/**
 * Format a set of preference examples as a tight few-shot string suitable for
 * inclusion in a Claude system prompt. Returns an empty string when there are
 * no examples (so callers can safely concatenate).
 */
export function formatAsFewShot(examples: PreferenceExample[]): string {
  if (!examples || examples.length === 0) return "";
  const lines: string[] = ["PAST PREFERENCES (user accepted/rejected these suggestions):"];
  // Sort oldest → newest inside the block — models handle chronological
  // sequences better when reading the intent over time.
  const ordered = [...examples].sort((a, b) =>
    a.created_at.localeCompare(b.created_at),
  );
  for (const ex of ordered) {
    const verb = ex.accepted ? "ACCEPTED" : "REJECTED";
    const ctx = summarizeContext(ex.input_context);
    const sug = summarizeSuggestion(ex.suggested);
    lines.push(`- ${verb}: On ${ctx}, ${sug}`);
  }
  lines.push(
    "Lean the new suggestions toward what was ACCEPTED and away from what was REJECTED — but only when the context matches.",
  );
  return lines.join("\n");
}
