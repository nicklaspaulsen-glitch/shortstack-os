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
import type { LucideIcon } from "lucide-react";
import Reveal from "./reveal";
import SectionHeading from "./section-heading";

interface Feature {
  icon: LucideIcon;
  title: string;
  description: string;
  color: string;
  /** 1-3 tiny visual data points shown at the bottom of the card. */
  metrics: Array<{ label: string; value: string }>;
}

const FEATURES: Feature[] = [
  {
    icon: Target,
    title: "Lead Scraper",
    description:
      "Pull targeted leads from Google Maps, LinkedIn, niche directories, and custom sources. AI-enrich with emails, phones, socials, and fit scores.",
    color: "#c8a855",
    metrics: [
      { label: "Sources", value: "12+" },
      { label: "Enriched", value: "98%" },
    ],
  },
  {
    icon: Mail,
    title: "AI Outreach",
    description:
      "Cold email, DM, and LinkedIn sequences that write and adapt themselves. Built-in warmup, deliverability monitoring, and reply-handling.",
    color: "#3b82f6",
    metrics: [
      { label: "Channels", value: "5" },
      { label: "Avg reply", value: "11%" },
    ],
  },
  {
    icon: Phone,
    title: "AI Voice Caller",
    description:
      "Outbound AI voice agents that qualify leads, book meetings, and hand off to humans the moment intent spikes.",
    color: "#ef4444",
    metrics: [
      { label: "24/7", value: "Live" },
      { label: "Hand-off", value: "<2s" },
    ],
  },
  {
    icon: PenTool,
    title: "Content Auto-Generation",
    description:
      "Scripts, captions, ad copy, blog posts, email newsletters, and design assets — generated in your voice, on-brand, at scale.",
    color: "#a855f7",
    metrics: [
      { label: "Formats", value: "15+" },
      { label: "On-brand", value: "Auto" },
    ],
  },
  {
    icon: Globe,
    title: "Content Auto-Publishing",
    description:
      "Schedule and post to Meta, TikTok, LinkedIn, X, YouTube, Google Business, and more. Queue-first, mobile-friendly, failure-safe.",
    color: "#10b981",
    metrics: [
      { label: "Platforms", value: "10+" },
      { label: "Retry", value: "Auto" },
    ],
  },
  {
    icon: Users,
    title: "Client Portals (White-Label)",
    description:
      "Each client gets a portal on your domain, your logo, your colors. Deliverables, reports, tasks, invoices, contracts — all in one place.",
    color: "#f59e0b",
    metrics: [
      { label: "Domain", value: "Yours" },
      { label: "Branding", value: "100%" },
    ],
  },
  {
    icon: Layers,
    title: "CRM & Deal Tracking",
    description:
      "Pipeline views, contact timelines, won/lost reporting, forecasting. Syncs with every inbound channel automatically.",
    color: "#ec4899",
    metrics: [
      { label: "Pipelines", value: "∞" },
      { label: "Forecasts", value: "Live" },
    ],
  },
  {
    icon: FileText,
    title: "Proposals",
    description:
      "Template-driven proposals your prospects actually open on their phones. e-Sign, expiration, auto-reminders, win-rate analytics built in.",
    color: "#06b6d4",
    metrics: [
      { label: "Mobile", value: "Yes" },
      { label: "e-Sign", value: "Built-in" },
    ],
  },
  {
    icon: FileSignature,
    title: "Contracts & e-Sign",
    description:
      "Legally-binding e-signature with audit trails. Reusable templates, auto-fill from CRM, reminder sequences for stalling signers.",
    color: "#14b8a6",
    metrics: [
      { label: "Audit log", value: "Full" },
      { label: "Templates", value: "∞" },
    ],
  },
  {
    icon: Globe,
    title: "Websites & Funnels",
    description:
      "Spin up client sites, landing pages, and funnels from branded templates. Hosted, SEO-ready, and connected to your CRM out of the box.",
    color: "#8b5cf6",
    metrics: [
      { label: "Hosted", value: "Yes" },
      { label: "SEO", value: "Auto" },
    ],
  },
  {
    icon: CreditCard,
    title: "Billing & Invoicing",
    description:
      "Stripe-powered subscription billing, one-off invoices, payment plans, and dunning. Clients pay from their portal. Revenue hits your dashboard live.",
    color: "#22c55e",
    metrics: [
      { label: "Stripe", value: "Native" },
      { label: "Dunning", value: "Auto" },
    ],
  },
  {
    icon: Bot,
    title: "20+ AI Agents",
    description:
      "Agents for content, SEO, ad optimization, customer support, reporting, and more — chainable into autopilot workflows that run 24/7.",
    color: "#f97316",
    metrics: [
      { label: "Agents", value: "20+" },
      { label: "Chainable", value: "Yes" },
    ],
  },
  {
    icon: BarChart3,
    title: "White-Label Reports",
    description:
      "Automated monthly and weekly reports your clients actually forward around. Custom branding, custom KPIs, scheduled delivery.",
    color: "#0ea5e9",
    metrics: [
      { label: "Branded", value: "Yes" },
      { label: "Scheduled", value: "Auto" },
    ],
  },
  {
    icon: ShieldCheck,
    title: "Access Control & SSO",
    description:
      "Role-based permissions for team members, clients, and contractors. SSO, audit logs, and data-residency options on higher plans.",
    color: "#64748b",
    metrics: [
      { label: "RBAC", value: "Granular" },
      { label: "Audit", value: "Full" },
    ],
  },
];

