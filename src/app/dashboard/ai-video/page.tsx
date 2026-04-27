"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Film, Sparkles, Play, Download,
  Clock, Monitor, Zap, Layers,
  Wand2, Palette, Camera, Music, Type, Lock,
  ChevronDown, ChevronRight, AlertCircle, Edit3, Loader2,
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

// Icon-first model picker — all backed by the same Higgsfield/RunPod pipeline.
// Changing the "style" here adjusts the downstream prompt enhancement, it does
// NOT change the actual model endpoint (that still goes through /api/video/render).
const MODELS = [
  { id: "cinematic", name: "Cinematic", sub: "Film-like grade", icon: Film },
  { id: "realistic", name: "Realistic", sub: "Documentary", icon: Camera },
  { id: "animated", name: "Animated", sub: "3D / Pixar", icon: Palette },
  { id: "anime", name: "Anime", sub: "Japanese", icon: Sparkles },
  { id: "vintage", name: "Vintage", sub: "Film grain", icon: Layers },
  { id: "dreamy", name: "Dreamy", sub: "Soft, ethereal", icon: Wand2 },
];

const ASPECTS = [
  { id: "9:16", label: "Vertical", w: 36, h: 60 },
  { id: "16:9", label: "Landscape", w: 64, h: 36 },
  { id: "1:1", label: "Square", w: 48, h: 48 },
];

interface GenerationResult {
  id: string;
  prompt: string;
  status: "generating" | "completed" | "failed" | "plan";
  url?: string;
  plan?: string;
  aspect_ratio: string;
  style?: string;
  created_at: string;
}

