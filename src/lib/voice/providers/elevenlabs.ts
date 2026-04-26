import {
  type VoiceProviderImpl,
  type VoiceSynthRequest,
  type VoiceSynthResponse,
  VoiceProviderError,
  estimateCostUsd,
} from "../provider";

/**
 * ElevenLabs — premium commercial TTS.
 *
 * Available when `ELEVENLABS_API_KEY` (or alias `XI_API_KEY`) is set.
 * Cost: Creator tier is $22/100k chars = $0.00022/char; Pro is closer to
 * $0.0003/char. We use $0.00018/char as the floor since most agencies start
 * on Creator. Real spend is reconciled later from ElevenLabs invoices.
 */

const COST_PER_CHAR = 0.00018;

// Charlotte — calm, composed, British female. Same default the existing
// /api/tts/speak route uses, so falling back to ElevenLabs sounds identical.
const DEFAULT_VOICE_ID = "XB0fDUnXU5powFXDhCwa";

const DEFAULT_TIMEOUT_MS = 30_000;

function getApiKey(): string | undefined {
  return process.env.ELEVENLABS_API_KEY || process.env.XI_API_KEY;
}

export const elevenLabsProvider: VoiceProviderImpl = {
  name: "elevenlabs",
  costPerCharUsd: COST_PER_CHAR,

  available(): boolean {
    return Boolean(getApiKey());
  },

  async synthesize(req: VoiceSynthRequest): Promise<VoiceSynthResponse> {
    const apiKey = getApiKey();
    if (!apiKey) {
      throw new VoiceProviderError("elevenlabs", "not_configured", false);
    }

    const text = req.text.trim();
    if (!text) {
      throw new VoiceProviderError("elevenlabs", "empty_text", false);
    }

    const voiceId =
      req.voiceId || process.env.ELEVENLABS_VOICE_ID || DEFAULT_VOICE_ID;

    let res: Response;
    try {
      res = await fetch(
        `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}?output_format=mp3_44100_128`,
        {
          method: "POST",
          headers: {
            "xi-api-key": apiKey,
            "Content-Type": "application/json",
            Accept: "audio/mpeg",
          },
          body: JSON.stringify({
            text,
            model_id: "eleven_turbo_v2_5",
            voice_settings: {
              stability: 0.7,
              similarity_boost: 0.8,
              style: 0.0,
              use_speaker_boost: true,
            },
          }),
          signal: AbortSignal.timeout(DEFAULT_TIMEOUT_MS),
        },
      );
    } catch (err) {
      const reason = err instanceof Error ? err.message : "fetch_error";
      throw new VoiceProviderError("elevenlabs", reason);
    }

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      // 402 = quota exhausted; surface that distinctly so the router can
      // log the right hint and we can spot it in voice_usage_events.context.
      const reason = `http_${res.status}: ${errText.slice(0, 160)}`;
      // 402 / 429 are retryable on a different provider (fall through),
      // but obviously not on the same one — `retryable` is router-level.
      throw new VoiceProviderError("elevenlabs", reason);
    }

    const arrayBuffer = await res.arrayBuffer();
    return {
      audio: Buffer.from(arrayBuffer),
      contentType: "audio/mpeg",
      provider: "elevenlabs",
      costEstimate: estimateCostUsd(text.length, COST_PER_CHAR),
    };
  },
};
