"use client";

import { useState } from "react";

// Each style renders a mini dashboard mockup so you can compare them side-by-side

export default function StylePreviewPage() {
  const [expanded, setExpanded] = useState<string | null>(null);

  const styles = [
    { id: "executive", name: "Black & Gold Executive", sub: "Bloomberg meets Amex Black Card" },
    { id: "neobrutal", name: "Neobrutalism", sub: "Anti-AI, hand-designed, bold and loud" },
    { id: "burnt", name: "Burnt Orange & Slate", sub: "Warm, distinctive, nobody else uses this" },
    { id: "nordic", name: "Nordic Minimal", sub: "Scandinavian calm, premium, considered" },
  ];

  return (
    <div className="min-h-screen bg-black p-6">
      <div className="max-w-[1400px] mx-auto">
        <h1 className="text-2xl font-bold text-white mb-1">Pick Your Style</h1>
        <p className="text-sm text-white/50 mb-8">Click any card to expand. Each is a mini dashboard mockup showing how ShortStack OS would look.</p>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {styles.map((s) => (
            <div key={s.id} className="cursor-pointer" onClick={() => setExpanded(expanded === s.id ? null : s.id)}>
              <div className="mb-2 flex items-center justify-between">
                <div>
                  <span className="text-white font-semibold text-sm">{s.name}</span>
                  <span className="text-white/40 text-xs ml-2">{s.sub}</span>
                </div>
                <span className="text-white/30 text-xs">{expanded === s.id ? "Click to shrink" : "Click to expand"}</span>
              </div>
              <div className={`rounded-2xl overflow-hidden border border-white/10 transition-all duration-500 ${expanded === s.id ? "scale-100" : "hover:scale-[1.01]"}`}
                style={{ height: expanded === s.id ? "auto" : "420px" }}>
                {s.id === "executive" && <ExecutiveStyle expanded={expanded === s.id} />}
                {s.id === "neobrutal" && <NeoBrutalStyle expanded={expanded === s.id} />}
                {s.id === "burnt" && <BurntOrangeStyle expanded={expanded === s.id} />}
                {s.id === "nordic" && <NordicStyle expanded={expanded === s.id} />}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════
// STYLE 1: BLACK & GOLD EXECUTIVE
// Bloomberg Terminal meets Amex Black Card
// ═══════════════════════════════════════════════════

function ExecutiveStyle({ expanded }: { expanded: boolean }) {
  return (
    <div className="h-full" style={{ background: "#050505", color: "#E8E0CE", fontFamily: "'Inter', system-ui, sans-serif" }}>
      {/* Top bar */}
      <div className="flex items-center justify-between px-6 py-3" style={{ borderBottom: "1px solid rgba(201,168,76,0.12)" }}>
        <div className="flex items-center gap-3">
          <div className="w-6 h-6 rounded" style={{ background: "linear-gradient(135deg, #C9A84C, #A08030)" }} />
          <span style={{ fontWeight: 700, fontSize: 13, letterSpacing: "0.05em", color: "#C9A84C" }}>SHORTSTACK</span>
        </div>
        <div className="flex items-center gap-4" style={{ fontSize: 10, color: "#666" }}>
          <span>FRI 11 APR</span>
          <span style={{ color: "#C9A84C" }}>SYSTEMS NOMINAL</span>
        </div>
      </div>

      {/* Greeting */}
      <div className="px-6 pt-5 pb-3">
        <p style={{ fontSize: 11, color: "#555", letterSpacing: "0.08em", textTransform: "uppercase" }}>Command Center</p>
        <p style={{ fontSize: 22, fontWeight: 300, color: "#E8E0CE", letterSpacing: "-0.02em" }}>Good evening, <span style={{ color: "#C9A84C", fontWeight: 600 }}>Nicklas</span></p>
      </div>

      {/* Stats row — big bold numbers, gold thin lines */}
      <div className="grid grid-cols-4 mx-6 mb-4" style={{ border: "1px solid rgba(201,168,76,0.1)" }}>
        {[
          { label: "MRR", value: "$4,200", change: "+12%" },
          { label: "LEADS TODAY", value: "73", change: "+23" },
          { label: "OUTREACH", value: "142", change: "of 160" },
          { label: "DEALS WON", value: "8", change: "$34.2K" },
        ].map((s, i) => (
          <div key={i} className="p-4 text-center" style={{ borderRight: i < 3 ? "1px solid rgba(201,168,76,0.08)" : "none" }}>
            <p style={{ fontSize: 9, color: "#555", letterSpacing: "0.12em", marginBottom: 6 }}>{s.label}</p>
            <p style={{ fontSize: 26, fontWeight: 700, fontFamily: "'JetBrains Mono', monospace", color: "#E8E0CE", lineHeight: 1 }}>{s.value}</p>
            <p style={{ fontSize: 10, color: "#C9A84C", marginTop: 4 }}>{s.change}</p>
          </div>
        ))}
      </div>

      {expanded && (
        <>
          {/* Pipeline */}
          <div className="mx-6 mb-4 p-4" style={{ border: "1px solid rgba(201,168,76,0.08)" }}>
            <p style={{ fontSize: 9, color: "#555", letterSpacing: "0.12em", marginBottom: 12 }}>PIPELINE</p>
            <div className="flex items-end gap-2 h-16">
              {[
                { label: "New", w: 100, color: "#C9A84C" },
                { label: "Called", w: 65, color: "#A08030" },
                { label: "Replied", w: 30, color: "#7A6020" },
                { label: "Booked", w: 18, color: "#5A4510" },
                { label: "Won", w: 10, color: "#C9A84C" },
              ].map((b, i) => (
                <div key={i} className="flex-1 flex flex-col items-center gap-1">
                  <div className="w-full rounded-sm" style={{ height: `${Math.max(b.w * 0.6, 4)}px`, background: b.color, opacity: 0.7 }} />
                  <span style={{ fontSize: 8, color: "#444" }}>{b.label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Activity rows */}
          <div className="mx-6 p-4" style={{ border: "1px solid rgba(201,168,76,0.08)" }}>
            <p style={{ fontSize: 9, color: "#555", letterSpacing: "0.12em", marginBottom: 10 }}>RECENT ACTIVITY</p>
            {["Lead Engine scraped 73 leads from 12 cities", "Outreach sent 42 emails, 28 SMS", "Follow-Up Agent sent 6 second-touch messages", "Lead Scoring rated 100 new leads"].map((a, i) => (
              <div key={i} className="flex items-center gap-3 py-2" style={{ borderBottom: i < 3 ? "1px solid rgba(255,255,255,0.03)" : "none" }}>
                <div className="w-1 h-1 rounded-full" style={{ background: "#C9A84C" }} />
                <span style={{ fontSize: 11, color: "#888" }}>{a}</span>
                <span style={{ fontSize: 9, color: "#333", marginLeft: "auto" }}>{i === 0 ? "2m ago" : i === 1 ? "14m ago" : i === 2 ? "1h ago" : "3h ago"}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════
// STYLE 2: NEOBRUTALISM
// Anti-AI, hand-designed, bold blocks
// ═══════════════════════════════════════════════════

function NeoBrutalStyle({ expanded }: { expanded: boolean }) {
  return (
    <div className="h-full" style={{ background: "#FFFEF5", color: "#1A1A1A", fontFamily: "'Inter', system-ui, sans-serif" }}>
      {/* Top bar */}
      <div className="flex items-center justify-between px-5 py-3" style={{ background: "#1A1A1A", borderBottom: "3px solid #1A1A1A" }}>
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-sm" style={{ background: "#FACC15", border: "2px solid #1A1A1A" }} />
          <span style={{ fontWeight: 900, fontSize: 14, color: "#FFFEF5", letterSpacing: "-0.02em" }}>ShortStack OS</span>
        </div>
        <span style={{ fontSize: 10, color: "#888", fontWeight: 600 }}>FRI 11 APR</span>
      </div>

      {/* Greeting */}
      <div className="px-5 pt-5 pb-4">
        <p style={{ fontSize: 26, fontWeight: 900, color: "#1A1A1A", lineHeight: 1.1 }}>Hey Nicklas!</p>
        <p style={{ fontSize: 12, color: "#666", fontWeight: 500, marginTop: 4 }}>Here&apos;s what&apos;s happening today.</p>
      </div>

      {/* Stats — colored blocks with thick borders */}
      <div className="grid grid-cols-2 gap-3 px-5 mb-4">
        {[
          { label: "MRR", value: "$4,200", bg: "#FACC15", shadow: "#D4A90E" },
          { label: "Leads Today", value: "73", bg: "#A5F3FC", shadow: "#67CCD7" },
          { label: "Outreach", value: "142 sent", bg: "#FCA5A5", shadow: "#D47070" },
          { label: "Deals Won", value: "8", bg: "#BBF7D0", shadow: "#6DD89E" },
        ].map((s, i) => (
          <div key={i} className="p-4 relative" style={{
            background: s.bg,
            border: "3px solid #1A1A1A",
            borderRadius: 8,
            boxShadow: `4px 4px 0px #1A1A1A`,
          }}>
            <p style={{ fontSize: 10, fontWeight: 700, color: "#1A1A1A", textTransform: "uppercase", letterSpacing: "0.05em" }}>{s.label}</p>
            <p style={{ fontSize: 28, fontWeight: 900, color: "#1A1A1A", lineHeight: 1.1, marginTop: 2 }}>{s.value}</p>
          </div>
        ))}
      </div>

      {expanded && (
        <>
          {/* Quick actions — pill buttons */}
          <div className="flex flex-wrap gap-2 px-5 mb-4">
            {["Run Autopilot", "New Client", "Send Outreach", "Gen Content"].map((a, i) => (
              <button key={i} style={{
                background: i === 0 ? "#1A1A1A" : "#FFFEF5",
                color: i === 0 ? "#FACC15" : "#1A1A1A",
                border: "2px solid #1A1A1A",
                borderRadius: 999,
                padding: "6px 14px",
                fontSize: 11,
                fontWeight: 700,
                boxShadow: "2px 2px 0px #1A1A1A",
              }}>{a}</button>
            ))}
          </div>

          {/* Activity */}
          <div className="mx-5 p-4" style={{ border: "3px solid #1A1A1A", borderRadius: 8, background: "#FEF9C3" }}>
            <p style={{ fontSize: 12, fontWeight: 900, marginBottom: 8, textTransform: "uppercase" }}>Agent Feed</p>
            {["Scout found 73 new leads", "Echo sent 142 outreach messages", "Follow-up touched 6 cold leads", "Scoring rated 100 leads"].map((a, i) => (
              <div key={i} className="flex items-center gap-2 py-1.5" style={{ borderBottom: i < 3 ? "2px dashed #D4A90E" : "none" }}>
                <div className="w-2 h-2" style={{ background: "#1A1A1A", borderRadius: 2 }} />
                <span style={{ fontSize: 11, fontWeight: 600 }}>{a}</span>
              </div>
            ))}
          </div>

          {/* Pipeline */}
          <div className="mx-5 mt-4 p-4" style={{ border: "3px solid #1A1A1A", borderRadius: 8 }}>
            <p style={{ fontSize: 12, fontWeight: 900, marginBottom: 10, textTransform: "uppercase" }}>Pipeline</p>
            {[
              { label: "New", count: 234, pct: 100, color: "#3B82F6" },
              { label: "Contacted", count: 89, pct: 38, color: "#F59E0B" },
              { label: "Replied", count: 23, pct: 10, color: "#10B981" },
              { label: "Booked", count: 12, pct: 5, color: "#8B5CF6" },
            ].map((p, i) => (
              <div key={i} className="flex items-center gap-3 mb-2">
                <span style={{ fontSize: 10, fontWeight: 700, width: 70 }}>{p.label}</span>
                <div style={{ flex: 1, height: 14, background: "#F0F0E8", border: "2px solid #1A1A1A", borderRadius: 4, overflow: "hidden" }}>
                  <div style={{ width: `${p.pct}%`, height: "100%", background: p.color }} />
                </div>
                <span style={{ fontSize: 11, fontWeight: 800, width: 30, textAlign: "right" }}>{p.count}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════
// STYLE 3: BURNT ORANGE & SLATE
// Warm, distinctive, nobody else uses this
// ═══════════════════════════════════════════════════

function BurntOrangeStyle({ expanded }: { expanded: boolean }) {
  return (
    <div className="h-full" style={{ background: "#0F172A", color: "#E2E8F0", fontFamily: "'Inter', system-ui, sans-serif" }}>
      {/* Top bar */}
      <div className="flex items-center justify-between px-6 py-3" style={{ borderBottom: "1px solid rgba(234,88,12,0.15)" }}>
        <div className="flex items-center gap-3">
          <div className="w-6 h-6 rounded-lg" style={{ background: "linear-gradient(135deg, #EA580C, #C2410C)" }} />
          <span style={{ fontWeight: 700, fontSize: 13, color: "#F97316" }}>ShortStack</span>
        </div>
        <div style={{ fontSize: 10, color: "#475569" }}>Friday, April 11</div>
      </div>

      {/* Greeting */}
      <div className="px-6 pt-5 pb-4">
        <p style={{ fontSize: 22, fontWeight: 600, color: "#F1F5F9", letterSpacing: "-0.02em" }}>Good evening, <span style={{ color: "#F97316" }}>Nicklas</span></p>
        <p style={{ fontSize: 12, color: "#64748B", marginTop: 2 }}>All systems running smooth</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-3 px-6 mb-4">
        {[
          { label: "MRR", value: "$4,200", accent: true },
          { label: "Leads", value: "73" },
          { label: "Outreach", value: "142" },
          { label: "Won", value: "8", accent: true },
        ].map((s, i) => (
          <div key={i} className="p-3.5 rounded-xl" style={{
            background: s.accent ? "rgba(234,88,12,0.08)" : "rgba(30,41,59,0.8)",
            border: s.accent ? "1px solid rgba(234,88,12,0.2)" : "1px solid rgba(51,65,85,0.5)",
          }}>
            <p style={{ fontSize: 9, color: "#64748B", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>{s.label}</p>
            <p style={{ fontSize: 22, fontWeight: 700, fontFamily: "monospace", color: s.accent ? "#F97316" : "#E2E8F0" }}>{s.value}</p>
          </div>
        ))}
      </div>

      {expanded && (
        <>
          {/* Outreach bars */}
          <div className="mx-6 mb-4 p-4 rounded-xl" style={{ background: "rgba(30,41,59,0.6)", border: "1px solid rgba(51,65,85,0.4)" }}>
            <p style={{ fontSize: 11, fontWeight: 600, marginBottom: 12 }}>Today&apos;s Outreach</p>
            {[
              { label: "Email", sent: 42, target: 50, color: "#F97316" },
              { label: "SMS", sent: 28, target: 30, color: "#FB923C" },
              { label: "Calls", sent: 8, target: 10, color: "#FDBA74" },
              { label: "DMs", sent: 15, target: 20, color: "#EA580C" },
            ].map((ch, i) => (
              <div key={i} className="flex items-center gap-3 mb-2.5">
                <span style={{ fontSize: 10, color: "#94A3B8", width: 40 }}>{ch.label}</span>
                <div style={{ flex: 1, height: 6, background: "#1E293B", borderRadius: 3 }}>
                  <div style={{ width: `${(ch.sent / ch.target) * 100}%`, height: "100%", background: ch.color, borderRadius: 3 }} />
                </div>
                <span style={{ fontSize: 10, color: "#64748B", fontFamily: "monospace", width: 40, textAlign: "right" }}>{ch.sent}/{ch.target}</span>
              </div>
            ))}
          </div>

          {/* Clients */}
          <div className="mx-6 p-4 rounded-xl" style={{ background: "rgba(30,41,59,0.6)", border: "1px solid rgba(51,65,85,0.4)" }}>
            <p style={{ fontSize: 11, fontWeight: 600, marginBottom: 10 }}>Top Clients</p>
            {["Bright Smiles Dental — $800/mo", "Urban Cuts Barbershop — $600/mo", "Peak Fitness Gym — $500/mo"].map((c, i) => (
              <div key={i} className="flex items-center justify-between py-2" style={{ borderBottom: i < 2 ? "1px solid rgba(51,65,85,0.3)" : "none" }}>
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: "rgba(234,88,12,0.1)", fontSize: 10, fontWeight: 700, color: "#F97316" }}>
                    {c.charAt(0)}
                  </div>
                  <span style={{ fontSize: 11 }}>{c.split(" — ")[0]}</span>
                </div>
                <span style={{ fontSize: 11, fontFamily: "monospace", color: "#F97316" }}>{c.split(" — ")[1]}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════
// STYLE 4: NORDIC MINIMAL
// Scandinavian calm, muted tones, generous spacing
// ═══════════════════════════════════════════════════

function NordicStyle({ expanded }: { expanded: boolean }) {
  return (
    <div className="h-full" style={{ background: "#FAFAF7", color: "#1A1A1A", fontFamily: "'Inter', system-ui, sans-serif" }}>
      {/* Top bar */}
      <div className="flex items-center justify-between px-7 py-4" style={{ borderBottom: "1px solid #ECECEA" }}>
        <div className="flex items-center gap-2.5">
          <div className="w-5 h-5 rounded-full" style={{ background: "#1A1A1A" }} />
          <span style={{ fontWeight: 600, fontSize: 13, color: "#1A1A1A", letterSpacing: "-0.01em" }}>ShortStack</span>
        </div>
        <span style={{ fontSize: 10, color: "#A3A3A3" }}>Friday, April 11</span>
      </div>

      {/* Greeting — lots of breathing room */}
      <div className="px-7 pt-8 pb-5">
        <p style={{ fontSize: 14, color: "#A3A3A3", fontWeight: 400 }}>Good evening</p>
        <p style={{ fontSize: 28, fontWeight: 500, color: "#1A1A1A", letterSpacing: "-0.03em", marginTop: 2 }}>Nicklas</p>
      </div>

      {/* Stats — soft cards, muted */}
      <div className="grid grid-cols-4 gap-4 px-7 mb-6">
        {[
          { label: "Revenue", value: "$4,200", sub: "monthly" },
          { label: "Leads", value: "73", sub: "today" },
          { label: "Sent", value: "142", sub: "outreach" },
          { label: "Won", value: "8", sub: "deals" },
        ].map((s, i) => (
          <div key={i} className="p-4 rounded-2xl" style={{ background: "#F5F5F0", border: "1px solid #ECECEA" }}>
            <p style={{ fontSize: 10, color: "#A3A3A3", marginBottom: 8 }}>{s.label}</p>
            <p style={{ fontSize: 24, fontWeight: 600, color: "#1A1A1A", fontFamily: "monospace", lineHeight: 1 }}>{s.value}</p>
            <p style={{ fontSize: 9, color: "#C4C4C0", marginTop: 4 }}>{s.sub}</p>
          </div>
        ))}
      </div>

      {expanded && (
        <>
          {/* Pipeline — thin elegant bars */}
          <div className="mx-7 mb-6 p-5 rounded-2xl" style={{ background: "#F5F5F0", border: "1px solid #ECECEA" }}>
            <p style={{ fontSize: 11, fontWeight: 500, color: "#1A1A1A", marginBottom: 14 }}>Pipeline</p>
            {[
              { label: "New", pct: 100, color: "#1A1A1A" },
              { label: "Contacted", pct: 38, color: "#525252" },
              { label: "Replied", pct: 10, color: "#737373" },
              { label: "Booked", pct: 5, color: "#A3A3A3" },
            ].map((p, i) => (
              <div key={i} className="flex items-center gap-4 mb-3">
                <span style={{ fontSize: 10, color: "#737373", width: 60 }}>{p.label}</span>
                <div style={{ flex: 1, height: 3, background: "#E5E5E0", borderRadius: 2 }}>
                  <div style={{ width: `${p.pct}%`, height: "100%", background: p.color, borderRadius: 2 }} />
                </div>
              </div>
            ))}
          </div>

          {/* Activity — minimal list */}
          <div className="mx-7 p-5 rounded-2xl" style={{ background: "#F5F5F0", border: "1px solid #ECECEA" }}>
            <p style={{ fontSize: 11, fontWeight: 500, color: "#1A1A1A", marginBottom: 12 }}>Today</p>
            {[
              { text: "73 leads scraped across 12 cities", time: "2m" },
              { text: "142 outreach messages sent", time: "14m" },
              { text: "6 follow-up touches delivered", time: "1h" },
              { text: "100 leads scored and prioritized", time: "3h" },
            ].map((a, i) => (
              <div key={i} className="flex items-center justify-between py-2.5" style={{ borderBottom: i < 3 ? "1px solid #ECECEA" : "none" }}>
                <span style={{ fontSize: 11, color: "#525252" }}>{a.text}</span>
                <span style={{ fontSize: 9, color: "#C4C4C0" }}>{a.time}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
