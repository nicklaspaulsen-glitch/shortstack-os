"use client";
import { Brain, CaretDown, Check, CircleNotch, FloppyDisk, Lightbulb, Plus, X } from "@phosphor-icons/react";

/**
 * PageTrainingPanel — collapsible inline drawer for per-page AI training.
 *
 * Now ships with page-specific smart defaults:
 *   - Context-aware instruction placeholder
 *   - Suggested focus-topic chips per page type
 *   - Page-tailored example hint
 *   - Description of what training does on this specific surface
 *
 * Usage:
 *   <PageTrainingPanel pageKey="social" />
 */

import { useState, useEffect, useCallback } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { CREATOR_STYLES } from "@/lib/ai/creator-styles";
import type { PageContext } from "@/lib/ai/creator-styles";

// ─── Per-page smart defaults ───────────────────────────────────────────────

interface PageHints {
  /** What training does on this specific surface (shown collapsed) */
  description: string;
  /** Placeholder for the custom instructions textarea */
  instructionPlaceholder: string;
  /** Pre-defined topic chips the user can click to add */
  suggestedTopics: string[];
  /** Placeholder for the example outputs textarea */
  examplePlaceholder: string;
}

const PAGE_HINTS: Record<PageContext, PageHints> = {
  social: {
    description: "Teach AI your posting voice, niche, and hook style",
    instructionPlaceholder:
      'E.g. "Always open with a provocative question. Never use the word \'amazing\'. Keep captions under 150 chars for LinkedIn. Include 3 hashtags max. Sign off with my brand tagline \'Design moves businesses\'."',
    suggestedTopics: [
      "agency growth",
      "client results",
      "marketing tips",
      "behind the scenes",
      "social proof",
      "lead gen",
    ],
    examplePlaceholder:
      "Paste a high-performing caption or post you want AI to emulate in style and structure…",
  },
  thumbnail: {
    description: "Set your thumbnail style — color palette, text style, and CTR formula",
    instructionPlaceholder:
      'E.g. "Always use bold Impact-style text with black stroke. Keep backgrounds simple (1-2 colors). Include a shocked/excited face in every thumbnail. Stick to our brand colors: deep blue + neon yellow. Avoid red unless urgency is the hook."',
    suggestedTopics: [
      "YouTube",
      "tutorials",
      "reviews",
      "reaction",
      "documentary",
      "vlog",
      "education",
    ],
    examplePlaceholder:
      "Describe an example thumbnail concept that performed well for you — composition, colors, text overlay, emotion…",
  },
  script: {
    description: "Define your on-camera voice, pacing, and storytelling structure",
    instructionPlaceholder:
      'E.g. "Start every video with a 10-second hook — present a problem the viewer feels. Use short punchy sentences. No jargon. End each section with a teaser to the next. Sign off: \'If this helped, subscribe — new video every Tuesday.\'"',
    suggestedTopics: [
      "hooks",
      "storytelling",
      "tutorials",
      "case studies",
      "motivation",
      "product demos",
    ],
    examplePlaceholder:
      "Paste an excerpt from a script that felt natural and on-brand for you…",
  },
  "ai-video": {
    description: "Guide AI video scenes — style, pacing, visual language",
    instructionPlaceholder:
      'E.g. "Cinematic wide shots with slow dolly-in. Moody color grade (teal + orange). B-roll should feel editorial, not stock. Transitions: cut only — no dissolves. Background music: lo-fi, instrumental."',
    suggestedTopics: [
      "brand films",
      "product showcases",
      "client stories",
      "agency reel",
      "testimonials",
    ],
    examplePlaceholder:
      "Describe a video style or reference a specific video that matches the aesthetic you want…",
  },
  copy: {
    description: "Set your copywriting voice, banned words, and structural rules",
    instructionPlaceholder:
      'E.g. "Write in second person (\'you\'). Lead with the benefit, not the feature. No passive voice. Banned words: innovative, leverage, synergy, unlock, game-changer. End every blog with a CTA to book a strategy call."',
    suggestedTopics: [
      "agency services",
      "SEO",
      "lead gen",
      "social media",
      "paid ads",
      "email marketing",
      "branding",
    ],
    examplePlaceholder:
      "Paste an example of copy you wrote (blog intro, landing page headline, email) that you want AI to match in style…",
  },
  websites: {
    description: "Shape AI-generated sites — brand voice, sections, and CTA style",
    instructionPlaceholder:
      'E.g. "Every hero section must have a clear ROI-focused headline. Use social proof (logos / testimonials) in the first fold. CTA text must be specific — never just \'Learn More\'. Match our brand tone: confident, direct, no fluff."',
    suggestedTopics: [
      "agency websites",
      "landing pages",
      "portfolios",
      "service pages",
      "client results",
    ],
    examplePlaceholder:
      "Paste example hero copy or a section structure you want AI to replicate…",
  },
  ads: {
    description: "Define your paid ad voice — hooks, angles, and offer framing",
    instructionPlaceholder:
      'E.g. "Lead with pain point in the first 3 words. Primary text under 125 chars. Always test a \'social proof\' angle (\'Join 800+ agencies\') alongside a \'result\' angle (\'Get 10 leads in 7 days\'). No emoji in headlines."',
    suggestedTopics: [
      "lead gen",
      "retargeting",
      "awareness",
      "agency services",
      "ROI angles",
      "urgency",
    ],
    examplePlaceholder:
      "Paste a high-converting ad (headline + primary text + CTA) you want AI to replicate in structure…",
  },
  email: {
    description: "Train your email voice — subject lines, open rates, and CTAs",
    instructionPlaceholder:
      'E.g. "Subject lines under 45 chars. Never use all-caps. Open with a story or a surprising stat. Body: 3 short paragraphs max. One CTA only. P.S. line always — it\'s the second most-read part of an email."',
    suggestedTopics: [
      "newsletters",
      "cold outreach",
      "client updates",
      "follow-ups",
      "promotions",
      "onboarding",
    ],
    examplePlaceholder:
      "Paste a high-performing email (subject + body) that got great open/click rates…",
  },
  proposals: {
    description: "Set your proposal voice, structure, and pricing framing",
    instructionPlaceholder:
      'E.g. "Lead with the client\'s business goal, not our services. Frame pricing as an investment vs. cost. Use bullet outcomes not feature lists. Always include a 90-day roadmap section. Close with a single clear next step."',
    suggestedTopics: [
      "social media management",
      "paid ads",
      "SEO",
      "branding",
      "full-service retainer",
      "project-based",
    ],
    examplePlaceholder:
      "Paste an executive summary or scope section from a proposal that closed a deal…",
  },
  "crm-followup": {
    description: "Define your outreach tone, follow-up cadence, and CTA style",
    instructionPlaceholder:
      'E.g. "Keep follow-ups under 100 words. Reference something specific from the last interaction. CTA: always one soft option (\'open to a 15-min call?\') not a hard sell. Avoid \'just following up\' openers — be direct."',
    suggestedTopics: [
      "cold outreach",
      "warm follow-ups",
      "re-engagement",
      "proposals sent",
      "meeting requests",
    ],
    examplePlaceholder:
      "Paste a follow-up email or sequence that got a reply or booked a call…",
  },
  carousel: {
    description: "Set your carousel hook, slide structure, and closing CTA",
    instructionPlaceholder:
      'E.g. "Slide 1 hook: a bold contrarian claim. Slides 2-8: one point per slide, max 15 words each. Last slide: save prompt + follow CTA. Use numbered structure (\'1/\', \'2/\') for LinkedIn carousels."',
    suggestedTopics: [
      "tips & tricks",
      "case studies",
      "myths vs facts",
      "how-to guides",
      "tools",
      "results",
    ],
    examplePlaceholder:
      "Paste a carousel that got strong saves/shares — include the hook slide and structure…",
  },
  "weekly-plan": {
    description: "Guide AI weekly planning — priorities, client mix, and content cadence",
    instructionPlaceholder:
      'E.g. "Mon/Wed/Fri: content creation. Tue/Thu: client calls. Always block 2h for deep work mornings. Limit to 3 active clients per week. Reserve Friday afternoons for strategy and no meetings."',
    suggestedTopics: [
      "content creation",
      "client calls",
      "prospecting",
      "deep work",
      "reporting",
      "team syncs",
    ],
    examplePlaceholder:
      "Paste an ideal week schedule or planning format that works well for you…",
  },
};

