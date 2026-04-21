"use client";

/**
 * Plan comparison + upgrade page.
 *
 * Grid of 5 plan cards (Starter / Growth / Pro / Business / Unlimited) with:
 *  - Monthly price (pulled from `PLAN_TIERS` in src/lib/plan-config.ts)
 *  - Feature list per tier
 *  - Limit columns (emails/tokens/clients/sms/call_minutes) from
 *    `LIMITS_BY_TIER` in src/lib/usage-limits.ts
 *  - "Current plan" pill on active one, disabled
 *  - "Upgrade to [name]" button — POST /api/billing/checkout → Stripe Checkout
 *  - Green "Recommended" badge on Pro
 *
 * Below: "Why upgrade?" savings copy + FAQ.
 */

import { useMemo, useState } from "react";
import Link from "next/link";
import toast from "react-hot-toast";
import {
  ArrowUpRight,
  Check,
  Crown,
  Infinity as InfinityIcon,
  Zap,
  TrendingUp,
  Building2,
  Sparkles,
  Loader2,
  Minus,
  Mail,
  Bot,
  Users,
  Smartphone,
  Phone,
  ShieldCheck,
  Award,
} from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { PLAN_TIERS, type PlanTier } from "@/lib/plan-config";
import { LIMITS_BY_TIER, normalizePlanTier } from "@/lib/plan-limits";
import { formatLimit, getTierFeatures } from "@/lib/plan-display";
import PageHero from "@/components/ui/page-hero";

// ── Plan order (low → high) for "upgrade path" gating ────────────────────────
// `Founder` is intentionally excluded — it's an internal/dev-only tier.
type CheckoutTier = Exclude<PlanTier, "Founder">;
const PLAN_ORDER: CheckoutTier[] = ["Starter", "Growth", "Pro", "Business", "Unlimited"];

function planRank(tier: string): number {
  const idx = PLAN_ORDER.indexOf(tier as CheckoutTier);
  return idx === -1 ? 0 : idx;
}

// ── Plan feature copy ────────────────────────────────────────────────────────
const PLAN_ICONS: Record<CheckoutTier, React.ReactNode> = {
  Starter: <Zap size={18} />,
  Growth: <TrendingUp size={18} />,
  Pro: <Crown size={18} />,
  Business: <Building2 size={18} />,
  Unlimited: <InfinityIcon size={18} />,
};

const PLAN_TAGLINE: Record<CheckoutTier, string> = {
  Starter: "Solo agency getting started",
  Growth: "Scaling to 10-15 clients",
  Pro: "Running at scale with a team",
  Business: "Multi-brand + white label",
  Unlimited: "No caps. No limits.",
};

// Feature bullets are derived from LIMITS_BY_TIER / PLAN_TIERS so the copy
// can never drift from what checkLimit enforces. See src/lib/plan-display.ts.

// ── Resource limits table (display) ──────────────────────────────────────────
const LIMIT_ROWS: Array<{ key: keyof (typeof LIMITS_BY_TIER)["Starter"]; label: string; icon: React.ReactNode; suffix?: string }> = [
  { key: "emails", label: "Emails / mo", icon: <Mail size={12} /> },
  { key: "tokens", label: "AI Tokens / mo", icon: <Bot size={12} /> },
  { key: "clients", label: "Active Clients", icon: <Users size={12} /> },
  { key: "sms", label: "SMS / mo", icon: <Smartphone size={12} /> },
  { key: "call_minutes", label: "Call Minutes / mo", icon: <Phone size={12} />, suffix: "min" },
];

