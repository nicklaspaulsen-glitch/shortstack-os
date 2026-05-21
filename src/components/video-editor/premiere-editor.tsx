"use client";

/* ────────────────────────────────────────────────────────────────
 * PremiereEditor — orchestrator for the multi-track NLE.
 *
 * Wires together:
 *   - preview player (active clip + cross-fade mid-transition)
 *   - transport (play/pause, scrub, J-K-L, in/out markers)
 *   - keyboard shortcuts (Space, I, O, Cmd+B, Cmd+Z, Cmd+Shift+Z, Backspace)
 *   - multi-track timeline (premiere-timeline.tsx)
 *   - AI assist, effects, electron feature bar
 *   - Render button → POST /api/compositions/[id]/render
 * ────────────────────────────────────────────────────────────────*/

import {
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from "react";
import toast from "react-hot-toast";
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Rewind,
  FastForward,
  Scissors,
  Trash2,
  Undo2,
  Redo2,
  ZoomIn,
  ZoomOut,
  Sparkles,
  SlidersHorizontal,
  Download,
  LibraryBig,
  Repeat,
  Type,
  Plus,
  ChevronDown,
} from "lucide-react";
import {
  historyReducer,
  createInitialHistory,
  INITIAL_STATE,
  interpolate,
} from "@/lib/video-editor/reducer";
import type {
  EditorState,
  EditorAction,
  Clip,
} from "@/lib/video-editor/types";
import { PremiereTimeline, msToTc } from "./premiere-timeline";
import { Waveform } from "./waveform";
import { AiPanel } from "./ai-panel";
import { EffectsPanel } from "./effects-panel";
import { SfxVfxBrollPanel } from "./sfx-vfx-broll-panel";
import { ElectronBar } from "./electron-bar";

const KEY_REPEAT_MS = 33; // ~1 frame @ 30fps

export interface PremiereEditorProps {
  /** Optional initial state to seed the editor. */
  initialState?: Partial<EditorState>;
  /** Composition id for /api/compositions/[id]/render. */
  compositionId?: string;
  /** Callback when state changes — parent can mirror into DB/URL. */
  onStateChange?: (state: EditorState) => void;
}

