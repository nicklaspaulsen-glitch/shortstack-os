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
                className="rounded-2xl p-7 h-full flex flex-col transition-all duration-300 hover:-translate-y-1"
                style={{
                  background: plan.featured
                    ? "rgba(200,168,85,0.05)"
                    : "rgba(255,255,255,0.02)",
                  border: plan.featured
                    ? "1px solid rgba(200,168,85,0.3)"
                    : "1px solid rgba(255,255,255,0.05)",
                  boxShadow: plan.featured
                    ? "0 0 30px rgba(200,168,85,0.08)"
                    : "none",
                }}
              >
                {plan.featured && (
                  <div
                    className="self-start text-[9px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-full mb-4"
                    style={{
                      background: "#c8a855",
                      color: "#0b0d12",
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
                        style={{ color: "#c8a855" }}
                      />
                      <span>{b}</span>
                    </li>
                  ))}
                </ul>

                <Link
                  href="/pricing"
                  className="group flex items-center justify-center gap-2 px-5 py-3 rounded-xl font-semibold text-sm transition-all"
                  style={
                    plan.featured
                      ? {
                          background:
                            "linear-gradient(135deg, #c8a855, #b89840)",
                          color: "#0b0d12",
                        }
                      : {
                          background: "rgba(255,255,255,0.04)",
                          border: "1px solid rgba(255,255,255,0.08)",
                          color: "#fff",
                        }
                  }
                >
                  {plan.cta}
                  <ArrowRight
                    size={14}
                    className="group-hover:translate-x-0.5 transition-transform"
                  />
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
