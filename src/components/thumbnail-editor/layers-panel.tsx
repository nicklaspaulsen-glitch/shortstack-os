"use client";

// Right-side layers panel. Drag-to-reorder, visibility/lock/opacity/blend
// controls per layer, right-click context menu, tiny thumbnail preview
// generated on-demand via offscreen canvas.

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Eye,
  EyeOff,
  Lock,
  Unlock,
  Image as ImageIcon,
  Type,
  Square,
  Layers,
  Shapes,
  Sparkles,
  Folder,
  FolderOpen,
  ChevronDown,
  ChevronRight,
  Trash2,
  Copy,
  MoreHorizontal,
} from "lucide-react";
import type {
  BlendMode,
  EditorState,
  Layer,
  LayerType,
  ImageLayer,
  TextLayer,
  ShapeLayer,
  GroupLayer,
} from "@/lib/thumbnail-editor/types";
import { BLEND_MODE_OPTIONS } from "@/lib/thumbnail-editor/blend-modes";

const LAYER_ICONS: Record<LayerType, typeof ImageIcon> = {
  image: ImageIcon,
  text: Type,
  shape: Shapes,
  adjustment: Sparkles,
  "smart-object": Layers,
  group: Folder,
};

interface LayersPanelProps {
  state: EditorState;
  onSelect: (ids: string[]) => void;
  onToggleVisibility: (id: string) => void;
  onToggleLock: (id: string) => void;
  onSetOpacity: (id: string, opacity: number) => void;
  onSetBlendMode: (id: string, mode: BlendMode) => void;
  onReorder: (ids: string[]) => void;
  onRename: (id: string, name: string) => void;
  onDuplicate: (id: string) => void;
  onDelete: (id: string) => void;
  onGroup: (ids: string[]) => void;
  onUngroup: (id: string) => void;
  onConvertToSmartObject: (id: string) => void;
  onFlatten: () => void;
  onMergeDown: (id: string) => void;
}

export default function LayersPanel(props: LayersPanelProps) {
  const { state, onSelect } = props;
  const selectedId = state.selectedLayerIds[0] || null;
  const selected = useMemo(
    () => state.layers.find((l) => l.id === selectedId) || null,
    [state.layers, selectedId],
  );

  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dropIndex, setDropIndex] = useState<number | null>(null);
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    id: string;
  } | null>(null);

  useEffect(() => {
    function onDocClick() {
      setContextMenu(null);
    }
    if (contextMenu) {
      window.addEventListener("click", onDocClick);
      return () => window.removeEventListener("click", onDocClick);
    }
  }, [contextMenu]);

  const handleDrop = useCallback(() => {
    if (draggingId && dropIndex !== null) {
      const ids = state.layers.map((l) => l.id);
      const fromIdx = ids.indexOf(draggingId);
      if (fromIdx >= 0) {
        const next = ids.slice();
        next.splice(fromIdx, 1);
        const insertAt = dropIndex > fromIdx ? dropIndex - 1 : dropIndex;
        next.splice(insertAt, 0, draggingId);
        props.onReorder(next);
      }
    }
    setDraggingId(null);
    setDropIndex(null);
  }, [draggingId, dropIndex, state.layers, props]);

  return (
    <div className="w-72 bg-neutral-900 border-l border-neutral-800 flex flex-col text-neutral-200 text-sm">
      <div className="flex items-center justify-between px-3 py-2 border-b border-neutral-800">
        <span className="font-semibold text-neutral-100">Layers</span>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={props.onFlatten}
            title="Flatten Image"
            className="text-neutral-400 hover:text-neutral-100 px-1"
          >
            <Layers className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Blend mode + opacity for selected layer */}
      <div className="px-3 py-2 border-b border-neutral-800 space-y-2">
        <div className="flex items-center gap-2">
          <span className="w-12 text-xs text-neutral-400">Blend</span>
          <select
            value={selected?.blendMode || "normal"}
            disabled={!selected}
            onChange={(e) =>
              selected &&
              props.onSetBlendMode(selected.id, e.target.value as BlendMode)
            }
            className="flex-1 bg-neutral-800 border border-neutral-700 rounded px-2 py-1 text-xs"
          >
            {BLEND_MODE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-12 text-xs text-neutral-400">Opacity</span>
          <input
            type="range"
            min={0}
            max={100}
            value={selected?.opacity ?? 100}
            disabled={!selected}
            onChange={(e) =>
              selected && props.onSetOpacity(selected.id, Number(e.target.value))
            }
            className="flex-1 accent-blue-500"
          />
          <span className="w-8 text-xs text-neutral-400 text-right">
            {selected?.opacity ?? 100}%
          </span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {state.layers.length === 0 && (
          <div className="p-4 text-xs text-neutral-500 text-center">
            Drop an image or click "+ Text" to add the first layer.
          </div>
        )}
        {state.layers.map((layer, idx) => (
          <div
            key={layer.id}
            onDragOver={(e) => {
              e.preventDefault();
              setDropIndex(idx);
            }}
          >
            {dropIndex === idx && draggingId !== layer.id && (
              <div className="h-0.5 bg-cyan-400 mx-2" />
            )}
            <LayerRow
              layer={layer}
              depth={0}
              selected={state.selectedLayerIds.includes(layer.id)}
              onSelect={(additive) => {
                if (additive) {
                  onSelect([...state.selectedLayerIds, layer.id]);
                } else {
                  onSelect([layer.id]);
                }
              }}
              onToggleVisibility={() => props.onToggleVisibility(layer.id)}
              onToggleLock={() => props.onToggleLock(layer.id)}
              onRename={(name) => props.onRename(layer.id, name)}
              onContextMenu={(x, y) => setContextMenu({ x, y, id: layer.id })}
              onDragStart={() => setDraggingId(layer.id)}
              onDragEnd={handleDrop}
            />
          </div>
        ))}
        {dropIndex === state.layers.length && (
          <div className="h-0.5 bg-cyan-400 mx-2" />
        )}
      </div>

      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          layer={state.layers.find((l) => l.id === contextMenu.id) || null}
          onDuplicate={() => {
            props.onDuplicate(contextMenu.id);
            setContextMenu(null);
          }}
          onDelete={() => {
            props.onDelete(contextMenu.id);
            setContextMenu(null);
          }}
          onGroup={() => {
            props.onGroup(state.selectedLayerIds);
            setContextMenu(null);
          }}
          onUngroup={() => {
            props.onUngroup(contextMenu.id);
            setContextMenu(null);
          }}
          onFlatten={() => {
            props.onFlatten();
            setContextMenu(null);
          }}
          onMergeDown={() => {
            props.onMergeDown(contextMenu.id);
            setContextMenu(null);
          }}
          onConvertToSmart={() => {
            props.onConvertToSmartObject(contextMenu.id);
            setContextMenu(null);
          }}
        />
      )}
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Layer row
// ────────────────────────────────────────────────────────────────────────────

