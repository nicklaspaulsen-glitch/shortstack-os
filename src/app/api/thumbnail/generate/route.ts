import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createServerSupabase } from "@/lib/supabase/server";
import { getStyleById } from "@/lib/thumbnail-styles";
import { getEffectiveOwnerId } from "@/lib/security/require-owned-client";
import { checkLimit, recordUsage } from "@/lib/usage-limits";

// Average FLUX/SDXL render consumes roughly this many "tokens" in the
// plan-tier budget. Tuned against observed RunPod usage — a Starter plan
// (250k tokens/mo) gets ~250 single-image generations before hitting the
// cap, which matches the rough infra-cost breakeven.
const THUMBNAIL_TOKEN_COST = 1000;

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// Platform dimensions
const PLATFORM_SIZES: Record<string, { width: number; height: number }> = {
  youtube: { width: 1280, height: 720 },
  instagram: { width: 1080, height: 1080 },
  twitter: { width: 1200, height: 675 },
  facebook: { width: 1200, height: 630 },
  linkedin: { width: 1200, height: 627 },
  tiktok: { width: 1080, height: 1920 },
};

// ── HIGH-CTR THUMBNAIL PROMPT SYSTEM ──
// Optimized for MrBeast-style YouTube thumbnails: bold, clean, exaggerated, eye-catching
// Key principles: strong focal point, 2-3 max colors, exaggerated expressions, clean bg, high saturation

// Style prompt modifiers — each tuned for specific thumbnail aesthetics
const STYLE_PROMPTS: Record<string, string> = {
  youtube_classic:
    "professional YouTube thumbnail photo, extremely vibrant saturated colors, shallow depth of field background blur, studio lighting, clean uncluttered composition, bold dramatic look, high-end DSLR quality, wide angle lens distortion, strong single focal point, 3-color maximum palette, editorial photography",
  cinematic:
    "cinematic widescreen composition, dramatic volumetric lighting with god rays, teal and orange color grading, lens flare, bokeh background, movie poster composition, anamorphic lens, ultra sharp subject with blurred background, professional color grading",
  minimal:
    "ultra clean minimalist thumbnail, solid color gradient background, single subject centered, lots of negative space for text overlay, modern graphic design, flat clean aesthetic, professional product photography style, soft diffused lighting",
  bold_text:
    "bold graphic design thumbnail, solid vivid background color, clean separation between subject and background, strong geometric shapes, pop art influenced, high saturation neon accents, designed for large text overlay",
  dark_moody:
    "dark dramatic thumbnail, deep blacks with selective rim lighting, single spotlight on subject, noir cinematic mood, volumetric fog, strong silhouette, neon accent glow on edges, cyberpunk undertones, extremely high contrast",
  news_breaking:
    "urgent breaking news style thumbnail, clean sharp professional look, red and white accents, broadcast quality composition, serious tone, strong centered subject, professional headshot style lighting, high clarity",
  tutorial:
    "bright clean tutorial thumbnail, well-lit flat lay or screen setup, organized clear composition, soft shadows, friendly approachable look, bright natural daylight colors, clean white or light background, professional but warm",
  listicle:
    "colorful numbered list thumbnail, bold color-blocked sections, organized visual hierarchy, clean graphic design, multiple small elements arranged in grid, infographic style, bright saturated section colors",
};

// Mood modifiers — exaggerated for thumbnail impact
const MOOD_PROMPTS: Record<string, string> = {
  dramatic: "extremely dramatic high-stakes atmosphere, intense contrast between light and dark, cinematic tension, spotlight effect",
  happy: "bright joyful explosion of warm golden light, genuine wide smile energy, uplifting warm color palette, sun-drenched glow",
  mysterious: "deep mysterious shadows, silhouette with glowing backlight, fog and mist, hidden elements partially revealed, eerie blue undertone",
  energetic: "explosive dynamic energy, motion lines, electric sparks, vibrant neon action, speed and impact frozen in time, extreme saturation",
  calm: "serene peaceful atmosphere, soft golden hour light, pastel sky gradients, gentle bokeh, dreamy ethereal glow",
  dark: "pitch black environment with dramatic single light source, ominous silhouettes, deep shadows consuming the frame, horror movie lighting",
  luxurious: "ultra luxury gold and black premium aesthetic, reflective surfaces, metallic sheen, diamonds and sparkles, wealth and opulence, marble textures",
  retro: "nostalgic 80s retro neon aesthetic, synthwave colors, VHS scan lines subtle, chrome text reflections, sunset gradient pink purple orange",
};

