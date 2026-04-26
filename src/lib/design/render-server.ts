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
import { checkFetchUrl } from "@/lib/security/ssrf";

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
 * Returns true if the URL is safe to pass to Satori for server-side fetching.
 * Requires https://, no private IPs, and hostname in the allowlist.
 */
function isAllowedImageUrl(src: string): boolean {
  // First run the generic SSRF check (blocks private IPs, metadata endpoints, etc.)
  const ssrfError = checkFetchUrl(src);
  if (ssrfError !== null) return false;

  let parsed: URL;
  try {
    parsed = new URL(src);
  } catch {
    return false;
  }

  const host = parsed.hostname.toLowerCase();

  // Check static allowlist
  for (const allowed of ALLOWED_IMAGE_HOSTS) {
    if (typeof allowed === "string") {
      if (host === allowed) return true;
    } else {
      if (allowed.test(host)) return true;
    }
  }

  // Check dynamic Supabase storage host
  const supabaseHost = getSupabaseStorageHost();
  if (supabaseHost && host === supabaseHost.toLowerCase()) return true;

  return false;
}

/** 1×1 transparent PNG data URL used as a placeholder for blocked/invalid src */
const PLACEHOLDER_SRC =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==";

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

  // Build the HTML element tree for Satori
  const html = buildPageHtml(page, width, height);

  let pngBuffer: Buffer;

  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const satori = (await import("satori")).default;
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const sharp = (await import("sharp")).default;

    // Satori needs font data — embed a minimal subset or use a CDN font.
    // For MVP we inline the system sans-serif fallback.
    const svg = await satori(html as Parameters<typeof satori>[0], {
      width,
      height,
      fonts: [],
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

function buildPageHtml(page: Page, width: number, height: number): SatoriElement {
  const orderedLayers = page.layerIds
    .map((id) => page.layers[id])
    .filter(Boolean)
    .filter((l) => !l.hidden);

  const children: SatoriElement[] = orderedLayers.map((l) =>
    buildLayerElement(l),
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

function buildLayerElement(layer: Layer): SatoriElement {
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
    // SSRF: validate layer.src before Satori fetches it server-side.
    // Bad URLs are replaced with a transparent 1×1 placeholder so we never
    // expose the render server to internal network endpoints.
    const safeSrc = layer.src && isAllowedImageUrl(layer.src)
      ? layer.src
      : (() => {
          console.warn(
            "[design-studio/render] blocked disallowed image src for layer",
            layer.id,
          );
          return PLACEHOLDER_SRC;
        })();

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
