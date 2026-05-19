"use client";

/**
 * AiFirstStarter — Pikzel-AI-style entry flow for the thumbnail editor.
 *
 * User backlog (apr27): "current opens straight into Photoshop/Photopea-style
 * canvas. That assumes the user already knows what they want. Should be
 * AI-first. User describes what they want → AI generates → ONLY THEN does
 * the editor surface for refinement."
 *
 * MVP: when the canvas is empty (no layers), this overlay covers the editor
 * with a single hero prompt textarea. User types intent + clicks "Generate
 * 4 thumbnails", we call /api/ai-studio/image-gen four times in parallel,
 * show the 4 options as picker tiles. User clicks one → the chosen image
 * becomes an image layer on the canvas → overlay dismisses → editor takes
 * over for refinement.
 *
 * User can also "Skip — start with a blank canvas" if they want the
 * traditional Photopea behaviour.
 */

import { useState } from "react";
import {
  Sparkles,
  Loader,
  ArrowRight,
  X,
  ImageIcon,
} from "lucide-react";
import toast from "react-hot-toast";

interface Props {
  /** Triggered when user picks one of the 4 AI options. The data URL of the
   *  chosen image is provided. */
  onPickThumbnail: (imageDataUrl: string) => void;
  /** Skip → keep blank canvas, dismiss overlay. */
  onSkip: () => void;
  /** Suggested aspect (defaults to YouTube 1280x720). */
  width?: number;
  height?: number;
}

interface ThumbnailTemplate {
  id: string;
  label: string;
  aspect: "16:9" | "9:16" | "1:1";
  emoji: string;
  /** Tailwind gradient applied to the card swatch */
  gradient: string;
  /** Text color on the swatch (must contrast with gradient) */
  textColor: string;
  prompt: string;
}

const THUMBNAIL_TEMPLATES: ThumbnailTemplate[] = [
  {
    id: "yt-drama",
    label: "YouTube Drama",
    aspect: "16:9",
    emoji: "😱",
    gradient: "from-red-700 to-orange-500",
    textColor: "#fff",
    prompt: "Bold YouTube thumbnail. Close-up shocked face, huge impactful bold red text, arrow pointing right, dark dramatic background with orange lighting.",
  },
  {
    id: "tiktok-challenge",
    label: "TikTok Challenge",
    aspect: "9:16",
    emoji: "🕺",
    gradient: "from-fuchsia-600 to-pink-400",
    textColor: "#fff",
    prompt: "Vertical TikTok thumbnail. Energetic pose mid-dance, neon pink and purple gradient background, bold lowercase sans-serif headline at top, confetti particles.",
  },
  {
    id: "podcast-cover",
    label: "Podcast Cover",
    aspect: "1:1",
    emoji: "🎙️",
    gradient: "from-slate-800 to-indigo-900",
    textColor: "#c8a855",
    prompt: "Square podcast cover art. Professional headshot on right, bold show name in serif font on left, deep navy background, subtle microphone graphic, clean minimal layout.",
  },
  {
    id: "tech-tutorial",
    label: "Tech Tutorial",
    aspect: "16:9",
    emoji: "💻",
    gradient: "from-sky-600 to-cyan-400",
    textColor: "#fff",
    prompt: "Clean tech tutorial thumbnail. Dark code editor screenshot, bright cyan accent, bold how-to headline, laptop or monitor graphic, professional and modern.",
  },
  {
    id: "fitness-motivation",
    label: "Fitness Before/After",
    aspect: "9:16",
    emoji: "💪",
    gradient: "from-emerald-600 to-lime-400",
    textColor: "#0b0d12",
    prompt: "Fitness transformation thumbnail. Split before-and-after portrait, bold green RESULTS text overlay, athletic background, high-contrast dramatic lighting.",
  },
  {
    id: "recipe-reveal",
    label: "Recipe Reveal",
    aspect: "16:9",
    emoji: "🍽️",
    gradient: "from-amber-600 to-yellow-400",
    textColor: "#0b0d12",
    prompt: "Food recipe thumbnail. Extreme close-up of a finished dish with steam, warm golden bokeh background, handwritten-style font showing dish name, appetizing and vibrant.",
  },
  {
    id: "travel-vlog",
    label: "Travel Vlog",
    aspect: "16:9",
    emoji: "✈️",
    gradient: "from-blue-500 to-teal-400",
    textColor: "#fff",
    prompt: "Cinematic travel thumbnail. Wide landscape aerial photo, vlogger silhouette in foreground, clean bold location name typography, golden-hour warm tones.",
  },
  {
    id: "finance-tips",
    label: "Finance Tips",
    aspect: "16:9",
    emoji: "💰",
    gradient: "from-green-800 to-emerald-500",
    textColor: "#c8a855",
    prompt: "Finance / money thumbnail. Rising chart graphic, dollar bills or coins, bold MONEY headline, dark professional background, gold accents, authoritative clean layout.",
  },
  {
    id: "gaming-highlight",
    label: "Gaming Highlight",
    aspect: "16:9",
    emoji: "🎮",
    gradient: "from-purple-700 to-pink-500",
    textColor: "#fff",
    prompt: "Gaming highlight thumbnail. Screenshot of intense game moment, neon purple and pink glow effects, player name and EPIC PLAY text, controller graphic, high-energy.",
  },
  {
    id: "business-coaching",
    label: "Business Coaching",
    aspect: "16:9",
    emoji: "🚀",
    gradient: "from-slate-700 to-blue-600",
    textColor: "#fff",
    prompt: "Business coaching thumbnail. Professional headshot, confident pose, large bold value statement, clean white and navy layout, authority and trust signals, minimal.",
  },
  {
    id: "music-release",
    label: "Music Release",
    aspect: "1:1",
    emoji: "🎵",
    gradient: "from-violet-700 to-fuchsia-500",
    textColor: "#fff",
    prompt: "Square music release cover. Abstract artistic background with light trails, artist silhouette, album title in large elegant typography, dark moody atmosphere.",
  },
  {
    id: "real-estate",
    label: "Real Estate Tour",
    aspect: "16:9",
    emoji: "🏡",
    gradient: "from-orange-500 to-amber-300",
    textColor: "#0b0d12",
    prompt: "Real estate YouTube thumbnail. Beautiful exterior house photo at golden hour, bold price or location text overlay, realtor logo corner, professional and inviting.",
  },
];

