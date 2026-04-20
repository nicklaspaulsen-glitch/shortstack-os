"use client";

/**
 * Dashboard-home banner that nudges Starter users to upgrade when they're
 * approaching any plan limit (>70% of at least one resource).
 *
 * Behavior:
 *  - Only rendered for users on "Starter".
 *  - Fetches /api/usage/current once on mount; hides itself if no resource
 *    is above the threshold.
 *  - Dismissal is persisted in localStorage keyed to the current month so
 *    the banner resurfaces next month.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowUpRight, AlertTriangle, X } from "lucide-react";
import { normalizePlanTier } from "@/lib/usage-limits";

type UsageMap = Record<string, number>;
type LimitMap = Record<string, number | "unlimited">;

interface UsageResponse {
  plan_tier: string;
  usage: UsageMap;
  limits: LimitMap;
  remaining: LimitMap;
}

const THRESHOLD_PCT = 70;
const DISMISS_KEY_PREFIX = "ss_usage_nudge_dismissed";

function currentMonthKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function storageKey(): string {
  return `${DISMISS_KEY_PREFIX}_${currentMonthKey()}`;
}

export default function UsageNudgeBanner({ planTier }: { planTier?: string | null }) {
  const normalizedTier = useMemo(() => normalizePlanTier(planTier), [planTier]);
  const eligible = normalizedTier === "Starter";

  const [dismissed, setDismissed] = useState<boolean>(() => {
    if (typeof window === "undefined") return true;
    try {
      return localStorage.getItem(storageKey()) === "1";
    } catch {
      return false;
    }
  });
  const [worstResource, setWorstResource] = useState<{ key: string; pct: number } | null>(null);

  const loadUsage = useCallback(async () => {
    try {
      const res = await fetch("/api/usage/current", { cache: "no-store" });
      if (!res.ok) return;
      const data = (await res.json()) as UsageResponse;
      let worst: { key: string; pct: number } | null = null;
      for (const key of Object.keys(data.usage || {})) {
        const used = data.usage[key] || 0;
        const limit = data.limits[key];
        if (limit === "unlimited" || typeof limit !== "number" || limit <= 0) continue;
        const pct = (used / limit) * 100;
        if (pct >= THRESHOLD_PCT && (!worst || pct > worst.pct)) {
          worst = { key, pct };
        }
      }
      setWorstResource(worst);
    } catch {
      // Silent — banner simply won't appear if usage fetch fails.
    }
  }, []);

  useEffect(() => {
    if (!eligible || dismissed) return;
    void loadUsage();
  }, [eligible, dismissed, loadUsage]);

  function handleDismiss() {
    setDismissed(true);
    try {
      localStorage.setItem(storageKey(), "1");
    } catch {
      // non-fatal — dismissal just won't persist across reloads.
    }
  }

  if (!eligible || dismissed || !worstResource) return null;

  const pctRounded = Math.min(100, Math.round(worstResource.pct));
  const resourceLabel = worstResource.key.replace(/_/g, " ");

  return (
    <div className="relative flex items-center gap-3 px-4 py-3 rounded-2xl border border-amber-500/25 bg-gradient-to-r from-amber-500/[0.06] via-orange-500/[0.04] to-transparent">
      <div className="w-9 h-9 rounded-xl bg-amber-500/15 border border-amber-500/25 flex items-center justify-center shrink-0">
        <AlertTriangle size={16} className="text-amber-500" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-semibold text-foreground">
          You&apos;re approaching your plan limits
        </p>
        <p className="text-[11px] text-muted mt-0.5 leading-relaxed">
          You&apos;ve used <span className="text-amber-500 font-semibold">{pctRounded}%</span> of
          your monthly <span className="font-medium text-foreground">{resourceLabel}</span> allowance
          on Starter. Upgrade for higher limits and unlock premium features.
        </p>
      </div>
      <Link
        href="/dashboard/upgrade"
        className="shrink-0 hidden sm:flex items-center gap-1.5 px-3 py-2 rounded-xl bg-gold text-white text-xs font-semibold hover:bg-gold/90 transition-colors shadow-sm"
      >
        <ArrowUpRight size={12} />
        Upgrade
      </Link>
      <Link
        href="/dashboard/upgrade"
        className="shrink-0 sm:hidden p-2 rounded-xl bg-gold text-white hover:bg-gold/90 transition-colors"
        aria-label="Upgrade"
      >
        <ArrowUpRight size={12} />
      </Link>
      <button
        onClick={handleDismiss}
        className="shrink-0 p-1.5 rounded-md text-muted hover:text-foreground hover:bg-surface-light transition-colors"
        aria-label="Dismiss"
      >
        <X size={14} />
      </button>
    </div>
  );
}
