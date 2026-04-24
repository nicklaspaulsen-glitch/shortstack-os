"use client";

// Top bar: undo/redo, preset picker, AI fill/remove/upscale, export,
// grid/rulers toggles, and zoom controls. The page.tsx owns the state
// dispatchers and wires them in as props.

import { useState } from "react";
import {
  Undo2,
  Redo2,
  Download,
  Grid as GridIcon,
  Ruler,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Wand2,
  Eraser,
  Sparkles,
  ChevronDown,
  Text as TextIcon,
  Shapes,
  Image as ImageIcon,
  Upload,
} from "lucide-react";
import type { CanvasPreset } from "@/lib/thumbnail-editor/types";
import type { ExportFormat } from "@/lib/thumbnail-editor/export";
import { DEFAULT_PRESETS } from "@/lib/thumbnail-editor/types";

interface TopBarProps {
  canUndo: boolean;
  canRedo: boolean;
  zoom: number;
  showRulers: boolean;
  showGrid: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onFit: () => void;
  onToggleRulers: () => void;
  onToggleGrid: () => void;
  onPickPreset: (p: CanvasPreset) => void;
  onAddText: () => void;
  onAddShape: (kind: "rect" | "ellipse") => void;
  onUpload: (file: File) => void;
  onOpenNativePicker?: () => void;
  hasElectron: boolean;
  onAIFill: () => void;
  onAIRemove: () => void;
  onAIUpscale: () => void;
  onTextToLayer: () => void;
  onExport: (format: ExportFormat, quality: number) => void;
}