// ─── Component ─────────────────────────────────────────────────────────────

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

  const hints = PAGE_HINTS[pageKey];
  const label = pageLabel ?? pageKey;

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

  const addTopic = (topic?: string) => {
    const t = (topic ?? newTopic).trim();
    if (!t || config.focus_topics.includes(t)) return;
    setConfig((c) => ({ ...c, focus_topics: [...c.focus_topics, t] }));
    if (!topic) setNewTopic("");
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

  // Suggested topics not yet added
  const availableSuggestions = hints.suggestedTopics.filter(
    (t) => !config.focus_topics.includes(t),
  );

  return (
    <div
      className={`rounded-2xl border overflow-hidden ${className}`}
      style={{ borderColor: "rgba(212, 255, 0,0.14)" }}
    >
      {/* Header — always visible */}
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-4 py-3 transition-colors cursor-pointer"
        style={{ background: open ? "rgba(13,17,32,0.95)" : "rgba(13,17,32,0.70)" }}
      >
        <div className="flex items-center gap-2.5">
          <Brain
            size={14}
            style={{ color: config.creator_style_id || config.custom_instructions ? "#D4FF00" : "#4A4A5A" }}
          />
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
            <span className="text-[9px] text-text-muted">{hints.description}</span>
          )}
        </div>
        <CaretDown
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
                borderColor: "rgba(212, 255, 0,0.10)",
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
                            : "rgba(212, 255, 0,0.10)",
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
                            ? "rgba(212,255,0,0.18)"
                            : "rgba(13,17,32,0.55)",
                        borderColor:
                          config.tone === t
                            ? "#D4FF00"
                            : "rgba(212, 255, 0,0.12)",
                        color: config.tone === t ? "#D4FF00" : "#A8A8B2",
                      }}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>

              {/* Focus topics — with smart suggestions */}
              <div>
                <p className="text-[10px] font-semibold text-text-muted uppercase tracking-wider mb-2">
                  Focus topics
                </p>

                {/* Active topics */}
                {config.focus_topics.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {config.focus_topics.map((t) => (
                      <span
                        key={t}
                        className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px]"
                        style={{
                          background: "rgba(212,255,0,0.12)",
                          color: "#D4FF00",
                          border: "1px solid rgba(212,255,0,0.22)",
                        }}
                      >
                        {t}
                        <button
                          onClick={() => removeTopic(t)}
                          className="cursor-pointer opacity-60 hover:opacity-100"
                        >
                          <X size={9} />
                        </button>
                      </span>
                    ))}
                  </div>
                )}

                {/* Suggested topic chips */}
                {availableSuggestions.length > 0 && (
                  <div className="mb-2">
                    <p className="text-[9px] text-text-muted mb-1.5 flex items-center gap-1">
                      <Lightbulb size={9} />
                      Suggested for {label}:
                    </p>
                    <div className="flex flex-wrap gap-1">
                      {availableSuggestions.map((t) => (
                        <button
                          key={t}
                          onClick={() => addTopic(t)}
                          className="px-2 py-0.5 rounded-full text-[9px] border cursor-pointer transition-all duration-150 hover:border-indigo-400/40"
                          style={{
                            background: "rgba(13,17,32,0.55)",
                            borderColor: "rgba(212, 255, 0,0.16)",
                            color: "#6B7280",
                          }}
                        >
                          + {t}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Manual add */}
                <div className="flex gap-1.5">
                  <input
                    type="text"
                    value={newTopic}
                    onChange={(e) => setNewTopic(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && addTopic()}
                    placeholder="Add a topic…"
                    className="flex-1 px-2.5 py-1.5 text-[10px] rounded-lg border bg-transparent text-text-primary placeholder:text-text-muted focus:outline-none"
                    style={{ borderColor: "rgba(212, 255, 0,0.18)" }}
                  />
                  <button
                    onClick={() => addTopic()}
                    className="px-2 py-1.5 rounded-lg border text-[10px] cursor-pointer transition-colors"
                    style={{
                      background: "rgba(212,255,0,0.12)",
                      borderColor: "rgba(212,255,0,0.22)",
                      color: "#D4FF00",
                    }}
                  >
                    <Plus size={11} />
                  </button>
                </div>
              </div>

              {/* Custom instructions — page-specific placeholder */}
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
                  rows={4}
                  placeholder={hints.instructionPlaceholder}
                  className="w-full px-3 py-2 text-[10px] rounded-lg border bg-transparent text-text-primary placeholder:text-text-muted focus:outline-none resize-none"
                  style={{ borderColor: "rgba(212, 255, 0,0.18)", lineHeight: 1.6 }}
                />
              </div>

              {/* Example outputs — page-specific placeholder */}
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
                        borderColor: "rgba(212, 255, 0,0.12)",
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
                      placeholder={hints.examplePlaceholder}
                      className="flex-1 px-2.5 py-1.5 text-[10px] rounded-lg border bg-transparent text-text-primary placeholder:text-text-muted focus:outline-none resize-none"
                      style={{ borderColor: "rgba(212, 255, 0,0.18)" }}
                    />
                    <button
                      onClick={addExample}
                      className="self-start mt-0.5 px-2 py-1.5 rounded-lg border text-[10px] cursor-pointer transition-colors"
                      style={{
                        background: "rgba(212,255,0,0.12)",
                        borderColor: "rgba(212,255,0,0.22)",
                        color: "#D4FF00",
                      }}
                    >
                      <Plus size={11} />
                    </button>
                  </div>
                )}
              </div>

              {/* FloppyDisk */}
              <div className="flex justify-end pt-1">
                <button
                  onClick={save}
                  disabled={saving}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-[11px] font-semibold transition-all duration-150 cursor-pointer"
                  style={{
                    background: saved
                      ? "rgba(74,222,128,0.15)"
                      : "rgba(212,255,0,0.18)",
                    color: saved ? "#4ADE80" : "#D4FF00",
                    border: `1px solid ${saved ? "rgba(74,222,128,0.30)" : "rgba(212,255,0,0.28)"}`,
                    opacity: saving ? 0.7 : 1,
                  }}
                >
                  {saving ? (
                    <CircleNotch size={11} className="animate-spin" />
                  ) : saved ? (
                    <Check size={11} />
                  ) : (
                    <FloppyDisk size={11} />
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
