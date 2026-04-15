"use client";

import { useState } from "react";
import {
  Zap, MessageSquare, Search, Phone, Mail, Star,
  TrendingUp, Users, Target, ArrowDownRight,
  CheckCircle, AlertTriangle, Tag, Upload, Download, Flame,
  Clock, UserPlus, BarChart3,
  RefreshCw, Bell, Layers, GitBranch
} from "lucide-react";

type MainTab = "leads" | "scoring" | "routing" | "attribution" | "nurture" | "enrichment" | "funnel" | "tags";

interface MockLead {
  id: string;
  business_name: string;
  phone: string;
  email: string;
  industry: string;
  city: string;
  source: string;
  status: string;
  score: number;
  tags: string[];
  lastActivity: string;
  website: string;
  rating: number;
  reviews: number;
  assigned: string;
  engagements: number;
}

const MOCK_LEADS: MockLead[] = [];

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const SOURCES = ["Google Maps", "Instagram DM", "Cold Call", "Website Form", "Facebook", "Referral", "TikTok", "LinkedIn", "Cold Email"];

export default function LeadEnginePage() {
  const [activeTab, setActiveTab] = useState<MainTab>("leads");
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [industryFilter, setIndustryFilter] = useState("");
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [selectedLead, setSelectedLead] = useState<string | null>(null);
  const [tagInput, setTagInput] = useState("");
  const [hotAlerts, setHotAlerts] = useState(true);
  const [expandedLead, setExpandedLead] = useState<string | null>(null);

  const filteredLeads = MOCK_LEADS.filter(l =>
    (!searchQuery || l.business_name.toLowerCase().includes(searchQuery.toLowerCase()) || l.email.toLowerCase().includes(searchQuery.toLowerCase())) &&
    (!statusFilter || l.status === statusFilter) &&
    (!industryFilter || l.industry === industryFilter)
  );

  const industries = Array.from(new Set(MOCK_LEADS.map(l => l.industry)));
  const totalLeads = MOCK_LEADS.length;
  const hotLeads = MOCK_LEADS.filter(l => l.score >= 80).length;
  const qualifiedLeads = MOCK_LEADS.filter(l => l.status === "qualified" || l.status === "booked").length;
  const convertedLeads = MOCK_LEADS.filter(l => l.status === "converted").length;

  const TABS: { key: MainTab; label: string; icon: React.ReactNode }[] = [
    { key: "leads", label: "All Leads", icon: <Users size={14} /> },
    { key: "scoring", label: "Lead Scoring", icon: <Target size={14} /> },
    { key: "routing", label: "Smart Routing", icon: <GitBranch size={14} /> },
    { key: "attribution", label: "Source Attribution", icon: <BarChart3 size={14} /> },
    { key: "nurture", label: "Nurture Sequences", icon: <Mail size={14} /> },
    { key: "enrichment", label: "Enrichment", icon: <Zap size={14} /> },
    { key: "funnel", label: "Conversion Funnel", icon: <TrendingUp size={14} /> },
    { key: "tags", label: "Tags & Alerts", icon: <Tag size={14} /> },
  ];

  return (
    <div className="fade-in space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-header mb-0 flex items-center gap-3">
            <div className="w-10 h-10 bg-gold/10 rounded-xl flex items-center justify-center">
              <Zap size={24} className="text-gold" />
            </div>
            Lead Engine
          </h1>
          <p className="text-muted text-sm">Automated lead scoring, routing, enrichment & nurture</p>
        </div>
        <div className="flex gap-2">
          <button className="btn-secondary text-xs flex items-center gap-1.5"><Upload size={12} /> Import CSV</button>
          <button className="btn-secondary text-xs flex items-center gap-1.5"><Download size={12} /> Export</button>
          <button className="btn-primary text-xs flex items-center gap-1.5"><UserPlus size={12} /> Add Lead</button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
        {[
          { label: "Total Leads", value: totalLeads, icon: <Users size={12} />, color: "text-gold" },
          { label: "Hot Leads", value: hotLeads, icon: <Flame size={12} />, color: "text-red-400" },
          { label: "Qualified", value: qualifiedLeads, icon: <CheckCircle size={12} />, color: "text-green-400" },
          { label: "Converted", value: convertedLeads, icon: <Star size={12} />, color: "text-purple-400" },
          { label: "Avg Score", value: totalLeads > 0 ? Math.round(MOCK_LEADS.reduce((s, l) => s + l.score, 0) / totalLeads) : 0, icon: <Target size={12} />, color: "text-blue-400" },
          { label: "Conv Rate", value: `${totalLeads > 0 ? Math.round((convertedLeads / totalLeads) * 100) : 0}%`, icon: <TrendingUp size={12} />, color: "text-gold" },
        ].map((stat, i) => (
          <div key={i} className="card text-center p-3">
            <div className={`w-7 h-7 rounded-lg mx-auto mb-1.5 flex items-center justify-center bg-white/5 ${stat.color}`}>{stat.icon}</div>
            <p className="text-lg font-bold">{stat.value}</p>
            <p className="text-[9px] text-muted">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-surface rounded-lg p-1 overflow-x-auto">
        {TABS.map(t => (
          <button key={t.key} onClick={() => setActiveTab(t.key)}
            className={`px-4 py-2 text-xs rounded-md flex items-center gap-2 whitespace-nowrap transition-all ${
              activeTab === t.key ? "bg-gold text-black font-medium" : "text-muted hover:text-foreground"
            }`}>{t.icon} {t.label}</button>
        ))}
      </div>

      {/* ===== ALL LEADS TAB ===== */}
      {activeTab === "leads" && (
        <div className="space-y-4">
          {/* Filters */}
          <div className="flex flex-wrap gap-3">
            <div className="relative flex-1 min-w-[200px]">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
              <input type="text" placeholder="Search leads..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="input w-full pl-9 text-xs" />
            </div>
            <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="input text-xs">
              <option value="">All Statuses</option>
              <option value="new">New</option>
              <option value="contacted">Contacted</option>
              <option value="qualified">Qualified</option>
              <option value="booked">Booked</option>
              <option value="converted">Converted</option>
            </select>
            <select value={industryFilter} onChange={e => setIndustryFilter(e.target.value)} className="input text-xs">
              <option value="">All Industries</option>
              {industries.map(i => <option key={i} value={i}>{i}</option>)}
            </select>
          </div>

          {/* Lead Table */}
          <div className="space-y-1.5">
            <div className="grid grid-cols-12 text-[9px] text-muted uppercase tracking-wider font-semibold py-2 px-3">
              <span className="col-span-3">Business</span>
              <span className="col-span-2">Contact</span>
              <span>Source</span>
              <span className="text-center">Score</span>
              <span>Status</span>
              <span className="text-center">Rating</span>
              <span>Tags</span>
              <span>Activity</span>
              <span className="text-center">Actions</span>
            </div>
            {filteredLeads.length === 0 && (
              <div className="text-center py-12 text-muted text-xs">No leads yet. Add or import leads to get started.</div>
            )}
            {filteredLeads.map(lead => (
              <div key={lead.id}>
                <div onClick={() => setExpandedLead(expandedLead === lead.id ? null : lead.id)}
                  className="grid grid-cols-12 items-center py-2.5 px-3 rounded-lg bg-surface-light border border-border hover:border-gold/10 transition-all cursor-pointer text-[10px]">
                  <div className="col-span-3">
                    <p className="text-xs font-semibold">{lead.business_name}</p>
                    <p className="text-[9px] text-muted">{lead.industry} | {lead.city}</p>
                  </div>
                  <div className="col-span-2">
                    <p className="text-muted flex items-center gap-1"><Mail size={9} /> {lead.email}</p>
                    <p className="text-muted flex items-center gap-1"><Phone size={9} /> {lead.phone}</p>
                  </div>
                  <span className="text-muted">{lead.source}</span>
                  <div className="text-center">
                    <span className={`font-bold ${lead.score >= 80 ? "text-green-400" : lead.score >= 50 ? "text-yellow-400" : "text-red-400"}`}>{lead.score}</span>
                  </div>
                  <span className={`text-[9px] px-1.5 py-0.5 rounded-full w-fit ${
                    lead.status === "converted" ? "bg-purple-400/10 text-purple-400" :
                    lead.status === "booked" ? "bg-green-400/10 text-green-400" :
                    lead.status === "qualified" ? "bg-blue-400/10 text-blue-400" :
                    lead.status === "contacted" ? "bg-yellow-400/10 text-yellow-400" :
                    "bg-white/5 text-muted"
                  }`}>{lead.status}</span>
                  <div className="text-center flex items-center justify-center gap-0.5">
                    <Star size={9} className="text-gold" />
                    <span>{lead.rating}</span>
                    <span className="text-muted">({lead.reviews})</span>
                  </div>
                  <div className="flex gap-0.5 flex-wrap">
                    {lead.tags.slice(0, 2).map(tag => (
                      <span key={tag} className="text-[8px] px-1 py-0.5 rounded bg-gold/10 text-gold">{tag}</span>
                    ))}
                  </div>
                  <span className="text-muted">{lead.lastActivity}</span>
                  <div className="flex items-center justify-center gap-1">
                    <button className="p-1 rounded hover:bg-white/5 text-muted hover:text-gold"><Phone size={10} /></button>
                    <button className="p-1 rounded hover:bg-white/5 text-muted hover:text-gold"><Mail size={10} /></button>
                    <button className="p-1 rounded hover:bg-white/5 text-muted hover:text-gold"><MessageSquare size={10} /></button>
                  </div>
                </div>
                {/* Engagement Timeline */}
                {expandedLead === lead.id && (
                  <div className="ml-4 mt-2 mb-3 p-3 rounded-lg bg-surface border border-border">
                    <h4 className="text-[10px] font-semibold mb-2 flex items-center gap-1.5"><Clock size={10} /> Engagement Timeline</h4>
                    <div className="text-center py-4 text-muted text-[9px]">No engagement data yet.</div>
                    {/* Qualification Checklist */}
                    <div className="mt-3 pt-3 border-t border-border">
                      <h4 className="text-[10px] font-semibold mb-2 flex items-center gap-1.5"><CheckCircle size={10} /> Qualification Checklist</h4>
                      <div className="grid grid-cols-2 gap-1">
                        {[
                          { item: "Has phone number", check: !!lead.phone },
                          { item: "Has email", check: !!lead.email },
                          { item: "Website found", check: !!lead.website },
                          { item: "Rating 4.0+", check: lead.rating >= 4.0 },
                          { item: "Engaged (opened/clicked)", check: lead.engagements >= 3 },
                          { item: "Decision maker identified", check: lead.tags.includes("decision-maker") },
                        ].map((q, i) => (
                          <div key={i} className="flex items-center gap-1.5 text-[9px]">
                            {q.check ? <CheckCircle size={9} className="text-green-400" /> : <div className="w-2.5 h-2.5 rounded border border-muted" />}
                            <span className={q.check ? "" : "text-muted"}>{q.item}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Duplicate Detection */}
          <div className="card">
            <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
              <Layers size={14} className="text-yellow-400" /> Duplicate Detection
            </h3>
            <div className="text-center py-8 text-muted text-xs">No duplicates detected.</div>
          </div>
        </div>
      )}

      {/* ===== LEAD SCORING MATRIX ===== */}
      {activeTab === "scoring" && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Scoring Rules */}
            <div className="card">
              <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                <Target size={14} className="text-gold" /> Scoring Matrix
              </h3>
              <div className="space-y-1.5">
                {[
                  { factor: "Has phone number", points: "+15", category: "Data" },
                  { factor: "Has email", points: "+10", category: "Data" },
                  { factor: "Google rating 4.5+", points: "+20", category: "Quality" },
                  { factor: "50+ reviews", points: "+15", category: "Quality" },
                  { factor: "Opened email", points: "+10", category: "Engagement" },
                  { factor: "Clicked link", points: "+15", category: "Engagement" },
                  { factor: "Replied to DM", points: "+25", category: "Engagement" },
                  { factor: "Visited website", points: "+5", category: "Engagement" },
                  { factor: "Booked call", points: "+30", category: "Intent" },
                  { factor: "No response 7d", points: "-10", category: "Decay" },
                  { factor: "Bounced email", points: "-20", category: "Data" },
                  { factor: "Unsubscribed", points: "-50", category: "Disqualify" },
                ].map((r, i) => (
                  <div key={i} className="flex items-center justify-between p-2 rounded bg-surface-light text-[10px]">
                    <div className="flex items-center gap-2">
                      <span className="text-[8px] px-1.5 py-0.5 rounded bg-white/5 text-muted">{r.category}</span>
                      <span>{r.factor}</span>
                    </div>
                    <span className={`font-bold ${r.points.startsWith("+") ? "text-green-400" : "text-red-400"}`}>{r.points}</span>
                  </div>
                ))}
              </div>
            </div>
            {/* Score Distribution */}
            <div className="card">
              <h3 className="text-sm font-semibold mb-3">Score Distribution</h3>
              <div className="space-y-3">
                {[
                  { range: "90-100 (Hot)", count: 0, pct: 0, color: "bg-red-400" },
                  { range: "70-89 (Warm)", count: 0, pct: 0, color: "bg-orange-400" },
                  { range: "50-69 (Lukewarm)", count: 0, pct: 0, color: "bg-yellow-400" },
                  { range: "0-49 (Cold)", count: 0, pct: 0, color: "bg-blue-400" },
                ].map((d, i) => (
                  <div key={i}>
                    <div className="flex justify-between text-[10px] mb-1">
                      <span>{d.range}</span>
                      <span className="text-muted">{d.count} leads ({d.pct}%)</span>
                    </div>
                    <div className="w-full bg-surface-light rounded-full h-2">
                      <div className={`${d.color} rounded-full h-2`} style={{ width: `${d.pct}%` }} />
                    </div>
                  </div>
                ))}
              </div>
              {/* Hot Lead Alerts */}
              <div className="mt-4 pt-4 border-t border-border">
                <h4 className="text-xs font-semibold mb-2 flex items-center gap-2">
                  <Bell size={12} className="text-red-400" /> Hot Lead Alerts
                </h4>
                <div className="space-y-1.5">
                  {MOCK_LEADS.filter(l => l.score >= 80).map(lead => (
                    <div key={lead.id} className="flex items-center justify-between p-2 rounded bg-red-400/5 border border-red-400/10 text-[10px]">
                      <div className="flex items-center gap-2">
                        <Flame size={10} className="text-red-400" />
                        <span className="font-semibold">{lead.business_name}</span>
                        <span className="text-muted">Score: {lead.score}</span>
                      </div>
                      <button className="text-[9px] px-2 py-0.5 rounded bg-gold/10 text-gold">Contact Now</button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ===== SMART ROUTING ===== */}
      {activeTab === "routing" && (
        <div className="space-y-4">
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <GitBranch size={14} className="text-gold" /> Smart Lead Routing Rules
          </h3>
          <div className="space-y-2">
            {[
              { condition: "Score >= 80", action: "Assign to Nicklas (Closer)", priority: "High", active: true },
              { condition: "Industry = Dental", action: "Route to Dental specialist queue", priority: "Medium", active: true },
              { condition: "Source = Referral", action: "Priority queue + auto-call within 1hr", priority: "High", active: true },
              { condition: "City = Miami", action: "Assign to local rep", priority: "Low", active: false },
              { condition: "No phone number", action: "Route to email nurture sequence", priority: "Medium", active: true },
              { condition: "Score < 30", action: "Add to cold storage (revisit in 30d)", priority: "Low", active: true },
            ].map((rule, i) => (
              <div key={i} className={`card p-4 flex items-center justify-between ${!rule.active ? "opacity-50" : ""}`}>
                <div className="flex items-center gap-3">
                  <div className={`w-2 h-2 rounded-full ${rule.priority === "High" ? "bg-red-400" : rule.priority === "Medium" ? "bg-yellow-400" : "bg-blue-400"}`} />
                  <div>
                    <p className="text-xs font-semibold">If: {rule.condition}</p>
                    <p className="text-[10px] text-muted">Then: {rule.action}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-[8px] px-1.5 py-0.5 rounded ${
                    rule.priority === "High" ? "bg-red-400/10 text-red-400" : rule.priority === "Medium" ? "bg-yellow-400/10 text-yellow-400" : "bg-blue-400/10 text-blue-400"
                  }`}>{rule.priority}</span>
                  <div className={`w-8 h-4 rounded-full ${rule.active ? "bg-gold" : "bg-surface-light"}`}>
                    <div className={`w-3 h-3 bg-white rounded-full mt-0.5 ${rule.active ? "ml-4" : "ml-0.5"}`} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ===== SOURCE ATTRIBUTION ===== */}
      {activeTab === "attribution" && (
        <div className="space-y-4">
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <BarChart3 size={14} className="text-gold" /> Lead Source Attribution
          </h3>
          <div className="text-center py-12 text-muted text-xs">No source attribution data yet.</div>
        </div>
      )}

      {/* ===== NURTURE SEQUENCES ===== */}
      {activeTab === "nurture" && (
        <div className="space-y-4">
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <Mail size={14} className="text-gold" /> Lead Nurture Sequences
          </h3>
          <div className="text-center py-12 text-muted text-xs">No nurture sequences configured yet.</div>
        </div>
      )}

      {/* ===== ENRICHMENT ===== */}
      {activeTab === "enrichment" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <Zap size={14} className="text-gold" /> Lead Enrichment Panel
            </h3>
            <button className="btn-primary text-xs flex items-center gap-1.5"><RefreshCw size={12} /> Enrich All Missing</button>
          </div>
          <div className="grid grid-cols-4 gap-3 mb-4">
            {[
              { label: "Fully Enriched", value: 0, total: totalLeads, color: "text-green-400" },
              { label: "Partial Data", value: 0, total: totalLeads, color: "text-yellow-400" },
              { label: "Missing Email", value: 0, total: totalLeads, color: "text-red-400" },
              { label: "Missing Phone", value: 0, total: totalLeads, color: "text-red-400" },
            ].map((s, i) => (
              <div key={i} className="card text-center p-3">
                <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
                <p className="text-[9px] text-muted">{s.label}</p>
                <p className="text-[8px] text-muted">of {s.total} leads</p>
              </div>
            ))}
          </div>
          <div className="space-y-1.5">
            {MOCK_LEADS.length === 0 && (
              <div className="text-center py-8 text-muted text-xs">No leads to enrich yet.</div>
            )}
            {MOCK_LEADS.map(lead => (
              <div key={lead.id} className="flex items-center justify-between p-3 rounded-lg bg-surface-light border border-border text-[10px]">
                <div className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                    lead.email !== "---" && lead.phone !== "---" ? "bg-green-400/10" : "bg-yellow-400/10"
                  }`}>
                    {lead.email !== "---" && lead.phone !== "---" ? <CheckCircle size={12} className="text-green-400" /> : <AlertTriangle size={12} className="text-yellow-400" />}
                  </div>
                  <div>
                    <p className="font-semibold">{lead.business_name}</p>
                    <p className="text-[9px] text-muted">{lead.industry} | {lead.city}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex gap-2">
                    <span className={lead.email !== "---" ? "text-green-400" : "text-red-400"}>{lead.email !== "---" ? "Email" : "No email"}</span>
                    <span className={lead.phone !== "---" ? "text-green-400" : "text-red-400"}>{lead.phone !== "---" ? "Phone" : "No phone"}</span>
                    <span className={lead.website ? "text-green-400" : "text-red-400"}>{lead.website ? "Website" : "No site"}</span>
                  </div>
                  <button className="text-[9px] px-2 py-1 rounded bg-gold/10 text-gold hover:bg-gold/20">Enrich</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ===== CONVERSION FUNNEL ===== */}
      {activeTab === "funnel" && (
        <div className="space-y-4">
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <TrendingUp size={14} className="text-gold" /> Lead Conversion Funnel
          </h3>
          <div className="flex flex-col items-center gap-2">
            {[
              { stage: "Total Leads Scraped", count: 0, pct: 0, color: "bg-blue-400" },
              { stage: "Contacted (DM/Email/Call)", count: 0, pct: 0, color: "bg-purple-400" },
              { stage: "Replied / Engaged", count: 0, pct: 0, color: "bg-yellow-400" },
              { stage: "Qualified (Score 70+)", count: 0, pct: 0, color: "bg-orange-400" },
              { stage: "Booked Discovery Call", count: 0, pct: 0, color: "bg-green-400" },
              { stage: "Converted to Client", count: 0, pct: 0, color: "bg-gold" },
            ].map((s, i) => (
              <div key={i} className="w-full max-w-2xl">
                <div className="flex items-center justify-between mb-1 text-[10px]">
                  <span className="font-semibold">{s.stage}</span>
                  <span className="text-muted">{s.count} ({s.pct}%)</span>
                </div>
                <div className="w-full bg-surface-light rounded-full h-6 overflow-hidden">
                  <div className={`${s.color} h-6 rounded-full flex items-center justify-center`} style={{ width: `${s.pct}%` }}>
                    {s.pct > 15 && <span className="text-[8px] font-bold text-black">{s.count}</span>}
                  </div>
                </div>
                {i < 5 && (
                  <div className="flex justify-center my-1">
                    <ArrowDownRight size={12} className="text-muted/30" />
                    <span className="text-[8px] text-muted ml-1">
                      {i === 0 ? "0% contact rate" : i === 1 ? "0% reply rate" : i === 2 ? "0% qualify rate" : i === 3 ? "0% book rate" : "0% close rate"}
                    </span>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ===== TAGS & ALERTS ===== */}
      {activeTab === "tags" && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Lead Tagging System */}
            <div className="card">
              <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                <Tag size={14} className="text-gold" /> Lead Tagging System
              </h3>
              <div className="flex flex-wrap gap-2 mb-3">
                {["high-value", "responsive", "warm", "needs-nurture", "follow-up", "hot", "referral", "decision-maker", "client", "upsell", "no-budget", "competitor-user"].map(tag => (
                  <span key={tag} className="text-[9px] px-2 py-1 rounded-full bg-gold/10 text-gold border border-gold/20 cursor-pointer hover:bg-gold/20 transition-all">{tag}</span>
                ))}
              </div>
              <div className="flex gap-2">
                <input value={tagInput} onChange={e => setTagInput(e.target.value)} className="input flex-1 text-xs" placeholder="Create new tag..." />
                <button className="btn-primary text-xs px-3">Add</button>
              </div>
            </div>
            {/* Hot Lead Alerts Config */}
            <div className="card">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold flex items-center gap-2">
                  <Bell size={14} className="text-red-400" /> Hot Lead Alert Settings
                </h3>
                <button onClick={() => setHotAlerts(!hotAlerts)}
                  className={`w-10 h-5 rounded-full transition-all flex items-center ${hotAlerts ? "bg-gold justify-end" : "bg-surface-light justify-start"}`}>
                  <div className="w-4 h-4 bg-white rounded-full mx-0.5 shadow" />
                </button>
              </div>
              <div className="space-y-2">
                {[
                  { trigger: "Lead score reaches 80+", channel: "Slack + Email", active: true },
                  { trigger: "Lead replies to outreach", channel: "Slack + Push", active: true },
                  { trigger: "Lead books a call", channel: "Slack + SMS", active: true },
                  { trigger: "Lead visits pricing page", channel: "Slack", active: false },
                ].map((alert, i) => (
                  <div key={i} className={`flex items-center justify-between p-2.5 rounded-lg bg-surface-light text-[10px] ${!alert.active ? "opacity-50" : ""}`}>
                    <div>
                      <p className="font-semibold">{alert.trigger}</p>
                      <p className="text-[9px] text-muted">Notify via: {alert.channel}</p>
                    </div>
                    <div className={`w-6 h-3 rounded-full ${alert.active ? "bg-green-400" : "bg-surface"}`}>
                      <div className={`w-2.5 h-2.5 bg-white rounded-full mt-px ${alert.active ? "ml-3" : "ml-0.5"}`} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
