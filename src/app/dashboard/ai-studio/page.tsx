"use client";

import { useEffect, useMemo, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  Mic, ImagePlus, Scissors, Film, Music, Volume2, Layers, Sparkles,
  Upload, Download, Play, Loader, X,
  Wand2, Zap, Copy, Palette, AlertTriangle,
  ArrowUpRight, FileAudio, Brain,
  Target, Edit3, Type as TypeIcon, Ratio, Loader2,
} from "lucide-react";
import toast from "react-hot-toast";
import { motion } from "framer-motion";
import PageHero from "@/components/ui/page-hero";
import { MotionPage } from "@/components/motion/motion-page";
import ImageWizard from "@/components/image-wizard";
import CreationWizard, { type WizardStep } from "@/components/creation-wizard";
import { Wizard, AdvancedToggle, useAdvancedMode } from "@/components/ui/wizard";
import RollingPreview, { type RollingPreviewItem } from "@/components/RollingPreview";
import SafeThumb from "@/components/safe-thumb";
import { createClient } from "@/lib/supabase/client";
import { createHandoff, handoffUrl } from "@/lib/ai-handoff";

// Static AI-generated-style image previews (Unsplash wide crops) shown in
// the marquee on the AI Studio landing state when nothing has been
// generated yet.
const AI_STUDIO_PREVIEW_FALLBACK: RollingPreviewItem[] = [
  { id: "ai1", src: "https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=640&h=360&fit=crop", alt: "Neon sci-fi", tag: "Cyberpunk" },
  { id: "ai2", src: "https://images.unsplash.com/photo-1506703719100-a0f3a48c0f86?w=640&h=360&fit=crop", alt: "Dreamy sunset", tag: "Dreamscape" },
  { id: "ai3", src: "https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?w=640&h=360&fit=crop", alt: "Moody forest", tag: "Moody" },
  { id: "ai4", src: "https://images.unsplash.com/photo-1533106418989-88406c7cc8ca?w=640&h=360&fit=crop", alt: "Luxury product", tag: "Product" },
  { id: "ai5", src: "https://images.unsplash.com/photo-1518770660439-4636190af475?w=640&h=360&fit=crop", alt: "Tech abstract", tag: "Tech" },
  { id: "ai6", src: "https://images.unsplash.com/photo-1502082553048-f009c37129b9?w=640&h=360&fit=crop", alt: "Nature", tag: "Nature" },
  { id: "ai7", src: "https://images.unsplash.com/photo-1536440136628-849c177e76a1?w=640&h=360&fit=crop", alt: "Cinematic", tag: "Cinematic" },
  { id: "ai8", src: "https://images.unsplash.com/photo-1520390138845-fd2d229dd553?w=640&h=360&fit=crop", alt: "Automotive", tag: "Automotive" },
  { id: "ai9", src: "https://images.unsplash.com/photo-1515894203077-9cd36032142f?w=640&h=360&fit=crop", alt: "Portrait light", tag: "Portrait" },
  { id: "ai10", src: "https://images.unsplash.com/photo-1558591710-4b4a1ae0f04d?w=640&h=360&fit=crop", alt: "Futuristic", tag: "Futurism" },
  { id: "ai11", src: "https://images.unsplash.com/photo-1554080353-a576cf803bda?w=640&h=360&fit=crop", alt: "Abstract pastel", tag: "Abstract" },
  { id: "ai12", src: "https://images.unsplash.com/photo-1501785888041-af3ef285b470?w=640&h=360&fit=crop", alt: "Epic landscape", tag: "Epic" },
];

// ── Types ────────────────────────────────────────────────────────
interface JobResult {
  id: string;
  type: string;
  status: "processing" | "completed" | "failed";
  result?: string;
  timestamp: Date;
  meta?: Record<string, unknown>;
}

// ── Tool configs ─────────────────────────────────────────────────
const TOOLS = [
  { id: "transcribe", name: "Transcribe", desc: "Audio/video to text with timestamps", icon: Mic, color: "#60a5fa", tag: "Whisper V3" },
  { id: "image-gen", name: "Image Gen", desc: "Generate images from text prompts", icon: Palette, color: "#818cf8", tag: "FLUX/DALL-E" },
  { id: "upscale", name: "Upscale", desc: "4x AI image upscaling", icon: ArrowUpRight, color: "#34d399", tag: "Real-ESRGAN" },
  { id: "remove-bg", name: "Remove BG", desc: "One-click background removal", icon: Scissors, color: "#f472b6", tag: "REMBG/SAM" },
  { id: "img-to-video", name: "Image to Video", desc: "Animate still images into video", icon: Film, color: "#a78bfa", tag: "SVD" },
  { id: "music-gen", name: "Music Gen", desc: "AI background music for videos", icon: Music, color: "#fbbf24", tag: "MusicGen" },
  { id: "voice-clone", name: "Voice Clone", desc: "Clone voice from 6 sec audio", icon: Volume2, color: "#fb923c", tag: "XTTS v2" },
  { id: "train-lora", name: "Brand LoRA", desc: "Train custom image style models", icon: Brain, color: "#e879f9", tag: "LoRA", badge: "Business+" },
  { id: "batch-gen", name: "Batch Generate", desc: "50+ images in one go", icon: Layers, color: "#22d3ee", tag: "FLUX/SDXL" },
] as const;

type ToolId = typeof TOOLS[number]["id"];

