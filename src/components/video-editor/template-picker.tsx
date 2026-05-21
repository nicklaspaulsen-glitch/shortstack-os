"use client";

/**
 * TemplatePicker
 *
 * Displays the HyperFrames short-form video template gallery.
 * On selection, renders the template to HTML via the API and shows
 * an iframe preview + a prop-editing panel for the chosen template.
 *
 * Usage:
 *   <TemplatePicker
 *     onSelect={(html, templateId) => void}
 *     brandColor="#D4FF00"
 *   />
 */

import { useState, useCallback } from "react";
import { Layers, Play, ChevronDown, ChevronUp, Loader2 } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";

// ---------------------------------------------------------------------------
// Types (mirrors the server-side registry — no imports across the boundary)
// ---------------------------------------------------------------------------

interface TemplateMeta {
  id: string;
  name: string;
  description: string;
  category: string;
  aspectRatio: string;
  durationSeconds: number;
  previewGradient: string;
  defaultProps: Record<string, unknown>;
}

interface TemplatePickerProps {
  /** Called with the rendered HTML and template id when the user confirms */
  onSelect?: (html: string, templateId: string, props: Record<string, unknown>) => void;
  /** Pre-fill the brand accent color in every template's props */
  brandColor?: string;
  /** Pre-fill the background color */
  bgColor?: string;
  /** Additional CSS classes for the root element */
  className?: string;
}

// ---------------------------------------------------------------------------
// Static template list (avoids a network round-trip on first render)
// Kept in sync with src/lib/video-templates/index.ts
// ---------------------------------------------------------------------------

const STATIC_TEMPLATES: TemplateMeta[] = [
  {
    id: "headline",
    name: "Headline",
    description: "Bold cinematic text reveal — great for announcements.",
    category: "text",
    aspectRatio: "9:16",
    durationSeconds: 5,
    previewGradient: "linear-gradient(135deg, #020711 0%, #0D1120 60%, #3B82F620 100%)",
    defaultProps: {
      headline: "Your bold headline here",
      subheadline: "Supporting context in one short line",
      cta: "#shortstack",
      bgColor: "#020711",
      accentColor: "#D4FF00",
      textColor: "#F0F0F4",
    },
  },
  {
    id: "listicle",
    name: "Listicle",
    description: "Numbered list items reveal sequentially — perfect for tips and steps.",
    category: "text",
    aspectRatio: "9:16",
    durationSeconds: 6,
    previewGradient: "linear-gradient(135deg, #020711 0%, #0D1120 70%, #D4FF0015 100%)",
    defaultProps: {
      title: "5 things you need to know",
      items: ["Start with the fundamentals", "Build consistent habits", "Track progress daily"],
      cta: "#shortstack",
      bgColor: "#020711",
      accentColor: "#D4FF00",
      textColor: "#F0F0F4",
    },
  },
  {
    id: "quote-card",
    name: "Quote Card",
    description: "Elegant full-screen quote — great for inspiration and thought leadership.",
    category: "text",
    aspectRatio: "9:16",
    durationSeconds: 5,
    previewGradient: "linear-gradient(135deg, #020711 0%, #0D1120 50%, #3B82F614 100%)",
    defaultProps: {
      quote: "The best way to predict the future is to create it.",
      attribution: "— Peter Drucker",
      tag: "#leadership",
      bgColor: "#020711",
      accentColor: "#D4FF00",
      textColor: "#F0F0F4",
      quoteSize: "md",
    },
  },
];

// ---------------------------------------------------------------------------
// Prop editor helpers
// ---------------------------------------------------------------------------

