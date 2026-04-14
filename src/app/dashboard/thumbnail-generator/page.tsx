"use client";

import { useState, useEffect, useMemo } from "react";
import { useAuth } from "@/lib/auth-context";
import { createClient } from "@/lib/supabase/client";
import {
  Image as ImageIcon, Sparkles, Download, RefreshCw, Edit3, Loader,
  Monitor, Palette, Type, Smile, Layers, ChevronDown,
  Clock, Trash2, Copy, Check, Zap, Grid, User,
  Square, RectangleHorizontal, Upload, X,
} from "lucide-react";
import toast from "react-hot-toast";
import PromptEnhancer from "@/components/prompt-enhancer";
import { THUMBNAIL_PRESETS, THUMBNAIL_PRESET_CATEGORIES } from "@/lib/presets";

/* ──────────────────── DATA ──────────────────── */

const FACE_OPTIONS = [
  { id: "professional_man", emoji: "\u{1F468}\u200D\u{1F4BC}", label: "Professional Man" },
  { id: "young_guy", emoji: "\u{1F9D1}", label: "Young Guy" },
  { id: "bearded_man", emoji: "\u{1F9D4}", label: "Bearded Man" },
  { id: "business_man", emoji: "\u{1F935}", label: "Business Man" },
  { id: "professional_woman", emoji: "\u{1F469}\u200D\u{1F4BC}", label: "Professional Woman" },
  { id: "young_woman", emoji: "\u{1F469}", label: "Young Woman" },
  { id: "fitness_woman", emoji: "\u{1F3CB}\u{FE0F}\u200D\u2640\u{FE0F}", label: "Fitness Woman" },
  { id: "business_woman", emoji: "\u{1F470}", label: "Business Woman" },
  { id: "surprised_face", emoji: "\u{1F632}", label: "Surprised Face" },
  { id: "angry_face", emoji: "\u{1F621}", label: "Angry Face" },
  { id: "happy_face", emoji: "\u{1F604}", label: "Happy Face" },
  { id: "no_face", emoji: "\u{1F6AB}", label: "No Face" },
];

const THUMBNAIL_STYLES = [
  { id: "youtube_classic", name: "YouTube Classic", desc: "Bold text, face close-up", gradient: "from-red-500 to-yellow-500" },
  { id: "cinematic", name: "Cinematic", desc: "Movie-poster style, dark", gradient: "from-slate-800 to-slate-600" },
  { id: "minimal_clean", name: "Minimal Clean", desc: "Simple, white bg", gradient: "from-gray-100 to-white" },
  { id: "bold_colorful", name: "Bold & Colorful", desc: "Bright gradients", gradient: "from-purple-500 to-pink-500" },
  { id: "dark_mysterious", name: "Dark & Mysterious", desc: "Moody, dark tones", gradient: "from-gray-900 to-purple-900" },
  { id: "news_breaking", name: "News / Breaking", desc: "Red banners, urgent", gradient: "from-red-700 to-red-500" },
  { id: "tutorial_howto", name: "Tutorial / How-To", desc: "Step indicators", gradient: "from-blue-500 to-cyan-400" },
  { id: "listicle", name: "Listicle", desc: "Numbered, grid layout", gradient: "from-orange-400 to-amber-300" },
];

const PLATFORM_SIZES = [
  { id: "youtube", name: "YouTube", width: 1280, height: 720 },
  { id: "instagram", name: "Instagram Post", width: 1080, height: 1080 },
  { id: "twitter", name: "Twitter / X", width: 1600, height: 900 },
  { id: "facebook", name: "Facebook", width: 1200, height: 630 },
  { id: "linkedin", name: "LinkedIn", width: 1200, height: 627 },
  { id: "tiktok", name: "TikTok Cover", width: 1080, height: 1920 },
  { id: "custom", name: "Custom", width: 1280, height: 720 },
];

const COLOR_THEMES = [
  { id: "red_black", name: "Red & Black", colors: ["#EF4444", "#1A1A1A"] },
  { id: "blue_white", name: "Blue & White", colors: ["#3B82F6", "#FFFFFF"] },
  { id: "gold_dark", name: "Gold & Dark", colors: ["#C9A84C", "#1A1A2E"] },
  { id: "green_white", name: "Green & White", colors: ["#10B981", "#FFFFFF"] },
  { id: "purple_pink", name: "Purple & Pink", colors: ["#8B5CF6", "#EC4899"] },
  { id: "orange_yellow", name: "Orange & Yellow", colors: ["#F97316", "#EAB308"] },
];