interface LayerRowProps {
  layer: Layer;
  depth: number;
  selected: boolean;
  onSelect: (additive: boolean) => void;
  onToggleVisibility: () => void;
  onToggleLock: () => void;
  onRename: (name: string) => void;
  onContextMenu: (x: number, y: number) => void;
  onDragStart: () => void;
  onDragEnd: () => void;
}

function LayerRow({
  layer,
  depth,
  selected,
  onSelect,
  onToggleVisibility,
  onToggleLock,
  onRename,
  onContextMenu,
  onDragStart,
  onDragEnd,
}: LayerRowProps) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(layer.name);
  useEffect(() => setName(layer.name), [layer.name]);
  const Icon = LAYER_ICONS[layer.type];
  const thumbRef = useRef<HTMLCanvasElement | null>(null);

  // Render a 32x32 thumbnail. For image layers we paint the src; for
  // text/shape we render a small glyph using the layer's fill color.
  useEffect(() => {
    const c = thumbRef.current;
    if (!c) return;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    c.width = 32;
    c.height = 32;
    ctx.fillStyle = "#1a1a1a";
    ctx.fillRect(0, 0, 32, 32);
    if (layer.type === "image") {
      const l = layer as ImageLayer;
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => {
        const ratio = img.width / img.height;
        let dw = 32;
        let dh = 32;
        if (ratio > 1) dh = 32 / ratio;
        else dw = 32 * ratio;
        ctx.drawImage(img, (32 - dw) / 2, (32 - dh) / 2, dw, dh);
      };
      img.src = l.src;
    } else if (layer.type === "shape") {
      const l = layer as ShapeLayer;
      ctx.fillStyle = l.fill;
      if (l.shape === "rect") ctx.fillRect(4, 4, 24, 24);
      else if (l.shape === "ellipse") {
        ctx.beginPath();
        ctx.ellipse(16, 16, 12, 12, 0, 0, Math.PI * 2);
        ctx.fill();
      }
    } else if (layer.type === "text") {
      const l = layer as TextLayer;
      ctx.fillStyle = l.color;
      ctx.font = "bold 18px sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("T", 16, 17);
    } else if (layer.type === "group") {
      ctx.fillStyle = "#4b5563";
      ctx.fillRect(4, 6, 24, 20);
      ctx.fillRect(4, 4, 12, 4);
    } else {
      ctx.fillStyle = "#6366f1";
      ctx.fillRect(8, 8, 16, 16);
    }
  }, [layer]);

  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      className={`flex items-center gap-2 px-2 py-1.5 cursor-pointer border-l-2 ${
        selected
          ? "bg-blue-600/20 border-blue-500"
          : "border-transparent hover:bg-neutral-800/60"
      }`}
      style={{ paddingLeft: 8 + depth * 12 }}
      onClick={(e) => onSelect(e.shiftKey || e.metaKey || e.ctrlKey)}
      onContextMenu={(e) => {
        e.preventDefault();
        onContextMenu(e.clientX, e.clientY);
      }}
    >
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onToggleVisibility();
        }}
        className="text-neutral-400 hover:text-neutral-100"
      >
        {layer.visible ? (
          <Eye className="w-4 h-4" />
        ) : (
          <EyeOff className="w-4 h-4 text-neutral-600" />
        )}
      </button>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onToggleLock();
        }}
        className="text-neutral-400 hover:text-neutral-100"
      >
        {layer.locked ? (
          <Lock className="w-3 h-3" />
        ) : (
          <Unlock className="w-3 h-3 text-neutral-600" />
        )}
      </button>
      <canvas
        ref={thumbRef}
        className="w-8 h-8 rounded border border-neutral-700 bg-neutral-800"
      />
      <Icon className="w-3 h-3 text-neutral-500" />
      {editing ? (
        <input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={() => {
            setEditing(false);
            if (name !== layer.name) onRename(name);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              setEditing(false);
              if (name !== layer.name) onRename(name);
            }
            if (e.key === "Escape") {
              setEditing(false);
              setName(layer.name);
            }
          }}
          className="flex-1 bg-neutral-800 border border-neutral-600 rounded px-1 text-xs"
        />
      ) : (
        <span
          className="flex-1 truncate text-xs"
          onDoubleClick={(e) => {
            e.stopPropagation();
            setEditing(true);
          }}
        >
          {layer.name}
        </span>
      )}
      <span className="text-[10px] text-neutral-500">{layer.opacity}%</span>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Context menu