// ── FAQ content ──────────────────────────────────────────────────────────────
const FAQS: Array<{ q: string; a: string }> = [
  {
    q: "Can I switch plans at any time?",
    a: "Yes. Upgrades take effect immediately and you're only charged the prorated difference. Downgrades take effect at the end of your current billing cycle.",
  },
  {
    q: "What happens if I hit my token limit mid-month?",
    a: "You'll get a notice in-product (and hit a friendly wall on metered features). You can top up with a one-time token pack on the Billing page, or upgrade your plan.",
  },
  {
    q: "Do unused tokens roll over?",
    a: "No — monthly AI tokens reset at the start of each billing cycle. One-time token top-ups, however, roll over until used.",
  },
  {
    q: "Is there a free trial?",
    a: "Every plan comes with a 14-day free trial. You can cancel anytime from the Stripe customer portal before the trial ends with no charge.",
  },
  {
    q: "How does the AI Caller pricing work?",
    a: "Each plan includes a monthly call-minute allowance. Additional minutes are billed at $0.12/min — you'll only pay for what you use beyond your plan's bundle.",
  },
  {
    q: "Can I cancel anytime?",
    a: "Yes. There are no contracts — click 'Manage subscription' on the Billing page to open the Stripe customer portal and cancel with a click.",
  },
];

