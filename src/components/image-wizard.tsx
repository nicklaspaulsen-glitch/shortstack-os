"use client";

/**
 * Image Wizard
 * --------------------------------------------------------------------
 * Step-by-step "Guided Mode" for the AI image generator. Walks the user
 * through 10 questions, then asks Claude (Haiku) to expand their answers
 * into an optimized FLUX/SDXL prompt before kicking the actual job off
 * to RunPod via /api/images/create.
 *
 * Design intent:
 *   - "Claude writes the perfect prompt, FLUX generates" — we never
 *     pretend Claude itself produces images.
 *   - Drop-in: takes `open` + `onClose` + an optional onComplete callback
 *     so the host page (AI Studio) can react to a finished generation.
 *   - Carousel mode opens a different sub-flow that asks for N subjects
 *     after the shared style is locked in, then chains generations.
 */

import { useEffect, useMemo, useState } from "react";
import {
  Image as ImageIcon,
  Layers,
  Maximize2,
  Users,
  Type,
  Palette,
  Wand2,
  Sparkles,
  Download,
  RefreshCw,
  Settings2,
  X,
  Trash2,
  Plus,
  Edit3,
  CheckCircle2,
  Loader2,
} from "lucide-react";
import toast from "react-hot-toast";
import CreationWizard, { type WizardStep } from "@/components/creation-wizard";

/* ── Types ───────────────────────────────────────────────────────── */

interface BuildPromptResult {
  prompt: string;
  negative_prompt: string;
  recommended_model: "flux" | "sdxl";
  dimensions: { width: number; height: number };
  steps: number;
  guidance_scale: number;
  notes?: string;
}

interface GeneratedImage {
  id?: string;
  url: string;
  model: string;
  width: number;
  height: number;
  prompt: string;
  negative_prompt: string;
  wizard_answers: Record<string, unknown>;
}

export interface ImageWizardProps {
  open: boolean;
  onClose: () => void;
  onComplete?: (images: GeneratedImage[]) => void;
  initialAnswers?: Record<string, unknown>;
  clientId?: string | null;
}

/* ── Wizard step definitions ─────────────────────────────────────── */

const CREATION_TYPES = [
  { value: "pfp", label: "Profile Picture", description: "1024×1024 square avatar / brand mark", emoji: "🪪" },
  { value: "post", label: "Social Post", description: "1080×1080 — Instagram, LinkedIn, FB", emoji: "📱" },
  { value: "story", label: "Story / Reel Cover", description: "1080×1920 vertical — IG / TikTok", emoji: "📲" },
  { value: "ad", label: "Ad Creative", description: "1200×628 banner / story / feed", emoji: "📣" },
  { value: "carousel", label: "Carousel", description: "Multiple slides, shared style", emoji: "🗂️" },
  { value: "blog_hero", label: "Blog Hero", description: "1600×900 hero image", emoji: "📰" },
  { value: "yt_thumb", label: "YouTube Thumbnail", description: "1280×720 high-CTR design", emoji: "▶️" },
  { value: "mockup", label: "Product Mockup", description: "Phone, laptop, t-shirt etc.", emoji: "📦" },
  { value: "logo", label: "Logo / Mark", description: "Concept logo or icon", emoji: "🏆" },
  { value: "custom", label: "Custom Size", description: "Pick your own dimensions", emoji: "📐" },
];

const STYLE_VIBES = [
  { value: "photorealistic", label: "Photorealistic", preview: "bg-gradient-to-br from-stone-300 to-stone-600" },
  { value: "minimalist", label: "Minimalist", preview: "bg-gradient-to-br from-white to-zinc-200" },
  { value: "bold", label: "Bold & Graphic", preview: "bg-gradient-to-br from-red-500 to-yellow-400" },
  { value: "vintage", label: "Vintage / Retro", preview: "bg-gradient-to-br from-amber-700 to-orange-500" },
  { value: "anime", label: "Anime / Manga", preview: "bg-gradient-to-br from-pink-400 to-purple-500" },
  { value: "3d_render", label: "3D Render", preview: "bg-gradient-to-br from-cyan-400 to-blue-600" },
  { value: "watercolor", label: "Watercolor", preview: "bg-gradient-to-br from-sky-300 via-purple-300 to-pink-300" },
  { value: "cyberpunk", label: "Cyberpunk", preview: "bg-gradient-to-br from-fuchsia-600 to-cyan-400" },
  { value: "pastel", label: "Pastel / Soft", preview: "bg-gradient-to-br from-pink-200 to-blue-200" },
  { value: "cinematic", label: "Dark Cinematic", preview: "bg-gradient-to-br from-zinc-900 to-blue-900" },
  { value: "flat", label: "Flat Design", preview: "bg-gradient-to-br from-emerald-400 to-teal-500" },
  { value: "pixar", label: "Pixar Style", preview: "bg-gradient-to-br from-orange-400 to-red-400" },
];

