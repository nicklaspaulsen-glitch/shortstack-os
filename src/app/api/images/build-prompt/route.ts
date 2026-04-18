import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { checkAiRateLimit } from "@/lib/api-rate-limit";
import {
  anthropic,
  MODEL_HAIKU,
  safeJsonParse,
  getResponseText,
} from "@/lib/ai/claude-helpers";

/**
 * Image Wizard — Build Prompt
 *
 * POST: Accept the wizard's per-step answers and use Claude Haiku to
 * craft an optimized FLUX/SDXL prompt + sensible model parameters.
 *
 * The wizard surfaces this so the user sees the AI-expanded prompt
 * before sending the actual job to RunPod / Replicate.
 *
 * Input JSON: WizardAnswers (see type below)
 * Output JSON: { prompt, negative_prompt, recommended_model, dimensions, steps, guidance_scale }
 */

interface WizardAnswers {
  creation_type?: string;       // pfp | post | story | ad | carousel | blog_hero | yt_thumb | mockup | logo | custom
  audience?: string;            // free text — niche / target audience
  subject?: string;             // free text — what the image depicts
  style?: string;               // photorealistic | minimalist | bold | ...
  mood?: string[];              // chip-select
  composition?: string;         // centered | rule_of_thirds | portrait | ...
  palette?: string;             // brand | warm | cool | bw | pastel | neon | earth | custom
  custom_color?: string;        // hex if palette === "custom"
  text_overlay_enabled?: boolean;
  text_overlay?: string;
  text_position?: string;       // top | center | bottom | left | right
  text_style?: string;          // bold | minimal | handwritten | ...
  extras?: string[];            // logo_watermark | remove_bg | upscale | variants_4 | face_enhance
  custom_width?: number;
  custom_height?: number;
}

interface BuildPromptOutput {
  prompt: string;
  negative_prompt: string;
  recommended_model: "flux" | "sdxl";
  dimensions: { width: number; height: number };
  steps: number;
  guidance_scale: number;
  notes?: string;
}

/* ── Sensible defaults for each creation type ─────────────────── */
const DEFAULT_DIMENSIONS: Record<string, { width: number; height: number }> = {
  pfp: { width: 1024, height: 1024 },
  post: { width: 1080, height: 1080 },
  story: { width: 1080, height: 1920 },
  ad: { width: 1200, height: 628 },
  carousel: { width: 1080, height: 1080 },
  blog_hero: { width: 1600, height: 900 },
  yt_thumb: { width: 1280, height: 720 },
  mockup: { width: 1200, height: 1200 },
  logo: { width: 1024, height: 1024 },
  custom: { width: 1024, height: 1024 },
};

const SYSTEM_PROMPT = `You are an expert AI image prompt engineer for FLUX.1-dev and SDXL models.

Given a user's creative brief (the wizard answers below), produce a single optimal text-to-image prompt that captures their intent precisely. The prompt must:
- Lead with the subject and main element
- Layer in style modifiers, composition cues, color guidance, lighting, and quality boosters
- Stay under 300 characters total — be dense, not chatty
- Avoid double-quoted phrases or chatty connectors like "Please" or "I want"
- Never include forbidden words like "child" or "kid" (FLUX safety filters)

Also produce a tight negative prompt with the standard quality avoidances (low quality, blurry, watermark, jpeg artifacts, deformed). When the user did NOT request text overlay, ALWAYS add "text, words, letters, typography, captions" to the negative prompt to keep the image clean for an external text overlay.

Recommend model:
- "flux" for: photorealistic, cinematic, brand work, faces, logos, complex compositions
- "sdxl" for: anime/manga, illustration, watercolor, stylized art, vintage, pixar/animated

Recommend steps (12-30) and guidance_scale (1.0-7.5):
- FLUX: steps 12-20, guidance 1-3.5 (lower)
- SDXL: steps 25-30, guidance 6.5-7.5

Return ONLY raw JSON. No markdown fences. No commentary.

Schema:
{
  "prompt": "string",
  "negative_prompt": "string",
  "recommended_model": "flux" | "sdxl",
  "steps": number,
  "guidance_scale": number,
  "notes": "string (optional, very brief)"
}`;

function buildBriefText(a: WizardAnswers): string {
  const lines: string[] = [];

  if (a.creation_type) lines.push(`Creating: ${a.creation_type}`);
  if (a.audience?.trim()) lines.push(`Target audience / niche: ${a.audience.trim()}`);
  if (a.subject?.trim()) lines.push(`Main subject: ${a.subject.trim()}`);
  if (a.style) lines.push(`Style vibe: ${a.style}`);
  if (a.mood?.length) lines.push(`Mood: ${a.mood.join(", ")}`);
  if (a.composition) lines.push(`Composition: ${a.composition.replace(/_/g, " ")}`);

  if (a.palette) {
    if (a.palette === "custom" && a.custom_color) {
      lines.push(`Color palette: custom centered around ${a.custom_color}`);
    } else if (a.palette === "brand") {
      lines.push(`Color palette: user's brand colors`);
    } else {
      lines.push(`Color palette: ${a.palette.replace(/_/g, " ")}`);
    }
  }

  if (a.text_overlay_enabled && a.text_overlay?.trim()) {
    lines.push(
      `Text overlay: yes, "${a.text_overlay.trim()}" positioned ${a.text_position || "center"}, ${a.text_style || "bold"} style`,
    );
  } else {
    lines.push(`Text overlay: NO — image must be pure visual without text artifacts`);
  }

  if (a.extras?.length) lines.push(`Post-processing extras: ${a.extras.join(", ")}`);

  return lines.join("\n");
}

