import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase, createServiceClient } from "@/lib/supabase/server";
import { checkAiRateLimit } from "@/lib/api-rate-limit";

/**
 * Image Wizard — Unified Generate
 *
 * POST: Take a finalized prompt + dimensions + options and generate an image
 * via the same RunPod FLUX/SDXL stack used by the thumbnail generator. Falls
 * back to Replicate FLUX-Schnell, then OpenAI DALL-E.
 *
 * The endpoint kicks the job off, polls until complete (or returns the job_id
 * for the client to poll), and persists the resulting image into the
 * `generated_images` table along with the wizard answers used to build the
 * prompt — so users can re-tweak / regenerate later.
 *
 * Input JSON:
 *   {
 *     prompt: string,
 *     negative_prompt?: string,
 *     width?: number,
 *     height?: number,
 *     model?: "flux" | "sdxl",
 *     steps?: number,
 *     guidance_scale?: number,
 *     wizard_answers?: object,   // for persistence + later re-tweak
 *     client_id?: string,        // optional managed-client scope
 *     wait?: boolean,            // default true; if false return job_id immediately
 *   }
 *
 * Output JSON (sync path):
 *   { success: true, image: { id, url, model, width, height } }
 *
 * Output JSON (async path):
 *   { success: true, job_id, status, image_id, poll_url }
 */

interface CreateBody {
  prompt?: string;
  negative_prompt?: string;
  width?: number;
  height?: number;
  model?: "flux" | "sdxl";
  steps?: number;
  guidance_scale?: number;
  wizard_answers?: Record<string, unknown>;
  client_id?: string;
  wait?: boolean;
}

const DEFAULT_NEGATIVE =
  "low quality, blurry, watermark, jpeg artifacts, deformed, ugly, " +
  "distorted, bad anatomy, extra limbs, poorly drawn";

const POLL_INTERVAL_MS = 2_000;
const POLL_MAX_MS = 90_000; // 90s — enough for FLUX/SDXL on a warm RunPod worker

async function sleep(ms: number) {
  return new Promise(r => setTimeout(r, ms));
}

/* ── RunPod payload builders ─────────────────────────────────── */
function buildFluxPayload(
  prompt: string,
  negative: string,
  width: number,
  height: number,
  steps: number,
  seed: number,
) {
  return {
    input: {
      workflow: {
        "6": { inputs: { text: prompt, clip: ["30", 1] }, class_type: "CLIPTextEncode" },
        "8": { inputs: { samples: ["31", 0], vae: ["30", 2] }, class_type: "VAEDecode" },
        "9": { inputs: { filename_prefix: "ComfyUI", images: ["8", 0] }, class_type: "SaveImage" },
        "27": { inputs: { width, height, batch_size: 1 }, class_type: "EmptySD3LatentImage" },
        "30": {
          inputs: { ckpt_name: "flux1-dev-fp8.safetensors" },
          class_type: "CheckpointLoaderSimple",
        },
        "31": {
          inputs: {
            seed,
            steps,
            cfg: 1,
            sampler_name: "euler",
            scheduler: "simple",
            denoise: 1,
            model: ["30", 0],
            positive: ["35", 0],
            negative: ["33", 0],
            latent_image: ["27", 0],
          },
          class_type: "KSampler",
        },
        "33": { inputs: { text: negative, clip: ["30", 1] }, class_type: "CLIPTextEncode" },
        "35": { inputs: { guidance: 3.5, conditioning: ["6", 0] }, class_type: "FluxGuidance" },
      },
    },
  };
}

function buildSdxlPayload(
  prompt: string,
  negative: string,
  width: number,
  height: number,
  steps: number,
  guidance: number,
  seed: number,
) {
  return {
    input: {
      prompt,
      negative_prompt: negative,
      width,
      height,
      num_inference_steps: steps,
      guidance_scale: guidance,
      seed,
      scheduler: "K_EULER",
      num_images: 1,
    },
  };
}

interface RunPodJob {
  id?: string;
  status?: string;
  output?: { images?: string[]; image_url?: string; image_base64?: string };
  error?: string;
}

async function pollRunPod(endpointUrl: string, runpodKey: string, jobId: string): Promise<string | null> {
  const startedAt = Date.now();
  while (Date.now() - startedAt < POLL_MAX_MS) {
    await sleep(POLL_INTERVAL_MS);
    try {
      const res = await fetch(`${endpointUrl}/status/${jobId}`, {
        headers: { Authorization: `Bearer ${runpodKey}` },
      });
      const data = (await res.json()) as RunPodJob;
      if (data.status === "COMPLETED" && data.output) {
        const img =
          data.output.images?.[0] ||
          data.output.image_url ||
          (data.output.image_base64 ? `data:image/png;base64,${data.output.image_base64}` : null);
        if (img) return img;
      }
      if (data.status === "FAILED") return null;
    } catch {
      // continue polling — transient errors are normal
    }
  }
  return null;
}

