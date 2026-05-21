"use client";

/**
 * PageTrainingPanel — a collapsible inline drawer for configuring
 * per-page AI training on any feature page.
 *
 * Usage:
 *   <PageTrainingPanel pageKey="social" />
 *
 * The panel saves to /api/settings/page-training and the setting is
 * automatically read by the corresponding API routes on the next generation.
 */

import { useState, useEffect, useCallback } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Brain, ChevronDown, Save, Loader2, Check, X, Plus } from "lucide-react";
import { CREATOR_STYLES } from "@/lib/ai/creator-styles";
import type { PageContext } from "@/lib/ai/creator-styles";

interface TrainingConfig {
  creator_style_id: string | null;
  custom_instructions: string | null;
  tone: string | null;
  example_outputs: string[];
  focus_topics: string[];
}

const TONE_OPTIONS = [
  "professional",
  "conversational",
  "bold & direct",
  "warm & friendly",
  "educational",
  "witty & playful",
  "urgent",
  "inspirational",
];

interface PageTrainingPanelProps {
  /** Maps to the PageContext type in creator-styles.ts */
  pageKey: PageContext;
  /** Short label shown in the panel header, e.g. "Social Posts" */
  pageLabel?: string;
  /** Extra class names for the outer wrapper */
  className?: string;
}

