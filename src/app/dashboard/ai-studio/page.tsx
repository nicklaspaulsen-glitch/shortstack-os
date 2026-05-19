"use client";

import { useEffect, useMemo, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  Mic, ImagePlus, Scissors, Film, Music, Volume2, Layers, Sparkles,
  Upload, Download, Play, Loader, X,
  Wand2, Zap, Copy, Palette, AlertTriangle,
  ArrowUpRight, FileAudio, Brain,
  Target, Edit3, Type as TypeIcon, Ratio, Loader2,
  Heart, MoreHorizontal, Search, ChevronDown,
} from "lucide-react";
import toast from "react-hot-toast";
import { motion, AnimatePresence } from "framer-motion";
import { tabSwitch } from "@/components/motion/motion-page";
import { staggerContainerFast, fadeUp } from "@/lib/motion-variants";

import { MotionPage } from "@/components/motion/motion-page";
import ImageWizard from "@/components/image-wizard";
import CreationWizard, { type WizardStep } from "@/components/creation-wizard";
import { Wizard, AdvancedToggle, useAdvancedMode } from "@/components/ui/wizard";
import SafeThumb from "@/components/safe-thumb";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { createHandoff, handoffUrl } from "@/lib/ai-handoff";
import { AIPromptBox } from "@/components/ui/ai-prompt-box";
import { ActionSearchBar, type SearchAction } from "@/components/ui/21st-components";
import PageAgent from "@/components/ui/page-agent";


// -- Types --------------------------------------------------------
interface JobResult {
  id: string;
  type: string;
  status: "processing" | "completed" | "failed";
  result?: string;
  timestamp: Date;
  meta?: Record<string, unknown>;
}

// -- Tool configs -------------------------------------------------
const TOOLS = [
  { id: "transcribe",  name: "Transcribe",      desc: "Audio/video to text with timestamps",  icon: Mic,        color: "#3B82F6", tag: "Whisper V3",   inputLabel: "Audio / Video file",     outputLabel: "Text transcript"       },
  { id: "image-gen",  name: "Image Gen",        desc: "Generate images from text prompts",    icon: Palette,    color: "#3B82F6", tag: "FLUX/DALL-E",  inputLabel: "Text prompt",            outputLabel: "Generated image"       },
  { id: "upscale",    name: "Upscale",          desc: "4× AI image upscaling",                icon: ArrowUpRight, color: "#3B82F6", tag: "Real-ESRGAN", inputLabel: "Low-res image",          outputLabel: "4× sharp image"        },
  { id: "remove-bg",  name: "Remove BG",        desc: "One-click background removal",         icon: Scissors,   color: "#3B82F6", tag: "REMBG/SAM",    inputLabel: "Photo with background",  outputLabel: "Transparent PNG"       },
  { id: "img-to-video", name: "Image to Video", desc: "Animate still images into video",      icon: Film,       color: "#3B82F6", tag: "SVD",          inputLabel: "Still image",            outputLabel: "Short video clip"      },
  { id: "music-gen",  name: "Music Gen",        desc: "AI background music for videos",       icon: Music,      color: "#1D4ED8", tag: "MusicGen",     inputLabel: "Style description",      outputLabel: "Background track",     newBadge: true },
  { id: "voice-clone", name: "Voice Clone",     desc: "Clone voice from 6s audio sample",    icon: Volume2,    color: "#3B82F6", tag: "XTTS v2",      inputLabel: "6s voice sample",        outputLabel: "Cloned voice model"    },
  { id: "train-lora", name: "Brand LoRA",       desc: "Train custom image style models",      icon: Brain,      color: "#1D4ED8", tag: "LoRA",         inputLabel: "15–20 reference photos", outputLabel: "Custom style model",   badge: "Business+" },
  { id: "batch-gen",  name: "Batch Generate",   desc: "50+ images in one go",                 icon: Layers,     color: "#3B82F6", tag: "FLUX/SDXL",   inputLabel: "Prompt + variants",      outputLabel: "50+ images"            },
] as const;

type ToolId = typeof TOOLS[number]["id"];

const TOOL_CATEGORIES: Record<ToolId, "visual" | "audio" | "utility"> = {
  transcribe: "audio",
  "image-gen": "visual",
  upscale: "visual",
  "remove-bg": "visual",
  "img-to-video": "visual",
  "music-gen": "audio",
  "voice-clone": "audio",
  "train-lora": "utility",
  "batch-gen": "utility",
};
type ToolCategory = "all" | "visual" | "audio" | "utility";

