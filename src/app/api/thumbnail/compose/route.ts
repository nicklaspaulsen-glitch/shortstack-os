import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase, createServiceClient } from "@/lib/supabase/server";
import { checkAiRateLimit } from "@/lib/api-rate-limit";
import sharp from "sharp";
import crypto from "crypto";
import fs from "fs";
import path from "path";

/* ──────────────────── Font embedding ──────────────────── */
// Fonts live in public/fonts/. We read them once at module load, base64-encode,
// and inject as @font-face in every SVG so librsvg (used by sharp) renders
// custom fonts correctly on Vercel (where we can't install system fonts).
const FONT_FILES: Record<string, string> = {
  Impact: "Impact.ttf",
  "Bebas Neue": "BebasNeue-Bold.ttf",
  Anton: "Anton-Regular.ttf",
  Oswald: "Oswald-Bold.ttf",
  Poppins: "Poppins-Black.ttf",
  "Poppins Bold": "Poppins-Bold.ttf",
  Montserrat: "Montserrat-Bold.ttf",
  Inter: "Inter-Bold.ttf",
  Roboto: "Roboto-Black.ttf",
  Bangers: "Bangers-Regular.ttf",
  "Permanent Marker": "PermanentMarker-Regular.ttf",
  Staatliches: "Staatliches-Regular.ttf",
  "Playfair Display": "PlayfairDisplay-Black.ttf",
  "Archivo Black": "ArchivoBlack-Regular.ttf",
};

let cachedFontFaceCss: string | null = null;
function getFontFaceCss(): string {
  if (cachedFontFaceCss !== null) return cachedFontFaceCss;
  const fontsDir = path.join(process.cwd(), "public", "fonts");
  const faces: string[] = [];
  for (const [family, filename] of Object.entries(FONT_FILES)) {
    try {
      const filePath = path.join(fontsDir, filename);
      if (!fs.existsSync(filePath)) continue;
      const buf = fs.readFileSync(filePath);
      const b64 = buf.toString("base64");
      faces.push(
        `@font-face{font-family:"${family}";src:url(data:font/ttf;base64,${b64}) format("truetype");font-display:block;}`
      );
    } catch {
      // skip missing fonts silently
    }
  }
  cachedFontFaceCss = faces.join("");
  return cachedFontFaceCss;
}

/* ──────────────────── Types (mirror src/app/dashboard/thumbnail-generator/page.tsx) ──────────────────── */

interface ThumbnailTypography {
  enabled?: boolean;
  fontId?: string;
  fontFamily?: string; // optional override
  fontSize?: number;
  weight?: number;
  italic?: boolean;
  textCase?: "uppercase" | "lowercase" | "titlecase" | "astyped";
  color?: string;
  strokeEnabled?: boolean;
  strokeWidth?: number;
  strokeColor?: string;
  shadowEnabled?: boolean;
  shadowX?: number;
  shadowY?: number;
  shadowBlur?: number;
  shadowColor?: string;
  gradientEnabled?: boolean;
  gradientFrom?: string;
  gradientTo?: string;
  letterSpacing?: number;
  textAlign?: "left" | "center" | "right";
  highlightWords?: string;
  highlightColor?: string;
}

interface ThumbnailFace {
  position?: "left" | "center" | "right";
}

interface ThumbnailBackground {
  mode?: "solid" | "gradient" | "pattern" | "image" | "ai";
  solidColor?: string;
  brightness?: number;
  blurEnabled?: boolean;
  blurAmount?: number;
}

interface ThumbnailElement {
  id: string;
  emoji: string;
  name?: string;
  x?: number; // 0..1
  y?: number; // 0..1
  size?: number;
}

interface ThumbnailConfigInput {
  title?: string;
  text?: string; // alias for title
  size?: { width?: number; height?: number };
  typography?: ThumbnailTypography;
  face?: ThumbnailFace;
  background?: ThumbnailBackground;
  colors?: { paletteId?: string | null };
  elements?: { active?: ThumbnailElement[] } | ThumbnailElement[];
  export?: { format?: "png" | "jpg" | "webp"; quality?: number };
}

interface ComposeInput {
  config: ThumbnailConfigInput;
  background_image_url?: string;
  background_image_base64?: string;
  face_image_url?: string;
}

interface ComposeOutput {
  thumbnail_url: string;
  width: number;
  height: number;
}

/* ──────────────────── helpers ──────────────────── */

