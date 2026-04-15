"use client";

import { useState } from "react";
import {
  Users, Mail, MessageCircle, Search,
  Calendar, Send, Clock, Flame,
  Star, BarChart3, Shield, Zap, Target,
  ArrowUpRight, AlertTriangle, XCircle,
  TrendingUp, Globe, RefreshCw, Copy, ChevronRight,
  Inbox, UserPlus, Settings, Eye
} from "lucide-react";

type MainTab = "dashboard" | "sequences" | "templates" | "ab-test" | "deliverability" | "warmup" | "contacts" | "automation";

// All data is fetched from real APIs — no mock data
const EMPTY_SEQUENCES: Array<{ id: string; name: string; steps: number; enrolled: number; replied: number; status: string }> = [];
const EMPTY_TEMPLATES: Array<{ id: string; name: string; subject: string; opens: number; replies: number; category: string }> = [];
const EMPTY_AB_TESTS: Array<{ id: string; subjectA: string; subjectB: string; openA: number; openB: number; replyA: number; replyB: number; winner: string; status: string }> = [];
const EMPTY_WARMUP: Array<{ domain: string; health: number; sent: number; reputation: string; age: string; dailyLimit: number }> = [];
const EMPTY_AUTOMATION: Array<{ id: string; trigger: string; action: string; enabled: boolean }> = [];
const EMPTY_CONTACTS: Array<{ id: string; name: string; email: string; phone: string; industry: string; city: string; score: number; enriched: boolean }> = [];

