"use client";

/**
 * LogoMark — thin wrapper around BrainMark.
 * Drop-in replacement for the previous hexagon + S-bolt glyph.
 * All existing usages (<LogoMark size="sm" />) get the brain automatically.
 */
import BrainMark, { type BrainMarkSize } from "./brain-mark";

interface LogoMarkProps {
  /** Visual size. sm=28, md=48, lg=96, xl=192 */
  size?: "sm" | "md" | "lg" | "xl";
  /** Blue CSS drop-shadow glow */
  glowing?: boolean;
  className?: string;
}

export function LogoMark({ size = "md", glowing, className }: LogoMarkProps) {
  return (
    <BrainMark
      size={size as BrainMarkSize}
      glowing={glowing}
      className={className}
    />
  );
}
