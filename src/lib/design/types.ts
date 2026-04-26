/**
 * Design Studio — core type definitions.
 *
 * A Design is a normalized JSON document: one or more Pages, each containing
 * an ordered array of Layers. Layers are discriminated unions keyed by `kind`.
 * All mutations must produce a NEW object (immutable pattern) — the Zustand
 * store uses immer patches to drive undo/redo.
 */

// ── Size presets ─────────────────────────────────────────────────────────────

export interface SizePreset {
  label: string;
  width: number;
  height: number;
  category: string;
}

export const SIZE_PRESETS: SizePreset[] = [
  { label: "Instagram Post", width: 1080, height: 1080, category: "Instagram" },
  { label: "Instagram Story", width: 1080, height: 1920, category: "Instagram" },
  { label: "YouTube Thumbnail", width: 1280, height: 720, category: "YouTube" },
  { label: "Facebook Post", width: 1200, height: 630, category: "Facebook" },
  { label: "Facebook Story", width: 1080, height: 1920, category: "Facebook" },
  { label: "LinkedIn Banner", width: 1584, height: 396, category: "LinkedIn" },
  { label: "LinkedIn Post", width: 1200, height: 627, category: "LinkedIn" },
  { label: "Twitter/X Post", width: 1600, height: 900, category: "Twitter/X" },
];

// ── Layer base ────────────────────────────────────────────────────────────────

export interface LayerBase {
  id: string;
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number; // degrees
  opacity: number;  // 0–1
  locked: boolean;
  hidden: boolean;
  zIndex: number;
}

// ── Text layer ────────────────────────────────────────────────────────────────

export interface TextLayer extends LayerBase {
  kind: "text";
  content: string;
  fontFamily: string;
  fontSize: number; // px
  fontWeight: string; // "400" | "600" | "700" | etc.
  fontStyle: "normal" | "italic";
  textAlign: "left" | "center" | "right";
  color: string; // CSS color
  lineHeight: number; // multiplier
  letterSpacing: number; // px
  textDecoration: "none" | "underline" | "line-through";
  backgroundColor: string | null;
  padding: number;
  borderRadius: number;
}

// ── Image layer ───────────────────────────────────────────────────────────────

export interface ImageLayer extends LayerBase {
  kind: "image";
  src: string; // URL (R2 CDN or data URI for placeholders)
  objectFit: "fill" | "contain" | "cover";
  borderRadius: number;
  flipX: boolean;
  flipY: boolean;
  /** R2 key for the asset — populated when src is an R2 upload */
  r2Key: string | null;
  /** In-progress AI op job id */
  jobId: string | null;
}

// ── Shape layer ───────────────────────────────────────────────────────────────

export type ShapeType = "rectangle" | "ellipse" | "triangle" | "star" | "line";

export interface ShapeLayer extends LayerBase {
  kind: "shape";
  shapeType: ShapeType;
  fill: string; // CSS color or "transparent"
  stroke: string; // CSS color
  strokeWidth: number;
  borderRadius: number; // for rectangles
}

// ── Group layer ───────────────────────────────────────────────────────────────

export interface GroupLayer extends LayerBase {
  kind: "group";
  children: string[]; // child layer ids (in z-order)
}

// ── Union ─────────────────────────────────────────────────────────────────────

export type Layer = TextLayer | ImageLayer | ShapeLayer | GroupLayer;

// ── Page ──────────────────────────────────────────────────────────────────────

export interface Page {
  id: string;
  name: string;
  backgroundColor: string;
  /** Layer order: index 0 = bottom, last = top */
  layerIds: string[];
  /** Flat map for O(1) lookup */
  layers: Record<string, Layer>;
}

// ── Design document ───────────────────────────────────────────────────────────

export interface DesignDoc {
  version: 1;
  pages: Page[];
  /** Index of the active page during editing */
  activePageIndex: number;
}

// ── DB row shapes (subset — full rows come from Supabase) ─────────────────────

export interface DesignRow {
  id: string;
  user_id: string;
  client_id: string | null;
  title: string;
  width: number;
  height: number;
  doc: DesignDoc;
  thumbnail_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface DesignTemplateRow {
  id: string;
  owner_id: string | null;
  is_global: boolean;
  category: string;
  name: string;
  doc: DesignDoc;
  preview_url: string | null;
  created_at: string;
}

export interface DesignJobRow {
  id: string;
  design_id: string;
  user_id: string;
  op: "flux_generate" | "rembg" | "upscale" | "inpaint";
  status: "pending" | "running" | "done" | "error";
  runpod_id: string | null;
  params: Record<string, unknown> | null;
  result: Record<string, unknown> | null;
  error: string | null;
  created_at: string;
  updated_at: string;
}

// ── Canvas selection ──────────────────────────────────────────────────────────

export interface Selection {
  layerIds: string[];
}

// ── Export format ─────────────────────────────────────────────────────────────

export type ExportFormat = "png" | "jpg" | "webp";
