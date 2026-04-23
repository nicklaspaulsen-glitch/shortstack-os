"use client";

/**
 * Logo Picker — 20 hand-authored SVG variants of the "stacked rectangles"
 * ShortStack mark. See public/icons/concepts/concept-NN.svg.
 *
 * Each tile shows a large preview, small favicon-scale previews, the concept
 * name + theme, and two actions:
 *   - "Preview in app" — flips a CSS var override so every consumer of
 *     `var(--ss-logo-url)` temporarily paints this concept. Useful for
 *     flipping through options without touching the filesystem.
 *   - "Apply permanently" (admin only) — POSTs to /api/admin/apply-logo,
 *     which overwrites public/icons/shortstack-logo.svg and regenerates
 *     every raster artefact (png / ico / og-image / favicon / email-logo).
 *
 * If a prior concept is recorded in logo_apply_log, a "Revert to concept #N"
 * button appears at the top.
 */

import { useEffect, useMemo, useState } from "react";
import { Check, RotateCcw, Eye, Upload } from "lucide-react";
import toast from "react-hot-toast";

interface Concept {
  number: number;
  id: string; // "01".."20"
  name: string;
  theme: string;
  url: string; // /icons/concepts/concept-NN.svg
}

// Names + taglines for the 20 concepts. Kept in sync with the SVGs on disk.
const CONCEPT_META: { name: string; theme: string }[] = [
  { name: "Tight Symmetrical", theme: "Tightness: flush-centered, minimal gap." },
  { name: "Cascading Offset", theme: "Tightness: each bar climbs right." },
  { name: "Loose Stack", theme: "Tightness: generous gaps, airy." },
  { name: "Alternating Offset", theme: "Tightness: zig-zag lean." },
  { name: "Interlocking", theme: "Tightness: overlapping, alpha-blended." },
  { name: "Current Gold", theme: "Color: canonical baseline." },
  { name: "Monochrome Silver", theme: "Color: neutral brushed-steel." },
  { name: "Dark + Gold Accent", theme: "Color: graphite w/ gold cap." },
  { name: "Duotone Purple + Gold", theme: "Color: royal indigo + gold." },
  { name: "Rainbow Subtle", theme: "Color: bronze → rose → gold." },
  { name: "Rounded Pill", theme: "Shape: fully rounded ends." },
  { name: "Sharp Brick", theme: "Shape: zero-radius masonry." },
  { name: "Thick Bars", theme: "Shape: heavy confident slabs." },
  { name: "Thin Bars", theme: "Shape: delicate minimal lines." },
  { name: "Pill Capsule", theme: "Shape: tablet-style stroke." },
  { name: "Highlight Bar", theme: "Twist: middle bar glows bright." },
  { name: "Pancake Steam", theme: "Twist: steam curls above." },
  { name: "Fading Opacity", theme: "Twist: ghostly base, sharp top." },
  { name: "Typography", theme: "Twist: SS wordmark on top bar." },
  { name: "Monogram S Hidden", theme: "Twist: bars form negative-space S." },
];

const CONCEPTS: Concept[] = CONCEPT_META.map((m, i) => {
  const n = i + 1;
  const id = String(n).padStart(2, "0");
  return { number: n, id, name: m.name, theme: m.theme, url: `/icons/concepts/concept-${id}.svg` };
});

type ApplyHistory = {
  last: { applied_concept: number; applied_at: string } | null;
  previous: { applied_concept: number; applied_at: string } | null;
} | null;

