import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import {
  pollCloneStatus,
  type RunPodCloneProvider,
} from "@/lib/voice/runpod-clone";
import { secureCompare } from "@/lib/security/ssrf-guard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Apr 28 audit: maxDuration was missing — Vercel default is 10s and this
// cron polls up to 50 RunPod jobs sequentially. Match the other long
// crons at 60s.
export const maxDuration = 60;

const RUNPOD_PROVIDERS: ReadonlyArray<RunPodCloneProvider> = [
  "runpod_f5tts",
  "runpod_openvoice",
  "runpod_xtts",
];

/**
 * GET /api/cron/voice-clone-poll
 *
 * Polls every voice_clones row in `training` state with a RunPod provider
 * and a recorded job id. Runs every 2 minutes via vercel.json.
 *
 * Auth: must include `Authorization: Bearer ${CRON_SECRET}`. Fails-closed
 * (503) when CRON_SECRET is unset — matches the rest of the cron surface.
 */
export async function GET(request: NextRequest) {
  if (!process.env.CRON_SECRET) {
    return NextResponse.json(
      { error: "CRON_SECRET not configured" },
      { status: 503 },
    );
  }
  const authHeader = request.headers.get("authorization");
  const rawToken = authHeader?.replace(/^Bearer\s+/i, "") ?? "";
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || !secureCompare(rawToken, cronSecret)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const service = createServiceClient();
  // Limit batch size — long-running polls inside a 60s cron window.
  const { data: jobs } = await service
    .from("voice_clones")
    .select("id, provider, provider_voice_id")
    .eq("status", "training")
    .in("provider", RUNPOD_PROVIDERS as string[])
    .not("provider_voice_id", "is", null)
    .order("created_at", { ascending: true })
    .limit(50);

  if (!jobs || jobs.length === 0) {
    return NextResponse.json({ ok: true, checked: 0, ready: 0, failed: 0 });
  }

  let ready = 0;
  let failed = 0;
  let stillTraining = 0;

  for (const job of jobs) {
    if (
      !RUNPOD_PROVIDERS.includes(job.provider as RunPodCloneProvider) ||
      !job.provider_voice_id
    ) {
      continue;
    }

    let result;
    try {
      result = await pollCloneStatus(
        job.provider as RunPodCloneProvider,
        job.provider_voice_id,
      );
    } catch (err) {
      // Don't crash the whole cron if one job 500s — just count it as
      // failure and continue.
      const reason = err instanceof Error ? err.message : "poll_error";
      await service
        .from("voice_clones")
        .update({ status: "failed", failed_reason: reason })
        .eq("id", job.id);
      failed += 1;
      continue;
    }

    if (result.status === "ready") {
      await service
        .from("voice_clones")
        .update({
          status: "ready",
          ready_at: new Date().toISOString(),
          provider_voice_id: result.fingerprint || job.provider_voice_id,
        })
        .eq("id", job.id);
      ready += 1;
    } else if (result.status === "failed") {
      await service
        .from("voice_clones")
        .update({
          status: "failed",
          failed_reason: result.failedReason || "runpod_failed",
        })
        .eq("id", job.id);
      failed += 1;
    } else {
      stillTraining += 1;
    }
  }

  return NextResponse.json({
    ok: true,
    checked: jobs.length,
    ready,
    failed,
    still_training: stillTraining,
  });
}
