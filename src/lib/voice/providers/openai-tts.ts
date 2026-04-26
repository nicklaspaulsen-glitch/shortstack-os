import {
  type VoiceProviderImpl,
  type VoiceSynthRequest,
  type VoiceSynthResponse,
  VoiceProviderError,
  estimateCostUsd,
} from "../provider";

/**
 * OpenAI TTS (`tts-1` + `tts-1-hd`).
 *
 * Available when `OPENAI_API_KEY` is set. Default voice: `nova` (warm, slightly
 * British female — closest match to the ElevenLabs Charlotte default).
 *
 * Cost:
 *   tts-1     — $15 / 1M chars  → $0.000015/char
 *   tts-1-hd  — $30 / 1M chars  → $0.000030/char
 * We default to tts-1 because the dialer + receptionist priorities latency.
 */

const COST_PER_CHAR_STANDARD = 0.000015;
const COST_PER_CHAR_HD = 0.00003;

const DEFAULT_VOICE = "nova";

const DEFAULT_TIMEOUT_MS = 30_000;

function getModel(): "tts-1" | "tts-1-hd" {
  const env = process.env.OPENAI_TTS_MODEL?.toLowerCase();
  return env === "tts-1-hd" ? "tts-1-hd" : "tts-1";
}

export const openaiTtsProvider: VoiceProviderImpl = {
  name: "openai_tts",
  // Reflect the standard model since that's the default. HD synthesis
  // computes its own cost in `synthesize`.
  costPerCharUsd: COST_PER_CHAR_STANDARD,

  available(): boolean {
    return Boolean(process.env.OPENAI_API_KEY);
  },

  async synthesize(req: VoiceSynthRequest): Promise<VoiceSynthResponse> {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new VoiceProviderError("openai_tts", "not_configured", false);
    }

    const text = req.text.trim();
    if (!text) {
      throw new VoiceProviderError("openai_tts", "empty_text", false);
    }

    const model = getModel();
    const voice =
      req.voiceId || process.env.OPENAI_TTS_VOICE || DEFAULT_VOICE;
    // OpenAI clamps speed to [0.25, 4.0] but only [0.7, 1.3] sounds natural.
    const speed = Math.max(0.7, Math.min(1.3, req.speed ?? 1.0));

    let res: Response;
    try {
      res = await fetch("https://api.openai.com/v1/audio/speech", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model,
          voice,
          input: text,
          response_format: req.format === "wav" ? "wav" : "mp3",
          speed,
        }),
        signal: AbortSignal.timeout(DEFAULT_TIMEOUT_MS),
      });
    } catch (err) {
      const reason = err instanceof Error ? err.message : "fetch_error";
      throw new VoiceProviderError("openai_tts", reason);
    }

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      throw new VoiceProviderError(
        "openai_tts",
        `http_${res.status}: ${errText.slice(0, 160)}`,
      );
    }

    const arrayBuffer = await res.arrayBuffer();
    const costPerChar =
      model === "tts-1-hd" ? COST_PER_CHAR_HD : COST_PER_CHAR_STANDARD;

    return {
      audio: Buffer.from(arrayBuffer),
      contentType: req.format === "wav" ? "audio/wav" : "audio/mpeg",
      provider: "openai_tts",
      costEstimate: estimateCostUsd(text.length, costPerChar),
    };
  },
};
