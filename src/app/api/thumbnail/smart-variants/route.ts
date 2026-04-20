import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase, createServiceClient } from "@/lib/supabase/server";
import { getEffectiveOwnerId } from "@/lib/security/require-owned-client";
import { checkLimit, recordUsage } from "@/lib/usage-limits";
import {
  anthropic,
  MODEL_SONNET,
  MODEL_HAIKU,
  getResponseText,
  safeJsonParse,
} from "@/lib/ai/claude-helpers";
import { THUMBNAIL_STYLES } from "@/lib/thumbnail-styles";

/**
 * POST /api/thumbnail/smart-variants
 *
 * Body: { prompt: string, count?: number = 4, platform?: string }
 *
 * Pipeline:
 *   1. Claude Haiku picks N style presets from THUMBNAIL_STYLES that best
 *      match the user's prompt (cheap planning step).
 *   2. We kick off N FLUX/SDXL render jobs in parallel via the same config
 *      the /api/thumbnail/generate route uses.
 *   3. Once jobs complete (polled), Claude Sonnet Vision ranks them.
 *
 * Because the renders are GPU jobs that usually queue 10-60s, we return the
 * job IDs synchronously plus Claude's "expected" ordering. The UI can then
 * poll /api/thumbnail/status and, once all URLs land, call
 * /api/thumbnail/generate-variants/rank to get the real Sonnet ranking.
 *
 * Metered: 1 token bucket hit for the planning step + N render jobs. The
 * render route itself doesn't meter against plan tokens (GPU billing is
 * separate) so we do the accounting here.
 */

export const maxDuration = 60;

interface SmartVariantsInput {
  prompt?: unknown;
  count?: unknown;
  platform?: unknown;
  mood?: unknown;
  colorTheme?: unknown;
  faces?: unknown;
}

interface PlannedStyle {
  style_id: string;
  rationale: string;
  mood: string;
  color_theme: string;
}

// Platform dimensions mirror /api/thumbnail/generate's table — keep in sync.
const PLATFORM_SIZES: Record<string, { width: number; height: number }> = {
  youtube: { width: 1280, height: 720 },
  instagram: { width: 1080, height: 1080 },
  twitter: { width: 1200, height: 675 },
  facebook: { width: 1200, height: 630 },
  linkedin: { width: 1200, height: 627 },
  tiktok: { width: 1080, height: 1920 },
};

function pickStyleIds(): string[] {
  return THUMBNAIL_STYLES.map((s) => s.id);
}

function roundTo8(n: number): number {
  return Math.round(n / 8) * 8;
}

/** Compact catalog shown to Claude — names only, to keep tokens small. */
function styleCatalog(): string {
  return THUMBNAIL_STYLES.slice(0, 60)
    .map((s) => `- ${s.id} [${s.category}]: ${s.name}`)
    .join("\n");
}

async function planStyles(
  prompt: string,
  count: number,
): Promise<PlannedStyle[] | null> {
  if (!process.env.ANTHROPIC_API_KEY) return null;
  const systemPrompt =
    "You are a viral YouTube thumbnail art director. Given the user's prompt, " +
    "pick N DIFFERENT styles (one per variant) from the catalog that together " +
    "give the creator a spread of takes on the same idea: a safe pick, a " +
    "bolder pick, a cinematic/moody pick, and something unexpected. " +
    "Output JSON only — no markdown.";

  try {
    const resp = await anthropic.messages.create({
      model: MODEL_HAIKU,
      max_tokens: 600,
      temperature: 0.5,
      system: systemPrompt,
      messages: [
        {
          role: "user",
          content:
            `USER PROMPT: "${prompt.slice(0, 600)}"\n\n` +
            `CATALOG (id + category + name):\n${styleCatalog()}\n\n` +
            `Pick ${count} distinct style_ids and output:\n` +
            `{\n  "variants": [\n    { "style_id": "...", "rationale": "...", "mood": "dramatic|happy|energetic|dark|mysterious|calm|luxurious|retro", "color_theme": "red_black|blue_white|neon|gold_black|pastel|monochrome" }\n  ]\n}`,
        },
      ],
    });
    const parsed = safeJsonParse<{ variants?: unknown }>(getResponseText(resp));
    if (!parsed || !Array.isArray(parsed.variants)) return null;
    const validIds = new Set(pickStyleIds());
    const out: PlannedStyle[] = [];
    for (const v of parsed.variants as Array<Record<string, unknown>>) {
      const id =
        typeof v?.style_id === "string" && validIds.has(v.style_id)
          ? v.style_id
          : null;
      if (!id) continue;
      out.push({
        style_id: id,
        rationale:
          typeof v.rationale === "string"
            ? v.rationale.slice(0, 200)
            : "AI-selected style",
        mood: typeof v.mood === "string" ? v.mood : "dramatic",
        color_theme:
          typeof v.color_theme === "string" ? v.color_theme : "red_black",
      });
    }
    return out.slice(0, count);
  } catch {
    return null;
  }
}

