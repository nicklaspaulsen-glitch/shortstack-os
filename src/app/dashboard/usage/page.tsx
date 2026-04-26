"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/lib/auth-context";
import { PLAN_TIERS, type PlanTier, isValidPlanTier } from "@/lib/plan-config";
import Link from "next/link";
import PageAI from "@/components/page-ai";
import PageHero from "@/components/ui/page-hero";
import toast from "react-hot-toast";
import {
  Zap,
  TrendingUp,
  Clock,
  BarChart3,
  Sparkles,
  Bot,
  Mail,
  Paintbrush,
  Search,
  Globe,
  Loader2,
  ChevronRight,
  Shield,
  Plus,
  Package,
  RefreshCw,
  Calendar,
  Activity,
} from "lucide-react";

// ── Types ───────────────────────────────────────────────────────────────────

interface TokenData {
  plan: string;
  used: number;
  limit: number;
  bonus_tokens: number;
  effective_limit: number;
  reset_date: string;
  days_remaining: number;
  daily_average: number;
  by_category: Record<string, number>;
  daily_usage: Array<{ date: string; tokens: number }>;
  recent_activity: Array<{
    id: string;
    action_type: string;
    description: string;
    tokens_used: number;
    created_at: string;
  }>;
}

// ── Constants ────────────────────────────────────────────────────────────────

const TOKEN_PACKS = [
  { id: "100k", tokens: 100_000, price: 19, label: "100K", popular: false },
  { id: "500k", tokens: 500_000, price: 79, label: "500K", popular: true },
  { id: "1m", tokens: 1_000_000, price: 149, label: "1M", popular: false },
  { id: "5m", tokens: 5_000_000, price: 599, label: "5M", popular: false },
] as const;

const CATEGORY_ICONS: Record<string, React.ReactNode> = {
  "Content Generation": <Sparkles size={13} />,
  "AI Chat": <Bot size={13} />,
  "Email Generation": <Mail size={13} />,
  "Image Generation": <Paintbrush size={13} />,
  "Lead Scraper": <Search size={13} />,
  "Social Media": <Globe size={13} />,
  Other: <BarChart3 size={13} />,
};

const CATEGORY_COLORS: Record<string, string> = {
  "Content Generation": "bg-gold",
  "AI Chat": "bg-blue-400",
  "Email Generation": "bg-emerald-400",
  "Image Generation": "bg-purple-400",
  "Lead Scraper": "bg-amber-400",
  "Social Media": "bg-pink-400",
  Other: "bg-slate-400",
};

// ── Helpers ──────────────────────────────────────────────────────────────────

function fmt(n: number): string {
  return new Intl.NumberFormat().format(n);
}

function fmtShort(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return String(n);
}

function getProgressColor(pct: number): string {
  if (pct >= 90) return "bg-red-400";
  if (pct >= 75) return "bg-orange-400";
  if (pct >= 50) return "bg-amber-400";
  return "bg-gold";
}

function getProgressGlow(pct: number): string {
  if (pct >= 90) return "shadow-[0_0_12px_rgba(248,113,113,0.5)]";
  if (pct >= 75) return "shadow-[0_0_12px_rgba(251,146,60,0.4)]";
  if (pct >= 50) return "shadow-[0_0_12px_rgba(251,191,36,0.4)]";
  return "shadow-[0_0_12px_rgba(200,168,85,0.4)]";
}

