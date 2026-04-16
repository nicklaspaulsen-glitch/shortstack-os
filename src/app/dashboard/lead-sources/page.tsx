"use client";

import { useState } from "react";
import {
  TrendingUp, TrendingDown, DollarSign, BarChart3, Plus,
  Search, Star,
  Activity
} from "lucide-react";

interface LeadSource {
  id: string;
  name: string;
  icon: React.ReactNode;
  color: string;
  count: number;
  converted: number;
  costPerLead: number;
  roi: number;
  quality: number;
  trend: "up" | "down" | "flat";
  trendPct: number;
  status: "active" | "inactive";
  lastLead: string;
}

const MOCK_SOURCES: LeadSource[] = [];

const UTM_DATA = [
  { source: "google", medium: "cpc", campaign: "dental-leads-miami", leads: 82, converted: 14 },
  { source: "facebook", medium: "social", campaign: "retarget-spring-2026", leads: 45, converted: 6 },
  { source: "instagram", medium: "social", campaign: "dm-outreach-q2", leads: 38, converted: 5 },
  { source: "email", medium: "newsletter", campaign: "april-promo", leads: 24, converted: 8 },
  { source: "linkedin", medium: "social", campaign: "b2b-outreach", leads: 18, converted: 3 },
  { source: "tiktok", medium: "social", campaign: "viral-hooks", leads: 12, converted: 1 },
];

const DECAY_DATA = [
  { month: "Nov", value: 100 },
  { month: "Dec", value: 92 },
  { month: "Jan", value: 85 },
  { month: "Feb", value: 78 },
  { month: "Mar", value: 88 },
  { month: "Apr", value: 95 },
];

const TABS = ["Overview", "Attribution", "ROI", "UTM Tracker", "Trending", "Decay Analysis", "Custom Sources"] as const;
type Tab = typeof TABS[number];