export default function FeaturesOverview() {
  return (
    <section id="features" className="py-20 md:py-28 px-6 relative">
      {/* Soft ambient background */}
      <div
        className="absolute inset-0 -z-0 pointer-events-none opacity-30"
        style={{
          background:
            "radial-gradient(ellipse 80% 50% at 50% 30%, rgba(200,168,85,0.04) 0%, transparent 70%)",
        }}
      />
      <div className="max-w-6xl mx-auto relative">
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
              <FeatureCard feature={feature} />
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

function FeatureCard({ feature }: { feature: Feature }) {
  return (
    <div
      className="group relative rounded-2xl p-6 h-full transition-all duration-500 hover:-translate-y-1 overflow-hidden"
      style={{
        background:
          "linear-gradient(160deg, rgba(255,255,255,0.025) 0%, rgba(255,255,255,0.005) 100%)",
        border: "1px solid rgba(255,255,255,0.06)",
      }}
    >
      {/* Hover accent — soft radial glow keyed to the feature color */}
      <div
        className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none -z-0"
        style={{
          background: `radial-gradient(circle at 30% 0%, ${feature.color}18 0%, transparent 60%)`,
        }}
      />

      {/* Icon + label row */}
      <div className="flex items-start justify-between mb-4 relative">
        <div
          className="w-11 h-11 rounded-xl flex items-center justify-center transition-all duration-500 group-hover:scale-110"
          style={{
            background: `${feature.color}14`,
            border: `1px solid ${feature.color}28`,
          }}
        >
          <feature.icon size={20} style={{ color: feature.color }} />
        </div>
        {/* Live-pulse dot — visual cue this is "running" */}
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-500">
          <span
            className="w-1.5 h-1.5 rounded-full animate-pulse"
            style={{ background: feature.color }}
          />
          <span
            className="text-[9px] font-semibold uppercase tracking-wider"
            style={{ color: feature.color }}
          >
            Live
          </span>
        </div>
      </div>

      <h3 className="text-base font-bold text-white mb-2 relative">
        {feature.title}
      </h3>
      <p className="text-sm text-gray-400 leading-relaxed mb-5 relative">
        {feature.description}
      </p>

      {/* Metrics strip — bottom of card */}
      <div
        className="flex gap-1.5 pt-4 mt-auto relative"
        style={{
          borderTop: "1px solid rgba(255,255,255,0.04)",
        }}
      >
        {feature.metrics.map((m) => (
          <div
            key={m.label}
            className="flex-1 px-2.5 py-2 rounded-lg"
            style={{
              background: "rgba(255,255,255,0.02)",
            }}
          >
            <p className="text-[9px] uppercase tracking-wider text-gray-600">
              {m.label}
            </p>
            <p
              className="text-xs font-bold mt-0.5"
              style={{ color: feature.color }}
            >
              {m.value}
            </p>
          </div>
        ))}
      </div>

      {/* Bottom accent bar — grows in on hover */}
      <div
        className="absolute bottom-0 left-0 h-[3px] w-0 group-hover:w-full transition-all duration-700 ease-out"
        style={{
          background: `linear-gradient(90deg, transparent, ${feature.color}, transparent)`,
        }}
      />
    </div>
  );
}