export default function AIStudioPage() {
  const supabaseMain = useMemo(() => createClient(), []);
  const [activeTool, setActiveTool] = useState<ToolId>("transcribe");
  // Ref on the active-tool panel — used by the tile grid to scroll the
  // panel into view when the user picks a tile. Without this, clicks on
  // tiles look dead because the tool panel is rendered far below the
  // grid (off-screen by ~600 px) and the active-tile gold border is
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

  // Guided Mode ↔ Advanced Mode (full tool grid)
  const [advancedMode, setAdvancedMode] = useAdvancedMode("ai-studio");
  const [guidedStep, setGuidedStep] = useState(0);
  const [guidedIntent, setGuidedIntent] = useState<ToolId>("image-gen");
  const [guidedPrompt, setGuidedPrompt] = useState("");

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

  // ── Handoff consumer — ?handoff= opens the image-gen tool in edit mode ──
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
        toast.success("Image loaded — adjust settings and regenerate");
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
    <MotionPage className="p-6 max-w-7xl mx-auto">
      <PageHero
        className="mb-6"
        icon={<Sparkles size={28} />}
        title="AI Studio"
        subtitle="Generate images, upscale photos, clone voices. All in one place."
        gradient="ocean"
        actions={
          <div className="flex flex-wrap items-center justify-end gap-2">
            <AdvancedToggle value={advancedMode} onChange={setAdvancedMode} />
            {advancedMode && (
              <button
                onClick={() => {
                  setActiveTool("image-gen");
                  setCreationWizardOpen(true);
                }}
                className="relative flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gradient-to-r from-gold to-amber-500 text-black text-xs font-bold shadow-lg shadow-gold/20 hover:shadow-gold/40 hover-lift transition-all"
              >
                <Sparkles size={12} className="animate-pulse" />
                + New with AI
                <span className="ml-0.5 text-[8px] uppercase bg-black/20 px-1.5 py-0.5 rounded-full font-semibold tracking-wider">
                  Recommended
                </span>
              </button>
            )}
            <span className="text-[10px] text-white bg-white/10 border border-white/20 px-2 py-1 rounded-lg">
              9 tools available
            </span>
          </div>
        }
      />

      {/* Guided Mode — simple routing flow */}
      {!advancedMode && (
        <Wizard
          className="mb-6"
          steps={[
            {
              id: "intent",
              title: "What do you want to make?",
              description: "Pick the thing — we'll hand you the right tool with the right defaults.",
              icon: <Sparkles size={18} />,
              component: (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2.5">
                  {TOOLS.map(t => {
                    const Icon = t.icon;
                    const selected = guidedIntent === t.id;
                    return (
                      <button
                        key={t.id}
                        onClick={() => { setGuidedIntent(t.id); setActiveTool(t.id); }}
                        className={`relative text-left p-4 rounded-xl border transition-all ${
                          selected ? "border-gold bg-gold/10 shadow-lg shadow-gold/10" : "border-border hover:border-gold/30 bg-surface-light"
                        }`}
                      >
                        {"badge" in t && t.badge && (
                          <span className="absolute top-2 right-2 text-[8px] font-bold px-1.5 py-0.5 rounded-full bg-purple-500/20 text-purple-400">
                            {t.badge}
                          </span>
                        )}
                        <div className="w-10 h-10 rounded-lg flex items-center justify-center mb-2" style={{ background: `${t.color}22` }}>
                          <Icon size={20} style={{ color: t.color }} />
                        </div>
                        <p className="text-sm font-bold">{t.name}</p>
                        <p className="text-[10px] text-muted mt-0.5 line-clamp-2">{t.desc}</p>
                      </button>
                    );
                  })}
                </div>
              ),
            },
            {
              id: "prompt",
              title: guidedIntent === "transcribe" || guidedIntent === "upscale" || guidedIntent === "remove-bg" || guidedIntent === "voice-clone" || guidedIntent === "img-to-video" || guidedIntent === "train-lora"
                ? "Ready to upload?"
                : "Describe what you want",
              description: guidedIntent === "transcribe" || guidedIntent === "upscale" || guidedIntent === "remove-bg" || guidedIntent === "voice-clone" || guidedIntent === "img-to-video" || guidedIntent === "train-lora"
                ? "We'll hand you the upload tool. You'll be able to drop files on the next screen."
                : "One line is enough. The more detail, the better the output.",
              icon: <TypeIcon size={18} />,
              optional: true,
              component: guidedIntent === "image-gen" || guidedIntent === "music-gen" || guidedIntent === "batch-gen" ? (
                <textarea
                  value={guidedPrompt}
                  onChange={e => setGuidedPrompt(e.target.value)}
                  placeholder={
                    guidedIntent === "music-gen"
                      ? "e.g., Chill lofi beat with warm piano and soft drums, 60 seconds"
                      : guidedIntent === "batch-gen"
                      ? "e.g., 10 product shots of a leather wallet on neutral backgrounds"
                      : "e.g., A minimalist logo mockup on a black marble surface, studio lighting"
                  }
                  rows={4}
                  className="w-full px-4 py-3 rounded-xl bg-surface-light border border-border text-sm focus:outline-none focus:border-gold/50 focus:ring-2 focus:ring-gold/20 transition-all resize-none"
                  autoFocus
                />
              ) : (
                <div className="card bg-gold/[0.04] border-gold/20 text-center py-8">
                  <Upload size={28} className="mx-auto mb-2 text-gold" />
                  <p className="text-sm font-semibold">
                    {TOOLS.find(t => t.id === guidedIntent)?.name} uses files — hit Finish to open the tool.
                  </p>
                </div>
              ),
            },
            {
              id: "go",
              title: "Ready to go?",
              description: "We'll take you to the tool with everything pre-filled.",
              icon: <Wand2 size={18} />,
              component: (
                <div className="card bg-gold/[0.04] border-gold/20 space-y-2">
                  <div className="flex items-center gap-2">
                    {(() => {
                      const t = TOOLS.find(x => x.id === guidedIntent);
                      if (!t) return null;
                      const Icon = t.icon;
                      return (
                        <>
                          <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: `${t.color}22` }}>
                            <Icon size={16} style={{ color: t.color }} />
                          </div>
                          <div>
                            <p className="text-sm font-bold">{t.name}</p>
                            <p className="text-[10px] text-muted">{t.tag}</p>
                          </div>
                        </>
                      );
                    })()}
                  </div>
                  {guidedPrompt && (
                    <p className="text-[11px] text-muted pt-2 border-t border-border/50 line-clamp-3">
                      <span className="text-gold font-semibold">Prompt:</span> {guidedPrompt}
                    </p>
                  )}
                </div>
              ),
            },
          ]}
          activeIdx={guidedStep}
          onStepChange={setGuidedStep}
          finishLabel="Open tool"
          onFinish={() => {
            setActiveTool(guidedIntent);
            if (guidedIntent === "image-gen" && guidedPrompt.trim()) {
              setImageGenInit({
                prompt: guidedPrompt,
                style: "",
                size: "1024x1024",
                autoGenerateToken: Date.now(),
              });
            }
            setAdvancedMode(true);
            toast.success(`Opening ${TOOLS.find(t => t.id === guidedIntent)?.name}…`);
          }}
          onCancel={() => setAdvancedMode(true)}
          cancelLabel="Advanced mode"
        />
      )}

      {advancedMode && (
      <>
      {/* Rolling preview of AI-generated examples */}
      <div className="relative rounded-2xl overflow-hidden border border-border bg-surface-light/30 py-6 mb-6">
        <div className="absolute inset-0 pointer-events-none">
          <RollingPreview
            items={AI_STUDIO_PREVIEW_FALLBACK}
            rows={2}
            aspectRatio="16:9"
            opacity={0.35}
            speed="medium"
          />
        </div>
        <div className="relative text-center px-4">
          <p className="text-[11px] uppercase tracking-widest text-gold/80 font-semibold">
            Example generations
          </p>
          <h3 className="text-lg font-bold text-foreground mt-1">
            From a one-line prompt to a hero image
          </h3>
          <p className="text-xs text-muted max-w-md mx-auto mt-1">
            FLUX, SDXL, DALL-E, upscale, remove-bg, voice clone — everything
            under one roof with your brand LoRA baked in.
          </p>
        </div>
      </div>

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

      {/* Wizard results — show inline once produced so they don't disappear when modal closes */}
      {wizardImages.length > 0 && (
        <div className="bg-surface border border-gold/30 rounded-2xl p-4 mb-6">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Sparkles size={14} className="text-gold" />
              <h3 className="text-sm font-semibold text-foreground">Latest wizard generation</h3>
              <span className="text-[10px] text-muted">{wizardImages.length} image{wizardImages.length > 1 ? "s" : ""}</span>
            </div>
            <button
              onClick={() => setWizardImages([])}
              className="text-[10px] text-muted hover:text-foreground"
            >
              Clear
            </button>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {wizardImages.map((img, i) => (
              <a key={i} href={img.url} target="_blank" rel="noopener noreferrer" className="block bg-black rounded-lg overflow-hidden">
                <SafeThumb
                  src={img.url}
                  alt={`Wizard ${i + 1}`}
                  className="w-full"
                  style={{ aspectRatio: `${img.width} / ${img.height}` }}
                  wrapperClassName="w-full"
                />
              </a>
            ))}
          </div>
        </div>
      )}

      {/* Tool grid */}
      <motion.div
        className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6"
        initial="hidden"
        animate="visible"
        variants={{ hidden: {}, visible: { transition: { staggerChildren: 0.04 } } }}
      >
        {TOOLS.map(tool => {
          const Icon = tool.icon;
          const active = activeTool === tool.id;
          return (
            <motion.button
              key={tool.id}
              variants={{
                hidden: { opacity: 0, y: 12 },
                visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.22, 1, 0.36, 1] } },
              }}
              whileHover={{ y: -3 }}
              onClick={() => {
                setActiveTool(tool.id);
                // Scroll the tool panel into view so users actually see
                // their click "do" something. setTimeout(0) lets React
                // commit the new panel render first, then we scroll.
                setTimeout(() => {
                  toolPanelRef.current?.scrollIntoView({
                    behavior: "smooth",
                    block: "start",
                  });
                }, 0);
              }}
              className={`relative text-left p-3 rounded-xl border transition-all ${
                // Active state was border-gold/30 + bg-gold/[0.04] — too
                // subtle to read as "you picked this". Bumped to a full
                // gold border + 2x ring + denser bg so the active tile
                // visibly pops out of the grid on click.
                active
                  ? "border-gold ring-2 ring-gold/40 bg-gold/[0.12] shadow-lg shadow-gold/10"
                  : "border-border bg-surface hover:bg-surface-light"
              }`}
            >
              {"badge" in tool && tool.badge && (
                <span className="absolute top-2 right-2 text-[8px] font-bold px-1.5 py-0.5 rounded-full bg-purple-500/20 text-purple-400">
                  {tool.badge}
                </span>
              )}
              <div className="flex items-center gap-2 mb-1.5">
                <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: `${tool.color}18` }}>
                  <Icon size={14} style={{ color: tool.color }} />
                </div>
                <span className="text-xs font-semibold text-foreground">{tool.name}</span>
              </div>
              <p className="text-[10px] text-muted leading-relaxed">{tool.desc}</p>
              <span className="inline-block mt-1.5 text-[8px] font-mono px-1.5 py-0.5 rounded bg-surface-light text-muted">
                {tool.tag}
              </span>
            </motion.button>
          );
        })}
      </motion.div>

      {/* Active tool panel — ref'd by the tile-click handler so the
          page auto-scrolls here when the user picks a different tool.
          The scroll-margin-top keeps a comfortable gap below the
          sticky-ish nav after the smooth scroll lands. */}
      <div
        ref={toolPanelRef}
        className="bg-surface border border-border rounded-2xl p-5 scroll-mt-6"
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
      </div>
      </>
      )}
    </MotionPage>
  );
}

