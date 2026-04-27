/**
 * POST /api/cold-email/jobs/{id}/start
 *
 * Move the job from "pending" → "researching". The cron picks it up from
 * there. Idempotent: if the job is already running it just returns its
 * current status.
 */
import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { getEffectiveOwnerId } from "@/lib/security/require-owned-client";

export async function POST(
  _req: NextRequest,
  ctx: { params: { id: string } },
) {
  const supabase = createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const ownerId = (await getEffectiveOwnerId(supabase, user.id)) ?? user.id;

  const { data: job, error: lookupErr } = await supabase
    .from("cold_email_jobs")
    .select("id, status")
    .eq("id", ctx.params.id)
    .eq("user_id", ownerId)
    .maybeSingle();

  if (lookupErr) return NextResponse.json({ error: lookupErr.message }, { status: 500 });
  if (!job) return NextResponse.json({ error: "Job not found" }, { status: 404 });

  if (job.status !== "pending") {
    return NextResponse.json({ job, note: `Already ${job.status}` });
  }

  const { data: updated, error: updErr } = await supabase
    .from("cold_email_jobs")
    .update({
      status: "researching",
      started_at: new Date().toISOString(),
    })
    .eq("id", ctx.params.id)
    .eq("user_id", ownerId)
    .select()
    .single();

  if (updErr) return NextResponse.json({ error: updErr.message }, { status: 500 });
  return NextResponse.json({ job: updated });
}
