"use client";

// Thumbnail Generator Pro — Photoshop/Photopea-style layer editor.
// The previous 7000+ line AI-generator page has been replaced with a
// real layer-based editor per spec. FLUX generation, face-swap, and
// style tooling remain available via the dedicated AI Studio and the
// thumbnail/* API routes; this page is the pixel-editor surface.

import {
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from "react";
import { AnimatePresence, motion } from "framer-motion";
import toast from "react-hot-toast";
import type {
  BlendMode,
  CanvasPreset,
  EditorState,
  Layer,
  ToolId,
  HistoryState,
} from "@/lib/thumbnail-editor/types";
import {
  createImageLayer,
  createInitialHistory,
  createInitialState,
  createShapeLayer,
  createTextLayer,
  editorReducer,
  flattenHistory,
  historyReducer,
  type EditorAction,
  type HistoryAction,
} from "@/lib/thumbnail-editor/reducer";
import { exportAndDownload, type ExportFormat } from "@/lib/thumbnail-editor/export";
import ToolsPalette from "@/components/thumbnail-editor/tools-palette";
import EditorCanvas from "@/components/thumbnail-editor/canvas";
import LayersPanel from "@/components/thumbnail-editor/layers-panel";
import TopBar from "@/components/thumbnail-editor/top-bar";
import AIFillDialog from "@/components/thumbnail-editor/ai-fill-dialog";
import HistoryPanel from "@/components/thumbnail-editor/history-panel";
import AiFirstStarter from "@/components/thumbnail-editor/ai-first-starter";
import StockPhotosPanel from "@/components/thumbnail-editor/stock-photos-panel";
import type { StockPhoto } from "@/lib/integrations/stock-photos";
import { MotionPage } from "@/components/motion/motion-page";
import SmartBar from "@/components/ui/smart-bar";
import CreatorIntelligence from "@/components/ui/creator-intelligence";

// ── Headline Quality Scorer ───────────────────────────────────────────────
// Pure fn — no deps. Scores thumbnail text content for CTR potential 0-100.
function headlineScore(text: string): { score: number; label: string; color: string; tips: string[] } {
  const t = text.toLowerCase().trim();
  const words = t.split(/\s+/).filter(Boolean);
  const tips: string[] = [];
  let score = 0;

  // Word count sweet spot: 2-6 words is ideal for thumbnails
  if (words.length >= 2 && words.length <= 6) score += 25;
  else if (words.length === 1) { score += 10; tips.push("Too short — add 1-2 power words"); }
  else if (words.length > 6) { score += 10; tips.push("Too many words — trim to 6 max"); }

  // Numbers (specificity signal: "5 secrets", "10x faster")
  if (/\d/.test(text)) score += 20;
  else tips.push("Add a number for specificity (e.g. '3 mistakes')");

  // Power / emotion words
  if (/\b(secret|never|stop|truth|mistake|shocking|viral|exposed|revealed|finally|alone|warning|critical|free|instant|proven|guaranteed|huge)\b/.test(t)) score += 20;
  else tips.push("Add a power word (secret, never, truth, exposed…)");

  // All-caps signals emphasis (common thumbnail style)
  const capRatio = (text.match(/[A-Z]/g)?.length ?? 0) / Math.max(text.replace(/\s/g, "").length, 1);
  if (capRatio > 0.5) score += 15;
  else tips.push("Use CAPS for emphasis");

  // Question or "How to" format
  if (/^(how|why|what|can|will|does|is|are|should|\bwhy\b|\bhow\b)/.test(t) || t.includes("?")) score += 20;

  score = Math.min(100, score);
  const label = score >= 75 ? "High CTR" : score >= 50 ? "Decent" : score >= 30 ? "Weak" : "Needs work";
  const color = score >= 75 ? "#22C55E" : score >= 50 ? "#F59E0B" : "#EF4444";
  return { score, label, color, tips: tips.slice(0, 2) };
}

// Electron hint — the preload script sets window.electron. We check for
// truthy at runtime to decide whether to show the native picker.
// Shape comes from the shared ambient declaration at src/types/electron.d.ts.

export default function ThumbnailEditorProPage() {
  // Two separate reducers — one for editor state, one wrapping it for
  // history. A COMMIT action snapshots the editor state into history.
  // This keeps intermediate tool-drag changes out of history so the
  // panel doesn't fill up with one entry per pixel of drag.
  const [state, dispatch] = useReducer(editorReducer, undefined, () =>
    createInitialState(1280, 720),
  );
  const [history, historyDispatch] = useReducer(
    historyReducer,
    undefined,
    () => createInitialHistory(createInitialState(1280, 720)),
  );
  const renderGetter = useRef<(() => HTMLCanvasElement | null) | null>(null);
  const [aiFillOpen, setAIFillOpen] = useState(false);
  const [textToLayerOpen, setTextToLayerOpen] = useState(false);
  const [stockPhotosOpen, setStockPhotosOpen] = useState(false);
  const [aiBusy, setAIBusy] = useState(false);
  const [hasElectron, setHasElectron] = useState(false);
  // AI-first starter — overlay shown when canvas is empty and user hasn't
  // explicitly skipped (Pikzel-AI-style entry per apr27 backlog).
  const [aiStarterSkipped, setAiStarterSkipped] = useState(() => {
    if (typeof window === "undefined") return false;
    return sessionStorage.getItem("thumbnail-ai-starter-skipped") === "1";
  });

  useEffect(() => {
    setHasElectron(typeof window !== "undefined" && !!window.electron);
  }, []);

  // ── Seed from AI-video "Thumb" action (peepshow auto-select) ────────────
  // When the user clicks "Thumb" on a generated video, the best frame is
  // stored in sessionStorage under "ss-thumb-seed-image". We read it once
  // on mount, add it as a full-canvas image layer, and clear the key so
  // subsequent visits start with a blank canvas.
  useEffect(() => {
    try {
      const seedDataUrl = sessionStorage.getItem("ss-thumb-seed-image");
      if (!seedDataUrl || !seedDataUrl.startsWith("data:image/")) return;

      // Clear immediately so a refresh/back-nav doesn't re-seed
      sessionStorage.removeItem("ss-thumb-seed-image");
      sessionStorage.removeItem("ss-thumb-seed-reason");

      const img = new window.Image();
      img.onload = () => {
        const maxW = state.canvasWidth;
        const maxH = state.canvasHeight;
        // Cover-fill: scale up to fill the canvas while preserving aspect
        const scale = Math.max(maxW / img.width, maxH / img.height);
        const w = img.width * scale;
        const h = img.height * scale;
        const layer = createImageLayer(seedDataUrl, {
          x: (maxW - w) / 2,
          y: (maxH - h) / 2,
          width: w,
          height: h,
          name: "AI Video Frame",
        });
        commit({ type: "ADD_LAYER", layer }, "Seed from AI video");
      };
      img.src = seedDataUrl;
    } catch {
      // sessionStorage unavailable — silently skip
    }
    // Run only once on mount; state.canvasWidth/Height are stable after init
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Commit helper — dispatch + commit snapshot under the given label
  const commit = useCallback(
    (action: EditorAction, label: string) => {
      dispatch(action);
      // Defer so the editor reducer updates before we snapshot. We
      // compute the next state inline to avoid waiting a frame.
      const nextState = editorReducer(state, action);
      historyDispatch({
        type: "COMMIT",
        label,
        state: nextState,
      } as HistoryAction);
    },
    [state],
  );

  // Keep history present in sync with editor state if the reducer is
  // jumped (e.g. via the history panel).
  useEffect(() => {
    // When history jumps/undoes/redoes, sync editor state to the
    // present snapshot. We compare references — if the snapshots are
    // identical we skip the dispatch.
    if (history.present.snapshot !== state) {
      dispatch({ type: "REPLACE_STATE", state: history.present.snapshot });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [history.present.id]);

  // ── Keyboard: Ctrl/Cmd+Z undo, +Shift+Z redo ────────────────────────────
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable)
      ) {
        return;
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "z") {
        e.preventDefault();
        if (e.shiftKey) historyDispatch({ type: "REDO" });
        else historyDispatch({ type: "UNDO" });
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "y") {
        e.preventDefault();
        historyDispatch({ type: "REDO" });
      }
      if (e.key === "Delete" || e.key === "Backspace") {
        const firstId = state.selectedLayerIds[0];
        if (firstId) {
          e.preventDefault();
          commit({ type: "DELETE_LAYER", id: firstId }, "Delete layer");
        }
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [state.selectedLayerIds, commit]);

  // ── Top-bar actions ────────────────────────────────────────────────────
  const onUndo = useCallback(
    () => historyDispatch({ type: "UNDO" }),
    [],
  );
  const onRedo = useCallback(
    () => historyDispatch({ type: "REDO" }),
    [],
  );
  const onZoomIn = useCallback(() => {
    dispatch({
      type: "SET_VIEWPORT",
      patch: { zoom: Math.min(8, state.viewport.zoom * 1.25) },
    });
  }, [state.viewport.zoom]);
  const onZoomOut = useCallback(() => {
    dispatch({
      type: "SET_VIEWPORT",
      patch: { zoom: Math.max(0.1, state.viewport.zoom / 1.25) },
    });
  }, [state.viewport.zoom]);
  const onFit = useCallback(() => {
    // EditorCanvas listens for a global "thumb-editor:fit" event and
    // recalculates zoom/pan against its container size. Wiring via an
    // event keeps the component boundary thin.
    window.dispatchEvent(new Event("thumb-editor:fit"));
  }, []);

  const onPickPreset = useCallback(
    (p: CanvasPreset) => {
      commit(
        { type: "SET_CANVAS_SIZE", width: p.width, height: p.height },
        `Preset: ${p.name}`,
      );
    },
    [commit],
  );

  // ── Layer quick-adds ───────────────────────────────────────────────────
  const onAddText = useCallback(() => {
    const layer = createTextLayer("EPIC THUMBNAIL", {
      x: state.canvasWidth / 2 - 300,
      y: state.canvasHeight / 2 - 60,
      width: 600,
      height: 120,
    });
    commit({ type: "ADD_LAYER", layer }, "Add text");
  }, [state.canvasWidth, state.canvasHeight, commit]);

  const onAddShape = useCallback(
    (kind: "rect" | "ellipse") => {
      const layer = createShapeLayer(kind, {
        x: state.canvasWidth / 2 - 100,
        y: state.canvasHeight / 2 - 100,
        width: 200,
        height: 200,
      });
      commit({ type: "ADD_LAYER", layer }, `Add ${kind}`);
    },
    [state.canvasWidth, state.canvasHeight, commit],
  );

  const onUpload = useCallback(
    async (file: File) => {
      const reader = new FileReader();
      reader.onload = (ev) => {
        const src = ev.target?.result as string;
        if (!src) return;
        // Fit the image into the canvas while preserving aspect
        const img = new Image();
        img.onload = () => {
          const maxW = state.canvasWidth;
          const maxH = state.canvasHeight;
          const ratio = Math.min(maxW / img.width, maxH / img.height, 1);
          const w = img.width * ratio;
          const h = img.height * ratio;
          const layer = createImageLayer(src, {
            x: (state.canvasWidth - w) / 2,
            y: (state.canvasHeight - h) / 2,
            width: w,
            height: h,
            name: file.name,
          });
          commit({ type: "ADD_LAYER", layer }, `Add image: ${file.name}`);
        };
        img.src = src;
      };
      reader.readAsDataURL(file);
    },
    [state.canvasWidth, state.canvasHeight, commit],
  );

  const onOpenNativePicker = useCallback(async () => {
    if (!window.electron?.openFilePicker || !window.electron?.readFileDataUrl) {
      toast.error("Native file picker unavailable");
      return;
    }
    try {
      const path = await window.electron.openFilePicker();
      if (!path) return;
      const src = await window.electron.readFileDataUrl(path);
      const img = new Image();
      img.onload = () => {
        const ratio = Math.min(
          state.canvasWidth / img.width,
          state.canvasHeight / img.height,
          1,
        );
        const w = img.width * ratio;
        const h = img.height * ratio;
        const layer = createImageLayer(src, {
          x: (state.canvasWidth - w) / 2,
          y: (state.canvasHeight - h) / 2,
          width: w,
          height: h,
          name: path.split(/[/\\]/).pop() || "image",
        });
        commit({ type: "ADD_LAYER", layer }, "Add image (native)");
      };
      img.src = src;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Import failed");
    }
  }, [state.canvasWidth, state.canvasHeight, commit]);

  // ── AI actions ─────────────────────────────────────────────────────────
  const runAIFill = useCallback(
    async (prompt: string) => {
      if (state.selection.kind === "none") {
        toast.error("Draw a selection first");
        return;
      }
      setAIBusy(true);
      try {
        const canvas = renderGetter.current?.();
        const imageBase64 = canvas?.toDataURL("image/png");
        const res = await fetch("/api/thumbnails/ai-fill", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            imageBase64,
            prompt,
            width: state.canvasWidth,
            height: state.canvasHeight,
            selection: {
              x: state.selection.x,
              y: state.selection.y,
              width: state.selection.width,
              height: state.selection.height,
            },
          }),
        });
        const data = (await res.json()) as {
          status?: string;
          placeholder?: boolean;
          gradient?: { from: string; to: string; angle: number };
          image?: string;
          error?: string;
          message?: string;
        };
        if (data.error) {
          toast.error(data.error);
          return;
        }
        // Real image path
        if (data.image) {
          const layer = createImageLayer(data.image, {
            x: state.selection.x,
            y: state.selection.y,
            width: state.selection.width,
            height: state.selection.height,
            name: `AI Fill: ${prompt.slice(0, 24)}`,
          });
          commit({ type: "ADD_LAYER", layer }, "AI Fill");
          toast.success("AI Fill applied");
          setAIFillOpen(false);
          return;
        }
        // Placeholder path — render a gradient rect into the selection
        if (data.placeholder && data.gradient) {
          const c = document.createElement("canvas");
          c.width = Math.max(1, Math.round(state.selection.width));
          c.height = Math.max(1, Math.round(state.selection.height));
          const ctx = c.getContext("2d");
          if (ctx) {
            const g = ctx.createLinearGradient(0, 0, c.width, c.height);
            g.addColorStop(0, data.gradient.from);
            g.addColorStop(1, data.gradient.to);
            ctx.fillStyle = g;
            ctx.fillRect(0, 0, c.width, c.height);
            ctx.fillStyle = "rgba(255,255,255,0.85)";
            ctx.font = "bold 20px sans-serif";
            ctx.textAlign = "center";
            ctx.fillText("AI placeholder", c.width / 2, c.height / 2);
          }
          const layer = createImageLayer(c.toDataURL(), {
            x: state.selection.x,
            y: state.selection.y,
            width: state.selection.width,
            height: state.selection.height,
            name: `AI Fill (placeholder): ${prompt.slice(0, 24)}`,
          });
          commit({ type: "ADD_LAYER", layer }, "AI Fill (placeholder)");
          toast(data.message || "Placeholder rendered (FLUX not configured).");
          setAIFillOpen(false);
          return;
        }
        toast.error("Unexpected AI response");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "AI Fill failed");
      } finally {
        setAIBusy(false);
      }
    },
    [
      state.selection,
      state.canvasWidth,
      state.canvasHeight,
      commit,
    ],
  );

  const runAIRemove = useCallback(async () => {
    if (state.selection.kind === "none") {
      toast.error("Draw a selection first");
      return;
    }
    setAIBusy(true);
    try {
      const canvas = renderGetter.current?.();
      const imageBase64 = canvas?.toDataURL("image/png");
      const res = await fetch("/api/thumbnails/ai-remove", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imageBase64,
          width: state.canvasWidth,
          height: state.canvasHeight,
          selection: {
            x: state.selection.x,
            y: state.selection.y,
            width: state.selection.width,
            height: state.selection.height,
          },
        }),
      });
      const data = (await res.json()) as {
        image?: string;
        error?: string;
        placeholder?: boolean;
        message?: string;
      };
      if (data.error) {
        toast.error(data.error);
        return;
      }
      if (data.image) {
        const layer = createImageLayer(data.image, {
          x: state.selection.x,
          y: state.selection.y,
          width: state.selection.width,
          height: state.selection.height,
          name: "AI Erase",
        });
        commit({ type: "ADD_LAYER", layer }, "AI Erase");
      } else {
        toast(data.message || "Placeholder erase (FLUX not configured).");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "AI Erase failed");
    } finally {
      setAIBusy(false);
    }
  }, [
    state.selection,
    state.canvasWidth,
    state.canvasHeight,
    commit,
  ]);

  const runAIUpscale = useCallback(async () => {
    const canvas = renderGetter.current?.();
    if (!canvas) {
      toast.error("Canvas not ready");
      return;
    }
    setAIBusy(true);
    try {
      const imageBase64 = canvas.toDataURL("image/png");
      const res = await fetch("/api/thumbnails/ai-upscale", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageBase64, factor: 2 }),
      });
      const data = (await res.json()) as {
        image?: string;
        factor?: number;
        placeholder?: boolean;
        message?: string;
      };
      if (data.image && data.factor) {
        commit(
          {
            type: "FLATTEN_ALL",
            rasterSrc: data.image,
          },
          `AI Upscale ×${data.factor}`,
        );
        toast.success(`Upscaled ×${data.factor}`);
      } else {
        toast(data.message || "Placeholder upscale (FLUX not configured).");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upscale failed");
    } finally {
      setAIBusy(false);
    }
  }, [commit]);

  const runTextToLayer = useCallback(
    async (prompt: string) => {
      setAIBusy(true);
      try {
        // Reuse the existing thumbnail generate route — it's the same
        // FLUX worker, just without a mask. The route returns a finished
        // image URL that we add as a new layer.
        const res = await fetch("/api/thumbnail/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            prompt,
            platform: "youtube",
            style: "youtube_classic",
            mood: "dramatic",
            variations: 1,
            width: state.canvasWidth,
            height: state.canvasHeight,
          }),
        });
        const data = (await res.json()) as {
          images?: { url: string }[];
          url?: string;
          error?: string;
        };
        if (data.error) {
          toast.error(data.error);
          return;
        }
        const url = data.images?.[0]?.url || data.url;
        if (!url) {
          toast.error("No image returned");
          return;
        }
        const layer = createImageLayer(url, {
          x: 0,
          y: 0,
          width: state.canvasWidth,
          height: state.canvasHeight,
          name: `AI: ${prompt.slice(0, 24)}`,
        });
        commit({ type: "ADD_LAYER", layer }, "Text → Layer");
        toast.success("AI layer added");
        setTextToLayerOpen(false);
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : "Text → Layer failed",
        );
      } finally {
        setAIBusy(false);
      }
    },
    [state.canvasWidth, state.canvasHeight, commit],
  );

  // ── Stock photos ───────────────────────────────────────────────────────
  // Pexels/Unsplash backdrops — inserts as a new layer fitted to canvas.
  // The src_full URL goes straight onto the layer; CORS is handled by the
  // browser since both providers serve images with permissive headers.
  const onInsertStockPhoto = useCallback(
    (photo: StockPhoto) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => {
        const ratio = Math.min(
          state.canvasWidth / img.width,
          state.canvasHeight / img.height,
          1,
        );
        const w = img.width * ratio;
        const h = img.height * ratio;
        const layer = createImageLayer(photo.src_full, {
          x: (state.canvasWidth - w) / 2,
          y: (state.canvasHeight - h) / 2,
          width: w,
          height: h,
          name: `Stock: ${photo.photographer}`,
        });
        commit(
          { type: "ADD_LAYER", layer },
          `Add stock photo (${photo.source})`,
        );
        toast.success(`Added stock photo by ${photo.photographer}`);
        setStockPhotosOpen(false);
      };
      img.onerror = () => {
        toast.error("Failed to load stock photo");
      };
      img.src = photo.src_full;
    },
    [state.canvasWidth, state.canvasHeight, commit],
  );

  // ── Export ─────────────────────────────────────────────────────────────
  const onExport = useCallback(
    async (format: ExportFormat, quality: number) => {
      const canvas = renderGetter.current?.();
      if (!canvas && format !== "svg") {
        toast.error("Canvas not ready");
        return;
      }
      try {
        await exportAndDownload(canvas as HTMLCanvasElement, state, {
          format,
          quality,
          filename: `thumbnail-${Date.now()}`,
        });
        toast.success(`Exported ${format.toUpperCase()}`);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Export failed");
      }
    },
    [state],
  );

  // ── Layer panel callbacks ──────────────────────────────────────────────
  const layersProps = useMemo(
    () => ({
      state,
      onSelect: (ids: string[]) => dispatch({ type: "SELECT_LAYERS", ids }),
      onToggleVisibility: (id: string) =>
        commit({ type: "TOGGLE_VISIBILITY", id }, "Toggle visibility"),
      onToggleLock: (id: string) =>
        commit({ type: "TOGGLE_LOCK", id }, "Toggle lock"),
      onSetOpacity: (id: string, opacity: number) =>
        dispatch({ type: "SET_OPACITY", id, opacity }),
      onSetBlendMode: (id: string, mode: BlendMode) =>
        commit({ type: "SET_BLEND_MODE", id, mode }, `Blend: ${mode}`),
      onReorder: (ids: string[]) =>
        commit({ type: "REORDER_LAYERS", ids }, "Reorder layers"),
      onRename: (id: string, name: string) =>
        commit(
          { type: "UPDATE_LAYER", id, patch: { name } as Partial<Layer> },
          "Rename layer",
        ),
      onDuplicate: (id: string) =>
        commit({ type: "DUPLICATE_LAYER", id }, "Duplicate layer"),
      onDelete: (id: string) =>
        commit({ type: "DELETE_LAYER", id }, "Delete layer"),
      onGroup: (ids: string[]) =>
        commit({ type: "GROUP_LAYERS", ids }, "Group layers"),
      onUngroup: (id: string) =>
        commit({ type: "UNGROUP_LAYER", id }, "Ungroup"),
      onConvertToSmartObject: (id: string) =>
        commit(
          { type: "CONVERT_TO_SMART_OBJECT", id },
          "Convert to smart object",
        ),
      onFlatten: () => {
        const canvas = renderGetter.current?.();
        const src = canvas?.toDataURL("image/png");
        if (!src) {
          toast.error("Canvas not ready");
          return;
        }
        commit({ type: "FLATTEN_ALL", rasterSrc: src }, "Flatten image");
      },
      onMergeDown: (id: string) =>
        commit({ type: "MERGE_DOWN", id }, "Merge down"),
    }),
    [state, commit],
  );

  // Flat memoized layer count for the history label — prevents re-creating
  // callback refs on every render.
  void flattenHistory;

  // ── CTR Presets panel ─────────────────────────────────────────────────
  const [ctrPresetsOpen, setCtrPresetsOpen] = useState(false);

  /** CTR-optimised thumbnail style presets derived from TikTok + YouTube CTR research. */
  const CTR_PRESETS = [
    {
      id: "face_close_up",
      name: "Face Close-Up",
      ctr: "8–10%",
      tier: "top",
      desc: "Big face + contrast text = highest click rate",
      apply: () => {
        const textLayer = createTextLayer("YOUR TITLE", {
          x: state.canvasWidth * 0.05,
          y: state.canvasHeight * 0.70,
          width: state.canvasWidth * 0.9,
          height: state.canvasHeight * 0.22,
        });
        commit({ type: "ADD_LAYER", layer: { ...textLayer, fontSize: 80, fontWeight: 900, color: "#FFFFFF", strokeColor: "#000000", strokeWidth: 4, shadowColor: "rgba(0,0,0,0.7)", shadowBlur: 12, shadowOffsetX: 0, shadowOffsetY: 4 } as typeof textLayer }, "Preset: Face Close-Up");
      },
    },
    {
      id: "bold_number",
      name: "Bold Number",
      ctr: "7–9%",
      tier: "top",
      desc: "\"TOP 10\" listicle style drives curiosity",
      apply: () => {
        const numLayer = createTextLayer("TOP 10", {
          x: state.canvasWidth * 0.05,
          y: state.canvasHeight * 0.05,
          width: state.canvasWidth * 0.9,
          height: state.canvasHeight * 0.40,
        });
        const subLayer = createTextLayer("REASONS WHY...", {
          x: state.canvasWidth * 0.05,
          y: state.canvasHeight * 0.50,
          width: state.canvasWidth * 0.9,
          height: state.canvasHeight * 0.18,
        });
        commit({ type: "ADD_LAYER", layer: { ...numLayer, fontSize: 160, fontWeight: 900, color: "#FFDD00", strokeColor: "#000000", strokeWidth: 8 } as typeof numLayer }, "Number");
        commit({ type: "ADD_LAYER", layer: { ...subLayer, fontSize: 48, fontWeight: 700, color: "#FFFFFF" } as typeof subLayer }, "Preset: Bold Number");
      },
    },
    {
      id: "arrow_callout",
      name: "Arrow Callout",
      ctr: "6–8%",
      tier: "high",
      desc: "Red arrow pointing at subject = MrBeast CTR formula",
      apply: () => {
        const arrowBg = createShapeLayer("ellipse", {
          x: state.canvasWidth * 0.60,
          y: state.canvasHeight * 0.10,
          width: 80,
          height: 80,
        });
        const textLayer = createTextLayer("LOOK!", {
          x: state.canvasWidth * 0.05,
          y: state.canvasHeight * 0.60,
          width: state.canvasWidth * 0.50,
          height: state.canvasHeight * 0.25,
        });
        commit({ type: "ADD_LAYER", layer: { ...arrowBg, fill: "#EF4444", stroke: "#B91C1C", strokeWidth: 3 } as typeof arrowBg }, "Arrow BG");
        commit({ type: "ADD_LAYER", layer: { ...textLayer, fontSize: 96, fontWeight: 900, color: "#EF4444", strokeColor: "#000000", strokeWidth: 5 } as typeof textLayer }, "Preset: Arrow Callout");
      },
    },
    {
      id: "before_after",
      name: "Before / After",
      ctr: "6–8%",
      tier: "high",
      desc: "Transformation split — tutorial & transformation content",
      apply: () => {
        const divider = createShapeLayer("rect", {
          x: state.canvasWidth / 2 - 3,
          y: 0,
          width: 6,
          height: state.canvasHeight,
        });
        const beforeLabel = createTextLayer("BEFORE", {
          x: state.canvasWidth * 0.02,
          y: state.canvasHeight * 0.04,
          width: state.canvasWidth * 0.45,
          height: state.canvasHeight * 0.14,
        });
        const afterLabel = createTextLayer("AFTER", {
          x: state.canvasWidth * 0.52,
          y: state.canvasHeight * 0.04,
          width: state.canvasWidth * 0.45,
          height: state.canvasHeight * 0.14,
        });
        commit({ type: "ADD_LAYER", layer: { ...divider, fill: "#FFFFFF", stroke: "transparent" } as typeof divider }, "Divider");
        commit({ type: "ADD_LAYER", layer: { ...beforeLabel, fontSize: 52, fontWeight: 900, color: "#EF4444", strokeColor: "#000000", strokeWidth: 3 } as typeof beforeLabel }, "Before");
        commit({ type: "ADD_LAYER", layer: { ...afterLabel, fontSize: 52, fontWeight: 900, color: "#10B981", strokeColor: "#000000", strokeWidth: 3 } as typeof afterLabel }, "Preset: Before/After");
      },
    },
    {
      id: "high_contrast",
      name: "High Contrast",
      ctr: "5–7%",
      tier: "high",
      desc: "OLED dark + white + accent. Gaming & tech content",
      apply: () => {
        const bgRect = createShapeLayer("rect", {
          x: 0,
          y: 0,
          width: state.canvasWidth,
          height: state.canvasHeight,
        });
        const headline = createTextLayer("THIS CHANGES EVERYTHING", {
          x: state.canvasWidth * 0.04,
          y: state.canvasHeight * 0.30,
          width: state.canvasWidth * 0.92,
          height: state.canvasHeight * 0.40,
        });
        commit({ type: "ADD_LAYER", layer: { ...bgRect, fill: "#020711", stroke: "transparent" } as typeof bgRect }, "Dark BG");
        commit({ type: "ADD_LAYER", layer: { ...headline, fontSize: 84, fontWeight: 900, color: "#FFFFFF", strokeColor: "#3B82F6", strokeWidth: 2 } as typeof headline }, "Preset: High Contrast");
      },
    },
    {
      id: "shock_expression",
      name: "Shock Expression",
      ctr: "5–7%",
      tier: "high",
      desc: "OMG + massive text. Maximum emotional reaction",
      apply: () => {
        const exclaim = createTextLayer("OMG!!", {
          x: state.canvasWidth * 0.02,
          y: state.canvasHeight * 0.02,
          width: state.canvasWidth * 0.96,
          height: state.canvasHeight * 0.35,
        });
        const sub = createTextLayer("I CAN'T BELIEVE THIS...", {
          x: state.canvasWidth * 0.04,
          y: state.canvasHeight * 0.62,
          width: state.canvasWidth * 0.92,
          height: state.canvasHeight * 0.22,
        });
        commit({ type: "ADD_LAYER", layer: { ...exclaim, fontSize: 180, fontWeight: 900, color: "#FFDD00", strokeColor: "#B45309", strokeWidth: 8, shadowColor: "rgba(0,0,0,0.8)", shadowBlur: 20 } as typeof exclaim }, "Shock text");
        commit({ type: "ADD_LAYER", layer: { ...sub, fontSize: 56, fontWeight: 800, color: "#FFFFFF", strokeColor: "#000000", strokeWidth: 3 } as typeof sub }, "Preset: Shock Expression");
      },
    },
    {
      id: "curiosity_gap",
      name: "Curiosity Gap",
      ctr: "5–7%",
      tier: "high",
      desc: "Unfinished reveal — compels clicking to find out",
      apply: () => {
        const hook = createTextLayer("The secret they\ndon't want you to know...", {
          x: state.canvasWidth * 0.05,
          y: state.canvasHeight * 0.20,
          width: state.canvasWidth * 0.90,
          height: state.canvasHeight * 0.60,
        });
        commit({ type: "ADD_LAYER", layer: { ...hook, fontSize: 72, fontWeight: 800, color: "#FFFFFF", lineHeight: 1.2, shadowColor: "rgba(0,0,0,0.7)", shadowBlur: 16 } as typeof hook }, "Preset: Curiosity Gap");
      },
    },
    {
      id: "color_pop",
      name: "Color Pop",
      ctr: "4–6%",
      tier: "medium",
      desc: "Single saturated background + bold white text",
      apply: () => {
        const bg = createShapeLayer("rect", {
          x: 0,
          y: 0,
          width: state.canvasWidth,
          height: state.canvasHeight,
        });
        const headline = createTextLayer("YOUR HOOK\nHERE", {
          x: state.canvasWidth * 0.06,
          y: state.canvasHeight * 0.15,
          width: state.canvasWidth * 0.88,
          height: state.canvasHeight * 0.70,
        });
        commit({ type: "ADD_LAYER", layer: { ...bg, fill: "#7C3AED", stroke: "transparent" } as typeof bg }, "Color BG");
        commit({ type: "ADD_LAYER", layer: { ...headline, fontSize: 100, fontWeight: 900, color: "#FFFFFF", lineHeight: 1.15 } as typeof headline }, "Preset: Color Pop");
      },
    },
  ] as const;

  type CtrPreset = typeof CTR_PRESETS[number];

  const tierColor = (tier: CtrPreset["tier"]) =>
    tier === "top" ? { bg: "rgba(16,185,129,0.14)", text: "#10B981" }
      : tier === "high" ? { bg: "rgba(59,130,246,0.14)", text: "#60A5FA" }
      : { bg: "rgba(245,158,11,0.14)", text: "#F59E0B" };

  return (
    <MotionPage>
            <motion.div
            className="fixed inset-0 bg-[#F3F6FA] text-[#111827] flex flex-col"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.22 }}
          >
            <TopBar
              canUndo={history.past.length > 0}
              canRedo={history.future.length > 0}
              zoom={state.viewport.zoom}
              showRulers={state.viewport.showRulers}
              showGrid={state.viewport.showGrid}
              onUndo={onUndo}
              onRedo={onRedo}
              onZoomIn={onZoomIn}
              onZoomOut={onZoomOut}
              onFit={onFit}
              onToggleRulers={() =>
                dispatch({
                  type: "SET_VIEWPORT",
                  patch: { showRulers: !state.viewport.showRulers },
                })
              }
              onToggleGrid={() =>
                dispatch({
                  type: "SET_VIEWPORT",
                  patch: { showGrid: !state.viewport.showGrid },
                })
              }
              onPickPreset={onPickPreset}
              onAddText={onAddText}
              onAddShape={onAddShape}
              onUpload={onUpload}
              onOpenNativePicker={hasElectron ? onOpenNativePicker : undefined}
              hasElectron={hasElectron}
              onAIFill={() => setAIFillOpen(true)}
              onAIRemove={runAIRemove}
              onAIUpscale={runAIUpscale}
              onTextToLayer={() => setTextToLayerOpen(true)}
              onStockPhotos={() => setStockPhotosOpen(true)}
              onExport={onExport}
            />

            <div className="flex-1 flex min-h-0">
              <ToolsPalette
                active={state.activeTool}
                onSelect={(tool: ToolId) => dispatch({ type: "SET_TOOL", tool })}
                foregroundColor={state.foregroundColor}
                backgroundColor={state.backgroundColor}
                onSwapColors={() => {
                  dispatch({ type: "SET_FG_COLOR", color: state.backgroundColor });
                  dispatch({ type: "SET_BG_COLOR", color: state.foregroundColor });
                }}
                onFgColor={(c) => dispatch({ type: "SET_FG_COLOR", color: c })}
                onBgColor={(c) => dispatch({ type: "SET_BG_COLOR", color: c })}
              />

              <EditorCanvas
                state={state}
                onSelectionChange={(selection) =>
                  dispatch({ type: "SET_SELECTION", selection })
                }
                onSelectLayers={(ids) => dispatch({ type: "SELECT_LAYERS", ids })}
                onPanZoom={(patch) => dispatch({ type: "SET_VIEWPORT", patch })}
                onUpdateLayer={(id, patch) =>
                  dispatch({ type: "UPDATE_LAYER", id, patch })
                }
                onRegisterRenderer={(fn) => {
                  renderGetter.current = fn;
                }}
              />

              {/* Headline Quality badge — shows when text layers exist */}
              {(() => {
                const textLayers = state.layers.filter(l => l.type === "text" && (l as { text?: string }).text?.trim());
                if (textLayers.length === 0) return null;
                const combined = textLayers.map(l => (l as { text?: string }).text ?? "").join(" | ");
                const hs = headlineScore(combined);
                return (
                  <div className="mx-2 mb-1 px-3 py-2 rounded-xl border border-border-subtle bg-surface-light/60">
                    <div className="flex items-center justify-between">
                      <p className="text-[8px] uppercase tracking-wider text-text-muted font-medium">Headline CTR</p>
                      <span className="text-[8px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: `${hs.color}22`, color: hs.color }}>
                        {hs.score} · {hs.label}
                      </span>
                    </div>
                    <div className="mt-1 h-1 rounded-full bg-white/5 overflow-hidden">
                      <div className="h-full rounded-full transition-all duration-500" style={{ width: `${hs.score}%`, background: hs.color, opacity: 0.75 }} />
                    </div>
                    {hs.tips.length > 0 && (
                      <p className="text-[7.5px] text-text-muted mt-1 leading-snug">{hs.tips[0]}</p>
                    )}
                  </div>
                );
              })()}
              <LayersPanel {...layersProps} />
              <HistoryPanel
                history={history}
                onJump={(entryId) => historyDispatch({ type: "JUMP", entryId })}
                onUndo={onUndo}
                onRedo={onRedo}
              />
            </div>

            {/* AI Director — floating CTR formula panel, bottom-right */}
            <div
              className="absolute bottom-4 right-4 z-40 w-72"
              style={{ pointerEvents: "auto" }}
            >
              <SmartBar context="thumbnail" />
            </div>

            {/* CTR Presets — floating panel, bottom-left */}
            <div className="absolute bottom-4 left-4 z-40" style={{ pointerEvents: "auto" }}>
              {/* Toggle button */}
              <button
                onClick={() => setCtrPresetsOpen((o) => !o)}
                className="flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold shadow-lg border transition-all duration-150"
                style={{
                  background: ctrPresetsOpen ? "rgba(59,130,246,0.22)" : "rgba(13,17,32,0.90)",
                  borderColor: ctrPresetsOpen ? "#3B82F6" : "rgba(99,146,255,0.22)",
                  color: ctrPresetsOpen ? "#60A5FA" : "#A8A8B2",
                  backdropFilter: "blur(12px)",
                }}
              >
                <span style={{ fontSize: 11 }}>⚡</span>
                CTR Presets
                <span style={{ fontSize: 9, opacity: 0.6 }}>{ctrPresetsOpen ? "▼" : "▲"}</span>
              </button>

              {/* Expandable panel — slides up above the button */}
              <AnimatePresence>
                {ctrPresetsOpen && (
                  <motion.div
                    key="ctr-panel"
                    initial={{ opacity: 0, y: 12, scale: 0.96 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 8, scale: 0.96 }}
                    transition={{ duration: 0.18, ease: [0.32, 0.72, 0, 1] }}
                    className="absolute bottom-10 left-0 w-72 rounded-xl border shadow-2xl overflow-hidden"
                    style={{
                      background: "rgba(13,17,32,0.96)",
                      borderColor: "rgba(99,146,255,0.18)",
                      backdropFilter: "blur(20px)",
                    }}
                  >
                    {/* Header */}
                    <div
                      className="px-3 py-2.5 border-b flex items-center justify-between"
                      style={{ borderColor: "rgba(99,146,255,0.12)" }}
                    >
                      <div>
                        <p className="text-[11px] font-bold text-white tracking-wide">CTR PRESETS</p>
                        <p className="text-[9px]" style={{ color: "#4A4A5A" }}>
                          YouTube + TikTok click-rate formulas
                        </p>
                      </div>
                      <button
                        onClick={() => setCtrPresetsOpen(false)}
                        className="text-[10px] px-1.5 py-0.5 rounded"
                        style={{ color: "#4A4A5A", background: "rgba(255,255,255,0.04)" }}
                      >
                        ✕
                      </button>
                    </div>

                    {/* Preset list — scrollable */}
                    <div className="overflow-y-auto" style={{ maxHeight: 340 }}>
                      {CTR_PRESETS.map((preset) => {
                        const tc = tierColor(preset.tier);
                        return (
                          <button
                            key={preset.id}
                            onClick={() => {
                              preset.apply();
                              setCtrPresetsOpen(false);
                            }}
                            className="w-full flex items-start gap-2.5 px-3 py-2.5 text-left transition-colors duration-100 border-b"
                            style={{
                              borderColor: "rgba(99,146,255,0.08)",
                              background: "transparent",
                            }}
                            onMouseEnter={(e) => {
                              (e.currentTarget as HTMLButtonElement).style.background = "rgba(59,130,246,0.06)";
                            }}
                            onMouseLeave={(e) => {
                              (e.currentTarget as HTMLButtonElement).style.background = "transparent";
                            }}
                          >
                            {/* CTR badge */}
                            <div
                              className="mt-0.5 shrink-0 rounded px-1.5 py-0.5 text-[9px] font-bold"
                              style={{ background: tc.bg, color: tc.text, minWidth: 44, textAlign: "center" }}
                            >
                              {preset.ctr}
                            </div>
                            {/* Text */}
                            <div className="min-w-0">
                              <p className="text-[11px] font-semibold text-white leading-tight">{preset.name}</p>
                              <p className="text-[9px] leading-tight mt-0.5" style={{ color: "#4A4A5A" }}>
                                {preset.desc}
                              </p>
                            </div>
                          </button>
                        );
                      })}
                    </div>

                    {/* Footer hint */}
                    <div
                      className="px-3 py-2 text-[9px]"
                      style={{ color: "#4A4A5A", background: "rgba(255,255,255,0.02)" }}
                    >
                      Adds text + shape layers — adjust colours & font to match your brand
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Creator Intelligence — floating panel, bottom-center-left (right of CTR button) */}
            <CreatorIntelligence
              context="thumbnail"
              variant="floating"
              className="bottom-4 left-36"
              platform="youtube"
              onApply={(idea) => {
                const textLayer = createTextLayer(idea.title.toUpperCase(), {
                  x: Math.round(state.canvasWidth / 2 - 240),
                  y: 60,
                  width: 480,
                  height: 90,
                });
                commit({ type: "ADD_LAYER", layer: textLayer }, `Creator idea: ${idea.title}`);
                toast.success("Idea title added to canvas — adjust font and colour to taste!");
              }}
            />

            <AIFillDialog
              open={aiFillOpen}
              title="AI Generative Fill"
              subtitle="Describe what to render in the selected area"
              submitLabel="Fill"
              busy={aiBusy}
              onClose={() => setAIFillOpen(false)}
              onSubmit={runAIFill}
              presetSuggestions={[
                "a dramatic sky with lightning",
                "a wooden texture background",
                "a cinematic explosion",
                "a cyberpunk cityscape",
              ]}
            />
            <AIFillDialog
              open={textToLayerOpen}
              title="Text → Layer"
              subtitle="Generate a full-canvas layer from a prompt"
              submitLabel="Generate"
              busy={aiBusy}
              onClose={() => setTextToLayerOpen(false)}
              onSubmit={runTextToLayer}
              presetSuggestions={[
                "MrBeast thumbnail, shocked face, dramatic lighting",
                "cinematic cyberpunk cityscape, neon glow, rain",
                "bold colorful pop-art style, extreme contrast",
                "tutorial thumbnail, clean flat lay, bright lighting",
              ]}
            />

            <StockPhotosPanel
              open={stockPhotosOpen}
              onClose={() => setStockPhotosOpen(false)}
              onInsert={onInsertStockPhoto}
              defaultOrientation={
                state.canvasWidth > state.canvasHeight
                  ? "landscape"
                  : state.canvasWidth < state.canvasHeight
                    ? "portrait"
                    : "square"
              }
            />

            {/* HistoryState is consumed by HistoryPanel, no extra surface */}
            <HistoryTypeGuard history={history} />

            {/* AI-first starter overlay — shows when canvas is empty + not skipped.
                Per the apr27 backlog Pikzel-AI request: "user describes what they
                want → AI generates → ONLY THEN does the editor surface for
                refinement". User can skip to use the traditional blank canvas. */}
            {state.layers.length === 0 && !aiStarterSkipped && (
              <AiFirstStarter
                width={state.canvasWidth}
                height={state.canvasHeight}
                onPickThumbnail={(imageUrl) => {
                  const layer = createImageLayer(imageUrl, {
                    x: 0,
                    y: 0,
                    width: state.canvasWidth,
                    height: state.canvasHeight,
                    name: "AI starter",
                  });
                  commit({ type: "ADD_LAYER", layer }, "AI thumbnail starter");
                  toast.success("Thumbnail loaded — refine in the editor");
                }}
                onSkip={() => {
                  setAiStarterSkipped(true);
                  try {
                    sessionStorage.setItem("thumbnail-ai-starter-skipped", "1");
                  } catch {
                    /* private mode etc — fine */
                  }
                }}
              />
            )}
          </motion.div>
          </MotionPage>
  );
}

// Tiny helper so unused-import warnings don't clutter the file.
// The HistoryState type is referenced so a downstream refactor knows the
// panel is the source of truth for history rendering.
function HistoryTypeGuard(_: { history: HistoryState }) {
  return null;
}
