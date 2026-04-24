// Export helpers. PNG/JPG/WebP are produced from the canvas renderer; SVG
// is composed only from text + shape layers (raster layers fall back to
// base64-embedded <image> so the file still works when loaded in Photopea
// or Figma).

import type {
  EditorState,
  Layer,
  TextLayer,
  ShapeLayer,
  ImageLayer,
} from "./types";

export type ExportFormat = "png" | "jpg" | "webp" | "svg";

export interface ExportOptions {
  format: ExportFormat;
  quality?: number; // 0..1 for jpg/webp
  filename?: string;
}

export async function exportCanvas(
  canvas: HTMLCanvasElement,
  opts: ExportOptions,
): Promise<Blob | null> {
  const { format, quality } = opts;
  if (format === "svg") return null; // svg goes through exportSVG
  const mime =
    format === "png"
      ? "image/png"
      : format === "jpg"
        ? "image/jpeg"
        : "image/webp";
  return await new Promise<Blob | null>((resolve) => {
    canvas.toBlob((b) => resolve(b), mime, quality ?? 0.92);
  });
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 0);
}

export function exportSVG(state: EditorState): string {
  const { canvasWidth, canvasHeight, background, layers } = state;
  const bg =
    background && background !== "transparent"
      ? `<rect width="${canvasWidth}" height="${canvasHeight}" fill="${escapeAttr(background)}"/>`
      : "";
  // Layers are top-first in state; SVG draws bottom-to-top so we reverse
  const svgLayers = [...layers]
    .reverse()
    .map((l) => layerToSVG(l))
    .filter(Boolean)
    .join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${canvasWidth}" height="${canvasHeight}" viewBox="0 0 ${canvasWidth} ${canvasHeight}">
${bg}
${svgLayers}
</svg>`;
}

function layerToSVG(layer: Layer): string {
  if (!layer.visible) return "";
  const transform =
    layer.rotation !== 0
      ? ` transform="rotate(${layer.rotation} ${layer.x + layer.width / 2} ${layer.y + layer.height / 2})"`
      : "";
  const opacity = (layer.opacity / 100).toFixed(3);
  const styleAttr = ` style="mix-blend-mode:${layer.blendMode};opacity:${opacity}"`;
  switch (layer.type) {
    case "text": {
      const l = layer as TextLayer;
      const anchorX =
        l.align === "center"
          ? l.x + l.width / 2
          : l.align === "right"
            ? l.x + l.width
            : l.x;
      const anchor =
        l.align === "center" ? "middle" : l.align === "right" ? "end" : "start";
      const stroke =
        l.strokeColor && (l.strokeWidth ?? 0) > 0
          ? ` stroke="${escapeAttr(l.strokeColor)}" stroke-width="${l.strokeWidth}"`
          : "";
      const italic = l.italic ? ' font-style="italic"' : "";
      const lines = l.text.split("\n");
      const tspans = lines
        .map(
          (line, i) =>
            `<tspan x="${anchorX}" dy="${i === 0 ? 0 : l.fontSize * l.lineHeight}">${escapeText(line)}</tspan>`,
        )
        .join("");
      return `<text x="${anchorX}" y="${l.y + l.fontSize}" font-family="${escapeAttr(l.fontFamily)}" font-size="${l.fontSize}" font-weight="${l.fontWeight}"${italic} fill="${escapeAttr(l.color)}"${stroke} text-anchor="${anchor}"${transform}${styleAttr}>${tspans}</text>`;
    }
    case "shape": {
      const l = layer as ShapeLayer;
      const stroke =
        l.stroke && (l.strokeWidth ?? 0) > 0
          ? ` stroke="${escapeAttr(l.stroke)}" stroke-width="${l.strokeWidth}"`
          : "";
      if (l.shape === "rect") {
        return `<rect x="${l.x}" y="${l.y}" width="${l.width}" height="${l.height}" fill="${escapeAttr(l.fill)}"${stroke}${transform}${styleAttr}/>`;
      }
      if (l.shape === "ellipse") {
        const cx = l.x + l.width / 2;
        const cy = l.y + l.height / 2;
        const rx = l.width / 2;
        const ry = l.height / 2;
        return `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="${escapeAttr(l.fill)}"${stroke}${transform}${styleAttr}/>`;
      }
      if (l.shape === "polygon" && l.points && l.points.length > 0) {
        const pts = l.points
          .map((p) => `${l.x + p.x},${l.y + p.y}`)
          .join(" ");
        return `<polygon points="${pts}" fill="${escapeAttr(l.fill)}"${stroke}${transform}${styleAttr}/>`;
      }
      return "";
    }
    case "image": {
      const l = layer as ImageLayer;
      return `<image x="${l.x}" y="${l.y}" width="${l.width}" height="${l.height}" href="${escapeAttr(l.src)}" preserveAspectRatio="none"${transform}${styleAttr}/>`;
    }
    case "group":
      return `<g${transform}${styleAttr}>${[...(layer).children]
        .reverse()
        .map(layerToSVG)
        .join("\n")}</g>`;
    case "smart-object":
      // Render sub as nested SVG
      return `<g${transform}${styleAttr}>${[...(layer).sub]
        .reverse()
        .map(layerToSVG)
        .join("\n")}</g>`;
    case "adjustment":
      return "";
    default:
      return "";
  }
}

function escapeAttr(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function escapeText(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export async function exportAndDownload(
  canvas: HTMLCanvasElement,
  state: EditorState,
  opts: ExportOptions,
): Promise<void> {
  const baseName = opts.filename || "thumbnail";
  if (opts.format === "svg") {
    const svg = exportSVG(state);
    const blob = new Blob([svg], { type: "image/svg+xml" });
    downloadBlob(blob, `${baseName}.svg`);
    return;
  }
  const blob = await exportCanvas(canvas, opts);
  if (!blob) return;
  const ext = opts.format === "jpg" ? "jpg" : opts.format;
  downloadBlob(blob, `${baseName}.${ext}`);
}
