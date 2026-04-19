"use client";

import {
  AlertTriangle,
  BellRing,
  Clock,
  FileQuestion,
  Flame,
  Layers,
} from "lucide-react";
import { BRAND } from "@/lib/brand-config";
import Reveal from "./reveal";
import SectionHeading from "./section-heading";

const PAINS = [
  {
    icon: Layers,
    title: "Your tool stack is a mess",
    body:
      "GoHighLevel, ClickUp, Notion, Loom, Canva, Airtable, Zapier, ManyChat, Calendly, a separate CRM… ten tabs open and no single source of truth. Every subscription renews on a different day and nobody is ever 100% sure which tool has the latest client info.",
  },
  {
    icon: FileQuestion,
    title: "\"What did you do this week?\"",
    body:
      "Clients ask for updates and you're scrambling to stitch together screenshots, numbers, and notes from five dashboards. By the time you send the report, the work is already a week old and the client is already skeptical.",
  },
  {
    icon: Clock,
    title: "Content is a bottleneck",
    body:
      "You can only shoot so many videos, write so many captions, and edit so many reels per day. The content calendar slips, clients get nervous, and you end up paying a freelancer just to keep up with what you promised.",
  },
  {
    icon: Flame,
    title: "Outreach is getting burned",
    body:
      "Cold-email templates die in weeks. Spam filters eat half your sends. DMs get flagged. Every time you finally find an angle that works, someone else copy-pastes it and kills the inbox before your follow-ups even land.",
  },
  {
    icon: AlertTriangle,
    title: "Scaling = drowning, not marketing",
    body:
      "The moment you pass 10 clients, you stop doing actual marketing and start doing admin: onboarding forms, proposals, contract chase-ups, invoice reminders, Slack questions, portal logins. You built an agency. You got a project management job.",
  },
  {
    icon: BellRing,
    title: "No clean system to onboard and retain",
    body:
      "Every new client is a manual setup: spin up a folder, send the contract, invoice them, give them a dashboard link, explain three tools, send a Loom. Then six months in they ask, \"what are we actually paying you for?\" and you don't have a clean answer.",
  },
];

export default function PainPoints() {
  return (
    <section
      id="why"
      className="py-20 md:py-28 px-6"
      style={{ borderTop: "1px solid rgba(255,255,255,0.03)" }}
    >
      <div className="max-w-6xl mx-auto">
        <Reveal>
          <SectionHeading
            eyebrow="Why we built this"
            title={
              <>
                Running an agency in 2026
                <br />
                <span
                  style={{
                    background:
                      "linear-gradient(135deg, #c8a855, #e2c878)",
                    WebkitBackgroundClip: "text",
                    WebkitTextFillColor: "transparent",
                  }}
                >
                  shouldn&apos;t feel like this.
                </span>
              </>
            }
            subtitle={
              <>
                We ran {BRAND.company_name} Digital as an agency for years. We
                hit every one of these walls. {BRAND.product_name} exists
                because the tools we could buy off the shelf couldn&apos;t solve
                them — so we built one that does.
              </>
            }
            className="mb-16"
          />
        </Reveal>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {PAINS.map((pain, i) => (
            <Reveal key={pain.title} delay={0.08 * i}>
              <div
                className="rounded-2xl p-6 h-full transition-all duration-300 hover:-translate-y-1"
                style={{
                  background: "rgba(255,255,255,0.02)",
                  border: "1px solid rgba(255,255,255,0.05)",
                }}
              >
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center mb-4"
                  style={{ background: "rgba(239,68,68,0.08)" }}
                >
                  <pain.icon size={18} style={{ color: "#f87171" }} />
                </div>
                <h3 className="text-base font-bold text-white mb-2">
                  {pain.title}
                </h3>
                <p className="text-sm text-gray-400 leading-relaxed">
                  {pain.body}
                </p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