export default function LogoPickerPage() {
  const [selected, setSelected] = useState<number | null>(null);
  const [preview, setPreview] = useState<number | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [history, setHistory] = useState<ApplyHistory>(null);
  const [applying, setApplying] = useState<number | null>(null);

  // Fetch admin status + apply history.
  useEffect(() => {
    fetch("/api/admin/apply-logo")
      .then(async (r) => {
        if (r.status === 403 || r.status === 401) {
          setIsAdmin(false);
          return null;
        }
        setIsAdmin(true);
        return r.json();
      })
      .then((data) => {
        if (!data) return;
        setHistory({ last: data.last ?? null, previous: data.previous ?? null });
      })
      .catch(() => {
        /* ignore — treat as non-admin */
      });
  }, []);

  // CSS var override for "Preview in app" — any component using
  // background-image: var(--ss-logo-url) will flip live.
  useEffect(() => {
    const root = document.documentElement;
    if (preview == null) {
      root.style.removeProperty("--ss-logo-url");
      return;
    }
    const c = CONCEPTS.find((x) => x.number === preview);
    if (c) root.style.setProperty("--ss-logo-url", `url("${c.url}")`);
  }, [preview]);

  const previewConcept = useMemo(
    () => (preview != null ? CONCEPTS.find((c) => c.number === preview) ?? null : null),
    [preview],
  );

  async function applyPermanently(concept: number) {
    if (!confirm(`Apply concept #${concept} as the live ShortStack logo?\n\nThis overwrites public/icons/shortstack-logo.svg and rebuilds every raster icon. You'll still need to commit + push to deploy to Vercel.`)) {
      return;
    }
    setApplying(concept);
    const t = toast.loading(`Applying concept ${String(concept).padStart(2, "0")}…`);
    try {
      const res = await fetch("/api/admin/apply-logo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ concept_number: concept }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Apply failed");
      toast.success(
        `Applied #${String(concept).padStart(2, "0")} — ${json.files_updated?.length ?? 0} files rewritten`,
        { id: t },
      );
      if (json.warning) toast(json.warning, { icon: "⚠️", duration: 6000 });
      // refresh history
      const h = await fetch("/api/admin/apply-logo").then((r) => r.json());
      setHistory({ last: h.last ?? null, previous: h.previous ?? null });
    } catch (e) {
      toast.error((e as Error).message, { id: t });
    } finally {
      setApplying(null);
    }
  }

  const revertTarget = history?.previous?.applied_concept ?? null;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-[1500px] px-6 py-10">
        <div className="mb-8 flex items-start justify-between gap-6">
          <div>
            <h1 className="mb-2 text-3xl font-bold">Logo Picker</h1>
            <p className="max-w-2xl text-sm text-muted">
              20 SVG concepts — all riffs on the stacked-rectangles ShortStack mark.
              <span className="text-gold"> Preview in app</span> flips the live mark temporarily.
              {isAdmin && (
                <>
                  {" "}
                  <span className="text-gold">Apply permanently</span> overwrites the brand file and rebuilds every raster size.
                </>
              )}
            </p>
            {history?.last && (
              <p className="mt-2 text-xs text-muted">
                Last applied: concept #{String(history.last.applied_concept).padStart(2, "0")} on{" "}
                {new Date(history.last.applied_at).toLocaleString()}
              </p>
            )}
          </div>

          {isAdmin && revertTarget != null && (
            <button
              onClick={() => applyPermanently(revertTarget)}
              disabled={applying != null}
              className="inline-flex items-center gap-2 rounded-md border border-gold/40 bg-gold/10 px-3 py-2 text-xs font-medium text-gold transition hover:bg-gold/20 disabled:opacity-50"
            >
              <RotateCcw size={14} /> Revert to concept #{String(revertTarget).padStart(2, "0")}
            </button>
          )}
        </div>

        {previewConcept && (
          <div className="mb-6 flex items-center gap-3 rounded-lg border border-gold/40 bg-gold/5 px-4 py-3 text-sm">
            <Eye size={16} className="text-gold" />
            <span className="font-medium">Previewing #{previewConcept.id} — {previewConcept.name}</span>
            <span className="text-xs text-muted">(temporary — CSS var override only)</span>
            <button
              onClick={() => setPreview(null)}
              className="ml-auto rounded bg-surface-light px-2 py-1 text-xs hover:bg-surface-light/70"
            >
              Clear preview
            </button>
          </div>
        )}

        {/* 5-column grid per spec */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {CONCEPTS.map((c) => {
            const isSelected = selected === c.number;
            const isPreviewing = preview === c.number;
            const isApplying = applying === c.number;
            return (
              <div
                key={c.number}
                className={`group relative overflow-hidden rounded-xl border transition ${
                  isSelected
                    ? "border-gold bg-gold/5 ring-2 ring-gold/40"
                    : "border-border/50 bg-surface-light/30 hover:border-gold/40"
                }`}
              >
                <div className="absolute left-2 top-2 rounded bg-black/60 px-1.5 py-0.5 font-mono text-[10px] text-gold backdrop-blur">
                  #{c.id}
                </div>
                {isPreviewing && (
                  <div className="absolute right-2 top-2 rounded bg-gold px-1.5 py-0.5 text-[10px] font-semibold text-black">
                    LIVE
                  </div>
                )}

                {/* Large preview */}
                <div className="flex aspect-square items-center justify-center p-8">
                  <img
                    src={c.url}
                    alt={c.name}
                    width={128}
                    height={128}
                    className="h-full w-full object-contain"
                  />
                </div>

                {/* Favicon-scale row */}
                <div className="flex items-center justify-center gap-4 border-t border-border/30 py-2">
                  <img src={c.url} alt="" width={16} height={16} />
                  <img src={c.url} alt="" width={24} height={24} />
                  <img src={c.url} alt="" width={32} height={32} />
                </div>

                <div className="space-y-2 border-t border-border/30 p-3">
                  <div>
                    <p className="text-sm font-semibold leading-tight">{c.name}</p>
                    <p className="text-[11px] leading-snug text-muted">{c.theme}</p>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <button
                      onClick={() => {
                        setSelected(c.number);
                        setPreview(c.number);
                      }}
                      className={`w-full rounded-md px-2 py-1.5 text-xs font-medium transition ${
                        isPreviewing
                          ? "bg-gold text-black"
                          : "bg-surface-light text-foreground hover:bg-gold/15 hover:text-gold"
                      }`}
                    >
                      {isPreviewing ? (
                        <span className="inline-flex items-center gap-1">
                          <Check size={12} /> Previewing
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1">
                          <Eye size={12} /> Preview in app
                        </span>
                      )}
                    </button>

                    {isAdmin && (
                      <button
                        onClick={() => applyPermanently(c.number)}
                        disabled={applying != null}
                        className="inline-flex w-full items-center justify-center gap-1 rounded-md border border-gold/40 bg-gold/10 px-2 py-1.5 text-xs font-medium text-gold transition hover:bg-gold/20 disabled:opacity-50"
                      >
                        <Upload size={12} />
                        {isApplying ? "Applying…" : "Apply permanently"}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {!isAdmin && (
          <div className="mt-8 rounded-lg border border-dashed border-border/50 bg-surface-light/20 p-4 text-xs text-muted">
            <p className="mb-1 font-semibold text-foreground">Admin access required to apply permanently.</p>
            <p>
              Use <span className="font-mono text-gold">Preview in app</span> to test any concept live — it sets a CSS
              variable override that affects any component using <code>var(--ss-logo-url)</code>.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
