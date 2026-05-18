"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { useAuth } from "@/lib/auth-context";
import {
  Check, Zap, TrendingUp, Crown, Building2, Infinity,
  Plus, ArrowRight, Globe, PenTool, Film, Bot, Phone,
  Shield, Code, Users, Headphones, Lock, Sparkles,
} from "lucide-react";
import { PLAN_TIERS, formatBytes, type PlanTier } from "@/lib/plan-config";
import { LIMITS_BY_TIER } from "@/lib/plan-limits";
import { formatLimit, getTierFeatures } from "@/lib/plan-display";
import { CreditCard } from "lucide-react";
import toast from "react-hot-toast";
import { MotionPage } from "@/components/motion/motion-page";
import PageHero from "@/components/ui/page-hero";

// Description + icon + marketing badge are the only hand-curated bits.
// Price, token count, client count, feature bullets — all derived from
// LIMITS_BY_TIER / PLAN_TIERS / getTierFeatures (single source of truth).
const PLAN_META: Array<{
  key: PlanTier;
  description: string;
  icon: React.ReactNode;
  popular?: boolean;
  highlight?: string;
}> = [
  { key: "Starter", description: "For solo agencies getting started with AI", icon: <Zap size={20} /> },
  { key: "Growth", description: "For growing agencies scaling operations", icon: <TrendingUp size={20} /> },
  { key: "Pro", description: "For established agencies running at scale", icon: <Crown size={20} />, popular: true, highlight: "Most Popular" },
  { key: "Business", description: "For large agencies & multi-brand operations", icon: <Building2 size={20} /> },
  { key: "Unlimited", description: "Unlimited everything. No caps. No limits.", icon: <Infinity size={20} />, highlight: "Best Value" },
];

interface Plan {
  key: PlanTier;
  name: string;
  price: number;
  tokens: string;
  description: string;
  icon: React.ReactNode;
  features: string[];
  popular?: boolean;
  highlight?: string;
}

const PLANS: Plan[] = PLAN_META.map((m) => {
  const cfg = PLAN_TIERS[m.key];
  const limits = LIMITS_BY_TIER[m.key];
  return {
    key: m.key,
    name: cfg.badge_label,
    price: cfg.price_monthly,
    tokens: Number.isFinite(limits.tokens) ? formatLimit(limits.tokens) : "Unlimited",
    description: m.description,
    icon: m.icon,
    features: getTierFeatures(m.key),
    popular: m.popular,
    highlight: m.highlight,
  };
});

interface AddOn {
  name: string;
  price: string;
  type: "one-time" | "monthly";
  description: string;
  icon: React.ReactNode;
}

const ADD_ONS: AddOn[] = [
  { name: "Pro Website Build", price: "$2,000", type: "one-time", description: "Custom AI-built website with hosting", icon: <Globe size={16} /> },
  { name: "Landing Page", price: "$500", type: "one-time", description: "High-converting landing page", icon: <Globe size={16} /> },
  { name: "Brand Kit Design", price: "$1,500", type: "one-time", description: "Full brand identity package", icon: <PenTool size={16} /> },
  { name: "Video Production", price: "$299/mo", type: "monthly", description: "4 professional videos per month", icon: <Film size={16} /> },
  { name: "Extra AI Tokens", price: "$5/100K", type: "monthly", description: "Additional tokens beyond plan limit", icon: <Bot size={16} /> },
  { name: "AI Caller Minutes", price: "$0.12/min", type: "monthly", description: "Additional calling minutes", icon: <Phone size={16} /> },
];

