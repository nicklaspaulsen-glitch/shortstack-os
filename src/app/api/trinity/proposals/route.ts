/**
 * GET /api/trinity/proposals
 *
 * List the authed user's Trinity proposals.  Optional filters:
 *   ?status=proposed|approved|executed|vetoed|expired|failed
 *   ?limit=N   (default 50, max 200)
 */

import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

const ALLOWED_STATUSES = new Set([
  "proposed",
  "approved",
  "executed",
  "vetoed",
  "expired",
  "failed",
]);

function clampLimit(raw: string | null): number {
  const n = Number(raw ?? 50);
  if (!Number.isFinite(n) || n <= 0) return 50;
  return Math.min(200, Math.max(1, Math.floor(n)));
}

export async function GET(request: NextRequest) {
  const supabase = createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(request.url);
  const statusRaw = url.searchParams.get("status")?.toLowerCase().trim() ?? null;
  const limit = clampLimit(url.searchParams.get("limit"));

  if (statusRaw && !ALLOWED_STATUSES.has(statusRaw)) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }

  let query = supabase
    .from("trinity_actions")
    .select(
      "id, action_type, context, proposed_action, rationale, status, veto_window_until, executed_at, result, cost_usd, created_at",
    )
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (statusRaw) {
    query = query.eq("status", statusRaw);
  }

  const { data, error } = await query;
  if (error) {
    console.error("[trinity/proposals] list error", error);
    return NextResponse.json(
      { error: "Failed to load proposals" },
      { status: 500 },
    );
  }
  return NextResponse.json({ proposals: data ?? [] });
}
