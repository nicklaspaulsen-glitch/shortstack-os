"use client";

import { PLATFORM_META } from "@/lib/social-studio/constants";
import type { SocialPlatform } from "@/lib/social-studio/types";

interface PlatformChipProps {
  platform: SocialPlatform;
  size?: "sm" | "md";
}

/**
 * Tiny pill rendering platform name + platform colour. Shared across the
 * lineup, auto-upload and stats tabs so platform identity stays visually
 * consistent (the same color on the calendar dot and the chart legend).
 */
export default function PlatformChip({ platform, size = "sm" }: PlatformChipProps) {
  const meta = PLATFORM_META[platform];
  const padding = size === "sm" ? "px-1.5 py-0.5" : "px-2 py-1";
  const text = size === "sm" ? "text-[10px]" : "text-xs";

  return (
    <span
      className={`inline-flex items-center rounded-full font-medium ${padding} ${text}`}
      style={{
        background: meta.bg,
        border: `1px solid ${meta.border}`,
        color: meta.color,
      }}
    >
      {meta.label}
    </span>
  );
}
