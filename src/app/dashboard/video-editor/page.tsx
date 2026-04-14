"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/lib/auth-context";
import { createClient } from "@/lib/supabase/client";
import { useManagedClient } from "@/lib/use-managed-client";
import {
  Film, Sparkles, Loader, Play, Copy, Download,
  Clock, Camera, Monitor, Zap, Music, Type, Wand2,
  Layers, Mic, Volume2, Palette, LayoutGrid, Eye,
  BookOpen, Scissors, Image as ImageIcon, Upload, X
} from "lucide-react";
import toast from "react-hot-toast";
import PromptEnhancer from "@/components/prompt-enhancer";
import { VIDEO_PRESETS, VIDEO_PRESET_CATEGORIES } from "@/lib/presets";

const VIDEO_TYPES = [
  { id: "reel", name: "Reel / TikTok", aspect: "9:16", duration: 30, icon: <Camera size={14} />, desc: "Vertical short-form" },
  { id: "youtube", name: "YouTube Video", aspect: "16:9", duration: 60, icon: <Monitor size={14} />, desc: "Horizontal long-form" },
  { id: "ad", name: "Ad Creative", aspect: "1:1", duration: 15, icon: <Zap size={14} />, desc: "Square ad format" },
  { id: "story", name: "Story", aspect: "9:16", duration: 15, icon: <Film size={14} />, desc: "Full-screen ephemeral" },
  { id: "explainer", name: "Explainer", aspect: "16:9", duration: 90, icon: <BookOpen size={14} />, desc: "Educational walkthrough" },
  { id: "testimonial", name: "Testimonial", aspect: "1:1", duration: 30, icon: <Mic size={14} />, desc: "Client success story" },
  { id: "product_demo", name: "Product Demo", aspect: "16:9", duration: 45, icon: <Eye size={14} />, desc: "Feature showcase" },
  { id: "carousel_video", name: "Carousel Video", aspect: "1:1", duration: 60, icon: <Layers size={14} />, desc: "Multi-slide video" },
];

const STYLES = [
  { id: "modern-dark", name: "Modern Dark", desc: "Dark bg, neon accents, clean" },
  { id: "clean-white", name: "Clean White", desc: "Light, airy, professional" },
  { id: "bold-gradient", name: "Bold Gradient", desc: "Vibrant color transitions" },
  { id: "neon", name: "Neon Glow", desc: "Dark with neon highlights" },
  { id: "minimal", name: "Minimal", desc: "Less is more, whitespace" },
  { id: "corporate", name: "Corporate", desc: "Professional, trust-focused" },
  { id: "retro", name: "Retro / Y2K", desc: "Nostalgic, colorful, playful" },
  { id: "cinematic", name: "Cinematic", desc: "Film grain, moody lighting" },
];

const MUSIC_MOODS = [
  { id: "upbeat", name: "Upbeat", emoji: "🎵" },
  { id: "motivational", name: "Motivational", emoji: "💪" },
  { id: "chill", name: "Chill", emoji: "😎" },
  { id: "dramatic", name: "Dramatic", emoji: "🎬" },
  { id: "corporate", name: "Corporate", emoji: "💼" },
  { id: "trendy", name: "Trendy/Pop", emoji: "🔥" },
  { id: "emotional", name: "Emotional", emoji: "❤️" },
  { id: "none", name: "No Music", emoji: "🔇" },
];

const CAPTION_STYLES = [
  { id: "none", name: "No Captions" },
  { id: "bottom_bar", name: "Bottom Bar" },
  { id: "word_highlight", name: "Word-by-Word Highlight" },
  { id: "centered_bold", name: "Centered Bold" },
  { id: "karaoke", name: "Karaoke Style" },
];

interface StoryboardScene {
  scene_number: number;
  duration: string;
  visual: string;
  text_overlay: string;
  voiceover: string;
  transition: string;
  camera_movement: string;
  music_note: string;
}

interface VideoResult {
  source: string;
  plan?: string;
  storyboard?: StoryboardScene[];
  url?: string;
  render_id?: string;
  thumbnail_suggestion?: string;
  music_suggestions?: string[];
}

