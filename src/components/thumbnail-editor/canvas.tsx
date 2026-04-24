"use client";

// Editor canvas — renders the layer stack into an HTML5 canvas, manages
// pan/zoom + rulers + grid + checkerboard transparent background, and
// handles drawing selections (rect/ellipse/lasso).
//
// We intentionally hand-roll canvas drawing instead of bringing in Konva —
// the spec allows Konva but we stay dependency-free to keep the branch
// surface small. If performance becomes an issue we can swap later.

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type {
  EditorState,
  Layer,
  Selection,
  ImageLayer,
  TextLayer,
  ShapeLayer,
  GroupLayer,
  SmartObjectLayer,
} from "@/lib/thumbnail-editor/types";
import { blendModeToCanvas } from "@/lib/thumbnail-editor/blend-modes";

interface CanvasProps {
  state: EditorState;
  onSelectionChange: (sel: Selection) => void;
  onSelectLayers: (ids: string[]) => void;
  onPanZoom: (patch: {
    zoom?: number;
    panX?: number;
    panY?: number;
  }) => void;
  onUpdateLayer: (id: string, patch: Partial<Layer>) => void;
  onRegisterRenderer?: (fn: () => HTMLCanvasElement | null) => void;
}

// Image cache — dataURL / remote URL -> HTMLImageElement
const imageCache = new Map<string, HTMLImageElement>();

function loadImage(src: string): HTMLImageElement {
  const existing = imageCache.get(src);
  if (existing) return existing;
  const img = new Image();
  img.crossOrigin = "anonymous";
  img.src = src;
  imageCache.set(src, img);
  return img;
}

function drawCheckerboard(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
) {
  const size = 12;
  for (let y = 0; y < h; y += size) {
    for (let x = 0; x < w; x += size) {
      const even = (Math.floor(x / size) + Math.floor(y / size)) % 2 === 0;
      ctx.fillStyle = even ? "#262626" : "#1a1a1a";
      ctx.fillRect(x, y, size, size);
    }
  }
}