// ── Shared types for tool props ──────────────────────────────────
interface ToolProps {
  processing: boolean;
  setProcessing: (v: boolean) => void;
  history?: JobResult[];
  setHistory?: (v: JobResult[]) => void;
}

// ── TRANSCRIBE TOOL ──────────────────────────────────────────────
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
      } else {
        toast.error(data.error || "Failed");
      }
    } catch { toast.error("Transcription failed"); }
    setProcessing(false);
  };

  return (
    <div>
      <div className="flex items-center gap-2 mb-4">
        <Mic size={16} className="text-blue-400" />
        <h2 className="text-sm font-bold text-foreground">Speech to Text</h2>
        <span className="text-[9px] bg-blue-500/10 text-blue-400 px-2 py-0.5 rounded-full">Whisper Large V3</span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Input */}
        <div>
          <div
            onClick={() => fileRef.current?.click()}
            className="border-2 border-dashed border-border rounded-xl p-8 text-center cursor-pointer hover:border-blue-400/30 hover:bg-blue-400/[0.02] transition-all"
          >
            <input ref={fileRef} type="file" accept="audio/*,video/*" className="hidden" onChange={e => setFile(e.target.files?.[0] || null)} />
            <Upload size={24} className="mx-auto mb-2 text-muted" />
            <p className="text-xs text-foreground font-medium">{file ? file.name : "Drop audio/video file"}</p>
            <p className="text-[10px] text-muted mt-1">MP3, WAV, MP4, WebM, M4A, OGG, FLAC</p>
          </div>

          <div className="flex items-center gap-3 mt-3">
            <select value={language} onChange={e => setLanguage(e.target.value)}
              className="flex-1 text-xs bg-surface-light border border-border rounded-lg px-3 py-2 text-foreground">
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
            <button onClick={handleTranscribe} disabled={processing || !file}
              className="px-4 py-2 bg-blue-500 text-white text-xs font-semibold rounded-lg hover:bg-blue-600 disabled:opacity-40 flex items-center gap-1.5">
              {processing ? <Loader size={12} className="animate-spin" /> : <Play size={12} />}
              Transcribe
            </button>
          </div>
        </div>

        {/* Output */}
        <div className="bg-surface-light rounded-xl p-4 min-h-[200px]">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-foreground">Transcript</span>
            {transcript && (
              <button onClick={() => { navigator.clipboard.writeText(transcript); toast.success("Copied"); }}
                className="text-[10px] text-muted hover:text-foreground flex items-center gap-1">
                <Copy size={10} /> Copy
              </button>
            )}
          </div>
          {transcript ? (
            <div className="space-y-2">
              <p className="text-xs text-foreground leading-relaxed whitespace-pre-wrap">{transcript}</p>
              {segments.length > 0 && (
                <div className="mt-3 pt-3 border-t border-border">
                  <p className="text-[10px] font-semibold text-muted mb-2">Timestamps</p>
                  <div className="space-y-1 max-h-[200px] overflow-y-auto">
                    {segments.slice(0, 20).map((seg, i) => (
                      <div key={i} className="flex gap-2 text-[10px]">
                        <span className="text-muted font-mono shrink-0">{formatTime(seg.start)}</span>
                        <span className="text-foreground">{seg.text}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <p className="text-xs text-muted">Upload a file and click Transcribe to get started.</p>
          )}
        </div>
      </div>
    </div>
  );
}

// ── IMAGE GEN TOOL ──────────────────────────────────────────────
interface ImageGenInit {
  prompt?: string;
  style?: string;
  size?: string;
  autoGenerateToken?: number;
}

function ImageGenTool({ processing, setProcessing, initial }: ToolProps & { initial?: ImageGenInit }) {
  const router = useRouter();
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

  // Sync incoming initial from wizard — overwrite current values and auto-run
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
    } catch { toast.error("Generation failed"); }
    setProcessing(false);
  };

  const handleGenerate = () => runGenerate();

  // Keep ref up to date so the auto-run effect can call the latest handler
  runGenerateRef.current = runGenerate;

  return (
    <div>
      <div className="flex items-center gap-2 mb-4">
        <Palette size={16} className="text-indigo-400" />
        <h2 className="text-sm font-bold text-foreground">Image Generator</h2>
        <span className="text-[9px] bg-indigo-500/10 text-indigo-400 px-2 py-0.5 rounded-full">FLUX / DALL-E</span>
      </div>

      {setupRequired && (
        <div className="mb-4 p-3 rounded-xl border border-yellow-500/20 bg-yellow-500/5 flex items-start gap-2">
          <AlertTriangle size={14} className="text-yellow-400 mt-0.5 shrink-0" />
          <div>
            <p className="text-xs font-medium text-yellow-400">Setup Required</p>
            <p className="text-[10px] text-muted mt-0.5">
              Configure REPLICATE_API_TOKEN, RUNPOD_API_KEY, or OPENAI_API_KEY in your environment to enable image generation.
            </p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-3">
          <textarea
            value={prompt}
            onChange={e => setPrompt(e.target.value)}
            placeholder="Describe the image you want to create... e.g. 'A modern tech startup office with warm lighting, clean desks, and large windows overlooking a city skyline'"
            className="w-full h-24 text-xs bg-surface-light border border-border rounded-xl px-3 py-2 text-foreground resize-none"
          />

          <div>
            <span className="text-[10px] text-muted mb-1 block">Style</span>
            <div className="flex flex-wrap gap-1.5">
              {styles.map(s => (
                <button key={s.value} onClick={() => setStyle(s.value)}
                  className={`text-[10px] px-2.5 py-1 rounded-lg ${
                    style === s.value
                      ? "bg-indigo-500 text-white font-semibold"
                      : "bg-surface-light text-muted"
                  }`}>{s.label}</button>
              ))}
            </div>
          </div>

          <div>
            <span className="text-[10px] text-muted mb-1 block">Aspect Ratio</span>
            <div className="flex gap-1.5">
              {sizes.map(s => (
                <button key={s.value} onClick={() => setSize(s.value)}
                  className={`text-[10px] px-2.5 py-1 rounded-lg ${
                    size === s.value
                      ? "bg-indigo-500 text-white font-semibold"
                      : "bg-surface-light text-muted"
                  }`}>{s.label}</button>
              ))}
            </div>
          </div>

          <button onClick={handleGenerate} disabled={processing || !prompt.trim()}
            className="w-full px-4 py-2.5 bg-indigo-500 text-white text-xs font-semibold rounded-lg hover:bg-indigo-600 disabled:opacity-40 flex items-center justify-center gap-1.5">
            {processing ? <Loader size={12} className="animate-spin" /> : <Sparkles size={12} />}
            Generate Image
          </button>
        </div>

        <div className="bg-surface-light rounded-xl p-4 min-h-[200px] flex items-center justify-center">
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
                      className="inline-flex items-center gap-1 text-[10px] text-indigo-400 hover:underline">
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
                      className="inline-flex items-center gap-1 text-[10px] text-indigo-400 hover:underline disabled:opacity-40"
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
              <Palette size={32} className="mx-auto mb-2 text-muted/30" />
              <p className="text-xs text-muted">Generated image will appear here</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── UPSCALE TOOL ─────────────────────────────────────────────────
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
      } else {
        toast.error(data.error || "Failed");
      }
    } catch { toast.error("Upscale failed"); }
    setProcessing(false);
  };

  return (
    <div>
      <div className="flex items-center gap-2 mb-4">
        <ArrowUpRight size={16} className="text-green-400" />
        <h2 className="text-sm font-bold text-foreground">AI Image Upscaler</h2>
        <span className="text-[9px] bg-green-500/10 text-green-400 px-2 py-0.5 rounded-full">Real-ESRGAN</span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <div onClick={() => fileRef.current?.click()}
            className="border-2 border-dashed border-border rounded-xl p-8 text-center cursor-pointer hover:border-green-400/30 transition-all">
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])} />
            {preview ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img src={preview} alt="Preview" className="max-h-[200px] mx-auto rounded-lg" />
            ) : (
              <>
                <ImagePlus size={24} className="mx-auto mb-2 text-muted" />
                <p className="text-xs text-foreground font-medium">Drop image to upscale</p>
                <p className="text-[10px] text-muted mt-1">JPG, PNG, WebP — max 20MB</p>
              </>
            )}
          </div>

          <div className="flex items-center gap-3 mt-3">
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-muted">Scale:</span>
              {[2, 4].map(s => (
                <button key={s} onClick={() => setScale(s)}
                  className={`text-xs px-2.5 py-1 rounded-lg font-medium ${scale === s ? "bg-green-500 text-white" : "bg-surface-light text-muted"}`}>
                  {s}x
                </button>
              ))}
            </div>
            <label className="flex items-center gap-1.5 cursor-pointer">
              <input type="checkbox" checked={faceEnhance} onChange={e => setFaceEnhance(e.target.checked)} className="w-3 h-3 rounded" />
              <span className="text-[10px] text-muted">Face enhance</span>
            </label>
            <button onClick={handleUpscale} disabled={processing || !file}
              className="ml-auto px-4 py-2 bg-green-500 text-white text-xs font-semibold rounded-lg hover:bg-green-600 disabled:opacity-40 flex items-center gap-1.5">
              {processing ? <Loader size={12} className="animate-spin" /> : <Wand2 size={12} />}
              Upscale
            </button>
          </div>
        </div>

        <div className="bg-surface-light rounded-xl p-4 min-h-[200px] flex items-center justify-center">
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
            <p className="text-xs text-muted">Upscaled result will appear here</p>
          )}
        </div>
      </div>
    </div>
  );
}

