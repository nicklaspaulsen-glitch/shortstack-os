"use client";

/**
 * TiltCard — Framer-style mouse-tracking 3D perspective tilt card.
 *
 * On mouse move, the card rotates around X and Y axes following
 * the cursor position relative to the card's center.
 * A specular "glare" overlay tracks the cursor for realism.
 *
 * Usage:
 *   <TiltCard>
 *     <YourContent />
 *   </TiltCard>
 *
 * Props:
 *   maxTilt      — max degrees of rotation (default: 12)
 *   perspective  — CSS perspective in px (default: 800)
 *   glare        — show specular glare layer (default: true)
 *   glareOpacity — max glare opacity 0-1 (default: 0.12)
 *   scale        — hover scale factor (default: 1.04)
 *   speed        — spring stiffness (default: 280) - higher = snappier
 *   className    — additional Tailwind classes
 */

import { useRef, type ReactNode } from "react";
import { motion, useMotionValue, useSpring, useTransform } from "framer-motion";

interface TiltCardProps {
  children: ReactNode;
  maxTilt?: number;
  perspective?: number;
  glare?: boolean;
  glareOpacity?: number;
  scale?: number;
  speed?: number;
  className?: string;
  style?: React.CSSProperties;
}

export function TiltCard({
  children,
  maxTilt = 12,
  perspective = 800,
  glare = true,
  glareOpacity = 0.12,
  scale = 1.04,
  speed = 280,
  className = "",
  style,
}: TiltCardProps) {
  const ref = useRef<HTMLDivElement>(null);

  // Raw mouse values -0.5..0.5 relative to card center
  const rawX = useMotionValue(0);
  const rawY = useMotionValue(0);
  const rawGlX = useMotionValue(50); // glare X%
  const rawGlY = useMotionValue(50); // glare Y%
  const rawScale = useMotionValue(1);

  // Spring physics
  const SPRING = { stiffness: speed, damping: 28 };
  const x = useSpring(rawX, SPRING);
  const y = useSpring(rawY, SPRING);
  const glX = useSpring(rawGlX, SPRING);
  const glY = useSpring(rawGlY, SPRING);
  const scaleSp = useSpring(rawScale, SPRING);

  // Map to CSS rotations
  const rotY  = useTransform(x, [-0.5, 0.5], [-maxTilt, maxTilt]);
  const rotX  = useTransform(y, [-0.5, 0.5], [maxTilt, -maxTilt]);

  function onMouseMove(e: React.MouseEvent<HTMLDivElement>) {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const cx = (e.clientX - rect.left) / rect.width  - 0.5;
    const cy = (e.clientY - rect.top)  / rect.height - 0.5;
    rawX.set(cx);
    rawY.set(cy);
    rawGlX.set(((e.clientX - rect.left) / rect.width)  * 100);
    rawGlY.set(((e.clientY - rect.top)  / rect.height) * 100);
  }

  function onMouseEnter() { rawScale.set(scale); }

  function onMouseLeave() {
    rawX.set(0);
    rawY.set(0);
    rawGlX.set(50);
    rawGlY.set(50);
    rawScale.set(1);
  }

  // Glare gradient: radial from cursor position
  const glareBackground = useTransform(
    [glX, glY],
    ([gx, gy]) =>
      `radial-gradient(circle at ${gx}% ${gy}%, rgba(255,255,255,${glareOpacity}) 0%, transparent 70%)`,
  );

  return (
    <div
      ref={ref}
      style={{ perspective, ...style }}
      onMouseMove={onMouseMove}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      className={className}
    >
      <motion.div
        style={{
          rotateX: rotX,
          rotateY: rotY,
          scale: scaleSp,
          transformStyle: "preserve-3d",
        }}
        transition={{ type: "spring", ...SPRING }}
        className="relative w-full h-full"
      >
        {children}

        {/* Specular glare layer */}
        {glare && (
          <motion.div
            aria-hidden
            className="absolute inset-0 rounded-[inherit] pointer-events-none"
            style={{ background: glareBackground }}
          />
        )}
      </motion.div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// TiltCardGrid — ready-made section with a tilt card grid
// ---------------------------------------------------------------------------

export interface TiltCardItem {
  icon?: ReactNode;
  label: string;
  description: string;
  /** Optional accent color used for icon glow */
  color?: string;
}

interface TiltCardGridProps {
  items: TiltCardItem[];
  columns?: 2 | 3 | 4;
  className?: string;
}

export function TiltCardGrid({ items, columns = 3, className = "" }: TiltCardGridProps) {
  const colClass = {
    2: "md:grid-cols-2",
    3: "md:grid-cols-3",
    4: "md:grid-cols-4",
  }[columns];

  return (
    <div className={`grid grid-cols-1 ${colClass} gap-4 ${className}`}>
      {items.map((item) => (
        <TiltCard key={item.label} maxTilt={10} scale={1.03}>
          <div
            className="h-full rounded-2xl p-6 flex flex-col gap-3"
            style={{
              background: "rgba(19,24,39,0.72)",
              border: "1px solid rgba(99,146,255,0.12)",
              backdropFilter: "blur(12px)",
              boxShadow: "0 1px 0 rgba(255,255,255,0.04) inset, 0 4px 24px rgba(0,0,0,0.30)",
            }}
          >
            {item.icon && (
              <span
                className="flex items-center justify-center w-10 h-10 rounded-xl mb-1"
                style={{
                  background: item.color
                    ? `${item.color}18`
                    : "rgba(59,130,246,0.15)",
                  color: item.color ?? "#3B82F6",
                  boxShadow: item.color
                    ? `0 0 14px ${item.color}30`
                    : "0 0 14px rgba(59,130,246,0.22)",
                }}
              >
                {item.icon}
              </span>
            )}
            <p className="text-sm font-semibold text-white">{item.label}</p>
            <p className="text-xs text-text-muted leading-relaxed">{item.description}</p>
          </div>
        </TiltCard>
      ))}
    </div>
  );
}
