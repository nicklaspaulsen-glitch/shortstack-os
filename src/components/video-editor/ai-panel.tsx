"use client";

/* ────────────────────────────────────────────────────────────────
 * AI-assist panel.
 *
 * Three capabilities, all wired to /api/video/auto-edit/*:
 *   1. Auto-cut silence — POST /api/video/auto-edit/silence
 *   2. Auto-caption active clip — POST /api/video/auto-edit/captions
 *   3. Natural-language edit intent — POST /api/video/auto-edit/intent
 *
 * When a route returns 404 (unimplemented) or the worker call fails,
 * we surface a toast "AI worker offline, returning uncut" and leave
 * the clips unchanged.
 * ────────────────────────────────────────────────────────────────*/

import { useState } from "react";
import {
  Sparkles,
  Scissors,
  Captions as CaptionsIcon,
  Bot,
  Loader2,
  Film,
  AlertTriangle,
  Info,
  Zap,
  Award,
} from "lucide-react";
import toast from "react-hot-toast";
import type { EditorState, EditorAction, Clip } from "@/lib/video-editor/types";

interface DirectorBrief {
  hook_assessment: string;
  pacing_notes: Array<{ at_seconds: number; note: string; severity: "info" | "warn" | "important" }>;
  suggested_cuts: Array<{ at_seconds: number; why: string }>;
  suggested_inserts: Array<{
    at_seconds: number;
    kind: "b_roll" | "text_overlay" | "transition" | "sfx";
    why: string;
  }>;
  overall_grade: "A" | "B" | "C" | "D" | "F";
  overall_summary: string;
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export interface AiPanelProps {
  state: EditorState;
  dispatch: (a: EditorAction) => void;
}

interface SilenceResponse {
  ok?: boolean;
  clips?: Array<{ id?: string; start?: number; duration?: number }>;
  error?: string;
}
interface CaptionResponse {
  ok?: boolean;
  captions?: Array<{ start: number; end: number; text: string }>;
  error?: string;
}
interface IntentResponse {
  ok?: boolean;
  clips?: Clip[];
  error?: string;
}

async function safePost<T>(url: string, body: unknown): Promise<T | { __offline: true }> {
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (res.status === 404) return { __offline: true };
    return (await res.json()) as T;
  } catch {
    return { __offline: true };
  }
}