// Color themes — bold 2-3 color palettes (what performs best on YouTube)
const COLOR_PROMPTS: Record<string, string> = {
  red_black: "bold red (#FF0000) and jet black color scheme, maximum contrast, danger and urgency feel, red glowing accents on black",
  blue_white: "electric blue (#0066FF) and pure white clean palette, trustworthy professional, blue neon glow on white background",
  neon: "vivid neon green (#00FF41) and hot pink (#FF00FF) on black, cyberpunk glow effect, electric plasma energy",
  gold_black: "rich gold (#FFD700) metallic sheen on deep black, luxury premium feel, gold light rays, treasure and wealth",
  pastel: "soft pastel pink (#FFB6C1) and lavender (#E6E6FA) with white, dreamy aesthetic, soft gradient transitions",
  monochrome: "pure high-contrast black and white, dramatic grayscale with single accent color pop, artistic editorial photography",
};

// Face/character descriptions — MrBeast-style exaggerated expressions
const FACE_DESCRIPTIONS: Record<string, string> = {
  face_surprised: "a person with an extremely exaggerated surprised expression, jaw dropped wide open, eyes bulging huge, hands on cheeks, MrBeast thumbnail style shock face, looking directly at camera",
  face_excited: "a person with an over-the-top excited expression, massive open-mouth smile showing teeth, wide bright eyes, fist pump energy, extreme enthusiasm, looking at camera",
  face_thinking: "a person with exaggerated thinking pose, hand dramatically on chin, one eyebrow raised high, squinting eyes, curious puzzled look, looking slightly off-camera",
  face_pointing: "a person aggressively pointing directly at the camera, intense direct eye contact, slightly leaning forward, commanding attention, index finger perfectly centered",
  face_laughing: "a person laughing uncontrollably, head tilted back, tears of joy, genuine explosive laughter, contagious joy energy, hands on stomach",
  face_serious: "a person with an intense dead-serious expression, locked eye contact with camera, clenched jaw, determined powerful presence, arms crossed, authority pose",
  face_cool: "a person looking effortlessly cool, designer sunglasses, slight confident smirk, chin slightly up, casual power pose, celebrity energy",
  face_angry: "a person with exaggerated fury, furrowed brows creating deep wrinkles, gritted teeth visible, red-faced intensity, veins showing, pure rage energy",
  face_wink: "a person doing an exaggerated playful wink, tongue slightly out, finger guns at camera, mischievous grin, charismatic energy",
  face_money: "a person surrounded by falling cash and coins, eyes wide with dollar signs energy, holding stacks of money, wealth explosion, pure greed excitement",
  face_trophy: "a victorious person holding a trophy, celebrating success",
  face_fire: "a person with flames around them, intense fierce energy",
};

// Use AI router to enhance simple prompts into thumbnail-optimized prompts
async function enhancePromptWithAI(simplePrompt: string, style: string, mood: string): Promise<string | null> {
  const runpodUrl = process.env.RUNPOD_LLM_URL;
  const runpodKey = process.env.RUNPOD_API_KEY;
  if (!runpodUrl || !runpodKey) return null;

  try {
    const res = await fetch(`${runpodUrl}/runsync`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${runpodKey}`,
      },
      body: JSON.stringify({
        input: {
          messages: [
            {
              role: "system",
              content: `You are a YouTube thumbnail prompt engineer. Convert the user's simple description into a detailed Stable Diffusion prompt optimized for a viral YouTube thumbnail. Focus on: exaggerated facial expressions (MrBeast-style), bold 2-3 color palettes, clean backgrounds with blur, dramatic lighting, high contrast, single strong focal point. Keep it under 100 words. Only output the prompt, no explanation.`,
            },
            {
              role: "user",
              content: `Create a thumbnail prompt for: "${simplePrompt}" (Style: ${style}, Mood: ${mood})`,
            },
          ],
          max_tokens: 200,
          temperature: 0.7,
        },
      }),
    });
    const data = await res.json();
    const enhanced = data?.output?.choices?.[0]?.message?.content;
    return enhanced && enhanced.length > 20 ? enhanced.trim() : null;
  } catch {
    return null;
  }
}

