"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Target, Flame, AlertTriangle, Pause, CheckCircle2, ArrowRight,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

interface Priority {
  kind: "hot_lead" | "client_risk" | "stalled_sequence" | "all_clear";
  title: string;
  subtitle: string;
  accent: "danger" | "warning" | "info" | "success";
  href: string;
  ctaLabel: string;
}

const ACCENTS: Record<Priority["accent"], { bg: string; ring: string; iconBg: string; iconColor: string; text: string; cta: string }> = {
  danger:  { bg: "from-danger/10 via-danger/5 to-transparent",   ring: "border-danger/25",  iconBg: "bg-danger/15",  iconColor: "text-danger",  text: "text-danger",  cta: "bg-danger/10 hover:bg-danger/20 text-danger border-danger/25" },
  warning: { bg: "from-warning/10 via-warning/5 to-transparent", ring: "border-warning/25", iconBg: "bg-warning/15", iconColor: "text-warning", text: "text-warning", cta: "bg-warning/10 hover:bg-warning/20 text-warning border-warning/25" },
  info:    { bg: "from-info/10 via-info/5 to-transparent",       ring: "border-info/25",    iconBg: "bg-info/15",    iconColor: "text-info",    text: "text-info",    cta: "bg-info/10 hover:bg-info/20 text-info border-info/25" },
  success: { bg: "from-success/10 via-success/5 to-transparent", ring: "border-success/25", iconBg: "bg-success/15", iconColor: "text-success", text: "text-success", cta: "bg-success/10 hover:bg-success/20 text-success border-success/25" },
};

function iconFor(kind: Priority["kind"]) {
  switch (kind) {
    case "hot_lead":         return <Flame size={22} />;
    case "client_risk":      return <AlertTriangle size={22} />;
    case "stalled_sequence": return <Pause size={22} />;
    case "all_clear":        return <CheckCircle2 size={22} />;
  }
}

export default function TodaysPriority() {
  const [priority, setPriority] = useState<Priority | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/dashboard/today-priority")
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (!cancelled) setPriority(data?.priority || null); })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  if (loading) {
    return (
      <div className="card-static">
        <Skeleton className="h-3 w-24 mb-3" />
        <div className="flex items-center gap-4">
          <Skeleton className="w-12 h-12 rounded-xl shrink-0" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-48" />
            <Skeleton className="h-3 w-64" />
          </div>
          <Skeleton className="h-8 w-28 rounded-lg" />
        </div>
      </div>
    );
  }

  if (!priority) return null;

  const accent = ACCENTS[priority.accent];

  return (
    <Link
      href={priority.href}
      className={`block rounded-2xl border ${accent.ring} bg-gradient-to-br ${accent.bg} p-4 transition-all hover:-translate-y-0.5 hover:shadow-md group`}
    >
      <div className="flex items-center justify-between mb-2">
        <span className="text-[10px] text-muted font-semibold uppercase tracking-wider flex items-center gap-1.5">
          <Target size={11} className={accent.iconColor} /> Today&apos;s Priority
        </span>
        <span className={`text-[9px] font-semibold uppercase tracking-wider ${accent.text}`}>
          {priority.kind.replace(/_/g, " ")}
        </span>
      </div>
      <div className="flex items-center gap-4">
        <div className={`w-12 h-12 rounded-xl ${accent.iconBg} ${accent.iconColor} flex items-center justify-center shrink-0`}>
          {iconFor(priority.kind)}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-base font-bold truncate">{priority.title}</p>
          <p className="text-[11px] text-muted mt-0.5 truncate">{priority.subtitle}</p>
        </div>
        <span
          className={`shrink-0 inline-flex items-center gap-1.5 text-[11px] font-semibold px-3 py-2 rounded-xl border ${accent.cta} transition-all group-hover:gap-2`}
        >
          {priority.ctaLabel} <ArrowRight size={12} />
        </span>
      </div>
    </Link>
  );
}
