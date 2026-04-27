/**
 * POST /api/sequences/runs/[id]/exit
 *
 * Graceful exit. Body: { reason?: string } — defaults to "manual_exit".
 */
import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { getEffectiveOwnerId } from "@/lib/security/require-owned-client";
import { exitRun } from "@/lib/sequences/engine";

interface ExitInput {
  reason?: string;
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } },
): Promise<NextResponse> {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const ownerId = await getEffectiveOwnerId(supabase, user.id);
  if (!ownerId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  let body: ExitInput = {};
  try {
    body = (await request.json().catch(() => ({}))) as ExitInput;
  } catch {
    body = {};
  }
  const reason = (body.reason || "manual_exit").slice(0, 200);

  const { data: run } = await supabase
    .from("sequence_runs")
    .select("id, user_id, status")
    .eq("id", params.id)
    .eq("user_id", ownerId)
    .single();
  if (!run) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const ok = await exitRun(supabase, params.id, reason);
  if (!ok) {
    return NextResponse.json(
      { error: `Cannot exit run in status ${run.status}` },
      { status: 409 },
    );
  }
  return NextResponse.json({
    success: true,
    run_id: params.id,
    status: "exited",
    reason,
  });
}