function drawLayer(ctx: CanvasRenderingContext2D, layer: Layer) {
  if (!layer.visible) return;
  ctx.save();
  ctx.globalAlpha = layer.opacity / 100;
  ctx.globalCompositeOperation = blendModeToCanvas(layer.blendMode);

  // Apply transforms around layer center for rotation
  const cx = layer.x + layer.width / 2;
  const cy = layer.y + layer.height / 2;
  if (layer.rotation !== 0) {
    ctx.translate(cx, cy);
    ctx.rotate((layer.rotation * Math.PI) / 180);
    ctx.translate(-cx, -cy);
  }

  switch (layer.type) {
    case "image": {
      const l = layer as ImageLayer;
      const img = loadImage(l.src);
      if (img.complete && img.naturalWidth > 0) {
        ctx.drawImage(img, l.x, l.y, l.width, l.height);
      } else {
        // Placeholder while loading
        ctx.fillStyle = "#333";
        ctx.fillRect(l.x, l.y, l.width, l.height);
      }
      break;
    }
    case "text": {
      const l = layer as TextLayer;
      ctx.textBaseline = "top";
      ctx.textAlign = l.align;
      const style = l.italic ? "italic " : "";
      ctx.font = `${style}${l.fontWeight} ${l.fontSize}px ${l.fontFamily}`;
      // Shadow
      if (l.shadowColor && (l.shadowBlur ?? 0) > 0) {
        ctx.shadowColor = l.shadowColor;
        ctx.shadowBlur = l.shadowBlur ?? 0;
        ctx.shadowOffsetX = l.shadowOffsetX ?? 0;
        ctx.shadowOffsetY = l.shadowOffsetY ?? 0;
      }
      // Stroke first, then fill (so fill sits on top for a knockout look)
      const lines = l.text.split("\n");
      const lineH = l.fontSize * l.lineHeight;
      const anchorX =
        l.align === "center"
          ? l.x + l.width / 2
          : l.align === "right"
            ? l.x + l.width
            : l.x;
      if (l.strokeColor && (l.strokeWidth ?? 0) > 0) {
        ctx.strokeStyle = l.strokeColor;
        ctx.lineWidth = l.strokeWidth ?? 0;
        ctx.lineJoin = "round";
        lines.forEach((line, i) => {
          ctx.strokeText(line, anchorX, l.y + i * lineH);
        });
      }
      ctx.shadowColor = "transparent";
      ctx.fillStyle = l.color;
      lines.forEach((line, i) => {
        ctx.fillText(line, anchorX, l.y + i * lineH);
      });
      break;
    }
    case "shape": {
      const l = layer as ShapeLayer;
      ctx.fillStyle = l.fill;
      if (l.stroke && (l.strokeWidth ?? 0) > 0) {
        ctx.strokeStyle = l.stroke;
        ctx.lineWidth = l.strokeWidth ?? 0;
      }
      if (l.shape === "rect") {
        ctx.fillRect(l.x, l.y, l.width, l.height);
        if (l.stroke) ctx.strokeRect(l.x, l.y, l.width, l.height);
      } else if (l.shape === "ellipse") {
        ctx.beginPath();
        ctx.ellipse(
          l.x + l.width / 2,
          l.y + l.height / 2,
          l.width / 2,
          l.height / 2,
          0,
          0,
          Math.PI * 2,
        );
        ctx.fill();
        if (l.stroke) ctx.stroke();
      } else if (l.shape === "polygon" && l.points && l.points.length > 0) {
        ctx.beginPath();
        ctx.moveTo(l.x + l.points[0].x, l.y + l.points[0].y);
        for (let i = 1; i < l.points.length; i++) {
          ctx.lineTo(l.x + l.points[i].x, l.y + l.points[i].y);
        }
        ctx.closePath();
        ctx.fill();
        if (l.stroke) ctx.stroke();
      }
      break;
    }
    case "group": {
      const g = layer as GroupLayer;
      // Paint children from the bottom of the children array up
      for (let i = g.children.length - 1; i >= 0; i--) {
        drawLayer(ctx, g.children[i]);
      }
      break;
    }
    case "smart-object": {
      const so = layer as SmartObjectLayer;
      // Render sub-composition to an offscreen canvas, then draw scaled
      const off = document.createElement("canvas");
      off.width = so.subWidth;
      off.height = so.subHeight;
      const octx = off.getContext("2d");
      if (octx) {
        for (let i = so.sub.length - 1; i >= 0; i--) {
          drawLayer(octx, so.sub[i]);
        }
        ctx.drawImage(off, so.x, so.y, so.width, so.height);
      }
      break;
    }
    case "adjustment":
      // Adjustment layers would apply filters to layers beneath. A full
      // implementation needs ctx.filter / image data manipulation; for
      // this drop we render nothing (adjustment is tracked in state
      // but not composited yet). Intentional — TODO for follow-up.
      break;
  }

  ctx.restore();
}

