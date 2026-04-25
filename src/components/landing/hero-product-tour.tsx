"use client";

/**
 * HeroProductTour — rotating mock-up of 4 product surfaces, replaces the
 * single static dashboard mock that lived inline in hero.tsx. Auto-cycles
 * every 5 seconds; user can click the dot indicators to jump to a specific
 * surface.
 *
 * Each mock is a stylised representation of the real ShortStack surface
 * (no actual screenshots — drawn with CSS so it stays sharp at any DPI
 * and adjusts to the user's color scheme automatically).
 *
 * Pure CSS animations + a single setInterval. Pauses while the user is
 * hovering the panel.
 */

import { useEffect, useState } from "react";
import {
  TrendingUp,
  Phone,
  Calendar,
  PenTool,
  CheckCircle2,
  Sparkles,
  ArrowUpRight,
  PlayCircle,
} from "lucide-react";
import {
  SiMeta,
  SiGoogleads,
  SiTiktok,
  SiYoutube,
  SiInstagram,
} from "react-icons/si";

const SURFACES = [
  { key: "dashboard", label: "Dashboard" },
  { key: "leads", label: "Lead Finder" },
  { key: "voice", label: "Voice AI" },
  { key: "content", label: "Content Plan" },
  { key: "ads", label: "Ads Manager" },
] as const;

type SurfaceKey = (typeof SURFACES)[number]["key"];

export default function HeroProductTour({ visible }: { visible: boolean }) {
  const [active, setActive] = useState<SurfaceKey>("dashboard");
  const [paused, setPaused] = useState(false);

  // Auto-rotate every 5 seconds
  useEffect(() => {
    if (paused) return;
    const t = setInterval(() => {
      setActive((curr) => {
        const idx = SURFACES.findIndex((s) => s.key === curr);
        return SURFACES[(idx + 1) % SURFACES.length].key;
      });
    }, 5000);
    return () => clearInterval(t);
  }, [paused]);

  return (
    <div
      className={`relative mt-16 md:mt-24 mx-auto max-w-4xl ${
        visible ? "animate-fade-up delay-500" : "opacity-0"
      }`}
      style={{ opacity: 0 }}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <div
        className="relative rounded-2xl overflow-hidden"
        style={{
          background: "rgba(255,255,255,0.02)",
          border: "1px solid rgba(255,255,255,0.06)",
          padding: "1px",
        }}
      >
        <div
          className="rounded-2xl px-6 md:px-8 py-8 md:py-10 min-h-[420px] relative overflow-hidden"
          style={{
            background:
              "linear-gradient(180deg, rgba(200,168,85,0.03) 0%, rgba(11,13,18,1) 100%)",
          }}
        >
          {/* Window chrome + tab pills */}
          <div className="flex items-center gap-2 mb-5 md:mb-6 flex-wrap">
            <div className="w-3 h-3 rounded-full bg-red-500/50" />
            <div className="w-3 h-3 rounded-full bg-yellow-500/50" />
            <div className="w-3 h-3 rounded-full bg-green-500/50" />
            <div className="hidden sm:flex ml-3 gap-1 flex-wrap">
              {SURFACES.map((s) => (
                <button
                  key={s.key}
                  type="button"
                  onClick={() => setActive(s.key)}
                  className="text-[10px] font-semibold px-2.5 py-1 rounded-md transition-all"
                  style={{
                    background:
                      active === s.key ? "rgba(200,168,85,0.18)" : "rgba(255,255,255,0.03)",
                    border:
                      active === s.key
                        ? "1px solid rgba(200,168,85,0.35)"
                        : "1px solid rgba(255,255,255,0.06)",
                    color:
                      active === s.key ? "#e2c878" : "rgba(255,255,255,0.5)",
                  }}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          {/* Surface content — only one is mounted at a time, cross-fades */}
          <div className="relative">
            {SURFACES.map((s) => (
              <div
                key={s.key}
                className="transition-opacity duration-500"
                style={{
                  opacity: active === s.key ? 1 : 0,
                  position: active === s.key ? "relative" : "absolute",
                  inset: active === s.key ? "auto" : 0,
                  pointerEvents: active === s.key ? "auto" : "none",
                }}
              >
                {s.key === "dashboard" && <DashboardMock />}
                {s.key === "leads" && <LeadsMock />}
                {s.key === "voice" && <VoiceMock />}
                {s.key === "content" && <ContentMock />}
                {s.key === "ads" && <AdsMock />}
              </div>
            ))}
          </div>

          {/* Dot indicators (mobile) */}
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-1.5 sm:hidden">
            {SURFACES.map((s) => (
              <button
                key={s.key}
                type="button"
                onClick={() => setActive(s.key)}
                className="rounded-full transition-all"
                style={{
                  width: active === s.key ? 18 : 6,
                  height: 6,
                  background:
                    active === s.key
                      ? "#c8a855"
                      : "rgba(255,255,255,0.25)",
                }}
                aria-label={s.label}
              />
            ))}
          </div>

          {/* Shimmer */}
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              background:
                "linear-gradient(90deg, transparent, rgba(200,168,85,0.03), transparent)",
              animation: "shimmer 3s ease-in-out infinite",
            }}
          />
        </div>
      </div>

      {/* Bottom glow */}
      <div
        className="absolute -bottom-8 left-1/2 -translate-x-1/2 w-3/4 h-16 pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse, rgba(200,168,85,0.1) 0%, transparent 70%)",
          filter: "blur(20px)",
        }}
      />
    </div>
  );
}

