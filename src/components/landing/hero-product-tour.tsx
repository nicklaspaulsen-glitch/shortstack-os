"use client";

/**
 * HeroProductTour — rotating mock-up of 5 product surfaces.
 * Upgraded: Framer Motion AnimatePresence for smooth surface crossfades,
 * glass aesthetic wrapper, animated tab indicator.
 */

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  TrendingUp,
  Phone,
  Calendar,
  PenTool,
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

export default function HeroProductTour() {
  const [active, setActive] = useState<SurfaceKey>("dashboard");
  const [paused, setPaused] = useState(false);

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
      className="relative mt-16 md:mt-24 mx-auto"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      {/* Glass wrapper */}
      <div
        className="relative overflow-hidden rounded-2xl"
        style={{
          background: "rgba(10, 10, 13, 0.55)",
          backdropFilter: "blur(24px) saturate(1.4)",
          WebkitBackdropFilter: "blur(24px) saturate(1.4)",
          border: "1px solid rgba(255,255,255,0.08)",
          boxShadow:
            "0 1px 0 rgba(255,255,255,0.06) inset, 0 24px 80px -8px rgba(0,0,0,0.55)",
        }}
      >
        {/* Inner highlight bevel */}
        <div
          className="absolute top-0 left-0 right-0 h-px pointer-events-none"
          style={{ background: "rgba(255,255,255,0.10)" }}
        />

        <div className="px-6 md:px-8 py-8 md:py-10 min-h-[420px] relative overflow-hidden">
          {/* Window chrome + tab pills */}
          <div className="flex items-center gap-2 mb-6 flex-wrap">
            <div className="w-3 h-3 rounded-full" style={{ background: "rgba(239,68,68,0.5)" }} />
            <div className="w-3 h-3 rounded-full" style={{ background: "rgba(234,179,8,0.5)" }} />
            <div className="w-3 h-3 rounded-full" style={{ background: "rgba(34,197,94,0.5)" }} />

            <div className="hidden sm:flex ml-3 gap-1 flex-wrap">
              {SURFACES.map((s) => (
                <button
                  key={s.key}
                  type="button"
                  onClick={() => setActive(s.key)}
                  className="relative text-[10px] font-semibold px-3 py-1 rounded-md transition-colors duration-150"
                  style={{
                    color: active === s.key ? "#60A5FA" : "rgba(255,255,255,0.4)",
                  }}
                >
                  {active === s.key && (
                    <motion.div
                      layoutId="tab-bg"
                      className="absolute inset-0 rounded-md"
                      style={{
                        background: "rgba(255,255,255,0.10)",
                        border: "1px solid rgba(255,255,255,0.16)",
                      }}
                      transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
                    />
                  )}
                  <span className="relative z-10">{s.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Surface content — AnimatePresence crossfade */}
          <div className="relative min-h-[300px]">
            <AnimatePresence mode="wait">
              <motion.div
                key={active}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
              >
                {active === "dashboard" && <DashboardMock />}
                {active === "leads" && <LeadsMock />}
                {active === "voice" && <VoiceMock />}
                {active === "content" && <ContentMock />}
                {active === "ads" && <AdsMock />}
              </motion.div>
            </AnimatePresence>
          </div>

          {/* Mobile dot indicators */}
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2 sm:hidden">
            {SURFACES.map((s) => (
              <motion.button
                key={s.key}
                type="button"
                onClick={() => setActive(s.key)}
                className="rounded-full"
                animate={{
                  width: active === s.key ? 18 : 6,
                  background: active === s.key ? "#2563EB" : "rgba(255,255,255,0.25)",
                }}
                transition={{ duration: 0.2 }}
                style={{ height: 6 }}
                aria-label={s.label}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Bottom ambient glow */}
      <div
        className="absolute -bottom-8 left-1/2 -translate-x-1/2 w-3/4 h-16 pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse, rgba(212,255,0,0.12) 0%, transparent 70%)",
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
        ].map((s, i) => (
          <motion.div
            key={s.label}
            className="rounded-lg p-3"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05, duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
            style={{
              background: "rgba(255,255,255,0.03)",
              border: "1px solid rgba(255,255,255,0.06)",
            }}
          >
            <p className="text-[9px] text-gray-500 mb-1">{s.label}</p>
            <p className="text-lg font-bold text-white">{s.val}</p>
            <p className="text-[9px] text-emerald-400 flex items-center gap-0.5">
              <ArrowUpRight size={8} /> {s.change}
            </p>
          </motion.div>
        ))}
      </div>
      <div className="flex items-end gap-1.5 h-24">
        {[40, 55, 35, 65, 80, 60, 75, 90, 70, 85, 95, 78].map((h, i) => (
          <motion.div
            key={i}
            className="flex-1 rounded-t"
            initial={{ height: 0 }}
            animate={{ height: `${h}%` }}
            transition={{ delay: i * 0.03, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
            style={{
              background: `linear-gradient(180deg, rgba(255,255,255,${
                0.25 + (h / 100) * 0.45
              }) 0%, rgba(255,255,255,0.04) 100%)`,
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
          <motion.div
            key={r.name}
            className="rounded-md p-2.5 grid grid-cols-12 gap-2 items-center"
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.06, duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
            style={{
              background: "rgba(255,255,255,0.02)",
              border: "1px solid rgba(255,255,255,0.05)",
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
                <motion.div
                  className="h-full rounded-full"
                  initial={{ width: 0 }}
                  animate={{ width: `${r.score}%` }}
                  transition={{ delay: i * 0.08 + 0.2, duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
                  style={{ background: "linear-gradient(90deg, #2563EB, #60A5FA)" }}
                />
              </div>
              <span className="text-[9px] text-white font-mono">{r.score}</span>
            </div>
            <div className="col-span-2">
              <span
                className="text-[9px] font-bold px-2 py-0.5 rounded"
                style={{
                  background:
                    r.status === "Hot" ? "rgba(239,68,68,0.14)" : "rgba(212,255,0,0.10)",
                  color: r.status === "Hot" ? "#fca5a5" : "#93C5FD",
                }}
              >
                {r.status}
              </span>
            </div>
          </motion.div>
        ))}
      </div>
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
          { caller: "+1 510 555 0144", duration: "3:42", outcome: "Qualified", color: "#10b981" },
          { caller: "+1 650 555 0119", duration: "0:12", outcome: "Spam", color: "#ef4444" },
        ].map((row, i) => (
          <motion.div
            key={i}
            className="rounded-md p-2.5 grid grid-cols-12 gap-2 items-center text-xs"
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.07, duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
            style={{
              background: "rgba(255,255,255,0.02)",
              border: "1px solid rgba(255,255,255,0.05)",
            }}
          >
            <div className="col-span-4 text-white font-mono text-[10px]">{row.caller}</div>
            <div className="col-span-2 text-gray-500 text-[10px]">{row.duration}</div>
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
          </motion.div>
        ))}
      </div>
      <motion.div
        className="mt-4 rounded-md p-2.5 flex items-center gap-2 text-[10px] text-gray-300"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.35, duration: 0.5 }}
        style={{
          background: "rgba(255,255,255,0.04)",
          border: "1px solid rgba(255,255,255,0.10)",
        }}
      >
        <Sparkles size={10} style={{ color: "#3B82F6" }} />
        AI hand-off triggered for high-intent caller — booked to John Friday 2pm.
      </motion.div>
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
    { day: 5, type: "ai", icon: <Sparkles size={9} />, color: "#3B82F6" },
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
            <motion.div
              key={i}
              className="rounded-md aspect-[3/4] p-2 flex flex-col"
              initial={{ opacity: 0, scale: 0.92 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: i * 0.04, duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
              style={{
                background: "rgba(255,255,255,0.02)",
                border: "1px solid rgba(255,255,255,0.05)",
              }}
            >
              <p className="text-[9px] text-gray-500 mb-1 font-bold">{d}</p>
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
            </motion.div>
          );
        })}
      </div>
      <div className="flex items-center gap-2 text-[10px] text-text-muted">
        <PenTool size={10} className="text-text-muted" />
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
          <motion.div
            key={i}
            className="rounded-md p-2.5 flex items-center gap-3"
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.08, duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
            style={{
              background: "rgba(255,255,255,0.02)",
              border: "1px solid rgba(255,255,255,0.05)",
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
              style={{ background: "rgba(212,255,0,0.12)", color: "#60A5FA" }}
            >
              {row.roas}
            </div>
          </motion.div>
        ))}
      </div>
      <motion.div
        className="rounded-md p-2.5 flex items-start gap-2 text-[10px] text-gray-300"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.32, duration: 0.5 }}
        style={{
          background: "rgba(255,255,255,0.04)",
          border: "1px solid rgba(255,255,255,0.10)",
        }}
      >
        <Sparkles size={10} style={{ color: "#3B82F6" }} className="shrink-0 mt-0.5" />
        AI rebalanced budget: shifted $400/day from Meta Awareness → Google Search.
      </motion.div>
    </div>
  );
}