export default function EditorCanvas({
  state,
  onSelectionChange,
  onSelectLayers,
  onPanZoom,
  onUpdateLayer,
  onRegisterRenderer,
}: CanvasProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [containerSize, setContainerSize] = useState({ w: 0, h: 0 });
  const [isDrawingSel, setIsDrawingSel] = useState(false);
  const [drawStart, setDrawStart] = useState<{ x: number; y: number } | null>(
    null,
  );
  const [lassoPoints, setLassoPoints] = useState<
    { x: number; y: number }[]
  >([]);
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState<{
    x: number;
    y: number;
    panX: number;
    panY: number;
  } | null>(null);
  const [spaceHeld, setSpaceHeld] = useState(false);

  // Observe container size for fit-to-screen math
  useEffect(() => {
    if (!containerRef.current) return;
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        setContainerSize({ w: width, h: height });
      }
    });
    ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, []);

  // Hold-space to pan
  useEffect(() => {
    function down(e: KeyboardEvent) {
      if (e.code === "Space" && !spaceHeld) {
        const target = e.target as HTMLElement | null;
        if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)) {
          return;
        }
        e.preventDefault();
        setSpaceHeld(true);
      }
    }
    function up(e: KeyboardEvent) {
      if (e.code === "Space") setSpaceHeld(false);
    }
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, [spaceHeld]);

  // Composite render
  const render = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const { canvasWidth, canvasHeight, background, layers } = state;

    canvas.width = canvasWidth;
    canvas.height = canvasHeight;

    // Background — checkerboard for transparent, solid otherwise
    if (background === "transparent") {
      drawCheckerboard(ctx, canvasWidth, canvasHeight);
    } else {
      ctx.fillStyle = background;
      ctx.fillRect(0, 0, canvasWidth, canvasHeight);
    }

    // Paint layers bottom-up (layers[] is top-first in state)
    for (let i = layers.length - 1; i >= 0; i--) {
      drawLayer(ctx, layers[i]);
    }
  }, [state]);

  useEffect(() => {
    render();
    // Re-render when cached images finish loading. We attach handlers
    // once per src; when the image decodes we trigger another render.
    const toWatch: HTMLImageElement[] = [];
    function collect(layers: Layer[]) {
      for (const l of layers) {
        if (l.type === "image") {
          const img = loadImage(l.src);
          if (!img.complete) toWatch.push(img);
        } else if (l.type === "group") {
          collect(l.children);
        } else if (l.type === "smart-object") {
          collect(l.sub);
        }
      }
    }
    collect(state.layers);
    const onload = () => render();
    toWatch.forEach((img) => img.addEventListener("load", onload));
    return () =>
      toWatch.forEach((img) => img.removeEventListener("load", onload));
  }, [render, state.layers]);

  // Expose a getter so the page can snapshot the canvas for export /
  // history thumbnails without poking at refs.
  useEffect(() => {
    if (onRegisterRenderer) {
      onRegisterRenderer(() => canvasRef.current);
    }
  }, [onRegisterRenderer]);

  // Fit-to-screen zoom on mount / canvas-size change
  const fittedOnce = useRef(false);
  useEffect(() => {
    if (fittedOnce.current) return;
    if (containerSize.w === 0 || containerSize.h === 0) return;
    const padding = 48;
    const availW = containerSize.w - padding * 2;
    const availH = containerSize.h - padding * 2;
    const zoom = Math.min(availW / state.canvasWidth, availH / state.canvasHeight, 1);
    onPanZoom({ zoom, panX: 0, panY: 0 });
    fittedOnce.current = true;
  }, [containerSize, state.canvasWidth, state.canvasHeight, onPanZoom]);

  const { zoom, panX, panY, showRulers, showGrid } = state.viewport;

  // Wheel zoom with Cmd/Ctrl
  const onWheel = useCallback(
    (e: React.WheelEvent<HTMLDivElement>) => {
      if (!(e.metaKey || e.ctrlKey)) return;
      e.preventDefault();
      const delta = -e.deltaY * 0.002;
      const newZoom = Math.max(0.1, Math.min(8, zoom + delta));
      onPanZoom({ zoom: newZoom });
    },
    [zoom, onPanZoom],
  );

  // Map screen (container-relative) coords -> canvas coords
  const screenToCanvas = useCallback(
    (sx: number, sy: number) => {
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return { x: 0, y: 0 };
      const localX = sx - rect.left;
      const localY = sy - rect.top;
      const cx = (localX - panX - rect.width / 2) / zoom + state.canvasWidth / 2;
      const cy = (localY - panY - rect.height / 2) / zoom + state.canvasHeight / 2;
      return { x: cx, y: cy };
    },
    [panX, panY, zoom, state.canvasWidth, state.canvasHeight],
  );

  const onMouseDown = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const shouldPan = spaceHeld || state.activeTool === "hand" || e.button === 1;
      if (shouldPan) {
        setIsPanning(true);
        setPanStart({ x: e.clientX, y: e.clientY, panX, panY });
        return;
      }

      const { x, y } = screenToCanvas(e.clientX, e.clientY);

      if (state.activeTool === "marquee-rect" || state.activeTool === "marquee-ellipse") {
        setIsDrawingSel(true);
        setDrawStart({ x, y });
      } else if (state.activeTool === "lasso") {
        setLassoPoints([{ x, y }]);
        setIsDrawingSel(true);
      } else if (state.activeTool === "move") {
        // Click a layer to select — topmost hit wins
        const hit = hitTestTopLevel(state.layers, x, y);
        if (hit) {
          onSelectLayers([hit.id]);
        } else {
          onSelectLayers([]);
        }
      }
    },
    [
      spaceHeld,
      state.activeTool,
      state.layers,
      panX,
      panY,
      onSelectLayers,
      screenToCanvas,
    ],
  );

  const onMouseMove = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (isPanning && panStart) {
        const dx = e.clientX - panStart.x;
        const dy = e.clientY - panStart.y;
        onPanZoom({ panX: panStart.panX + dx, panY: panStart.panY + dy });
        return;
      }
      if (!isDrawingSel) return;
      const { x, y } = screenToCanvas(e.clientX, e.clientY);
      if (state.activeTool === "lasso") {
        setLassoPoints((prev) => [...prev, { x, y }]);
      } else if (drawStart) {
        const sel: Selection = {
          kind: state.activeTool === "marquee-ellipse" ? "ellipse" : "rect",
          x: Math.min(drawStart.x, x),
          y: Math.min(drawStart.y, y),
          width: Math.abs(x - drawStart.x),
          height: Math.abs(y - drawStart.y),
        };
        onSelectionChange(sel);
      }
    },
    [
      isDrawingSel,
      isPanning,
      panStart,
      drawStart,
      state.activeTool,
      onSelectionChange,
      onPanZoom,
      screenToCanvas,
    ],
  );

  const onMouseUp = useCallback(() => {
    if (isPanning) {
      setIsPanning(false);
      setPanStart(null);
      return;
    }
    if (!isDrawingSel) return;
    setIsDrawingSel(false);
    if (state.activeTool === "lasso" && lassoPoints.length > 2) {
      // Build bounding box for lasso
      const xs = lassoPoints.map((p) => p.x);
      const ys = lassoPoints.map((p) => p.y);
      const minX = Math.min(...xs);
      const maxX = Math.max(...xs);
      const minY = Math.min(...ys);
      const maxY = Math.max(...ys);
      onSelectionChange({
        kind: "lasso",
        x: minX,
        y: minY,
        width: maxX - minX,
        height: maxY - minY,
        points: lassoPoints,
      });
      setLassoPoints([]);
    }
    setDrawStart(null);
  }, [isPanning, isDrawingSel, state.activeTool, lassoPoints, onSelectionChange]);

  // Fit-to-screen callback — exposed via a header button (we pass it
  // through viewport for now by letting the parent call onPanZoom).
  const fitToScreen = useCallback(() => {
    if (containerSize.w === 0 || containerSize.h === 0) return;
    const padding = 48;
    const availW = containerSize.w - padding * 2;
    const availH = containerSize.h - padding * 2;
    const newZoom = Math.min(
      availW / state.canvasWidth,
      availH / state.canvasHeight,
      1,
    );
    onPanZoom({ zoom: newZoom, panX: 0, panY: 0 });
  }, [containerSize, state.canvasWidth, state.canvasHeight, onPanZoom]);

  // Expose fit via a custom event — the top bar listens for this
  useEffect(() => {
    function onFit() {
      fitToScreen();
    }
    window.addEventListener("thumb-editor:fit", onFit);
    return () => window.removeEventListener("thumb-editor:fit", onFit);
  }, [fitToScreen]);

  const containerCursor = useMemo(() => {
    if (isPanning || spaceHeld || state.activeTool === "hand") return "grab";
    if (state.activeTool === "text") return "text";
    if (state.activeTool === "zoom") return "zoom-in";
    if (state.activeTool === "move") return "default";
    return "crosshair";
  }, [isPanning, spaceHeld, state.activeTool]);

  return (
    <div
      ref={containerRef}
      className="flex-1 relative overflow-hidden bg-neutral-950"
      style={{ cursor: containerCursor }}
      onWheel={onWheel}
      onMouseDown={onMouseDown}
      onMouseMove={onMouseMove}
      onMouseUp={onMouseUp}
      onMouseLeave={onMouseUp}
    >
      {/* Rulers */}
      {showRulers && (
        <>
          <div className="absolute top-0 left-6 right-0 h-6 bg-neutral-900 border-b border-neutral-800 z-10 pointer-events-none" />
          <div className="absolute top-0 left-0 bottom-0 w-6 bg-neutral-900 border-r border-neutral-800 z-10 pointer-events-none" />
        </>
      )}

      {/* Scaled artboard wrapper — rotate pan into CSS transform */}
      <div
        className="absolute top-1/2 left-1/2 origin-center"
        style={{
          transform: `translate(-50%, -50%) translate(${panX}px, ${panY}px) scale(${zoom})`,
          width: state.canvasWidth,
          height: state.canvasHeight,
          boxShadow: "0 0 0 1px rgba(255,255,255,0.08), 0 24px 48px rgba(0,0,0,0.6)",
        }}
      >
        {/* Checkerboard behind canvas for the transparent-bg case */}
        <canvas
          ref={canvasRef}
          className="block"
          style={{ width: state.canvasWidth, height: state.canvasHeight }}
        />

        {/* Grid overlay */}
        {showGrid && (
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              backgroundImage:
                "linear-gradient(to right, rgba(255,255,255,0.08) 1px, transparent 1px)," +
                "linear-gradient(to bottom, rgba(255,255,255,0.08) 1px, transparent 1px)",
              backgroundSize: "40px 40px",
            }}
          />
        )}

        {/* Selection overlay */}
        {state.selection.kind !== "none" && (
          <div
            className="absolute pointer-events-none border border-dashed border-cyan-300"
            style={{
              left: state.selection.x,
              top: state.selection.y,
              width: state.selection.width,
              height: state.selection.height,
              borderRadius:
                state.selection.kind === "ellipse" ? "50%" : undefined,
            }}
          />
        )}

        {/* Selected-layer transform box */}
        {state.selectedLayerIds.map((id) => {
          const l = findTopLevel(state.layers, id);
          if (!l) return null;
          return (
            <TransformHandles
              key={id}
              layer={l}
              onDrag={(dx, dy) =>
                onUpdateLayer(id, { x: l.x + dx, y: l.y + dy })
              }
              onResize={(w, h) => onUpdateLayer(id, { width: w, height: h })}
            />
          );
        })}
      </div>

      {/* Zoom indicator */}
      <div className="absolute bottom-2 left-2 bg-neutral-900/90 px-2 py-1 rounded text-xs text-neutral-400 border border-neutral-800 pointer-events-none">
        {(zoom * 100).toFixed(0)}%
      </div>
    </div>
  );
}

