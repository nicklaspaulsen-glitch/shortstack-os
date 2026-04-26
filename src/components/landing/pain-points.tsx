"use client";

import {
  AlertTriangle,
  BellRing,
  Clock,
  FileQuestion,
  Flame,
  Layers,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { BRAND } from "@/lib/brand-config";
import Reveal from "./reveal";
import SectionHeading from "./section-heading";

interface Pain {
  icon: LucideIcon;
  title: string;
  body: string;
  /** Tags shown at the bottom — concrete pain bullet points. */
  tags: string[];
}

const PAINS: Pain[] = [
  {
    icon: Layers,
    title: "Your tool stack is a mess",
    body:
      "GoHighLevel, ClickUp, Notion, Loom, Canva, Airtable, Zapier, ManyChat, Calendly, a separate CRM… ten tabs open and no single source of truth. Every subscription renews on a different day and nobody is ever 100% sure which tool has the latest client info.",
    tags: ["10+ logins", "$500+/mo", "no source of truth"],
  },
  {
    icon: FileQuestion,
    title: "\"What did you do this week?\"",
    body:
      "Clients ask for updates and you're scrambling to stitch together screenshots, numbers, and notes from five dashboards. By the time you send the report, the work is already a week old and the client is already skeptical.",
    tags: ["manual reports", "Friday-night scramble", "stale data"],
  },
  {
    icon: Clock,
    title: "Content is a bottleneck",
    body:
      "You can only shoot so many videos, write so many captions, and edit so many reels per day. The content calendar slips, clients get nervous, and you end up paying a freelancer just to keep up with what you promised.",
    tags: ["calendar slips", "freelancer cost", "client churn risk"],
  },
  {
    icon: Flame,
    title: "Outreach is getting burned",
    body:
      "Cold-email templates die in weeks. Spam filters eat half your sends. DMs get flagged. Every time you finally find an angle that works, someone else copy-pastes it and kills the inbox before your follow-ups even land.",
    tags: ["templates die", "deliverability", "DMs flagged"],
  },
  {
    icon: AlertTriangle,
    title: "Scaling = drowning, not marketing",
    body:
      "The moment you pass 10 clients, you stop doing actual marketing and start doing admin: onboarding forms, proposals, contract chase-ups, invoice reminders, Slack questions, portal logins. You built an agency. You got a project management job.",
    tags: ["admin > marketing", "no leverage", "owner stuck"],
  },
  {
    icon: BellRing,
    title: "No clean system to onboard and retain",
    body:
      "Every new client is a manual setup: spin up a folder, send the contract, invoice them, give them a dashboard link, explain three tools, send a Loom. Then six months in they ask, \"what are we actually paying you for?\" and you don't have a clean answer.",
    tags: ["manual onboarding", "ROI invisible", "churn at month 6"],
  },
];

export default function PainPoints() {
  return (
    <section
      id="why"
      className="py-20 md:py-28 px-6 relative overflow-hidden"
      style={{ borderTop: "1px solid rgba(255,255,255,0.03)" }}
    >
      {/* Faint red glow that hints at "this is hurting" without being heavy */}
      <div
        className="absolute top-1/3 left-1/4 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] rounded-full opacity-20 pointer-events-none blur-3xl"
        style={{
          background:
            "radial-gradient(circle, rgba(239,68,68,0.15) 0%, transparent 70%)",
        }}
      />

      <div className="max-w-6xl mx-auto relative">
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
              <PainCard pain={pain} />
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

function PainCard({ pain }: { pain: Pain }) {
  return (
    <div
      className="group relative rounded-2xl p-6 h-full transition-all duration-500 hover:-translate-y-1 overflow-hidden flex flex-col"
      style={{
        background:
          "linear-gradient(160deg, rgba(255,255,255,0.025) 0%, rgba(255,255,255,0.005) 100%)",
        border: "1px solid rgba(255,255,255,0.06)",
      }}
    >
      {/* Hover red wash — subtle, only on hover, signals "ouch" */}
      <div
        className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none -z-0"
        style={{
          background:
            "radial-gradient(circle at 100% 0%, rgba(239,68,68,0.08) 0%, transparent 60%)",
        }}
      />

      <div className="flex items-start justify-between mb-4 relative">
        <div
          className="w-11 h-11 rounded-xl flex items-center justify-center transition-transform duration-500 group-hover:rotate-[-4deg]"
          style={{
            background: "rgba(239,68,68,0.08)",
            border: "1px solid rgba(239,68,68,0.18)",
          }}
        >
          <pain.icon size={18} style={{ color: "#f87171" }} />
        </div>
        {/* Pulsing red dot — signals "this is hurting you right now" */}
        <span className="relative flex h-2 w-2 mt-1.5">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-40" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500" />
        </span>
      </div>

      <h3 className="text-base font-bold text-white mb-2 relative">
        {pain.title}
      </h3>
      <p className="text-sm text-gray-400 leading-relaxed mb-5 flex-1 relative">
        {pain.body}
      </p>

      {/* Pain tags — chip-style at the bottom of the card */}
      <div className="flex flex-wrap gap-1.5 pt-4 relative" style={{
        borderTop: "1px solid rgba(255,255,255,0.04)",
      }}>
        {pain.tags.map((tag) => (
          <span
            key={tag}
            className="text-[10px] font-semibold px-2 py-0.5 rounded-md"
            style={{
              background: "rgba(239,68,68,0.06)",
              border: "1px solid rgba(239,68,68,0.15)",
              color: "#fca5a5",
            }}
          >
            {tag}
          </span>
        ))}
      </div>
    </div>
  );
}
