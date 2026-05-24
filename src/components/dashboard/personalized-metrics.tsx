"use client";
import { Calendar, CheckSquare, CurrencyDollar, Eye, Heart, House, Lightning, Pulse, Rocket, ShoppingCart, Sparkle, Target, TrendUp, Trophy, UserCheck, Users } from "@phosphor-icons/react";

import type { Icon } from "@phosphor-icons/react";
import { useEffect, useState } from "react";
import Link from "next/link";
import { METRIC_LABELS, type DashboardMetricKey, USER_TYPES } from "@/lib/user-types";

/* ─── Metric → icon mapping ────────────────────────────────────────── */
const METRIC_ICONS: Record<DashboardMetricKey, Icon> = {
  clients: Users,
  mrr: CurrencyDollar,
  outreach: Lightning,
  leads: Target,
  views: Eye,
  subscribers: Users,
  engagement: Heart,
  content_pieces: Sparkle,
  listings: House,
  showings: Calendar,
  closings: Trophy,
  sessions_booked: Calendar,
  revenue: CurrencyDollar,
  churn: TrendUp,
  signups: UserCheck,
  activations: Lightning,
  orders: ShoppingCart,
  aov: CurrencyDollar,
  conversion: TrendUp,
  tasks_done: CheckSquare,
};

const METRIC_ACCENT: Record<DashboardMetricKey, string> = {
  clients: "text-emerald-400",
  mrr: "text-[#D4FF00]",
  outreach: "text-indigo-400",
  leads: "text-emerald-400",
  views: "text-purple-400",
  subscribers: "text-indigo-400",
  engagement: "text-pink-400",
  content_pieces: "text-purple-400",
  listings: "text-indigo-400",
  showings: "text-emerald-400",
  closings: "text-[#D4FF00]",
  sessions_booked: "text-emerald-400",
  revenue: "text-[#D4FF00]",
  churn: "text-red-400",
  signups: "text-emerald-400",
  activations: "text-indigo-400",
  orders: "text-emerald-400",
  aov: "text-[#D4FF00]",
  conversion: "text-purple-400",
  tasks_done: "text-emerald-400",
};

interface Props {
  /** Optional override — if omitted, fetched from /api/user/onboarding */
  userType?: string;
}

/**
 * AI-personalized metric strip shown at the top of the dashboard.
 * Picks metrics based on user_type (content creator → views/subscribers,
 * real estate → leads/showings/closings, etc.).
 */
export default function PersonalizedMetrics({ userType: providedType }: Props) {
  const [userType, setUserType] = useState<string>(providedType || "agency");
  const [loaded, setLoaded] = useState(!!providedType);

  useEffect(() => {
    if (providedType) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/user/onboarding", { cache: "no-store" });
        if (!res.ok) {
          setLoaded(true);
          return;
        }
        const data = await res.json();
        if (cancelled) return;
        if (typeof data?.user_type === "string") setUserType(data.user_type);
      } catch {
        // fall back to default
      } finally {
        if (!cancelled) setLoaded(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [providedType]);

  // Agency users use the existing dashboard stats — no personalized strip needed.
  if (!loaded || userType === "agency") return null;

  const meta = USER_TYPES.find((u) => u.id === userType);
  if (!meta) return null;

  return (
    <div className=" border border-[rgba(212,255,0,0.2)] bg-gradient-to-br from-[rgba(212,255,0,0.05)] via-transparent to-transparent p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-[rgba(212,255,0,0.08)] flex items-center justify-center">
            <Sparkle size={13} className="text-[#D4FF00]" />
          </div>
          <div>
            <p className="text-xs font-bold text-text-primary">
              Personalized for your {meta.label}
            </p>
            <p className="text-[10px] text-text-muted">
              Metrics that matter most to you — tuned during onboarding.
            </p>
          </div>
        </div>
        <Link
          href="/dashboard/settings"
          className="text-[10px] text-text-muted hover:text-[#D4FF00] transition-colors"
        >
          Customize
        </Link>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {meta.dashboardMetrics.map((key) => {
          const Icon = METRIC_ICONS[key] || Pulse;
          const accent = METRIC_ACCENT[key] || "text-[#D4FF00]";
          const label = METRIC_LABELS[key]?.label ?? key;
          const hint = METRIC_LABELS[key]?.hint ?? "";
          return (
            <div
              key={key}
              className="rounded-xl border border-border-subtle bg-surface-light/40 p-3 hover:border-[rgba(212,255,0,0.25)] transition-all"
            >
              <div className="flex items-center gap-2 mb-1">
                <Icon size={13} className={accent} />
                <p className="text-[10px] text-text-muted uppercase tracking-wider font-semibold">
                  {label}
                </p>
              </div>
              <p className="text-xl font-bold text-text-primary">—</p>
              <p className="text-[9px] text-text-muted mt-0.5">{hint}</p>
            </div>
          );
        })}
      </div>

      <div className="mt-3 text-[10px] text-text-muted/70 italic">
        <Rocket size={10} className="inline mr-1 text-[rgba(212,255,0,0.7)]" />
        Connect your platforms to populate these metrics live.
      </div>
    </div>
  );
}