const MOODS = [
  { value: "energetic", label: "Energetic", emoji: "⚡" },
  { value: "calm", label: "Calm", emoji: "🌿" },
  { value: "mysterious", label: "Mysterious", emoji: "🌙" },
  { value: "confident", label: "Confident", emoji: "💪" },
  { value: "playful", label: "Playful", emoji: "🎈" },
  { value: "professional", label: "Professional", emoji: "👔" },
  { value: "warm", label: "Warm", emoji: "🔥" },
  { value: "bold", label: "Bold", emoji: "💥" },
  { value: "minimalist", label: "Minimalist", emoji: "⚪" },
  { value: "luxurious", label: "Luxurious", emoji: "👑" },
];

const COMPOSITIONS = [
  { value: "centered", label: "Centered Subject", emoji: "🎯" },
  { value: "rule_of_thirds", label: "Rule of Thirds", emoji: "📐" },
  { value: "portrait", label: "Portrait / Face Focus", emoji: "🪞" },
  { value: "landscape", label: "Wide Landscape", emoji: "🏞️" },
  { value: "closeup", label: "Close-Up", emoji: "🔍" },
  { value: "flatlay", label: "Top-Down Flat Lay", emoji: "📷" },
  { value: "dynamic", label: "Dynamic / Diagonal", emoji: "↗️" },
];

const PALETTES = [
  { value: "brand", label: "Brand Colors", description: "Uses your brand kit", emoji: "🎨" },
  { value: "warm", label: "Warm", description: "Reds, oranges, yellows", preview: "bg-gradient-to-br from-red-500 to-yellow-400" },
  { value: "cool", label: "Cool", description: "Blues, greens", preview: "bg-gradient-to-br from-cyan-500 to-emerald-500" },
  { value: "bw", label: "Black & White", description: "Monochrome", preview: "bg-gradient-to-br from-black to-white" },
  { value: "pastel", label: "Pastel", description: "Soft & dreamy", preview: "bg-gradient-to-br from-pink-200 to-purple-200" },
  { value: "neon", label: "Neon", description: "Electric glow", preview: "bg-gradient-to-br from-fuchsia-500 to-cyan-400" },
  { value: "earth", label: "Earth Tones", description: "Natural & muted", preview: "bg-gradient-to-br from-amber-700 to-stone-500" },
  { value: "custom", label: "Custom", description: "Pick a hex color", emoji: "🎯" },
];

const EXTRAS = [
  { value: "logo_watermark", label: "Add logo watermark", emoji: "🏷️" },
  { value: "remove_bg", label: "Remove background", emoji: "✂️" },
  { value: "upscale", label: "Upscale to 4K", emoji: "🔍" },
  { value: "variants_4", label: "Generate 4 variants", emoji: "🎲" },
  { value: "face_enhance", label: "Face enhance", emoji: "🪞" },
];

/* ── Helpers ─────────────────────────────────────────────────────── */

function dimensionsFor(answers: Record<string, unknown>): { width: number; height: number } {
  const t = answers.creation_type as string | undefined;
  const map: Record<string, { width: number; height: number }> = {
    pfp: { width: 1024, height: 1024 },
    post: { width: 1080, height: 1080 },
    story: { width: 1080, height: 1920 },
    ad: { width: 1200, height: 628 },
    carousel: { width: 1080, height: 1080 },
    blog_hero: { width: 1600, height: 900 },
    yt_thumb: { width: 1280, height: 720 },
    mockup: { width: 1200, height: 1200 },
    logo: { width: 1024, height: 1024 },
  };
  if (t === "custom") {
    return {
      width: (answers.custom_width as number) || 1024,
      height: (answers.custom_height as number) || 1024,
    };
  }
  return map[t || "post"] || map.post;
}

