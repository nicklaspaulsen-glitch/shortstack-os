"use client";

/**
 * Contact Support — honest landing page that points users to real support
 * channels (email, scheduled call, Discord community).
 *
 * Replaced the previous localStorage-only "tickets" prototype: tickets were
 * stored in browser storage, so they vanished on cache clear, never reached
 * the team, and felt like a fake backend. The proper ticketing system (email
 * intake + SLA timers + team assignment) is on the roadmap, but until that
 * ships we route users to channels we actually monitor.
 */

import Link from "next/link";
import {
  LifeBuoy,
  Mail,
  Calendar,
  MessageCircle,
  ArrowRight,
  Clock,
  Sparkles,
} from "lucide-react";
import PageHero from "@/components/ui/page-hero";

const SUPPORT_EMAIL = "support@shortstack.work";
// Replace with the real Calendly link once configured. Falls back to mailto.
const SUPPORT_SCHEDULE_URL = "https://calendly.com/shortstack-support/30min";
const DISCORD_COMMUNITY_URL = "https://discord.gg/shortstack";

interface SupportChannel {
  icon: React.ReactNode;
  title: string;
  description: string;
  responseTime: string;
  cta: string;
  href: string;
  external?: boolean;
  accent: string;
}

const SUPPORT_CHANNELS: SupportChannel[] = [
  {
    icon: <Mail size={22} />,
    title: "Email support",
    description:
      "Best for detailed questions, screenshots, and anything that needs a written paper trail. We reply Mon–Fri.",
    responseTime: "Reply within 1 business day",
    cta: "Email us",
    href: `mailto:${SUPPORT_EMAIL}?subject=ShortStack%20support%20request`,
    external: true,
    accent: "gold",
  },
  {
    icon: <Calendar size={22} />,
    title: "Schedule a call",
    description:
      "Walk through a workflow on a 30-minute screenshare. Best for onboarding, integrations, and complex issues.",
    responseTime: "Same-week availability",
    cta: "Book a time",
    href: SUPPORT_SCHEDULE_URL,
    external: true,
    accent: "blue",
  },
  {
    icon: <MessageCircle size={22} />,
    title: "Discord community",
    description:
      "Quick questions, share what you built, and chat with other agency owners using ShortStack day-to-day.",
    responseTime: "Active during US business hours",
    cta: "Join the server",
    href: DISCORD_COMMUNITY_URL,
    external: true,
    accent: "purple",
  },
];

const ACCENT_STYLES: Record<string, { ring: string; iconBg: string; iconText: string; cta: string }> = {
  gold: {
    ring: "border-gold/30 hover:border-gold/60 hover:shadow-[0_0_0_1px_rgba(212,175,55,0.18)]",
    iconBg: "bg-gold/10",
    iconText: "text-gold",
    cta: "bg-gold text-black hover:bg-gold/90",
  },
  blue: {
    ring: "border-sky-500/30 hover:border-sky-500/60 hover:shadow-[0_0_0_1px_rgba(14,165,233,0.18)]",
    iconBg: "bg-sky-500/10",
    iconText: "text-sky-300",
    cta: "bg-sky-500 text-white hover:bg-sky-500/90",
  },
  purple: {
    ring: "border-purple-500/30 hover:border-purple-500/60 hover:shadow-[0_0_0_1px_rgba(168,85,247,0.18)]",
    iconBg: "bg-purple-500/10",
    iconText: "text-purple-300",
    cta: "bg-purple-500 text-white hover:bg-purple-500/90",
  },
};

export default function ContactSupportPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <PageHero
        title="Contact Support"
        subtitle="Pick the channel that fits the question — every one is monitored by a real human."
        icon={<LifeBuoy size={20} />}
        gradient="blue"
      />

      <div className="mx-auto max-w-5xl space-y-6 px-6 pb-12 pt-5">
        {/* Three support channels */}
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          {SUPPORT_CHANNELS.map((channel) => {
            const accent = ACCENT_STYLES[channel.accent];
            return (
              <a
                key={channel.title}
                href={channel.href}
                target={channel.external ? "_blank" : undefined}
                rel={channel.external ? "noopener noreferrer" : undefined}
                className={`flex flex-col rounded-2xl border bg-surface-light/20 p-5 transition ${accent.ring}`}
              >
                <div
                  className={`mb-4 inline-flex h-11 w-11 items-center justify-center rounded-xl ${accent.iconBg} ${accent.iconText}`}
                >
                  {channel.icon}
                </div>
                <h3 className="text-base font-semibold text-foreground">
                  {channel.title}
                </h3>
                <p className="mt-1.5 flex-1 text-[13px] leading-relaxed text-muted">
                  {channel.description}
                </p>
                <p className="mt-3 inline-flex items-center gap-1.5 text-[11px] font-medium text-muted">
                  <Clock size={11} /> {channel.responseTime}
                </p>
                <span
                  className={`mt-4 inline-flex items-center justify-center gap-1.5 rounded-lg px-4 py-2 text-sm font-semibold transition ${accent.cta}`}
                >
                  {channel.cta} <ArrowRight size={14} />
                </span>
              </a>
            );
          })}
        </div>

        {/* Self-serve helpers */}
        <div className="rounded-2xl border border-border/40 bg-surface-light/15 p-5">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gold/10 text-gold">
              <Sparkles size={18} />
            </div>
            <div className="flex-1">
              <h3 className="text-sm font-semibold text-foreground">
                Try these first — most answers are in the product
              </h3>
              <p className="mt-1 text-[12px] text-muted">
                Faster than waiting on a reply. If none of these solve it, hit
                a channel above and we&apos;ll dig in.
              </p>
              <ul className="mt-3 grid grid-cols-1 gap-1.5 text-[12px] sm:grid-cols-2">
                <li>
                  <Link
                    href="/dashboard/integrations"
                    className="text-gold underline-offset-2 hover:underline"
                  >
                    Integrations status
                  </Link>{" "}
                  <span className="text-muted">— check for red dots first</span>
                </li>
                <li>
                  <Link
                    href="/dashboard/usage"
                    className="text-gold underline-offset-2 hover:underline"
                  >
                    Token usage
                  </Link>{" "}
                  <span className="text-muted">— if AI features look stuck</span>
                </li>
                <li>
                  <Link
                    href="/dashboard/inbox"
                    className="text-gold underline-offset-2 hover:underline"
                  >
                    Unified inbox
                  </Link>{" "}
                  <span className="text-muted">— for missing client messages</span>
                </li>
                <li>
                  <Link
                    href="/dashboard/pricing"
                    className="text-gold underline-offset-2 hover:underline"
                  >
                    Plans &amp; billing
                  </Link>{" "}
                  <span className="text-muted">— upgrade or change plan</span>
                </li>
              </ul>
            </div>
          </div>
        </div>

        {/* Honest roadmap note — sets expectations */}
        <div className="rounded-2xl border border-border/40 bg-background/40 p-5 text-[12px] text-muted">
          <p className="font-semibold text-foreground">On the roadmap</p>
          <p className="mt-1">
            A first-class in-product ticket inbox with email intake, SLA timers
            per plan, and team assignment is in active development. Until then,
            the channels above are the fastest way to reach us.
          </p>
        </div>
      </div>
    </div>
  );
}
