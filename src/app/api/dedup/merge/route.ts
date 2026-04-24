import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { getEffectiveOwnerId } from "@/lib/security/require-owned-client";

/**
 * POST /api/dedup/merge
 * Body: {
 *   winner_id: string,      // the row to keep
 *   loser_id: string,       // the row to merge into winner then delete
 *   fields?: { field_name: "winner" | "loser" }  // optional override per field
 * }
 *
 * Copies any requested field values from loser to winner, writes an audit
 * row, and deletes the loser. All rows are verified to belong to the
 * caller's owner before any mutation.
 */
export async function POST(req: NextRequest) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const ownerId = await getEffectiveOwnerId(supabase, user.id);
  if (!ownerId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const winnerId = typeof body.winner_id === "string" ? body.winner_id : null;
  const loserId = typeof body.loser_id === "string" ? body.loser_id : null;
  const fields = (body.fields && typeof body.fields === "object") ? body.fields : {};

  if (!winnerId || !loserId || winnerId === loserId) {
    return NextResponse.json({ error: "winner_id and loser_id required and must differ" }, { status: 400 });
  }

  const [{ data: winner }, { data: loser }] = await Promise.all([
    supabase.from("leads").select("*").eq("id", winnerId).maybeSingle(),
    supabase.from("leads").select("*").eq("id", loserId).maybeSingle(),
  ]);

  if (!winner || !loser) return NextResponse.json({ error: "Lead not found" }, { status: 404 });
  if (winner.user_id !== ownerId || loser.user_id !== ownerId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Build the patch to apply to the winner row — for any field flagged
  // "loser" in the `fields` map, copy loser's value onto the winner.
  // For fields not in the map, default to: keep winner if non-null, else
  // fall back to loser's value.
  const MERGEABLE_FIELDS = [
    "business_name", "owner_name", "phone", "email", "website", "address",
    "city", "state", "country", "google_rating", "review_count", "industry",
    "category", "instagram_url", "facebook_url", "linkedin_url", "tiktok_url",
    "ghl_contact_id", "lead_score",
  ];

  const mergedFields: Record<string, { from: unknown; to: unknown }> = {};
  const patch: Record<string, unknown> = {};

  for (const f of MERGEABLE_FIELDS) {
    const w = (winner as Record<string, unknown>)[f];
    const l = (loser as Record<string, unknown>)[f];
    const decision = (fields as Record<string, string>)[f];
    let chosen: unknown = w;
    if (decision === "loser") chosen = l;
    else if (decision === "winner") chosen = w;
    else if ((w === null || w === undefined || w === "") && l !== null && l !== undefined && l !== "") {
      // Default: fill winner's blanks from loser.
      chosen = l;
    }
    if (chosen !== w) {
      patch[f] = chosen;
      mergedFields[f] = { from: w, to: chosen };
    }
  }

  if (Object.keys(patch).length > 0) {
    const { error: upErr } = await supabase
      .from("leads")
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq("id", winnerId);
    if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 });
  }

  // Log the merge before deletion so a foreign-key reference isn't needed.
  await supabase.from("dedup_audit_log").insert({
    user_id: user.id,
    entity_type: "lead",
    merged_from_id: loserId,
    merged_into_id: winnerId,
    merged_fields: mergedFields,
  });

  const { error: delErr } = await supabase
    .from("leads")
    .delete()
    .eq("id", loserId);

  if (delErr) return NextResponse.json({ error: delErr.message }, { status: 500 });

  return NextResponse.json({
    success: true,
    winner_id: winnerId,
    loser_id: loserId,
    merged_fields: Object.keys(mergedFields),
  });
}
