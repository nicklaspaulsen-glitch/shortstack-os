/**
 * POST /api/thumbnail/generate-dalle
 *
 * Generates a thumbnail image via DALL-E 3 or GPT-image-1.
 *
 * Request body:
 *   prompt        string   required — image description
 *   model?        "dall-e-3" | "gpt-image-1"   default: "dall-e-3"
 *   size?         DalleSize   default: "1792x1024" (16:9)
 *   quality?      "standard" | "hd" | "high" | "medium" | "low"
 *   style?        "vivid" | "natural"   (DALL-E 3 only)
 *   n?            number   number of images (gpt-image-1 only, max 4)
 *   enhancePrompt? boolean  prepend thumbnail-optimisation prefix to prompt
 *
 * Response 201:
 *   { ok: true, urls: string[], revisedPrompt?: string, estimatedCostUsd: number }
 */

import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import {
  generateImage,
  type ImageGenRequest,
  type ImageModel,
  type DalleSize,
  type ImageQuality,
  type ImageStyle,
} from "@/lib/services/dalle";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60; // Image gen can take up to 20–30 s for hd

// Comprehensive YouTube thumbnail quality formula — trained on MrBeast,
// Jordan Welch, Jeff Nippard, Alex Hormozi, Logan Paul, Grizzy, Pezzy
// and other top creators. Applied when enhancePrompt=true.
const THUMBNAIL_PROMPT_PREFIX =
  "Professional YouTube thumbnail, 1280×720 pixels (16:9). " +
  "COMPOSITION: Subject offset to rule-of-thirds, never dead-center. " +
  "If a person is present, face fills at least 35% of the frame. " +
  "EMOTION: Maximum expressive emotion — shock, ecstasy, raw intensity, or extreme curiosity. " +
  "Subtle expressions are invisible at mobile scale; go bigger. " +
  "LIGHTING: Cinematic dramatic studio lighting with deep shadows and vivid rim-light separation. " +
  "No flat or ambient-only lighting. Hard light preferred. " +
  "COLOR: Hyper-saturated vivid palette. Never washed out, never pastel. " +
  "High contrast between subject and background. Dark backgrounds use deep blacks (#0a0a0a–#1c1c2e) with a single punchy accent color. " +
  "TYPOGRAPHY (if included): 2–5 words max, bold condensed sans-serif (Impact or Bebas Neue weight), " +
  "thick black stroke 4px+, color chosen for maximum contrast. Must be legible at 320×180 mobile preview size. " +
  "QUALITY: Photorealistic, 8K detail, professional photography or premium digital art. " +
  "Not stock photo aesthetic. Not corporate. Not advertisement. Viral YouTube creator energy. " +
  "Subject: ";

export async function POST(req: NextRequest) {
  // Auth check — only authenticated agency users can call this
  const supabase = createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: {
    prompt?: string;
    model?: string;
    size?: string;
    quality?: string;
    style?: string;
    n?: number;
    enhancePrompt?: boolean;
  };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.prompt?.trim()) {
    return NextResponse.json({ error: "prompt is required" }, { status: 400 });
  }

  const model = (["dall-e-3", "gpt-image-1"].includes(body.model ?? "")
    ? body.model
    : "dall-e-3") as ImageModel;

  const size = (body.size as DalleSize) ?? "1792x1024";
  const quality = (body.quality as ImageQuality) ?? (model === "gpt-image-1" ? "high" : "hd");
  const style = (["vivid", "natural"].includes(body.style ?? "")
    ? body.style
    : "vivid") as ImageStyle;
  const n = Math.min(Math.max(1, body.n ?? 1), model === "dall-e-3" ? 1 : 4);

  const finalPrompt = body.enhancePrompt
    ? THUMBNAIL_PROMPT_PREFIX + body.prompt.trim()
    : body.prompt.trim();

  const imageReq: ImageGenRequest = {
    prompt: finalPrompt,
    model,
    size,
    quality,
    style,
    n,
    responseFormat: "url",
  };

  let result: Awaited<ReturnType<typeof generateImage>>;
  try {
    result = await generateImage(imageReq);
  } catch (err) {
    console.error("[thumbnail/generate-dalle] image generation failed", err);
    return NextResponse.json(
      {
        error:
          "Image generation failed",
      },
      { status: 500 },
    );
  }

  return NextResponse.json(
    {
      ok: true,
      urls: result.urls,
      revisedPrompt: result.revisedPrompt ?? null,
      estimatedCostUsd: result.estimatedCostUsd,
      model: result.model,
    },
    { status: 201 },
  );
}
