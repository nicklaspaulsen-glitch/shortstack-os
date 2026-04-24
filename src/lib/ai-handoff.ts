/*
  ai-handoff.ts
  ─────────────
  "Edit after AI" — pass an AI output from a generator page into an editor
  page without forcing a full regeneration.

  Small payloads (<6 KB base64) are inlined directly into the URL query-string.
  Large payloads go through the `ai_output_handoffs` DB table (15-min TTL).

  Usage — generator side:
    const q = await createHandoff(supabase, { layers, imageUrl });
    router.push(handoffUrl(q, "/dashboard/thumbnail-generator"));

  Usage — editor side (in a useEffect on mount):
    const data = await loadHandoff(supabase, searchParams.get("handoff") ?? searchParams.get("from"));
    if (data) applyData(data.payload);
*/

import type { SupabaseClient } from "@supabase/supabase-js";

const INLINE_LIMIT = 6000; // bytes of base64

function encodeInline(payload: unknown): string {
  const json = JSON.stringify(payload);
  const bytes = new TextEncoder().encode(json);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

function decodeInline(b64: string): unknown {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return JSON.parse(new TextDecoder().decode(bytes));
}

/**
 * Store `payload` in the handoff table and return the handoff id.
 * For small payloads the id is prefixed with "inline:" and the base64
 * is stored locally — no DB round-trip.
 */
export async function createHandoff(
  supabase: SupabaseClient,
  payload: unknown,
): Promise<string> {
  const inline = encodeInline(payload);
  if (inline.length <= INLINE_LIMIT) {
    // Return a pseudo-id that loadHandoff can detect
    return `inline:${inline}`;
  }

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { data, error } = await supabase
    .from("ai_output_handoffs")
    .insert({ user_id: user.id, kind: "generic", payload })
    .select("id")
    .single();

  if (error) throw new Error(error.message);
  return data.id as string;
}

/**
 * Read + delete a handoff by the id returned from `createHandoff`.
 * Returns null if `id` is null/empty, throws on expired or not-found.
 */
export async function loadHandoff(
  supabase: SupabaseClient,
  id: string | null,
): Promise<{ payload: unknown } | null> {
  if (!id) return null;

  if (id.startsWith("inline:")) {
    try {
      const payload = decodeInline(id.slice("inline:".length));
      return { payload };
    } catch {
      throw new Error("Invalid handoff data");
    }
  }

  const { data, error } = await supabase
    .from("ai_output_handoffs")
    .select("payload, expires_at")
    .eq("id", id)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) throw new Error("Edit handoff not found");
  if (new Date(data.expires_at as string).getTime() < Date.now()) {
    throw new Error("This edit link has expired");
  }

  // Delete after read (one-shot)
  await supabase.from("ai_output_handoffs").delete().eq("id", id);

  return { payload: data.payload };
}

/**
 * Build the full destination URL with `?handoff=<id>` appended.
 *
 * Example:
 *   handoffUrl("abc-123", "/dashboard/thumbnail-generator")
 *   → "/dashboard/thumbnail-generator?handoff=abc-123"
 */
export function handoffUrl(id: string, dest: string): string {
  const encoded = encodeURIComponent(id);
  return `${dest}${dest.includes("?") ? "&" : "?"}handoff=${encoded}`;
}