export default function VideoEditorPage() {
  useAuth();
  const { clientId: managedClientId } = useManagedClient();
  const [generating, setGenerating] = useState(false);
  const [result, setResult] = useState<VideoResult | null>(null);
  const [clients, setClients] = useState<Array<{ id: string; business_name: string }>>([]);
  const [selectedClient, setSelectedClient] = useState("");
  const supabase = createClient();

  const [referenceFiles, setReferenceFiles] = useState<Array<{ name: string; type: string; preview: string; data: string }>>([]);
  const [tab, setTab] = useState<"create" | "storyboard" | "templates">("create");
  const [mode, setMode] = useState<"render" | "plan" | "storyboard">("plan");
  const [config, setConfig] = useState({
    type: "reel",
    title: "",
    script: "",
    style: "modern-dark",
    duration: 30,
    aspect_ratio: "9:16",
    music_mood: "upbeat",
    caption_style: "word_highlight",
    include_voiceover: false,
    include_cta: true,
    cta_text: "",
    brand_colors: "",
    target_platform: "instagram",
  });

  useEffect(() => {
    supabase.from("clients").select("id, business_name").eq("is_active", true).then(({ data }) => setClients(data || []));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-select managed client
  useEffect(() => {
    if (managedClientId && clients.length > 0) {
      setSelectedClient(managedClientId);
    }
  }, [managedClientId, clients]);

  function handleFileUpload(files: File[]) {
    const remaining = 5 - referenceFiles.length;
    if (remaining <= 0) { toast.error("Max 5 files"); return; }
    const toProcess = files.slice(0, remaining);
    toProcess.forEach(file => {
      const reader = new FileReader();
      reader.onload = () => {
        const base64 = reader.result as string;
        setReferenceFiles(prev => [...prev, {
          name: file.name,
          type: file.type,
          preview: file.type.startsWith("image/") ? base64 : "",
          data: base64,
        }]);
      };
      reader.readAsDataURL(file);
    });
  }

  function selectType(type: typeof VIDEO_TYPES[0]) {
    setConfig(prev => ({ ...prev, type: type.id, aspect_ratio: type.aspect, duration: type.duration }));
  }

  const [renderProgress, setRenderProgress] = useState(0);

  async function generateVideo() {
    if (!config.title) { toast.error("Enter a video title"); return; }
    setGenerating(true);
    setResult(null);
    setRenderProgress(0);

    const progressInterval = setInterval(() => {
      setRenderProgress(prev => Math.min(prev + Math.random() * 8, 90));
    }, 500);

    const loadMsg = mode === "storyboard" ? "Creating AI storyboard..." : mode === "plan" ? "Generating video plan..." : "Rendering video...";
    toast.loading(loadMsg);

    try {
      const res = await fetch("/api/video/render", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...config,
          music_mood: config.music_mood,
          client_id: selectedClient || null,
          plan_only: mode === "plan" || mode === "storyboard",
          storyboard_mode: mode === "storyboard",
          reference_files: referenceFiles.map(f => ({ name: f.name, type: f.type, data: f.data })),
        }),
      });
      clearInterval(progressInterval);
      setRenderProgress(100);
      toast.dismiss();
      const data = await res.json();
      if (data.success) {
        setResult(data);
        if (data.url) {
          toast.success("Video rendered! Ready to download.");
        } else if (data.storyboard || data.plan) {
          toast.success(mode === "storyboard" ? "Storyboard created!" : "Video plan generated!");
          if (mode === "storyboard") setTab("storyboard");
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
            <p className="text-xs text-muted">AI storyboards, video plans & GPU rendering via Remotion & Mochi</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <select value={selectedClient} onChange={e => setSelectedClient(e.target.value)} className="input text-xs py-1.5 min-w-[140px]">
            <option value="">No client</option>
            {clients.map(c => <option key={c.id} value={c.id}>{c.business_name}</option>)}
          </select>
        </div>
      </div>

      {/* Tabs */}
      <div className="tab-group w-fit">
        {(["create", "storyboard", "templates"] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={tab === t ? "tab-item-active" : "tab-item-inactive"}>
            {t === "create" ? "Create Video" : t === "storyboard" ? "Storyboard" : "Quick Templates"}
          </button>
        ))}
      </div>

      {/* Create Tab */}
      {tab === "create" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 space-y-4">
            {/* Video type */}
            <div className="card">
              <h2 className="section-header flex items-center gap-2"><Film size={13} className="text-gold" /> Video Type</h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                {VIDEO_TYPES.map(t => (
                  <button key={t.id} onClick={() => selectType(t)}
                    className={`flex items-center gap-2 p-2.5 rounded-xl border transition-all ${
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

            {/* Details */}
            <div className="card space-y-3">
              <h2 className="section-header">Video Details</h2>
              <div>
                <label className="block text-[9px] text-muted uppercase tracking-wider mb-1">Title *</label>
                <input value={config.title} onChange={e => setConfig({ ...config, title: e.target.value })}
                  className="input w-full text-xs" placeholder="e.g., 5 Dental Marketing Tips That Actually Work" />
              </div>
              <div>
                <label className="block text-[9px] text-muted uppercase tracking-wider mb-1">Script (optional — AI will create one if empty)</label>
                <PromptEnhancer
                  value={config.script}
                  onChange={(v) => setConfig({ ...config, script: v })}
                  type="video"
                  placeholder="Paste your script here, or leave empty for AI to write..."
                  rows={3}
                />
              </div>
              {/* Reference Files */}
              <div>
                <label className="block text-[9px] text-muted uppercase tracking-wider mb-1">Reference Files (faces, logos, footage, effects)</label>
                <div
                  className="border-2 border-dashed border-border/40 rounded-xl p-3 text-center hover:border-gold/30 transition-colors cursor-pointer"
                  onDragOver={e => { e.preventDefault(); e.currentTarget.classList.add("border-gold/40", "bg-gold/5"); }}
                  onDragLeave={e => { e.currentTarget.classList.remove("border-gold/40", "bg-gold/5"); }}
                  onDrop={e => {
                    e.preventDefault();
                    e.currentTarget.classList.remove("border-gold/40", "bg-gold/5");
                    handleFileUpload(Array.from(e.dataTransfer.files));
                  }}
                  onClick={() => {
                    const input = document.createElement("input");
                    input.type = "file";
                    input.multiple = true;
                    input.accept = "image/*,video/*,audio/*";
                    input.onchange = (ev) => {
                      const files = Array.from((ev.target as HTMLInputElement).files || []);
                      handleFileUpload(files);
                    };
                    input.click();
                  }}
                >
                  <Upload size={16} className="mx-auto text-muted mb-1" />
                  <p className="text-[10px] text-muted">Drop files or click to upload (up to 5)</p>
                  <p className="text-[8px] text-muted/60">Images, video clips, audio, logos</p>
                </div>
                {referenceFiles.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-2">
                    {referenceFiles.map((f, i) => (
                      <div key={i} className="relative group">
                        {f.type.startsWith("image/") ? (
                          <img src={f.preview} alt={f.name} className="w-14 h-14 object-cover rounded-lg border border-border" />
                        ) : (
                          <div className="w-14 h-14 bg-surface-light rounded-lg border border-border flex flex-col items-center justify-center">
                            {f.type.startsWith("video/") ? <Film size={14} className="text-gold mb-0.5" /> :
                             f.type.startsWith("audio/") ? <Music size={14} className="text-gold mb-0.5" /> :
                             <ImageIcon size={14} className="text-muted mb-0.5" />}
                            <span className="text-[7px] text-muted truncate max-w-[48px]">{f.name}</span>
                          </div>
                        )}
                        <button
                          onClick={(e) => { e.stopPropagation(); setReferenceFiles(prev => prev.filter((_, idx) => idx !== i)); }}
                          className="absolute -top-1 -right-1 w-4 h-4 bg-danger/80 text-white rounded-full items-center justify-center text-[8px] hidden group-hover:flex"
                        >
                          <X size={8} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-[9px] text-muted uppercase tracking-wider mb-1">Duration (sec)</label>
                  <input type="number" min={5} max={300} value={config.duration}
                    onChange={e => setConfig({ ...config, duration: parseInt(e.target.value) || 30 })}
                    className="input w-full text-xs" />
                </div>
                <div>
                  <label className="block text-[9px] text-muted uppercase tracking-wider mb-1">Platform</label>
                  <select value={config.target_platform} onChange={e => setConfig({ ...config, target_platform: e.target.value })} className="input w-full text-xs">
                    <option value="instagram">Instagram</option>
                    <option value="tiktok">TikTok</option>
                    <option value="youtube">YouTube</option>
                    <option value="facebook">Facebook</option>
                    <option value="linkedin">LinkedIn</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[9px] text-muted uppercase tracking-wider mb-1">Brand Colors</label>
                  <input value={config.brand_colors} onChange={e => setConfig({ ...config, brand_colors: e.target.value })}
                    className="input w-full text-xs" placeholder="#C9A84C, #1a1a1a" />
                </div>
              </div>
            </div>

            {/* Style */}
            <div className="card">
              <h2 className="section-header flex items-center gap-2"><Palette size={13} className="text-gold" /> Visual Style</h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                {STYLES.map(s => (
                  <button key={s.id} onClick={() => setConfig({ ...config, style: s.id })}
                    className={`p-2 rounded-xl border text-left transition-all ${
                      config.style === s.id ? "border-gold/30 bg-gold/[0.05]" : "border-border hover:border-gold/15"
                    }`}>
                    <p className="text-[10px] font-semibold">{s.name}</p>
                    <p className="text-[8px] text-muted">{s.desc}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* AI Options */}
            <div className="card">
              <h2 className="section-header flex items-center gap-2"><Wand2 size={13} className="text-gold" /> AI Enhancement Options</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[9px] text-muted uppercase tracking-wider mb-1.5">Music Mood</label>
                  <div className="grid grid-cols-4 gap-1">
                    {MUSIC_MOODS.map(m => (
                      <button key={m.id} onClick={() => setConfig({ ...config, music_mood: m.id })}
                        className={`text-[9px] p-1.5 rounded-lg border transition-all text-center ${
                          config.music_mood === m.id ? "border-gold/30 bg-gold/[0.05] text-gold" : "border-border text-muted hover:text-foreground"
                        }`}>
                        <span className="text-sm">{m.emoji}</span>
                        <p className="text-[8px] mt-0.5">{m.name}</p>
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="block text-[9px] text-muted uppercase tracking-wider mb-1.5">Caption Style</label>
                  <div className="space-y-1">
                    {CAPTION_STYLES.map(c => (
                      <button key={c.id} onClick={() => setConfig({ ...config, caption_style: c.id })}
                        className={`w-full text-left text-[10px] px-2.5 py-1.5 rounded-lg border transition-all ${
                          config.caption_style === c.id ? "border-gold/30 bg-gold/[0.05] text-gold" : "border-border text-muted hover:text-foreground"
                        }`}>
                        {c.name}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              <div className="flex flex-wrap gap-3 mt-3 pt-3 border-t border-border">
                <label className="flex items-center gap-2 text-[10px] text-muted cursor-pointer">
                  <input type="checkbox" checked={config.include_voiceover}
                    onChange={e => setConfig({ ...config, include_voiceover: e.target.checked })}
                    className="rounded border-border text-gold focus:ring-gold/30" />
                  <Volume2 size={11} /> AI Voiceover Notes
                </label>
                <label className="flex items-center gap-2 text-[10px] text-muted cursor-pointer">
                  <input type="checkbox" checked={config.include_cta}
                    onChange={e => setConfig({ ...config, include_cta: e.target.checked })}
                    className="rounded border-border text-gold focus:ring-gold/30" />
                  <Zap size={11} /> Include CTA Overlay
                </label>
                {config.include_cta && (
                  <input value={config.cta_text} onChange={e => setConfig({ ...config, cta_text: e.target.value })}
                    className="input text-xs py-1 flex-1 min-w-[150px]" placeholder="CTA text (e.g., Book Now)" />
                )}
              </div>
            </div>

            {/* Mode toggle */}
            <div className="flex gap-2">
              <button onClick={() => setMode("storyboard")}
                className={`flex-1 text-xs py-2.5 rounded-xl font-semibold flex items-center justify-center gap-2 transition-all border ${
                  mode === "storyboard" ? "bg-gold/10 border-gold/30 text-gold" : "border-border text-muted hover:text-foreground"
                }`}>
                <LayoutGrid size={14} /> AI Storyboard
              </button>
              <button onClick={() => setMode("plan")}
                className={`flex-1 text-xs py-2.5 rounded-xl font-semibold flex items-center justify-center gap-2 transition-all border ${
                  mode === "plan" ? "bg-gold/10 border-gold/30 text-gold" : "border-border text-muted hover:text-foreground"
                }`}>
                <Sparkles size={14} /> AI Plan
              </button>
              <button onClick={() => setMode("render")}
                className={`flex-1 text-xs py-2.5 rounded-xl font-semibold flex items-center justify-center gap-2 transition-all border ${
                  mode === "render" ? "bg-gold/10 border-gold/30 text-gold" : "border-border text-muted hover:text-foreground"
                }`}>
                <Film size={14} /> Render MP4
              </button>
            </div>

            <button onClick={generateVideo} disabled={generating || !config.title}
              className={`w-full text-xs py-2.5 flex items-center justify-center gap-2 disabled:opacity-50 rounded-xl font-semibold transition-all ${
                mode === "render" ? "btn-primary" : "bg-gold/10 text-gold border border-gold/30 hover:bg-gold/20"
              }`}>
              {generating ? <Loader size={14} className="animate-spin" /> : mode === "storyboard" ? <LayoutGrid size={14} /> : mode === "render" ? <Film size={14} /> : <Sparkles size={14} />}
              {generating ? "Creating..." : mode === "storyboard" ? "Generate Storyboard" : mode === "render" ? "Render Video" : "Generate Video Plan"}
            </button>
            <p className="text-[8px] text-muted text-center">
              {mode === "render" ? "Remotion + Higgsfield render an MP4 with animations, text, and transitions (~30-60s)" : mode === "storyboard" ? "AI creates scene-by-scene breakdown with visuals, transitions, and timing" : "AI creates a detailed shot list, timing, overlays, and music suggestions"}
            </p>
          </div>

          {/* Preview / Result */}
          <div className="space-y-4">
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
                {generating && (
                  <div className="mx-auto w-40 mt-2">
                    <div className="w-full bg-surface-light rounded-full h-1.5">
                      <div className="bg-gradient-gold rounded-full h-1.5 transition-all duration-300"
                        style={{ width: `${renderProgress}%` }} />
                    </div>
                    <p className="text-[8px] text-muted mt-1">Creating {config.duration}s {selectedType.name}...</p>
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
                  {result.url ? "Rendered Video" : result.storyboard ? "Storyboard Ready" : "Production Plan"}
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
                {result.plan && !result.storyboard && (
                  <div className="space-y-2">
                    <pre className="text-[9px] text-muted bg-surface-light rounded-lg p-2.5 max-h-[300px] overflow-y-auto whitespace-pre-wrap">{result.plan}</pre>
                    <button onClick={() => { navigator.clipboard.writeText(result.plan || ""); toast.success("Copied!"); }}
                      className="btn-ghost text-[9px] w-full flex items-center justify-center gap-1"><Copy size={10} /> Copy Plan</button>
                  </div>
                )}
                {result.music_suggestions && result.music_suggestions.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-border">
                    <p className="text-[9px] text-gold uppercase tracking-wider font-medium mb-1 flex items-center gap-1"><Music size={9} /> Music Suggestions</p>
                    {result.music_suggestions.map((m, i) => (
                      <p key={i} className="text-[9px] text-muted">{m}</p>
                    ))}
                  </div>
                )}
                {result.thumbnail_suggestion && (
                  <div className="mt-2 pt-2 border-t border-border">
                    <p className="text-[9px] text-gold uppercase tracking-wider font-medium mb-1 flex items-center gap-1"><ImageIcon size={9} /> Thumbnail Idea</p>
                    <p className="text-[9px] text-muted">{result.thumbnail_suggestion}</p>
                  </div>
                )}
              </div>
            )}

            <div className="card border-gold/10">
              <h3 className="section-header flex items-center gap-2"><Clock size={12} className="text-gold" /> How it works</h3>
              <div className="space-y-1.5 text-[9px] text-muted">
                <p><span className="text-gold font-medium">1.</span> Pick video type, style & AI options</p>
                <p><span className="text-gold font-medium">2.</span> Choose: Storyboard / Plan / Direct Render</p>
                <p><span className="text-gold font-medium">3.</span> AI creates your video with music, captions & CTA</p>
                <p><span className="text-gold font-medium">4.</span> Download and post to social media</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Storyboard Tab */}
      {tab === "storyboard" && (
        <div className="space-y-4">
          {result?.storyboard ? (
            <>
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-sm font-semibold">{config.title}</h2>
                  <p className="text-[10px] text-muted">{result.storyboard.length} scenes / {config.duration}s / {selectedType.name}</p>
                </div>
                <div className="flex gap-1.5">
                  <button onClick={() => {
                    const text = result.storyboard!.map(s => `Scene ${s.scene_number} (${s.duration})\nVisual: ${s.visual}\nText: ${s.text_overlay}\nVO: ${s.voiceover}\nTransition: ${s.transition}\n`).join("\n");
                    navigator.clipboard.writeText(text);
                    toast.success("Storyboard copied!");
                  }} className="btn-secondary text-[10px] flex items-center gap-1"><Copy size={10} /> Copy</button>
                  <button onClick={() => { setMode("render"); setTab("create"); }}
                    className="btn-primary text-[10px] flex items-center gap-1"><Film size={10} /> Render This</button>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {result.storyboard.map((scene, i) => (
                  <div key={i} className="card card-hover">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[10px] font-bold text-gold">Scene {scene.scene_number}</span>
                      <span className="text-[9px] text-muted font-mono">{scene.duration}</span>
                    </div>
                    <div className="space-y-2">
                      <div>
                        <p className="text-[8px] text-muted uppercase tracking-wider">Visual</p>
                        <p className="text-[10px]">{scene.visual}</p>
                      </div>
                      {scene.text_overlay && (
                        <div>
                          <p className="text-[8px] text-muted uppercase tracking-wider flex items-center gap-1"><Type size={8} /> Text Overlay</p>
                          <p className="text-[10px] text-gold font-medium">{scene.text_overlay}</p>
                        </div>
                      )}
                      {scene.voiceover && (
                        <div>
                          <p className="text-[8px] text-muted uppercase tracking-wider flex items-center gap-1"><Mic size={8} /> Voiceover</p>
                          <p className="text-[10px] italic">{scene.voiceover}</p>
                        </div>
                      )}
                      <div className="flex items-center gap-3 pt-1 border-t border-border">
                        {scene.transition && <span className="text-[8px] text-muted flex items-center gap-1"><Scissors size={8} /> {scene.transition}</span>}
                        {scene.camera_movement && <span className="text-[8px] text-muted flex items-center gap-1"><Camera size={8} /> {scene.camera_movement}</span>}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          ) : result?.plan ? (
            <div className="card">
              <h2 className="section-header flex items-center gap-2"><Sparkles size={13} className="text-gold" /> Video Plan</h2>
              <pre className="text-[10px] text-muted bg-surface-light rounded-lg p-3 whitespace-pre-wrap max-h-[500px] overflow-y-auto">{result.plan}</pre>
              <div className="flex gap-2 mt-3">
                <button onClick={() => { navigator.clipboard.writeText(result.plan || ""); toast.success("Copied!"); }}
                  className="btn-secondary text-[10px] flex items-center gap-1"><Copy size={10} /> Copy Plan</button>
                <button onClick={() => { setMode("storyboard"); generateVideo(); }}
                  className="btn-primary text-[10px] flex items-center gap-1"><LayoutGrid size={10} /> Convert to Storyboard</button>
              </div>
            </div>
          ) : (
            <div className="card text-center py-12">
              <LayoutGrid size={24} className="mx-auto mb-2 text-muted/30" />
              <p className="text-xs text-muted">No storyboard yet. Generate one from the Create tab.</p>
              <button onClick={() => { setMode("storyboard"); setTab("create"); }}
                className="btn-primary text-[10px] mt-3 flex items-center gap-1 mx-auto"><Sparkles size={10} /> Create Storyboard</button>
            </div>
          )}
        </div>
      )}

      {/* Templates / Presets Tab */}
      {tab === "templates" && (
        <VideoPresetsTab onSelect={(preset) => {
          setConfig(prev => ({
            ...prev,
            ...preset.config,
            title: preset.config.title || prev.title,
            script: preset.config.script || prev.script,
          }));
          setTab("create");
          toast.success(`Preset loaded: ${preset.name}`);
        }} />
      )}
    </div>
  );
}

/* ─── Video Presets Tab ──────────────────────────────────────── */
import { VideoPreset } from "@/lib/presets";

function VideoPresetsTab({ onSelect }: { onSelect: (preset: VideoPreset) => void }) {
  const [activeCategory, setActiveCategory] = useState("hooks");
  const [search, setSearch] = useState("");

  const filtered = VIDEO_PRESETS.filter(p => {
    const matchesCategory = p.category === activeCategory;
    const matchesSearch = !search || p.name.toLowerCase().includes(search.toLowerCase()) || p.desc.toLowerCase().includes(search.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted">{VIDEO_PRESETS.length} presets — select one to auto-fill all settings</p>
        <div className="relative">
          <input
            type="text" placeholder="Search presets..." value={search}
            onChange={e => setSearch(e.target.value)}
            className="input text-[10px] w-48 pl-3 py-1"
          />
        </div>
      </div>

      {/* Category tabs */}
      <div className="flex flex-wrap gap-1.5">
        {VIDEO_PRESET_CATEGORIES.map(cat => (
          <button
            key={cat.id}
            onClick={() => setActiveCategory(cat.id)}
            className={`text-[10px] px-3 py-1.5 rounded-lg border transition-all ${
              activeCategory === cat.id
                ? "bg-gold/10 text-gold border-gold/20 font-semibold"
                : "text-muted border-border hover:border-gold/15 hover:text-foreground"
            }`}
          >
            {cat.name}
          </button>
        ))}
      </div>

      {/* Preset cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {filtered.map(preset => (
          <button
            key={preset.id}
            onClick={() => onSelect(preset)}
            className="card card-hover text-left p-4"
          >
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-[11px] font-semibold">{preset.name}</h3>
              <span className="text-[8px] text-muted bg-surface-light px-1.5 py-0.5 rounded">
                {preset.config.aspect_ratio} / {preset.config.duration}s
              </span>
            </div>
            <p className="text-[9px] text-muted mb-2">{preset.desc}</p>
            <div className="flex flex-wrap gap-1">
              <span className="text-[8px] bg-gold/10 text-gold px-1.5 py-0.5 rounded">{preset.config.style}</span>
              <span className="text-[8px] bg-surface-light text-muted px-1.5 py-0.5 rounded">{preset.config.caption_style}</span>
              <span className="text-[8px] bg-surface-light text-muted px-1.5 py-0.5 rounded">{preset.config.music_mood}</span>
            </div>
          </button>
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-8 text-xs text-muted">
          No presets found. Try a different category or search term.
        </div>
      )}

      {/* Batch ideas */}
      <div className="card border-gold/10">
        <h3 className="section-header flex items-center gap-2"><Zap size={12} className="text-gold" /> Weekly Content Plan</h3>
        <p className="text-[10px] text-muted mb-3">Auto-generate a week of video content — one preset per day</p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          {["Monday Motivation", "Tuesday Tip", "Wednesday BTS", "Thursday Myth Bust", "Friday Client Win", "Saturday Q&A", "Sunday Recap"].map((day, i) => (
            <div key={i} className="p-2 rounded-lg border border-border text-center">
              <p className="text-[10px] font-semibold">{day}</p>
              <p className="text-[8px] text-muted">Auto-generate</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
