import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase, createServiceClient } from "@/lib/supabase/server";
import { getEffectiveOwnerId } from "@/lib/security/require-owned-client";

// GET /api/triggers/runs
// Return the most recent workflow_trigger_runs for the caller's owner.
// Used by /dashboard/triggers history panel. Defaults to 50 rows, newest
// first. Optional ?trigger_id=X filter to limit to one trigger.

export async function GET(request: NextRequest) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const ownerId = await getEffectiveOwnerId(supabase, user.id);
  if (!ownerId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const triggerId = request.nextUrl.searchParams.get("trigger_id");
  const limit = Math.min(Number(request.nextUrl.searchParams.get("limit")) || 50, 200);

  const service = createServiceClient();
  let query = service
    .from("workflow_trigger_runs")
    .select("id, trigger_id, workflow_id, status, payload, error, started_at, finished_at")
    .eq("user_id", ownerId)
    .order("started_at", { ascending: false })
    .limit(limit);
  if (triggerId) query = query.eq("trigger_id", triggerId);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, runs: data || [] });
}
