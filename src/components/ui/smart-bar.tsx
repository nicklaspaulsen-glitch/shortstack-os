"use client";
import { ArrowsClockwise, Brain, CaretDown, ChartBar, Check, Copy, Lightbulb, Lightning, Star, Target } from "@phosphor-icons/react";

/**
 * SmartBar — AI Director intelligence panel for creative pages.
 *
 * Context-aware: shows viral format cards (video-gen), structure
 * timeline templates (video-editor), or CTR formula scoring (thumbnail).
 * Three tabs: Formats | Ideas | Score
 *
 * Usage:
 *   <SmartBar context="video-gen" onUseFormat={(prompt) => setPrompt(prompt)} />
 *   <SmartBar context="video-editor" />
 *   <SmartBar context="thumbnail" />
 */

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

export type SmartBarContext = "video-gen" | "video-editor" | "thumbnail";

// ─── Data ────────────────────────────────────────────────────────────────────

const VIDEO_FORMATS = [
  {
    id: "pov_reveal",
    emoji: "👀",
    title: "POV Reveal",
    tag: "TikTok #1",
    color: "#69C9D0",
    prompt:
      "POV: close-up reaction shot revealing a surprising result, slow zoom into face, dramatic lighting shift from shadow to bright, cinematic teal-and-orange grade, 9:16 vertical",
  },
  {
    id: "day_in_life",
    emoji: "📅",
    title: "Day in Life",
    tag: "YouTube #1",
    color: "#FF6B6B",
    prompt:
      "Morning routine aesthetic vlog: 5:30am alarm clock close-up, golden sunrise through window, coffee preparation slow-motion, productive workspace with soft bokeh, golden hour reflection moment, warm cinematic grade",
  },
  {
    id: "before_after",
    emoji: "🔄",
    title: "Before / After",
    tag: "+280% CTR",
    color: "#E1306C",
    prompt:
      "Split-screen transformation reveal: left side muted desaturated before state, dramatic orchestral swell, wipe transition, right side vibrant after result, face reaction zoom at reveal, high contrast color grade",
  },
  {
    id: "tutorial_hook",
    emoji: "🎯",
    title: "Tutorial Hook",
    tag: "Educational",
    color: "#D4FF00",
    prompt:
      "Quick-cut tutorial: text overlay 'stop doing this mistake', step-by-step demonstration with numbered overlays, clean studio lighting, final result dramatic reveal with animated check marks, energetic pace",
  },
  {
    id: "reaction_shock",
    emoji: "😱",
    title: "Shock Reaction",
    tag: "+310% CTR",
    color: "#FBBF24",
    prompt:
      "Genuine shock reaction shot: wide eyes and open mouth expression in dramatic close-up, split-screen showing the shocking thing being reacted to, slow zoom into face at peak moment, high contrast cinematic lighting",
  },
  {
    id: "street_interview",
    emoji: "🎙️",
    title: "Street Interview",
    tag: "Authenticity",
    color: "#8B5CF6",
    prompt:
      "Candid street interview documentary style: handheld camera movement, natural city ambient sound, quick cuts between different people giving authentic answers to the same question, unscripted real reactions",
  },
  {
    id: "cinematic_product",
    emoji: "🎬",
    title: "Cinematic Product",
    tag: "Brand ad",
    color: "#6366F1",
    prompt:
      "Ultra-cinematic product hero: macro close-up texture reveals, studio lighting with dramatic knife-edge shadows, slow 360-degree orbit, water droplet slow-motion, premium teal-orange film color grade, IMAX aspect ratio",
  },
  {
    id: "storytime",
    emoji: "📖",
    title: "Storytime",
    tag: "High retention",
    color: "#F59E0B",
    prompt:
      "Personal story direct-to-camera: intimate handheld warmth, speaking directly to viewer in close framing, emotional arc from problem face to breakthrough revelation to result celebration, candlelit feel",
  },
];

