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

  async function generateVideo() {
    if (!config.title) { toast.error("Enter a video title"); return; }
    setGenerating(true);
    setResult(null);
    toast.loading("Creating video plan...");

    try {
      const res = await fetch("/api/video/render", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...config, client_id: selectedClient || null }),
      });
      toast.dismiss();
      const data = await res.json();
      if (data.success) {
        setResult(data);
        toast.success(data.url ? "Video rendered!" : "Video plan ready!");
      } else {
        toast.error(data.error || "Failed");
      }
    } catch {
      toast.dismiss();
      toast.error("Error");
    }
    setGenerating(false);
  }

  const selectedType = VIDEO_TYPES.find(t => t.id === config.type) || VIDEO_TYPES[0];

  return (
    <div className="fade-in space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="page-header mb-0 flex items-center gap-2">
            <Film size={18} className="text-gold" /> Video Editor
          </h1>
          <p className="text-xs text-muted mt-0.5">AI creates video plans, scripts, and renders via Remotion</p>
        </div>
        <select value={selectedClient} onChange={e => setSelectedClient(e.target.value)} className="input text-xs py-1.5 min-w-[160px]">
          <option value="">No client</option>
          {clients.map(c => <option key={c.id} value={c.id}>{c.business_name}</option>)}
        </select>
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
                    config.type === t.id ? "border-gold/30 bg-gold/[0.05]" : "border-border/20"
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

          <button onClick={generateVideo} disabled={generating || !config.title}
            className="btn-primary w-full text-xs py-2.5 flex items-center justify-center gap-2 disabled:opacity-50">
            {generating ? <Loader size={14} className="animate-spin" /> : <Sparkles size={14} />}
            {generating ? "Creating..." : "Generate Video"}
          </button>
        </div>

        {/* Preview / Result */}
        <div className="space-y-4">
          <div className="card border-gold/10 text-center py-6">
            <div className={`mx-auto mb-3 rounded-xl flex items-center justify-center ${
              selectedType.aspect === "9:16" ? "w-24 h-40" : selectedType.aspect === "16:9" ? "w-40 h-24" : "w-32 h-32"
            } bg-surface-light/50 border border-border/20`}>
              {result?.url ? (
                <a href={result.url} target="_blank" rel="noopener" className="text-gold text-xs">View Video</a>
              ) : (
                <Film size={24} className="text-muted/30" />
              )}
            </div>
            <p className="text-[10px] text-muted">{selectedType.name} / {selectedType.aspect} / {config.duration}s</p>
          </div>

          {/* Result */}
          {result && (
            <div className="card">
              <h3 className="section-header flex items-center gap-2">
                {result.url ? <Play size={12} className="text-success" /> : <Sparkles size={12} className="text-gold" />}
                {result.source === "ai-plan" ? "Video Plan" : "Rendered"}
              </h3>
              {result.url && (
                <div className="space-y-2">
                  <a href={result.url} target="_blank" rel="noopener" className="btn-primary w-full text-xs flex items-center justify-center gap-1">
                    <Download size={12} /> Download Video
                  </a>
                </div>
              )}
              {result.plan && (
                <div className="space-y-2">
                  <pre className="text-[9px] text-muted bg-surface-light/30 rounded-lg p-2.5 max-h-[300px] overflow-y-auto whitespace-pre-wrap">{result.plan}</pre>
                  <button onClick={() => { navigator.clipboard.writeText(result.plan || ""); toast.success("Copied!"); }}
                    className="btn-ghost text-[9px] w-full flex items-center justify-center gap-1"><Copy size={10} /> Copy Plan</button>
                </div>
              )}
              <p className="text-[8px] text-muted mt-2">Source: {result.source}{result.render_id ? ` / ID: ${result.render_id}` : ""}</p>
            </div>
          )}

          <div className="card border-accent/10">
            <h3 className="section-header flex items-center gap-2"><Clock size={12} className="text-accent" /> How it works</h3>
            <div className="space-y-1 text-[9px] text-muted">
              <p>1. Choose video type and enter details</p>
              <p>2. AI creates a production plan with shots, timing, overlays</p>
              <p>3. Use the plan to record or send to editors via Production page</p>
              <p>4. With Remotion server: auto-renders motion graphics videos</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
