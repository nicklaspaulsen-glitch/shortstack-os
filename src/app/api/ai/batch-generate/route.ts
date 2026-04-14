import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { checkAiRateLimit } from "@/lib/api-rate-limit";

/**
 * Batch Image Generation — Generate 5-50 social media assets at once on RunPod.
 * Uses FLUX or SDXL to create multiple variations from templates/prompts.
 * Supports: custom LoRA, brand colors, multiple sizes, bulk export.
 */
export async function POST(request: NextRequest) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const limited = checkAiRateLimit(user.id);
  if (limited) return limited;

  const body = await request.json();
  const {
    prompts,           // Array of prompt strings
    base_prompt,       // Optional shared prefix
    count = 5,         // Total images if using single prompt
    sizes = ["1024x1024"], // Array of WxH strings
    style,             // Style preset
    lora_url,          // Optional custom LoRA
    lora_trigger,      // LoRA trigger word
    negative_prompt,   // Shared negative prompt
    model = "flux",    // flux | sdxl
  } = body;

  // Validate
  const promptList: string[] = prompts || (base_prompt ? Array(count).fill(base_prompt) : []);
  if (promptList.length === 0) {
    return NextResponse.json({ error: "Provide prompts array or base_prompt" }, { status: 400 });
  }

  if (promptList.length > 50) {
    return NextResponse.json({ error: "Max 50 images per batch" }, { status: 400 });
  }

  // Plan-based batch limits
  const { data: profile } = await supabase
    .from("profiles")
    .select("plan_tier")
    .eq("id", user.id)
    .single();

  const tier = profile?.plan_tier || "Starter";
  const batchLimits: Record<string, number> = {
    Starter: 5, Growth: 15, Pro: 30, Business: 50, Unlimited: 50,
  };
  const maxBatch = batchLimits[tier] || 5;

  if (promptList.length > maxBatch) {
    return NextResponse.json({
      error: `Your ${tier} plan allows ${maxBatch} images per batch. Upgrade for more.`,
      limit: maxBatch,
    }, { status: 403 });
  }

  const fluxUrl = process.env.RUNPOD_FLUX_URL;
  const sdxlUrl = process.env.RUNPOD_SDXL_URL;
  const runpodKey = process.env.RUNPOD_API_KEY;
  const endpointUrl = model === "sdxl" ? (sdxlUrl || fluxUrl) : (fluxUrl || sdxlUrl);

  if (!endpointUrl || !runpodKey) {
    return NextResponse.json({ error: "Image generation not configured" }, { status: 500 });
  }

  // Style presets
  const styleMap: Record<string, string> = {
    modern: "clean modern design, professional, high quality, sharp details",
    vintage: "vintage retro aesthetic, warm film grain, nostalgic colors",
    minimalist: "ultra minimalist, simple, vast negative space, elegant",
    bold: "bold colors, high contrast, eye-catching, dynamic composition",
    luxury: "luxury premium feel, gold accents, deep blacks, sophisticated",
    playful: "fun playful colorful, rounded shapes, friendly, approachable",
    dark: "dark moody aesthetic, deep shadows, dramatic lighting, cinematic",
    corporate: "professional corporate, clean layout, business-appropriate",
  };

  const stylePrompt = style && styleMap[style] ? `, ${styleMap[style]}` : "";
  const negPrompt = negative_prompt || "blurry, low quality, distorted, watermark, ugly, amateur";

  try {
    // Parse sizes into width/height pairs
    const sizeList = sizes.map((s: string) => {
      const [w, h] = s.split("x").map(Number);
      return { width: w || 1024, height: h || 1024 };
    });

    // Launch all jobs in parallel

    const jobPromises = promptList.map(async (prompt: string, i: number) => {
      const size = sizeList[i % sizeList.length];
      const fullPrompt = `${lora_trigger ? lora_trigger + ", " : ""}${prompt}${stylePrompt}`;
      const seed = Math.floor(Math.random() * 2147483647);

      const payload = model === "flux" || endpointUrl === fluxUrl
        ? {
            input: {
              workflow: {
                "6": { inputs: { text: fullPrompt, clip: ["11", 0] }, class_type: "CLIPTextEncode" },
                "8": { inputs: { samples: ["13", 0], vae: ["10", 0] }, class_type: "VAEDecode" },
                "9": { inputs: { filename_prefix: "flux_batch", images: ["8", 0] }, class_type: "SaveImage" },
                "10": { inputs: { vae_name: "ae.sft" }, class_type: "VAELoader" },
                "11": { inputs: { clip_name1: "t5xxl_fp8_e4m3fn.safetensors", clip_name2: "clip_l.safetensors", type: "flux" }, class_type: "DualCLIPLoader" },
                "12": { inputs: { unet_name: "flux1-dev.sft", weight_dtype: "fp8_e4m3fn" }, class_type: "UNETLoader" },
                "13": { inputs: { noise: ["25", 0], guider: ["22", 0], sampler: ["16", 0], sigmas: ["17", 0], latent_image: ["27", 0] }, class_type: "SamplerCustomAdvanced" },
                "16": { inputs: { sampler_name: "euler" }, class_type: "KSamplerSelect" },
                "17": { inputs: { scheduler: "simple", steps: 20, denoise: 1, model: ["12", 0] }, class_type: "BasicScheduler" },
                "22": { inputs: { model: ["12", 0], conditioning: ["6", 0] }, class_type: "BasicGuider" },
                "25": { inputs: { noise_seed: seed }, class_type: "RandomNoise" },
                "27": { inputs: { width: size.width, height: size.height, batch_size: 1 }, class_type: "EmptySD3LatentImage" },
              },
            },
          }
        : {
            input: {
              prompt: fullPrompt,
              negative_prompt: negPrompt,
              width: size.width,
              height: size.height,
              num_inference_steps: 30,
              guidance_scale: 7.5,
              seed,
              ...(lora_url ? { lora_url, lora_strength: 0.8 } : {}),
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
      return {
        prompt,
        size: `${size.width}x${size.height}`,
        jobId: job.id || null,
        status: job.status || "QUEUED",
      };
    });

    const results = await Promise.all(jobPromises);

    // Save batch record
    await supabase.from("batch_generations").insert({
      user_id: user.id,
      total_images: results.length,
      model,
      style: style || null,
      job_ids: results.map(r => r.jobId).filter(Boolean),
      status: "processing",
    });

    return NextResponse.json({
      success: true,
      batch_size: results.length,
      jobs: results,
      message: `${results.length} images queued for generation. Poll each job_id for status.`,
    });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
