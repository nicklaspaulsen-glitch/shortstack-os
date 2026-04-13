"use client";

import { useState } from "react";
import { Check, Zap, Crown, Building2, Plus, ArrowRight, Sparkles, Globe, PenTool, Film, Bot, Phone } from "lucide-react";

interface Plan {
  name: string;
  price: number;
  tokens: string;
  tokensNum: number;
  description: string;
  icon: React.ReactNode;
  features: string[];
  popular?: boolean;
}

const PLANS: Plan[] = [
  {
    name: "Starter",
    price: 997,
    tokens: "500K",
    tokensNum: 500000,
    description: "For solo agencies getting started with AI automation",
    icon: <Zap size={20} />,
    features: [
      "Up to 5 clients",
      "500K AI tokens / month",
      "Lead Finder + CRM",
      "Social Manager (3 platforms)",
      "AI Script Lab",
      "Client Portal",
      "Email support",
    ],
  },
  {
    name: "Growth",
    price: 2497,
    tokens: "2M",
    tokensNum: 2000000,
    description: "For growing agencies scaling operations",
    icon: <Crown size={20} />,
    popular: true,
    features: [
      "Up to 25 clients",
      "2M AI tokens / month",
      "Everything in Starter",
      "AI Agents + Agent HQ",
      "Workflows & Automations",
      "Social Manager (all platforms)",
      "Design Studio + Video Editor",
      "AI Caller (500 min/mo)",
      "Priority support",
    ],
  },
  {
    name: "Enterprise",
    price: 4997,
    tokens: "Unlimited",
    tokensNum: -1,
    description: "For established agencies running at scale",
    icon: <Building2 size={20} />,
    features: [
      "Unlimited clients",
      "Unlimited AI tokens",
      "Everything in Growth",
      "White-label branding",
      "Custom AI model tuning",
      "AI Caller (unlimited)",
      "Dedicated success manager",
      "API access + Webhooks",
      "SLA guarantee",
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
  const [annual, setAnnual] = useState(false);

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      {/* Header */}
      <div className="text-center space-y-3">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-gold/10 text-gold text-xs font-medium">
          <Sparkles size={12} />
          Simple, transparent pricing
        </div>
        <h1 className="text-2xl font-bold text-foreground">Choose your plan</h1>
        <p className="text-sm text-muted max-w-md mx-auto">
          Everything you need to run your agency with AI. Scale up or down anytime.
        </p>

        {/* Billing toggle */}
        <div className="flex items-center justify-center gap-3 pt-2">
          <span className={`text-xs font-medium ${!annual ? "text-foreground" : "text-muted"}`}>Monthly</span>
          <button
            onClick={() => setAnnual(!annual)}
            className={`relative w-11 h-6 rounded-full transition-colors ${annual ? "bg-gold" : "bg-border"}`}
          >
            <div className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-transform ${annual ? "left-6" : "left-1"}`} />
          </button>
          <span className={`text-xs font-medium ${annual ? "text-foreground" : "text-muted"}`}>
            Annual <span className="text-gold text-[10px]">Save 20%</span>
          </span>
        </div>
      </div>

      {/* Plans */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {PLANS.map((plan) => {
          const monthlyPrice = annual ? Math.round(plan.price * 0.8) : plan.price;
          return (
            <div
              key={plan.name}
              className={`relative rounded-2xl border p-6 flex flex-col transition-all hover:shadow-card-hover ${
                plan.popular
                  ? "border-gold/30 bg-gold/[0.03] shadow-card ring-1 ring-gold/10"
                  : "border-border bg-surface shadow-soft"
              }`}
            >
              {plan.popular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full bg-gold text-white text-[10px] font-bold uppercase tracking-wider">
                  Most Popular
                </div>
              )}

              <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-4 ${plan.popular ? "bg-gold/10 text-gold" : "bg-surface-light text-muted"}`}>
                {plan.icon}
              </div>

              <h3 className="text-lg font-bold text-foreground">{plan.name}</h3>
              <p className="text-xs text-muted mt-1">{plan.description}</p>

              <div className="mt-4 mb-1">
                <span className="text-3xl font-bold text-foreground">${monthlyPrice.toLocaleString()}</span>
                <span className="text-xs text-muted">/month</span>
              </div>
              <p className="text-[11px] text-muted mb-5">
                {plan.tokensNum > 0 ? `${plan.tokens} AI tokens included` : "Unlimited AI tokens"}
                {annual && <span className="text-gold ml-1">({`$${(monthlyPrice * 12).toLocaleString()}/yr`})</span>}
              </p>

              <button
                className={`w-full py-2.5 rounded-xl text-sm font-medium transition-all ${
                  plan.popular
                    ? "bg-gold text-white hover:bg-gold/90 shadow-sm"
                    : "bg-surface-light text-foreground hover:bg-gold/10 hover:text-gold border border-border"
                }`}
              >
                Get Started
                <ArrowRight size={14} className="inline ml-1.5" />
              </button>

              <div className="mt-6 pt-5 border-t border-border space-y-2.5">
                {plan.features.map((f) => (
                  <div key={f} className="flex items-start gap-2.5">
                    <Check size={14} className={`mt-0.5 shrink-0 ${plan.popular ? "text-gold" : "text-accent"}`} />
                    <span className="text-xs text-foreground/80">{f}</span>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
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
                    addon.type === "one-time" ? "bg-accent/10 text-accent" : "bg-gold/10 text-gold"
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
        <button className="px-5 py-2 rounded-xl bg-gold text-white text-xs font-medium hover:bg-gold/90 transition-colors">
          Start Free Trial
        </button>
      </div>
    </div>
  );
}
