"use client";

import { useState, useEffect } from "react";
import {
  Film, Sparkles, Loader, Play, Download,
  Clock, Monitor, Zap, Layers, RefreshCw,
  Wand2, Palette, Camera, Music, Type
} from "lucide-react";
import toast from "react-hot-toast";
import PromptEnhancer from "@/components/prompt-enhancer";
import { useAuth } from "@/lib/auth-context";
import PageHero from "@/components/ui/page-hero";
import CreationWizard, { type WizardStep } from "@/components/creation-wizard";
import { Wizard, AdvancedToggle, useAdvancedMode, type WizardStepDef } from "@/components/ui/wizard";
import RollingPreview, { type RollingPreviewItem } from "@/components/RollingPreview";
import TutorialSection, { type TutorialStep } from "@/components/TutorialSection";

// Static fallback — real AI-video showcase thumbs from ytimg.com (public CDN).
// Used only when the preview_content table is unreachable. RollingPreview with
// fetchRemote+tool="ai_video" is the primary source and will replace this.
const YT = (id: string) => `https://i.ytimg.com/vi/${id}/maxresdefault.jpg`;
// Verified-working YouTube IDs (stable on ytimg.com). Previous AI-video IDs
// mostly 404'd — most of those showcase videos are gone from YouTube.
// Using popular high-traffic videos that reliably serve maxresdefault.jpg.
const AI_VIDEO_PREVIEW_FALLBACK: RollingPreviewItem[] = [
  { id: "v1", src: YT("_9LX9HSQkWo"), alt: "AI video showcase", tag: "AI Video" },
  { id: "v2", src: YT("HK6y8DAPN_0"), alt: "AI video showcase", tag: "AI Video" },
  { id: "v3", src: YT("LXb3EKWsInQ"), alt: "Nature 4K", tag: "Nature" },
  { id: "v4", src: YT("z9Ul9ccDOqE"), alt: "Macro footage", tag: "Macro" },
  { id: "v5", src: YT("ulCdoCfw-bY"), alt: "Space visual", tag: "Abstract" },
  { id: "v6", src: YT("bHIhgxav9LY"), alt: "Science visual", tag: "Science" },
  { id: "v7", src: YT("dQw4w9WgXcQ"), alt: "Music video", tag: "Music" },
  { id: "v8", src: YT("kJQP7kiw5Fk"), alt: "Cinematic outdoor", tag: "Cinematic" },
  { id: "v9", src: YT("OPf0YbXqDm0"), alt: "Performance clip", tag: "Performance" },
  { id: "v10", src: YT("9bZkp7q19f0"), alt: "Dance cinematic", tag: "Motion" },
  { id: "v11", src: YT("CevxZvSJLk8"), alt: "Nature macro", tag: "Nature" },
  { id: "v12", src: YT("YQHsXMglC9A"), alt: "Atmospheric", tag: "Moody" },
];

const AI_VIDEO_TUTORIAL_STEPS: TutorialStep[] = [
  {
    number: 1,
    title: "Describe your scene",
    description: "Paint a picture with words — subject, lighting, camera, mood. The richer the prompt, the sharper the render.",
    icon: Type,
  },
  {
    number: 2,
    title: "Pick style + aspect ratio",
    description: "Cinematic, anime, vintage, dreamy — match the vibe to the platform (9:16 for Reels, 16:9 for YouTube).",
    icon: Palette,
  },
  {
    number: 3,
    title: "Dial in frames & guidance",
    description: "24 frames = 1s at 24fps. Higher guidance = stricter prompt adherence. Most clips nail it at 72 frames + 7.5.",
    icon: Sparkles,
  },
  {
    number: 4,
    title: "Hit Generate → review → download",
    description: "Your clip renders on RunPod GPU. If GPU is offline, you'll get a scene plan you can use elsewhere.",
    icon: Play,
  },
];

const ASPECT_RATIOS = [
  { id: "16:9", label: "16:9 Landscape", icon: <Monitor size={12} /> },
  { id: "9:16", label: "9:16 Vertical", icon: <Film size={12} /> },
  { id: "1:1", label: "1:1 Square", icon: <Layers size={12} /> },
];

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

interface GenerationResult {
  id: string;
  prompt: string;
  status: "generating" | "completed" | "failed" | "plan";
  url?: string;
  plan?: string;
  aspect_ratio: string;
  created_at: string;
}

