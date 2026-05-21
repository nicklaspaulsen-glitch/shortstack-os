"use client";

import { useState, useCallback } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Sparkles, ChevronLeft, X, Loader2, Lightbulb, TrendingUp, Copy, Check } from "lucide-react";
import { CREATOR_STYLES } from "@/lib/ai/creator-styles";
import type { CreatorStyle, PageContext, Platform } from "@/lib/ai/creator-styles";

/**
 * A single AI-generated content idea from the Creator Intelligence panel.
 */
export interface CreatorIdea {
  title: string;
  hook: string;
  angle: string;
  thumbnail_concept: string;
  caption: string;
  hashtags: string[];
}

interface CreatorIntelligenceProps {
  /** Called when the user clicks "Use this idea" on any generated idea. */
  onApply: (idea: CreatorIdea, creator: CreatorStyle) => void;
  /** Which page/tool this panel is embedded in — affects LLM prompt hints. */
  context: PageContext;
  /** Pre-fills the topic field from the parent page's current topic state. */
  currentTopic?: string;
  /** Passed to the API for platform-specific idea generation. */
  platform?: Platform;
  /**
   * "floating" — renders as a pill-button toggle with a slide-up panel,
   *   positioned absolutely.  Parent must be position:relative.
   * "inline" — renders as a full contained block (for Social Studio tab).
   */
  variant?: "floating" | "inline";
  /** Extra class names for the floating variant's wrapper div. */
  className?: string;
}

type Panel = "creator-pick" | "loading" | "ideas";