// ── REMOVE BG TOOL ───────────────────────────────────────────────
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
      } else {
        toast.error(data.error || "Failed");
      }
    } catch { toast.error("Failed"); }
    setProcessing(false);
  };

  return (
    <div>
      <div className="flex items-center gap-2 mb-4">
        <Scissors size={16} className="text-pink-400" />
        <h2 className="text-sm font-bold text-foreground">Background Remover</h2>
        <span className="text-[9px] bg-pink-500/10 text-pink-400 px-2 py-0.5 rounded-full">REMBG / SAM</span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <div onClick={() => fileRef.current?.click()}
            className="border-2 border-dashed border-border rounded-xl p-8 text-center cursor-pointer hover:border-pink-400/30 transition-all">
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) { setFile(f); setPreview(URL.createObjectURL(f)); setResult(null); } }} />
            {preview ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img src={preview} alt="" className="max-h-[200px] mx-auto rounded-lg" />
            ) : (
              <>
                <Scissors size={24} className="mx-auto mb-2 text-muted" />
                <p className="text-xs text-foreground font-medium">Drop image</p>
                <p className="text-[10px] text-muted mt-1">JPG, PNG, WebP — max 15MB</p>
              </>
            )}
          </div>
          <div className="flex items-center gap-3 mt-3">
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-muted">BG Color:</span>
              <button onClick={() => setBgColor("")} className={`w-6 h-6 rounded border ${!bgColor ? "border-pink-400" : "border-border"}`}
                style={{ background: "repeating-conic-gradient(#808080 0% 25%, transparent 0% 50%) 50% / 8px 8px" }} title="Transparent" />
              {["#ffffff", "#000000", "#f0f0f0"].map(c => (
                <button key={c} onClick={() => setBgColor(c)} className={`w-6 h-6 rounded border ${bgColor === c ? "border-pink-400" : "border-border"}`}
                  style={{ background: c }} />
              ))}
              <input type="color" value={bgColor || "#ffffff"} onChange={e => setBgColor(e.target.value)} className="w-6 h-6 rounded cursor-pointer" />
            </div>
            <button onClick={handleRemoveBg} disabled={processing || !file}
              className="ml-auto px-4 py-2 bg-pink-500 text-white text-xs font-semibold rounded-lg hover:bg-pink-600 disabled:opacity-40 flex items-center gap-1.5">
              {processing ? <Loader size={12} className="animate-spin" /> : <Scissors size={12} />}
              Remove BG
            </button>
          </div>
        </div>
        <div className="bg-surface-light rounded-xl p-4 min-h-[200px] flex items-center justify-center"
          style={{ background: !result ? undefined : bgColor ? bgColor : "repeating-conic-gradient(#e0e0e0 0% 25%, #f8f8f8 0% 50%) 50% / 16px 16px" }}>
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
            <p className="text-xs text-muted">Result with transparent background</p>
          )}
        </div>
      </div>
    </div>
  );
}