function defaultDimensions(a: WizardAnswers): { width: number; height: number } {
  if (a.creation_type === "custom" && a.custom_width && a.custom_height) {
    return { width: a.custom_width, height: a.custom_height };
  }
  return DEFAULT_DIMENSIONS[a.creation_type || "post"] || DEFAULT_DIMENSIONS.post;
}

/* ── Heuristic fallback when Claude is unavailable ───────────── */
function heuristicPrompt(a: WizardAnswers): BuildPromptOutput {
  const parts: string[] = [];
  if (a.subject?.trim()) parts.push(a.subject.trim());

  const styleMap: Record<string, string> = {
    photorealistic: "photorealistic, professional photography, ultra detailed, 8k",
    minimalist: "minimalist clean design, lots of negative space, elegant",
    bold: "bold graphic design, high contrast, vibrant saturated colors",
    vintage: "vintage retro aesthetic, film grain, warm nostalgic tones",
    anime: "anime manga style, cel shaded, vivid colors",
    "3d_render": "3D render, isometric perspective, octane render, soft shadows",
    watercolor: "watercolor illustration, soft edges, painterly",
    cyberpunk: "cyberpunk neon aesthetic, glowing accents, dark futuristic",
    pastel: "soft pastel palette, dreamy, gentle gradients",
    cinematic: "cinematic dark lighting, dramatic mood, moody color grading",
    flat: "flat design, geometric shapes, clean vector style",
    pixar: "pixar style 3D animation, expressive characters, friendly",
  };
  if (a.style && styleMap[a.style]) parts.push(styleMap[a.style]);

  if (a.mood?.length) parts.push(`mood: ${a.mood.join(" and ")}`);

  const compMap: Record<string, string> = {
    centered: "centered subject composition",
    rule_of_thirds: "rule of thirds composition",
    portrait: "portrait shot, face focus, shallow depth of field",
    landscape: "wide landscape shot",
    closeup: "extreme close-up shot",
    flatlay: "top-down flat lay perspective",
    dynamic: "dynamic diagonal composition, sense of motion",
  };
  if (a.composition && compMap[a.composition]) parts.push(compMap[a.composition]);

  const palMap: Record<string, string> = {
    warm: "warm color palette, reds oranges yellows",
    cool: "cool color palette, blues and greens",
    bw: "monochrome black and white",
    pastel: "soft pastel colors",
    neon: "neon glow palette",
    earth: "earth tones, natural muted colors",
  };
  if (a.palette && palMap[a.palette]) parts.push(palMap[a.palette]);
  if (a.palette === "custom" && a.custom_color) parts.push(`color palette built around ${a.custom_color}`);
  if (a.palette === "brand") parts.push("on-brand color palette");

  parts.push("sharp focus, professional, magazine quality, beautifully lit");

  const negativeParts = ["low quality", "blurry", "watermark", "jpeg artifacts", "deformed", "ugly"];
  if (!a.text_overlay_enabled) negativeParts.push("text", "words", "letters", "typography");

  const stylized = ["anime", "watercolor", "pixar", "flat", "vintage"].includes(a.style || "");
  const recommended_model: "flux" | "sdxl" = stylized ? "sdxl" : "flux";

  return {
    prompt: parts.join(", ").slice(0, 300),
    negative_prompt: negativeParts.join(", "),
    recommended_model,
    dimensions: defaultDimensions(a),
    steps: recommended_model === "flux" ? 16 : 28,
    guidance_scale: recommended_model === "flux" ? 3.5 : 7.0,
    notes: "Heuristic fallback (Claude unavailable)",
  };
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

  let answers: WizardAnswers;
  try {
    answers = (await request.json()) as WizardAnswers;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!answers.subject?.trim()) {
    return NextResponse.json({ error: "Subject / main element is required" }, { status: 400 });
  }

  const dimensions = defaultDimensions(answers);

  // No Claude key -> heuristic only
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(heuristicPrompt(answers));
  }

  try {
    const briefText = buildBriefText(answers);

    const response = await anthropic.messages.create({
      model: MODEL_HAIKU,
      max_tokens: 700,
      system: [
        {
          type: "text",
          text: SYSTEM_PROMPT,
          cache_control: { type: "ephemeral" },
        },
      ],
      messages: [
        {
          role: "user",
          content: `Build the optimal image prompt from this wizard brief:\n\n${briefText}\n\nReturn JSON only.`,
        },
      ],
    });

    const text = getResponseText(response);
    const parsed = safeJsonParse<{
      prompt?: string;
      negative_prompt?: string;
      recommended_model?: "flux" | "sdxl";
      steps?: number;
      guidance_scale?: number;
      notes?: string;
    }>(text);

    if (!parsed?.prompt) {
      // Fall back gracefully
      return NextResponse.json(heuristicPrompt(answers));
    }

    const recommended_model: "flux" | "sdxl" =
      parsed.recommended_model === "sdxl" ? "sdxl" : "flux";

    const out: BuildPromptOutput = {
      prompt: parsed.prompt.trim(),
      negative_prompt:
        parsed.negative_prompt?.trim() ||
        "low quality, blurry, watermark, jpeg artifacts, deformed",
      recommended_model,
      dimensions,
      steps:
        typeof parsed.steps === "number"
          ? Math.min(40, Math.max(8, Math.round(parsed.steps)))
          : recommended_model === "flux"
            ? 16
            : 28,
      guidance_scale:
        typeof parsed.guidance_scale === "number"
          ? Math.min(15, Math.max(1, parsed.guidance_scale))
          : recommended_model === "flux"
            ? 3.5
            : 7.0,
      notes: parsed.notes,
    };

    return NextResponse.json(out);
  } catch (err) {
    console.error("[images/build-prompt] error", err);
    // Fall back so the wizard never blocks the user
    return NextResponse.json(heuristicPrompt(answers));
  }
}
