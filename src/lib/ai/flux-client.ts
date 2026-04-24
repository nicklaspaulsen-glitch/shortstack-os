// ── FLUX.1 RunPod client ───────────────────────────────────────────
//
// Thin wrapper around the RunPod-hosted FLUX endpoint. Used by the
// thumbnail-generator feature when `THUMBNAIL_MODEL=flux` (or `auto`
// resolves to it because `RUNPOD_FLUX_URL` is set).
//
// LICENSING — IMPORTANT:
//   FLUX.1-dev      — non-commercial license (Black Forest Labs).
//                     Safe for personal / internal use. NOT safe for
//                     monetised output-as-a-service.
//   FLUX.1-schnell  — Apache-2.0. Safe for commercial use.
//   Caller selects via FLUX_VARIANT env ("dev" | "schnell", default "dev").
//
// The RunPod endpoint is expected to expose a ComfyUI-compatible
// /sdapi/v1/txt2img route (returning `{ images: ["data:image/png;base64,…"] }`)
// or the standard RunPod /run + /status pair. This client handles both —
// synchronous txt2img first, then falls back to run+poll.

import type { SupportedFluxVariant } from "./flux-types";

export interface GenerateFluxImageInput {
  prompt: string;
  negativePrompt?: string;
  width?: number;
  height?: number;
  steps?: number;
  guidance?: number;
  seed?: number;
  /** Override env default. */
  variant?: SupportedFluxVariant;
}

export interface GenerateFluxImageResult {
  image_url: string;          // data: URL or public URL
  seed_used: number;
  duration_ms: number;
  model: "flux-dev" | "flux-schnell";
  provider: "runpod";
}

const TIMEOUT_MS = 90_000;   // A100 renders ~15-25s / 1024² — 90s headroom
const MAX_POLL_MS = 80_000;
const POLL_INTERVAL_MS = 1_500;

function resolveVariant(override?: SupportedFluxVariant): SupportedFluxVariant {
  if (override) return override;
  const env = (process.env.FLUX_VARIANT || "dev").toLowerCase();
  return env === "schnell" ? "schnell" : "dev";
}

/**
 * Generate a single image using the RunPod FLUX endpoint.
 *
 * @throws Error when the endpoint is not configured, the job times out, or
 *         the RunPod response doesn't include a usable image URL.
 */
