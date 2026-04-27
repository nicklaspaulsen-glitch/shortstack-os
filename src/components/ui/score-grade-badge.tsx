"use client";

import type { ReactNode } from "react";
import { Flame, Snowflake, Sun, BadgeCheck } from "lucide-react";

export type ScoreGrade = "cold" | "warm" | "hot" | "customer";

interface GradeStyle {
  label: string;
  bg: string;
  text: string;
  dot: string;
  icon: ReactNode;
}

const GRADE_STYLES: Record<ScoreGrade, GradeStyle> = {
  cold: {
    label: "Cold",
    bg: "bg-blue-500/10 border-blue-500/20",
    text: "text-blue-400",
    dot: "bg-blue-400",
    icon: <Snowflake size={9} />,
  },
  warm: {
    label: "Warm",
    bg: "bg-yellow-500/10 border-yellow-500/20",
    text: "text-yellow-400",
    dot: "bg-yellow-400",
    icon: <Sun size={9} />,
  },
  hot: {
    label: "Hot",
    bg: "bg-orange-500/10 border-orange-500/20",
    text: "text-orange-400",
    dot: "bg-orange-400",
    icon: <Flame size={9} />,
  },
  customer: {
    label: "Customer",
    bg: "bg-emerald-500/10 border-emerald-500/20",
    text: "text-emerald-400",
    dot: "bg-emerald-400",
    icon: <BadgeCheck size={9} />,
  },
};

export function gradeFromScore(
  score: number | null,
  status: string | null,
): ScoreGrade {
  if (status === "converted") return "customer";
  if (score === null || score < 0) return "cold";
  if (score <= 30) return "cold";
  if (score <= 60) return "warm";
  if (score <= 85) return "hot";
  return "customer";
}

interface ScoreGradeBadgeProps {
  score: number | null;
  grade?: ScoreGrade | null;
  status?: string | null;
  showScore?: boolean;
  showLabel?: boolean;
  onClick?: () => void;
  title?: string;
}

/**
 * Compact pill-shaped badge for a lead's hot/warm/cold/customer grade.
 * Defaults to inferring grade from `score + status` when grade is omitted.
 */
export default function ScoreGradeBadge({
  score,
  grade,
  status,
  showScore = true,
  showLabel = true,
  onClick,
  title,
}: ScoreGradeBadgeProps) {
  const resolved: ScoreGrade =
    grade ?? gradeFromScore(score ?? null, status ?? null);
  const style = GRADE_STYLES[resolved];

  const content = (
    <span
      title={title ?? `${style.label}${score !== null ? ` (${score})` : ""}`}
      className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded border ${style.bg} ${style.text}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${style.dot}`} />
      {style.icon}
      {showLabel ? style.label : null}
      {showScore && score !== null ? (
        <span className="font-mono opacity-80">{score}</span>
      ) : null}
    </span>
  );

  if (!onClick) return content;
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className="inline-flex"
    >
      {content}
    </button>
  );
}
