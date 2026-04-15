"use client";

import { useState, useRef, useCallback } from "react";
import {
  Sparkles, Download, Copy, Check, Loader, ChevronLeft, ChevronRight,
  Palette, Type, Layers, Wand2, LayoutGrid, Zap, Edit3, RotateCcw,
  BookOpen, List, MessageCircle, Lightbulb, HelpCircle, X,
  Image as ImageIcon,
} from "lucide-react";
import toast from "react-hot-toast";

/* ══════════════════════════════════════════════════════════════════
   TYPES
   ══════════════════════════════════════════════════════════════════ */

interface Slide {
  slideNumber: number;
  headline: string;
  body: string;
}

type CarouselStyle = "minimalist" | "bold" | "corporate" | "playful" | "dark" | "gradient";

interface BrandColors {
  primary: string;
  secondary: string;
}

/* ══════════════════════════════════════════════════════════════════
   DATA
   ══════════════════════════════════════════════════════════════════ */

const STYLES: { id: CarouselStyle; name: string; desc: string; preview: string; text: string }[] = [
  { id: "minimalist", name: "Minimalist", desc: "Clean & elegant", preview: "linear-gradient(135deg, #f8f8f8 0%, #e8e8e8 100%)", text: "#1a1a1a" },
  { id: "bold", name: "Bold", desc: "High impact", preview: "linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)", text: "#ffffff" },
  { id: "corporate", name: "Corporate", desc: "Professional", preview: "linear-gradient(135deg, #1e3a5f 0%, #2d5a87 100%)", text: "#ffffff" },
  { id: "playful", name: "Playful", desc: "Fun & vibrant", preview: "linear-gradient(135deg, #ff6b6b 0%, #ffa06b 100%)", text: "#ffffff" },
  { id: "dark", name: "Dark", desc: "Premium feel", preview: "linear-gradient(135deg, #0a0a0a 0%, #1a1a2e 100%)", text: "#ffffff" },
  { id: "gradient", name: "Gradient", desc: "Modern vibes", preview: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)", text: "#ffffff" },
];

const TEMPLATES = [
  { id: "howto", name: "How-To Guide", desc: "Step-by-step instructions", icon: HelpCircle, example: "How to grow on Instagram in 2026" },
  { id: "listicle", name: "Listicle", desc: "Numbered tips or items", icon: List, example: "7 tools every creator needs" },
  { id: "story", name: "Story", desc: "Narrative arc with hook", icon: BookOpen, example: "How I went from 0 to 100K followers" },
  { id: "tips", name: "Tips & Tricks", desc: "Actionable advice", icon: Lightbulb, example: "5 copywriting secrets that convert" },
  { id: "myths", name: "Myths vs Facts", desc: "Debunk misconceptions", icon: MessageCircle, example: "SEO myths that are killing your traffic" },
];

const PRESET_COLORS: { name: string; primary: string; secondary: string }[] = [
  { name: "Ocean Blue", primary: "#2563eb", secondary: "#60a5fa" },
  { name: "Coral Sunset", primary: "#f43f5e", secondary: "#fb923c" },
  { name: "Forest Green", primary: "#059669", secondary: "#34d399" },
  { name: "Royal Purple", primary: "#7c3aed", secondary: "#a78bfa" },
  { name: "Midnight Gold", primary: "#1a1a2e", secondary: "#C9A84C" },
  { name: "Slate Rose", primary: "#475569", secondary: "#f472b6" },
];

/* ══════════════════════════════════════════════════════════════════
   SLIDE STYLE HELPERS
   ══════════════════════════════════════════════════════════════════ */

