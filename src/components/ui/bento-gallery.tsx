"use client";

/**
 * BentoGallery — Framer-style asymmetric CSS grid image gallery.
 *
 * A masonry-ish bento layout using explicit `grid-template-areas`
 * so each cell can span different widths / heights. Cells animate in
 * with staggered fade + rise on scroll enter.
 *
 * Usage (data-driven):
 *   <BentoGallery items={galleryItems} />
 *
 * Or use the layout presets:
 *   <BentoGallery items={items} layout="editorial" />
 *
 * Layouts:
 *   "editorial" — large hero left + 3 smaller right (default)
 *   "spotlight" — 1 wide top + 3 equal bottom
 *   "mosaic"    — 2+2 symmetric masonry
 */

import { useRef, type ReactNode } from "react";
import { motion, useInView } from "framer-motion";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface GalleryItem {
  id: string;
  /** Background image URL or gradient string */
  src?: string;
  /** Optional overlay label */
  label?: string;
  /** Optional sub-label */
  sublabel?: string;
  /** Optional icon in overlay */
  icon?: ReactNode;
  /** Accent color for label pill */
  color?: string;
  /** Grid area name — matches the layout template */
  area?: string;
  /** Direct inline styles applied to the cell */
  style?: React.CSSProperties;
}

type BentoLayout = "editorial" | "spotlight" | "mosaic";

interface BentoGalleryProps {
  items: GalleryItem[];
  layout?: BentoLayout;
  className?: string;
  /** Height of the gallery in px (default: 480) */
  height?: number;
}

// ---------------------------------------------------------------------------
// Layout templates
// ---------------------------------------------------------------------------

const LAYOUTS: Record<BentoLayout, {
  template: string;
  columns: string;
  rows: string;
  areas: string[];
}> = {
  editorial: {
    template: `
      "a a b"
      "a a c"
      "a a d"
    `,
    columns: "5fr 5fr 4fr",
    rows: "repeat(3, 1fr)",
    areas: ["a", "b", "c", "d"],
  },
  spotlight: {
    template: `
      "a a a"
      "b c d"
    `,
    columns: "repeat(3, 1fr)",
    rows: "3fr 2fr",
    areas: ["a", "b", "c", "d"],
  },
  mosaic: {
    template: `
      "a b b"
      "a c d"
    `,
    columns: "2fr 3fr 3fr",
    rows: "repeat(2, 1fr)",
    areas: ["a", "b", "c", "d"],
  },
};

// ---------------------------------------------------------------------------
// BentoCell — single animated cell
// ---------------------------------------------------------------------------

interface BentoCellProps {
  item: GalleryItem;
  delay: number;
  area: string;
}

function BentoCell({ item, delay, area }: BentoCellProps) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-40px 0px" });

  const bg = item.src
    ? item.src.startsWith("linear-gradient") || item.src.startsWith("radial-gradient")
      ? item.src
      : `url(${item.src}) center / cover no-repeat`
    : "rgba(19,24,39,0.80)";

  return (
    <motion.div
      ref={ref}
      style={{ gridArea: area, ...item.style }}
      initial={{ opacity: 0, scale: 0.97 }}
      animate={inView ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.97 }}
      transition={{ duration: 0.52, delay, ease: [0.22, 1, 0.36, 1] }}
      className="relative overflow-hidden rounded-2xl group"
    >
      {/* Background */}
      <div
        className="absolute inset-0 transition-transform duration-700 ease-out group-hover:scale-[1.04]"
        style={{ background: bg }}
      />

      {/* Bottom gradient scrim for label legibility */}
      {(item.label ?? item.sublabel ?? item.icon) && (
        <div
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(to top, rgba(7,7,8,0.80) 0%, transparent 60%)",
          }}
        />
      )}

      {/* Hover shine ring */}
      <div
        aria-hidden
        className="absolute inset-0 rounded-2xl border border-white/0 group-hover:border-white/[0.09] transition-colors duration-300 pointer-events-none"
      />

      {/* Label overlay */}
      {(item.label ?? item.icon) && (
        <div className="absolute bottom-0 left-0 right-0 p-4 z-10">
          {item.icon && (
            <span
              className="inline-flex items-center justify-center w-8 h-8 rounded-lg mb-2"
              style={{
                background: item.color ? `${item.color}22` : "rgba(212,255,0,0.18)",
                color: item.color ?? "#3B82F6",
              }}
            >
              {item.icon}
            </span>
          )}
          {item.label && (
            <p className="text-sm font-semibold text-white leading-snug">
              {item.label}
            </p>
          )}
          {item.sublabel && (
            <p className="text-[11px] text-white/60 mt-0.5">{item.sublabel}</p>
          )}
        </div>
      )}
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// BentoGallery
// ---------------------------------------------------------------------------

export function BentoGallery({
  items,
  layout = "editorial",
  className = "",
  height = 480,
}: BentoGalleryProps) {
  const tpl = LAYOUTS[layout];

  return (
    <div
      className={`w-full grid gap-3 ${className}`}
      style={{
        gridTemplateAreas: tpl.template,
        gridTemplateColumns: tpl.columns,
        gridTemplateRows: tpl.rows,
        height,
      }}
    >
      {items.slice(0, 4).map((item, i) => (
        <BentoCell
          key={item.id}
          item={item}
          delay={i * 0.08}
          area={item.area ?? tpl.areas[i] ?? tpl.areas[0]}
        />
      ))}
    </div>
  );
}
