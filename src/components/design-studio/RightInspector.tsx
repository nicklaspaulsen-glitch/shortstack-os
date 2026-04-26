"use client";

import React from "react";
import { useDesignStore } from "@/lib/design/store";
import type { Layer, TextLayer, ImageLayer, ShapeLayer } from "@/lib/design/types";
import {
  Trash2, Copy, Eye, EyeOff, Lock, Unlock, ArrowUp, ArrowDown,
  Loader2, Sparkles,
} from "lucide-react";
import toast from "react-hot-toast";

export default function RightInspector() {
  const design = useDesignStore((s) => s.design);
  const pageIndex = useDesignStore((s) => s.pageIndex);
  const selection = useDesignStore((s) => s.selection);
  const updateLayer = useDesignStore((s) => s.updateLayer);
  const deleteLayer = useDesignStore((s) => s.deleteLayer);
  const duplicateLayer = useDesignStore((s) => s.duplicateLayer);
  const reorderLayer = useDesignStore((s) => s.reorderLayer);
  const setBackgroundColor = useDesignStore((s) => s.setBackgroundColor);

  const page = design?.doc.pages[pageIndex];
  const selectedId = selection.layerIds[0];
  const layer = selectedId ? page?.layers[selectedId] : null;

  function update<T extends Layer>(patch: Partial<T>) {
    if (!selectedId) return;
    updateLayer(selectedId, patch as Partial<Omit<Layer, "id" | "kind">>);
  }

  function num(val: number, field: string) {
    return (
      <div>
        <label className="text-[10px] text-gray-500 uppercase tracking-wider">{field}</label>
        <input
          type="number"
          value={Math.round(val)}
          onChange={(e) => update({ [field.toLowerCase()]: Number(e.target.value) })}
          className="mt-0.5 w-full bg-white/5 border border-white/10 rounded text-xs text-gray-300 px-2 py-1 focus:outline-none focus:border-white/30"
        />
      </div>
    );
  }

  async function handleAiOp(op: "rembg" | "upscale") {
    if (!layer || layer.kind !== "image" || !layer.src || !design) return;
    const fluxUrl = "/api/thumbnails/ai-remove";
    if (op === "rembg") {
      toast("Background removal uses the thumbnail editor endpoint.");
    } else {
      toast("Upscale uses the thumbnail editor endpoint.");
    }
  }

  if (!page) return <div className="w-56 bg-[#151525] border-l border-white/10" />;

  return (
    <div className="w-56 flex flex-col border-l border-white/10 bg-[#151525] shrink-0 overflow-y-auto">
      {/* No selection — show page bg */}
      {!layer ? (
        <div className="p-3 space-y-3">
          <p className="text-xs font-medium text-gray-400">Canvas</p>
          <div>
            <label className="text-[10px] text-gray-500 uppercase tracking-wider">Background</label>
            <div className="mt-1 flex items-center gap-2">
              <input
                type="color"
                value={page.backgroundColor}
                onChange={(e) => setBackgroundColor(e.target.value)}
                className="w-8 h-8 rounded cursor-pointer border border-white/10"
              />
              <input
                type="text"
                value={page.backgroundColor}
                onChange={(e) => setBackgroundColor(e.target.value)}
                className="flex-1 bg-white/5 border border-white/10 rounded text-xs text-gray-300 px-2 py-1 focus:outline-none"
              />
            </div>
          </div>
          {design && (
            <div className="space-y-1 text-xs text-gray-500">
              <p>{design.width} × {design.height}px</p>
              <p>{page.layerIds.length} layer{page.layerIds.length !== 1 ? "s" : ""}</p>
            </div>
          )}
        </div>
      ) : (
        <div className="p-3 space-y-3">
          {/* Layer actions */}
          <div className="flex items-center gap-1">
            <span className="text-xs font-medium text-gray-300 truncate flex-1 capitalize">
              {layer.kind} layer
            </span>
            <button
              onClick={() => update({ hidden: !layer.hidden } as Partial<Layer>)}
              className="p-1 rounded hover:bg-white/10 text-gray-400 hover:text-white transition-colors"
              title={layer.hidden ? "Show" : "Hide"}
            >
              {layer.hidden ? <EyeOff size={12} /> : <Eye size={12} />}
            </button>
            <button
              onClick={() => update({ locked: !layer.locked } as Partial<Layer>)}
              className="p-1 rounded hover:bg-white/10 text-gray-400 hover:text-white transition-colors"
              title={layer.locked ? "Unlock" : "Lock"}
            >
              {layer.locked ? <Lock size={12} /> : <Unlock size={12} />}
            </button>
            <button
              onClick={() => duplicateLayer(selectedId)}
              className="p-1 rounded hover:bg-white/10 text-gray-400 hover:text-white transition-colors"
              title="Duplicate"
            >
              <Copy size={12} />
            </button>
            <button
              onClick={() => deleteLayer(selectedId)}
              className="p-1 rounded hover:bg-white/10 text-red-400 hover:text-red-300 transition-colors"
              title="Delete"
            >
              <Trash2 size={12} />
            </button>
          </div>

          {/* Name */}
          <div>
            <label className="text-[10px] text-gray-500 uppercase tracking-wider">Name</label>
            <input
              value={layer.name}
              onChange={(e) => update({ name: e.target.value } as Partial<Layer>)}
              className="mt-0.5 w-full bg-white/5 border border-white/10 rounded text-xs text-gray-300 px-2 py-1 focus:outline-none focus:border-white/30"
            />
          </div>

          {/* Position & size */}
          <div className="grid grid-cols-2 gap-2">
            {num(layer.x, "X")}
            {num(layer.y, "Y")}
            {num(layer.width, "Width")}
            {num(layer.height, "Height")}
            {num(layer.rotation, "Rotation")}
            <div>
              <label className="text-[10px] text-gray-500 uppercase tracking-wider">Opacity</label>
              <input
                type="number"
                min={0}
                max={1}
                step={0.01}
                value={layer.opacity}
                onChange={(e) => update({ opacity: Number(e.target.value) } as Partial<Layer>)}
                className="mt-0.5 w-full bg-white/5 border border-white/10 rounded text-xs text-gray-300 px-2 py-1 focus:outline-none focus:border-white/30"
              />
            </div>
          </div>

          {/* Layer-specific controls */}
          {layer.kind === "text" && <TextControls layer={layer} update={update} />}
          {layer.kind === "shape" && <ShapeControls layer={layer} update={update} />}
          {layer.kind === "image" && (
            <ImageControls layer={layer} update={update} designId={design?.id ?? ""} onAiOp={handleAiOp} />
          )}

          {/* Z-order */}
          <div className="border-t border-white/10 pt-2 flex gap-1">
            <button
              onClick={() => reorderLayer(selectedId, "up")}
              className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded bg-white/5 hover:bg-white/10 text-xs text-gray-400 hover:text-white transition-colors"
            >
              <ArrowUp size={12} /> Forward
            </button>
            <button
              onClick={() => reorderLayer(selectedId, "down")}
              className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded bg-white/5 hover:bg-white/10 text-xs text-gray-400 hover:text-white transition-colors"
            >
              <ArrowDown size={12} /> Back
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Text controls ─────────────────────────────────────────────────────────────

function TextControls({ layer, update }: { layer: TextLayer; update: (p: Partial<TextLayer>) => void }) {
  return (
    <div className="space-y-2 border-t border-white/10 pt-2">
      <div>
        <label className="text-[10px] text-gray-500 uppercase tracking-wider">Content</label>
        <textarea
          value={layer.content}
          onChange={(e) => update({ content: e.target.value })}
          rows={3}
          className="mt-0.5 w-full bg-white/5 border border-white/10 rounded text-xs text-gray-300 px-2 py-1 focus:outline-none resize-none"
        />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-[10px] text-gray-500">Font size</label>
          <input
            type="number"
            value={layer.fontSize}
            onChange={(e) => update({ fontSize: Number(e.target.value) })}
            className="mt-0.5 w-full bg-white/5 border border-white/10 rounded text-xs text-gray-300 px-2 py-1 focus:outline-none"
          />
        </div>
        <div>
          <label className="text-[10px] text-gray-500">Weight</label>
          <select
            value={layer.fontWeight}
            onChange={(e) => update({ fontWeight: e.target.value })}
            className="mt-0.5 w-full bg-white/5 border border-white/10 rounded text-xs text-gray-300 px-1 py-1 focus:outline-none"
          >
            {["300","400","500","600","700","800","900"].map((w) => (
              <option key={w} value={w} className="bg-[#1a1a2e]">{w}</option>
            ))}
          </select>
        </div>
      </div>
      <div>
        <label className="text-[10px] text-gray-500 uppercase tracking-wider">Color</label>
        <div className="mt-1 flex items-center gap-2">
          <input
            type="color"
            value={layer.color}
            onChange={(e) => update({ color: e.target.value })}
            className="w-7 h-7 rounded cursor-pointer border border-white/10"
          />
          <input
            type="text"
            value={layer.color}
            onChange={(e) => update({ color: e.target.value })}
            className="flex-1 bg-white/5 border border-white/10 rounded text-xs text-gray-300 px-2 py-1 focus:outline-none"
          />
        </div>
      </div>
      <div>
        <label className="text-[10px] text-gray-500 uppercase tracking-wider">Align</label>
        <div className="mt-1 flex gap-1">
          {(["left", "center", "right"] as const).map((a) => (
            <button
              key={a}
              onClick={() => update({ textAlign: a })}
              className={`flex-1 py-1 rounded text-[10px] transition-colors ${
                layer.textAlign === a
                  ? "bg-white/20 text-white"
                  : "bg-white/5 text-gray-400 hover:bg-white/10"
              }`}
            >
              {a[0].toUpperCase() + a.slice(1)}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Shape controls ────────────────────────────────────────────────────────────

function ShapeControls({ layer, update }: { layer: ShapeLayer; update: (p: Partial<ShapeLayer>) => void }) {
  return (
    <div className="space-y-2 border-t border-white/10 pt-2">
      <div>
        <label className="text-[10px] text-gray-500 uppercase tracking-wider">Fill</label>
        <div className="mt-1 flex items-center gap-2">
          <input
            type="color"
            value={layer.fill}
            onChange={(e) => update({ fill: e.target.value })}
            className="w-7 h-7 rounded cursor-pointer border border-white/10"
          />
          <input
            type="text"
            value={layer.fill}
            onChange={(e) => update({ fill: e.target.value })}
            className="flex-1 bg-white/5 border border-white/10 rounded text-xs text-gray-300 px-2 py-1 focus:outline-none"
          />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-[10px] text-gray-500">Stroke</label>
          <input
            type="color"
            value={layer.stroke}
            onChange={(e) => update({ stroke: e.target.value })}
            className="mt-0.5 w-full h-7 rounded cursor-pointer border border-white/10"
          />
        </div>
        <div>
          <label className="text-[10px] text-gray-500">Stroke W</label>
          <input
            type="number"
            value={layer.strokeWidth}
            onChange={(e) => update({ strokeWidth: Number(e.target.value) })}
            className="mt-0.5 w-full bg-white/5 border border-white/10 rounded text-xs text-gray-300 px-2 py-1 focus:outline-none"
          />
        </div>
      </div>
      <div>
        <label className="text-[10px] text-gray-500">Radius</label>
        <input
          type="number"
          value={layer.borderRadius}
          onChange={(e) => update({ borderRadius: Number(e.target.value) })}
          className="mt-0.5 w-full bg-white/5 border border-white/10 rounded text-xs text-gray-300 px-2 py-1 focus:outline-none"
        />
      </div>
    </div>
  );
}

// ── Image controls ────────────────────────────────────────────────────────────

function ImageControls({
  layer,
  update,
  designId,
  onAiOp,
}: {
  layer: ImageLayer;
  update: (p: Partial<ImageLayer>) => void;
  designId: string;
  onAiOp: (op: "rembg" | "upscale") => void;
}) {
  const [srcInput, setSrcInput] = useState(layer.src);

  function handleSrcSubmit(e: React.FormEvent) {
    e.preventDefault();
    update({ src: srcInput });
  }

  return (
    <div className="space-y-2 border-t border-white/10 pt-2">
      <div>
        <label className="text-[10px] text-gray-500 uppercase tracking-wider">Image URL</label>
        <form onSubmit={handleSrcSubmit} className="mt-0.5 flex gap-1">
          <input
            value={srcInput}
            onChange={(e) => setSrcInput(e.target.value)}
            placeholder="https://…"
            className="flex-1 bg-white/5 border border-white/10 rounded text-xs text-gray-300 px-2 py-1 focus:outline-none focus:border-white/30 min-w-0"
          />
          <button type="submit" className="px-2 py-1 rounded bg-white/10 text-xs text-gray-300 hover:bg-white/20">
            Set
          </button>
        </form>
      </div>
      <div>
        <label className="text-[10px] text-gray-500">Fit</label>
        <select
          value={layer.objectFit}
          onChange={(e) => update({ objectFit: e.target.value as ImageLayer["objectFit"] })}
          className="mt-0.5 w-full bg-white/5 border border-white/10 rounded text-xs text-gray-300 px-1 py-1 focus:outline-none"
        >
          {["cover", "contain", "fill"].map((v) => (
            <option key={v} value={v} className="bg-[#1a1a2e]">{v}</option>
          ))}
        </select>
      </div>
      <div>
        <label className="text-[10px] text-gray-500">Radius</label>
        <input
          type="number"
          value={layer.borderRadius}
          onChange={(e) => update({ borderRadius: Number(e.target.value) })}
          className="mt-0.5 w-full bg-white/5 border border-white/10 rounded text-xs text-gray-300 px-2 py-1 focus:outline-none"
        />
      </div>
      <div className="border-t border-white/10 pt-2 space-y-1">
        <p className="text-[10px] text-gray-500 uppercase tracking-wider">AI Ops</p>
        <button
          onClick={() => onAiOp("rembg")}
          className="w-full flex items-center gap-2 py-1.5 px-2 rounded bg-white/5 hover:bg-white/10 text-xs text-gray-300 hover:text-white transition-colors"
        >
          <Sparkles size={12} /> Remove Background
        </button>
        <button
          onClick={() => onAiOp("upscale")}
          className="w-full flex items-center gap-2 py-1.5 px-2 rounded bg-white/5 hover:bg-white/10 text-xs text-gray-300 hover:text-white transition-colors"
        >
          <Sparkles size={12} /> Upscale
        </button>
      </div>
    </div>
  );
}

// Local useState import
import { useState } from "react";