// ── IMAGE TO VIDEO TOOL ──────────────────────────────────────────
function ImgToVideoTool({ processing, setProcessing }: ToolProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [motion, setMotion] = useState(127);
  const [fps, setFps] = useState(6);
  const [result, setResult] = useState<string | null>(null);

  const handleGenerate = async () => {
    if (!file) return toast.error("Upload an image first");
    setProcessing(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("motion_bucket", String(motion));
      fd.append("fps", String(fps));
      const res = await fetch("/api/ai/img-to-video", { method: "POST", body: fd });
      const data = await res.json();
      if (data.video) {
        setResult(data.video.startsWith("data:") ? data.video : data.video);
        toast.success("Video generated!");
      } else if (data.job_id) {
        toast.success("Processing... this takes 30-60 seconds");
      } else {
        toast.error(data.error || "Failed");
      }
    } catch { toast.error("Failed"); }
    setProcessing(false);
  };

  return (
    <div>
      <div className="flex items-center gap-2 mb-4">
        <Film size={16} className="text-purple-400" />
        <h2 className="text-sm font-bold text-foreground">Image to Video</h2>
        <span className="text-[9px] bg-purple-500/10 text-purple-400 px-2 py-0.5 rounded-full">Stable Video Diffusion</span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <div onClick={() => fileRef.current?.click()}
            className="border-2 border-dashed border-border rounded-xl p-8 text-center cursor-pointer hover:border-purple-400/30 transition-all">
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) { setFile(f); setPreview(URL.createObjectURL(f)); setResult(null); } }} />
            {preview ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img src={preview} alt="" className="max-h-[200px] mx-auto rounded-lg" />
            ) : (
              <>
                <Film size={24} className="mx-auto mb-2 text-muted" />
                <p className="text-xs text-foreground font-medium">Drop still image to animate</p>
                <p className="text-[10px] text-muted mt-1">Product shots, logos, hero images</p>
              </>
            )}
          </div>
          <div className="mt-3 space-y-2">
            <div className="flex items-center gap-3">
              <span className="text-[10px] text-muted w-16">Motion:</span>
              <input type="range" min={1} max={255} value={motion} onChange={e => setMotion(Number(e.target.value))}
                className="flex-1 h-1 accent-purple-500" />
              <span className="text-[10px] text-muted w-8">{motion}</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-[10px] text-muted w-16">FPS:</span>
              {[6, 12, 24].map(f => (
                <button key={f} onClick={() => setFps(f)}
                  className={`text-xs px-2 py-1 rounded ${fps === f ? "bg-purple-500 text-white" : "bg-surface-light text-muted"}`}>{f}</button>
              ))}
            </div>
          </div>
          <button onClick={handleGenerate} disabled={processing || !file}
            className="w-full mt-3 px-4 py-2.5 bg-purple-500 text-white text-xs font-semibold rounded-lg hover:bg-purple-600 disabled:opacity-40 flex items-center justify-center gap-1.5">
            {processing ? <Loader size={12} className="animate-spin" /> : <Play size={12} />}
            Animate Image
          </button>
        </div>
        <div className="bg-surface-light rounded-xl p-4 min-h-[200px] flex items-center justify-center">
          {result ? (
            <video src={result} controls autoPlay loop muted className="max-h-[300px] rounded-lg" />
          ) : (
            <p className="text-xs text-muted">Animated video will appear here</p>
          )}
        </div>
      </div>
    </div>
  );
}

