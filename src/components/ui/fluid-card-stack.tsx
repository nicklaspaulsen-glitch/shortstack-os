"use client";

/**
 * FluidCardStack — Framer-style spring drag-to-reveal card stack.
 *
 * Cards sit stacked with y/rotation offsets. Dragging the top card
 * to the left (or clicking) sends it to the back. The stack springs
 * into the next card with physics.
 *
 * Usage:
 *   <FluidCardStack cards={cardItems} />
 *
 * Props:
 *   cards       — array of card content
 *   fanOffset   — px offset between stacked cards (default: 12)
 *   rotateStep  — deg rotation between cards (default: 4)
 *   dragThreshold — px drag before sending to back (default: 60)
 */

import { useState, type ReactNode } from "react";
import { motion, useMotionValue, useTransform, useSpring, AnimatePresence } from "framer-motion";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CardStackItem {
  id: string;
  content: ReactNode;
}

interface FluidCardStackProps {
  cards: CardStackItem[];
  fanOffset?: number;
  rotateStep?: number;
  dragThreshold?: number;
  className?: string;
  cardClassName?: string;
}

// ---------------------------------------------------------------------------
// FluidCardStack
// ---------------------------------------------------------------------------

export function FluidCardStack({
  cards,
  fanOffset = 12,
  rotateStep = 4,
  dragThreshold = 60,
  className = "",
  cardClassName = "",
}: FluidCardStackProps) {
  const [stack, setStack] = useState(cards.map((c) => c.id));

  const SPRING = { type: "spring" as const, stiffness: 260, damping: 26 };

  function sendToBack() {
    setStack((prev) => {
      const [top, ...rest] = prev;
      return [...rest, top];
    });
  }

  return (
    <div className={`relative ${className}`} style={{ isolation: "isolate" }}>
      <AnimatePresence>
        {stack.map((id, i) => {
          const card = cards.find((c) => c.id === id);
          if (!card) return null;

          const isTop = i === 0;
          const depth = stack.length - 1 - i;

          return (
            <StackCard
              key={id}
              card={card}
              isTop={isTop}
              depth={depth}
              fanOffset={fanOffset}
              rotateStep={rotateStep}
              dragThreshold={dragThreshold}
              onSendToBack={sendToBack}
              spring={SPRING}
              cardClassName={cardClassName}
            />
          );
        })}
      </AnimatePresence>
    </div>
  );
}

// ---------------------------------------------------------------------------
// StackCard — single card in the stack
// ---------------------------------------------------------------------------

interface StackCardProps {
  card: CardStackItem;
  isTop: boolean;
  depth: number;
  fanOffset: number;
  rotateStep: number;
  dragThreshold: number;
  onSendToBack: () => void;
  spring: { type: "spring"; stiffness: number; damping: number };
  cardClassName: string;
}

function StackCard({
  card,
  isTop,
  depth,
  fanOffset,
  rotateStep,
  dragThreshold,
  onSendToBack,
  spring,
  cardClassName,
}: StackCardProps) {
  const x = useMotionValue(0);
  const y = useMotionValue(0);

  // Rotate based on drag distance
  const rotate = useTransform(x, [-200, 200], [-15, 15]);
  const opacity = useTransform(x, [-dragThreshold * 3, 0, dragThreshold * 3], [0, 1, 0]);

  // Stack visual offset (non-top cards)
  const targetY = isTop ? 0 : depth * -fanOffset;
  const targetR = isTop ? 0 : (depth % 2 === 0 ? 1 : -1) * depth * rotateStep;

  const scale = isTop ? 1 : 1 - depth * 0.04;

  function onDragEnd() {
    const xVal = x.get();
    if (Math.abs(xVal) > dragThreshold) {
      onSendToBack();
    } else {
      // Snap back
      x.set(0);
      y.set(0);
    }
  }

  return (
    <motion.div
      className={`absolute inset-0 cursor-grab active:cursor-grabbing ${cardClassName}`}
      style={
        isTop
          ? { x, y, rotate, opacity, zIndex: 10 }
          : {
              y: targetY,
              rotate: targetR,
              scale,
              zIndex: 10 - depth,
              pointerEvents: "none",
            }
      }
      animate={!isTop ? { y: targetY, rotate: targetR, scale } : undefined}
      transition={spring}
      drag={isTop ? "x" : false}
      dragConstraints={{ left: -300, right: 300, top: -100, bottom: 100 }}
      dragElastic={0.3}
      onDragEnd={onDragEnd}
      whileDrag={{ scale: 1.04 }}
      onClick={isTop ? onSendToBack : undefined}
    >
      {card.content}
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// FluidCardStackPreview — demo wrapper with fixed size
// ---------------------------------------------------------------------------

interface FluidCardStackPreviewProps {
  cards: CardStackItem[];
  width?: number;
  height?: number;
}

export function FluidCardStackPreview({
  cards,
  width = 320,
  height = 200,
}: FluidCardStackPreviewProps) {
  return (
    <div
      className="relative mx-auto"
      style={{ width, height: height + 40 /* room for fan */ }}
    >
      <FluidCardStack
        cards={cards}
        cardClassName="rounded-2xl overflow-hidden"
        className="w-full"
      />
    </div>
  );
}
