/**
 * POST /api/sequences/runs/[id]/pause
 *
 * Pause an active sequence run. The cron runner won't pick paused rows; the
 * caller can /resume later.
 */
import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { getEffectiveOwnerId } from "@/lib/security/require-owned-client";
import { pauseRun } from "@/lib/sequences/engine";

export async function POST(
  _request: NextRequest,
  { params }: { params: { id: string } },
): Promise<NextResponse> {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const ownerId = await getEffectiveOwnerId(supabase, user.id);
  if (!ownerId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  // Confirm the run belongs to the caller's owner before pausing.
  const { data: run } = await supabase
    .from("sequence_runs")
    .select("id, user_id, status")
    .eq("id", params.id)
    .eq("user_id", ownerId)
    .single();
  if (!run) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const ok = await pauseRun(supabase, params.id);
  if (!ok) {
    return NextResponse.json(
      { error: `Cannot pause run in status ${run.status}` },
      { status: 409 },
    );
  }
  return NextResponse.json({ success: true, run_id: params.id, status: "paused" });
}
