"use client";

/* ────────────────────────────────────────────────────────────────
 * Effects panel — keyframeable properties per clip.
 *
 * Covers opacity, scale, position (x/y), rotation. Keyframes store
 * `frame` (ms within the clip — NOT global timeline) and `value`.
 * Add-keyframe adds at the current playhead minus the clip start.
 * ────────────────────────────────────────────────────────────────*/

import { Diamond, Plus, Trash2, X } from "lucide-react";
import type {
  EditorState,
  EditorAction,
  KeyframeableProperty,
  Keyframe,
} from "@/lib/video-editor/types";
import { interpolate } from "@/lib/video-editor/reducer";

export interface EffectsPanelProps {
  state: EditorState;
  dispatch: (a: EditorAction) => void;
  onClose?: () => void;
}

interface PropertyDef {
  key: KeyframeableProperty;
  label: string;
  default: number;
  min: number;
  max: number;
  step: number;
  unit: string;
}

const PROPERTIES: PropertyDef[] = [
  { key: "opacity",   label: "Opacity",   default: 1,   min: 0,    max: 1,    step: 0.05, unit: "" },
  { key: "scale",     label: "Scale",     default: 1,   min: 0,    max: 4,    step: 0.05, unit: "×" },
  { key: "positionX", label: "Position X", default: 0,  min: -1000, max: 1000, step: 1,   unit: "px" },
  { key: "positionY", label: "Position Y", default: 0,  min: -1000, max: 1000, step: 1,   unit: "px" },
  { key: "rotation",  label: "Rotation",  default: 0,   min: -360, max: 360,  step: 1,   unit: "°" },
];

const TRANSITION_KINDS: Array<{ value: string; label: string }> = [
  { value: "none", label: "None" },
  { value: "cross-dissolve", label: "Cross Dissolve" },
  { value: "dip-to-black", label: "Dip to Black" },
  { value: "push", label: "Push" },
  { value: "slide", label: "Slide" },
];

export function EffectsPanel({ state, dispatch, onClose }: EffectsPanelProps) {
  const selectedId = state.selection[0];
  const clip = state.clips.find((c) => c.id === selectedId);

  if (!clip) {
    return (
      <aside className="w-72 shrink-0 bg-neutral-900 border-l border-neutral-800 p-4 text-neutral-400 text-xs">
        <header className="flex items-center justify-between mb-2">
          <h3 className="text-neutral-200 font-medium text-sm">Effects</h3>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="p-1 text-neutral-400 hover:text-white"
            >
              <X size={14} />
            </button>
          )}
        </header>
        Select a clip to edit keyframes.
      </aside>
    );
  }

  const localFrame = Math.max(0, state.playhead - clip.start);

  const getValueAt = (prop: KeyframeableProperty, fallback: number): number =>
    interpolate(clip.keyframes?.[prop], localFrame, fallback);

  const addKeyframe = (prop: PropertyDef) => {
    const currentVal = getValueAt(prop.key, prop.default);
    dispatch({
      type: "ADD_KEYFRAME",
      clipId: clip.id,
      property: prop.key,
      keyframe: { frame: localFrame, value: currentVal },
    });
  };

  const setValue = (prop: PropertyDef, value: number) => {
    dispatch({
      type: "ADD_KEYFRAME",
      clipId: clip.id,
      property: prop.key,
      keyframe: { frame: localFrame, value },
    });
  };

  const removeKeyframe = (prop: KeyframeableProperty, frame: number) => {
    dispatch({ type: "REMOVE_KEYFRAME", clipId: clip.id, property: prop, frame });
  };

  const setTransition = (side: "in" | "out", kind: string) => {
    dispatch({
      type: "SET_TRANSITION",
      clipId: clip.id,
      side,
      transition: { kind: kind as never, duration: 500 },
    });
  };

  return (
    <aside className="w-72 shrink-0 bg-neutral-900 border-l border-neutral-800 overflow-y-auto">
      <header className="flex items-center justify-between px-3 py-2 border-b border-neutral-800">
        <h3 className="text-neutral-200 font-medium text-sm">Effects — {clip.label}</h3>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="p-1 text-neutral-400 hover:text-white"
            aria-label="Close effects panel"
          >
            <X size={14} />
          </button>
        )}
      </header>

      <div className="p-3 space-y-4">
        {PROPERTIES.map((p) => {
          const kfs: Keyframe[] = clip.keyframes?.[p.key] || [];
          const current = getValueAt(p.key, p.default);
          return (
            <div key={p.key} className="space-y-1">
              <div className="flex items-center gap-2">
                <label className="text-[11px] text-neutral-300 flex-1">{p.label}</label>
                <span className="text-[10px] font-mono text-neutral-400 w-12 text-right">
                  {p.key === "opacity" ? current.toFixed(2) : current.toFixed(1)}
                  {p.unit}
                </span>
                <button
                  type="button"
                  onClick={() => addKeyframe(p)}
                  className="p-1 rounded hover:bg-neutral-800 text-neutral-400 hover:text-amber-300"
                  title="Add keyframe at playhead"
                >
                  <Diamond size={10} />
                </button>
              </div>
              <input
                type="range"
                min={p.min}
                max={p.max}
                step={p.step}
                value={current}
                onChange={(e) => setValue(p, Number(e.target.value))}
                className="w-full accent-rose-500"
              />
              {kfs.length > 0 && (
                <div className="flex gap-1 flex-wrap mt-1">
                  {kfs.map((kf) => (
                    <span
                      key={`${p.key}-${kf.frame}`}
                      className="group inline-flex items-center gap-1 text-[9px] rounded bg-neutral-800 text-neutral-300 px-1.5 py-0.5 font-mono"
                      title={`Frame ${kf.frame}ms → ${kf.value}`}
                    >
                      <Diamond size={8} className="text-amber-400" />
                      {Math.round(kf.frame)}ms
                      <button
                        type="button"
                        onClick={() => removeKeyframe(p.key, kf.frame)}
                        className="opacity-50 group-hover:opacity-100 hover:text-rose-400"
                        title="Remove keyframe"
                      >
                        <Trash2 size={8} />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>
          );
        })}

        <div className="border-t border-neutral-800 pt-3">
          <h4 className="text-[11px] uppercase tracking-wider text-neutral-500 mb-2">
            Transitions
          </h4>
          <div className="grid grid-cols-2 gap-2">
            <label className="text-[10px] text-neutral-400 space-y-1">
              In
              <select
                value={clip.transitionIn?.kind || "none"}
                onChange={(e) => setTransition("in", e.target.value)}
                className="w-full bg-neutral-800 border border-neutral-700 rounded px-1 py-1 text-[10px] text-neutral-200"
              >
                {TRANSITION_KINDS.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-[10px] text-neutral-400 space-y-1">
              Out
              <select
                value={clip.transitionOut?.kind || "none"}
                onChange={(e) => setTransition("out", e.target.value)}
                className="w-full bg-neutral-800 border border-neutral-700 rounded px-1 py-1 text-[10px] text-neutral-200"
              >
                {TRANSITION_KINDS.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>
      </div>
    </aside>
  );
}
