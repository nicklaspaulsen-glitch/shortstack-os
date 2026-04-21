"use client";

import { useState, useRef, useCallback } from "react";
import {
  Sparkles, Download, Copy, Check, Loader, ChevronLeft, ChevronRight,
  Palette, Type, Layers, Wand2, LayoutGrid, Zap, Edit3, RotateCcw,
  BookOpen, List, MessageCircle, Lightbulb, HelpCircle, X,
  Image as ImageIcon,
} from "lucide-react";
import toast from "react-hot-toast";
import PageHero from "@/components/ui/page-hero";
import CreationWizard, { type WizardStep } from "@/components/creation-wizard";
import { Wizard, AdvancedToggle, useAdvancedMode } from "@/components/ui/wizard";
import RollingPreview, { type RollingPreviewItem } from "@/components/RollingPreview";
import { trackGeneration } from "@/lib/track-generation";

// Real viral carousel-style thumbnails served from ytimg.com (public CDN).
// RollingPreview with fetchRemote + tool="carousel" replaces these with the
// curated library in `preview_content` at runtime; this list is the fallback.
const YT = (id: string) => `https://i.ytimg.com/vi/${id}/maxresdefault.jpg`;
// Verified-working YouTube IDs (stable on ytimg.com). Previous carousel IDs
// mostly 404'd. Using popular high-traffic videos that reliably serve
// maxresdefault.jpg.
const CAROUSEL_PREVIEW_FALLBACK: RollingPreviewItem[] = [
  { id: "cg1", src: YT("5MgBikgcWnY"), alt: "Business carousel", tag: "Business" },
  { id: "cg2", src: YT("YQHsXMglC9A"), alt: "Productivity carousel", tag: "Productivity" },
  { id: "cg3", src: YT("CevxZvSJLk8"), alt: "Fitness carousel", tag: "Fitness" },
  { id: "cg4", src: YT("hT_nvWreIhg"), alt: "Finance carousel", tag: "Finance" },
  { id: "cg5", src: YT("bHIhgxav9LY"), alt: "Education carousel", tag: "Education" },
  { id: "cg6", src: YT("kX3nB4PpJko"), alt: "Creator carousel", tag: "Business" },
  { id: "cg7", src: YT("dQw4w9WgXcQ"), alt: "Minimal carousel", tag: "Minimal" },
  { id: "cg8", src: YT("ulCdoCfw-bY"), alt: "Science carousel", tag: "Education" },
  { id: "cg9", src: YT("kJQP7kiw5Fk"), alt: "Documentary carousel", tag: "Documentary" },
  { id: "cg10", src: YT("OPf0YbXqDm0"), alt: "Tech carousel", tag: "Tech" },
  { id: "cg11", src: YT("9bZkp7q19f0"), alt: "Podcast carousel", tag: "Podcast" },
  { id: "cg12", src: YT("RgKAFK5djSk"), alt: "Fitness carousel", tag: "Fitness" },
];

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
   CAROUSEL WIZARD — 5-step guided creation flow
   ══════════════════════════════════════════════════════════════════ */

interface CarouselWizardProps {
  open: boolean;
  onClose: () => void;
  onComplete: (data: {
    topic: string;
    slideCount: number;
    style: CarouselStyle;
    contentDirection?: string;
  }) => Promise<void> | void;
}

