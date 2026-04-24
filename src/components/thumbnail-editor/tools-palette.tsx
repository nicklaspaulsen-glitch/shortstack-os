"use client";

// Left-hand vertical tool rail, shortcuts mapped to
// V/M/L/W/C/T/U/B/E/I/H/Z per spec. Tool state lives in the editor
// reducer; this component is pure UI over `activeTool` + dispatch.

import { useEffect } from "react";
import {
  MousePointer2,
  Square,
  Circle,
  Lasso,
  Wand2,
  Crop,
  Type,
  Shapes,
  Brush,
  Eraser,
  Pipette,
  Hand,
  ZoomIn,
  type LucideIcon,
} from "lucide-react";
import type { ToolId } from "@/lib/thumbnail-editor/types";

interface ToolDef {
  id: ToolId;
  label: string;
  icon: LucideIcon;
  shortcut: string; // single key
  group?: string; // visual separator group
}

export const TOOLS: ToolDef[] = [
  { id: "move", label: "Move", icon: MousePointer2, shortcut: "v", group: "select" },
  { id: "marquee-rect", label: "Rect Marquee", icon: Square, shortcut: "m", group: "select" },
  { id: "marquee-ellipse", label: "Ellipse Marquee", icon: Circle, shortcut: "m", group: "select" },
  { id: "lasso", label: "Lasso", icon: Lasso, shortcut: "l", group: "select" },
  { id: "magic-wand", label: "Magic Wand", icon: Wand2, shortcut: "w", group: "select" },
  { id: "crop", label: "Crop", icon: Crop, shortcut: "c", group: "crop" },
  { id: "text", label: "Text", icon: Type, shortcut: "t", group: "draw" },
  { id: "shape", label: "Shape", icon: Shapes, shortcut: "u", group: "draw" },
  { id: "brush", label: "Brush", icon: Brush, shortcut: "b", group: "paint" },
  { id: "eraser", label: "Eraser", icon: Eraser, shortcut: "e", group: "paint" },
  { id: "eyedropper", label: "Eyedropper", icon: Pipette, shortcut: "i", group: "util" },
  { id: "hand", label: "Hand", icon: Hand, shortcut: "h", group: "util" },
  { id: "zoom", label: "Zoom", icon: ZoomIn, shortcut: "z", group: "util" },
];

interface ToolsPaletteProps {
  active: ToolId;
  onSelect: (id: ToolId) => void;
  foregroundColor: string;
  backgroundColor: string;
  onSwapColors: () => void;
  onFgColor: (c: string) => void;
  onBgColor: (c: string) => void;
}

export default function ToolsPalette({
  active,
  onSelect,
  foregroundColor,
  backgroundColor,
  onSwapColors,
  onFgColor,
  onBgColor,
}: ToolsPaletteProps) {
  // Keyboard shortcuts. We ignore events from inputs/textareas so typing in
  // the properties panel doesn't switch tools.
  useEffect(() => {
    function handler(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)) {
        return;
      }
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const key = e.key.toLowerCase();
      const match = TOOLS.find((t) => t.shortcut === key);
      if (match) {
        e.preventDefault();
        onSelect(match.id);
      }
    }
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onSelect]);

  // Group tools for visual rhythm
  const groups: ToolDef[][] = [];
  let current: ToolDef[] = [];
  let lastGroup: string | undefined;
  for (const t of TOOLS) {
    if (t.group !== lastGroup && current.length > 0) {
      groups.push(current);
      current = [];
    }
    current.push(t);
    lastGroup = t.group;
  }
  if (current.length > 0) groups.push(current);

  return (
    <div className="w-14 bg-neutral-900 border-r border-neutral-800 flex flex-col items-center py-2 gap-1 select-none">
      {groups.map((group, gi) => (
        <div key={gi} className="flex flex-col gap-1 w-full items-center">
          {group.map((tool) => {
            const Icon = tool.icon;
            const isActive = tool.id === active;
            return (
              <button
                key={tool.id}
                type="button"
                onClick={() => onSelect(tool.id)}
                title={`${tool.label} (${tool.shortcut.toUpperCase()})`}
                className={`w-10 h-10 flex items-center justify-center rounded transition-colors ${
                  isActive
                    ? "bg-blue-600 text-white"
                    : "text-neutral-400 hover:bg-neutral-800 hover:text-neutral-100"
                }`}
              >
                <Icon className="w-4 h-4" />
              </button>
            );
          })}
          {gi < groups.length - 1 && (
            <div className="w-8 h-px bg-neutral-800 my-1" />
          )}
        </div>
      ))}

      {/* FG / BG color chips — Photoshop-style overlapping squares */}
      <div className="mt-auto pt-3 pb-2 flex flex-col items-center gap-2">
        <div className="relative w-9 h-9">
          <input
            type="color"
            value={backgroundColor}
            onChange={(e) => onBgColor(e.target.value)}
            title="Background color"
            className="absolute right-0 bottom-0 w-6 h-6 border border-neutral-600 cursor-pointer p-0 bg-transparent"
            style={{ background: backgroundColor }}
          />
          <input
            type="color"
            value={foregroundColor}
            onChange={(e) => onFgColor(e.target.value)}
            title="Foreground color"
            className="absolute left-0 top-0 w-6 h-6 border border-neutral-600 cursor-pointer p-0 bg-transparent"
            style={{ background: foregroundColor }}
          />
        </div>
        <button
          type="button"
          onClick={onSwapColors}
          title="Swap colors (X)"
          className="text-neutral-500 hover:text-neutral-200 text-xs"
        >
          swap
        </button>
      </div>
    </div>
  );
}