export default function AIVideoPage() {
  useAuth();
  const [prompt, setPrompt] = useState("");
  const [aspectRatio, setAspectRatio] = useState("9:16");
  const [numFrames, setNumFrames] = useState(24);
  const [guidanceScale, setGuidanceScale] = useState(7.5);
  const [generating, setGenerating] = useState(false);
  const [results, setResults] = useState<GenerationResult[]>([]);
  const [progress, setProgress] = useState(0);

  // Guided wizard (legacy modal — still accessible from PageHero button)
  const [wizardOpen, setWizardOpen] = useState(false);
  useEffect(() => {
    try {
      const seen = localStorage.getItem("ss-aivideo-wizard-seen");
      if (!seen) setWizardOpen(true);
    } catch {}
  }, []);

  // Guided Mode (in-page wizard) ↔ Advanced Mode (original controls)
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
          {[
            { id: "9:16", label: "Vertical", sub: "TikTok, Reels, Shorts", emoji: "📱", box: "h-20 w-12" },
            { id: "16:9", label: "Landscape", sub: "YouTube, web", emoji: "🖥️", box: "h-12 w-20" },
            { id: "1:1", label: "Square", sub: "Instagram feed", emoji: "⬜", box: "h-16 w-16" },
          ].map(ar => (
            <button
              key={ar.id}
              onClick={() => setAspectRatio(ar.id)}
              className={`flex flex-col items-center gap-2 p-4 rounded-xl border transition-all ${
                aspectRatio === ar.id
                  ? "border-gold bg-gold/10 shadow-lg shadow-gold/10"
                  : "border-border hover:border-gold/30 bg-surface-light"
              }`}
            >
              <div className={`${ar.box} rounded-md bg-gradient-to-br from-gold/30 to-amber-400/20 border border-gold/20 flex items-center justify-center text-lg`}>
                {ar.emoji}
              </div>
              <div>
                <p className="text-sm font-semibold">{ar.id}</p>
                <p className="text-[10px] text-muted">{ar.label}</p>
                <p className="text-[9px] text-muted/70">{ar.sub}</p>
              </div>
            </button>
          ))}
        </div>
      ),
    },
    {
      id: "duration",
      title: "How long?",
      description: "Longer clips take more GPU time. 3 seconds is the sweet spot.",
      icon: <Clock size={18} />,
      component: (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {[
            { f: 24, label: "1s", sub: "Fastest", emoji: "⚡" },
            { f: 48, label: "2s", sub: "Quick", emoji: "🎯" },
            { f: 72, label: "3s", sub: "Recommended", emoji: "⭐" },
            { f: 120, label: "5s", sub: "Max quality", emoji: "💎" },
          ].map(opt => (
            <button
              key={opt.f}
              onClick={() => setNumFrames(opt.f)}
              className={`p-3 rounded-xl border transition-all text-center ${
                numFrames === opt.f
                  ? "border-gold bg-gold/10"
                  : "border-border hover:border-gold/30 bg-surface-light"
              }`}
            >
              <div className="text-xl mb-1">{opt.emoji}</div>
              <p className="text-sm font-bold">{opt.label}</p>
              <p className="text-[9px] text-muted">{opt.sub}</p>
            </button>
          ))}
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

  async function generateVideo() {
    if (!prompt.trim()) { toast.error("Enter a video description"); return; }
    setGenerating(true);
    setProgress(0);

    const progressInterval = setInterval(() => {
      setProgress(prev => Math.min(prev + Math.random() * 5, 90));
    }, 1000);

    const id = crypto.randomUUID();
    setResults(prev => [{
      id, prompt, status: "generating", aspect_ratio: aspectRatio,
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
          style: "cinematic",
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
      console.log("[ai-video] /api/video/render response:", data);
      if (data.success && data.url) {
        setResults(prev => prev.map(r => r.id === id ? { ...r, status: "completed", url: data.url } : r));
        toast.success("Video generated!");
      } else if (data.plan) {
        setResults(prev => prev.map(r => r.id === id ? { ...r, status: "plan", plan: data.plan } : r));
        toast.success("Video plan created (GPU endpoint not configured — showing scene plan)");
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
          { value: "cinematic", label: "Cinematic", description: "Film-like, dramatic lighting", emoji: "🎬", preview: "bg-gradient-to-br from-orange-500/40 to-teal-500/40" },
          { value: "realistic", label: "Realistic", description: "Natural, documentary feel", emoji: "📷", preview: "bg-gradient-to-br from-stone-500/40 to-slate-500/40" },
          { value: "animated", label: "Animated", description: "3D animation, Pixar-like", emoji: "🎨", preview: "bg-gradient-to-br from-pink-500/40 to-purple-500/40" },
          { value: "anime", label: "Anime", description: "Japanese animation style", emoji: "🌸", preview: "bg-gradient-to-br from-rose-400/40 to-indigo-500/40" },
          { value: "vintage", label: "Vintage", description: "Film grain, retro colors", emoji: "📼", preview: "bg-gradient-to-br from-amber-500/40 to-red-700/40" },
          { value: "futuristic", label: "Futuristic", description: "Neon, cyberpunk", emoji: "🤖", preview: "bg-gradient-to-br from-cyan-500/40 to-purple-700/40" },
          { value: "dreamy", label: "Dreamy", description: "Soft, ethereal", emoji: "☁️", preview: "bg-gradient-to-br from-pink-300/40 to-blue-300/40" },
          { value: "dark", label: "Dark/Moody", description: "Low-key, dramatic", emoji: "🌑", preview: "bg-gradient-to-br from-slate-900 to-red-900/40" },
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
          { value: "9:16", label: "9:16 Vertical", description: "TikTok, Reels, Shorts", emoji: "📱" },
          { value: "16:9", label: "16:9 Landscape", description: "YouTube, web", emoji: "🖥️" },
          { value: "1:1", label: "1:1 Square", description: "Instagram feed", emoji: "⬜" },
        ],
      },
    },
    {
      id: "camera",
      title: "Camera movement",
      description: "How should the camera move? Static works for most product shots.",
      icon: <Camera size={16} />,
      field: {
        type: "choice-cards",
        key: "camera",
        optional: true,
        options: [
          { value: "static", label: "Static", description: "Camera doesn't move", emoji: "📷" },
          { value: "pan", label: "Pan", description: "Horizontal sweep", emoji: "↔️" },
          { value: "zoom_in", label: "Zoom In", description: "Slowly approaches subject", emoji: "🔍" },
          { value: "zoom_out", label: "Zoom Out", description: "Pulls back reveal", emoji: "🔭" },
          { value: "orbit", label: "Orbit", description: "Circles around subject", emoji: "🌀" },
          { value: "tracking", label: "Tracking", description: "Follows subject", emoji: "🏃" },
          { value: "crane", label: "Crane Up", description: "Rises dramatically", emoji: "⬆️" },
          { value: "dolly", label: "Dolly In", description: "Slow push forward", emoji: "🚄" },
        ],
      },
    },
    {
      id: "mood",
      title: "Mood & energy",
      description: "Sets the emotional tone.",
      icon: <Sparkles size={16} />,
      field: {
        type: "chip-select",
        key: "mood",
        optional: true,
        options: [
          { value: "epic", label: "Epic", emoji: "🎭" },
          { value: "calm", label: "Calm", emoji: "🧘" },
          { value: "energetic", label: "Energetic", emoji: "⚡" },
          { value: "mysterious", label: "Mysterious", emoji: "🔮" },
          { value: "warm", label: "Warm", emoji: "☀️" },
          { value: "cold", label: "Cold", emoji: "❄️" },
          { value: "happy", label: "Happy", emoji: "😊" },
          { value: "melancholic", label: "Melancholic", emoji: "🌧️" },
        ],
      },
    },
    {
      id: "duration",
      title: "Duration",
      description: "Higgsfield works best at 2-6 seconds. Longer clips cost more GPU time.",
      icon: <Clock size={16} />,
      field: {
        type: "choice-cards",
        key: "duration",
        options: [
          { value: "48", label: "2 seconds", description: "48 frames · Fast & cheap", emoji: "⚡" },
          { value: "72", label: "3 seconds", description: "72 frames · Balanced", emoji: "🎯" },
          { value: "120", label: "5 seconds", description: "120 frames · Standard", emoji: "⭐" },
          { value: "144", label: "6 seconds", description: "144 frames · Max quality", emoji: "💎" },
        ],
      },
    },
    {
      id: "enhancements",
      title: "AI enhancements (optional)",
      description: "Toggle extras that improve quality but add render time.",
      icon: <Wand2 size={16} />,
      field: {
        type: "chip-select",
        key: "enhancements",
        optional: true,
        options: [
          { value: "upscale", label: "4K Upscale", emoji: "🔍" },
          { value: "motion_smooth", label: "Motion Smoothing", emoji: "✨" },
          { value: "face_enhance", label: "Face Enhance", emoji: "👤" },
          { value: "color_grade", label: "Cinematic Grade", emoji: "🎨" },
          { value: "denoise", label: "Denoise", emoji: "🧹" },
          { value: "stabilize", label: "Stabilize", emoji: "📐" },
        ],
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
          { value: "cinematic", label: "🎬 Cinematic orchestral" },
          { value: "epic", label: "🥁 Epic trailer" },
          { value: "upbeat", label: "⚡ Upbeat electronic" },
          { value: "chill", label: "🎧 Chill lo-fi" },
          { value: "ambient", label: "🌊 Ambient atmospheric" },
          { value: "hip_hop", label: "🎤 Hip-hop beat" },
          { value: "rock", label: "🎸 Rock" },
          { value: "piano", label: "🎹 Solo piano" },
          { value: "emotional", label: "💖 Emotional strings" },
        ],
      },
    },
  ];

  return (
    <div className="fade-in space-y-5">
      <PageHero
        icon={<Film size={28} />}
        title="AI Video Generation"
        subtitle="Text-to-video powered by Higgsfield on RunPod GPU."
        gradient="purple"
        actions={
          <>
            <AdvancedToggle value={advancedMode} onChange={setAdvancedMode} />
            <span className="text-[10px] text-white bg-white/10 border border-white/20 px-2 py-1 rounded-lg flex items-center gap-1">
              <Zap size={9} /> GPU Serverless
            </span>
          </>
        }
      />

      {/* Guided Mode — the "4-year-old friendly" path */}
      {!advancedMode && (
        <Wizard
          steps={guidedSteps}
          activeIdx={guidedStep}
          onStepChange={setGuidedStep}
          finishLabel={generating ? "Generating…" : "Generate video"}
          busy={generating}
          onFinish={async () => {
            await generateVideo();
          }}
          onCancel={() => setAdvancedMode(true)}
          cancelLabel="Advanced mode"
        />
      )}

      {/* Step-by-step guided wizard */}
      <CreationWizard
        open={wizardOpen}
        title="Create Your AI Video"
        subtitle="Step-by-step — describe, pick style, hit generate."
        icon={<Film size={18} />}
        submitLabel="Apply & Generate"
        initialData={{ prompt, style: "cinematic", aspectRatio, duration: String(numFrames) }}
        steps={videoGenWizardSteps}
        onClose={() => {
          setWizardOpen(false);
          try { localStorage.setItem("ss-aivideo-wizard-seen", "1"); } catch {}
        }}
        onComplete={async (data) => {
          // Build an enhanced prompt from the selections
          const parts: string[] = [];
          if (data.prompt) parts.push(data.prompt as string);
          if (data.style) parts.push(`${data.style} style`);
          if (data.camera && data.camera !== "static") parts.push(`${(data.camera as string).replace("_", " ")} camera`);
          if (Array.isArray(data.mood) && data.mood.length > 0) parts.push((data.mood as string[]).join(", ") + " mood");
          if (Array.isArray(data.enhancements) && data.enhancements.length > 0) parts.push(`with ${(data.enhancements as string[]).join(", ")}`);

          const finalPrompt = parts.join(", ");
          setPrompt(finalPrompt);
          if (data.aspectRatio) setAspectRatio(data.aspectRatio as string);
          if (data.duration) setNumFrames(parseInt(data.duration as string));

          setWizardOpen(false);
          try { localStorage.setItem("ss-aivideo-wizard-seen", "1"); } catch {}
          toast.success("Settings applied! Click Generate to create your video.");
        }}
      />

      {advancedMode && (
      <div className="grid grid-cols-1 lg:grid-cols-7 gap-5">
        {/* Left — Controls */}
        <div className="lg:col-span-3 space-y-4">
          <div className="card space-y-3">
            <h2 className="section-header">Video Description</h2>
            <PromptEnhancer
              value={prompt}
              onChange={setPrompt}
              type="video"
              placeholder="Describe the video you want to generate..."
              rows={4}
            />

            {/* Quick prompts */}
            <div>
              <p className="text-[9px] text-muted uppercase tracking-wider mb-1.5">Try these</p>
              <div className="flex flex-wrap gap-1.5">
                {PROMPT_IDEAS.slice(0, 4).map((idea, i) => (
                  <button
                    key={i}
                    onClick={() => setPrompt(idea)}
                    className="text-[8px] text-muted hover:text-foreground bg-surface-light/50 hover:bg-surface-light px-2 py-1 rounded-md border border-border/30 transition-all truncate max-w-[200px]"
                  >
                    {idea.slice(0, 50)}...
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Settings */}
          <div className="card space-y-3">
            <h2 className="section-header">Settings</h2>

            {/* Aspect ratio */}
            <div>
              <label className="block text-[9px] text-muted uppercase tracking-wider mb-1.5">Aspect Ratio</label>
              <div className="grid grid-cols-3 gap-2">
                {ASPECT_RATIOS.map(ar => (
                  <button
                    key={ar.id}
                    onClick={() => setAspectRatio(ar.id)}
                    className={`p-2.5 rounded-xl border text-center transition-all ${
                      aspectRatio === ar.id
                        ? "border-gold/30 bg-gold/[0.05]"
                        : "border-border hover:border-gold/15"
                    }`}
                  >
                    <div className="flex items-center justify-center gap-1.5 mb-0.5">
                      {ar.icon}
                      <span className="text-[10px] font-semibold">{ar.id}</span>
                    </div>
                    <p className="text-[8px] text-muted">{ar.label}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* Frames & Guidance */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[9px] text-muted uppercase tracking-wider mb-1">Frames</label>
                <input
                  type="number" min={8} max={72} value={numFrames}
                  onChange={e => setNumFrames(parseInt(e.target.value) || 24)}
                  className="input w-full text-xs"
                />
                <p className="text-[8px] text-muted mt-0.5">~{(numFrames / 24).toFixed(1)}s at 24fps</p>
              </div>
              <div>
                <label className="block text-[9px] text-muted uppercase tracking-wider mb-1">Guidance Scale</label>
                <input
                  type="number" min={1} max={20} step={0.5} value={guidanceScale}
                  onChange={e => setGuidanceScale(parseFloat(e.target.value) || 7.5)}
                  className="input w-full text-xs"
                />
                <p className="text-[8px] text-muted mt-0.5">Higher = more prompt adherence</p>
              </div>
            </div>
          </div>

          {/* Generate */}
          <button
            onClick={generateVideo}
            disabled={generating || !prompt.trim()}
            className="btn-primary w-full flex items-center justify-center gap-2 text-sm disabled:opacity-50"
          >
            {generating ? (
              <>
                <Loader size={16} className="animate-spin" />
                Generating... {Math.round(progress)}%
              </>
            ) : (
              <>
                <Sparkles size={16} />
                Generate Video
              </>
            )}
          </button>

          {generating && (
            <div className="w-full bg-surface-light rounded-full h-1.5 overflow-hidden">
              <div
                className="h-full bg-gold rounded-full transition-all duration-500"
                style={{ width: `${progress}%` }}
              />
            </div>
          )}

          {/* Setup notice */}
          <div className="card border-gold/10 bg-gold/[0.02]">
            <h3 className="text-[10px] font-semibold flex items-center gap-1.5 mb-1">
              <Zap size={10} className="text-gold" /> GPU Setup
            </h3>
            <p className="text-[9px] text-muted">
              Requires <code className="text-[8px] bg-surface-light px-1 py-0.5 rounded">HIGGSFIELD_URL</code> and{" "}
              <code className="text-[8px] bg-surface-light px-1 py-0.5 rounded">RUNPOD_API_KEY</code> environment
              variables. Without them, the system generates video plans instead of rendering.
            </p>
          </div>
        </div>

        {/* Right — Results */}
        <div className="lg:col-span-4 space-y-4">
          {results.length === 0 ? (
            <div className="relative card-static overflow-hidden py-16 text-center">
              {/* Rolling preview — pulls real AI video showcases from preview_content */}
              <div className="absolute inset-0 pointer-events-none">
                <RollingPreview
                  items={AI_VIDEO_PREVIEW_FALLBACK}
                  rows={2}
                  aspectRatio="16:9"
                  opacity={0.25}
                  speed="medium"
                  fetchRemote
                  tool="ai_video"
                />
              </div>
              {/* Foreground content */}
              <div className="relative flex flex-col items-center">
                <div className="w-16 h-16 bg-gold/10 rounded-2xl flex items-center justify-center mb-4 backdrop-blur-sm">
                  <Film size={28} className="text-gold" />
                </div>
                <h3 className="text-sm font-semibold mb-1">No videos yet</h3>
                <p className="text-xs text-muted max-w-xs">
                  Describe a scene and click Generate to create AI-powered video clips.
                </p>
                <div className="grid grid-cols-2 gap-3 mt-6 max-w-sm">
                  <div className="p-3 rounded-xl border border-border bg-surface/80 backdrop-blur-sm text-center">
                    <Film size={16} className="text-gold mx-auto mb-1" />
                    <p className="text-[10px] font-semibold">Text to Video</p>
                    <p className="text-[8px] text-muted">Describe any scene</p>
                  </div>
                  <div className="p-3 rounded-xl border border-border bg-surface/80 backdrop-blur-sm text-center">
                    <RefreshCw size={16} className="text-gold mx-auto mb-1" />
                    <p className="text-[10px] font-semibold">Open Source</p>
                    <p className="text-[8px] text-muted">No per-video fees</p>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {results.map(result => (
                <div key={result.id} className="card">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium mb-1 line-clamp-2">{result.prompt}</p>
                      <div className="flex items-center gap-2">
                        <span className="text-[8px] bg-surface-light text-muted px-1.5 py-0.5 rounded">{result.aspect_ratio}</span>
                        {result.status === "generating" && (
                          <span className="text-[8px] text-gold flex items-center gap-1">
                            <Loader size={8} className="animate-spin" /> Generating...
                          </span>
                        )}
                        {result.status === "completed" && (
                          <span className="text-[8px] text-success flex items-center gap-1">
                            <Play size={8} /> Ready
                          </span>
                        )}
                        {result.status === "plan" && (
                          <span className="text-[8px] text-gold flex items-center gap-1">
                            <Sparkles size={8} /> Plan Ready
                          </span>
                        )}
                        {result.status === "failed" && (
                          <span className="text-[8px] text-danger">Failed</span>
                        )}
                        <span className="text-[8px] text-muted flex items-center gap-1">
                          <Clock size={8} /> {new Date(result.created_at).toLocaleTimeString()}
                        </span>
                      </div>
                    </div>
                    {result.url && (
                      <a href={result.url} download className="btn-secondary text-[10px] flex items-center gap-1">
                        <Download size={10} /> Download
                      </a>
                    )}
                  </div>
                  {result.url && (
                    <div className="mt-3 rounded-xl overflow-hidden bg-black aspect-video">
                      <video src={result.url} controls className="w-full h-full object-contain" />
                    </div>
                  )}
                  {result.plan && (
                    <div className="mt-3 rounded-xl border border-gold/20 bg-gold/[0.03] p-3">
                      <p className="text-[9px] text-gold uppercase tracking-wider mb-1.5 font-semibold">
                        AI-Generated Video Plan
                      </p>
                      <pre className="text-[10px] text-foreground/90 whitespace-pre-wrap font-sans leading-relaxed">
                        {result.plan}
                      </pre>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      )}

      {/* Result preview shown in guided mode too (once generated) */}
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
                        <Loader size={8} className="animate-spin" /> Generating…
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
                  <a href={result.url} download className="btn-secondary text-[10px] flex items-center gap-1">
                    <Download size={10} /> Download
                  </a>
                )}
              </div>
              {result.url && (
                <div className="mt-3 rounded-xl overflow-hidden bg-black aspect-video">
                  <video src={result.url} controls className="w-full h-full object-contain" />
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* How to use it — tutorial walkthrough */}
      <TutorialSection
        title="How to use it"
        subtitle="Four steps from idea to rendered clip."
        steps={AI_VIDEO_TUTORIAL_STEPS}
        columns={4}
        collapsible
      />
    </div>
  );
}
