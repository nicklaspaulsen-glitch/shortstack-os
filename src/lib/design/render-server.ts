/**
 * Design Studio — server-side rasterizer.
 *
 * Converts a DesignDoc page into PNG/JPG/WebP bytes using Satori (HTML→SVG)
 * + sharp (SVG→raster). This keeps the editor DOM-only (zero canvas tax) and
 * uses the same layout model for export.
 *
 * Satori is optional — if not installed we fall back to a stub that returns
 * a 1x1 transparent PNG so the route doesn't hard-crash in dev.
 */

import type { DesignDoc, ExportFormat, Layer, Page } from "./types";
import { resolveAndCheckUrl } from "@/lib/security/ssrf";
import fs from "node:fs";
import path from "node:path";

// ── Image URL allowlist for SSRF protection ───────────────────────────────────
// Only https:// URLs from these hosts are passed to Satori (which fetches them
// server-side). A malicious PATCH could set layer.src to the cloud metadata
// endpoint or internal services — this guard closes that vector.

const ALLOWED_IMAGE_HOSTS: Array<string | RegExp> = [
  "cdn.shortstack.cloud",
  /^.*\.r2\.cloudflarestorage\.com$/,
  // OpenAI / DALL-E generated images
  "oaidalleapiprodscus.blob.core.windows.net",
];

// Supabase storage host is dynamic — derive from env at call time.
function getSupabaseStorageHost(): string | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!url) return null;
  try {
    return new URL(url).hostname;
  } catch {
    return null;
  }
}

/**
 * Returns true if the hostname is in the image allowlist.
 * This is a fast sync check — the DNS-resolving SSRF guard runs separately.
 */
function isHostAllowed(hostname: string): boolean {
  const host = hostname.toLowerCase();

  for (const allowed of ALLOWED_IMAGE_HOSTS) {
    if (typeof allowed === "string") {
      if (host === allowed) return true;
    } else {
      if (allowed.test(host)) return true;
    }
  }

  const supabaseHost = getSupabaseStorageHost();
  if (supabaseHost && host === supabaseHost.toLowerCase()) return true;

  return false;
}

/**
 * Returns true if the URL passes both the hostname allowlist AND
 * the async DNS-resolving SSRF guard (Layer 1 + Layer 2).
 */
async function isAllowedImageUrlAsync(src: string): Promise<boolean> {
  // data: URIs are always safe (no server-side fetch of external resources)
  if (src.startsWith("data:")) return true;

  let parsed: URL;
  try {
    parsed = new URL(src);
  } catch {
    return false;
  }

  // Hostname must be in the allowlist
  if (!isHostAllowed(parsed.hostname)) return false;

  // Layer 1 (string-based) + Layer 2 (DNS resolution) SSRF check
  const ssrfError = await resolveAndCheckUrl(src);
  if (ssrfError !== null) return false;

  return true;
}

/**
 * Walk the layer tree, collect all image src URLs, and run the async
 * SSRF check (Layer 1 + Layer 2 DNS resolution) on each in parallel.
 * Returns a Set of URLs that are BLOCKED — the sync render path checks
 * membership with O(1) lookup instead of doing async work.
 */
async function preValidateImageUrls(layers: Layer[]): Promise<Set<string>> {
  const blocked = new Set<string>();

  // Collect all image URLs from the layer tree
  const imageEntries: Array<{ layerId: string; src: string }> = [];
  for (const layer of layers) {
    if (layer.kind === "image" && layer.src) {
      imageEntries.push({ layerId: layer.id, src: layer.src });
    }
  }

  if (imageEntries.length === 0) return blocked;

  // Validate all URLs in parallel (DNS resolution + SSRF check)
  const results = await Promise.allSettled(
    imageEntries.map(async ({ layerId, src }) => {
      const allowed = await isAllowedImageUrlAsync(src);
      if (!allowed) {
        console.warn(
          "[design-studio/render] blocked disallowed image src for layer",
          layerId,
        );
        blocked.add(src);
      }
    }),
  );

  // Log any unexpected errors during validation (shouldn't happen, but
  // defensive — a failing check blocks the URL rather than allowing it)
  for (let i = 0; i < results.length; i++) {
    const result = results[i];
    if (result.status === "rejected") {
      const entry = imageEntries[i];
      console.warn(
        `[design-studio/render] image validation failed for layer ${entry.layerId}:`,
        result.reason instanceof Error ? result.reason.message : String(result.reason),
      );
      blocked.add(entry.src);
    }
  }

  return blocked;
}