const MOODS = [
  "Dramatic", "Funny", "Shocking", "Inspiring",
  "Educational", "Luxurious", "Scary", "Exciting",
];

interface ThumbnailResult {
  id: string;
  job_id?: string;
  status?: string;
  prompt: string;
  style: string;
  platform: string;
  textOverlay: string;
  colorTheme: string;
  mood: string;
  faces: string[];
  imageUrl: string | null;
  gradient?: string;
  width: number;
  height: number;
  createdAt: string;
}

interface HistoryItem {
  id: string;
  description: string;
  created_at: string;
  metadata: Record<string, unknown>;
}

/* ──────────────────── PAGE ──────────────────── */

export default function ThumbnailGeneratorPage() {
  useAuth();
  const supabase = useMemo(() => createClient(), []);

  // Form state
  const [prompt, setPrompt] = useState("");
  const [referenceImages, setReferenceImages] = useState<string[]>([]);
  const [selectedFaces, setSelectedFaces] = useState<string[]>([]);
  const [style, setStyle] = useState("youtube_classic");
  const [platform, setPlatform] = useState("youtube");
  const [customWidth, setCustomWidth] = useState(1280);
  const [customHeight, setCustomHeight] = useState(720);
  const [textOverlay, setTextOverlay] = useState("");
  const [colorTheme, setColorTheme] = useState("red_black");
  const [mood, setMood] = useState("Dramatic");
  const [variations, setVariations] = useState(1);

  // UI state
  const [tab, setTab] = useState<"generate" | "history">("generate");
  const [generating, setGenerating] = useState(false);
  const [results, setResults] = useState<ThumbnailResult[]>([]);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const currentPlatform = PLATFORM_SIZES.find((p) => p.id === platform) || PLATFORM_SIZES[0];
  const displayWidth = platform === "custom" ? customWidth : currentPlatform.width;
  const displayHeight = platform === "custom" ? customHeight : currentPlatform.height;

  useEffect(() => {
    loadHistory();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadHistory() {
    const { data } = await supabase
      .from("trinity_log")
      .select("id, description, metadata, created_at")
      .eq("action_type", "thumbnail_generated")
      .order("created_at", { ascending: false })
      .limit(20);
    setHistory(
      (data || []).map((d) => ({
        id: d.id as string,
        description: d.description as string,
        created_at: d.created_at as string,
        metadata: d.metadata as Record<string, unknown>,
      }))
    );
  }

  function toggleFace(id: string) {
    setSelectedFaces((prev) =>
      prev.includes(id) ? prev.filter((f) => f !== id) : [...prev, id]
    );
  }

  // Poll a single job until completion
  async function pollJob(jobId: string, index: number) {
    const maxAttempts = 120; // 2 minutes max
    let attempts = 0;
    while (attempts < maxAttempts) {
      attempts++;
      await new Promise((r) => setTimeout(r, 1000));
      try {
        const res = await fetch(`/api/thumbnail/status?job_id=${jobId}`);
        const data = await res.json();
        if (data.status === "COMPLETED") {
          setResults((prev) => {
            const updated = [...prev];
            if (updated[index]) {
              updated[index] = {
                ...updated[index],
                status: "COMPLETED",
                imageUrl: data.imageUrl || null,
              };
            }
            return updated;
          });
          return data.imageUrl;
        } else if (data.status === "FAILED") {
          setResults((prev) => {
            const updated = [...prev];
            if (updated[index]) {
              updated[index] = { ...updated[index], status: "FAILED" };
            }
            return updated;
          });
          return null;
        }
        // Still in queue or processing — update status
        setResults((prev) => {
          const updated = [...prev];
          if (updated[index]) {
            updated[index] = { ...updated[index], status: data.status };
          }
          return updated;
        });
      } catch {
        // Network error, keep polling
      }
    }
    return null; // Timed out
  }

  async function generate() {
    if (!prompt.trim()) {
      toast.error("Enter a description for your thumbnail");
      return;
    }
    setGenerating(true);
    setResults([]);
    const toastId = toast.loading(
      "Sending to GPU... this takes 15-30s per image"
    );
    try {
      const res = await fetch("/api/thumbnail/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt,
          faces: selectedFaces,
          style,
          platform,
          width: displayWidth,
          height: displayHeight,
          textOverlay,
          colorTheme,
          mood,
          variations,
          reference_images: referenceImages,
        }),
      });
      const data = await res.json();
      if (data.success) {
        // Set initial results with IN_QUEUE status
        setResults(data.thumbnails);
        toast.loading("GPU is generating your images...", { id: toastId });

        // Start polling all jobs in parallel
        const pollPromises = data.thumbnails.map(
          (thumb: ThumbnailResult, i: number) =>
            thumb.job_id ? pollJob(thumb.job_id, i) : Promise.resolve(null)
        );
        const images = await Promise.all(pollPromises);
        const completed = images.filter(Boolean).length;

        toast.dismiss(toastId);
        if (completed > 0) {
          toast.success(
            `${completed} thumbnail${completed > 1 ? "s" : ""} generated!`
          );
          // Log to history
          await supabase.from("trinity_log").insert({
            action_type: "thumbnail_generated",
            description: prompt.slice(0, 100),
            status: "completed",
            metadata: {
              style,
              platform,
              colorTheme,
              mood,
              faces: selectedFaces,
              count: variations,
            },
          });
          loadHistory();
        } else {
          toast.error("Generation failed — GPU may be cold-starting, try again");
        }
      } else {
        toast.error(data.error || "Generation failed", { id: toastId });
      }
    } catch {
      toast.dismiss(toastId);
      toast.error("Error generating thumbnails");
    }
    setGenerating(false);
  }

  async function regenerateSingle(index: number) {
    toast.loading("Regenerating variation " + (index + 1) + "...");
    // Mark this result as loading
    setResults((prev) => {
      const updated = [...prev];
      if (updated[index]) {
        updated[index] = {
          ...updated[index],
          status: "IN_QUEUE",
          imageUrl: null,
        };
      }
      return updated;
    });
    try {
      const res = await fetch("/api/thumbnail/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt,
          faces: selectedFaces,
          style,
          platform,
          width: displayWidth,
          height: displayHeight,
          textOverlay,
          colorTheme,
          mood,
          variations: 1,
        }),
      });
      const data = await res.json();
      if (data.success && data.thumbnails?.[0]?.job_id) {
        const newThumb = data.thumbnails[0];
        setResults((prev) => {
          const updated = [...prev];
          updated[index] = { ...updated[index], ...newThumb };
          return updated;
        });
        toast.dismiss();
        await pollJob(newThumb.job_id, index);
        toast.success("Variation regenerated!");
      } else {
        toast.dismiss();
        toast.error("Regeneration failed");
      }
    } catch {
      toast.dismiss();
      toast.error("Error regenerating");
    }
  }

  function copyPrompt(text: string, id: string) {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
    toast.success("Prompt copied!");
  }

  function getAspectClass(): string {
    const ratio = displayWidth / displayHeight;
    if (ratio > 1.5) return "aspect-video";
    if (ratio > 0.9 && ratio < 1.1) return "aspect-square";
    if (ratio < 0.7) return "aspect-[9/16]";
    return "aspect-video";
  }

  return (
    <div className="fade-in space-y-5">
      {/* ─── Header ─── */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gold/10 rounded-xl flex items-center justify-center">
            <ImageIcon size={20} className="text-gold" />
          </div>
          <div>
            <h1 className="page-header mb-0">Thumbnail Generator</h1>
            <p className="text-xs text-muted">
              AI-powered thumbnail creation with styles, faces & text overlays
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[9px] text-muted uppercase tracking-wider">
            {displayWidth} x {displayHeight}
          </span>
          <div className="w-8 h-5 rounded border border-border bg-surface-light flex items-center justify-center">
            <RectangleHorizontal size={12} className="text-muted" />
          </div>
        </div>
      </div>

      {/* ─── Tabs ─── */}
      <div className="tab-group w-fit">
        {(["generate", "history"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={tab === t ? "tab-item-active" : "tab-item-inactive"}
          >
            {t === "generate"
              ? "Generator"
              : `History (${history.length})`}
          </button>
        ))}
      </div>

      {/* ─── Generate Tab ─── */}
      {tab === "generate" && (
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
          {/* LEFT PANEL — Controls */}
          <div className="lg:col-span-2 space-y-4">
            {/* Reference Images */}
            <div className="card">
              <h2 className="section-header flex items-center gap-2">
                <Upload size={13} className="text-gold" /> Reference Images <span className="text-[9px] text-muted font-normal">(optional)</span>
              </h2>
              <p className="text-[9px] text-muted mb-2">Drop faces, logos, or reference images to include in your thumbnail</p>
              {referenceImages.length > 0 && (
                <div className="flex gap-2 mb-2 flex-wrap">
                  {referenceImages.map((img, i) => (
                    <div key={i} className="relative group">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={img} alt="" className="w-16 h-16 rounded-lg object-cover border border-border" />
                      <button onClick={() => setReferenceImages(prev => prev.filter((_, j) => j !== i))}
                        className="absolute -top-1 -right-1 w-4 h-4 bg-danger rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                        <X size={8} className="text-white" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              {referenceImages.length < 3 && (
                <label className="flex items-center justify-center gap-2 border-2 border-dashed border-border/50 hover:border-gold/30 rounded-xl py-3 cursor-pointer transition-colors">
                  <Upload size={14} className="text-muted" />
                  <span className="text-[10px] text-muted">Click or drag files here ({3 - referenceImages.length} remaining)</span>
                  <input type="file" accept="image/*" multiple className="hidden" onChange={(e) => {
                    const files = Array.from(e.target.files || []);
                    const remaining = 3 - referenceImages.length;
                    files.slice(0, remaining).forEach(file => {
                      if (file.size > 5 * 1024 * 1024) return;
                      const reader = new FileReader();
                      reader.onload = () => {
                        setReferenceImages(prev => [...prev, reader.result as string].slice(0, 3));
                      };
                      reader.readAsDataURL(file);
                    });
                    e.target.value = "";
                  }} />
                </label>
              )}
            </div>

            {/* Prompt */}
            <div className="card">
              <h2 className="section-header flex items-center gap-2">
                <Sparkles size={13} className="text-gold" /> Description / Prompt
              </h2>
              <PromptEnhancer
                value={prompt}
                onChange={setPrompt}
                type="thumbnail"
                placeholder='e.g., "A dramatic thumbnail about space exploration with a shocked astronaut"'
                rows={3}
              />
            </div>

            {/* Face / Character Selection */}
            <div className="card">
              <h2 className="section-header flex items-center gap-2">
                <User size={13} className="text-gold" /> Face / Character
              </h2>
              <p className="text-[9px] text-muted mb-2">Select one or more faces to include</p>
              <div className="grid grid-cols-4 gap-1.5">
                {FACE_OPTIONS.map((face) => {
                  const selected = selectedFaces.includes(face.id);
                  return (
                    <button
                      key={face.id}
                      onClick={() => toggleFace(face.id)}
                      className={`flex flex-col items-center gap-1 p-2 rounded-xl border transition-all ${
                        selected
                          ? "border-gold/40 bg-gold/[0.07] ring-1 ring-gold/20"
                          : "border-border hover:border-gold/15"
                      }`}
                    >
                      <span className="text-lg leading-none">{face.emoji}</span>
                      <span
                        className={`text-[8px] leading-tight text-center ${
                          selected ? "text-gold font-semibold" : "text-muted"
                        }`}
                      >
                        {face.label}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Thumbnail Style */}
            <div className="card">
              <h2 className="section-header flex items-center gap-2">
                <Layers size={13} className="text-gold" /> Thumbnail Style
              </h2>
              <div className="grid grid-cols-2 gap-2">
                {THUMBNAIL_STYLES.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => setStyle(s.id)}
                    className={`flex items-center gap-2.5 p-2.5 rounded-xl border transition-all text-left ${
                      style === s.id
                        ? "border-gold/30 bg-gold/[0.05]"
                        : "border-border hover:border-gold/15"
                    }`}
                  >
                    <div
                      className={`w-7 h-7 rounded-lg bg-gradient-to-br ${s.gradient} flex-shrink-0`}
                    />
                    <div className="min-w-0">
                      <p
                        className={`text-[10px] font-semibold truncate ${
                          style === s.id ? "text-gold" : ""
                        }`}
                      >
                        {s.name}
                      </p>
                      <p className="text-[8px] text-muted truncate">{s.desc}</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Platform / Size */}
            <div className="card">
              <h2 className="section-header flex items-center gap-2">
                <Monitor size={13} className="text-gold" /> Platform / Size
              </h2>
              <div className="relative">
                <select
                  value={platform}
                  onChange={(e) => setPlatform(e.target.value)}
                  className="input w-full text-xs appearance-none pr-8"
                >
                  {PLATFORM_SIZES.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.width}x{p.height})
                    </option>
                  ))}
                </select>
                <ChevronDown
                  size={14}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none"
                />
              </div>
              {platform === "custom" && (
                <div className="grid grid-cols-2 gap-2 mt-2">
                  <div>
                    <label className="block text-[9px] text-muted uppercase tracking-wider mb-1">
                      Width
                    </label>
                    <input
                      type="number"
                      value={customWidth}
                      onChange={(e) => setCustomWidth(Number(e.target.value))}
                      className="input w-full text-xs"
                      min={100}
                      max={4096}
                    />
                  </div>
                  <div>
                    <label className="block text-[9px] text-muted uppercase tracking-wider mb-1">
                      Height
                    </label>
                    <input
                      type="number"
                      value={customHeight}
                      onChange={(e) => setCustomHeight(Number(e.target.value))}
                      className="input w-full text-xs"
                      min={100}
                      max={4096}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Text Overlay */}
            <div className="card">
              <h2 className="section-header flex items-center gap-2">
                <Type size={13} className="text-gold" /> Text Overlay
              </h2>
              <input
                value={textOverlay}
                onChange={(e) => setTextOverlay(e.target.value)}
                className="input w-full text-xs"
                placeholder={"e.g., \"YOU WON'T BELIEVE THIS...\""}
                maxLength={80}
              />
              <div className="flex justify-end mt-1">
                <span className="text-[9px] text-muted">{textOverlay.length}/80</span>
              </div>
            </div>

            {/* Color Theme */}
            <div className="card">
              <h2 className="section-header flex items-center gap-2">
                <Palette size={13} className="text-gold" /> Color Theme
              </h2>
              <div className="grid grid-cols-3 gap-2">
                {COLOR_THEMES.map((ct) => (
                  <button
                    key={ct.id}
                    onClick={() => setColorTheme(ct.id)}
                    className={`flex items-center gap-2 p-2 rounded-xl border transition-all ${
                      colorTheme === ct.id
                        ? "border-gold/30 bg-gold/[0.05]"
                        : "border-border hover:border-gold/15"
                    }`}
                  >
                    <div className="flex -space-x-1">
                      {ct.colors.map((c, ci) => (
                        <div
                          key={ci}
                          className="w-4 h-4 rounded-full border border-white/50"
                          style={{ backgroundColor: c }}
                        />
                      ))}
                    </div>
                    <span
                      className={`text-[9px] truncate ${
                        colorTheme === ct.id ? "text-gold font-semibold" : "text-muted"
                      }`}
                    >
                      {ct.name}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Mood / Emotion */}
            <div className="card">
              <h2 className="section-header flex items-center gap-2">
                <Smile size={13} className="text-gold" /> Mood / Emotion
              </h2>
              <div className="flex flex-wrap gap-1.5">
                {MOODS.map((m) => (
                  <button
                    key={m}
                    onClick={() => setMood(m)}
                    className={`text-[10px] px-2.5 py-1 rounded-full border transition-all ${
                      mood === m
                        ? "border-gold/30 bg-gold/[0.08] text-gold font-semibold"
                        : "border-border text-muted hover:text-foreground hover:border-gold/15"
                    }`}
                  >
                    {m}
                  </button>
                ))}
              </div>
            </div>

            {/* Variations + Generate */}
            <div className="card">
              <div className="flex items-center justify-between mb-3">
                <h2 className="section-header mb-0 flex items-center gap-2">
                  <Grid size={13} className="text-gold" /> Variations
                </h2>
                <div className="flex gap-1">
                  {[1, 2, 4].map((n) => (
                    <button
                      key={n}
                      onClick={() => setVariations(n)}
                      className={`text-[10px] px-3 py-1 rounded-lg border transition-all ${
                        variations === n
                          ? "border-gold/30 bg-gold/[0.05] text-gold font-semibold"
                          : "border-border text-muted hover:text-foreground"
                      }`}
                    >
                      {n}x
                    </button>
                  ))}
                </div>
              </div>
              {/* Quick Presets */}
              <div>
                <h2 className="section-header flex items-center gap-2"><Layers size={13} className="text-gold" /> Quick Presets</h2>
                <div className="flex flex-wrap gap-1 mb-2">
                  {THUMBNAIL_PRESET_CATEGORIES.map(cat => (
                    <button
                      key={cat.id}
                      onClick={() => {
                        const preset = THUMBNAIL_PRESETS.find(p => p.category === cat.id);
                        if (preset) {
                          setPrompt(preset.config.description || `${preset.name} — ${preset.desc}`);
                          toast.success(`Preset: ${preset.name}`);
                        }
                      }}
                      className="text-[8px] px-2 py-1 rounded border border-border text-muted hover:text-foreground hover:border-gold/15 transition-all"
                    >
                      {cat.name}
                    </button>
                  ))}
                </div>
                <div className="max-h-32 overflow-y-auto space-y-1">
                  {THUMBNAIL_PRESETS.slice(0, 8).map(preset => (
                    <button
                      key={preset.id}
                      onClick={() => {
                        setPrompt(preset.config.description || `${preset.name}: ${preset.desc}. Style: ${preset.config.style}, Colors: ${preset.config.color_scheme}, Text: "${preset.config.text_overlay}", Face: ${preset.config.face_expression}, BG: ${preset.config.background}`);
                        toast.success(`Preset loaded: ${preset.name}`);
                      }}
                      className="w-full text-left px-2.5 py-1.5 rounded-lg hover:bg-surface-light border border-transparent hover:border-border/30 transition-all"
                    >
                      <p className="text-[10px] font-medium">{preset.name}</p>
                      <p className="text-[8px] text-muted">{preset.desc}</p>
                    </button>
                  ))}
                </div>
              </div>

              <button
                onClick={generate}
                disabled={generating}
                className="btn-primary w-full flex items-center justify-center gap-2 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {generating ? (
                  <>
                    <Loader size={16} className="animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Zap size={16} />
                    Generate Thumbnail{variations > 1 ? "s" : ""}
                  </>
                )}
              </button>
            </div>
          </div>

          {/* RIGHT PANEL — Results */}
          <div className="lg:col-span-3 space-y-4">
            {/* Results area */}
            {generating && results.length === 0 && (
              <div
                className={`grid gap-4 ${
                  variations >= 4
                    ? "grid-cols-2"
                    : variations >= 2
                    ? "grid-cols-2"
                    : "grid-cols-1"
                }`}
              >
                {Array.from({ length: variations }).map((_, i) => (
                  <div key={i} className="card-static">
                    <div className={`${getAspectClass()} rounded-xl overflow-hidden relative`}>
                      <div className="absolute inset-0 skeleton" />
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className="flex flex-col items-center gap-2">
                          <Loader size={24} className="text-gold animate-spin" />
                          <span className="text-[10px] text-muted">
                            Generating {i + 1}/{variations}...
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {results.length > 0 && (
              <div
                className={`grid gap-4 ${
                  results.length >= 4
                    ? "grid-cols-2"
                    : results.length >= 2
                    ? "grid-cols-2"
                    : "grid-cols-1"
                }`}
              >
                {results.map((thumb, i) => {
                  const isLoading =
                    thumb.status === "IN_QUEUE" || thumb.status === "IN_PROGRESS";
                  const isFailed = thumb.status === "FAILED";
                  const isComplete =
                    thumb.status === "COMPLETED" && thumb.imageUrl;

                  return (
                    <div key={thumb.id} className="card-static group">
                      {/* Preview */}
                      <div
                        className={`${getAspectClass()} rounded-xl overflow-hidden relative bg-surface-light`}
                      >
                        {/* Real generated image */}
                        {isComplete && thumb.imageUrl && (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={thumb.imageUrl}
                            alt={thumb.prompt}
                            className="w-full h-full object-cover"
                          />
                        )}

                        {/* Loading state */}
                        {isLoading && (
                          <div className="absolute inset-0 flex items-center justify-center bg-surface-light">
                            <div className="flex flex-col items-center gap-2">
                              <Loader
                                size={28}
                                className="text-gold animate-spin"
                              />
                              <span className="text-[10px] text-muted">
                                {thumb.status === "IN_QUEUE"
                                  ? "Waiting for GPU..."
                                  : "Generating image..."}
                              </span>
                              <div className="w-32 h-1 bg-border rounded-full overflow-hidden">
                                <div className="h-full bg-gold/60 rounded-full animate-pulse w-2/3" />
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Failed state */}
                        {isFailed && (
                          <div className="absolute inset-0 flex items-center justify-center bg-surface-light">
                            <div className="flex flex-col items-center gap-2">
                              <span className="text-danger text-lg">!</span>
                              <span className="text-[10px] text-danger">
                                Generation failed
                              </span>
                              <button
                                onClick={() => regenerateSingle(i)}
                                className="text-[9px] px-2 py-1 rounded border border-danger/30 text-danger hover:bg-danger/10"
                              >
                                Retry
                              </button>
                            </div>
                          </div>
                        )}

                        {/* Text overlay (on completed images) */}
                        {isComplete && thumb.textOverlay && (
                          <div className="absolute inset-0 flex items-center justify-center p-4">
                            <h3
                              className="text-white font-black text-center drop-shadow-lg"
                              style={{
                                fontSize:
                                  results.length >= 4 ? "14px" : "22px",
                                textShadow: "2px 2px 8px rgba(0,0,0,0.7)",
                                lineHeight: 1.1,
                              }}
                            >
                              {thumb.textOverlay}
                            </h3>
                          </div>
                        )}

                        {/* Face badges */}
                        {thumb.faces.length > 0 && (
                          <div className="absolute top-2 left-2 flex gap-1">
                            {thumb.faces.slice(0, 3).map((fid) => {
                              const face = FACE_OPTIONS.find(
                                (f) => f.id === fid
                              );
                              return face ? (
                                <span
                                  key={fid}
                                  className="w-6 h-6 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center text-xs"
                                >
                                  {face.emoji}
                                </span>
                              ) : null;
                            })}
                          </div>
                        )}

                        {/* Style badge */}
                        <div className="absolute top-2 right-2">
                          <span className="text-[8px] px-1.5 py-0.5 rounded bg-black/40 text-white/80 backdrop-blur-sm">
                            {THUMBNAIL_STYLES.find((s) => s.id === thumb.style)
                              ?.name || thumb.style}
                          </span>
                        </div>

                        {/* Size badge */}
                        <div className="absolute bottom-2 right-2">
                          <span className="text-[8px] px-1.5 py-0.5 rounded bg-black/40 text-white/60 backdrop-blur-sm">
                            {thumb.width}x{thumb.height}
                          </span>
                        </div>

                        {/* Status badge */}
                        <div className="absolute bottom-2 left-2">
                          <span
                            className={`text-[7px] px-1.5 py-0.5 rounded font-semibold ${
                              isComplete
                                ? "bg-success/80 text-white"
                                : isLoading
                                ? "bg-gold/80 text-white"
                                : "bg-danger/80 text-white"
                            }`}
                          >
                            {isComplete
                              ? "READY"
                              : isLoading
                              ? "GENERATING"
                              : isFailed
                              ? "FAILED"
                              : "QUEUED"}
                          </span>
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-1.5 mt-3">
                        <button
                          onClick={() => {
                            if (isComplete && thumb.imageUrl) {
                              // Download real image
                              const link = document.createElement("a");
                              link.href = thumb.imageUrl;
                              link.download = `thumbnail_${thumb.id}.png`;
                              link.click();
                              toast.success("Downloading thumbnail");
                            } else {
                              toast.error("Image not ready yet");
                            }
                          }}
                          disabled={!isComplete}
                          className="flex-1 flex items-center justify-center gap-1.5 text-[10px] font-medium py-1.5 rounded-lg border border-border hover:border-gold/20 hover:bg-gold/[0.03] transition-all text-muted hover:text-foreground disabled:opacity-40"
                        >
                          <Download size={12} /> Download
                        </button>
                        <button
                          onClick={() => regenerateSingle(i)}
                          className="flex-1 flex items-center justify-center gap-1.5 text-[10px] font-medium py-1.5 rounded-lg border border-border hover:border-gold/20 hover:bg-gold/[0.03] transition-all text-muted hover:text-foreground"
                        >
                          <RefreshCw size={12} /> Regenerate
                        </button>
                        <button
                          onClick={() => toast("Edit feature coming soon")}
                          className="flex-1 flex items-center justify-center gap-1.5 text-[10px] font-medium py-1.5 rounded-lg border border-border hover:border-gold/20 hover:bg-gold/[0.03] transition-all text-muted hover:text-foreground"
                        >
                          <Edit3 size={12} /> Edit
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Empty state */}
            {!generating && results.length === 0 && (
              <div className="card-static flex flex-col items-center justify-center py-16 text-center">
                <div className="w-16 h-16 bg-gold/10 rounded-2xl flex items-center justify-center mb-4">
                  <ImageIcon size={28} className="text-gold" />
                </div>
                <h3 className="text-sm font-semibold mb-1">No thumbnails yet</h3>
                <p className="text-xs text-muted max-w-xs">
                  Fill out the settings on the left and click Generate to create
                  AI-powered thumbnails for your content.
                </p>
                <div className="flex items-center gap-4 mt-6">
                  {[
                    { icon: <Sparkles size={14} />, label: "AI-Powered" },
                    { icon: <Palette size={14} />, label: "Custom Styles" },
                    { icon: <Square size={14} />, label: "Multi-Platform" },
                  ].map((feat, i) => (
                    <div
                      key={i}
                      className="flex items-center gap-1.5 text-[10px] text-muted"
                    >
                      <span className="text-gold">{feat.icon}</span>
                      {feat.label}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Quick config summary */}
            {(results.length > 0 || generating) && (
              <div className="card-static">
                <h3 className="text-[10px] font-semibold text-muted uppercase tracking-wider mb-2">
                  Generation Config
                </h3>
                <div className="flex flex-wrap gap-2">
                  {[
                    { label: "Style", value: THUMBNAIL_STYLES.find((s) => s.id === style)?.name },
                    { label: "Platform", value: currentPlatform.name },
                    { label: "Theme", value: COLOR_THEMES.find((c) => c.id === colorTheme)?.name },
                    { label: "Mood", value: mood },
                    {
                      label: "Faces",
                      value:
                        selectedFaces.length > 0
                          ? selectedFaces
                              .map(
                                (fid) =>
                                  FACE_OPTIONS.find((f) => f.id === fid)?.label || fid
                              )
                              .join(", ")
                          : "None",
                    },
                  ].map((item, i) => (
                    <div
                      key={i}
                      className="text-[9px] px-2 py-1 rounded-lg bg-surface-light border border-border"
                    >
                      <span className="text-muted">{item.label}:</span>{" "}
                      <span className="font-medium">{item.value}</span>
                    </div>
                  ))}
                </div>
                {prompt && (
                  <div className="mt-2 flex items-start gap-2">
                    <p className="text-[10px] text-muted italic flex-1 line-clamp-2">
                      &ldquo;{prompt}&rdquo;
                    </p>
                    <button
                      onClick={() => copyPrompt(prompt, "config")}
                      className="text-muted hover:text-gold transition-colors flex-shrink-0"
                    >
                      {copiedId === "config" ? (
                        <Check size={12} className="text-success" />
                      ) : (
                        <Copy size={12} />
                      )}
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ─── History Tab ─── */}
      {tab === "history" && (
        <div className="space-y-3">
          {history.length === 0 ? (
            <div className="card-static flex flex-col items-center py-12 text-center">
              <Clock size={28} className="text-muted mb-3" />
              <h3 className="text-sm font-semibold mb-1">No history yet</h3>
              <p className="text-xs text-muted">
                Generated thumbnails will appear here.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {history.map((item) => {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const meta: any = item.metadata || {};
                const styleObj = THUMBNAIL_STYLES.find(
                  (s) => s.id === (meta.style as string)
                );
                return (
                  <div key={item.id} className="card-static group">
                    {/* Mock preview */}
                    <div className="aspect-video rounded-xl bg-gradient-to-br from-gold/10 to-gold/5 flex items-center justify-center mb-3">
                      <ImageIcon size={24} className="text-gold/40" />
                    </div>
                    <p className="text-xs font-medium truncate">{item.description}</p>
                    <div className="flex items-center gap-2 mt-1">
                      {styleObj && (
                        <span className="text-[8px] px-1.5 py-0.5 rounded bg-gold/10 text-gold">
                          {styleObj.name}
                        </span>
                      )}
                      {meta.platform && (
                        <span className="text-[8px] px-1.5 py-0.5 rounded bg-surface-light border border-border text-muted">
                          {PLATFORM_SIZES.find((p) => p.id === (meta.platform as string))?.name ||
                            (meta.platform as string)}
                        </span>
                      )}
                      {meta.count && Number(meta.count) > 1 && (
                        <span className="text-[8px] text-muted">
                          {String(meta.count)} variations
                        </span>
                      )}
                    </div>
                    <p className="text-[9px] text-muted mt-1.5">
                      {new Date(item.created_at).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </p>
                    {/* Actions */}
                    <div className="flex gap-1.5 mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => {
                          setPrompt(item.description);
                          if (meta.style) setStyle(meta.style as string);
                          if (meta.platform) setPlatform(meta.platform as string);
                          if (meta.colorTheme) setColorTheme(meta.colorTheme as string);
                          if (meta.mood) setMood(meta.mood as string);
                          if (Array.isArray(meta.faces)) setSelectedFaces(meta.faces as string[]);
                          setTab("generate");
                          toast.success("Settings loaded from history");
                        }}
                        className="text-[9px] px-2 py-1 rounded border border-border hover:border-gold/20 text-muted hover:text-foreground transition-all"
                      >
                        Reuse Settings
                      </button>
                      <button
                        onClick={async () => {
                          await supabase
                            .from("trinity_log")
                            .delete()
                            .eq("id", item.id);
                          loadHistory();
                          toast.success("Removed from history");
                        }}
                        className="text-[9px] px-2 py-1 rounded border border-border hover:border-danger/20 text-muted hover:text-danger transition-all"
                      >
                        <Trash2 size={10} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
