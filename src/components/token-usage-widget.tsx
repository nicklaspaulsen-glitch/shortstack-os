"use client";

/**
 * Floating token-usage circle (bottom-right).
 *
 * Admin-only widget that visualises how many AI tokens the agency owner has
 * burned this billing period. The ring shifts colour as usage climbs:
 *   0–49%  green
 *   50–74% yellow
 *   75–89% amber
 *   90%+   red (pulses when at/over the limit)
 *
 * Data comes from GET /api/billing/tokens, which returns
 *   { limit, used, effective_limit, bonus_tokens, by_category, ... }.
 *
 * Click → /dashboard/pricing so the user can upgrade straight away.
 * "X" dismisses for the session (sessionStorage); localStorage key
 * `trinity_token_widget_hidden` dismisses forever.
 *
 * If the endpoint returns 401/403/any error we silently hide the widget —
 * we never want a billing API hiccup to crash the dashboard.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { X, Zap } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import Draggable from "@/components/ui/draggable";

interface TokenData {
  plan: string;
  limit: number;
  used: number;
  bonus_tokens: number;
  effective_limit: number;
  by_category: Record<string, number>;
  daily_average: number;
  days_remaining: number;
}

const HIDE_FOREVER_KEY = "trinity_token_widget_hidden";
const HIDE_SESSION_KEY = "trinity_token_widget_session_hidden";
const REFRESH_INTERVAL_MS = 60_000;

function formatNum(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}

function getRingColor(pct: number): string {
  if (pct >= 0.9) return "#ef4444"; // red
  if (pct >= 0.75) return "#f59e0b"; // amber
  if (pct >= 0.5) return "#eab308"; // yellow
  return "#10b981"; // green
}

export default function TokenUsageWidget() {
  const { profile, loading: authLoading } = useAuth();
  const [data, setData] = useState<TokenData | null>(null);
  const [errored, setErrored] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [sessionHidden, setSessionHidden] = useState(false);
  const [foreverHidden, setForeverHidden] = useState(false);

  // Hydrate hide prefs (client-only)
  useEffect(() => {
    try {
      if (localStorage.getItem(HIDE_FOREVER_KEY) === "1") setForeverHidden(true);
      if (sessionStorage.getItem(HIDE_SESSION_KEY) === "1") setSessionHidden(true);
    } catch {
      // Storage can throw in private mode — just continue
    }
  }, []);

  const isAdmin = profile?.role === "admin";

  const fetchTokens = useCallback(async () => {
    try {
      const res = await fetch("/api/billing/tokens", { cache: "no-store" });
      if (!res.ok) {
        setErrored(true);
        return;
      }
      const json = (await res.json()) as TokenData;
      setData(json);
      setErrored(false);
    } catch {
      setErrored(true);
    }
  }, []);

  // Fetch on mount + poll every 60s (admin only)
  useEffect(() => {
    if (authLoading || !isAdmin || foreverHidden) return;
    fetchTokens();
    const id = setInterval(fetchTokens, REFRESH_INTERVAL_MS);
    return () => clearInterval(id);
  }, [authLoading, isAdmin, foreverHidden, fetchTokens]);

  const dismissSession = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      sessionStorage.setItem(HIDE_SESSION_KEY, "1");
    } catch {}
    setSessionHidden(true);
  };

  // Derived metrics (always called to keep hook order stable)
  const {
    effectiveLimit,
    unlimited,
    clampedPct,
    ringColor,
    atLimit,
    circumference,
    dashOffset,
  } = useMemo(() => {
    const used = data?.used ?? 0;
    const limit = data?.effective_limit ?? data?.limit ?? 0;
    const isUnlimited = limit === -1;
    const rawPct = isUnlimited ? 0 : limit > 0 ? used / limit : 0;
    const cPct = Math.min(1, Math.max(0, rawPct));
    const radius = 18;
    const circ = 2 * Math.PI * radius;
    return {
      effectiveLimit: limit,
      unlimited: isUnlimited,
      clampedPct: cPct,
      ringColor: isUnlimited ? "#10b981" : getRingColor(cPct),
      atLimit: !isUnlimited && used >= limit && limit > 0,
      circumference: circ,
      dashOffset: circ * (1 - cPct),
    };
  }, [data]);

  // Gate rendering AFTER hooks have run
  if (authLoading) return null;
  if (!isAdmin) return null;
  if (foreverHidden || sessionHidden) return null;
  if (errored) return null; // silently hide on any API error
  if (!data) return null;

  const categoryEntries = Object.entries(data.by_category || {}).sort(
    (a, b) => b[1] - a[1],
  );

  return (
    <Draggable
      dragAnywhere
      defaultX={typeof window !== "undefined" ? window.innerWidth - 360 : 0}
      defaultY={typeof window !== "undefined" ? window.innerHeight - 70 : 0}
      storageKey="token_widget"
    >
    <div
      className="select-none"
      style={{ pointerEvents: "auto" }}
    >
      {/* Expanded breakdown on hover */}
      {expanded && (
        <div
          className="absolute bottom-full right-0 mb-2 w-64 rounded-2xl border border-border bg-surface shadow-2xl shadow-black/50 p-3 fade-in"
          onMouseEnter={() => setExpanded(true)}
          onMouseLeave={() => setExpanded(false)}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-gold">
              Token usage
            </span>
            <span className="text-[10px] text-muted">{data.plan}</span>
          </div>
          <div className="text-xs text-foreground mb-1">
            <span className="font-semibold">{formatNum(data.used)}</span>
            <span className="text-muted">
              {" / "}
              {unlimited ? "∞" : formatNum(effectiveLimit)} tokens
            </span>
          </div>
          {!unlimited && (
            <div className="text-[10px] text-muted mb-2">
              {Math.round(clampedPct * 100)}% used ·{" "}
              {data.days_remaining} day{data.days_remaining === 1 ? "" : "s"}{" "}
              left
            </div>
          )}
          {categoryEntries.length > 0 && (
            <div className="space-y-1 pt-2 border-t border-border">
              {categoryEntries.slice(0, 5).map(([cat, tokens]) => (
                <div
                  key={cat}
                  className="flex items-center justify-between text-[10px]"
                >
                  <span className="text-muted truncate">{cat}</span>
                  <span className="text-foreground font-medium ml-2">
                    {formatNum(tokens)}
                  </span>
                </div>
              ))}
            </div>
          )}
          {atLimit && (
            <Link
              href="/dashboard/pricing"
              className="mt-3 block text-center text-[11px] font-semibold px-3 py-1.5 rounded-lg bg-danger/10 text-danger border border-danger/30 hover:bg-danger/20 transition-colors"
            >
              Upgrade plan
            </Link>
          )}
        </div>
      )}

      <Link
        href="/dashboard/pricing"
        aria-label="Token usage — click to view plans"
        onMouseEnter={() => setExpanded(true)}
        onMouseLeave={() => setExpanded(false)}
        className={`group flex items-center gap-2 pl-2 pr-3 py-1.5 rounded-full bg-surface border shadow-lg backdrop-blur transition-all hover:scale-[1.02] active:scale-95 ${
          atLimit
            ? "border-danger/50 shadow-danger/20 animate-pulse"
            : "border-border hover:border-gold/40"
        }`}
        style={{
          background:
            "color-mix(in srgb, var(--color-surface) 92%, transparent)",
        }}
      >
        {/* SVG progress ring */}
        <div className="relative w-10 h-10 shrink-0">
          <svg
            className="w-10 h-10 -rotate-90"
            viewBox="0 0 40 40"
            aria-hidden="true"
          >
            <circle
              cx="20"
              cy="20"
              r="18"
              fill="none"
              stroke="currentColor"
              strokeWidth="3"
              className="text-border"
            />
            <circle
              cx="20"
              cy="20"
              r="18"
              fill="none"
              stroke={ringColor}
              strokeWidth="3"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={unlimited ? 0 : dashOffset}
              style={{
                transition:
                  "stroke-dashoffset 600ms ease, stroke 400ms ease",
                filter: `drop-shadow(0 0 4px ${ringColor}80)`,
              }}
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <Zap
              size={12}
              style={{ color: ringColor }}
              className="transition-colors"
            />
          </div>
        </div>

        {/* Label */}
        <div className="flex flex-col leading-tight min-w-0">
          <span className="text-[11px] font-semibold text-foreground tabular-nums">
            {formatNum(data.used)}
            <span className="text-muted">
              {" / "}
              {unlimited ? "∞" : formatNum(effectiveLimit)}
            </span>
          </span>
          <span className="text-[9px] uppercase tracking-wider text-muted">
            {unlimited
              ? "Unlimited"
              : atLimit
                ? "Upgrade needed"
                : `${Math.round(clampedPct * 100)}% used`}
          </span>
        </div>

        {/* Dismiss (X) */}
        <button
          onClick={dismissSession}
          aria-label="Dismiss for this session"
          className="ml-1 p-1 rounded-full text-muted hover:text-foreground hover:bg-surface-light transition-colors"
        >
          <X size={10} />
        </button>
      </Link>
    </div>
    </Draggable>
  );
}
