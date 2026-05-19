"use client";

import { useState, useEffect, useMemo } from "react";
import { AnimatePresence, motion } from "framer-motion";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Film, Sparkles, Play, Download,
  Clock, Monitor, Zap, Layers,
  Wand2, Palette, Camera, Music, Type, Lock,
  ChevronDown, ChevronRight, AlertCircle, Edit3, Loader2, Image,
  TrendingUp, Upload, UserCircle, X, Target,
} from "lucide-react";
import toast from "react-hot-toast";
import { useAuth } from "@/lib/auth-context";
import { createClient } from "@/lib/supabase/client";
import CreationWizard, { type WizardStep } from "@/components/creation-wizard";
import SafeThumb from "@/components/safe-thumb";
import { Wizard, AdvancedToggle, useAdvancedMode, type WizardStepDef } from "@/components/ui/wizard";
import {
  limitsForTier,
  formatVideoDuration,
  tierForVideoSeconds,
} from "@/lib/plan-limits";
import { createHandoff, handoffUrl } from "@/lib/ai-handoff";
import { PrismPanel } from "@/components/prism";
import { MotionPage } from "@/components/motion/motion-page";
import PageAgent from "@/components/ui/page-agent";
import SmartBar from "@/components/ui/smart-bar";
import CreatorIntelligence from "@/components/ui/creator-intelligence";
import dynamic from "next/dynamic";

// Lazy-load Remotion player — browser-only, heavy (~200 KB), only needed
// when a user clicks "Preview overlay" on a completed video.
const RemotionOverlayPlayer = dynamic(
  () => import("@/components/video-editor/remotion-overlay-player"),
  { ssr: false, loading: () => <div className="h-64 flex items-center justify-center text-text-muted text-xs"><Loader2 size={14} className="animate-spin mr-2" /> Loading preview…</div> },
);

// Lazy-load template picker — only shown in advanced mode.
const TemplatePicker = dynamic(
  () => import("@/components/video-editor/template-picker"),
  { ssr: false },
);

const PROMPT_IDEAS = [
  "A golden retriever running through a field of sunflowers at sunset, cinematic lighting",
  "Drone shot of ocean waves crashing on a rocky coast, slow motion, 4K",
  "Abstract neon particles flowing in slow motion, dark background, vibrant colors",
  "Coffee being poured into a glass cup in slow motion, warm lighting, close-up",
  "City skyline timelapse from day to night, lights turning on, clouds moving",
  "Person walking through a misty forest, morning light rays through trees",
  "Product showcase of a phone on a reflective surface, rotating 360 degrees",
  "Colorful paint splashing in slow motion against white background",
];

// Named prompt categories � chips fill a strong, production-ready prompt on click.
// Each label is =12 chars so chips stay compact in one row on mobile.
const PROMPT_CATEGORIES = [
  {
    label: "Product demo",
    icon: "??",
    prompt: "Product showcase: sleek smartphone rotating on a dark reflective surface, studio lighting, dramatic shadows, 4K cinematic close-up revealing every detail",
  },
  {
    label: "Cinematic landscape",
    icon: "??",
    prompt: "Drone flying low over golden wheat fields at magic hour, long shadows stretching across the land, slow push-in revealing a farmhouse in the distance, 4K wide angle",
  },
  {
    label: "Abstract art",
    icon: "??",
    prompt: "Abstract liquid metal morphing into geometric shapes, iridescent surface, slow motion, dark void background, ultra high definition macro lens",
  },
  {
    label: "Social ad",
    icon: "??",
    prompt: "Vertical social ad: confident person holding a product, clean white background, warm natural light, quick dynamic cuts between close-up and lifestyle shots, 9:16 format",
  },
];

// Icon-first model picker � all backed by the same Higgsfield/RunPod pipeline.
// Changing the "style" here adjusts the downstream prompt enhancement, it does
// NOT change the actual model endpoint (that still goes through /api/video/render).
const MODELS = [
  { id: "cinematic", name: "Cinematic", sub: "Film-like grade", icon: Film,    preview: "linear-gradient(90deg,#0d0d14 0%,#1a2340 40%,#3d5a7a 70%,#8fa8be 100%)", viralScore: 78, ctrTier: "high"   as const },
  { id: "realistic", name: "Realistic", sub: "Documentary",     icon: Camera,  preview: "linear-gradient(90deg,#2d1e12 0%,#6b4226 40%,#b5855a 70%,#d4a96a 100%)", viralScore: 71, ctrTier: "medium" as const },
  { id: "animated",  name: "Animated",  sub: "3D / Pixar",      icon: Palette, preview: "linear-gradient(90deg,#4158D0 0%,#C850C0 50%,#FFCC70 100%)",              viralScore: 85, ctrTier: "high"   as const },
  { id: "anime",     name: "Anime",     sub: "Japanese",         icon: Sparkles,preview: "linear-gradient(90deg,#5665E9 0%,#9251AE 40%,#F95B8E 100%)",              viralScore: 89, ctrTier: "high"   as const },
  { id: "vintage",   name: "Vintage",   sub: "Film grain",       icon: Layers,  preview: "linear-gradient(90deg,#2C1810 0%,#7A3D1A 40%,#C4832A 70%,#E8C875 100%)", viralScore: 62, ctrTier: "medium" as const },
  { id: "dreamy",    name: "Dreamy",    sub: "Soft, ethereal",   icon: Wand2,   preview: "linear-gradient(90deg,#A18CD1 0%,#FBC2EB 50%,#A1C4FD 100%)",              viralScore: 74, ctrTier: "high"   as const },
];

/** OSS model backends — exposed in advanced mode. All route to /api/video/render;
 *  the backend field is passed as model_backend and the server picks the right
 *  RunPod endpoint. "higgsfield" is the default (current production). */
const MODEL_BACKENDS = [
  {
    id: "higgsfield",
    name: "Higgsfield",
    badge: "Default",
    badgeColor: "#3B82F6",
    specs: "Highest quality · 4K · 90s max",
    note: null,
  },
  {
    id: "wan2",
    name: "Wan 2.1",
    badge: "OSS",
    badgeColor: "#10B981",
    specs: "Excellent quality · 8GB VRAM · MIT",
    note: "via RunPod",
  },
  {
    id: "ltx",
    name: "LTX-Video",
    badge: "Fastest",
    badgeColor: "#F59E0B",
    specs: "Real-time 30fps · Lowest cost",
    note: "via RunPod",
  },
  {
    id: "hunyuan",
    name: "HunyuanVideo",
    badge: "Best arch",
    badgeColor: "#8B5CF6",
    specs: "13B · Transformer-VAE · Highest VRAM",
    note: "via RunPod",
  },
] as const;
type ModelBackendId = (typeof MODEL_BACKENDS)[number]["id"];

const ASPECTS = [
  { id: "9:16", label: "Vertical", w: 36, h: 60 },
  { id: "16:9", label: "Landscape", w: 64, h: 36 },
  { id: "1:1", label: "Square", w: 48, h: 48 },
];

/** CSS device silhouettes for the aspect ratio picker � phone / monitor / square. */
const DEVICE_FRAMES: Record<string, JSX.Element> = {
  "9:16": (
    <svg width="14" height="22" viewBox="0 0 14 22" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="0.65" y="0.65" width="12.7" height="20.7" rx="2.5" />
      <line x1="4.5" y1="19.5" x2="9.5" y2="19.5" />
    </svg>
  ),
  "16:9": (
    <svg width="22" height="16" viewBox="0 0 22 16" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="0.65" y="0.65" width="20.7" height="13.7" rx="1.5" />
      <line x1="9" y1="14.35" x2="13" y2="14.35" />
      <line x1="7" y1="15.35" x2="15" y2="15.35" />
    </svg>
  ),
  "1:1": (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="0.65" y="0.65" width="16.7" height="16.7" rx="3" />
    </svg>
  ),
};

// --- Intent wizard data ---
const INTENT_GOALS = [
  { id: "sell",      label: "Sell",        emoji: "💰", phrase: "persuasive product reveal, conversion-focused, direct gaze, value proposition" },
  { id: "entertain", label: "Entertain",   emoji: "🎭", phrase: "unexpected reaction moment, playful energy, eye-catching visual surprise" },
  { id: "inform",    label: "Inform",      emoji: "💡", phrase: "clear demonstration, bold data point, confident explainer framing" },
  { id: "brand",     label: "Build brand", emoji: "⭐", phrase: "sleek brand moment, premium atmosphere, aspirational lifestyle shot" },
];
const INTENT_SUBJECTS = [
  { id: "person",  label: "Person",  emoji: "👤", phrase: "close-up face with strong eye contact" },
  { id: "product", label: "Product", emoji: "📦", phrase: "hero product shot on dark reflective surface" },
  { id: "place",   label: "Place",   emoji: "🏔", phrase: "wide cinematic establishing shot" },
  { id: "concept", label: "Concept", emoji: "✨", phrase: "dynamic abstract motion, flowing particles" },
];
const INTENT_FEELINGS = [
  { id: "inspired", label: "Inspired", emoji: "🚀", phrase: "golden sunrise light, triumphant upward energy, bright warm tones" },
  { id: "urgent",   label: "Urgent",   emoji: "⚡", phrase: "high-contrast red accent, forward lean posture, motion blur" },
  { id: "amused",   label: "Amused",   emoji: "😂", phrase: "vibrant pop colors, playful composition, lighthearted fun" },
  { id: "curious",  label: "Curious",  emoji: "🤔", phrase: "mysterious lighting, unresolved tension, intriguing partial reveal" },
];

