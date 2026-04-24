import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

/**
 * POST /api/video/callback/[secret]
 *
 * Called by the Python video-use worker when a job completes. Updates the
 * ai_video_jobs row. If an assets table exists, also inserts the output as
 * a new asset so it can be referenced in projects.
 */

export const dynamic = "force-dynamic";

interface CallbackBody {
  job_id?: string;
  status?: string;
  output_url?: string | null;
  duration_seconds?: number;
  cost_usd?: number;
  error?: string | null;
}

export async function POST(request: NextRequest, { params }: { params: { secret: string } }) {
  const expected = process.env.RUNPOD_VIDEO_USE_SECRET;
  if (!expected) {
    return NextResponse.json({ ok: false, error: "Not configured" }, { status: 503 });
  }
  if (!params.secret || params.secret !== expected) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  let body: CallbackBody;
  try {
    body = (await request.json()) as CallbackBody;
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const jobId = body.job_id;
  if (!jobId) {
    return NextResponse.json({ ok: false, error: "Missing job_id" }, { status: 400 });
  }

  const service = createServiceClient();

  const { data: existing, error: readErr } = await service
    .from("ai_video_jobs")
    .select("id, user_id, project_id, org_id, asset_id_out")
    .eq("id", jobId)
    .maybeSingle();

  if (readErr) {
    return NextResponse.json({ ok: false, error: readErr.message }, { status: 500 });
  }
  if (!existing) {
    return NextResponse.json({ ok: false, error: "Job not found" }, { status: 404 });
  }

  const status = typeof body.status === "string" ? body.status : "complete";
  const update: Record<string, unknown> = {
    status,
    output_url: body.output_url ?? null,
    error: body.error ?? null,
  };
  if (typeof body.cost_usd === "number") update.cost_usd = body.cost_usd;
  if (typeof body.duration_seconds === "number") update.duration_seconds = body.duration_seconds;

  // If an assets table exists (feat/asset-library), create an asset row for
  // the output. This is a soft integration — skipped silently on failure.
  let assetIdOut: string | null = null;
  if (status === "complete" && body.output_url) {
    try {
      const { data: newAsset } = await service
        .from("assets")
        .insert({
          org_id: existing.org_id ?? null,
          project_id: existing.project_id ?? null,
          asset_type: "video",
          source: "ai",
          storage_url: body.output_url,
          filename: `auto-edit-${jobId}.mp4`,
          mime_type: "video/mp4",
          tags: ["ai-edit", "video-use"],
          description: "Auto-edited via video-use",
          ai_metadata: { source: "video-use", job_id: jobId },
          created_by: existing.user_id ?? null,
        })
        .select("id")
        .maybeSingle();
      if (newAsset && typeof newAsset.id === "string") {
        assetIdOut = newAsset.id;
        update.asset_id_out = assetIdOut;
      }
    } catch {
      // Assets table not deployed — leave asset_id_out null.
    }
  }

  const { error: updateErr } = await service
    .from("ai_video_jobs")
    .update(update)
    .eq("id", jobId);

  if (updateErr) {
    return NextResponse.json({ ok: false, error: updateErr.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, asset_id_out: assetIdOut });
}
