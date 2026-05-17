"use client";

/**
 * GlassCardShuffle — Framer-style layoutId-powered card reorder.
 *
 * Renders a deck of glass cards. Clicking any non-top card promotes
 * it to the top with a shared-layout animation. The previous top card
 * slides into the stack with a spring transition.
 *
 * Usage:
 *   <GlassCardShuffle cards={cardItems} />
 *
 * Props:
 *   cards        — array of card data (id, content, accent colour)
 *   stackOffset  — px offset per depth level (default: 10)
 *   rotateStep   — deg rotation per depth level (default: 3)
 *   className    — wrapper class
 *   cardClassName — extra class on every card
 */

import { useState, type ReactNode } from "react";
import { motion, AnimatePresence, LayoutGroup } from "framer-motion";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ShuffleCard {
  id: string;
  content?: ReactNode;
  /** Optional accent colour used for the card's glow / border tint */
  accent?: string;
  /** Short title rendered as a fallback when content is absent */
  title?: string;
  subtitle?: string;
}

interface GlassCardShuffleProps {
  cards: ShuffleCard[];
  /** px offset between stacked cards (default: 10) */
  stackOffset?: number;
  /** rotation step per depth in degrees (default: 3) */
  rotateStep?: number;
  /** Width of cards in px (default: 280) */
  cardWidth?: number;
  /** Height of cards in px (default: 180) */
  cardHeight?: number;
  className?: string;
  cardClassName?: string;
}

// ---------------------------------------------------------------------------
// Spring config
// ---------------------------------------------------------------------------

const SPRING = { type: "spring" as const, stiffness: 320, damping: 30 };

// ---------------------------------------------------------------------------
// GlassCardShuffle
// ---------------------------------------------------------------------------

export function GlassCardShuffle({
  cards,
  stackOffset = 10,
  rotateStep = 3,
  cardWidth = 280,
  cardHeight = 180,
  className = "",
  cardClassName = "",
}: GlassCardShuffleProps) {
  // `order` is the display stack — index 0 is the top card
  const [order, setOrder] = useState(cards.map((c) => c.id));

  function promote(id: string) {
    setOrder((prev) => {
      if (prev[0] === id) return prev;           // already on top
      return [id, ...prev.filter((x) => x !== id)];
    });
  }

  // Extra height to accommodate the fanned stack behind the top card
  const wrapH = cardHeight + stackOffset * (cards.length - 1) + 20;

  return (
    <LayoutGroup>
      <div
        className={`relative mx-auto ${className}`}
        style={{ width: cardWidth, height: wrapH }}
      >
        <AnimatePresence initial={false}>
          {order.map((id, idx) => {
            const card  = cards.find((c) => c.id === id);
            if (!card) return null;

            const isTop  = idx === 0;
            const depth  = order.length - 1 - idx;          // 0 = bottom-most
            const rot    = isTop ? 0 : (idx % 2 === 0 ? 1 : -1) * idx * rotateStep;
            const yOff   = isTop ? 0 : idx * stackOffset;
            const scale  = isTop ? 1 : 1 - idx * 0.04;
            const zIdx   = order.length - idx;

            return (
              <motion.div
                key={id}
                layoutId={id}
                transition={SPRING}
                animate={{
                  y: yOff,
                  rotate: rot,
                  scale,
                  zIndex: zIdx,
                }}
                initial={false}
                className={`absolute top-0 left-0 ${cardClassName}`}
                style={{
                  width: cardWidth,
                  height: cardHeight,
                  zIndex: zIdx,
                  cursor: isTop ? "default" : "pointer",
                  // prevent accidental text-select while shuffling
                  userSelect: "none",
                }}
                onClick={() => !isTop && promote(id)}
                whileHover={!isTop ? { scale: scale + 0.03, transition: { duration: 0.15 } } : undefined}
                whileTap={!isTop ? { scale: scale - 0.02 } : undefined}
              >
                <CardFace card={card} isTop={isTop} />
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </LayoutGroup>
  );
}

// ---------------------------------------------------------------------------
// CardFace — visual layer
// ---------------------------------------------------------------------------

interface CardFaceProps {
  card: ShuffleCard;
  isTop: boolean;
}

function CardFace({ card, isTop }: CardFaceProps) {
  const accent = card.accent ?? "rgba(59,130,246,0.50)";

  return (
    <div
      className="w-full h-full rounded-2xl overflow-hidden flex flex-col justify-between"
      style={{
        background: "rgba(19,24,39,0.82)",
        border: `1px solid ${isTop ? accent : "rgba(255,255,255,0.07)"}`,
        backdropFilter: "blur(16px) saturate(160%)",
        boxShadow: isTop
          ? `0 4px 32px ${accent}33, 0 0 0 1px ${accent}22`
          : "0 2px 12px rgba(0,0,0,0.40)",
        transition: "border-color 0.3s, box-shadow 0.3s",
      }}
    >
      {/* Accent top bar */}
      <div
        className="h-1 w-full rounded-t-2xl"
        style={{
          background: `linear-gradient(90deg, ${accent}, transparent)`,
          opacity: isTop ? 1 : 0.4,
        }}
      />

      {/* Card body */}
      <div className="flex-1 p-4">
        {card.content ? (
          <div className="w-full h-full flex items-center justify-center">
            {card.content}
          </div>
        ) : (
          <>
            {card.title && (
              <p
                className="text-sm font-semibold leading-snug"
                style={{ color: isTop ? "#F0F0F4" : "#A8A8B2" }}
              >
                {card.title}
              </p>
            )}
            {card.subtitle && (
              <p
                className="text-[11px] mt-1"
                style={{ color: "#4A4A5A" }}
              >
                {card.subtitle}
              </p>
            )}
          </>
        )}
      </div>

      {/* "Tap to bring forward" hint on non-top cards */}
      {!isTop && (
        <div className="px-4 pb-3">
          <p className="text-[10px] text-white/20 font-medium tracking-wide uppercase">
            Click to bring forward
          </p>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// GlassCardShuffleDemo — pre-wired demo for quick embedding
// ---------------------------------------------------------------------------

const DEMO_CARDS: ShuffleCard[] = [
  {
    id: "analytics",
    accent: "rgba(59,130,246,0.70)",
    title: "Analytics",
    subtitle: "Track performance across all campaigns",
  },
  {
    id: "clients",
    accent: "rgba(168,85,247,0.60)",
    title: "Client Portal",
    subtitle: "White-label client dashboards",
  },
  {
    id: "voice",
    accent: "rgba(34,197,94,0.55)",
    title: "Voice Studio",
    subtitle: "Clone voices, build dialer presets",
  },
  {
    id: "ai",
    accent: "rgba(251,191,36,0.55)",
    title: "AI Studio",
    subtitle: "Generate content at agency scale",
  },
];

export function GlassCardShuffleDemo() {
  return (
    <div className="flex flex-col items-center gap-6 py-8">
      <GlassCardShuffle cards={DEMO_CARDS} />
      <p className="text-xs text-white/30 tracking-wide">Click any card to bring it forward</p>
    </div>
  );
}
