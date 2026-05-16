"use client";

/**
 * GlassButton — Framer-inspired glass button system for ShortStack OS.
 *
 * Variants:
 *   default   — filled blue pill (primary action)
 *   ghost     — outlined, transparent (secondary action)
 *   glass     — frosted dark glass (utility / toolbar)
 *   conic     — animated conic-gradient border (feature-highlighted CTA)
 *   glow      — filled blue with radial glow shadow (hero CTA)
 *   metal     — dark with shimmering metal sheen (premium / billing)
 *
 * Sizes: sm | md | lg
 */

import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";
import { motion, useMotionValue, useTransform, useSpring } from "framer-motion";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type GlassVariant = "default" | "ghost" | "glass" | "conic" | "glow" | "metal";
type GlassSize    = "sm" | "md" | "lg";

interface GlassButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: GlassVariant;
  size?: GlassSize;
  icon?: ReactNode;
  iconRight?: ReactNode;
  loading?: boolean;
  children: ReactNode;
  asChild?: boolean;
  /** Glow color override (CSS color string). Defaults to brand blue. */
  glowColor?: string;
}

// ---------------------------------------------------------------------------
// Size map
// ---------------------------------------------------------------------------

const sizeMap: Record<GlassSize, string> = {
  sm: "h-8  px-3.5  text-[11px] gap-1.5  rounded-[10px]",
  md: "h-9  px-4    text-[12px] gap-2    rounded-[12px]",
  lg: "h-11 px-5    text-[13px] gap-2.5  rounded-[14px]",
};

const iconSizeMap: Record<GlassSize, number> = {
  sm: 13,
  md: 14,
  lg: 16,
};

// ---------------------------------------------------------------------------
// Base styles shared by all variants
// ---------------------------------------------------------------------------

const base =
  "relative inline-flex items-center justify-center select-none font-medium leading-none " +
  "outline-none focus-visible:ring-2 focus-visible:ring-[#3B82F6]/50 " +
  "disabled:pointer-events-none disabled:opacity-40 " +
  "transition-all duration-200 ease-[cubic-bezier(0.32,0.72,0,1)] " +
  "cursor-pointer shrink-0";

// ---------------------------------------------------------------------------
// Variant style objects
// ---------------------------------------------------------------------------

const variantStyles: Record<GlassVariant, { wrapper: string; inner?: string }> = {
  default: {
    wrapper:
      "bg-[#3B82F6] text-white " +
      "border border-[rgba(59,130,246,0.60)] " +
      "shadow-[0_2px_8px_rgba(59,130,246,0.35)] " +
      "hover:bg-[#2563EB] hover:shadow-[0_4px_16px_rgba(59,130,246,0.50)] " +
      "hover:-translate-y-px active:translate-y-0 active:shadow-none",
  },
  ghost: {
    wrapper:
      "bg-transparent text-[#A8A8B2] " +
      "border border-[rgba(99,146,255,0.18)] " +
      "hover:bg-[rgba(59,130,246,0.08)] hover:text-[#C8C8D4] hover:border-[rgba(99,146,255,0.32)] " +
      "active:bg-[rgba(59,130,246,0.12)]",
  },
  glass: {
    wrapper:
      "bg-[rgba(19,24,39,0.72)] text-[#A8A8B2] " +
      "border border-[rgba(255,255,255,0.08)] " +
      "backdrop-blur-[14px] saturate-150 " +
      "shadow-[0_1px_0_rgba(255,255,255,0.06)_inset,0_2px_12px_rgba(0,0,0,0.28)] " +
      "hover:bg-[rgba(28,35,56,0.80)] hover:text-[#F0F0F4] hover:border-[rgba(255,255,255,0.13)] " +
      "hover:shadow-[0_1px_0_rgba(255,255,255,0.10)_inset,0_4px_16px_rgba(0,0,0,0.36)] " +
      "hover:-translate-y-px active:translate-y-0",
  },
  conic: {
    // Handled specially via wrapper element + ::before for animated conic border
    wrapper:
      "bg-[rgba(13,17,32,0.90)] text-[#F0F0F4] " +
      "shadow-[0_2px_12px_rgba(0,0,0,0.30)] " +
      "hover:-translate-y-px active:translate-y-0",
  },
  glow: {
    wrapper:
      "bg-[#3B82F6] text-white font-semibold " +
      "border border-[rgba(96,165,250,0.40)] " +
      "shadow-[0_0_0_1px_rgba(59,130,246,0.30),0_4px_20px_rgba(59,130,246,0.55),0_0_60px_rgba(59,130,246,0.20)] " +
      "hover:shadow-[0_0_0_1px_rgba(59,130,246,0.50),0_6px_28px_rgba(59,130,246,0.70),0_0_80px_rgba(59,130,246,0.30)] " +
      "hover:bg-[#2563EB] hover:-translate-y-0.5 active:translate-y-0",
  },
  metal: {
    wrapper:
      "text-[#D4D4D8] " +
      "border border-[rgba(255,255,255,0.10)] " +
      "shadow-[0_1px_0_rgba(255,255,255,0.08)_inset,0_-1px_0_rgba(0,0,0,0.20)_inset,0_4px_16px_rgba(0,0,0,0.40)] " +
      "hover:text-white hover:border-[rgba(255,255,255,0.18)] " +
      "hover:-translate-y-px active:translate-y-0 " +
      "overflow-hidden",
  },
};

