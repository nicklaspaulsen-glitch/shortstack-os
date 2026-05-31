"use client";
import { FilmStrip, Lightning, MagnifyingGlass, MusicNote, Plus, SpeakerHigh, SpeakerX, Tag } from "@phosphor-icons/react";

/**
 * SfxVfxBrollPanel — asset browser for sound effects, VFX, and B-roll.
 *
 * Three tabs:
 *   SFX    — Browse SFX_LIBRARY, preview via Web Audio tone, drag/click to A2·SFX track
 *   VFX    — Browse EFFECTS_CATALOG, click to add overlay clip on FX track
 *   B-Roll — MagnifyingGlass curated footage concepts; click to add placeholder clip on V2/V3
 *
 * Integrates with the editor via ADD_CLIP dispatch actions.
 */

import { useState, useCallback, useRef } from "react";
import { SFX_LIBRARY, EFFECTS_CATALOG } from "@/lib/asset-catalog";
import type { EditorState, EditorAction } from "@/lib/video-editor/types";

/* ──────────────────── B-roll concept catalogue ──────────────────── */

interface BrollConcept {
  id: string;
  label: string;
  keywords: string[];
  preview: string; // CSS gradient used as placeholder thumbnail
  category: string;
}

const BROLL_CATALOGUE: BrollConcept[] = [
  { id: "city-skyline", label: "City Skyline", keywords: ["urban", "city", "skyline", "buildings"], preview: "linear-gradient(135deg, #0f2027, #203a43, #2c5364)", category: "Urban" },
  { id: "coffee-shop", label: "Coffee Shop", keywords: ["cafe", "coffee", "cozy", "people"], preview: "linear-gradient(135deg, #4a2c0a, #8b5e3c, #c4926a)", category: "Lifestyle" },
  { id: "laptop-desk", label: "Laptop on Desk", keywords: ["work", "office", "productivity", "tech"], preview: "linear-gradient(135deg, #1a1a2e, #16213e, #0f3460)", category: "Tech" },
  { id: "ocean-waves", label: "Ocean Waves", keywords: ["ocean", "sea", "waves", "nature"], preview: "linear-gradient(135deg, #00b4d8, #0077b6, #03045e)", category: "Nature" },
  { id: "hands-typing", label: "Hands Typing", keywords: ["keyboard", "type", "code", "write"], preview: "linear-gradient(135deg, #2d3436, #636e72, #b2bec3)", category: "Tech" },
  { id: "sunrise-mountains", label: "Sunrise Mountains", keywords: ["sunrise", "mountains", "landscape", "golden"], preview: "linear-gradient(135deg, #f06292, #ffb74d, #fff176)", category: "Nature" },
  { id: "city-traffic", label: "City Traffic", keywords: ["traffic", "car", "road", "timelapse"], preview: "linear-gradient(135deg, #212121, #424242, #f57c00)", category: "Urban" },
  { id: "whiteboard-meeting", label: "Whiteboard Meeting", keywords: ["meeting", "office", "team", "presentation"], preview: "linear-gradient(135deg, #eceff1, #cfd8dc, #90a4ae)", category: "Business" },
  { id: "coding-screen", label: "Code Editor", keywords: ["code", "programming", "developer", "screen"], preview: "linear-gradient(135deg, #0d1117, #161b22, #1f6feb)", category: "Tech" },
  { id: "drone-forest", label: "Drone Forest", keywords: ["drone", "forest", "aerial", "trees", "nature"], preview: "linear-gradient(135deg, #1b5e20, #388e3c, #66bb6a)", category: "Nature" },
  { id: "clock-ticking", label: "Clock Close-up", keywords: ["clock", "time", "deadline", "close-up"], preview: "linear-gradient(135deg, #3e2723, #6d4c41, #a1887f)", category: "Abstract" },
  { id: "street-walk", label: "Street Walk POV", keywords: ["street", "walk", "pov", "urban", "person"], preview: "linear-gradient(135deg, #37474f, #546e7a, #78909c)", category: "Urban" },
];

