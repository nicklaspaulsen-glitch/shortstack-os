"use client";

import Image from "next/image";
import Link from "next/link";

const ENTRIES = [
  {
    date: "April 10, 2026",
    title: "Massive Feature Drop",
    tag: "New",
    items: [
      "Pixel art Agent Office with 12 animated characters",
      "Public booking page (like Calendly)",
      "Form builder with embed codes",
      "Email sequence/drip campaign builder",
      "Deals pipeline with 6-stage kanban",
      "Client health dashboard",
      "ROI calculator for proposals",
      "SMS templates with AI generation",
      "Support ticket system",
      "Integrations marketplace",
      "Profile settings",
      "Full autopilot mode",
      "Client self-service AI (auto-triggers agents)",
    ],
  },
  {
    date: "April 9, 2026",
    title: "Agent Orchestration & UI Overhaul",
    tag: "Improved",
    items: [
      "20 AI agents with health endpoints",
      "12 agent-to-agent trigger chains",
      "7 autonomous cron jobs",
      "UI humanization — warmer, softer design",
      "10 theme presets",
      "Telegram bot: 9 commands + /autopilot",
      "Meta + Google + TikTok OAuth setup",
      "Remotion video server on Railway",
    ],
  },
  {
    date: "April 8, 2026",
    title: "Core Platform Launch",
    tag: "Launch",
    items: [
      "CRM with pipeline view and lead scoring",
      "Cold outreach (email + SMS + calls via GHL)",
      "AI content generation",
      "Video editor with Remotion",
      "Website builder",
      "Client portal",
      "Stripe payments",
      "Desktop Electron app",
    ],
  },
];

export default function ChangelogPage() {
  return (
    <div className="min-h-screen" style={{ background: "#0b0d12" }}>
      <div className="max-w-2xl mx-auto px-6 py-12">
        <div className="flex items-center justify-between mb-12">
          <Link href="/" className="flex items-center gap-2">
            <Image src="/trinity-logo.svg" alt="Trinity" width={28} height={28} />
            <span className="text-white font-bold text-sm leading-tight flex flex-col">
              <span>Trinity</span>
              <span className="text-[9px] font-medium text-gray-500 tracking-wide">by ShortStack</span>
            </span>
          </Link>
          <Link href="/login" className="text-xs text-gray-400 hover:text-white">Login</Link>
        </div>

        <h1 className="text-3xl font-extrabold text-white mb-2" style={{ letterSpacing: "-0.03em" }}>Changelog</h1>
        <p className="text-gray-500 text-sm mb-12">What&apos;s new in Trinity</p>

        <div className="space-y-12">
          {ENTRIES.map((entry, i) => (
            <div key={i} className="relative pl-6" style={{ borderLeft: "1px solid rgba(255,255,255,0.06)" }}>
              <div className="absolute left-0 top-0 w-2 h-2 rounded-full -translate-x-[4.5px]"
                style={{ background: entry.tag === "New" ? "#c8a855" : entry.tag === "Launch" ? "#10b981" : "#3b82f6" }} />
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xs text-gray-500">{entry.date}</span>
                <span className="text-[9px] px-2 py-0.5 rounded-full font-medium" style={{
                  background: entry.tag === "New" ? "rgba(200,168,85,0.1)" : entry.tag === "Launch" ? "rgba(16,185,129,0.1)" : "rgba(59,130,246,0.1)",
                  color: entry.tag === "New" ? "#c8a855" : entry.tag === "Launch" ? "#10b981" : "#3b82f6",
                }}>{entry.tag}</span>
              </div>
              <h2 className="text-lg font-bold text-white mb-3">{entry.title}</h2>
              <ul className="space-y-1.5">
                {entry.items.map((item, j) => (
                  <li key={j} className="text-sm text-gray-400 flex items-start gap-2">
                    <span className="text-gray-600 mt-1">•</span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <p className="text-center text-[10px] text-gray-600 mt-16">Trinity · by ShortStack</p>
      </div>
    </div>
  );
}