export function AiPanel({ state, dispatch }: AiPanelProps) {
  const [intent, setIntent] = useState("");
  const [busy, setBusy] = useState<"silence" | "captions" | "intent" | "director" | null>(null);
  const [directorBrief, setDirectorBrief] = useState<DirectorBrief | null>(null);

  const onDirectorBrief = async () => {
    if (state.clips.length === 0) {
      toast.error("Add some clips first");
      return;
    }
    setBusy("director");
    setDirectorBrief(null);
    const id = toast.loading("AI Director reviewing the cut…");
    try {
      // Compute total duration as the max end-time across all clips
      const totalDuration = state.clips.reduce(
        (max, c) => Math.max(max, (c.start ?? 0) + (c.duration ?? 0)),
        0,
      );
      const payload = {
        clips: state.clips.map((c) => ({
          id: c.id,
          kind: state.tracks.find((t) => t.id === c.trackId)?.kind || "video",
          start: c.start ?? 0,
          duration: c.duration ?? 0,
          label: c.name || c.kind,
        })),
        total_duration: totalDuration,
        intent: "engage and retain viewers through the full runtime",
        target_platform: "youtube",
      };
      const res = await fetch("/api/video/auto-edit/director", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `Error ${res.status}`);
      }
      const brief = (await res.json()) as DirectorBrief;
      setDirectorBrief(brief);
      toast.success(`Director brief ready · grade ${brief.overall_grade}`, { id });
    } catch (err) {
      toast.error(`Director failed: ${(err as Error).message}`, { id });
    } finally {
      setBusy(null);
    }
  };

  const selectedClip = state.clips.find((c) => state.selection.includes(c.id)) || state.clips[0];

  const onSilence = async () => {
    setBusy("silence");
    const id = toast.loading("Scanning for silence…");
    const videoClip =
      state.clips.find((c) => state.tracks.find((t) => t.id === c.trackId)?.kind === "video") ||
      selectedClip;
    if (!videoClip?.src) {
      toast.error("Load a video clip first", { id });
      setBusy(null);
      return;
    }
    const payload = {
      video_url: videoClip.src,
      clip_id: videoClip.id,
    };
    const res = await safePost<SilenceResponse>("/api/video/auto-edit/silence", payload);
    setBusy(null);
    if ("__offline" in res) {
      toast("AI worker offline, returning uncut", { id, icon: "○" });
      return;
    }
    if (!res.ok || !res.clips || res.clips.length === 0) {
      toast.error(res.error || "No silence removed", { id });
      return;
    }
    toast.success(`Trimmed ${res.clips.length} silence segments`, { id });
    // Shape into editor clips (best-effort — use the returned start/duration)
    const next: Clip[] = res.clips.map((c, i) => ({
      ...videoClip,
      id: c.id || `${videoClip.id}-cut-${i}`,
      start: c.start ?? videoClip.start,
      duration: c.duration ?? videoClip.duration,
    }));
    dispatch({
      type: "REPLACE_CLIPS",
      clips: [...state.clips.filter((c) => c.id !== videoClip.id), ...next],
    });
  };

  const onCaptions = async () => {
    setBusy("captions");
    const id = toast.loading("Generating captions…");
    const videoClip =
      state.clips.find((c) => state.tracks.find((t) => t.id === c.trackId)?.kind === "video") ||
      selectedClip;
    if (!videoClip?.src) {
      toast.error("Select a video clip first", { id });
      setBusy(null);
      return;
    }
    const res = await safePost<CaptionResponse>("/api/video/auto-edit/captions", {
      video_url: videoClip.src,
      clip_id: videoClip.id,
    });
    setBusy(null);
    if ("__offline" in res) {
      toast("AI worker offline, returning uncut", { id, icon: "○" });
      return;
    }
    if (!res.ok || !res.captions || res.captions.length === 0) {
      toast.error(res.error || "No captions returned", { id });
      return;
    }
    toast.success(`Added ${res.captions.length} caption clips`, { id });
    const capTrack = state.tracks.find((t) => t.kind === "caption");
    if (!capTrack) {
      toast.error("No caption track", { id });
      return;
    }
    const newClips: Clip[] = res.captions.map((c, i) => ({
      id: `cap-auto-${Date.now()}-${i}`,
      trackId: capTrack.id,
      start: Math.round(c.start * 1000),
      duration: Math.max(300, Math.round((c.end - c.start) * 1000)),
      label: c.text.slice(0, 40),
      color: capTrack.accent,
      text: c.text,
    }));
    dispatch({
      type: "REPLACE_CLIPS",
      clips: [...state.clips.filter((c) => c.trackId !== capTrack.id), ...newClips],
    });
  };

  const onIntent = async () => {
    if (!intent.trim()) {
      toast.error("Describe what to do first");
      return;
    }
    setBusy("intent");
    const id = toast.loading("Thinking…");
    const res = await safePost<IntentResponse>("/api/video/auto-edit/intent", {
      instructions: intent,
      clips: state.clips,
    });
    setBusy(null);
    if ("__offline" in res) {
      toast("AI worker offline, returning uncut", { id, icon: "○" });
      return;
    }
    if (!res.ok || !res.clips) {
      toast.error(res.error || "No edits returned", { id });
      return;
    }
    toast.success(`Applied ${res.clips.length}-clip edit`, { id });
    dispatch({ type: "REPLACE_CLIPS", clips: res.clips });
  };

  const BtnIcon = ({ k }: { k: typeof busy }) => (busy === k ? <Loader2 size={12} className="animate-spin" /> : null);

  return (
    <aside className="w-72 shrink-0 bg-neutral-900 border-l border-neutral-800 overflow-y-auto">
      <header className="flex items-center gap-2 px-3 py-2 border-b border-neutral-800">
        <Sparkles size={14} className="text-amber-300" />
        <h3 className="text-neutral-200 font-medium text-sm">AI Assist</h3>
      </header>

      <div className="p-3 space-y-3 text-xs">
        <button
          type="button"
          disabled={busy !== null}
          onClick={onSilence}
          className="w-full flex items-center gap-2 rounded-md bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 px-3 py-2 text-neutral-200 disabled:opacity-50"
        >
          <Scissors size={12} />
          <span className="flex-1 text-left">Auto-cut silence</span>
          <BtnIcon k="silence" />
        </button>

        <button
          type="button"
          disabled={busy !== null}
          onClick={onCaptions}
          className="w-full flex items-center gap-2 rounded-md bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 px-3 py-2 text-neutral-200 disabled:opacity-50"
        >
          <CaptionsIcon size={12} />
          <span className="flex-1 text-left">Auto-caption active clip</span>
          <BtnIcon k="captions" />
        </button>

        <button
          type="button"
          disabled={busy !== null}
          onClick={onDirectorBrief}
          className="w-full flex items-center gap-2 rounded-md border px-3 py-2 disabled:opacity-50"
          style={{
            background:
              "linear-gradient(135deg, rgba(168,85,247,0.10), rgba(168,85,247,0.04))",
            borderColor: "rgba(168,85,247,0.30)",
            color: "#e9d5ff",
          }}
        >
          <Film size={12} />
          <span className="flex-1 text-left">AI Director review</span>
          <BtnIcon k="director" />
        </button>

        {directorBrief && (
          <DirectorBriefDisplay
            brief={directorBrief}
            onClose={() => setDirectorBrief(null)}
          />
        )}

        <div className="space-y-2 pt-2 border-t border-neutral-800">
          <label className="text-[11px] text-neutral-400 flex items-center gap-1">
            <Bot size={11} /> Describe what you want
          </label>
          <textarea
            value={intent}
            onChange={(e) => setIntent(e.target.value)}
            placeholder={"e.g. Remove filler words, tighten pacing, add b-roll every 3 sec"}
            rows={4}
            className="w-full bg-neutral-950 border border-neutral-700 rounded-md px-2 py-1.5 text-[11px] text-neutral-200 placeholder:text-neutral-600 resize-none"
          />
          <button
            type="button"
            disabled={busy !== null}
            onClick={onIntent}
            className="w-full flex items-center justify-center gap-2 rounded-md bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/40 text-amber-200 px-3 py-2 disabled:opacity-50"
          >
            <Sparkles size={12} /> Apply
            <BtnIcon k="intent" />
          </button>
        </div>

        <p className="text-[10px] text-neutral-500 pt-2 border-t border-neutral-800">
          AI calls route through the RunPod video-use worker. When offline,
          the timeline is returned unchanged.
        </p>
      </div>
    </aside>
  );
}

