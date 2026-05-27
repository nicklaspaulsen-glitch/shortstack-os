/**
 * Transcription provider abstraction — common types shared by every
 * speech-to-text implementation.
 *
 * Mirrors the voice / email / llm router patterns. Adds a transcription
 * router (`./router.ts`) that picks the right provider based on caller
 * preferences (e.g. `diarize: true` → WhisperX) and which env vars are
 * configured.
 *
 * Cost ranking (cheapest -> most expensive, ballpark):
 *   local_whisper         — runs whisper CLI locally, completely free
 *   runpod_faster_whisper — self-hosted, GPU-second billing, ~free at idle
 *   runpod_whisperx       — same as above + diarization (slightly more GPU)
 *   openai_whisper        — $0.006/min
 *
 * Quality / capability:
 *   - faster-whisper matches stock Whisper accuracy at ~4x the speed
 *     (CTranslate2 backend). Same large-v3 model.
 *   - WhisperX = faster-whisper + pyannote diarization (3.1) so segments
 *     carry SPEAKER_00 / SPEAKER_01 labels suitable for sales-coach
 *     talk-ratio metrics.
 *   - OpenAI Whisper API is whisper-1 (slightly older/smaller than v3) but
 *     reliable and fast cold-start. No diarization.
 */

export type TranscriptionProvider =
  | "openai_whisper"
  | "runpod_faster_whisper"
  | "runpod_whisperx"
  | "local_whisper";

export interface TranscribeOptions {
  /** Public URL the provider can fetch the audio from. */
  audioUrl: string;
  /** ISO-639-1 language hint (e.g. "en"). Whisper auto-detects when omitted. */
  language?: string;
  /**
   * Request speaker diarization. Only honoured by `runpod_whisperx`. The
   * router falls back to a non-diarizing provider when this is true but
   * WhisperX isn't configured — segments arrive without `speaker` labels.
   */
  diarize?: boolean;
  /**
   * Optional hint for WhisperX's diarizer when you know how many people are
   * on the call (e.g. 2 for a sales call). Improves clustering accuracy.
   */
  speakerCountHint?: number;
  /**
   * Force a specific provider as the first attempt. Router still falls
   * through to the next available provider on hard failure.
   */
  preferredProvider?: TranscriptionProvider;
  /**
   * Originating user id for usage tracking + cost attribution. Optional so
   * webhooks / cron paths still work.
   */
  userId?: string;
  /**
   * Free-text label for grouping spend by surface (`meeting`, `voice_call`,
   * `ai-studio`, `script-lab`). Persisted on the source row when relevant.
   */
  context?: string;
}

export interface TranscribeSegment {
  /** Seconds from start of audio. */
  start: number;
  /** Seconds from start of audio. */
  end: number;
  /** Cleaned segment text. */
  text: string;
  /**
   * Diarization label, only present when produced by WhisperX. Format is
   * `SPEAKER_00`, `SPEAKER_01`, ... matching pyannote's output.
   */
  speaker?: string;
  /** Whisper confidence 0..1, when the provider returns it. */
  confidence?: number;
}

export interface TranscribeResult {
  /** Full transcript text (concatenation of segments, normalised). */
  text: string;
  /** Per-segment timing + (optional) diarization labels. */
  segments: TranscribeSegment[];
  /** Detected language code (e.g. "en"). */
  language: string;
  /** Audio duration in seconds. */
  duration_seconds: number;
  /** Which provider actually produced the result. */
  provider: TranscriptionProvider;
  /**
   * Estimated USD cost. OpenAI Whisper has a real per-minute price; the
   * RunPod providers report 0 because GPU billing is amortised across all
   * agents and not per-call.
   */
  cost_usd?: number;
  /**
   * Provider-side job id for long-running / async jobs. When set, callers
   * should poll via the cron handler instead of waiting on the inline call.
   * Null for sync completions.
   */
  job_id?: string | null;
}

export interface TranscriptionProviderImpl {
  /** Stable identifier matching the `transcription_jobs.provider` column. */
  name: TranscriptionProvider;
  /**
   * Whether this provider supports diarization. Router uses this to skip
   * non-diarizing providers when `diarize: true` is requested.
   */
  supportsDiarization: boolean;
  /**
   * Returns true when the provider's required env vars are set. The router
   * skips providers that report unavailable instead of letting them fail
   * mid-transcription.
   */
  available(): boolean;
  /**
   * Run transcription. On failure throw `TranscriptionProviderError` so the
   * router can fall through to the next provider.
   */
  transcribe(opts: TranscribeOptions): Promise<TranscribeResult>;
}

/**
 * Thrown when a provider fails (HTTP error, timeout, malformed response).
 * The router catches these and tries the next available provider.
 */
export class TranscriptionProviderError extends Error {
  constructor(
    public readonly provider: TranscriptionProvider,
    public readonly reason: string,
    public readonly retryable: boolean = true,
  ) {
    super(`[transcription/${provider}] ${reason}`);
    this.name = "TranscriptionProviderError";
  }
}

/**
 * OpenAI Whisper API price: $0.006 / minute, billed per second.
 * https://openai.com/api/pricing
 */
export function estimateOpenAiCostUsd(durationSeconds: number): number {
  if (!Number.isFinite(durationSeconds) || durationSeconds <= 0) return 0;
  return Math.round((durationSeconds / 60) * 0.006 * 10000) / 10000;
}
