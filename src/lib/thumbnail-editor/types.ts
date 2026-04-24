// Thumbnail editor — core types
// Photoshop/Photopea-style layer-based editor. All state is serializable
// so it can be persisted to localStorage, snapshotted for history, and
// round-tripped through export.

export type BlendMode =
  | "normal"
  | "multiply"
  | "screen"
  | "overlay"
  | "darken"
  | "lighten"
  | "color-dodge"
  | "color-burn"
  | "hard-light"
  | "soft-light"
  | "difference"
  | "exclusion";

export type ToolId =
  | "move"
  | "marquee-rect"
  | "marquee-ellipse"
  | "lasso"
  | "magic-wand"
  | "crop"
  | "text"
  | "shape"
  | "brush"
  | "eraser"
  | "eyedropper"
  | "hand"
  | "zoom";

export type ShapeKind = "rect" | "ellipse" | "polygon";

export interface BaseLayer {
  id: string;
  name: string;
  visible: boolean;
  locked: boolean;
  opacity: number; // 0..100
  blendMode: BlendMode;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number; // degrees
  // Optional raster mask as a data URL (black = hidden, white = shown)
  mask?: string | null;
}

export interface ImageLayer extends BaseLayer {
  type: "image";
  src: string; // data URL or remote URL
}

export interface TextLayer extends BaseLayer {
  type: "text";
  text: string;
  fontFamily: string;
  fontSize: number;
  fontWeight: number;
  color: string;
  align: "left" | "center" | "right";
  italic: boolean;
  underline: boolean;
  letterSpacing: number;
  lineHeight: number;
  strokeColor?: string;
  strokeWidth?: number;
  shadowColor?: string;
  shadowBlur?: number;
  shadowOffsetX?: number;
  shadowOffsetY?: number;
}

export interface ShapeLayer extends BaseLayer {
  type: "shape";
  shape: ShapeKind;
  fill: string;
  stroke?: string;
  strokeWidth?: number;
  // For polygon — absolute points in layer-local coordinates
  points?: { x: number; y: number }[];
}

export type AdjustmentKind =
  | "brightness"
  | "contrast"
  | "hue-saturation"
  | "curves"
  | "levels";

export interface AdjustmentLayer extends BaseLayer {
  type: "adjustment";
  kind: AdjustmentKind;
  params: Record<string, number>;
}

export interface SmartObjectLayer extends BaseLayer {
  type: "smart-object";
  // Sub-composition is stored inline as its own layer list. Edits to the
  // smart object open a nested editor; rasterize flattens to an image layer.
  sub: Layer[];
  subWidth: number;
  subHeight: number;
}

export interface GroupLayer extends BaseLayer {
  type: "group";
  collapsed: boolean;
  children: Layer[];
}

export type Layer =
  | ImageLayer
  | TextLayer
  | ShapeLayer
  | AdjustmentLayer
  | SmartObjectLayer
  | GroupLayer;

export type LayerType = Layer["type"];

export interface CanvasPreset {
  id: string;
  name: string;
  width: number;
  height: number;
}

export interface Selection {
  kind: "rect" | "ellipse" | "lasso" | "none";
  // Normalized canvas-space coordinates
  x: number;
  y: number;
  width: number;
  height: number;
  // For lasso — polygon points
  points?: { x: number; y: number }[];
}

export interface ViewportState {
  zoom: number; // 1 = 100%
  panX: number;
  panY: number;
  showRulers: boolean;
  showGrid: boolean;
  showGuides: boolean;
}

export interface EditorState {
  canvasWidth: number;
  canvasHeight: number;
  background: string; // CSS color or "transparent"
  layers: Layer[];
  selectedLayerIds: string[];
  activeTool: ToolId;
  selection: Selection;
  viewport: ViewportState;
  // Ephemeral — not persisted: cursor color from eyedropper
  foregroundColor: string;
  backgroundColor: string;
}

export interface HistoryEntry {
  id: string;
  label: string;
  timestamp: number;
  snapshot: EditorState;
}

export interface HistoryState {
  past: HistoryEntry[]; // oldest first
  present: HistoryEntry;
  future: HistoryEntry[]; // newest first (so future[0] is the next redo)
}

// Canvas presets shipped with the editor
export const DEFAULT_PRESETS: CanvasPreset[] = [
  { id: "youtube", name: "YouTube Thumbnail", width: 1280, height: 720 },
  { id: "instagram-square", name: "Instagram Square", width: 1080, height: 1080 },
  { id: "instagram-story", name: "Instagram Story", width: 1080, height: 1920 },
  { id: "tiktok", name: "TikTok Cover", width: 1080, height: 1920 },
  { id: "twitter", name: "Twitter Card", width: 1200, height: 675 },
];