/* ──────────────────── Types ──────────────────── */

interface Props {
  state: EditorState;
  dispatch: (action: EditorAction) => void;
}

type PanelTab = "sfx" | "vfx" | "broll";

/* ──────────────────── Helpers ──────────────────── */

/** Find track by partial label match, case-insensitive. */
function findTrack(state: EditorState, labelHint: string) {
  return state.tracks.find((t) =>
    t.label.toLowerCase().includes(labelHint.toLowerCase()),
  );
}

/** Cursor = next available start position on a track. */
function trackCursor(state: EditorState, trackId: string): number {
  return state.clips
    .filter((c) => c.trackId === trackId)
    .reduce((max, c) => Math.max(max, c.start + c.duration), state.playhead);
}

/* ──────────────────── Web Audio SFX preview ──────────────────── */

let _audioCtx: AudioContext | null = null;
function getAudioCtx(): AudioContext {
  if (!_audioCtx) {
    _audioCtx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
  }
  return _audioCtx;
}

function playSfxTone(category: string, durationSec: number) {
  try {
    const ctx = getAudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);

    // Different waveforms/frequencies for different SFX categories
    const configs: Record<string, { type: OscillatorType; freq: number }> = {
      impact: { type: "sawtooth", freq: 80 },
      ambient: { type: "sine", freq: 200 },
      tech: { type: "square", freq: 440 },
      transition: { type: "sine", freq: 600 },
    };
    const cfg = configs[category] ?? { type: "sine", freq: 300 };
    osc.type = cfg.type;
    osc.frequency.setValueAtTime(cfg.freq, ctx.currentTime);
    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + Math.min(durationSec, 0.8));

    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + Math.min(durationSec, 0.8));
  } catch {
    // Web Audio API not available — silent fail
  }
}

/* ──────────────────── Sub-panels ──────────────────── */

