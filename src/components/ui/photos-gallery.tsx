"use client";

/**
 * PhotosGallery — Framer-style horizontal drag carousel.
 *
 * A drag-scrollable row of image/content cards. Supports:
 *   - Framer Motion drag with elastic constraints
 *   - Prev / Next buttons
 *   - Optional index dots indicator
 *   - Momentum / inertia via dragTransition
 *
 * Usage:
 *   <PhotosGallery items={galleryItems} />
 */

import {
  useRef,
  useState,
  useCallback,
  useEffect,
  type ReactNode,
} from "react";
import { motion } from "framer-motion";
import Image from "next/image";
import { ChevronLeft, ChevronRight } from "lucide-react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PhotoItem {
  id: string;
  src?: string;
  alt?: string;
  label?: string;
  sublabel?: string;
  content?: ReactNode;
  /** Background gradient (used when src is absent) */
  gradient?: string;
  /** Aspect ratio CSS value (default: "4/3") */
  aspect?: string;
}

interface PhotosGalleryProps {
  items: PhotoItem[];
  /** Card width in px (default: 280) */
  cardWidth?: number;
  /** Gap between cards in px (default: 12) */
  gap?: number;
  /** Show prev/next buttons (default: true) */
  showArrows?: boolean;
  /** Show dot indicators (default: false) */
  showDots?: boolean;
  className?: string;
}

// ---------------------------------------------------------------------------
// PhotosGallery
// ---------------------------------------------------------------------------

export function PhotosGallery({
  items,
  cardWidth = 280,
  gap = 12,
  showArrows = true,
  showDots = false,
  className = "",
}: PhotosGalleryProps) {
  const constraintsRef = useRef<HTMLDivElement>(null);
  const trackRef       = useRef<HTMLDivElement>(null);
  const [activeIdx, setActiveIdx] = useState(0);
  const [maxDrag, setMaxDrag]     = useState(0);

  // Compute total track width to derive drag constraint
  useEffect(() => {
    const el = trackRef.current;
    if (!el) return;
    const parentW = el.parentElement?.offsetWidth ?? 0;
    const total   = items.length * (cardWidth + gap) - gap;
    setMaxDrag(Math.max(0, total - parentW));
  }, [items.length, cardWidth, gap]);

  const scrollTo = useCallback(
    (idx: number) => {
      const clamped = Math.max(0, Math.min(idx, items.length - 1));
      setActiveIdx(clamped);
      // Programmatic scroll — not via drag, so set the x directly
      const x = -(clamped * (cardWidth + gap));
      const el = trackRef.current;
      if (el) {
        el.style.transform = `translateX(${x}px)`;
      }
    },
    [items.length, cardWidth, gap],
  );

  const prev = useCallback(() => scrollTo(activeIdx - 1), [activeIdx, scrollTo]);
  const next = useCallback(() => scrollTo(activeIdx + 1), [activeIdx, scrollTo]);

  return (
    <div className={`relative overflow-hidden ${className}`} ref={constraintsRef}>
      {/* Track */}
      <motion.div
        ref={trackRef}
        drag="x"
        dragConstraints={{ left: -maxDrag, right: 0 }}
        dragTransition={{ bounceStiffness: 300, bounceDamping: 30, timeConstant: 200 }}
        dragElastic={0.08}
        className="flex cursor-grab active:cursor-grabbing"
        style={{ gap }}
        onDragEnd={(_, info) => {
          // Snap to nearest card after drag
          const currentX = -(activeIdx * (cardWidth + gap));
          const newX     = currentX + info.offset.x;
          const nearest  = Math.round(-newX / (cardWidth + gap));
          scrollTo(Math.max(0, Math.min(nearest, items.length - 1)));
        }}
      >
        {items.map((item) => (
          <GalleryCard key={item.id} item={item} width={cardWidth} />
        ))}
      </motion.div>

      {/* Prev / next arrows */}
      {showArrows && (
        <>
          <button
            type="button"
            onClick={prev}
            disabled={activeIdx === 0}
            aria-label="Previous"
            className="absolute left-2 top-1/2 -translate-y-1/2 z-10 flex items-center justify-center w-9 h-9 rounded-full bg-black/50 text-white/80 hover:text-white border border-white/10 backdrop-blur-sm transition-all disabled:opacity-30 disabled:pointer-events-none hover:-translate-y-1/2 hover:bg-black/70"
          >
            <ChevronLeft size={16} />
          </button>
          <button
            type="button"
            onClick={next}
            disabled={activeIdx >= items.length - 1}
            aria-label="Next"
            className="absolute right-2 top-1/2 -translate-y-1/2 z-10 flex items-center justify-center w-9 h-9 rounded-full bg-black/50 text-white/80 hover:text-white border border-white/10 backdrop-blur-sm transition-all disabled:opacity-30 disabled:pointer-events-none hover:-translate-y-1/2 hover:bg-black/70"
          >
            <ChevronRight size={16} />
          </button>
        </>
      )}

      {/* Dot indicators */}
      {showDots && items.length > 1 && (
        <div className="flex items-center justify-center gap-1.5 mt-3">
          {items.map((_, i) => (
            <button
              key={i}
              type="button"
              onClick={() => scrollTo(i)}
              aria-label={`Go to slide ${i + 1}`}
              className="rounded-full transition-all duration-200"
              style={{
                width: i === activeIdx ? 20 : 6,
                height: 6,
                background: i === activeIdx ? "#D4FF00" : "rgba(255,255,255,0.25)",
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// GalleryCard
// ---------------------------------------------------------------------------

interface GalleryCardProps {
  item: PhotoItem;
  width: number;
}

function GalleryCard({ item, width }: GalleryCardProps) {
  const aspect = item.aspect ?? "4/3";

  return (
    <div
      className="relative shrink-0 overflow-hidden rounded-2xl"
      style={{
        width,
        aspectRatio: aspect,
        background:
          item.gradient ?? "rgba(19,24,39,0.80)",
        border: "1px solid rgba(255,255,255,0.07)",
      }}
    >
      {item.src && (
        <Image
          src={item.src}
          alt={item.alt ?? item.label ?? "Gallery image"}
          fill
          className="object-cover"
          sizes={`${width}px`}
          draggable={false}
        />
      )}

      {item.content && (
        <div className="absolute inset-0 flex items-center justify-center">
          {item.content}
        </div>
      )}

      {(item.label ?? item.sublabel) && (
        <div
          className="absolute bottom-0 left-0 right-0 p-3"
          style={{
            background:
              "linear-gradient(to top, rgba(7,7,8,0.80) 0%, transparent 100%)",
          }}
        >
          {item.label && (
            <p className="text-sm font-medium text-white leading-snug">
              {item.label}
            </p>
          )}
          {item.sublabel && (
            <p className="text-[11px] text-white/55 mt-0.5">{item.sublabel}</p>
          )}
        </div>
      )}
    </div>
  );
}
