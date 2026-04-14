"use client";

import { useState } from "react";
import {
  Film, Sparkles, Loader, Play, Download,
  Clock, Monitor, Zap, Layers, RefreshCw
} from "lucide-react";
import toast from "react-hot-toast";
import PromptEnhancer from "@/components/prompt-enhancer";
import { useAuth } from "@/lib/auth-context";

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

  return (
    <div className="fade-in space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gold/10 rounded-xl flex items-center justify-center">
            <Film size={20} className="text-gold" />
          </div>
          <div>
            <h1 className="page-header mb-0">AI Video Generation</h1>
            <p className="text-xs text-muted">
              Text-to-video powered by Higgsfield (open-source) on RunPod GPU
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[9px] text-muted bg-surface-light px-2 py-1 rounded-lg flex items-center gap-1">
            <Zap size={9} className="text-gold" /> GPU Serverless
          </span>
        </div>
      </div>

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
