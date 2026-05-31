"use client";

import React from "react";
import { getStatusBgColor } from "@/lib/utils";

// ── Semantic bucket types ─────────────────────────────────────────────────────

type SemanticColor = "success" | "warning" | "error" | "info" | "neutral";

interface SemanticTokens {
  color: string;
  bgTint: string;
  border: string;
}

const SEMANTIC_TOKENS: Record<SemanticColor, SemanticTokens> = {
  success: {
    color: "#7FE5B8",
    bgTint: "rgba(127,229,184,0.12)",
    border: "rgba(127,229,184,0.28)",
  },
  warning: {
    color: "#FFC062",
    bgTint: "rgba(255,192,98,0.12)",
    border: "rgba(255,192,98,0.28)",
  },
  error: {
    color: "#F26063",
    bgTint: "rgba(242,96,99,0.12)",
    border: "rgba(242,96,99,0.28)",
  },
  info: {
    color: "#6366F1",
    bgTint: "rgba(99,102,241,0.12)",
    border: "rgba(99,102,241,0.28)",
  },
  neutral: {
    color: "#4A4A5A",
    bgTint: "rgba(74,74,90,0.10)",
    border: "rgba(74,74,90,0.20)",
  },
};

// ── Status → semantic bucket map ─────────────────────────────────────────────

const SUCCESS_STATUSES = new Set([
  "active", "paid", "completed", "success", "approved", "verified",
  "published", "sent", "delivered", "online", "enabled", "connected",
  "healthy", "booked", "signed", "replied", "converted",
]);

const WARNING_STATUSES = new Set([
  "pending", "processing", "scheduled", "draft", "paused", "waiting",
  "review", "in_progress", "in_review", "degraded", "called",
  "in_production", "editing",
]);

const ERROR_STATUSES = new Set([
  "failed", "error", "rejected", "cancelled", "canceled", "overdue",
  "expired", "declined", "blocked", "down", "bounced", "not_interested",
]);

const INFO_STATUSES = new Set([
  "info", "new", "invited", "queued", "scripted",
]);

function getSemanticColor(status: string): SemanticColor {
  const key = status.toLowerCase();
  if (SUCCESS_STATUSES.has(key)) return "success";
  if (WARNING_STATUSES.has(key)) return "warning";
  if (ERROR_STATUSES.has(key)) return "error";
  if (INFO_STATUSES.has(key)) return "info";
  return "neutral";
}

// ── Size tokens ───────────────────────────────────────────────────────────────

const SIZE_CLASSES = {
  sm: {
    badge: "h-5 text-[10px] px-2 gap-1",
    dot: "w-1.5 h-1.5",
  },
  md: {
    badge: "h-6 text-xs px-2.5 gap-1.5",
    dot: "w-2 h-2",
  },
} as const;

// ── Props interface ───────────────────────────────────────────────────────────

interface StatusBadgeProps {
  /** Existing — the status string that drives color + label */
  status: string;
  /** Existing — extra Tailwind classes */
  className?: string;
  /** NEW — badge height/text scale (default "md") */
  size?: "sm" | "md";
  /** NEW — filled tint vs. transparent bg (default "solid") */
  variant?: "solid" | "outline";
  /** NEW — show leading colored dot (default true; ignored when icon is provided) */
  showDot?: boolean;
  /** NEW — replaces the dot with any ReactNode (icon) */
  icon?: React.ReactNode;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function StatusBadge({
  status,
  className = "",
  size = "md",
  variant = "solid",
  showDot = true,
  icon,
}: StatusBadgeProps) {
  const semantic = getSemanticColor(status);
  const tokens = SEMANTIC_TOKENS[semantic];
  const sizeTokens = SIZE_CLASSES[size];

  const bgColor = variant === "solid" ? tokens.bgTint : "transparent";
  const borderColor = tokens.border;
  const textColor = tokens.color;
  const dotOpacity = variant === "outline" ? 0.75 : 1;

  // Keep the legacy `.badge` class for CSS-driven fallback (globals.css:957)
  // but override visual properties via inline style for the new system.
  const legacyBgClass = getStatusBgColor(status);

  return (
    <span
      className={`badge ${legacyBgClass} inline-flex items-center font-ui rounded-full border ${sizeTokens.badge} ${className}`}
      style={{
        backgroundColor: bgColor,
        borderColor: borderColor,
        color: textColor,
      }}
    >
      {icon ? (
        <span className="flex-shrink-0 flex items-center justify-center" style={{ opacity: dotOpacity }}>
          {icon}
        </span>
      ) : showDot ? (
        <span
          className={`flex-shrink-0 rounded-full ${sizeTokens.dot}`}
          style={{ backgroundColor: tokens.color, opacity: dotOpacity }}
          aria-hidden="true"
        />
      ) : null}
      {status.replace(/_/g, " ")}
    </span>
  );
}
