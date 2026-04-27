/**
 * OpenAI Whisper provider — wraps `client.audio.transcriptions.create` so the
 * router-level callers see the same `TranscribeResult` shape every other
 * provider produces.
 *
 * Caveats vs RunPod:
 *   - No diarization (returns segments without speaker labels). The router
 *     falls back to single-speaker output when WhisperX isn't configured.
 *   - $0.006/min — billed by OpenAI. Tracked in `cost_usd` on the result.
 *   - Whisper-1 model is older than v3; accuracy is fine for English calls
 *     but accents + jargon-heavy meetings benefit from WhisperX/v3.
 */

import OpenAI from "openai";
import {
  TranscriptionProviderError,
  estimateOpenAiCostUsd,
  type TranscribeOptions,
  type TranscribeResult,
  type TranscriptionProviderImpl,
} from "./provider";

// Lazy singleton — see CLAUDE.md "Module-level SDK init is BANNED" rule.
let _openai: OpenAI | null = null;
function getOpenAIClient(): OpenAI {
  if (!_openai) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new TranscriptionProviderError(
        "openai_whisper",
        "OPENAI_API_KEY not configured",
        false,
      );
    }
    _openai = new OpenAI({ apiKey });
  }
  return _openai;
}

interface WhisperVerboseJson {
  text: string;
  language?: string;
  duration?: number;
  segments?: Array<{
    id?: number;
    start: number;
    end: number;
    text: string;
    avg_logprob?: number;
  }>;
}

/**
 * Convert Whisper's `avg_logprob` (negative number, closer to 0 = more
 * confident) into a 0..1 confidence score. Pure heuristic — Whisper doesn't
 * publish a calibrated confidence metric, but exposing something is better
 * than swallowing it.
 */
function normaliseConfidence(avgLogprob?: number): number | undefined {
  if (typeof avgLogprob !== "number" || !Number.isFinite(avgLogprob)) return undefined;
  // Most whisper-1 segments fall in [-1.5, 0]. Map to [0, 1].
  const normalised = Math.max(0, Math.min(1, 1 + avgLogprob / 1.5));
  return Math.round(normalised * 1000) / 1000;
}

export const openAiWhisperProvider: TranscriptionProviderImpl = {
  name: "openai_whisper",
  supportsDiarization: false,

  available(): boolean {
    return Boolean(process.env.OPENAI_API_KEY);
  },

  async transcribe(opts: TranscribeOptions): Promise<TranscribeResult> {
    const client = getOpenAIClient();

    // OpenAI's SDK requires a `File` upload — fetch the audio first.
    let audioBlob: Blob;
    let filename: string;
    try {
      const audioResp = await fetch(opts.audioUrl);
      if (!audioResp.ok) {
        throw new TranscriptionProviderError(
          "openai_whisper",
          `audio fetch failed (${audioResp.status})`,
        );
      }
      audioBlob = await audioResp.blob();
      filename = opts.audioUrl.split("/").pop()?.split("?")[0] || "audio.webm";
    } catch (err) {
      if (err instanceof TranscriptionProviderError) throw err;
      const reason = err instanceof Error ? err.message : "audio fetch error";
      throw new TranscriptionProviderError("openai_whisper", reason);
    }

    const file = new File([audioBlob], filename, {
      type: audioBlob.type || "audio/webm",
    });

    let raw: WhisperVerboseJson;
    try {
      const response = await client.audio.transcriptions.create({
        file,
        model: "whisper-1",
        response_format: "verbose_json",
        timestamp_granularities: ["segment"],
        language: opts.language,
      });
      raw = response as unknown as WhisperVerboseJson;
    } catch (err) {
      const reason = err instanceof Error ? err.message : "openai api error";
      throw new TranscriptionProviderError("openai_whisper", reason);
    }

    const rawSegments = Array.isArray(raw.segments) ? raw.segments : [];
    const segments = rawSegments.map((seg) => ({
      start: seg.start,
      end: seg.end,
      text: seg.text.trim(),
      confidence: normaliseConfidence(seg.avg_logprob),
    }));

    const duration = typeof raw.duration === "number" ? Math.round(raw.duration) : 0;
    return {
      text: raw.text,
      segments,
      language: raw.language || opts.language || "en",
      duration_seconds: duration,
      provider: "openai_whisper",
      cost_usd: estimateOpenAiCostUsd(duration),
      job_id: null,
    };
  },
};