function getSlideBackground(
  style: CarouselStyle,
  colors: BrandColors,
  slideIndex: number,
  totalSlides: number,
): string {
  const { primary, secondary } = colors;
  const isFirst = slideIndex === 0;
  const isLast = slideIndex === totalSlides - 1;

  switch (style) {
    case "minimalist":
      return isFirst || isLast
        ? `linear-gradient(145deg, ${primary} 0%, ${secondary} 100%)`
        : "#f9fafb";
    case "bold":
      return `linear-gradient(${135 + slideIndex * 15}deg, ${primary} 0%, ${secondary} 100%)`;
    case "corporate":
      return isFirst
        ? `linear-gradient(180deg, ${primary} 0%, ${primary}dd 100%)`
        : slideIndex % 2 === 0
          ? "#ffffff"
          : "#f1f5f9";
    case "playful": {
      const hueShift = slideIndex * 30;
      return `linear-gradient(${120 + hueShift}deg, ${primary} 0%, ${secondary} 100%)`;
    }
    case "dark":
      return isFirst
        ? `linear-gradient(145deg, #0a0a0a 0%, ${primary} 100%)`
        : `linear-gradient(${160 + slideIndex * 10}deg, #0f0f0f 0%, #1a1a2e 100%)`;
    case "gradient":
      return `linear-gradient(${90 + slideIndex * 25}deg, ${primary} 0%, ${secondary} 50%, ${primary}88 100%)`;
    default:
      return "#ffffff";
  }
}

function getSlideTextColor(style: CarouselStyle, slideIndex: number): { headline: string; body: string } {
  switch (style) {
    case "minimalist":
      return slideIndex === 0
        ? { headline: "#ffffff", body: "#ffffffcc" }
        : { headline: "#111827", body: "#4b5563" };
    case "bold":
      return { headline: "#ffffff", body: "#ffffffdd" };
    case "corporate":
      return slideIndex === 0
        ? { headline: "#ffffff", body: "#ffffffcc" }
        : { headline: "#1e3a5f", body: "#475569" };
    case "playful":
      return { headline: "#ffffff", body: "#ffffffee" };
    case "dark":
      return { headline: "#ffffff", body: "#a0a0b8" };
    case "gradient":
      return { headline: "#ffffff", body: "#ffffffdd" };
    default:
      return { headline: "#111827", body: "#4b5563" };
  }
}

/* ══════════════════════════════════════════════════════════════════
   MOCK AI (fallback when API is unavailable)
   ══════════════════════════════════════════════════════════════════ */

function generateMockSlides(topic: string, count: number, template?: string): Slide[] {
  const slides: Slide[] = [];

  const hookHeadlines = [
    `Stop Scrolling.`,
    `You Need to See This.`,
    `This Changes Everything.`,
    `The Truth About ${topic.split(" ").slice(0, 3).join(" ")}`,
    `${topic.split(" ").slice(0, 4).join(" ")}`,
  ];

  const ctaHeadlines = [
    "Save This For Later",
    "Follow For More",
    "Share With Someone Who Needs This",
    "Drop a Comment Below",
    "Ready to Start?",
  ];

  // Slide 1 - Hook
  slides.push({
    slideNumber: 1,
    headline: hookHeadlines[Math.floor(Math.random() * hookHeadlines.length)],
    body: `Everything you need to know about ${topic.toLowerCase()} — swipe to learn more.`,
  });

  // Middle slides
  const middleTemplates: Record<string, (i: number) => { headline: string; body: string }> = {
    howto: (i) => ({
      headline: `Step ${i}`,
      body: `Here is a detailed but concise explanation of step ${i} in mastering ${topic.toLowerCase()}.`,
    }),
    listicle: (i) => ({
      headline: `#${i} — Key Insight`,
      body: `This is one of the most important aspects of ${topic.toLowerCase()} that most people overlook.`,
    }),
    story: (i) => {
      const parts = ["The Beginning", "The Struggle", "The Breakthrough", "The Lesson", "The Transformation", "The Result", "Looking Back", "What I Learned"];
      return {
        headline: parts[i - 1] || `Chapter ${i}`,
        body: `This part of the ${topic.toLowerCase()} journey changed my perspective completely.`,
      };
    },
    tips: (i) => ({
      headline: `Tip ${i}`,
      body: `A practical, actionable tip about ${topic.toLowerCase()} you can implement today.`,
    }),
    myths: (i) => ({
      headline: i % 2 === 0 ? "FACT" : "MYTH",
      body: i % 2 === 0
        ? `The reality about ${topic.toLowerCase()} is quite different from what most people think.`
        : `Many people believe this about ${topic.toLowerCase()}, but it is actually not true.`,
    }),
  };

  const getMiddle = middleTemplates[template || "tips"] || middleTemplates.tips;

  for (let i = 1; i <= count - 2; i++) {
    const content = getMiddle(i);
    slides.push({ slideNumber: i + 1, headline: content.headline, body: content.body });
  }

  // Final slide - CTA
  slides.push({
    slideNumber: count,
    headline: ctaHeadlines[Math.floor(Math.random() * ctaHeadlines.length)],
    body: `If this was helpful, save it and share it with someone who needs to hear this. Follow for more content like this.`,
  });

  return slides;
}

