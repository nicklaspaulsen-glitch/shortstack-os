"use client";

import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight, Zap, Users, BarChart3, Bot,
  MessageSquare, Globe, Film, CheckCircle
} from "lucide-react";

const FEATURES = [
  { icon: <Users size={20} />, title: "CRM & Pipeline", desc: "Kanban boards, lead scoring, deal tracking" },
  { icon: <Zap size={20} />, title: "20 AI Agents", desc: "Autopilot marketing — agents work 24/7" },
  { icon: <MessageSquare size={20} />, title: "Outreach", desc: "Cold email, SMS, DMs on autopilot" },
  { icon: <BarChart3 size={20} />, title: "Analytics", desc: "Real-time dashboards, client reports" },
  { icon: <Bot size={20} />, title: "AI Content", desc: "Scripts, posts, videos, designs — all AI" },
  { icon: <Globe size={20} />, title: "Websites", desc: "Build and deploy client websites" },
  { icon: <Film size={20} />, title: "Video Editor", desc: "Auto-render social videos" },
  { icon: <CheckCircle size={20} />, title: "Client Portal", desc: "Self-service portal for every client" },
];

const STATS = [
  { value: "74", label: "Pages" },
  { value: "147", label: "API Routes" },
  { value: "20", label: "AI Agents" },
  { value: "8", label: "Cron Jobs" },
];

export default function DemoPage() {
  return (
    <div className="min-h-screen" style={{ background: "#0b0d12" }}>
      <div className="max-w-5xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-16">
          <Link href="/" className="flex items-center gap-2">
            <Image src="/trinity-logo.svg" alt="Trinity" width={28} height={28} />
            <span className="text-white font-bold text-sm">Trinity</span>
          </Link>
          <div className="flex items-center gap-4">
            <Link href="/pricing" className="text-xs text-gray-400 hover:text-white">Pricing</Link>
            <Link href="/book" className="text-xs text-gray-400 hover:text-white">Book a Call</Link>
            <Link href="/login" className="text-xs px-4 py-2 rounded-lg font-medium text-black"
              style={{ background: "linear-gradient(135deg, #c8a855, #b89840)" }}>
              Login
            </Link>
          </div>
        </div>

        {/* Hero */}
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full mb-6 text-xs"
            style={{ background: "rgba(200,168,85,0.08)", color: "#c8a855", border: "1px solid rgba(200,168,85,0.15)" }}>
            <Zap size={12} /> AI-Powered Agency OS
          </div>
          <h1 className="text-4xl md:text-6xl font-extrabold text-white mb-4" style={{ letterSpacing: "-0.04em", lineHeight: 1.1 }}>
            Run your entire agency<br />
            <span style={{ color: "#c8a855" }}>on autopilot</span>
          </h1>
          <p className="text-lg text-gray-400 max-w-2xl mx-auto mb-8">
            20 AI agents work around the clock — scraping leads, sending outreach, creating content, managing clients, and closing deals. All while you sleep.
          </p>
          <div className="flex items-center justify-center gap-4">
            <Link href="/book" className="px-8 py-3 rounded-xl font-semibold text-sm text-black flex items-center gap-2"
              style={{ background: "linear-gradient(135deg, #c8a855, #b89840)" }}>
              Start Free Trial <ArrowRight size={14} />
            </Link>
            <Link href="/pricing" className="px-8 py-3 rounded-xl text-sm font-medium text-gray-300"
              style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)" }}>
              See Pricing
            </Link>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-4 gap-4 mb-16">
          {STATS.map(s => (
            <div key={s.label} className="text-center p-4 rounded-xl" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.04)" }}>
              <p className="text-2xl font-extrabold text-gold">{s.value}</p>
              <p className="text-xs text-gray-500">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Features */}
        <div className="mb-16">
          <h2 className="text-2xl font-bold text-white text-center mb-8">Everything you need to run an agency</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {FEATURES.map(f => (
              <div key={f.title} className="p-5 rounded-xl text-center"
                style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.04)" }}>
                <div className="w-10 h-10 rounded-lg mx-auto mb-3 flex items-center justify-center text-gold"
                  style={{ background: "rgba(200,168,85,0.08)" }}>
                  {f.icon}
                </div>
                <h3 className="text-sm font-bold text-white mb-1">{f.title}</h3>
                <p className="text-[11px] text-gray-500">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>

        {/* CTA */}
        <div className="text-center mb-8 p-8 rounded-2xl" style={{ background: "rgba(200,168,85,0.04)", border: "1px solid rgba(200,168,85,0.1)" }}>
          <h2 className="text-xl font-bold text-white mb-2">Ready to automate your agency?</h2>
          <p className="text-sm text-gray-400 mb-6">Book a free strategy call and see how ShortStack can transform your business.</p>
          <Link href="/book" className="inline-flex items-center gap-2 px-8 py-3 rounded-xl font-semibold text-sm text-black"
            style={{ background: "linear-gradient(135deg, #c8a855, #b89840)" }}>
            Book Free Strategy Call <ArrowRight size={14} />
          </Link>
        </div>

        <div className="flex items-center justify-center gap-6 text-[10px] text-gray-600">
          <Link href="/changelog" className="hover:text-gray-400">Changelog</Link>
          <Link href="/privacy" className="hover:text-gray-400">Privacy</Link>
          <Link href="/terms" className="hover:text-gray-400">Terms</Link>
          <span>Powered by ShortStack</span>
        </div>
      </div>
    </div>
  );
}
