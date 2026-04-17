"use client";

import { useState } from "react";
import { useAuth } from "@/lib/auth-context";
import {
  Check, Zap, TrendingUp, Crown, Building2, Infinity,
  Plus, ArrowRight, Globe, PenTool, Film, Bot, Phone,
  Shield, Code, Users, Headphones, Lock,
} from "lucide-react";
import { PLAN_TIERS, formatBytes } from "@/lib/plan-config";
import PageHero from "@/components/ui/page-hero";
import { CreditCard } from "lucide-react";

interface Plan {
  key: string;
  name: string;
  price: number;
  tokens: string;
  description: string;
  icon: React.ReactNode;
  features: string[];
  popular?: boolean;
  highlight?: string;
}

const PLANS: Plan[] = [
  {
    key: "Starter",
    name: "Starter",
    price: PLAN_TIERS.Starter.price_monthly,
    tokens: PLAN_TIERS.Starter.tokens_label,
    description: "For solo agencies getting started with AI",
    icon: <Zap size={20} />,
    features: [
      `Up to ${PLAN_TIERS.Starter.max_clients} clients`,
      `${PLAN_TIERS.Starter.tokens_label} AI tokens / month`,
      "Lead Finder + CRM",
      `Social Manager (${PLAN_TIERS.Starter.social_platforms} platforms)`,
      "AI Script Lab",
      "Client Portal",
      `Upload limit: ${formatBytes(PLAN_TIERS.Starter.max_storage_upload)} / file`,
      "Email support",
    ],
  },
  {
    key: "Growth",
    name: "Growth",
    price: PLAN_TIERS.Growth.price_monthly,
    tokens: PLAN_TIERS.Growth.tokens_label,
    description: "For growing agencies scaling operations",
    icon: <TrendingUp size={20} />,
    features: [
      `Up to ${PLAN_TIERS.Growth.max_clients} clients`,
      `${PLAN_TIERS.Growth.tokens_label} AI tokens / month`,
      "Everything in Starter",
      "AI Agents + Agent HQ",
      "Workflows & Automations",
      "Social Manager (all platforms)",
      "Design Studio + Video Editor",
      `AI Caller (${PLAN_TIERS.Growth.caller_minutes} min/mo)`,
      `Upload limit: ${formatBytes(PLAN_TIERS.Growth.max_storage_upload)} / file`,
      "Priority support",
    ],
  },
  {
    key: "Pro",
    name: "Pro",
    price: PLAN_TIERS.Pro.price_monthly,
    tokens: PLAN_TIERS.Pro.tokens_label,
    description: "For established agencies running at scale",
    icon: <Crown size={20} />,
    popular: true,
    highlight: "Most Popular",
    features: [
      `Up to ${PLAN_TIERS.Pro.max_clients} clients`,
      `${PLAN_TIERS.Pro.tokens_label} AI tokens / month`,
      "Everything in Growth",
      `${PLAN_TIERS.Pro.team_members} team members`,
      `AI Caller (${PLAN_TIERS.Pro.caller_minutes} min/mo)`,
      "API access + Webhooks",
      `Upload limit: ${formatBytes(PLAN_TIERS.Pro.max_storage_upload)} / file`,
      "Advanced analytics",
      "Priority support",
    ],
  },
  {
    key: "Business",
    name: "Business",
    price: PLAN_TIERS.Business.price_monthly,
    tokens: PLAN_TIERS.Business.tokens_label,
    description: "For large agencies & multi-brand operations",
    icon: <Building2 size={20} />,
    features: [
      `Up to ${PLAN_TIERS.Business.max_clients} clients`,
      `${PLAN_TIERS.Business.tokens_label} AI tokens / month`,
      "Everything in Pro",
      `${PLAN_TIERS.Business.team_members} team members`,
      "White-label branding",
      "Custom AI model tuning",
      `AI Caller (${PLAN_TIERS.Business.caller_minutes.toLocaleString()} min/mo)`,
      `Upload limit: ${formatBytes(PLAN_TIERS.Business.max_storage_upload)} / file`,
      "Dedicated success manager",
    ],
  },
  {
    key: "Unlimited",
    name: "Unlimited",
    price: PLAN_TIERS.Unlimited.price_monthly,
    tokens: PLAN_TIERS.Unlimited.tokens_label,
    description: "Unlimited everything. No caps. No limits.",
    icon: <Infinity size={20} />,
    highlight: "Best Value",
    features: [
      "Unlimited clients",
      "Unlimited AI tokens",
      "Everything in Business",
      "Unlimited team members",
      "Unlimited AI Caller",
      "Unlimited uploads",
      "SLA guarantee",
      "Dedicated support + Slack channel",
      "Custom integrations",
    ],
  },
];

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

  async function handleSubscribe(planKey: string) {
    try {
      const res = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan: planKey.toLowerCase(), billing: annual ? "annual" : "monthly" }),
      });
      const data = await res.json();
      if (data.checkout_url) {
        window.location.href = data.checkout_url;
      }
    } catch {
      // Toast will be shown by the API error handler
    }
  }

  return (
    <div className="max-w-7xl mx-auto space-y-8">
      <PageHero
        icon={<CreditCard size={28} />}
        title="Choose Your Plan"
        subtitle="Simple, transparent pricing — scale anytime."
        gradient="sunset"
        eyebrow="Plans"
        actions={
          <div className="flex items-center justify-center gap-3">
            <span className={`text-xs font-medium ${!annual ? "text-white" : "text-white/60"}`}>Monthly</span>
            <button
              onClick={() => setAnnual(!annual)}
              className={`relative w-11 h-6 rounded-full transition-colors ${annual ? "bg-white/40" : "bg-white/15"}`}
            >
              <div className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-transform ${annual ? "left-6" : "left-1"}`} />
            </button>
            <span className={`text-xs font-medium ${annual ? "text-white" : "text-white/60"}`}>
              Annual <span className="text-white/90 text-[10px]">Save 20%</span>
            </span>
          </div>
        }
      />

      {/* Plans grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-3">
        {PLANS.map((plan) => {
          const monthlyPrice = annual ? Math.round(plan.price * 0.8) : plan.price;
          const isCurrentPlan = currentPlan === plan.key;
          const tierConfig = PLAN_TIERS[plan.key as keyof typeof PLAN_TIERS];

          return (
            <div
              key={plan.key}
              className={`relative rounded-2xl border p-5 flex flex-col transition-all hover:shadow-card-hover ${
                plan.popular
                  ? "border-gold/30 bg-gold/[0.03] shadow-card ring-1 ring-gold/10"
                  : isCurrentPlan
                  ? "border-success/30 bg-success/[0.03] ring-1 ring-success/10"
                  : "border-border bg-surface shadow-soft"
              }`}
            >
              {plan.highlight && (
                <div className={`absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full text-white text-[9px] font-bold uppercase tracking-wider ${
                  plan.popular ? "bg-gold" : "bg-gradient-to-r from-red-500 to-orange-500"
                }`}>
                  {plan.highlight}
                </div>
              )}

              {isCurrentPlan && !plan.highlight && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full bg-success text-white text-[9px] font-bold uppercase tracking-wider">
                  Current Plan
                </div>
              )}

              <div
                className="w-9 h-9 rounded-xl flex items-center justify-center mb-3"
                style={{ backgroundColor: `${tierConfig.color}15`, color: tierConfig.color }}
              >
                {plan.icon}
              </div>

              <h3 className="text-base font-bold text-foreground">{plan.name}</h3>
              <p className="text-[10px] text-muted mt-0.5 leading-relaxed">{plan.description}</p>

              <div className="mt-3 mb-1">
                <span className="text-2xl font-bold text-foreground">${monthlyPrice.toLocaleString()}</span>
                <span className="text-[10px] text-muted">/mo</span>
              </div>
              <p className="text-[10px] text-muted mb-4">
                {plan.tokens === "Unlimited" ? "Unlimited AI tokens" : `${plan.tokens} AI tokens included`}
                {annual && <span className="text-gold ml-1">(${(monthlyPrice * 12).toLocaleString()}/yr)</span>}
              </p>

              <button
                onClick={() => handleSubscribe(plan.key)}
                disabled={isCurrentPlan}
                className={`w-full py-2 rounded-xl text-xs font-medium transition-all ${
                  isCurrentPlan
                    ? "bg-success/10 text-success border border-success/20 cursor-default"
                    : plan.popular
                    ? "bg-gold text-white hover:bg-gold/90 shadow-sm"
                    : "bg-surface-light text-foreground hover:bg-gold/10 hover:text-gold border border-border"
                }`}
              >
                {isCurrentPlan ? "Current Plan" : "Get Started"}
                {!isCurrentPlan && <ArrowRight size={12} className="inline ml-1" />}
              </button>

              <div className="mt-4 pt-4 border-t border-border space-y-2">
                {plan.features.map((f) => (
                  <div key={f} className="flex items-start gap-2">
                    <Check size={12} className="mt-0.5 shrink-0 text-gold" />
                    <span className="text-[10px] text-foreground/80 leading-relaxed">{f}</span>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* Feature comparison highlights */}
      <div className="rounded-2xl border border-border bg-surface p-6">
        <h2 className="text-sm font-bold text-foreground mb-4">What scales with your plan</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-xs font-medium text-foreground">
              <Users size={14} className="text-blue-400" />
              Clients
            </div>
            <div className="space-y-1">
              {PLANS.map(p => (
                <div key={p.key} className="flex justify-between text-[10px]">
                  <span className="text-muted">{p.name}</span>
                  <span className="font-mono font-medium text-foreground">
                    {PLAN_TIERS[p.key as keyof typeof PLAN_TIERS].max_clients === -1
                      ? "Unlimited"
                      : PLAN_TIERS[p.key as keyof typeof PLAN_TIERS].max_clients}
                  </span>
                </div>
              ))}
            </div>
          </div>
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-xs font-medium text-foreground">
              <Bot size={14} className="text-purple-400" />
              AI Tokens
            </div>
            <div className="space-y-1">
              {PLANS.map(p => (
                <div key={p.key} className="flex justify-between text-[10px]">
                  <span className="text-muted">{p.name}</span>
                  <span className="font-mono font-medium text-foreground">{p.tokens}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-xs font-medium text-foreground">
              <Film size={14} className="text-gold" />
              Upload Limit
            </div>
            <div className="space-y-1">
              {PLANS.map(p => {
                const t = PLAN_TIERS[p.key as keyof typeof PLAN_TIERS];
                return (
                  <div key={p.key} className="flex justify-between text-[10px]">
                    <span className="text-muted">{p.name}</span>
                    <span className="font-mono font-medium text-foreground">
                      {formatBytes(t.max_storage_upload)}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-xs font-medium text-foreground">
              <Phone size={14} className="text-emerald-400" />
              AI Caller
            </div>
            <div className="space-y-1">
              {PLANS.map(p => {
                const t = PLAN_TIERS[p.key as keyof typeof PLAN_TIERS];
                return (
                  <div key={p.key} className="flex justify-between text-[10px]">
                    <span className="text-muted">{p.name}</span>
                    <span className="font-mono font-medium text-foreground">
                      {t.caller_minutes === -1 ? "Unlimited" : t.caller_minutes === 0 ? "---" : `${t.caller_minutes} min`}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Enterprise features callout */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { icon: <Shield size={16} />, label: "White-label", desc: "Your brand, your platform", plans: "Business+" },
          { icon: <Code size={16} />, label: "API Access", desc: "Full REST API + webhooks", plans: "Pro+" },
          { icon: <Lock size={16} />, label: "SLA Guarantee", desc: "99.9% uptime commitment", plans: "Unlimited" },
          { icon: <Headphones size={16} />, label: "Dedicated Support", desc: "Named success manager", plans: "Business+" },
        ].map((item) => (
          <div key={item.label} className="rounded-xl border border-border bg-surface p-4">
            <div className="w-8 h-8 rounded-lg bg-gold/10 flex items-center justify-center text-gold mb-2">{item.icon}</div>
            <p className="text-xs font-medium text-foreground">{item.label}</p>
            <p className="text-[10px] text-muted mt-0.5">{item.desc}</p>
            <p className="text-[9px] text-gold font-medium mt-1.5">{item.plans}</p>
          </div>
        ))}
      </div>

      {/* Token Usage Explainer */}
      <div className="rounded-2xl border border-border bg-surface p-6">
        <h2 className="text-sm font-bold text-foreground mb-1">How AI tokens work</h2>
        <p className="text-xs text-muted mb-4">
          Tokens power all AI features — content generation, lead scoring, ad copy, scripts, social posts, and more.
          Each action uses a different amount of tokens based on complexity.
        </p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: "Social post", tokens: "~500", uses: "1,000 posts" },
            { label: "Blog article", tokens: "~3,000", uses: "166 articles" },
            { label: "Ad campaign", tokens: "~2,000", uses: "250 campaigns" },
            { label: "Lead scoring", tokens: "~100", uses: "5,000 leads" },
          ].map((item) => (
            <div key={item.label} className="rounded-xl bg-surface-light p-3 border border-border/50">
              <p className="text-xs font-medium text-foreground">{item.label}</p>
              <p className="text-[11px] text-muted mt-0.5">{item.tokens} tokens</p>
              <p className="text-[10px] text-gold mt-1">~{item.uses}/500K</p>
            </div>
          ))}
        </div>
      </div>

      {/* Add-ons */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <Plus size={16} className="text-gold" />
          <h2 className="text-sm font-bold text-foreground">Add-ons</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {ADD_ONS.map((addon) => (
            <div
              key={addon.name}
              className="rounded-xl border border-border bg-surface p-4 hover:shadow-card transition-shadow flex items-start gap-3"
            >
              <div className="w-8 h-8 rounded-lg bg-surface-light flex items-center justify-center text-muted shrink-0">
                {addon.icon}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-medium text-foreground">{addon.name}</p>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
                    addon.type === "one-time" ? "bg-info/10 text-info" : "bg-gold/10 text-gold"
                  }`}>
                    {addon.type === "one-time" ? "One-time" : "Monthly"}
                  </span>
                </div>
                <p className="text-[11px] text-muted mt-0.5">{addon.description}</p>
                <p className="text-sm font-bold text-foreground mt-1.5">{addon.price}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* FAQ / CTA */}
      <div className="rounded-2xl border border-gold/20 bg-gold/[0.03] p-6 text-center">
        <h2 className="text-sm font-bold text-foreground mb-1">Not sure which plan is right?</h2>
        <p className="text-xs text-muted mb-4">
          Start with Starter and upgrade anytime. All plans include a 14-day free trial.
        </p>
        <button
          onClick={() => handleSubscribe("Starter")}
          className="px-5 py-2 rounded-xl bg-gold text-white text-xs font-medium hover:bg-gold/90 transition-colors"
        >
          Start Free Trial
        </button>
      </div>
    </div>
  );
}