const STRUCTURE_TEMPLATES = [
  {
    id: "hook_story_cta",
    title: "Hook → Story → CTA",
    tag: "Universal #1",
    color: "#D4FF00",
    description: "First 3s: pattern interrupt. 3–25s: value delivery. Last 5s: clear CTA.",
    segments: [
      { label: "HOOK", pct: 10, bg: "#EF4444" },
      { label: "STORY / VALUE", pct: 75, bg: "#D4FF00" },
      { label: "CTA", pct: 15, bg: "#22C55E" },
    ],
  },
  {
    id: "tutorial",
    title: "Tutorial Format",
    tag: "YouTube / TikTok",
    color: "#8B5CF6",
    description: "Problem (0–5s) → Steps (5–50s) → Result reveal (50–60s)",
    segments: [
      { label: "PROB", pct: 8, bg: "#EF4444" },
      { label: "STEP 1", pct: 20, bg: "#6366F1" },
      { label: "STEP 2", pct: 22, bg: "#8B5CF6" },
      { label: "STEP 3", pct: 20, bg: "#6366F1" },
      { label: "RESULT", pct: 30, bg: "#22C55E" },
    ],
  },
  {
    id: "reveal",
    title: "Slow Reveal",
    tag: "Curiosity-driven",
    color: "#EC4899",
    description: "Teaser (0–5s) → Build tension → Big reveal at 80% → Reaction",
    segments: [
      { label: "TEASE", pct: 15, bg: "#EC4899" },
      { label: "BUILD TENSION", pct: 50, bg: "#DB2777" },
      { label: "REVEAL", pct: 20, bg: "#22C55E" },
      { label: "REACT", pct: 15, bg: "#F59E0B" },
    ],
  },
  {
    id: "listicle",
    title: "Listicle",
    tag: "High completion",
    color: "#06B6D4",
    description: "State the count (0–3s) → Items 1–N with equal weight → Best one last",
    segments: [
      { label: "#", pct: 8, bg: "#EF4444" },
      { label: "1", pct: 15, bg: "#06B6D4" },
      { label: "2", pct: 17, bg: "#06B6D4" },
      { label: "3", pct: 17, bg: "#06B6D4" },
      { label: "4", pct: 18, bg: "#0EA5E9" },
      { label: "BEST", pct: 25, bg: "#22C55E" },
    ],
  },
  {
    id: "dayinlife",
    title: "Day in Life",
    tag: "Vlog / POV",
    color: "#F59E0B",
    description: "Morning hook → Throughout the day → Evening reflection",
    segments: [
      { label: "MORNING", pct: 20, bg: "#FBBF24" },
      { label: "DAY", pct: 50, bg: "#F59E0B" },
      { label: "EVENING", pct: 20, bg: "#D97706" },
      { label: "END", pct: 10, bg: "#22C55E" },
    ],
  },
];

const THUMBNAIL_FORMULAS = [
  {
    id: "curiosity_gap",
    emoji: "🤔",
    title: "Curiosity Gap",
    tag: "CTR gold",
    color: "#D4FF00",
    ctrScore: 94,
    description: "Imply something shocking without fully revealing it",
    tips: [
      "Bold question or \"...\" overlay on image",
      "Partially hide or blur the result",
      "Pair with a surprised face pointing at the mystery",
    ],
  },
  {
    id: "face_emotion",
    emoji: "😮",
    title: "Face + Emotion",
    tag: "YouTube gold",
    color: "#F59E0B",
    ctrScore: 91,
    description: "Expressive face filling 50–60% of the frame",
    tips: [
      "Eyes directed toward text or main subject",
      "Mouth open — shock, joy, or confusion outperform neutral",
      "High contrast between face and background",
    ],
  },
  {
    id: "number_shock",
    emoji: "💰",
    title: "Number Shock",
    tag: "Specific = trust",
    color: "#22C55E",
    ctrScore: 88,
    description: "Specific, surprising number anchors attention instantly",
    tips: [
      "Make the number 60%+ of the frame width",
      "Specific beats round — $10,247 > $10K",
      "Contrasting accent color for the number only",
    ],
  },
  {
    id: "before_after",
    emoji: "🔄",
    title: "Before / After",
    tag: "Transformation",
    color: "#EC4899",
    ctrScore: 85,
    description: "Split frame showing a dramatic visual difference",
    tips: [
      "Clear contrast between left (problem) and right (result)",
      "Divider line or arrow between the two states",
      "Desaturate the before side; saturate the after",
    ],
  },
  {
    id: "color_pop",
    emoji: "🎨",
    title: "Color Pop",
    tag: "Stand-out",
    color: "#8B5CF6",
    ctrScore: 78,
    description: "One bold color subject against a desaturated background",
    tips: [
      "Desaturate everything except the single focal subject",
      "Works best with complementary color pairs",
      "Creates an instant visual magnet in the feed",
    ],
  },
  {
    id: "authority",
    emoji: "👑",
    title: "Authority + Proof",
    tag: "Trust builder",
    color: "#F97316",
    ctrScore: 75,
    description: "Credibility markers that create instant trust",
    tips: [
      "Logos, subscriber counts, or years of experience",
      "Professional setting or recognized visual cues",
      "Social proof numbers in the overlay text",
    ],
  },
];