/** 1×1 transparent PNG data URL used as a placeholder for blocked/invalid src */
const PLACEHOLDER_SRC =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==";

// ── Font loading for Satori ─────────────────────────────
// Satori needs at least one font to render text — passing fonts: [] produces
// garbled glyphs or crashes on text-heavy designs. We bundle Inter (regular +
// bold) under public/fonts and lazy-load on first call. Buffer is cached on
// the module so subsequent renders reuse the read.
//
// If the font files are missing (e.g. someone trims public/fonts) we fall back
// to an empty fonts array and log a clear warning rather than crash the route.

type SatoriFont = {
  name: string;
  data: Buffer;
  weight: 100 | 200 | 300 | 400 | 500 | 600 | 700 | 800 | 900;
  style: "normal" | "italic";
};

let cachedFonts: SatoriFont[] | null = null;

function loadFonts(): SatoriFont[] {
  if (cachedFonts !== null) return cachedFonts;

  const fontsDir = path.join(process.cwd(), "public", "fonts");
  const candidates: Array<{ file: string; weight: SatoriFont["weight"] }> = [
    { file: "Inter-Regular.ttf", weight: 400 },
    { file: "Inter-Bold.ttf", weight: 700 },
  ];

  const loaded: SatoriFont[] = [];
  for (const { file, weight } of candidates) {
    const fontPath = path.join(fontsDir, file);
    try {
      const data = fs.readFileSync(fontPath);
      loaded.push({ name: "Inter", data, weight, style: "normal" });
    } catch (err) {
      console.warn(
        `[design-studio/render] missing font ${file} at ${fontPath} —`,
        err instanceof Error ? err.message : String(err),
      );
    }
  }

  if (loaded.length === 0) {
    console.warn(
      "[design-studio/render] no fonts available — Satori will render with empty fonts list, expect garbled text",
    );
  }

  cachedFonts = loaded;
  return loaded;
}

export interface RenderOptions {
  pageIndex?: number;
  format?: ExportFormat;
  quality?: number; // 1-100 for jpg/webp
}

/**
 * Render a DesignDoc page to a Buffer (PNG/JPG/WebP).
 * Throws on render failure so the API route can return 500.
 */
export async function renderDesign(
  doc: DesignDoc,
  width: number,
  height: number,
  opts: RenderOptions = {},
): Promise<Buffer> {
  const pageIndex = opts.pageIndex ?? doc.activePageIndex ?? 0;
  const format = opts.format ?? "png";
  const quality = opts.quality ?? 90;

  const page = doc.pages[pageIndex];
  if (!page) throw new Error(`Page index ${pageIndex} not found in doc`);

  // Pre-validate all image URLs with async DNS-resolving SSRF guard
  // (Layer 1 + Layer 2) BEFORE entering the sync Satori render path.
  // The returned set is checked synchronously during element building.
  const visibleLayers = page.layerIds
    .map((id) => page.layers[id])
    .filter(Boolean)
    .filter((l) => !l.hidden);
  const blockedUrls = await preValidateImageUrls(visibleLayers);

  // Build the HTML element tree for Satori
  const html = buildPageHtml(page, width, height, blockedUrls);

  let pngBuffer: Buffer;

  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const satori = (await import("satori")).default;
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const sharp = (await import("sharp")).default;

    // Satori needs font data — empty fonts array produces garbled glyphs or
    // crashes on text-heavy designs. Load Inter regular + bold from
    // public/fonts (cached after first call).
    const fonts = loadFonts();
    const svg = await satori(html as Parameters<typeof satori>[0], {
      width,
      height,
      fonts: fonts as Parameters<typeof satori>[1]["fonts"],
    });

    const sharpInst = sharp(Buffer.from(svg));
    if (format === "jpg") {
      pngBuffer = await sharpInst.jpeg({ quality }).toBuffer();
    } else if (format === "webp") {
      pngBuffer = await sharpInst.webp({ quality }).toBuffer();
    } else {
      pngBuffer = await sharpInst.png().toBuffer();
    }
  } catch (err) {
    console.error("[design-studio/render] satori failed:", err);
    if (process.env.NODE_ENV === "production") {
      // In production, surface the failure so the API returns 500
      throw err;
    }
    // Dev fallback: 1x1 transparent PNG — signals missing deps without crashing
    pngBuffer = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==",
      "base64",
    );
  }

  return pngBuffer;
}

