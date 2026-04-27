/**
 * RunPod faster-whisper provider — calls a serverless RunPod endpoint that
 * wraps SYSTRAN/faster-whisper (CTranslate2 backend). 4x faster than stock
 * Whisper at the same accuracy, and free at GPU-cost when the worker is
 * already warm.
 *
 * Endpoint contract (matches the upstream community templates):
 *   POST {url}/runsync
 *     { input: { audio_url, language?, model?, return_timestamps? } }
 *   →
 *     { status: "COMPLETED", output: { text, segments: [...], language, duration } }
 *   or
 *     { id, status: "IN_QUEUE" | "IN_PROGRESS" } when cold start exceeds the
 *     runsync timeout — caller polls /status/{id}.
 *
 * Async polling: long meetings (>60 min) often outrun the runsync window. We
 * surface a `job_id` on the result and persist a `transcription_jobs` row so
 * `/api/cron/poll-transcription-jobs` can finish the work and update the
 * source table.
 */

import {
  TranscriptionProviderError,
  type TranscribeOptions,
  type TranscribeResult,
  type TranscriptionProviderImpl,
} from "./provider";

// 60s sync window — anything longer comes back as a job id.
const SYNC_TIMEOUT_MS = 60_000;
const POLL_INTERVAL_MS = 2_000;
// Cap on inline polling. After this we hand off to the cron handler.
const POLL_INLINE_TRIES = 5;

interface RunpodSegment {
  id?: number;
  start: number;
  end: number;
  text: string;
  avg_logprob?: number;
  no_speech_prob?: number;
}

interface RunpodOutput {
  text?: string;
  transcription?: string;
  language?: string;
  duration?: number;
  segments?: RunpodSegment[];
}

interface RunpodResponse {
  status?: string;
  id?: string;
  output?: RunpodOutput;
  error?: string;
}

function envCreds(): { url: string; key: string } | null {
  const url = process.env.RUNPOD_FASTER_WHISPER_ENDPOINT;
  const key = process.env.RUNPOD_FASTER_WHISPER_API_KEY;
  if (!url || !key) return null;
  return { url, key };
}

function normaliseConfidence(seg: RunpodSegment): number | undefined {
  if (typeof seg.avg_logprob === "number") {
    // Whisper avg_logprob is negative, closer to 0 = more confident.
    const conf = Math.max(0, Math.min(1, 1 + seg.avg_logprob / 1.5));
    return Math.round(conf * 1000) / 1000;
  }
  return undefined;
}

function parseOutput(
  output: RunpodOutput,
  jobId: string | null,
  fallbackLanguage: string | undefined,
): TranscribeResult {
  const text = output.text || output.transcription || "";
  const rawSegments = Array.isArray(output.segments) ? output.segments : [];
  const segments = rawSegments.map((seg) => ({
    start: seg.start,
    end: seg.end,
    text: (seg.text || "").trim(),
    confidence: normaliseConfidence(seg),
  }));
  return {
    text,
    segments,
    language: output.language || fallbackLanguage || "en",
    duration_seconds: output.duration ? Math.round(output.duration) : 0,
    provider: "runpod_faster_whisper",
    cost_usd: 0,
    job_id: jobId,
  };
}

async function startJob(
  url: string,
  key: string,
  audioUrl: string,
  language: string | undefined,
): Promise<RunpodResponse> {
  let res: Response;
  try {
    res = await fetch(`${url}/runsync`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        input: {
          audio_url: audioUrl,
          model: "large-v3",
          language: language ?? null,
          task: "transcribe",
          return_timestamps: true,
          word_timestamps: false,
        },
      }),
      signal: AbortSignal.timeout(SYNC_TIMEOUT_MS),
    });
  } catch (err) {
    const reason = err instanceof Error ? err.message : "fetch_error";
    throw new TranscriptionProviderError("runpod_faster_whisper", reason);
  }
  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new TranscriptionProviderError(
      "runpod_faster_whisper",
      `http_${res.status}: ${errText.slice(0, 160)}`,
    );
  }
  try {
    return (await res.json()) as RunpodResponse;
  } catch {
    throw new TranscriptionProviderError("runpod_faster_whisper", "bad_json");
  }
}

async function pollOnce(
  url: string,
  key: string,
  jobId: string,
): Promise<RunpodResponse> {
  const res = await fetch(`${url}/status/${jobId}`, {
    headers: { Authorization: `Bearer ${key}` },
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) {
    throw new TranscriptionProviderError(
      "runpod_faster_whisper",
      `poll_http_${res.status}`,
    );
  }
  return (await res.json()) as RunpodResponse;
}

export const runpodFasterWhisperProvider: TranscriptionProviderImpl = {
  name: "runpod_faster_whisper",
  supportsDiarization: false,

  available(): boolean {
    return envCreds() !== null;
  },

  async transcribe(opts: TranscribeOptions): Promise<TranscribeResult> {
    const creds = envCreds();
    if (!creds) {
      throw new TranscriptionProviderError(
        "runpod_faster_whisper",
        "not_configured",
        false,
      );
    }

    const initial = await startJob(creds.url, creds.key, opts.audioUrl, opts.language);

    if (initial.status === "FAILED") {
      throw new TranscriptionProviderError(
        "runpod_faster_whisper",
        `job_failed: ${(initial.error || "").slice(0, 160)}`,
      );
    }

    if (initial.status === "COMPLETED" && initial.output) {
      return parseOutput(initial.output, null, opts.language);
    }

    // Async / cold-start path. Poll a few times inline; if still pending,
    // surface the job id so the cron handler can finish it.
    if (!initial.id) {
      throw new TranscriptionProviderError(
        "runpod_faster_whisper",
        `no_job_id_status_${initial.status || "unknown"}`,
      );
    }

    for (let i = 0; i < POLL_INLINE_TRIES; i++) {
      await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
      const status = await pollOnce(creds.url, creds.key, initial.id);
      if (status.status === "COMPLETED" && status.output) {
        return parseOutput(status.output, null, opts.language);
      }
      if (status.status === "FAILED") {
        throw new TranscriptionProviderError(
          "runpod_faster_whisper",
          `job_failed_${status.error || "unknown"}`,
        );
      }
    }

    // Still pending — return a stub with the job id so the caller can
    // persist a transcription_jobs row and let the cron finish.
    return {
      text: "",
      segments: [],
      language: opts.language || "en",
      duration_seconds: 0,
      provider: "runpod_faster_whisper",
      cost_usd: 0,
      job_id: initial.id,
    };
  },
};

/**
 * Public helper used by the cron poller. Performs a single status check and
 * normalises the output, or returns null when the job is still pending.
 */
export async function pollFasterWhisperJob(
  jobId: string,
): Promise<TranscribeResult | null> {
  const creds = envCreds();
  if (!creds) {
    throw new TranscriptionProviderError(
      "runpod_faster_whisper",
      "not_configured",
      false,
    );
  }
  const status = await pollOnce(creds.url, creds.key, jobId);
  if (status.status === "COMPLETED" && status.output) {
    return parseOutput(status.output, null, undefined);
  }
  if (status.status === "FAILED") {
    throw new TranscriptionProviderError(
      "runpod_faster_whisper",
      `job_failed_${status.error || "unknown"}`,
    );
  }
  return null;
}