/** Simple inline editor that handles string, number, and string[] fields */
function PropEditor({
  propKey,
  value,
  onChange,
}: {
  propKey: string;
  value: unknown;
  onChange: (key: string, val: unknown) => void;
}) {
  if (Array.isArray(value)) {
    return (
      <div>
        <label className="block text-xs text-text-secondary mb-1 font-medium capitalize">
          {propKey.replace(/([A-Z])/g, " $1").trim()}
        </label>
        <textarea
          className="w-full bg-[rgba(255,255,255,0.04)] border border-[rgba(212, 255, 0,0.12)] rounded-lg px-3 py-2 text-sm text-text-primary resize-none focus:outline-none focus:border-brand-accent/40"
          rows={3}
          value={(value as string[]).join("\n")}
          onChange={(e) => onChange(propKey, e.target.value.split("\n").filter(Boolean))}
        />
        <p className="text-xs text-text-muted mt-1">One item per line</p>
      </div>
    );
  }

  if (typeof value === "string" && value.startsWith("#") && value.length === 7) {
    return (
      <div className="flex items-center gap-3">
        <label className="flex-1 text-xs text-text-secondary font-medium capitalize">
          {propKey.replace(/([A-Z])/g, " $1").trim()}
        </label>
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(propKey, e.target.value)}
          className="w-8 h-8 rounded cursor-pointer border border-[rgba(212, 255, 0,0.15)] bg-transparent"
        />
        <span className="text-xs text-text-muted font-mono w-16">{value}</span>
      </div>
    );
  }

  if (propKey === "quoteSize") {
    return (
      <div>
        <label className="block text-xs text-text-secondary mb-1 font-medium">Quote size</label>
        <div className="flex gap-2">
          {(["sm", "md", "lg"] as const).map((size) => (
            <button
              key={size}
              onClick={() => onChange(propKey, size)}
              className={`flex-1 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                value === size
                  ? "bg-brand-accent/20 border-brand-accent/40 text-brand-accent"
                  : "bg-[rgba(255,255,255,0.03)] border-[rgba(212, 255, 0,0.10)] text-text-secondary hover:text-text-primary"
              }`}
            >
              {size.toUpperCase()}
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div>
      <label className="block text-xs text-text-secondary mb-1 font-medium capitalize">
        {propKey.replace(/([A-Z])/g, " $1").trim()}
      </label>
      <input
        className="w-full bg-[rgba(255,255,255,0.04)] border border-[rgba(212, 255, 0,0.12)] rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-brand-accent/40"
        value={typeof value === "string" ? value : String(value ?? "")}
        onChange={(e) => onChange(propKey, e.target.value)}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function TemplatePicker({
  onSelect,
  brandColor = "#D4FF00",
  bgColor = "#020711",
  className = "",
}: TemplatePickerProps) {
  const [selected, setSelected] = useState<TemplateMeta | null>(null);
  const [props, setProps] = useState<Record<string, unknown>>({});
  const [previewHtml, setPreviewHtml] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showProps, setShowProps] = useState(true);

  // Merge brand color into default props when a template is selected
  const selectTemplate = useCallback(
    (template: TemplateMeta) => {
      const merged: Record<string, unknown> = {
        ...template.defaultProps,
        accentColor: brandColor,
        bgColor,
      };
      setSelected(template);
      setProps(merged);
      setPreviewHtml(null);
    },
    [brandColor, bgColor],
  );

  const updateProp = useCallback((key: string, val: unknown) => {
    setProps((prev) => ({ ...prev, [key]: val }));
    setPreviewHtml(null); // invalidate preview on prop change
  }, []);

  const handlePreview = useCallback(async () => {
    if (!selected) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/video/templates/${selected.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(props),
      });
      const data = (await res.json()) as { success: boolean; html?: string };
      if (data.success && data.html) {
        setPreviewHtml(data.html);
      }
    } catch (err) {
      console.error("[TemplatePicker] preview failed", err);
    } finally {
      setLoading(false);
    }
  }, [selected, props]);

  const handleConfirm = useCallback(() => {
    if (!selected || !previewHtml) return;
    onSelect?.(previewHtml, selected.id, props);
  }, [selected, previewHtml, props, onSelect]);

  return (
    <div className={`flex flex-col gap-6 ${className}`}>
      {/* Template gallery */}
      <div>
        <p className="text-xs text-text-muted font-medium uppercase tracking-wider mb-3">
          Choose a template
        </p>
        <div className="grid grid-cols-3 gap-3">
          {STATIC_TEMPLATES.map((t) => (
            <button
              key={t.id}
              onClick={() => selectTemplate(t)}
              className={`relative flex flex-col rounded-xl overflow-hidden border transition-all text-left ${
                selected?.id === t.id
                  ? "border-brand-accent/60 ring-1 ring-brand-accent/30"
                  : "border-[rgba(212, 255, 0,0.12)] hover:border-[rgba(212, 255, 0,0.25)]"
              }`}
            >
              {/* Preview swatch */}
              <div
                className="h-24 w-full flex-shrink-0"
                style={{ background: t.previewGradient }}
              >
                {selected?.id === t.id && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                    <div className="w-5 h-5 rounded-full bg-brand-accent flex items-center justify-center">
                      <div className="w-2 h-2 rounded-full bg-white" />
                    </div>
                  </div>
                )}
                <div className="absolute top-2 right-2 bg-black/50 rounded px-1.5 py-0.5 text-[9px] text-white/60">
                  {t.durationSeconds}s
                </div>
              </div>
              {/* Name */}
              <div className="px-3 py-2 bg-[rgba(13,17,32,0.9)]">
                <p className="text-xs font-semibold text-text-primary">{t.name}</p>
                <p className="text-[10px] text-text-muted mt-0.5 line-clamp-1">{t.description}</p>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Editor + preview */}
      <AnimatePresence>
        {selected && (
          <motion.div
            key={selected.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            transition={{ duration: 0.22, ease: [0.32, 0.72, 0, 1] }}
            className="flex flex-col gap-4"
          >
            {/* Prop editor */}
            <div className="glass-card rounded-xl p-4">
              <button
                onClick={() => setShowProps((v) => !v)}
                className="flex items-center justify-between w-full text-sm font-medium text-text-primary mb-0"
              >
                <span className="flex items-center gap-2">
                  <Layers size={14} className="text-brand-accent" />
                  Customize — {selected.name}
                </span>
                {showProps ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              </button>

              <AnimatePresence initial={false}>
                {showProps && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden"
                  >
                    <div className="mt-4 flex flex-col gap-4">
                      {Object.entries(props)
                        // Skip internal/font props — they clutter the editor
                        .filter(([k]) => !["fontFamily"].includes(k))
                        .map(([k, v]) => (
                          <PropEditor key={k} propKey={k} value={v} onChange={updateProp} />
                        ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Preview area */}
            <div className="flex gap-4 items-start">
              {/* Aspect-ratio-correct preview box */}
              <div
                className="relative flex-shrink-0 rounded-xl overflow-hidden border border-[rgba(212, 255, 0,0.12)] bg-[#020711]"
                style={{ width: 120, height: 213 }} // 9:16 at 120px wide
              >
                {previewHtml ? (
                  <iframe
                    srcDoc={previewHtml}
                    className="w-full h-full pointer-events-none"
                    style={{ transform: "scale(0.111)", transformOrigin: "top left", width: "1080px", height: "1920px" }}
                    title={`${selected.name} preview`}
                    sandbox="allow-scripts"
                  />
                ) : (
                  <div
                    className="w-full h-full"
                    style={{ background: selected.previewGradient }}
                  />
                )}

                {loading && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-xl">
                    <Loader2 size={18} className="animate-spin text-brand-accent" />
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="flex flex-col gap-2 flex-1">
                <button
                  onClick={handlePreview}
                  disabled={loading}
                  className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl bg-[rgba(212, 255, 0,0.08)] border border-[rgba(212, 255, 0,0.18)] text-sm font-medium text-text-primary hover:bg-[rgba(212, 255, 0,0.15)] transition-colors disabled:opacity-50"
                >
                  {loading ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : (
                    <Play size={14} />
                  )}
                  Preview
                </button>

                <button
                  onClick={handleConfirm}
                  disabled={!previewHtml || loading}
                  className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl bg-brand-accent text-white text-sm font-semibold hover:bg-brand-accent/90 transition-colors disabled:opacity-40"
                >
                  Use this template
                </button>

                <p className="text-[10px] text-text-muted text-center leading-snug">
                  {selected.durationSeconds}s · {selected.aspectRatio} · HTML/CSS animated
                </p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