function findTopLevel(layers: Layer[], id: string): Layer | null {
  for (const l of layers) if (l.id === id) return l;
  return null;
}

function hitTestTopLevel(layers: Layer[], x: number, y: number): Layer | null {
  // Top-first order matches visual stack (index 0 is on top)
  for (const l of layers) {
    if (!l.visible) continue;
    if (
      x >= l.x &&
      x <= l.x + l.width &&
      y >= l.y &&
      y <= l.y + l.height
    ) {
      return l;
    }
  }
  return null;
}

interface TransformHandlesProps {
  layer: Layer;
  onDrag: (dx: number, dy: number) => void;
  onResize: (w: number, h: number) => void;
}

// Simple transform box — 4 corners + edges. We support drag-to-move on
// the whole bounding box and corner resize. Rotate handle is a top
// anchor. Kept minimal for now (skew/Cmd-modifier reserved for a
// follow-up commit).
function TransformHandles({ layer, onDrag, onResize }: TransformHandlesProps) {
  const [dragging, setDragging] = useState<
    | null
    | {
        kind: "move" | "resize-br";
        startX: number;
        startY: number;
        w: number;
        h: number;
      }
  >(null);

  useEffect(() => {
    if (!dragging) return;
    function onMove(e: MouseEvent) {
      const dx = e.clientX - dragging!.startX;
      const dy = e.clientY - dragging!.startY;
      if (dragging!.kind === "move") onDrag(dx, dy);
      else onResize(Math.max(8, dragging!.w + dx), Math.max(8, dragging!.h + dy));
    }
    function onUp() {
      setDragging(null);
    }
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [dragging, onDrag, onResize]);

  return (
    <div
      className="absolute border border-cyan-400"
      style={{
        left: layer.x,
        top: layer.y,
        width: layer.width,
        height: layer.height,
      }}
    >
      <div
        className="absolute inset-0 cursor-move"
        onMouseDown={(e) => {
          e.stopPropagation();
          setDragging({
            kind: "move",
            startX: e.clientX,
            startY: e.clientY,
            w: layer.width,
            h: layer.height,
          });
        }}
      />
      {/* Corners */}
      {([
        ["-left-1 -top-1", "nwse-resize"],
        ["-right-1 -top-1", "nesw-resize"],
        ["-left-1 -bottom-1", "nesw-resize"],
        ["-right-1 -bottom-1", "nwse-resize"],
      ] as const).map(([pos, cursor], i) => (
        <div
          key={i}
          className={`absolute ${pos} w-2 h-2 bg-cyan-400 border border-neutral-900`}
          style={{ cursor }}
          onMouseDown={(e) => {
            e.stopPropagation();
            if (i === 3) {
              setDragging({
                kind: "resize-br",
                startX: e.clientX,
                startY: e.clientY,
                w: layer.width,
                h: layer.height,
              });
            } else {
              // Other corners fall back to bottom-right-style resize
              setDragging({
                kind: "resize-br",
                startX: e.clientX,
                startY: e.clientY,
                w: layer.width,
                h: layer.height,
              });
            }
          }}
        />
      ))}
    </div>
  );
}