function SfxTab({ state, dispatch }: Props) {
  const [search, setSearch] = useState("");
  const [playing, setPlaying] = useState<string | null>(null);

  const filtered = SFX_LIBRARY.filter(
    (s) =>
      !search ||
      s.name.toLowerCase().includes(search.toLowerCase()) ||
      s.category.toLowerCase().includes(search.toLowerCase()),
  );

  const addSfx = useCallback(
    (sfxId: string) => {
      const sfx = SFX_LIBRARY.find((s) => s.id === sfxId);
      if (!sfx) return;
      const track = findTrack(state, "SFX") ?? findTrack(state, "A2") ?? state.tracks.find((t) => t.kind === "audio");
      if (!track) return;
      const start = trackCursor(state, track.id);
      dispatch({
        type: "ADD_CLIP",
        clip: {
          id: `sfx-${sfxId}-${Date.now()}`,
          trackId: track.id,
          start,
          duration: sfx.duration_sec * 1000,
          label: sfx.name,
          color: track.accent,
          src: sfx.free_alt_url ?? undefined,
        },
      });
    },
    [state, dispatch],
  );

  const previewSfx = useCallback((sfx: (typeof SFX_LIBRARY)[0]) => {
    setPlaying(sfx.id);
    playSfxTone(sfx.category, sfx.duration_sec);
    setTimeout(() => setPlaying(null), Math.min(sfx.duration_sec * 1000, 800));
  }, []);

  const categoryColors: Record<string, string> = {
    impact: "text-orange-400 bg-orange-400/10",
    ambient: "text-sky-400 bg-sky-400/10",
    tech: "text-purple-400 bg-purple-400/10",
    transition: "text-emerald-400 bg-emerald-400/10",
  };

  return (
    <div className="flex flex-col h-full">
      <div className="px-2 pt-2 pb-1">
        <div className="flex items-center gap-1 bg-neutral-800 rounded px-2 py-1 text-neutral-400">
          <MagnifyingGlass size={10} />
          <input
            type="text"
            placeholder="Search SFX…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="bg-transparent flex-1 text-[11px] text-neutral-200 placeholder-neutral-500 outline-none min-w-0"
          />
        </div>
      </div>
      <div className="flex-1 overflow-y-auto px-2 pb-2 space-y-0.5">
        {filtered.map((sfx) => (
          <div
            key={sfx.id}
            className="flex items-center gap-2 py-1.5 px-2 rounded hover:bg-neutral-800 group cursor-pointer"
            onClick={() => addSfx(sfx.id)}
          >
            <button
              type="button"
              title="Preview"
              onClick={(e) => {
                e.stopPropagation();
                previewSfx(sfx);
              }}
              className="shrink-0 p-1 rounded hover:bg-neutral-700 text-neutral-400 hover:text-white transition-colors"
            >
              {playing === sfx.id ? <SpeakerHigh size={12} className="text-indigo-400" /> : <SpeakerX size={12} />}
            </button>
            <div className="flex-1 min-w-0">
              <p className="text-[11px] text-neutral-200 truncate">{sfx.name}</p>
              <p className="text-[10px] text-neutral-500 truncate">{sfx.desc}</p>
            </div>
            <span className={`shrink-0 text-[9px] px-1.5 py-0.5 rounded-full font-medium ${categoryColors[sfx.category] ?? "text-neutral-400 bg-neutral-700"}`}>
              {sfx.category}
            </span>
            <span className="shrink-0 text-[10px] text-neutral-500">{sfx.duration_sec}s</span>
            <button
              type="button"
              title="Add to timeline"
              onClick={(e) => { e.stopPropagation(); addSfx(sfx.id); }}
              className="shrink-0 p-1 rounded opacity-0 group-hover:opacity-100 hover:bg-indigo-500/20 text-indigo-400 transition-all"
            >
              <Plus size={11} />
            </button>
          </div>
        ))}
        {filtered.length === 0 && (
          <p className="text-[11px] text-neutral-500 text-center py-4">No SFX matching &ldquo;{search}&rdquo;</p>
        )}
      </div>
    </div>
  );
}

