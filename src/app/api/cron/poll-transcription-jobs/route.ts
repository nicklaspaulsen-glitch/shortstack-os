/**
 * GET /api/cron/poll-transcription-jobs
 *
 * Every minute Vercel hits this route. We pick up to 25 pending RunPod jobs
 * (queued or processing), poll their status, and on COMPLETED:
 *   1. Persist the transcript on the source row (meetings / voice_calls).
 *   2. Mark the job row `completed`.
 * On FAILED:
 *   - Mark the job row `failed` with the error message.
 *
 * Auth: Bearer CRON_SECRET — same pattern as every other cron in this repo.
 *
 * Per-tick cap (25) is conservative: each poll is a single HTTP call to
 * RunPod, no LLM spend involved. The cron runs every minute so backlog
 * drains within a few minutes even on heavy days.
 */

import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { pollFasterWhisperJob } from "@/lib/transcription/runpod-faster-whisper";
import { pollWhisperXJob } from "@/lib/transcription/runpod-whisperx";
import {
  writeTranscriptToSource,
  type TranscriptionSourceTable,
} from "@/lib/transcription/job-completion";
import type { TranscribeResult } from "@/lib/transcription/provider";

export const maxDuration = 300;
export const dynamic = "force-dynamic";

const PER_TICK_LIMIT = 25;
// After this many failed polls we mark the job failed so the queue doesn't
// loop forever on a stuck RunPod job. RunPod times out cold-start jobs at
// ~10 minutes, so 15 polling attempts (~15 min) is plenty.
const MAX_ATTEMPTS = 15;

interface JobRow {
  id: string;
  agency_owner_id: string;
  source_table: string;
  source_id: string;
  audio_url: string;
  provider: string;
  provider_job_id: string | null;
  status: string;
  attempts: number;
  diarize: boolean;
}

async function pollProvider(
  provider: string,
  jobId: string,
): Promise<TranscribeResult | null> {
  if (provider === "runpod_whisperx") {
    return pollWhisperXJob(jobId);
  }
  if (provider === "runpod_faster_whisper") {
    return pollFasterWhisperJob(jobId);
  }
  // openai_whisper jobs are sync-only; if one ever lands here, mark failed.
  throw new Error(`unsupported provider for polling: ${provider}`);
}

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const service = createServiceClient();

  const { data: pending, error: listErr } = await service
    .from("transcription_jobs")
    .select(
      "id, agency_owner_id, source_table, source_id, audio_url, provider, provider_job_id, status, attempts, diarize",
    )
    .in("status", ["queued", "processing"])
    .order("started_at", { ascending: true })
    .limit(PER_TICK_LIMIT);

  if (listErr) {
    console.error("[cron/poll-transcription-jobs] list failed", listErr);
    return NextResponse.json({ error: listErr.message }, { status: 500 });
  }

  const jobs: JobRow[] = (pending || []) as JobRow[];

  let completed = 0;
  let failed = 0;
  let stillPending = 0;
  const errors: Array<{ id: string; reason: string }> = [];

  for (const job of jobs) {
    const nextAttempts = job.attempts + 1;

    // No provider job id — defensive, this shouldn't happen but failing the
    // row is better than re-polling forever.
    if (!job.provider_job_id) {
      await service
        .from("transcription_jobs")
        .update({
          status: "failed",
          error_message: "missing provider_job_id",
          completed_at: new Date().toISOString(),
          attempts: nextAttempts,
        })
        .eq("id", job.id);
      failed += 1;
      errors.push({ id: job.id, reason: "missing provider_job_id" });
      continue;
    }

    try {
      const result = await pollProvider(job.provider, job.provider_job_id);

      if (result === null) {
        // Still pending. If we've polled too many times, give up.
        if (nextAttempts >= MAX_ATTEMPTS) {
          await service
            .from("transcription_jobs")
            .update({
              status: "failed",
              error_message: `exceeded MAX_ATTEMPTS (${MAX_ATTEMPTS}) without completion`,
              completed_at: new Date().toISOString(),
              attempts: nextAttempts,
            })
            .eq("id", job.id);
          failed += 1;
          errors.push({ id: job.id, reason: "max_attempts" });
        } else {
          await service
            .from("transcription_jobs")
            .update({
              status: "processing",
              attempts: nextAttempts,
            })
            .eq("id", job.id);
          stillPending += 1;
        }
        continue;
      }

      // COMPLETED — write transcript back to source then mark job done.
      const ok = await writeTranscriptToSource({
        supabase: service,
        sourceTable: job.source_table as TranscriptionSourceTable,
        sourceId: job.source_id,
        result,
      });

      await service
        .from("transcription_jobs")
        .update({
          status: ok ? "completed" : "failed",
          error_message: ok ? null : "source row update failed",
          result: result as unknown as Record<string, unknown>,
          completed_at: new Date().toISOString(),
          attempts: nextAttempts,
        })
        .eq("id", job.id);

      if (ok) {
        completed += 1;
      } else {
        failed += 1;
        errors.push({ id: job.id, reason: "source_update_failed" });
      }
    } catch (err) {
      const reason = err instanceof Error ? err.message : "unknown";
      // Genuine provider failures get marked failed immediately — re-trying
      // a confirmed FAILED job won't help.
      const looksTerminal = /job_failed/.test(reason);
      const giveUp = looksTerminal || nextAttempts >= MAX_ATTEMPTS;
      await service
        .from("transcription_jobs")
        .update({
          status: giveUp ? "failed" : "processing",
          error_message: reason.slice(0, 500),
          attempts: nextAttempts,
          completed_at: giveUp ? new Date().toISOString() : null,
        })
        .eq("id", job.id);
      if (giveUp) {
        failed += 1;
        errors.push({ id: job.id, reason: reason.slice(0, 200) });
      } else {
        stillPending += 1;
      }
    }
  }

  return NextResponse.json({
    ok: true,
    queue_size: jobs.length,
    completed,
    failed,
    still_pending: stillPending,
    errors,
    timestamp: new Date().toISOString(),
  });
}