// ── MUSIC GEN TOOL ───────────────────────────────────────────────
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
    } catch { toast.error("Failed"); }
    setProcessing(false);
  };

  return (
    <div>
      <div className="flex items-center gap-2 mb-4">
        <Music size={16} className="text-yellow-400" />
        <h2 className="text-sm font-bold text-foreground">AI Music Generator</h2>
        <span className="text-[9px] bg-yellow-500/10 text-yellow-400 px-2 py-0.5 rounded-full">MusicGen</span>
        <span className="text-[9px] text-muted ml-auto">Royalty-free output</span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-3">
          <textarea value={prompt} onChange={e => setPrompt(e.target.value)} placeholder="Describe the music... e.g. 'upbeat background music with light drums and synth pads for a tech product video'"
            className="w-full h-20 text-xs bg-surface-light border border-border rounded-xl px-3 py-2 text-foreground resize-none" />

          <div>
            <span className="text-[10px] text-muted mb-1 block">Mood</span>
            <div className="flex flex-wrap gap-1.5">
              {moods.map(m => (
                <button key={m} onClick={() => setMood(m)}
                  className={`text-[10px] px-2.5 py-1 rounded-lg capitalize ${mood === m ? "bg-yellow-500 text-black font-semibold" : "bg-surface-light text-muted"}`}>{m}</button>
              ))}
            </div>
          </div>

          <div>
            <span className="text-[10px] text-muted mb-1 block">Genre</span>
            <div className="flex flex-wrap gap-1.5">
              {genres.map(g => (
                <button key={g} onClick={() => setGenre(g)}
                  className={`text-[10px] px-2.5 py-1 rounded-lg capitalize ${genre === g ? "bg-yellow-500 text-black font-semibold" : "bg-surface-light text-muted"}`}>{g}</button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-[10px] text-muted">Duration:</span>
            <input type="range" min={5} max={30} value={duration} onChange={e => setDuration(Number(e.target.value))}
              className="flex-1 h-1 accent-yellow-500" />
            <span className="text-xs text-foreground font-mono">{duration}s</span>
          </div>

          <button onClick={handleGenerate} disabled={processing || !prompt}
            className="w-full px-4 py-2.5 bg-yellow-500 text-black text-xs font-semibold rounded-lg hover:bg-yellow-400 disabled:opacity-40 flex items-center justify-center gap-1.5">
            {processing ? <Loader size={12} className="animate-spin" /> : <Music size={12} />}
            Generate Music
          </button>
        </div>

        <div className="bg-surface-light rounded-xl p-4 min-h-[200px] flex flex-col items-center justify-center">
          {result ? (
            <div className="w-full text-center space-y-3">
              <div className="w-16 h-16 mx-auto rounded-full bg-yellow-500/10 flex items-center justify-center">
                <Music size={24} className="text-yellow-400" />
              </div>
              <audio src={result} controls className="w-full" />
              <a href={result} download="ai-music.wav"
                className="inline-flex items-center gap-1 text-[10px] text-yellow-400 hover:underline">
                <Download size={10} /> Download WAV
              </a>
            </div>
          ) : (
            <p className="text-xs text-muted">Generated music will play here</p>
          )}
        </div>
      </div>
    </div>
  );
}

// ── VOICE CLONE TOOL ─────────────────────────────────────────────
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
    } catch { toast.error("Clone failed"); }
    setProcessing(false);
  };

  const handleSpeak = async () => {
    if (!text) return toast.error("Enter text to speak");
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
    } catch { toast.error("Failed"); }
    setProcessing(false);
  };

  return (
    <div>
      <div className="flex items-center gap-2 mb-4">
        <Volume2 size={16} className="text-orange-400" />
        <h2 className="text-sm font-bold text-foreground">Voice Clone + TTS</h2>
        <span className="text-[9px] bg-orange-500/10 text-orange-400 px-2 py-0.5 rounded-full">XTTS v2</span>
      </div>

      <div className="flex gap-2 mb-4">
        {(["clone", "speak"] as const).map(m => (
          <button key={m} onClick={() => setMode(m)}
            className={`text-xs px-3 py-1.5 rounded-lg font-medium capitalize ${mode === m ? "bg-orange-500 text-white" : "bg-surface-light text-muted"}`}>
            {m === "clone" ? "Clone Voice" : "Generate Speech"}
          </button>
        ))}
      </div>

      {mode === "clone" ? (
        <div className="space-y-3">
          <div onClick={() => fileRef.current?.click()}
            className="border-2 border-dashed border-border rounded-xl p-6 text-center cursor-pointer hover:border-orange-400/30 transition-all">
            <input ref={fileRef} type="file" accept="audio/*" multiple className="hidden" onChange={e => {
              const files = Array.from(e.target.files || []);
              if (files.length) setVoiceFiles(prev => [...prev, ...files]);
              e.target.value = "";
            }} />
            <FileAudio size={24} className="mx-auto mb-2 text-muted" />
            <p className="text-xs text-foreground font-medium">{voiceFiles.length > 0 ? `${voiceFiles.length} sample${voiceFiles.length > 1 ? "s" : ""} selected` : "Upload voice samples (6+ seconds each)"}</p>
            <p className="text-[10px] text-muted mt-1">Clone multiple voices in one batch</p>
          </div>
          {voiceFiles.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {voiceFiles.map((f, i) => (
                <div key={i} className="flex items-center gap-1 bg-surface-light border border-border rounded-lg px-2 py-1 text-[10px] text-foreground">
                  <FileAudio size={10} className="text-orange-400" />
                  <span className="truncate max-w-[120px]">{f.name}</span>
                  <button onClick={() => setVoiceFiles(prev => prev.filter((_, j) => j !== i))} className="text-muted hover:text-red-400" aria-label={`Remove ${f.name}`}>
                    <X size={10} />
                  </button>
                </div>
              ))}
            </div>
          )}
          <input value={voiceName} onChange={e => setVoiceName(e.target.value)} placeholder="Voice name (e.g. 'Client - John')"
            className="w-full text-xs bg-surface-light border border-border rounded-lg px-3 py-2 text-foreground" />
          <button onClick={handleClone} disabled={processing || voiceFiles.length === 0}
            className="w-full px-4 py-2.5 bg-orange-500 text-white text-xs font-semibold rounded-lg disabled:opacity-40 flex items-center justify-center gap-1.5">
            {processing ? <Loader size={12} className="animate-spin" /> : <Volume2 size={12} />}
            Clone {voiceFiles.length > 1 ? `${voiceFiles.length} Voices` : "Voice"}
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-3">
            {savedVoices.length > 0 && (
              <select value={selectedVoice} onChange={e => setSelectedVoice(e.target.value)}
                className="w-full text-xs bg-surface-light border border-border rounded-lg px-3 py-2 text-foreground">
                <option value="">Use reference audio</option>
                {savedVoices.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
              </select>
            )}
            <textarea value={text} onChange={e => setText(e.target.value)} placeholder="Enter text to speak in the cloned voice..."
              className="w-full h-32 text-xs bg-surface-light border border-border rounded-xl px-3 py-2 text-foreground resize-none" />
            <button onClick={handleSpeak} disabled={processing || !text}
              className="w-full px-4 py-2.5 bg-orange-500 text-white text-xs font-semibold rounded-lg disabled:opacity-40 flex items-center justify-center gap-1.5">
              {processing ? <Loader size={12} className="animate-spin" /> : <Play size={12} />}
              Generate Speech
            </button>
          </div>
          <div className="bg-surface-light rounded-xl p-4 flex items-center justify-center">
            {result ? (
              <div className="w-full text-center space-y-3">
                <audio src={result} controls className="w-full" />
                <a href={result} download="voice-clone.wav" className="inline-flex items-center gap-1 text-[10px] text-orange-400 hover:underline">
                  <Download size={10} /> Download
                </a>
              </div>
            ) : (
              <p className="text-xs text-muted">Generated speech plays here</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── TRAIN LORA TOOL ──────────────────────────────────────────────
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
    } catch { toast.error("Failed"); }
    setProcessing(false);
  };

  return (
    <div>
      <div className="flex items-center gap-2 mb-4">
        <Brain size={16} className="text-purple-400" />
        <h2 className="text-sm font-bold text-foreground">Brand LoRA Training</h2>
        <span className="text-[9px] bg-purple-500/10 text-purple-400 px-2 py-0.5 rounded-full">Business+ Only</span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-3">
          <div onClick={() => fileRef.current?.click()}
            className="border-2 border-dashed border-border rounded-xl p-6 text-center cursor-pointer hover:border-purple-400/30 transition-all">
            <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={e => e.target.files && addImages(e.target.files)} />
            <Layers size={24} className="mx-auto mb-2 text-muted" />
            <p className="text-xs text-foreground font-medium">
              {images.length > 0 ? `${images.length} images selected` : "Upload 10-20 reference images"}
            </p>
            <p className="text-[10px] text-muted mt-1">Same style, consistent quality</p>
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
            className="w-full text-xs bg-surface-light border border-border rounded-lg px-3 py-2 text-foreground" />
          <input value={triggerWord} onChange={e => setTriggerWord(e.target.value)} placeholder="Trigger word"
            className="w-full text-xs bg-surface-light border border-border rounded-lg px-3 py-2 text-foreground" />

          <div className="flex items-center gap-3">
            <span className="text-[10px] text-muted">Steps:</span>
            <input type="range" min={500} max={5000} step={100} value={steps} onChange={e => setSteps(Number(e.target.value))}
              className="flex-1 h-1 accent-purple-500" />
            <span className="text-xs text-foreground font-mono">{steps}</span>
          </div>

          <button onClick={handleTrain} disabled={processing || images.length < 5}
            className="w-full px-4 py-2.5 bg-purple-500 text-white text-xs font-semibold rounded-lg disabled:opacity-40 flex items-center justify-center gap-1.5">
            {processing ? <Loader size={12} className="animate-spin" /> : <Zap size={12} />}
            Start Training (~{Math.ceil(steps / 100)} min)
          </button>
        </div>

        <div className="bg-surface-light rounded-xl p-4 min-h-[200px]">
          <h3 className="text-xs font-semibold text-foreground mb-3">How it works</h3>
          <div className="space-y-2">
            {[
              { step: 1, text: "Upload 10-20 images in your client's brand style" },
              { step: 2, text: "Set a trigger word (used in prompts to activate the style)" },
              { step: 3, text: "Training runs on GPU (~15-30 min)" },
              { step: 4, text: "Use the trained LoRA in Design Studio & Thumbnail Generator" },
            ].map(({ step, text }) => (
              <div key={step} className="flex items-start gap-2">
                <div className="w-5 h-5 rounded-full bg-purple-500/10 flex items-center justify-center shrink-0">
                  <span className="text-[9px] font-bold text-purple-400">{step}</span>
                </div>
                <p className="text-[10px] text-muted leading-relaxed">{text}</p>
              </div>
            ))}
          </div>
          {trainingStatus && (
            <div className="mt-4 p-3 rounded-lg bg-purple-500/10 text-xs text-purple-400">
              {trainingStatus}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── BATCH GENERATE TOOL ──────────────────────────────────────────
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
    } catch { toast.error("Failed"); }
    setProcessing(false);
  };

  return (
    <div>
      <div className="flex items-center gap-2 mb-4">
        <Layers size={16} className="text-cyan-400" />
        <h2 className="text-sm font-bold text-foreground">Batch Image Generation</h2>
        <span className="text-[9px] bg-cyan-500/10 text-cyan-400 px-2 py-0.5 rounded-full">FLUX / SDXL</span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-3">
          <div className="space-y-2">
            {prompts.map((p, i) => (
              <div key={i} className="flex gap-2">
                <span className="text-[10px] text-muted mt-2 w-4">{i + 1}.</span>
                <input value={p} onChange={e => { const np = [...prompts]; np[i] = e.target.value; setPrompts(np); }}
                  placeholder="Describe image..."
                  className="flex-1 text-xs bg-surface-light border border-border rounded-lg px-3 py-2 text-foreground" />
                {prompts.length > 1 && (
                  <button onClick={() => setPrompts(prev => prev.filter((_, j) => j !== i))}
                    className="text-muted hover:text-red-400" aria-label={`Remove prompt ${i + 1}`}><X size={12} /></button>
                )}
              </div>
            ))}
          </div>

          <button onClick={() => setPrompts(prev => [...prev, ""])}
            className="text-[10px] text-cyan-400 hover:underline flex items-center gap-1">
            + Add prompt (max 50)
          </button>

          <div className="flex flex-wrap gap-3">
            <div>
              <span className="text-[10px] text-muted block mb-1">Style</span>
              <select value={style} onChange={e => setStyle(e.target.value)}
                className="text-xs bg-surface-light border border-border rounded-lg px-2 py-1.5 text-foreground">
                {styles.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <span className="text-[10px] text-muted block mb-1">Size</span>
              <select value={size} onChange={e => setSize(e.target.value)}
                className="text-xs bg-surface-light border border-border rounded-lg px-2 py-1.5 text-foreground">
                {sizes.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <span className="text-[10px] text-muted block mb-1">Model</span>
              <select value={model} onChange={e => setModel(e.target.value)}
                className="text-xs bg-surface-light border border-border rounded-lg px-2 py-1.5 text-foreground">
                <option value="flux">FLUX.1-dev</option>
                <option value="sdxl">SDXL</option>
              </select>
            </div>
          </div>

          <button onClick={handleGenerate} disabled={processing}
            className="w-full px-4 py-2.5 bg-cyan-500 text-black text-xs font-semibold rounded-lg hover:bg-cyan-400 disabled:opacity-40 flex items-center justify-center gap-1.5">
            {processing ? <Loader size={12} className="animate-spin" /> : <Zap size={12} />}
            Generate {prompts.filter(p => p.trim()).length} Images
          </button>
        </div>

        <div className="bg-surface-light rounded-xl p-4 min-h-[200px]">
          <h3 className="text-xs font-semibold text-foreground mb-3">Queue ({results.length})</h3>
          {results.length > 0 ? (
            <div className="space-y-2 max-h-[300px] overflow-y-auto">
              {results.map((r, i) => (
                <div key={i} className="flex items-center gap-2 p-2 bg-surface rounded-lg">
                  <div className={`w-2 h-2 rounded-full ${
                    r.status === "COMPLETED" ? "bg-green-400" : r.status === "FAILED" ? "bg-red-400" : "bg-yellow-400 animate-pulse"
                  }`} />
                  <span className="text-[10px] text-foreground flex-1 truncate">{r.prompt}</span>
                  <span className="text-[9px] text-muted">{r.status}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-muted">Batch results will appear here</p>
          )}
        </div>
      </div>
    </div>
  );
}

// ── IMAGE CREATION WIZARD (5-step lean flow) ─────────────────────
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
          { value: "profile", label: "Profile picture", emoji: "🪪" },
          { value: "ad", label: "Ad creative", emoji: "📣" },
          { value: "hero", label: "Hero image", emoji: "🖼️" },
          { value: "carousel", label: "Carousel slide", emoji: "🗂️" },
          { value: "thumbnail", label: "Thumbnail", emoji: "▶️" },
          { value: "product", label: "Product shot", emoji: "📦" },
          { value: "illustration", label: "Illustration", emoji: "🎨" },
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
        placeholder: 'e.g. "a confident woman holding a latte in a sunlit café"',
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
              toast.error("No suggestion — try again");
              return {};
            }
            toast.success("Subject suggested!");
            return { subject: suggestion };
          } catch (err) {
            console.error(err);
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
          { value: "photorealistic", label: "Photorealistic", emoji: "📷" },
          { value: "3d_render", label: "3D render", emoji: "🧊" },
          { value: "illustration", label: "Illustration", emoji: "🖌️" },
          { value: "cinematic", label: "Cinematic", emoji: "🎬" },
          { value: "minimalist", label: "Minimalist", emoji: "⚪" },
          { value: "artistic", label: "Artistic", emoji: "🎨" },
          { value: "vaporwave", label: "Vaporwave", emoji: "🌴" },
        ],
      },
    },
    {
      id: "ratio",
      title: "Aspect ratio",
      description: "Pick the dimensions — we'll pass them straight to FLUX.",
      icon: <Ratio size={16} />,
      field: {
        type: "chip-select",
        key: "ratio",
        options: [
          { value: "1024x1024", label: "1:1 square", emoji: "⬛" },
          { value: "1024x1792", label: "9:16 portrait / story", emoji: "📱" },
          { value: "1792x1024", label: "16:9 landscape / thumbnail", emoji: "📺" },
          { value: "896x1120", label: "4:5 post", emoji: "📐" },
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
        placeholder: "Your final prompt — include details about lighting, mood, composition, etc.",
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
              toast.error("Couldn't enhance prompt — try again");
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
            console.error(err);
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
      subtitle="AI-guided 5-step flow — FLUX renders the final image."
      icon={<Sparkles size={18} />}
      submitLabel="Generate Image"
      steps={steps}
      onClose={onClose}
      onComplete={handleComplete}
    />
  );
}

// ── Helper ───────────────────────────────────────────────────────
function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}