function formatActionType(t: string): string {
  return t
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatRelative(iso: string): string {
  const d = new Date(iso);
  const diff = Date.now() - d.getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

// ── Component ────────────────────────────────────────────────────────────────

export default function UsagePage() {
  const { profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [tokenData, setTokenData] = useState<TokenData>({
    plan: "Growth",
    used: 0,
    limit: 1_000_000,
    bonus_tokens: 0,
    effective_limit: 1_000_000,
    reset_date: "",
    days_remaining: 0,
    daily_average: 0,
    by_category: {},
    daily_usage: [],
    recent_activity: [],
  });
  const [buying, setBuying] = useState(false);
  const [selectedPack, setSelectedPack] = useState<string | null>(null);
  const [buySuccess, setBuySuccess] = useState<string | null>(null);

  const planTier = (profile?.plan_tier || "Growth") as string;
  const planConfig = isValidPlanTier(planTier)
    ? PLAN_TIERS[planTier as PlanTier]
    : PLAN_TIERS.Growth;
  const isUnlimited = planConfig.tokens_monthly === -1;

  // ── Fetch token data ────────────────────────────────────────────────────

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/billing/tokens");
      if (!res.ok) throw new Error(`Failed to fetch (${res.status})`);
      const data = await res.json();
      setTokenData(data);
    } catch (err) {
      // Leave defaults in place on error — but log so we catch real outages.
      console.error("[usage] fetchData error:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // ── Derived values ──────────────────────────────────────────────────────

  const effectiveLimit = tokenData.effective_limit;
  const used = tokenData.used;
  const remaining =
    effectiveLimit === -1 ? -1 : Math.max(0, effectiveLimit - used);
  const pct =
    effectiveLimit > 0 ? Math.min(100, (used / effectiveLimit) * 100) : 0;

  const maxCategory = Math.max(0, ...Object.values(tokenData.by_category));
  const maxDaily = Math.max(
    1,
    ...tokenData.daily_usage.map((d) => d.tokens)
  );

  // ── Buy tokens ──────────────────────────────────────────────────────────

  async function handleBuy() {
    if (!selectedPack) return;
    setBuying(true);
    try {
      const res = await fetch("/api/billing/buy-tokens", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pack_id: selectedPack }),
      });
      const data = await res.json();
      // Stripe's buy-tokens endpoint may return either a redirect URL
      // (real Checkout flow) or a success message (when credits are
      // applied directly). Handle both and surface any error.
      const redirectUrl = data.url || data.checkout_url;
      if (redirectUrl) {
        window.location.href = redirectUrl as string;
        return;
      }
      if (data.success) {
        const msg = data.message || "Tokens added to your balance!";
        setBuySuccess(msg);
        toast.success(msg);
        setSelectedPack(null);
        fetchData();
        setTimeout(() => setBuySuccess(null), 5000);
      } else {
        toast.error(data.error || "Token purchase failed. Please try again.");
      }
    } catch (err) {
      console.error("[usage] handleBuy error:", err);
      toast.error(err instanceof Error ? err.message : "Network error. Please try again.");
    } finally {
      setBuying(false);
    }
  }

  // ── Render ──────────────────────────────────────────────────────────────

  return (
    <div className="fade-in p-6 max-w-5xl mx-auto space-y-5">
      <PageHero
        icon={<Zap size={28} />}
        title="Token Usage"
        subtitle="Monitor AI consumption & manage balance."
        gradient="purple"
        actions={
          <>
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-white/20 bg-white/15 text-white text-xs font-medium">
              <Shield size={12} />
              {planConfig.badge_label} Plan
            </div>
            <button
              onClick={fetchData}
              disabled={loading}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-white/20 bg-white/10 text-white text-xs hover:bg-white/20 transition-all"
            >
              <RefreshCw size={12} className={loading ? "animate-spin" : ""} />
              Refresh
            </button>
          </>
        }
      />

      {/* ── Stats Strip ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {/* Tokens Used */}
        <div className="card p-4 flex flex-col gap-1">
          <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-muted font-medium">
            <Activity size={10} />
            Tokens Used
          </div>
          {loading ? (
            <div className="h-6 w-20 bg-surface-light animate-pulse rounded" />
          ) : (
            <div className="text-2xl font-bold text-foreground">
              {fmt(used)}
            </div>
          )}
          <div className="text-[10px] text-muted">this month</div>
        </div>

        {/* Remaining */}
        <div className="card p-4 flex flex-col gap-1">
          <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-muted font-medium">
            <Zap size={10} />
            Remaining
          </div>
          {loading ? (
            <div className="h-6 w-20 bg-surface-light animate-pulse rounded" />
          ) : (
            <div
              className={`text-2xl font-bold ${
                isUnlimited
                  ? "text-gold"
                  : remaining < effectiveLimit * 0.1
                  ? "text-red-400"
                  : "text-foreground"
              }`}
            >
              {isUnlimited ? "∞" : fmt(remaining)}
            </div>
          )}
          <div className="text-[10px] text-muted">
            {isUnlimited ? "unlimited" : `of ${fmtShort(effectiveLimit)}`}
          </div>
        </div>

        {/* Resets In */}
        <div className="card p-4 flex flex-col gap-1">
          <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-muted font-medium">
            <Clock size={10} />
            Resets In
          </div>
          {loading ? (
            <div className="h-6 w-16 bg-surface-light animate-pulse rounded" />
          ) : (
            <div className="text-2xl font-bold text-foreground">
              {tokenData.days_remaining}
            </div>
          )}
          <div className="text-[10px] text-muted">days</div>
        </div>

        {/* Daily Average */}
        <div className="card p-4 flex flex-col gap-1">
          <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-muted font-medium">
            <TrendingUp size={10} />
            Daily Avg
          </div>
          {loading ? (
            <div className="h-6 w-16 bg-surface-light animate-pulse rounded" />
          ) : (
            <div className="text-2xl font-bold text-foreground">
              {fmtShort(tokenData.daily_average)}
            </div>
          )}
          <div className="text-[10px] text-muted">tokens / day</div>
        </div>
      </div>

      {/* ── Progress Bar ── */}
      {!isUnlimited && (
        <div className="card p-5 space-y-3">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted">Monthly usage</span>
            <span className="font-medium text-foreground">
              {pct.toFixed(1)}% used
            </span>
          </div>

          {/* Track */}
          <div className="relative h-4 rounded-full bg-surface-light overflow-hidden">
            {loading ? (
              <div className="h-full w-1/3 bg-surface animate-pulse rounded-full" />
            ) : (
              <div
                className={`h-full rounded-full transition-all duration-700 ${getProgressColor(
                  pct
                )} ${getProgressGlow(pct)}`}
                style={{ width: `${pct}%` }}
              />
            )}
          </div>

          <div className="flex items-center justify-between text-[11px] text-muted">
            <span>
              {fmt(used)} used of {fmt(effectiveLimit)}{" "}
              {tokenData.bonus_tokens > 0 && (
                <span className="text-gold">
                  (+{fmtShort(tokenData.bonus_tokens)} bonus)
                </span>
              )}
            </span>
            <span
              className={`font-medium ${
                pct >= 90
                  ? "text-red-400"
                  : pct >= 75
                  ? "text-orange-400"
                  : "text-muted"
              }`}
            >
              {pct >= 90
                ? "Critical — buy more or upgrade"
                : pct >= 75
                ? "Running low"
                : `${planConfig.badge_label} plan limit`}
            </span>
          </div>
        </div>
      )}

      {/* ── Usage by Category + Daily Chart (side by side on larger screens) ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Usage by Category */}
        <div className="card p-5 space-y-4">
          <div className="flex items-center gap-2 text-sm font-medium text-foreground">
            <BarChart3 size={14} className="text-gold" />
            Usage by Category
          </div>

          {loading ? (
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="space-y-1.5">
                  <div className="h-3 w-28 bg-surface-light animate-pulse rounded" />
                  <div className="h-2 rounded-full bg-surface-light animate-pulse" style={{ width: `${60 - i * 10}%` }} />
                </div>
              ))}
            </div>
          ) : Object.keys(tokenData.by_category).length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 gap-2 text-muted">
              <Sparkles size={24} className="opacity-30" />
              <p className="text-xs">No AI activity recorded this month</p>
            </div>
          ) : (
            <div className="space-y-3">
              {Object.entries(tokenData.by_category)
                .sort(([, a], [, b]) => b - a)
                .map(([cat, tokens]) => {
                  const barPct = maxCategory > 0 ? (tokens / maxCategory) * 100 : 0;
                  return (
                    <div key={cat} className="space-y-1">
                      <div className="flex items-center justify-between text-[11px]">
                        <div className="flex items-center gap-1.5 text-muted">
                          <span className="text-foreground opacity-60">
                            {CATEGORY_ICONS[cat] ?? <BarChart3 size={13} />}
                          </span>
                          {cat}
                        </div>
                        <span className="font-medium text-foreground tabular-nums">
                          {fmt(tokens)}
                        </span>
                      </div>
                      <div className="h-1.5 rounded-full bg-surface-light overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${
                            CATEGORY_COLORS[cat] ?? "bg-slate-400"
                          }`}
                          style={{ width: `${barPct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
            </div>
          )}
        </div>

        {/* Daily Usage Chart */}
        <div className="card p-5 space-y-4">
          <div className="flex items-center gap-2 text-sm font-medium text-foreground">
            <Calendar size={14} className="text-gold" />
            Daily Usage (Last 30 Days)
          </div>

          {loading ? (
            <div className="flex items-end gap-0.5 h-24">
              {[...Array(30)].map((_, i) => (
                <div
                  key={i}
                  className="flex-1 bg-surface-light animate-pulse rounded-t"
                  style={{ height: `${20 + Math.random() * 60}%` }}
                />
              ))}
            </div>
          ) : (
            <div className="flex items-end gap-0.5 h-28" title="Daily token usage">
              {tokenData.daily_usage.map((d) => {
                const h = maxDaily > 0 ? (d.tokens / maxDaily) * 100 : 0;
                const label = d.date.substring(5); // MM-DD
                return (
                  <div
                    key={d.date}
                    className="flex-1 flex flex-col items-center justify-end h-full group relative"
                  >
                    <div
                      className="w-full rounded-t transition-all duration-300 bg-gold/60 group-hover:bg-gold"
                      style={{ height: `${Math.max(h, d.tokens > 0 ? 4 : 0)}%` }}
                    />
                    {/* Tooltip */}
                    <div className="absolute bottom-full mb-1.5 left-1/2 -translate-x-1/2 hidden group-hover:block z-10 pointer-events-none">
                      <div className="bg-surface border border-border rounded-lg px-2 py-1 text-[10px] whitespace-nowrap shadow-elevated">
                        <div className="font-medium text-foreground">{fmt(d.tokens)}</div>
                        <div className="text-muted">{label}</div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* X-axis labels: show start, mid, end */}
          {!loading && tokenData.daily_usage.length > 0 && (
            <div className="flex justify-between text-[9px] text-muted mt-1">
              <span>{tokenData.daily_usage[0]?.date.substring(5)}</span>
              <span>{tokenData.daily_usage[14]?.date.substring(5)}</span>
              <span>{tokenData.daily_usage[29]?.date.substring(5)}</span>
            </div>
          )}
        </div>
      </div>

      {/* ── Buy More Tokens ── */}
      {isUnlimited ? (
        <div className="card p-5 flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-gold/10 border border-gold/20 flex items-center justify-center text-gold shrink-0">
            <Zap size={18} />
          </div>
          <div>
            <div className="text-sm font-medium text-foreground">You have unlimited tokens</div>
            <div className="text-xs text-muted mt-0.5">
              Your {planConfig.badge_label} plan includes unlimited AI token usage — no limits, no worries.
            </div>
          </div>
        </div>
      ) : (
        <div className="card p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm font-medium text-foreground">
              <Package size={14} className="text-gold" />
              Buy More Tokens
            </div>
            <Link
              href="/dashboard/pricing"
              className="flex items-center gap-1 text-xs text-gold hover:underline"
            >
              Or upgrade your plan <ChevronRight size={12} />
            </Link>
          </div>

          <p className="text-xs text-muted">
            Need more tokens before your plan resets? Purchase a one-time pack
            and it will be added immediately to your balance.
          </p>

          {/* Pack cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {TOKEN_PACKS.map((pack) => (
              <button
                key={pack.id}
                onClick={() =>
                  setSelectedPack(selectedPack === pack.id ? null : pack.id)
                }
                className={`relative flex flex-col items-center gap-1.5 p-4 rounded-xl border text-center transition-all ${
                  selectedPack === pack.id
                    ? "border-gold bg-gold/10 text-gold"
                    : "border-border bg-surface-light text-foreground hover:border-gold/50"
                }`}
              >
                {pack.popular && (
                  <div className="absolute -top-2 left-1/2 -translate-x-1/2 bg-gold text-black text-[9px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">
                    Popular
                  </div>
                )}
                <div className="text-lg font-bold">{pack.label}</div>
                <div className="text-[10px] text-muted">tokens</div>
                <div className="text-sm font-semibold">${pack.price}</div>
              </button>
            ))}
          </div>

          {/* Buy button / success */}
          {buySuccess ? (
            <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm">
              <Zap size={14} />
              {buySuccess}
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <button
                onClick={handleBuy}
                disabled={!selectedPack || buying}
                className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium transition-all ${
                  selectedPack && !buying
                    ? "bg-gold text-black hover:bg-gold/90"
                    : "bg-surface-light text-muted cursor-not-allowed"
                }`}
              >
                {buying ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <Plus size={14} />
                )}
                {buying ? "Processing..." : selectedPack ? "Buy Now" : "Select a Pack"}
              </button>
              {selectedPack && !buying && (
                <span className="text-xs text-muted">
                  {TOKEN_PACKS.find((p) => p.id === selectedPack)?.tokens.toLocaleString()} tokens for ${TOKEN_PACKS.find((p) => p.id === selectedPack)?.price}
                </span>
              )}
            </div>
          )}

          <p className="text-[10px] text-muted">
            Token packs are added to your account instantly. Bonus tokens carry
            over and are used before your plan&apos;s monthly allocation.
          </p>
        </div>
      )}

      {/* ── Recent Activity ── */}
      <div className="card p-5 space-y-4">
        <div className="flex items-center gap-2 text-sm font-medium text-foreground">
          <Activity size={14} className="text-gold" />
          Recent AI Activity
        </div>

        {loading ? (
          <div className="space-y-2">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-10 bg-surface-light animate-pulse rounded-xl" />
            ))}
          </div>
        ) : tokenData.recent_activity.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 gap-2 text-muted">
            <Sparkles size={24} className="opacity-30" />
            <p className="text-xs">No AI activity recorded this month</p>
          </div>
        ) : (
          <div className="overflow-x-auto -mx-1">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left text-[10px] uppercase tracking-wider text-muted border-b border-border">
                  <th className="pb-2 font-medium pl-1">Time</th>
                  <th className="pb-2 font-medium">Type</th>
                  <th className="pb-2 font-medium hidden sm:table-cell">Description</th>
                  <th className="pb-2 font-medium text-right pr-1">Tokens</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {tokenData.recent_activity.map((item) => (
                  <tr key={item.id} className="hover:bg-surface-light/50 transition-colors">
                    <td className="py-2.5 pl-1 text-muted whitespace-nowrap">
                      {formatRelative(item.created_at)}
                    </td>
                    <td className="py-2.5">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-surface-light border border-border text-[10px] font-medium text-foreground whitespace-nowrap">
                        {formatActionType(item.action_type)}
                      </span>
                    </td>
                    <td className="py-2.5 text-muted hidden sm:table-cell max-w-[200px] truncate">
                      {item.description || "—"}
                    </td>
                    <td className="py-2.5 pr-1 text-right font-medium tabular-nums text-gold whitespace-nowrap">
                      {fmt(item.tokens_used)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── PageAI ── */}
      <PageAI
        pageName="Token Usage"
        context={`The user is on the Token Usage page. They have used ${fmt(used)} tokens this month on the ${planTier} plan. Their limit is ${isUnlimited ? "unlimited" : fmt(effectiveLimit)}. They have ${tokenData.days_remaining} days until the reset. Daily average is ${fmt(tokenData.daily_average)} tokens.`}
        suggestions={[
          "How can I reduce my token usage?",
          "Which features use the most tokens?",
          "What happens when I run out of tokens?",
          "How do token packs work?",
        ]}
      />
    </div>
  );
}
