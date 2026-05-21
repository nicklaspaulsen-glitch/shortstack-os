"use client";

/**
 * LiquidGlassButton — SVG feTurbulence glass distortion button.
 * Creates a tactile "liquid glass" feel using an SVG filter pipeline:
 *   feTurbulence → feDisplacementMap → feGaussianBlur → feComposite
 * The filter is applied via CSS backdrop-filter to create real glass distortion.
 * Adapted from 21st.dev/r/serafimcloud/liquid-glass-button.
 */

import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

interface LiquidGlassButtonProps {
  children: ReactNode;
  className?: string;
  onClick?: () => void;
  disabled?: boolean;
  type?: "button" | "submit" | "reset";
  size?: "sm" | "md" | "lg";
}

/** Unique filter ID per page to avoid SVG filter namespace collisions */
const FILTER_ID = "liquid-glass-filter-btn";

export function LiquidGlassButton({
  children,
  className,
  onClick,
  disabled,
  type = "button",
  size = "md",
}: LiquidGlassButtonProps) {
  const sizeClasses = {
    sm: "h-8 px-4 text-xs",
    md: "h-10 px-6 text-sm",
    lg: "h-12 px-8 text-base",
  };

  return (
    <>
      {/* Hidden SVG filter definition — rendered once per component usage */}
      <svg
        aria-hidden="true"
        width="0"
        height="0"
        style={{ position: "absolute", pointerEvents: "none" }}
      >
        <defs>
          <filter id={FILTER_ID} x="-20%" y="-20%" width="140%" height="140%">
            {/* Organic noise texture */}
            <feTurbulence
              type="fractalNoise"
              baseFrequency="0.65"
              numOctaves="3"
              seed="2"
              result="noise"
            />
            {/* Displace the source graphic using the noise */}
            <feDisplacementMap
              in="SourceGraphic"
              in2="noise"
              scale="8"
              xChannelSelector="R"
              yChannelSelector="G"
              result="displaced"
            />
            {/* Slight blur for the frosted-glass softness */}
            <feGaussianBlur in="displaced" stdDeviation="0.8" result="blurred" />
          </filter>
        </defs>
      </svg>

      <button
        type={type}
        onClick={onClick}
        disabled={disabled}
        className={cn(
          "relative inline-flex items-center justify-center",
          "rounded-xl font-semibold select-none cursor-pointer",
          "transition-all duration-300 ease-out",
          "disabled:pointer-events-none disabled:opacity-40",
          sizeClasses[size],
          className
        )}
        style={{
          background: "rgba(255, 255, 255, 0.18)",
          backdropFilter: `url(#${FILTER_ID}) blur(12px) saturate(1.6)`,
          WebkitBackdropFilter: `url(#${FILTER_ID}) blur(12px) saturate(1.6)`,
          boxShadow: [
            "inset 0 1px 1px rgba(255,255,255,0.55)",
            "inset 0 -1px 1px rgba(0,0,0,0.08)",
            "0 4px 16px rgba(212,255,0,0.12)",
            "0 1px 4px rgba(0,0,0,0.08)",
          ].join(", "),
          border: "1px solid rgba(255,255,255,0.40)",
          color: "#1D4ED8",
        }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLButtonElement).style.boxShadow = [
            "inset 0 1px 1px rgba(255,255,255,0.70)",
            "inset 0 -1px 1px rgba(0,0,0,0.06)",
            "0 8px 28px rgba(212,255,0,0.20)",
            "0 2px 6px rgba(0,0,0,0.10)",
          ].join(", ");
          (e.currentTarget as HTMLButtonElement).style.transform = "translateY(-1px)";
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLButtonElement).style.boxShadow = [
            "inset 0 1px 1px rgba(255,255,255,0.55)",
            "inset 0 -1px 1px rgba(0,0,0,0.08)",
            "0 4px 16px rgba(212,255,0,0.12)",
            "0 1px 4px rgba(0,0,0,0.08)",
          ].join(", ");
          (e.currentTarget as HTMLButtonElement).style.transform = "translateY(0)";
        }}
      >
        {/* Specular highlight rim */}
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 rounded-xl"
          style={{
            background:
              "linear-gradient(135deg, rgba(255,255,255,0.30) 0%, rgba(255,255,255,0) 50%)",
          }}
        />
        <span className="relative z-10">{children}</span>
      </button>
    </>
  );
}

export default LiquidGlassButton;
