/**
 * RunPod voice cloning client — supports F5-TTS, XTTS, and OpenVoice
 * serverless endpoints. The user picks which provider their RunPod endpoint
 * is running and we send the right request shape.
 *
 * F5-TTS is preferred (best zero-shot quality among the three open models).
 * OpenVoice is the fallback (emotion-controllable, smaller). XTTS is the
 * least-preferred but most-tested in this codebase already.
 *
 * Config (per provider): set the URL + key as env vars. Only one needs to
 * be set; the trainClone caller picks the first available.
 *
 *   F5-TTS:    RUNPOD_F5TTS_ENDPOINT     RUNPOD_F5TTS_API_KEY
 *   OpenVoice: RUNPOD_OPENVOICE_ENDPOINT RUNPOD_OPENVOICE_API_KEY
 *   XTTS:      RUNPOD_XTTS_ENDPOINT      RUNPOD_XTTS_API_KEY  (or RUNPOD_API_KEY)
 *
 * RunPod serverless endpoints are job-based — POST returns { id, status }
 * and we poll /status/{id} until it's COMPLETED. For shorter samples
 * (<10s) F5-TTS often finishes during the initial /runsync call so we
 * try that path first.
 *
 * See docs/VOICE_CLONING_SETUP.md for endpoint deployment instructions.
 */

import { getR2SignedGetUrl } from "@/lib/server/r2-client";
import { isValidExternalHttpsUrl } from "@/lib/security/ssrf-guard";

export type RunPodCloneProvider =
  | "runpod_f5tts"
  | "runpod_xtts"
  | "runpod_openvoice";

interface ProviderEndpoint {
  url: string;
  key: string;
}

function resolveEndpoint(provider: RunPodCloneProvider): ProviderEndpoint {
  let url: string | undefined;
  let key: string | undefined;
  switch (provider) {
    case "runpod_f5tts":
      url = process.env.RUNPOD_F5TTS_ENDPOINT;
      key = process.env.RUNPOD_F5TTS_API_KEY || process.env.RUNPOD_API_KEY;
      break;
    case "runpod_openvoice":
      url = process.env.RUNPOD_OPENVOICE_ENDPOINT;
      key = process.env.RUNPOD_OPENVOICE_API_KEY || process.env.RUNPOD_API_KEY;
      break;
    case "runpod_xtts":
      url = process.env.RUNPOD_XTTS_URL || process.env.RUNPOD_XTTS_ENDPOINT;
      key = process.env.RUNPOD_XTTS_API_KEY || process.env.RUNPOD_API_KEY;
      break;
  }
  if (!url || !key) {
    throw new Error(
      `${provider} not configured — see docs/VOICE_CLONING_SETUP.md to deploy a RunPod endpoint and set env vars.`,
    );
  }
  return { url: url.replace(/\/$/, ""), key };
}

/**
 * True when at least one RunPod cloning provider is configured.
 */
export function getAvailableRunPodCloneProviders(): RunPodCloneProvider[] {
  const out: RunPodCloneProvider[] = [];
  if (
    process.env.RUNPOD_F5TTS_ENDPOINT &&
    (process.env.RUNPOD_F5TTS_API_KEY || process.env.RUNPOD_API_KEY)
  ) {
    out.push("runpod_f5tts");
  }
  if (
    process.env.RUNPOD_OPENVOICE_ENDPOINT &&
    (process.env.RUNPOD_OPENVOICE_API_KEY || process.env.RUNPOD_API_KEY)
  ) {
    out.push("runpod_openvoice");
  }
  if (
    (process.env.RUNPOD_XTTS_URL || process.env.RUNPOD_XTTS_ENDPOINT) &&
    (process.env.RUNPOD_XTTS_API_KEY || process.env.RUNPOD_API_KEY)
  ) {
    out.push("runpod_xtts");
  }
  return out;
}

export interface SubmitCloneTrainOptions {
  provider: RunPodCloneProvider;
  /**
   * R2 keys for the uploaded samples. We resolve presigned URLs server-side
   * and pass those into the RunPod request — RunPod workers fetch the bytes
   * directly so we never round-trip multi-MB samples through this process.
   */
  sampleR2Keys: string[];
  language?: string;
  /** Stable label for telemetry/logging only. */
  label?: string;
}