// ── Component ────────────────────────────────────────────────────────────────
export default function UpgradePage() {
  const { profile } = useAuth();
  const [billingCycle, setBillingCycle] = useState<"monthly" | "yearly">("monthly");
  const [loadingTier, setLoadingTier] = useState<CheckoutTier | null>(null);
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  // `Founder` normalizes to "Founder" which isn't in the checkout grid; treat
  // it like `Starter` for ranking/visual purposes (the internal tier doesn't
  // get a card), but still disable all upgrade buttons (Founder is effectively
  // unlimited already).
  const currentTier = useMemo(() => {
    const norm = normalizePlanTier(profile?.plan_tier);
    return (norm === "Founder" ? "Unlimited" : norm) as CheckoutTier;
  }, [profile?.plan_tier]);
  const currentRank = planRank(currentTier);

  async function handleUpgrade(tier: CheckoutTier) {
    if (loadingTier) return;
    if (tier === currentTier) return;
    setLoadingTier(tier);
    try {
      const res = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          plan_tier: tier.toLowerCase(),
          billing_cycle: billingCycle,
        }),
      });
      const data = await res.json();
      const redirectUrl = data.url || data.checkout_url;
      if (redirectUrl) {
        window.location.href = redirectUrl as string;
      } else {
        toast.error(data.error || "Checkout failed. Please try again.");
        setLoadingTier(null);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Network error");
      setLoadingTier(null);
    }
  }

  return (
    <div className="fade-in max-w-7xl mx-auto space-y-8">
      <PageHero
        icon={<Crown size={22} />}
        eyebrow="Plans"
        title="Upgrade your plan"
        subtitle="Scale your agency with higher limits, white-label, and more AI power."
        gradient="gold"
        actions={
          <div className="flex items-center gap-2 bg-white/10 border border-white/15 rounded-xl p-1">
            <button
              onClick={() => setBillingCycle("monthly")}
              className={`px-3 py-1 rounded-lg text-[11px] font-medium transition-all ${
                billingCycle === "monthly" ? "bg-white text-black" : "text-white/70 hover:text-white"
              }`}
            >
              Monthly
            </button>
            <button
              onClick={() => setBillingCycle("yearly")}
              className={`px-3 py-1 rounded-lg text-[11px] font-medium transition-all flex items-center gap-1 ${
                billingCycle === "yearly" ? "bg-white text-black" : "text-white/70 hover:text-white"
              }`}
            >
              Yearly
              <span
                className={`text-[9px] font-bold px-1 py-0.5 rounded ${
                  billingCycle === "yearly" ? "bg-emerald-500/20 text-emerald-700" : "bg-white/20 text-white"
                }`}
              >
                -20%
              </span>
            </button>
          </div>
        }
      />

      {/* ─── Plan cards grid ───────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-3">
        {PLAN_ORDER.map((tier) => {
          const config = PLAN_TIERS[tier];
          const isCurrent = tier === currentTier;
          const isRecommended = tier === "Pro";
          const isDowngrade = planRank(tier) < currentRank;
          const isUpgrade = planRank(tier) > currentRank;
          const monthlyBase = config.price_monthly;
          const displayPrice =
            billingCycle === "yearly" ? Math.round(monthlyBase * 0.8) : monthlyBase;
          const limits = LIMITS_BY_TIER[tier];

          return (
            <div
              key={tier}
              className={`relative rounded-2xl border p-5 flex flex-col transition-all ${
                isRecommended
                  ? "border-emerald-500/30 bg-emerald-500/[0.03] ring-1 ring-emerald-500/15 shadow-card"
                  : isCurrent
                  ? "border-gold/30 bg-gold/[0.03] ring-1 ring-gold/10"
                  : "border-border bg-surface shadow-soft hover:shadow-card-hover"
              }`}
            >
              {isRecommended && !isCurrent && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full bg-emerald-500 text-white text-[9px] font-bold uppercase tracking-wider flex items-center gap-1">
                  <Award size={9} />
                  Recommended
                </div>
              )}
              {isCurrent && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full bg-gold text-white text-[9px] font-bold uppercase tracking-wider">
                  Current plan
                </div>
              )}

              <div
                className="w-9 h-9 rounded-xl flex items-center justify-center mb-3"
                style={{ background: `${config.color}15`, color: config.color }}
              >
                {PLAN_ICONS[tier]}
              </div>

              <h3 className="text-base font-bold text-foreground">{config.badge_label}</h3>
              <p className="text-[10px] text-muted mt-0.5 leading-relaxed">{PLAN_TAGLINE[tier]}</p>

              <div className="mt-3 mb-1">
                <span className="text-2xl font-bold text-foreground">${displayPrice.toLocaleString()}</span>
                <span className="text-[10px] text-muted">/mo</span>
              </div>
              <p className="text-[10px] text-muted mb-4">
                {billingCycle === "yearly" ? (
                  <>
                    <span className="text-emerald-400">${(displayPrice * 12).toLocaleString()}/yr</span>
                    <span> · billed annually</span>
                  </>
                ) : (
                  "Billed monthly, cancel anytime"
                )}
              </p>

              <button
                onClick={() => handleUpgrade(tier)}
                disabled={isCurrent || loadingTier !== null}
                className={`w-full flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-semibold transition-all ${
                  isCurrent
                    ? "bg-gold/10 text-gold border border-gold/20 cursor-default"
                    : isRecommended
                    ? "bg-emerald-500 text-white hover:bg-emerald-600 shadow-sm"
                    : isUpgrade
                    ? "bg-gold text-white hover:bg-gold/90 shadow-sm"
                    : "bg-surface-light text-foreground border border-border hover:bg-gold/10 hover:text-gold"
                } ${loadingTier === tier ? "opacity-70 cursor-wait" : ""}`}
              >
                {loadingTier === tier ? (
                  <Loader2 size={12} className="animate-spin" />
                ) : isCurrent ? (
                  <Check size={12} />
                ) : isUpgrade ? (
                  <ArrowUpRight size={12} />
                ) : null}
                {isCurrent
                  ? "Current plan"
                  : loadingTier === tier
                  ? "Redirecting…"
                  : isDowngrade
                  ? `Downgrade to ${config.badge_label}`
                  : `Upgrade to ${config.badge_label}`}
              </button>

              {/* Limits grid */}
              <div className="mt-4 pt-4 border-t border-border space-y-1.5">
                {LIMIT_ROWS.map((row) => {
                  const val = limits[row.key];
                  return (
                    <div key={row.key} className="flex items-center justify-between text-[10px]">
                      <span className="flex items-center gap-1.5 text-muted">
                        <span className="text-muted/60">{row.icon}</span>
                        {row.label}
                      </span>
                      <span className="font-mono font-medium text-foreground">
                        {!Number.isFinite(val) ? (
                          <span className="text-gold">Unlimited</span>
                        ) : (
                          formatLimit(val, { suffix: row.suffix })
                        )}
                      </span>
                    </div>
                  );
                })}
              </div>

              {/* Feature list — derived from LIMITS_BY_TIER via getTierFeatures */}
              <div className="mt-3 pt-3 border-t border-border space-y-1.5">
                {getTierFeatures(tier).map((f) => (
                  <div key={f} className="flex items-start gap-1.5">
                    <Check size={10} className="mt-0.5 shrink-0 text-gold" />
                    <span className="text-[10px] text-foreground/80 leading-relaxed">{f}</span>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* ─── Why upgrade? ──────────────────────────────────────────── */}
      <section className="rounded-2xl border border-gold/20 bg-gradient-to-br from-gold/[0.04] to-transparent p-6">
        <div className="flex items-center gap-2 mb-3">
          <Sparkles size={16} className="text-gold" />
          <h2 className="text-sm font-bold text-foreground">Why upgrade?</h2>
        </div>
        <p className="text-xs text-muted mb-5 max-w-3xl leading-relaxed">
          The per-use math almost always makes a higher tier cheaper once you&apos;re running a real
          book of clients. Here&apos;s a rough comparison at typical agency-usage levels.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="rounded-xl bg-surface p-4 border border-border">
            <p className="text-[10px] uppercase tracking-wider text-muted font-semibold mb-1.5">
              Starter → Growth
            </p>
            <p className="text-xs text-foreground leading-relaxed mb-2">
              <span className="font-bold">4× AI tokens</span>, <span className="font-bold">10× SMS</span>, unlimited social
              platforms, AI Caller minutes.
            </p>
            <p className="text-[10px] text-emerald-400 font-medium">
              ~$500/mo saved vs pay-per-use at 3 active clients
            </p>
          </div>
          <div className="rounded-xl bg-surface p-4 border border-border">
            <p className="text-[10px] uppercase tracking-wider text-muted font-semibold mb-1.5">
              Growth → Pro
            </p>
            <p className="text-xs text-foreground leading-relaxed mb-2">
              <span className="font-bold">5× tokens</span>, 50 clients, API access, 10 team seats,
              advanced analytics.
            </p>
            <p className="text-[10px] text-emerald-400 font-medium">
              ~$1,200/mo saved at 15+ clients
            </p>
          </div>
          <div className="rounded-xl bg-surface p-4 border border-border">
            <p className="text-[10px] uppercase tracking-wider text-muted font-semibold mb-1.5">
              Pro → Business
            </p>
            <p className="text-xs text-foreground leading-relaxed mb-2">
              <span className="font-bold">White label</span>, custom AI tuning, 150 clients, 25 team
              seats, dedicated success.
            </p>
            <p className="text-[10px] text-emerald-400 font-medium">
              ~$2,500/mo saved vs competing white-label tools
            </p>
          </div>
        </div>
        <div className="mt-5 flex items-center gap-2 text-[11px] text-muted">
          <ShieldCheck size={12} className="text-emerald-400" />
          14-day free trial on every plan · Cancel anytime · No setup fees
        </div>
      </section>

      {/* ─── FAQ ───────────────────────────────────────────────────── */}
      <section>
        <h2 className="text-sm font-bold text-foreground mb-4">Frequently asked questions</h2>
        <div className="rounded-2xl border border-border bg-surface divide-y divide-border">
          {FAQS.map((faq, idx) => {
            const open = openFaq === idx;
            return (
              <div key={idx}>
                <button
                  onClick={() => setOpenFaq(open ? null : idx)}
                  className="w-full flex items-center justify-between px-5 py-3.5 text-left hover:bg-surface-light/50 transition-colors"
                >
                  <span className="text-xs font-medium text-foreground pr-4">{faq.q}</span>
                  <Minus
                    size={12}
                    className={`shrink-0 text-muted transition-transform ${
                      open ? "rotate-0" : "rotate-90"
                    }`}
                  />
                </button>
                {open && (
                  <div className="px-5 pb-4 -mt-1 text-[11px] text-muted leading-relaxed">
                    {faq.a}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* ─── CTA ───────────────────────────────────────────────────── */}
      <section className="rounded-2xl border border-border bg-surface p-6 text-center">
        <p className="text-xs text-muted mb-3">Still not sure? See your current usage and invoices.</p>
        <Link
          href="/dashboard/billing"
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-surface-light text-foreground text-xs font-medium border border-border hover:bg-gold/10 hover:text-gold transition-colors"
        >
          View billing & usage
          <ArrowUpRight size={12} />
        </Link>
      </section>
    </div>
  );
}