function buildPrompt(body: {
  prompt: string;
  style?: string;
  mood?: string;
  colorTheme?: string;
  faces?: string[];
  textOverlay?: string;
  enhancedPrompt?: string | null;
}): string {
  const parts: string[] = [];

  // Use AI-enhanced prompt if available, otherwise use original
  if (body.enhancedPrompt) {
    parts.push(body.enhancedPrompt);
  } else {
    parts.push(body.prompt);
  }

  // Add face/character descriptions (MrBeast-style exaggerated)
  if (body.faces && body.faces.length > 0) {
    const faceDescs = body.faces
      .map((f: string) => FACE_DESCRIPTIONS[f])
      .filter(Boolean);
    if (faceDescs.length > 0) {
      parts.push(`featuring ${faceDescs.join(" and ")}`);
    }
  }

  // Add style — check legacy STYLE_PROMPTS first, then fall back to the
  // 50-style preset library (src/lib/thumbnail-styles.ts).
  if (body.style) {
    if (STYLE_PROMPTS[body.style]) {
      parts.push(STYLE_PROMPTS[body.style]);
    } else {
      const preset = getStyleById(body.style);
      if (preset) {
        parts.push(preset.promptModifier);
      }
    }
  }

  // Add mood
  if (body.mood && MOOD_PROMPTS[body.mood]) {
    parts.push(MOOD_PROMPTS[body.mood]);
  }

  // Add color theme
  if (body.colorTheme && COLOR_PROMPTS[body.colorTheme]) {
    parts.push(COLOR_PROMPTS[body.colorTheme]);
  }

  // Reserve text space (don't put text in the image — overlay it later)
  if (body.textOverlay) {
    parts.push("leave clean open space on one side for large bold text overlay, asymmetric composition");
  }

  // Universal HIGH-CTR thumbnail quality boosters
  parts.push(
    "viral YouTube thumbnail, extremely sharp focus, professional studio photography, " +
    "8k ultra HD, perfect lighting, clean edges, magazine cover quality, " +
    "strong visual hierarchy, click-worthy composition, trending on YouTube, " +
    "shallow depth of field background blur, subject perfectly in focus"
  );

  return parts.join(", ");
}

