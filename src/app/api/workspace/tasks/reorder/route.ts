import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { getEffectiveOwnerId } from "@/lib/security/require-owned-client";
import { reorderSchema } from "@/lib/workspace/board";

export const dynamic = "force-dynamic";

/**
 * POST /api/workspace/tasks/reorder
 *
 * Bulk reorder a column after a drag-drop. Accepts the destination status
 * plus the new in-order id list; writes `position = 0..N-1` in a single
 * round-trip per row.
 *
 * Why per-row updates instead of a single multi-row UPDATE: PostgREST
 * doesn't support correlated multi-row updates with different values per
 * row, so we issue a small batch. With realistic column sizes (≤ 100
 * tasks) this is fine — the bottleneck is the network, not the DB. The
 * route caps `ordered_ids.length` at 500 in the schema as a safety belt.
 */
export async function POST(request: NextRequest) {
  const supabase = createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const ownerId = await getEffectiveOwnerId(supabase, user.id);
  if (!ownerId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = reorderSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const { status, ordered_ids } = parsed.data;
  if (ordered_ids.length === 0) {
    return NextResponse.json({ updated: 0 });
  }

  // Defense in depth: only update tasks that already belong to this owner
  // and live in this column, so a malicious caller can't pull a task from
  // a different column or tenant into a fresh position. RLS would block
  // cross-tenant writes anyway, but this keeps the column invariant.
  const { data: existing, error: existingErr } = await supabase
    .from("workspace_tasks")
    .select("id")
    .eq("agency_owner_id", ownerId)
    .eq("status", status)
    .in("id", ordered_ids);

  if (existingErr) {
    console.error("[workspace-board] reorder fetch error", existingErr);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }

  const allowed = new Set((existing || []).map((r) => r.id as string));
  const targets = ordered_ids.filter((id) => allowed.has(id));

  // Issue all updates in parallel — Supabase JS will pipeline these on the
  // same connection, and the rows are independent so order doesn't matter.
  const results = await Promise.all(
    targets.map((id, idx) =>
      supabase
        .from("workspace_tasks")
        .update({ position: idx, status })
        .eq("id", id)
        .eq("agency_owner_id", ownerId),
    ),
  );

  const failures = results.filter((r) => r.error);
  if (failures.length > 0) {
    console.error("[workspace-board] reorder partial failure", failures[0].error);
    return NextResponse.json(
      { error: "Some rows failed to reorder", failed: failures.length },
      { status: 500 },
    );
  }

  return NextResponse.json({ updated: targets.length });
}
