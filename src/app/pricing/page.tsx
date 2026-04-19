"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Check, ArrowRight, Infinity } from "lucide-react";
import { PLAN_TIERS, formatBytes } from "@/lib/plan-config";
import { BRAND } from "@/lib/brand-config";

const PLANS = [
  {
    key: "Starter",
    name: "Starter",
    price: PLAN_TIERS.Starter.price_monthly,
    description: "For solo agencies getting started with AI",
    color: PLAN_TIERS.Starter.color,
    features: [
      `Up to ${PLAN_TIERS.Starter.max_clients} clients`,
      `${PLAN_TIERS.Starter.tokens_label} AI tokens / month`,
      "Lead Finder + CRM",
      `Social Manager (${PLAN_TIERS.Starter.social_platforms} platforms)`,
      "AI Script Lab",
      "Client Portal",
      `Upload limit: ${formatBytes(PLAN_TIERS.Starter.max_storage_upload)}`,
      "Email support",
    ],
    cta: "Get Started",
    popular: false,
  },
  {
    key: "Growth",
    name: "Growth",
    price: PLAN_TIERS.Growth.price_monthly,
    description: "For growing agencies scaling operations",
    color: PLAN_TIERS.Growth.color,
    features: [
      `Up to ${PLAN_TIERS.Growth.max_clients} clients`,
      `${PLAN_TIERS.Growth.tokens_label} AI tokens / month`,
      "Everything in Starter",
      "AI Agents + Agent HQ",
      "Workflows & Automations",
      "All social platforms",
      "Design Studio + Video Editor",
      `AI Caller (${PLAN_TIERS.Growth.caller_minutes} min/mo)`,
      "Priority support",
    ],
    cta: "Start Growing",
    popular: false,
  },
  {
    key: "Pro",
    name: "Pro",
    price: PLAN_TIERS.Pro.price_monthly,
    description: "For established agencies running at scale",
    color: PLAN_TIERS.Pro.color,
    features: [
      `Up to ${PLAN_TIERS.Pro.max_clients} clients`,
      `${PLAN_TIERS.Pro.tokens_label} AI tokens / month`,
      "Everything in Growth",
      `${PLAN_TIERS.Pro.team_members} team members`,
      `AI Caller (${PLAN_TIERS.Pro.caller_minutes} min/mo)`,
      "API access + Webhooks",
      `Upload limit: ${formatBytes(PLAN_TIERS.Pro.max_storage_upload)}`,
      "Advanced analytics",
    ],
    cta: "Go Pro",
    popular: true,
  },
  {
    key: "Business",
    name: "Business",
    price: PLAN_TIERS.Business.price_monthly,
    description: "For large agencies & multi-brand ops",
    color: PLAN_TIERS.Business.color,
    features: [
      `Up to ${PLAN_TIERS.Business.max_clients} clients`,
      `${PLAN_TIERS.Business.tokens_label} AI tokens / month`,
      "Everything in Pro",
      `${PLAN_TIERS.Business.team_members} team members`,
      "White-label branding",
      "Custom AI model tuning",
      `AI Caller (${PLAN_TIERS.Business.caller_minutes.toLocaleString()} min/mo)`,
      "Dedicated success manager",
    ],
    cta: "Go Business",
    popular: false,
  },
  {
    key: "Unlimited",
    name: "Unlimited",
    price: PLAN_TIERS.Unlimited.price_monthly,
    description: "No caps. No limits. Everything unlimited.",
    color: PLAN_TIERS.Unlimited.color,
    features: [
      "Unlimited clients",
      "Unlimited AI tokens",
      "Everything in Business",
      "Unlimited team members",
      "Unlimited AI Caller",
      "Unlimited uploads",
      "SLA guarantee",
      "Dedicated support + Slack",
      "Custom integrations",
    ],
    cta: "Go Unlimited",
    popular: false,
  },
];

