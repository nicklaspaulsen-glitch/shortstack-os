"use client";

/**
 * Referrals — earn commission every time someone you referred pays for
 * ShortStack.
 *
 * Composition:
 *   1. Hero with unique referral code + share link + copy + social share
 *   2. Three stat cards (this month / all time / pending) + projected MRR
 *   3. Two-column bottom: referred-users table (left) + leaderboard (right)
 *
 * Data flows through four endpoints under /api/referrals/*:
 *   - GET /me              → own code + aggregate stats
 *   - GET /list            → list of referred users (+ plan tiers)
 *   - GET /leaderboard     → top 3 (regular) or top 10 (admin) + own rank
 *   - POST /generate-code  → regenerate own code (invalidates old one)
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import {
  Gift,
  Copy,
  RefreshCw,
  TrendingUp,
  Wallet,
  Clock,
  Sparkles,
  MessageCircle,
  Check,
  Trophy,
  Users,
  ArrowUpRight,
  Loader2,
} from "lucide-react";

// Brand icons — inline SVG because lucide-react dropped the brand marks in
// v0.344+. These are the official simple-icons glyphs; they scale cleanly
// at 14px.
function TwitterIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}

function FacebookIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M9.101 23.691v-7.98H6.627v-3.667h2.474v-1.58c0-4.085 1.848-5.978 5.858-5.978.401 0 .955.042 1.468.103a8.68 8.68 0 0 1 1.141.195v3.325a8.623 8.623 0 0 0-.653-.036 26.805 26.805 0 0 0-.733-.009c-.707 0-1.259.096-1.675.309a1.686 1.686 0 0 0-.679.622c-.258.42-.374.995-.374 1.752v1.297h3.919l-.386 2.103-.287 1.564h-3.246v8.245C19.396 23.238 24 18.179 24 12.044c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.628 3.874 10.35 9.101 11.647Z" />
    </svg>
  );
}

function LinkedinIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.268 2.37 4.268 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.063 2.063 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
    </svg>
  );
}
import PageHero from "@/components/ui/page-hero";
import { COMMISSION_RATES } from "@/lib/referral-commission";
import { PLAN_TIERS, getPlanConfig, type PlanTier } from "@/lib/plan-config";

// ── Types ────────────────────────────────────────────────────────────────────
interface MeResponse {
  referral_code: string;
  share_url: string;
  stats: {
    total_referrals: number;
    active_subs: number;
    total_earned_cents: number;
    pending_payout_cents: number;
    this_month_cents: number;
    projected_monthly_cents: number;
  };
}

interface ReferralRow {
  id: string;
  email: string;
  full_name: string;
  plan_tier: string;
  subscription_status: string;
  signed_up_at: string;
  commission_pct: number;
}

interface LeaderboardEntry {
  rank: number;
  display_name: string;
  total_cents: number;
  is_you: boolean;
}

interface LeaderboardResponse {
  is_admin_view: boolean;
  top: LeaderboardEntry[];
  own_rank: number | null;
  own_total_cents: number;
  total_referrers: number;
}

// ── Helpers ──────────────────────────────────────────────────────────────────
function fmtCents(cents: number): string {
  return `$${(cents / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function fmtDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  } catch {
    return "—";
  }
}

const SHARE_BLURB = "I've been using ShortStack to run my agency on autopilot — lead gen, socials, content, the works. Sign up through my link and get a head start:";

// ── Page ─────────────────────────────────────────────────────────────────────
export default function ReferralsPage() {
  const [me, setMe] = useState<MeResponse | null>(null);
  const [meLoading, setMeLoading] = useState(true);
  const [referrals, setReferrals] = useState<ReferralRow[]>([]);
  const [referralsLoading, setReferralsLoading] = useState(true);
  const [leaderboard, setLeaderboard] = useState<LeaderboardResponse | null>(null);
  const [leaderboardLoading, setLeaderboardLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [regenLoading, setRegenLoading] = useState(false);

  const loadMe = useCallback(async () => {
    try {
      const res = await fetch("/api/referrals/me", { cache: "no-store" });
      if (!res.ok) throw new Error(`referrals/me ${res.status}`);
      const data = (await res.json()) as MeResponse;
      setMe(data);
    } catch (err) {
      console.error("[referrals] me fetch failed:", err);
    } finally {
      setMeLoading(false);
    }
  }, []);

  const loadReferrals = useCallback(async () => {
    try {
      const res = await fetch("/api/referrals/list", { cache: "no-store" });
      if (!res.ok) throw new Error(`referrals/list ${res.status}`);
      const data = (await res.json()) as { referrals: ReferralRow[] };
      setReferrals(data.referrals || []);
    } catch (err) {
      console.error("[referrals] list fetch failed:", err);
    } finally {
      setReferralsLoading(false);
    }
  }, []);

  const loadLeaderboard = useCallback(async () => {
    try {
      const res = await fetch("/api/referrals/leaderboard", { cache: "no-store" });
      if (!res.ok) throw new Error(`referrals/leaderboard ${res.status}`);
      const data = (await res.json()) as LeaderboardResponse;
      setLeaderboard(data);
    } catch (err) {
      console.error("[referrals] leaderboard fetch failed:", err);
    } finally {
      setLeaderboardLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadMe();
    void loadReferrals();
    void loadLeaderboard();
  }, [loadMe, loadReferrals, loadLeaderboard]);

  const handleCopy = useCallback(async () => {
    if (!me?.share_url) return;
    try {
      await navigator.clipboard.writeText(me.share_url);
      setCopied(true);
      toast.success("Link copied!");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Couldn't copy — select and copy manually");
    }
  }, [me?.share_url]);

  const handleRegen = useCallback(async () => {
    if (regenLoading) return;
    if (!window.confirm("Regenerate your referral code? Your old link will stop working.")) return;
    setRegenLoading(true);
    try {
      const res = await fetch("/api/referrals/generate-code", { method: "POST" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error || "Couldn't regenerate code");
        return;
      }
      toast.success("New code generated!");
      await loadMe();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Network error");
    } finally {
      setRegenLoading(false);
    }
  }, [regenLoading, loadMe]);

  // Pre-compose share URLs — all parameters URL-encoded.
  const shareLinks = useMemo(() => {
    if (!me?.share_url) return null;
    const url = encodeURIComponent(me.share_url);
    const text = encodeURIComponent(`${SHARE_BLURB} ${me.share_url}`);
    const blurb = encodeURIComponent(SHARE_BLURB);
    return {
      twitter: `https://twitter.com/intent/tweet?text=${text}`,
      facebook: `https://www.facebook.com/sharer/sharer.php?u=${url}`,
      linkedin: `https://www.linkedin.com/sharing/share-offsite/?url=${url}`,
      whatsapp: `https://wa.me/?text=${text}`,
      email: `mailto:?subject=${encodeURIComponent("Try ShortStack")}&body=${blurb}%20${url}`,
    };
  }, [me?.share_url]);

  return (
    <div className="fade-in max-w-6xl mx-auto space-y-6">
      <PageHero
        icon={<Gift size={22} />}
        eyebrow="Affiliate program"
        title="Referrals & commissions"
        subtitle="Share your link. Earn 10–30% monthly commission for 12 months on every referral."
        gradient="purple"
      />

      {/* ─── Hero: code + share link + social buttons ──────────────── */}
      <section
        className="rounded-2xl border p-5 sm:p-6"
        style={{
          background:
            "linear-gradient(135deg, rgba(168, 85, 247, 0.08) 0%, rgba(26, 16, 51, 0.0) 70%)",
          borderColor: "rgba(168, 85, 247, 0.25)",
        }}
      >
        <div className="flex items-start justify-between gap-4 flex-wrap mb-4">
          <div className="min-w-0">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-muted mb-1">
              Your referral code
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <code className="text-2xl sm:text-3xl font-bold tracking-widest text-foreground bg-surface border border-border rounded-xl px-4 py-2">
                {meLoading ? "—" : me?.referral_code ?? "—"}
              </code>
              <button
                onClick={handleRegen}
                disabled={regenLoading || meLoading}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-surface-light text-foreground text-xs font-medium border border-border hover:bg-purple-500/10 hover:text-purple-300 transition-colors disabled:opacity-60"
                title="Regenerate code (invalidates old link)"
              >
                {regenLoading ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
                Regenerate
              </button>
            </div>
          </div>
          <div className="text-right">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-muted mb-1">
              Projected MRR
            </div>
            <div className="text-xl sm:text-2xl font-bold text-foreground">
              {meLoading ? "—" : fmtCents(me?.stats.projected_monthly_cents ?? 0)}
            </div>
            <div className="text-[10px] text-muted">
              from {me?.stats.active_subs ?? 0} active sub{me?.stats.active_subs === 1 ? "" : "s"}
            </div>
          </div>
        </div>

        {/* Share link + copy */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex-1 min-w-[260px] flex items-center gap-2 bg-surface border border-border rounded-xl px-3 py-2">
            <span className="text-xs text-muted truncate flex-1">
              {meLoading ? "Loading…" : me?.share_url ?? "—"}
            </span>
            <button
              onClick={handleCopy}
              disabled={meLoading || !me?.share_url}
              className="flex items-center gap-1 text-xs font-medium text-purple-300 hover:text-purple-200 transition-colors disabled:opacity-60 shrink-0"
            >
              {copied ? <Check size={12} /> : <Copy size={12} />}
              {copied ? "Copied" : "Copy link"}
            </button>
          </div>

          {/* Social share buttons */}
          {shareLinks && (
            <div className="flex items-center gap-1.5">
              <a
                href={shareLinks.twitter}
                target="_blank"
                rel="noreferrer noopener"
                className="w-9 h-9 rounded-xl bg-surface border border-border flex items-center justify-center text-muted hover:text-sky-400 hover:border-sky-500/30 transition-colors"
                title="Share on Twitter"
              >
                <TwitterIcon size={14} />
              </a>
              <a
                href={shareLinks.facebook}
                target="_blank"
                rel="noreferrer noopener"
                className="w-9 h-9 rounded-xl bg-surface border border-border flex items-center justify-center text-muted hover:text-blue-400 hover:border-blue-500/30 transition-colors"
                title="Share on Facebook"
              >
                <FacebookIcon size={14} />
              </a>
              <a
                href={shareLinks.linkedin}
                target="_blank"
                rel="noreferrer noopener"
                className="w-9 h-9 rounded-xl bg-surface border border-border flex items-center justify-center text-muted hover:text-sky-500 hover:border-sky-500/30 transition-colors"
                title="Share on LinkedIn"
              >
                <LinkedinIcon size={14} />
              </a>
              <a
                href={shareLinks.whatsapp}
                target="_blank"
                rel="noreferrer noopener"
                className="w-9 h-9 rounded-xl bg-surface border border-border flex items-center justify-center text-muted hover:text-emerald-400 hover:border-emerald-500/30 transition-colors"
                title="Share on WhatsApp"
              >
                <MessageCircle size={14} />
              </a>
            </div>
          )}
        </div>

        {/* Commission tier strip */}
        <div className="mt-5 grid grid-cols-2 sm:grid-cols-5 gap-2">
          {(["Starter", "Growth", "Pro", "Business", "Unlimited"] as PlanTier[]).map((tier) => {
            const pct = Math.round((COMMISSION_RATES[tier] ?? 0) * 100);
            const cfg = PLAN_TIERS[tier];
            return (
              <div
                key={tier}
                className="rounded-xl border border-border bg-surface/60 px-3 py-2.5 flex items-center justify-between gap-2"
                style={{ borderColor: `${cfg.color}25` }}
              >
                <div className="min-w-0">
                  <div className="text-[10px] font-semibold uppercase tracking-wider text-muted">{tier}</div>
                  <div className="text-[11px] text-muted">${cfg.price_monthly.toLocaleString()}/mo</div>
                </div>
                <div className="text-base font-bold shrink-0" style={{ color: cfg.color }}>
                  {pct}%
                </div>
              </div>
            );
          })}
        </div>
        <p className="text-[10px] text-muted mt-3">
          Commission paid monthly for 12 months on every active subscription. Payout sent on the 1st of each month via Stripe Connect.
        </p>
      </section>

      {/* ─── Stat cards ─────────────────────────────────────────────── */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <StatCard
          icon={<TrendingUp size={14} />}
          accent="#10b981"
          label="This month"
          value={meLoading ? "—" : fmtCents(me?.stats.this_month_cents ?? 0)}
          sublabel="Current cycle"
        />
        <StatCard
          icon={<Wallet size={14} />}
          accent="#c8a855"
          label="All time earned"
          value={meLoading ? "—" : fmtCents(me?.stats.total_earned_cents ?? 0)}
          sublabel={`${me?.stats.total_referrals ?? 0} total referral${me?.stats.total_referrals === 1 ? "" : "s"}`}
        />
        <StatCard
          icon={<Clock size={14} />}
          accent="#a855f7"
          label="Pending payout"
          value={meLoading ? "—" : fmtCents(me?.stats.pending_payout_cents ?? 0)}
          sublabel="Paid on the 1st"
        />
      </section>

      {/* ─── Bottom: referred users + leaderboard ──────────────────── */}
      <section className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Referrals table */}
        <div className="lg:col-span-2 rounded-2xl border border-border bg-surface overflow-hidden">
          <div className="px-5 py-3.5 border-b border-border flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Users size={14} className="text-purple-300" />
              <h2 className="text-sm font-bold text-foreground">Referred users</h2>
              {!referralsLoading && (
                <span className="text-[10px] text-muted">· {referrals.length}</span>
              )}
            </div>
          </div>
          {referralsLoading ? (
            <div className="p-5 space-y-2">
              <div className="h-10 animate-pulse rounded bg-surface-light" />
              <div className="h-10 animate-pulse rounded bg-surface-light" />
              <div className="h-10 animate-pulse rounded bg-surface-light" />
            </div>
          ) : referrals.length === 0 ? (
            <div className="p-8 text-center">
              <div className="w-12 h-12 mx-auto rounded-2xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center mb-3">
                <Sparkles size={18} className="text-purple-300" />
              </div>
              <p className="text-sm font-medium text-foreground mb-1">No referrals yet</p>
              <p className="text-xs text-muted max-w-xs mx-auto">
                Share your link above. When someone signs up and subscribes, they'll appear here and you start earning.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-surface-light/30">
                    <th className="text-left px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-muted">User</th>
                    <th className="text-left px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-muted">Plan</th>
                    <th className="text-left px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-muted">Commission</th>
                    <th className="text-left px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-muted">Status</th>
                    <th className="text-left px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-muted">Joined</th>
                  </tr>
                </thead>
                <tbody>
                  {referrals.map((r) => {
                    const cfg = getPlanConfig(r.plan_tier);
                    const active = r.subscription_status === "active" || r.subscription_status === "trialing";
                    return (
                      <tr key={r.id} className="border-b border-border last:border-0 hover:bg-surface-light/20 transition-colors">
                        <td className="px-4 py-3">
                          <div className="text-xs font-semibold text-foreground truncate max-w-[180px]">
                            {r.full_name || "—"}
                          </div>
                          <div className="text-[10px] text-muted truncate max-w-[180px]">{r.email}</div>
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold"
                            style={{ background: `${cfg.color}18`, color: cfg.color }}
                          >
                            {cfg.badge_label}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-xs text-foreground font-semibold">
                          {r.commission_pct}%
                          <span className="text-[10px] text-muted font-normal"> · {fmtCents(Math.round(cfg.price_monthly * 100 * (r.commission_pct / 100)))}/mo</span>
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                              active
                                ? "bg-emerald-500/15 text-emerald-400"
                                : "bg-surface-light text-muted"
                            }`}
                          >
                            {active ? "Active" : r.subscription_status || "Inactive"}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-xs text-muted">{fmtDate(r.signed_up_at)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Leaderboard */}
        <div className="rounded-2xl border border-border bg-surface overflow-hidden">
          <div className="px-5 py-3.5 border-b border-border flex items-center gap-2">
            <Trophy size={14} className="text-amber-400" />
            <h2 className="text-sm font-bold text-foreground">Leaderboard</h2>
            {leaderboard?.is_admin_view && (
              <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-purple-500/15 text-purple-300">
                Admin
              </span>
            )}
          </div>
          {leaderboardLoading ? (
            <div className="p-5 space-y-2">
              <div className="h-10 animate-pulse rounded bg-surface-light" />
              <div className="h-10 animate-pulse rounded bg-surface-light" />
              <div className="h-10 animate-pulse rounded bg-surface-light" />
            </div>
          ) : !leaderboard || leaderboard.top.length === 0 ? (
            <div className="p-6 text-center">
              <p className="text-xs text-muted">Nobody's earned yet. Be first?</p>
            </div>
          ) : (
            <div className="p-3 space-y-1.5">
              {leaderboard.top.map((entry) => (
                <LeaderboardRow key={`${entry.rank}-${entry.display_name}`} entry={entry} />
              ))}
              {leaderboard.own_rank && leaderboard.own_rank > leaderboard.top.length && !leaderboard.is_admin_view && (
                <>
                  <div className="flex items-center gap-2 py-1">
                    <div className="flex-1 h-px bg-border" />
                    <span className="text-[9px] font-bold uppercase tracking-wider text-muted">Your rank</span>
                    <div className="flex-1 h-px bg-border" />
                  </div>
                  <LeaderboardRow
                    entry={{
                      rank: leaderboard.own_rank,
                      display_name: "You",
                      total_cents: leaderboard.own_total_cents,
                      is_you: true,
                    }}
                  />
                </>
              )}
              <div className="text-[10px] text-muted text-center pt-2">
                {leaderboard.total_referrers} referrer{leaderboard.total_referrers === 1 ? "" : "s"} earning
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Footer help */}
      <div className="rounded-2xl border border-border bg-surface p-5 flex items-start gap-4 flex-wrap">
        <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center shrink-0">
          <Sparkles size={16} className="text-purple-300" />
        </div>
        <div className="flex-1 min-w-[220px]">
          <h3 className="text-sm font-semibold text-foreground mb-1">How it works</h3>
          <ul className="text-xs text-muted space-y-1 list-disc ml-4">
            <li>Share your link. When someone signs up with it, we attribute them to you forever.</li>
            <li>Once they subscribe to a paid plan, you earn commission on every monthly invoice for 12 months.</li>
            <li>Commission rate = their plan tier. Business tier = 25%, Unlimited = 30%.</li>
            <li>Payouts run on the 1st of each month via Stripe Connect. Minimum $10 payout.</li>
          </ul>
        </div>
        <a
          href="/dashboard/settings"
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-surface-light text-foreground text-xs font-medium border border-border hover:bg-purple-500/10 hover:text-purple-300 transition-colors shrink-0"
        >
          <ArrowUpRight size={12} />
          Connect payout
        </a>
      </div>
    </div>
  );
}

// ── Subcomponents ────────────────────────────────────────────────────────────

function StatCard({
  icon,
  accent,
  label,
  value,
  sublabel,
}: {
  icon: React.ReactNode;
  accent: string;
  label: string;
  value: string;
  sublabel: string;
}) {
  return (
    <div className="rounded-2xl border border-border bg-surface p-4">
      <div className="flex items-center gap-2 mb-2.5">
        <div
          className="w-7 h-7 rounded-lg flex items-center justify-center"
          style={{ background: `${accent}15`, color: accent }}
        >
          {icon}
        </div>
        <span className="text-xs font-semibold text-foreground">{label}</span>
      </div>
      <div className="text-2xl font-bold text-foreground leading-none">{value}</div>
      <p className="text-[10px] text-muted mt-1.5">{sublabel}</p>
    </div>
  );
}

function LeaderboardRow({ entry }: { entry: LeaderboardEntry }) {
  const medal =
    entry.rank === 1 ? "🥇" : entry.rank === 2 ? "🥈" : entry.rank === 3 ? "🥉" : null;
  return (
    <div
      className={`flex items-center gap-3 px-3 py-2 rounded-xl transition-colors ${
        entry.is_you ? "bg-purple-500/10 border border-purple-500/25" : "bg-surface-light/30"
      }`}
    >
      <div className="w-6 text-center text-xs font-bold text-muted">
        {medal ?? `#${entry.rank}`}
      </div>
      <div className="flex-1 min-w-0">
        <div className={`text-xs font-semibold truncate ${entry.is_you ? "text-purple-200" : "text-foreground"}`}>
          {entry.display_name}
          {entry.is_you && <span className="text-[10px] text-purple-300 ml-1">(you)</span>}
        </div>
      </div>
      <div className="text-xs font-bold text-foreground shrink-0">
        ${(entry.total_cents / 100).toLocaleString("en-US", { maximumFractionDigits: 0 })}
      </div>
    </div>
  );
}
