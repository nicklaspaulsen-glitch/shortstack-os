"use client";

/**
 * FlowButton — morphing circle-expand CTA.
 * Hover: pill shrinks border-radius → rect, circle expands from center,
 * left arrow slides in while right arrow slides out.
 * Adapted from 21st.dev/r/serafimcloud/flow-button for ShortStack brand tokens.
 */

import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface FlowButtonProps {
  children?: React.ReactNode;
  text?: string;
  /** Fill color on hover — defaults to brand accent blue */
  fillColor?: string;
  className?: string;
  onClick?: () => void;
  disabled?: boolean;
  type?: "button" | "submit" | "reset";
}

export function FlowButton({
  children,
  text,
  fillColor = "#D4FF00",
  className,
  onClick,
  disabled,
  type = "button",
}: FlowButtonProps) {
  const label = children ?? text ?? "Get started";

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "group relative flex items-center gap-1 overflow-hidden",
        "rounded-full border border-[rgba(212,255,0,0.35)] bg-transparent",
        "px-7 py-2.5 text-sm font-semibold text-[#D4FF00]",
        "cursor-pointer select-none",
        "transition-all duration-[600ms] ease-[cubic-bezier(0.23,1,0.32,1)]",
        "hover:border-transparent hover:text-white hover:rounded-xl",
        "active:scale-[0.97]",
        "disabled:pointer-events-none disabled:opacity-50",
        className
      )}
      style={{ "--fill": fillColor } as React.CSSProperties}
    >
      {/* Sliding-in left arrow */}
      <ArrowRight
        className={cn(
          "absolute left-[-20%] h-4 w-4 fill-none",
          "transition-all duration-[700ms] ease-[cubic-bezier(0.34,1.56,0.64,1)]",
          "group-hover:left-3.5 group-hover:stroke-white",
          "stroke-[#D4FF00] z-10"
        )}
      />

      {/* Label — shifts right on hover to make room for left arrow */}
      <span
        className={cn(
          "relative z-10",
          "-translate-x-2 transition-all duration-[700ms] ease-out",
          "group-hover:translate-x-2.5"
        )}
      >
        {label}
      </span>

      {/* Sliding-out right arrow */}
      <ArrowRight
        className={cn(
          "absolute right-3.5 h-4 w-4 fill-none",
          "stroke-[#D4FF00] z-10",
          "transition-all duration-[700ms] ease-[cubic-bezier(0.34,1.56,0.64,1)]",
          "group-hover:right-[-20%] group-hover:stroke-white"
        )}
      />

      {/* Circle that expands to fill the button */}
      <span
        className={cn(
          "absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2",
          "h-4 w-4 rounded-full opacity-0",
          "transition-all duration-[750ms] ease-[cubic-bezier(0.19,1,0.22,1)]",
          "group-hover:h-[240px] group-hover:w-[240px] group-hover:opacity-100"
        )}
        style={{ backgroundColor: fillColor }}
      />
    </button>
  );
}

export default FlowButton;
