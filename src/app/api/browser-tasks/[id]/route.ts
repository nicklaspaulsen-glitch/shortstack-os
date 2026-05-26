/**
 * Browser Worker — single task detail.
 *
 *   GET    /api/browser-tasks/{id}   — full row (incl. recordings + result)
 *   PATCH  /api/browser-tasks/{id}   — update (cancel / re-queue)
 *   DELETE /api/browser-tasks/{id}   — delete
 */
import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { getEffectiveOwnerId } from "@/lib/security/require-owned-client";

export const dynamic = "force-dynamic";

const VALID_PATCH_STATUSES = new Set(["queued", "cancelled"]);

export async function GET(_req: NextRequest, ctx: { params: { id: string } }) {
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
    .select("*")
    .eq("id", ctx.params.id)
    .eq("agency_owner_id", ownerId)
    .maybeSingle();

  if (error) return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  if (!task) return NextResponse.json({ error: "Task not found" }, { status: 404 });

  return NextResponse.json({ task });
}

export async function PATCH(request: NextRequest, ctx: { params: { id: string } }) {
  const supabase = createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Apr 28: removed `|| user.id` fallback — null = suspended team_member.


  const ownerId = await getEffectiveOwnerId(supabase, user.id);


  if (!ownerId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  let body: { status?: unknown };
  try {
    body = (await request.json()) as { status?: unknown };
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const update: Record<string, unknown> = {};
  if (typeof body.status === "string") {
    if (!VALID_PATCH_STATUSES.has(body.status)) {
      return NextResponse.json(
        { error: "status must be one of: queued (re-run), cancelled" },
        { status: 400 },
      );
    }
    update.status = body.status;
    if (body.status === "queued") {
      // Re-queue: clear prior result so cron picks it up cleanly.
      update.error_message = null;
      update.completed_at = null;
      update.steps_taken = 0;
      update.total_cost_usd = 0;
      update.recordings = [];
    }
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: "no valid fields to update" }, { status: 400 });
  }

  const { error } = await supabase
    .from("browser_tasks")
    .update(update)
    .eq("id", ctx.params.id)
    .eq("agency_owner_id", ownerId);

  if (error) return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  return NextResponse.json({ success: true });
}

export async function DELETE(_req: NextRequest, ctx: { params: { id: string } }) {
  const supabase = createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Apr 28: removed `|| user.id` fallback — null = suspended team_member.


  const ownerId = await getEffectiveOwnerId(supabase, user.id);


  if (!ownerId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { error } = await supabase
    .from("browser_tasks")
    .delete()
    .eq("id", ctx.params.id)
    .eq("agency_owner_id", ownerId);

  if (error) return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  return NextResponse.json({ success: true });
}
