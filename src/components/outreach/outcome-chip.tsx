"use client";

import type { OutreachOutcome } from "@/lib/outreach/types";

interface OutcomeChipProps {
  outcome: OutreachOutcome;
  size?: "sm" | "md";
  title?: string;
}

const OUTCOME_META: Record<
  OutreachOutcome,
  { label: string; tone: string }
> = {
  interested: {
    label: "Interested",
    tone: "text-emerald-300 bg-emerald-500/15 border-emerald-500/30",
  },
  booked: {
    label: "Booked",
    tone: "text-emerald-200 bg-emerald-500/25 border-emerald-400/40",
  },
  replied: {
    label: "Replied",
    tone: "text-sky-300 bg-sky-500/15 border-sky-500/30",
  },
  objection: {
    label: "Objection",
    tone: "text-amber-300 bg-amber-500/15 border-amber-500/30",
  },
  no_answer: {
    label: "No answer",
    tone: "text-white/60 bg-white/5 border-white/10",
  },
  voicemail: {
    label: "Voicemail",
    tone: "text-violet-300 bg-violet-500/15 border-violet-500/30",
  },
  bounced: {
    label: "Bounced",
    tone: "text-rose-300 bg-rose-500/15 border-rose-500/30",
  },
  unknown: {
    label: "Pending",
    tone: "text-white/40 bg-white/5 border-white/10",
  },
};

export default function OutcomeChip({ outcome, size = "sm", title }: OutcomeChipProps) {
  const meta = OUTCOME_META[outcome];
  const padding = size === "sm" ? "px-1.5 py-0.5 text-[10px]" : "px-2 py-1 text-xs";
  return (
    <span
      title={title || meta.label}
      className={`inline-flex items-center rounded-full border font-medium tracking-tight ${meta.tone} ${padding}`}
    >
      {meta.label}
    </span>
  );
}
