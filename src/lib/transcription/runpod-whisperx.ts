/**
 * RunPod WhisperX provider — faster-whisper + pyannote 3.1 speaker
 * diarization. Returns segments WITH `SPEAKER_00`/`SPEAKER_01` labels so the
 * AI Sales Coach can compute proper rep / prospect talk-ratios and the
 * meeting transcript view can color-code turns.
 *
 * Endpoint contract (community RunPod template):
 *   POST {url}/runsync
 *     {
 *       input: {
 *         audio_url, language?, model?,
 *         diarize: true, min_speakers?, max_speakers?
 *       }
 *     }
 *   →
 *     {
 *       status: "COMPLETED",
 *       output: {
 *         text, segments: [{ start, end, text, speaker, ... }],
 *         language, duration
 *       }
 *     }
 *
 * Notes:
 *   - Diarization requires HUGGINGFACE_TOKEN in the RunPod worker env. The
 *     pyannote/speaker-diarization-3.1 model is gated; the worker needs a
 *     token for an account that accepted the TOS.
 *   - GPU requirement: RTX 3090 minimum. T4/A10 work for short calls but
 *     OOM on hour-long meetings.
 *   - Same async polling pattern as faster-whisper.
 */

import {
  TranscriptionProviderError,
  type TranscribeOptions,
  type TranscribeResult,
  type TranscriptionProviderImpl,
} from "./provider";

const SYNC_TIMEOUT_MS = 60_000;
const POLL_INTERVAL_MS = 2_000;
const POLL_INLINE_TRIES = 5;

interface WhisperXSegment {
  id?: number;
  start: number;
  end: number;
  text: string;
  speaker?: string;
  avg_logprob?: number;
}

interface WhisperXOutput {
  text?: string;
  transcription?: string;
  language?: string;
  duration?: number;
  segments?: WhisperXSegment[];
}

interface WhisperXResponse {
  status?: string;
  id?: string;
  output?: WhisperXOutput;
  error?: string;
}

function envCreds(): { url: string; key: string } | null {
  const url = process.env.RUNPOD_WHISPERX_ENDPOINT;
  const key = process.env.RUNPOD_WHISPERX_API_KEY;
  if (!url || !key) return null;
  return { url, key };
}

function normaliseConfidence(seg: WhisperXSegment): number | undefined {
  if (typeof seg.avg_logprob === "number") {
    const conf = Math.max(0, Math.min(1, 1 + seg.avg_logprob / 1.5));
    return Math.round(conf * 1000) / 1000;
  }
  return undefined;
}

function parseOutput(
  output: WhisperXOutput,
  jobId: string | null,
  fallbackLanguage: string | undefined,
): TranscribeResult {
  const text = output.text || output.transcription || "";
  const rawSegments = Array.isArray(output.segments) ? output.segments : [];
  const segments = rawSegments.map((seg) => ({
    start: seg.start,
    end: seg.end,
    text: (seg.text || "").trim(),
    // WhisperX produces "SPEAKER_00", "SPEAKER_01", ... — we keep them as-is
    // so the existing meetings.transcript_speaker_labeled jsonb shape stays
    // stable and the coach metrics module can classify them.
    speaker: seg.speaker || undefined,
    confidence: normaliseConfidence(seg),
  }));
  return {
    text,
    segments,
    language: output.language || fallbackLanguage || "en",
    duration_seconds: output.duration ? Math.round(output.duration) : 0,
    provider: "runpod_whisperx",
    cost_usd: 0,
    job_id: jobId,
  };
}

async function startJob(
  url: string,
  key: string,
  opts: TranscribeOptions,
): Promise<WhisperXResponse> {
  const minSpeakers =
    typeof opts.speakerCountHint === "number" && opts.speakerCountHint > 0
      ? Math.max(1, Math.floor(opts.speakerCountHint - 1))
      : undefined;
  const maxSpeakers =
    typeof opts.speakerCountHint === "number" && opts.speakerCountHint > 0
      ? Math.max(1, Math.ceil(opts.speakerCountHint + 1))
      : undefined;

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
          audio_url: opts.audioUrl,
          model: "large-v3",
          language: opts.language ?? null,
          task: "transcribe",
          diarize: true,
          return_timestamps: true,
          word_timestamps: false,
          ...(minSpeakers !== undefined ? { min_speakers: minSpeakers } : {}),
          ...(maxSpeakers !== undefined ? { max_speakers: maxSpeakers } : {}),
        },
      }),
      signal: AbortSignal.timeout(SYNC_TIMEOUT_MS),
    });
  } catch (err) {
    const reason = err instanceof Error ? err.message : "fetch_error";
    throw new TranscriptionProviderError("runpod_whisperx", reason);
  }
  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new TranscriptionProviderError(
      "runpod_whisperx",
      `http_${res.status}: ${errText.slice(0, 160)}`,
    );
  }
  try {
    return (await res.json()) as WhisperXResponse;
  } catch {
    throw new TranscriptionProviderError("runpod_whisperx", "bad_json");
  }
}

async function pollOnce(
  url: string,
  key: string,
  jobId: string,
): Promise<WhisperXResponse> {
  const res = await fetch(`${url}/status/${jobId}`, {
    headers: { Authorization: `Bearer ${key}` },
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) {
    throw new TranscriptionProviderError(
      "runpod_whisperx",
      `poll_http_${res.status}`,
    );
  }
  return (await res.json()) as WhisperXResponse;
}

export const runpodWhisperXProvider: TranscriptionProviderImpl = {
  name: "runpod_whisperx",
  supportsDiarization: true,

  available(): boolean {
    return envCreds() !== null;
  },

  async transcribe(opts: TranscribeOptions): Promise<TranscribeResult> {
    const creds = envCreds();
    if (!creds) {
      throw new TranscriptionProviderError(
        "runpod_whisperx",
        "not_configured",
        false,
      );
    }

    const initial = await startJob(creds.url, creds.key, opts);

    if (initial.status === "FAILED") {
      throw new TranscriptionProviderError(
        "runpod_whisperx",
        `job_failed: ${(initial.error || "").slice(0, 160)}`,
      );
    }

    if (initial.status === "COMPLETED" && initial.output) {
      return parseOutput(initial.output, null, opts.language);
    }

    if (!initial.id) {
      throw new TranscriptionProviderError(
        "runpod_whisperx",
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
          "runpod_whisperx",
          `job_failed_${status.error || "unknown"}`,
        );
      }
    }

    return {
      text: "",
      segments: [],
      language: opts.language || "en",
      duration_seconds: 0,
      provider: "runpod_whisperx",
      cost_usd: 0,
      job_id: initial.id,
    };
  },
};

/**
 * Public helper used by the cron poller — single status check, returns null
 * when still pending.
 */
export async function pollWhisperXJob(
  jobId: string,
): Promise<TranscribeResult | null> {
  const creds = envCreds();
  if (!creds) {
    throw new TranscriptionProviderError(
      "runpod_whisperx",
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
      "runpod_whisperx",
      `job_failed_${status.error || "unknown"}`,
    );
  }
  return null;
}
