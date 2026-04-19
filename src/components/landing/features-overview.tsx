"use client";

import {
  BarChart3,
  Bot,
  CreditCard,
  FileSignature,
  FileText,
  Globe,
  Layers,
  Mail,
  PenTool,
  Phone,
  ShieldCheck,
  Target,
  Users,
} from "lucide-react";
import Reveal from "./reveal";
import SectionHeading from "./section-heading";

const FEATURES = [
  {
    icon: Target,
    title: "Lead Scraper",
    description:
      "Pull targeted leads from Google Maps, LinkedIn, niche directories, and custom sources. AI-enrich with emails, phones, socials, and fit scores.",
    color: "#c8a855",
  },
  {
    icon: Mail,
    title: "AI Outreach",
    description:
      "Cold email, DM, and LinkedIn sequences that write and adapt themselves. Built-in warmup, deliverability monitoring, and reply-handling.",
    color: "#3b82f6",
  },
  {
    icon: Phone,
    title: "AI Voice Caller",
    description:
      "Outbound AI voice agents that qualify leads, book meetings, and hand off to humans the moment intent spikes.",
    color: "#ef4444",
  },
  {
    icon: PenTool,
    title: "Content Auto-Generation",
    description:
      "Scripts, captions, ad copy, blog posts, email newsletters, and design assets — generated in your voice, on-brand, at scale.",
    color: "#a855f7",
  },
  {
    icon: Globe,
    title: "Content Auto-Publishing",
    description:
      "Schedule and post to Meta, TikTok, LinkedIn, X, YouTube, Google Business, and more. Queue-first, mobile-friendly, failure-safe.",
    color: "#10b981",
  },
  {
    icon: Users,
    title: "Client Portals (White-Label)",
    description:
      "Each client gets a portal on your domain, your logo, your colors. Deliverables, reports, tasks, invoices, contracts — all in one place.",
    color: "#f59e0b",
  },
  {
    icon: Layers,
    title: "CRM & Deal Tracking",
    description:
      "Pipeline views, contact timelines, won/lost reporting, forecasting. Syncs with every inbound channel automatically.",
    color: "#ec4899",
  },
  {
    icon: FileText,
    title: "Proposals",
    description:
      "Template-driven proposals your prospects actually open on their phones. e-Sign, expiration, auto-reminders, win-rate analytics built in.",
    color: "#06b6d4",
  },
  {
    icon: FileSignature,
    title: "Contracts & e-Sign",
    description:
      "Legally-binding e-signature with audit trails. Reusable templates, auto-fill from CRM, reminder sequences for stalling signers.",
    color: "#14b8a6",
  },
  {
    icon: Globe,
    title: "Websites & Funnels",
    description:
      "Spin up client sites, landing pages, and funnels from branded templates. Hosted, SEO-ready, and connected to your CRM out of the box.",
    color: "#8b5cf6",
  },
  {
    icon: CreditCard,
    title: "Billing & Invoicing",
    description:
      "Stripe-powered subscription billing, one-off invoices, payment plans, and dunning. Clients pay from their portal. Revenue hits your dashboard live.",
    color: "#22c55e",
  },
  {
    icon: Bot,
    title: "20+ AI Agents",
    description:
      "Agents for content, SEO, ad optimization, customer support, reporting, and more — chainable into autopilot workflows that run 24/7.",
    color: "#f97316",
  },
  {
    icon: BarChart3,
    title: "White-Label Reports",
    description:
      "Automated monthly and weekly reports your clients actually forward around. Custom branding, custom KPIs, scheduled delivery.",
    color: "#0ea5e9",
  },
  {
    icon: ShieldCheck,
    title: "Access Control & SSO",
    description:
      "Role-based permissions for team members, clients, and contractors. SSO, audit logs, and data-residency options on higher plans.",
    color: "#64748b",
  },
];

export default function FeaturesOverview() {
  return (
    <section id="features" className="py-20 md:py-28 px-6">
      <div className="max-w-6xl mx-auto">
        <Reveal>
          <SectionHeading
            eyebrow="Everything you need"
            title="One platform. Zero excuses."
            subtitle="Replace your entire agency tool stack. Every capability below ships on day one — no add-on pricing, no surprise upgrade gates on core features."
            className="mb-16"
          />
        </Reveal>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {FEATURES.map((feature, i) => (
            <Reveal key={feature.title} delay={0.05 * i}>
              <div
                className="group rounded-2xl p-6 h-full transition-all duration-300 hover:-translate-y-1"
                style={{
                  background: "rgba(255,255,255,0.02)",
                  border: "1px solid rgba(255,255,255,0.05)",
                }}
              >
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center mb-4"
                  style={{ background: `${feature.color}14` }}
                >
                  <feature.icon size={20} style={{ color: feature.color }} />
                </div>
                <h3 className="text-base font-bold text-white mb-2">
                  {feature.title}
                </h3>
                <p className="text-sm text-gray-400 leading-relaxed">
                  {feature.description}
                </p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
