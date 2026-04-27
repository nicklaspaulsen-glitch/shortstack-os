/**
 * GET /api/sequences/runs
 *
 * List sequence_runs scoped to the caller's effective owner.
 * Query params:
 *   - status        — filter to one of active|paused|completed|exited|failed
 *   - sequence_id   — filter to a single sequence
 *   - contact_id    — filter to a single contact
 *   - limit         — default 100, max 500
 */
import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { getEffectiveOwnerId } from "@/lib/security/require-owned-client";

const VALID_STATUSES = new Set([
  "active",
  "paused",
  "completed",
  "exited",
  "failed",
]);

export async function GET(request: NextRequest): Promise<NextResponse> {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const ownerId = await getEffectiveOwnerId(supabase, user.id);
  if (!ownerId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const url = new URL(request.url);
  const status = url.searchParams.get("status");
  const sequenceId = url.searchParams.get("sequence_id");
  const contactId = url.searchParams.get("contact_id");
  const rawLimit = parseInt(url.searchParams.get("limit") || "100", 10);
  const limit = Number.isFinite(rawLimit) ? Math.min(Math.max(rawLimit, 1), 500) : 100;

  let query = supabase
    .from("sequence_runs")
    .select(
      "id, user_id, sequence_id, contact_id, current_step, next_action_at, status, enrolled_at, completed_at, exit_reason, metadata",
    )
    .eq("user_id", ownerId)
    .order("enrolled_at", { ascending: false })
    .limit(limit);

  if (status && VALID_STATUSES.has(status)) {
    query = query.eq("status", status);
  }
  if (sequenceId) query = query.eq("sequence_id", sequenceId);
  if (contactId) query = query.eq("contact_id", contactId);

  const { data, error } = await query;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ runs: data || [] });
}
