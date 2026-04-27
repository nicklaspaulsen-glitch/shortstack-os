/**
 * ElevenLabs Voices API client — focused on voice cloning surface.
 *
 * Separate from `providers/elevenlabs.ts` (which is a synthesis-only provider
 * inside the cost-routing pipeline). This module owns the
 * create/synthesize-with-clone/delete lifecycle for voice cloning.
 *
 * API reference: https://elevenlabs.io/docs/api-reference/voices/add
 */

const API_BASE = "https://api.elevenlabs.io/v1";
const DEFAULT_TIMEOUT_MS = 60_000;

function getApiKey(): string {
  const key = process.env.ELEVENLABS_API_KEY || process.env.XI_API_KEY;
  if (!key) {
    throw new Error(
      "ElevenLabs not configured. Set ELEVENLABS_API_KEY (or XI_API_KEY) in env.",
    );
  }
  return key;
}

export interface InstantVoiceSample {
  /** File buffer for the sample. */
  buffer: Buffer;
  /** Original filename — ElevenLabs uses this for the part name. */
  filename: string;
  /** MIME type — recommended audio/mpeg or audio/wav. */
  contentType: string;
}

export interface CreateInstantVoiceResult {
  voiceId: string;
  /** ElevenLabs returns a "name" echo — surfaced for sanity-check logging. */
  name: string;
}

/**
 * Create an instant voice clone from one or more audio samples.
 *
 * ElevenLabs Instant Voice Cloning is synchronous (returns a voice_id ready
 * to use immediately). For Professional Voice Cloning (longer samples,
 * higher fidelity) we'd use the same endpoint with `trained_at` polling —
 * out of scope for v1.
 */
export async function createInstantVoice(
  samples: InstantVoiceSample[],
  label: string,
  description?: string,
): Promise<CreateInstantVoiceResult> {
  if (samples.length === 0) {
    throw new Error("createInstantVoice: at least one sample is required.");
  }
  const apiKey = getApiKey();

  const form = new FormData();
  form.append("name", label);
  if (description) form.append("description", description);

  for (const sample of samples) {
    // Convert Node Buffer → Blob for the multipart body. We can't use plain
    // Buffer here — fetch's FormData expects Blob/File-shaped values.
    const arr = new Uint8Array(sample.buffer);
    const blob = new Blob([arr], { type: sample.contentType });
    form.append("files", blob, sample.filename);
  }

  const res = await fetch(`${API_BASE}/voices/add`, {
    method: "POST",
    headers: {
      "xi-api-key": apiKey,
    },
    body: form,
    signal: AbortSignal.timeout(DEFAULT_TIMEOUT_MS),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(
      `ElevenLabs createInstantVoice failed: ${res.status} ${text.slice(0, 240)}`,
    );
  }

  const data = (await res.json()) as { voice_id?: string; name?: string };
  if (!data.voice_id) {
    throw new Error(
      "ElevenLabs createInstantVoice: response missing voice_id field.",
    );
  }

  return { voiceId: data.voice_id, name: data.name || label };
}

export interface SynthesizeWithVoiceOptions {
  /** Voice id returned by `createInstantVoice` or a preset id. */
  voiceId: string;
  text: string;
  /** Stability 0-1, default 0.7. */
  stability?: number;
  /** Similarity boost 0-1, default 0.8. */
  similarityBoost?: number;
  /** Style 0-1, default 0.0. */
  style?: number;
  /** Output format. Defaults to mp3_44100_128 — the smallest acceptable. */
  outputFormat?: "mp3_44100_128" | "mp3_44100_192" | "pcm_44100";
  /** Model id — turbo for short snippets, multilingual for non-en. */
  modelId?: "eleven_turbo_v2_5" | "eleven_multilingual_v2";
}

export interface SynthesizeWithVoiceResult {
  audio: Buffer;
  contentType: string;
}

/**
 * Synthesize speech with a specific ElevenLabs voice id (cloned or preset).
 */
export async function synthesizeWithVoice(
  opts: SynthesizeWithVoiceOptions,
): Promise<SynthesizeWithVoiceResult> {
  const apiKey = getApiKey();
  const text = opts.text.trim();
  if (!text) throw new Error("synthesizeWithVoice: empty text");

  const outputFormat = opts.outputFormat || "mp3_44100_128";
  const modelId = opts.modelId || "eleven_turbo_v2_5";

  const res = await fetch(
    `${API_BASE}/text-to-speech/${opts.voiceId}?output_format=${outputFormat}`,
    {
      method: "POST",
      headers: {
        "xi-api-key": apiKey,
        "Content-Type": "application/json",
        Accept: outputFormat.startsWith("mp3") ? "audio/mpeg" : "audio/wav",
      },
      body: JSON.stringify({
        text,
        model_id: modelId,
        voice_settings: {
          stability: opts.stability ?? 0.7,
          similarity_boost: opts.similarityBoost ?? 0.8,
          style: opts.style ?? 0.0,
          use_speaker_boost: true,
        },
      }),
      signal: AbortSignal.timeout(DEFAULT_TIMEOUT_MS),
    },
  );

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new Error(
      `ElevenLabs synthesize failed: ${res.status} ${errText.slice(0, 240)}`,
    );
  }

  const arrayBuffer = await res.arrayBuffer();
  return {
    audio: Buffer.from(arrayBuffer),
    contentType: outputFormat.startsWith("mp3") ? "audio/mpeg" : "audio/wav",
  };
}

/**
 * Delete a voice from ElevenLabs. Best-effort — caller already removed the
 * row in voice_clones; failure here just leaves an orphan provider-side.
 */
export async function deleteVoice(voiceId: string): Promise<void> {
  const apiKey = getApiKey();
  const res = await fetch(`${API_BASE}/voices/${voiceId}`, {
    method: "DELETE",
    headers: {
      "xi-api-key": apiKey,
    },
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok && res.status !== 404) {
    const text = await res.text().catch(() => "");
    throw new Error(
      `ElevenLabs deleteVoice failed: ${res.status} ${text.slice(0, 200)}`,
    );
  }
}

/**
 * True when ElevenLabs is configured. Mirrors providers/elevenlabs.ts so the
 * router-side checks line up.
 */
export function isElevenLabsConfigured(): boolean {
  return Boolean(process.env.ELEVENLABS_API_KEY || process.env.XI_API_KEY);
}