export interface SubmitCloneTrainResult {
  /** RunPod job id — written to voice_clones.provider_voice_id. */
  jobId: string;
  /** "training" | "ready" — F5-TTS sometimes finishes during /runsync. */
  status: "training" | "ready" | "failed";
  /**
   * For F5-TTS: a stable fingerprint (typically the base64-encoded sample
   * embedding). We store it so subsequent synthesise calls can reference it.
   * For OpenVoice/XTTS: usually just an echo of the speaker_wav URL we sent.
   */
  fingerprint?: string;
  failedReason?: string;
}

/**
 * Submit a voice-cloning training job to a RunPod serverless endpoint.
 *
 * F5-TTS / OpenVoice are zero-shot — there's no real "training", just a
 * fingerprint extraction. So this function is fast (<5s typically) and
 * commonly returns status='ready' on the first /runsync call.
 *
 * XTTS-style providers may return status='training' instead, in which case
 * the cron in /api/cron/voice-clone-poll picks the job up.
 */
export async function submitCloneTrain(
  opts: SubmitCloneTrainOptions,
): Promise<SubmitCloneTrainResult> {
  const endpoint = resolveEndpoint(opts.provider);

  if (opts.sampleR2Keys.length === 0) {
    throw new Error("submitCloneTrain: at least one sample required.");
  }

  // Resolve a presigned GET URL for each sample so the RunPod worker can pull
  // the audio bytes without needing R2 credentials.
  const sampleUrls = await Promise.all(
    opts.sampleR2Keys.map((k) => getR2SignedGetUrl(k, 30 * 60)),
  );

  // Most RunPod TTS templates accept input.speaker_wav for cloning; F5-TTS
  // additionally accepts input.ref_audio. We send both keys so the worker
  // template can pick whichever it knows how to handle.
  const input: Record<string, unknown> = {
    operation: "clone",
    speaker_wav: sampleUrls[0],
    ref_audio: sampleUrls[0],
    samples: sampleUrls,
    language: opts.language || "en",
    label: opts.label || "voice-clone",
  };

  let res: Response;
  try {
    res = await fetch(`${endpoint.url}/runsync`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${endpoint.key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ input }),
      signal: AbortSignal.timeout(120_000),
    });
  } catch (err) {
    const reason = err instanceof Error ? err.message : "fetch_error";
    return { jobId: "", status: "failed", failedReason: reason };
  }

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    return {
      jobId: "",
      status: "failed",
      failedReason: `http_${res.status}: ${text.slice(0, 200)}`,
    };
  }

  type RunPodResponse = {
    id?: string;
    status?: string;
    output?: { fingerprint?: string; speaker_id?: string; voice_id?: string };
    error?: string;
  };
  let data: RunPodResponse;
  try {
    data = (await res.json()) as RunPodResponse;
  } catch {
    return { jobId: "", status: "failed", failedReason: "bad_json" };
  }

  const jobId = data.id || "";
  if (data.status === "COMPLETED" && data.output) {
    const fp =
      data.output.fingerprint ||
      data.output.speaker_id ||
      data.output.voice_id ||
      jobId;
    return { jobId, status: "ready", fingerprint: fp };
  }
  if (data.status === "FAILED") {
    return {
      jobId,
      status: "failed",
      failedReason: data.error || "runpod_failed",
    };
  }
  // Still running (IN_QUEUE, IN_PROGRESS, etc.) → cron will poll.
  return { jobId, status: "training" };
}

export interface PollCloneStatusResult {
  status: "training" | "ready" | "failed";
  fingerprint?: string;
  failedReason?: string;
}

/**
 * Poll a previously-submitted RunPod cloning job. Used by the cron and by
 * the dashboard's clone-detail-page status check.
 */
