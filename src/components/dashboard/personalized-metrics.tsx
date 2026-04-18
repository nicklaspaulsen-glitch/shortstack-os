"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  TrendingUp,
  Eye,
  Users as UsersIcon,
  Heart,
  Home as HomeIcon,
  Calendar as CalendarIcon,
  Trophy,
  DollarSign,
  Rocket,
  UserCheck,
  ShoppingCart,
  Target as TargetIcon,
  Activity,
  CheckSquare,
  Zap,
  Sparkles,
  type LucideIcon,
} from "lucide-react";
import { METRIC_LABELS, type DashboardMetricKey, USER_TYPES } from "@/lib/user-types";

/* ─── Metric → icon mapping ────────────────────────────────────────── */
const METRIC_ICONS: Record<DashboardMetricKey, LucideIcon> = {
  clients: UsersIcon,
  mrr: DollarSign,
  outreach: Zap,
  leads: TargetIcon,
  views: Eye,
  subscribers: UsersIcon,
  engagement: Heart,
  content_pieces: Sparkles,
  listings: HomeIcon,
  showings: CalendarIcon,
  closings: Trophy,
  sessions_booked: CalendarIcon,
  revenue: DollarSign,
  churn: TrendingUp,
  signups: UserCheck,
  activations: Zap,
  orders: ShoppingCart,
  aov: DollarSign,
  conversion: TrendingUp,
  tasks_done: CheckSquare,
};

const METRIC_ACCENT: Record<DashboardMetricKey, string> = {
  clients: "text-emerald-400",
  mrr: "text-gold",
  outreach: "text-blue-400",
  leads: "text-emerald-400",
  views: "text-purple-400",
  subscribers: "text-blue-400",
  engagement: "text-pink-400",
  content_pieces: "text-purple-400",
  listings: "text-blue-400",
  showings: "text-emerald-400",
  closings: "text-gold",
  sessions_booked: "text-emerald-400",
  revenue: "text-gold",
  churn: "text-red-400",
  signups: "text-emerald-400",
  activations: "text-blue-400",
  orders: "text-emerald-400",
  aov: "text-gold",
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
    <div className="rounded-2xl border border-gold/20 bg-gradient-to-br from-gold/[0.04] via-transparent to-transparent p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-gold/10 flex items-center justify-center">
            <Sparkles size={13} className="text-gold" />
          </div>
          <div>
            <p className="text-xs font-bold text-foreground">
              Personalized for your {meta.label}
            </p>
            <p className="text-[10px] text-muted">
              Metrics that matter most to you — tuned during onboarding.
            </p>
          </div>
        </div>
        <Link
          href="/dashboard/settings"
          className="text-[10px] text-muted hover:text-gold transition-colors"
        >
          Customize
        </Link>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {meta.dashboardMetrics.map((key) => {
          const Icon = METRIC_ICONS[key] || Activity;
          const accent = METRIC_ACCENT[key] || "text-gold";
          const label = METRIC_LABELS[key]?.label ?? key;
          const hint = METRIC_LABELS[key]?.hint ?? "";
          return (
            <div
              key={key}
              className="rounded-xl border border-border bg-surface-light/40 p-3 hover:border-gold/30 transition-all"
            >
              <div className="flex items-center gap-2 mb-1">
                <Icon size={13} className={accent} />
                <p className="text-[10px] text-muted uppercase tracking-wider font-semibold">
                  {label}
                </p>
              </div>
              <p className="text-xl font-bold text-foreground">—</p>
              <p className="text-[9px] text-muted mt-0.5">{hint}</p>
            </div>
          );
        })}
      </div>

      <div className="mt-3 text-[10px] text-muted/70 italic">
        <Rocket size={10} className="inline mr-1 text-gold/70" />
        Connect your platforms to populate these metrics live.
      </div>
    </div>
  );
}