const FONT_ID_TO_FAMILY: Record<string, string> = {
  impact: "Impact, 'Arial Black', sans-serif",
  anton: "Anton, Impact, sans-serif",
  bebas: "'Bebas Neue', Impact, sans-serif",
  bebas_neue: "'Bebas Neue', Impact, sans-serif",
  inter: "Inter, 'Helvetica Neue', Arial, sans-serif",
  poppins: "Poppins, 'Helvetica Neue', Arial, sans-serif",
  montserrat: "Montserrat, 'Helvetica Neue', Arial, sans-serif",
  oswald: "Oswald, Impact, sans-serif",
  bangers: "Bangers, Impact, sans-serif",
  roboto: "Roboto, 'Helvetica Neue', Arial, sans-serif",
  staatliches: "Staatliches, Impact, sans-serif",
  permanent_marker: "'Permanent Marker', cursive",
  playfair: "'Playfair Display', Georgia, serif",
  archivo_black: "'Archivo Black', Impact, sans-serif",
};

function resolveFontFamily(config: ThumbnailConfigInput): string {
  const t = config.typography;
  if (t?.fontFamily) return t.fontFamily;
  if (t?.fontId && FONT_ID_TO_FAMILY[t.fontId]) return FONT_ID_TO_FAMILY[t.fontId];
  return "'Arial Black', Impact, sans-serif";
}