/* ── Main Component ──────────────────────────────────────────────── */

export default function ImageWizard({
  open,
  onClose,
  onComplete,
  initialAnswers,
  clientId,
}: ImageWizardProps) {
  // Phase state — wizard -> review -> generating -> result
  const [phase, setPhase] = useState<"wizard" | "review" | "generating" | "result">("wizard");
  const [answers, setAnswers] = useState<Record<string, unknown>>(initialAnswers || {});
  const [build, setBuild] = useState<BuildPromptResult | null>(null);
  const [editedPrompt, setEditedPrompt] = useState("");
  const [editedNegative, setEditedNegative] = useState("");
  const [isBuilding, setIsBuilding] = useState(false);
  // Track generating purely so future "Cancel" UX can read it without restructuring callbacks
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [_isGenerating, setIsGenerating] = useState(false);
  const [results, setResults] = useState<GeneratedImage[]>([]);

  // Carousel sub-flow state
  const [carouselSubjects, setCarouselSubjects] = useState<string[]>([""]);

  useEffect(() => {
    if (!open) {
      // Reset on close
      setPhase("wizard");
      setBuild(null);
      setResults([]);
      setIsBuilding(false);
      setIsGenerating(false);
      setCarouselSubjects([""]);
    }
  }, [open]);

  /* ── Build wizard step list ───────────────────────────────────── */
  const steps: WizardStep[] = useMemo(
    () => [
      {
        id: "creation_type",
        title: "What are you creating?",
        description: "Pick the format — we'll set sensible dimensions for you.",
        icon: <ImageIcon size={16} />,
        field: { type: "choice-cards", key: "creation_type", options: CREATION_TYPES },
      },
      {
        id: "audience",
        title: "Who is this for?",
        description: "Business type, niche, or target audience. Helps Claude tune the visual.",
        icon: <Users size={16} />,
        field: {
          type: "text",
          key: "audience",
          placeholder: 'e.g. "luxury fitness coaches" or "B2B SaaS founders"',
          optional: true,
        },
      },
      {
        id: "subject",
        title: "Main subject",
        description: "Describe the main element of the image in your own words.",
        icon: <Edit3 size={16} />,
        field: {
          type: "textarea",
          key: "subject",
          placeholder:
            'e.g. "a young female entrepreneur holding a laptop in a sunlit modern office" or "a sleek red sports car parked under neon signs at night"',
        },
      },
      {
        id: "style",
        title: "Style vibe",
        description: "Pick the visual aesthetic.",
        icon: <Palette size={16} />,
        field: { type: "choice-cards", key: "style", options: STYLE_VIBES },
      },
      {
        id: "mood",
        title: "Mood & emotion",
        description: "How should it feel? Pick one or more.",
        icon: <Sparkles size={16} />,
        field: { type: "chip-select", key: "mood", options: MOODS },
      },
      {
        id: "composition",
        title: "Composition",
        description: "Where should the subject sit in the frame?",
        icon: <Maximize2 size={16} />,
        field: { type: "choice-cards", key: "composition", options: COMPOSITIONS, optional: true },
      },
      {
        id: "palette",
        title: "Colors & palette",
        description: "Pick a color direction.",
        icon: <Palette size={16} />,
        field: { type: "choice-cards", key: "palette", options: PALETTES, optional: true },
      },
      {
        id: "text_overlay",
        title: "Text overlay?",
        description: "If yes, we'll leave clean space and Claude will mention text in the prompt.",
        icon: <Type size={16} />,
        field: { type: "toggle", key: "text_overlay_enabled", optional: true },
      },
      {
        id: "extras",
        title: "Extras",
        description: "Optional finishing touches.",
        icon: <Settings2 size={16} />,
        field: { type: "chip-select", key: "extras", options: EXTRAS, optional: true },
      },
      {
        id: "review_step",
        title: "Review & build prompt",
        description: "Claude (Haiku) will turn your answers into an optimized FLUX prompt next.",
        icon: <Wand2 size={16} />,
        field: {
          type: "textarea",
          key: "extra_notes",
          placeholder: "Any extra details or things to avoid? (optional)",
          optional: true,
        },
      },
    ],
    [],
  );

  /* ── Wizard finished -> ask Claude to build the prompt ────────── */
  async function handleWizardComplete(data: Record<string, unknown>) {
    setAnswers(data);

    // Carousel branches into the multi-subject sub-flow before we ever build a prompt
    if (data.creation_type === "carousel") {
      setPhase("review");
      setBuild(null); // we'll build per-slide
      setEditedPrompt("");
      setEditedNegative("");
      return;
    }

    setIsBuilding(true);
    try {
      const res = await fetch("/api/images/build-prompt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const built = (await res.json()) as BuildPromptResult & { error?: string };
      if (built.error || !built.prompt) {
        toast.error(built.error || "Failed to build prompt");
        setIsBuilding(false);
        return;
      }
      setBuild(built);
      setEditedPrompt(built.prompt);
      setEditedNegative(built.negative_prompt);
      setPhase("review");
    } catch (err) {
      console.error(err);
      toast.error("Failed to build prompt — check your connection");
    } finally {
      setIsBuilding(false);
    }
  }

  /* ── Generate (single image path) ─────────────────────────────── */
  async function handleGenerate() {
    if (!editedPrompt.trim()) return toast.error("Prompt is empty");
    setPhase("generating");
    setIsGenerating(true);
    setResults([]);

    const dims = build?.dimensions || dimensionsFor(answers);
    const variantCount = (answers.extras as string[] | undefined)?.includes("variants_4") ? 4 : 1;

    try {
      const reqs = Array.from({ length: variantCount }).map(() =>
        fetch("/api/images/create", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            prompt: editedPrompt,
            negative_prompt: editedNegative,
            width: dims.width,
            height: dims.height,
            model: build?.recommended_model || "flux",
            steps: build?.steps,
            guidance_scale: build?.guidance_scale,
            wizard_answers: answers,
            client_id: clientId || undefined,
          }),
        }).then(r => r.json()),
      );

      const responses = await Promise.all(reqs);
      const imgs: GeneratedImage[] = [];
      for (const r of responses) {
        if (r.image?.url) {
          imgs.push({
            id: r.image.id,
            url: r.image.url,
            model: r.image.model,
            width: r.image.width,
            height: r.image.height,
            prompt: editedPrompt,
            negative_prompt: editedNegative,
            wizard_answers: answers,
          });
        }
      }

      if (imgs.length === 0) {
        const first = responses[0];
        if (first?.error === "setup_required") {
          toast.error("No image provider configured. Set RUNPOD_FLUX_URL, REPLICATE_API_TOKEN, or OPENAI_API_KEY.");
        } else if (first?.error) {
          toast.error(first.error);
        } else {
          toast.error("Generation timed out — try again");
        }
        setPhase("review");
        setIsGenerating(false);
        return;
      }

      setResults(imgs);
      setPhase("result");
      onComplete?.(imgs);
      toast.success(`${imgs.length} image${imgs.length > 1 ? "s" : ""} ready`);
    } catch (err) {
      console.error(err);
      toast.error("Generation failed");
      setPhase("review");
    } finally {
      setIsGenerating(false);
    }
  }

  /* ── Generate (carousel — N subjects, shared style) ──────────── */
  async function handleGenerateCarousel() {
    const subjects = carouselSubjects.map(s => s.trim()).filter(Boolean);
    if (subjects.length === 0) return toast.error("Add at least one slide subject");

    setPhase("generating");
    setIsGenerating(true);
    setResults([]);

    const dims = dimensionsFor(answers);

    try {
      const imgs: GeneratedImage[] = [];
      // Build a per-slide prompt sequentially so all slides share the same style intent
      for (const subject of subjects) {
        const slideAnswers = { ...answers, subject };
        const buildRes = await fetch("/api/images/build-prompt", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(slideAnswers),
        });
        const built = (await buildRes.json()) as BuildPromptResult;
        if (!built.prompt) continue;

        const genRes = await fetch("/api/images/create", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            prompt: built.prompt,
            negative_prompt: built.negative_prompt,
            width: dims.width,
            height: dims.height,
            model: built.recommended_model,
            steps: built.steps,
            guidance_scale: built.guidance_scale,
            wizard_answers: slideAnswers,
            client_id: clientId || undefined,
          }),
        });
        const r = await genRes.json();
        if (r.image?.url) {
          imgs.push({
            id: r.image.id,
            url: r.image.url,
            model: r.image.model,
            width: r.image.width,
            height: r.image.height,
            prompt: built.prompt,
            negative_prompt: built.negative_prompt,
            wizard_answers: slideAnswers,
          });
          setResults([...imgs]); // progressive update
        }
      }

      if (imgs.length === 0) {
        toast.error("Carousel generation failed");
        setPhase("review");
        setIsGenerating(false);
        return;
      }

      setPhase("result");
      onComplete?.(imgs);
      toast.success(`${imgs.length}-slide carousel ready`);
    } catch (err) {
      console.error(err);
      toast.error("Generation failed");
      setPhase("review");
    } finally {
      setIsGenerating(false);
    }
  }

  /* ── Regenerate one carousel slide ───────────────────────────── */
  async function regenerateSlide(index: number) {
    const subject = carouselSubjects[index]?.trim();
    if (!subject) return;
    const slideAnswers = { ...answers, subject };
    toast.loading(`Regenerating slide ${index + 1}…`, { id: `regen-${index}` });
    try {
      const buildRes = await fetch("/api/images/build-prompt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(slideAnswers),
      });
      const built = (await buildRes.json()) as BuildPromptResult;
      if (!built.prompt) throw new Error("No prompt");

      const dims = dimensionsFor(answers);
      const genRes = await fetch("/api/images/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: built.prompt,
          negative_prompt: built.negative_prompt,
          width: dims.width,
          height: dims.height,
          model: built.recommended_model,
          wizard_answers: slideAnswers,
          client_id: clientId || undefined,
        }),
      });
      const r = await genRes.json();
      if (r.image?.url) {
        setResults(prev => {
          const next = [...prev];
          next[index] = {
            id: r.image.id,
            url: r.image.url,
            model: r.image.model,
            width: r.image.width,
            height: r.image.height,
            prompt: built.prompt,
            negative_prompt: built.negative_prompt,
            wizard_answers: slideAnswers,
          };
          return next;
        });
        toast.success(`Slide ${index + 1} updated`, { id: `regen-${index}` });
      } else {
        toast.error("Regenerate failed", { id: `regen-${index}` });
      }
    } catch {
      toast.error("Regenerate failed", { id: `regen-${index}` });
    }
  }

  if (!open) return null;

  /* ── Render: wizard phase reuses CreationWizard ─────────────── */
  if (phase === "wizard") {
    return (
      <CreationWizard
        open={open}
        title="Image Generator — Guided Mode"
        subtitle="Claude writes the perfect prompt. FLUX generates the image."
        icon={<Wand2 size={18} />}
        submitLabel={isBuilding ? "Building prompt…" : "Build prompt with Claude"}
        steps={steps}
        initialData={initialAnswers}
        onClose={onClose}
        onComplete={handleWizardComplete}
      />
    );
  }

  /* ── Render: review phase (review prompt or set up carousel) ── */
  if (phase === "review") {
    const isCarousel = answers.creation_type === "carousel";
    return (
      <ReviewModal
        title={isCarousel ? "Carousel — Add slide subjects" : "Review your AI-built prompt"}
        onClose={onClose}
        onBack={() => setPhase("wizard")}
      >
        {isCarousel ? (
          <CarouselSetup
            subjects={carouselSubjects}
            setSubjects={setCarouselSubjects}
            answers={answers}
            onGenerate={handleGenerateCarousel}
          />
        ) : (
          <PromptReview
            build={build}
            prompt={editedPrompt}
            setPrompt={setEditedPrompt}
            negative={editedNegative}
            setNegative={setEditedNegative}
            dimensions={build?.dimensions || dimensionsFor(answers)}
            onGenerate={handleGenerate}
          />
        )}
      </ReviewModal>
    );
  }

  /* ── Render: generating loader ────────────────────────────── */
  if (phase === "generating") {
    const isCarousel = answers.creation_type === "carousel";
    const total = isCarousel ? carouselSubjects.filter(s => s.trim()).length : 1;
    return (
      <FullModal onClose={onClose}>
        <div className="flex flex-col items-center justify-center py-16 px-6">
          <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-gold/20 to-amber-500/10 flex items-center justify-center mb-4">
            <Loader2 size={32} className="text-gold animate-spin" />
          </div>
          <h2 className="text-base font-semibold text-foreground mb-1.5">Generating with FLUX on RunPod</h2>
          <p className="text-xs text-muted text-center max-w-md">
            {isCarousel
              ? `Building ${total}-slide carousel — each slide shares your style. ${results.length}/${total} done.`
              : "FLUX is rendering your image. This usually takes 8–25 seconds."}
          </p>
          {isCarousel && results.length > 0 && (
            <div className="mt-6 grid grid-cols-3 gap-2 max-w-md">
              {results.map((img, i) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img key={i} src={img.url} alt="" className="w-full aspect-square object-cover rounded-lg" />
              ))}
            </div>
          )}
        </div>
      </FullModal>
    );
  }

  /* ── Render: result ──────────────────────────────────────── */
  return (
    <FullModal onClose={onClose}>
      <ResultPanel
        results={results}
        isCarousel={answers.creation_type === "carousel"}
        creationType={answers.creation_type as string}
        onRegenerateOne={regenerateSlide}
        onRemove={(i) => setResults(prev => prev.filter((_, j) => j !== i))}
        onTweak={() => {
          setPhase("wizard");
        }}
        onRegenerateAll={() => {
          if (answers.creation_type === "carousel") handleGenerateCarousel();
          else handleGenerate();
        }}
        onClose={onClose}
      />
    </FullModal>
  );
}

