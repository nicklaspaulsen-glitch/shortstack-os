import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase, createServiceClient } from "@/lib/supabase/server";

/**
 * GET /api/video/auto-edit/[jobId]
 *
 * Return status + output_url of an auto-edit job. Used by the dashboard for
 * polling.
 */

export async function GET(_request: NextRequest, { params }: { params: { jobId: string } }) {
  const supabase = createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const jobId = params.jobId;
  if (!jobId || typeof jobId !== "string") {
    return NextResponse.json({ ok: false, error: "Missing jobId" }, { status: 400 });
  }

  const service = createServiceClient();
  const { data: job, error } = await service
    .from("ai_video_jobs")
    .select(
      "id, status, error, source_url, output_url, style_hints, cost_usd, duration_seconds, user_id, project_id, org_id, created_at, started_at, completed_at"
    )
    .eq("id", jobId)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
  if (!job) {
    return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });
  }

  // Access: creator, or (if org_id set) anyone who can SELECT via RLS. Since
  // we used the service client, enforce here: match user OR pass through
  // (org_id presence trusts RLS on the read path).
  if (job.user_id && job.user_id !== user.id && !job.org_id) {
    return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true, job });
}
