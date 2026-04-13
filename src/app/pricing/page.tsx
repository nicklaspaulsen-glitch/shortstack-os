"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Check, ArrowRight, Phone } from "lucide-react";

const PLANS = [
  {
    name: "Starter",
    price: 997,
    period: "mo",
    description: "Perfect for small businesses getting started",
    color: "#3b82f6",
    features: [
      "Up to 5 clients",
      "1 team member",
      "1 social media platform",
      "10 posts per month",
      "Basic ad management",
      "Monthly performance report",
      "Email support",
      "Client portal access",
      "AI Lead Engine",
    ],
    cta: "Get Started",
    popular: false,
  },
  {
    name: "Growth",
    price: 2497,
    period: "mo",
    description: "For businesses ready to scale aggressively",
    color: "#c8a855",
    features: [
      "Up to 25 clients",
      "5 team members",
      "3 social media platforms",
      "30 posts per month",
      "Advanced ad management",
      "Weekly performance reports",
      "SEO & content marketing",
      "Email & SMS campaigns",
      "AI-powered content creation",
      "Multi-channel outreach",
      "Priority support",
    ],
    cta: "Start Growing",
    popular: true,
  },
  {
    name: "Enterprise",
    price: 4997,
    period: "mo",
    description: "Full-service agency partnership",
    color: "#a855f7",
    features: [
      "Unlimited clients",
      "Unlimited team members",
      "All social media platforms",
      "Unlimited content creation",
      "Full ad management (Meta + Google + TikTok)",
      "Daily performance reports",
      "AI receptionist & chatbot",
      "Automation workflows",
      "Website design included",
      "Video production",
      "Custom AI agents & voice callers",
      "Dedicated team of specialists",
      "24/7 priority support",
      "White-label options",
    ],
    cta: "Go Enterprise",
    popular: false,
  },
];

export default function PricingPage() {
  const [annual, setAnnual] = useState(false);

  return (
    <div className="min-h-screen" style={{ background: "#0b0d12" }}>
      {/* Header */}
      <div className="max-w-6xl mx-auto px-6 py-8">
        <div className="flex items-center justify-between mb-16">
          <Link href="/" className="flex items-center gap-2">
            <Image src="/icons/shortstack-logo.png" alt="ShortStack" width={28} height={28} />
            <span className="text-white font-bold text-sm">ShortStack</span>
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
            Marketing that actually<br /><span style={{ color: "#c8a855" }}>works</span>
          </h1>
          <p className="text-gray-400 text-lg max-w-xl mx-auto mb-8">
            AI-powered digital marketing for businesses that want real results. No fluff, no vanity metrics — just more clients.
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

        {/* Plans */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto">
          {PLANS.map(plan => {
            const displayPrice = annual ? Math.round(plan.price * 0.8) : plan.price;
            return (
              <div key={plan.name} className={`rounded-2xl p-6 relative ${plan.popular ? "ring-2" : ""}`}
                style={{
                  background: plan.popular ? "rgba(200,168,85,0.04)" : "rgba(255,255,255,0.02)",
                  border: `1px solid ${plan.popular ? "rgba(200,168,85,0.2)" : "rgba(255,255,255,0.05)"}`,
                }}>
                {plan.popular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 text-[10px] font-bold px-3 py-1 rounded-full" style={{ background: "#c8a855", color: "#000" }}>
                    Most Popular
                  </div>
                )}

                <div className="mb-6">
                  <h3 className="text-lg font-bold text-white mb-1">{plan.name}</h3>
                  <p className="text-xs text-gray-500">{plan.description}</p>
                </div>

                <div className="mb-6">
                  <span className="text-4xl font-extrabold text-white">${displayPrice.toLocaleString()}</span>
                  <span className="text-gray-500 text-sm">/{plan.period}</span>
                </div>

                <ul className="space-y-2.5 mb-8">
                  {plan.features.map((f, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-gray-300">
                      <Check size={14} className="shrink-0 mt-0.5" style={{ color: plan.color }} />
                      {f}
                    </li>
                  ))}
                </ul>

                <Link href={`/login?plan=${plan.name.toLowerCase()}${annual ? "&billing=annual" : ""}`}
                  className={`w-full py-3 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 transition-all hover:opacity-90 ${
                    plan.popular ? "text-black" : "text-white"
                  }`}
                  style={{
                    background: plan.popular ? "linear-gradient(135deg, #c8a855, #b89840)" : "rgba(255,255,255,0.06)",
                    border: plan.popular ? "none" : "1px solid rgba(255,255,255,0.08)",
                  }}>
                  {plan.cta} <ArrowRight size={14} />
                </Link>
                <Link href="/book"
                  className="w-full mt-2 py-2 rounded-lg text-[11px] text-gray-500 hover:text-gray-300 flex items-center justify-center gap-1.5 transition-colors">
                  <Phone size={10} /> Or book a free strategy call
                </Link>
              </div>
            );
          })}
        </div>

        {/* Bottom CTA */}
        <div className="text-center mt-16 mb-8">
          <p className="text-gray-500 text-sm mb-2">Sign up in 60 seconds. Cancel anytime.</p>
          <p className="text-gray-600 text-xs mb-5">Not sure which plan? <Link href="/book" className="text-gray-400 hover:text-white underline underline-offset-2 transition-colors">Book a free strategy call</Link> and we&apos;ll help you decide.</p>
          <Link href="/login" className="inline-flex items-center gap-2 text-sm font-medium px-6 py-3 rounded-xl transition-all hover:opacity-90"
            style={{ background: "linear-gradient(135deg, #c8a855, #b89840)", color: "#0b0d12" }}>
            Get Started Now <ArrowRight size={14} />
          </Link>
        </div>

        <p className="text-center text-[10px] text-gray-600">Powered by ShortStack OS</p>
      </div>
    </div>
  );
}