function DirectorBriefDisplay({
  brief,
  onClose,
}: {
  brief: DirectorBrief;
  onClose: () => void;
}) {
  const gradeColor =
    brief.overall_grade === "A"
      ? "#10b981"
      : brief.overall_grade === "B"
      ? "#22c55e"
      : brief.overall_grade === "C"
      ? "#c8a855"
      : "#ef4444";
  return (
    <div
      className="rounded-md p-3 space-y-3"
      style={{
        background: "rgba(168,85,247,0.04)",
        border: "1px solid rgba(168,85,247,0.20)",
      }}
    >
      <div className="flex items-start gap-3">
        <div
          className="w-10 h-10 rounded-md flex items-center justify-center shrink-0"
          style={{
            background: `${gradeColor}18`,
            border: `1px solid ${gradeColor}40`,
          }}
        >
          <Award size={16} style={{ color: gradeColor }} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <span className="text-[11px] font-bold text-purple-200">
              Director Brief
            </span>
            <span
              className="text-[9.5px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded"
              style={{ background: `${gradeColor}24`, color: gradeColor }}
            >
              Grade {brief.overall_grade}
            </span>
            <button
              type="button"
              onClick={onClose}
              className="ml-auto text-[10px] text-neutral-500 hover:text-neutral-200"
            >
              Close
            </button>
          </div>
          <p className="text-[11px] text-neutral-300 leading-relaxed">
            {brief.overall_summary}
          </p>
        </div>
      </div>

      <div className="rounded-md p-2.5" style={{ background: "rgba(0,0,0,0.25)" }}>
        <p className="text-[9.5px] uppercase tracking-wider text-neutral-500 mb-1">
          Hook
        </p>
        <p className="text-[11px] text-neutral-200">{brief.hook_assessment}</p>
      </div>

      {brief.pacing_notes.length > 0 && (
        <div>
          <p className="text-[9.5px] uppercase tracking-wider text-neutral-500 mb-1.5">
            Pacing
          </p>
          <div className="space-y-1">
            {brief.pacing_notes.map((p, i) => {
              const Icon =
                p.severity === "important"
                  ? AlertTriangle
                  : p.severity === "warn"
                  ? Zap
                  : Info;
              const color =
                p.severity === "important"
                  ? "#fca5a5"
                  : p.severity === "warn"
                  ? "#fcd34d"
                  : "#94a3b8";
              return (
                <div
                  key={i}
                  className="flex items-start gap-2 text-[10.5px] text-neutral-300 leading-relaxed"
                >
                  <Icon size={10} style={{ color }} className="mt-0.5 shrink-0" />
                  <span className="font-mono text-[9.5px] text-neutral-500 shrink-0 mt-0.5">
                    {formatTime(p.at_seconds)}
                  </span>
                  <span className="flex-1">{p.note}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {brief.suggested_cuts.length > 0 && (
        <div>
          <p className="text-[9.5px] uppercase tracking-wider text-neutral-500 mb-1.5">
            Cuts to make
          </p>
          <div className="space-y-1">
            {brief.suggested_cuts.map((c, i) => (
              <div
                key={i}
                className="flex items-start gap-2 text-[10.5px] text-neutral-300 leading-relaxed"
              >
                <Scissors size={10} className="text-rose-300 mt-0.5 shrink-0" />
                <span className="font-mono text-[9.5px] text-neutral-500 shrink-0 mt-0.5">
                  {formatTime(c.at_seconds)}
                </span>
                <span className="flex-1">{c.why}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {brief.suggested_inserts.length > 0 && (
        <div>
          <p className="text-[9.5px] uppercase tracking-wider text-neutral-500 mb-1.5">
            Add
          </p>
          <div className="space-y-1">
            {brief.suggested_inserts.map((s, i) => (
              <div
                key={i}
                className="flex items-start gap-2 text-[10.5px] text-neutral-300 leading-relaxed"
              >
                <Sparkles size={10} className="text-amber-300 mt-0.5 shrink-0" />
                <span className="font-mono text-[9.5px] text-neutral-500 shrink-0 mt-0.5">
                  {formatTime(s.at_seconds)}
                </span>
                <span className="flex-1">
                  <span className="text-amber-300 font-semibold">{s.kind.replace("_", " ")}</span>
                  {" — "}
                  {s.why}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
