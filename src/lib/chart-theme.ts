import type { CSSProperties } from "react";

export const CHART_COLORS: string[] = [
  "#D4FF00",
  "#10B981",
  "#6366F1",
  "#64748B",
  "#94A3B8",
  "#475569",
];

export const chartTooltip: {
  contentStyle: CSSProperties;
  labelStyle: CSSProperties;
  itemStyle: CSSProperties;
} = {
  contentStyle: {
    background: "rgba(13,17,32,0.95)",
    border: "1px solid rgba(212,255,0,0.10)",
    borderRadius: "8px",
    fontSize: "11px",
    color: "#F0F0F4",
    boxShadow: "0 8px 32px rgba(0,0,0,0.60)",
    padding: "8px 10px",
    backdropFilter: "blur(16px)",
  },
  labelStyle: {
    color: "var(--text-muted)",
    fontSize: "9px",
    marginBottom: "4px",
    textTransform: "uppercase" as const,
    letterSpacing: "0.1em",
  },
  itemStyle: { color: "#F0F0F4", fontSize: "11px" },
};