export default function LeadSourcesPage() {
  const [tab, setTab] = useState<Tab>("Overview");
  const [sources] = useState(MOCK_SOURCES);
  const [sortBy, setSortBy] = useState<"count" | "converted" | "quality" | "roi">("count");
  const [customName, setCustomName] = useState("");
  const [customType, setCustomType] = useState("organic");

  const totalLeads = sources.reduce((s, c) => s + c.count, 0);
  const totalConverted = sources.reduce((s, c) => s + c.converted, 0);
  const avgQuality = sources.length > 0 ? Math.round(sources.reduce((s, c) => s + c.quality, 0) / sources.length) : 0;
  const overallConvRate = totalLeads > 0 ? ((totalConverted / totalLeads) * 100).toFixed(1) : "0";

  const sorted = [...sources].sort((a, b) => {
    if (sortBy === "count") return b.count - a.count;
    if (sortBy === "converted") return b.converted - a.converted;
    if (sortBy === "quality") return b.quality - a.quality;
    return b.roi - a.roi;
  });

  return (
    <div className="fade-in space-y-5">
      <div>
        <h1 className="page-header mb-0 flex items-center gap-2">
          <BarChart3 size={18} className="text-gold" /> Lead Sources
        </h1>
        <p className="text-xs text-muted mt-0.5">{totalLeads} total leads &middot; {totalConverted} converted &middot; {overallConvRate}% conversion rate</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-2.5">
        <div className="card p-3 text-center">
          <p className="text-[9px] text-muted uppercase">Total Leads</p>
          <p className="text-xl font-bold text-gold">{totalLeads.toLocaleString()}</p>
        </div>
        <div className="card p-3 text-center">
          <p className="text-[9px] text-muted uppercase">Converted</p>
          <p className="text-xl font-bold text-emerald-400">{totalConverted}</p>
        </div>
        <div className="card p-3 text-center">
          <p className="text-[9px] text-muted uppercase">Conv Rate</p>
          <p className="text-xl font-bold text-blue-400">{overallConvRate}%</p>
        </div>
        <div className="card p-3 text-center">
          <p className="text-[9px] text-muted uppercase">Avg Quality</p>
          <p className="text-xl font-bold text-foreground">{avgQuality}/100</p>
        </div>
        <div className="card p-3 text-center">
          <p className="text-[9px] text-muted uppercase">Active Sources</p>
          <p className="text-xl font-bold text-gold">{sources.filter(s => s.status === "active").length}</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 overflow-x-auto">
        {TABS.map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-3 py-1.5 rounded-lg text-[10px] font-medium whitespace-nowrap transition-all ${
              tab === t ? "bg-gold/15 text-gold border border-gold/20" : "text-muted border border-transparent hover:text-foreground"
            }`}>{t}</button>
        ))}
      </div>

      {/* ═══ OVERVIEW TAB ═══ */}
      {tab === "Overview" && (
        <div className="space-y-4">
          {/* Chart */}
          <div className="card">
            <h3 className="text-xs font-bold mb-3">Source Attribution</h3>
            <div className="flex items-end gap-2 h-36">
              {sorted.map(s => {
                const pct = totalLeads > 0 ? (s.count / totalLeads) * 100 : 0;
                return (
                  <div key={s.id} className="flex-1 flex flex-col items-center gap-1">
                    <span className="text-[8px] font-mono font-bold">{Math.round(pct)}%</span>
                    <div className="w-full rounded-t transition-all" style={{ height: `${pct * 2.5}%`, backgroundColor: s.color, opacity: 0.7 }} />
                    <span className="text-[7px] text-muted text-center truncate w-full">{s.name}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Sort Controls */}
          <div className="flex gap-1">
            {(["count", "converted", "quality", "roi"] as const).map(s => (
              <button key={s} onClick={() => setSortBy(s)}
                className={`text-[9px] px-2 py-1 rounded capitalize ${sortBy === s ? "bg-gold/15 text-gold" : "text-muted"}`}>
                {s === "count" ? "Volume" : s === "roi" ? "ROI" : s}
              </button>
            ))}
          </div>

          {/* Source List */}
          <div className="space-y-2">
            {sorted.map(s => {
              const pct = totalLeads > 0 ? Math.round((s.count / totalLeads) * 100) : 0;
              const convRate = s.count > 0 ? ((s.converted / s.count) * 100).toFixed(1) : "0";
              return (
                <div key={s.id} className={`flex items-center gap-3 p-3 rounded-xl border ${s.status === "active" ? "bg-surface-light border-border" : "bg-surface border-border/50 opacity-50"}`}>
                  <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0" style={{ background: `${s.color}15`, color: s.color }}>
                    {s.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="text-xs font-semibold">{s.name}</p>
                      <span className={`text-[8px] flex items-center gap-0.5 ${s.trend === "up" ? "text-emerald-400" : s.trend === "down" ? "text-red-400" : "text-muted"}`}>
                        {s.trend === "up" ? <TrendingUp size={8} /> : s.trend === "down" ? <TrendingDown size={8} /> : null}
                        {s.trendPct !== 0 && `${s.trendPct > 0 ? "+" : ""}${s.trendPct}%`}
                      </span>
                    </div>
                    <div className="w-full h-1.5 rounded-full bg-surface">
                      <div className="h-1.5 rounded-full transition-all" style={{ width: `${pct}%`, background: s.color }} />
                    </div>
                  </div>
                  <div className="grid grid-cols-4 gap-3 text-center shrink-0">
                    <div>
                      <p className="text-xs font-mono font-bold" style={{ color: s.color }}>{s.count}</p>
                      <p className="text-[8px] text-muted">Leads</p>
                    </div>
                    <div>
                      <p className="text-xs font-mono font-bold text-emerald-400">{convRate}%</p>
                      <p className="text-[8px] text-muted">Conv</p>
                    </div>
                    <div>
                      <p className="text-xs font-mono font-bold">{s.quality}</p>
                      <p className="text-[8px] text-muted">Quality</p>
                    </div>
                    <div>
                      <div className="w-8 h-8 rounded-full flex items-center justify-center mx-auto" style={{ background: `${s.color}15` }}>
                        <Star size={10} style={{ color: s.color }} className={s.quality >= 80 ? "fill-current" : ""} />
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ═══ ATTRIBUTION TAB ═══ */}
      {tab === "Attribution" && (
        <div className="space-y-4">
          <div className="card">
            <h3 className="text-xs font-bold mb-3">Channel Performance Comparison</h3>
            <div className="space-y-2">
              {sorted.slice(0, 6).map(s => {
                const convRate = s.count > 0 ? (s.converted / s.count) * 100 : 0;
                return (
                  <div key={s.id} className="grid grid-cols-6 gap-2 text-[10px] items-center py-2 border-b border-border last:border-0">
                    <span className="font-medium col-span-2 flex items-center gap-1.5" style={{ color: s.color }}>{s.icon} {s.name}</span>
                    <span className="text-center font-mono">{s.count}</span>
                    <span className="text-center font-mono">{convRate.toFixed(1)}%</span>
                    <span className="text-center font-mono">{s.costPerLead > 0 ? `$${s.costPerLead.toFixed(2)}` : "Free"}</span>
                    <span className="text-center font-mono">{s.quality}/100</span>
                  </div>
                );
              })}
              <div className="grid grid-cols-6 gap-2 text-[8px] text-muted uppercase pt-1">
                <span className="col-span-2">Source</span>
                <span className="text-center">Leads</span>
                <span className="text-center">Conv %</span>
                <span className="text-center">CPL</span>
                <span className="text-center">Quality</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ═══ ROI TAB ═══ */}
      {tab === "ROI" && (
        <div className="space-y-4">
          <div className="card">
            <h3 className="text-xs font-bold flex items-center gap-2 mb-3"><DollarSign size={12} className="text-gold" /> ROI by Channel</h3>
            <div className="space-y-2">
              {sources.filter(s => s.roi > 0).sort((a, b) => b.roi - a.roi).map(s => (
                <div key={s.id} className="flex items-center gap-3 p-2.5 rounded-lg bg-surface-light border border-border">
                  <span className="text-[10px] w-28 shrink-0 font-medium">{s.name}</span>
                  <div className="flex-1 h-2.5 rounded-full bg-surface">
                    <div className="h-2.5 rounded-full bg-emerald-400 transition-all" style={{ width: `${Math.min(s.roi / 5, 100)}%` }} />
                  </div>
                  <span className="text-xs font-mono font-bold text-emerald-400 w-16 text-right">{s.roi}%</span>
                  <span className="text-[9px] text-muted w-20 text-right">${s.costPerLead}/lead</span>
                </div>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="card p-3 text-center border-emerald-500/10">
              <p className="text-[9px] text-muted uppercase">Best ROI</p>
              <p className="text-sm font-bold text-emerald-400">Paid Ads</p>
              <p className="text-[10px] text-emerald-400">410% ROI</p>
            </div>
            <div className="card p-3 text-center border-gold/10">
              <p className="text-[9px] text-muted uppercase">Lowest CPL</p>
              <p className="text-sm font-bold text-gold">Google Maps</p>
              <p className="text-[10px] text-gold">$0.00</p>
            </div>
            <div className="card p-3 text-center border-blue-500/10">
              <p className="text-[9px] text-muted uppercase">Best Quality</p>
              <p className="text-sm font-bold text-blue-400">Referral</p>
              <p className="text-[10px] text-blue-400">95/100</p>
            </div>
          </div>
        </div>
      )}

      {/* ═══ UTM TRACKER TAB ═══ */}
      {tab === "UTM Tracker" && (
        <div className="card">
          <h3 className="text-xs font-bold flex items-center gap-2 mb-3"><Search size={12} className="text-gold" /> UTM Parameter Tracking</h3>
          <div className="overflow-x-auto">
            <div className="space-y-1.5">
              <div className="grid grid-cols-5 gap-2 text-[8px] text-muted uppercase py-1 border-b border-border">
                <span>Source</span><span>Medium</span><span>Campaign</span><span className="text-center">Leads</span><span className="text-center">Converted</span>
              </div>
              {UTM_DATA.map((u, i) => (
                <div key={i} className="grid grid-cols-5 gap-2 text-[10px] py-2 border-b border-border last:border-0 items-center">
                  <span className="font-medium">{u.source}</span>
                  <span className="text-muted">{u.medium}</span>
                  <span className="text-gold font-mono text-[9px]">{u.campaign}</span>
                  <span className="text-center font-mono">{u.leads}</span>
                  <span className="text-center font-mono text-emerald-400">{u.converted}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ═══ TRENDING TAB ═══ */}
      {tab === "Trending" && (
        <div className="space-y-4">
          <div className="card">
            <h3 className="text-xs font-bold flex items-center gap-2 mb-3"><TrendingUp size={12} className="text-gold" /> Trending Sources</h3>
            <div className="space-y-2">
              {sources.filter(s => s.trend === "up").sort((a, b) => b.trendPct - a.trendPct).map(s => (
                <div key={s.id} className="flex items-center gap-3 p-2.5 rounded-lg bg-emerald-500/5 border border-emerald-500/10">
                  <TrendingUp size={12} className="text-emerald-400" />
                  <span className="text-xs font-medium flex-1">{s.name}</span>
                  <span className="text-xs font-mono text-emerald-400">+{s.trendPct}%</span>
                  <span className="text-[9px] text-muted">{s.count} leads</span>
                </div>
              ))}
            </div>
          </div>
          <div className="card">
            <h3 className="text-xs font-bold flex items-center gap-2 mb-3 text-red-400"><TrendingDown size={12} /> Declining Sources</h3>
            <div className="space-y-2">
              {sources.filter(s => s.trend === "down").map(s => (
                <div key={s.id} className="flex items-center gap-3 p-2.5 rounded-lg bg-red-500/5 border border-red-500/10">
                  <TrendingDown size={12} className="text-red-400" />
                  <span className="text-xs font-medium flex-1">{s.name}</span>
                  <span className="text-xs font-mono text-red-400">{s.trendPct}%</span>
                  <span className="text-[9px] text-muted">{s.count} leads</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ═══ DECAY ANALYSIS TAB ═══ */}
      {tab === "Decay Analysis" && (
        <div className="card">
          <h3 className="text-xs font-bold flex items-center gap-2 mb-3"><Activity size={12} className="text-gold" /> Source Decay Analysis</h3>
          <p className="text-[10px] text-muted mb-3">How lead quality changes over time for each source. Higher = better retention.</p>
          <div className="flex items-end gap-2 h-32 mb-2">
            {DECAY_DATA.map((d, i) => (
              <div key={i} className="flex-1 flex flex-col items-center gap-1">
                <span className="text-[8px] font-mono">{d.value}%</span>
                <div className={`w-full rounded-t ${d.value >= 90 ? "bg-emerald-400/60" : d.value >= 80 ? "bg-gold/60" : "bg-amber-400/60"}`}
                  style={{ height: `${d.value}%` }} />
                <span className="text-[8px] text-muted">{d.month}</span>
              </div>
            ))}
          </div>
          <p className="text-[9px] text-muted">Lead quality from cold outreach sources decays fastest. Referrals and organic maintain quality over 6+ months.</p>
        </div>
      )}

      {/* ═══ CUSTOM SOURCES TAB ═══ */}
      {tab === "Custom Sources" && (
        <div className="card">
          <h3 className="text-xs font-bold flex items-center gap-2 mb-3"><Plus size={12} className="text-gold" /> Create Custom Source</h3>
          <div className="space-y-3">
            <div>
              <label className="text-[9px] text-muted uppercase mb-1 block">Source Name</label>
              <input value={customName} onChange={e => setCustomName(e.target.value)}
                className="input w-full text-xs" placeholder="e.g. Podcast Leads" />
            </div>
            <div>
              <label className="text-[9px] text-muted uppercase mb-1 block">Source Type</label>
              <select value={customType} onChange={e => setCustomType(e.target.value)} className="input w-full text-xs">
                <option value="organic">Organic</option>
                <option value="paid">Paid</option>
                <option value="referral">Referral</option>
                <option value="partner">Partner</option>
                <option value="event">Event</option>
              </select>
            </div>
            <button disabled={!customName} className="btn-primary text-xs flex items-center gap-1.5 disabled:opacity-40">
              <Plus size={12} /> Create Source
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
