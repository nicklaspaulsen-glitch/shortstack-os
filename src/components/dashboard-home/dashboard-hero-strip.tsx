"use client";

import { useEffect, useState } from "react";
import { Flame, PhoneCall, Target } from "lucide-react";
import PageHero from "@/components/ui/page-hero";
import { tokens } from "@/lib/brand/tokens";

/**
 * DashboardHeroStrip — slim editorial header at the top of the dashboard.
 *
 * Wraps <PageHero variant="compact"> with a Bodoni-Moda eyebrow ("Tuesday,
 * April 28"), the user's first-name greeting, a real-time clock that mounts
 * client-side, and three inline micro-stats anchored to the right.
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

function formatToday(): string {
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
    const id = setInterval(tick, 30 * 1000);
    return () => clearInterval(id);
  }, []);
  return now;
}

export default function DashboardHeroStrip({ firstName, microStats }: Props) {
  const clock = useClock();

  return (
    <PageHero
      variant="compact"
      gradient="gold"
      showStack3D
      eyebrow={formatToday()}
      title={`${getGreeting()}${firstName ? `, ${firstName}` : ""}`}
      subtitle={clock ? `Local time — ${clock}` : undefined}
      actions={
        <div className="flex items-center gap-3 mr-2">
          <MicroStat icon={<PhoneCall size={11} />} label="calls today" value={microStats.calls} />
          <MicroStat icon={<Target size={11} />} label="leads scored" value={microStats.leads} />
          <MicroStat icon={<Flame size={11} />} label="hot" value={microStats.hot} highlight />
        </div>
      }
    />
  );
}

interface MicroStatProps {
  icon: React.ReactNode;
  label: string;
  value: number;
  highlight?: boolean;
}

function MicroStat({ icon, label, value, highlight = false }: MicroStatProps) {
  return (
    <div
      className="hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg"
      style={{
        background: highlight ? `${tokens.brand.accent}18` : "rgba(0,0,0,0.05)",
        border: `1px solid ${highlight ? tokens.brand.accent : "rgba(0,0,0,0.08)"}`,
      }}
    >
      <span style={{ color: highlight ? tokens.brand.accent : "rgba(0,0,0,0.5)" }}>{icon}</span>
      <span
        className="text-[11px] font-mono tabular-nums font-bold"
        style={{ color: highlight ? tokens.brand.accent : "rgba(0,0,0,0.85)" }}
      >
        {value}
      </span>
      <span
        className="text-[9px] uppercase tracking-wider"
        style={{ color: "rgba(0,0,0,0.45)" }}
      >
        {label}
      </span>
    </div>
  );
}