function applyTextCase(text: string, mode: ThumbnailTypography["textCase"]): string {
  switch (mode) {
    case "uppercase":
      return text.toUpperCase();
    case "lowercase":
      return text.toLowerCase();
    case "titlecase":
      return text.replace(/\w\S*/g, (t) => t.charAt(0).toUpperCase() + t.slice(1).toLowerCase());
    default:
      return text;
  }
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function normalizeColor(c: string | undefined, fallback: string): string {
  if (!c || typeof c !== "string") return fallback;
  return c;
}

async function loadBackground(
  background_image_url: string | undefined,
  background_image_base64: string | undefined,
  backgroundCfg: ThumbnailBackground | undefined,
  width: number,
  height: number
): Promise<Buffer> {
  // 1. explicit image provided (base64 or url)
  if (background_image_base64) {
    const m = background_image_base64.match(
      /^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/
    );
    const data = m ? m[2] : background_image_base64;
    return Buffer.from(data, "base64");
  }
  if (background_image_url) {
    const res = await fetch(background_image_url);
    if (!res.ok) throw new Error(`Failed to fetch background (${res.status})`);
    return Buffer.from(await res.arrayBuffer());
  }

  // 2. derive a solid color background from config
  const color = normalizeColor(backgroundCfg?.solidColor, "#0F172A");
  return sharp({
    create: {
      width,
      height,
      channels: 3,
      background: color,
    },
  })
    .png()
    .toBuffer();
}

function buildTextSvg(config: ThumbnailConfigInput, width: number, height: number): string {
  const title = config.title ?? config.text ?? "";
  if (!title) return "";

  const t = config.typography ?? {};
  const fontFamily = resolveFontFamily(config);
  const weight = t.weight ?? 900;
  const italic = t.italic ? "italic" : "normal";
  const color = normalizeColor(t.color, "#FFFFFF");
  const align = t.textAlign ?? "center";
  const letterSpacing = t.letterSpacing ?? 0;
  const textCased = applyTextCase(title, t.textCase);

  // Rough auto-size: fill ~70% of canvas width. Approximate 0.58 px per char @ weight 900.
  const fontSize =
    t.fontSize ??
    Math.max(32, Math.min(Math.floor(height * 0.18), Math.floor((width * 0.9) / Math.max(1, textCased.length * 0.58))));

  // Position: anchor near bottom-center for classic YT thumbnails, unless align says otherwise
  const anchorX = align === "left" ? Math.floor(width * 0.06) : align === "right" ? Math.floor(width * 0.94) : Math.floor(width / 2);
  const anchorY = Math.floor(height * 0.75);
  const textAnchor = align === "left" ? "start" : align === "right" ? "end" : "middle";

  // Stroke
  const strokeEnabled = t.strokeEnabled ?? false;
  const strokeWidth = t.strokeWidth ?? 4;
  const strokeColor = normalizeColor(t.strokeColor, "#000000");

  // Shadow (via SVG filter)
  const shadowEnabled = t.shadowEnabled ?? false;
  const shadowX = t.shadowX ?? 2;
  const shadowY = t.shadowY ?? 2;
  const shadowBlur = t.shadowBlur ?? 4;
  const shadowColor = normalizeColor(t.shadowColor, "#000000");

  // Gradient fill
  const gradientEnabled = t.gradientEnabled ?? false;
  const gradientFrom = normalizeColor(t.gradientFrom, "#F59E0B");
  const gradientTo = normalizeColor(t.gradientTo, "#DC2626");

  const fillAttr = gradientEnabled ? "url(#titleGradient)" : color;
  const paintOrder = strokeEnabled ? 'paint-order="stroke fill"' : "";
  const filterAttr = shadowEnabled ? 'filter="url(#titleShadow)"' : "";

  const fontFaceCss = getFontFaceCss();
  const defs = `
    <defs>
      ${fontFaceCss ? `<style type="text/css"><![CDATA[${fontFaceCss}]]></style>` : ""}
      ${
        gradientEnabled
          ? `<linearGradient id="titleGradient" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stop-color="${escapeXml(gradientFrom)}"/>
              <stop offset="100%" stop-color="${escapeXml(gradientTo)}"/>
            </linearGradient>`
          : ""
      }
      ${
        shadowEnabled
          ? `<filter id="titleShadow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur in="SourceAlpha" stdDeviation="${Math.max(0, shadowBlur / 2)}"/>
              <feOffset dx="${shadowX}" dy="${shadowY}" result="offsetblur"/>
              <feFlood flood-color="${escapeXml(shadowColor)}"/>
              <feComposite in2="offsetblur" operator="in"/>
              <feMerge>
                <feMergeNode/>
                <feMergeNode in="SourceGraphic"/>
              </feMerge>
            </filter>`
          : ""
      }
    </defs>
  `;

  const strokeAttrs = strokeEnabled
    ? `stroke="${escapeXml(strokeColor)}" stroke-width="${strokeWidth}" stroke-linejoin="round"`
    : "";

  const textEl = `<text
    x="${anchorX}"
    y="${anchorY}"
    text-anchor="${textAnchor}"
    font-family="${escapeXml(fontFamily)}"
    font-size="${fontSize}"
    font-weight="${weight}"
    font-style="${italic}"
    letter-spacing="${letterSpacing}"
    fill="${fillAttr}"
    ${strokeAttrs}
    ${paintOrder}
    ${filterAttr}
  >${escapeXml(textCased)}</text>`;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
    ${defs}
    ${textEl}
  </svg>`;
}

function buildElementsSvg(
  config: ThumbnailConfigInput,
  width: number,
  height: number
): string {
  const elementsRaw = Array.isArray(config.elements)
    ? config.elements
    : config.elements?.active ?? [];

  if (!elementsRaw.length) return "";

  const parts = elementsRaw
    .map((el, idx) => {
      if (!el || !el.emoji) return "";
      // default scattered placement if no x/y provided
      const x = Math.floor((el.x ?? ((idx + 1) / (elementsRaw.length + 1))) * width);
      const y = Math.floor((el.y ?? 0.15) * height);
      const size = el.size ?? Math.floor(height * 0.12);
      return `<text x="${x}" y="${y}" font-size="${size}" text-anchor="middle" dominant-baseline="central">${escapeXml(
        el.emoji
      )}</text>`;
    })
    .filter(Boolean)
    .join("\n");

  if (!parts) return "";
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">${parts}</svg>`;
}

function computeFacePosition(
  position: ThumbnailFace["position"] | undefined,
  canvasWidth: number,
  canvasHeight: number,
  faceWidth: number,
  faceHeight: number
): { left: number; top: number } {
  const top = canvasHeight - faceHeight; // anchor to bottom
  let left = 0;
  if (position === "center") left = Math.floor((canvasWidth - faceWidth) / 2);
  else if (position === "right") left = canvasWidth - faceWidth;
  else left = 0; // left default
  return { left: Math.max(0, left), top: Math.max(0, top) };
}

async function ensureBucket(
  service: ReturnType<typeof createServiceClient>,
  bucket: string
): Promise<void> {
  const { data: existing } = await service.storage.getBucket(bucket);
  if (existing) return;
  await service.storage.createBucket(bucket, { public: false });
}

/* ──────────────────── route handler ──────────────────── */

export async function POST(request: NextRequest) {
  const authSupabase = createServerSupabase();
  const {
    data: { user },
  } = await authSupabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: profile } = await authSupabase
    .from("profiles")
    .select("plan_tier")
    .eq("id", user.id)
    .single();
  const limited = checkAiRateLimit(user.id, profile?.plan_tier);
  if (limited) return limited;

  let body: ComposeInput;
  try {
    body = (await request.json()) as ComposeInput;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body.config || typeof body.config !== "object") {
    return NextResponse.json({ error: "config is required" }, { status: 400 });
  }

  const width = Math.max(64, Math.min(3840, body.config.size?.width ?? 1280));
  const height = Math.max(64, Math.min(3840, body.config.size?.height ?? 720));

  try {
    // 1. Background
    const bgRaw = await loadBackground(
      body.background_image_url,
      body.background_image_base64,
      body.config.background,
      width,
      height
    );

    let base = sharp(bgRaw, { failOn: "none" }).resize(width, height, { fit: "cover" });
    const brightness = body.config.background?.brightness;
    if (typeof brightness === "number" && brightness !== 100) {
      base = base.modulate({ brightness: Math.max(0.1, brightness / 100) });
    }
    if (body.config.background?.blurEnabled && (body.config.background.blurAmount ?? 0) > 0) {
      base = base.blur(Math.min(40, body.config.background.blurAmount!));
    }

    // Composite layers
    const composites: sharp.OverlayOptions[] = [];

    // 2. Face image (optional)
    if (body.face_image_url) {
      try {
        const faceRes = await fetch(body.face_image_url);
        if (faceRes.ok) {
          const faceBuf = Buffer.from(await faceRes.arrayBuffer());
          const faceHeight = Math.floor(height * 0.85);
          const facePng = await sharp(faceBuf, { failOn: "none" })
            .resize({ height: faceHeight, fit: "inside" })
            .png()
            .toBuffer();
          const faceMeta = await sharp(facePng).metadata();
          const { left, top } = computeFacePosition(
            body.config.face?.position,
            width,
            height,
            faceMeta.width ?? faceHeight,
            faceMeta.height ?? faceHeight
          );
          composites.push({ input: facePng, left, top });
        }
      } catch (e) {
        console.warn("[thumbnail/compose] face image failed", e);
      }
    }

    // 3. Title text overlay
    const titleSvg = buildTextSvg(body.config, width, height);
    if (titleSvg) {
      composites.push({ input: Buffer.from(titleSvg), left: 0, top: 0 });
    }

    // 4. Elements / stickers
    const elementsSvg = buildElementsSvg(body.config, width, height);
    if (elementsSvg) {
      composites.push({ input: Buffer.from(elementsSvg), left: 0, top: 0 });
    }

    if (composites.length > 0) base = base.composite(composites);

    // 5. Output format
    const format = body.config.export?.format ?? "png";
    const quality = Math.max(1, Math.min(100, body.config.export?.quality ?? 92));
    let outBuf: Buffer;
    let contentType: string;
    let ext: string;
    if (format === "jpg") {
      outBuf = await base.jpeg({ quality }).toBuffer();
      contentType = "image/jpeg";
      ext = "jpg";
    } else if (format === "webp") {
      outBuf = await base.webp({ quality }).toBuffer();
      contentType = "image/webp";
      ext = "webp";
    } else {
      outBuf = await base.png({ quality }).toBuffer();
      contentType = "image/png";
      ext = "png";
    }

    // 6. Upload to Supabase Storage
    const service = createServiceClient();
    const bucket = "generated-thumbnails";
    try {
      await ensureBucket(service, bucket);
    } catch (e) {
      console.warn("[thumbnail/compose] ensureBucket warning (continuing)", e);
    }

    const filename = `${user.id}/${Date.now()}-${crypto.randomBytes(6).toString("hex")}.${ext}`;
    const { error: uploadErr } = await service.storage
      .from(bucket)
      .upload(filename, outBuf, {
        contentType,
        upsert: false,
      });
    if (uploadErr) {
      throw new Error(`Storage upload failed: ${uploadErr.message}`);
    }

    // 24h signed URL
    const { data: signed, error: signErr } = await service.storage
      .from(bucket)
      .createSignedUrl(filename, 60 * 60 * 24);
    if (signErr || !signed?.signedUrl) {
      throw new Error(`Signed URL failed: ${signErr?.message ?? "unknown"}`);
    }

    void service.from("trinity_log").insert({
      action_type: "ai_thumbnail_compose",
      description: `Composed thumbnail ${width}x${height} ${format}`,
      profile_id: user.id,
      status: "completed",
      result: {
        width,
        height,
        format,
        size_bytes: outBuf.length,
        generated_at: new Date().toISOString(),
      },
    });

    const out: ComposeOutput = {
      thumbnail_url: signed.signedUrl,
      width,
      height,
    };
    return NextResponse.json(out);
  } catch (err) {
    console.error("[thumbnail/compose] error", err);
    const message = err instanceof Error ? err.message : "Unknown compose error";
    return NextResponse.json(
      { error: "Failed to compose thumbnail", detail: message },
      { status: 500 }
    );
  }
}
