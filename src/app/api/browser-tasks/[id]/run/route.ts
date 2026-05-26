/**
 * Browser Worker — manual run endpoint.
 *
 *   POST /api/browser-tasks/{id}/run   — kick off the loop now
 *
 * Inline run: blocks until the task completes (max ~5 min before Vercel
 * timeout). Long-running tasks should be queued via cron instead.
 *
 * Auth: caller must own the row. Ownership is verified via RLS-friendly
 * select (agency_owner_id = effective owner).
 */
import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { getEffectiveOwnerId } from "@/lib/security/require-owned-client";
import { runBrowserAgent } from "@/lib/browser-worker/agent-loop";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST(_req: NextRequest, ctx: { params: { id: string } }) {
  const supabase = createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Apr 28: removed `|| user.id` fallback — null = suspended team_member.


  const ownerId = await getEffectiveOwnerId(supabase, user.id);


  if (!ownerId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { data: task, error } = await supabase
    .from("browser_tasks")
    .select("id, goal, start_url, max_steps, status")
    .eq("id", ctx.params.id)
    .eq("agency_owner_id", ownerId)
    .maybeSingle();

  if (error) return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  if (!task) return NextResponse.json({ error: "Task not found" }, { status: 404 });
  if (task.status === "running") {
    return NextResponse.json({ error: "Task is already running" }, { status: 409 });
  }

  try {
    const result = await runBrowserAgent({
      goal: task.goal,
      startUrl: task.start_url ?? undefined,
      maxSteps: task.max_steps,
      agencyOwnerId: ownerId,
      taskId: task.id,
    });
    return NextResponse.json({ result });
  } catch (err) {
    console.error("[browser-tasks/run]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
