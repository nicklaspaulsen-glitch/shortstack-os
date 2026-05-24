"use client";

import { ArrowRight, ChatCircle, Clock, Envelope, Sparkle } from "@phosphor-icons/react";

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
import { motion } from "framer-motion";
import { MotionPage } from "@/components/motion/motion-page";

const SUPPORT_EMAIL = "support@shortstack.work";
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
    icon: <Envelope size={22} />,
    title: "Email support",
    description:
      "Best for detailed questions, screenshots, and anything that needs a written paper trail. We reply Mon–Fri.",
    responseTime: "Reply within 1 business day",
    cta: "Email us",
    href: `mailto:${SUPPORT_EMAIL}?subject=ShortStack%20support%20request`,
    external: true,
    accent: "blue",
  },
  {
    icon: <ChatCircle size={22} />,
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
  blue: {
    ring: "border-[rgba(212,255,0,0.25)] hover:border-[rgba(212,255,0,0.5)] hover:shadow-[0_0_0_1px_rgba(212,255,0,0.18)]",
    iconBg: "bg-[rgba(212,255,0,0.08)]",
    iconText: "text-brand-accent",
    cta: "bg-brand-accent text-[#020711] hover:bg-[#E8FF4D]",
  },
  purple: {
    ring: "border-[rgba(212,255,0,0.25)] hover:border-[rgba(212,255,0,0.50)] hover:shadow-[0_0_0_1px_rgba(212,255,0,0.18)]",
    iconBg: "bg-[rgba(212,255,0,0.08)]",
    iconText: "text-brand-accent",
    cta: "bg-brand-accent text-[#020711] hover:bg-[rgba(212,255,0,0.90)]",
  },
};

export default function ContactSupportPage() {
  return (
    <MotionPage className="min-h-screen bg-background text-text-primary">{/* -- Contact Support command strip -- */}
    <div className="flex items-center justify-between gap-4 px-1 py-3 sm:py-4">
      <div className="min-w-0">
        <p className="text-xs uppercase tracking-[0.2em] text-text-muted font-editorial italic mb-1">Help &amp; Support</p>
        <h1 className="text-2xl font-display font-bold text-text-primary">Contact Support</h1>
      </div>
    </div><div className="mx-auto max-w-5xl space-y-6 px-6 pb-12 pt-5">
              {/* Three support channels */}
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                {SUPPORT_CHANNELS.map((channel, i) => {
                  const accent = ACCENT_STYLES[channel.accent];
                  return (
                    <motion.a
                      key={channel.title}
                      href={channel.href}
                      target={channel.external ? "_blank" : undefined}
                      rel={channel.external ? "noopener noreferrer" : undefined}
                      initial={{ opacity: 0, y: 16 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.06, duration: 0.4 }}
                      whileHover={{ y: -4, scale: 1.01 }}
                      onMouseMove={(e) => { const rect = e.currentTarget.getBoundingClientRect(); e.currentTarget.style.setProperty("--mouse-x", `${e.clientX - rect.left}px`); e.currentTarget.style.setProperty("--mouse-y", `${e.clientY - rect.top}px`); }}
                      className={`flex flex-col glass rounded-xl overflow-hidden p-5 transition spotlight-card ${accent.ring}`}
                    >
                      <div
                        className={`mb-4 inline-flex h-11 w-11 items-center justify-center rounded-xl ${accent.iconBg} ${accent.iconText}`}
                      >
                        {channel.icon}
                      </div>
                      <h3 className="text-base font-semibold text-text-primary">
                        {channel.title}
                      </h3>
                      <p className="mt-1.5 flex-1 text-[13px] leading-relaxed text-text-muted">
                        {channel.description}
                      </p>
                      <p className="mt-3 inline-flex items-center gap-1.5 text-[11px] font-medium text-text-muted">
                        <Clock size={11} /> {channel.responseTime}
                      </p>
                      <span
                        className={`mt-4 inline-flex items-center justify-center gap-1.5 rounded-lg px-4 py-2 text-sm font-semibold transition ${accent.cta}`}
                      >
                        {channel.cta} <ArrowRight size={14} />
                      </span>
                    </motion.a>
                  );
                })}
              </div>

              {/* Self-serve helpers */}
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.24, duration: 0.4 }}
                className="glass rounded-xl p-5"
              >
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[rgba(212,255,0,0.08)] text-brand-accent">
                    <Sparkle size={18} />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-sm font-semibold text-text-primary">
                      Try these first — most answers are in the product
                    </h3>
                    <p className="mt-1 text-[12px] text-text-muted">
                      Faster than waiting on a reply. If none of these solve it, hit
                      a channel above and we&apos;ll dig in.
                    </p>
                    <ul className="mt-3 grid grid-cols-1 gap-1.5 text-[12px] sm:grid-cols-2">
                      <li>
                        <Link
                          href="/dashboard/integrations-hub"
                          className="text-brand-accent underline-offset-2 hover:underline"
                        >
                          Integrations status
                        </Link>{" "}
                        <span className="text-text-muted">— check for red dots first</span>
                      </li>
                      <li>
                        <Link
                          href="/dashboard/usage"
                          className="text-brand-accent underline-offset-2 hover:underline"
                        >
                          Token usage
                        </Link>{" "}
                        <span className="text-text-muted">— if AI features look stuck</span>
                      </li>
                      <li>
                        <Link
                          href="/dashboard/inbox"
                          className="text-brand-accent underline-offset-2 hover:underline"
                        >
                          Unified inbox
                        </Link>{" "}
                        <span className="text-text-muted">— for missing client messages</span>
                      </li>
                      <li>
                        <Link
                          href="/dashboard/pricing"
                          className="text-brand-accent underline-offset-2 hover:underline"
                        >
                          Plans &amp; billing
                        </Link>{" "}
                        <span className="text-text-muted">— upgrade or change plan</span>
                      </li>
                    </ul>
                  </div>
                </div>
              </motion.div>

              {/* Honest roadmap note — sets expectations */}
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3, duration: 0.4 }}
                className="glass rounded-xl p-5 text-[12px] text-text-muted"
              >
                <p className="font-semibold text-text-primary">On the roadmap</p>
                <p className="mt-1">
                  A first-class in-product ticket inbox with email intake, SLA timers
                  per plan, and team assignment is in active development. Until then,
                  the channels above are the fastest way to reach us.
                </p>
              </motion.div>
            </div></MotionPage>
  );
}
