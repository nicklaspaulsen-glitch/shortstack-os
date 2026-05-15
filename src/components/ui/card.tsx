/**
 * Card — shared glass card primitive.
 * May 16 glassmorphism overhaul: white-tinted glass on lavender/periwinkle base.
 *
 * Variants:
 *   glass    (default) — rgba(255,255,255,0.75) + blur(14px) + double-border
 *   solid    — bg-white, same radius + shadow, no blur
 *   ghost    — rgba(255,255,255,0.40) + blur(8px), minimal shadow
 *   elevated — rgba(255,255,255,0.92) + blur(20px), stronger shadow
 */

import React from "react";
import { cn } from "@/lib/utils";

type CardVariant = "glass" | "solid" | "ghost" | "elevated";
type CardPadding = "none" | "sm" | "md" | "lg";

interface CardProps extends React.HTMLAttributes<HTMLElement> {
  variant?: CardVariant;
  padding?: CardPadding;
  hover?: boolean;
  as?: "div" | "article" | "section" | "li";
}

const variantStyles: Record<CardVariant, React.CSSProperties> = {
  glass: {
    background: "rgba(255,255,255,0.75)",
    backdropFilter: "blur(14px) saturate(140%)",
    WebkitBackdropFilter: "blur(14px) saturate(140%)",
    border: "1px solid rgba(255,255,255,0.70)",
    boxShadow: "0 0 0 1px rgba(156,167,222,0.20), 0 4px 24px rgba(108,114,172,0.10), 0 1px 4px rgba(0,0,0,0.04)",
    borderRadius: "18px",
  },
  solid: {
    background: "#FFFFFF",
    border: "1px solid rgba(255,255,255,0.70)",
    boxShadow: "0 0 0 1px rgba(156,167,222,0.20), 0 4px 24px rgba(108,114,172,0.10), 0 1px 4px rgba(0,0,0,0.04)",
    borderRadius: "18px",
  },
  ghost: {
    background: "rgba(255,255,255,0.40)",
    backdropFilter: "blur(8px) saturate(130%)",
    WebkitBackdropFilter: "blur(8px) saturate(130%)",
    border: "1px solid rgba(255,255,255,0.50)",
    boxShadow: "0 0 0 1px rgba(156,167,222,0.12), 0 2px 12px rgba(108,114,172,0.06)",
    borderRadius: "18px",
  },
  elevated: {
    background: "rgba(255,255,255,0.92)",
    backdropFilter: "blur(20px) saturate(150%)",
    WebkitBackdropFilter: "blur(20px) saturate(150%)",
    border: "1px solid rgba(255,255,255,0.80)",
    boxShadow: "0 0 0 1px rgba(156,167,222,0.24), 0 8px 32px rgba(108,114,172,0.14), 0 2px 8px rgba(0,0,0,0.06)",
    borderRadius: "18px",
  },
};

const hoverStyles: Record<CardVariant, React.CSSProperties> = {
  glass: {
    background: "rgba(255,255,255,0.88)",
    border: "1px solid rgba(255,255,255,0.80)",
    boxShadow: "0 0 0 1px rgba(156,167,222,0.28), 0 8px 32px rgba(108,114,172,0.14), 0 2px 8px rgba(0,0,0,0.05)",
  },
  solid: {
    boxShadow: "0 0 0 1px rgba(156,167,222,0.28), 0 8px 32px rgba(108,114,172,0.14), 0 2px 8px rgba(0,0,0,0.05)",
  },
  ghost: {
    background: "rgba(255,255,255,0.55)",
    boxShadow: "0 0 0 1px rgba(156,167,222,0.18), 0 4px 18px rgba(108,114,172,0.09)",
  },
  elevated: {
    boxShadow: "0 0 0 1px rgba(156,167,222,0.30), 0 12px 40px rgba(108,114,172,0.18), 0 4px 12px rgba(0,0,0,0.07)",
  },
};

const paddingMap: Record<CardPadding, string> = {
  none: "",
  sm: "p-3",
  md: "p-5",
  lg: "p-7",
};

export function Card({
  variant = "glass",
  padding = "md",
  hover = false,
  as: Tag = "div",
  className,
  style,
  children,
  ...props
}: CardProps) {
  const base = variantStyles[variant];
  const hov = hover ? hoverStyles[variant] : {};

  return (
    <Tag
      className={cn(
        "relative isolate transition-all duration-[280ms] ease-[cubic-bezier(0.22,1,0.36,1)]",
        paddingMap[padding],
        hover && "cursor-pointer hover:-translate-y-0.5",
        className
      )}
      style={{ ...base, ...style }}
      {...props}
    >
      {children}
    </Tag>
  );
}

/** Convenience wrapper that adds hover lift + pointer cursor. */
export function CardHover(props: Omit<CardProps, "hover">) {
  return <Card {...props} hover />;
}

export default Card;