export default function TopBar(props: TopBarProps) {
  const [presetsOpen, setPresetsOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [exportFormat, setExportFormat] = useState<ExportFormat>("png");
  const [exportQuality, setExportQuality] = useState(0.92);

  return (
    <div className="h-12 bg-neutral-900 border-b border-neutral-800 flex items-center px-3 gap-2 text-sm text-neutral-200">
      <span className="font-semibold text-neutral-100 mr-2">Thumbnail Pro</span>

      <IconBtn
        icon={<Undo2 className="w-4 h-4" />}
        title="Undo (Ctrl+Z)"
        disabled={!props.canUndo}
        onClick={props.onUndo}
      />
      <IconBtn
        icon={<Redo2 className="w-4 h-4" />}
        title="Redo (Ctrl+Shift+Z)"
        disabled={!props.canRedo}
        onClick={props.onRedo}
      />

      <span className="w-px h-6 bg-neutral-800 mx-1" />

      {/* Add layer quick actions */}
      <IconBtn
        icon={<TextIcon className="w-4 h-4" />}
        title="Add text"
        onClick={props.onAddText}
        label="Text"
      />
      <IconBtn
        icon={<Shapes className="w-4 h-4" />}
        title="Add rectangle"
        onClick={() => props.onAddShape("rect")}
      />
      <label className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded hover:bg-neutral-800 cursor-pointer">
        <Upload className="w-4 h-4" />
        <span>Upload</span>
        <input
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) props.onUpload(f);
            e.target.value = "";
          }}
        />
      </label>
      {props.hasElectron && props.onOpenNativePicker && (
        <IconBtn
          icon={<ImageIcon className="w-4 h-4" />}
          title="Open native file picker (Electron)"
          onClick={props.onOpenNativePicker}
          label="Native"
        />
      )}

      <span className="w-px h-6 bg-neutral-800 mx-1" />

      {/* AI actions */}
      <button
        type="button"
        onClick={props.onAIFill}
        className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs bg-gradient-to-r from-purple-600 to-pink-500 text-white hover:opacity-90"
      >
        <Wand2 className="w-4 h-4" /> AI Fill
      </button>
      <button
        type="button"
        onClick={props.onAIRemove}
        className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs bg-neutral-800 hover:bg-neutral-700"
      >
        <Eraser className="w-4 h-4" /> AI Erase
      </button>
      <button
        type="button"
        onClick={props.onAIUpscale}
        className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs bg-neutral-800 hover:bg-neutral-700"
      >
        <Sparkles className="w-4 h-4" /> Upscale
      </button>
      <button
        type="button"
        onClick={props.onTextToLayer}
        className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs bg-neutral-800 hover:bg-neutral-700"
      >
        <Wand2 className="w-4 h-4" /> Text → Layer
      </button>

      <span className="flex-1" />

      {/* View toggles */}
      <IconBtn
        icon={<Ruler className="w-4 h-4" />}
        title="Rulers"
        onClick={props.onToggleRulers}
        active={props.showRulers}
      />
      <IconBtn
        icon={<GridIcon className="w-4 h-4" />}
        title="Grid"
        onClick={props.onToggleGrid}
        active={props.showGrid}
      />

      <span className="w-px h-6 bg-neutral-800 mx-1" />

      <IconBtn
        icon={<ZoomOut className="w-4 h-4" />}
        title="Zoom out"
        onClick={props.onZoomOut}
      />
      <span className="text-xs text-neutral-400 min-w-[3rem] text-center">
        {(props.zoom * 100).toFixed(0)}%
      </span>
      <IconBtn
        icon={<ZoomIn className="w-4 h-4" />}
        title="Zoom in"
        onClick={props.onZoomIn}
      />
      <IconBtn
        icon={<Maximize2 className="w-4 h-4" />}
        title="Fit to screen"
        onClick={props.onFit}
      />

      <span className="w-px h-6 bg-neutral-800 mx-1" />

      {/* Presets */}
      <div className="relative">
        <button
          type="button"
          onClick={() => setPresetsOpen(!presetsOpen)}
          className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs bg-neutral-800 hover:bg-neutral-700"
        >
          Presets <ChevronDown className="w-3 h-3" />
        </button>
        {presetsOpen && (
          <div
            className="absolute right-0 top-full mt-1 bg-neutral-900 border border-neutral-700 rounded shadow-lg z-50 min-w-[220px]"
            onMouseLeave={() => setPresetsOpen(false)}
          >
            {DEFAULT_PRESETS.map((p) => (
              <button
                key={p.id}
                type="button"
                className="block w-full text-left px-3 py-2 text-xs hover:bg-neutral-800"
                onClick={() => {
                  props.onPickPreset(p);
                  setPresetsOpen(false);
                }}
              >
                <div className="text-neutral-100">{p.name}</div>
                <div className="text-neutral-500">
                  {p.width} × {p.height}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Export */}
      <div className="relative">
        <button
          type="button"
          onClick={() => setExportOpen(!exportOpen)}
          className="inline-flex items-center gap-1 px-3 py-1 rounded text-xs bg-blue-600 hover:bg-blue-500 text-white"
        >
          <Download className="w-4 h-4" /> Export
        </button>
        {exportOpen && (
          <div
            className="absolute right-0 top-full mt-1 bg-neutral-900 border border-neutral-700 rounded shadow-lg z-50 p-3 min-w-[240px]"
            onMouseLeave={() => setExportOpen(false)}
          >
            <label className="text-xs text-neutral-400 block mb-1">
              Format
            </label>
            <select
              className="w-full bg-neutral-800 border border-neutral-700 rounded px-2 py-1 text-xs mb-2"
              value={exportFormat}
              onChange={(e) => setExportFormat(e.target.value as ExportFormat)}
            >
              <option value="png">PNG</option>
              <option value="jpg">JPG</option>
              <option value="webp">WebP</option>
              <option value="svg">SVG (vector layers only)</option>
            </select>
            {(exportFormat === "jpg" || exportFormat === "webp") && (
              <>
                <label className="text-xs text-neutral-400 block mb-1">
                  Quality ({Math.round(exportQuality * 100)})
                </label>
                <input
                  type="range"
                  min={0.1}
                  max={1}
                  step={0.01}
                  value={exportQuality}
                  onChange={(e) => setExportQuality(Number(e.target.value))}
                  className="w-full accent-blue-500 mb-2"
                />
              </>
            )}
            <button
              type="button"
              onClick={() => {
                props.onExport(exportFormat, exportQuality);
                setExportOpen(false);
              }}
              className="w-full bg-blue-600 hover:bg-blue-500 text-white rounded py-1.5 text-xs"
            >
              Download
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

interface IconBtnProps {
  icon: React.ReactNode;
  title: string;
  onClick: () => void;
  disabled?: boolean;
  active?: boolean;
  label?: string;
}

function IconBtn({ icon, title, onClick, disabled, active, label }: IconBtnProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs transition-colors ${
        disabled
          ? "text-neutral-600 cursor-not-allowed"
          : active
            ? "bg-blue-600 text-white"
            : "text-neutral-300 hover:bg-neutral-800"
      }`}
    >
      {icon}
      {label}
    </button>
  );
}
