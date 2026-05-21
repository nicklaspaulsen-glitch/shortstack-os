/**
 * DALL-E / GPT-image-1 image generation service.
 *
 * Supports:
 *   - dall-e-3  — OpenAI DALL-E 3, best prompt following, natural quality
 *   - gpt-image-1 — OpenAI gpt-image-1, broader aspect ratios, faster
 *
 * Uses the same lazy OpenAI client as the LLM provider (no module-level SDK init).
 *
 * Pricing (2026-05-21, approximate):
 *   DALL-E 3 standard 1024×1024  $0.040/img
 *   DALL-E 3 hd      1024×1024   $0.080/img
 *   gpt-image-1 high  1024×1024   $0.167/img (6 credits × $0.019 + detail fee)
 */
import OpenAI from "openai";

let _client: OpenAI | null = null;
function getClient(): OpenAI {
  if (_client) return _client;
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("[dalle] OPENAI_API_KEY not configured");
  _client = new OpenAI({ apiKey });
  return _client;
}

export type ImageModel = "dall-e-3" | "gpt-image-1";

export type DalleSize =
  | "1024x1024"
  | "1792x1024"
  | "1024x1792"  // DALL-E 3 landscape / portrait
  | "1536x1024"
  | "1024x1536"; // gpt-image-1 landscape / portrait

export type ImageQuality = "standard" | "hd" | "high" | "medium" | "low";

export type ImageStyle = "vivid" | "natural";

export interface ImageGenRequest {
  /** The image generation prompt. */
  prompt: string;
  /** Model to use. Defaults to "dall-e-3". */
  model?: ImageModel;
  /** Output size. Defaults to "1024x1024". */
  size?: DalleSize;
  /** Quality level. Defaults to "standard". gpt-image-1 uses "high"|"medium"|"low". */
  quality?: ImageQuality;
  /** Style for DALL-E 3 only — vivid (hyper-real) or natural. */
  style?: ImageStyle;
  /** Number of images. DALL-E 3 only supports n=1. */
  n?: number;
  /** Return format. Default "url". Use "b64_json" for server-side base64. */
  responseFormat?: "url" | "b64_json";
}

export interface ImageGenResult {
  /** Public URL or data URI depending on responseFormat. */
  urls: string[];
  /** Revised prompt as returned by the model (DALL-E 3 only). */
  revisedPrompt?: string;
  model: ImageModel;
  /** Approximate cost in USD */
  estimatedCostUsd: number;
}

/** Rough cost lookup (USD, 2026-05) */
const COST_TABLE: Record<string, number> = {
  "dall-e-3:standard:1024x1024": 0.040,
  "dall-e-3:standard:1792x1024": 0.080,
  "dall-e-3:standard:1024x1792": 0.080,
  "dall-e-3:hd:1024x1024": 0.080,
  "dall-e-3:hd:1792x1024": 0.120,
  "dall-e-3:hd:1024x1792": 0.120,
  "gpt-image-1:high:1024x1024": 0.167,
  "gpt-image-1:medium:1024x1024": 0.085,
  "gpt-image-1:low:1024x1024": 0.042,
  "gpt-image-1:high:1536x1024": 0.200,
  "gpt-image-1:high:1024x1536": 0.200,
};

function estimateCost(model: ImageModel, quality: string, size: string): number {
  return COST_TABLE[`${model}:${quality}:${size}`] ?? 0.05;
}

export async function generateImage(req: ImageGenRequest): Promise<ImageGenResult> {
  const client = getClient();

  const model: ImageModel = req.model ?? "dall-e-3";
  const size: DalleSize = req.size ?? "1024x1024";
  const quality: ImageQuality = req.quality ?? (model === "gpt-image-1" ? "high" : "standard");
  const style: ImageStyle = req.style ?? "vivid";
  const n = req.n ?? 1;
  const responseFormat = req.responseFormat ?? "url";

  let response: OpenAI.Images.ImagesResponse;

  if (model === "dall-e-3") {
    // DALL-E 3: style param supported, n must be 1
    response = await client.images.generate({
      model: "dall-e-3",
      prompt: req.prompt,
      size: size as OpenAI.Images.ImageGenerateParams["size"],
      quality: quality as "standard" | "hd",
      style,
      n: 1,
      response_format: responseFormat,
    });
  } else {
    // gpt-image-1: no style param, supports n > 1, different quality tiers
    response = await client.images.generate({
      model: "gpt-image-1",
      prompt: req.prompt,
      size: size as OpenAI.Images.ImageGenerateParams["size"],
      quality: quality as "high" | "medium" | "low",
      n,
      response_format: responseFormat,
    });
  }

  const images = response.data ?? [];
  const urls = images.map((img) => {
    if (responseFormat === "b64_json") {
      return `data:image/png;base64,${img.b64_json ?? ""}`;
    }
    return img.url ?? "";
  }).filter(Boolean);

  // DALL-E 3 may return a revised prompt
  const revisedPrompt = model === "dall-e-3" ? (images[0]?.revised_prompt ?? undefined) : undefined;

  return {
    urls,
    revisedPrompt,
    model,
    estimatedCostUsd: estimateCost(model, quality, size) * n,
  };
}

/** Convenience wrapper: generate a thumbnail-optimised image (16:9, vivid). */
export async function generateThumbnail(prompt: string, model?: ImageModel): Promise<ImageGenResult> {
  return generateImage({
    prompt,
    model: model ?? "dall-e-3",
    size: "1792x1024",
    quality: "hd",
    style: "vivid",
  });
}

/** Convenience wrapper: generate a square image (good for avatars / icons). */
export async function generateSquareImage(prompt: string, hd?: boolean): Promise<ImageGenResult> {
  return generateImage({
    prompt,
    model: "dall-e-3",
    size: "1024x1024",
    quality: hd ? "hd" : "standard",
    style: "vivid",
  });
}