export function PremiereEditor({
  initialState,
  compositionId,
  onStateChange,
}: PremiereEditorProps) {
  const [history, dispatch] = useReducer(
    historyReducer,
    undefined,
    () => createInitialHistory({ ...INITIAL_STATE, ...initialState } as EditorState)
  );
  const state = history.present;
  const [playing, setPlaying] = useState(false);
  const [looping, setLooping] = useState(false);
  const [panel, setPanel] = useState<"ai" | "effects" | "assets">("ai");
  const [addTrackMenuOpen, setAddTrackMenuOpen] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const lastTickRef = useRef<number>(0);

  /* ─── Mirror state changes upward ─────────────────────────── */
  useEffect(() => {
    onStateChange?.(state);
  }, [state, onStateChange]);

  /* ─── Active clip = top-most video clip containing playhead ─ */
  const activeVideoClip: Clip | null = useMemo(() => {
    const videoTracks = state.tracks.filter((t) => t.kind === "video" && !t.hidden);
    for (const t of videoTracks) {
      const match = state.clips.find(
        (c) => c.trackId === t.id && state.playhead >= c.start && state.playhead < c.start + c.duration
      );
      if (match) return match;
    }
    return null;
  }, [state.tracks, state.clips, state.playhead]);

  /* ─── Keyframe interpolation for preview ───────────────────── */
  const previewStyle = useMemo(() => {
    if (!activeVideoClip) return {};
    const local = state.playhead - activeVideoClip.start;
    const opacity = interpolate(activeVideoClip.keyframes?.opacity, local, 1);
    const scale = interpolate(activeVideoClip.keyframes?.scale, local, 1);
    const x = interpolate(activeVideoClip.keyframes?.positionX, local, 0);
    const y = interpolate(activeVideoClip.keyframes?.positionY, local, 0);
    const rot = interpolate(activeVideoClip.keyframes?.rotation, local, 0);

    // Cross-fade layer for transitions: fade in the first transitionIn.duration ms
    // of the clip, fade out the final transitionOut.duration ms.
    let transitionOpacity = 1;
    if (activeVideoClip.transitionIn && activeVideoClip.transitionIn.kind !== "none" && local < activeVideoClip.transitionIn.duration) {
      transitionOpacity = local / activeVideoClip.transitionIn.duration;
    }
    const tailStart = activeVideoClip.duration - (activeVideoClip.transitionOut?.duration || 0);
    if (
      activeVideoClip.transitionOut &&
      activeVideoClip.transitionOut.kind !== "none" &&
      local > tailStart
    ) {
      transitionOpacity =
        1 - (local - tailStart) / activeVideoClip.transitionOut.duration;
    }

    return {
      opacity: Math.max(0, Math.min(1, opacity)) * Math.max(0, Math.min(1, transitionOpacity)),
      transform: `translate(${x}px, ${y}px) scale(${scale}) rotate(${rot}deg)`,
      transformOrigin: "center center",
    } as React.CSSProperties;
  }, [activeVideoClip, state.playhead]);

  /* ─── Transport loop (with optional loop-region wrap) ──────── */
  useEffect(() => {
    if (!playing) {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
      return;
    }
    lastTickRef.current = performance.now();
    const tick = (now: number) => {
      const dt = now - lastTickRef.current;
      lastTickRef.current = now;
      // Loop region: if looping + both markers set + playhead past markerOut → wrap to markerIn
      const nextMs = state.playhead + dt;
      if (
        looping &&
        state.markerIn !== null &&
        state.markerOut !== null &&
        state.markerOut > state.markerIn &&
        nextMs >= state.markerOut
      ) {
        dispatch({ type: "SET_PLAYHEAD", ms: state.markerIn });
      } else {
        dispatch({ type: "SET_PLAYHEAD", ms: nextMs });
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing, looping, state.markerIn, state.markerOut]);

  /* ─── Sync HTMLVideoElement to the active clip ─────────────── */
  useEffect(() => {
    const el = videoRef.current;
    if (!el || !activeVideoClip) return;
    if (activeVideoClip.src && el.src !== activeVideoClip.src) {
      el.src = activeVideoClip.src;
    }
    const local = (state.playhead - activeVideoClip.start) / 1000 + (activeVideoClip.sourceIn || 0) / 1000;
    if (Number.isFinite(local) && Math.abs(el.currentTime - local) > 0.1) {
      try {
        el.currentTime = Math.max(0, local);
      } catch {
        /* non-fatal seek failure */
      }
    }
    if (playing && el.paused) {
      void el.play().catch(() => undefined);
    } else if (!playing && !el.paused) {
      el.pause();
    }
  }, [activeVideoClip, state.playhead, playing]);

  /* ─── Keyboard shortcuts ───────────────────────────────────── */
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const inInput =
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        (e.target instanceof HTMLElement && e.target.isContentEditable);
      if (inInput) return;

      const mod = e.metaKey || e.ctrlKey;

      // Undo / Redo
      if (mod && e.key.toLowerCase() === "z") {
        e.preventDefault();
        dispatch({ type: e.shiftKey ? "REDO" : "UNDO" });
        return;
      }
      // Blade / split
      if (mod && e.key.toLowerCase() === "b") {
        e.preventDefault();
        const underPlayhead = state.clips.find(
          (c) => state.playhead > c.start && state.playhead < c.start + c.duration
        );
        if (underPlayhead) {
          dispatch({ type: "SPLIT_CLIP", id: underPlayhead.id, atMs: state.playhead });
        }
        return;
      }
      // Transport
      if (e.key === " ") {
        e.preventDefault();
        setPlaying((v) => !v);
        return;
      }
      if (e.key.toLowerCase() === "j") {
        dispatch({ type: "SET_PLAYHEAD", ms: Math.max(0, state.playhead - KEY_REPEAT_MS * 10) });
        return;
      }
      if (e.key.toLowerCase() === "k") {
        setPlaying(false);
        return;
      }
      if (e.key.toLowerCase() === "l") {
        dispatch({ type: "SET_PLAYHEAD", ms: state.playhead + KEY_REPEAT_MS * 10 });
        return;
      }
      // In / Out markers
      if (e.key.toLowerCase() === "i") {
        dispatch({ type: "SET_MARKER_IN", ms: state.playhead });
        return;
      }
      if (e.key.toLowerCase() === "o") {
        dispatch({ type: "SET_MARKER_OUT", ms: state.playhead });
        return;
      }
      // Ripple delete / delete
      if (e.key === "Backspace" || e.key === "Delete") {
        if (state.selection.length === 0) return;
        e.preventDefault();
        for (const id of state.selection) {
          dispatch({ type: "DELETE_CLIP", id, ripple: e.key === "Backspace" });
        }
        return;
      }
      // Frame step
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        dispatch({ type: "SET_PLAYHEAD", ms: Math.max(0, state.playhead - 1000 / state.fps) });
        return;
      }
      if (e.key === "ArrowRight") {
        e.preventDefault();
        dispatch({ type: "SET_PLAYHEAD", ms: state.playhead + 1000 / state.fps });
        return;
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [state.clips, state.playhead, state.selection, state.fps]);

  /* ─── Render handler ──────────────────────────────────────── */
  const onRender = async () => {
    if (!compositionId) {
      toast("Render requires a composition id", { icon: "▸" });
      return;
    }
    const id = toast.loading("Dispatching render…");
    try {
      const res = await fetch(`/api/compositions/${compositionId}/render`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clips: state.clips, tracks: state.tracks, fps: state.fps }),
      });
      if (res.status === 404) {
        toast("Render route not live yet — JSON logged", { id, icon: "○" });
        return;
      }
      const j = await res.json();
      if (j.ok) {
        toast.success("Render queued", { id });
      } else {
        toast.error(j.error || "Render failed", { id });
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Render failed";
      toast.error(msg, { id });
    }
  };

  /* ─── Selected clip helpers ─────────────────────────────────── */
  const selectedClip = state.selection.length === 1
    ? state.clips.find((c) => c.id === state.selection[0]) ?? null
    : null;

  const setSpeed = useCallback(
    (speed: number) => {
      if (!selectedClip) return;
      dispatch({ type: "SPEED_CLIP", id: selectedClip.id, speed });
    },
    [selectedClip]
  );

  /* ─── Add caption at playhead ────────────────────────────────── */
  const addCaption = useCallback(() => {
    const capTrack = state.tracks.find((t) => t.kind === "caption");
    if (!capTrack) { toast("No caption track", { icon: "ℹ" }); return; }
    const id = `cap-${Date.now().toString(36)}`;
    dispatch({
      type: "ADD_CLIP",
      clip: {
        id,
        trackId: capTrack.id,
        start: state.playhead,
        duration: 4000,
        label: "New caption",
        color: capTrack.accent,
        text: "Your text here",
      },
    });
    toast.success("Caption added — double-click to edit");
  }, [state.tracks, state.playhead]);

  /* ─── Close Add Track menu on outside click ─────────────────── */
  useEffect(() => {
    if (!addTrackMenuOpen) return;
    const close = () => setAddTrackMenuOpen(false);
    window.addEventListener("pointerdown", close, { capture: true });
    return () => window.removeEventListener("pointerdown", close, { capture: true });
  }, [addTrackMenuOpen]);

  /* ─── Add track ──────────────────────────────────────────────── */
  const addTrack = useCallback(
    (kind: "video" | "audio" | "caption") => {
      const prefix = kind === "video" ? "V" : kind === "audio" ? "A" : "C";
      const accent =
        kind === "video" ? "#8B5CF6" : kind === "audio" ? "#F59E0B" : "#22D3EE";
      const existing = state.tracks.filter((t) => t.kind === kind);
      const n = existing.length + 1;
      const id = `${kind[0]}${n}-${Date.now().toString(36)}`;
      dispatch({
        type: "ADD_TRACK",
        track: { id, label: `${prefix}${n}`, kind, accent },
      });
      setAddTrackMenuOpen(false);
      toast.success(`${prefix}${n} track added`);
    },
    [state.tracks]
  );

  /* ─── Peaks renderer for audio clips ───────────────────────── */
  const renderPeaks = useCallback((clip: Clip, widthPx: number, heightPx: number) => (
    <Waveform peaks={clip.peaks} widthPx={widthPx} heightPx={heightPx} accent={clip.color || "#F59E0B"} />
  ), []);

  const totalMs = useMemo(
    () => state.clips.reduce((m, c) => Math.max(m, c.start + c.duration), 30_000),
    [state.clips]
  );

  const canUndo = history.past.length > 0;
  const canRedo = history.future.length > 0;

  return (
    <div className="flex flex-col bg-neutral-950 text-neutral-200 h-full min-h-[720px] border border-neutral-800 rounded-lg overflow-hidden">
      {/* Top: preview + transport + panels switcher */}
      <div className="flex gap-0 flex-1 min-h-0">
        {/* Preview */}
        <div className="flex-1 flex flex-col min-w-0 bg-black">
          <div className="flex-1 relative flex items-center justify-center overflow-hidden">
            {activeVideoClip ? (
              <video
                ref={videoRef}
                className="max-w-full max-h-full"
                style={previewStyle}
                muted={false}
                playsInline
              />
            ) : (
              <div className="text-neutral-600 text-sm font-mono">
                No clip at playhead — drop footage on V1 to begin
              </div>
            )}
          </div>
          {/* Transport bar */}
          <div className="flex items-center gap-2 px-3 py-2 bg-neutral-900 border-t border-neutral-800">
            <button
              type="button"
              onClick={() => dispatch({ type: "SET_PLAYHEAD", ms: 0 })}
              className="p-1.5 rounded hover:bg-neutral-800 text-neutral-300"
              title="Go to start"
            >
              <SkipBack size={14} />
            </button>
            <button
              type="button"
              onClick={() => dispatch({ type: "SET_PLAYHEAD", ms: Math.max(0, state.playhead - 1000) })}
              className="p-1.5 rounded hover:bg-neutral-800 text-neutral-300"
              title="-1s (J)"
            >
              <Rewind size={14} />
            </button>
            <button
              type="button"
              onClick={() => setPlaying((v) => !v)}
              className="p-1.5 rounded bg-rose-500 hover:bg-rose-400 text-white"
              title="Play/pause (Space)"
            >
              {playing ? <Pause size={14} /> : <Play size={14} />}
            </button>
            <button
              type="button"
              onClick={() => dispatch({ type: "SET_PLAYHEAD", ms: state.playhead + 1000 })}
              className="p-1.5 rounded hover:bg-neutral-800 text-neutral-300"
              title="+1s (L)"
            >
              <FastForward size={14} />
            </button>
            <button
              type="button"
              onClick={() => dispatch({ type: "SET_PLAYHEAD", ms: totalMs })}
              className="p-1.5 rounded hover:bg-neutral-800 text-neutral-300"
              title="Go to end"
            >
              <SkipForward size={14} />
            </button>

            <span className="px-2 py-0.5 bg-black/60 rounded font-mono text-[11px] text-neutral-300 tracking-wide">
              {msToTc(state.playhead, state.fps)} / {msToTc(totalMs, state.fps)}
            </span>

            {/* ── In/Out + Loop ───────────────────────────────────── */}
            <div className="flex items-center gap-px ml-1">
              <button
                type="button"
                onClick={() =>
                  dispatch({
                    type: state.markerIn !== null ? "SET_MARKER_IN" : "SET_MARKER_IN",
                    ms: state.markerIn !== null ? null : state.playhead,
                  })
                }
                onContextMenu={(e) => { e.preventDefault(); dispatch({ type: "SET_MARKER_IN", ms: null }); }}
                className={`px-1.5 py-1 rounded text-[10px] font-mono font-bold transition-colors ${
                  state.markerIn !== null
                    ? "bg-emerald-500/20 text-emerald-400"
                    : "hover:bg-neutral-800 text-neutral-500"
                }`}
                title="Set In (I) — right-click to clear"
              >
                I{state.markerIn !== null ? `·${msToTc(state.markerIn, state.fps).slice(3, 8)}` : ""}
              </button>
              <button
                type="button"
                onClick={() =>
                  dispatch({ type: "SET_MARKER_OUT", ms: state.markerOut !== null ? null : state.playhead })
                }
                onContextMenu={(e) => { e.preventDefault(); dispatch({ type: "SET_MARKER_OUT", ms: null }); }}
                className={`px-1.5 py-1 rounded text-[10px] font-mono font-bold transition-colors ${
                  state.markerOut !== null
                    ? "bg-rose-500/20 text-rose-400"
                    : "hover:bg-neutral-800 text-neutral-500"
                }`}
                title="Set Out (O) — right-click to clear"
              >
                O{state.markerOut !== null ? `·${msToTc(state.markerOut, state.fps).slice(3, 8)}` : ""}
              </button>
              <button
                type="button"
                onClick={() => setLooping((v) => !v)}
                className={`p-1.5 rounded transition-colors ${
                  looping && state.markerIn !== null && state.markerOut !== null
                    ? "text-cyan-400 bg-cyan-500/15"
                    : "text-neutral-500 hover:bg-neutral-800"
                }`}
                title="Loop In→Out region"
              >
                <Repeat size={13} />
              </button>
            </div>

            <div className="flex-1" />

            <button
              type="button"
              disabled={!canUndo}
              onClick={() => dispatch({ type: "UNDO" })}
              className="p-1.5 rounded hover:bg-neutral-800 text-neutral-300 disabled:opacity-30"
              title="Undo (Cmd+Z)"
            >
              <Undo2 size={14} />
            </button>
            <button
              type="button"
              disabled={!canRedo}
              onClick={() => dispatch({ type: "REDO" })}
              className="p-1.5 rounded hover:bg-neutral-800 text-neutral-300 disabled:opacity-30"
              title="Redo (Cmd+Shift+Z)"
            >
              <Redo2 size={14} />
            </button>
            <button
              type="button"
              onClick={() => {
                const underPlayhead = state.clips.find(
                  (c) => state.playhead > c.start && state.playhead < c.start + c.duration
                );
                if (underPlayhead) {
                  dispatch({ type: "SPLIT_CLIP", id: underPlayhead.id, atMs: state.playhead });
                }
              }}
              className="p-1.5 rounded hover:bg-neutral-800 text-neutral-300"
              title="Blade (Cmd+B)"
            >
              <Scissors size={14} />
            </button>
            <button
              type="button"
              onClick={() => {
                for (const id of state.selection) dispatch({ type: "DELETE_CLIP", id, ripple: true });
              }}
              className="p-1.5 rounded hover:bg-neutral-800 text-neutral-300"
              title="Ripple delete (Backspace)"
            >
              <Trash2 size={14} />
            </button>
            <button
              type="button"
              onClick={() => dispatch({ type: "SET_ZOOM", pixelsPerSecond: state.pixelsPerSecond * 0.87 })}
              className="p-1.5 rounded hover:bg-neutral-800 text-neutral-300"
              title="Zoom out"
            >
              <ZoomOut size={14} />
            </button>
            <button
              type="button"
              onClick={() => dispatch({ type: "SET_ZOOM", pixelsPerSecond: state.pixelsPerSecond * 1.15 })}
              className="p-1.5 rounded hover:bg-neutral-800 text-neutral-300"
              title="Zoom in"
            >
              <ZoomIn size={14} />
            </button>

            {/* ── Speed selector (contextual — selected clip only) ── */}
            {selectedClip && (
              <>
                <div className="w-px h-4 bg-neutral-700 mx-1" />
                <div className="flex items-center gap-px">
                  {([0.25, 0.5, 1, 1.5, 2] as const).map((s) => {
                    const active = Math.abs((selectedClip.speed ?? 1) - s) < 0.01;
                    return (
                      <button
                        key={s}
                        type="button"
                        onClick={() => setSpeed(s)}
                        className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-medium transition-colors ${
                          active
                            ? "bg-indigo-500/25 text-indigo-300 border border-indigo-500/50"
                            : "text-neutral-500 hover:bg-neutral-800 hover:text-neutral-300"
                        }`}
                        title={`Set speed to ${s}×`}
                      >
                        {s}×
                      </button>
                    );
                  })}
                </div>
              </>
            )}

            {/* ── Add Caption at playhead ───────────────────────────── */}
            <div className="w-px h-4 bg-neutral-700 mx-1" />
            <button
              type="button"
              onClick={addCaption}
              className="flex items-center gap-1 px-2 py-1 rounded hover:bg-neutral-800 text-neutral-400 hover:text-neutral-200 text-[11px] transition-colors"
              title="Add caption clip at playhead"
            >
              <Type size={12} />
              <span>Caption</span>
            </button>

            {/* ── Add Track dropdown ────────────────────────────────── */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setAddTrackMenuOpen((v) => !v)}
                className="flex items-center gap-0.5 px-2 py-1 rounded hover:bg-neutral-800 text-neutral-400 hover:text-neutral-200 text-[11px] transition-colors"
                title="Add new track"
              >
                <Plus size={12} />
                <span>Track</span>
                <ChevronDown size={10} className={`transition-transform ${addTrackMenuOpen ? "rotate-180" : ""}`} />
              </button>
              {addTrackMenuOpen && (
                <div className="absolute right-0 bottom-full mb-1 bg-neutral-900 border border-neutral-700 rounded-lg shadow-xl py-1 min-w-[110px] z-50">
                  {(["video", "audio", "caption"] as const).map((kind) => (
                    <button
                      key={kind}
                      type="button"
                      onClick={() => { addTrack(kind); setAddTrackMenuOpen(false); }}
                      className="w-full text-left px-3 py-1.5 text-[11px] text-neutral-300 hover:bg-neutral-800 capitalize transition-colors"
                    >
                      {kind === "video" ? "🎬" : kind === "audio" ? "🎵" : "💬"} {kind.charAt(0).toUpperCase() + kind.slice(1)} track
                    </button>
                  ))}
                </div>
              )}
            </div>

            <ElectronBar
              onFilesImported={(paths) => {
                const v1 = state.tracks.find((t) => t.kind === "video");
                if (!v1) return;
                let cursor = state.clips.reduce((m, c) => (c.trackId === v1.id ? Math.max(m, c.start + c.duration) : m), 0);
                for (const p of paths) {
                  dispatch({
                    type: "ADD_CLIP",
                    clip: {
                      id: `clip-${Date.now()}-${cursor}`,
                      trackId: v1.id,
                      start: cursor,
                      duration: 5000,
                      label: p.split(/[\\/]/).pop() || "Clip",
                      color: v1.accent,
                      src: p,
                    },
                  });
                  cursor += 5000;
                }
              }}
              composition={{ clips: state.clips, tracks: state.tracks, fps: state.fps }}
            />

            <button
              type="button"
              onClick={onRender}
              className="flex items-center gap-1 bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/40 text-amber-200 rounded-md px-3 py-1 text-[11px]"
              title="Render to hyperframes worker"
            >
              <Download size={12} /> Render
            </button>
          </div>
        </div>

        {/* Right dock: AI | Effects | Assets */}
        <div className="flex flex-col">
          <div className="flex border-l border-b border-neutral-800 bg-neutral-900">
            <button
              type="button"
              onClick={() => setPanel("ai")}
              className={`flex-1 flex items-center justify-center gap-1 text-[11px] px-2 py-1.5 border-r border-neutral-800 ${
                panel === "ai" ? "bg-neutral-800 text-amber-300" : "text-neutral-400 hover:text-white"
              }`}
            >
              <Sparkles size={11} /> AI
            </button>
            <button
              type="button"
              onClick={() => setPanel("effects")}
              className={`flex-1 flex items-center justify-center gap-1 text-[11px] px-2 py-1.5 border-r border-neutral-800 ${
                panel === "effects" ? "bg-neutral-800 text-amber-300" : "text-neutral-400 hover:text-white"
              }`}
            >
              <SlidersHorizontal size={11} /> FX
            </button>
            <button
              type="button"
              onClick={() => setPanel("assets")}
              className={`flex-1 flex items-center justify-center gap-1 text-[11px] px-2 py-1.5 ${
                panel === "assets" ? "bg-neutral-800 text-indigo-400" : "text-neutral-400 hover:text-white"
              }`}
            >
              <LibraryBig size={11} /> Assets
            </button>
          </div>
          {panel === "ai" && (
            <AiPanel state={state} dispatch={dispatch as (a: EditorAction) => void} />
          )}
          {panel === "effects" && (
            <EffectsPanel state={state} dispatch={dispatch as (a: EditorAction) => void} />
          )}
          {panel === "assets" && (
            <SfxVfxBrollPanel state={state} dispatch={dispatch as (a: EditorAction) => void} />
          )}
        </div>
      </div>

      {/* Bottom: timeline */}
      <div className="shrink-0">
        <PremiereTimeline
          state={state}
          dispatch={dispatch as (a: EditorAction) => void}
          renderPeaks={renderPeaks}
          totalDurationMs={totalMs}
        />
      </div>
    </div>
  );
}
