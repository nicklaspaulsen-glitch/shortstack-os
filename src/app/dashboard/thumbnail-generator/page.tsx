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

  return (
    <div className="fixed inset-0 bg-neutral-950 text-neutral-100 flex flex-col">
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

        <LayersPanel {...layersProps} />
        <HistoryPanel
          history={history}
          onJump={(entryId) => historyDispatch({ type: "JUMP", entryId })}
          onUndo={onUndo}
          onRedo={onRedo}
        />
      </div>

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
    </div>
  );
}

// Tiny helper so unused-import warnings don't clutter the file.
// The HistoryState type is referenced so a downstream refactor knows the
// panel is the source of truth for history rendering.
function HistoryTypeGuard(_: { history: HistoryState }) {
  return null;
}
