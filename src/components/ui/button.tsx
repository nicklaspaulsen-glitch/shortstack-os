/**
 * Button — shared button primitive.
 * May 16 glassmorphism overhaul.
 *
 * Variants:
 *   primary   — #2563EB solid, white text, 8px radius, glow shadow
 *   secondary — glass chip rgba(255,255,255,0.85) + periwinkle border
 *   ghost     — transparent, text-text-secondary, hover bg tint
 *   pill      — rounded-full with icon+label (matches Dribbble prompt chips)
 *   chip      — compact label pill for tags/filters
 *   danger    — red destructive action
 */

import React from "react";
import { cn } from "@/lib/utils";

type ButtonVariant = "primary" | "secondary" | "ghost" | "pill" | "chip" | "danger";
type ButtonSize = "sm" | "md" | "lg";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  loading?: boolean;
  as?: "button" | "a";
  href?: string;
}

const baseClasses =
  "inline-flex items-center justify-center gap-2 font-medium select-none cursor-pointer transition-all duration-[150ms] ease-[cubic-bezier(0.22,1,0.36,1)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-brand-accent disabled:pointer-events-none disabled:opacity-50";

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    "bg-[#2563EB] text-white rounded-lg shadow-[0_2px_8px_rgba(59,130,246,0.28)] hover:bg-[#1D4ED8] hover:shadow-[0_4px_16px_rgba(59,130,246,0.40)] active:translate-y-px active:shadow-[0_1px_4px_rgba(59,130,246,0.20)]",
  secondary:
    "bg-[rgba(255,255,255,0.85)] border border-[rgba(156,167,222,0.30)] text-text-primary rounded-full backdrop-blur-sm hover:bg-[rgba(255,255,255,0.95)] hover:border-[rgba(156,167,222,0.50)] hover:shadow-[0_2px_12px_rgba(108,114,172,0.12)]",
  ghost:
    "bg-transparent text-text-secondary rounded-lg hover:bg-[rgba(108,114,172,0.07)] hover:text-text-primary active:bg-[rgba(108,114,172,0.12)]",
  pill:
    "bg-[rgba(255,255,255,0.80)] border border-[rgba(156,167,222,0.26)] text-text-secondary rounded-full backdrop-blur-sm hover:bg-[rgba(255,255,255,0.92)] hover:border-[rgba(156,167,222,0.42)] hover:text-text-primary hover:shadow-[0_2px_10px_rgba(108,114,172,0.10)]",
  chip:
    "bg-[rgba(108,114,172,0.09)] border border-[rgba(156,167,222,0.22)] text-text-secondary rounded-full hover:bg-[rgba(108,114,172,0.15)] hover:border-[rgba(156,167,222,0.36)] hover:text-text-primary",
  danger:
    "bg-[rgba(242,96,99,0.08)] border border-[rgba(242,96,99,0.22)] text-[#F26063] rounded-lg hover:bg-[rgba(242,96,99,0.14)] hover:border-[rgba(242,96,99,0.36)]",
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: "h-7 px-3 text-xs",
  md: "h-9 px-4 text-sm",
  lg: "h-11 px-6 text-sm",
};

const chipSizeClasses: Record<ButtonSize, string> = {
  sm: "h-6 px-2.5 text-xs",
  md: "h-7 px-3 text-xs",
  lg: "h-9 px-4 text-sm",
};

export function Button({
  variant = "primary",
  size = "md",
  leftIcon,
  rightIcon,
  loading = false,
  as: Tag = "button",
  href,
  className,
  children,
  disabled,
  ...props
}: ButtonProps) {
  const isCompact = variant === "chip";
  const sz = isCompact ? chipSizeClasses[size] : sizeClasses[size];

  const content = (
    <>
      {loading && (
        <svg className="animate-spin -ml-0.5 h-3.5 w-3.5" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      )}
      {!loading && leftIcon}
      {children}
      {rightIcon}
    </>
  );

  if (Tag === "a" && href) {
    return (
      <a
        href={href}
        className={cn(baseClasses, variantClasses[variant], sz, className)}
        {...(props as React.AnchorHTMLAttributes<HTMLAnchorElement>)}
      >
        {content}
      </a>
    );
  }

  return (
    <button
      className={cn(baseClasses, variantClasses[variant], sz, className)}
      disabled={disabled || loading}
      {...(props as React.ButtonHTMLAttributes<HTMLButtonElement>)}
    >
      {content}
    </button>
  );
}

export default Button;
