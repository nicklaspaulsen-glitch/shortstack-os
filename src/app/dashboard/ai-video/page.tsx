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
  { id: "cinematic", name: "Cinematic", sub: "Film-like grade", icon: Film,    preview: "linear-gradient(90deg,#0d0d14 0%,#1a2340 40%,#3d5a7a 70%,#8fa8be 100%)" },
  { id: "realistic", name: "Realistic", sub: "Documentary",     icon: Camera,  preview: "linear-gradient(90deg,#2d1e12 0%,#6b4226 40%,#b5855a 70%,#d4a96a 100%)" },
  { id: "animated",  name: "Animated",  sub: "3D / Pixar",      icon: Palette, preview: "linear-gradient(90deg,#4158D0 0%,#C850C0 50%,#FFCC70 100%)" },
  { id: "anime",     name: "Anime",     sub: "Japanese",         icon: Sparkles,preview: "linear-gradient(90deg,#5665E9 0%,#9251AE 40%,#F95B8E 100%)" },
  { id: "vintage",   name: "Vintage",   sub: "Film grain",       icon: Layers,  preview: "linear-gradient(90deg,#2C1810 0%,#7A3D1A 40%,#C4832A 70%,#E8C875 100%)" },
  { id: "dreamy",    name: "Dreamy",    sub: "Soft, ethereal",   icon: Wand2,   preview: "linear-gradient(90deg,#A18CD1 0%,#FBC2EB 50%,#A1C4FD 100%)" },
];

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

  // Guided Mode (in-page wizard) ? Advanced Mode (Higgsfield-style hero)
  const [advancedMode, setAdvancedMode] = useAdvancedMode("ai-video");
  const [guidedStep, setGuidedStep] = useState(0);

  const guidedSteps: WizardStepDef[] = [
    {
      id: "prompt",
      title: "Describe your scene",
      description: "One or two sentences. Mention subject, lighting, camera movement, mood.",
      icon: <Type size={18} />,
      canProceed: prompt.trim().length > 0,
      component: (
        <div className="space-y-3">
          <textarea
            value={prompt}
            onChange={e => setPrompt(e.target.value)}
            placeholder="e.g., Golden retriever running through a field of sunflowers at sunset, cinematic warm lighting, slow tracking shot"
            rows={4}
            className="w-full px-4 py-3 rounded-xl bg-surface-light border border-border-subtle text-sm focus:outline-none focus:border-[rgba(59,130,246,0.5)] focus:ring-2 focus:ring-[rgba(59,130,246,0.2)] transition-all resize-none"
            autoFocus
          />
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
          className="col-span-2 lg:col-span-1 glass rounded-2xl p-5 flex items-center gap-4 shadow-[0_2px_16px_rgba(0,0,0,0.35)]"
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
          className="glass rounded-2xl p-5 flex flex-col justify-center shadow-[0_2px_16px_rgba(0,0,0,0.35)]"
          initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.38, delay: 0.10, ease: [0.22, 1, 0.36, 1] }}
        >
          <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-text-muted mb-1.5">Plan Tier</p>
          <p className="font-display text-2xl font-bold tracking-[-0.02em] text-text-primary">{planTier}</p>
          <p className="text-[11px] text-text-muted mt-1.5">current plan</p>
        </motion.div>
        <motion.div
          className="glass rounded-2xl p-5 flex flex-col justify-center shadow-[0_2px_16px_rgba(0,0,0,0.35)]"
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

            {/* Prompt textarea � the real star */}
            <textarea
              value={prompt}
              onChange={e => setPrompt(e.target.value)}
              placeholder="Describe your scene..."
              className="hf-prompt"
              autoFocus
            />

            {/* Bottom rail � model picker + aspect picker + generate button */}
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

              {/* Generate � big, gold, pulsing */}
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
            </div>
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

          {/* GALLERY � fullbleed thumbs, no card chrome */}
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

      {/* Setup / GPU env note � admin-only; clients should never see env-var names */}
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