async function pollReplicate(token: string, predId: string): Promise<string | null> {
  const startedAt = Date.now();
  while (Date.now() - startedAt < POLL_MAX_MS) {
    await sleep(POLL_INTERVAL_MS);
    try {
      const res = await fetch(`https://api.replicate.com/v1/predictions/${predId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.status === "succeeded") {
        const img = Array.isArray(data.output) ? data.output[0] : data.output;
        if (img) return img;
      }
      if (data.status === "failed" || data.status === "canceled") return null;
    } catch {
      // continue polling
    }
  }
  return null;
}

export async function POST(request: NextRequest) {
  const supabase = createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase
    .from("profiles")
    .select("plan_tier")
    .eq("id", user.id)
    .single();

  const limited = checkAiRateLimit(user.id, profile?.plan_tier);
  if (limited) return limited;

  let body: CreateBody;
  try {
    body = (await request.json()) as CreateBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const prompt = body.prompt?.trim();
  if (!prompt) return NextResponse.json({ error: "prompt is required" }, { status: 400 });

  const width = Math.max(256, Math.min(1440, body.width || 1024));
  const height = Math.max(256, Math.min(1440, body.height || 1024));
  const negative = body.negative_prompt?.trim() || DEFAULT_NEGATIVE;
  const model: "flux" | "sdxl" = body.model === "sdxl" ? "sdxl" : "flux";
  const steps = Math.max(8, Math.min(40, body.steps ?? (model === "flux" ? 16 : 28)));
  const guidance = Math.max(1, Math.min(15, body.guidance_scale ?? (model === "flux" ? 3.5 : 7)));
  const wait = body.wait !== false; // default true

  // Round to nearest 8 (model requirement)
  const w = Math.round(width / 8) * 8;
  const h = Math.round(height / 8) * 8;

  // Pre-create a row so we always have an image_id to return
  const service = createServiceClient();
  const { data: row, error: insertErr } = await service
    .from("generated_images")
    .insert({
      profile_id: user.id,
      client_id: body.client_id || null,
      prompt,
      negative_prompt: negative,
      model,
      width: w,
      height: h,
      wizard_answers: body.wizard_answers || {},
      metadata: { steps, guidance_scale: guidance },
      status: "processing",
    })
    .select("id")
    .single();

  if (insertErr) {
    // Non-fatal — keep going so the user still gets an image
    console.warn("[images/create] failed to insert tracking row:", insertErr.message);
  }
  const imageId = row?.id as string | undefined;

  const updateRow = async (
    patch: Partial<{ status: string; image_url: string; error_message: string; job_id: string }>,
  ) => {
    if (!imageId) return;
    await service
      .from("generated_images")
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq("id", imageId);
  };

  /* ── Strategy 1: RunPod (FLUX preferred, SDXL fallback) ─────── */
  const fluxUrl = process.env.RUNPOD_FLUX_URL;
  const sdxlUrl = process.env.RUNPOD_SDXL_URL;
  const runpodKey = process.env.RUNPOD_API_KEY;
  const runpodEndpoint = model === "sdxl" ? sdxlUrl || fluxUrl : fluxUrl || sdxlUrl;

  if (runpodEndpoint && runpodKey) {
    try {
      const seed = Math.floor(Math.random() * 2147483647);
      const useFlux = runpodEndpoint === fluxUrl && model === "flux";
      const payload = useFlux
        ? buildFluxPayload(prompt, negative, w, h, steps, seed)
        : buildSdxlPayload(prompt, negative, w, h, steps, guidance, seed);

      const submit = await fetch(`${runpodEndpoint}/run`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${runpodKey}`,
        },
        body: JSON.stringify(payload),
      });
      const job = (await submit.json()) as RunPodJob;

      // Sync result?
      if (job.status === "COMPLETED" && job.output) {
        const img =
          job.output.images?.[0] ||
          job.output.image_url ||
          (job.output.image_base64 ? `data:image/png;base64,${job.output.image_base64}` : null);
        if (img) {
          await updateRow({ status: "completed", image_url: img });
          return NextResponse.json({
            success: true,
            image: { id: imageId, url: img, model, width: w, height: h },
          });
        }
      }

      if (job.id) {
        await updateRow({ job_id: job.id });

        if (!wait) {
          return NextResponse.json({
            success: true,
            job_id: job.id,
            status: job.status || "IN_QUEUE",
            image_id: imageId,
            poll_url: `/api/ai-studio/image-gen?job_id=${job.id}`,
          });
        }

        const img = await pollRunPod(runpodEndpoint, runpodKey, job.id);
        if (img) {
          await updateRow({ status: "completed", image_url: img });
          return NextResponse.json({
            success: true,
            image: { id: imageId, url: img, model, width: w, height: h },
          });
        }

        await updateRow({ status: "failed", error_message: "RunPod timeout" });
        return NextResponse.json({
          success: false,
          error: "Image still generating — try again in a moment.",
          job_id: job.id,
          image_id: imageId,
        }, { status: 504 });
      }

      // Fall through to next strategy
    } catch (err) {
      console.warn("[images/create] RunPod attempt failed:", err);
    }
  }

  /* ── Strategy 2: Replicate FLUX-Schnell ──────────────────────── */
  const replicateToken = process.env.REPLICATE_API_TOKEN;
  if (replicateToken) {
    try {
      const res = await fetch("https://api.replicate.com/v1/predictions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${replicateToken}`,
          "Content-Type": "application/json",
          Prefer: wait ? "wait" : "respond-async",
        },
        body: JSON.stringify({
          version: "5599ed30703defd1d160a25a63321b4dec97101d98b4674bcc56e41f62f35637",
          input: {
            prompt,
            width: w,
            height: h,
            num_outputs: 1,
            num_inference_steps: 4,
            go_fast: true,
          },
        }),
      });
      const pred = await res.json();

      if (pred.status === "succeeded" && pred.output) {
        const img = Array.isArray(pred.output) ? pred.output[0] : pred.output;
        await updateRow({ status: "completed", image_url: img });
        return NextResponse.json({
          success: true,
          image: { id: imageId, url: img, model: "flux-schnell", width: w, height: h },
        });
      }

      if (pred.id && wait) {
        await updateRow({ job_id: pred.id });
        const img = await pollReplicate(replicateToken, pred.id);
        if (img) {
          await updateRow({ status: "completed", image_url: img });
          return NextResponse.json({
            success: true,
            image: { id: imageId, url: img, model: "flux-schnell", width: w, height: h },
          });
        }
      }

      if (pred.id) {
        await updateRow({ job_id: pred.id });
        return NextResponse.json({
          success: true,
          job_id: pred.id,
          status: pred.status || "processing",
          image_id: imageId,
          poll_url: `/api/ai-studio/image-gen?job_id=${pred.id}`,
        });
      }
    } catch (err) {
      console.warn("[images/create] Replicate attempt failed:", err);
    }
  }

  /* ── Strategy 3: OpenAI DALL-E 3 ─────────────────────────────── */
  const openaiKey = process.env.OPENAI_API_KEY;
  if (openaiKey) {
    try {
      const dalleSize = h > w ? "1024x1792" : w > h ? "1792x1024" : "1024x1024";
      const res = await fetch("https://api.openai.com/v1/images/generations", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${openaiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "dall-e-3",
          prompt,
          n: 1,
          size: dalleSize,
          quality: "standard",
        }),
      });
      const data = await res.json();
      const img = data.data?.[0]?.url;
      if (img) {
        await updateRow({ status: "completed", image_url: img });
        return NextResponse.json({
          success: true,
          image: { id: imageId, url: img, model: "dall-e-3", width: w, height: h },
        });
      }
    } catch (err) {
      console.warn("[images/create] OpenAI attempt failed:", err);
    }
  }

  await updateRow({ status: "failed", error_message: "No provider configured" });
  return NextResponse.json(
    {
      error: "setup_required",
      message:
        "Configure RUNPOD_FLUX_URL + RUNPOD_API_KEY, REPLICATE_API_TOKEN, or OPENAI_API_KEY to use the image wizard.",
      image_id: imageId,
    },
    { status: 501 },
  );
}

/** GET — Poll status by image_id (for async path) */
export async function GET(request: NextRequest) {
  const supabase = createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const imageId = request.nextUrl.searchParams.get("image_id");
  if (!imageId) return NextResponse.json({ error: "image_id required" }, { status: 400 });

  const { data, error } = await supabase
    .from("generated_images")
    .select("id, status, image_url, error_message, model, width, height, job_id")
    .eq("id", imageId)
    .eq("profile_id", user.id)
    .single();

  if (error || !data) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({
    image_id: data.id,
    status: data.status,
    image_url: data.image_url,
    model: data.model,
    width: data.width,
    height: data.height,
    job_id: data.job_id,
    error: data.error_message,
  });
}