/* ─── Surface mocks ─────────────────────────────────────────────── */

function DashboardMock() {
  return (
    <div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        {[
          { label: "Active Leads", val: "1,284", change: "+12%" },
          { label: "Emails Sent", val: "8,432", change: "+28%" },
          { label: "Deals Won", val: "47", change: "+8%" },
          { label: "Revenue", val: "$124K", change: "+18%" },
        ].map((s) => (
          <div
            key={s.label}
            className="rounded-lg p-3"
            style={{
              background: "rgba(255,255,255,0.02)",
              border: "1px solid rgba(255,255,255,0.04)",
            }}
          >
            <p className="text-[9px] text-gray-600 mb-1">{s.label}</p>
            <p className="text-lg font-bold text-white">{s.val}</p>
            <p className="text-[9px] text-emerald-400 flex items-center gap-0.5">
              <ArrowUpRight size={8} /> {s.change}
            </p>
          </div>
        ))}
      </div>
      <div className="flex items-end gap-1.5 h-24">
        {[40, 55, 35, 65, 80, 60, 75, 90, 70, 85, 95, 78].map((h, i) => (
          <div
            key={i}
            className="flex-1 rounded-t transition-all"
            style={{
              height: `${h}%`,
              background: `linear-gradient(180deg, rgba(200,168,85,${
                0.3 + (h / 100) * 0.5
              }) 0%, rgba(200,168,85,0.05) 100%)`,
            }}
          />
        ))}
      </div>
    </div>
  );
}