const IDEAS_BY_CONTEXT: Record<SmartBarContext, string[]> = {
  "video-gen": [
    "Show the same product at 3 price points side by side — no commentary, let the camera do the talking",
    "FilmStrip the 'villain origin story' of the biggest myth in your industry — then debunk it at the end",
    "Day 1 vs Day 365: same location, same camera angle, same lighting — only the person changes",
    "What your competitor won't show you — raw, unedited behind-the-scenes with no voiceover",
    "Silent demo — zero voiceover, just the product performing for 30 focused seconds",
  ],
  "video-editor": [
    "Cut your first 5 seconds — viewers decide whether to swipe in 2 seconds, not 5",
    "Add a visual pattern interrupt at the 12–15 second mark: text pop, sound effect, or camera angle change",
    "End your video on an open question — it forces comments and signals the algorithm",
    "Speed ramp: slow-motion leading into your key reveal moment, then fast cut immediately after",
    "Silence + slow zoom = emotion — try it on your single best frame",
  ],
  "thumbnail": [
    "Add the result number to top-left in the largest text on the frame",
    "Remove every element that isn't the main subject and face",
    "Test a red arrow pointing at the single most important element",
    "Try an unexpected color combo — visual surprise = more clicks",
    "Make the face fill at least half the frame and use an open-mouthed expression",
  ],
};

const CTR_METRICS = [
  { label: "Emotional impact", score: 72, tip: "Boost with open-mouth expression or larger face crop" },
  { label: "Visual clarity", score: 85, tip: "Good contrast and clean composition" },
  { label: "Text readability", score: 60, tip: "Increase font size or reduce to one key phrase" },
  { label: "Curiosity factor", score: 55, tip: "Hide part of the result to create a gap" },
  { label: "Color contrast", score: 78, tip: "Try a complementary color push to pop more" },
];

const HOOK_METRICS = [
  { label: "First 3 seconds", score: 0, tip: "Load a video to analyze the opening hook" },
  { label: "Pattern interrupts", score: 0, tip: "Edit then analyze to find retention drop-off points" },
  { label: "CTA clarity", score: 0, tip: "Is your end call-to-action explicit and timed well?" },
];

const TREND_METRICS = [
  { label: "Hook strength", score: 0, tip: "Write your prompt first, then we score it" },
  { label: "Platform fit", score: 0, tip: "Pick a viral format above to see platform alignment" },
  { label: "Viral potential", score: 0, tip: "Using a viral format chip boosts this score significantly" },
];

// ─── Component ───────────────────────────────────────────────────────────────

interface SmartBarProps {
  context: SmartBarContext;
  /** Called when user clicks "Use this" on a video format card */
  onUseFormat?: (prompt: string) => void;
  /** Called when user clicks "Apply" on a structure template */
  onUseTemplate?: (templateId: string) => void;
  className?: string;
}

type Tab = "formats" | "ideas" | "score";