// ── HTML builder for Satori ───────────────────────────────────────────────────

type SatoriElement = {
  type: string;
  props: {
    style?: Record<string, string | number>;
    children?: SatoriElement | SatoriElement[] | string;
    src?: string;
    tw?: string;
  };
};

function buildPageHtml(page: Page, width: number, height: number, blockedUrls: Set<string>): SatoriElement {
  const orderedLayers = page.layerIds
    .map((id) => page.layers[id])
    .filter(Boolean)
    .filter((l) => !l.hidden);

  const children: SatoriElement[] = orderedLayers.map((l) =>
    buildLayerElement(l, blockedUrls),
  );

  return {
    type: "div",
    props: {
      style: {
        position: "relative",
        width: `${width}px`,
        height: `${height}px`,
        backgroundColor: page.backgroundColor,
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
      },
      children,
    },
  };
}

function buildLayerElement(layer: Layer, blockedUrls: Set<string>): SatoriElement {
  const baseStyle: Record<string, string | number> = {
    position: "absolute",
    left: `${layer.x}px`,
    top: `${layer.y}px`,
    width: `${layer.width}px`,
    height: `${layer.height}px`,
    opacity: layer.opacity,
    transform: layer.rotation ? `rotate(${layer.rotation}deg)` : "none",
    overflow: "hidden",
  };

  if (layer.kind === "text") {
    return {
      type: "div",
      props: {
        style: {
          ...baseStyle,
          fontFamily: layer.fontFamily,
          fontSize: `${layer.fontSize}px`,
          fontWeight: layer.fontWeight,
          fontStyle: layer.fontStyle,
          color: layer.color,
          textAlign: layer.textAlign,
          lineHeight: layer.lineHeight,
          letterSpacing: `${layer.letterSpacing}px`,
          textDecoration: layer.textDecoration,
          backgroundColor: layer.backgroundColor ?? "transparent",
          padding: `${layer.padding}px`,
          borderRadius: `${layer.borderRadius}px`,
          whiteSpace: "pre-wrap",
          display: "flex",
          alignItems: "center",
        },
        children: layer.content,
      },
    };
  }

  if (layer.kind === "image") {
    // SSRF: layer.src was pre-validated by preValidateImageUrls() with async
    // DNS resolution (Layer 1 + 2). Blocked URLs are in the set — check is O(1).
    const safeSrc = layer.src && !blockedUrls.has(layer.src)
      ? layer.src
      : PLACEHOLDER_SRC;

    return {
      type: "img",
      props: {
        src: safeSrc,
        style: {
          ...baseStyle,
          objectFit: layer.objectFit,
          borderRadius: `${layer.borderRadius}px`,
          transform: `${baseStyle.transform} ${layer.flipX ? "scaleX(-1)" : ""} ${layer.flipY ? "scaleY(-1)" : ""}`.trim(),
        },
      },
    };
  }

  if (layer.kind === "shape") {
    const shapeStyle: Record<string, string | number> = {
      ...baseStyle,
      backgroundColor: layer.fill,
      border: layer.strokeWidth > 0 ? `${layer.strokeWidth}px solid ${layer.stroke}` : "none",
      borderRadius:
        layer.shapeType === "ellipse"
          ? "50%"
          : `${layer.borderRadius}px`,
    };

    if (layer.shapeType === "triangle") {
      // CSS triangle via clip-path
      shapeStyle.clipPath = "polygon(50% 0%, 0% 100%, 100% 100%)";
    }

    return {
      type: "div",
      props: { style: shapeStyle },
    };
  }

  // group — render as transparent container
  return {
    type: "div",
    props: { style: baseStyle },
  };
}