function VfxTab({ state, dispatch }: Props) {
  const [search, setSearch] = useState("");
  const [intensities, setIntensities] = useState<Record<string, number>>({});

  const filtered = EFFECTS_CATALOG.filter(
    (e) =>
      !search ||
      e.name.toLowerCase().includes(search.toLowerCase()) ||
      e.category.toLowerCase().includes(search.toLowerCase()),
  );

  const addVfx = useCallback(
    (effectId: string) => {
      const effect = EFFECTS_CATALOG.find((e) => e.id === effectId);
      if (!effect) return;
      // Add to FX track, or first video track as fallback
      const track = findTrack(state, "FX") ?? state.tracks.find((t) => t.kind === "video");
      if (!track) return;
      const intensity = (intensities[effectId] ?? 80) / 100;
      const start = state.playhead;
      const duration = 2000; // 2 s default overlay
      dispatch({
        type: "ADD_CLIP",
        clip: {
          id: `vfx-${effectId}-${Date.now()}`,
          trackId: track.id,
          start,
          duration,
          label: `${effect.name} (${Math.round(intensity * 100)}%)`,
          color: track.accent,
          // Store intensity as opacity keyframe
          keyframes: {
            opacity: [
              { frame: 0, value: intensity },
              { frame: duration, value: intensity },
            ],
          },
        },
      });
    },
    [state, dispatch, intensities],
  );

  const categoryColors: Record<string, string> = {
    transition: "text-violet-400 bg-violet-400/10",
    overlay: "text-amber-400 bg-amber-400/10",
    filter: "text-teal-400 bg-teal-400/10",
  };

  return (
    <div className="flex flex-col h-full">
      <div className="px-2 pt-2 pb-1">
        <div className="flex items-center gap-1 bg-neutral-800 rounded px-2 py-1 text-neutral-400">
          <MagnifyingGlass size={10} />
          <input
            type="text"
            placeholder="Search VFX…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="bg-transparent flex-1 text-[11px] text-neutral-200 placeholder-neutral-500 outline-none min-w-0"
          />
        </div>
      </div>
      <div className="flex-1 overflow-y-auto px-2 pb-2">
        <div className="grid grid-cols-2 gap-1.5">
          {filtered.map((effect) => (
            <div
              key={effect.id}
              className="relative rounded-lg overflow-hidden border border-neutral-700/60 hover:border-indigo-500/50 cursor-pointer group transition-colors"
              onClick={() => addVfx(effect.id)}
              title={effect.description}
            >
              {/* Preview gradient */}
              <div
                className="h-[46px] w-full"
                style={{ background: effect.preview }}
              />
              {/* Intensity slider */}
              <div className="px-1.5 py-1 bg-neutral-900">
                <div className="flex items-center justify-between mb-0.5">
                  <p className="text-[10px] text-neutral-200 truncate">{effect.name}</p>
                  <span className={`text-[8px] px-1 py-px rounded-full ${categoryColors[effect.category] ?? "text-neutral-400 bg-neutral-700"}`}>
                    {effect.category}
                  </span>
                </div>
                <input
                  type="range"
                  min={10}
                  max={100}
                  value={intensities[effect.id] ?? 80}
                  onChange={(e) => {
                    e.stopPropagation();
                    setIntensities((prev) => ({ ...prev, [effect.id]: Number(e.target.value) }));
                  }}
                  onClick={(e) => e.stopPropagation()}
                  className="w-full h-0.5 accent-blue-500 cursor-pointer"
                  title={`Intensity: ${intensities[effect.id] ?? 80}%`}
                />
              </div>
              {/* Add overlay */}
              <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); addVfx(effect.id); }}
                  className="p-0.5 rounded bg-indigo-500 text-white hover:bg-indigo-400"
                >
                  <Plus size={10} />
                </button>
              </div>
            </div>
          ))}
        </div>
        {filtered.length === 0 && (
          <p className="text-[11px] text-neutral-500 text-center py-4">No effects matching &ldquo;{search}&rdquo;</p>
        )}
      </div>
    </div>
  );
}

