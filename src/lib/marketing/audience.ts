/**
 * Audience resolver — turns a campaign's `audience_type` + `audience_filter`
 * into a deduped list of `{ contactId | null, email }` recipient rows.
 *
 * The campaign builder lets the user choose:
 *   - `segment` → an existing CRM segment (live filter applied)
 *   - `tag`     → all leads/clients carrying a tag (or any of N tags)
 *   - `csv`     → a raw uploaded list (emails baked into audience_filter)
 *   - `all`     → every lead the agency owns that has an email
 *
 * Implementation notes:
 *   - Uses the SERVER (RLS-respecting) supabase client passed in by the
 *     caller so we never accidentally leak rows across agencies.
 *   - Caller is expected to have already passed the user_id auth gate
 *     and looked up the effective owner via getEffectiveOwnerId.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

export type AudienceType = "segment" | "tag" | "csv" | "all";

export interface AudienceFilterSegment {
  segment_id: string;
}
export interface AudienceFilterTag {
  tag_ids: string[];
}
export interface AudienceFilterCsv {
  emails: string[];
}
export interface AudienceFilterAll {
  scope?: "all";
}

export type AudienceFilter =
  | AudienceFilterSegment
  | AudienceFilterTag
  | AudienceFilterCsv
  | AudienceFilterAll;

export interface ResolvedRecipient {
  contactId: string | null;
  email: string;
}

const EMAIL_RE = /^[^\s@<>,]+@[^\s@<>,]+\.[^\s@<>,]+$/;

function dedupeAndValidate(rows: ResolvedRecipient[]): ResolvedRecipient[] {
  const seen = new Set<string>();
  const out: ResolvedRecipient[] = [];
  for (const r of rows) {
    const email = (r.email || "").trim().toLowerCase();
    if (!email) continue;
    if (!EMAIL_RE.test(email)) continue;
    if (seen.has(email)) continue;
    seen.add(email);
    out.push({ contactId: r.contactId, email });
  }
  return out;
}

interface LeadEmailRow {
  id: string;
  email: string | null;
}

async function pullLeadsByOwner(
  supabase: SupabaseClient,
  ownerId: string,
  ids?: string[],
): Promise<ResolvedRecipient[]> {
  let q = supabase.from("leads").select("id, email").eq("user_id", ownerId);
  if (ids && ids.length) q = q.in("id", ids);
  const { data, error } = await q;
  if (error) {
    console.error("[marketing.audience] leads query failed:", error.message);
    return [];
  }
  return ((data as LeadEmailRow[] | null) ?? [])
    .filter((row): row is LeadEmailRow & { email: string } => Boolean(row.email))
    .map((row) => ({ contactId: row.id, email: row.email }));
}

/**
 * Pull lead ids that match a tag set. We try a `lead_tags` join table
 * first then fall back to a tags-array contains query — keeps the
 * resolver tolerant of either schema.
 */
async function pullLeadIdsForTags(
  supabase: SupabaseClient,
  tagIds: string[],
): Promise<string[]> {
  if (!tagIds.length) return [];
  const { data, error } = await supabase
    .from("lead_tags")
    .select("lead_id")
    .in("tag_id", tagIds);
  if (!error && Array.isArray(data)) {
    const seen = new Set<string>();
    for (const row of data as Array<{ lead_id: string | null }>) {
      if (row.lead_id) seen.add(row.lead_id);
    }
    return Array.from(seen);
  }
  const { data: alt } = await supabase
    .from("leads")
    .select("id")
    .overlaps("tags", tagIds);
  if (Array.isArray(alt)) {
    return (alt as Array<{ id: string }>).map((r) => r.id);
  }
  return [];
}

export async function resolveAudience(
  supabase: SupabaseClient,
  ownerId: string,
  audienceType: AudienceType,
  audienceFilter: unknown,
): Promise<ResolvedRecipient[]> {
  const filter = (audienceFilter && typeof audienceFilter === "object" ? audienceFilter : {}) as Record<string, unknown>;

  if (audienceType === "all") {
    const rows = await pullLeadsByOwner(supabase, ownerId);
    return dedupeAndValidate(rows).slice(0, 100_000);
  }

  if (audienceType === "csv") {
    const emails = Array.isArray(filter.emails) ? (filter.emails as unknown[]) : [];
    const rows: ResolvedRecipient[] = emails
      .filter((e): e is string => typeof e === "string")
      .map((e) => ({ contactId: null, email: e }));
    return dedupeAndValidate(rows).slice(0, 100_000);
  }

  if (audienceType === "tag") {
    const tagIds = Array.isArray(filter.tag_ids) ? (filter.tag_ids as unknown[]) : [];
    const validTagIds = tagIds.filter((t): t is string => typeof t === "string");
    if (!validTagIds.length) return [];
    const leadIds = await pullLeadIdsForTags(supabase, validTagIds);
    if (!leadIds.length) return [];
    const rows = await pullLeadsByOwner(supabase, ownerId, leadIds);
    return dedupeAndValidate(rows).slice(0, 100_000);
  }

  if (audienceType === "segment") {
    const segmentId = typeof filter.segment_id === "string" ? filter.segment_id : null;
    if (!segmentId) return [];
    const { data: seg, error } = await supabase
      .from("crm_segments")
      .select("filters")
      .eq("id", segmentId)
      .eq("profile_id", ownerId)
      .maybeSingle();
    if (error || !seg) return [];
    const segFilters = (seg as { filters: Record<string, unknown> | null }).filters ?? {};
    const tagIds = Array.isArray(segFilters.tag_ids) ? (segFilters.tag_ids as unknown[]) : [];
    const validTagIds = tagIds.filter((t): t is string => typeof t === "string");
    if (validTagIds.length) {
      const leadIds = await pullLeadIdsForTags(supabase, validTagIds);
      if (!leadIds.length) return [];
      const rows = await pullLeadsByOwner(supabase, ownerId, leadIds);
      return dedupeAndValidate(rows).slice(0, 100_000);
    }
    const rows = await pullLeadsByOwner(supabase, ownerId);
    return dedupeAndValidate(rows).slice(0, 100_000);
  }

  return [];
}

export async function countAudience(
  supabase: SupabaseClient,
  ownerId: string,
  audienceType: AudienceType,
  audienceFilter: unknown,
): Promise<number> {
  const recipients = await resolveAudience(supabase, ownerId, audienceType, audienceFilter);
  return recipients.length;
}