export default function AiFirstStarter({
  onPickThumbnail,
  onSkip,
  width = 1280,
  height = 720,
}: Props) {
  const [prompt, setPrompt] = useState("");
  const [busy, setBusy] = useState(false);
  const [options, setOptions] = useState<Array<{ url: string; idx: number }>>([]);
  const [pickedIdx, setPickedIdx] = useState<number | null>(null);
  const [ctrs, setCtrs] = useState<Record<number, number | null>>({});
  const [winnerTip, setWinnerTip] = useState<string | null>(null);

  const analyzeCtrs = async (wins: Array<{ url: string; idx: number }>) => {
    const initial: Record<number, number | null> = {};
    wins.forEach(w => { initial[w.idx] = null; });
    setCtrs(initial);
    setWinnerTip(null);

    const results = await Promise.allSettled(
      wins.map(({ url, idx }) =>
        fetch("/api/thumbnail/analyze", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ image_url: url }),
        })
          .then(r => r.json())
          .then((data: { ok: boolean; predicted_ctr?: number; improvement_suggestions?: string[] }) => ({
            idx,
            ctr: data.ok ? (data.predicted_ctr ?? 0) : 0,
            tip: data.ok ? (data.improvement_suggestions?.[0] ?? null) : null,
          }))
      )
    );

    const final: Record<number, number> = {};
    let bestIdx = -1;
    let bestCtr = -1;
    let bestTip: string | null = null;

    for (const res of results) {
      if (res.status === "fulfilled") {
        final[res.value.idx] = res.value.ctr;
        if (res.value.ctr > bestCtr) {
          bestCtr = res.value.ctr;
          bestIdx = res.value.idx;
          bestTip = res.value.tip;
        }
      }
    }
    void bestIdx; // tracked via ctrs map — direct idx compare in render
    setCtrs(final);
    if (bestTip) setWinnerTip(bestTip);
  };

  const generate = async (overridePrompt?: string) => {
    const p = (overridePrompt ?? prompt).trim();
    if (!p) {
      toast.error("Describe your thumbnail first");
      return;
    }
    if (overridePrompt) setPrompt(overridePrompt);
    setBusy(true);
    setOptions([]);
    setCtrs({});
    setWinnerTip(null);
    try {
      // Generate 4 in parallel — each call hits our existing FLUX/SDXL/DALL-E
      // image-gen route. We add subtle prompt variation per call so the 4
      // options aren't identical.
      const variants = [
        p,
        `${p} — alternate angle, different lighting`,
        `${p} — bolder typography, higher contrast`,
        `${p} — minimal version, more whitespace`,
      ];

      const settled = await Promise.allSettled(
        variants.map((p, idx) =>
          fetch("/api/ai-studio/image-gen", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              prompt: p,
              width,
              height,
            }),
          })
            .then((r) => r.json())
            .then((data) => {
              const url =
                data?.images?.[0]?.url || data?.url || data?.image || null;
              if (!url) throw new Error(data?.error || "No image returned");
              return { url, idx };
            }),
        ),
      );

      const wins = settled
        .filter((s): s is PromiseFulfilledResult<{ url: string; idx: number }> =>
          s.status === "fulfilled",
        )
        .map((s) => s.value);

      if (wins.length === 0) {
        toast.error(
          "All 4 generations failed. Check API keys + try a simpler prompt.",
        );
      } else {
        setOptions(wins);
        if (wins.length < 4) {
          toast(`${wins.length}/4 options generated`, { icon: "⚠️" });
        }
        // Fire CTR analysis in background — no await so UI updates progressively
        void analyzeCtrs(wins);
      }
    } catch (err) {
      toast.error(`Generation failed: ${(err as Error).message}`);
    } finally {
      setBusy(false);
    }
  };

  const pickOption = (idx: number, url: string) => {
    setPickedIdx(idx);
    // Tiny delay so the user sees the visual confirmation
    setTimeout(() => {
      onPickThumbnail(url);
    }, 220);
  };

  return (
    <div
      className="absolute inset-0 z-40 flex items-center justify-center p-6 backdrop-blur-md"
      style={{ background: "rgba(11,13,18,0.85)" }}
    >
      {/* Ambient gold glow */}
      <div
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] rounded-full pointer-events-none blur-3xl opacity-25"
        style={{
          background:
            "radial-gradient(circle, rgba(200,168,85,0.18) 0%, transparent 70%)",
        }}
      />

      <div
        className="relative max-w-3xl w-full rounded-3xl p-7 md:p-9"
        style={{
          background:
            "linear-gradient(135deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.01) 100%)",
          border: "1px solid rgba(200,168,85,0.18)",
          boxShadow: "0 20px 80px rgba(0,0,0,0.5)",
        }}
      >
        {/* Skip button */}
        <button
          onClick={onSkip}
          className="absolute top-4 right-4 text-neutral-500 hover:text-neutral-200 p-1.5 rounded hover:bg-white/[0.05] transition flex items-center gap-1 text-[11px]"
          title="Start with a blank canvas instead"
        >
          Skip — blank canvas <X size={11} />
        </button>

        {/* Header */}
        <div className="flex items-center gap-3 mb-5">
          <div
            className="w-11 h-11 rounded-xl flex items-center justify-center"
            style={{
              background:
                "linear-gradient(135deg, rgba(200,168,85,0.18), rgba(200,168,85,0.04))",
              border: "1px solid rgba(200,168,85,0.3)",
            }}
          >
            <Sparkles size={18} style={{ color: "#c8a855" }} />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white">
              Start with AI, refine in the editor
            </h2>
            <p className="text-[12px] text-neutral-400">
              Describe what you want. Pick from 4 AI options. Then tweak in the
              full Photopea-style editor.
            </p>
          </div>
        </div>

        {/* Prompt input */}
        <div className="mb-3">
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="e.g. YouTube thumbnail for a video about productivity hacks. Bold gold text, person looking shocked, dark background…"
            rows={3}
            disabled={busy}
            className="w-full bg-neutral-900 border border-neutral-800 rounded-xl px-4 py-3 text-sm text-white placeholder:text-neutral-600 focus:outline-none focus:border-amber-400/40 resize-none disabled:opacity-60"
          />
        </div>

        {/* Template library grid — 12 clickable visual cards */}
        {options.length === 0 && !busy && (
          <div className="mb-4">
            <p className="text-[10.5px] uppercase tracking-wider text-neutral-500 mb-2">
              Start from a template — click to generate instantly
            </p>
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-1.5">
              {THUMBNAIL_TEMPLATES.map((t) => (
                <button
                  key={t.id}
                  onClick={() => generate(t.prompt)}
                  className={`group relative rounded-lg overflow-hidden text-left transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/20`}
                  style={{ border: "1px solid rgba(255,255,255,0.08)" }}
                  title={t.prompt}
                >
                  {/* Gradient swatch */}
                  <div className={`h-8 bg-gradient-to-br ${t.gradient} flex items-center justify-center text-base`}>
                    {t.emoji}
                  </div>
                  {/* Label + aspect */}
                  <div className="px-1.5 py-1 bg-neutral-900/90">
                    <p className="text-[9.5px] font-semibold text-neutral-200 truncate leading-tight">
                      {t.label}
                    </p>
                    <p className="text-[8px] text-neutral-500 mt-0.5">{t.aspect}</p>
                  </div>
                  {/* Hover overlay */}
                  <div className="absolute inset-0 bg-black/5 opacity-0 group-hover:opacity-100 transition-opacity" />
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Generate button or option grid */}
        {options.length === 0 ? (
          <button
            onClick={() => generate()}
            disabled={busy || !prompt.trim()}
            className="w-full py-3 rounded-xl text-sm font-bold transition disabled:opacity-50 flex items-center justify-center gap-2"
            style={{
              background:
                "linear-gradient(135deg, #c8a855, #b89840)",
              color: "#0b0d12",
              boxShadow: "0 8px 24px rgba(200,168,85,0.3)",
            }}
          >
            {busy ? (
              <>
                <Loader size={14} className="animate-spin" />
                Generating 4 options…
              </>
            ) : (
              <>
                <Sparkles size={14} />
                Generate 4 thumbnails
                <ArrowRight size={14} />
              </>
            )}
          </button>
        ) : (
          <div>
            <p className="text-[12px] text-white mb-3 font-semibold">
              Pick one to start. You&apos;ll be able to edit in the next step.
            </p>
            <div className="grid grid-cols-2 gap-3">
              {options.map((opt) => {
                const picked = pickedIdx === opt.idx;
                return (
                  <button
                    key={opt.idx}
                    onClick={() => pickOption(opt.idx, opt.url)}
                    className="group relative rounded-xl overflow-hidden transition-all hover:-translate-y-0.5"
                    style={{
                      border: picked
                        ? "2px solid #c8a855"
                        : "2px solid rgba(255,255,255,0.06)",
                      boxShadow: picked
                        ? "0 0 24px rgba(200,168,85,0.4)"
                        : undefined,
                    }}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={opt.url}
                      alt={`AI option ${opt.idx + 1}`}
                      className="w-full aspect-video object-cover transition-opacity"
                      style={{ opacity: picked ? 0.6 : 1 }}
                    />
                    <div
                      className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                      style={{ background: "rgba(11,13,18,0.5)" }}
                    >
                      <span
                        className="text-xs font-bold px-3 py-1.5 rounded-md"
                        style={{
                          background: "rgba(200,168,85,0.95)",
                          color: "#0b0d12",
                        }}
                      >
                        Edit this →
                      </span>
                    </div>
                    {/* CTR analyzing indicator */}
                    {ctrs[opt.idx] === null && Object.keys(ctrs).length > 0 && (
                      <div className="absolute top-2 right-2 z-10 text-[8px] text-neutral-400 bg-black/60 px-1.5 py-0.5 rounded-full animate-pulse pointer-events-none">
                        CTR…
                      </div>
                    )}
                    {/* BEST CTR winner badge */}
                    {typeof ctrs[opt.idx] === "number" && (() => {
                      const vals = Object.values(ctrs).filter((v): v is number => typeof v === "number");
                      return vals.length > 0 && ctrs[opt.idx] === Math.max(...vals);
                    })() && (
                      <div className="absolute top-2 left-2 z-10 flex items-center gap-1 text-[8px] font-bold px-1.5 py-0.5 rounded-full bg-amber-400 text-black pointer-events-none">
                        ★ BEST CTR {ctrs[opt.idx]}
                      </div>
                    )}
                    {picked && (
                      <div
                        className="absolute inset-0 flex items-center justify-center"
                        style={{ background: "rgba(11,13,18,0.4)" }}
                      >
                        <Loader size={20} className="animate-spin text-amber-300" />
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
            {winnerTip && (
              <p className="mt-2 text-[10px] text-amber-300 flex items-start gap-1.5">
                <span className="mt-0.5 shrink-0">💡</span>
                <span>Top tip: {winnerTip}</span>
              </p>
            )}
            <button
              onClick={() => {
                setOptions([]);
                setPickedIdx(null);
                setCtrs({});
                setWinnerTip(null);
              }}
              className="mt-4 text-[11.5px] text-neutral-400 hover:text-white transition flex items-center gap-1.5"
            >
              <ImageIcon size={11} /> None of these — try a different prompt
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
