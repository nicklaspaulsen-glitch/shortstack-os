/**
 * Design Studio — Zustand store with immer-based undo/redo history.
 *
 * State shape:
 *   design       — current DesignRow (width/height/title/doc)
 *   pageIndex    — active page index
 *   selection    — selected layer ids
 *   history      — stack of DesignDoc snapshots for undo/redo
 *   historyIndex — cursor into history stack
 *   zoom         — canvas zoom level (0.1–4)
 *   isDirty      — unsaved changes flag
 *
 * All layer mutations go through `updateLayer` / `addLayer` / `deleteLayer` which
 * push a snapshot onto the history stack and mark isDirty = true.
 */

import { create } from "zustand";
import { produce } from "immer";
import { v4 as uuidv4 } from "uuid";
import type {
  DesignRow,
  DesignDoc,
  Layer,
  Page,
  Selection,
} from "./types";

const MAX_HISTORY = 50;

export interface DesignStoreState {
  // ── Design data ──────────────────────────────────────────────────────────
  design: DesignRow | null;
  pageIndex: number;
  selection: Selection;

  // ── History ──────────────────────────────────────────────────────────────
  history: DesignDoc[];
  historyIndex: number;

  // ── UI state ─────────────────────────────────────────────────────────────
  zoom: number;
  isDirty: boolean;
  isSaving: boolean;
  showGrid: boolean;
  showGuides: boolean;

  // ── Actions ──────────────────────────────────────────────────────────────
  loadDesign: (d: DesignRow) => void;
  setTitle: (t: string) => void;
  setPageIndex: (i: number) => void;
  setSelection: (sel: Selection) => void;
  addLayer: (layer: Layer) => void;
  updateLayer: (layerId: string, patch: Partial<Omit<Layer, "id" | "kind">>) => void;
  deleteLayer: (layerId: string) => void;
  reorderLayer: (layerId: string, direction: "up" | "down") => void;
  duplicateLayer: (layerId: string) => void;
  setBackgroundColor: (color: string) => void;
  undo: () => void;
  redo: () => void;
  setZoom: (z: number) => void;
  setIsSaving: (v: boolean) => void;
  markSaved: () => void;
  toggleGrid: () => void;
  toggleGuides: () => void;
  getDoc: () => DesignDoc | null;
  getCurrentPage: () => Page | null;
}

function cloneDoc(doc: DesignDoc): DesignDoc {
  return JSON.parse(JSON.stringify(doc)) as DesignDoc;
}

function pushHistory(state: DesignStoreState): void {
  if (!state.design) return;
  const snap = cloneDoc(state.design.doc);
  // Truncate redo tail
  const base = state.history.slice(0, state.historyIndex + 1);
  const next = [...base, snap];
  state.history = next.slice(-MAX_HISTORY);
  state.historyIndex = state.history.length - 1;
  state.isDirty = true;
}