export async function pollCloneStatus(
  provider: RunPodCloneProvider,
  jobId: string,
): Promise<PollCloneStatusResult> {
  const endpoint = resolveEndpoint(provider);

  let res: Response;
  try {
    res = await fetch(`${endpoint.url}/status/${jobId}`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${endpoint.key}`,
      },
      signal: AbortSignal.timeout(15_000),
    });
  } catch (err) {
    return {
      status: "failed",
      failedReason: err instanceof Error ? err.message : "fetch_error",
    };
  }

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    return {
      status: "failed",
      failedReason: `http_${res.status}: ${text.slice(0, 160)}`,
    };
  }

  type RunPodStatusResponse = {
    status?: string;
    output?: { fingerprint?: string; speaker_id?: string; voice_id?: string };
    error?: string;
  };
  let data: RunPodStatusResponse;
  try {
    data = (await res.json()) as RunPodStatusResponse;
  } catch {
    return { status: "failed", failedReason: "bad_json" };
  }

  if (data.status === "COMPLETED") {
    const fp =
      data.output?.fingerprint ||
      data.output?.speaker_id ||
      data.output?.voice_id ||
      jobId;
    return { status: "ready", fingerprint: fp };
  }
  if (data.status === "FAILED") {
    return {
      status: "failed",
      failedReason: data.error || "runpod_failed",
    };
  }
  return { status: "training" };
}

export interface SynthesizeWithCloneOptions {
  provider: RunPodCloneProvider;
  /** Fingerprint or speaker_wav URL recovered from training. */
  fingerprint: string;
  text: string;
  language?: string;
  speed?: number;
}

export interface SynthesizeWithCloneResult {
  audio: Buffer;
  contentType: string;
  durationSeconds?: number;
}

/**
 * Synthesise speech using a previously-trained RunPod clone fingerprint.
 *
 * For F5-TTS-style endpoints, the worker accepts the fingerprint key the
 * training step returned. For XTTS-style endpoints, the fingerprint is
 * usually a speaker_wav URL — same shape, different semantics under the
 * hood. We pass it as both `speaker_id` AND `speaker_wav` so the worker
 * template can pick whichever name it knows.
 */
export async function synthesizeWithClone(
  opts: SynthesizeWithCloneOptions,
): Promise<SynthesizeWithCloneResult> {
  const endpoint = resolveEndpoint(opts.provider);
  const text = opts.text.trim();
  if (!text) throw new Error("synthesizeWithClone: empty text");

  const input: Record<string, unknown> = {
    text,
    operation: "synthesize",
    speaker_id: opts.fingerprint,
    speaker_wav: opts.fingerprint,
    ref_audio: opts.fingerprint,
    language: opts.language || "en",
  };
  if (opts.speed !== undefined) {
    input.speed = opts.speed;
  }

  const res = await fetch(`${endpoint.url}/runsync`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${endpoint.key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ input }),
    signal: AbortSignal.timeout(120_000),
  });

  if (!res.ok) {
    const text2 = await res.text().catch(() => "");
    throw new Error(
      `RunPod ${opts.provider} synth failed: ${res.status} ${text2.slice(0, 200)}`,
    );
  }

  type RunPodSynthResponse = {
    status?: string;
    output?: {
      audio_base64?: string;
      audio?: string;
      audio_data?: string;
      url?: string;
      audio_url?: string;
      duration?: number;
    };
    error?: string;
  };
  const data = (await res.json()) as RunPodSynthResponse;
  if (data.status !== "COMPLETED" || !data.output) {
    throw new Error(
      `RunPod ${opts.provider} synth incomplete: ${data.status || "unknown"} ${data.error || ""}`,
    );
  }

  const out = data.output;
  let audio: Buffer | null = null;
  if (out.audio_base64 || out.audio || out.audio_data) {
    const b64 = (out.audio_base64 || out.audio || out.audio_data) as string;
    audio = Buffer.from(b64.replace(/^data:[^;]+;base64,/, ""), "base64");
  } else if (out.url || out.audio_url) {
    const remoteUrl = (out.url || out.audio_url) as string;
    // SSRF guard: RunPod response URL must be a public HTTPS endpoint,
    // not a private network address or internal metadata service.
    if (!isValidExternalHttpsUrl(remoteUrl)) {
      throw new Error(`RunPod ${opts.provider} synth: url_ssrf_blocked`);
    }
    const fetched = await fetch(remoteUrl, {
      signal: AbortSignal.timeout(30_000),
    });
    if (!fetched.ok) {
      throw new Error(
        `RunPod ${opts.provider} fetch_audio failed: ${fetched.status}`,
      );
    }
    audio = Buffer.from(await fetched.arrayBuffer());
  }

  if (!audio) {
    throw new Error(`RunPod ${opts.provider} synth: no_audio_in_output`);
  }

  return {
    audio,
    contentType: "audio/wav",
    durationSeconds: out.duration,
  };
}