export default function CreatorIntelligence({
  onApply,
  context,
  currentTopic = "",
  platform,
  variant = "floating",
  className = "",
}: CreatorIntelligenceProps) {
  const [open, setOpen] = useState(false);
  const [panel, setPanel] = useState<Panel>("creator-pick");
  const [selectedCreator, setSelectedCreator] = useState<CreatorStyle | null>(null);
  const [ideas, setIdeas] = useState<CreatorIdea[]>([]);
  const [localTopic, setLocalTopic] = useState(currentTopic);
  const [error, setError] = useState<string | null>(null);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  const fetchIdeas = useCallback(
    async (creator: CreatorStyle) => {
      setSelectedCreator(creator);
      setPanel("loading");
      setError(null);
      try {
        const res = await fetch("/api/ai/creator-ideas", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            topic: localTopic.trim() || "content creation",
            creator_id: creator.id,
            platform: platform ?? "youtube",
            page_context: context,
            count: 5,
          }),
        });
        const json = (await res.json()) as { ideas?: CreatorIdea[]; error?: string };
        if (!res.ok || json.error) throw new Error(json.error ?? "Failed");
        setIdeas(json.ideas ?? []);
        setPanel("ideas");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to generate ideas");
        setPanel("creator-pick");
      }
    },
    [localTopic, platform, context],
  );

  const copyIdea = (idea: CreatorIdea, idx: number) => {
    const text = `${idea.title}\n\n${idea.hook}\n\n${idea.caption}\n${idea.hashtags.map((t) => `#${t}`).join(" ")}`;
    navigator.clipboard.writeText(text).catch(() => null);
    setCopiedIndex(idx);
    setTimeout(() => setCopiedIndex(null), 1800);
  };

  const reset = () => {
    setPanel("creator-pick");
    setSelectedCreator(null);
    setIdeas([]);
    setError(null);
  };

  /* ── Shared panel content ─────────────────────────────────────── */
  const panelContent = (
    <div className="flex flex-col" style={{ minHeight: 320 }}>
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 py-2.5 border-b shrink-0"
        style={{ borderColor: "rgba(99,146,255,0.14)" }}
      >
        <div className="flex items-center gap-2">
          {panel !== "creator-pick" && (
            <button
              onClick={reset}
              className="p-0.5 rounded text-text-muted hover:text-text-primary transition-colors"
              title="Back to creator picker"
            >
              <ChevronLeft size={13} />
            </button>
          )}
          <TrendingUp size={12} style={{ color: "#3B82F6" }} />
          <span className="text-[11px] font-semibold text-text-primary">Creator Intelligence</span>
          {selectedCreator && panel === "ideas" && (
            <span
              className="text-[9px] px-2 py-0.5 rounded-full font-semibold"
              style={{
                background: selectedCreator.primaryColor + "22",
                color: selectedCreator.primaryColor,
              }}
            >
              {selectedCreator.emoji} {selectedCreator.name}
            </span>
          )}
        </div>
        {variant === "floating" && (
          <button
            onClick={() => setOpen(false)}
            className="text-text-muted hover:text-text-primary transition-colors"
          >
            <X size={12} />
          </button>
        )}
      </div>

      {/* Topic input — shown on creator-pick panel */}
      {panel === "creator-pick" && (
        <div className="px-4 pt-3 pb-2 shrink-0">
          <input
            type="text"
            value={localTopic}
            onChange={(e) => setLocalTopic(e.target.value)}
            placeholder="Your topic or niche (e.g. email marketing tips)"
            className="w-full px-3 py-2 text-xs rounded-lg border bg-transparent text-text-primary placeholder:text-text-muted focus:outline-none transition-all"
            style={{ borderColor: "rgba(99,146,255,0.20)", background: "rgba(13,17,32,0.55)" }}
            onFocus={(e) => (e.currentTarget.style.borderColor = "#3B82F6")}
            onBlur={(e) => (e.currentTarget.style.borderColor = "rgba(99,146,255,0.20)")}
          />
          {error && (
            <p className="mt-1.5 text-[10px]" style={{ color: "#EF4444" }}>
              ⚠ {error}
            </p>
          )}
        </div>
      )}

      {/* Body */}
      <div className="flex-1 overflow-y-auto" style={{ maxHeight: variant === "floating" ? 380 : 540 }}>
        {/* ── Creator picker grid ── */}
        {panel === "creator-pick" && (
          <div className="p-3">
            <p className="text-[10px] text-text-muted mb-3 px-0.5">
              Pick an archetype — AI writes 5 viral ideas in that style
            </p>
            <div className="grid grid-cols-2 gap-2">
              {CREATOR_STYLES.map((c) => (
                <button
                  key={c.id}
                  onClick={() => fetchIdeas(c)}
                  className="flex flex-col gap-1.5 p-2.5 rounded-xl border text-left transition-all duration-150 cursor-pointer"
                  style={{
                    background: "rgba(13,17,32,0.65)",
                    borderColor: "rgba(99,146,255,0.13)",
                  }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLButtonElement).style.borderColor = c.primaryColor + "70";
                    (e.currentTarget as HTMLButtonElement).style.background = c.primaryColor + "0F";
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(99,146,255,0.13)";
                    (e.currentTarget as HTMLButtonElement).style.background = "rgba(13,17,32,0.65)";
                  }}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm leading-none">{c.emoji}</span>
                    <span
                      className="text-[8px] font-mono font-bold px-1.5 py-0.5 rounded"
                      style={{ background: c.primaryColor + "22", color: c.primaryColor }}
                    >
                      {c.ctrRange}
                    </span>
                  </div>
                  <span className="text-[10px] font-semibold text-text-primary leading-tight">
                    {c.name}
                  </span>
                  <span className="text-[9px] text-text-muted leading-tight line-clamp-2">
                    {c.tagline}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ── Loading state ── */}
        {panel === "loading" && (
          <div className="flex flex-col items-center justify-center py-14 gap-3">
            <Loader2 size={20} className="animate-spin" style={{ color: "#3B82F6" }} />
            <p className="text-[11px] text-text-muted text-center px-4">
              Generating 5 ideas in
              <br />
              <span className="font-semibold text-text-secondary">{selectedCreator?.name}</span>{" "}
              style…
            </p>
          </div>
        )}

        {/* ── Ideas list ── */}
        {panel === "ideas" && (
          <div className="p-3 space-y-2">
            <div className="flex items-center justify-between px-0.5 mb-2">
              <span className="text-[10px] text-text-muted">5 ideas · tap to use</span>
              <button
                onClick={reset}
                className="text-[10px] flex items-center gap-1 transition-colors"
                style={{ color: "#3B82F6" }}
              >
                <Sparkles size={9} />
                Change style
              </button>
            </div>

            {ideas.map((idea, i) => (
              <div
                key={i}
                className="rounded-xl border p-3 space-y-1.5"
                style={{
                  background: "rgba(13,17,32,0.65)",
                  borderColor: "rgba(99,146,255,0.11)",
                }}
              >
                {/* Title + idea number */}
                <div className="flex items-start gap-2">
                  <span
                    className="shrink-0 text-[8px] font-mono font-bold mt-0.5 w-4 h-4 rounded flex items-center justify-center"
                    style={{ background: "rgba(212,255,0,0.18)", color: "#60A5FA" }}
                  >
                    {i + 1}
                  </span>
                  <p className="text-[11px] font-semibold text-text-primary leading-snug">{idea.title}</p>
                </div>

                {/* Hook */}
                <p className="text-[10px] italic text-text-secondary leading-snug pl-6">
                  &ldquo;{idea.hook}&rdquo;
                </p>

                {/* Angle */}
                <p className="text-[9px] text-text-muted leading-tight pl-6">{idea.angle}</p>

                {/* Hashtags */}
                <div className="flex flex-wrap gap-1 pl-6 pt-0.5">
                  {idea.hashtags.slice(0, 4).map((tag) => (
                    <span
                      key={tag}
                      className="text-[8px] px-1.5 py-0.5 rounded"
                      style={{ background: "rgba(99,146,255,0.10)", color: "#A8A8B2" }}
                    >
                      #{tag}
                    </span>
                  ))}
                </div>

                {/* Actions */}
                <div className="flex gap-1.5 pt-1">
                  <button
                    onClick={() => {
                      onApply(idea, selectedCreator!);
                      if (variant === "floating") setOpen(false);
                    }}
                    className="flex-1 py-1.5 rounded-lg text-[10px] font-semibold transition-all duration-150 flex items-center justify-center gap-1.5"
                    style={{
                      background: "rgba(212,255,0,0.18)",
                      color: "#60A5FA",
                      border: "1px solid rgba(212,255,0,0.22)",
                    }}
                    onMouseEnter={(e) => {
                      (e.currentTarget as HTMLButtonElement).style.background = "rgba(212,255,0,0.30)";
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLButtonElement).style.background = "rgba(212,255,0,0.18)";
                    }}
                  >
                    <Lightbulb size={10} />
                    Use this idea
                  </button>
                  <button
                    onClick={() => copyIdea(idea, i)}
                    className="px-2.5 py-1.5 rounded-lg text-[10px] transition-all duration-150 flex items-center justify-center"
                    style={{
                      background: "rgba(13,17,32,0.8)",
                      color: copiedIndex === i ? "#4ADE80" : "#6B7280",
                      border: "1px solid rgba(99,146,255,0.15)",
                    }}
                    title="Copy all fields to clipboard"
                  >
                    {copiedIndex === i ? <Check size={10} /> : <Copy size={10} />}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      <div
        className="px-4 py-1.5 border-t shrink-0 flex items-center gap-1.5"
        style={{ borderColor: "rgba(99,146,255,0.09)" }}
      >
        <div
          className="w-1.5 h-1.5 rounded-full animate-pulse"
          style={{ background: "#3B82F6" }}
        />
        <span className="text-[8.5px] text-text-muted">
          12 creator archetypes · trained on viral patterns
        </span>
      </div>
    </div>
  );

  /* ── Inline variant ────────────────────────────────────────────── */
  if (variant === "inline") {
    return (
      <div
        className={`rounded-2xl border overflow-hidden ${className}`}
        style={{
          background: "rgba(13,17,32,0.92)",
          borderColor: "rgba(99,146,255,0.14)",
        }}
      >
        {panelContent}
      </div>
    );
  }

  /* ── Floating variant ──────────────────────────────────────────── */
  return (
    <div className={`absolute z-40 ${className}`} style={{ pointerEvents: "auto" }}>
      {/* Toggle pill */}
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold shadow-lg border transition-all duration-150"
        style={{
          background: open ? "rgba(212,255,0,0.22)" : "rgba(13,17,32,0.90)",
          borderColor: open ? "#3B82F6" : "rgba(99,146,255,0.22)",
          color: open ? "#60A5FA" : "#A8A8B2",
          backdropFilter: "blur(12px)",
        }}
      >
        <TrendingUp size={11} />
        Creator AI
        <span style={{ fontSize: 9, opacity: 0.6 }}>{open ? "▼" : "▲"}</span>
      </button>

      {/* Slide-up panel */}
      <AnimatePresence>
        {open && (
          <motion.div
            key="creator-panel"
            initial={{ opacity: 0, y: 10, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.97 }}
            transition={{ duration: 0.16, ease: [0.32, 0.72, 0, 1] }}
            className="absolute bottom-10 left-0 rounded-2xl border shadow-2xl overflow-hidden"
            style={{
              width: 340,
              background: "rgba(13,17,32,0.97)",
              borderColor: "rgba(99,146,255,0.17)",
              backdropFilter: "blur(20px)",
            }}
          >
            {panelContent}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