export default function PricingPage() {
  const [annual, setAnnual] = useState(false);

  return (
    <div className="min-h-screen" style={{ background: "#0b0d12" }}>
      {/* Header */}
      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="flex items-center justify-between mb-16">
          <Link href="/" className="flex items-center gap-2">
            <Image src={BRAND.logo_svg} alt={BRAND.product_name} width={28} height={28} />
            <span className="text-white font-bold text-sm leading-tight flex flex-col">
              <span>{BRAND.product_name}</span>
              <span className="text-[8px] font-medium text-gray-400 tracking-wide">by {BRAND.company_name}</span>
            </span>
          </Link>
          <div className="flex items-center gap-4">
            <Link href="/book" className="text-xs text-gray-400 hover:text-white transition-colors">Book a Call</Link>
            <Link href="/login" className="text-xs px-4 py-2 rounded-lg font-medium" style={{ background: "rgba(255,255,255,0.06)", color: "#fff", border: "1px solid rgba(255,255,255,0.08)" }}>
              Login
            </Link>
          </div>
        </div>

        {/* Hero */}
        <div className="text-center mb-12">
          <h1 className="text-4xl md:text-5xl font-extrabold text-white mb-4" style={{ letterSpacing: "-0.03em" }}>
            The AI operating system<br /><span style={{ color: "#c8a855" }}>for agencies</span>
          </h1>
          <p className="text-gray-400 text-lg max-w-xl mx-auto mb-8">
            Run your entire agency with AI. Lead gen, content, social, video, design, outreach, reporting — all in one platform.
          </p>

          {/* Annual toggle */}
          <div className="flex items-center justify-center gap-3 mb-4">
            <span className={`text-sm ${!annual ? "text-white" : "text-gray-500"}`}>Monthly</span>
            <button onClick={() => setAnnual(!annual)}
              className={`w-12 h-6 rounded-full transition-colors ${annual ? "bg-green-500" : "bg-gray-700"}`}>
              <div className={`w-5 h-5 rounded-full bg-white shadow transition-transform ${annual ? "translate-x-6" : "translate-x-0.5"}`} />
            </button>
            <span className={`text-sm ${annual ? "text-white" : "text-gray-500"}`}>Annual <span className="text-green-400 text-xs">Save 20%</span></span>
          </div>
        </div>

        {/* Plans — 5 tier grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4 max-w-7xl mx-auto">
          {PLANS.map(plan => {
            const displayPrice = annual ? Math.round(plan.price * 0.8) : plan.price;
            return (
              <div key={plan.key} className="rounded-2xl p-5 relative flex flex-col"
                style={{
                  background: plan.popular ? "rgba(200,168,85,0.04)" : "rgba(255,255,255,0.02)",
                  border: `1px solid ${plan.popular ? "rgba(200,168,85,0.2)" : "rgba(255,255,255,0.05)"}`,
                  ...(plan.popular ? { boxShadow: "0 0 0 2px rgba(200,168,85,0.3)" } : {}),
                }}>
                {plan.popular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 text-[9px] font-bold px-3 py-1 rounded-full" style={{ background: "#c8a855", color: "#000" }}>
                    Most Popular
                  </div>
                )}

                {plan.key === "Unlimited" && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 text-[9px] font-bold px-3 py-1 rounded-full bg-gradient-to-r from-red-500 to-orange-500 text-white">
                    Best Value
                  </div>
                )}

                <div className="mb-4">
                  <h3 className="text-base font-bold text-white mb-0.5 flex items-center gap-1.5">
                    {plan.name}
                    {plan.key === "Unlimited" && <Infinity size={14} className="text-red-400" />}
                  </h3>
                  <p className="text-[10px] text-gray-500 leading-relaxed">{plan.description}</p>
                </div>

                <div className="mb-4">
                  <span className="text-2xl font-extrabold text-white">${displayPrice.toLocaleString()}</span>
                  <span className="text-gray-500 text-xs">/mo</span>
                </div>

                <ul className="space-y-2 mb-6 flex-1">
                  {plan.features.map((f, i) => (
                    <li key={i} className="flex items-start gap-2 text-[11px] text-gray-300 leading-relaxed">
                      <Check size={12} className="shrink-0 mt-0.5" style={{ color: plan.color }} />
                      {f}
                    </li>
                  ))}
                </ul>

                <Link href={`/login?plan=${plan.key.toLowerCase()}${annual ? "&billing=annual" : ""}`}
                  className={`w-full py-2.5 rounded-xl font-semibold text-xs flex items-center justify-center gap-1.5 transition-all hover:opacity-90 ${
                    plan.popular ? "text-black" : "text-white"
                  }`}
                  style={{
                    background: plan.popular ? "linear-gradient(135deg, #c8a855, #b89840)" : "rgba(255,255,255,0.06)",
                    border: plan.popular ? "none" : "1px solid rgba(255,255,255,0.08)",
                  }}>
                  {plan.cta} <ArrowRight size={12} />
                </Link>
              </div>
            );
          })}
        </div>

        {/* Bottom CTA */}
        <div className="text-center mt-16 mb-8">
          <p className="text-gray-500 text-sm mb-2">14-day free trial on all plans. Cancel anytime.</p>
          <p className="text-gray-600 text-xs mb-5">Not sure which plan? <Link href="/book" className="text-gray-400 hover:text-white underline underline-offset-2 transition-colors">Book a free strategy call</Link> and we&apos;ll help you decide.</p>
          <Link href="/login" className="inline-flex items-center gap-2 text-sm font-medium px-6 py-3 rounded-xl transition-all hover:opacity-90"
            style={{ background: "linear-gradient(135deg, #c8a855, #b89840)", color: "#0b0d12" }}>
            Get Started Now <ArrowRight size={14} />
          </Link>
        </div>

        <p className="text-center text-[10px] text-gray-600">Trinity · by ShortStack</p>
      </div>
    </div>
  );
}
