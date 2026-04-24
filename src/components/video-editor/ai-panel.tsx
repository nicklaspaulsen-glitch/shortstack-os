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
import { Sparkles, Scissors, Captions as CaptionsIcon, Bot, Loader2 } from "lucide-react";
import toast from "react-hot-toast";
import type { EditorState, EditorAction, Clip } from "@/lib/video-editor/types";

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
  const [busy, setBusy] = useState<"silence" | "captions" | "intent" | null>(null);

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
