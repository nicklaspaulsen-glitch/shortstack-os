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
  status: "generating" | "completed" | "failed";
  url?: string;
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

  // Guided wizard
  const [wizardOpen, setWizardOpen] = useState(false);
  useEffect(() => {
    try {
      const seen = localStorage.getItem("ss-aivideo-wizard-seen");
      if (!seen) setWizardOpen(true);
    } catch {}
  }, []);

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
      if (data.success && data.url) {
        setResults(prev => prev.map(r => r.id === id ? { ...r, status: "completed", url: data.url } : r));
        toast.success("Video generated!");
      } else if (data.plan) {
        setResults(prev => prev.map(r => r.id === id ? { ...r, status: "completed" } : r));
        toast.success("Video plan created (GPU endpoint not configured yet)");
      } else {
        setResults(prev => prev.map(r => r.id === id ? { ...r, status: "failed" } : r));
        toast.error(data.error || "Generation failed");
      }
    } catch {
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
            <button
              onClick={() => setWizardOpen(true)}
              className="text-[10px] px-3 py-1 rounded-lg bg-gradient-to-r from-gold to-amber-500 text-black font-semibold hover:shadow-lg hover:shadow-gold/30 flex items-center gap-1"
            >
              <Sparkles size={10} /> Guided Mode
            </button>
            <span className="text-[10px] text-white bg-white/10 border border-white/20 px-2 py-1 rounded-lg flex items-center gap-1">
              <Zap size={9} /> GPU Serverless
            </span>
          </>
        }
      />

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
            <div className="card-static flex flex-col items-center justify-center py-16 text-center">
              <div className="w-16 h-16 bg-gold/10 rounded-2xl flex items-center justify-center mb-4">
                <Film size={28} className="text-gold" />
              </div>
              <h3 className="text-sm font-semibold mb-1">No videos yet</h3>
              <p className="text-xs text-muted max-w-xs">
                Describe a scene and click Generate to create AI-powered video clips.
              </p>
              <div className="grid grid-cols-2 gap-3 mt-6 max-w-sm">
                <div className="p-3 rounded-xl border border-border text-center">
                  <Film size={16} className="text-gold mx-auto mb-1" />
                  <p className="text-[10px] font-semibold">Text to Video</p>
                  <p className="text-[8px] text-muted">Describe any scene</p>
                </div>
                <div className="p-3 rounded-xl border border-border text-center">
                  <RefreshCw size={16} className="text-gold mx-auto mb-1" />
                  <p className="text-[10px] font-semibold">Open Source</p>
                  <p className="text-[8px] text-muted">No per-video fees</p>
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
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
