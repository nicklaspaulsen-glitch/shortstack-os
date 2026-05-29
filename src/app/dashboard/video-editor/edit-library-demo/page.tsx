"use client";

/**
 * Simplified video editor flow: drop → analyze → pick edits → apply.
 * Reference implementation for the "start simple, reveal on demand" pattern.
 */

import { useState, useCallback, useRef, useEffect } from "react";
import { EditLibraryPanel } from "@/components/video-editor/edit-library-panel";
import type {
  EditLibrary,
  EditCategory,
  EditDecisionAlternative,
} from "@/lib/auto-edit-types";
import {
  FilmStrip,
  UploadSimple,
  Sparkle,
  CheckCircle,
  ArrowLeft,
  Play,
} from "@phosphor-icons/react";

/* ── Flow state ─────────────────────────────────────────────────── */

type FlowStep = "drop" | "analyzing" | "library" | "done";

const ANALYSIS_STAGES = [
  "Detecting scenes and cuts...",
  "Reading facial expressions...",
  "Mapping energy and pacing...",
  "Identifying comedy beats...",
  "Selecting music and SFX...",
  "Building your edit plan...",
];

/* ── Mock data ──────────────────────────────────────────────────── */

function mockLibrary(): EditLibrary {
  return {
    scene_count: 12,
    total_duration_sec: 147,
    total_decisions: 14,
    enabled_count: 10,
    categories: {
      music: [
        {
          id: "mus_1",
          category: "music",
          label: "Lo-fi chill beat — 90 BPM",
          description: "Instrumental lo-fi hip-hop loop with warm vinyl texture.",
          enabled: true,
          confidence: 0.92,
          timestamp_sec: 0,
          payload: { track_id: "lofi_chill_01", bpm: 90, mood: "chill" },
          director_note: "Matches the relaxed intro energy. Fade in over first 3 seconds.",
          alternatives: [
            { id: "mus_1a", label: "Acoustic guitar loop — 85 BPM", payload: { track_id: "acoustic_01", bpm: 85 } },
            { id: "mus_1b", label: "Ambient pad — 70 BPM", payload: { track_id: "ambient_01", bpm: 70 } },
          ],
        },
      ],
      zoom: [
        {
          id: "zoom_1",
          category: "zoom",
          label: "Face zoom on punchline",
          description: "Punch in 1.4x on the comedic beat, hold 800ms.",
          enabled: true,
          confidence: 0.88,
          timestamp_sec: 12.4,
          payload: { type: "face_zoom", scale: 1.4, duration_ms: 800 },
          director_note: "Strong comedic beat — zoom sells the reaction.",
          alternatives: [
            { id: "zoom_1a", label: "Slow push-in 1.2x", payload: { type: "push_in", scale: 1.2, duration_ms: 1200 } },
          ],
        },
        {
          id: "zoom_2",
          category: "zoom",
          label: "Product close-up",
          description: "Zoom to 1.6x on held product, fill frame 600ms.",
          enabled: true,
          confidence: 0.75,
          timestamp_sec: 24.1,
          payload: { type: "object_zoom", scale: 1.6, duration_ms: 600 },
          director_note: "Speaker holds up product — zoom to fill frame.",
          alternatives: [],
        },
        {
          id: "zoom_3",
          category: "zoom",
          label: "Wide pull-out for context",
          description: "Pull out to 0.8x wide shot over 1s.",
          enabled: false,
          confidence: 0.6,
          timestamp_sec: 35.0,
          payload: { type: "pull_out", scale: 0.8, duration_ms: 1000 },
          director_note: "Scene transition — wide shot establishes new location.",
          alternatives: [],
        },
      ],
      effect: [
        {
          id: "fx_1",
          category: "effect",
          label: "Flash cut on beat drop",
          description: "White flash at 2x brightness for 100ms on peak.",
          enabled: true,
          confidence: 0.95,
          timestamp_sec: 8.2,
          payload: { type: "flash_cut", brightness: 2.0, duration_ms: 100 },
          director_note: "Music peaks here. Flash emphasises the energy shift.",
          alternatives: [
            { id: "fx_1a", label: "Shake effect", payload: { type: "shake", intensity: 0.3, duration_ms: 200 } },
            { id: "fx_1b", label: "Glitch transition", payload: { type: "glitch", blocks: 8, duration_ms: 150 } },
          ],
        },
        {
          id: "fx_2",
          category: "effect",
          label: "Slow-mo emphasis",
          description: "50% speed for 2s on the key reveal.",
          enabled: true,
          confidence: 0.82,
          timestamp_sec: 18.5,
          payload: { type: "slow_motion", speed: 0.5, duration_ms: 2000 },
          director_note: "Slowing lets the audience absorb the reveal.",
          alternatives: [],
        },
      ],
      transition: [
        {
          id: "tr_1",
          category: "transition",
          label: "Whip pan to scene 2",
          description: "Left whip pan over 300ms between scenes.",
          enabled: true,
          confidence: 0.87,
          timestamp_sec: 15.0,
          payload: { type: "whip_pan", direction: "left", duration_ms: 300 },
          director_note: "Energy is high. Whip pan maintains momentum.",
          alternatives: [
            { id: "tr_1a", label: "Cross dissolve", payload: { type: "dissolve", duration_ms: 500 } },
            { id: "tr_1b", label: "Hard cut", payload: { type: "cut", duration_ms: 0 } },
          ],
        },
        {
          id: "tr_2",
          category: "transition",
          label: "Fade to black before CTA",
          description: "800ms fade to black for dramatic pause.",
          enabled: true,
          confidence: 0.91,
          timestamp_sec: 42.0,
          payload: { type: "fade_black", duration_ms: 800 },
          director_note: "Dramatic pause before the call-to-action.",
          alternatives: [],
        },
      ],
      sfx: [
        {
          id: "sfx_1",
          category: "sfx",
          label: "Whoosh on whip pan",
          description: "Fast whoosh at 70% volume synced to transition.",
          enabled: true,
          confidence: 0.9,
          timestamp_sec: 15.0,
          payload: { sound_id: "whoosh_fast_01", volume: 0.7 },
          director_note: "Without audio cue the pan feels incomplete.",
          alternatives: [
            { id: "sfx_1a", label: "Soft swoosh", payload: { sound_id: "swoosh_soft_01", volume: 0.5 } },
          ],
        },
        {
          id: "sfx_2",
          category: "sfx",
          label: "Click on text pop",
          description: "Subtle click-pop at 40% volume on text appear.",
          enabled: false,
          confidence: 0.55,
          timestamp_sec: 20.0,
          payload: { sound_id: "click_pop_01", volume: 0.4 },
          director_note: "Optional — might be too much with many SFX already.",
          alternatives: [],
        },
      ],
      caption: [
        {
          id: "cap_1",
          category: "caption",
          label: "Word-highlight captions",
          description: "Lime word-by-word highlight, bottom position.",
          enabled: true,
          confidence: 0.94,
          timestamp_sec: 0,
          payload: { style: "word_highlight", color: "#D4FF00", position: "bottom" },
          director_note: "Matches brand accent. Full video.",
          alternatives: [
            { id: "cap_1a", label: "Karaoke-style white", payload: { style: "karaoke", color: "#FFFFFF", position: "bottom" } },
          ],
        },
      ],
      broll: [
        {
          id: "br_1",
          category: "broll",
          label: "Screen recording overlay",
          description: "4s dashboard UI overlay when product is mentioned.",
          enabled: true,
          confidence: 0.78,
          timestamp_sec: 28.0,
          payload: { type: "screen_recording", query: "dashboard UI demo", duration_sec: 4 },
          director_note: "B-roll of actual UI reinforces credibility.",
          alternatives: [
            { id: "br_1a", label: "Stock footage — laptop", payload: { type: "stock", query: "person using laptop", duration_sec: 3 } },
          ],
        },
      ],
      cut: [
        {
          id: "cut_1",
          category: "cut",
          label: "Remove dead air 6.1s–7.3s",
          description: "Cut 1.2s silence to tighten pacing.",
          enabled: true,
          confidence: 0.96,
          timestamp_sec: 6.1,
          payload: { start_sec: 6.1, end_sec: 7.3, reason: "dead_air" },
          director_note: "Removing tightens pacing without losing content.",
          alternatives: [],
        },
      ],
    },
  };
}