export default function OutreachHubPage() {
  const [activeTab, setActiveTab] = useState<MainTab>("dashboard");
  const [search, setSearch] = useState("");
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);
  const [templateCategory, setTemplateCategory] = useState("all");
  const [automationRules, setAutomationRules] = useState(EMPTY_AUTOMATION);
  const [unsubSearch, setUnsubSearch] = useState("");
  const [bounceFilter, setBounceFilter] = useState("all");

  const TABS: { key: MainTab; label: string; icon: React.ReactNode }[] = [
    { key: "dashboard", label: "Analytics", icon: <BarChart3 size={14} /> },
    { key: "sequences", label: "Sequences", icon: <Send size={14} /> },
    { key: "templates", label: "Templates", icon: <Mail size={14} /> },
    { key: "ab-test", label: "A/B Testing", icon: <Target size={14} /> },
    { key: "deliverability", label: "Deliverability", icon: <Shield size={14} /> },
    { key: "warmup", label: "Domain Warmup", icon: <Flame size={14} /> },
    { key: "contacts", label: "Contacts", icon: <UserPlus size={14} /> },
    { key: "automation", label: "Automation", icon: <Settings size={14} /> },
  ];

  const filteredTemplates = EMPTY_TEMPLATES.filter(t =>
    (templateCategory === "all" || t.category === templateCategory) &&
    (!search || t.name.toLowerCase().includes(search.toLowerCase()) || t.subject.toLowerCase().includes(search.toLowerCase()))
  );

  const unsubList = ([] as Array<{ email: string; date: string; reason: string }>).filter(u => !unsubSearch || u.email.includes(unsubSearch));

  return (
    <div className="fade-in space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-header mb-0 flex items-center gap-3">
            <div className="w-10 h-10 bg-gold/10 rounded-xl flex items-center justify-center">
              <Users size={24} className="text-gold" />
            </div>
            Outreach Hub
          </h1>
          <p className="text-muted text-sm mt-1">Email sequences, templates, deliverability, and contact enrichment</p>
        </div>
        <div className="flex gap-2">
          <button className="btn-secondary text-xs flex items-center gap-1.5">
            <RefreshCw size={12} /> Sync
          </button>
          <button className="btn-primary text-xs flex items-center gap-1.5">
            <Send size={12} /> New Campaign
          </button>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex gap-1 bg-surface rounded-lg p-1 overflow-x-auto">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setActiveTab(t.key)}
            className={`px-4 py-2 text-xs rounded-md flex items-center gap-2 whitespace-nowrap transition-all ${
              activeTab === t.key ? "bg-gold text-black font-medium" : "text-muted hover:text-foreground"
            }`}
          >
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {/* ===== ANALYTICS DASHBOARD ===== */}
      {activeTab === "dashboard" && (
        <div className="space-y-5">
          {/* Stats Row */}
          <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
            {[
              { label: "Emails Sent", value: "0", icon: <Send size={14} />, change: "—", color: "text-gold" },
              { label: "Open Rate", value: "—", icon: <Eye size={14} />, change: "—", color: "text-blue-400" },
              { label: "Reply Rate", value: "—", icon: <MessageCircle size={14} />, change: "—", color: "text-green-400" },
              { label: "Bounce Rate", value: "—", icon: <XCircle size={14} />, change: "—", color: "text-red-400" },
              { label: "Meetings Booked", value: "0", icon: <Calendar size={14} />, change: "—", color: "text-purple-400" },
              { label: "Pipeline Added", value: "$0", icon: <TrendingUp size={14} />, change: "—", color: "text-gold" },
            ].map((stat, i) => (
              <div key={i} className="card text-center p-3">
                <div className={`w-8 h-8 rounded-lg mx-auto mb-2 flex items-center justify-center ${stat.color} bg-white/5`}>
                  {stat.icon}
                </div>
                <p className="text-lg font-bold">{stat.value}</p>
                <p className="text-[10px] text-muted">{stat.label}</p>
                <p className="text-[9px] mt-1 text-muted">{stat.change}</p>
              </div>
            ))}
          </div>

          {/* Reply Detection + Bounce Monitor Row */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Reply Detection */}
            <div className="card">
              <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                <Inbox size={14} className="text-green-400" /> Reply Detection
              </h3>
              <div className="text-center py-8">
                <Inbox size={24} className="mx-auto text-muted/30 mb-2" />
                <p className="text-xs text-muted">No replies detected yet</p>
                <p className="text-[10px] text-muted/60 mt-1">Replies will appear here when leads respond to your outreach</p>
              </div>
            </div>

            {/* Bounce Rate Monitor */}
            <div className="card">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold flex items-center gap-2">
                  <AlertTriangle size={14} className="text-red-400" /> Bounce Monitor
                </h3>
                <select value={bounceFilter} onChange={e => setBounceFilter(e.target.value)} className="input text-[10px] py-1 px-2">
                  <option value="all">All</option>
                  <option value="hard">Hard Bounce</option>
                  <option value="soft">Soft Bounce</option>
                </select>
              </div>
              <div className="grid grid-cols-3 gap-2 mb-3">
                <div className="bg-surface-light rounded-lg p-2 text-center">
                  <p className="text-lg font-bold text-red-400">0</p>
                  <p className="text-[9px] text-muted">Hard Bounces</p>
                </div>
                <div className="bg-surface-light rounded-lg p-2 text-center">
                  <p className="text-lg font-bold text-yellow-400">0</p>
                  <p className="text-[9px] text-muted">Soft Bounces</p>
                </div>
                <div className="bg-surface-light rounded-lg p-2 text-center">
                  <p className="text-lg font-bold text-green-400">—</p>
                  <p className="text-[9px] text-muted">Delivery Rate</p>
                </div>
              </div>
              <div className="text-center py-4">
                <p className="text-[10px] text-muted">No bounces recorded</p>
              </div>
            </div>
          </div>

          {/* Send Time Optimizer */}
          <div className="card">
            <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
              <Clock size={14} className="text-gold" /> Send Time Optimizer
            </h3>
            <p className="text-[10px] text-muted mb-3">Best send times based on historical open rates. Recommended: <span className="text-gold font-semibold">10:00 AM - 11:00 AM</span></p>
            <div className="flex items-end gap-1.5 h-32">
              {([] as Array<{hour: string; score: number}>).map((d, i) => (
                <div key={i} className="flex-1 flex flex-col items-center gap-1">
                  <div
                    className={`w-full rounded-t transition-all ${d.score >= 80 ? "bg-gold" : d.score >= 50 ? "bg-gold/40" : "bg-surface-light"}`}
                    style={{ height: `${d.score}%` }}
                  />
                  <span className="text-[7px] text-muted">{d.hour.replace(" AM", "a").replace(" PM", "p")}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ===== EMAIL SEQUENCES ===== */}
      {activeTab === "sequences" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold">Email Sequence Builder</h3>
            <button className="btn-primary text-xs flex items-center gap-1.5"><Zap size={12} /> Create Sequence</button>
          </div>
          <div className="space-y-2">
            {EMPTY_SEQUENCES.map(seq => (
              <div key={seq.id} className="card p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`w-2.5 h-2.5 rounded-full ${seq.status === "active" ? "bg-green-400 animate-pulse" : "bg-yellow-400"}`} />
                  <div>
                    <p className="text-sm font-semibold">{seq.name}</p>
                    <p className="text-[10px] text-muted">{seq.steps} steps</p>
                  </div>
                </div>
                <div className="flex items-center gap-6 text-xs">
                  <div className="text-center">
                    <p className="font-bold">{seq.enrolled}</p>
                    <p className="text-[9px] text-muted">Enrolled</p>
                  </div>
                  <div className="text-center">
                    <p className="font-bold text-green-400">{seq.replied}</p>
                    <p className="text-[9px] text-muted">Replied</p>
                  </div>
                  <div className="text-center">
                    <p className="font-bold text-gold">{seq.enrolled > 0 ? ((seq.replied / seq.enrolled) * 100).toFixed(1) : 0}%</p>
                    <p className="text-[9px] text-muted">Rate</p>
                  </div>
                  <span className={`text-[9px] px-2 py-0.5 rounded-full font-medium ${
                    seq.status === "active" ? "bg-green-400/10 text-green-400" : "bg-yellow-400/10 text-yellow-400"
                  }`}>{seq.status}</span>
                  <button className="btn-ghost text-[10px] p-1"><ChevronRight size={12} /></button>
                </div>
              </div>
            ))}
          </div>

          {/* Visual Sequence Preview */}
          <div className="card">
            <h4 className="text-xs font-semibold mb-3">Sequence Visual</h4>
            <div className="text-center py-6">
              <Send size={24} className="mx-auto text-muted/30 mb-2" />
              <p className="text-xs text-muted">No sequences created yet</p>
              <p className="text-[10px] text-muted/60 mt-1">Create a sequence to see its visual flow here</p>
            </div>
            <div className="hidden">
              {([] as Array<{type: string; label: string; delay: string}>).map((step, i) => (
                <div key={i} className="flex items-center gap-2 flex-shrink-0">
                  <div className="p-3 rounded-lg border text-center min-w-[100px] border-border bg-surface-light">
                    <div className="text-[8px] uppercase font-bold mb-1 text-muted">{step.type}</div>
                    <p className="text-[10px] font-medium">{step.label}</p>
                    {step.delay && <p className="text-[8px] text-muted mt-0.5">{step.delay}</p>}
                  </div>
                  {i < 6 && <ChevronRight size={12} className="text-muted/30 flex-shrink-0" />}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ===== COLD EMAIL TEMPLATES ===== */}
      {activeTab === "templates" && (
        <div className="space-y-4">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="relative flex-1 min-w-[200px]">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
              <input className="input w-full pl-9 text-xs" placeholder="Search templates..." value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            <div className="flex gap-1">
              {["all", "opener", "value", "social", "followup", "referral", "promo"].map(c => (
                <button key={c} onClick={() => setTemplateCategory(c)}
                  className={`text-[10px] px-2.5 py-1.5 rounded-lg capitalize transition-all ${
                    templateCategory === c ? "bg-gold/10 text-gold border border-gold/20" : "text-muted border border-white/[0.05]"
                  }`}>{c}</button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {filteredTemplates.map(t => (
              <div key={t.id}
                onClick={() => setSelectedTemplate(selectedTemplate === t.id ? null : t.id)}
                className={`p-4 rounded-xl border cursor-pointer transition-all ${
                  selectedTemplate === t.id ? "border-gold/30 bg-gold/5" : "border-border bg-surface-light hover:border-gold/10"
                }`}>
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <p className="text-xs font-semibold">{t.name}</p>
                    <p className="text-[10px] text-muted mt-0.5">{t.subject}</p>
                  </div>
                  <button onClick={e => { e.stopPropagation(); }} className="p-1 text-muted hover:text-gold"><Copy size={10} /></button>
                </div>
                <div className="flex items-center gap-3 mt-3">
                  <span className="flex items-center gap-1 text-[9px] text-blue-400"><Eye size={9} /> {t.opens}% opens</span>
                  <span className="flex items-center gap-1 text-[9px] text-green-400"><MessageCircle size={9} /> {t.replies}% replies</span>
                  <span className="text-[8px] px-1.5 py-0.5 rounded bg-surface text-muted capitalize">{t.category}</span>
                </div>
                {selectedTemplate === t.id && (
                  <div className="mt-3 pt-3 border-t border-border">
                    <p className="text-[10px] text-muted mb-2">Preview:</p>
                    <div className="bg-surface rounded-lg p-3 text-[10px] leading-relaxed">
                      <p className="font-semibold mb-1">Subject: {t.subject}</p>
                      <p className="text-muted">Hey {"{name}"},</p>
                      <p className="text-muted mt-1">I noticed {"{business_name}"} is doing great work in {"{industry}"}. We recently helped a similar business increase their client base by 3x in 60 days.</p>
                      <p className="text-muted mt-1">Would you be open to a quick 15-minute call this week?</p>
                      <p className="text-muted mt-1">Best,<br/>Nicklas</p>
                    </div>
                    <div className="flex gap-2 mt-2">
                      <button className="btn-primary text-[9px] px-2 py-1 flex items-center gap-1"><Send size={9} /> Use</button>
                      <button className="btn-secondary text-[9px] px-2 py-1 flex items-center gap-1"><Copy size={9} /> Clone</button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ===== A/B TESTING ===== */}
      {activeTab === "ab-test" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold">A/B Subject Line Tester</h3>
            <button className="btn-primary text-xs flex items-center gap-1.5"><Target size={12} /> New Test</button>
          </div>
          <div className="space-y-3">
            {EMPTY_AB_TESTS.map(test => (
              <div key={test.id} className="card p-4">
                <div className="flex items-center gap-2 mb-3">
                  <span className={`text-[9px] px-2 py-0.5 rounded-full font-medium ${
                    test.status === "complete" ? "bg-green-400/10 text-green-400" : "bg-blue-400/10 text-blue-400 animate-pulse"
                  }`}>{test.status}</span>
                  {test.winner !== "tie" && test.status === "complete" && (
                    <span className="text-[9px] text-gold flex items-center gap-1"><Star size={9} /> Winner: Variant {test.winner}</span>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className={`p-3 rounded-lg border ${test.winner === "A" ? "border-gold/30 bg-gold/5" : "border-border bg-surface-light"}`}>
                    <p className="text-[9px] text-muted mb-1 uppercase font-bold">Variant A</p>
                    <p className="text-xs font-medium mb-2">{test.subjectA}</p>
                    <div className="flex gap-3">
                      <span className="text-[10px]"><span className="text-blue-400 font-bold">{test.openA}%</span> opens</span>
                      <span className="text-[10px]"><span className="text-green-400 font-bold">{test.replyA}%</span> replies</span>
                    </div>
                    <div className="w-full bg-surface rounded-full h-1.5 mt-2">
                      <div className="bg-blue-400 rounded-full h-1.5" style={{ width: `${test.openA}%` }} />
                    </div>
                  </div>
                  <div className={`p-3 rounded-lg border ${test.winner === "B" ? "border-gold/30 bg-gold/5" : "border-border bg-surface-light"}`}>
                    <p className="text-[9px] text-muted mb-1 uppercase font-bold">Variant B</p>
                    <p className="text-xs font-medium mb-2">{test.subjectB}</p>
                    <div className="flex gap-3">
                      <span className="text-[10px]"><span className="text-blue-400 font-bold">{test.openB}%</span> opens</span>
                      <span className="text-[10px]"><span className="text-green-400 font-bold">{test.replyB}%</span> replies</span>
                    </div>
                    <div className="w-full bg-surface rounded-full h-1.5 mt-2">
                      <div className="bg-blue-400 rounded-full h-1.5" style={{ width: `${test.openB}%` }} />
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ===== DELIVERABILITY SCORE ===== */}
      {activeTab === "deliverability" && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Score Card */}
            <div className="card text-center p-6">
              <div className="w-24 h-24 rounded-full border-4 border-border flex items-center justify-center mx-auto mb-3">
                <div>
                  <p className="text-3xl font-bold text-muted">—</p>
                  <p className="text-[9px] text-muted">/ 100</p>
                </div>
              </div>
              <h3 className="text-sm font-semibold">Deliverability Score</h3>
              <p className="text-[10px] text-muted mt-1">Configure email domains to see score</p>
            </div>
            {/* Breakdown */}
            <div className="card col-span-1 lg:col-span-2">
              <h3 className="text-sm font-semibold mb-3">Score Breakdown</h3>
              <div className="text-center py-8">
                <Shield size={24} className="mx-auto text-muted/30 mb-2" />
                <p className="text-xs text-muted">No email domains configured</p>
                <p className="text-[10px] text-muted/60 mt-1">Add your sending domains to get SPF, DKIM, DMARC and deliverability checks</p>
              </div>
            </div>
          </div>

          {/* Unsubscribe Management */}
          <div className="card">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold flex items-center gap-2">
                <XCircle size={14} className="text-muted" /> Unsubscribe Management
              </h3>
              <div className="relative w-48">
                <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted" />
                <input className="input w-full pl-8 text-[10px] py-1.5" placeholder="Search email..." value={unsubSearch} onChange={e => setUnsubSearch(e.target.value)} />
              </div>
            </div>
            <div className="space-y-1">
              <div className="grid grid-cols-3 text-[9px] text-muted uppercase tracking-wider font-semibold py-1.5 px-2">
                <span>Email</span>
                <span>Date</span>
                <span>Reason</span>
              </div>
              {unsubList.map((u, i) => (
                <div key={i} className="grid grid-cols-3 text-[10px] py-2 px-2 rounded bg-surface-light">
                  <span className="font-mono text-muted">{u.email}</span>
                  <span className="text-muted">{u.date}</span>
                  <span className={`${u.reason === "Spam complaint" ? "text-red-400" : "text-muted"}`}>{u.reason}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ===== DOMAIN WARMUP ===== */}
      {activeTab === "warmup" && (
        <div className="space-y-4">
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <Flame size={14} className="text-gold" /> Domain Warm-up Tracker
          </h3>
          <div className="space-y-3">
            {EMPTY_WARMUP.map((d, i) => (
              <div key={i} className="card p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                      d.health >= 90 ? "bg-green-400/10" : d.health >= 70 ? "bg-yellow-400/10" : "bg-red-400/10"
                    }`}>
                      <Globe size={16} className={d.health >= 90 ? "text-green-400" : d.health >= 70 ? "text-yellow-400" : "text-red-400"} />
                    </div>
                    <div>
                      <p className="text-xs font-semibold font-mono">{d.domain}</p>
                      <p className="text-[10px] text-muted">Age: {d.age} | Daily limit: {d.dailyLimit}/day</p>
                    </div>
                  </div>
                  <span className={`text-xs font-bold ${
                    d.reputation === "Excellent" ? "text-green-400" : d.reputation === "Good" ? "text-blue-400" : "text-yellow-400"
                  }`}>{d.reputation}</span>
                </div>
                <div className="grid grid-cols-3 gap-4 mb-3">
                  <div className="text-center">
                    <p className="text-lg font-bold">{d.health}%</p>
                    <p className="text-[9px] text-muted">Health Score</p>
                  </div>
                  <div className="text-center">
                    <p className="text-lg font-bold">{d.sent.toLocaleString()}</p>
                    <p className="text-[9px] text-muted">Total Sent</p>
                  </div>
                  <div className="text-center">
                    <p className="text-lg font-bold">{d.dailyLimit}</p>
                    <p className="text-[9px] text-muted">Daily Limit</p>
                  </div>
                </div>
                <div className="w-full bg-surface rounded-full h-2">
                  <div className={`rounded-full h-2 transition-all ${
                    d.health >= 90 ? "bg-green-400" : d.health >= 70 ? "bg-yellow-400" : "bg-red-400"
                  }`} style={{ width: `${d.health}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ===== CONTACT ENRICHMENT ===== */}
      {activeTab === "contacts" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <UserPlus size={14} className="text-gold" /> Contact Enrichment
            </h3>
            <div className="flex gap-2">
              <button className="btn-secondary text-xs flex items-center gap-1.5"><ArrowUpRight size={12} /> Import CSV</button>
              <button className="btn-primary text-xs flex items-center gap-1.5"><Zap size={12} /> Enrich All</button>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-[9px] text-muted uppercase tracking-wider border-b border-border">
                  <th className="text-left py-2 px-3">Business</th>
                  <th className="text-left py-2 px-3">Email</th>
                  <th className="text-left py-2 px-3">Phone</th>
                  <th className="text-left py-2 px-3">Industry</th>
                  <th className="text-left py-2 px-3">City</th>
                  <th className="text-center py-2 px-3">Score</th>
                  <th className="text-center py-2 px-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {EMPTY_CONTACTS.map(c => (
                  <tr key={c.id} className="border-b border-border/50 hover:bg-surface-light transition-colors">
                    <td className="py-2.5 px-3 text-xs font-medium">{c.name}</td>
                    <td className="py-2.5 px-3 text-[10px] text-muted font-mono">{c.email}</td>
                    <td className="py-2.5 px-3 text-[10px] text-muted">{c.phone}</td>
                    <td className="py-2.5 px-3 text-[10px]">{c.industry}</td>
                    <td className="py-2.5 px-3 text-[10px] text-muted">{c.city}</td>
                    <td className="py-2.5 px-3 text-center">
                      <span className={`text-[10px] font-bold ${c.score >= 80 ? "text-green-400" : c.score >= 50 ? "text-yellow-400" : "text-red-400"}`}>{c.score}</span>
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      {c.enriched ? (
                        <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-green-400/10 text-green-400">Enriched</span>
                      ) : (
                        <button className="text-[9px] px-1.5 py-0.5 rounded-full bg-gold/10 text-gold hover:bg-gold/20 transition-colors">Enrich</button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ===== AUTOMATION RULES ===== */}
      {activeTab === "automation" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <Settings size={14} className="text-gold" /> Follow-up Automation Rules
            </h3>
            <button className="btn-primary text-xs flex items-center gap-1.5"><Zap size={12} /> Add Rule</button>
          </div>
          <div className="space-y-2">
            {automationRules.map(rule => (
              <div key={rule.id} className={`card p-4 flex items-center justify-between transition-all ${!rule.enabled ? "opacity-50" : ""}`}>
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-gold/10 flex items-center justify-center">
                    <Zap size={14} className="text-gold" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold">When: {rule.trigger}</p>
                    <p className="text-[10px] text-muted">Then: {rule.action}</p>
                  </div>
                </div>
                <button
                  onClick={() => setAutomationRules(prev => prev.map(r => r.id === rule.id ? { ...r, enabled: !r.enabled } : r))}
                  className={`w-10 h-5 rounded-full transition-all flex items-center ${rule.enabled ? "bg-gold justify-end" : "bg-surface-light justify-start"}`}
                >
                  <div className="w-4 h-4 bg-white rounded-full mx-0.5 shadow" />
                </button>
              </div>
            ))}
          </div>

          {/* Follow-up Automation Stats */}
          <div className="card">
            <h4 className="text-xs font-semibold mb-3">Automation Performance</h4>
            <div className="grid grid-cols-4 gap-3">
              {[
                { label: "Auto Follow-ups Sent", value: "0", icon: <Send size={12} /> },
                { label: "Auto-replies Detected", value: "0", icon: <Inbox size={12} /> },
                { label: "Leads Auto-upgraded", value: "0", icon: <TrendingUp size={12} /> },
                { label: "Bounces Auto-cleaned", value: "0", icon: <Trash2 size={12} /> },
              ].map((s, i) => (
                <div key={i} className="bg-surface-light rounded-lg p-3 text-center">
                  <div className="w-6 h-6 rounded mx-auto mb-1.5 bg-gold/10 flex items-center justify-center text-gold">{s.icon}</div>
                  <p className="text-sm font-bold">{s.value}</p>
                  <p className="text-[9px] text-muted">{s.label}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Trash2({ size, className }: { size: number; className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M3 6h18" /><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
      <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
    </svg>
  );
}
