/**
 * Voice provider abstraction — common types shared by every TTS implementation.
 *
 * Replaces the hard-coded ElevenLabs calls scattered across API routes with a
 * single router (`./router.ts`) that picks the right provider based on
 * configuration + caller preferences.
 *
 * Cost ranking (cheapest → most expensive, ballpark):
 *   runpod_xtts    — self-hosted, ~$0.0003/sec audio (idle worker is free)
 *   openai_tts     — $0.015/1k chars (tts-1)  /  $0.030/1k chars (tts-1-hd)
 *   elevenlabs     — ~$0.18/1k chars on Creator tier; ~$0.30/1k chars on Pro
 */

export type VoiceProvider = "runpod_xtts" | "elevenlabs" | "openai_tts";

export interface VoiceSynthRequest {
  /** The text to synthesize. Implementations should reject empty strings. */
  text: string;
  /** Provider-specific voice id. ElevenLabs voice id, OpenAI voice name, etc. */
  voiceId?: string;
  /** Speech rate. OpenAI clamps to [0.7, 1.3]; XTTS interprets as a multiplier. */
  speed?: number;
  /** Output format hint; some providers default-emit MP3 regardless. */
  format?: "mp3" | "wav" | "pcm";
  /**
   * Originating user id (for usage tracking + cost attribution).
   * Optional so unauthenticated callers (e.g. webhooks) still work.
   */
  userId?: string;
  /**
   * Free-text label so we can group spend by surface (`dialer`, `receptionist`,
   * `voicemail`, `preview`, etc.). Persisted on `voice_usage_events.context`.
   */
  context?: string;
}

export interface VoiceSynthResponse {
  /** Raw audio bytes. Buffer on Node runtimes, Uint8Array on edge. */
  audio: Buffer | Uint8Array;
  /** MIME type (`audio/mpeg`, `audio/wav`, `audio/pcm`). */
  contentType: string;
  /** Synthesized clip length in seconds, when the provider returns it. */
  durationSeconds?: number;
  /** Estimated USD spend for this synthesis. Logged to `voice_usage_events`. */
  costEstimate?: number;
  /** Which provider actually served the audio. */
  provider: VoiceProvider;
}

export interface VoiceProviderImpl {
  /** Stable identifier matching the `voice_usage_events.provider` enum. */
  name: VoiceProvider;
  /** Per-character USD cost estimate; rough — used only for budgeting telemetry. */
  costPerCharUsd: number;
  /**
   * Returns true when the provider's required env vars are set. The router
   * skips providers that report unavailable instead of letting them fail
   * mid-synthesis.
   */
  available(): boolean;
  /**
   * Synthesize speech. On failure, throw `VoiceProviderError` so the router
   * can fall through to the next provider.
   */
  synthesize(req: VoiceSynthRequest): Promise<VoiceSynthResponse>;
}

/**
 * Thrown when a provider fails (HTTP error, timeout, malformed response).
 * The router catches these and tries the next provider in the priority list.
 */
export class VoiceProviderError extends Error {
  constructor(
    public readonly provider: VoiceProvider,
    public readonly reason: string,
    public readonly retryable: boolean = true,
  ) {
    super(`[voice/${provider}] ${reason}`);
    this.name = "VoiceProviderError";
  }
}

/**
 * Compute estimated cost for a synthesis based on character count.
 * Conservative: rounds up to the next character to avoid undercounting spend.
 */
export function estimateCostUsd(
  characters: number,
  costPerCharUsd: number,
): number {
  if (characters <= 0 || costPerCharUsd <= 0) return 0;
  // Keep four decimals — enough for a single ElevenLabs sentence.
  return Math.round(characters * costPerCharUsd * 10000) / 10000;
}