function BrollTab({ state, dispatch }: Props) {
  const [search, setSearch] = useState("");
  const [adding, setAdding] = useState<string | null>(null);

  const filtered = BROLL_CATALOGUE.filter(
    (b) =>
      !search ||
      b.label.toLowerCase().includes(search.toLowerCase()) ||
      b.category.toLowerCase().includes(search.toLowerCase()) ||
      b.keywords.some((k) => k.includes(search.toLowerCase())),
  );

  const addBroll = useCallback(
    async (concept: BrollConcept) => {
      setAdding(concept.id);
      try {
        // Find V2 or V3 track for B-roll (avoid V1 which is main footage)
        const brollTrack =
          findTrack(state, "V2") ??
          findTrack(state, "V3") ??
          state.tracks.filter((t) => t.kind === "video")[1] ??
          state.tracks.find((t) => t.kind === "video");
        if (!brollTrack) return;

        const start = trackCursor(state, brollTrack.id);
        dispatch({
          type: "ADD_CLIP",
          clip: {
            id: `broll-${concept.id}-${Date.now()}`,
            trackId: brollTrack.id,
            start,
            duration: 5000,
            label: `B-roll: ${concept.label}`,
            color: brollTrack.accent,
            // No src — placeholder clip awaiting real footage
          },
        });
      } finally {
        setAdding(null);
      }
    },
    [state, dispatch],
  );

  const categoryColors: Record<string, string> = {
    Urban: "text-sky-400 bg-sky-400/10",
    Nature: "text-emerald-400 bg-emerald-400/10",
    Tech: "text-purple-400 bg-purple-400/10",
    Lifestyle: "text-rose-400 bg-rose-400/10",
    Business: "text-amber-400 bg-amber-400/10",
    Abstract: "text-indigo-400 bg-indigo-400/10",
  };

  return (
    <div className="flex flex-col h-full">
      <div className="px-2 pt-2 pb-1">
        <div className="flex items-center gap-1 bg-neutral-800 rounded px-2 py-1 text-neutral-400">
          <MagnifyingGlass size={10} />
          <input
            type="text"
            placeholder="Search B-roll…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="bg-transparent flex-1 text-[11px] text-neutral-200 placeholder-neutral-500 outline-none min-w-0"
          />
        </div>
      </div>
      <p className="text-[10px] text-neutral-500 px-3 py-1">
        Adds a placeholder clip on V2. Replace with real footage later.
      </p>
      <div className="flex-1 overflow-y-auto px-2 pb-2">
        <div className="grid grid-cols-2 gap-1.5">
          {filtered.map((concept) => (
            <button
              key={concept.id}
              type="button"
              onClick={() => void addBroll(concept)}
              disabled={adding === concept.id}
              className="text-left rounded-lg overflow-hidden border border-neutral-700/60 hover:border-indigo-500/50 transition-colors group disabled:opacity-60"
            >
              {/* Thumbnail preview */}
              <div
                className="h-[44px] w-full relative flex items-center justify-center"
                style={{ background: concept.preview }}
              >
                {adding === concept.id && (
                  <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                    <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  </div>
                )}
                <div className="absolute bottom-0.5 right-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                  <div className="p-0.5 rounded bg-indigo-500 text-white">
                    <Plus size={9} />
                  </div>
                </div>
              </div>
              <div className="px-1.5 py-1 bg-neutral-900">
                <div className="flex items-center justify-between gap-1">
                  <p className="text-[10px] text-neutral-200 truncate">{concept.label}</p>
                  <span className={`shrink-0 text-[8px] px-1 py-px rounded-full ${categoryColors[concept.category] ?? "text-neutral-400 bg-neutral-700"}`}>
                    {concept.category}
                  </span>
                </div>
                <div className="flex items-center gap-0.5 mt-0.5 flex-wrap">
                  {concept.keywords.slice(0, 3).map((kw) => (
                    <span key={kw} className="flex items-center gap-0.5 text-[9px] text-neutral-500">
                      <Tag size={7} />{kw}
                    </span>
                  ))}
                </div>
              </div>
            </button>
          ))}
        </div>
        {filtered.length === 0 && (
          <p className="text-[11px] text-neutral-500 text-center py-4">No B-roll matching &ldquo;{search}&rdquo;</p>
        )}
      </div>
    </div>
  );
}

/* ──────────────────── Main export ──────────────────── */

export function SfxVfxBrollPanel({ state, dispatch }: Props) {
  const [tab, setTab] = useState<PanelTab>("sfx");

  const tabs: { id: PanelTab; label: string; icon: React.ReactNode }[] = [
    { id: "sfx", label: "SFX", icon: <MusicNote size={10} /> },
    { id: "vfx", label: "VFX", icon: <Lightning size={10} /> },
    { id: "broll", label: "B-Roll", icon: <FilmStrip size={10} /> },
  ];

  return (
    <div className="w-[200px] flex flex-col h-full border-l border-neutral-800 bg-neutral-950">
      {/* Tab strip */}
      <div className="flex border-b border-neutral-800 shrink-0">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`flex-1 flex items-center justify-center gap-1 text-[10px] py-1.5 border-r border-neutral-800 last:border-r-0 transition-colors ${
              tab === t.id
                ? "bg-neutral-800 text-indigo-400"
                : "text-neutral-400 hover:text-white"
            }`}
          >
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {/* Panel content */}
      <div className="flex-1 overflow-hidden">
        {tab === "sfx" && <SfxTab state={state} dispatch={dispatch} />}
        {tab === "vfx" && <VfxTab state={state} dispatch={dispatch} />}
        {tab === "broll" && <BrollTab state={state} dispatch={dispatch} />}
      </div>
    </div>
  );
}
