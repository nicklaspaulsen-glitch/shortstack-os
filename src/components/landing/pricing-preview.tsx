"use client";

import Link from "next/link";
import { ArrowRight, Check } from "lucide-react";
import { BRAND } from "@/lib/brand-config";
import Reveal from "./reveal";
import SectionHeading from "./section-heading";

/**
 * Condensed 3-tier preview on the landing page. The full 5-tier grid
 * (Starter / Growth / Pro / Business / Unlimited) lives at /pricing.
 * Prices here MUST match PLAN_TIERS in src/lib/plan-config.ts.
 */
const PLANS = [
  {
    name: "Starter",
    price: "$497",
    cadence: "/mo",
    blurb: "Solo agencies getting started with AI.",
    bullets: [
      "Up to 5 clients",
      "250K AI tokens / month",
      "Lead Finder + CRM + Social Manager",
      "AI Script Lab + Client Portal",
      "Email support",
    ],
    cta: "Start free trial",
    featured: false,
  },
  {
    name: "Pro",
    price: "$2,497",
    cadence: "/mo",
    blurb: "For established agencies running at scale — most teams land here.",
    bullets: [
      "Up to 50 clients, 10 team members",
      "5M AI tokens / month",
      "Workflows, Agent HQ, Design Studio",
      "AI Caller 500 min, API + Webhooks",
      "Advanced analytics",
      "Priority support",
    ],
    cta: "Start free trial",
    featured: true,
  },
  {
    name: "Unlimited",
    price: "$9,997",
    cadence: "/mo",
    blurb: "No caps, no limits, everything unlimited. For multi-brand ops.",
    bullets: [
      "Unlimited clients + team members",
      "Unlimited AI tokens + outreach",
      "White-label + custom AI model tuning",
      "Unlimited AI Caller minutes",
      "SLA + dedicated support in Slack",
      "Custom integrations",
    ],
    cta: "Go Unlimited",
    featured: false,
  },
];

export default function PricingPreview() {
  return (
    <section
      id="pricing-preview"
      className="py-20 md:py-28 px-6"
      style={{ borderTop: "1px solid rgba(255,255,255,0.03)" }}
    >
      <div className="max-w-6xl mx-auto">
        <Reveal>
          <SectionHeading
            eyebrow="Pricing"
            title="Honest pricing. No feature gates."
            subtitle={`Every ${BRAND.product_name} plan includes the full platform — what you pay for is volume and team size, not the ability to use the product. 14-day free trial on all plans. Cancel anytime.`}
            className="mb-14"
          />
        </Reveal>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {PLANS.map((plan, i) => (
            <Reveal key={plan.name} delay={0.1 * i}>
              <div
                className="p-7 h-full flex flex-col transition-all duration-300 hover:-translate-y-1"
                style={{
                  background: plan.featured
                    ? "rgba(255,255,255,0.05)"
                    : "rgba(255,255,255,0.02)",
                  border: plan.featured
                    ? "1px solid rgba(255,255,255,0.25)"
                    : "1px solid rgba(255,255,255,0.05)",
                  boxShadow: plan.featured
                    ? "0 0 30px rgba(255,255,255,0.07)"
                    : "none",
                }}
              >
                {plan.featured && (
                  <div
                    className="self-start text-[9px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-full mb-4"
                    style={{
                      background: "#D4FF00",
                      color: "#fff",
                    }}
                  >
                    Most popular
                  </div>
                )}
                <h3 className="text-lg font-bold text-white mb-1">
                  {plan.name}
                </h3>
                <p className="text-xs text-gray-500 mb-5 min-h-[32px]">
                  {plan.blurb}
                </p>

                <div className="flex items-baseline gap-1 mb-6">
                  <span className="text-4xl font-extrabold text-white">
                    {plan.price}
                  </span>
                  <span className="text-sm text-gray-500">
                    {plan.cadence}
                  </span>
                </div>

                <ul className="space-y-2.5 mb-8 flex-1">
                  {plan.bullets.map((b) => (
                    <li
                      key={b}
                      className="flex items-start gap-2 text-sm text-gray-300"
                    >
                      <Check
                        size={14}
                        className="shrink-0 mt-0.5"
                        style={{ color: "#D4FF00" }}
                      />
                      <span>{b}</span>
                    </li>
                  ))}
                </ul>

                {/* GlassButton-style CTA: glow for featured, glass for standard */}
                <Link
                  href="/pricing"
                  className={
                    plan.featured
                      ? "relative inline-flex items-center justify-center select-none font-semibold leading-none cursor-pointer shrink-0 outline-none focus-visible:ring-2 focus-visible:ring-[#D4FF00]/50 transition-all duration-200 ease-[cubic-bezier(0.32,0.72,0,1)] h-10 px-5 text-[12px] gap-2 rounded-[12px] w-full bg-[#D4FF00] text-[#020711] border border-[rgba(212, 255, 0,0.40)] shadow-[0_0_0_1px_rgba(212,255,0,0.30),0_4px_20px_rgba(212,255,0,0.55),0_0_60px_rgba(212,255,0,0.20)] hover:shadow-[0_0_0_1px_rgba(212,255,0,0.50),0_6px_28px_rgba(212,255,0,0.70),0_0_80px_rgba(212,255,0,0.30)] hover:bg-[#D4FF00] hover:-translate-y-0.5 active:translate-y-0"
                      : "relative inline-flex items-center justify-center select-none font-medium leading-none cursor-pointer shrink-0 outline-none focus-visible:ring-2 focus-visible:ring-[#D4FF00]/50 transition-all duration-200 ease-[cubic-bezier(0.32,0.72,0,1)] h-10 px-5 text-[12px] gap-2 rounded-[12px] w-full bg-[rgba(19,24,39,0.72)] text-[#A8A8B2] border border-[rgba(255,255,255,0.08)] backdrop-blur-[14px] hover:bg-[rgba(28,35,56,0.80)] hover:text-[#F0F0F4] hover:border-[rgba(255,255,255,0.13)] hover:-translate-y-px active:translate-y-0"
                  }
                >
                  {plan.cta}
                  <ArrowRight size={14} />
                </Link>
              </div>
            </Reveal>
          ))}
        </div>

        <Reveal delay={0.3}>
          <div className="text-center mt-10 space-y-2">
            <Link
              href="/pricing"
              className="inline-flex items-center gap-1.5 text-sm text-gray-300 hover:text-white transition-colors"
            >
              See all 5 plans (Growth $997 + Business $4,997 too)
              <ArrowRight size={14} />
            </Link>
            <p className="text-[11px] text-gray-500">
              14-day free trial · No credit card required to start · You own your data
            </p>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