export default function SmartBar({
  context,
  onUseFormat,
  onUseTemplate,
  className = "",
}: SmartBarProps) {
  const [expanded, setExpanded] = useState(true);
  const [tab, setTab] = useState<Tab>("formats");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [ideaCopied, setIdeaCopied] = useState<number | null>(null);

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2200);
  };

  const copyIdea = (text: string, idx: number) => {
    navigator.clipboard.writeText(text);
    setIdeaCopied(idx);
    setTimeout(() => setIdeaCopied(null), 2200);
  };

  const TAB_LABELS: Record<Tab, Record<SmartBarContext, string>> = {
    formats: { "video-gen": "Viral Formats", "video-editor": "Structure", "thumbnail": "CTR Formulas" },
    ideas: { "video-gen": "Ideas", "video-editor": "Ideas", "thumbnail": "Ideas" },
    score: { "video-gen": "Insights", "video-editor": "Hook Score", "thumbnail": "CTR Score" },
  };

  const overallCtr = Math.round(CTR_METRICS.reduce((a, m) => a + m.score, 0) / CTR_METRICS.length);

  return (
    <div
      className={`rounded-xl overflow-hidden ${className}`}
      style={{
        background: "rgba(13,17,32,0.92)",
        border: "1px solid rgba(139,92,246,0.14)",
      }}
    >
      {/* ── Header ── */}
      <button
        onClick={() => setExpanded((e) => !e)}
        className="w-full flex items-center justify-between px-4 py-3 transition-colors hover:bg-white/[0.02]"
      >
        <div className="flex items-center gap-2">
          <div
            className="w-6 h-6 rounded-lg flex items-center justify-center"
            style={{
              background: "rgba(139,92,246,0.18)",
              border: "1px solid rgba(139,92,246,0.28)",
            }}
          >
            <Brain className="w-3.5 h-3.5" style={{ color: "#A78BFA" }} />
          </div>
          <div className="text-left">
            <div className="text-xs font-semibold text-white">AI Director</div>
            <div className="text-[10px] text-white/30">
              {context === "video-gen" && "Viral formats · smart prompts · trend insights"}
              {context === "video-editor" && "Structure templates · hook scoring · edit tips"}
              {context === "thumbnail" && "CTR formulas · scoring · viral formula library"}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span
            className="text-[9px] font-bold px-2 py-0.5 rounded-full"
            style={{ background: "rgba(139,92,246,0.15)", color: "#A78BFA" }}
          >
            AI
          </span>
          <CaretDown
            className="w-3.5 h-3.5 text-white/25 transition-transform duration-200"
            style={{ transform: expanded ? "rotate(180deg)" : "rotate(0deg)" }}
          />
        </div>
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: "easeInOut" }}
            className="overflow-hidden"
          >
            <div className="border-t border-white/[0.05]">
              {/* ── Tab Strip ── */}
              <div className="flex gap-1 p-2 pb-0">
                {(["formats", "ideas", "score"] as Tab[]).map((t) => (
                  <button
                    key={t}
                    onClick={() => setTab(t)}
                    className="flex-1 text-[10px] font-medium py-1.5 rounded-md transition-all"
                    style={{
                      background: tab === t ? "rgba(139,92,246,0.15)" : "transparent",
                      color: tab === t ? "#A78BFA" : "rgba(255,255,255,0.30)",
                      border: tab === t ? "1px solid rgba(139,92,246,0.25)" : "1px solid transparent",
                    }}
                  >
                    {TAB_LABELS[t][context]}
                  </button>
                ))}
              </div>

              {/* ── Formats / Templates / Formulas Tab ── */}
              <AnimatePresence mode="wait">
                {tab === "formats" && (
                  <motion.div
                    key="formats"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.15 }}
                    className="p-2"
                  >
                    {/* VIDEO-GEN: horizontal scroll of format cards */}
                    {context === "video-gen" && (
                      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
                        {VIDEO_FORMATS.map((fmt) => (
                          <div
                            key={fmt.id}
                            className="flex-shrink-0 w-36 rounded-xl p-2.5"
                            style={{
                              background: "rgba(255,255,255,0.03)",
                              border: "1px solid rgba(255,255,255,0.07)",
                            }}
                          >
                            <div className="text-[18px] mb-1.5 leading-none">{fmt.emoji}</div>
                            <div className="text-[11px] font-semibold text-white/90 leading-tight">
                              {fmt.title}
                            </div>
                            <div
                              className="text-[9px] font-medium mt-0.5 mb-2"
                              style={{ color: fmt.color }}
                            >
                              {fmt.tag}
                            </div>
                            <p className="text-[9px] text-white/35 leading-snug mb-2.5 line-clamp-2">
                              {fmt.prompt.slice(0, 62)}…
                            </p>
                            <div className="flex gap-1">
                              <button
                                onClick={() => {
                                  onUseFormat?.(fmt.prompt);
                                }}
                                className="flex-1 text-[9px] font-semibold py-1 rounded-md text-center transition-all hover:brightness-110"
                                style={{
                                  background: `${fmt.color}1A`,
                                  color: fmt.color,
                                  border: `1px solid ${fmt.color}30`,
                                }}
                              >
                                Use this
                              </button>
                              <button
                                onClick={() => copyToClipboard(fmt.prompt, fmt.id)}
                                className="w-6 h-6 flex items-center justify-center rounded-md transition-all"
                                style={{
                                  background:
                                    copiedId === fmt.id
                                      ? "rgba(34,197,94,0.15)"
                                      : "rgba(255,255,255,0.05)",
                                }}
                                title="Copy prompt"
                              >
                                {copiedId === fmt.id ? (
                                  <Check className="w-2.5 h-2.5 text-green-400" />
                                ) : (
                                  <Copy className="w-2.5 h-2.5 text-white/30" />
                                )}
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* VIDEO-EDITOR: structure template timeline cards */}
                    {context === "video-editor" && (
                      <div className="space-y-2 max-h-[380px] overflow-y-auto scrollbar-hide">
                        {STRUCTURE_TEMPLATES.map((tmpl, i) => (
                          <motion.div
                            key={tmpl.id}
                            initial={{ opacity: 0, x: -8 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: i * 0.05 }}
                            className="rounded-xl p-3"
                            style={{
                              background: "rgba(255,255,255,0.03)",
                              border: "1px solid rgba(255,255,255,0.07)",
                            }}
                          >
                            <div className="flex items-start justify-between mb-2">
                              <div>
                                <div className="text-[11px] font-semibold text-white/90">
                                  {tmpl.title}
                                </div>
                                <div
                                  className="text-[9px] font-medium mt-0.5"
                                  style={{ color: tmpl.color }}
                                >
                                  {tmpl.tag}
                                </div>
                              </div>
                              <button
                                onClick={() => onUseTemplate?.(tmpl.id)}
                                className="text-[9px] font-semibold px-2 py-1 rounded-lg transition-all hover:brightness-110 shrink-0"
                                style={{
                                  background: `${tmpl.color}18`,
                                  color: tmpl.color,
                                  border: `1px solid ${tmpl.color}28`,
                                }}
                              >
                                Apply
                              </button>
                            </div>
                            {/* Visual timeline bar */}
                            <div className="flex rounded-full overflow-hidden h-3.5 mb-2" style={{ gap: "1px" }}>
                              {tmpl.segments.map((seg) => (
                                <div
                                  key={seg.label}
                                  className="flex items-center justify-center text-[7px] font-bold text-white/90 transition-all"
                                  style={{
                                    width: `${seg.pct}%`,
                                    background: seg.bg + "DD",
                                    minWidth: "4px",
                                  }}
                                  title={seg.label}
                                >
                                  {seg.pct >= 14 ? seg.label : ""}
                                </div>
                              ))}
                            </div>
                            <p className="text-[9px] text-white/35 leading-snug">{tmpl.description}</p>
                          </motion.div>
                        ))}
                      </div>
                    )}

                    {/* THUMBNAIL: CTR formula cards */}
                    {context === "thumbnail" && (
                      <div className="space-y-2 max-h-[380px] overflow-y-auto scrollbar-hide">
                        {THUMBNAIL_FORMULAS.map((formula, i) => (
                          <motion.div
                            key={formula.id}
                            initial={{ opacity: 0, x: -8 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: i * 0.06 }}
                            className="rounded-xl p-3"
                            style={{
                              background: "rgba(255,255,255,0.03)",
                              border: "1px solid rgba(255,255,255,0.07)",
                            }}
                          >
                            <div className="flex items-start justify-between mb-1.5">
                              <div className="flex items-center gap-2">
                                <span className="text-base leading-none">{formula.emoji}</span>
                                <div>
                                  <div className="text-[11px] font-semibold text-white/90">
                                    {formula.title}
                                  </div>
                                  <div
                                    className="text-[9px] font-medium mt-0.5"
                                    style={{ color: formula.color }}
                                  >
                                    {formula.tag}
                                  </div>
                                </div>
                              </div>
                              <div className="text-right shrink-0">
                                <div
                                  className="text-base font-bold leading-none"
                                  style={{
                                    color:
                                      formula.ctrScore >= 90
                                        ? "#22C55E"
                                        : formula.ctrScore >= 80
                                        ? "#D4FF00"
                                        : "#F59E0B",
                                  }}
                                >
                                  {formula.ctrScore}
                                </div>
                                <div className="text-[8px] text-white/25 mt-0.5">CTR score</div>
                              </div>
                            </div>
                            <p className="text-[9px] text-white/45 mb-2 leading-snug">
                              {formula.description}
                            </p>
                            <div className="space-y-1">
                              {formula.tips.map((tip, j) => (
                                <div key={j} className="flex items-start gap-1.5">
                                  <div
                                    className="w-1 h-1 rounded-full mt-1.5 shrink-0"
                                    style={{ background: formula.color }}
                                  />
                                  <span className="text-[9px] text-white/40 leading-snug">{tip}</span>
                                </div>
                              ))}
                            </div>
                          </motion.div>
                        ))}
                      </div>
                    )}
                  </motion.div>
                )}

                {/* ── Ideas Tab ── */}
                {tab === "ideas" && (
                  <motion.div
                    key="ideas"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.15 }}
                    className="p-2 space-y-1.5"
                  >
                    {IDEAS_BY_CONTEXT[context].map((idea, i) => (
                      <motion.button
                        key={i}
                        initial={{ opacity: 0, x: -6 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.07 }}
                        onClick={() => copyIdea(idea, i)}
                        className="w-full flex items-start gap-2.5 px-2.5 py-2.5 rounded-lg text-left group transition-all"
                        style={{
                          background:
                            ideaCopied === i
                              ? "rgba(34,197,94,0.08)"
                              : "rgba(255,255,255,0.03)",
                          border:
                            ideaCopied === i
                              ? "1px solid rgba(34,197,94,0.20)"
                              : "1px solid rgba(255,255,255,0.06)",
                        }}
                      >
                        <span
                          className="w-4 h-4 rounded-full flex items-center justify-center shrink-0 text-[8px] font-bold mt-0.5"
                          style={{
                            background: "rgba(139,92,246,0.18)",
                            color: "#A78BFA",
                          }}
                        >
                          {i + 1}
                        </span>
                        <span className="text-[10px] text-white/65 flex-1 leading-relaxed">
                          {idea}
                        </span>
                        <div className="w-4 h-4 shrink-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity mt-0.5">
                          {ideaCopied === i ? (
                            <Check className="w-2.5 h-2.5 text-green-400" />
                          ) : (
                            <Copy className="w-2.5 h-2.5 text-white/25" />
                          )}
                        </div>
                      </motion.button>
                    ))}
                    <button
                      className="w-full flex items-center justify-center gap-1.5 py-2 mt-1 rounded-lg text-[10px] font-medium transition-all hover:bg-white/[0.04] text-white/30"
                      style={{ border: "1px dashed rgba(255,255,255,0.10)" }}
                    >
                      <ArrowsClockwise className="w-3 h-3" /> Refresh ideas
                    </button>
                  </motion.div>
                )}

                {/* ── Score / Insights Tab ── */}
                {tab === "score" && (
                  <motion.div
                    key="score"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.15 }}
                    className="p-3 space-y-3"
                  >
                    {/* THUMBNAIL: CTR score breakdown */}
                    {context === "thumbnail" && (
                      <>
                        <p className="text-[10px] text-white/30 uppercase tracking-wider">
                          CTR Score Breakdown
                        </p>
                        <div className="space-y-2.5">
                          {CTR_METRICS.map((metric, i) => (
                            <div key={metric.label}>
                              <div className="flex items-center justify-between mb-1">
                                <span className="text-[10px] text-white/55">{metric.label}</span>
                                <span
                                  className="text-[10px] font-bold tabular-nums"
                                  style={{
                                    color:
                                      metric.score >= 80
                                        ? "#22C55E"
                                        : metric.score >= 65
                                        ? "#F59E0B"
                                        : "#EF4444",
                                  }}
                                >
                                  {metric.score}
                                </span>
                              </div>
                              <div className="h-1.5 rounded-full bg-white/[0.08] overflow-hidden">
                                <motion.div
                                  className="h-full rounded-full"
                                  initial={{ width: 0 }}
                                  animate={{ width: `${metric.score}%` }}
                                  transition={{ duration: 0.7, delay: i * 0.08 }}
                                  style={{
                                    background:
                                      metric.score >= 80
                                        ? "#22C55E"
                                        : metric.score >= 65
                                        ? "#F59E0B"
                                        : "#EF4444",
                                  }}
                                />
                              </div>
                              <p className="text-[8px] text-white/25 mt-0.5">{metric.tip}</p>
                            </div>
                          ))}
                        </div>
                        <div
                          className="rounded-xl p-3 mt-1"
                          style={{
                            background: "rgba(212,255,0,0.07)",
                            border: "1px solid rgba(212,255,0,0.18)",
                          }}
                        >
                          <p className="text-[10px] font-semibold text-indigo-400 mb-1">
                            Overall CTR Score
                          </p>
                          <div className="flex items-end gap-1">
                            <span className="font-display text-3xl font-bold text-white tabular-nums">
                              {overallCtr}
                            </span>
                            <span className="text-sm text-white/30 mb-1">/ 100</span>
                          </div>
                          <p className="text-[9px] text-white/35 mt-1">
                            Above average. Fix text readability + curiosity factor to reach 85+.
                          </p>
                        </div>
                      </>
                    )}

                    {/* VIDEO-GEN: trend insights */}
                    {context === "video-gen" && (
                      <>
                        <p className="text-[10px] text-white/30 uppercase tracking-wider">
                          Trend Insights
                        </p>
                        <div className="space-y-2.5">
                          {TREND_METRICS.map((metric) => (
                            <div key={metric.label}>
                              <div className="flex items-center justify-between mb-1">
                                <span className="text-[10px] text-white/55">{metric.label}</span>
                                <span className="text-[9px] text-white/18">pending</span>
                              </div>
                              <div className="h-1.5 rounded-full bg-white/[0.06]" />
                              <p className="text-[8px] text-white/22 mt-0.5">{metric.tip}</p>
                            </div>
                          ))}
                        </div>
                        <div
                          className="rounded-xl p-3 text-[9px] text-white/28"
                          style={{ border: "1px dashed rgba(255,255,255,0.08)" }}
                        >
                          Pick a viral format, write your prompt, then generate — we&apos;ll score the
                          result and show trend alignment here.
                        </div>
                      </>
                    )}

                    {/* VIDEO-EDITOR: hook scoring */}
                    {context === "video-editor" && (
                      <>
                        <p className="text-[10px] text-white/30 uppercase tracking-wider">
                          Hook Analyzer
                        </p>
                        <div className="space-y-2.5">
                          {HOOK_METRICS.map((metric) => (
                            <div key={metric.label}>
                              <div className="flex items-center justify-between mb-1">
                                <span className="text-[10px] text-white/55">{metric.label}</span>
                                <span className="text-[9px] text-white/18">no video yet</span>
                              </div>
                              <div className="h-1.5 rounded-full bg-white/[0.06]" />
                              <p className="text-[8px] text-white/22 mt-0.5">{metric.tip}</p>
                            </div>
                          ))}
                        </div>
                        <div
                          className="rounded-xl p-3 text-[9px] text-white/28"
                          style={{ border: "1px dashed rgba(255,255,255,0.08)" }}
                        >
                          Import your video to get hook timing analysis and predicted audience
                          drop-off points.
                        </div>
                      </>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