export const useDesignStore = create<DesignStoreState>((set, get) => ({
  design: null,
  pageIndex: 0,
  selection: { layerIds: [] },
  history: [],
  historyIndex: -1,
  zoom: 1,
  isDirty: false,
  isSaving: false,
  showGrid: false,
  showGuides: true,

  loadDesign: (d) =>
    set({
      design: d,
      pageIndex: d.doc.activePageIndex ?? 0,
      selection: { layerIds: [] },
      history: [cloneDoc(d.doc)],
      historyIndex: 0,
      isDirty: false,
    }),

  setTitle: (t) =>
    set(
      produce((s: DesignStoreState) => {
        if (!s.design) return;
        s.design.title = t;
        s.isDirty = true;
      }),
    ),

  setPageIndex: (i) => set({ pageIndex: i, selection: { layerIds: [] } }),

  setSelection: (sel) => set({ selection: sel }),

  addLayer: (layer) =>
    set(
      produce((s: DesignStoreState) => {
        if (!s.design) return;
        const page = s.design.doc.pages[s.pageIndex];
        if (!page) return;
        // Assign zIndex above current max
        const maxZ = Object.values(page.layers).reduce(
          (m, l) => Math.max(m, l.zIndex),
          0,
        );
        const newLayer: Layer = { ...layer, zIndex: maxZ + 1 } as Layer;
        page.layers[newLayer.id] = newLayer;
        page.layerIds.push(newLayer.id);
        pushHistory(s);
      }),
    ),

  updateLayer: (layerId, patch) =>
    set(
      produce((s: DesignStoreState) => {
        if (!s.design) return;
        const page = s.design.doc.pages[s.pageIndex];
        if (!page) return;
        const layer = page.layers[layerId];
        if (!layer) return;
        Object.assign(layer, patch);
        pushHistory(s);
      }),
    ),

  deleteLayer: (layerId) =>
    set(
      produce((s: DesignStoreState) => {
        if (!s.design) return;
        const page = s.design.doc.pages[s.pageIndex];
        if (!page) return;
        delete page.layers[layerId];
        page.layerIds = page.layerIds.filter((id) => id !== layerId);
        s.selection = { layerIds: s.selection.layerIds.filter((id) => id !== layerId) };
        pushHistory(s);
      }),
    ),

  reorderLayer: (layerId, direction) =>
    set(
      produce((s: DesignStoreState) => {
        if (!s.design) return;
        const page = s.design.doc.pages[s.pageIndex];
        if (!page) return;
        const idx = page.layerIds.indexOf(layerId);
        if (idx === -1) return;
        if (direction === "up" && idx < page.layerIds.length - 1) {
          [page.layerIds[idx], page.layerIds[idx + 1]] = [
            page.layerIds[idx + 1],
            page.layerIds[idx],
          ];
        } else if (direction === "down" && idx > 0) {
          [page.layerIds[idx], page.layerIds[idx - 1]] = [
            page.layerIds[idx - 1],
            page.layerIds[idx],
          ];
        }
        // Sync zIndex to order
        page.layerIds.forEach((id, i) => {
          if (page.layers[id]) page.layers[id].zIndex = i;
        });
        pushHistory(s);
      }),
    ),

  duplicateLayer: (layerId) =>
    set(
      produce((s: DesignStoreState) => {
        if (!s.design) return;
        const page = s.design.doc.pages[s.pageIndex];
        if (!page) return;
        const src = page.layers[layerId];
        if (!src) return;
        const newId = uuidv4();
        const dup: Layer = {
          ...JSON.parse(JSON.stringify(src)) as Layer,
          id: newId,
          name: `${src.name} copy`,
          x: src.x + 16,
          y: src.y + 16,
          zIndex: src.zIndex + 1,
        };
        page.layers[newId] = dup;
        const srcIdx = page.layerIds.indexOf(layerId);
        page.layerIds.splice(srcIdx + 1, 0, newId);
        s.selection = { layerIds: [newId] };
        pushHistory(s);
      }),
    ),

  setBackgroundColor: (color) =>
    set(
      produce((s: DesignStoreState) => {
        if (!s.design) return;
        const page = s.design.doc.pages[s.pageIndex];
        if (!page) return;
        page.backgroundColor = color;
        pushHistory(s);
      }),
    ),

  undo: () =>
    set(
      produce((s: DesignStoreState) => {
        if (!s.design || s.historyIndex <= 0) return;
        s.historyIndex -= 1;
        s.design.doc = cloneDoc(s.history[s.historyIndex]);
        s.selection = { layerIds: [] };
        s.isDirty = true;
      }),
    ),

  redo: () =>
    set(
      produce((s: DesignStoreState) => {
        if (!s.design || s.historyIndex >= s.history.length - 1) return;
        s.historyIndex += 1;
        s.design.doc = cloneDoc(s.history[s.historyIndex]);
        s.selection = { layerIds: [] };
        s.isDirty = true;
      }),
    ),

  setZoom: (z) => set({ zoom: Math.max(0.1, Math.min(4, z)) }),

  setIsSaving: (v) => set({ isSaving: v }),

  markSaved: () => set({ isDirty: false }),

  toggleGrid: () => set((s) => ({ showGrid: !s.showGrid })),
  toggleGuides: () => set((s) => ({ showGuides: !s.showGuides })),

  getDoc: () => get().design?.doc ?? null,

  getCurrentPage: () => {
    const s = get();
    if (!s.design) return null;
    return s.design.doc.pages[s.pageIndex] ?? null;
  },
}));

// ── Helpers for creating default layers ──────────────────────────────────────

export function makeTextLayer(overrides: Partial<import("./types").TextLayer> = {}): import("./types").TextLayer {
  return {
    id: uuidv4(),
    kind: "text",
    name: "Text",
    x: 100,
    y: 100,
    width: 300,
    height: 60,
    rotation: 0,
    opacity: 1,
    locked: false,
    hidden: false,
    zIndex: 0,
    content: "Your text here",
    fontFamily: "Inter",
    fontSize: 36,
    fontWeight: "700",
    fontStyle: "normal",
    textAlign: "left",
    color: "#ffffff",
    lineHeight: 1.2,
    letterSpacing: 0,
    textDecoration: "none",
    backgroundColor: null,
    padding: 0,
    borderRadius: 0,
    ...overrides,
  };
}

export function makeImageLayer(overrides: Partial<import("./types").ImageLayer> = {}): import("./types").ImageLayer {
  return {
    id: uuidv4(),
    kind: "image",
    name: "Image",
    x: 0,
    y: 0,
    width: 400,
    height: 300,
    rotation: 0,
    opacity: 1,
    locked: false,
    hidden: false,
    zIndex: 0,
    src: "",
    objectFit: "cover",
    borderRadius: 0,
    flipX: false,
    flipY: false,
    r2Key: null,
    jobId: null,
    ...overrides,
  };
}

export function makeShapeLayer(overrides: Partial<import("./types").ShapeLayer> = {}): import("./types").ShapeLayer {
  return {
    id: uuidv4(),
    kind: "shape",
    name: "Shape",
    x: 100,
    y: 100,
    width: 200,
    height: 200,
    rotation: 0,
    opacity: 1,
    locked: false,
    hidden: false,
    zIndex: 0,
    shapeType: "rectangle",
    fill: "#8B6FCF",
    stroke: "transparent",
    strokeWidth: 0,
    borderRadius: 0,
    ...overrides,
  };
}

export function makeEmptyDoc(width: number, height: number): DesignDoc {
  const pageId = uuidv4();
  return {
    version: 1,
    pages: [
      {
        id: pageId,
        name: "Page 1",
        backgroundColor: "#1a1a2e",
        layerIds: [],
        layers: {},
      },
    ],
    activePageIndex: 0,
  };
}
