// Slug helper for case studies. URL-safe, lowercased, hyphenated.
// Collision resolution is the caller's responsibility (see
// `nextAvailableSlug`, which appends -2, -3, ... on conflict).

import type { SupabaseClient } from "@supabase/supabase-js";

export function slugify(input: string): string {
  return (input || "")
    .toString()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "") // strip diacritics
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "case-study";
}

/**
 * Find the next available slug by probing case_studies.slug.
 * Uses the provided client (which may be service or user-scoped). Slug is
 * globally unique in the DB.
 */
export async function nextAvailableSlug(
  supabase: SupabaseClient,
  base: string,
  opts?: { excludeId?: string },
): Promise<string> {
  const root = slugify(base);
  let candidate = root;
  let i = 2;

  while (true) {
    let query = supabase.from("case_studies").select("id").eq("slug", candidate).limit(1);
    if (opts?.excludeId) query = query.neq("id", opts.excludeId);
    const { data, error } = await query;
    if (error) return candidate; // fail-open; caller handles insert error
    if (!data || data.length === 0) return candidate;
    candidate = `${root}-${i}`;
    i += 1;
    if (i > 200) return `${root}-${Date.now()}`;
  }
}