// --- Style Vault: 24 battle-tested prompts across 6 content categories ---
const STYLE_VAULT: Array<{ id: string; cat: string; label: string; prompt: string }> = [
  // Educational
  { id: "sv-edu-1",    cat: "Educational", label: "Explainer Whiteboard",    prompt: "Crisp whiteboard-style video, clean white background, hand-drawn diagrams appearing in real time, warm neutral light, confident narrating voice energy, clear typography callouts." },
  { id: "sv-edu-2",    cat: "Educational", label: "Cinematic Documentary",   prompt: "Documentary-style B-roll, handheld 4K camera, natural ambient light, subject interview cross-cut with illustrative cutaways, subtle film grain, neutral color grade." },
  { id: "sv-edu-3",    cat: "Educational", label: "Screen Tutorial",         prompt: "Clean screen-recording aesthetic, cursor highlight effect, zoomed callout boxes, clean sans-serif annotation overlays, professional desktop setup in background, soft ambient key light." },
  { id: "sv-edu-4",    cat: "Educational", label: "Data-Driven Breakdown",   prompt: "Bold animated data visualization, rising bar charts, number counters, dark background with neon accent lines, authoritative presentation energy, Bloomberg-style motion graphics." },
  // Entertainment
  { id: "sv-ent-1",    cat: "Entertainment", label: "Viral Reaction",        prompt: "Genuine reaction video, split-screen composition, real-time emotional response, expressive facial close-ups, chaotic natural lighting, energetic fast cuts." },
  { id: "sv-ent-2",    cat: "Entertainment", label: "Challenge Hook",        prompt: "Jump-cut challenge format, bold caption overlay, high-energy music beat-sync, saturated colors, crowd or peer-pressure social proof element, 9:16 vertical fill." },
  { id: "sv-ent-3",    cat: "Entertainment", label: "Comedy Skit",           prompt: "Situational comedy, two-character dialogue, over-the-shoulder cuts, exaggerated comic timing, warm practical lighting, relatable everyday setting." },
  { id: "sv-ent-4",    cat: "Entertainment", label: "Cinematic Meme",        prompt: "Cinematic meme format, theatrical slow motion moment, dramatic orchestral music implied, low-angle heroic framing, film-look color grade, ironic juxtaposition." },
  // Testimonials
  { id: "sv-test-1",   cat: "Testimonials",  label: "Raw Testimonial",       prompt: "Authentic talking-head testimonial, casual home or office environment, shallow depth-of-field portrait, warm window light, nervous-but-honest energy, no teleprompter feel." },
  { id: "sv-test-2",   cat: "Testimonials",  label: "Before & After",        prompt: "Split-screen before-after transformation, neutral background, clinical bright light, side-by-side comparison, progress metric callouts, honest unfiltered expression." },
  { id: "sv-test-3",   cat: "Testimonials",  label: "Social Proof Montage",  prompt: "Quick-cut montage of five different people endorsing, varied backgrounds, diverse demographics, each 3-second cut with animated quote overlay, upbeat subtle music bed." },
  { id: "sv-test-4",   cat: "Testimonials",  label: "Case Study Walk-through", prompt: "Professional case study narrative, animated results dashboard appearing, calm confident presenter, neutral background with brand color accent, metric highlight animations." },
  // Product
  { id: "sv-prod-1",   cat: "Product",       label: "Hero Product Reveal",   prompt: "Dark studio product reveal, single product emerging from black, dramatic upward key light, slow rotation, premium metallic reflections, cinematic rack focus." },
  { id: "sv-prod-2",   cat: "Product",       label: "Lifestyle In Use",      prompt: "Natural-light lifestyle setting, product being used in real context, 4K slow-motion detail shots, warm home environment, aspirational but achievable everyday vibe." },
  { id: "sv-prod-3",   cat: "Product",       label: "Unboxing ASMR",         prompt: "Close-up unboxing, crisp packaging sounds implied, shallow DOF on product, white table surface, natural side lighting, clean minimal composition, satisfying reveal moment." },
  { id: "sv-prod-4",   cat: "Product",       label: "Problem → Solution",    prompt: "Frustrated person shot (problem), product appears, satisfied expression (solution), simple two-act structure, clear cause-effect visual contrast, friendly approachable tone." },
  // Motivational
  { id: "sv-mot-1",    cat: "Motivational",  label: "Sunrise Epic",          prompt: "Sweeping landscape at golden hour, silhouette figure against sky, slow push-in drone move, triumphant orchestral energy implied, text burns in serif font, cinematic scope." },
  { id: "sv-mot-2",    cat: "Motivational",  label: "Grind Culture",         prompt: "Dark gym or hustle workspace, high-contrast hard lighting, sweat and effort close-ups, fast-cut tempo, bold sans-serif affirmations, raw unpolished energy, deep bass feel." },
  { id: "sv-mot-3",    cat: "Motivational",  label: "Quiet Discipline",      prompt: "Minimalist quiet scene, person in focused solitary work, soft morning window light, slow deliberate cuts, contemplative mood, understated strength, no hype no noise." },
  { id: "sv-mot-4",    cat: "Motivational",  label: "Origin Story",          prompt: "Personal origin story format, childhood photos implied, humble beginning b-roll, emotional confessional talking head, warm desaturated flashback tone, journey arc narrative." },
  // Social Proof / Brand
  { id: "sv-brand-1",  cat: "Brand",         label: "Premium Brand Film",    prompt: "High-fashion brand film aesthetic, wide lens anamorphic flare, moody desaturated color grade, slow model walk, architectural setting, luxury product integration, aspirational silence." },
  { id: "sv-brand-2",  cat: "Brand",         label: "Behind the Scenes",     prompt: "Authentic BTS documentary feel, candid team moments, handheld B-roll, warm golden workshop light, craft and process revealed, genuine laughter and expertise visible." },
  { id: "sv-brand-3",  cat: "Brand",         label: "Brand Manifesto",       prompt: "Manifesto video, black screen with single word reveals, bold typographic animation, voice-over building to crescendo, montage of community or product in action, rallying emotional close." },
  { id: "sv-brand-4",  cat: "Brand",         label: "Community Story",       prompt: "User-generated feel, multiple real people sharing moments, colorful diverse environments, upbeat optimistic score, movement and energy, brand subtly present throughout." },
];

interface GenerationResult {
  id: string;
  prompt: string;
  status: "generating" | "completed" | "failed" | "plan";
  url?: string;
  plan?: string;
  error?: string;
  aspect_ratio: string;
  style?: string;
  created_at: string;
}

/** Progress ring � premium replacement for a text "generating..." */
function ProgressRing({ progress, size = 20 }: { progress: number; size?: number }) {
  const r = (size - 4) / 2;
  const c = 2 * Math.PI * r;
  const offset = c - (Math.max(0, Math.min(100, progress)) / 100) * c;
  return (
    <div className="hf-ring" style={{ width: size, height: size }}>
      <svg viewBox={`0 0 ${size} ${size}`}>
        <circle cx={size / 2} cy={size / 2} r={r} className="hf-ring-track" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          className="hf-ring-progress"
          strokeDasharray={c}
          strokeDashoffset={offset}
        />
      </svg>
    </div>
  );
}

