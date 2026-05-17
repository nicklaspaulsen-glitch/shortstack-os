"use client";

/**
 * IconSlideInButton — Framer-style icon that slides in on hover.
 *
 * Label slides left and icon slides in from the right (or left)
 * on hover, revealing the icon inline. Both elements share an
 * overflow-hidden clip for a clean reveal.
 *
 * Usage:
 *   <IconSlideInButton icon={<ArrowRight size={14} />}>
 *     Get started
 *   </IconSlideInButton>
 *
 * Props:
 *   icon        — icon element to reveal
 *   direction   — "right" (default) | "left" — which side icon slides from
 *   variant     — visual style matching GlassButton variants
 *   size        — "sm" | "md" | "lg"
 *   href        — renders as <a> when provided
 *   asDiv       — renders as <div> when true
 */

import { type ReactNode, forwardRef } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

type SlideDirection = "right" | "left";
type SlideVariant = "default" | "ghost" | "glass" | "glow";
type SlideSize = "sm" | "md" | "lg";

interface IconSlideInButtonProps {
  icon: ReactNode;
  children: ReactNode;
  direction?: SlideDirection;
  variant?: SlideVariant;
  size?: SlideSize;
  className?: string;
  href?: string;
  onClick?: React.MouseEventHandler;
  disabled?: boolean;
  type?: "button" | "submit" | "reset";
}

const sizeMap: Record<SlideSize, string> = {
  sm: "h-8 px-3.5 text-[11px] gap-1.5 rounded-[10px]",
  md: "h-9 px-4 text-[12px] gap-2 rounded-[12px]",
  lg: "h-11 px-5 text-[13px] gap-2.5 rounded-[14px]",
};

const iconGapMap: Record<SlideSize, number> = { sm: 6, md: 8, lg: 10 };

const variantMap: Record<SlideVariant, string> = {
  default:
    "bg-[#3B82F6] text-white border border-[rgba(59,130,246,0.60)] shadow-[0_2px_8px_rgba(59,130,246,0.35)] hover:bg-[#2563EB] hover:shadow-[0_4px_16px_rgba(59,130,246,0.50)]",
  ghost:
    "bg-transparent text-[#A8A8B2] border border-[rgba(99,146,255,0.18)] hover:bg-[rgba(59,130,246,0.08)] hover:text-[#C8C8D4] hover:border-[rgba(99,146,255,0.32)]",
  glass:
    "bg-[rgba(19,24,39,0.72)] text-[#A8A8B2] border border-[rgba(255,255,255,0.08)] backdrop-blur-[14px] hover:bg-[rgba(28,35,56,0.80)] hover:text-[#F0F0F4]",
  glow:
    "bg-[#3B82F6] text-white font-semibold border border-[rgba(96,165,250,0.40)] shadow-[0_0_0_1px_rgba(59,130,246,0.30),0_4px_20px_rgba(59,130,246,0.55)] hover:shadow-[0_0_0_1px_rgba(59,130,246,0.50),0_6px_28px_rgba(59,130,246,0.70)]",
};

const base =
  "relative inline-flex items-center justify-center select-none font-medium leading-none " +
  "outline-none focus-visible:ring-2 focus-visible:ring-[#3B82F6]/50 " +
  "disabled:pointer-events-none disabled:opacity-40 " +
  "transition-all duration-200 ease-[cubic-bezier(0.32,0.72,0,1)] " +
  "cursor-pointer shrink-0 overflow-hidden group";

const ICON_VARIANTS = (direction: SlideDirection) => ({
  rest: { x: direction === "right" ? 14 : -14, opacity: 0 },
  hover: { x: 0, opacity: 1 },
});

const LABEL_VARIANTS = (direction: SlideDirection, gap: number) => ({
  rest: { x: 0 },
  hover: { x: direction === "right" ? -gap : gap },
});

const TRANSITION = { type: "spring" as const, stiffness: 380, damping: 28 };

export const IconSlideInButton = forwardRef<
  HTMLButtonElement,
  IconSlideInButtonProps
>(function IconSlideInButton(
  {
    icon,
    children,
    direction = "right",
    variant = "default",
    size = "md",
    className,
    href,
    onClick,
    disabled,
    type = "button",
  },
  ref,
) {
  const gap = iconGapMap[size];
  const iconV = ICON_VARIANTS(direction);
  const labelV = LABEL_VARIANTS(direction, gap);

  const inner = (
    <motion.span
      initial="rest"
      whileHover="hover"
      className={cn(
        base,
        sizeMap[size],
        variantMap[variant],
        className,
      )}
    >
      {/* Label — slides away from icon */}
      <motion.span variants={labelV} transition={TRANSITION}>
        {children}
      </motion.span>

      {/* Icon — slides in */}
      <motion.span
        variants={iconV}
        transition={TRANSITION}
        className="absolute"
        style={{
          right: direction === "right" ? 14 : "auto",
          left:  direction === "left"  ? 14 : "auto",
        }}
      >
        {icon}
      </motion.span>
    </motion.span>
  );

  if (href) {
    return <a href={href} className="inline-flex">{inner}</a>;
  }

  return (
    <button
      ref={ref}
      type={type}
      onClick={onClick}
      disabled={disabled}
      className="inline-flex"
    >
      {inner}
    </button>
  );
});

IconSlideInButton.displayName = "IconSlideInButton";