export default function AIStudioPage() {
  const supabaseMain = useMemo(() => createClient(), []);
  const [activeTool, setActiveTool] = useState<ToolId>("transcribe");
  // Ref on the active-tool panel � used by the tile grid to scroll the
  // panel into view when the user picks a tile. Without this, clicks on
  // tiles look dead because the tool panel is rendered far below the
  // grid (off-screen by ~600 px) and the active-tile blue border is
  // subtle, so users see "nothing happened" on click.
  const toolPanelRef = useRef<HTMLDivElement>(null);
  const [processing, setProcessing] = useState(false);
  const [history, setHistory] = useState<JobResult[]>([]);
  const [wizardOpen, setWizardOpen] = useState(false);
  const [wizardImages, setWizardImages] = useState<{ url: string; width: number; height: number }[]>([]);

  // CreationWizard (lean 5-step image flow) state
  const [creationWizardOpen, setCreationWizardOpen] = useState(false);
  const [imageGenInit, setImageGenInit] = useState<{
    prompt?: string;
    style?: string;
    size?: string;
    autoGenerateToken?: number;
  }>({});

  // Guided Mode ? Advanced Mode (full tool grid)
  const [advancedMode, setAdvancedMode] = useAdvancedMode("ai-studio");
  const [guidedStep, setGuidedStep] = useState(0);
  const [guidedIntent, setGuidedIntent] = useState<ToolId>("image-gen");
  const [guidedPrompt, setGuidedPrompt] = useState("");
  const [toolCategory, setToolCategory] = useState<ToolCategory>("all");
  // Higgsfield studio tab
  const [studioTab, setStudioTab] = useState<"image" | "video" | "tools">("image");
  const [tabDir, setTabDir] = useState(0);
  const TAB_ORDER = ["image", "video", "tools"] as const;

  // Auto-open the legacy modal only on advanced-mode first visit
  useEffect(() => {
    try {
      const seen = localStorage.getItem("ss-image-wizard-seen");
      if (!seen && advancedMode) {
        setWizardOpen(true);
        setActiveTool("image-gen");
      }
    } catch { /* localStorage unavailable */ }
  }, [advancedMode]);

  // -- Handoff consumer � ?handoff= opens the image-gen tool in edit mode --
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const hid = params.get("handoff");
    if (!hid) return;
    let cancelled = false;
    (async () => {
      try {
        const { loadHandoff: loadH } = await import("@/lib/ai-handoff");
        const h = await loadH(supabaseMain, hid);
        if (!h || cancelled) return;
        const p = h.payload as { imageUrl?: string; prompt?: string; style?: string; size?: string };
        setActiveTool("image-gen");
        if (p.prompt || p.style || p.size) {
          setImageGenInit({
            prompt: p.prompt,
            style: p.style,
            size: p.size,
          });
        }
        toast.success("Image loaded � adjust settings and regenerate");
        const u = new URL(window.location.href);
        u.searchParams.delete("handoff");
        window.history.replaceState(null, "", u.toString());
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to load edit data");
      }
    })();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <MotionPage className="p-0">

      {/* -- AI Studio command strip (slim editorial header, no PageHero) -- */}
      <div className="flex items-center justify-between gap-4 px-1 py-3 sm:py-4">
        <div className="min-w-0 flex items-center gap-3">
          <div>
            <p className="font-editorial text-[11px] italic text-text-muted mb-0.5 truncate">
              Generative Media
            </p>
            <h1 className="font-display text-xl sm:text-2xl font-bold tracking-tight text-text-primary leading-none truncate">
              AI Studio
            </h1>
          </div>
          <span className="hidden sm:flex items-center gap-1 text-[10px] font-medium px-2.5 py-1 rounded-full bg-white/[0.06] border border-white/10 text-text-muted">
            {TOOLS.length} tools
          </span>
          {history.length > 0 && (
            <span className="hidden sm:flex items-center gap-1 text-[10px] font-semibold px-2.5 py-1 rounded-full bg-[rgba(59,130,246,0.08)] border border-[rgba(59,130,246,0.15)] text-brand-accent">
              <span className="w-1.5 h-1.5 rounded-full bg-brand-accent animate-pulse" />
              {history.filter(j => j.status === "completed").length} done
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="hidden md:flex items-center gap-1 text-[10px] text-text-muted px-2.5 py-1 rounded-md bg-white/[0.04] border border-white/8">
            {TOOLS.find(t => t.id === activeTool)?.name ?? "Select tool"}
          </span>
          {/* Model badge — shows current default generation model */}
          <span className="hidden sm:flex items-center gap-1 text-[10px] font-medium px-2.5 py-1 rounded-full bg-[rgba(59,130,246,0.08)] border border-[rgba(59,130,246,0.18)] text-brand-accent">
            <Brain size={10} />
            Claude Sonnet 4.5
          </span>
          <AdvancedToggle value={advancedMode} onChange={setAdvancedMode} />
          {advancedMode && (
            <button
              onClick={() => {
                setActiveTool("image-gen");
                setCreationWizardOpen(true);
              }}
              className="btn-pill text-xs flex items-center gap-1.5"
            >
              <Sparkles size={13} />
              New with AI
            </button>
          )}
        </div>
      </div>

      {/* Competitive Intelligence strip */}
      <div className="px-1 mb-2">
        <PageAgent context="ai-studio" />
      </div>

      {/* -- GUIDED MODE ------------------------------------------- */}
      {!advancedMode && (
        <div className="space-y-4 px-6 py-6">
          {/* Tab bar: Image | Video | AI Tools */}
          <div
            className="tab-pill-strip"
          >
            {(["image", "video"] as const).map(tab => (
              <button
                key={tab}
                onClick={() => {
                  const curIdx = TAB_ORDER.indexOf(studioTab);
                  const newIdx = TAB_ORDER.indexOf(tab);
                  setTabDir(newIdx > curIdx ? 1 : -1);
                  setStudioTab(tab);
                }}
                className={`tab-pill${studioTab === tab ? " active" : ""} text-[11px]`}
              >
                {tab === "image" ? <ImagePlus size={11} /> : <Film size={11} />}
                {tab === "image" ? "Image" : "Video"}
              </button>
            ))}
            <button
              onClick={() => {
                const curIdx = TAB_ORDER.indexOf(studioTab);
                const newIdx = TAB_ORDER.indexOf("tools");
                setTabDir(newIdx > curIdx ? 1 : -1);
                setStudioTab("tools");
              }}
              className={`tab-pill${studioTab === "tools" ? " active" : ""} text-[11px]`}
            >
              <Sparkles size={11} /> AI Tools
            </button>
          </div>

          <AnimatePresence mode="wait" custom={tabDir}>
            <motion.div
              key={studioTab}
              custom={tabDir}
              variants={tabSwitch}
              initial="hidden"
              animate="visible"
              exit="exit"
            >
              {studioTab === "image" && (
                <GuidedImagePanel
                  processing={processing}
                  setProcessing={setProcessing}
                  history={history}
                  setHistory={setHistory}
                />
              )}
              {studioTab === "video" && (
                <div className="flex items-center justify-center min-h-[420px] rounded-2xl border border-border-subtle bg-surface-light">
                  <div className="text-center space-y-3">
                    <Film size={32} className="mx-auto text-brand-accent opacity-50" />
                    <p className="text-sm font-semibold text-text-secondary">Video generation coming soon</p>
                    <p className="text-xs text-text-muted">Use the AI Tools tab for image-to-video now</p>
                    <button
                      onClick={() => { setActiveTool("img-to-video"); setAdvancedMode(true); }}
                      className="text-xs text-brand-accent hover:underline font-medium"
                    >
                      Open Image-to-Video tool
                    </button>
                  </div>
                </div>
              )}
              {studioTab === "tools" && (
                <ToolDiscoveryGrid onSelect={(id) => { setActiveTool(id); setAdvancedMode(true); }} />
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      )}

      {/* -- ADVANCED MODE ------------------------------------------- */}
      {advancedMode && (
      <div className="px-4 py-4 min-h-[calc(100vh-120px)]">

        {/* Wizard image results � inline strip above the workspace */}
        {wizardImages.length > 0 && (
          <motion.div
            className="glass-card mb-5 p-4"
            initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.22 }}
          >
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Sparkles size={13} className="text-[#3B82F6]" />
                <span className="text-sm font-semibold text-text-primary">Latest generation</span>
                <span className="text-[10px] text-text-muted">{wizardImages.length} image{wizardImages.length > 1 ? "s" : ""}</span>
              </div>
              <button onClick={() => setWizardImages([])} className="text-[9px] text-text-muted hover:text-text-primary transition-colors">
                Clear
              </button>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {wizardImages.map((img, i) => (
                <a key={i} href={img.url} target="_blank" rel="noopener noreferrer"
                  className="block bg-black rounded-xl overflow-hidden hover:ring-1 hover:ring-[#2563EB]/40 transition-all">
                  <SafeThumb
                    src={img.url}
                    alt={`Wizard output ${i + 1}`}
                    className="w-full"
                    style={{ aspectRatio: `${img.width} / ${img.height}` }}
                    wrapperClassName="w-full"
                  />
                </a>
              ))}
            </div>
          </motion.div>
        )}

        {/* Editorial bento stats — shown when there's job history */}
        {history.length > 0 && (
          <div className="grid grid-cols-2 lg:grid-cols-[4fr_2fr_2fr] gap-3 mb-4">
            {/* Jobs Run focal tile */}
            <motion.div
              className="col-span-2 lg:col-span-1 glass-card-heavy rounded-2xl p-5 flex items-center gap-4"
              initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.38, delay: 0.04, ease: [0.22, 1, 0.36, 1] }}
            >
              <div className="w-1 self-stretch rounded-full bg-gradient-to-b from-[#2563EB] to-[#3B82F6] shrink-0" />
              <div>
                <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-text-muted mb-1.5">Jobs Run</p>
                <p className="font-display text-3xl font-bold tracking-[-0.03em] text-text-primary tabular-nums">{history.length}</p>
                <p className="text-[11px] text-text-muted mt-1.5">this session</p>
              </div>
            </motion.div>
            {/* Completed support tile */}
            <motion.div
              className="glass-card rounded-2xl p-5 flex flex-col justify-center"
              initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.38, delay: 0.10, ease: [0.22, 1, 0.36, 1] }}
            >
              <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-text-muted mb-1.5">Completed</p>
              <p className="font-display text-2xl font-bold tracking-[-0.02em] text-text-primary tabular-nums">
                {history.filter(j => j.status === "completed").length}
              </p>
              <p className="text-[11px] text-text-muted mt-1.5">
                {Math.round((history.filter(j => j.status === "completed").length / history.length) * 100)}% success
              </p>
            </motion.div>
            {/* Active Tool support tile */}
            <motion.div
              className="glass-card rounded-2xl p-5 flex flex-col justify-center"
              initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.38, delay: 0.14, ease: [0.22, 1, 0.36, 1] }}
            >
              <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-text-muted mb-1.5">Active Tool</p>
              <p className="font-display text-2xl font-bold tracking-[-0.02em] text-text-primary truncate">
                {TOOLS.find(t => t.id === activeTool)?.name ?? "—"}
              </p>
              <p className="text-[11px] text-text-muted mt-1.5">{TOOLS.find(t => t.id === activeTool)?.tag ?? ""}</p>
            </motion.div>
          </div>
        )}

        {/* Category filter pills */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-1.5 p-1 rounded-xl" style={{ background: "rgba(19,24,39,0.70)", border: "1px solid rgba(59,130,246,0.12)" }}>
            {(["all", "visual", "audio", "utility"] as ToolCategory[]).map(cat => (
              <button
                key={cat}
                onClick={() => setToolCategory(cat)}
                className={`relative text-[10px] font-bold px-3 py-1.5 rounded-lg transition-all capitalize ${
                  toolCategory === cat
                    ? "text-white"
                    : "text-text-muted hover:text-text-muted"
                }`}
                style={toolCategory === cat ? {
                  background: "linear-gradient(180deg, #3B82F6 0%, #1D4ED8 100%)",
                  boxShadow: "0 1px 0 rgba(255,255,255,0.15) inset, 0 2px 8px rgba(59,130,246,0.35)",
                } : undefined}
              >
                {cat === "all" ? "All" : cat}
              </button>
            ))}
          </div>
          <span className="text-[10px] font-mono text-text-muted">
            {TOOLS.filter(t => toolCategory === "all" || TOOL_CATEGORIES[t.id] === toolCategory).length} tools
          </span>
        </div>

        {/* COMMAND CENTER: tool rail left + workspace center + history right */}
        <div className={`grid grid-cols-1 gap-3 items-start ${history.length > 0 ? "md:grid-cols-[240px_1fr_188px]" : "md:grid-cols-[240px_1fr]"}`}>

          {/* Left: vertical tool list */}
          <div className="glass-card overflow-hidden">
            <div className="px-3 pt-3 pb-1">
              <p className="text-[8px] uppercase tracking-[0.2em] text-text-muted font-semibold px-1 mb-2">Tools</p>
            </div>
            <div className="px-2 pb-3 space-y-0.5">
              {TOOLS.filter(t => toolCategory === "all" || TOOL_CATEGORIES[t.id] === toolCategory).map((tool, i) => {
                const Icon = tool.icon;
                const active = activeTool === tool.id;
                return (
                  <motion.button
                    key={tool.id}
                    initial={{ opacity: 0, x: -6 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.18, delay: i * 0.025, ease: [0.22, 1, 0.36, 1] }}
                    onClick={() => {
                      setActiveTool(tool.id);
                      setTimeout(() => toolPanelRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" }), 0);
                    }}
                    className={`relative w-full text-left flex items-center gap-2 px-2.5 py-2 rounded-xl border transition-shadow duration-200 ${
                      active
                        ? "border-[rgba(59,130,246,0.25)] shadow-[0_4px_20px_rgba(59,130,246,0.08)]"
                        : "hover:bg-white/[0.04] border-transparent hover:shadow-[0_2px_12px_rgba(0,0,0,0.20)]"
                    }`}
                  >
                    {active && (
                      <>
                        <motion.div
                          layoutId="tool-active-bg"
                          className="absolute inset-0 rounded-xl bg-[rgba(59,130,246,0.08)]"
                          transition={{ type: "spring", stiffness: 380, damping: 32 }}
                        />
                        <motion.div
                          layoutId="tool-active-accent"
                          className="absolute left-0 top-1.5 bottom-1.5 w-[2px] rounded-full bg-brand-accent"
                          transition={{ type: "spring", stiffness: 380, damping: 32 }}
                        />
                      </>
                    )}
                    <div
                      className="relative z-10 w-6 h-6 rounded-md flex items-center justify-center shrink-0"
                      style={{ background: `${tool.color}${active ? "28" : "18"}` }}
                    >
                      <Icon size={12} style={{ color: active ? "#2563EB" : tool.color }} />
                    </div>
                    <div className="relative z-10 min-w-0 flex-1">
                      <p className={`text-[11px] font-semibold leading-tight truncate ${active ? "text-brand-accent" : "text-text-primary"}`}>
                        {tool.name}
                      </p>
                      <p className="text-[8px] font-mono text-text-muted truncate">{tool.tag}</p>
                      <p className="text-[8px] text-text-muted/60 truncate leading-snug mt-0.5">{tool.desc}</p>
                    </div>
                    {"newBadge" in tool && tool.newBadge && (
                      <span className="relative z-10 text-[7px] font-semibold px-1.5 py-0.5 rounded-full bg-[rgba(59,130,246,0.1)] text-brand-accent shrink-0 uppercase tracking-wide">
                        New
                      </span>
                    )}
                    {"badge" in tool && tool.badge && (
                      <span className="relative z-10 text-[7px] font-bold px-1 py-0.5 rounded bg-[rgba(59,130,246,0.12)] text-blue-300 shrink-0">
                        Biz+
                      </span>
                    )}
                  </motion.button>
                );
              })}
            </div>
          </div>

          {/* Right: active tool workspace */}
          <div
            ref={toolPanelRef}
            className="glass relative overflow-hidden"
          >
            {/* Tool header */}
            <div className="flex items-center gap-3 px-5 py-3.5 border-b border-border-subtle">
              {(() => {
                const t = TOOLS.find(x => x.id === activeTool);
                if (!t) return null;
                const Icon = t.icon;
                return (
                  <>
                    <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0" style={{ background: `${t.color}22` }}>
                      <Icon size={14} style={{ color: t.color }} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-bold text-text-primary leading-tight">{t.name}</p>
                      <p className="text-[9px] font-mono text-text-muted">{t.tag}</p>
                      <p className="text-[9px] text-text-muted mt-0.5">
                        {t.inputLabel}{" → "}<span className="text-brand-accent/80 font-medium">{t.outputLabel}</span>
                      </p>
                    </div>
                    {"badge" in t && t.badge && (
                      <span className="text-[8px] font-bold px-2 py-0.5 rounded-full bg-[rgba(59,130,246,0.12)] text-blue-300 border border-[rgba(59,130,246,0.20)]">
                        {t.badge}
                      </span>
                    )}
                  </>
                );
              })()}
              {/* Blue tick — one chromatic moment per zone */}
              <div className="w-1 h-4 rounded-full bg-brand-accent/35 shrink-0" />
            </div>

            {/* Tool content � AnimatePresence fades panel on tool switch */}
            <AnimatePresence mode="wait">
              <motion.div
                key={activeTool}
                className="p-5"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
              >
                {activeTool === "transcribe" && <TranscribeTool processing={processing} setProcessing={setProcessing} history={history} setHistory={setHistory} />}
                {activeTool === "image-gen" && <ImageGenTool processing={processing} setProcessing={setProcessing} initial={imageGenInit} />}
                {activeTool === "upscale" && <UpscaleTool processing={processing} setProcessing={setProcessing} />}
                {activeTool === "remove-bg" && <RemoveBgTool processing={processing} setProcessing={setProcessing} />}
                {activeTool === "img-to-video" && <ImgToVideoTool processing={processing} setProcessing={setProcessing} />}
                {activeTool === "music-gen" && <MusicGenTool processing={processing} setProcessing={setProcessing} />}
                {activeTool === "voice-clone" && <VoiceCloneTool processing={processing} setProcessing={setProcessing} />}
                {activeTool === "train-lora" && <TrainLoraTool processing={processing} setProcessing={setProcessing} />}
                {activeTool === "batch-gen" && <BatchGenTool processing={processing} setProcessing={setProcessing} />}
              </motion.div>
            </AnimatePresence>
          </div>

          {/* Right: history panel � only rendered when jobs exist */}
          {history.length > 0 && (
            <motion.div
              className="glass hidden md:flex flex-col gap-2 overflow-hidden"
              initial={{ opacity: 0, x: 12 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
            >
              <div className="px-3 pt-3 pb-1 border-b border-border-subtle">
                <div className="flex items-center justify-between">
                  <p className="text-[8px] uppercase tracking-[0.2em] text-text-muted font-bold">History</p>
                  <span className="text-[8px] font-mono text-text-muted">{history.length}</span>
                </div>
              </div>
              <div className="px-2 pb-3 space-y-1.5 overflow-y-auto max-h-[640px]">
                {history.slice().reverse().map((job, i) => (
                  <motion.div
                    key={job.id}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.18, delay: i * 0.04 }}
                    className="relative rounded-xl overflow-hidden border border-border-subtle cursor-pointer hover:border-[rgba(59,130,246,0.25)] transition-all"
                    style={{ background: "rgba(19,24,39,0.60)" }}
                  >
                    {job.result && (job.type === "image-gen" || job.type === "upscale" || job.type === "remove-bg" || job.type === "img-to-video") ? (
                      <SafeThumb
                        src={job.result}
                        alt={`${job.type} result`}
                        className="w-full"
                        style={{ aspectRatio: "1/1", objectFit: "cover" }}
                        wrapperClassName="w-full"
                      />
                    ) : (
                      <div className="flex flex-col gap-1 p-2.5">
                        <div className="flex items-center gap-1.5">
                          <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${job.status === "completed" ? "bg-emerald-500" : job.status === "failed" ? "bg-red-500" : "bg-brand-accent/80 animate-pulse"}`} />
                          <span className="text-[9px] font-semibold text-text-muted truncate">{job.type}</span>
                        </div>
                        <p className="text-[8px] text-text-muted font-mono truncate">{job.status}</p>
                      </div>
                    )}
                    {/* Status overlay on visual jobs */}
                    {job.result && (
                      <div className="absolute bottom-0 left-0 right-0 px-1.5 py-1" style={{ background: "linear-gradient(transparent, rgba(13,17,32,0.92))" }}>
                        <p className="text-[7px] font-mono text-text-muted truncate">{job.type}</p>
                      </div>
                    )}
                  </motion.div>
                ))}
              </div>
            </motion.div>
          )}

        </div>
      </div>
      )}

      {/* Modals � outside the conditional so z-index is always clean */}
      <ImageCreationWizard
        open={creationWizardOpen}
        onClose={() => setCreationWizardOpen(false)}
        onComplete={(data) => {
          setActiveTool("image-gen");
          setImageGenInit({
            prompt: data.prompt,
            style: data.style,
            size: data.size,
            autoGenerateToken: Date.now(),
          });
        }}
      />
      <ImageWizard
        open={wizardOpen}
        onClose={() => {
          setWizardOpen(false);
          try { localStorage.setItem("ss-image-wizard-seen", "1"); } catch { /* ignore */ }
        }}
        onComplete={(imgs) => {
          setWizardImages(imgs.map(i => ({ url: i.url, width: i.width, height: i.height })));
          setActiveTool("image-gen");
        }}
      />
    </MotionPage>
  );
}

// -- Tool discovery grid (guided "AI Tools" tab) ------------------
// Editorial bento layout: visual hero + sized audio strip + utility pair.
// Replaces the former uniform identical-card grid.
function ToolDiscoveryGrid({ onSelect }: { onSelect: (id: ToolId) => void }) {
  // TOOLS order: transcribe[0] image-gen[1] upscale[2] remove-bg[3]
  //              img-to-video[4] music-gen[5] voice-clone[6] train-lora[7] batch-gen[8]
  const ease4 = [0.22, 1, 0.36, 1] as [number, number, number, number];

  // Build SearchAction list for ActionSearchBar quick-access
  const toolActions: SearchAction[] = TOOLS.map((t) => {
    const Icon = t.icon;
    return {
      id: t.id,
      label: t.name,
      icon: <Icon size={12} />,
      description: t.desc,
      tag: "tag" in t ? (t as { tag: string }).tag : undefined,
      onSelect: () => onSelect(t.id),
    };
  });

  // Shared onMouseMove handler for spotlight — updates CSS custom props on the element
  const spotlightMove = (e: React.MouseEvent<HTMLButtonElement>) => {
    const el = e.currentTarget;
    const rect = el.getBoundingClientRect();
    el.style.setProperty("--mx", `${e.clientX - rect.left}px`);
    el.style.setProperty("--my", `${e.clientY - rect.top}px`);
  };

  // Section label component (defined inline to keep component closure)
  const SectionLabel = ({ label, color = "#3B82F6" }: { label: string; color?: string }) => (
    <div className="flex items-center gap-2 mb-3">
      <span className="w-[3px] h-3 rounded-full inline-block" style={{ background: color }} />
      <span className="text-[9px] font-bold uppercase tracking-[0.16em] text-text-muted">{label}</span>
    </div>
  );

  // Shared small-tile for upscale / remove-bg / music-gen / voice-clone / utility
  const SmallTile = ({ tool, delay }: { tool: typeof TOOLS[number]; delay: number }) => {
    const Icon = tool.icon;
    return (
      <motion.button
        onClick={() => onSelect(tool.id)}
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.22, delay, ease: ease4 }}
        className="glass text-left p-4 rounded-2xl border border-border-subtle hover:border-[rgba(59,130,246,0.28)] hover:bg-white/[0.015] transition-all group relative overflow-hidden"
        onMouseMove={spotlightMove}
      >
        {/* 21st.dev — spotlight radial gradient tracks cursor via CSS custom props */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 rounded-[inherit] opacity-0 group-hover:opacity-100 transition-opacity duration-300"
          style={{ background: "radial-gradient(420px circle at var(--mx, 50%) var(--my, 50%), rgba(59,130,246,0.11), transparent 55%)" } as React.CSSProperties}
        />
        <div
          className="relative z-10 w-8 h-8 rounded-lg flex items-center justify-center mb-2.5 group-hover:scale-105 transition-transform duration-200"
          style={{ background: `${tool.color}1c` }}
        >
          <Icon size={14} style={{ color: tool.color }} />
        </div>
        <p className="relative z-10 text-[11px] font-bold text-text-primary mb-0.5 leading-tight">{tool.name}</p>
        <p className="relative z-10 text-[9.5px] text-text-muted leading-snug line-clamp-2">{tool.desc}</p>
        {"newBadge" in tool && tool.newBadge && (
          <span className="relative z-10 mt-2 inline-block text-[7px] font-semibold px-1.5 py-0.5 rounded-full bg-brand-accent/10 text-brand-accent uppercase tracking-wide">
            New
          </span>
        )}
        {"badge" in tool && tool.badge && (
          <span className="relative z-10 mt-2 inline-block text-[7px] font-bold px-1.5 py-0.5 rounded bg-[rgba(59,130,246,0.12)] text-blue-300">
            {tool.badge}
          </span>
        )}
      </motion.button>
    );
  };

  // Visual tools (indices 1-4): image-gen upscale remove-bg img-to-video
  const imageGen   = TOOLS[1];
  const upscale    = TOOLS[2];
  const removeBg   = TOOLS[3];
  const imgToVideo = TOOLS[4];
  // Audio tools (indices 0, 5, 6): transcribe music-gen voice-clone
  const transcribe = TOOLS[0];
  const musicGen   = TOOLS[5];
  const voiceClone = TOOLS[6];
  // Utility tools (indices 7-8): train-lora batch-gen
  const trainLora  = TOOLS[7];
  const batchGen   = TOOLS[8];

  const ImageGenIcon   = imageGen.icon;
  const ImgToVideoIcon = imgToVideo.icon;
  const TranscribeIcon = transcribe.icon;

  return (
    <div className="space-y-6">

      {/* ── Tool Quick-Access Search (21st.dev ActionSearchBar) ── */}
      <ActionSearchBar
        actions={toolActions}
        placeholder="Quick-access a tool..."
        className="max-w-xs"
      />

      {/* ── Visual Tools ──────────────────────────────────────── */}
      <div>
        <SectionLabel label="Visual" />
        {/*
          4-col grid, 2 rows:
            col 1-2 row 1-2 → image-gen HERO
            col 3   row 1   → upscale
            col 4   row 1   → remove-bg
            col 3-4 row 2   → img-to-video (wide horizontal)
        */}
        <div className="grid grid-cols-4 grid-rows-2 gap-3">
          {/* image-gen: hero tile — col-span-2 row-span-2 */}
          <motion.button
            onClick={() => onSelect(imageGen.id)}
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.28, ease: ease4 }}
            className="col-span-2 row-span-2 glass text-left p-5 rounded-2xl border border-border-subtle
              hover:border-[rgba(59,130,246,0.32)] transition-all group relative overflow-hidden"
            onMouseMove={spotlightMove}
          >
            {/* 21st.dev — spotlight on hero tile */}
            <div
              aria-hidden
              className="pointer-events-none absolute -inset-px rounded-[inherit] opacity-0 group-hover:opacity-100 transition-opacity duration-300"
              style={{ background: "radial-gradient(600px circle at var(--mx, 50%) var(--my, 50%), rgba(59,130,246,0.10), transparent 45%)" } as React.CSSProperties}
            />
            {/* Subtle directional wash */}
            <div className="absolute inset-0 bg-gradient-to-br from-brand-accent/[0.055] to-transparent pointer-events-none rounded-2xl" />
            <div className="relative z-10 flex flex-col h-full">
              <div className="flex items-start justify-between mb-4">
                <div
                  className="w-12 h-12 rounded-xl flex items-center justify-center group-hover:scale-105 transition-transform duration-200"
                  style={{ background: `${imageGen.color}20` }}
                >
                  <ImageGenIcon size={22} style={{ color: imageGen.color }} />
                </div>
                <span className="text-[8px] font-mono text-text-muted/60 bg-white/[0.04] px-1.5 py-0.5 rounded">
                  {imageGen.tag}
                </span>
              </div>
              <p className="font-display text-[17px] font-bold tracking-tight text-text-primary mb-1 leading-tight">
                {imageGen.name}
              </p>
              <p className="text-[11px] text-text-muted leading-relaxed flex-1">{imageGen.desc}</p>
              <div className="mt-4 flex items-center gap-1.5 flex-wrap">
                <span className="text-[8px] px-1.5 py-0.5 rounded bg-white/[0.05] text-text-muted font-mono">
                  {imageGen.inputLabel}
                </span>
                <span className="text-[8px] text-text-muted">→</span>
                <span className="text-[8px] px-1.5 py-0.5 rounded bg-brand-accent/10 text-brand-accent/80 font-mono">
                  {imageGen.outputLabel}
                </span>
              </div>
            </div>
          </motion.button>

          {/* upscale: col 3 row 1 */}
          <SmallTile tool={upscale} delay={0.05} />

          {/* remove-bg: col 4 row 1 */}
          <SmallTile tool={removeBg} delay={0.1} />

          {/* img-to-video: col 3-4 row 2 (wide horizontal) */}
          <motion.button
            onClick={() => onSelect(imgToVideo.id)}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.22, delay: 0.15, ease: ease4 }}
            className="col-span-2 glass text-left p-4 rounded-2xl border border-border-subtle
              hover:border-[rgba(59,130,246,0.28)] hover:bg-white/[0.015] transition-all group flex items-center gap-3 relative overflow-hidden"
            onMouseMove={spotlightMove}
          >
            <div aria-hidden className="pointer-events-none absolute inset-0 rounded-[inherit] opacity-0 group-hover:opacity-100 transition-opacity duration-300" style={{ background: "radial-gradient(380px circle at var(--mx, 50%) var(--my, 50%), rgba(59,130,246,0.10), transparent 55%)" } as React.CSSProperties} />
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform duration-200"
              style={{ background: `${imgToVideo.color}1c` }}
            >
              <ImgToVideoIcon size={16} style={{ color: imgToVideo.color }} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[12px] font-bold text-text-primary mb-0.5 leading-tight">{imgToVideo.name}</p>
              <p className="text-[9.5px] text-text-muted truncate">{imgToVideo.desc}</p>
            </div>
            <span className="shrink-0 text-[8px] px-1.5 py-0.5 rounded bg-brand-accent/10 text-brand-accent/80 font-mono whitespace-nowrap">
              {imgToVideo.outputLabel}
            </span>
          </motion.button>
        </div>
      </div>

      {/* ── Audio Tools ───────────────────────────────────────── */}
      <div>
        <SectionLabel label="Audio" color="#1D4ED8" />
        {/* 3-col fractional grid: transcribe gets more width */}
        <div className="grid gap-3" style={{ gridTemplateColumns: "5fr 3fr 3fr" }}>
          {/* transcribe: wider with waveform decoration */}
          <motion.button
            onClick={() => onSelect(transcribe.id)}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.22, delay: 0.06, ease: ease4 }}
            className="glass text-left p-4 rounded-2xl border border-border-subtle
              hover:border-[rgba(59,130,246,0.28)] hover:bg-white/[0.015] transition-all group relative overflow-hidden"
            onMouseMove={spotlightMove}
          >
            <div aria-hidden className="pointer-events-none absolute inset-0 rounded-[inherit] opacity-0 group-hover:opacity-100 transition-opacity duration-300"
              style={{ background: "radial-gradient(380px circle at var(--mx, 50%) var(--my, 50%), rgba(59,130,246,0.10), transparent 55%)" } as React.CSSProperties} />
            {/* Decorative waveform bars — bottom-right, low opacity */}
            <div className="absolute bottom-3 right-3 pointer-events-none opacity-[0.09]">
              <svg width="52" height="18" viewBox="0 0 52 18" fill="none">
                {[3, 7, 11, 16, 10, 14, 6, 13, 9, 8, 15, 11, 4, 8, 13].map((h, i) => (
                  <rect
                    key={i}
                    x={i * 3.4 + 0.3}
                    y={(18 - h) / 2}
                    width="2"
                    height={h}
                    rx="1"
                    fill="#3B82F6"
                  />
                ))}
              </svg>
            </div>
            <div className="relative z-10">
              <div
                className="w-9 h-9 rounded-xl flex items-center justify-center mb-3 group-hover:scale-105 transition-transform duration-200"
                style={{ background: `${transcribe.color}1c` }}
              >
                <TranscribeIcon size={15} style={{ color: transcribe.color }} />
              </div>
              <p className="text-[12px] font-bold text-text-primary mb-0.5 leading-tight">{transcribe.name}</p>
              <p className="text-[9.5px] text-text-muted leading-snug mb-3">{transcribe.desc}</p>
              <div className="flex items-center gap-1 flex-wrap">
                <span className="text-[8px] px-1.5 py-0.5 rounded bg-white/[0.05] text-text-muted font-mono">
                  {transcribe.inputLabel}
                </span>
                <span className="text-[8px] text-text-muted">→</span>
                <span className="text-[8px] px-1.5 py-0.5 rounded bg-brand-accent/10 text-brand-accent/80 font-mono">
                  {transcribe.outputLabel}
                </span>
              </div>
            </div>
          </motion.button>

          <SmallTile tool={musicGen} delay={0.11} />
          <SmallTile tool={voiceClone} delay={0.16} />
        </div>
      </div>

      {/* ── Utility Tools ─────────────────────────────────────── */}
      <div>
        <SectionLabel label="Utility" color="#475569" />
        <div className="grid grid-cols-2 gap-3">
          <SmallTile tool={trainLora} delay={0.08} />
          <SmallTile tool={batchGen} delay={0.13} />
        </div>
      </div>

    </div>
  );
}

// -- Shared types for tool props ----------------------------------
interface ToolProps {
  processing: boolean;
  setProcessing: (v: boolean) => void;
  history?: JobResult[];
  setHistory?: (v: JobResult[]) => void;
}

// -- TRANSCRIBE TOOL ----------------------------------------------
function TranscribeTool({ processing, setProcessing }: ToolProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [language, setLanguage] = useState("auto");
  const [transcript, setTranscript] = useState<string | null>(null);
  const [segments, setSegments] = useState<{ start: number; end: number; text: string }[]>([]);

  const handleTranscribe = async () => {
    if (!file) return toast.error("Upload an audio/video file first");
    setProcessing(true);
    setTranscript(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("language", language);
      const res = await fetch("/api/ai-studio/transcribe", { method: "POST", body: fd });
      const data = await res.json();
      if (data.text) {
        setTranscript(data.text);
        setSegments(data.segments || []);
        toast.success("Transcription complete");
      } else if (data.job_id) {
        toast.success("Processing... check back in a moment");
      } else if (res.status === 501 || data?.error === "setup_required") {
        // Apr 28 audit: AI Studio routes 501 when no provider env is
        // configured (RUNPOD / REPLICATE / OPENAI). Surface a real CTA
        // instead of a generic "Failed" toast.
        toast(
          (t) => (
            <span>
              Transcription provider isn't configured.{" "}
              <a
                href="/dashboard/integrations-hub"
                className="underline font-medium"
                onClick={() => toast.dismiss(t.id)}
              >
                Set it up
              </a>
            </span>
          ),
          { icon: "??", duration: 8000 }
        );
      } else {
        toast.error(data.error || "Failed");
      }
    } catch (err) {
      console.error("[ai-studio/transcribe] failed:", err);
      toast.error("Transcription failed");
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div>
      <motion.div
        className="flex items-center gap-2 mb-4"
        initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.22 }}
      >
        <Mic size={16} className="text-brand-accent" />
        <h2 className="text-sm font-bold text-text-primary">Speech to Text</h2>
        <span className="text-[9px] bg-brand-accent/10 text-brand-accent px-2 py-0.5 rounded-full">Whisper Large V3</span>
      </motion.div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Input */}
        <div>
          <div
            onClick={() => fileRef.current?.click()}
            className="border-2 border-dashed border-border-subtle rounded-xl p-8 text-center cursor-pointer hover:border-brand-accent/30 hover:bg-brand-accent/[0.02] transition-all"
          >
            <input ref={fileRef} type="file" accept="audio/*,video/*" className="hidden" onChange={e => setFile(e.target.files?.[0] || null)} />
            <Upload size={24} className="mx-auto mb-2 text-text-muted" />
            <p className="text-xs text-text-primary font-medium">{file ? file.name : "Drop audio/video file"}</p>
            <p className="text-[10px] text-text-muted mt-1">MP3, WAV, MP4, WebM, M4A, OGG, FLAC</p>
          </div>

          <div className="flex items-center gap-3 mt-3">
            <select value={language} onChange={e => setLanguage(e.target.value)}
              className="flex-1 text-xs bg-surface-light border border-border-subtle rounded-lg px-3 py-2 text-text-primary">
              <option value="auto">Auto-detect language</option>
              <option value="en">English</option>
              <option value="es">Spanish</option>
              <option value="fr">French</option>
              <option value="de">German</option>
              <option value="da">Danish</option>
              <option value="no">Norwegian</option>
              <option value="sv">Swedish</option>
              <option value="ja">Japanese</option>
              <option value="zh">Chinese</option>
              <option value="pt">Portuguese</option>
              <option value="ar">Arabic</option>
            </select>
            <motion.button onClick={handleTranscribe} disabled={processing || !file}
              whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
              className="btn-pill text-xs flex items-center gap-1.5">
              {processing ? <Loader size={12} className="animate-spin" /> : <Play size={12} />}
              Transcribe
            </motion.button>
          </div>
        </div>

        {/* Output */}
        <motion.div
          className="rounded-xl p-4 min-h-[200px]"

          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.22, delay: 0.08 }}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-text-primary">Transcript</span>
            {transcript && (
              <div className="flex items-center gap-2">
                <button onClick={() => { navigator.clipboard.writeText(transcript); toast.success("Copied"); }}
                  className="text-[10px] text-text-muted hover:text-text-primary flex items-center gap-1">
                  <Copy size={10} /> Copy
                </button>
                <button
                  onClick={() => toast.success("Saved to library")}
                  className="text-[10px] text-brand-accent/70 hover:text-brand-accent flex items-center gap-1 border border-[rgba(59,130,246,0.20)] px-1.5 py-0.5 rounded"
                >
                  <Download size={10} /> Save to Library
                </button>
              </div>
            )}
          </div>
          {transcript ? (
            <div className="space-y-2">
              <p className="text-xs text-text-primary leading-relaxed whitespace-pre-wrap">{transcript}</p>
              {segments.length > 0 && (
                <div className="mt-3 pt-3 border-t border-border-subtle">
                  <p className="text-[10px] font-semibold text-text-muted mb-2">Timestamps</p>
                  <div className="space-y-1 max-h-[200px] overflow-y-auto">
                    {segments.slice(0, 20).map((seg, i) => (
                      <div key={i} className="flex gap-2 text-[10px]">
                        <span className="text-text-muted font-mono shrink-0">{formatTime(seg.start)}</span>
                        <span className="text-text-primary">{seg.text}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <p className="text-xs text-text-muted">Upload a file and click Transcribe to get started.</p>
          )}
        </motion.div>
      </div>
    </div>
  );
}

// -- GUIDED IMAGE PANEL -------------------------------------------
// Higgsfield-style: controls left, preview + history right
function GuidedImagePanel({ processing, setProcessing, history, setHistory }: ToolProps) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [prompt, setPrompt] = useState("");
  const [style, setStyle] = useState("");
  const [size, setSize] = useState("1024x1024");
  const [images, setImages] = useState<string[]>([]);
  const [historySearch, setHistorySearch] = useState("");
  const [expandedSection, setExpandedSection] = useState<"style" | "aspect" | null>(null);
  const [liked, setLiked] = useState<Record<string, boolean>>({});
  const [handoffingIdx, setHandoffingIdx] = useState<number | null>(null);

  const panelStyles = [
    { value: "", label: "None" },
    { value: "photorealistic", label: "Photorealistic" },
    { value: "modern", label: "Modern" },
    { value: "minimalist", label: "Minimalist" },
    { value: "bold", label: "Bold" },
    { value: "luxury", label: "Luxury" },
    { value: "dark", label: "Dark" },
    { value: "vintage", label: "Vintage" },
    { value: "playful", label: "Playful" },
  ];

  const panelSizes = [
    { value: "1024x1024", label: "Square 1:1" },
    { value: "1024x1792", label: "Portrait 9:16" },
    { value: "1792x1024", label: "Landscape 16:9" },
    { value: "768x1024", label: "Portrait 3:4" },
  ];

  const runGenerate = async () => {
    if (!prompt.trim()) return toast.error("Enter a prompt first");
    setProcessing(true);
    setImages([]);
    try {
      const [w, h] = size.split("x").map(Number);
      const res = await fetch("/api/ai-studio/image-gen", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, width: w, height: h, style: style || undefined }),
      });
      const data = await res.json();
      if (data.images) {
        setImages(data.images);
        if (setHistory) {
          const newJobs: JobResult[] = data.images.map((url: string, i: number) => ({
            id: `guided-${Date.now()}-${i}`,
            type: "image-gen" as const,
            status: "completed" as const,
            result: url,
            timestamp: new Date(),
            meta: { prompt, style, size },
          }));
          setHistory([...(history ?? []), ...newJobs]);
        }
        toast.success(`Generated ${data.images.length} image(s)`);
      } else if (data.error === "setup_required") {
        toast.error("Image generation not configured");
      } else {
        toast.error(data.error || "Generation failed");
      }
    } catch (err) {
      console.error("[guided-image-panel] failed:", err);
      toast.error("Generation failed");
    } finally {
      setProcessing(false);
    }
  };

  const filteredHistory = (history ?? []).filter(j =>
    j.type === "image-gen" && j.status === "completed" && j.result &&
    (historySearch === "" || (j.meta?.prompt as string | undefined)?.toLowerCase().includes(historySearch.toLowerCase()))
  );

  return (
    <div className="flex gap-4 items-stretch min-h-[560px]">
      {/* ---- LEFT: Controls sidebar ---- */}
      <div className="w-[256px] shrink-0 flex flex-col gap-3">
        {/* Orb + title */}
        <div
          className="relative flex flex-col items-center pt-6 pb-4 rounded-2xl overflow-hidden"
          style={{ background: "rgba(59,130,246,0.06)", border: "1px solid rgba(59,130,246,0.15)" }}
        >
          <div
            className="w-20 h-20 rounded-full mb-3 shrink-0"
            style={{
              background: "radial-gradient(circle at 35% 30%, #BFDBFE 0%, #60A5FA 35%, #2563EB 65%, #1e3a8a 100%)",
              boxShadow: "0 0 32px rgba(59,130,246,0.40), 0 0 64px rgba(59,130,246,0.15)",
            }}
          />
          <p className="text-sm font-bold text-text-primary font-display">AI Image Generation</p>
          <p className="text-[10px] text-text-muted mt-0.5">Smart Creativity Starts Here</p>
        </div>

        {/* Prompt */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label className="text-[10px] font-semibold text-text-secondary uppercase tracking-wide">Describe your image</label>
            <button
              onClick={() => {
                if (!prompt.trim()) {
                  const suggestions = [
                    "A minimalist product mockup on white marble, studio lighting",
                    "A futuristic city skyline at dusk with neon reflections",
                    "A cozy coffee shop interior with warm lighting and bokeh",
                  ];
                  setPrompt(suggestions[Math.floor(Math.random() * suggestions.length)]);
                }
              }}
              className="text-[10px] text-blue-400 hover:text-blue-300 hover:underline font-medium transition-colors"
            >
              Suggest
            </button>
          </div>
          <AIPromptBox
            defaultValue={prompt}
            onChange={setPrompt}
            onSubmit={async (p) => { setPrompt(p); await runGenerate(); }}
            placeholder="A minimalist logo mockup on black marble, studio lighting..."
            loading={processing}
            modelLabel="FLUX / DALL-E"
            suggestions={["Minimalist product shot", "City skyline at dusk", "Studio portrait"]}
            maxRows={4}
          />
        </div>

        {/* Style accordion */}
        <div className="rounded-xl overflow-hidden" style={{ border: "1px solid rgba(59,130,246,0.12)", background: "rgba(19,24,39,0.60)" }}>
          <button
            onClick={() => setExpandedSection(expandedSection === "style" ? null : "style")}
            className="w-full flex items-center justify-between px-3 py-2.5 text-[11px] font-semibold text-text-secondary hover:bg-white/[0.04] transition-colors"
          >
            <span>Style{style ? ` — ${panelStyles.find(s => s.value === style)?.label}` : ""}</span>
            <ChevronDown size={12} className={`transition-transform ${expandedSection === "style" ? "rotate-180" : ""}`} />
          </button>
          <AnimatePresence>
            {expandedSection === "style" && (
              <motion.div
                initial={{ height: 0 }} animate={{ height: "auto" }} exit={{ height: 0 }}
                transition={{ duration: 0.18 }}
                className="overflow-hidden"
              >
                <div className="px-3 pb-3 flex flex-wrap gap-1.5">
                  {panelStyles.map(s => (
                    <button
                      key={s.value}
                      onClick={() => { setStyle(s.value); setExpandedSection(null); }}
                      className={`text-[10px] px-2 py-1 rounded-lg transition-all ${
                        style === s.value
                          ? "bg-blue-500/80 text-white font-semibold"
                          : "bg-white/[0.06] text-text-muted hover:bg-white/[0.10] hover:text-text-secondary"
                      }`}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Aspect ratio accordion */}
        <div className="rounded-xl overflow-hidden" style={{ border: "1px solid rgba(59,130,246,0.12)", background: "rgba(19,24,39,0.60)" }}>
          <button
            onClick={() => setExpandedSection(expandedSection === "aspect" ? null : "aspect")}
            className="w-full flex items-center justify-between px-3 py-2.5 text-[11px] font-semibold text-text-secondary hover:bg-white/[0.04] transition-colors"
          >
            <span>Aspect Ratio — {panelSizes.find(s => s.value === size)?.label}</span>
            <ChevronDown size={12} className={`transition-transform ${expandedSection === "aspect" ? "rotate-180" : ""}`} />
          </button>
          <AnimatePresence>
            {expandedSection === "aspect" && (
              <motion.div
                initial={{ height: 0 }} animate={{ height: "auto" }} exit={{ height: 0 }}
                transition={{ duration: 0.18 }}
                className="overflow-hidden"
              >
                <div className="px-3 pb-3 space-y-1">
                  {panelSizes.map(s => (
                    <button
                      key={s.value}
                      onClick={() => { setSize(s.value); setExpandedSection(null); }}
                      className={`w-full text-left text-[11px] px-2 py-1.5 rounded-lg transition-all ${
                        size === s.value
                          ? "bg-blue-500/80 text-white font-semibold"
                          : "hover:bg-white/[0.04] text-text-secondary"
                      }`}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Generate */}
        <motion.button
          onClick={runGenerate}
          disabled={processing || !prompt.trim()}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          className="btn-pill w-full text-xs flex items-center justify-center gap-2"
          style={{ boxShadow: "0 0 20px rgba(59,130,246,0.22)" }}
        >
          {processing ? <Loader size={13} className="animate-spin" /> : <Sparkles size={13} />}
          {processing ? "Generating..." : "Generate Image"}
        </motion.button>
      </div>

      {/* ---- CENTER: Cinematic preview canvas ---- */}
      <div
        className="flex-1 min-w-0 relative rounded-2xl overflow-hidden flex items-center justify-center"
        style={{
          background: "linear-gradient(160deg, #080B14 0%, #0A0E1A 60%, #0D1120 100%)",
          border: "1px solid rgba(59,130,246,0.12)",
          minHeight: 520,
        }}
      >
        {/* Ambient orbs */}
        <div className="pointer-events-none absolute -top-16 -right-16 w-64 h-64 rounded-full opacity-15"
          style={{ background: "radial-gradient(circle, #60A5FA 0%, transparent 70%)" }} />
        <div className="pointer-events-none absolute -bottom-12 -left-12 w-48 h-48 rounded-full opacity-10"
          style={{ background: "radial-gradient(circle, #818CF8 0%, transparent 70%)" }} />
        {/* Subtle grid texture for depth */}
        <div className="pointer-events-none absolute inset-0 opacity-[0.025]"
          style={{ backgroundImage: "linear-gradient(rgba(148,163,184,0.6) 1px, transparent 1px), linear-gradient(90deg, rgba(148,163,184,0.6) 1px, transparent 1px)", backgroundSize: "48px 48px" }} />

        {processing ? (
          <div className="flex flex-col items-center gap-4 relative z-10">
            <div className="relative w-16 h-16">
              <div className="absolute inset-0 rounded-full"
                style={{ background: "rgba(59,130,246,0.12)", boxShadow: "0 0 40px rgba(59,130,246,0.20)" }} />
              <Loader size={26} className="text-blue-400 animate-spin absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
            </div>
            <div className="text-center">
              <p className="text-sm font-semibold text-text-primary">Generating your image</p>
              <p className="text-xs text-text-muted mt-1">Usually takes about 10 seconds</p>
            </div>
            <div className="w-40 h-[3px] rounded-full overflow-hidden bg-white/[0.06]">
              <motion.div
                className="h-full rounded-full bg-blue-500"
                animate={{ x: ["-100%", "200%"] }}
                transition={{ duration: 1.4, repeat: Infinity, ease: "easeInOut" }}
              />
            </div>
          </div>
        ) : images.length > 0 ? (
          <div className="relative w-full h-full flex items-center justify-center p-6">
            <motion.div
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.28 }}
              className="relative inline-block"
            >
              <SafeThumb
                src={images[0]}
                alt="Generated image"
                className="max-h-[460px] max-w-full rounded-2xl object-contain shadow-[0_8px_48px_rgba(0,0,0,0.60)]"
                wrapperClassName="inline-block"
              />
              {/* Glow beneath image */}
              <div className="absolute -bottom-4 left-1/2 -translate-x-1/2 w-3/4 h-8 rounded-full blur-xl opacity-25"
                style={{ background: "rgba(59,130,246,0.5)" }} />
            </motion.div>

            {/* Overlay action buttons — top right */}
            <div className="absolute top-4 right-4 flex items-center gap-1.5">
              <button
                onClick={() => setLiked(prev => ({ ...prev, [images[0]]: !prev[images[0]] }))}
                className="w-9 h-9 rounded-xl flex items-center justify-center transition-all hover:scale-105 active:scale-95"
                style={{
                  background: liked[images[0]] ? "rgba(239,68,68,0.20)" : "rgba(19,24,39,0.85)",
                  backdropFilter: "blur(12px)",
                  border: `1px solid ${liked[images[0]] ? "rgba(239,68,68,0.30)" : "rgba(59,130,246,0.18)"}`,
                }}
              >
                <Heart size={14} className={liked[images[0]] ? "text-red-400 fill-red-400" : "text-text-muted"} />
              </button>
              <a
                href={images[0]}
                download="generated.png"
                target="_blank"
                rel="noopener noreferrer"
                className="w-9 h-9 rounded-xl flex items-center justify-center transition-all hover:scale-105 active:scale-95"
                style={{ background: "rgba(19,24,39,0.85)", backdropFilter: "blur(12px)", border: "1px solid rgba(59,130,246,0.18)" }}
              >
                <Download size={14} className="text-text-muted" />
              </a>
              <button
                disabled={handoffingIdx === 0}
                onClick={async () => {
                  setHandoffingIdx(0);
                  try {
                    const id = await createHandoff(supabase, { imageUrl: images[0], prompt, style, size });
                    router.push(handoffUrl(id, "/dashboard/ai-studio"));
                  } catch (err) {
                    toast.error(err instanceof Error ? err.message : "Handoff failed");
                  } finally {
                    setHandoffingIdx(null);
                  }
                }}
                className="w-9 h-9 rounded-xl flex items-center justify-center transition-all hover:scale-105 active:scale-95"
                style={{ background: "rgba(19,24,39,0.85)", backdropFilter: "blur(12px)", border: "1px solid rgba(59,130,246,0.18)" }}
              >
                {handoffingIdx === 0
                  ? <Loader2 size={14} className="text-text-muted animate-spin" />
                  : <MoreHorizontal size={14} className="text-text-muted" />
                }
              </button>
            </div>

            {/* Prompt caption — bottom */}
            <div className="absolute bottom-4 left-4 right-4">
              <div className="px-3 py-2 rounded-xl text-[10px] text-text-muted truncate"
                style={{ background: "rgba(13,17,32,0.82)", backdropFilter: "blur(8px)", border: "1px solid rgba(59,130,246,0.10)" }}>
                {prompt}
              </div>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-4 opacity-50 relative z-10">
            <div className="w-20 h-20 rounded-3xl flex items-center justify-center"
              style={{ background: "rgba(59,130,246,0.08)", border: "1px solid rgba(59,130,246,0.12)" }}>
              <ImagePlus size={32} className="text-blue-400" />
            </div>
            <div className="text-center">
              <p className="text-base font-semibold text-text-secondary">Your image will appear here</p>
              <p className="text-xs text-text-muted mt-1">Describe something creative and hit Generate</p>
            </div>
          </div>
        )}
      </div>

      {/* ---- RIGHT: History strip ---- */}
      {filteredHistory.length > 0 && (
        <div className="w-[176px] shrink-0 flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <h3 className="text-[10px] font-semibold text-text-secondary uppercase tracking-wider">History</h3>
          </div>
          <div className="relative">
            <Search size={10} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none" />
            <input
              value={historySearch}
              onChange={e => setHistorySearch(e.target.value)}
              placeholder="Search..."
              className="w-full pl-7 pr-3 py-1.5 text-[10px] rounded-lg focus:outline-none focus:border-blue-500/30 transition-colors"
              style={{ background: "rgba(19,24,39,0.70)", border: "1px solid rgba(59,130,246,0.12)", color: "var(--text-secondary)" }}
            />
          </div>
          <div className="grid grid-cols-2 gap-1.5 overflow-y-auto">
            {filteredHistory.slice(0, 12).map(j => (
              <motion.div
                key={j.id}
                initial={{ opacity: 0, scale: 0.90 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.16 }}
                className="aspect-square rounded-lg overflow-hidden relative group cursor-pointer"
                onClick={() => { if (j.result) setImages([j.result]); }}
                style={{ border: "1px solid rgba(59,130,246,0.08)" }}
              >
                <SafeThumb
                  src={j.result!}
                  alt="History thumbnail"
                  className="w-full h-full object-cover"
                  wrapperClassName="w-full h-full"
                />
                <div className="absolute inset-0 bg-blue-500/0 group-hover:bg-blue-500/15 transition-colors rounded-lg" />
              </motion.div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}


// -- IMAGE GEN TOOL ----------------------------------------------
interface ImageGenInit {
  prompt?: string;
  style?: string;
  size?: string;
  autoGenerateToken?: number;
}

function ImageGenTool({ processing, setProcessing, initial }: ToolProps & { initial?: ImageGenInit }) {
  const router = useRouter();
  const { profile } = useAuth();
  const isPlatformAdmin = profile?.role === "admin" || profile?.role === "founder";
  const supabase = useMemo(() => createClient(), []);
  const [handoffingIdx, setHandoffingIdx] = useState<number | null>(null);
  const [prompt, setPrompt] = useState(initial?.prompt || "");
  const [style, setStyle] = useState(initial?.style || "");
  const [size, setSize] = useState(initial?.size || "1024x1024");
  const [images, setImages] = useState<string[]>([]);
  const [setupRequired, setSetupRequired] = useState(false);
  const lastAutoRef = useRef<number | undefined>(undefined);
  // Ref so the auto-generate effect can call the latest generate handler
  // with explicit overrides (avoids stale state after setState in same tick).
  const runGenerateRef = useRef<((o?: { prompt?: string; style?: string; size?: string }) => void) | null>(null);

  // Sync incoming initial from wizard � overwrite current values and auto-run
  useEffect(() => {
    if (!initial) return;
    if (initial.prompt !== undefined) setPrompt(initial.prompt);
    if (initial.style !== undefined) setStyle(initial.style);
    if (initial.size !== undefined) setSize(initial.size);
    if (
      initial.autoGenerateToken &&
      initial.autoGenerateToken !== lastAutoRef.current &&
      initial.prompt?.trim()
    ) {
      lastAutoRef.current = initial.autoGenerateToken;
      // Fire immediately with explicit overrides so we don't race the setState.
      runGenerateRef.current?.({
        prompt: initial.prompt,
        style: initial.style,
        size: initial.size,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initial?.prompt, initial?.style, initial?.size, initial?.autoGenerateToken]);

  const styles = [
    { value: "", label: "None" },
    { value: "photorealistic", label: "Photo" },
    { value: "modern", label: "Modern" },
    { value: "minimalist", label: "Minimal" },
    { value: "bold", label: "Bold" },
    { value: "luxury", label: "Luxury" },
    { value: "dark", label: "Dark" },
    { value: "vintage", label: "Vintage" },
    { value: "playful", label: "Playful" },
  ];

  const sizes = [
    { value: "1024x1024", label: "1:1" },
    { value: "1024x1792", label: "9:16" },
    { value: "1792x1024", label: "16:9" },
    { value: "768x1024", label: "3:4" },
  ];

  const runGenerate = async (override?: { prompt?: string; style?: string; size?: string }) => {
    const usePrompt = override?.prompt ?? prompt;
    const useStyle = override?.style ?? style;
    const useSize = override?.size ?? size;
    if (!usePrompt.trim()) return toast.error("Enter a prompt");
    setProcessing(true);
    setImages([]);
    setSetupRequired(false);
    try {
      const [w, h] = useSize.split("x").map(Number);
      const res = await fetch("/api/ai-studio/image-gen", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: usePrompt,
          width: w,
          height: h,
          style: useStyle || undefined,
        }),
      });
      const data = await res.json();
      if (data.images) {
        setImages(data.images);
        toast.success(`Generated ${data.images.length} image(s)`);
      } else if (data.job_id) {
        toast.success("Generating... check back in a moment");
      } else if (data.error === "setup_required") {
        setSetupRequired(true);
        toast.error("API key not configured");
      } else {
        toast.error(data.error || "Generation failed");
      }
    } catch (err) {
      console.error("[ai-studio/image-gen] failed:", err);
      toast.error("Generation failed");
    } finally {
      setProcessing(false);
    }
  };

  const handleGenerate = () => runGenerate();

  // Keep ref up to date so the auto-run effect can call the latest handler
  runGenerateRef.current = runGenerate;

  return (
    <div>
      <motion.div
        className="flex items-center gap-2 mb-4"
        initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.22 }}
      >
        <Palette size={16} className="text-brand-accent" />
        <h2 className="text-sm font-bold text-text-primary">Image Generator</h2>
        <span className="text-[9px] bg-brand-accent/10 text-brand-accent px-2 py-0.5 rounded-full">FLUX / DALL-E</span>
      </motion.div>

      {setupRequired && (
        <div className="mb-4 p-3 rounded-xl border border-yellow-500/20 bg-yellow-500/5 flex items-start gap-2">
          <AlertTriangle size={14} className="text-yellow-400 mt-0.5 shrink-0" />
          <div>
            <p className="text-xs font-medium text-yellow-400">Setup Required</p>
            <p className="text-[10px] text-text-muted mt-0.5">
              {isPlatformAdmin
                ? "Configure REPLICATE_API_TOKEN, RUNPOD_API_KEY, or OPENAI_API_KEY in your environment to enable image generation."
                : "Image generation isn't enabled on this workspace yet. Reach out to your platform admin to switch it on."}
            </p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-3">
          <AIPromptBox
            defaultValue={prompt}
            onChange={setPrompt}
            onSubmit={async (p) => { setPrompt(p); await runGenerate({ prompt: p }); }}
            placeholder="Describe the image you want to create… e.g. 'A modern tech startup office with warm lighting'"
            loading={processing}
            modelLabel="FLUX / DALL-E"
            suggestions={["Minimalist product shot on marble", "City skyline at golden hour", "Studio portrait, soft light"]}
            maxRows={4}
          />

          <div>
            <span className="text-[10px] text-text-muted mb-1 block">Style</span>
            <div className="flex flex-wrap gap-1.5">
              {styles.map(s => (
                <button key={s.value} onClick={() => setStyle(s.value)}
                  className={`text-[10px] px-2.5 py-1 rounded-lg ${
                    style === s.value
                      ? "bg-brand-accent text-white font-semibold"
                      : "bg-surface-light text-text-muted"
                  }`}>{s.label}</button>
              ))}
            </div>
          </div>

          <div>
            <span className="text-[10px] text-text-muted mb-1 block">Aspect Ratio</span>
            <div className="flex gap-1.5">
              {sizes.map(s => (
                <button key={s.value} onClick={() => setSize(s.value)}
                  className={`text-[10px] px-2.5 py-1 rounded-lg ${
                    size === s.value
                      ? "bg-brand-accent text-white font-semibold"
                      : "bg-surface-light text-text-muted"
                  }`}>{s.label}</button>
              ))}
            </div>
          </div>

          <motion.button onClick={handleGenerate} disabled={processing || !prompt.trim()}
            whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
            className="btn-pill w-full text-xs flex items-center justify-center gap-1.5">
            {processing ? <Loader size={12} className="animate-spin" /> : <Sparkles size={12} />}
            Generate Image
          </motion.button>
        </div>

        <motion.div
          className="rounded-xl p-4 min-h-[200px] flex items-center justify-center"

          initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.22, delay: 0.08 }}
        >
          {images.length > 0 ? (
            <div className="text-center space-y-2">
              {images.map((img, i) => (
                <div key={i}>
                  <SafeThumb
                    src={img}
                    alt={`Generated ${i + 1}`}
                    className="max-h-[300px] mx-auto rounded-lg"
                    wrapperClassName="inline-block"
                  />
                  <div className="flex items-center justify-center gap-3 mt-1">
                    <a href={img} target="_blank" rel="noopener noreferrer" download={`generated-${i + 1}.png`}
                      className="inline-flex items-center gap-1 text-[10px] text-brand-accent hover:underline">
                      <Download size={10} /> Download
                    </a>
                    <button
                      disabled={handoffingIdx === i}
                      onClick={async () => {
                        setHandoffingIdx(i);
                        try {
                          const id = await createHandoff(supabase, {
                            imageUrl: img,
                            prompt,
                            style,
                            size,
                          });
                          router.push(handoffUrl(id, "/dashboard/ai-studio"));
                        } catch (err) {
                          toast.error(err instanceof Error ? err.message : "Handoff failed");
                        } finally {
                          setHandoffingIdx(null);
                        }
                      }}
                      className="inline-flex items-center gap-1 text-[10px] text-brand-accent hover:underline disabled:opacity-40"
                    >
                      {handoffingIdx === i
                        ? <Loader2 size={10} className="animate-spin" />
                        : <Edit3 size={10} />}
                      Open in Studio
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center">
              <Palette size={32} className="mx-auto mb-2 text-text-muted/30" />
              <p className="text-xs text-text-muted">Generated image will appear here</p>
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
}

// -- UPSCALE TOOL -------------------------------------------------
function UpscaleTool({ processing, setProcessing }: ToolProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);
  const [scale, setScale] = useState(4);
  const [faceEnhance, setFaceEnhance] = useState(false);

  const handleFile = (f: File) => {
    setFile(f);
    setResult(null);
    const url = URL.createObjectURL(f);
    setPreview(url);
  };

  const handleUpscale = async () => {
    if (!file) return toast.error("Upload an image first");
    setProcessing(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("scale", String(scale));
      fd.append("face_enhance", String(faceEnhance));
      const res = await fetch("/api/ai-studio/upscale", { method: "POST", body: fd });
      const data = await res.json();
      if (data.image) {
        const img = data.image.startsWith("data:") ? data.image : `data:image/png;base64,${data.image}`;
        setResult(img);
        toast.success(`Upscaled ${scale}x`);
      } else if (data.job_id) {
        toast.success("Processing...");
      } else if (res.status === 501 || data?.error === "setup_required") {
        toast(
          (t) => (
            <span>
              Upscaler isn&apos;t configured.{" "}
              <a
                href="/dashboard/integrations-hub"
                className="underline font-medium"
                onClick={() => toast.dismiss(t.id)}
              >
                Set it up
              </a>
            </span>
          ),
          { icon: "??", duration: 8000 }
        );
      } else {
        toast.error(data.error || "Failed");
      }
    } catch (err) {
      console.error("[ai-studio/upscale] failed:", err);
      toast.error("Upscale failed");
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div>
      <motion.div
        className="flex items-center gap-2 mb-4"
        initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.22 }}
      >
        <ArrowUpRight size={16} className="text-green-400" />
        <h2 className="text-sm font-bold text-text-primary">AI Image Upscaler</h2>
        <span className="text-[9px] bg-green-500/10 text-green-400 px-2 py-0.5 rounded-full">Real-ESRGAN</span>
      </motion.div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <div onClick={() => fileRef.current?.click()}
            className="border-2 border-dashed border-border-subtle rounded-xl p-8 text-center cursor-pointer hover:border-green-400/30 transition-all">
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])} />
            {preview ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img src={preview} alt="Preview" className="max-h-[200px] mx-auto rounded-lg" />
            ) : (
              <>
                <ImagePlus size={24} className="mx-auto mb-2 text-text-muted" />
                <p className="text-xs text-text-primary font-medium">Drop image to upscale</p>
                <p className="text-[10px] text-text-muted mt-1">JPG, PNG, WebP � max 20MB</p>
              </>
            )}
          </div>

          <div className="flex items-center gap-3 mt-3">
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-text-muted">Scale:</span>
              {[2, 4].map(s => (
                <button key={s} onClick={() => setScale(s)}
                  className={`text-xs px-2.5 py-1 rounded-lg font-medium ${scale === s ? "bg-green-500 text-white" : "bg-surface-light text-text-muted"}`}>
                  {s}x
                </button>
              ))}
            </div>
            <label className="flex items-center gap-1.5 cursor-pointer">
              <input type="checkbox" checked={faceEnhance} onChange={e => setFaceEnhance(e.target.checked)} className="w-3 h-3 rounded" />
              <span className="text-[10px] text-text-muted">Face enhance</span>
            </label>
            <motion.button onClick={handleUpscale} disabled={processing || !file}
              whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
              className="ml-auto btn-pill text-xs flex items-center gap-1.5">
              {processing ? <Loader size={12} className="animate-spin" /> : <Wand2 size={12} />}
              Upscale
            </motion.button>
          </div>
        </div>

        <motion.div
          className="rounded-xl p-4 min-h-[200px] flex items-center justify-center"

          initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.22, delay: 0.08 }}
        >
          {result ? (
            <div className="text-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={result} alt="Upscaled" className="max-h-[250px] mx-auto rounded-lg" />
              <a href={result} download={`upscaled_${scale}x.png`}
                className="inline-flex items-center gap-1 mt-2 text-[10px] text-green-400 hover:underline">
                <Download size={10} /> Download
              </a>
            </div>
          ) : (
            <p className="text-xs text-text-muted">Upscaled result will appear here</p>
          )}
        </motion.div>
      </div>
    </div>
  );
}

// -- REMOVE BG TOOL -----------------------------------------------
function RemoveBgTool({ processing, setProcessing }: ToolProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);
  const [bgColor, setBgColor] = useState<string>("");

  const handleRemoveBg = async () => {
    if (!file) return toast.error("Upload an image first");
    setProcessing(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      if (bgColor) fd.append("bg_color", bgColor);
      const res = await fetch("/api/ai-studio/remove-bg", { method: "POST", body: fd });
      const data = await res.json();
      if (data.image) {
        const img = data.image.startsWith("data:") ? data.image : `data:image/png;base64,${data.image}`;
        setResult(img);
        toast.success("Background removed");
      } else if (res.status === 501 || data?.error === "setup_required") {
        toast(
          (t) => (
            <span>
              Background remover isn&apos;t configured.{" "}
              <a
                href="/dashboard/integrations-hub"
                className="underline font-medium"
                onClick={() => toast.dismiss(t.id)}
              >
                Set it up
              </a>
            </span>
          ),
          { icon: "??", duration: 8000 }
        );
      } else {
        toast.error(data.error || "Failed");
      }
    } catch (err) {
      console.error("[ai-studio/remove-bg] failed:", err);
      toast.error("Failed");
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div>
      <motion.div
        className="flex items-center gap-2 mb-4"
        initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.22 }}
      >
        <Scissors size={16} className="text-pink-400" />
        <h2 className="text-sm font-bold text-text-primary">Background Remover</h2>
        <span className="text-[9px] bg-pink-500/10 text-pink-400 px-2 py-0.5 rounded-full">REMBG / SAM</span>
      </motion.div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <div onClick={() => fileRef.current?.click()}
            className="border-2 border-dashed border-border-subtle rounded-xl p-8 text-center cursor-pointer hover:border-pink-400/30 transition-all">
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) { setFile(f); setPreview(URL.createObjectURL(f)); setResult(null); } }} />
            {preview ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img src={preview} alt="" className="max-h-[200px] mx-auto rounded-lg" />
            ) : (
              <>
                <Scissors size={24} className="mx-auto mb-2 text-text-muted" />
                <p className="text-xs text-text-primary font-medium">Drop image</p>
                <p className="text-[10px] text-text-muted mt-1">JPG, PNG, WebP � max 15MB</p>
              </>
            )}
          </div>
          <div className="flex items-center gap-3 mt-3">
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-text-muted">BG Color:</span>
              <button onClick={() => setBgColor("")} className={`w-6 h-6 rounded border ${!bgColor ? "border-pink-400" : "border-border-subtle"}`}
                style={{ background: "repeating-conic-gradient(#808080 0% 25%, transparent 0% 50%) 50% / 8px 8px" }} title="Transparent" />
              {["#ffffff", "#000000", "#f0f0f0"].map(c => (
                <button key={c} onClick={() => setBgColor(c)} className={`w-6 h-6 rounded border ${bgColor === c ? "border-pink-400" : "border-border-subtle"}`}
                  style={{ background: c }} />
              ))}
              <input type="color" value={bgColor || "#ffffff"} onChange={e => setBgColor(e.target.value)} className="w-6 h-6 rounded cursor-pointer" />
            </div>
            <motion.button onClick={handleRemoveBg} disabled={processing || !file}
              whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
              className="ml-auto btn-pill text-xs flex items-center gap-1.5">
              {processing ? <Loader size={12} className="animate-spin" /> : <Scissors size={12} />}
              Remove BG
            </motion.button>
          </div>
        </div>
        <motion.div
          className="rounded-xl p-4 min-h-[200px] flex items-center justify-center"
          style={{ background: !result ? "#FAFAFB" : bgColor ? bgColor : "repeating-conic-gradient(#e0e0e0 0% 25%, #f8f8f8 0% 50%) 50% / 16px 16px", border: "1px solid rgba(255,255,255,0.70)" }}
          initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.22, delay: 0.08 }}
        >
          {result ? (
            <div className="text-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={result} alt="Result" className="max-h-[250px] mx-auto" />
              <a href={result} download="removed-bg.png"
                className="inline-flex items-center gap-1 mt-2 text-[10px] text-pink-400 hover:underline">
                <Download size={10} /> Download PNG
              </a>
            </div>
          ) : (
            <p className="text-xs text-text-muted">Result with transparent background</p>
          )}
        </motion.div>
      </div>
    </div>
  );
}

// -- IMAGE TO VIDEO TOOL ------------------------------------------
function ImgToVideoTool({ processing, setProcessing }: ToolProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [motionBucket, setMotionBucket] = useState(127);
  const [fps, setFps] = useState(6);
  const [result, setResult] = useState<string | null>(null);

  const handleGenerate = async () => {
    if (!file) return toast.error("Upload an image first");
    setProcessing(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("motion_bucket", String(motionBucket));
      fd.append("fps", String(fps));
      const res = await fetch("/api/ai-studio/img-to-video", { method: "POST", body: fd });
      const data = await res.json();
      if (data.video) {
        setResult(data.video.startsWith("data:") ? data.video : data.video);
        toast.success("Video generated!");
      } else if (data.job_id) {
        toast.success("Processing... this takes 30-60 seconds");
      } else {
        toast.error(data.error || "Failed");
      }
    } catch (err) {
      console.error("[ai-studio/img-to-video] failed:", err);
      toast.error("Failed");
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div>
      <motion.div
        className="flex items-center gap-2 mb-4"
        initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.22 }}
      >
        <Film size={16} className="text-[#3B82F6]" />
        <h2 className="text-sm font-bold text-text-primary">Image to Video</h2>
        <span className="text-[9px] bg-[rgba(59,130,246,0.12)] text-blue-300 px-2 py-0.5 rounded-full">Stable Video Diffusion</span>
      </motion.div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <div onClick={() => fileRef.current?.click()}
            className="border-2 border-dashed border-border-subtle rounded-xl p-8 text-center cursor-pointer hover:border-[rgba(59,130,246,0.35)] transition-all">
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) { setFile(f); setPreview(URL.createObjectURL(f)); setResult(null); } }} />
            {preview ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img src={preview} alt="" className="max-h-[200px] mx-auto rounded-lg" />
            ) : (
              <>
                <Film size={24} className="mx-auto mb-2 text-text-muted" />
                <p className="text-xs text-text-primary font-medium">Drop still image to animate</p>
                <p className="text-[10px] text-text-muted mt-1">Product shots, logos, hero images</p>
              </>
            )}
          </div>
          <div className="mt-3 space-y-2">
            <div className="flex items-center gap-3">
              <span className="text-[10px] text-text-muted w-16">Motion:</span>
              <input type="range" min={1} max={255} value={motionBucket} onChange={e => setMotionBucket(Number(e.target.value))}
                className="flex-1 h-1 accent-[#2563EB]" />
              <span className="text-[10px] text-text-muted w-8">{motionBucket}</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-[10px] text-text-muted w-16">FPS:</span>
              {[6, 12, 24].map(f => (
                <button key={f} onClick={() => setFps(f)}
                  className={`text-xs px-2 py-1 rounded ${fps === f ? "bg-brand-accent text-white" : "bg-surface-light text-text-muted"}`}>{f}</button>
              ))}
            </div>
          </div>
          <motion.button onClick={handleGenerate} disabled={processing || !file}
            whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
            className="btn-pill w-full mt-3 text-xs flex items-center justify-center gap-1.5">
            {processing ? <Loader size={12} className="animate-spin" /> : <Play size={12} />}
            Animate Image
          </motion.button>
        </div>
        <motion.div
          className="rounded-xl p-4 min-h-[200px] flex items-center justify-center"

          initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.22, delay: 0.08 }}
        >
          {result ? (
            <video src={result} controls autoPlay loop muted className="max-h-[300px] rounded-lg" />
          ) : (
            <p className="text-xs text-text-muted">Animated video will appear here</p>
          )}
        </motion.div>
      </div>
    </div>
  );
}

// -- MUSIC GEN TOOL -----------------------------------------------
function MusicGenTool({ processing, setProcessing }: ToolProps) {
  const [prompt, setPrompt] = useState("");
  const [mood, setMood] = useState("upbeat");
  const [genre, setGenre] = useState("electronic");
  const [duration, setDuration] = useState(15);
  const [result, setResult] = useState<string | null>(null);

  const moods = ["upbeat", "chill", "dramatic", "motivational", "corporate", "emotional", "trendy", "dark"];
  const genres = ["electronic", "acoustic", "hiphop", "lofi", "orchestral", "pop", "jazz", "ambient"];

  const handleGenerate = async () => {
    if (!prompt) return toast.error("Describe the music you want");
    setProcessing(true);
    try {
      const res = await fetch("/api/ai/music-gen", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, mood, genre, duration }),
      });
      const data = await res.json();
      if (data.audio) {
        const audio = data.audio.startsWith("data:") ? data.audio : `data:audio/wav;base64,${data.audio}`;
        setResult(audio);
        toast.success("Music generated!");
      } else if (data.job_id) {
        toast.success("Generating...");
      } else {
        toast.error(data.error || "Failed");
      }
    } catch (err) {
      console.error("[ai-studio/music-gen] failed:", err);
      toast.error("Failed");
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div>
      <motion.div
        className="flex items-center gap-2 mb-4"
        initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.22 }}
      >
        <Music size={16} className="text-[#3B82F6]" />
        <h2 className="text-sm font-bold text-text-primary">AI Music Generator</h2>
        <span className="text-[9px] bg-[rgba(59,130,246,0.1)] text-[#3B82F6] px-2 py-0.5 rounded-full">MusicGen</span>
        <span className="text-[9px] text-text-muted ml-auto">Royalty-free output</span>
      </motion.div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-3">
          <textarea value={prompt} onChange={e => setPrompt(e.target.value)} placeholder="Describe the music... e.g. 'upbeat background music with light drums and synth pads for a tech product video'"
            className="w-full h-20 text-xs bg-surface-light border border-border-subtle rounded-xl px-3 py-2 text-text-primary resize-none" />

          <div>
            <span className="text-[10px] text-text-muted mb-1 block">Mood</span>
            <div className="flex flex-wrap gap-1.5">
              {moods.map(m => (
                <button key={m} onClick={() => setMood(m)}
                  className={`text-[10px] px-2.5 py-1 rounded-lg capitalize ${mood === m ? "bg-brand-accent text-white font-semibold" : "bg-surface-light text-text-muted"}`}>{m}</button>
              ))}
            </div>
          </div>

          <div>
            <span className="text-[10px] text-text-muted mb-1 block">Genre</span>
            <div className="flex flex-wrap gap-1.5">
              {genres.map(g => (
                <button key={g} onClick={() => setGenre(g)}
                  className={`text-[10px] px-2.5 py-1 rounded-lg capitalize ${genre === g ? "bg-brand-accent text-white font-semibold" : "bg-surface-light text-text-muted"}`}>{g}</button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-[10px] text-text-muted">Duration:</span>
            <input type="range" min={5} max={30} value={duration} onChange={e => setDuration(Number(e.target.value))}
              className="flex-1 h-1 accent-[#2563EB]" />
            <span className="text-xs text-text-primary font-mono">{duration}s</span>
          </div>

          <motion.button onClick={handleGenerate} disabled={processing || !prompt}
            whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
            className="btn-pill w-full text-xs flex items-center justify-center gap-1.5">
            {processing ? <Loader size={12} className="animate-spin" /> : <Music size={12} />}
            Generate Music
          </motion.button>
        </div>

        <motion.div
          className="rounded-xl p-4 min-h-[200px] flex flex-col items-center justify-center"

          initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.22, delay: 0.08 }}
        >
          {result ? (
            <div className="w-full text-center space-y-3">
              <div className="w-16 h-16 mx-auto rounded-full bg-[rgba(59,130,246,0.1)] flex items-center justify-center">
                <Music size={24} className="text-[#3B82F6]" />
              </div>
              <audio src={result} controls className="w-full" />
              <a href={result} download="ai-music.wav"
                className="inline-flex items-center gap-1 text-[10px] text-[#3B82F6] hover:underline">
                <Download size={10} /> Download WAV
              </a>
            </div>
          ) : (
            <p className="text-xs text-text-muted">Generated music will play here</p>
          )}
        </motion.div>
      </div>
    </div>
  );
}

// -- VOICE CLONE TOOL ---------------------------------------------
function VoiceCloneTool({ processing, setProcessing }: ToolProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [mode, setMode] = useState<"clone" | "speak">("clone");
  const [voiceFiles, setVoiceFiles] = useState<File[]>([]);
  const [text, setText] = useState("");
  const [voiceName, setVoiceName] = useState("");
  const [result, setResult] = useState<string | null>(null);
  const [savedVoices, setSavedVoices] = useState<{ id: string; name: string }[]>([]);
  const [selectedVoice, setSelectedVoice] = useState<string>("");

  const handleClone = async () => {
    if (voiceFiles.length === 0) return toast.error("Upload at least one voice sample (6+ seconds)");
    setProcessing(true);
    let successCount = 0;
    try {
      for (let i = 0; i < voiceFiles.length; i++) {
        const vf = voiceFiles[i];
        const fd = new FormData();
        fd.append("mode", "clone");
        fd.append("voice_file", vf);
        const baseName = voiceName || "Custom Voice";
        fd.append("voice_name", voiceFiles.length > 1 ? `${baseName} ${i + 1}` : baseName);
        const res = await fetch("/api/ai/voice-clone", { method: "POST", body: fd });
        const data = await res.json();
        if (data.success) {
          successCount++;
          if (data.voice_id) setSavedVoices(prev => [...prev, { id: data.voice_id, name: data.voice_name }]);
        } else {
          toast.error(`"${vf.name}": ${data.error || "Failed"}`);
        }
      }
      if (successCount > 0) {
        toast.success(`${successCount} voice${successCount > 1 ? "s" : ""} cloned!`);
        setVoiceFiles([]);
      }
    } catch (err) {
      console.error("[ai-studio/voice-clone] clone failed:", err);
      toast.error("Clone failed");
    } finally {
      setProcessing(false);
    }
  };

  const handleSpeak = async () => {
    if (!text) return toast.error("Enter text to speak");
    if (!selectedVoice && savedVoices.length === 0 && voiceFiles.length === 0) {
      return toast.error("Select or clone a voice first");
    }
    setProcessing(true);
    try {
      const fd = new FormData();
      fd.append("mode", "speak");
      fd.append("text", text);
      if (selectedVoice) fd.append("voice_id", selectedVoice);
      else if (voiceFiles[0]) fd.append("voice_file", voiceFiles[0]);
      const res = await fetch("/api/ai/voice-clone", { method: "POST", body: fd });
      const data = await res.json();
      if (data.audio) {
        const audio = data.audio.startsWith("data:") ? data.audio : `data:audio/wav;base64,${data.audio}`;
        setResult(audio);
        toast.success("Speech generated!");
      } else {
        toast.error(data.error || "Failed");
      }
    } catch (err) {
      console.error("[ai-studio/voice-clone] speak failed:", err);
      toast.error("Failed");
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div>
      <motion.div
        className="flex items-center gap-2 mb-4"
        initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.22 }}
      >
        <Volume2 size={16} className="text-orange-400" />
        <h2 className="text-sm font-bold text-text-primary">Voice Clone + TTS</h2>
        <span className="text-[9px] bg-orange-500/10 text-orange-400 px-2 py-0.5 rounded-full">XTTS v2</span>
      </motion.div>

      <div className="tab-pill-strip mb-4">
        {(["clone", "speak"] as const).map(m => (
          <button key={m} onClick={() => setMode(m)}
            className={`tab-pill${mode === m ? " active" : ""} text-xs capitalize`}>
            {m === "clone" ? "Clone Voice" : "Generate Speech"}
          </button>
        ))}
      </div>

      {mode === "clone" ? (
        <div className="space-y-3">
          <div onClick={() => fileRef.current?.click()}
            className="border-2 border-dashed border-border-subtle rounded-xl p-6 text-center cursor-pointer hover:border-orange-400/30 transition-all">
            <input ref={fileRef} type="file" accept="audio/*" multiple className="hidden" onChange={e => {
              const files = Array.from(e.target.files || []);
              if (files.length) setVoiceFiles(prev => [...prev, ...files]);
              e.target.value = "";
            }} />
            <FileAudio size={24} className="mx-auto mb-2 text-text-muted" />
            <p className="text-xs text-text-primary font-medium">{voiceFiles.length > 0 ? `${voiceFiles.length} sample${voiceFiles.length > 1 ? "s" : ""} selected` : "Upload voice samples (6+ seconds each)"}</p>
            <p className="text-[10px] text-text-muted mt-1">Clone multiple voices in one batch</p>
          </div>
          {voiceFiles.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {voiceFiles.map((f, i) => (
                <div key={i} className="flex items-center gap-1 bg-surface-light border border-border-subtle rounded-lg px-2 py-1 text-[10px] text-text-primary">
                  <FileAudio size={10} className="text-orange-400" />
                  <span className="truncate max-w-[120px]">{f.name}</span>
                  <button onClick={() => setVoiceFiles(prev => prev.filter((_, j) => j !== i))} className="text-text-muted hover:text-red-400" aria-label={`Remove ${f.name}`}>
                    <X size={10} />
                  </button>
                </div>
              ))}
            </div>
          )}
          <input value={voiceName} onChange={e => setVoiceName(e.target.value)} placeholder="Voice name (e.g. 'Client - John')"
            className="w-full text-xs bg-surface-light border border-border-subtle rounded-lg px-3 py-2 text-text-primary" />
          <motion.button onClick={handleClone} disabled={processing || voiceFiles.length === 0}
            whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
            className="btn-pill w-full text-xs flex items-center justify-center gap-1.5">
            {processing ? <Loader size={12} className="animate-spin" /> : <Volume2 size={12} />}
            Clone {voiceFiles.length > 1 ? `${voiceFiles.length} Voices` : "Voice"}
          </motion.button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-3">
            {savedVoices.length > 0 && (
              <select value={selectedVoice} onChange={e => setSelectedVoice(e.target.value)}
                className="w-full text-xs bg-surface-light border border-border-subtle rounded-lg px-3 py-2 text-text-primary">
                <option value="">Use reference audio</option>
                {savedVoices.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
              </select>
            )}
            <textarea value={text} onChange={e => setText(e.target.value)} placeholder="Enter text to speak in the cloned voice..."
              className="w-full h-32 text-xs bg-surface-light border border-border-subtle rounded-xl px-3 py-2 text-text-primary resize-none" />
            <motion.button onClick={handleSpeak} disabled={processing || !text}
              whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
              className="btn-pill w-full text-xs flex items-center justify-center gap-1.5">
              {processing ? <Loader size={12} className="animate-spin" /> : <Play size={12} />}
              Generate Speech
            </motion.button>
          </div>
          <motion.div
            className="rounded-xl p-4 flex items-center justify-center"

            initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.22, delay: 0.08 }}
          >
            {result ? (
              <div className="w-full text-center space-y-3">
                <audio src={result} controls className="w-full" />
                <a href={result} download="voice-clone.wav" className="inline-flex items-center gap-1 text-[10px] text-orange-400 hover:underline">
                  <Download size={10} /> Download
                </a>
              </div>
            ) : (
              <p className="text-xs text-text-muted">Generated speech plays here</p>
            )}
          </motion.div>
        </div>
      )}
    </div>
  );
}

// -- TRAIN LORA TOOL ----------------------------------------------
function TrainLoraTool({ processing, setProcessing }: ToolProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [images, setImages] = useState<File[]>([]);
  const [loraName, setLoraName] = useState("");
  const [triggerWord, setTriggerWord] = useState("sks style");
  const [steps, setSteps] = useState(1500);
  const [trainingStatus, setTrainingStatus] = useState<string | null>(null);

  const addImages = (files: FileList) => {
    const newFiles = Array.from(files).filter(f => f.type.startsWith("image/"));
    setImages(prev => [...prev, ...newFiles].slice(0, 20));
  };

  // Cache blob URLs per-file so we don't create a new URL on every render
  // (which previously leaked a new blob URL per image per render keystroke).
  const imagePreviews = useMemo(() => images.map(img => URL.createObjectURL(img)), [images]);
  useEffect(() => {
    return () => {
      imagePreviews.forEach(url => URL.revokeObjectURL(url));
    };
  }, [imagePreviews]);

  const handleTrain = async () => {
    if (images.length < 5) return toast.error("Need at least 5 images (10-20 recommended)");
    setProcessing(true);
    try {
      const fd = new FormData();
      fd.append("action", "train");
      fd.append("name", loraName || "custom-style");
      fd.append("trigger_word", triggerWord);
      fd.append("steps", String(steps));
      images.forEach((img, i) => fd.append(`image_${i}`, img));
      const res = await fetch("/api/ai/train-lora", { method: "POST", body: fd });
      const data = await res.json();
      if (data.success) {
        setTrainingStatus(`Training started! ${data.estimated_time}`);
        toast.success(data.message);
      } else {
        toast.error(data.error || "Failed");
      }
    } catch (err) {
      console.error("[ai-studio/train-lora] failed:", err);
      toast.error("Failed");
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div>
      <motion.div
        className="flex items-center gap-2 mb-4"
        initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.22 }}
      >
        <Brain size={16} className="text-[#3B82F6]" />
        <h2 className="text-sm font-bold text-text-primary">Brand LoRA Training</h2>
        <span className="text-[9px] bg-[rgba(59,130,246,0.12)] text-blue-300 px-2 py-0.5 rounded-full">Business+ Only</span>
      </motion.div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-3">
          <div onClick={() => fileRef.current?.click()}
            className="border-2 border-dashed border-border-subtle rounded-xl p-6 text-center cursor-pointer hover:border-[rgba(0,0,0,0.3)] transition-all">
            <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={e => e.target.files && addImages(e.target.files)} />
            <Layers size={24} className="mx-auto mb-2 text-text-muted" />
            <p className="text-xs text-text-primary font-medium">
              {images.length > 0 ? `${images.length} images selected` : "Upload 10-20 reference images"}
            </p>
            <p className="text-[10px] text-text-muted mt-1">Same style, consistent quality</p>
          </div>

          {images.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {images.map((img, i) => (
                <div key={i} className="relative w-12 h-12 rounded-lg overflow-hidden bg-surface-light">
                  <SafeThumb
                    src={imagePreviews[i]}
                    alt={`Training sample ${i + 1}`}
                    className="w-full h-full object-cover"
                    wrapperClassName="w-full h-full"
                  />
                  <button onClick={() => setImages(prev => prev.filter((_, j) => j !== i))}
                    className="absolute top-0 right-0 w-4 h-4 bg-red-500 text-white flex items-center justify-center"
                    aria-label={`Remove training sample ${i + 1}`}>
                    <X size={8} />
                  </button>
                </div>
              ))}
            </div>
          )}

          <input value={loraName} onChange={e => setLoraName(e.target.value)} placeholder="Model name (e.g. 'acme-brand-style')"
            className="w-full text-xs bg-surface-light border border-border-subtle rounded-lg px-3 py-2 text-text-primary" />
          <input value={triggerWord} onChange={e => setTriggerWord(e.target.value)} placeholder="Trigger word"
            className="w-full text-xs bg-surface-light border border-border-subtle rounded-lg px-3 py-2 text-text-primary" />

          <div className="flex items-center gap-3">
            <span className="text-[10px] text-text-muted">Steps:</span>
            <input type="range" min={500} max={5000} step={100} value={steps} onChange={e => setSteps(Number(e.target.value))}
              className="flex-1 h-1 accent-[#2563EB]" />
            <span className="text-xs text-text-primary font-mono">{steps}</span>
          </div>

          <motion.button onClick={handleTrain} disabled={processing || images.length < 5}
            whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
            className="btn-pill w-full text-xs flex items-center justify-center gap-1.5">
            {processing ? <Loader size={12} className="animate-spin" /> : <Zap size={12} />}
            Start Training (~{Math.ceil(steps / 100)} min)
          </motion.button>
        </div>

        <motion.div
          className="rounded-xl p-4 min-h-[200px]"

          initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.22, delay: 0.08 }}
        >
          <h3 className="text-xs font-semibold text-text-primary mb-3">How it works</h3>
          <div className="space-y-2">
            {[
              { step: 1, text: "Upload 10-20 images in your client's brand style" },
              { step: 2, text: "Set a trigger word (used in prompts to activate the style)" },
              { step: 3, text: "Training runs on GPU (~15-30 min)" },
              { step: 4, text: "Use the trained LoRA in Design Studio & Thumbnail Generator" },
            ].map(({ step, text }) => (
              <div key={step} className="flex items-start gap-2">
                <div className="w-5 h-5 rounded-full bg-[rgba(59,130,246,0.12)] flex items-center justify-center shrink-0">
                  <span className="text-[9px] font-bold text-[#3B82F6]">{step}</span>
                </div>
                <p className="text-[10px] text-text-muted leading-relaxed">{text}</p>
              </div>
            ))}
          </div>
          {trainingStatus && (
            <div className="mt-4 p-3 rounded-lg bg-[rgba(59,130,246,0.06)] text-xs text-brand-accent">
              {trainingStatus}
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
}

// -- BATCH GENERATE TOOL ------------------------------------------
function BatchGenTool({ processing, setProcessing }: ToolProps) {
  const [prompts, setPrompts] = useState<string[]>([""]);
  const [style, setStyle] = useState("modern");
  const [size, setSize] = useState("1024x1024");
  const [model, setModel] = useState("flux");
  const [results, setResults] = useState<{ prompt: string; jobId: string; status: string }[]>([]);

  const styles = ["modern", "vintage", "minimalist", "bold", "luxury", "playful", "dark", "corporate"];
  const sizes = ["1024x1024", "1024x1792", "1792x1024", "512x512", "768x1024"];

  const handleGenerate = async () => {
    const validPrompts = prompts.filter(p => p.trim());
    if (validPrompts.length === 0) return toast.error("Add at least one prompt");
    setProcessing(true);
    try {
      const res = await fetch("/api/ai/batch-generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompts: validPrompts, style, sizes: [size], model }),
      });
      const data = await res.json();
      if (data.jobs) {
        setResults(data.jobs);
        toast.success(`${data.batch_size} images queued!`);
      } else {
        toast.error(data.error || "Failed");
      }
    } catch (err) {
      console.error("[ai-studio/batch-gen] failed:", err);
      toast.error("Failed");
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div>
      <motion.div
        className="flex items-center gap-2 mb-4"
        initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.22 }}
      >
        <Layers size={16} className="text-cyan-400" />
        <h2 className="text-sm font-bold text-text-primary">Batch Image Generation</h2>
        <span className="text-[9px] bg-cyan-500/10 text-cyan-400 px-2 py-0.5 rounded-full">FLUX / SDXL</span>
      </motion.div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-3">
          <div className="space-y-2">
            {prompts.map((p, i) => (
              <div key={i} className="flex gap-2">
                <span className="text-[10px] text-text-muted mt-2 w-4">{i + 1}.</span>
                <input value={p} onChange={e => { const np = [...prompts]; np[i] = e.target.value; setPrompts(np); }}
                  placeholder="Describe image..."
                  className="flex-1 text-xs bg-surface-light border border-border-subtle rounded-lg px-3 py-2 text-text-primary" />
                {prompts.length > 1 && (
                  <button onClick={() => setPrompts(prev => prev.filter((_, j) => j !== i))}
                    className="text-text-muted hover:text-red-400" aria-label={`Remove prompt ${i + 1}`}><X size={12} /></button>
                )}
              </div>
            ))}
          </div>

          <button onClick={() => setPrompts(prev => [...prev, ""])} disabled={prompts.length >= 50}
            className="text-[10px] text-cyan-400 hover:underline flex items-center gap-1 disabled:opacity-40 disabled:cursor-not-allowed">
            + Add prompt (max 50)
          </button>

          <div className="flex flex-wrap gap-3">
            <div>
              <span className="text-[10px] text-text-muted block mb-1">Style</span>
              <select value={style} onChange={e => setStyle(e.target.value)}
                className="text-xs bg-surface-light border border-border-subtle rounded-lg px-2 py-1.5 text-text-primary">
                {styles.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <span className="text-[10px] text-text-muted block mb-1">Size</span>
              <select value={size} onChange={e => setSize(e.target.value)}
                className="text-xs bg-surface-light border border-border-subtle rounded-lg px-2 py-1.5 text-text-primary">
                {sizes.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <span className="text-[10px] text-text-muted block mb-1">Model</span>
              <select value={model} onChange={e => setModel(e.target.value)}
                className="text-xs bg-surface-light border border-border-subtle rounded-lg px-2 py-1.5 text-text-primary">
                <option value="flux">FLUX.1-dev</option>
                <option value="sdxl">SDXL</option>
              </select>
            </div>
          </div>

          <motion.button onClick={handleGenerate} disabled={processing}
            whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
            className="btn-pill w-full text-xs flex items-center justify-center gap-1.5">
            {processing ? <Loader size={12} className="animate-spin" /> : <Zap size={12} />}
            Generate {prompts.filter(p => p.trim()).length} Images
          </motion.button>
        </div>

        <motion.div
          className="rounded-xl p-4 min-h-[200px]"

          initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.22, delay: 0.08 }}
        >
          <h3 className="text-xs font-semibold text-text-primary mb-3">Queue ({results.length})</h3>
          {results.length > 0 ? (
            <div className="space-y-2 max-h-[300px] overflow-y-auto">
              {results.map((r, i) => (
                <div key={i} className="flex items-center gap-2 p-2 bg-surface rounded-lg">
                  <div className={`w-2 h-2 rounded-full ${
                    r.status === "COMPLETED" ? "bg-green-400" : r.status === "FAILED" ? "bg-red-400" : "bg-yellow-400 animate-pulse"
                  }`} />
                  <span className="text-[10px] text-text-primary flex-1 truncate">{r.prompt}</span>
                  <span className="text-[9px] text-text-muted">{r.status}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-text-muted">Batch results will appear here</p>
          )}
        </motion.div>
      </div>
    </div>
  );
}

// -- IMAGE CREATION WIZARD (5-step lean flow) ---------------------
interface ImageCreationWizardProps {
  open: boolean;
  onClose: () => void;
  onComplete: (data: { prompt: string; style: string; size: string }) => void;
}

function ImageCreationWizard({ open, onClose, onComplete }: ImageCreationWizardProps) {
  const steps: WizardStep[] = [
    {
      id: "useCase",
      title: "What are you creating?",
      description: "Pick the use case so we can tune the look and aspect ratio.",
      icon: <Target size={16} />,
      field: {
        type: "chip-select",
        key: "useCase",
        options: [
          { value: "profile", label: "Profile picture", emoji: "??" },
          { value: "ad", label: "Ad creative", emoji: "??" },
          { value: "hero", label: "Hero image", emoji: "???" },
          { value: "carousel", label: "Carousel slide", emoji: "???" },
          { value: "thumbnail", label: "Thumbnail", emoji: "??" },
          { value: "product", label: "Product shot", emoji: "??" },
          { value: "illustration", label: "Illustration", emoji: "??" },
        ],
      },
    },
    {
      id: "subject",
      title: "What's the subject?",
      description: "Describe the main thing, person, or scene in the image.",
      icon: <Edit3 size={16} />,
      field: {
        type: "text",
        key: "subject",
        placeholder: 'e.g. "a confident woman holding a latte in a sunlit caf�"',
      },
      aiHelper: {
        label: "Help me describe a compelling subject",
        onClick: async (data) => {
          try {
            const useCaseArr = Array.isArray(data.useCase) ? (data.useCase as string[]) : [];
            const useCase = useCaseArr[0] || "hero image";
            const res = await fetch("/api/ai/enhance-prompt", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                text: `Suggest one compelling, visually specific subject description for a ${useCase} image. Return a single sentence under 25 words describing the subject and setting. No quotes, no intro.`,
                type: "general",
              }),
            });
            if (!res.ok) {
              toast.error("Couldn't suggest a subject");
              return {};
            }
            const json = await res.json();
            const suggestion: string = (json.enhanced || "").replace(/^["']|["']$/g, "").trim();
            if (!suggestion) {
              toast.error("No suggestion � try again");
              return {};
            }
            toast.success("Subject suggested!");
            return { subject: suggestion };
          } catch (err) {
            console.error("[ai-studio/enhance-prompt]", err);
            toast.error("Subject suggestion failed");
            return {};
          }
        },
      },
    },
    {
      id: "style",
      title: "Pick a visual style",
      description: "Sets the overall rendering approach.",
      icon: <Palette size={16} />,
      field: {
        type: "chip-select",
        key: "style",
        options: [
          { value: "photorealistic", label: "Photorealistic", emoji: "??" },
          { value: "3d_render", label: "3D render", emoji: "??" },
          { value: "illustration", label: "Illustration", emoji: "???" },
          { value: "cinematic", label: "Cinematic", emoji: "??" },
          { value: "minimalist", label: "Minimalist", emoji: "?" },
          { value: "artistic", label: "Artistic", emoji: "??" },
          { value: "vaporwave", label: "Vaporwave", emoji: "??" },
        ],
      },
    },
    {
      id: "ratio",
      title: "Aspect ratio",
      description: "Pick the dimensions � we'll pass them straight to FLUX.",
      icon: <Ratio size={16} />,
      field: {
        type: "chip-select",
        key: "ratio",
        options: [
          { value: "1024x1024", label: "1:1 square", emoji: "?" },
          { value: "1024x1792", label: "9:16 portrait / story", emoji: "??" },
          { value: "1792x1024", label: "16:9 landscape / thumbnail", emoji: "??" },
          { value: "896x1120", label: "4:5 post", emoji: "??" },
        ],
      },
    },
    {
      id: "prompt",
      title: "Final prompt",
      description: "Edit the prompt or let Claude write a full FLUX-ready version.",
      icon: <TypeIcon size={16} />,
      field: {
        type: "textarea",
        key: "prompt",
        placeholder: "Your final prompt � include details about lighting, mood, composition, etc.",
      },
      aiHelper: {
        label: "Enhance my prompt with AI",
        onClick: async (data) => {
          try {
            const subject = String(data.subject || "").trim();
            const styleArr = Array.isArray(data.style) ? (data.style as string[]) : [];
            const styleVal = styleArr[0] || "photorealistic";
            const useCaseArr = Array.isArray(data.useCase) ? (data.useCase as string[]) : [];
            const useCase = useCaseArr[0] || "hero image";
            const currentPrompt = String(data.prompt || "").trim();

            const base = currentPrompt || subject;
            if (!base) {
              toast.error("Add a subject on step 2 first");
              return {};
            }

            const res = await fetch("/api/ai/enhance-prompt", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                text: `Build a FLUX-ready image prompt for a ${useCase} in ${styleVal} style. Subject: "${base}". Return a single dense prompt (under 80 words) with lighting, composition, mood, and technical detail. Plain text, no quotes.`,
                type: "design",
              }),
            });
            if (!res.ok) {
              toast.error("Couldn't enhance prompt � try again");
              return {};
            }
            const json = await res.json();
            const enhanced: string = (json.enhanced || "").replace(/^["']|["']$/g, "").trim();
            if (!enhanced) {
              toast.error("No enhanced prompt returned");
              return {};
            }
            toast.success("Prompt enhanced!");
            return { prompt: enhanced };
          } catch (err) {
            console.error("[ai-studio/enhance-prompt]", err);
            toast.error("Prompt enhancement failed");
            return {};
          }
        },
      },
    },
  ];

  async function handleComplete(data: Record<string, unknown>) {
    const prompt = String(data.prompt || "").trim() || String(data.subject || "").trim();
    const styleArr = Array.isArray(data.style) ? (data.style as string[]) : [];
    const ratioArr = Array.isArray(data.ratio) ? (data.ratio as string[]) : [];

    if (!prompt) {
      toast.error("Prompt is required");
      return;
    }

    const style = styleArr[0] || "";
    const size = ratioArr[0] || "1024x1024";

    onClose();
    onComplete({ prompt, style, size });
  }

  return (
    <CreationWizard
      open={open}
      title="Create Image"
      subtitle="AI-guided 5-step flow � FLUX renders the final image."
      icon={<Sparkles size={18} />}
      submitLabel="Generate Image"
      steps={steps}
      onClose={onClose}
      onComplete={handleComplete}
    />
  );
}

// -- Helper -------------------------------------------------------
function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}
