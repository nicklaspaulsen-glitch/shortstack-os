import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase, createServiceClient } from "@/lib/supabase/server";
import { getEffectiveOwnerId } from "@/lib/security/require-owned-client";
import { checkFetchUrl } from "@/lib/security/ssrf";
import { checkLimit, recordUsage } from "@/lib/usage-limits";
import {
  smartCrop,
  parseAspect,
  type CropCoords,
  type SubjectBox,
} from "@/lib/thumbnail/smart-crop";

/**
 * POST /api/thumbnail/smart-crop
 *
 * Body: { image_url: string, target_aspect: string | number }
 *
 * 1) Claude Sonnet Vision finds the subject's bounding box.
 * 2) We compute the best crop at the requested aspect ratio.
 * 3) When the `sharp` runtime is available, we also produce the cropped
 *    image as a base64 data URL so the client can preview it immediately.
 *
 * Metered with `checkLimit(ownerId, "tokens", 1)`.
 */

export const maxDuration = 60;

interface SmartCropInput {
  image_url?: unknown;
  target_aspect?: unknown;
}

async function fetchImageBytes(
  url: string,
): Promise<{ bytes: Buffer; mediaType: string } | null> {
  try {
    if (url.startsWith("data:image/")) {
      const match = url.match(/^data:(image\/[a-z]+);base64,(.+)$/i);
      if (!match) return null;
      return {
        bytes: Buffer.from(match[2], "base64"),
        mediaType: match[1],
      };
    }
    const res = await fetch(url);
    if (!res.ok) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    const ct = res.headers.get("content-type") || "image/png";
    return { bytes: buf, mediaType: ct };
  } catch {
    return null;
  }
}

async function imageSize(
  bytes: Buffer,
): Promise<{ width: number; height: number } | null> {
  try {
    // Lazy-load sharp so the route still builds when sharp isn't installed.
    const mod: unknown = await import("sharp");
    const sharp = ((mod as { default?: unknown }).default ||
      mod) as (input: Buffer) => { metadata: () => Promise<{ width?: number; height?: number }> };
    const meta = await sharp(bytes).metadata();
    if (meta.width && meta.height) return { width: meta.width, height: meta.height };
  } catch {
    /* ignore */
  }

  // Fallback: parse PNG / JPEG header manually — cheap and dependency-free.
  // PNG: signature + IHDR chunk has width/height at bytes 16-23.
  if (
    bytes.length >= 24 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47
  ) {
    const width = bytes.readUInt32BE(16);
    const height = bytes.readUInt32BE(20);
    if (width > 0 && height > 0) return { width, height };
  }
  // JPEG: scan for SOF0 (0xFFC0) and read 16-bit height/width.
  if (bytes.length >= 4 && bytes[0] === 0xff && bytes[1] === 0xd8) {
    let i = 2;
    while (i < bytes.length - 8) {
      if (bytes[i] !== 0xff) break;
      const marker = bytes[i + 1];
      if (marker === 0xc0 || marker === 0xc1 || marker === 0xc2) {
        const height = (bytes[i + 5] << 8) | bytes[i + 6];
        const width = (bytes[i + 7] << 8) | bytes[i + 8];
        if (width > 0 && height > 0) return { width, height };
      }
      const segLen = (bytes[i + 2] << 8) | bytes[i + 3];
      if (segLen <= 0) break;
      i += 2 + segLen;
    }
  }
  return null;
}

