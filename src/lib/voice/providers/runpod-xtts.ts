import {
  type VoiceProviderImpl,
  type VoiceSynthRequest,
  type VoiceSynthResponse,
  VoiceProviderError,
  estimateCostUsd,
} from "../provider";

/**
 * RunPod XTTS v2 — self-hosted, free TTS.
 *
 * Available when `RUNPOD_XTTS_URL` + `RUNPOD_API_KEY` are both set.
 * Cost is dominated by RunPod GPU-second billing (~$0.0003/sec of audio
 * when the worker is hot; idle is free with serverless workers).
 *
 * The worker accepts:
 *   { input: { text, language, speaker_wav? } }
 * and returns one of:
 *   { audio_base64 } | { audio } | { url }
 */

// $/character — back-of-the-envelope: ~15 chars/sec of speech, $0.0003/sec
// → ~$0.00002/char. Cheaper than every commercial provider.
const COST_PER_CHAR = 0.00002;

const DEFAULT_TIMEOUT_MS = 90_000;

interface XttsOutput {
  audio_base64?: string;
  audio?: string;
  audio_data?: string;
  url?: string;
  audio_url?: string;
}

interface XttsResponse {
  status?: string;
  output?: XttsOutput | string;
  error?: string;
}

function base64ToBuffer(b64: string): Buffer {
  const cleaned = b64.replace(/^data:[^;]+;base64,/, "");
  return Buffer.from(cleaned, "base64");
}

export const runpodXttsProvider: VoiceProviderImpl = {
  name: "runpod_xtts",
  costPerCharUsd: COST_PER_CHAR,

  available(): boolean {
    return Boolean(process.env.RUNPOD_XTTS_URL && process.env.RUNPOD_API_KEY);
  },

  async synthesize(req: VoiceSynthRequest): Promise<VoiceSynthResponse> {
    const url = process.env.RUNPOD_XTTS_URL;
    const key = process.env.RUNPOD_API_KEY;
    if (!url || !key) {
      throw new VoiceProviderError("runpod_xtts", "not_configured", false);
    }

    const text = req.text.trim();
    if (!text) {
      throw new VoiceProviderError("runpod_xtts", "empty_text", false);
    }

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
            text,
            language: "en",
            // Speaker_wav for voice cloning can be added later.
          },
        }),
        signal: AbortSignal.timeout(DEFAULT_TIMEOUT_MS),
      });
    } catch (err) {
      const reason = err instanceof Error ? err.message : "fetch_error";
      throw new VoiceProviderError("runpod_xtts", reason);
    }

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      throw new VoiceProviderError(
        "runpod_xtts",
        `http_${res.status}: ${errText.slice(0, 160)}`,
      );
    }

    let data: XttsResponse;
    try {
      data = (await res.json()) as XttsResponse;
    } catch {
      throw new VoiceProviderError("runpod_xtts", "bad_json");
    }

    if (data.status !== "COMPLETED" || !data.output) {
      throw new VoiceProviderError(
        "runpod_xtts",
        `job_${data.status || "unknown"}: ${data.error || ""}`.trim(),
      );
    }

    const output = data.output;
    let audio: Buffer | null = null;

    if (typeof output === "string") {
      audio = base64ToBuffer(output);
    } else {
      const b64 =
        output.audio_base64 || output.audio || output.audio_data || null;
      const remoteUrl = output.url || output.audio_url || null;
      if (b64) {
        audio = base64ToBuffer(b64);
      } else if (remoteUrl) {
        try {
          const fetched = await fetch(remoteUrl, {
            signal: AbortSignal.timeout(30_000),
          });
          if (!fetched.ok) {
            throw new VoiceProviderError(
              "runpod_xtts",
              `fetch_url_${fetched.status}`,
            );
          }
          audio = Buffer.from(await fetched.arrayBuffer());
        } catch (err) {
          if (err instanceof VoiceProviderError) throw err;
          const reason = err instanceof Error ? err.message : "fetch_url_error";
          throw new VoiceProviderError("runpod_xtts", reason);
        }
      }
    }

    if (!audio) {
      throw new VoiceProviderError("runpod_xtts", "no_audio_in_output");
    }

    return {
      audio,
      contentType: "audio/wav",
      provider: "runpod_xtts",
      costEstimate: estimateCostUsd(text.length, COST_PER_CHAR),
    };
  },
};