function CarouselWizard({ open, onClose, onComplete }: CarouselWizardProps) {
  const steps: WizardStep[] = [
    {
      id: "platform",
      title: "Where is this carousel going?",
      description: "Pick the platform so we can tune tone and length.",
      icon: <LayoutGrid size={16} />,
      field: {
        type: "chip-select",
        key: "platform",
        options: [
          { value: "instagram", label: "Instagram", emoji: "📸" },
          { value: "linkedin", label: "LinkedIn", emoji: "💼" },
          { value: "facebook", label: "Facebook", emoji: "👥" },
          { value: "twitter", label: "Twitter (X)", emoji: "𝕏" },
        ],
      },
    },
    {
      id: "topic",
      title: "What's the topic or hook?",
      description: "Describe what this carousel is about — be specific to get better slides.",
      icon: <Lightbulb size={16} />,
      field: {
        type: "text",
        key: "topic",
        placeholder: 'e.g. "5 copywriting mistakes that kill conversions"',
      },
      aiHelper: {
        label: "Suggest a viral carousel topic",
        onClick: async (data) => {
          try {
            const platforms = Array.isArray(data.platform) ? (data.platform as string[]).join(", ") : "Instagram";
            const res = await fetch("/api/ai/enhance-prompt", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                text: `Suggest one viral, scroll-stopping carousel topic for ${platforms}. Return a single punchy topic idea (under 12 words) that a creator or marketer could use. No quotes, no explanation.`,
                type: "content",
              }),
            });
            if (!res.ok) {
              toast.error("Couldn't suggest a topic — try again");
              return {};
            }
            const json = await res.json();
            const suggestion: string = (json.enhanced || "").replace(/^["']|["']$/g, "").trim();
            if (!suggestion) {
              toast.error("No suggestion — give it another try");
              return {};
            }
            toast.success("Topic suggested!");
            return { topic: suggestion };
          } catch (err) {
            console.error(err);
            toast.error("Topic suggestion failed");
            return {};
          }
        },
      },
    },
    {
      id: "slideCount",
      title: "How many slides?",
      description: "3-10 slides. 5-7 is usually the sweet spot for engagement.",
      icon: <Layers size={16} />,
      field: {
        type: "number",
        key: "slideCount",
        min: 3,
        max: 10,
        step: 1,
      },
    },
    {
      id: "style",
      title: "Pick a visual style",
      description: "Sets the tone — we'll apply the look in the preview.",
      icon: <Palette size={16} />,
      field: {
        type: "chip-select",
        key: "style",
        options: [
          { value: "minimal", label: "Minimal", emoji: "⚪" },
          { value: "bold", label: "Bold", emoji: "💥" },
          { value: "corporate", label: "Corporate", emoji: "💼" },
          { value: "playful", label: "Playful", emoji: "🎈" },
          { value: "educational", label: "Educational", emoji: "📚" },
        ],
      },
    },
    {
      id: "contentDirection",
      title: "Any specific angle? (optional)",
      description: "Tell the AI what angle to take, who it's for, or what to emphasize.",
      icon: <MessageCircle size={16} />,
      field: {
        type: "textarea",
        key: "contentDirection",
        placeholder: "e.g. Target solo founders, use case studies, end with a strong CTA to DM for a template.",
        optional: true,
      },
      aiHelper: {
        label: "Auto-write slide content based on topic",
        onClick: async (data) => {
          try {
            const topic = String(data.topic || "").trim();
            if (!topic) {
              toast.error("Add a topic on step 2 first");
              return {};
            }
            const platforms = Array.isArray(data.platform) ? (data.platform as string[]).join(", ") : "Instagram";
            const style = Array.isArray(data.style) ? (data.style as string[])[0] : "bold";
            const count = Number(data.slideCount) || 5;
            const res = await fetch("/api/ai/enhance-prompt", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                text: `Outline a content direction for a ${count}-slide ${style} carousel on ${platforms} about: "${topic}". Keep it under 80 words. Describe angle, target audience, and what each slide section should cover. Plain text, no markdown, no numbered list — write it as a brief paragraph.`,
                type: "content",
              }),
            });
            if (!res.ok) {
              toast.error("Couldn't draft direction — try again");
              return {};
            }
            const json = await res.json();
            const direction: string = (json.enhanced || "").trim();
            if (!direction) {
              toast.error("No content direction returned");
              return {};
            }
            toast.success("Content direction drafted!");
            return { contentDirection: direction };
          } catch (err) {
            console.error(err);
            toast.error("Content direction failed");
            return {};
          }
        },
      },
    },
  ];

  async function handleComplete(data: Record<string, unknown>) {
    const platformArr = Array.isArray(data.platform) ? (data.platform as string[]) : [];
    const topic = String(data.topic || "").trim();
    const slideCount = Math.min(10, Math.max(3, Number(data.slideCount) || 5));
    const styleArr = Array.isArray(data.style) ? (data.style as string[]) : [];
    const rawStyle = styleArr[0] || "bold";
    const contentDirection = String(data.contentDirection || "").trim();

    if (!topic) {
      toast.error("Topic is required");
      return;
    }
    if (platformArr.length === 0) {
      toast.error("Pick at least one platform");
      return;
    }

    // Map wizard style values -> existing CarouselStyle union
    const styleMap: Record<string, CarouselStyle> = {
      minimal: "minimalist",
      bold: "bold",
      corporate: "corporate",
      playful: "playful",
      educational: "corporate",
    };
    const style: CarouselStyle = styleMap[rawStyle] || "bold";

    onClose();
    await onComplete({
      topic,
      slideCount,
      style,
      contentDirection: contentDirection || undefined,
    });
  }

  return (
    <CreationWizard
      open={open}
      title="Create Carousel"
      subtitle="AI-guided flow — describe what you want, we'll write the slides."
      icon={<Sparkles size={18} />}
      submitLabel="Generate Carousel"
      steps={steps}
      initialData={{ slideCount: 5 }}
      onClose={onClose}
      onComplete={handleComplete}
    />
  );
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

  // Wizard state
  const [wizardOpen, setWizardOpen] = useState(false);

  // Guided Mode ↔ Advanced Mode (full form + slide editor)
  const [advancedMode, setAdvancedMode] = useAdvancedMode("carousel-generator");
  const [guidedStep, setGuidedStep] = useState(0);

  // Preview scroll ref
  const scrollRef = useRef<HTMLDivElement>(null);

  /* ── Generate carousel (runs with explicit args, not state) ── */
  const runGenerate = useCallback(async (opts: {
    topic: string;
    slideCount: number;
    style: CarouselStyle;
    template?: string | null;
    brandColors: BrandColors;
    contentDirection?: string;
  }) => {
    if (!opts.topic.trim()) {
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
          topic: opts.contentDirection
            ? `${opts.topic}\n\nContent direction: ${opts.contentDirection}`
            : opts.topic,
          slideCount: opts.slideCount,
          style: opts.style,
          template: opts.template || undefined,
          brandColors: opts.brandColors,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.slides && data.slides.length > 0) {
          setSlides(data.slides);
          trackGeneration({
            category: "social_post",
            title: opts.topic.slice(0, 120),
            source_tool: "Carousel Generator",
            content_preview: (data.slides as Slide[])
              .map((s) => `${s.headline} — ${s.body}`)
              .join(" | ")
              .slice(0, 200),
            metadata: {
              style: opts.style,
              slideCount: data.slides.length,
              slides: data.slides,
              template: opts.template || undefined,
              brandColors: opts.brandColors,
            },
          });
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
    const mockSlides = generateMockSlides(opts.topic, opts.slideCount, opts.template || undefined);
    setSlides(mockSlides);
    trackGeneration({
      category: "social_post",
      title: opts.topic.slice(0, 120),
      source_tool: "Carousel Generator",
      content_preview: mockSlides
        .map((s) => `${s.headline} — ${s.body}`)
        .join(" | ")
        .slice(0, 200),
      metadata: {
        style: opts.style,
        slideCount: mockSlides.length,
        slides: mockSlides,
        template: opts.template || undefined,
        brandColors: opts.brandColors,
        mock: true,
      },
    });
    toast.success(`${mockSlides.length} slides generated!`);
    setGenerating(false);
  }, []);

  /* ── Generate using current form state (existing button) ── */
  const handleGenerate = useCallback(async () => {
    await runGenerate({ topic, slideCount, style, template, brandColors });
  }, [topic, slideCount, style, template, brandColors, runGenerate]);

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
      <CarouselWizard
        open={wizardOpen}
        onClose={() => setWizardOpen(false)}
        onComplete={async (data) => {
          setTopic(data.topic);
          setSlideCount(data.slideCount);
          setStyle(data.style);
          await runGenerate({
            topic: data.topic,
            slideCount: data.slideCount,
            style: data.style,
            template,
            brandColors,
            contentDirection: data.contentDirection,
          });
        }}
      />

      <PageHero
        className="mb-6"
        icon={<Layers size={28} />}
        title="Carousel Generator"
        subtitle="Create scroll-stopping Instagram & LinkedIn carousels."
        gradient="gold"
        actions={
          <div className="flex items-center gap-2">
            <AdvancedToggle value={advancedMode} onChange={setAdvancedMode} />
            {advancedMode && (
              <button
                onClick={() => setWizardOpen(true)}
                className="relative group flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gradient-to-r from-gold to-amber-500 text-black text-xs font-bold shadow-lg shadow-gold/20 hover:shadow-gold/40 hover-lift transition-all"
              >
                <Sparkles size={13} className="animate-pulse" />
                + New with AI
                <span className="ml-0.5 text-[8px] uppercase bg-black/20 px-1.5 py-0.5 rounded-full font-semibold tracking-wider">
                  Recommended
                </span>
              </button>
            )}
            {slides.length > 0 && (
              <>
                <button
                  onClick={handleCopyAll}
                  className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-white/20 bg-white/10 text-white hover:bg-white/20 transition-all"
                >
                  {copied ? <Check size={13} /> : <Copy size={13} />}
                  {copied ? "Copied!" : "Copy Text"}
                </button>
                <button
                  onClick={handleDownload}
                  className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg bg-white/15 border border-white/25 text-white hover:bg-white/25 transition-all"
                >
                  <Download size={13} />
                  Download All
                </button>
              </>
            )}
          </div>
        }
      />

      {/* Guided Mode — "4-year-old friendly" */}
      {!advancedMode && (
        <Wizard
          className="mb-6"
          steps={[
            {
              id: "topic",
              title: "What's your carousel about?",
              description: "One sentence — what's the post teaching, telling, or selling?",
              icon: <Sparkles size={18} />,
              canProceed: topic.trim().length > 0,
              component: (
                <div className="space-y-3">
                  <input
                    type="text"
                    value={topic}
                    onChange={e => setTopic(e.target.value)}
                    placeholder="e.g., 5 mistakes new founders make in their first year"
                    className="w-full px-4 py-3 rounded-xl bg-surface-light border border-border text-sm focus:outline-none focus:border-gold/50 focus:ring-2 focus:ring-gold/20 transition-all"
                    autoFocus
                  />
                  <div>
                    <p className="text-[10px] text-muted uppercase tracking-wider mb-1.5 font-semibold">Starter templates</p>
                    <div className="flex flex-wrap gap-1.5">
                      {TEMPLATES.slice(0, 5).map(t => (
                        <button
                          key={t.id}
                          onClick={() => { setTopic(t.example); setTemplate(t.id); }}
                          className="text-[10px] text-muted hover:text-foreground bg-surface-light hover:bg-gold/10 hover:border-gold/30 px-2.5 py-1 rounded-full border border-border/50 transition-all"
                        >
                          {t.name}: {t.example.slice(0, 30)}…
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              ),
            },
            {
              id: "style",
              title: "Pick a look",
              description: "The style sets the mood — elegant, bold, fun, premium.",
              icon: <Palette size={18} />,
              component: (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2.5">
                  {STYLES.map(s => {
                    const selected = style === s.id;
                    return (
                      <button
                        key={s.id}
                        onClick={() => setStyle(s.id)}
                        className={`text-left rounded-xl border overflow-hidden transition-all ${
                          selected ? "border-gold ring-2 ring-gold/30" : "border-border hover:border-gold/30"
                        }`}
                      >
                        <div className="h-16" style={{ background: s.preview }}>
                          <div className="h-full flex items-center justify-center">
                            <span className="text-xs font-bold" style={{ color: s.text }}>Aa</span>
                          </div>
                        </div>
                        <div className="p-2.5 bg-surface-light">
                          <p className="text-xs font-semibold">{s.name}</p>
                          <p className="text-[10px] text-muted">{s.desc}</p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              ),
            },
            {
              id: "slides",
              title: "How many slides?",
              description: "Most carousels do best at 6-8 slides. More than 10 loses people.",
              icon: <LayoutGrid size={18} />,
              component: (
                <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
                  {[4, 6, 8, 10, 12].map(n => (
                    <button
                      key={n}
                      onClick={() => setSlideCount(n)}
                      className={`p-4 rounded-xl border text-center transition-all ${
                        slideCount === n
                          ? "border-gold bg-gold/10 shadow-lg shadow-gold/10"
                          : "border-border hover:border-gold/30 bg-surface-light"
                      }`}
                    >
                      <p className="text-2xl font-bold">{n}</p>
                      <p className="text-[10px] text-muted">slides</p>
                    </button>
                  ))}
                </div>
              ),
            },
            {
              id: "review",
              title: "Ready to generate?",
              description: "We'll draft all your slides now. You can tweak individual cards in Advanced mode.",
              icon: <Wand2 size={18} />,
              component: (
                <div className="card bg-gold/[0.04] border-gold/20 space-y-2">
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <p className="text-[9px] uppercase tracking-wider text-muted">Style</p>
                      <p className="text-xs font-semibold capitalize">{style}</p>
                    </div>
                    <div>
                      <p className="text-[9px] uppercase tracking-wider text-muted">Slides</p>
                      <p className="text-xs font-semibold">{slideCount}</p>
                    </div>
                    <div>
                      <p className="text-[9px] uppercase tracking-wider text-muted">Template</p>
                      <p className="text-xs font-semibold">{TEMPLATES.find(t => t.id === template)?.name || "Custom"}</p>
                    </div>
                  </div>
                  <div className="pt-2 border-t border-border/50">
                    <p className="text-[9px] uppercase tracking-wider text-muted">Topic</p>
                    <p className="text-sm font-semibold">{topic || <span className="text-muted italic">(none)</span>}</p>
                  </div>
                </div>
              ),
            },
          ]}
          activeIdx={guidedStep}
          onStepChange={setGuidedStep}
          finishLabel={generating ? "Generating…" : "Generate slides"}
          busy={generating}
          onFinish={handleGenerate}
          onCancel={() => setAdvancedMode(true)}
          cancelLabel="Advanced mode"
        />
      )}

      {/* Slide preview in guided mode (after generation) */}
      {!advancedMode && slides.length > 0 && (
        <div className="card mb-6 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="section-header flex items-center gap-2">
              <LayoutGrid size={14} className="text-gold" /> Your carousel ({slides.length} slides)
            </h2>
            <button
              onClick={handleCopyAll}
              className="flex items-center gap-1.5 text-[11px] px-3 py-1.5 rounded-lg bg-gold/10 text-gold hover:bg-gold/20 transition-colors"
            >
              {copied ? <Check size={11} /> : <Copy size={11} />} {copied ? "Copied!" : "Copy text"}
            </button>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {slides.map(s => (
              <div key={s.slideNumber} className="rounded-xl border border-border bg-surface-light p-3 aspect-square flex flex-col">
                <span className="text-[9px] uppercase tracking-wider text-muted">Slide {s.slideNumber}</span>
                <p className="text-sm font-bold leading-tight mt-1 line-clamp-3">{s.headline}</p>
                <p className="text-[10px] text-muted line-clamp-4 mt-2">{s.body}</p>
              </div>
            ))}
          </div>
          <p className="text-[11px] text-muted text-center pt-2">
            Need to edit slides or change brand colors? Flip to <span className="text-gold font-semibold">Advanced mode</span>.
          </p>
        </div>
      )}

      {advancedMode && (
      <>
      {/* Rolling preview of example carousels — 1:1 Instagram-native aspect */}
      <div className="relative rounded-2xl overflow-hidden border border-border bg-surface-light/30 py-6 mb-5">
        <div className="absolute inset-0 pointer-events-none">
          <RollingPreview
            items={CAROUSEL_PREVIEW_FALLBACK}
            rows={2}
            aspectRatio="1:1"
            opacity={0.45}
            speed="medium"
            fetchRemote
            tool="carousel"
          />
        </div>
        <div className="relative text-center px-4">
          <p className="text-[11px] uppercase tracking-widest text-gold/80 font-semibold">
            Example carousel library
          </p>
          <h3 className="text-lg font-bold text-foreground mt-1">
            Scroll-stopping carousels in every niche
          </h3>
          <p className="text-xs text-muted max-w-md mx-auto mt-1">
            How-tos, listicles, myths-vs-facts — pick a template and we
            generate all slides, headlines, and body copy in one pass.
          </p>
        </div>
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
      </>
      )}
    </div>
  );
}