async function performSharpCrop(
  bytes: Buffer,
  coords: CropCoords,
): Promise<{ data: Buffer; mediaType: string } | null> {
  try {
    const mod: unknown = await import("sharp");
    const sharpFn = ((mod as { default?: unknown }).default ||
      mod) as (input: Buffer) => {
      extract: (r: { left: number; top: number; width: number; height: number }) => {
        jpeg: (o?: { quality: number }) => { toBuffer: () => Promise<Buffer> };
      };
    };
    const out = await sharpFn(bytes)
      .extract({
        left: coords.crop_x,
        top: coords.crop_y,
        width: coords.crop_width,
        height: coords.crop_height,
      })
      .jpeg({ quality: 92 })
      .toBuffer();
    return { data: out, mediaType: "image/jpeg" };
  } catch {
    return null;
  }
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

  let body: SmartCropInput;
  try {
    body = (await request.json()) as SmartCropInput;
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON body" }, { status: 400 });
  }

  const imageUrl =
    typeof body.image_url === "string" ? body.image_url.trim() : "";
  if (!imageUrl) {
    return NextResponse.json(
      { ok: false, error: "image_url is required" },
      { status: 400 },
    );
  }

  // SSRF guard — see src/lib/security/ssrf.ts for the full block-list.
  const ssrfErr = checkFetchUrl(imageUrl);
  if (ssrfErr) {
    return NextResponse.json(
      { ok: false, error: `image_url rejected: ${ssrfErr}` },
      { status: 400 },
    );
  }

  const aspectRaw =
    typeof body.target_aspect === "string"
      ? body.target_aspect
      : typeof body.target_aspect === "number"
        ? String(body.target_aspect)
        : "";
  const targetAspect = parseAspect(aspectRaw);
  if (!targetAspect) {
    return NextResponse.json(
      { ok: false, error: "target_aspect is required (e.g. '16:9', '9:16', '1:1')" },
      { status: 400 },
    );
  }

  const img = await fetchImageBytes(imageUrl);
  if (!img) {
    return NextResponse.json(
      { ok: false, error: "Could not fetch image_url" },
      { status: 502 },
    );
  }
  const size = await imageSize(img.bytes);
  if (!size) {
    return NextResponse.json(
      { ok: false, error: "Could not read image dimensions" },
      { status: 502 },
    );
  }

  let subject: SubjectBox | null = null;
  let coords: CropCoords;
  try {
    const result = await smartCrop({
      imageUrl,
      srcWidth: size.width,
      srcHeight: size.height,
      targetAspect,
    });
    subject = result.subject;
    coords = result.coords;
  } catch (err) {
    // Hard fallback — center crop. The app still gets usable coords.
    const srcAspect = size.width / size.height;
    const cropW =
      srcAspect > targetAspect ? Math.round(size.height * targetAspect) : size.width;
    const cropH =
      srcAspect > targetAspect ? size.height : Math.round(size.width / targetAspect);
    coords = {
      crop_x: Math.round((size.width - cropW) / 2),
      crop_y: Math.round((size.height - cropH) / 2),
      crop_width: cropW,
      crop_height: cropH,
    };
    console.error("[smart-crop] detection failed, falling back", err);
  }

  // Optional: produce a cropped preview with sharp.
  let croppedImageUrl: string | null = null;
  const crop = await performSharpCrop(img.bytes, coords);
  if (crop) {
    croppedImageUrl = `data:${crop.mediaType};base64,${crop.data.toString("base64")}`;
  }

  void recordUsage(ownerId, "tokens", 800, {
    source: "thumbnail_smart_crop",
    aspect: aspectRaw,
  });

  try {
    const service = createServiceClient();
    void service.from("trinity_log").insert({
      action_type: "thumbnail_smart_crop",
      description: `Smart-cropped image to ${aspectRaw}`,
      profile_id: user.id,
      status: "completed",
      result: {
        target_aspect: aspectRaw,
        src_width: size.width,
        src_height: size.height,
        coords,
        subject,
      },
    });
  } catch {
    /* ignore */
  }

  return NextResponse.json({
    ok: true,
    src_width: size.width,
    src_height: size.height,
    target_aspect: targetAspect,
    crop_x: coords.crop_x,
    crop_y: coords.crop_y,
    crop_width: coords.crop_width,
    crop_height: coords.crop_height,
    subject,
    cropped_image_url: croppedImageUrl,
  });
}
