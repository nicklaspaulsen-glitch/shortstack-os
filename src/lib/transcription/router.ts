/**
 * Transcription router — picks the best provider for the request and falls
 * through across providers when one fails. Mirrors `src/lib/voice/router.ts`.
 *
 * Provider selection logic:
 *   1. If `diarize: true` and WhisperX is configured → WhisperX first
 *      (only provider that produces SPEAKER_xx labels).
 *   2. Else if faster-whisper is configured → faster-whisper (4x faster
 *      than stock Whisper, free at GPU-cost).
 *   3. Else if local whisper CLI is enabled → local_whisper (free, no
 *      API cost, runs whisper CLI as child process).
 *   4. Else → OpenAI Whisper API ($0.006/min, no diarization).
 *
 * Async / cold-start path: when faster-whisper or WhisperX returns a job id
 * (cold start exceeded the runsync window), the router does NOT fall
 * through. Instead it returns the stub result with `job_id` set so the
 * caller can persist a `transcription_jobs` row and let the cron handler
 * finish the work asynchronously. Falling through would mean we re-pay
 * OpenAI for audio the GPU is already processing.
 *
 * Backwards compatibility: when NO env vars are set, the router falls back
 * to OpenAI Whisper if `OPENAI_API_KEY` is set, matching the legacy
 * /api/meetings/[id]/transcribe behaviour.
 */

import { localWhisperProvider } from "./local-whisper";
import { openAiWhisperProvider } from "./openai-whisper";
import { runpodFasterWhisperProvider } from "./runpod-faster-whisper";
import { runpodWhisperXProvider } from "./runpod-whisperx";
import {
  TranscriptionProviderError,
  type TranscribeOptions,
  type TranscribeResult,
  type TranscriptionProvider,
  type TranscriptionProviderImpl,
} from "./provider";

const PROVIDERS: Record<TranscriptionProvider, TranscriptionProviderImpl> = {
  openai_whisper: openAiWhisperProvider,
  runpod_faster_whisper: runpodFasterWhisperProvider,
  runpod_whisperx: runpodWhisperXProvider,
  local_whisper: localWhisperProvider,
};

interface ProviderAttempt {
  provider: TranscriptionProvider;
  reason: string;
}

/**
 * Build the priority order for a request. Diarization-required requests put
 * WhisperX first regardless of caller preference.
 */
function buildPriorityList(opts: TranscribeOptions): TranscriptionProvider[] {
  const seen = new Set<TranscriptionProvider>();
  const order: TranscriptionProvider[] = [];

  const push = (p: TranscriptionProvider | undefined) => {
    if (!p) return;
    if (seen.has(p)) return;
    seen.add(p);
    order.push(p);
  };

  if (opts.diarize) {
    // Diarization requested — WhisperX is the only option that produces
    // speaker labels. Honour caller preference second.
    push("runpod_whisperx");
    push(opts.preferredProvider);
    push("runpod_faster_whisper");
    push("local_whisper");
    push("openai_whisper");
  } else {
    push(opts.preferredProvider);
    push("runpod_faster_whisper");
    push("local_whisper");
    push("openai_whisper");
    push("runpod_whisperx");
  }

  return order;
}

/**
 * Run transcription with provider fall-through. Always resolves with a
 * `TranscribeResult` or throws after every provider failed.
 *
 * Long-running jobs (cold-start runpod) come back with a populated
 * `job_id` and an empty `text` — callers must persist a
 * `transcription_jobs` row and rely on the cron poller to finalise.
 */
export async function transcribe(
  opts: TranscribeOptions,
): Promise<TranscribeResult> {
  if (!opts.audioUrl || typeof opts.audioUrl !== "string") {
    throw new Error("transcribe: audioUrl is required");
  }

  const order = buildPriorityList(opts);
  const attempts: ProviderAttempt[] = [];

  for (const name of order) {
    const provider = PROVIDERS[name];
    if (!provider.available()) {
      attempts.push({ provider: name, reason: "not_configured" });
      continue;
    }

    try {
      const result = await provider.transcribe(opts);
      // Job-pending result — surface to caller as-is so they can persist a
      // transcription_jobs row. Don't fall through.
      if (result.job_id) {
        return result;
      }
      return result;
    } catch (err) {
      const reason =
        err instanceof TranscriptionProviderError
          ? err.reason
          : err instanceof Error
            ? err.message
            : "unknown_error";
      attempts.push({ provider: name, reason });
      // Hard not_configured shouldn't keep retrying the same provider — but
      // we still drop through to the next provider this request, which is
      // the entire point of the router.
      console.warn(
        `[transcription/router] ${name} failed (${reason}); trying next`,
      );
    }
  }

  const summary = attempts.map((a) => `${a.provider}=${a.reason}`).join(", ");
  throw new Error(
    `All transcription providers failed: ${summary || "no providers configured"}`,
  );
}

/**
 * Snapshot of every provider's availability — used by the dashboard
 * "transcription provider status" tile and the self-test fixtures.
 */
export function getTranscriptionProviderStatus(): Array<{
  name: TranscriptionProvider;
  available: boolean;
  supportsDiarization: boolean;
}> {
  return (Object.keys(PROVIDERS) as TranscriptionProvider[]).map((name) => ({
    name,
    available: PROVIDERS[name].available(),
    supportsDiarization: PROVIDERS[name].supportsDiarization,
  }));
}

/**
 * Re-export common types so callers can import everything from
 * `@/lib/transcription/router` instead of reaching into provider.ts.
 */
export type {
  TranscribeOptions,
  TranscribeResult,
  TranscribeSegment,
  TranscriptionProvider,
} from "./provider";
