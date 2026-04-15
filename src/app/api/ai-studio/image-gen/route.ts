import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { checkAiRateLimit } from "@/lib/api-rate-limit";

/**
 * AI Studio — Image Generation
 *
 * POST: Accept a text prompt, generate an image via Replicate (FLUX/SDXL),
 * RunPod, or OpenAI DALL-E.
 *
 * Supports:
 *   - REPLICATE_API_TOKEN  -> FLUX Schnell on Replicate (fast, good quality)
 *   - RUNPOD_FLUX_URL      -> Self-hosted FLUX on RunPod
 *   - OPENAI_API_KEY       -> DALL-E 3 fallback
 *
 * Input JSON: { prompt, negative_prompt?, width?, height?, style?, model? }
 */
export async function POST(request: NextRequest) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase
    .from("profiles")
    .select("plan_tier")
    .eq("id", user.id)
    .single();

  const limited = checkAiRateLimit(user.id, profile?.plan_tier);
  if (limited) return limited;

  let body: {
    prompt?: string;
    negative_prompt?: string;
    width?: number;
    height?: number;
    style?: string;
    model?: string;
    num_outputs?: number;
  };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const {
    prompt,
    negative_prompt = "blurry, low quality, distorted, watermark, ugly, amateur",
    width = 1024,
    height = 1024,
    style,
    model = "flux",
    num_outputs = 1,
  } = body;

  if (!prompt?.trim()) {
    return NextResponse.json({ error: "A text prompt is required" }, { status: 400 });
  }

  // Build enhanced prompt with style
  const styleMap: Record<string, string> = {
    modern: "clean modern design, professional, high quality, sharp details",
    vintage: "vintage retro aesthetic, warm film grain, nostalgic colors",
    minimalist: "ultra minimalist, simple, vast negative space, elegant",
    bold: "bold colors, high contrast, eye-catching, dynamic composition",
    luxury: "luxury premium feel, gold accents, deep blacks, sophisticated",
    playful: "fun playful colorful, rounded shapes, friendly, approachable",
    dark: "dark moody aesthetic, deep shadows, dramatic lighting, cinematic",
    photorealistic: "photorealistic, 8k, ultra detailed, professional photography",
  };
  const styleStr = style && styleMap[style] ? `, ${styleMap[style]}` : "";
  const fullPrompt = `${prompt}${styleStr}`;

  // ── Strategy 1: Replicate (FLUX Schnell — fast) ───────────────
  const replicateToken = process.env.REPLICATE_API_TOKEN;

  if (replicateToken && (model === "flux" || !process.env.RUNPOD_FLUX_URL)) {
    try {
      const res = await fetch("https://api.replicate.com/v1/predictions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${replicateToken}`,
          "Content-Type": "application/json",
          Prefer: "wait",
        },
        body: JSON.stringify({
          // FLUX Schnell — fast, high-quality, no negative prompt needed
          version: "5599ed30703defd1d160a25a63321b4dec97101d98b4674bcc56e41f62f35637",
          input: {
            prompt: fullPrompt,
            width: Math.min(Math.max(width, 256), 1440),
            height: Math.min(Math.max(height, 256), 1440),
            num_outputs: Math.min(num_outputs, 4),
            num_inference_steps: 4,
            go_fast: true,
          },
        }),
      });

      const prediction = await res.json();

      if (prediction.status === "succeeded" && prediction.output) {
        const images = Array.isArray(prediction.output) ? prediction.output : [prediction.output];
        return NextResponse.json({
          success: true,
          images,
          model: "flux-schnell",
          prompt: fullPrompt,
        });
      }

      if (prediction.id) {
        return NextResponse.json({
          success: true,
          job_id: prediction.id,
          status: prediction.status || "processing",
          poll_url: `/api/ai-studio/image-gen?job_id=${prediction.id}`,
        });
      }

      return NextResponse.json({
        error: prediction.error || "Image generation failed",
      }, { status: 500 });
    } catch (err) {
      return NextResponse.json({ error: String(err) }, { status: 500 });
    }
  }

  // ── Strategy 2: RunPod FLUX (self-hosted) ─────────────────────
  const fluxUrl = process.env.RUNPOD_FLUX_URL;
  const sdxlUrl = process.env.RUNPOD_SDXL_URL;
  const runpodKey = process.env.RUNPOD_API_KEY;
  const endpointUrl = model === "sdxl" ? (sdxlUrl || fluxUrl) : (fluxUrl || sdxlUrl);

  if (endpointUrl && runpodKey) {
    const seed = Math.floor(Math.random() * 2147483647);
    try {
      const payload = model === "flux" || endpointUrl === fluxUrl
        ? {
            input: {
              workflow: {
                "6": { inputs: { text: fullPrompt, clip: ["11", 0] }, class_type: "CLIPTextEncode" },
                "8": { inputs: { samples: ["13", 0], vae: ["10", 0] }, class_type: "VAEDecode" },
                "9": { inputs: { filename_prefix: "flux_gen", images: ["8", 0] }, class_type: "SaveImage" },
                "10": { inputs: { vae_name: "ae.sft" }, class_type: "VAELoader" },
                "11": { inputs: { clip_name1: "t5xxl_fp8_e4m3fn.safetensors", clip_name2: "clip_l.safetensors", type: "flux" }, class_type: "DualCLIPLoader" },
                "12": { inputs: { unet_name: "flux1-dev.sft", weight_dtype: "fp8_e4m3fn" }, class_type: "UNETLoader" },
                "13": { inputs: { noise: ["25", 0], guider: ["22", 0], sampler: ["16", 0], sigmas: ["17", 0], latent_image: ["27", 0] }, class_type: "SamplerCustomAdvanced" },
                "16": { inputs: { sampler_name: "euler" }, class_type: "KSamplerSelect" },
                "17": { inputs: { scheduler: "simple", steps: 20, denoise: 1, model: ["12", 0] }, class_type: "BasicScheduler" },
                "22": { inputs: { model: ["12", 0], conditioning: ["6", 0] }, class_type: "BasicGuider" },
                "25": { inputs: { noise_seed: seed }, class_type: "RandomNoise" },
                "27": { inputs: { width, height, batch_size: 1 }, class_type: "EmptySD3LatentImage" },
              },
            },
          }
        : {
            input: {
              prompt: fullPrompt,
              negative_prompt,
              width,
              height,
              num_inference_steps: 30,
              guidance_scale: 7.5,
              seed,
            },
          };

      const res = await fetch(`${endpointUrl}/run`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${runpodKey}`,
        },
        body: JSON.stringify(payload),
      });

      const job = await res.json();

      if (job.status === "COMPLETED" && job.output) {
        const images = job.output.images || (job.output.image_url ? [job.output.image_url] : [job.output.image_base64]);
        return NextResponse.json({
          success: true,
          images: images.filter(Boolean),
          model: model === "flux" ? "flux-dev" : "sdxl",
          prompt: fullPrompt,
        });
      }

      if (job.id) {
        return NextResponse.json({
          success: true,
          job_id: job.id,
          status: job.status || "IN_QUEUE",
          poll_url: `/api/ai-studio/image-gen?job_id=${job.id}`,
        });
      }

      return NextResponse.json({ error: "Image generation failed" }, { status: 500 });
    } catch (err) {
      return NextResponse.json({ error: String(err) }, { status: 500 });
    }
  }

  // ── Strategy 3: OpenAI DALL-E 3 ──────────────────────────────
  const openaiKey = process.env.OPENAI_API_KEY;

  if (openaiKey) {
    try {
      const dalleSize = width >= 1792 || height >= 1792
        ? "1792x1024"
        : width <= 512 && height <= 512
          ? "1024x1024"
          : "1024x1024";

      const res = await fetch("https://api.openai.com/v1/images/generations", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${openaiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "dall-e-3",
          prompt: fullPrompt,
          n: 1,
          size: dalleSize,
          quality: "standard",
        }),
      });

      const data = await res.json();

      if (data.data?.[0]?.url) {
        return NextResponse.json({
          success: true,
          images: data.data.map((d: { url: string }) => d.url),
          model: "dall-e-3",
          prompt: fullPrompt,
        });
      }

      return NextResponse.json({
        error: data.error?.message || "Image generation failed",
      }, { status: 500 });
    } catch (err) {
      return NextResponse.json({ error: String(err) }, { status: 500 });
    }
  }

  // ── No provider configured ────────────────────────────────────
  return NextResponse.json({
    error: "setup_required",
    message: "Configure REPLICATE_API_TOKEN, RUNPOD_API_KEY + RUNPOD_FLUX_URL, or OPENAI_API_KEY in settings to use Image Gen.",
  }, { status: 501 });
}

/** GET — Poll job status */
export async function GET(request: NextRequest) {
  const jobId = request.nextUrl.searchParams.get("job_id");
  if (!jobId) return NextResponse.json({ error: "job_id required" }, { status: 400 });

  // Check Replicate first
  const replicateToken = process.env.REPLICATE_API_TOKEN;
  if (replicateToken) {
    try {
      const res = await fetch(`https://api.replicate.com/v1/predictions/${jobId}`, {
        headers: { Authorization: `Bearer ${replicateToken}` },
      });
      const data = await res.json();

      if (data.status === "succeeded") {
        const images = Array.isArray(data.output) ? data.output : [data.output];
        return NextResponse.json({ status: "completed", images });
      }
      if (data.status === "failed") {
        return NextResponse.json({ status: "failed", error: data.error });
      }
      return NextResponse.json({ status: data.status || "processing" });
    } catch { /* fall through to RunPod */ }
  }

  // Check RunPod
  const fluxUrl = process.env.RUNPOD_FLUX_URL;
  const runpodKey = process.env.RUNPOD_API_KEY;
  if (!fluxUrl || !runpodKey) {
    return NextResponse.json({ error: "Not configured" }, { status: 500 });
  }

  try {
    const res = await fetch(`${fluxUrl}/status/${jobId}`, {
      headers: { Authorization: `Bearer ${runpodKey}` },
    });
    const data = await res.json();

    if (data.status === "COMPLETED" && data.output) {
      const images = data.output.images || [data.output.image_url || data.output.image_base64].filter(Boolean);
      return NextResponse.json({ status: "completed", images });
    }

    return NextResponse.json({ status: data.status?.toLowerCase() || "processing" });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
