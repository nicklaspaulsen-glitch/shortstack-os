/**
 * POST /api/sequences/runs/[id]/resume
 *
 * Resume a paused sequence run. The runner will pick it up on the next tick
 * (next_action_at is set to now).
 */
import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { getEffectiveOwnerId } from "@/lib/security/require-owned-client";
import { resumeRun } from "@/lib/sequences/engine";

export async function POST(
  _request: NextRequest,
  { params }: { params: { id: string } },
): Promise<NextResponse> {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const ownerId = await getEffectiveOwnerId(supabase, user.id);
  if (!ownerId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { data: run } = await supabase
    .from("sequence_runs")
    .select("id, user_id, status")
    .eq("id", params.id)
    .eq("user_id", ownerId)
    .single();
  if (!run) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const ok = await resumeRun(supabase, params.id);
  if (!ok) {
    return NextResponse.json(
      { error: `Cannot resume run in status ${run.status}` },
      { status: 409 },
    );
  }
  return NextResponse.json({ success: true, run_id: params.id, status: "active" });
}