function LeadsMock() {
  const rows = [
    { name: "Acme Plumbing", city: "Austin, TX", score: 92, status: "Hot" },
    { name: "Riverside Dental", city: "Tampa, FL", score: 78, status: "Warm" },
    { name: "Northbrook Realty", city: "Chicago, IL", score: 86, status: "Hot" },
    { name: "Sun Valley Med", city: "Phoenix, AZ", score: 64, status: "Warm" },
    { name: "Bayview Auto", city: "San Diego, CA", score: 71, status: "Warm" },
  ];
  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs font-semibold text-white">Lead Finder · last scan</p>
        <span className="text-[9px] text-emerald-400 font-bold flex items-center gap-1">
          <Sparkles size={9} /> 247 new today
        </span>
      </div>
      <div className="space-y-1.5">
        {rows.map((r, i) => (
          <div
            key={r.name}
            className="rounded-md p-2.5 grid grid-cols-12 gap-2 items-center"
            style={{
              background: "rgba(255,255,255,0.02)",
              border: "1px solid rgba(255,255,255,0.04)",
              animation: `lead-row-in 0.6s ease-out ${i * 0.1}s both`,
            }}
          >
            <div className="col-span-4 text-xs font-semibold text-white truncate">
              {r.name}
            </div>
            <div className="col-span-3 text-[10px] text-gray-500 truncate">
              {r.city}
            </div>
            <div className="col-span-3 flex items-center gap-1.5">
              <div className="flex-1 h-1 rounded-full bg-white/[0.04] overflow-hidden">
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${r.score}%`,
                    background:
                      r.score > 80
                        ? "linear-gradient(90deg, #10b981, #34d399)"
                        : "linear-gradient(90deg, #c8a855, #e2c878)",
                  }}
                />
              </div>
              <span className="text-[9px] text-white font-mono">{r.score}</span>
            </div>
            <div className="col-span-2">
              <span
                className="text-[9px] font-bold px-2 py-0.5 rounded"
                style={{
                  background:
                    r.status === "Hot"
                      ? "rgba(239,68,68,0.14)"
                      : "rgba(200,168,85,0.14)",
                  color: r.status === "Hot" ? "#fca5a5" : "#e2c878",
                }}
              >
                {r.status}
              </span>
            </div>
          </div>
        ))}
      </div>
      <style jsx>{`
        @keyframes lead-row-in {
          from {
            opacity: 0;
            transform: translateY(6px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  );
}

function VoiceMock() {
  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs font-semibold text-white flex items-center gap-2">
          <Phone size={12} /> Voice Receptionist · today
        </p>
        <span className="flex items-center gap-1 text-[9px] text-emerald-400">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-50" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400" />
          </span>
          Live
        </span>
      </div>
      <div className="space-y-1.5">
        {[
          { caller: "+1 415 555 0102", duration: "2:14", outcome: "Booked", color: "#10b981" },
          { caller: "+1 408 555 0173", duration: "0:38", outcome: "Voicemail", color: "#94a3b8" },
          { caller: "+1 510 555 0144", duration: "3:42", outcome: "Qualified", color: "#c8a855" },
          { caller: "+1 650 555 0119", duration: "0:12", outcome: "Spam", color: "#ef4444" },
        ].map((row, i) => (
          <div
            key={i}
            className="rounded-md p-2.5 grid grid-cols-12 gap-2 items-center text-xs"
            style={{
              background: "rgba(255,255,255,0.02)",
              border: "1px solid rgba(255,255,255,0.04)",
            }}
          >
            <div className="col-span-4 text-white font-mono text-[10px]">
              {row.caller}
            </div>
            <div className="col-span-2 text-gray-500 text-[10px]">
              {row.duration}
            </div>
            <div className="col-span-3 text-gray-500 text-[10px]">
              <PlayCircle size={11} className="inline mr-1" /> Recording
            </div>
            <div className="col-span-3 text-right">
              <span
                className="text-[9px] font-bold px-2 py-0.5 rounded-full"
                style={{ background: `${row.color}24`, color: row.color }}
              >
                {row.outcome}
              </span>
            </div>
          </div>
        ))}
      </div>
      <div
        className="mt-4 rounded-md p-2.5 flex items-center gap-2 text-[10px] text-gray-300"
        style={{
          background: "rgba(200,168,85,0.05)",
          border: "1px solid rgba(200,168,85,0.15)",
        }}
      >
        <Sparkles size={10} style={{ color: "#c8a855" }} />
        AI hand-off triggered for high-intent caller — booked to John Friday 2pm.
      </div>
    </div>
  );
}

function ContentMock() {
  const days = ["M", "T", "W", "T", "F", "S", "S"];
  const slots = [
    { day: 0, type: "reel", icon: <SiTiktok size={9} />, color: "#FFFFFF" },
    { day: 1, type: "post", icon: <SiInstagram size={9} />, color: "#E4405F" },
    { day: 2, type: "video", icon: <SiYoutube size={9} />, color: "#FF0000" },
    { day: 3, type: "reel", icon: <SiInstagram size={9} />, color: "#E4405F" },
    { day: 4, type: "post", icon: <SiTiktok size={9} />, color: "#FFFFFF" },
    { day: 5, type: "ai", icon: <Sparkles size={9} />, color: "#c8a855" },
  ];
  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs font-semibold text-white flex items-center gap-2">
          <Calendar size={12} /> Content Plan · this week
        </p>
        <span className="text-[9px] font-bold text-emerald-400 flex items-center gap-1">
          <Sparkles size={9} /> AI generated 9
        </span>
      </div>
      <div className="grid grid-cols-7 gap-1.5 mb-4">
        {days.map((d, i) => {
          const slot = slots.find((s) => s.day === i);
          return (
            <div
              key={i}
              className="rounded-md aspect-[3/4] p-2 flex flex-col"
              style={{
                background: "rgba(255,255,255,0.02)",
                border: "1px solid rgba(255,255,255,0.04)",
              }}
            >
              <p className="text-[9px] text-gray-600 mb-1 font-bold">{d}</p>
              {slot && (
                <div
                  className="flex-1 rounded flex items-center justify-center"
                  style={{
                    background: `${slot.color}14`,
                    border: `1px solid ${slot.color}30`,
                  }}
                >
                  <span style={{ color: slot.color }}>{slot.icon}</span>
                </div>
              )}
            </div>
          );
        })}
      </div>
      <div className="flex items-center gap-2 text-[10px] text-gray-400">
        <PenTool size={10} className="text-gold" />
        <span>Next post drafted in your voice — review at 2pm.</span>
      </div>
    </div>
  );
}

function AdsMock() {
  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs font-semibold text-white flex items-center gap-2">
          <TrendingUp size={12} /> Ads Manager · 7-day rollup
        </p>
        <span className="text-[9px] text-emerald-400 font-bold">+22% ROAS</span>
      </div>
      <div className="space-y-2 mb-3">
        {[
          { Icon: SiMeta, name: "Meta Ads · Brand Lift", spend: "$3.2K", roas: "4.1x", color: "#0866FF" },
          { Icon: SiGoogleads, name: "Google Ads · Search", spend: "$1.8K", roas: "5.7x", color: "#4285F4" },
          { Icon: SiTiktok, name: "TikTok · Reels", spend: "$0.9K", roas: "3.2x", color: "#FFFFFF" },
        ].map((row, i) => (
          <div
            key={i}
            className="rounded-md p-2.5 flex items-center gap-3"
            style={{
              background: "rgba(255,255,255,0.02)",
              border: "1px solid rgba(255,255,255,0.04)",
            }}
          >
            <div
              className="w-7 h-7 rounded-md flex items-center justify-center shrink-0"
              style={{
                background: `${row.color}14`,
                border: `1px solid ${row.color}30`,
              }}
            >
              <row.Icon size={12} style={{ color: row.color }} />
            </div>
            <div className="flex-1 min-w-0 text-xs font-semibold text-white truncate">
              {row.name}
            </div>
            <div className="text-[10px] text-gray-500">{row.spend}</div>
            <div
              className="text-[10px] font-bold px-2 py-0.5 rounded"
              style={{ background: "rgba(16,185,129,0.14)", color: "#34d399" }}
            >
              {row.roas}
            </div>
          </div>
        ))}
      </div>
      <div
        className="rounded-md p-2.5 flex items-start gap-2 text-[10px] text-gray-300"
        style={{
          background: "rgba(200,168,85,0.05)",
          border: "1px solid rgba(200,168,85,0.15)",
        }}
      >
        <Sparkles size={10} style={{ color: "#c8a855" }} className="shrink-0 mt-0.5" />
        AI rebalanced budget: shifted $400/day from Meta Awareness → Google Search.
      </div>
    </div>
  );
}