export async function generateFluxImage(
  input: GenerateFluxImageInput,
): Promise<GenerateFluxImageResult> {
  const url = process.env.RUNPOD_FLUX_URL;
  const secret = process.env.RUNPOD_FLUX_SECRET || process.env.RUNPOD_API_KEY;
  if (!url) throw new Error("RUNPOD_FLUX_URL not set");
  if (!secret) throw new Error("RUNPOD_FLUX_SECRET (or RUNPOD_API_KEY) not set");

  const variant = resolveVariant(input.variant);
  const modelId = variant === "schnell" ? "flux-schnell" : "flux-dev";

  const width = input.width ?? 1024;
  const height = input.height ?? 1024;
  // Schnell is distilled — 4 steps produces near-final quality. Dev needs ~28.
  const defaultSteps = variant === "schnell" ? 4 : 28;
  const steps = input.steps ?? defaultSteps;
  const guidance = input.guidance ?? (variant === "schnell" ? 0 : 3.5);
  const seed = input.seed ?? Math.floor(Math.random() * 2_147_483_647);

  const started = Date.now();

  // ── Path A: ComfyUI-compat txt2img (synchronous) ─────────────────
  // Most ComfyUI RunPod templates expose this — returns immediately with
  // base64-encoded images.
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    const res = await fetch(`${url.replace(/\/$/, "")}/sdapi/v1/txt2img`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${secret}`,
      },
      body: JSON.stringify({
        prompt: input.prompt,
        negative_prompt: input.negativePrompt || "",
        width,
        height,
        steps,
        cfg_scale: guidance,
        seed,
        sampler_name: "euler",
      }),
      signal: controller.signal,
    });
    clearTimeout(timer);

    if (res.ok) {
      const data = (await res.json()) as {
        images?: string[];
        image_url?: string;
      };
      const imageUrl = normaliseImage(data.images?.[0] || data.image_url);
      if (imageUrl) {
        return {
          image_url: imageUrl,
          seed_used: seed,
          duration_ms: Date.now() - started,
          model: modelId,
          provider: "runpod",
        };
      }
    }
    // Non-ok or no image — fall through to /run path.
  } catch {
    // Endpoint may not support /sdapi/v1/txt2img — silent fallback.
  }

  // ── Path B: RunPod /run + /status poll ───────────────────────────
  const runRes = await fetch(`${url.replace(/\/$/, "")}/run`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${secret}`,
    },
    body: JSON.stringify({
      input: {
        prompt: input.prompt,
        negative_prompt: input.negativePrompt || "",
        width,
        height,
        num_inference_steps: steps,
        guidance_scale: guidance,
        seed,
        variant: modelId,
      },
    }),
  });

  if (!runRes.ok) {
    throw new Error(`RunPod /run returned ${runRes.status}`);
  }
  const runData = (await runRes.json()) as { id?: string; output?: unknown };
  const jobId = runData.id;
  if (!jobId) throw new Error("RunPod /run did not return a job id");

  const deadline = Date.now() + MAX_POLL_MS;
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
    const statusRes = await fetch(
      `${url.replace(/\/$/, "")}/status/${jobId}`,
      { headers: { Authorization: `Bearer ${secret}` } },
    );
    if (!statusRes.ok) continue;
    const s = (await statusRes.json()) as {
      status?: string;
      output?: unknown;
      error?: string;
    };
    if (s.status === "FAILED" || s.status === "CANCELLED") {
      throw new Error(`FLUX job failed: ${s.error || "unknown"}`);
    }
    if (s.status === "COMPLETED" && s.output) {
      const imageUrl = extractImageFromOutput(s.output);
      if (imageUrl) {
        return {
          image_url: imageUrl,
          seed_used: seed,
          duration_ms: Date.now() - started,
          model: modelId,
          provider: "runpod",
        };
      }
      throw new Error("FLUX job completed but no image in output");
    }
  }
  throw new Error(`FLUX job ${jobId} timed out after ${MAX_POLL_MS}ms`);
}

function normaliseImage(raw: string | undefined): string | null {
  if (!raw) return null;
  if (raw.startsWith("data:image") || raw.startsWith("http")) return raw;
  // Assume bare base64 PNG.
  return `data:image/png;base64,${raw}`;
}

function extractImageFromOutput(output: unknown): string | null {
  if (typeof output === "string") return normaliseImage(output);
  if (Array.isArray(output)) {
    const first = output.find((v): v is string => typeof v === "string");
    return normaliseImage(first);
  }
  if (output && typeof output === "object") {
    const obj = output as Record<string, unknown>;
    if (typeof obj.image_url === "string") return normaliseImage(obj.image_url);
    if (typeof obj.message === "string" && obj.message.startsWith("data:image")) {
      return obj.message;
    }
    if (Array.isArray(obj.images) && typeof obj.images[0] === "string") {
      return normaliseImage(obj.images[0]);
    }
  }
  return null;
}

/** Returns true if FLUX should be used per current env configuration. */
export function shouldUseFlux(): boolean {
  const mode = (process.env.THUMBNAIL_MODEL || "auto").toLowerCase();
  if (mode === "flux") return true;
  if (mode === "current" || mode === "legacy") return false;
  // auto
  return !!process.env.RUNPOD_FLUX_URL;
}

export function resolveThumbnailModelId(): "flux-dev" | "flux-schnell" | "legacy" {
  if (!shouldUseFlux()) return "legacy";
  return resolveVariant() === "schnell" ? "flux-schnell" : "flux-dev";
}