export default function PageTrainingPanel({
  pageKey,
  pageLabel,
  className = "",
}: PageTrainingPanelProps) {
  const [open, setOpen] = useState(false);
  const [config, setConfig] = useState<TrainingConfig>({
    creator_style_id: null,
    custom_instructions: null,
    tone: null,
    example_outputs: [],
    focus_topics: [],
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [newTopic, setNewTopic] = useState("");
  const [newExample, setNewExample] = useState("");

  // Load saved config on open
  useEffect(() => {
    if (!open) return;
    fetch(`/api/settings/page-training?page=${pageKey}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.config) {
          setConfig({
            creator_style_id: d.config.creator_style_id ?? null,
            custom_instructions: d.config.custom_instructions ?? null,
            tone: d.config.tone ?? null,
            example_outputs: d.config.example_outputs ?? [],
            focus_topics: d.config.focus_topics ?? [],
          });
        }
      })
      .catch(() => null);
  }, [open, pageKey]);

  const save = useCallback(async () => {
    setSaving(true);
    try {
      await fetch("/api/settings/page-training", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ page: pageKey, ...config }),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch {
      // Soft-fail
    } finally {
      setSaving(false);
    }
  }, [pageKey, config]);

  const addTopic = () => {
    const t = newTopic.trim();
    if (!t || config.focus_topics.includes(t)) return;
    setConfig((c) => ({ ...c, focus_topics: [...c.focus_topics, t] }));
    setNewTopic("");
  };

  const removeTopic = (t: string) =>
    setConfig((c) => ({
      ...c,
      focus_topics: c.focus_topics.filter((x) => x !== t),
    }));

  const addExample = () => {
    const e = newExample.trim();
    if (!e || config.example_outputs.length >= 5) return;
    setConfig((c) => ({ ...c, example_outputs: [...c.example_outputs, e] }));
    setNewExample("");
  };

  const removeExample = (i: number) =>
    setConfig((c) => ({
      ...c,
      example_outputs: c.example_outputs.filter((_, idx) => idx !== i),
    }));

  const selectedStyle = config.creator_style_id
    ? CREATOR_STYLES.find((s) => s.id === config.creator_style_id)
    : null;

  const label = pageLabel ?? pageKey;

  return (
    <div className={`rounded-2xl border overflow-hidden ${className}`} style={{ borderColor: "rgba(99,146,255,0.14)" }}>
      {/* Header — always visible */}
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-4 py-3 transition-colors cursor-pointer"
        style={{ background: open ? "rgba(13,17,32,0.95)" : "rgba(13,17,32,0.70)" }}
      >
        <div className="flex items-center gap-2.5">
          <Brain size={14} style={{ color: config.creator_style_id ? "#3B82F6" : "#4A4A5A" }} />
          <span className="text-[12px] font-semibold text-text-primary">
            AI Training
          </span>
          {selectedStyle ? (
            <span
              className="text-[9px] font-semibold px-2 py-0.5 rounded-full"
              style={{
                background: selectedStyle.primaryColor + "22",
                color: selectedStyle.primaryColor,
              }}
            >
              {selectedStyle.emoji} {selectedStyle.name}
            </span>
          ) : (
            <span className="text-[9px] text-text-muted">Configure how AI writes for {label}</span>
          )}
        </div>
        <ChevronDown
          size={13}
          className="text-text-muted transition-transform duration-200"
          style={{ transform: open ? "rotate(180deg)" : "rotate(0deg)" }}
        />
      </button>

      {/* Expandable body */}
      <AnimatePresence>
        {open && (
          <motion.div
            key="training-body"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22, ease: [0.32, 0.72, 0, 1] }}
            style={{ overflow: "hidden" }}
          >
            <div
              className="px-4 pb-4 pt-1 space-y-4 border-t"
              style={{
                background: "rgba(13,17,32,0.95)",
                borderColor: "rgba(99,146,255,0.10)",
              }}
            >
              {/* Creator style picker */}
              <div>
                <p className="text-[10px] font-semibold text-text-muted uppercase tracking-wider mb-2">
                  Creator style
                </p>
                <div className="grid grid-cols-3 gap-1.5">
                  {CREATOR_STYLES.map((s) => (
                    <button
                      key={s.id}
                      onClick={() =>
                        setConfig((c) => ({
                          ...c,
                          creator_style_id: c.creator_style_id === s.id ? null : s.id,
                        }))
                      }
                      className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg border text-left text-[10px] transition-all duration-150 cursor-pointer"
                      style={{
                        background:
                          config.creator_style_id === s.id
                            ? s.primaryColor + "18"
                            : "rgba(13,17,32,0.55)",
                        borderColor:
                          config.creator_style_id === s.id
                            ? s.primaryColor + "60"
                            : "rgba(99,146,255,0.10)",
                        color:
                          config.creator_style_id === s.id
                            ? s.primaryColor
                            : "#A8A8B2",
                      }}
                    >
                      <span style={{ fontSize: 11 }}>{s.emoji}</span>
                      <span className="truncate font-medium">{s.name}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Tone picker */}
              <div>
                <p className="text-[10px] font-semibold text-text-muted uppercase tracking-wider mb-2">
                  Tone
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {TONE_OPTIONS.map((t) => (
                    <button
                      key={t}
                      onClick={() =>
                        setConfig((c) => ({
                          ...c,
                          tone: c.tone === t ? null : t,
                        }))
                      }
                      className="px-2.5 py-1 rounded-full border text-[10px] font-medium transition-all duration-150 cursor-pointer"
                      style={{
                        background:
                          config.tone === t
                            ? "rgba(59,130,246,0.18)"
                            : "rgba(13,17,32,0.55)",
                        borderColor:
                          config.tone === t
                            ? "#3B82F6"
                            : "rgba(99,146,255,0.12)",
                        color: config.tone === t ? "#60A5FA" : "#A8A8B2",
                      }}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>

              {/* Focus topics */}
              <div>
                <p className="text-[10px] font-semibold text-text-muted uppercase tracking-wider mb-2">
                  Focus topics
                </p>
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {config.focus_topics.map((t) => (
                    <span
                      key={t}
                      className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px]"
                      style={{
                        background: "rgba(59,130,246,0.12)",
                        color: "#60A5FA",
                        border: "1px solid rgba(59,130,246,0.22)",
                      }}
                    >
                      {t}
                      <button onClick={() => removeTopic(t)} className="cursor-pointer opacity-60 hover:opacity-100">
                        <X size={9} />
                      </button>
                    </span>
                  ))}
                </div>
                <div className="flex gap-1.5">
                  <input
                    type="text"
                    value={newTopic}
                    onChange={(e) => setNewTopic(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && addTopic()}
                    placeholder="Add a topic (e.g. email marketing)"
                    className="flex-1 px-2.5 py-1.5 text-[10px] rounded-lg border bg-transparent text-text-primary placeholder:text-text-muted focus:outline-none"
                    style={{ borderColor: "rgba(99,146,255,0.18)" }}
                  />
                  <button
                    onClick={addTopic}
                    className="px-2 py-1.5 rounded-lg border text-[10px] cursor-pointer transition-colors"
                    style={{
                      background: "rgba(59,130,246,0.12)",
                      borderColor: "rgba(59,130,246,0.22)",
                      color: "#60A5FA",
                    }}
                  >
                    <Plus size={11} />
                  </button>
                </div>
              </div>

              {/* Custom instructions */}
              <div>
                <p className="text-[10px] font-semibold text-text-muted uppercase tracking-wider mb-2">
                  Custom instructions
                </p>
                <textarea
                  value={config.custom_instructions ?? ""}
                  onChange={(e) =>
                    setConfig((c) => ({
                      ...c,
                      custom_instructions: e.target.value || null,
                    }))
                  }
                  rows={3}
                  placeholder={`Any specific style notes for AI-generated ${label} content. E.g. "Always end posts with a question. Never use the word 'unlock'. Keep sentences under 15 words."`}
                  className="w-full px-3 py-2 text-[10px] rounded-lg border bg-transparent text-text-primary placeholder:text-text-muted focus:outline-none resize-none"
                  style={{ borderColor: "rgba(99,146,255,0.18)", lineHeight: 1.6 }}
                />
              </div>

              {/* Example outputs */}
              <div>
                <p className="text-[10px] font-semibold text-text-muted uppercase tracking-wider mb-2">
                  Reference examples{" "}
                  <span className="normal-case text-text-muted font-normal">
                    (up to 5 — AI emulates these)
                  </span>
                </p>
                {config.example_outputs.map((ex, i) => (
                  <div key={i} className="flex gap-1.5 mb-1.5">
                    <div
                      className="flex-1 px-3 py-2 text-[10px] rounded-lg border"
                      style={{
                        background: "rgba(13,17,32,0.55)",
                        borderColor: "rgba(99,146,255,0.12)",
                        color: "#A8A8B2",
                        whiteSpace: "pre-wrap",
                        wordBreak: "break-word",
                      }}
                    >
                      {ex.length > 120 ? ex.slice(0, 120) + "…" : ex}
                    </div>
                    <button
                      onClick={() => removeExample(i)}
                      className="self-start mt-1 p-1 rounded cursor-pointer text-text-muted hover:text-text-primary transition-colors"
                    >
                      <X size={11} />
                    </button>
                  </div>
                ))}
                {config.example_outputs.length < 5 && (
                  <div className="flex gap-1.5 mt-2">
                    <textarea
                      value={newExample}
                      onChange={(e) => setNewExample(e.target.value)}
                      rows={2}
                      placeholder="Paste an example of great output you want AI to emulate…"
                      className="flex-1 px-2.5 py-1.5 text-[10px] rounded-lg border bg-transparent text-text-primary placeholder:text-text-muted focus:outline-none resize-none"
                      style={{ borderColor: "rgba(99,146,255,0.18)" }}
                    />
                    <button
                      onClick={addExample}
                      className="self-start mt-0.5 px-2 py-1.5 rounded-lg border text-[10px] cursor-pointer transition-colors"
                      style={{
                        background: "rgba(59,130,246,0.12)",
                        borderColor: "rgba(59,130,246,0.22)",
                        color: "#60A5FA",
                      }}
                    >
                      <Plus size={11} />
                    </button>
                  </div>
                )}
              </div>

              {/* Save */}
              <div className="flex justify-end pt-1">
                <button
                  onClick={save}
                  disabled={saving}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-[11px] font-semibold transition-all duration-150 cursor-pointer"
                  style={{
                    background: saved
                      ? "rgba(74,222,128,0.15)"
                      : "rgba(59,130,246,0.18)",
                    color: saved ? "#4ADE80" : "#60A5FA",
                    border: `1px solid ${saved ? "rgba(74,222,128,0.30)" : "rgba(59,130,246,0.28)"}`,
                    opacity: saving ? 0.7 : 1,
                  }}
                >
                  {saving ? (
                    <Loader2 size={11} className="animate-spin" />
                  ) : saved ? (
                    <Check size={11} />
                  ) : (
                    <Save size={11} />
                  )}
                  {saved ? "Saved" : saving ? "Saving…" : "Save training"}
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
