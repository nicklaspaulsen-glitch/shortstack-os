// Editor reducer + history. Every mutation goes through `editorReducer`
// (layer tree edits, viewport pans, tool switches, AI-fill results, etc).
// The `historyReducer` wraps it and snapshots the state for undo/redo.
//
// History is capped at 50 entries per spec. We store full snapshots
// (not diffs) because the state object is small and snapshots are
// simpler to reason about than command-log replay.

import type {
  EditorState,
  HistoryEntry,
  HistoryState,
  Layer,
  BlendMode,
  ToolId,
  Selection,
  ImageLayer,
  TextLayer,
  ShapeLayer,
  GroupLayer,
  SmartObjectLayer,
} from "./types";

const HISTORY_LIMIT = 50;

export function makeId(prefix = "layer"): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}_${Date.now().toString(36)}`;
}

export function createInitialState(
  width = 1280,
  height = 720,
): EditorState {
  return {
    canvasWidth: width,
    canvasHeight: height,
    background: "#ffffff",
    layers: [],
    selectedLayerIds: [],
    activeTool: "move",
    selection: { kind: "none", x: 0, y: 0, width: 0, height: 0 },
    viewport: {
      zoom: 1,
      panX: 0,
      panY: 0,
      showRulers: true,
      showGrid: false,
      showGuides: true,
    },
    foregroundColor: "#000000",
    backgroundColor: "#ffffff",
  };
}

// ─── Action types ──────────────────────────────────────────────────────────

export type EditorAction =
  | { type: "ADD_LAYER"; layer: Layer }
  | { type: "UPDATE_LAYER"; id: string; patch: Partial<Layer> }
  | { type: "DELETE_LAYER"; id: string }
  | { type: "DUPLICATE_LAYER"; id: string }
  | { type: "REORDER_LAYERS"; ids: string[] } // new top-down order
  | { type: "SELECT_LAYERS"; ids: string[] }
  | { type: "TOGGLE_VISIBILITY"; id: string }
  | { type: "TOGGLE_LOCK"; id: string }
  | { type: "SET_OPACITY"; id: string; opacity: number }
  | { type: "SET_BLEND_MODE"; id: string; mode: BlendMode }
  | { type: "MERGE_DOWN"; id: string }
  | { type: "GROUP_LAYERS"; ids: string[] }
  | { type: "UNGROUP_LAYER"; id: string }
  | { type: "CONVERT_TO_SMART_OBJECT"; id: string }
  | { type: "RASTERIZE_LAYER"; id: string; rasterSrc: string }
  | { type: "FLATTEN_ALL"; rasterSrc: string }
  | { type: "SET_CANVAS_SIZE"; width: number; height: number }
  | { type: "SET_BACKGROUND"; color: string }
  | { type: "SET_TOOL"; tool: ToolId }
  | { type: "SET_SELECTION"; selection: Selection }
  | { type: "SET_VIEWPORT"; patch: Partial<EditorState["viewport"]> }
  | { type: "SET_FG_COLOR"; color: string }
  | { type: "SET_BG_COLOR"; color: string }
  | { type: "REPLACE_STATE"; state: EditorState };

// ─── Layer helpers ─────────────────────────────────────────────────────────

// Layers are stored top-of-stack first (index 0 renders on top — matches
// Photoshop's UI). The canvas renderer paints from the END of the array
// first so the visual stack matches the UI.
function insertLayer(layers: Layer[], layer: Layer): Layer[] {
  return [layer, ...layers];
}

function mapLayers(
  layers: Layer[],
  fn: (l: Layer) => Layer | null,
): Layer[] {
  const out: Layer[] = [];
  for (const l of layers) {
    const mapped = fn(l);
    if (mapped === null) continue;
    if (mapped.type === "group") {
      const g = mapped as GroupLayer;
      out.push({ ...g, children: mapLayers(g.children, fn) });
    } else if (mapped.type === "smart-object") {
      const so = mapped as SmartObjectLayer;
      out.push({ ...so, sub: mapLayers(so.sub, fn) });
    } else {
      out.push(mapped);
    }
  }
  return out;
}

function findLayer(layers: Layer[], id: string): Layer | null {
  for (const l of layers) {
    if (l.id === id) return l;
    if (l.type === "group") {
      const c = findLayer(l.children, id);
      if (c) return c;
    }
    if (l.type === "smart-object") {
      const c = findLayer(l.sub, id);
      if (c) return c;
    }
  }
  return null;
}

function removeLayer(layers: Layer[], id: string): Layer[] {
  return layers
    .filter((l) => l.id !== id)
    .map((l) => {
      if (l.type === "group") {
        return { ...l, children: removeLayer(l.children, id) };
      }
      if (l.type === "smart-object") {
        return { ...l, sub: removeLayer(l.sub, id) };
      }
      return l;
    });
}

function cloneLayerDeep(layer: Layer): Layer {
  const id = makeId(layer.type);
  if (layer.type === "group") {
    return {
      ...layer,
      id,
      name: `${layer.name} copy`,
      children: layer.children.map(cloneLayerDeep),
    };
  }
  if (layer.type === "smart-object") {
    return {
      ...layer,
      id,
      name: `${layer.name} copy`,
      sub: layer.sub.map(cloneLayerDeep),
    };
  }
  return { ...layer, id, name: `${layer.name} copy` };
}

export function editorReducer(
  state: EditorState,
  action: EditorAction,
): EditorState {
  switch (action.type) {
    case "ADD_LAYER":
      return {
        ...state,
        layers: insertLayer(state.layers, action.layer),
        selectedLayerIds: [action.layer.id],
      };

    case "UPDATE_LAYER":
      return {
        ...state,
        layers: mapLayers(state.layers, (l) =>
          l.id === action.id ? ({ ...l, ...action.patch } as Layer) : l,
        ),
      };

    case "DELETE_LAYER":
      return {
        ...state,
        layers: removeLayer(state.layers, action.id),
        selectedLayerIds: state.selectedLayerIds.filter(
          (x) => x !== action.id,
        ),
      };

    case "DUPLICATE_LAYER": {
      const original = findLayer(state.layers, action.id);
      if (!original) return state;
      const copy = cloneLayerDeep(original);
      // Nudge so the duplicate is visible
      copy.x += 12;
      copy.y += 12;
      return {
        ...state,
        layers: insertLayer(state.layers, copy),
        selectedLayerIds: [copy.id],
      };
    }

    case "REORDER_LAYERS": {
      const byId = new Map<string, Layer>();
      for (const l of state.layers) byId.set(l.id, l);
      const reordered: Layer[] = [];
      for (const id of action.ids) {
        const l = byId.get(id);
        if (l) reordered.push(l);
      }
      for (const l of state.layers) {
        if (!action.ids.includes(l.id)) reordered.push(l);
      }
      return { ...state, layers: reordered };
    }

    case "SELECT_LAYERS":
      return { ...state, selectedLayerIds: action.ids };

    case "TOGGLE_VISIBILITY":
      return {
        ...state,
        layers: mapLayers(state.layers, (l) =>
          l.id === action.id ? { ...l, visible: !l.visible } : l,
        ),
      };

    case "TOGGLE_LOCK":
      return {
        ...state,
        layers: mapLayers(state.layers, (l) =>
          l.id === action.id ? { ...l, locked: !l.locked } : l,
        ),
      };

    case "SET_OPACITY":
      return {
        ...state,
        layers: mapLayers(state.layers, (l) =>
          l.id === action.id
            ? { ...l, opacity: Math.max(0, Math.min(100, action.opacity)) }
            : l,
        ),
      };

    case "SET_BLEND_MODE":
      return {
        ...state,
        layers: mapLayers(state.layers, (l) =>
          l.id === action.id ? { ...l, blendMode: action.mode } : l,
        ),
      };

    case "MERGE_DOWN": {
      const idx = state.layers.findIndex((l) => l.id === action.id);
      if (idx < 0 || idx === state.layers.length - 1) return state;
      const next = [...state.layers];
      next.splice(idx + 1, 1);
      return { ...state, layers: next };
    }

    case "GROUP_LAYERS": {
      if (action.ids.length === 0) return state;
      const picked: Layer[] = [];
      const remaining: Layer[] = [];
      for (const l of state.layers) {
        if (action.ids.includes(l.id)) picked.push(l);
        else remaining.push(l);
      }
      if (picked.length === 0) return state;
      const group: GroupLayer = {
        id: makeId("group"),
        type: "group",
        name: "Group",
        visible: true,
        locked: false,
        opacity: 100,
        blendMode: "normal",
        x: 0,
        y: 0,
        width: state.canvasWidth,
        height: state.canvasHeight,
        rotation: 0,
        collapsed: false,
        children: picked,
      };
      return {
        ...state,
        layers: [group, ...remaining],
        selectedLayerIds: [group.id],
      };
    }

    case "UNGROUP_LAYER": {
      const layer = state.layers.find((l) => l.id === action.id);
      if (!layer || layer.type !== "group") return state;
      const children = layer.children;
      const next: Layer[] = [];
      for (const l of state.layers) {
        if (l.id === action.id) next.push(...children);
        else next.push(l);
      }
      return {
        ...state,
        layers: next,
        selectedLayerIds: children.map((c) => c.id),
      };
    }

    case "CONVERT_TO_SMART_OBJECT": {
      const layer = findLayer(state.layers, action.id);
      if (!layer) return state;
      const so: SmartObjectLayer = {
        id: makeId("smart"),
        type: "smart-object",
        name: `${layer.name} (Smart)`,
        visible: layer.visible,
        locked: false,
        opacity: layer.opacity,
        blendMode: layer.blendMode,
        x: layer.x,
        y: layer.y,
        width: layer.width,
        height: layer.height,
        rotation: layer.rotation,
        sub: [layer],
        subWidth: layer.width,
        subHeight: layer.height,
      };
      const removed = removeLayer(state.layers, action.id);
      return {
        ...state,
        layers: [so, ...removed],
        selectedLayerIds: [so.id],
      };
    }

    case "RASTERIZE_LAYER": {
      const layer = findLayer(state.layers, action.id);
      if (!layer) return state;
      const raster: ImageLayer = {
        id: makeId("image"),
        type: "image",
        name: layer.name,
        visible: layer.visible,
        locked: layer.locked,
        opacity: layer.opacity,
        blendMode: layer.blendMode,
        x: layer.x,
        y: layer.y,
        width: layer.width,
        height: layer.height,
        rotation: layer.rotation,
        src: action.rasterSrc,
      };
      const removed = removeLayer(state.layers, action.id);
      return {
        ...state,
        layers: [raster, ...removed],
        selectedLayerIds: [raster.id],
      };
    }

    case "FLATTEN_ALL": {
      const raster: ImageLayer = {
        id: makeId("image"),
        type: "image",
        name: "Background",
        visible: true,
        locked: false,
        opacity: 100,
        blendMode: "normal",
        x: 0,
        y: 0,
        width: state.canvasWidth,
        height: state.canvasHeight,
        rotation: 0,
        src: action.rasterSrc,
      };
      return { ...state, layers: [raster], selectedLayerIds: [raster.id] };
    }

    case "SET_CANVAS_SIZE":
      return {
        ...state,
        canvasWidth: action.width,
        canvasHeight: action.height,
      };

    case "SET_BACKGROUND":
      return { ...state, background: action.color };

    case "SET_TOOL":
      return { ...state, activeTool: action.tool };

    case "SET_SELECTION":
      return { ...state, selection: action.selection };

    case "SET_VIEWPORT":
      return { ...state, viewport: { ...state.viewport, ...action.patch } };

    case "SET_FG_COLOR":
      return { ...state, foregroundColor: action.color };

    case "SET_BG_COLOR":
      return { ...state, backgroundColor: action.color };

    case "REPLACE_STATE":
      return action.state;

    default:
      return state;
  }
}

// ─── Layer factories ───────────────────────────────────────────────────────

export function createImageLayer(
  src: string,
  opts: Partial<ImageLayer> = {},
): ImageLayer {
  return {
    id: makeId("image"),
    type: "image",
    name: opts.name || "Image",
    visible: true,
    locked: false,
    opacity: 100,
    blendMode: "normal",
    x: opts.x ?? 0,
    y: opts.y ?? 0,
    width: opts.width ?? 400,
    height: opts.height ?? 300,
    rotation: 0,
    src,
    ...opts,
  };
}

export function createTextLayer(
  text: string,
  opts: Partial<TextLayer> = {},
): TextLayer {
  return {
    id: makeId("text"),
    type: "text",
    name: opts.name || text.slice(0, 20) || "Text",
    visible: true,
    locked: false,
    opacity: 100,
    blendMode: "normal",
    x: opts.x ?? 100,
    y: opts.y ?? 100,
    width: opts.width ?? 400,
    height: opts.height ?? 120,
    rotation: 0,
    text,
    fontFamily: "Inter, sans-serif",
    fontSize: 72,
    fontWeight: 700,
    color: "#ffffff",
    align: "center",
    italic: false,
    underline: false,
    letterSpacing: 0,
    lineHeight: 1.1,
    strokeColor: "#000000",
    strokeWidth: 4,
    shadowColor: "rgba(0,0,0,0.6)",
    shadowBlur: 8,
    shadowOffsetX: 0,
    shadowOffsetY: 4,
    ...opts,
  };
}

export function createShapeLayer(
  shape: ShapeLayer["shape"],
  opts: Partial<ShapeLayer> = {},
): ShapeLayer {
  return {
    id: makeId("shape"),
    type: "shape",
    name: opts.name || shape,
    visible: true,
    locked: false,
    opacity: 100,
    blendMode: "normal",
    x: opts.x ?? 50,
    y: opts.y ?? 50,
    width: opts.width ?? 200,
    height: opts.height ?? 200,
    rotation: 0,
    shape,
    fill: "#ef4444",
    stroke: undefined,
    strokeWidth: 0,
    ...opts,
  };
}

// ─── History reducer ───────────────────────────────────────────────────────

export type HistoryAction =
  | { type: "COMMIT"; label: string; state: EditorState }
  | { type: "UNDO" }
  | { type: "REDO" }
  | { type: "JUMP"; entryId: string }
  | { type: "CLEAR" };

export function createInitialHistory(state: EditorState): HistoryState {
  const entry: HistoryEntry = {
    id: makeId("hist"),
    label: "Initial",
    timestamp: Date.now(),
    snapshot: state,
  };
  return { past: [], present: entry, future: [] };
}

export function historyReducer(
  state: HistoryState,
  action: HistoryAction,
): HistoryState {
  switch (action.type) {
    case "COMMIT": {
      const entry: HistoryEntry = {
        id: makeId("hist"),
        label: action.label,
        timestamp: Date.now(),
        snapshot: action.state,
      };
      const nextPast = [...state.past, state.present];
      const trimmed =
        nextPast.length > HISTORY_LIMIT
          ? nextPast.slice(nextPast.length - HISTORY_LIMIT)
          : nextPast;
      return { past: trimmed, present: entry, future: [] };
    }
    case "UNDO": {
      if (state.past.length === 0) return state;
      const prev = state.past[state.past.length - 1];
      return {
        past: state.past.slice(0, -1),
        present: prev,
        future: [state.present, ...state.future],
      };
    }
    case "REDO": {
      if (state.future.length === 0) return state;
      const [next, ...rest] = state.future;
      return {
        past: [...state.past, state.present],
        present: next,
        future: rest,
      };
    }
    case "JUMP": {
      const all: HistoryEntry[] = [...state.past, state.present, ...state.future];
      const idx = all.findIndex((e) => e.id === action.entryId);
      if (idx < 0) return state;
      return {
        past: all.slice(0, idx),
        present: all[idx],
        future: all.slice(idx + 1),
      };
    }
    case "CLEAR":
      return { past: [], present: state.present, future: [] };
    default:
      return state;
  }
}

// Flatten history into a chronologically-ordered list for the UI panel.
// Returns newest first (so the top of the panel is the current state).
export function flattenHistory(h: HistoryState): HistoryEntry[] {
  return [...[...h.future].reverse(), h.present, ...[...h.past].reverse()];
}