/** Progress ring — premium replacement for a text "generating..." */
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
  const [prompt, setPrompt] = useState("");
  const [aspectRatio, setAspectRatio] = useState("9:16");
  const [style, setStyle] = useState("cinematic");
  const [numFrames, setNumFrames] = useState(72);
  const [guidanceScale, setGuidanceScale] = useState(7.5);
  const [generating, setGenerating] = useState(false);
  const [results, setResults] = useState<GenerationResult[]>([]);
  const [progress, setProgress] = useState(0);
  const [advancedOpen, setAdvancedOpen] = useState(false);

  // ── Tier-based max video length (preserved from original) ──
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
      ? `${nextTier} — ${formatVideoDuration(
          limitsForTier(nextTier).max_video_seconds,
        )}`
      : null;

  // Guided wizard (legacy modal — still accessible to preserve existing flow)
  const [wizardOpen, setWizardOpen] = useState(false);
  useEffect(() => {
    try {
      const seen = localStorage.getItem("ss-aivideo-wizard-seen");
      if (!seen) setWizardOpen(true);
    } catch {}
  }, []);

  // Guided Mode (in-page wizard) ↔ Advanced Mode (Higgsfield-style hero)
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
            className="w-full px-4 py-3 rounded-xl bg-surface-light border border-border text-sm focus:outline-none focus:border-gold/50 focus:ring-2 focus:ring-gold/20 transition-all resize-none"
            autoFocus
          />
          <div>
            <p className="text-[10px] text-muted uppercase tracking-wider mb-1.5 font-semibold">Need inspiration? Try one</p>
            <div className="flex flex-wrap gap-1.5">
              {PROMPT_IDEAS.slice(0, 4).map((idea, i) => (
                <button
                  key={i}
                  onClick={() => setPrompt(idea)}
                  className="text-[10px] text-muted hover:text-foreground bg-surface-light hover:bg-gold/10 hover:border-gold/30 px-2.5 py-1 rounded-full border border-border/50 transition-all"
                >
                  {idea.slice(0, 45)}…
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
                  ? "border-gold bg-gold/10 shadow-lg shadow-gold/10"
                  : "border-border hover:border-gold/30 bg-surface-light"
              }`}
            >
              <div
                className="hf-aspect-frame"
                style={{ width: ar.w, height: ar.h }}
                data-active={aspectRatio === ar.id}
              />
              <div className="text-center">
                <p className="text-sm font-semibold">{ar.id}</p>
                <p className="text-[10px] text-muted">{ar.label}</p>
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
                <button
                  key={opt.f}
                  onClick={() => !locked && setNumFrames(opt.f)}
                  disabled={locked}
                  className={`p-3 rounded-xl border transition-all text-center relative ${
                    locked
                      ? "border-gold/30 bg-surface-light/40 opacity-60 cursor-not-allowed"
                      : numFrames === opt.f
                        ? "border-gold bg-gold/10"
                        : "border-border hover:border-gold/30 bg-surface-light"
                  }`}
                >
                  {locked && (
                    <span className="absolute top-1 right-1">
                      <Lock size={10} className="text-gold" />
                    </span>
                  )}
                  <p className="text-sm font-bold">{opt.label}</p>
                  <p className="text-[9px] text-muted">{opt.sub}</p>
                </button>
              );
            })}
          </div>
          {nextTierLabel && (
            <Link
              href="/dashboard/upgrade"
              className="flex items-center justify-center gap-1.5 text-[10px] text-gold hover:text-amber-400 py-1.5 rounded-lg border border-gold/20 bg-gold/[0.04] transition-all"
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
          <div className="card bg-gold/[0.04] border-gold/20">
            <p className="text-[10px] uppercase tracking-wider text-gold font-semibold mb-2">Your prompt</p>
            <p className="text-sm text-foreground leading-relaxed">{prompt || <span className="text-muted italic">(no prompt set)</span>}</p>
            <div className="grid grid-cols-2 gap-3 mt-4 pt-3 border-t border-border/50">
              <div>
                <p className="text-[9px] uppercase tracking-wider text-muted">Aspect</p>
                <p className="text-xs font-semibold">{aspectRatio}</p>
              </div>
              <div>
                <p className="text-[9px] uppercase tracking-wider text-muted">Duration</p>
                <p className="text-xs font-semibold">~{(numFrames / 24).toFixed(1)}s ({numFrames} frames)</p>
              </div>
            </div>
          </div>
          <p className="text-[11px] text-muted text-center">
            Want finer control? Flip to <span className="text-gold font-semibold">Advanced mode</span> at the top.
          </p>
        </div>
      ),
    },
  ];

  // Legacy wizard config preserved — same API shape as before
  const videoGenWizardSteps: WizardStep[] = [
    {
      id: "what",
      title: "What do you want in your video?",
      description: "Describe the scene. Be visual — mention subjects, environment, lighting, camera movement.",
      icon: <Type size={16} />,
      field: { type: "textarea", key: "prompt", placeholder: "e.g., A sleek red sports car driving through a neon-lit city at night, rain on the streets, cinematic camera" },
    },
    {
      id: "style",
      title: "Pick a visual style",
      description: "This changes the entire look — camera, lighting, color grade.",
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
          { value: "48", label: "2 seconds", description: "48 frames · Fast & cheap" },
          { value: "72", label: "3 seconds", description: "72 frames · Balanced" },
          { value: "120", label: "5 seconds", description: "120 frames · Standard" },
          { value: "144", label: "6 seconds", description: "144 frames · Max quality" },
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
        setResults(prev => prev.map(r => r.id === id ? { ...r, status: "failed" } : r));
        toast.error(
          data.error ||
            `Plan limit hit (${data.plan_tier}: ${data.current}/${data.limit}). Upgrade to continue.`,
        );
      } else if (data.success && data.url) {
        setResults(prev => prev.map(r => r.id === id ? { ...r, status: "completed", url: data.url } : r));
        toast.success("Video generated");
      } else if (data.plan) {
        setResults(prev => prev.map(r => r.id === id ? { ...r, status: "plan", plan: data.plan } : r));
        toast.success("Video plan created");
      } else {
        setResults(prev => prev.map(r => r.id === id ? { ...r, status: "failed" } : r));
        const attemptedMsg = Array.isArray(data.attempted) && data.attempted.length > 0
          ? `Video render failed. Tried: ${data.attempted.join(", ")}`
          : (data.error || "Generation failed");
        toast.error(attemptedMsg);
      }
    } catch (err) {
      console.error("[ai-video] generateVideo error:", err);
      clearInterval(progressInterval);
      setResults(prev => prev.map(r => r.id === id ? { ...r, status: "failed" } : r));
      toast.error("Connection error");
    }
    setGenerating(false);
  }

  return (
    <div className="fade-in space-y-5">
      {/* Minimal top bar — no marketing chrome. Just mode toggle + subtle title. */}
      <div className="flex items-center justify-between gap-4 px-1 pt-1">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-gold/20 to-amber-500/10 border border-gold/20 flex items-center justify-center text-gold shrink-0">
            <Film size={16} />
          </div>
          <div className="min-w-0">
            <h1 className="text-base font-semibold tracking-tight truncate">AI Video</h1>
            <p className="text-[10px] text-muted truncate">Text → rendered clip · {planTier}</p>
          </div>
        </div>
        <AdvancedToggle value={advancedMode} onChange={setAdvancedMode} />
      </div>

      {/* Guided Mode — preserved untouched for beginners */}
      {!advancedMode && (
        <Wizard
          steps={guidedSteps}
          activeIdx={guidedStep}
          onStepChange={setGuidedStep}
          finishLabel={generating ? "Generating…" : "Generate video"}
          busy={generating}
          onFinish={async () => { await generateVideo(); }}
          onCancel={() => setAdvancedMode(true)}
          cancelLabel="Advanced mode"
        />
      )}

      {/* Legacy modal wizard — preserved for first-run users */}
      <CreationWizard
        open={wizardOpen}
        title="Create Your AI Video"
        subtitle="Step-by-step — describe, pick style, hit generate."
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

      {/* ─────────────── ADVANCED: Higgsfield-style cinematic hero ─────────────── */}
      {advancedMode && (
        <>
          {/* HERO — huge prompt, dominant generate CTA, minimal chrome */}
          <div className="hf-canvas rounded-3xl p-8 sm:p-10 relative overflow-hidden">
            {/* Prompt textarea — the real star */}
            <textarea
              value={prompt}
              onChange={e => setPrompt(e.target.value)}
              placeholder="Describe your scene..."
              className="hf-prompt"
              autoFocus
            />

            {/* Inspiration chips — low-key, tucked under the prompt */}
            {!prompt && (
              <div className="mt-4 flex flex-wrap gap-1.5">
                {PROMPT_IDEAS.slice(0, 4).map((idea, i) => (
                  <button
                    key={i}
                    onClick={() => setPrompt(idea)}
                    className="text-[10px] text-white/40 hover:text-white/80 px-2.5 py-1 rounded-full border border-white/8 hover:border-white/20 transition-all"
                  >
                    {idea.slice(0, 48)}…
                  </button>
                ))}
              </div>
            )}

            {/* Bottom rail — model picker + aspect picker + generate button */}
            <div className="mt-7 flex items-end justify-between flex-wrap gap-5">
              <div className="flex items-end gap-5 flex-wrap">
                {/* Model picker — icon-first, compact */}
                <div>
                  <p className="text-[9px] uppercase tracking-[0.18em] text-white/35 mb-1.5 font-medium">Style</p>
                  <div className="flex gap-1.5">
                    {MODELS.map(m => {
                      const Icon = m.icon;
                      return (
                        <button
                          key={m.id}
                          onClick={() => setStyle(m.id)}
                          className="hf-tile min-w-[68px]"
                          data-active={style === m.id}
                          title={`${m.name} — ${m.sub}`}
                        >
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

                {/* Aspect picker — visual mini frames */}
                <div>
                  <p className="text-[9px] uppercase tracking-[0.18em] text-white/35 mb-1.5 font-medium">Aspect</p>
                  <div className="flex gap-1.5">
                    {ASPECTS.map(ar => (
                      <button
                        key={ar.id}
                        onClick={() => setAspectRatio(ar.id)}
                        className="hf-tile min-w-[68px]"
                        data-active={aspectRatio === ar.id}
                        title={`${ar.id} ${ar.label}`}
                      >
                        <div
                          className="hf-aspect-frame flex items-center justify-center"
                          style={{
                            width: Math.min(ar.w, 28),
                            height: Math.min(ar.h, 28),
                          }}
                        />
                        <p className="text-[10px] font-medium">{ar.id}</p>
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Generate — big, gold, pulsing */}
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

          {/* Advanced settings — collapsed by default, hover/click to expand */}
          <div>
            <button
              onClick={() => setAdvancedOpen(v => !v)}
              className="flex items-center gap-1.5 text-[11px] text-white/45 hover:text-white/80 transition-colors px-1"
            >
              {advancedOpen ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
              Advanced settings
              <span className="text-white/25 ml-1">
                · {(numFrames / 24).toFixed(1)}s · guidance {guidanceScale}
              </span>
            </button>
            {advancedOpen && (
              <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3 p-4 rounded-2xl border border-white/5 bg-white/[0.015]">
                <div>
                  <label className="block text-[9px] text-white/35 uppercase tracking-[0.16em] mb-1.5">
                    Frames
                    <span className="normal-case tracking-normal ml-1 text-white/25">
                      (max {Number.isFinite(maxFrames) ? maxFrames : "∞"})
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
                    className="input w-full text-xs bg-black/40 border-white/10"
                  />
                  <p className="text-[9px] text-white/30 mt-1">~{(numFrames / 24).toFixed(1)}s @ 24fps</p>
                </div>
                <div>
                  <label className="block text-[9px] text-white/35 uppercase tracking-[0.16em] mb-1.5">Guidance scale</label>
                  <input
                    type="number" min={1} max={20} step={0.5} value={guidanceScale}
                    onChange={e => setGuidanceScale(parseFloat(e.target.value) || 7.5)}
                    className="input w-full text-xs bg-black/40 border-white/10"
                  />
                  <p className="text-[9px] text-white/30 mt-1">Higher = stricter prompt adherence</p>
                </div>
                {nextTierLabel && (
                  <Link
                    href="/dashboard/upgrade"
                    className="col-span-full flex items-center justify-center gap-1.5 text-[10px] text-gold hover:text-amber-400 py-1.5 rounded-lg border border-gold/20 bg-gold/[0.04] transition-all"
                  >
                    <Lock size={10} /> Upgrade to unlock longer videos ({nextTierLabel})
                  </Link>
                )}
              </div>
            )}
          </div>

          {/* GALLERY — fullbleed thumbs, no card chrome */}
          {results.length === 0 ? (
            <div className="text-center py-16 text-white/30">
              <Film size={28} strokeWidth={1} className="mx-auto mb-3 opacity-50" />
              <p className="text-sm font-light">Your generations will appear here.</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              {results.map(result => {
                const isVertical = result.aspect_ratio === "9:16";
                const isSquare = result.aspect_ratio === "1:1";
                const aspectClass = isVertical ? "aspect-[9/16]" : isSquare ? "aspect-square" : "aspect-video";
                return (
                  <div key={result.id} className={`hf-thumb ${aspectClass} group`}>
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
                          <div className="flex flex-col items-center gap-2 text-white/60">
                            <ProgressRing progress={progress} size={28} />
                            <p className="text-[10px] font-light">{Math.round(progress)}%</p>
                          </div>
                        )}
                        {result.status === "plan" && (
                          <div className="text-center px-3 text-white/70">
                            <Sparkles size={16} className="mx-auto mb-1.5 text-gold/70" />
                            <p className="text-[10px] font-light">Plan ready</p>
                          </div>
                        )}
                        {result.status === "failed" && (
                          <div className="text-center px-3 text-red-300/70">
                            <AlertCircle size={16} className="mx-auto mb-1.5" />
                            <p className="text-[10px] font-light">Failed</p>
                          </div>
                        )}
                      </div>
                    )}
                    <div className="hf-thumb-meta">
                      <p className="line-clamp-2 leading-tight">{result.prompt}</p>
                      <div className="flex items-center justify-between mt-1 text-[9px] text-white/55">
                        <span>{result.aspect_ratio} · {result.style || "cinematic"}</span>
                        {result.url && (
                          <div className="flex items-center gap-2">
                            <a
                              href={result.url}
                              download
                              className="flex items-center gap-1 hover:text-white transition-colors"
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
                          </div>
                        )}
                      </div>
                    </div>
                    {result.plan && (
                      <details className="absolute inset-x-0 bottom-0 p-3 bg-black/95 text-white/80 text-[10px] max-h-[70%] overflow-y-auto">
                        <summary className="cursor-pointer text-gold font-semibold mb-1">Scene plan</summary>
                        <pre className="whitespace-pre-wrap font-sans leading-snug mt-1.5">{result.plan}</pre>
                      </details>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* Guided-mode result preview (preserved) */}
      {!advancedMode && results.length > 0 && (
        <div className="space-y-3">
          <h2 className="section-header flex items-center gap-2">
            <Film size={14} className="text-gold" /> Your generated videos
          </h2>
          {results.slice(0, 3).map(result => (
            <div key={result.id} className="card">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium mb-1 line-clamp-2">{result.prompt}</p>
                  <div className="flex items-center gap-2">
                    <span className="text-[8px] bg-surface-light text-muted px-1.5 py-0.5 rounded">{result.aspect_ratio}</span>
                    {result.status === "generating" && (
                      <span className="text-[8px] text-gold flex items-center gap-1">
                        <ProgressRing progress={progress} size={10} /> {Math.round(progress)}%
                      </span>
                    )}
                    {result.status === "completed" && (
                      <span className="text-[8px] text-success flex items-center gap-1">
                        <Play size={8} /> Ready
                      </span>
                    )}
                    {result.status === "failed" && (
                      <span className="text-[8px] text-danger">Failed</span>
                    )}
                  </div>
                </div>
                {result.url && (
                  <div className="flex items-center gap-2">
                    <a href={result.url} download className="btn-secondary text-[10px] flex items-center gap-1">
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
                      className="btn-secondary text-[10px] flex items-center gap-1"
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

      {/* Setup / GPU env note — admin-only; clients should never see env-var names */}
      {advancedMode && isPlatformAdmin && (
        <div className="flex items-center gap-2 text-[9px] text-white/25 px-1">
          <Zap size={10} />
          <span>
            GPU rendering requires <code className="text-white/45 bg-white/5 px-1 py-0.5 rounded">HIGGSFIELD_URL</code> + <code className="text-white/45 bg-white/5 px-1 py-0.5 rounded">RUNPOD_API_KEY</code>. Without them, you&apos;ll get a scene plan instead.
          </span>
        </div>
      )}
    </div>
  );
}