/* ── Page ────────────────────────────────────────────────────────── */

export default function EditorFlowPage() {
  const [step, setStep] = useState<FlowStep>("drop");
  const [progress, setProgress] = useState(0);
  const [stageIdx, setStageIdx] = useState(0);
  const [dragOver, setDragOver] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const [library, setLibrary] = useState<EditLibrary>(mockLibrary);
  const [applying, setApplying] = useState(false);
  const [appliedCount, setAppliedCount] = useState(0);

  /* ── Analysis simulation ──────────────────────────────────────── */

  const startAnalysis = useCallback((name: string) => {
    setFileName(name);
    setStep("analyzing");
    setProgress(0);
    setStageIdx(0);
  }, []);

  useEffect(() => {
    if (step !== "analyzing") return;
    const tick = setInterval(() => {
      setProgress((p) => {
        const next = Math.min(p + Math.random() * 12 + 4, 100);
        setStageIdx(Math.min(Math.floor((next / 100) * ANALYSIS_STAGES.length), ANALYSIS_STAGES.length - 1));
        if (next >= 100) {
          clearInterval(tick);
          setTimeout(() => setStep("library"), 600);
        }
        return next;
      });
    }, 350);
    return () => clearInterval(tick);
  }, [step]);

  /* ── Drop / file handlers ─────────────────────────────────────── */

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const file = e.dataTransfer.files?.[0];
      if (file) startAnalysis(file.name);
    },
    [startAnalysis],
  );

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) startAnalysis(file.name);
    },
    [startAnalysis],
  );

  /* ── Library handlers ─────────────────────────────────────────── */

  const handleToggle = useCallback((id: string, enabled: boolean) => {
    setLibrary((prev) => {
      const next = { ...prev, categories: { ...prev.categories } };
      let delta = 0;
      for (const cat of Object.keys(next.categories) as EditCategory[]) {
        next.categories[cat] = next.categories[cat].map((d) => {
          if (d.id !== id) return d;
          delta = enabled ? 1 : -1;
          return { ...d, enabled };
        });
      }
      next.enabled_count = Math.max(0, next.enabled_count + delta);
      return next;
    });
  }, []);

  const handleSwap = useCallback((id: string, alt: EditDecisionAlternative) => {
    setLibrary((prev) => {
      const next = { ...prev, categories: { ...prev.categories } };
      for (const cat of Object.keys(next.categories) as EditCategory[]) {
        next.categories[cat] = next.categories[cat].map((d) => {
          if (d.id !== id) return d;
          const oldPrimary = { id: d.id + "_prev", label: d.label, payload: d.payload };
          const newAlts = d.alternatives.filter((a) => a.id !== alt.id);
          newAlts.push(oldPrimary);
          return { ...d, label: alt.label, payload: alt.payload, alternatives: newAlts };
        });
      }
      return next;
    });
  }, []);

  const handleBulkToggle = useCallback((category: EditCategory, enabled: boolean) => {
    setLibrary((prev) => {
      const next = { ...prev, categories: { ...prev.categories } };
      let delta = 0;
      next.categories[category] = next.categories[category].map((d) => {
        if (d.enabled !== enabled) delta += enabled ? 1 : -1;
        return { ...d, enabled };
      });
      next.enabled_count = Math.max(0, next.enabled_count + delta);
      return next;
    });
  }, []);

  const handleApply = useCallback((enabledIds: string[]) => {
    setApplying(true);
    setTimeout(() => {
      setApplying(false);
      setAppliedCount(enabledIds.length);
      setStep("done");
    }, 1800);
  }, []);

  const reset = useCallback(() => {
    setStep("drop");
    setProgress(0);
    setStageIdx(0);
    setFileName(null);
    setLibrary(mockLibrary());
    setAppliedCount(0);
  }, []);

  /* ── Step: Drop zone ──────────────────────────────────────────── */

  if (step === "drop") {
    return (
      <div className="flex items-center justify-center min-h-[75vh] px-6">
        <div className="w-full max-w-md">
          <div
            role="button"
            tabIndex={0}
            onClick={() => fileRef.current?.click()}
            onKeyDown={(e) => e.key === "Enter" && fileRef.current?.click()}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            className={`
              relative flex flex-col items-center justify-center gap-5 rounded-2xl
              border-2 border-dashed py-20 px-8 cursor-pointer
              transition-all duration-220 ease-out
              ${dragOver
                ? "border-[#D4FF00]/50 bg-[#D4FF00]/[0.03] scale-[1.01]"
                : "border-white/[0.08] hover:border-white/20 bg-transparent"
              }
            `}
          >
            <div className={`
              rounded-full p-4 transition-colors duration-220
              ${dragOver ? "bg-[#D4FF00]/10" : "bg-white/[0.04]"}
            `}>
              {dragOver
                ? <UploadSimple size={32} weight="light" className="text-[#D4FF00]/70" />
                : <FilmStrip size={32} weight="light" className="text-white/30" />
              }
            </div>

            <div className="text-center">
              <p className="text-[15px] font-medium text-white/80">
                Drop your footage here
              </p>
              <p className="text-[13px] text-white/30 mt-1.5">
                or click to browse files
              </p>
            </div>

            <p className="text-[11px] text-white/15 tracking-wide">
              MP4, MOV, WEBM
            </p>

            <input
              ref={fileRef}
              type="file"
              accept="video/*"
              onChange={handleFileChange}
              className="hidden"
            />
          </div>
        </div>
      </div>
    );
  }

  /* ── Step: Analyzing ──────────────────────────────────────────── */

  if (step === "analyzing") {
    return (
      <div className="flex items-center justify-center min-h-[75vh] px-6">
        <div className="w-full max-w-sm text-center">
          {/* Spinner */}
          <div className="mx-auto mb-8 relative w-12 h-12">
            <div className="absolute inset-0 rounded-full border-2 border-white/[0.06]" />
            <div
              className="absolute inset-0 rounded-full border-2 border-transparent border-t-[#D4FF00]/60 animate-spin"
              style={{ animationDuration: "1s" }}
            />
            <Sparkle
              size={18}
              weight="fill"
              className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-[#D4FF00]/50"
            />
          </div>

          {/* File name */}
          {fileName && (
            <p className="text-[11px] text-white/25 mb-3 truncate max-w-[280px] mx-auto">
              {fileName}
            </p>
          )}

          {/* Stage text */}
          <p className="text-[14px] text-white/70 mb-6 h-5">
            {ANALYSIS_STAGES[stageIdx]}
          </p>

          {/* Progress bar */}
          <div className="w-full h-[3px] rounded-full bg-white/[0.06] overflow-hidden">
            <div
              className="h-full rounded-full bg-[#D4FF00]/50 transition-all duration-300 ease-out"
              style={{ width: `${Math.min(progress, 100)}%` }}
            />
          </div>
        </div>
      </div>
    );
  }

  /* ── Step: Edit Library ───────────────────────────────────────── */

  if (step === "library") {
    return (
      <div className="flex flex-col min-h-[75vh]">
        {/* Header */}
        <div className="text-center pt-6 pb-4 px-6">
          <p className="text-[11px] uppercase tracking-[0.15em] text-[#D4FF00]/50 mb-1.5">
            {library.enabled_count} of {library.total_decisions} enabled
          </p>
          <h2 className="text-[18px] font-semibold text-white/90">
            Your edit plan
          </h2>
          <p className="text-[12px] text-white/35 mt-1">
            Toggle what you want. Expand cards to swap alternatives.
          </p>
        </div>

        {/* Panel — centered, comfortable width */}
        <div className="flex-1 w-full max-w-xl mx-auto px-4">
          <EditLibraryPanel
            library={library}
            onToggle={handleToggle}
            onSwap={handleSwap}
            onBulkToggle={handleBulkToggle}
            onApply={handleApply}
            applying={applying}
          />
        </div>
      </div>
    );
  }

  /* ── Step: Done ───────────────────────────────────────────────── */

  return (
    <div className="flex items-center justify-center min-h-[75vh] px-6">
      <div className="text-center max-w-sm">
        <div className="mx-auto mb-6 w-14 h-14 rounded-full bg-[#D4FF00]/10 flex items-center justify-center">
          <CheckCircle size={28} weight="fill" className="text-[#D4FF00]" />
        </div>

        <h2 className="text-[18px] font-semibold text-white/90 mb-2">
          Edits applied
        </h2>
        <p className="text-[13px] text-white/40 mb-8">
          {appliedCount} decisions applied to your footage.
        </p>

        <div className="flex items-center justify-center gap-3">
          <button
            onClick={reset}
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-[13px] font-medium
              border border-white/[0.08] text-white/60 hover:text-white/80 hover:border-white/15
              transition-all duration-220"
          >
            <ArrowLeft size={14} />
            New video
          </button>
          <button
            className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-[13px] font-semibold
              bg-[#D4FF00] text-[#020711] hover:bg-[#E8FF4D]
              transition-all duration-220"
          >
            <Play size={14} weight="fill" />
            Preview
          </button>
        </div>
      </div>
    </div>
  );
}
