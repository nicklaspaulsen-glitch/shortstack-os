"use client";

import Link from "next/link";
import { ArrowRight, Check } from "lucide-react";
import { BRAND } from "@/lib/brand-config";
import Reveal from "./reveal";
import SectionHeading from "./section-heading";

const PLANS = [
  {
    name: "Starter",
    price: "$49",
    cadence: "/mo",
    blurb: "Solo operators and consultants dipping a toe in automation.",
    bullets: [
      "Up to 3 client workspaces",
      "CRM, proposals, billing",
      "1,000 lead enrichments/mo",
      "500 AI outreach sends/mo",
      "Standard email support",
    ],
    cta: "Start free trial",
    featured: false,
  },
  {
    name: "Growth",
    price: "$199",
    cadence: "/mo",
    blurb: "The plan most agencies run on. Full stack, no gates.",
    bullets: [
      "Up to 20 client workspaces",
      "White-label client portals",
      "10,000 lead enrichments/mo",
      "10,000 AI outreach sends/mo",
      "AI voice caller included",
      "Priority support",
    ],
    cta: "Start free trial",
    featured: true,
  },
  {
    name: "Agency",
    price: "$499",
    cadence: "/mo",
    blurb: "Multi-team agencies and franchises. Scale pricing, no surprise bills.",
    bullets: [
      "Unlimited client workspaces",
      "Custom domains & SSO",
      "Unlimited lead enrichments",
      "Unlimited AI outreach",
      "Dedicated CSM",
      "SLA & data residency options",
    ],
    cta: "Talk to sales",
    featured: false,
  },
];

export default function PricingPreview() {
  return (
    <section
      className="py-20 md:py-28 px-6"
      style={{ borderTop: "1px solid rgba(255,255,255,0.03)" }}
    >
      <div className="max-w-6xl mx-auto">
        <Reveal>
          <SectionHeading
            eyebrow="Pricing"
            title="Simple plans. Honest caps."
            subtitle={`Every plan includes the full ${BRAND.product_name} platform — no feature gates on core workflows. You pay for volume and workspaces, not for the ability to use the product.`}
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
          <div className="text-center mt-10">
            <Link
              href="/pricing"
              className="inline-flex items-center gap-1.5 text-sm text-gray-400 hover:text-white transition-colors"
            >
              See all plans and volume pricing
              <ArrowRight size={14} />
            </Link>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
