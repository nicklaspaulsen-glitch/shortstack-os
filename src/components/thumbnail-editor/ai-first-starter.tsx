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

const PROMPT_TEMPLATES: Array<{ label: string; prompt: string }> = [
  {
    label: "YouTube tutorial",
    prompt: "Bold, modern YouTube thumbnail. Person looking surprised, large gold text reading the headline, clean dark background, subtle gradient.",
  },
  {
    label: "Tech news",
    prompt: "Tech news thumbnail. Sleek minimalist layout, neon accents, futuristic typography, central product render with soft rim light.",
  },
  {
    label: "Lifestyle vlog",
    prompt: "Warm lifestyle vlog thumbnail. Sunset palette, candid lifestyle photo, friendly serif headline, soft film grain.",
  },
  {
    label: "Course preview",
    prompt: "Educational course preview. Clean modern design, instructor portrait on left, large bold value-prop text on right, dark navy background, gold highlights.",
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

  const generate = async () => {
    if (!prompt.trim()) {
      toast.error("Describe your thumbnail first");
      return;
    }
    setBusy(true);
    setOptions([]);
    try {
      // Generate 4 in parallel — each call hits our existing FLUX/SDXL/DALL-E
      // image-gen route. We add subtle prompt variation per call so the 4
      // options aren't identical.
      const variants = [
        prompt,
        `${prompt} — alternate angle, different lighting`,
        `${prompt} — bolder typography, higher contrast`,
        `${prompt} — minimal version, more whitespace`,
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

        {/* Quick templates */}
        {options.length === 0 && !busy && (
          <div className="mb-4">
            <p className="text-[10.5px] uppercase tracking-wider text-neutral-500 mb-2">
              Or start from a template
            </p>
            <div className="flex flex-wrap gap-1.5">
              {PROMPT_TEMPLATES.map((t) => (
                <button
                  key={t.label}
                  onClick={() => setPrompt(t.prompt)}
                  className="text-[11px] font-semibold px-3 py-1.5 rounded-md transition"
                  style={{
                    background: "rgba(255,255,255,0.03)",
                    border: "1px solid rgba(255,255,255,0.06)",
                    color: "rgba(255,255,255,0.7)",
                  }}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Generate button or option grid */}
        {options.length === 0 ? (
          <button
            onClick={generate}
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
            <button
              onClick={() => {
                setOptions([]);
                setPickedIdx(null);
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