// ---------------------------------------------------------------------------
// Loading spinner
// ---------------------------------------------------------------------------

function Spinner() {
  return (
    <svg
      className="animate-spin shrink-0"
      width={14}
      height={14}
      viewBox="0 0 14 14"
      fill="none"
      aria-hidden
    >
      <circle
        cx="7" cy="7" r="5.5"
        stroke="currentColor"
        strokeOpacity={0.25}
        strokeWidth={2}
      />
      <path
        d="M7 1.5A5.5 5.5 0 0 1 12.5 7"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
      />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// ConicBorder — animated rotating conic-gradient ring
// ---------------------------------------------------------------------------

const ConicBorderInner = forwardRef<
  HTMLButtonElement,
  { size: GlassSize; children: ReactNode; className?: string } & ButtonHTMLAttributes<HTMLButtonElement>
>(function ConicBorderInner({ size, children, className, ...props }, ref) {
  const sizeClass = sizeMap[size];

  return (
    <span className="relative inline-flex p-[1.5px] rounded-[14px] conic-border-animate overflow-hidden">
      {/* The animated gradient lives in the CSS via @keyframes */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0 rounded-[14px] conic-border-ring"
      />
      <button
        ref={ref}
        className={cn(
          base,
          sizeClass,
          variantStyles.conic.wrapper,
          "z-10 rounded-[12.5px]",
          className,
        )}
        {...props}
      >
        {children}
      </button>
    </span>
  );
});

// ---------------------------------------------------------------------------
// MetalSheen — shimmering light sweep for metal variant
// ---------------------------------------------------------------------------

function MetalSheen() {
  return (
    <span
      aria-hidden
      className="pointer-events-none absolute inset-0 rounded-[inherit] overflow-hidden"
    >
      <span className="metal-sheen-sweep absolute inset-0" />
    </span>
  );
}

// ---------------------------------------------------------------------------
// Magnetic hover — slight pull toward cursor
// ---------------------------------------------------------------------------

function useMagnet(strength = 0.15) {
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const sx = useSpring(x, { stiffness: 400, damping: 28 });
  const sy = useSpring(y, { stiffness: 400, damping: 28 });

  function handleMove(e: React.MouseEvent<HTMLElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    x.set((e.clientX - cx) * strength);
    y.set((e.clientY - cy) * strength);
  }
  function handleLeave() {
    x.set(0);
    y.set(0);
  }

  return { sx, sy, handleMove, handleLeave };
}

// ---------------------------------------------------------------------------
// GlassButton
// ---------------------------------------------------------------------------

export const GlassButton = forwardRef<HTMLButtonElement, GlassButtonProps>(
  function GlassButton(
    {
      variant = "default",
      size = "md",
      icon,
      iconRight,
      loading = false,
      children,
      className,
      glowColor,
      style,
      ...props
    },
    ref,
  ) {
    const sizeClass = sizeMap[size];
    const { wrapper } = variantStyles[variant];
    const { sx, sy, handleMove, handleLeave } = useMagnet(variant === "glow" ? 0.20 : 0.10);

    const glowStyle =
      variant === "glow" && glowColor
        ? ({
            "--glow-color": glowColor,
            boxShadow: `0 0 0 1px ${glowColor}50,0 4px 20px ${glowColor}88,0 0 60px ${glowColor}33`,
          } as React.CSSProperties)
        : undefined;

    const metalBg =
      variant === "metal"
        ? ({
            background:
              "linear-gradient(135deg, #1E2336 0%, #2A3350 40%, #1A1F2E 60%, #252B3A 100%)",
          } as React.CSSProperties)
        : undefined;

    // Conic variant uses a wrapper element
    if (variant === "conic") {
      return (
        <ConicBorderInner size={size} className={className} ref={ref} style={style} {...props}>
          {loading ? <Spinner /> : icon}
          <span>{children}</span>
          {!loading && iconRight}
        </ConicBorderInner>
      );
    }

    return (
      <motion.button
        ref={ref as React.Ref<HTMLButtonElement>}
        style={{ x: sx, y: sy, ...glowStyle, ...metalBg, ...style }}
        onMouseMove={handleMove}
        onMouseLeave={handleLeave}
        className={cn(base, sizeClass, wrapper, className)}
        {...(props as React.ComponentProps<typeof motion.button>)}
      >
        {variant === "metal" && <MetalSheen />}
        {loading ? <Spinner /> : icon}
        <span className="relative">{children}</span>
        {!loading && iconRight}
      </motion.button>
    );
  },
);

GlassButton.displayName = "GlassButton";

export type { GlassVariant, GlassSize, GlassButtonProps };
