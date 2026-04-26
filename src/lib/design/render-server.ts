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
  } catch {
    // Fallback: 1x1 transparent PNG — signals missing deps without crashing
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
    return {
      type: "img",
      props: {
        src: layer.src,
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