// ────────────────────────────────────────────────────────────────────────────

interface ContextMenuProps {
  x: number;
  y: number;
  layer: Layer | null;
  onDuplicate: () => void;
  onDelete: () => void;
  onGroup: () => void;
  onUngroup: () => void;
  onFlatten: () => void;
  onMergeDown: () => void;
  onConvertToSmart: () => void;
}

function ContextMenu({
  x,
  y,
  layer,
  onDuplicate,
  onDelete,
  onGroup,
  onUngroup,
  onFlatten,
  onMergeDown,
  onConvertToSmart,
}: ContextMenuProps) {
  if (!layer) return null;
  return (
    <div
      className="fixed z-50 bg-neutral-900 border border-neutral-700 rounded shadow-lg min-w-[180px] py-1 text-xs text-neutral-200"
      style={{ left: x, top: y }}
      onClick={(e) => e.stopPropagation()}
    >
      <MenuItem label="Duplicate" onClick={onDuplicate} />
      <MenuItem label="Delete" onClick={onDelete} />
      <div className="h-px bg-neutral-800 my-1" />
      <MenuItem label="Group Selected" onClick={onGroup} />
      {layer.type === "group" && (
        <MenuItem label="Ungroup" onClick={onUngroup} />
      )}
      <MenuItem label="Merge Down" onClick={onMergeDown} />
      <MenuItem label="Flatten Image" onClick={onFlatten} />
      <div className="h-px bg-neutral-800 my-1" />
      <MenuItem
        label="Convert to Smart Object"
        onClick={onConvertToSmart}
      />
    </div>
  );
}

function MenuItem({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full text-left px-3 py-1.5 hover:bg-neutral-800"
    >
      {label}
    </button>
  );
}

// Helpers to satisfy the unused-icon import errors if we tree-shake later
void FolderOpen;
void ChevronDown;
void ChevronRight;
void Trash2;
void Copy;
void MoreHorizontal;
void Square;
// GroupLayer is an imported type; referenced in component signatures only.
