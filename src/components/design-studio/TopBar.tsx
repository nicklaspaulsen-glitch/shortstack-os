"use client";

import React, { useState } from "react";
import { useDesignStore } from "@/lib/design/store";
import { SIZE_PRESETS } from "@/lib/design/types";
import {
  Undo2, Redo2, Download, Grid3x3, ZoomIn, ZoomOut, Save, Loader2,
  ChevronDown,
} from "lucide-react";
import toast from "react-hot-toast";

interface TopBarProps {
  onSave: () => Promise<void>;
}

export default function TopBar({ onSave }: TopBarProps) {
  const design = useDesignStore((s) => s.design);
  const isDirty = useDesignStore((s) => s.isDirty);
  const isSaving = useDesignStore((s) => s.isSaving);
  const historyIndex = useDesignStore((s) => s.historyIndex);
  const history = useDesignStore((s) => s.history);
  const zoom = useDesignStore((s) => s.zoom);
  const showGrid = useDesignStore((s) => s.showGrid);
  const undo = useDesignStore((s) => s.undo);
  const redo = useDesignStore((s) => s.redo);
  const setZoom = useDesignStore((s) => s.setZoom);
  const toggleGrid = useDesignStore((s) => s.toggleGrid);
  const setTitle = useDesignStore((s) => s.setTitle);

  const [showPresets, setShowPresets] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  const canUndo = historyIndex > 0;
  const canRedo = historyIndex < history.length - 1;

  async function handleExport(format: "png" | "jpg" | "webp") {
    if (!design) return;
    setIsExporting(true);
    setShowPresets(false);
    try {
      const res = await fetch("/api/design-studio/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ design_id: design.id, format }),
      });
      if (!res.ok) throw new Error("Export failed");
      const { url } = (await res.json()) as { url: string };
      // Trigger browser download
      const a = document.createElement("a");
      a.href = url;
      a.download = `${design.title}.${format}`;
      a.click();
      toast.success(`Exported as ${format.toUpperCase()}`);
    } catch {
      toast.error("Export failed — try again");
    } finally {
      setIsExporting(false);
    }
  }

  return (
    <div className="h-12 flex items-center gap-2 px-3 border-b border-white/10 bg-[#1a1a2e] shrink-0 z-20">
      {/* Title */}
      <input
        value={design?.title ?? "Untitled"}
        onChange={(e) => setTitle(e.target.value)}
        className="w-40 bg-transparent text-white text-sm font-medium outline-none border-b border-transparent focus:border-white/30 truncate"
        placeholder="Design title"
      />

      {/* Canvas size info */}
      {design && (
        <span className="text-xs text-gray-500 ml-1">
          {design.width}×{design.height}
        </span>
      )}

      <div className="flex-1" />

      {/* Zoom */}
      <button
        onClick={() => setZoom(zoom - 0.1)}
        className="p-1.5 rounded hover:bg-white/10 text-gray-400 hover:text-white transition-colors"
        title="Zoom out"
      >
        <ZoomOut size={14} />
      </button>
      <button
        onClick={() => setZoom(1)}
        className="text-xs text-gray-400 hover:text-white px-1 min-w-[40px] text-center"
        title="Reset zoom"
      >
        {Math.round(zoom * 100)}%
      </button>
      <button
        onClick={() => setZoom(zoom + 0.1)}
        className="p-1.5 rounded hover:bg-white/10 text-gray-400 hover:text-white transition-colors"
        title="Zoom in"
      >
        <ZoomIn size={14} />
      </button>

      <div className="w-px h-5 bg-white/10 mx-1" />

      {/* Undo/Redo */}
      <button
        onClick={undo}
        disabled={!canUndo}
        className="p-1.5 rounded hover:bg-white/10 text-gray-400 hover:text-white transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
        title="Undo (Ctrl+Z)"
      >
        <Undo2 size={14} />
      </button>
      <button
        onClick={redo}
        disabled={!canRedo}
        className="p-1.5 rounded hover:bg-white/10 text-gray-400 hover:text-white transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
        title="Redo (Ctrl+Y)"
      >
        <Redo2 size={14} />
      </button>

      <div className="w-px h-5 bg-white/10 mx-1" />

      {/* Grid toggle */}
      <button
        onClick={toggleGrid}
        className={`p-1.5 rounded transition-colors ${
          showGrid ? "bg-white/20 text-white" : "hover:bg-white/10 text-gray-400 hover:text-white"
        }`}
        title="Toggle grid"
      >
        <Grid3x3 size={14} />
      </button>

      <div className="w-px h-5 bg-white/10 mx-1" />

      {/* Save */}
      <button
        onClick={onSave}
        disabled={isSaving || !isDirty}
        className="flex items-center gap-1.5 px-3 h-7 rounded text-xs font-medium bg-white/10 hover:bg-white/20 text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
      >
        {isSaving ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
        {isSaving ? "Saving…" : isDirty ? "Save" : "Saved"}
      </button>

      {/* Export */}
      <div className="relative">
        <button
          onClick={() => setShowPresets((v) => !v)}
          disabled={isExporting}
          className="flex items-center gap-1.5 px-3 h-7 rounded text-xs font-medium bg-[#C9A84C] hover:bg-[#d4b35e] text-[#1a1a2e] font-semibold transition-colors disabled:opacity-50"
        >
          {isExporting ? (
            <Loader2 size={12} className="animate-spin" />
          ) : (
            <Download size={12} />
          )}
          Export
          <ChevronDown size={10} />
        </button>

        {showPresets && (
          <div className="absolute right-0 top-9 bg-[#2a2a3e] border border-white/10 rounded-lg shadow-xl z-50 py-1 min-w-[140px]">
            {(["png", "jpg", "webp"] as const).map((fmt) => (
              <button
                key={fmt}
                onClick={() => handleExport(fmt)}
                className="w-full text-left px-3 py-2 text-xs text-gray-300 hover:bg-white/10 hover:text-white transition-colors"
              >
                {fmt.toUpperCase()}
              </button>
            ))}
          </div>
        )}
      </div>

      {showPresets && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setShowPresets(false)}
        />
      )}
    </div>
  );
}
