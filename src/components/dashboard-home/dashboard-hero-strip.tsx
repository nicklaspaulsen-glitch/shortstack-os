"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Flame, PhoneCall, Target, Plus } from "lucide-react";

/**
 * DashboardHeroStrip — slim editorial command header at the top of the dashboard.
 *
 * Replaces the old <PageHero variant="compact"> wrapper. The data IS the
 * hero on the dashboard — this strip is intentionally compact (~72px) so the
 * bento grid lands immediately in the viewport.
 *
 * Left: Bodoni-Moda italic date + Satoshi greeting (large confident type)
 * Center: nothing — whitespace breathes
 * Right: live clock + 3 micro-stats + quick-add pills (+ Client, + Deal, + Content)
 */
interface Props {
  firstName?: string;
  microStats: { calls: number; leads: number; hot: number };
}

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

function formatDate(): string {
  return new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

function useClock(): string {
  const [now, setNow] = useState<string>("");
  useEffect(() => {
    const tick = () =>
      setNow(
        new Date().toLocaleTimeString("en-US", {
          hour: "numeric",
          minute: "2-digit",
          hour12: true,
        }),
      );
    tick();
    const id = setInterval(tick, 30_000);
    return () => clearInterval(id);
  }, []);
  return now;
}

export default function DashboardHeroStrip({ firstName, microStats }: Props) {
  const clock = useClock();

  return (
    <div className="flex items-center justify-between gap-4 px-1 py-3 sm:py-4">
      {/* Left: date eyebrow + greeting */}
      <div className="min-w-0">
        <p className="font-editorial text-[11px] italic text-text-muted mb-0.5 truncate">
          {formatDate()}
        </p>
        <h1 className="font-display text-xl sm:text-2xl font-bold tracking-tight text-text-primary leading-none truncate">
          {getGreeting()}
          {firstName ? (
            <span className="text-brand-accent">, {firstName}</span>
          ) : null}
        </h1>
      </div>

      {/* Right: clock + stats + quick-adds */}
      <div className="flex items-center gap-2 shrink-0">
        {/* Live clock — hidden on small screens */}
        {clock && (
          <span className="hidden md:block text-[11px] font-mono text-text-muted tabular-nums mr-1">
            {clock}
          </span>
        )}

        {/* Micro-stats */}
        <MicroStat icon={<PhoneCall size={10} />} label="calls" value={microStats.calls} />
        <MicroStat icon={<Target size={10} />} label="leads" value={microStats.leads} />
        <MicroStat icon={<Flame size={10} />} label="hot" value={microStats.hot} highlight />

        {/* Quick-add pills */}
        <div className="hidden sm:flex items-center gap-1.5 ml-2 pl-2 border-l border-border-subtle">
          <QuickAdd href="/dashboard/clients?action=new" label="Client" />
          <QuickAdd href="/dashboard/crm?action=new" label="Deal" />
          <QuickAdd href="/dashboard/content-plan?action=new" label="Content" />
        </div>
      </div>
    </div>
  );
}

/* ─── sub-components ──────────────────────────────────────────────────── */

interface MicroStatProps {
  icon: React.ReactNode;
  label: string;
  value: number;
  highlight?: boolean;
}

function MicroStat({ icon, label, value, highlight = false }: MicroStatProps) {
  return (
    <div
      className="hidden sm:flex items-center gap-1 px-2 py-1 rounded-md"
      style={{
        background: highlight ? "rgba(37,99,235,0.08)" : "rgba(0,0,0,0.04)",
        border: `1px solid ${highlight ? "rgba(37,99,235,0.2)" : "rgba(0,0,0,0.06)"}`,
      }}
    >
      <span style={{ color: highlight ? "#2563EB" : "rgba(0,0,0,0.4)" }}>{icon}</span>
      <span
        className="text-[11px] font-mono tabular-nums font-bold"
        style={{ color: highlight ? "#2563EB" : "rgba(0,0,0,0.8)" }}
      >
        {value}
      </span>
      <span className="text-[9px] uppercase tracking-wider text-text-muted">{label}</span>
    </div>
  );
}

function QuickAdd({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="flex items-center gap-0.5 px-2 py-1 rounded-md text-[11px] font-semibold text-text-secondary transition-colors duration-150 hover:bg-bg-surface-2 hover:text-brand-accent"
      style={{ border: "1px solid rgba(0,0,0,0.06)" }}
    >
      <Plus size={10} />
      {label}
    </Link>
  );
}
