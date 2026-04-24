import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase, createServiceClient } from "@/lib/supabase/server";

/**
 * POST /api/video/auto-edit
 *
 * Queue a video-use auto-edit job. Inserts a row into ai_video_jobs, kicks
 * off the Python worker on RunPod, returns the job id so the client can
 * poll /api/video/auto-edit/[jobId].
 *
 * Body: { source_asset_id?: string, source_url?: string, project_id?: string, style_hints?: object }
 */

export const maxDuration = 60;

interface AutoEditBody {
  source_asset_id?: string;
  source_url?: string;
  project_id?: string | null;
  style_hints?: Record<string, unknown>;
  org_id?: string;
}

const ALLOWED_PRESETS = ["documentary", "vlog", "social_short", "commercial"] as const;

function sanitizeStyleHints(input: unknown): Record<string, unknown> {
  if (!input || typeof input !== "object") return {};
  const src = input as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  const preset = src.style_preset;
  if (typeof preset === "string" && (ALLOWED_PRESETS as readonly string[]).includes(preset)) {
    out.style_preset = preset;
  } else {
    out.style_preset = "vlog";
  }
  for (const k of ["cut_filler_words", "auto_color_grade", "audio_fades", "burn_subtitles"]) {
    out[k] = src[k] === true;
  }
  return out;
}

// Soft budget-gate: if the helpers in feat/ai-budget-caps are present we use
// them; otherwise skip silently so we don't block on that branch landing.
async function softBudgetCheck(userId: string): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const mod = (await import("@/lib/ai/budget-gate")) as unknown as {
      checkBudget?: (userId: string, cost: number) => Promise<{ ok: boolean; error?: string }>;
    };
    if (typeof mod.checkBudget === "function") {
      const r = await mod.checkBudget(userId, 0.5);
      if (!r.ok) return { ok: false, error: r.error ?? "Budget exceeded" };
    }
  } catch {
    // Module doesn't exist yet — skip.
  }
  return { ok: true };
}

export async function POST(request: NextRequest) {
  const supabase = createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  let body: AutoEditBody;
  try {
    body = (await request.json()) as AutoEditBody;
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const service = createServiceClient();

  let sourceUrl = body.source_url ?? null;
  let assetIdIn: string | null = null;

  if (body.source_asset_id) {
    assetIdIn = body.source_asset_id;
    // Soft-read from assets — if the table doesn't exist yet, require source_url.
    try {
      const { data: asset } = await service
        .from("assets")
        .select("id, storage_url")
        .eq("id", body.source_asset_id)
        .maybeSingle();
      if (asset && typeof asset.storage_url === "string") {
        sourceUrl = asset.storage_url;
      }
    } catch {
      // assets table not yet deployed — fall through to source_url validation.
    }
  }

  if (!sourceUrl || typeof sourceUrl !== "string") {
    return NextResponse.json(
      { ok: false, error: "source_asset_id or source_url required" },
      { status: 400 }
    );
  }

  const budget = await softBudgetCheck(user.id);
  if (!budget.ok) {
    return NextResponse.json({ ok: false, error: budget.error }, { status: 402 });
  }

  const style_hints = sanitizeStyleHints(body.style_hints);

  const { data: job, error: insertError } = await service
    .from("ai_video_jobs")
    .insert({
      org_id: body.org_id ?? null,
      project_id: body.project_id ?? null,
      asset_id_in: assetIdIn,
      source_url: sourceUrl,
      style_hints,
      status: "queued",
      user_id: user.id,
    })
    .select("id, status")
    .single();

  if (insertError || !job) {
    return NextResponse.json(
      { ok: false, error: insertError?.message ?? "Failed to create job" },
      { status: 500 }
    );
  }

  // Fire-and-forget to the Python worker. If env isn't set we leave the job
  // as 'queued' and the caller can see the pending state.
  const workerUrl = process.env.RUNPOD_VIDEO_USE_URL;
  const workerSecret = process.env.RUNPOD_VIDEO_USE_SECRET;
  if (workerUrl && workerSecret) {
    const origin = request.nextUrl.origin;
    const callbackUrl = `${origin}/api/video/callback`;
    try {
      const resp = await fetch(`${workerUrl.replace(/\/$/, "")}/edit`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${workerSecret}`,
        },
        body: JSON.stringify({
          job_id: job.id,
          input_url: sourceUrl,
          style_hints,
          callback_url: callbackUrl,
          callback_secret: workerSecret,
        }),
      });
      if (!resp.ok) {
        await service
          .from("ai_video_jobs")
          .update({ status: "failed", error: `Worker returned ${resp.status}` })
          .eq("id", job.id);
        return NextResponse.json(
          { ok: false, job_id: job.id, error: `Worker error ${resp.status}` },
          { status: 502 }
        );
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "worker unreachable";
      await service
        .from("ai_video_jobs")
        .update({ status: "failed", error: msg })
        .eq("id", job.id);
      return NextResponse.json(
        { ok: false, job_id: job.id, error: msg },
        { status: 502 }
      );
    }
  }

  return NextResponse.json({ ok: true, job_id: job.id, status: job.status });
}