// POST — Generate AI thumbnails via RunPod SDXL
export async function POST(request: NextRequest) {
  // Auth — this route dispatches paid RunPod jobs and proxies to a self-hosted
  // LLM for prompt enhancement. Anonymous callers would let anyone on the
  // internet drain the GPU budget.
  const authSupabase = createServerSupabase();
  const { data: { user } } = await authSupabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await request.json();
    const {
      prompt,
      style,
      platform,
      textOverlay,
      colorTheme,
      mood,
      faces,
      variations,
    } = body;

    if (!prompt) {
      return NextResponse.json(
        { error: "Prompt is required" },
        { status: 400 }
      );
    }

    // Plan-tier token gate — bug-hunt-apr20-v2 HIGH #12. Without this a
    // Starter-plan user could queue unlimited RunPod jobs and drain the
    // GPU budget; the cost breakeven in LIMITS_BY_TIER assumes tokens
    // are metered.
    const variationCount = Math.max(1, Math.min(4, Number(variations) || 1));
    const estimatedTokens = THUMBNAIL_TOKEN_COST * variationCount;
    const ownerId = (await getEffectiveOwnerId(authSupabase, user.id)) || user.id;
    const gate = await checkLimit(ownerId, "tokens", estimatedTokens);
    if (!gate.allowed) {
      return NextResponse.json(
        {
          error: gate.reason || "Monthly token budget reached for your plan.",
          current: gate.current,
          limit: gate.limit,
          plan_tier: gate.plan_tier,
          remaining: gate.remaining,
        },
        { status: 402 },
      );
    }

    const fluxUrl = process.env.RUNPOD_FLUX_URL;
    const sdxlUrl = process.env.RUNPOD_SDXL_URL;
    const runpodKey = process.env.RUNPOD_API_KEY;
    const useFlux = !!fluxUrl; // Prefer FLUX.1-dev when available

    if ((!fluxUrl && !sdxlUrl) || !runpodKey) {
      return NextResponse.json(
        { error: "Image generation service not configured" },
        { status: 503 }
      );
    }

    // Determine dimensions
    const dims = PLATFORM_SIZES[platform] || {
      width: body.width || 1280,
      height: body.height || 720,
    };

    // Scale down for generation (max 1024x1024), upscale in post
    const maxDim = 1024;
    let genWidth = dims.width;
    let genHeight = dims.height;
    const aspectRatio = genWidth / genHeight;

    if (genWidth > maxDim || genHeight > maxDim) {
      if (aspectRatio >= 1) {
        genWidth = maxDim;
        genHeight = Math.round(maxDim / aspectRatio);
      } else {
        genHeight = maxDim;
        genWidth = Math.round(maxDim * aspectRatio);
      }
    }
    // Round to nearest 8
    genWidth = Math.round(genWidth / 8) * 8;
    genHeight = Math.round(genHeight / 8) * 8;

    const count = Math.min(variations || 1, 4); // Max 4 at once

    // Step 1: Enhance user prompt with self-hosted LLM
    const enhancedPrompt = await enhancePromptWithAI(prompt, style || "youtube_classic", mood || "dramatic");

    const fullPrompt = buildPrompt({
      prompt,
      style,
      mood,
      colorTheme,
      faces,
      textOverlay,
      enhancedPrompt,
    });

    const negativePrompt =
      "blurry, low quality, deformed, ugly, watermark, signature, cropped, worst quality, jpeg artifacts, " +
      "duplicate, morbid, mutilated, out of frame, extra fingers, mutated hands, poorly drawn hands, " +
      "poorly drawn face, mutation, bad anatomy, bad proportions, extra limbs, disfigured, malformed limbs, " +
      "missing arms, missing legs, extra arms, extra legs, fused fingers, too many fingers, long neck, " +
      "cluttered background, busy composition, multiple focal points, tiny subject, " +
      "text in image, words in image, letters, writing, font, typography rendered, " +
      "stock photo watermark, boring flat lighting, low contrast, washed out colors, " +
      "amateur photography, grainy, noisy, pixelated, oversaturated to point of neon, " +
      "uncanny valley face, plastic skin, dead eyes, asymmetric face";

    // Build FLUX.1-dev ComfyUI workflow JSON
    const buildFluxWorkflow = (promptText: string, negPrompt: string, w: number, h: number, seed: number) => {
      return {
        input: {
          workflow: {
            "6": {
              inputs: { text: promptText, clip: ["30", 1] },
              class_type: "CLIPTextEncode",
              _meta: { title: "CLIP Text Encode (Positive Prompt)" },
            },
            "8": {
              inputs: { samples: ["31", 0], vae: ["30", 2] },
              class_type: "VAEDecode",
              _meta: { title: "VAE Decode" },
            },
            "9": {
              inputs: { filename_prefix: "ComfyUI", images: ["8", 0] },
              class_type: "SaveImage",
              _meta: { title: "Save Image" },
            },
            "27": {
              inputs: { width: w, height: h, batch_size: 1 },
              class_type: "EmptySD3LatentImage",
              _meta: { title: "EmptySD3LatentImage" },
            },
            "30": {
              inputs: { ckpt_name: "flux1-dev-fp8.safetensors" },
              class_type: "CheckpointLoaderSimple",
              _meta: { title: "Load Checkpoint" },
            },
            "31": {
              inputs: {
                seed,
                steps: 12,
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
              _meta: { title: "KSampler" },
            },
            "33": {
              inputs: { text: negPrompt, clip: ["30", 1] },
              class_type: "CLIPTextEncode",
              _meta: { title: "CLIP Text Encode (Negative Prompt)" },
            },
            "35": {
              inputs: { guidance: 3.5, conditioning: ["6", 0] },
              class_type: "FluxGuidance",
              _meta: { title: "FluxGuidance" },
            },
          },
        },
      };
    }

    // Build SDXL request body (fallback)
    const buildSdxlRequest = (promptText: string, negPrompt: string, w: number, h: number, seed: number) => {
      return {
        input: {
          prompt: promptText,
          negative_prompt: negPrompt,
          width: w,
          height: h,
          num_inference_steps: 30,
          refiner_inference_steps: 50,
          guidance_scale: 7.5,
          strength: 0.3,
          high_noise_frac: 0.8,
          seed,
          scheduler: "K_EULER",
          num_images: 1,
        },
      };
    }

    // Launch all variation jobs in parallel — FLUX primary, SDXL fallback
    const endpointUrl = useFlux ? fluxUrl! : sdxlUrl!;
    const jobPromises = Array.from({ length: count }, (_, i) => {
      const seed = Math.floor(Math.random() * 2147483647) + i * 1000;
      const requestBody = useFlux
        ? buildFluxWorkflow(fullPrompt, negativePrompt, genWidth, genHeight, seed)
        : buildSdxlRequest(fullPrompt, negativePrompt, genWidth, genHeight, seed);

      return fetch(`${endpointUrl}/run`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${runpodKey}`,
        },
        body: JSON.stringify(requestBody),
      }).then((r) => r.json());
    });

    const jobResults = await Promise.all(jobPromises);

    // Build thumbnail entries with job IDs for polling
    const thumbnails = jobResults.map((job, i) => ({
      id: job.id || `thumb_${Date.now()}_${i}`,
      job_id: job.id,
      status: job.status || "IN_QUEUE",
      prompt: fullPrompt,
      style: style || "youtube_classic",
      platform: platform || "youtube",
      textOverlay: textOverlay || "",
      colorTheme: colorTheme || "red_black",
      mood: mood || "dramatic",
      faces: faces || [],
      imageUrl: null,
      width: dims.width,
      height: dims.height,
      genWidth,
      genHeight,
      createdAt: new Date().toISOString(),
    }));

    // Log to trinity_log
    try {
      const supabase = createClient(supabaseUrl, supabaseKey);
      await supabase.from("trinity_log").insert({
        type: "thumbnail_generate",
        message: `Generated ${count} thumbnail job(s): ${style} / ${platform}`,
        metadata: {
          prompt: fullPrompt,
          style,
          platform,
          mood,
          colorTheme,
          faces,
          count,
          job_ids: thumbnails.map((t) => t.job_id),
        },
      });
    } catch {
      // Non-critical — don't fail the request
    }

    // Plan-tier usage metering — record ACTUAL variation count that queued
    // successfully. Not every variation may have made it to the queue, so
    // we meter on `thumbnails.length`, not the requested `count`.
    if (thumbnails.length > 0) {
      await recordUsage(
        ownerId,
        "tokens",
        THUMBNAIL_TOKEN_COST * thumbnails.length,
        { kind: "thumbnail_generate", count: thumbnails.length },
      );
    }

    return NextResponse.json({
      success: true,
      thumbnails,
      message: `Queued ${count} thumbnail${count > 1 ? "s" : ""} for generation`,
      poll_url: "/api/thumbnail/status",
    });
  } catch (err) {
    console.error("Thumbnail generation error:", err);
    return NextResponse.json(
      { error: "Failed to generate thumbnails" },
      { status: 500 }
    );
  }
}