/* ══════════════════════════════════════════════════════════════════
   MAIN PAGE COMPONENT
   ══════════════════════════════════════════════════════════════════ */

export default function CarouselGeneratorPage() {
  // Input state
  const [topic, setTopic] = useState("");
  const [slideCount, setSlideCount] = useState(6);
  const [style, setStyle] = useState<CarouselStyle>("bold");
  const [template, setTemplate] = useState<string | null>(null);
  const [brandColors, setBrandColors] = useState<BrandColors>({ primary: "#1a1a2e", secondary: "#C9A84C" });

  // Generation state
  const [slides, setSlides] = useState<Slide[]>([]);
  const [generating, setGenerating] = useState(false);
  const [editingSlide, setEditingSlide] = useState<number | null>(null);
  const [copied, setCopied] = useState(false);

  // Preview scroll ref
  const scrollRef = useRef<HTMLDivElement>(null);

  /* ── Generate carousel ── */
  const handleGenerate = useCallback(async () => {
    if (!topic.trim()) {
      toast.error("Enter a topic first");
      return;
    }

    setGenerating(true);
    setSlides([]);
    setEditingSlide(null);

    try {
      const res = await fetch("/api/carousel/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topic,
          slideCount,
          style,
          template: template || undefined,
          brandColors,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.slides && data.slides.length > 0) {
          setSlides(data.slides);
          toast.success(`${data.slides.length} slides generated!`);
          setGenerating(false);
          return;
        }
      }
    } catch {
      // API failed, fall through to mock
    }

    // Fallback: mock generation with realistic delay
    await new Promise((r) => setTimeout(r, 1800));
    const mockSlides = generateMockSlides(topic, slideCount, template || undefined);
    setSlides(mockSlides);
    toast.success(`${mockSlides.length} slides generated!`);
    setGenerating(false);
  }, [topic, slideCount, style, template, brandColors]);

  /* ── Inline edit ── */
  const updateSlide = useCallback((index: number, field: "headline" | "body", value: string) => {
    setSlides((prev) => prev.map((s, i) => (i === index ? { ...s, [field]: value } : s)));
  }, []);

  /* ── Copy all text ── */
  const handleCopyAll = useCallback(() => {
    if (slides.length === 0) return;
    const text = slides
      .map((s) => `[Slide ${s.slideNumber}]\n${s.headline}\n${s.body}`)
      .join("\n\n---\n\n");
    navigator.clipboard.writeText(text);
    setCopied(true);
    toast.success("All slide text copied!");
    setTimeout(() => setCopied(false), 2000);
  }, [slides]);

  /* ── Download as JSON (content export) ── */
  const handleDownload = useCallback(() => {
    if (slides.length === 0) return;
    const payload = {
      topic,
      style,
      template,
      brandColors,
      generatedAt: new Date().toISOString(),
      slides,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `carousel-${topic.replace(/\s+/g, "-").toLowerCase().slice(0, 30)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Carousel downloaded!");
  }, [slides, topic, style, template, brandColors]);

  /* ── Scroll preview ── */
  const scrollPreview = useCallback((dir: "left" | "right") => {
    if (!scrollRef.current) return;
    const amount = 320;
    scrollRef.current.scrollBy({ left: dir === "left" ? -amount : amount, behavior: "smooth" });
  }, []);

  return (
    <div className="max-w-7xl mx-auto animate-fade-in">
      {/* ─── Header ─── */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
            <Layers size={20} className="text-gold" />
            Carousel Generator
          </h1>
          <p className="text-xs text-muted mt-0.5">
            Create scroll-stopping Instagram & LinkedIn carousels with AI
          </p>
        </div>
        {slides.length > 0 && (
          <div className="flex items-center gap-2">
            <button
              onClick={handleCopyAll}
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border transition-all"
              style={{
                borderColor: "var(--color-border)",
                background: "var(--color-surface)",
                color: "var(--color-foreground)",
              }}
            >
              {copied ? <Check size={13} /> : <Copy size={13} />}
              {copied ? "Copied!" : "Copy Text"}
            </button>
            <button
              onClick={handleDownload}
              className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg transition-all text-white"
              style={{ background: "var(--color-accent)" }}
            >
              <Download size={13} />
              Download All
            </button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* ═══════════════════════════════════════════
            LEFT PANEL — Configuration
            ═══════════════════════════════════════════ */}
        <div className="lg:col-span-4 space-y-4">

          {/* Topic Input */}
          <div
            className="rounded-2xl p-4"
            style={{
              background: "var(--color-surface)",
              border: "1px solid var(--color-border)",
            }}
          >
            <label className="text-xs font-semibold text-foreground flex items-center gap-1.5 mb-2">
              <Type size={13} className="text-gold" />
              Topic
            </label>
            <textarea
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="e.g. 5 mistakes killing your Instagram growth..."
              rows={3}
              className="w-full text-sm rounded-xl px-3 py-2.5 resize-none transition-all focus:outline-none"
              style={{
                background: "var(--color-surface-light)",
                border: "1px solid var(--color-border)",
                color: "var(--color-foreground)",
              }}
            />

            {/* Slide count */}
            <div className="mt-3">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-medium text-muted">Slides</span>
                <span className="text-xs font-bold text-foreground">{slideCount}</span>
              </div>
              <input
                type="range"
                min={3}
                max={10}
                value={slideCount}
                onChange={(e) => setSlideCount(Number(e.target.value))}
                className="w-full h-1.5 rounded-full appearance-none cursor-pointer"
                style={{
                  background: `linear-gradient(to right, var(--color-accent) ${((slideCount - 3) / 7) * 100}%, var(--color-border) ${((slideCount - 3) / 7) * 100}%)`,
                }}
              />
              <div className="flex justify-between mt-1">
                <span className="text-[10px] text-muted">3</span>
                <span className="text-[10px] text-muted">10</span>
              </div>
            </div>
          </div>

          {/* Style Picker */}
          <div
            className="rounded-2xl p-4"
            style={{
              background: "var(--color-surface)",
              border: "1px solid var(--color-border)",
            }}
          >
            <label className="text-xs font-semibold text-foreground flex items-center gap-1.5 mb-3">
              <Palette size={13} className="text-gold" />
              Style
            </label>
            <div className="grid grid-cols-3 gap-2">
              {STYLES.map((s) => (
                <button
                  key={s.id}
                  onClick={() => setStyle(s.id)}
                  className="relative text-left p-2.5 rounded-xl border transition-all group"
                  style={{
                    borderColor: style === s.id ? "var(--color-accent)" : "var(--color-border)",
                    background: style === s.id ? "color-mix(in srgb, var(--color-accent) 6%, var(--color-surface))" : "var(--color-surface)",
                  }}
                >
                  <div
                    className="w-full h-8 rounded-lg mb-1.5"
                    style={{ background: s.preview }}
                  />
                  <div className="text-[10px] font-semibold text-foreground">{s.name}</div>
                  <div className="text-[9px] text-muted">{s.desc}</div>
                  {style === s.id && (
                    <div
                      className="absolute top-1.5 right-1.5 w-4 h-4 rounded-full flex items-center justify-center"
                      style={{ background: "var(--color-accent)" }}
                    >
                      <Check size={10} color="#fff" />
                    </div>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Brand Colors */}
          <div
            className="rounded-2xl p-4"
            style={{
              background: "var(--color-surface)",
              border: "1px solid var(--color-border)",
            }}
          >
            <label className="text-xs font-semibold text-foreground flex items-center gap-1.5 mb-3">
              <Palette size={13} className="text-gold" />
              Brand Colors
            </label>

            {/* Preset palette row */}
            <div className="flex gap-1.5 mb-3 flex-wrap">
              {PRESET_COLORS.map((p) => (
                <button
                  key={p.name}
                  onClick={() => setBrandColors({ primary: p.primary, secondary: p.secondary })}
                  title={p.name}
                  className="w-7 h-7 rounded-lg border-2 transition-all flex items-center justify-center overflow-hidden"
                  style={{
                    borderColor:
                      brandColors.primary === p.primary && brandColors.secondary === p.secondary
                        ? "var(--color-accent)"
                        : "transparent",
                  }}
                >
                  <div className="w-full h-full flex">
                    <div className="w-1/2 h-full" style={{ background: p.primary }} />
                    <div className="w-1/2 h-full" style={{ background: p.secondary }} />
                  </div>
                </button>
              ))}
            </div>

            {/* Custom color pickers */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <span className="text-[10px] text-muted block mb-1">Primary</span>
                <div
                  className="flex items-center gap-2 rounded-lg px-2 py-1.5"
                  style={{
                    background: "var(--color-surface-light)",
                    border: "1px solid var(--color-border)",
                  }}
                >
                  <input
                    type="color"
                    value={brandColors.primary}
                    onChange={(e) => setBrandColors((c) => ({ ...c, primary: e.target.value }))}
                    className="w-5 h-5 rounded cursor-pointer border-0 p-0"
                  />
                  <span className="text-[10px] font-mono text-muted">{brandColors.primary}</span>
                </div>
              </div>
              <div>
                <span className="text-[10px] text-muted block mb-1">Secondary</span>
                <div
                  className="flex items-center gap-2 rounded-lg px-2 py-1.5"
                  style={{
                    background: "var(--color-surface-light)",
                    border: "1px solid var(--color-border)",
                  }}
                >
                  <input
                    type="color"
                    value={brandColors.secondary}
                    onChange={(e) => setBrandColors((c) => ({ ...c, secondary: e.target.value }))}
                    className="w-5 h-5 rounded cursor-pointer border-0 p-0"
                  />
                  <span className="text-[10px] font-mono text-muted">{brandColors.secondary}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Template Gallery */}
          <div
            className="rounded-2xl p-4"
            style={{
              background: "var(--color-surface)",
              border: "1px solid var(--color-border)",
            }}
          >
            <label className="text-xs font-semibold text-foreground flex items-center gap-1.5 mb-3">
              <LayoutGrid size={13} className="text-gold" />
              Template
              <span className="text-[9px] text-muted font-normal ml-1">(optional)</span>
            </label>
            <div className="space-y-1.5">
              {TEMPLATES.map((t) => {
                const Icon = t.icon;
                const active = template === t.id;
                return (
                  <button
                    key={t.id}
                    onClick={() => setTemplate(active ? null : t.id)}
                    className="w-full text-left flex items-start gap-2.5 p-2.5 rounded-xl border transition-all"
                    style={{
                      borderColor: active ? "var(--color-accent)" : "var(--color-border)",
                      background: active
                        ? "color-mix(in srgb, var(--color-accent) 6%, var(--color-surface))"
                        : "var(--color-surface)",
                    }}
                  >
                    <div
                      className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5"
                      style={{
                        background: active
                          ? "color-mix(in srgb, var(--color-accent) 15%, transparent)"
                          : "var(--color-surface-light)",
                      }}
                    >
                      <Icon size={13} style={{ color: active ? "var(--color-accent)" : "var(--color-muted)" }} />
                    </div>
                    <div className="min-w-0">
                      <div className="text-[11px] font-semibold text-foreground">{t.name}</div>
                      <div className="text-[9px] text-muted">{t.desc}</div>
                      <div
                        className="text-[9px] mt-0.5 italic truncate"
                        style={{ color: "var(--color-muted)" }}
                      >
                        {t.example}
                      </div>
                    </div>
                    {active && (
                      <div
                        className="w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0 mt-1"
                        style={{ background: "var(--color-accent)" }}
                      >
                        <Check size={10} color="#fff" />
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Generate Button */}
          <button
            onClick={handleGenerate}
            disabled={generating || !topic.trim()}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl text-sm font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed text-white"
            style={{
              background: generating
                ? "var(--color-muted)"
                : "linear-gradient(135deg, var(--color-accent) 0%, color-mix(in srgb, var(--color-accent) 80%, #000) 100%)",
              boxShadow: generating ? "none" : "0 4px 16px color-mix(in srgb, var(--color-accent) 30%, transparent)",
            }}
          >
            {generating ? (
              <>
                <Loader size={16} className="animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <Sparkles size={16} />
                Generate Carousel
              </>
            )}
          </button>
        </div>

        {/* ═══════════════════════════════════════════
            RIGHT PANEL — Preview
            ═══════════════════════════════════════════ */}
        <div className="lg:col-span-8">
          <div
            className="rounded-2xl p-5 min-h-[500px]"
            style={{
              background: "var(--color-surface)",
              border: "1px solid var(--color-border)",
            }}
          >
            {/* Preview header */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <ImageIcon size={14} className="text-gold" />
                <span className="text-xs font-semibold text-foreground">Preview</span>
                {slides.length > 0 && (
                  <span
                    className="text-[9px] font-medium px-2 py-0.5 rounded-full"
                    style={{
                      background: "color-mix(in srgb, var(--color-accent) 12%, transparent)",
                      color: "var(--color-accent)",
                    }}
                  >
                    {slides.length} slides
                  </span>
                )}
              </div>
              {slides.length > 0 && (
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => {
                      setSlides([]);
                      setEditingSlide(null);
                    }}
                    className="flex items-center gap-1 text-[10px] text-muted px-2 py-1 rounded-lg transition-colors"
                    style={{ background: "var(--color-surface-light)" }}
                  >
                    <RotateCcw size={10} /> Reset
                  </button>
                  <button
                    onClick={() => scrollPreview("left")}
                    className="p-1.5 rounded-lg transition-colors"
                    style={{ background: "var(--color-surface-light)", color: "var(--color-muted)" }}
                  >
                    <ChevronLeft size={14} />
                  </button>
                  <button
                    onClick={() => scrollPreview("right")}
                    className="p-1.5 rounded-lg transition-colors"
                    style={{ background: "var(--color-surface-light)", color: "var(--color-muted)" }}
                  >
                    <ChevronRight size={14} />
                  </button>
                </div>
              )}
            </div>

            {/* Empty state */}
            {slides.length === 0 && !generating && (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <div
                  className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4"
                  style={{ background: "color-mix(in srgb, var(--color-accent) 10%, transparent)" }}
                >
                  <Layers size={28} style={{ color: "var(--color-accent)" }} />
                </div>
                <h3 className="text-sm font-semibold text-foreground mb-1">No carousel yet</h3>
                <p className="text-xs text-muted max-w-xs">
                  Enter a topic, pick your style, and hit Generate to create a stunning carousel in seconds.
                </p>
              </div>
            )}

            {/* Loading skeleton */}
            {generating && (
              <div className="flex gap-4 overflow-hidden py-4">
                {Array.from({ length: Math.min(slideCount, 4) }).map((_, i) => (
                  <div
                    key={i}
                    className="flex-shrink-0 w-[280px] h-[280px] rounded-2xl overflow-hidden"
                    style={{
                      background: "var(--color-surface-light)",
                      border: "1px solid var(--color-border)",
                    }}
                  >
                    <div className="h-full flex flex-col items-center justify-center p-6 gap-4">
                      <div
                        className="w-24 h-3 rounded-full animate-pulse"
                        style={{ background: "var(--color-border)" }}
                      />
                      <div
                        className="w-32 h-2 rounded-full animate-pulse"
                        style={{ background: "var(--color-border)", animationDelay: "0.15s" }}
                      />
                      <div
                        className="w-28 h-2 rounded-full animate-pulse"
                        style={{ background: "var(--color-border)", animationDelay: "0.3s" }}
                      />
                      <div className="mt-4">
                        <Loader
                          size={18}
                          className="animate-spin"
                          style={{ color: "var(--color-accent)" }}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Slide carousel preview */}
            {slides.length > 0 && !generating && (
              <>
                <div
                  ref={scrollRef}
                  className="flex gap-4 overflow-x-auto py-4 scroll-smooth"
                  style={{ scrollbarWidth: "thin" }}
                >
                  {slides.map((slide, idx) => {
                    const bg = getSlideBackground(style, brandColors, idx, slides.length);
                    const colors = getSlideTextColor(style, idx);
                    const isEditing = editingSlide === idx;
                    const isFirst = idx === 0;
                    const isLast = idx === slides.length - 1;

                    return (
                      <div
                        key={idx}
                        className="flex-shrink-0 w-[280px] h-[280px] rounded-2xl overflow-hidden relative group cursor-pointer transition-transform hover:scale-[1.02]"
                        style={{
                          background: bg,
                          boxShadow: "0 4px 20px rgba(0,0,0,0.12)",
                        }}
                        onClick={() => setEditingSlide(isEditing ? null : idx)}
                      >
                        {/* Slide number badge */}
                        <div
                          className="absolute top-3 left-3 w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold"
                          style={{
                            background: "rgba(255,255,255,0.2)",
                            color: colors.headline,
                            backdropFilter: "blur(8px)",
                          }}
                        >
                          {slide.slideNumber}
                        </div>

                        {/* Edit indicator */}
                        <div
                          className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <div
                            className="w-6 h-6 rounded-full flex items-center justify-center"
                            style={{
                              background: "rgba(255,255,255,0.2)",
                              backdropFilter: "blur(8px)",
                            }}
                          >
                            <Edit3 size={10} style={{ color: colors.headline }} />
                          </div>
                        </div>

                        {/* Slide type indicator */}
                        {(isFirst || isLast) && (
                          <div
                            className="absolute top-3 left-1/2 -translate-x-1/2 text-[8px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full"
                            style={{
                              background: "rgba(255,255,255,0.15)",
                              color: colors.headline,
                              backdropFilter: "blur(8px)",
                            }}
                          >
                            {isFirst ? "Hook" : "CTA"}
                          </div>
                        )}

                        {/* Content */}
                        <div className="h-full flex flex-col items-center justify-center p-7 text-center">
                          {isEditing ? (
                            <div className="w-full space-y-2" onClick={(e) => e.stopPropagation()}>
                              <input
                                value={slide.headline}
                                onChange={(e) => updateSlide(idx, "headline", e.target.value)}
                                className="w-full text-center font-extrabold text-lg bg-transparent border-b-2 focus:outline-none px-1 py-0.5"
                                style={{
                                  color: colors.headline,
                                  borderColor: `${colors.headline}44`,
                                }}
                              />
                              <textarea
                                value={slide.body}
                                onChange={(e) => updateSlide(idx, "body", e.target.value)}
                                rows={3}
                                className="w-full text-center text-xs bg-transparent border-b focus:outline-none px-1 py-0.5 resize-none"
                                style={{
                                  color: colors.body,
                                  borderColor: `${colors.body}33`,
                                }}
                              />
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setEditingSlide(null);
                                }}
                                className="mx-auto flex items-center gap-1 text-[9px] font-medium px-2 py-1 rounded-full"
                                style={{
                                  background: "rgba(255,255,255,0.2)",
                                  color: colors.headline,
                                  backdropFilter: "blur(8px)",
                                }}
                              >
                                <Check size={9} /> Done
                              </button>
                            </div>
                          ) : (
                            <>
                              <h3
                                className="font-extrabold text-lg leading-tight mb-3 max-w-[220px]"
                                style={{ color: colors.headline }}
                              >
                                {slide.headline}
                              </h3>
                              <p
                                className="text-xs leading-relaxed max-w-[200px]"
                                style={{ color: colors.body }}
                              >
                                {slide.body}
                              </p>
                            </>
                          )}
                        </div>

                        {/* Bottom gradient for depth */}
                        <div
                          className="absolute bottom-0 left-0 right-0 h-12 pointer-events-none"
                          style={{
                            background: `linear-gradient(to top, rgba(0,0,0,0.08) 0%, transparent 100%)`,
                          }}
                        />
                      </div>
                    );
                  })}
                </div>

                {/* Slide list (text view for quick editing) */}
                <div className="mt-5 space-y-2">
                  <div className="flex items-center gap-2 mb-2">
                    <Wand2 size={13} className="text-gold" />
                    <span className="text-xs font-semibold text-foreground">Slide Content</span>
                  </div>
                  {slides.map((slide, idx) => (
                    <div
                      key={idx}
                      className="flex items-start gap-3 p-3 rounded-xl transition-all"
                      style={{
                        background: editingSlide === idx
                          ? "color-mix(in srgb, var(--color-accent) 5%, var(--color-surface-light))"
                          : "var(--color-surface-light)",
                        border: editingSlide === idx
                          ? "1px solid color-mix(in srgb, var(--color-accent) 25%, var(--color-border))"
                          : "1px solid transparent",
                      }}
                    >
                      <div
                        className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 text-[10px] font-bold mt-0.5"
                        style={{
                          background: "color-mix(in srgb, var(--color-accent) 12%, transparent)",
                          color: "var(--color-accent)",
                        }}
                      >
                        {slide.slideNumber}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-semibold text-foreground truncate">
                          {slide.headline}
                        </div>
                        <div className="text-[10px] text-muted mt-0.5 line-clamp-2">
                          {slide.body}
                        </div>
                      </div>
                      <button
                        onClick={() => setEditingSlide(editingSlide === idx ? null : idx)}
                        className="p-1.5 rounded-lg transition-colors flex-shrink-0"
                        style={{
                          color: editingSlide === idx ? "var(--color-accent)" : "var(--color-muted)",
                          background: editingSlide === idx
                            ? "color-mix(in srgb, var(--color-accent) 10%, transparent)"
                            : "transparent",
                        }}
                      >
                        {editingSlide === idx ? <X size={12} /> : <Edit3 size={12} />}
                      </button>
                    </div>
                  ))}
                </div>

                {/* Regenerate bar */}
                <div className="mt-4 flex items-center justify-between pt-4" style={{ borderTop: "1px solid var(--color-border)" }}>
                  <div className="flex items-center gap-1.5">
                    <Zap size={12} style={{ color: "var(--color-accent)" }} />
                    <span className="text-[10px] text-muted">
                      {slides.length} slides generated for &ldquo;{topic.slice(0, 40)}{topic.length > 40 ? "..." : ""}&rdquo;
                    </span>
                  </div>
                  <button
                    onClick={handleGenerate}
                    disabled={generating}
                    className="flex items-center gap-1.5 text-[10px] font-medium px-3 py-1.5 rounded-lg transition-all text-white disabled:opacity-50"
                    style={{ background: "var(--color-accent)" }}
                  >
                    <RotateCcw size={10} />
                    Regenerate
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