function buildFluxRequest(
  prompt: string,
  neg: string,
  w: number,
  h: number,
  seed: number,
) {
  return {
    input: {
      workflow: {
        "6": { inputs: { text: prompt, clip: ["30", 1] }, class_type: "CLIPTextEncode" },
        "8": { inputs: { samples: ["31", 0], vae: ["30", 2] }, class_type: "VAEDecode" },
        "9": { inputs: { filename_prefix: "ComfyUI", images: ["8", 0] }, class_type: "SaveImage" },
        "27": { inputs: { width: w, height: h, batch_size: 1 }, class_type: "EmptySD3LatentImage" },
        "30": { inputs: { ckpt_name: "flux1-dev-fp8.safetensors" }, class_type: "CheckpointLoaderSimple" },
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
        },
        "33": { inputs: { text: neg, clip: ["30", 1] }, class_type: "CLIPTextEncode" },
        "35": { inputs: { guidance: 3.5, conditioning: ["6", 0] }, class_type: "FluxGuidance" },
      },
    },
  };
}

function buildSdxlRequest(
  prompt: string,
  neg: string,
  w: number,
  h: number,
  seed: number,
) {
  return {
    input: {
      prompt,
      negative_prompt: neg,
      width: w,
      height: h,
      num_inference_steps: 30,
      guidance_scale: 7.5,
      seed,
      scheduler: "K_EULER",
      num_images: 1,
    },
  };
}

