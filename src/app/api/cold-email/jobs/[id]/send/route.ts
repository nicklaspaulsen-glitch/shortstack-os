/**
 * POST /api/cold-email/jobs/{id}/send
 *
 * Move the job from "researching"/"generating" → "sending". The cron handles
 * the actual outbound email loop; this just flips the lifecycle so the cron
 * starts processing send batches.
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

  if (!["pending", "researching", "generating"].includes(job.status)) {
    return NextResponse.json(
      { error: `Cannot send a job in status ${job.status}` },
      { status: 400 },
    );
  }

  const { data: updated, error: updErr } = await supabase
    .from("cold_email_jobs")
    .update({ status: "sending" })
    .eq("id", ctx.params.id)
    .eq("user_id", ownerId)
    .select()
    .single();

  if (updErr) return NextResponse.json({ error: updErr.message }, { status: 500 });
  return NextResponse.json({ job: updated });
}
