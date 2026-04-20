/**
 * smart-crop.ts
 *
 * Ask Claude Sonnet Vision to find the primary subject's bounding box in an
 * image, then compute the largest crop that keeps the subject centered and
 * matches the requested aspect ratio.
 *
 * Pure-function shape: no Supabase, no usage metering. The API route is the
 * place that meters + logs. This file can be unit-tested in isolation.
 */

import { anthropic, MODEL_SONNET, getResponseText, safeJsonParse } from "@/lib/ai/claude-helpers";

export interface CropCoords {
  crop_x: number;
  crop_y: number;
  crop_width: number;
  crop_height: number;
}

export interface SubjectBox {
  /** 0..1 fractional coordinates */
  x: number;
  y: number;
  width: number;
  height: number;
  confidence: number;
  label?: string;
}

/** "16:9" → 16/9 ; "9:16" → 9/16 ; "1:1" → 1 ; accepts decimals too. */
export function parseAspect(raw: string): number | null {
  if (!raw) return null;
  const s = String(raw).trim();
  const m = s.match(/^(\d+(?:\.\d+)?)\s*[:xX]\s*(\d+(?:\.\d+)?)$/);
  if (m) {
    const w = Number(m[1]);
    const h = Number(m[2]);
    if (w > 0 && h > 0) return w / h;
  }
  const num = Number(s);
  if (Number.isFinite(num) && num > 0) return num;
  return null;
}

async function urlToBase64(url: string): Promise<
  | { data: string; mediaType: "image/png" | "image/jpeg" | "image/webp" }
  | null
> {
  try {
    if (url.startsWith("data:image/")) {
      const match = url.match(/^data:(image\/[a-z]+);base64,(.+)$/i);
      if (!match) return null;
      const mediaType: "image/png" | "image/jpeg" | "image/webp" =
        match[1] === "image/jpeg"
          ? "image/jpeg"
          : match[1] === "image/webp"
            ? "image/webp"
            : "image/png";
      return { data: match[2], mediaType };
    }
    const res = await fetch(url);
    if (!res.ok) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    const ct = res.headers.get("content-type") || "image/png";
    const mediaType: "image/png" | "image/jpeg" | "image/webp" = ct.includes(
      "jpeg",
    )
      ? "image/jpeg"
      : ct.includes("webp")
        ? "image/webp"
        : "image/png";
    return { data: buf.toString("base64"), mediaType };
  } catch {
    return null;
  }
}

/**
 * Ask Claude Sonnet Vision for a subject bounding box. Returns fractional
 * coordinates (0..1) so callers can use the same data with any source size.
 * Returns null on transport / parse failure — the API route falls back to a
 * center crop.
 */
export async function detectSubjectBox(
  imageUrl: string,
): Promise<SubjectBox | null> {
  if (!process.env.ANTHROPIC_API_KEY) return null;
  const img = await urlToBase64(imageUrl);
  if (!img) return null;

  const systemPrompt =
    "You are a computer-vision expert. Find the primary subject of the image " +
    "and return its bounding box in normalized 0..1 coordinates (x,y,width,height) " +
    "plus a label and confidence 0..1. If there is no clear subject (landscape, " +
    "background plate, etc.), return the largest salient region. Output JSON only.";

  try {
    const resp = await anthropic.messages.create({
      model: MODEL_SONNET,
      max_tokens: 300,
      temperature: 0,
      system: systemPrompt,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `{\n  "x": 0.1,\n  "y": 0.05,\n  "width": 0.55,\n  "height": 0.9,\n  "confidence": 0.92,\n  "label": "person"\n}\nReturn the JSON for this image. No other text.`,
            },
            {
              type: "image",
              source: {
                type: "base64",
                media_type: img.mediaType,
                data: img.data,
              },
            },
          ],
        },
      ],
    });

    const parsed = safeJsonParse<{
      x?: number;
      y?: number;
      width?: number;
      height?: number;
      confidence?: number;
      label?: string;
    }>(getResponseText(resp));
    if (!parsed) return null;
    const clamp01 = (n: unknown, fallback: number) =>
      typeof n === "number" && Number.isFinite(n) ? Math.max(0, Math.min(1, n)) : fallback;
    return {
      x: clamp01(parsed.x, 0.1),
      y: clamp01(parsed.y, 0.1),
      width: clamp01(parsed.width, 0.8),
      height: clamp01(parsed.height, 0.8),
      confidence: clamp01(parsed.confidence, 0.5),
      label: typeof parsed.label === "string" ? parsed.label.slice(0, 60) : undefined,
    };
  } catch {
    return null;
  }
}

/**
 * Compute the largest crop that:
 *   - matches targetAspect (width / height)
 *   - contains the subject box as much as possible (keeps it centered)
 *   - stays entirely inside the source image
 *
 * `srcWidth`/`srcHeight` are the pixel dims of the source image. The returned
 * coords are in source pixels. If no subject box is provided we fall back to
 * a center-aligned crop.
 */
export function computeCrop(params: {
  srcWidth: number;
  srcHeight: number;
  targetAspect: number;
  subject?: SubjectBox | null;
}): CropCoords {
  const { srcWidth, srcHeight, targetAspect } = params;
  if (!(srcWidth > 0) || !(srcHeight > 0) || !(targetAspect > 0)) {
    return { crop_x: 0, crop_y: 0, crop_width: srcWidth, crop_height: srcHeight };
  }
  const srcAspect = srcWidth / srcHeight;

  let cropW: number;
  let cropH: number;
  if (srcAspect > targetAspect) {
    // Source wider than target — trim width.
    cropH = srcHeight;
    cropW = Math.round(cropH * targetAspect);
  } else if (srcAspect < targetAspect) {
    // Source taller than target — trim height.
    cropW = srcWidth;
    cropH = Math.round(cropW / targetAspect);
  } else {
    // Already matches.
    cropW = srcWidth;
    cropH = srcHeight;
  }

  // Subject center in source pixels.
  let centerX = srcWidth / 2;
  let centerY = srcHeight / 2;
  if (params.subject) {
    centerX = (params.subject.x + params.subject.width / 2) * srcWidth;
    centerY = (params.subject.y + params.subject.height / 2) * srcHeight;
  }

  let x = Math.round(centerX - cropW / 2);
  let y = Math.round(centerY - cropH / 2);
  // Clamp into source.
  x = Math.max(0, Math.min(srcWidth - cropW, x));
  y = Math.max(0, Math.min(srcHeight - cropH, y));

  return { crop_x: x, crop_y: y, crop_width: cropW, crop_height: cropH };
}

/**
 * One-shot helper: fetch image → detect subject → compute crop. Returns both
 * the crop coords and the raw subject box when available so the caller can
 * debug or overlay.
 */
export async function smartCrop(params: {
  imageUrl: string;
  srcWidth: number;
  srcHeight: number;
  targetAspect: number;
}): Promise<{ coords: CropCoords; subject: SubjectBox | null }> {
  const subject = await detectSubjectBox(params.imageUrl);
  const coords = computeCrop({
    srcWidth: params.srcWidth,
    srcHeight: params.srcHeight,
    targetAspect: params.targetAspect,
    subject,
  });
  return { coords, subject };
}