export async function POST(request: NextRequest) {
  const supabase = createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const ownerId = await getEffectiveOwnerId(supabase, user.id);
  if (!ownerId) {
    return NextResponse.json({ ok: false, error: "Profile not found" }, { status: 403 });
  }

  const limit = await checkLimit(ownerId, "tokens", 1);
  if (!limit.allowed) {
    return NextResponse.json(
      {
        ok: false,
        error: limit.reason || "Monthly token limit reached — upgrade to continue.",
        plan_tier: limit.plan_tier,
      },
      { status: 429 },
    );
  }

  let body: SmartVariantsInput;
  try {
    body = (await request.json()) as SmartVariantsInput;
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON body" }, { status: 400 });
  }

  const prompt =
    typeof body.prompt === "string" ? body.prompt.trim().slice(0, 2000) : "";
  if (!prompt) {
    return NextResponse.json({ ok: false, error: "prompt required" }, { status: 400 });
  }
  const count = Math.max(
    2,
    Math.min(6, typeof body.count === "number" ? Math.round(body.count) : 4),
  );
  const platform =
    typeof body.platform === "string" ? body.platform : "youtube";
  const dims = PLATFORM_SIZES[platform] || { width: 1280, height: 720 };

  // Plan style variants.
  const planned = (await planStyles(prompt, count)) || [];
  const fallbackStyleIds = ["youtube_classic", "cinematic", "dark_moody", "bold_text", "minimal", "news_breaking"].slice(
    0,
    count,
  );
  while (planned.length < count) {
    const id = fallbackStyleIds[planned.length] || "youtube_classic";
    planned.push({
      style_id: id,
      rationale: "Fallback diversity pick",
      mood: "dramatic",
      color_theme: "red_black",
    });
  }

  const fluxUrl = process.env.RUNPOD_FLUX_URL;
  const sdxlUrl = process.env.RUNPOD_SDXL_URL;
  const runpodKey = process.env.RUNPOD_API_KEY;
  const endpointUrl = fluxUrl || sdxlUrl;
  const useFlux = !!fluxUrl;

  // Graceful degradation: if GPU isn't configured, still return the plan so
  // the UI can show "here's what we'd try".
  if (!endpointUrl || !runpodKey) {
    void recordUsage(ownerId, "tokens", 2000, {
      source: "thumbnail_smart_variants_plan_only",
      count,
    });
    return NextResponse.json({
      ok: true,
      mode: "plan_only",
      variants: planned.map((p) => ({
        style_id: p.style_id,
        rationale: p.rationale,
        mood: p.mood,
        color_theme: p.color_theme,
        job_id: null,
      })),
      message: "Image generation service not configured — returning plan only.",
    });
  }

  const maxDim = 1024;
  let genWidth = dims.width;
  let genHeight = dims.height;
  const ar = genWidth / genHeight;
  if (genWidth > maxDim || genHeight > maxDim) {
    if (ar >= 1) {
      genWidth = maxDim;
      genHeight = Math.round(maxDim / ar);
    } else {
      genHeight = maxDim;
      genWidth = Math.round(maxDim * ar);
    }
  }
  genWidth = roundTo8(genWidth);
  genHeight = roundTo8(genHeight);

  const negativePrompt =
    "blurry, low quality, deformed, ugly, watermark, signature, cropped, worst quality, " +
    "duplicate, mutated hands, poorly drawn face, bad anatomy, extra limbs, " +
    "text in image, words in image, typography rendered, cluttered background";

  const jobs = await Promise.all(
    planned.map(async (p, i) => {
      const styleInfo = THUMBNAIL_STYLES.find((s) => s.id === p.style_id);
      const fullPrompt = [
        prompt,
        styleInfo?.promptModifier || "",
        `mood: ${p.mood}, color palette: ${p.color_theme}`,
        "viral YouTube thumbnail, extremely sharp focus, professional studio photography, 8k ultra HD, strong visual hierarchy",
      ]
        .filter(Boolean)
        .join(", ");
      const seed = Math.floor(Math.random() * 2_000_000_000) + i * 1000;
      const req = useFlux
        ? buildFluxRequest(fullPrompt, negativePrompt, genWidth, genHeight, seed)
        : buildSdxlRequest(fullPrompt, negativePrompt, genWidth, genHeight, seed);
      try {
        const res = await fetch(`${endpointUrl}/run`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${runpodKey}`,
          },
          body: JSON.stringify(req),
        });
        const j = (await res.json()) as { id?: string; status?: string };
        return {
          style_id: p.style_id,
          rationale: p.rationale,
          mood: p.mood,
          color_theme: p.color_theme,
          prompt: fullPrompt,
          job_id: j.id || null,
          status: j.status || "QUEUED",
        };
      } catch (err) {
        return {
          style_id: p.style_id,
          rationale: p.rationale,
          mood: p.mood,
          color_theme: p.color_theme,
          prompt: fullPrompt,
          job_id: null,
          status: "FAILED",
          error: err instanceof Error ? err.message : "dispatch failed",
        };
      }
    }),
  );

  // Record usage (planning + dispatch cost). Actual render GPU cost is on the
  // GPU account — we only record the Claude tokens here.
  void recordUsage(ownerId, "tokens", 2500, {
    source: "thumbnail_smart_variants",
    count,
    platform,
  });

  // Fire-and-forget trinity log so the history view can surface this.
  try {
    const service = createServiceClient();
    void service.from("trinity_log").insert({
      action_type: "thumbnail_smart_variants",
      description: `Generated ${count} smart variants`,
      profile_id: user.id,
      status: "completed",
      result: {
        count,
        platform,
        style_ids: planned.map((p) => p.style_id),
      },
    });
  } catch {
    /* ignore */
  }

  // The _predicted_ ranking uses the first-listed style as the "safe pick".
  // A real Sonnet Vision ranking has to wait for the images to land, which
  // the UI does via POST /api/thumbnail/generate-variants/rank after polling.
  return NextResponse.json({
    ok: true,
    mode: "dispatched",
    model_planning: MODEL_HAIKU,
    model_ranking: MODEL_SONNET,
    variants: jobs,
    poll_url: "/api/thumbnail/status",
    rank_url: "/api/thumbnail/generate-variants/rank",
    count,
    platform,
  });
}