export default function PricingPage() {
  const { profile } = useAuth();
  const [annual, setAnnual] = useState(false);
  const currentPlan = profile?.plan_tier || null;
  const [checkoutLoading, setCheckoutLoading] = useState<string | null>(null);

  async function handleSubscribe(planKey: string) {
    if (checkoutLoading) return;
    setCheckoutLoading(planKey);
    try {
      const res = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          plan_tier: planKey.toLowerCase(),
          billing_cycle: annual ? "yearly" : "monthly",
        }),
      });
      const data = await res.json();
      const redirectUrl = data.url || data.checkout_url;
      if (redirectUrl) {
        window.location.href = redirectUrl;
      } else {
        toast.error(data.error || "Checkout failed. Please try again.");
        setCheckoutLoading(null);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Network error. Please try again.");
      setCheckoutLoading(null);
    }
  }

  return (
    <MotionPage className="max-w-7xl mx-auto">
      <PageHero
        eyebrow="Billing"
        title="Choose Your Plan"
        subtitle="Scale your agency without limits — upgrade or downgrade anytime."
        icon={<CreditCard size={18} />}
        actions={
          <div className="flex items-center gap-3">
            <span className={`text-xs font-medium transition-colors ${!annual ? "text-text-primary" : "text-text-muted"}`}>Monthly</span>
            <button
              onClick={() => setAnnual(!annual)}
              aria-pressed={annual}
              aria-label="Toggle annual billing"
              className={`relative w-11 h-6 rounded-full border transition-all focus-visible:ring-2 focus-visible:ring-brand-accent focus-visible:outline-none ${
                annual
                  ? "bg-brand-accent border-brand-accent"
                  : "bg-[rgba(99,146,255,0.12)] border-[rgba(99,146,255,0.20)]"
              }`}
            >
              <div className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-transform ${annual ? "translate-x-5" : "translate-x-1"}`} />
            </button>
            <span className={`text-xs font-medium transition-colors ${annual ? "text-text-primary" : "text-text-muted"}`}>
              Annual
              {annual && <span className="ml-1.5 px-1.5 py-0.5 rounded-full bg-[rgba(59,130,246,0.15)] text-brand-accent text-[10px] font-bold">−20%</span>}
            </span>
          </div>
        }
      />

      <div className="space-y-6 mt-6">
        {/* Plans grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-3">
          {PLANS.map((plan, i) => {
            const monthlyPrice = annual ? Math.round(plan.price * 0.8) : plan.price;
            const isCurrentPlan = currentPlan === plan.key;
            const tierConfig = PLAN_TIERS[plan.key as keyof typeof PLAN_TIERS];

            return (
              <motion.div
                key={plan.key}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.06, duration: 0.4, ease: [0.32, 0.72, 0, 1] }}
                whileHover={{ y: -4, scale: 1.01 }}
                onMouseMove={(e) => {
                  const rect = e.currentTarget.getBoundingClientRect();
                  e.currentTarget.style.setProperty("--mouse-x", `${e.clientX - rect.left}px`);
                  e.currentTarget.style.setProperty("--mouse-y", `${e.clientY - rect.top}px`);
                }}
                className={`relative glass-panel p-5 flex flex-col transition-all duration-220 spotlight-card ${
                  plan.popular
                    ? "border-[rgba(59,130,246,0.30)] bg-[rgba(59,130,246,0.04)] shadow-[0_0_0_1px_rgba(59,130,246,0.12),inset_0_1px_0_rgba(255,255,255,0.08),0_8px_32px_rgba(0,0,0,0.40),0_0_48px_-16px_rgba(59,130,246,0.28)]"
                    : isCurrentPlan
                    ? "border-emerald-500/30 bg-emerald-500/[0.03] ring-1 ring-emerald-500/10"
                    : ""
                }`}
              >
                {/* Highlight badge */}
                {plan.highlight && (
                  <div className={`absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full text-white text-[9px] font-bold uppercase tracking-wider whitespace-nowrap ${
                    plan.popular
                      ? "bg-brand-accent shadow-[0_0_12px_rgba(59,130,246,0.40)]"
                      : "bg-[rgba(59,130,246,0.18)] border border-[rgba(59,130,246,0.35)] text-brand-accent"
                  }`}>
                    {plan.highlight}
                  </div>
                )}

                {isCurrentPlan && !plan.highlight && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full bg-emerald-500 text-white text-[9px] font-bold uppercase tracking-wider">
                    Current Plan
                  </div>
                )}

                {/* Plan icon */}
                <div
                  className="w-9 h-9 rounded-xl flex items-center justify-center mb-3 transition-all"
                  style={{
                    backgroundColor: `${tierConfig.color}18`,
                    color: tierConfig.color,
                    boxShadow: `0 0 0 1px ${tierConfig.color}20`,
                  }}
                >
                  {plan.icon}
                </div>

                <h3 className="text-base font-bold text-text-primary font-display">{plan.name}</h3>
                <p className="text-[10px] text-text-muted mt-0.5 leading-relaxed">{plan.description}</p>

                {/* Price */}
                <div className="mt-4 mb-1">
                  <span className="text-3xl font-bold text-text-primary font-display tabular-nums">${monthlyPrice.toLocaleString()}</span>
                  <span className="text-[10px] text-text-muted ml-0.5">/mo</span>
                </div>
                <p className="text-[10px] text-text-muted mb-5 min-h-[2.5rem] leading-relaxed">
                  {plan.tokens === "Unlimited" || plan.tokens === "∞"
                    ? "Unlimited AI tokens"
                    : `${plan.tokens} AI tokens included`}
                  {annual && (
                    <span className="text-brand-accent ml-1">
                      (${(monthlyPrice * 12).toLocaleString()}/yr)
                    </span>
                  )}
                </p>

                {/* CTA button */}
                <button
                  onClick={() => handleSubscribe(plan.key)}
                  disabled={isCurrentPlan || checkoutLoading !== null}
                  className={`w-full py-2.5 rounded-xl text-xs font-semibold transition-all duration-220 flex items-center justify-center gap-1.5 ${
                    isCurrentPlan
                      ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 cursor-default"
                      : plan.popular
                      ? "bg-brand-accent text-white hover:bg-[#2563EB] shadow-[0_4px_16px_rgba(59,130,246,0.30)] hover:shadow-[0_4px_24px_rgba(59,130,246,0.45)]"
                      : "bg-[rgba(99,146,255,0.08)] text-text-secondary hover:bg-[rgba(59,130,246,0.12)] hover:text-brand-accent border border-[rgba(99,146,255,0.14)] hover:border-[rgba(59,130,246,0.30)]"
                  } ${checkoutLoading === plan.key ? "opacity-60 cursor-wait" : ""} disabled:cursor-default`}
                >
                  {isCurrentPlan ? (
                    "Current Plan"
                  ) : checkoutLoading === plan.key ? (
                    "Redirecting..."
                  ) : (
                    <>
                      Get Started
                      <ArrowRight size={12} />
                    </>
                  )}
                </button>

                {/* Feature list */}
                <div className="mt-4 pt-4 border-t border-[rgba(99,146,255,0.10)] space-y-2">
                  {plan.features.map((f) => (
                    <div key={f} className="flex items-start gap-2">
                      <Check size={11} className="mt-0.5 shrink-0 text-brand-accent" />
                      <span className="text-[10px] text-text-secondary leading-relaxed">{f}</span>
                    </div>
                  ))}
                </div>
              </motion.div>
            );
          })}
        </div>

        {/* Feature comparison highlights */}
        <div className="glass-panel p-6">
          <h2 className="text-sm font-bold text-text-primary font-display mb-5">What scales with your plan</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {[
              {
                label: "Clients",
                icon: <Users size={14} className="text-brand-accent" />,
                values: PLANS.map(p => ({
                  name: p.name,
                  val: PLAN_TIERS[p.key as keyof typeof PLAN_TIERS].max_clients === -1
                    ? "Unlimited"
                    : String(PLAN_TIERS[p.key as keyof typeof PLAN_TIERS].max_clients),
                })),
              },
              {
                label: "AI Tokens",
                icon: <Bot size={14} className="text-brand-accent" />,
                values: PLANS.map(p => ({ name: p.name, val: p.tokens })),
              },
              {
                label: "Upload Limit",
                icon: <Film size={14} className="text-brand-accent" />,
                values: PLANS.map(p => ({
                  name: p.name,
                  val: formatBytes(PLAN_TIERS[p.key as keyof typeof PLAN_TIERS].max_storage_upload),
                })),
              },
              {
                label: "AI Caller",
                icon: <Phone size={14} className="text-emerald-400" />,
                values: PLANS.map(p => {
                  const mins = LIMITS_BY_TIER[p.key].call_minutes;
                  return {
                    name: p.name,
                    val: Number.isFinite(mins) ? formatLimit(mins, { suffix: "min" }) : "Unlimited",
                  };
                }),
              },
            ].map((col) => (
              <div key={col.label} className="space-y-2.5">
                <div className="flex items-center gap-2 text-xs font-semibold text-text-primary pb-1 border-b border-[rgba(99,146,255,0.10)]">
                  {col.icon}
                  {col.label}
                </div>
                <div className="space-y-1.5">
                  {col.values.map(({ name, val }) => (
                    <div key={name} className="flex justify-between items-center text-[10px]">
                      <span className="text-text-muted">{name}</span>
                      <span className="font-mono font-semibold text-text-secondary">{val}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Enterprise feature callouts */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { icon: <Shield size={16} />, label: "White-label", desc: "Your brand, your platform", plans: "Business+" },
            { icon: <Code size={16} />, label: "API Access", desc: "Full REST API + webhooks", plans: "Pro+" },
            { icon: <Lock size={16} />, label: "SLA Guarantee", desc: "99.9% uptime commitment", plans: "Unlimited" },
            { icon: <Headphones size={16} />, label: "Dedicated Support", desc: "Named success manager", plans: "Business+" },
          ].map((item, i) => (
            <motion.div
              key={item.label}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.06 + 0.3, duration: 0.35, ease: [0.32, 0.72, 0, 1] }}
              className="glass-panel p-4"
            >
              <div className="w-8 h-8 rounded-lg bg-[rgba(59,130,246,0.09)] flex items-center justify-center text-brand-accent mb-2.5 border border-[rgba(59,130,246,0.12)]">
                {item.icon}
              </div>
              <p className="text-xs font-semibold text-text-primary">{item.label}</p>
              <p className="text-[10px] text-text-muted mt-0.5 leading-relaxed">{item.desc}</p>
              <p className="text-[9px] text-brand-accent font-bold mt-2 uppercase tracking-wide">{item.plans}</p>
            </motion.div>
          ))}
        </div>

        {/* Token usage explainer */}
        <div className="glass-panel p-6">
          <div className="flex items-center gap-2 mb-1">
            <Sparkles size={14} className="text-brand-accent" />
            <h2 className="text-sm font-bold text-text-primary font-display">How AI tokens work</h2>
          </div>
          <p className="text-xs text-text-muted mb-5 leading-relaxed">
            Tokens power all AI features — content generation, lead scoring, ad copy, scripts, social posts, and more.
            Each action uses a different amount based on complexity.
          </p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label: "Social post", tokens: "~500", uses: "1,000 posts" },
              { label: "Blog article", tokens: "~3,000", uses: "166 articles" },
              { label: "Ad campaign", tokens: "~2,000", uses: "250 campaigns" },
              { label: "Lead scoring", tokens: "~100", uses: "5,000 leads" },
            ].map((item) => (
              <div key={item.label} className="rounded-xl bg-[rgba(99,146,255,0.05)] border border-[rgba(99,146,255,0.10)] p-3.5">
                <p className="text-xs font-semibold text-text-primary">{item.label}</p>
                <p className="text-[11px] text-text-muted mt-0.5">{item.tokens} tokens</p>
                <p className="text-[10px] text-brand-accent font-medium mt-1.5">~{item.uses}/500K</p>
              </div>
            ))}
          </div>
        </div>

        {/* Add-ons */}
        <div>
          <div className="flex items-center gap-2 mb-4">
            <div className="w-6 h-6 rounded-lg bg-[rgba(59,130,246,0.09)] flex items-center justify-center border border-[rgba(59,130,246,0.12)]">
              <Plus size={13} className="text-brand-accent" />
            </div>
            <h2 className="text-sm font-bold text-text-primary font-display">Add-ons</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {ADD_ONS.map((addon, idx) => (
              <motion.div
                key={addon.name}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: idx * 0.04, ease: [0.32, 0.72, 0, 1] }}
                whileHover={{ y: -2 }}
                className="glass-panel p-4 flex items-start gap-3 spotlight-card cursor-default"
                onMouseMove={(e) => {
                  const rect = e.currentTarget.getBoundingClientRect();
                  e.currentTarget.style.setProperty("--mouse-x", `${e.clientX - rect.left}px`);
                  e.currentTarget.style.setProperty("--mouse-y", `${e.clientY - rect.top}px`);
                }}
              >
                <div className="w-8 h-8 rounded-lg bg-[rgba(99,146,255,0.08)] border border-[rgba(99,146,255,0.12)] flex items-center justify-center text-text-muted shrink-0">
                  {addon.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs font-semibold text-text-primary truncate">{addon.name}</p>
                    <span className={`shrink-0 text-[9px] px-1.5 py-0.5 rounded-full font-bold uppercase tracking-wide ${
                      addon.type === "one-time"
                        ? "bg-[rgba(52,211,153,0.12)] text-emerald-400 border border-emerald-400/20"
                        : "bg-[rgba(59,130,246,0.10)] text-brand-accent border border-[rgba(59,130,246,0.18)]"
                    }`}>
                      {addon.type === "one-time" ? "One-time" : "Monthly"}
                    </span>
                  </div>
                  <p className="text-[10px] text-text-muted mt-0.5 leading-relaxed">{addon.description}</p>
                  <p className="text-sm font-bold text-text-primary mt-1.5 font-display">{addon.price}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>

        {/* CTA */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5, duration: 0.4 }}
          className="glass-panel glass-border-gradient border-[rgba(59,130,246,0.22)] bg-[rgba(59,130,246,0.03)] p-8 text-center"
        >
          <h2 className="text-base font-bold text-text-primary font-display mb-1.5">Not sure which plan is right?</h2>
          <p className="text-xs text-text-muted mb-5 leading-relaxed max-w-md mx-auto">
            Start with Starter and upgrade anytime. All plans include a 14-day free trial with no credit card required.
          </p>
          <button
            onClick={() => handleSubscribe("Starter")}
            className="px-6 py-2.5 rounded-xl bg-brand-accent text-white text-xs font-semibold hover:bg-[#2563EB] transition-all duration-220 shadow-[0_4px_16px_rgba(59,130,246,0.30)] hover:shadow-[0_4px_24px_rgba(59,130,246,0.45)] inline-flex items-center gap-2"
          >
            Start Free Trial
            <ArrowRight size={13} />
          </button>
        </motion.div>
      </div>
    </MotionPage>
  );
}
