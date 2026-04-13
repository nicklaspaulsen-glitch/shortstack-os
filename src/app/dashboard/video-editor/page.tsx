"use client";

import { useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { createClient } from "@/lib/supabase/client";
import {
  Film, Sparkles, Loader, Play, Copy, Download,
  Clock, Camera, Monitor, Zap
} from "lucide-react";
import toast from "react-hot-toast";

const VIDEO_TYPES = [
  { id: "reel", name: "Reel / TikTok", aspect: "9:16", duration: 30, icon: <Camera size={16} /> },
  { id: "youtube", name: "YouTube Video", aspect: "16:9", duration: 60, icon: <Monitor size={16} /> },
  { id: "ad", name: "Ad Creative", aspect: "1:1", duration: 15, icon: <Zap size={16} /> },
  { id: "story", name: "Story", aspect: "9:16", duration: 15, icon: <Film size={16} /> },
];

const STYLES = [
  "modern-dark", "clean-white", "bold-gradient", "neon", "minimal", "corporate",
];

export default function VideoEditorPage() {
  useAuth();
  const [generating, setGenerating] = useState(false);
  const [result, setResult] = useState<{ source: string; plan?: string; url?: string; render_id?: string } | null>(null);
  const [clients, setClients] = useState<Array<{ id: string; business_name: string }>>([]);
  const [selectedClient, setSelectedClient] = useState("");
  const supabase = createClient();

  const [mode, setMode] = useState<"render" | "plan">("render");
  const [config, setConfig] = useState({
    type: "reel",
    title: "",
    script: "",
    style: "modern-dark",
    duration: 30,
    aspect_ratio: "9:16",
  });

  useState(() => {
    supabase.from("clients").select("id, business_name").eq("is_active", true).then(({ data }) => setClients(data || []));
  });

  function selectType(type: typeof VIDEO_TYPES[0]) {
    setConfig(prev => ({ ...prev, type: type.id, aspect_ratio: type.aspect, duration: type.duration }));
  }

  const [renderProgress, setRenderProgress] = useState(0);

  async function generateVideo() {
    if (!config.title) { toast.error("Enter a video title"); return; }
    setGenerating(true);
    setResult(null);
    setRenderProgress(0);

    // Simulate progress while waiting for server
    const progressInterval = setInterval(() => {
      setRenderProgress(prev => Math.min(prev + Math.random() * 8, 90));
    }, 500);

    toast.loading("Rendering video...");

    try {
      const res = await fetch("/api/video/render", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...config, client_id: selectedClient || null, plan_only: mode === "plan" }),
      });
      clearInterval(progressInterval);
      setRenderProgress(100);
      toast.dismiss();
      const data = await res.json();
      if (data.success) {
        setResult(data);
        if (data.url) {
          toast.success("Video rendered! Ready to download.");
        } else if (data.plan) {
          toast.success("Video plan generated — use it to create the video or connect Remotion for auto-rendering.");
        }
      } else {
        toast.error(data.error || "Failed");
      }
    } catch {
      clearInterval(progressInterval);
      toast.dismiss();
      toast.error("Error");
    }
    setGenerating(false);
  }

  const selectedType = VIDEO_TYPES.find(t => t.id === config.type) || VIDEO_TYPES[0];

  return (
    <div className="fade-in space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gold/10 rounded-xl flex items-center justify-center">
            <Film size={20} className="text-gold" />
          </div>
          <div>
            <h1 className="page-header mb-0">Video Editor</h1>
            <p className="text-xs text-muted">AI video generation via Higgsfield, Remotion & Creatomate</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <a href="https://www.higgsfield.ai" target="_blank" rel="noopener noreferrer"
            className="btn-secondary flex items-center gap-1.5 text-xs">
            <Sparkles size={12} /> Higgsfield AI
          </a>
          <select value={selectedClient} onChange={e => setSelectedClient(e.target.value)} className="input text-xs py-1.5 min-w-[140px]">
            <option value="">No client</option>
            {clients.map(c => <option key={c.id} value={c.id}>{c.business_name}</option>)}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 space-y-4">
          {/* Video type */}
          <div className="card">
            <h2 className="section-header">Video Type</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              {VIDEO_TYPES.map(t => (
                <button key={t.id} onClick={() => selectType(t)}
                  className={`flex items-center gap-2 p-3 rounded-xl border transition-all ${
                    config.type === t.id ? "border-gold/30 bg-gold/[0.05]" : "border-border"
                  }`}>
                  <span className={config.type === t.id ? "text-gold" : "text-muted"}>{t.icon}</span>
                  <div>
                    <p className="text-[10px] font-semibold">{t.name}</p>
                    <p className="text-[8px] text-muted">{t.aspect} / {t.duration}s</p>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Quick Presets */}
          <div className="card">
            <h2 className="section-header flex items-center gap-2"><Zap size={12} className="text-gold" /> One-Click Videos</h2>
            <div className="grid grid-cols-2 gap-1.5">
              {[
                { title: "5 Reasons You Need Social Media", script: "Hook: Are you still not on social media? Here's why that's costing you clients..." },
                { title: "Before & After Transformation", script: "Look at what we did for this business in just 30 days..." },
                { title: "Client Testimonial Highlight", script: "Here's what our client said about working with us..." },
                { title: "3 Quick Marketing Tips", script: "Tip 1: Post consistently. Tip 2: Use video content. Tip 3: Engage with comments." },
                { title: "Behind The Scenes", script: "Ever wonder what goes on behind the scenes at a digital agency?" },
                { title: "Common Mistakes Business Owners Make", script: "Stop making these mistakes with your marketing..." },
              ].map((preset, i) => (
                <button key={i} onClick={() => setConfig({ ...config, title: preset.title, script: preset.script })}
                  className="text-left p-2 rounded-lg border border-border hover:border-gold/20 transition-all text-[9px] text-muted hover:text-foreground">
                  {preset.title}
                </button>
              ))}
            </div>
          </div>

          {/* Details */}
          <div className="card space-y-3">
            <h2 className="section-header">Video Details</h2>
            <div>
              <label className="block text-[9px] text-muted uppercase tracking-wider mb-1">Title *</label>
              <input value={config.title} onChange={e => setConfig({ ...config, title: e.target.value })}
                className="input w-full text-xs" placeholder="e.g., 5 Dental Marketing Tips That Actually Work" />
            </div>
            <div>
              <label className="block text-[9px] text-muted uppercase tracking-wider mb-1">Script (optional)</label>
              <textarea value={config.script} onChange={e => setConfig({ ...config, script: e.target.value })}
                className="input w-full h-24 text-xs" placeholder="Paste your script here, or leave empty and AI will create one..." />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[9px] text-muted uppercase tracking-wider mb-1">Style</label>
                <select value={config.style} onChange={e => setConfig({ ...config, style: e.target.value })} className="input w-full text-xs">
                  {STYLES.map(s => <option key={s} value={s}>{s.replace("-", " ")}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-[9px] text-muted uppercase tracking-wider mb-1">Duration (seconds)</label>
                <input type="number" min={5} max={300} value={config.duration}
                  onChange={e => setConfig({ ...config, duration: parseInt(e.target.value) || 30 })}
                  className="input w-full text-xs" />
              </div>
            </div>
          </div>

          {/* Mode toggle */}
          <div className="flex gap-2">
            <button onClick={() => setMode("render")}
              className={`flex-1 text-xs py-2.5 rounded-xl font-semibold flex items-center justify-center gap-2 transition-all border ${
                mode === "render" ? "bg-gold/10 border-gold/30 text-gold" : "border-border text-muted hover:text-foreground"
              }`}>
              <Film size={14} /> Render MP4
            </button>
            <button onClick={() => setMode("plan")}
              className={`flex-1 text-xs py-2.5 rounded-xl font-semibold flex items-center justify-center gap-2 transition-all border ${
                mode === "plan" ? "bg-gold/10 border-gold/30 text-gold" : "border-border text-muted hover:text-foreground"
              }`}>
              <Sparkles size={14} /> AI Plan Only
            </button>
          </div>

          <button onClick={generateVideo} disabled={generating || !config.title}
            className={`w-full text-xs py-2.5 flex items-center justify-center gap-2 disabled:opacity-50 rounded-xl font-semibold transition-all ${
              mode === "render" ? "btn-primary" : "bg-gold/10 text-gold border border-gold/30 hover:bg-gold/20"
            }`}>
            {generating ? <Loader size={14} className="animate-spin" /> : mode === "render" ? <Film size={14} /> : <Sparkles size={14} />}
            {generating ? "Creating..." : mode === "render" ? "Render Video" : "Generate Video Plan"}
          </button>
          <p className="text-[8px] text-muted text-center">
            {mode === "render" ? "Remotion renders an MP4 with animations, text, and transitions (~30-60s)" : "AI creates a detailed shot list, timing, overlays, and music suggestions"}
          </p>
        </div>

        {/* Preview / Result */}
        <div className="space-y-4">
          {/* Video preview area */}
          <div className="card-premium border-gold/10 text-center py-6 relative overflow-hidden">
            <div className="absolute inset-0 bg-mesh opacity-20" />
            <div className="relative">
              <div className={`mx-auto mb-3 rounded-xl flex items-center justify-center overflow-hidden ${
                selectedType.aspect === "9:16" ? "w-28 h-48" : selectedType.aspect === "16:9" ? "w-48 h-28" : "w-36 h-36"
              } bg-surface-light/50 border border-border`}>
                {result?.url ? (
                  <video src={result.url} controls className="w-full h-full object-cover rounded-xl" />
                ) : generating ? (
                  <div className="flex flex-col items-center gap-2">
                    <Loader size={20} className="animate-spin text-gold" />
                    <span className="text-[9px] text-gold font-mono">{Math.round(renderProgress)}%</span>
                  </div>
                ) : (
                  <Film size={24} className="text-muted/30" />
                )}
              </div>

              {/* Render progress bar */}
              {generating && (
                <div className="mx-auto w-40 mt-2">
                  <div className="w-full bg-surface-light rounded-full h-1.5">
                    <div className="bg-gradient-gold rounded-full h-1.5 transition-all duration-300"
                      style={{ width: `${renderProgress}%` }} />
                  </div>
                  <p className="text-[8px] text-muted mt-1">Rendering {config.duration}s {selectedType.name}...</p>
                </div>
              )}

              <p className="text-[10px] text-muted mt-2">{selectedType.name} / {selectedType.aspect} / {config.duration}s</p>
            </div>
          </div>

          {/* Result */}
          {result && (
            <div className="card">
              <h3 className="section-header flex items-center gap-2">
                {result.url ? <Play size={12} className="text-success" /> : <Sparkles size={12} className="text-gold" />}
                {result.source === "remotion" ? "Rendered Video" : result.source === "ai-plan" ? "Production Plan" : "Result"}
              </h3>
              {result.url && (
                <div className="space-y-2">
                  <a href={result.url} target="_blank" rel="noopener" download
                    className="btn-primary btn-shine w-full text-xs flex items-center justify-center gap-1">
                    <Download size={12} /> Download MP4
                  </a>
                  <button onClick={() => { navigator.clipboard.writeText(result.url || ""); toast.success("Link copied!"); }}
                    className="btn-secondary w-full text-xs flex items-center justify-center gap-1">
                    <Copy size={12} /> Copy Video URL
                  </button>
                </div>
              )}
              {result.plan && (
                <div className="space-y-2">
                  <pre className="text-[9px] text-muted bg-surface-light rounded-lg p-2.5 max-h-[300px] overflow-y-auto whitespace-pre-wrap">{result.plan}</pre>
                  <button onClick={() => { navigator.clipboard.writeText(result.plan || ""); toast.success("Copied!"); }}
                    className="btn-ghost text-[9px] w-full flex items-center justify-center gap-1"><Copy size={10} /> Copy Plan</button>
                </div>
              )}
              <p className="text-[8px] text-muted mt-2">
                Source: {result.source === "remotion" ? "Remotion (auto-rendered)" : result.source === "ai-plan" ? "AI Plan (connect Remotion for auto-render)" : result.source}
                {result.render_id ? ` / ${result.render_id}` : ""}
              </p>
            </div>
          )}

          <div className="card border-gold/10">
            <h3 className="section-header flex items-center gap-2"><Clock size={12} className="text-gold" /> How it works</h3>
            <div className="space-y-1.5 text-[9px] text-muted">
              <p><span className="text-gold font-medium">1.</span> Pick video type + enter title/script</p>
              <p><span className="text-gold font-medium">2.</span> AI renders motion graphics video automatically</p>
              <p><span className="text-gold font-medium">3.</span> Download MP4 and post to social media</p>
              <p className="pt-1 text-[8px] text-muted/60">Videos include: animated text, transitions, brand colors, CTA overlays. For real footage editing, use the Production page.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