/* ── Helper: full-modal shell ─────────────────────────────────── */

function FullModal({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-50 bg-black/75 backdrop-blur-md flex items-center justify-center p-3 fade-in"
      onClick={onClose}
    >
      <div
        className="bg-surface border border-border rounded-2xl shadow-2xl w-full max-w-5xl max-h-[92vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}

/* ── Helper: review-phase modal shell ──────────────────────── */

function ReviewModal({
  title,
  children,
  onClose,
  onBack,
}: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
  onBack: () => void;
}) {
  return (
    <FullModal onClose={onClose}>
      <div className="px-6 py-4 border-b border-border flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-gold/15 flex items-center justify-center text-gold">
          <Wand2 size={18} />
        </div>
        <div className="flex-1 min-w-0">
          <h2 className="text-sm font-semibold text-foreground">{title}</h2>
          <p className="text-[11px] text-muted">Edit anything you want before we send it to FLUX.</p>
        </div>
        <button onClick={onBack} className="text-xs text-muted hover:text-foreground px-2 py-1">
          Back to wizard
        </button>
        <button onClick={onClose} className="p-2 rounded-lg hover:bg-surface-light text-muted hover:text-foreground">
          <X size={14} />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto p-6">{children}</div>
    </FullModal>
  );
}

/* ── Review: prompt editor ──────────────────────────────────── */

function PromptReview({
  build,
  prompt,
  setPrompt,
  negative,
  setNegative,
  dimensions,
  onGenerate,
}: {
  build: BuildPromptResult | null;
  prompt: string;
  setPrompt: (v: string) => void;
  negative: string;
  setNegative: (v: string) => void;
  dimensions: { width: number; height: number };
  onGenerate: () => void;
}) {
  return (
    <div className="max-w-2xl mx-auto space-y-5">
      <div className="flex items-center gap-3 text-[11px]">
        <span className="px-2 py-1 rounded-full bg-gold/15 text-gold border border-gold/30 font-semibold uppercase tracking-wider">
          {build?.recommended_model || "flux"}
        </span>
        <span className="text-muted">
          {dimensions.width} × {dimensions.height}
        </span>
        {build?.steps != null && (
          <span className="text-muted">{build.steps} steps</span>
        )}
        {build?.guidance_scale != null && (
          <span className="text-muted">guidance {build.guidance_scale}</span>
        )}
      </div>

      <div>
        <label className="text-[11px] font-semibold text-foreground uppercase tracking-wider flex items-center gap-1.5 mb-2">
          <Wand2 size={11} className="text-gold" /> AI-built prompt
        </label>
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          rows={5}
          className="w-full px-4 py-3 rounded-xl bg-surface-light border border-border text-sm focus:outline-none focus:border-gold/50 focus:ring-2 focus:ring-gold/20 resize-none font-mono"
        />
        <p className="text-[10px] text-muted mt-1.5">
          Edit freely — this is the exact text we send to FLUX.
        </p>
      </div>

      <div>
        <label className="text-[11px] font-semibold text-foreground uppercase tracking-wider mb-2 block">
          Negative prompt
        </label>
        <textarea
          value={negative}
          onChange={(e) => setNegative(e.target.value)}
          rows={2}
          className="w-full px-4 py-3 rounded-xl bg-surface-light border border-border text-xs focus:outline-none focus:border-gold/50 focus:ring-2 focus:ring-gold/20 resize-none font-mono"
        />
      </div>

      {build?.notes && (
        <div className="text-[11px] text-muted italic border-l-2 border-gold/30 pl-3">{build.notes}</div>
      )}

      <button
        onClick={onGenerate}
        className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-gradient-to-r from-gold to-amber-500 text-black text-sm font-semibold hover:shadow-lg hover:shadow-gold/30 transition-all"
      >
        <Sparkles size={14} /> Generate with FLUX
      </button>
    </div>
  );
}

/* ── Carousel sub-flow setup ────────────────────────────────── */

function CarouselSetup({
  subjects,
  setSubjects,
  answers,
  onGenerate,
}: {
  subjects: string[];
  setSubjects: (s: string[]) => void;
  answers: Record<string, unknown>;
  onGenerate: () => void;
}) {
  const style = answers.style as string | undefined;
  const palette = answers.palette as string | undefined;
  return (
    <div className="max-w-2xl mx-auto space-y-5">
      <div className="bg-gold/[0.04] border border-gold/20 rounded-xl p-4">
        <div className="flex items-center gap-2 mb-1.5">
          <Layers size={14} className="text-gold" />
          <h3 className="text-xs font-semibold text-foreground">Shared style locked in</h3>
        </div>
        <p className="text-[11px] text-muted">
          Style: <span className="text-foreground font-medium">{style || "—"}</span> · Palette:{" "}
          <span className="text-foreground font-medium">{palette || "—"}</span> · Mood:{" "}
          <span className="text-foreground font-medium">
            {Array.isArray(answers.mood) ? (answers.mood as string[]).join(", ") : "—"}
          </span>
        </p>
        <p className="text-[10px] text-muted mt-2">
          Each slide will share these visuals. Just describe what each slide should depict below.
        </p>
      </div>

      <div className="space-y-2">
        {subjects.map((s, i) => (
          <div key={i} className="flex gap-2 items-start">
            <span className="w-6 h-6 rounded-full bg-gold/15 text-gold text-[10px] font-bold flex items-center justify-center mt-2.5 shrink-0">
              {i + 1}
            </span>
            <textarea
              value={s}
              onChange={(e) => {
                const next = [...subjects];
                next[i] = e.target.value;
                setSubjects(next);
              }}
              placeholder={`Slide ${i + 1} subject — e.g. "intro slide with bold hook" or "data chart with insight"`}
              rows={2}
              className="flex-1 px-3 py-2 rounded-lg bg-surface-light border border-border text-sm focus:outline-none focus:border-gold/50 resize-none"
            />
            {subjects.length > 1 && (
              <button
                onClick={() => setSubjects(subjects.filter((_, j) => j !== i))}
                className="p-2 text-muted hover:text-red-400 mt-1.5"
              >
                <Trash2 size={14} />
              </button>
            )}
          </div>
        ))}
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={() => setSubjects([...subjects, ""])}
          disabled={subjects.length >= 10}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-gold hover:bg-gold/10 disabled:opacity-40"
        >
          <Plus size={12} /> Add slide ({subjects.length}/10)
        </button>
      </div>

      <button
        onClick={onGenerate}
        disabled={subjects.filter(s => s.trim()).length === 0}
        className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-gradient-to-r from-gold to-amber-500 text-black text-sm font-semibold hover:shadow-lg hover:shadow-gold/30 transition-all disabled:opacity-40"
      >
        <Sparkles size={14} /> Generate {subjects.filter(s => s.trim()).length} slide
        {subjects.filter(s => s.trim()).length === 1 ? "" : "s"}
      </button>
    </div>
  );
}

/* ── Result panel ───────────────────────────────────────────── */

function ResultPanel({
  results,
  isCarousel,
  creationType,
  onRegenerateOne,
  onRemove,
  onTweak,
  onRegenerateAll,
  onClose,
}: {
  results: GeneratedImage[];
  isCarousel: boolean;
  creationType?: string;
  onRegenerateOne: (i: number) => void;
  onRemove: (i: number) => void;
  onTweak: () => void;
  onRegenerateAll: () => void;
  onClose: () => void;
}) {
  const isPfp = creationType === "pfp";
  return (
    <div className="flex flex-col h-full">
      <div className="px-6 py-4 border-b border-border flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-emerald-500/15 flex items-center justify-center text-emerald-400">
          <CheckCircle2 size={18} />
        </div>
        <div className="flex-1 min-w-0">
          <h2 className="text-sm font-semibold text-foreground">
            {isCarousel ? `${results.length}-slide carousel ready` : "Image ready"}
          </h2>
          <p className="text-[11px] text-muted">Download, regenerate, tweak, or save to library.</p>
        </div>
        <button onClick={onClose} className="p-2 rounded-lg hover:bg-surface-light text-muted hover:text-foreground">
          <X size={14} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        <div className={`grid gap-4 ${isCarousel ? "grid-cols-2 md:grid-cols-3" : "grid-cols-1 md:grid-cols-2"}`}>
          {results.map((img, i) => (
            <div key={i} className="bg-surface-light border border-border rounded-xl overflow-hidden">
              <div className="relative bg-black flex items-center justify-center">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={img.url}
                  alt={`Generated ${i + 1}`}
                  className={`w-full ${isPfp ? "aspect-square object-cover rounded-full m-4" : ""}`}
                  style={!isPfp ? { aspectRatio: `${img.width} / ${img.height}` } : undefined}
                />
                {isCarousel && (
                  <span className="absolute top-2 left-2 w-6 h-6 rounded-full bg-black/70 text-white text-[10px] font-bold flex items-center justify-center">
                    {i + 1}
                  </span>
                )}
              </div>
              <div className="p-2.5 flex items-center gap-1">
                <a
                  href={img.url}
                  download={`generated-${i + 1}.png`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 px-2 py-1.5 rounded-lg text-[10px] text-foreground hover:bg-surface"
                >
                  <Download size={11} /> Download
                </a>
                {isCarousel && (
                  <button
                    onClick={() => onRegenerateOne(i)}
                    className="flex items-center gap-1 px-2 py-1.5 rounded-lg text-[10px] text-foreground hover:bg-surface"
                  >
                    <RefreshCw size={11} /> Regen
                  </button>
                )}
                {isCarousel && results.length > 1 && (
                  <button
                    onClick={() => onRemove(i)}
                    className="flex items-center gap-1 px-2 py-1.5 rounded-lg text-[10px] text-red-400 hover:bg-red-500/10 ml-auto"
                  >
                    <Trash2 size={11} />
                  </button>
                )}
                <span className="ml-auto text-[9px] text-muted font-mono">
                  {img.width}×{img.height}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="px-6 py-3 border-t border-border bg-surface-light/30 flex items-center gap-2">
        <button
          onClick={onTweak}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs text-foreground hover:bg-surface-light"
        >
          <Edit3 size={12} /> Tweak answers
        </button>
        <button
          onClick={onRegenerateAll}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs text-foreground hover:bg-surface-light"
        >
          <RefreshCw size={12} /> Regenerate
        </button>
        <div className="flex-1" />
        <button
          onClick={onClose}
          className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-gradient-to-r from-gold to-amber-500 text-black text-xs font-semibold hover:shadow-lg hover:shadow-gold/30"
        >
          <CheckCircle2 size={12} /> Done
        </button>
      </div>
    </div>
  );
}