export default function AIVideoPage() {
  const { profile } = useAuth();
  const isPlatformAdmin = profile?.role === "admin" || profile?.role === "founder";
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [handoffingId, setHandoffingId] = useState<string | null>(null);
  const [thumbnailCapturingId, setThumbnailCapturingId] = useState<string | null>(null);
  const [prompt, setPrompt] = useState("");
  const [aspectRatio, setAspectRatio] = useState("9:16");
  const [style, setStyle] = useState("cinematic");
  const [numFrames, setNumFrames] = useState(72);
  const [guidanceScale, setGuidanceScale] = useState(7.5);
  const [generating, setGenerating] = useState(false);
  const [results, setResults] = useState<GenerationResult[]>([]);
  const [progress, setProgress] = useState(0);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [templatesOpen, setTemplatesOpen] = useState(false);
  // Brand color for templates (can be overridden per-template in the picker)
  const [brandColor] = useState("#3B82F6");
  // Remotion overlay preview — tracks which completed video is being previewed
  const [overlayPreviewId, setOverlayPreviewId] = useState<string | null>(null);
  const [overlayTitle, setOverlayTitle] = useState("");
  // OSS model backend selector (advanced mode only)
  const [modelBackend, setModelBackend] = useState<ModelBackendId>("higgsfield");

  // -- Tier-based max video length (preserved from original) --
  const planTier = profile?.plan_tier ?? "Starter";
  const tierLimits = limitsForTier(planTier);
  const maxSeconds = tierLimits.max_video_seconds;
  const maxFrames = Number.isFinite(maxSeconds)
    ? Math.max(24, Math.floor(maxSeconds * 24))
    : Number.POSITIVE_INFINITY;

  useEffect(() => {
    if (Number.isFinite(maxFrames) && numFrames > maxFrames) {
      setNumFrames(maxFrames);
    }
  }, [maxFrames, numFrames]);

  const nextTier = Number.isFinite(maxSeconds)
    ? tierForVideoSeconds(maxSeconds + 1)
    : null;
  const nextTierLabel =
    nextTier
      ? `${nextTier} � ${formatVideoDuration(
          limitsForTier(nextTier).max_video_seconds,
        )}`
      : null;

  // Guided wizard (legacy modal � still accessible to preserve existing flow)
  const [wizardOpen, setWizardOpen] = useState(false);
  useEffect(() => {
    try {
      const seen = localStorage.getItem("ss-aivideo-wizard-seen");
      if (!seen) setWizardOpen(true);
    } catch {}
  }, []);

  // Seed from Script Lab "Generate clip" action
  useEffect(() => {
    try {
      const seedPrompt = sessionStorage.getItem("ss-video-seed-prompt");
      const seedStyle  = sessionStorage.getItem("ss-video-seed-style");
      const seedAspect = sessionStorage.getItem("ss-video-seed-aspect");
      if (seedPrompt) {
        setPrompt(seedPrompt);
        sessionStorage.removeItem("ss-video-seed-prompt");
      }
      if (seedStyle) {
        setStyle(seedStyle);
        sessionStorage.removeItem("ss-video-seed-style");
      }
      if (seedAspect) {
        setAspectRatio(seedAspect);
        sessionStorage.removeItem("ss-video-seed-aspect");
      }
      if (seedPrompt) {
        toast("Seeded from your script", { icon: "🎬", duration: 3000 });
      }
    } catch {
      // sessionStorage unavailable in some contexts
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Intent wizard state
  const [intentOpen, setIntentOpen] = useState(false);
  const [intentGoal, setIntentGoal] = useState("");
  const [intentSubject, setIntentSubject] = useState("");
  const [intentFeeling, setIntentFeeling] = useState("");

  // Batch queue from Script Lab "Queue all clips" action
  const [batchQueue, setBatchQueue] = useState<Array<{ prompt: string; style: string; aspect: string; label: string }>>([]);
  const [batchQueueIdx, setBatchQueueIdx] = useState(0);
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem("ss-video-batch-queue");
      if (raw) {
        sessionStorage.removeItem("ss-video-batch-queue");
        const queue = JSON.parse(raw) as Array<{ prompt: string; style: string; aspect: string; label: string }>;
        if (Array.isArray(queue) && queue.length > 1) {
          setBatchQueue(queue);
          setBatchQueueIdx(0);
          toast(`${queue.length} clips queued from Script Lab`, { icon: "🎬", duration: 4000 });
        }
      }
    } catch { /* noop */ }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  function loadNextBatchClip() {
    const next = batchQueueIdx + 1;
    if (next >= batchQueue.length) { setBatchQueue([]); setBatchQueueIdx(0); return; }
    const clip = batchQueue[next];
    setPrompt(clip.prompt);
    setStyle(clip.style);
    setAspectRatio(clip.aspect);
    setBatchQueueIdx(next);
    toast.success(`Loaded clip ${next + 1}/${batchQueue.length}: ${clip.label}`);
  }

  // Style Vault
  const [styleVaultOpen, setStyleVaultOpen] = useState(false);
  const [styleVaultCat, setStyleVaultCat] = useState<string | null>(null);
  const vaultCats = Array.from(new Set(STYLE_VAULT.map(s => s.cat)));

  // Prompt history — last 5 prompts persisted to localStorage
  const [promptHistory, setPromptHistory] = useState<string[]>(() => {
    if (typeof window === "undefined") return [];
    try {
      const raw = localStorage.getItem("ss-aivideo-prompt-history");
      return raw ? (JSON.parse(raw) as string[]) : [];
    } catch { return []; }
  });
  function savePromptToHistory(p: string) {
    const trimmed = p.trim();
    if (!trimmed || trimmed.length < 12) return;
    setPromptHistory(prev => {
      const next = [trimmed, ...prev.filter(h => h !== trimmed)].slice(0, 5);
      try { localStorage.setItem("ss-aivideo-prompt-history", JSON.stringify(next)); } catch { /* noop */ }
      return next;
    });
  }

  // Face swap mode
  const [faceSwapMode, setFaceSwapMode] = useState(false);
  const [faceSwapImage, setFaceSwapImage] = useState<string | null>(null);
  const [faceSwapUploading, setFaceSwapUploading] = useState(false);

  const handleFaceSwapUpload = async (file: File) => {
    setFaceSwapUploading(true);
    try {
      await new Promise<void>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (ev) => {
          const src = ev.target?.result as string;
          if (!src) { reject(new Error("Empty file")); return; }
          setFaceSwapImage(src);
          resolve();
        };
        reader.onerror = () => reject(new Error("Read failed"));
        reader.readAsDataURL(file);
      });
      toast.success("Face photo loaded");
    } catch {
      toast.error("Could not load face photo");
    } finally {
      setFaceSwapUploading(false);
    }
  };

  // Viral prediction
  const [creatorIdeasOpen, setCreatorIdeasOpen] = useState(false);
  const [viralPredicting, setViralPredicting] = useState(false);
  const [viralResult, setViralResult] = useState<{
    viral_score: number;
    ctr_estimate: string;
    strengths: string[];
    suggestions: string[];
  } | null>(null);

  const predictViral = async () => {
    if (!prompt.trim() || viralPredicting) return;
    setViralPredicting(true);
    setViralResult(null);
    try {
      const res = await fetch("/api/ai/predict-viral", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: prompt.trim(), style, aspect_ratio: aspectRatio, face_swap: faceSwapMode }),
      });
      if (!res.ok) throw new Error("Prediction failed");
      const data = await res.json() as typeof viralResult;
      setViralResult(data);
    } catch {
      toast.error("Could not predict viral potential");
    } finally {
      setViralPredicting(false);
    }
  };

  // Prompt enhancement
  const [enhancing, setEnhancing] = useState(false);
  const enhancePrompt = async () => {
    if (!prompt.trim() || enhancing) return;
    setEnhancing(true);
    try {
      const res = await fetch("/api/ai/enhance-video-prompt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: prompt.trim(), style }),
      });
      if (!res.ok) throw new Error("Enhancement failed");
      const data = await res.json() as { enhanced?: string; error?: string };
      if (data.enhanced) {
        setPrompt(data.enhanced);
        toast.success("Prompt enhanced");
      }
    } catch {
      toast.error("Could not enhance prompt");
    } finally {
      setEnhancing(false);
    }
  };

  // Guided Mode (in-page wizard) ? Advanced Mode (Higgsfield-style hero)
  const [advancedMode, setAdvancedMode] = useAdvancedMode("ai-video");
  const [guidedStep, setGuidedStep] = useState(0);

  function buildIntentPrompt() {
    const goal    = INTENT_GOALS.find(g => g.id === intentGoal);
    const subject = INTENT_SUBJECTS.find(s => s.id === intentSubject);
    const feeling = INTENT_FEELINGS.find(f => f.id === intentFeeling);
    return [
      goal?.phrase,
      subject?.phrase,
      feeling?.phrase,
      aspectRatio === "9:16"
        ? "vertical 9:16 framing optimized for mobile feed"
        : "cinematic widescreen composition",
    ].filter(Boolean).join(", ");
  }

  const guidedSteps: WizardStepDef[] = [
    {
      id: "prompt",
      title: "Describe your scene",
      description: "One or two sentences. Mention subject, lighting, camera movement, mood.",
      icon: <Type size={18} />,
      canProceed: prompt.trim().length > 0,
      component: (
        <div className="space-y-3">
          {/* Intent Wizard — collapsible */}
          <div>
            <button
              type="button"
              onClick={() => setIntentOpen(o => !o)}
              className="flex items-center gap-2 text-[11px] text-text-muted hover:text-text-primary transition-all w-full text-left cursor-pointer"
            >
              <Target size={11} className="text-brand-accent" />
              <span>Not sure where to start?</span>
              <span className="text-brand-accent font-semibold ml-1">Use intent wizard</span>
              <ChevronDown size={10} className={`ml-auto transition-transform duration-220 ${intentOpen ? "rotate-180" : ""}`} />
            </button>
            {intentOpen && (
              <div className="mt-2 rounded-xl border border-[rgba(59,130,246,0.2)] bg-[rgba(59,130,246,0.03)] p-3 space-y-3">
                <div>
                  <p className="text-[9px] uppercase tracking-wider text-text-muted font-semibold mb-1.5">1. What&apos;s the goal?</p>
                  <div className="flex flex-wrap gap-1.5">
                    {INTENT_GOALS.map(g => (
                      <button key={g.id} type="button" onClick={() => setIntentGoal(g.id)}
                        className={`flex items-center gap-1 text-[11px] px-2.5 py-1 rounded-full border transition-all cursor-pointer ${intentGoal === g.id ? "border-brand-accent bg-[rgba(59,130,246,0.12)] text-text-primary" : "border-border-subtle text-text-muted hover:border-[rgba(59,130,246,0.3)]"}`}>
                        <span>{g.emoji}</span> {g.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-[9px] uppercase tracking-wider text-text-muted font-semibold mb-1.5">2. Main subject?</p>
                  <div className="flex flex-wrap gap-1.5">
                    {INTENT_SUBJECTS.map(s => (
                      <button key={s.id} type="button" onClick={() => setIntentSubject(s.id)}
                        className={`flex items-center gap-1 text-[11px] px-2.5 py-1 rounded-full border transition-all cursor-pointer ${intentSubject === s.id ? "border-brand-accent bg-[rgba(59,130,246,0.12)] text-text-primary" : "border-border-subtle text-text-muted hover:border-[rgba(59,130,246,0.3)]"}`}>
                        <span>{s.emoji}</span> {s.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-[9px] uppercase tracking-wider text-text-muted font-semibold mb-1.5">3. Viewer should feel?</p>
                  <div className="flex flex-wrap gap-1.5">
                    {INTENT_FEELINGS.map(f => (
                      <button key={f.id} type="button" onClick={() => setIntentFeeling(f.id)}
                        className={`flex items-center gap-1 text-[11px] px-2.5 py-1 rounded-full border transition-all cursor-pointer ${intentFeeling === f.id ? "border-brand-accent bg-[rgba(59,130,246,0.12)] text-text-primary" : "border-border-subtle text-text-muted hover:border-[rgba(59,130,246,0.3)]"}`}>
                        <span>{f.emoji}</span> {f.label}
                      </button>
                    ))}
                  </div>
                </div>
                {intentGoal && intentSubject && intentFeeling && (
                  <button
                    type="button"
                    onClick={() => { setPrompt(buildIntentPrompt()); setIntentOpen(false); }}
                    className="w-full flex items-center justify-center gap-2 text-[11px] font-semibold text-white py-2 rounded-xl bg-brand-accent hover:bg-[#2563EB] transition-all cursor-pointer"
                  >
                    <Sparkles size={11} /> Build prompt from answers
                  </button>
                )}
              </div>
            )}
          </div>
          <div className="relative">
            <textarea
              value={prompt}
              onChange={e => setPrompt(e.target.value)}
              placeholder="e.g., Golden retriever running through a field of sunflowers at sunset, cinematic warm lighting, slow tracking shot"
              rows={4}
              className="w-full px-4 py-3 rounded-xl bg-surface-light border border-border-subtle text-sm focus:outline-none focus:border-[rgba(59,130,246,0.5)] focus:ring-2 focus:ring-[rgba(59,130,246,0.2)] transition-all resize-none"
              autoFocus
            />
            {prompt.trim() && (
              <button
                type="button"
                onClick={enhancePrompt}
                disabled={enhancing}
                className="absolute bottom-2.5 right-2.5 inline-flex items-center gap-1 text-[10px] text-[#60A5FA] hover:text-white bg-[rgba(59,130,246,0.1)] hover:bg-[rgba(59,130,246,0.2)] border border-[rgba(59,130,246,0.2)] px-2.5 py-1 rounded-full transition-all disabled:opacity-50 cursor-pointer"
              >
                {enhancing ? <Loader2 size={10} className="animate-spin" /> : <Wand2 size={10} />}
                {enhancing ? "Enhancing…" : "Enhance ✨"}
              </button>
            )}
          </div>
          <div>
            <p className="text-[10px] text-text-muted uppercase tracking-wider mb-1.5 font-semibold">Quick start</p>
            <div className="flex flex-wrap gap-1.5">
              {PROMPT_CATEGORIES.map((cat) => (
                <button
                  key={cat.label}
                  type="button"
                  onClick={() => setPrompt(cat.prompt)}
                  className="inline-flex items-center gap-1.5 text-[11px] text-text-muted hover:text-text-primary bg-surface-light hover:bg-white/[0.05] hover:border-border-subtle px-3 py-1.5 rounded-full border border-border-subtle/50 transition-all cursor-pointer"
                >
                  <span className="text-[10px] leading-none">{cat.icon}</span>
                  {cat.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      ),
    },
    {
      id: "aspect",
      title: "Pick a shape",
      description: "Match the platform where this video will live.",
      icon: <Monitor size={18} />,
      component: (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {ASPECTS.map(ar => (
            <button
              key={ar.id}
              onClick={() => setAspectRatio(ar.id)}
              className={`flex flex-col items-center gap-2 p-4 rounded-xl border transition-all ${
                aspectRatio === ar.id
                  ? "border-brand-accent bg-[rgba(59,130,246,0.08)] shadow-lg shadow-[rgba(59,130,246,0.08)]"
                  : "border-border-subtle hover:border-[rgba(59,130,246,0.25)] bg-surface-light"
              }`}
            >
              <div
                className="hf-aspect-frame"
                style={{ width: ar.w, height: ar.h }}
                data-active={aspectRatio === ar.id}
              />
              <div className="text-center">
                <p className="text-sm font-semibold">{ar.id}</p>
                <p className="text-[10px] text-text-muted">{ar.label}</p>
              </div>
            </button>
          ))}
        </div>
      ),
    },
    {
      id: "duration",
      title: "How long?",
      description: `Longer clips take more GPU time. 3 seconds is the sweet spot. Your plan (${planTier}) supports up to ${formatVideoDuration(maxSeconds)}.`,
      icon: <Clock size={18} />,
      component: (
        <div className="space-y-2">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {[
              { f: 24, label: "1s", sub: "Fastest" },
              { f: 48, label: "2s", sub: "Quick" },
              { f: 72, label: "3s", sub: "Recommended" },
              { f: 120, label: "5s", sub: "Max quality" },
            ].map(opt => {
              const locked = opt.f > maxFrames;
              return (
                <MotionPage>
                                    <button
                                    key={opt.f}
                                    onClick={() => !locked && setNumFrames(opt.f)}
                                    disabled={locked}
                                    className={`p-3 rounded-xl border transition-all text-center relative ${
                                      locked
                                        ? "border-[rgba(59,130,246,0.25)] bg-surface-light/40 opacity-60 cursor-not-allowed"
                                        : numFrames === opt.f
                                          ? "border-brand-accent bg-[rgba(59,130,246,0.08)]"
                                          : "border-border-subtle hover:border-[rgba(59,130,246,0.25)] bg-surface-light"
                                    }`}
                                  >
                                    {locked && (
                                      <span className="absolute top-1 right-1">
                                        <Lock size={10} className="text-brand-accent" />
                                      </span>
                                    )}
                                    <p className="text-sm font-bold">{opt.label}</p>
                                    <p className="text-[9px] text-text-muted">{opt.sub}</p>
                                  </button>
                                  </MotionPage>
              );
            })}
          </div>
          {nextTierLabel && (
            <Link
              href="/dashboard/upgrade"
              className="flex items-center justify-center gap-1.5 text-[10px] text-brand-accent hover:text-[#3B82F6] py-1.5 rounded-lg border border-[rgba(59,130,246,0.2)] bg-[rgba(59,130,246,0.04)] transition-all"
            >
              <Lock size={10} /> Upgrade to unlock longer videos ({nextTierLabel})
            </Link>
          )}
        </div>
      ),
    },
    {
      id: "review",
      title: "Ready to generate?",
      description: "Click the big button and your clip will start rendering on the GPU.",
      icon: <Sparkles size={18} />,
      component: (
        <div className="space-y-3">
          <div className="glass rounded-xl p-4 bg-[rgba(59,130,246,0.04)] border-[rgba(59,130,246,0.2)]">
            <p className="text-[10px] uppercase tracking-wider text-brand-accent font-semibold mb-2">Your prompt</p>
            <p className="text-sm text-text-primary leading-relaxed">{prompt || <span className="text-text-muted italic">(no prompt set)</span>}</p>
            <div className="grid grid-cols-2 gap-3 mt-4 pt-3 border-t border-border-subtle/50">
              <div>
                <p className="text-[9px] uppercase tracking-wider text-text-muted">Aspect</p>
                <p className="text-xs font-semibold">{aspectRatio}</p>
              </div>
              <div>
                <p className="text-[9px] uppercase tracking-wider text-text-muted">Duration</p>
                <p className="text-xs font-semibold">~{(numFrames / 24).toFixed(1)}s ({numFrames} frames)</p>
              </div>
            </div>
          </div>
          <p className="text-[11px] text-text-muted text-center">
            Want finer control? Flip to <span className="text-brand-accent font-semibold">Advanced mode</span> at the top.
          </p>
        </div>
      ),
    },
  ];

  // Legacy wizard config preserved � same API shape as before
  const videoGenWizardSteps: WizardStep[] = [
    {
      id: "what",
      title: "What do you want in your video?",
      description: "Describe the scene. Be visual � mention subjects, environment, lighting, camera movement.",
      icon: <Type size={16} />,
      field: { type: "textarea", key: "prompt", placeholder: "e.g., A sleek red sports car driving through a neon-lit city at night, rain on the streets, cinematic camera" },
    },
    {
      id: "style",
      title: "Pick a visual style",
      description: "This changes the entire look � camera, lighting, color grade.",
      icon: <Palette size={16} />,
      field: {
        type: "choice-cards",
        key: "style",
        options: [
          { value: "cinematic", label: "Cinematic", description: "Film-like, dramatic lighting", preview: "bg-gradient-to-br from-orange-500/40 to-teal-500/40" },
          { value: "realistic", label: "Realistic", description: "Natural, documentary feel", preview: "bg-gradient-to-br from-stone-500/40 to-slate-500/40" },
          { value: "animated", label: "Animated", description: "3D animation, Pixar-like", preview: "bg-gradient-to-br from-pink-500/40 to-purple-500/40" },
          { value: "anime", label: "Anime", description: "Japanese animation style", preview: "bg-gradient-to-br from-rose-400/40 to-indigo-500/40" },
          { value: "vintage", label: "Vintage", description: "Film grain, retro colors", preview: "bg-gradient-to-br from-amber-500/40 to-red-700/40" },
          { value: "dreamy", label: "Dreamy", description: "Soft, ethereal", preview: "bg-gradient-to-br from-pink-300/40 to-blue-300/40" },
        ],
      },
    },
    {
      id: "aspect",
      title: "Aspect ratio",
      description: "Match the platform where this will live.",
      icon: <Monitor size={16} />,
      field: {
        type: "choice-cards",
        key: "aspectRatio",
        options: [
          { value: "9:16", label: "9:16 Vertical", description: "TikTok, Reels, Shorts" },
          { value: "16:9", label: "16:9 Landscape", description: "YouTube, web" },
          { value: "1:1", label: "1:1 Square", description: "Instagram feed" },
        ],
      },
    },
    {
      id: "duration",
      title: "Duration",
      description: `Higgsfield works best at 2-6 seconds. Your ${planTier} plan caps at ${formatVideoDuration(maxSeconds)}.`,
      icon: <Clock size={16} />,
      field: {
        type: "choice-cards",
        key: "duration",
        options: [
          { value: "48", label: "2 seconds", description: "48 frames � Fast & cheap" },
          { value: "72", label: "3 seconds", description: "72 frames � Balanced" },
          { value: "120", label: "5 seconds", description: "120 frames � Standard" },
          { value: "144", label: "6 seconds", description: "144 frames � Max quality" },
        ].filter(opt => parseInt(opt.value, 10) <= maxFrames),
      },
    },
    {
      id: "music",
      title: "Background music (optional)",
      description: "We'll match a royalty-free track to your mood.",
      icon: <Music size={16} />,
      field: {
        type: "dropdown",
        key: "music",
        optional: true,
        placeholder: "No music",
        options: [
          { value: "none", label: "No music" },
          { value: "cinematic", label: "Cinematic orchestral" },
          { value: "epic", label: "Epic trailer" },
          { value: "upbeat", label: "Upbeat electronic" },
          { value: "chill", label: "Chill lo-fi" },
          { value: "ambient", label: "Ambient atmospheric" },
          { value: "emotional", label: "Emotional strings" },
        ],
      },
    },
  ];

  async function generateVideo() {
    if (!prompt.trim()) { toast.error("Enter a video description"); return; }
    // Client-side tier cap guard (preserved). Server re-validates (402).
    const requestedSeconds = Math.round((numFrames / 24) * 30);
    if (Number.isFinite(maxSeconds) && requestedSeconds > maxSeconds) {
      toast.error(
        `Your ${planTier} plan caps videos at ${formatVideoDuration(maxSeconds)}. Upgrade to unlock longer videos.`,
      );
      return;
    }
    setGenerating(true);
    setProgress(0);
    savePromptToHistory(prompt);

    const progressInterval = setInterval(() => {
      setProgress(prev => Math.min(prev + Math.random() * 5, 90));
    }, 1000);

    const id = crypto.randomUUID();
    setResults(prev => [{
      id, prompt, status: "generating", aspect_ratio: aspectRatio, style,
      created_at: new Date().toISOString(),
    }, ...prev]);

    try {
      const res = await fetch("/api/video/render", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: prompt.slice(0, 50),
          script: prompt,
          type: aspectRatio === "9:16" ? "reel" : aspectRatio === "1:1" ? "ad" : "youtube",
          aspect_ratio: aspectRatio,
          duration: Math.round(numFrames / 24 * 30),
          style,
          music_mood: "none",
          caption_style: "none",
          include_voiceover: false,
          include_cta: false,
          target_platform: "instagram",
          higgsfield_mode: true,
          num_frames: numFrames,
          guidance_scale: guidanceScale,
          model_backend: modelBackend,
          ...(faceSwapMode && faceSwapImage ? { face_swap_image: faceSwapImage } : {}),
        }),
      });

      clearInterval(progressInterval);
      setProgress(100);

      const data = await res.json();
      if (res.status === 402) {
        const errMsg = data.error ||
          `Plan limit hit (${data.plan_tier}: ${data.current}/${data.limit}). Upgrade to continue.`;
        setResults(prev => prev.map(r => r.id === id ? { ...r, status: "failed", error: errMsg } : r));
        toast.error(errMsg);
      } else if (data.success && data.url) {
        setResults(prev => prev.map(r => r.id === id ? { ...r, status: "completed", url: data.url } : r));
        toast.success("Video generated");
      } else if (data.plan) {
        setResults(prev => prev.map(r => r.id === id ? { ...r, status: "plan", plan: data.plan } : r));
        toast.success("Video plan created");
      } else {
        const attemptedMsg = Array.isArray(data.attempted) && data.attempted.length > 0
          ? `Video render failed. Tried: ${data.attempted.join(", ")}`
          : (data.error || "Generation failed");
        setResults(prev => prev.map(r => r.id === id ? { ...r, status: "failed", error: attemptedMsg } : r));
        toast.error(attemptedMsg);
      }
    } catch (err) {
      console.error("[ai-video] generateVideo error:", err);
      clearInterval(progressInterval);
      setResults(prev => prev.map(r => r.id === id ? { ...r, status: "failed", error: "Connection error" } : r));
      toast.error("Connection error");
    }
    setGenerating(false);
  }

  /**
   * extractBestFrame — peepshow-style thumbnail auto-select.
   *
   * 1. Loads the video URL into a hidden <video> element.
   * 2. Seeks to N evenly-spaced timestamps and captures each frame via <canvas>.
   * 3. Sends the frames (as JPEG data URLs) to /api/video/best-frame (Claude Vision).
   * 4. Stores the winning frame in sessionStorage under "ss-thumb-seed-image".
   * 5. Navigates to /dashboard/thumbnail-generator which reads the seed on mount.
   */
  async function extractBestFrame(resultId: string, videoUrl: string, videoPrompt: string) {
    setThumbnailCapturingId(resultId);
    try {
      const NUM_SAMPLES = 6; // balance quality vs. payload size

      const frames = await new Promise<string[]>((resolve, reject) => {
        const video = document.createElement("video");
        video.crossOrigin = "anonymous";
        video.muted = true;
        video.preload = "auto";
        video.src = videoUrl;

        video.addEventListener("error", () => reject(new Error("Video load failed")));

        video.addEventListener("loadedmetadata", () => {
          const duration = video.duration;
          if (!Number.isFinite(duration) || duration <= 0) {
            reject(new Error("Invalid video duration"));
            return;
          }

          const canvas = document.createElement("canvas");
          // Cap frame size — 320px wide keeps payload small while Claude Vision handles it fine
          canvas.width = 320;
          canvas.height = Math.round(320 * (video.videoHeight / (video.videoWidth || 1)));
          const ctx = canvas.getContext("2d");
          if (!ctx) { reject(new Error("Canvas unavailable")); return; }

          const captured: string[] = [];
          let seeking = false;
          let sampleIdx = 0;

          // Timestamps: skip the very first and last 5% (often black frames)
          const timestamps = Array.from({ length: NUM_SAMPLES }, (_, i) =>
            duration * (0.05 + (i / (NUM_SAMPLES - 1)) * 0.90)
          );

          const captureNext = () => {
            if (sampleIdx >= timestamps.length) { resolve(captured); return; }
            if (seeking) return;
            seeking = true;
            video.currentTime = timestamps[sampleIdx];
          };

          video.addEventListener("seeked", () => {
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            captured.push(canvas.toDataURL("image/jpeg", 0.75));
            seeking = false;
            sampleIdx++;
            captureNext();
          });

          captureNext();
        });
      });

      const res = await fetch("/api/video/best-frame", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ frames, prompt: videoPrompt }),
      });

      if (!res.ok) throw new Error(`best-frame API ${res.status}`);
      const data = await res.json() as { best_index: number; reason: string; best_frame: string };

      // Store the winning frame so the thumbnail generator can seed itself
      try {
        sessionStorage.setItem("ss-thumb-seed-image", data.best_frame);
        sessionStorage.setItem("ss-thumb-seed-reason", data.reason);
        sessionStorage.removeItem("thumbnail-ai-starter-skipped"); // re-show the AI starter
      } catch {
        // sessionStorage unavailable — still navigate, generator will open empty
      }

      toast.success(`Best frame selected — ${data.reason}`);
      router.push("/dashboard/thumbnail-generator");
    } catch (err) {
      console.error("[ai-video] extractBestFrame error:", err);
      toast.error("Could not extract frames. Try again.");
    } finally {
      setThumbnailCapturingId(null);
    }
  }

  return (
    <div className="space-y-5">
            {/* AI Video command strip (slim editorial header, no PageHero) */}
      <div className="flex items-center justify-between gap-4 px-1 py-3 sm:py-4">
        <div className="min-w-0">
          <p className="font-editorial text-[11px] italic text-text-muted mb-0.5 truncate">Visual Production</p>
          <h1 className="font-display text-xl sm:text-2xl font-bold tracking-tight text-text-primary leading-none truncate">AI Video</h1>
        </div>
        <AdvancedToggle value={advancedMode} onChange={setAdvancedMode} />
      </div>

      {/* Competitive Intelligence strip */}
      <div className="px-1 mb-2">
        <PageAgent context="video-gen" />
      </div>

      {/* AI Director — viral formats, structure templates, CTR scoring */}
      <div className="px-1 mb-2">
        <SmartBar
          context="video-gen"
          onUseFormat={(fmt) => setPrompt(fmt)}
        />
      </div>

      {/* Scorecard strip */}
      <div className="grid grid-cols-2 lg:grid-cols-[4fr_2fr_2fr] gap-3 mb-4">
        <motion.div
          className="col-span-2 lg:col-span-1 glass-card-heavy rounded-2xl p-5 flex items-center gap-4"
          initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.38, delay: 0.04, ease: [0.22, 1, 0.36, 1] }}
        >
          <div className="w-1 self-stretch rounded-full bg-gradient-to-b from-[#2563EB] to-[#3B82F6] shrink-0" />
          <div>
            <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-text-muted mb-1.5">Videos Generated</p>
            <p className="font-display text-3xl font-bold tracking-[-0.03em] text-brand-accent tabular-nums">{results.length}</p>
            <p className="text-[11px] text-text-muted mt-1.5">this session</p>
          </div>
        </motion.div>
        <motion.div
          className="glass-card rounded-2xl p-5 flex flex-col justify-center"
          initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.38, delay: 0.10, ease: [0.22, 1, 0.36, 1] }}
        >
          <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-text-muted mb-1.5">Plan Tier</p>
          <p className="font-display text-2xl font-bold tracking-[-0.02em] text-text-primary">{planTier}</p>
          <p className="text-[11px] text-text-muted mt-1.5">current plan</p>
        </motion.div>
        <motion.div
          className="glass-card rounded-2xl p-5 flex flex-col justify-center"
          initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.38, delay: 0.14, ease: [0.22, 1, 0.36, 1] }}
        >
          <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-text-muted mb-1.5">Max Duration</p>
          <p className="font-display text-2xl font-bold tracking-[-0.02em] text-text-primary">
            {Number.isFinite(maxSeconds) ? formatVideoDuration(maxSeconds) : "Unlimited"}
          </p>
          <p className="text-[11px] text-text-muted mt-1.5">per video</p>
        </motion.div>
      </div>

      {/* Guided Mode � preserved untouched for beginners */}
      {!advancedMode && (
        <Wizard
          steps={guidedSteps}
          activeIdx={guidedStep}
          onStepChange={setGuidedStep}
          finishLabel={generating ? "Generating�" : "Generate video"}
          busy={generating}
          onFinish={async () => { await generateVideo(); }}
          onCancel={() => setAdvancedMode(true)}
          cancelLabel="Advanced mode"
        />
      )}

      {/* Legacy modal wizard � preserved for first-run users */}
      <CreationWizard
        open={wizardOpen}
        title="Create Your AI Video"
        subtitle="Step-by-step � describe, pick style, hit generate."
        icon={<Film size={18} />}
        submitLabel="Apply & Generate"
        initialData={{ prompt, style, aspectRatio, duration: String(numFrames) }}
        steps={videoGenWizardSteps}
        onClose={() => {
          setWizardOpen(false);
          try { localStorage.setItem("ss-aivideo-wizard-seen", "1"); } catch {}
        }}
        onComplete={async (data) => {
          const parts: string[] = [];
          if (data.prompt) parts.push(data.prompt as string);
          if (data.style) {
            parts.push(`${data.style} style`);
            setStyle(data.style as string);
          }
          const finalPrompt = parts.join(", ");
          setPrompt(finalPrompt);
          if (data.aspectRatio) setAspectRatio(data.aspectRatio as string);
          if (data.duration) setNumFrames(parseInt(data.duration as string));
          setWizardOpen(false);
          try { localStorage.setItem("ss-aivideo-wizard-seen", "1"); } catch {}
          toast.success("Settings applied. Click Generate to render.");
        }}
      />

      {/* --------------- ADVANCED: Higgsfield-style cinematic hero --------------- */}
      {advancedMode && (
        <>
          {/* HERO � huge prompt, dominant generate CTA, minimal chrome */}
          <div className="hf-canvas rounded-3xl p-8 sm:p-10 relative overflow-hidden">
            {/* Category chips � above textarea, disappear once user starts typing */}
            {!prompt && (
              <div className="mb-3 flex flex-wrap gap-1.5">
                {PROMPT_CATEGORIES.map((cat) => (
                  <button
                    key={cat.label}
                    type="button"
                    onClick={() => setPrompt(cat.prompt)}
                    className="inline-flex items-center gap-1.5 text-[11px] text-white/40 hover:text-white/80 px-3 py-1.5 rounded-full border border-border-subtle hover:border-border-subtle hover:bg-white/[0.05] transition-all cursor-pointer"
                  >
                    <span className="text-[10px] leading-none">{cat.icon}</span>
                    {cat.label}
                  </button>
                ))}
              </div>
            )}

            {/* Creator Intelligence — collapsible idea generator above prompt */}
            <div className="mb-3">
              <button
                type="button"
                onClick={() => setCreatorIdeasOpen((o) => !o)}
                className="flex items-center gap-1.5 text-[10px] font-medium mb-2 transition-colors cursor-pointer"
                style={{ color: creatorIdeasOpen ? "#60A5FA" : "#6B7280" }}
              >
                <TrendingUp size={10} />
                Get creator-style ideas
                <span style={{ fontSize: 8, opacity: 0.7 }}>{creatorIdeasOpen ? "▲" : "▼"}</span>
              </button>
              <AnimatePresence>
                {creatorIdeasOpen && (
                  <motion.div
                    key="creator-ideas-ai-video"
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.18, ease: [0.32, 0.72, 0, 1] }}
                    className="overflow-hidden mb-3"
                  >
                    <CreatorIntelligence
                      context="ai-video"
                      variant="inline"
                      currentTopic={prompt}
                      platform="youtube"
                      onApply={(idea) => {
                        setPrompt(idea.hook);
                        setCreatorIdeasOpen(false);
                        toast.success("Hook applied to prompt!");
                      }}
                    />
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Prompt history chips — last 5 prompts, visible when textarea is empty */}
            {!prompt && promptHistory.length > 0 && (
              <div className="mb-3">
                <p className="text-[9px] text-text-muted mb-1.5 flex items-center gap-1">
                  <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 8v4l3 3"/><circle cx="12" cy="12" r="9"/></svg>
                  Recent prompts
                </p>
                <div className="flex flex-col gap-1">
                  {promptHistory.map((h, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => setPrompt(h)}
                      className="text-left text-[10px] text-text-secondary hover:text-text-primary px-2.5 py-1.5 rounded-lg border border-border-subtle hover:border-[rgba(99,146,255,0.3)] hover:bg-white/[0.04] transition-all cursor-pointer truncate"
                      title={h}
                    >
                      {h.length > 90 ? h.slice(0, 90) + "…" : h}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Prompt textarea — the real star */}
            <textarea
              value={prompt}
              onChange={e => setPrompt(e.target.value)}
              placeholder="Describe your scene..."
              className="hf-prompt"
              autoFocus
            />

            {/* Enhance button — visible when prompt has content */}
            {prompt.trim() && (
              <div className="mt-2 flex justify-end">
                <button
                  type="button"
                  onClick={enhancePrompt}
                  disabled={enhancing}
                  className="inline-flex items-center gap-1.5 text-[11px] text-[#60A5FA] hover:text-white bg-[rgba(59,130,246,0.08)] hover:bg-[rgba(59,130,246,0.18)] border border-[rgba(59,130,246,0.2)] hover:border-[rgba(59,130,246,0.4)] px-3 py-1.5 rounded-full transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                >
                  {enhancing ? (
                    <Loader2 size={11} className="animate-spin" />
                  ) : (
                    <Wand2 size={11} />
                  )}
                  {enhancing ? "Enhancing…" : "Enhance ✨"}
                </button>
              </div>
            )}

            {/* Batch queue banner — shows when clips queued from Script Lab */}
            {batchQueue.length > 1 && (
              <div className="mt-3 flex items-center justify-between px-3 py-2 rounded-xl border border-[rgba(59,130,246,0.25)] bg-[rgba(59,130,246,0.06)]">
                <div className="flex items-center gap-2">
                  <Film size={10} className="text-brand-accent" />
                  <p className="text-[10px] text-text-secondary">
                    <span className="font-medium text-text-primary">{batchQueueIdx + 1}/{batchQueue.length}</span> — {batchQueue[batchQueueIdx]?.label ?? "Clip"}
                  </p>
                </div>
                <div className="flex items-center gap-1.5">
                  {batchQueueIdx + 1 < batchQueue.length && (
                    <button
                      type="button"
                      onClick={loadNextBatchClip}
                      className="text-[9px] font-medium text-brand-accent hover:text-white px-2.5 py-1 rounded-full border border-[rgba(59,130,246,0.3)] hover:bg-[rgba(59,130,246,0.15)] transition-all cursor-pointer"
                    >
                      Next clip →
                    </button>
                  )}
                  <button type="button" onClick={() => { setBatchQueue([]); setBatchQueueIdx(0); }} className="text-[9px] text-text-muted hover:text-text-primary cursor-pointer px-1">✕</button>
                </div>
              </div>
            )}

            {/* OSS model backend selector — compact chip strip */}
            <div className="mt-5">
              <p className="text-[9px] uppercase tracking-[0.18em] text-text-muted mb-2 font-medium">AI backend</p>
              <div className="flex flex-wrap gap-2">
                {MODEL_BACKENDS.map(b => (
                  <button
                    key={b.id}
                    type="button"
                    onClick={() => setModelBackend(b.id)}
                    className={[
                      "inline-flex flex-col items-start gap-0.5 px-3 py-2 rounded-lg border text-left transition-all cursor-pointer",
                      modelBackend === b.id
                        ? "border-[rgba(59,130,246,0.5)] bg-[rgba(59,130,246,0.1)] text-text-primary"
                        : "border-border-subtle bg-white/[0.03] text-text-muted hover:text-text-primary hover:border-border-strong hover:bg-white/[0.06]",
                    ].join(" ")}
                  >
                    <span className="flex items-center gap-1.5">
                      <span className="text-[11px] font-semibold">{b.name}</span>
                      <span
                        className="text-[8px] font-bold px-1.5 py-0.5 rounded-full"
                        style={{ background: `${b.badgeColor}22`, color: b.badgeColor }}
                      >
                        {b.badge}
                      </span>
                    </span>
                    <span className="text-[9px] opacity-60 leading-tight">{b.specs}</span>
                    {b.note && (
                      <span className="text-[8px] opacity-40">{b.note}</span>
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* ── Style Vault ────────────────────────────────────── */}
            <div className="mt-4">
              <button
                type="button"
                onClick={() => setStyleVaultOpen(v => !v)}
                className="flex items-center gap-1.5 text-[10px] text-text-muted hover:text-text-primary transition-colors cursor-pointer"
              >
                <Layers size={10} className={styleVaultOpen ? "text-brand-accent" : ""} />
                Style Vault
                <span className="text-[8px] text-text-muted opacity-60">24 proven prompts</span>
                <ChevronDown size={10} className={`transition-transform ${styleVaultOpen ? "rotate-180 text-brand-accent" : ""}`} />
              </button>
              {styleVaultOpen && (
                <div className="mt-2 rounded-xl border border-border-subtle bg-[rgba(13,17,32,0.5)] overflow-hidden">
                  {/* Category tabs */}
                  <div className="flex gap-0 border-b border-border-subtle overflow-x-auto">
                    <button
                      type="button"
                      onClick={() => setStyleVaultCat(null)}
                      className={["text-[9px] px-3 py-2 whitespace-nowrap transition-colors cursor-pointer", styleVaultCat === null ? "text-brand-accent border-b border-brand-accent -mb-px bg-[rgba(59,130,246,0.05)]" : "text-text-muted hover:text-text-primary"].join(" ")}
                    >All</button>
                    {vaultCats.map(cat => (
                      <button
                        key={cat}
                        type="button"
                        onClick={() => setStyleVaultCat(c => c === cat ? null : cat)}
                        className={["text-[9px] px-3 py-2 whitespace-nowrap transition-colors cursor-pointer", styleVaultCat === cat ? "text-brand-accent border-b border-brand-accent -mb-px bg-[rgba(59,130,246,0.05)]" : "text-text-muted hover:text-text-primary"].join(" ")}
                      >{cat}</button>
                    ))}
                  </div>
                  {/* Style grid */}
                  <div className="grid grid-cols-2 gap-px bg-border-subtle">
                    {STYLE_VAULT.filter(s => styleVaultCat === null || s.cat === styleVaultCat).map(style => (
                      <button
                        key={style.id}
                        type="button"
                        onClick={() => {
                          setPrompt(style.prompt);
                          setStyleVaultOpen(false);
                          toast(`Applied: ${style.label}`, { icon: "🎬", duration: 2000 });
                        }}
                        className="group bg-[rgba(13,17,32,0.9)] hover:bg-[rgba(59,130,246,0.06)] text-left px-3 py-2 transition-colors cursor-pointer"
                      >
                        <p className="text-[10px] font-medium text-text-secondary group-hover:text-text-primary transition-colors">{style.label}</p>
                        <p className="text-[8px] text-text-muted mt-0.5 line-clamp-2 leading-relaxed">{style.prompt}</p>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* ── Face Swap Mode ────────────────────────────────────── */}
            <div className="mt-5 flex items-start gap-4 flex-wrap">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => { setFaceSwapMode(v => !v); if (faceSwapMode) setFaceSwapImage(null); }}
                  className={[
                    "flex items-center gap-1.5 text-[11px] px-3 py-1.5 rounded-full border transition-all cursor-pointer",
                    faceSwapMode
                      ? "border-[rgba(139,92,246,0.5)] bg-[rgba(139,92,246,0.12)] text-[#A78BFA]"
                      : "border-border-subtle bg-white/[0.03] text-text-muted hover:text-text-primary hover:border-border-strong",
                  ].join(" ")}
                >
                  <UserCircle size={12} />
                  Face Swap
                  {faceSwapMode && <span className="text-[8px] px-1 py-0.5 rounded bg-[rgba(139,92,246,0.2)] text-[#C4B5FD]">ON</span>}
                </button>
                {faceSwapMode && faceSwapImage && (
                  <div className="flex items-center gap-1.5">
                    <div
                      className="w-6 h-6 rounded-full border border-[rgba(139,92,246,0.4)] bg-cover bg-center shrink-0"
                      style={{ backgroundImage: `url(${faceSwapImage})` }}
                    />
                    <span className="text-[9px] text-[#A78BFA]">Face loaded</span>
                    <button type="button" onClick={() => setFaceSwapImage(null)} className="text-text-muted hover:text-text-primary cursor-pointer"><X size={10} /></button>
                  </div>
                )}
              </div>
              {faceSwapMode && !faceSwapImage && (
                <label className="flex items-center gap-1.5 text-[11px] text-text-muted hover:text-text-primary border border-border-subtle hover:border-border-strong bg-white/[0.03] hover:bg-white/[0.06] px-3 py-1.5 rounded-full cursor-pointer transition-all">
                  {faceSwapUploading ? <Loader2 size={11} className="animate-spin" /> : <Upload size={11} />}
                  {faceSwapUploading ? "Loading…" : "Upload face photo"}
                  <input
                    type="file"
                    accept="image/*"
                    className="sr-only"
                    disabled={faceSwapUploading}
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (file) await handleFaceSwapUpload(file);
                      e.target.value = "";
                    }}
                  />
                </label>
              )}
              {faceSwapMode && (
                <p className="text-[9px] text-text-muted self-center">Upload a clear front-facing portrait. The AI will swap it into generated faces.</p>
              )}
            </div>

            {/* Bottom rail — model picker + aspect picker + generate button */}
            <div className="mt-7 flex items-end justify-between flex-wrap gap-5">
              <div className="flex items-end gap-5 flex-wrap">
                {/* Model picker � icon-first, compact */}
                <div>
                  <p className="text-[9px] uppercase tracking-[0.18em] text-text-muted mb-1.5 font-medium">Style</p>
                  <div className="flex gap-1.5">
                    {MODELS.map(m => {
                      const Icon = m.icon;
                      return (
                        <button
                          key={m.id}
                          onClick={() => setStyle(m.id)}
                          className="hf-tile min-w-[68px]"
                          data-active={style === m.id}
                          title={`${m.name} � ${m.sub}`}
                          style={{ overflow: "hidden" }}
                        >
                          {/* Aesthetic gradient stripe � each style gets a unique palette signature */}
                          <span
                            aria-hidden="true"
                            style={{
                              position: "absolute",
                              top: 0,
                              left: 0,
                              right: 0,
                              height: 4,
                              background: m.preview,
                              opacity: 0.85,
                            }}
                          />
                          <Icon size={15} strokeWidth={1.5} />
                          <div className="text-center leading-tight">
                            <p className="text-[10px] font-medium">{m.name}</p>
                            <p className="text-[8.5px] opacity-60">{m.sub}</p>
                          </div>
                          {/* CTR / viral score badge */}
                          <span
                            className="text-[7px] font-bold px-1.5 py-0.5 rounded-full mt-0.5"
                            style={{
                              background: m.ctrTier === "high" ? "rgba(16,185,129,0.18)" : "rgba(245,158,11,0.18)",
                              color: m.ctrTier === "high" ? "#10B981" : "#F59E0B",
                            }}
                          >
                            {m.viralScore}% viral
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Aspect picker � visual mini frames */}
                <div>
                  <p className="text-[9px] uppercase tracking-[0.18em] text-text-muted mb-1.5 font-medium">Aspect</p>
                  <div className="flex gap-1.5">
                    {ASPECTS.map(ar => (
                      <button
                        key={ar.id}
                        onClick={() => setAspectRatio(ar.id)}
                        className="hf-tile min-w-[68px]"
                        data-active={aspectRatio === ar.id}
                        title={`${ar.id} ${ar.label}`}
                      >
                        <div className="flex items-center justify-center h-6 w-6">
                          {DEVICE_FRAMES[ar.id]}
                        </div>
                        <p className="text-[10px] font-medium">{ar.label}</p>
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Generate + Predict viral — stacked CTA group */}
              <div className="flex flex-col items-end gap-2">
                <button
                  onClick={generateVideo}
                  disabled={generating || !prompt.trim()}
                  className="hf-generate flex items-center gap-2.5 shrink-0"
                >
                  {generating ? (
                    <>
                      <ProgressRing progress={progress} size={18} />
                      <span>{Math.round(progress)}%</span>
                    </>
                  ) : (
                    <>
                      <Sparkles size={18} strokeWidth={2.25} />
                      <span>Generate</span>
                    </>
                  )}
                </button>
                {prompt.trim() && (
                  <button
                    type="button"
                    onClick={predictViral}
                    disabled={viralPredicting}
                    className="inline-flex items-center gap-1.5 text-[10px] text-[#10B981] hover:text-white bg-[rgba(16,185,129,0.08)] hover:bg-[rgba(16,185,129,0.18)] border border-[rgba(16,185,129,0.2)] hover:border-[rgba(16,185,129,0.4)] px-3 py-1.5 rounded-full transition-all disabled:opacity-50 cursor-pointer"
                  >
                    {viralPredicting ? <Loader2 size={10} className="animate-spin" /> : <TrendingUp size={10} />}
                    {viralPredicting ? "Analysing…" : "Predict viral potential"}
                  </button>
                )}
              </div>
            </div>

            {/* ── Viral prediction result panel ────────────────────── */}
            <AnimatePresence>
              {viralResult && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.22, ease: [0.32, 0.72, 0, 1] }}
                  className="overflow-hidden"
                >
                  <div className="mt-5 pt-5 border-t border-border-subtle">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-2">
                        <TrendingUp size={13} className="text-[#10B981]" />
                        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-text-muted">Viral Prediction</p>
                      </div>
                      <button type="button" onClick={() => setViralResult(null)} className="text-text-muted hover:text-text-primary cursor-pointer"><X size={12} /></button>
                    </div>
                    <div className="grid grid-cols-2 gap-3 mb-4">
                      {/* Viral score */}
                      <div className="bg-[rgba(16,185,129,0.06)] border border-[rgba(16,185,129,0.15)] rounded-xl p-3">
                        <p className="text-[8px] uppercase tracking-wider text-[#10B981] mb-1 font-medium">Viral Score</p>
                        <div className="flex items-end gap-1.5">
                          <p className="font-display text-3xl font-bold text-[#10B981] tabular-nums">{viralResult.viral_score}</p>
                          <p className="text-[10px] text-[#10B981] opacity-60 mb-1">/100</p>
                        </div>
                        {/* Score bar */}
                        <div className="mt-2 h-1 rounded-full bg-white/[0.06]">
                          <div
                            className="h-full rounded-full"
                            style={{
                              width: `${viralResult.viral_score}%`,
                              background: viralResult.viral_score >= 80 ? "#10B981" : viralResult.viral_score >= 60 ? "#F59E0B" : "#EF4444",
                            }}
                          />
                        </div>
                      </div>
                      {/* CTR estimate */}
                      <div className="bg-[rgba(59,130,246,0.06)] border border-[rgba(59,130,246,0.15)] rounded-xl p-3">
                        <p className="text-[8px] uppercase tracking-wider text-brand-accent mb-1 font-medium flex items-center gap-1"><Target size={8} /> Est. CTR</p>
                        <p className="font-display text-3xl font-bold text-brand-accent tabular-nums">{viralResult.ctr_estimate}</p>
                        <p className="text-[9px] text-text-muted mt-1">click-through rate</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <p className="text-[8px] uppercase tracking-wider text-[#10B981] mb-2 font-medium">Strengths</p>
                        <ul className="space-y-1">
                          {viralResult.strengths.map((s, i) => (
                            <li key={i} className="flex items-start gap-1.5 text-[10px] text-text-secondary">
                              <span className="text-[#10B981] mt-0.5 shrink-0">✓</span>
                              {s}
                            </li>
                          ))}
                        </ul>
                      </div>
                      <div>
                        <p className="text-[8px] uppercase tracking-wider text-[#F59E0B] mb-2 font-medium">Improve</p>
                        <ul className="space-y-1">
                          {viralResult.suggestions.map((s, i) => (
                            <li key={i} className="flex items-start gap-1.5 text-[10px] text-text-secondary">
                              <span className="text-[#F59E0B] mt-0.5 shrink-0">→</span>
                              {s}
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Full-width progress bar � only visible during generation */}
          <AnimatePresence>
            {generating && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.2, ease: [0.32, 0.72, 0, 1] }}
                className="overflow-hidden"
              >
                <div className="space-y-2 py-1">
                  <div className="flex items-center justify-between text-[10px] text-text-muted">
                    <span>Estimated 45�90 seconds � Frame {Math.round((progress / 100) * numFrames)}/{numFrames}</span>
                    <span>{Math.round(progress)}%</span>
                  </div>
                  <div className="h-1 rounded-full bg-white/[0.06] overflow-hidden">
                    <motion.div
                      className="h-full rounded-full bg-gradient-to-r from-[#2563EB] to-[#3B82F6]"
                      animate={{ width: `${progress}%` }}
                      transition={{ duration: 0.8, ease: "easeOut" }}
                    />
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Advanced settings � collapsed by default, hover/click to expand */}
          <div>
            <button
              onClick={() => setAdvancedOpen(v => !v)}
              className="flex items-center gap-1.5 text-[11px] text-text-muted hover:text-text-primary transition-colors px-1"
            >
              {advancedOpen ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
              Advanced settings
              <span className="text-text-muted ml-1">
                � {(numFrames / 24).toFixed(1)}s � guidance {guidanceScale}
              </span>
            </button>
            {advancedOpen && (
              <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3 p-4 border border-border-subtle bg-white/[0.03] rounded-xl">
                <div>
                  <label className="block text-[9px] text-text-muted uppercase tracking-[0.16em] mb-1.5">
                    Frames
                    <span className="normal-case tracking-normal ml-1 text-text-muted">
                      (max {Number.isFinite(maxFrames) ? maxFrames : "8"})
                    </span>
                  </label>
                  <input
                    type="number"
                    min={8}
                    max={Number.isFinite(maxFrames) ? maxFrames : undefined}
                    value={numFrames}
                    onChange={e => {
                      const raw = parseInt(e.target.value) || 24;
                      const capped = Number.isFinite(maxFrames) ? Math.min(raw, maxFrames) : raw;
                      setNumFrames(capped);
                    }}
                    className="input w-full text-xs bg-surface-light border-border-subtle"
                  />
                  <p className="text-[9px] text-text-muted mt-1">~{(numFrames / 24).toFixed(1)}s @ 24fps</p>
                </div>
                <div>
                  <label className="block text-[9px] text-text-muted uppercase tracking-[0.16em] mb-1.5">Guidance scale</label>
                  <input
                    type="number" min={1} max={20} step={0.5} value={guidanceScale}
                    onChange={e => setGuidanceScale(parseFloat(e.target.value) || 7.5)}
                    className="input w-full text-xs bg-surface-light border-border-subtle"
                  />
                  <p className="text-[9px] text-text-muted mt-1">Higher = stricter prompt adherence</p>
                </div>
                {nextTierLabel && (
                  <Link
                    href="/dashboard/upgrade"
                    className="col-span-full flex items-center justify-center gap-1.5 text-[10px] text-brand-accent hover:text-[#3B82F6] py-1.5 rounded-lg border border-[rgba(59,130,246,0.2)] bg-[rgba(59,130,246,0.04)] transition-all"
                  >
                    <Lock size={10} /> Upgrade to unlock longer videos ({nextTierLabel})
                  </Link>
                )}
              </div>
            )}
          </div>

          {/* ─── HTML Templates (HyperFrames-style short-form cards) ─── */}
          <div>
            <button
              onClick={() => setTemplatesOpen(v => !v)}
              className="flex items-center gap-1.5 text-[11px] text-text-muted hover:text-text-primary transition-colors px-1"
            >
              {templatesOpen ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
              Text templates
              <span className="text-text-muted ml-1 text-[10px]">— Headline · Listicle · Quote</span>
            </button>
            <AnimatePresence initial={false}>
              {templatesOpen && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.22, ease: [0.32, 0.72, 0, 1] }}
                  className="overflow-hidden"
                >
                  <div className="mt-3">
                    <TemplatePicker
                      brandColor={brandColor}
                      bgColor="#020711"
                      onSelect={(html, templateId) => {
                        const blob = new Blob([html], { type: "text/html" });
                        const url = URL.createObjectURL(blob);
                        window.open(url, "_blank", "noopener");
                        setTimeout(() => URL.revokeObjectURL(url), 30_000);
                        toast.success("Template preview opened — use a screen recorder to capture it");
                        void templateId;
                      }}
                    />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* GALLERY� fullbleed thumbs, no card chrome */}
          {results.length === 0 ? (
            <div className="text-center py-16 text-text-muted">
              <Film size={28} strokeWidth={1} className="mx-auto mb-3 opacity-50" />
              <p className="text-sm font-light">Your generations will appear here.</p>
            </div>
          ) : (
            <motion.div
              className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3"
              initial="hidden"
              animate="visible"
              variants={{ hidden: {}, visible: { transition: { staggerChildren: 0.06 } } }}
            >
              {results.map(result => {
                const isVertical = result.aspect_ratio === "9:16";
                const isSquare = result.aspect_ratio === "1:1";
                const aspectClass = isVertical ? "aspect-[9/16]" : isSquare ? "aspect-square" : "aspect-video";
                return (
                  <motion.div
                    key={result.id}
                    className={`hf-thumb rounded-xl ${aspectClass} group`}
                    style={{ background: "rgba(0,0,0,0.03)", border: "1px solid rgba(0,0,0,0.08)" }}
                    variants={{ hidden: { opacity: 0, y: 12 }, visible: { opacity: 1, y: 0, transition: { duration: 0.22, ease: [0.22, 1, 0.36, 1] } } }}
                    whileHover={{ y: -4, scale: 1.02 }}
                  >
                    {result.url ? (
                      <SafeThumb
                        src={result.url}
                        kind="video"
                        hoverPlay
                        wrapperClassName="w-full h-full"
                        className="w-full h-full object-cover"
                        fallback={
                          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-black via-zinc-950 to-black text-red-300/70">
                            <div className="text-center px-3">
                              <AlertCircle size={16} className="mx-auto mb-1.5" />
                              <p className="text-[10px] font-light">Failed to load</p>
                            </div>
                          </div>
                        }
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-black via-zinc-950 to-black">
                        {result.status === "generating" && (
                          <div className="flex flex-col items-center gap-2 text-[#6B7280]">
                            <ProgressRing progress={progress} size={28} />
                            <p className="text-[10px] font-light">{Math.round(progress)}%</p>
                          </div>
                        )}
                        {result.status === "plan" && (
                          <div className="text-center px-3 text-[#6B7280]">
                            <Sparkles size={16} className="mx-auto mb-1.5 text-[rgba(59,130,246,0.7)]" />
                            <p className="text-[10px] font-light">Plan ready</p>
                          </div>
                        )}
                        {result.status === "failed" && (
                          <div className="flex flex-col items-center gap-2 px-3 text-red-300/70 group/fail">
                            <AlertCircle size={16} />
                            <p className="text-[10px] font-light">Failed</p>
                            {result.error && (
                              <p className="text-[9px] text-center text-red-300/50 line-clamp-3 opacity-0 group-hover/fail:opacity-100 transition-opacity duration-150">
                                {result.error}
                              </p>
                            )}
                            <button
                              onClick={() => {
                                setPrompt(result.prompt);
                                setAspectRatio(result.aspect_ratio);
                                window.scrollTo({ top: 0, behavior: "smooth" });
                              }}
                              className="text-[9px] px-2 py-0.5 rounded-full bg-red-400/10 text-red-300/70 hover:bg-red-400/20 hover:text-red-200 transition-all opacity-0 group-hover/fail:opacity-100"
                            >
                              Retry
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                    <div className="hf-thumb-meta">
                      <p className="line-clamp-2 leading-tight">{result.prompt}</p>
                      <div className="flex items-center justify-between mt-1 text-[9px] text-text-muted">
                        <span>{result.aspect_ratio} � {result.style || "cinematic"}</span>
                        {result.url && (
                          <div className="flex items-center gap-2">
                            <a
                              href={result.url}
                              download
                              className="flex items-center gap-1 hover:text-[#374151] transition-colors"
                              onClick={e => e.stopPropagation()}
                            >
                              <Download size={10} /> Save
                            </a>
                            <button
                              disabled={handoffingId === result.id}
                              onClick={async (e) => {
                                e.stopPropagation();
                                setHandoffingId(result.id);
                                try {
                                  const id = await createHandoff(supabase, {
                                    clipUrl: result.url,
                                    prompt: result.prompt,
                                    aspect_ratio: result.aspect_ratio,
                                    style: result.style,
                                  });
                                  router.push(handoffUrl(id, "/dashboard/video-editor"));
                                } catch (err) {
                                  toast.error(err instanceof Error ? err.message : "Handoff failed");
                                } finally {
                                  setHandoffingId(null);
                                }
                              }}
                              className="flex items-center gap-1 hover:text-white transition-colors disabled:opacity-40"
                            >
                              {handoffingId === result.id
                                ? <Loader2 size={10} className="animate-spin" />
                                : <Edit3 size={10} />}
                              Edit
                            </button>
                            <button
                              disabled={thumbnailCapturingId === result.id}
                              title="Auto-select best thumbnail frame with AI"
                              onClick={async (e) => {
                                e.stopPropagation();
                                if (result.url) {
                                  await extractBestFrame(result.id, result.url, result.prompt);
                                }
                              }}
                              className="flex items-center gap-1 hover:text-[#3B82F6] transition-colors disabled:opacity-40"
                            >
                              {thumbnailCapturingId === result.id
                                ? <Loader2 size={10} className="animate-spin" />
                                : <Image size={10} />}
                              Thumb
                            </button>
                            <button
                              title="Preview with brand overlay in Remotion"
                              onClick={(e) => {
                                e.stopPropagation();
                                if (overlayPreviewId === result.id) {
                                  setOverlayPreviewId(null);
                                } else {
                                  setOverlayPreviewId(result.id);
                                  setOverlayTitle(result.prompt.slice(0, 80));
                                  // Scroll to preview panel
                                  setTimeout(() => {
                                    document.getElementById("remotion-preview-panel")?.scrollIntoView({ behavior: "smooth", block: "start" });
                                  }, 150);
                                }
                              }}
                              className={`flex items-center gap-1 transition-colors ${overlayPreviewId === result.id ? "text-brand-accent" : "hover:text-brand-accent"}`}
                            >
                              <Layers size={10} />
                              Overlay
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                    {result.plan && (
                      <details className="absolute inset-x-0 bottom-0 p-3 bg-black/95 text-white/70 text-[10px] max-h-[70%] overflow-y-auto">
                        <summary className="cursor-pointer text-brand-accent font-semibold mb-1">Scene plan</summary>
                        <pre className="whitespace-pre-wrap font-sans leading-snug mt-1.5">{result.plan}</pre>
                      </details>
                    )}
                  </motion.div>
                );
              })}
            </motion.div>
          )}
        </>
      )}

      {/* Guided-mode result preview (preserved) */}
      {!advancedMode && results.length > 0 && (
        <div className="space-y-3">
          <h2 className="flex items-center gap-2">
            <Film size={14} className="text-brand-accent" /> Your generated videos
          </h2>
          {results.slice(0, 3).map(result => (
            <div key={result.id} className="glass rounded-xl p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium mb-1 line-clamp-2">{result.prompt}</p>
                  <div className="flex items-center gap-2">
                    <span className="text-[8px] bg-surface-light text-text-muted px-1.5 py-0.5 rounded">{result.aspect_ratio}</span>
                    {result.status === "generating" && (
                      <span className="text-[8px] text-brand-accent flex items-center gap-1">
                        <ProgressRing progress={progress} size={10} /> {Math.round(progress)}%
                      </span>
                    )}
                    {result.status === "completed" && (
                      <span className="text-[8px] text-success flex items-center gap-1">
                        <Play size={8} /> Ready
                      </span>
                    )}
                    {result.status === "failed" && (
                      <span className="text-[8px] text-danger flex items-center gap-1" title={result.error}>
                        <AlertCircle size={8} /> Failed{result.error ? ` � ${result.error.slice(0, 40)}` : ""}
                      </span>
                    )}
                  </div>
                </div>
                {result.url && (
                  <div className="flex items-center gap-2">
                    <a href={result.url} download className="btn-pill-ghost text-[10px] flex items-center gap-1">
                      <Download size={10} /> Download
                    </a>
                    <button
                      disabled={handoffingId === result.id}
                      onClick={async () => {
                        setHandoffingId(result.id);
                        try {
                          const id = await createHandoff(supabase, {
                            clipUrl: result.url,
                            prompt: result.prompt,
                            aspect_ratio: result.aspect_ratio,
                            style: result.style,
                          });
                          router.push(handoffUrl(id, "/dashboard/video-editor"));
                        } catch (err) {
                          toast.error(err instanceof Error ? err.message : "Handoff failed");
                        } finally {
                          setHandoffingId(null);
                        }
                      }}
                      className="btn-pill text-[10px] flex items-center gap-1"
                    >
                      {handoffingId === result.id
                        ? <Loader2 size={10} className="animate-spin" />
                        : <Edit3 size={10} />}
                      Edit in Video Editor
                    </button>
                  </div>
                )}
              </div>
              {result.url && (
                <div className="mt-3 rounded-xl overflow-hidden bg-black aspect-video">
                  <SafeThumb
                    src={result.url}
                    kind="video"
                    controls
                    muted={false}
                    loop={false}
                    wrapperClassName="w-full h-full"
                    className="w-full h-full object-contain"
                  />
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Remotion overlay preview panel — shown when a completed video has overlay selected */}
      <AnimatePresence>
        {overlayPreviewId && (() => {
          const previewResult = results.find(r => r.id === overlayPreviewId && r.url);
          if (!previewResult?.url) return null;
          return (
            <motion.div
              id="remotion-preview-panel"
              key="remotion-preview"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.28, ease: [0.32, 0.72, 0, 1] }}
              className="overflow-hidden"
            >
              <div className="glass-card rounded-2xl p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-text-muted mb-0.5">Remotion Overlay Preview</p>
                    <p className="text-xs text-text-secondary line-clamp-1">{previewResult.prompt}</p>
                  </div>
                  <button
                    onClick={() => setOverlayPreviewId(null)}
                    className="text-text-muted hover:text-text-primary transition-colors p-1 rounded-lg hover:bg-white/[0.05]"
                    aria-label="Close overlay preview"
                  >
                    <ChevronDown size={14} />
                  </button>
                </div>

                {/* Overlay title editor */}
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={overlayTitle}
                    onChange={e => setOverlayTitle(e.target.value)}
                    placeholder="Overlay title text (leave blank for none)"
                    className="flex-1 px-3 py-2 rounded-xl bg-surface-light border border-border-subtle text-xs focus:outline-none focus:border-[rgba(59,130,246,0.5)] focus:ring-1 focus:ring-[rgba(59,130,246,0.2)] transition-all"
                  />
                  <span className="text-[9px] text-text-muted whitespace-nowrap">Shown as text overlay</span>
                </div>

                {/* Remotion Player */}
                <div className="flex justify-center">
                  <RemotionOverlayPlayer
                    videoUrl={previewResult.url}
                    title={overlayTitle}
                    captionText={previewResult.prompt.slice(0, 120)}
                    brandColor="#3B82F6"
                    aspectRatio={previewResult.aspect_ratio as "9:16" | "16:9" | "1:1"}
                    playerHeight={previewResult.aspect_ratio === "9:16" ? 400 : 260}
                    controls
                    autoPlay={false}
                  />
                </div>

                <p className="text-[9px] text-text-muted text-center">
                  Browser preview only. Server export requires a self-hosted Remotion worker &mdash; see{" "}
                  <code className="text-text-secondary/70 bg-white/[0.05] px-1 py-0.5 rounded text-[8px]">/api/video/remotion-render</code>.
                </p>
              </div>
            </motion.div>
          );
        })()}
      </AnimatePresence>

      {/* Setup / GPU env note� admin-only; clients should never see env-var names */}
      {advancedMode && isPlatformAdmin && (
        <div className="flex items-center gap-2 text-[9px] text-text-primary/35 px-1">
          <Zap size={10} />
          <span>
            GPU rendering requires <code className="text-text-primary/55 bg-[rgba(0,0,0,0.05)] px-1 py-0.5 rounded">HIGGSFIELD_URL</code> + <code className="text-text-primary/55 bg-[rgba(0,0,0,0.05)] px-1 py-0.5 rounded">RUNPOD_API_KEY</code>. Without them, you&apos;ll get a scene plan instead.
          </span>
        </div>
      )}
    </div>
  );
}

