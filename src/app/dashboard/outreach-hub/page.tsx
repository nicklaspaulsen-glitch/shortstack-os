"use client";

import { useState } from "react";
import {
  Users, Mail, MessageCircle, Search,
  Calendar, Send, Clock, Flame,
  Star, BarChart3, Shield, Zap, Target,
  ArrowUpRight, AlertTriangle, CheckCircle, XCircle,
  TrendingUp, Globe, RefreshCw, Copy, ChevronRight,
  Inbox, UserPlus, Settings, Eye
} from "lucide-react";

type MainTab = "dashboard" | "sequences" | "templates" | "ab-test" | "deliverability" | "warmup" | "contacts" | "automation";

const MOCK_SEQUENCES = [
  { id: "1", name: "Cold Outreach (5 touches)", steps: 5, enrolled: 234, replied: 18, status: "active" },
  { id: "2", name: "Post-Call Follow Up", steps: 4, enrolled: 89, replied: 12, status: "active" },
  { id: "3", name: "Re-engagement Campaign", steps: 3, enrolled: 156, replied: 8, status: "paused" },
  { id: "4", name: "Client Onboarding Drip", steps: 6, enrolled: 45, replied: 32, status: "active" },
  { id: "5", name: "Free Audit Offer", steps: 4, enrolled: 312, replied: 24, status: "active" },
];

const COLD_TEMPLATES = [
  { id: "1", name: "Pain Point Opener", subject: "Noticed something about {business_name}", opens: 42, replies: 8, category: "opener" },
  { id: "2", name: "Case Study Lead", subject: "How we helped a {industry} grow 3x", opens: 38, replies: 6, category: "opener" },
  { id: "3", name: "Competitor Angle", subject: "{business_name} vs. competitors", opens: 51, replies: 11, category: "opener" },
  { id: "4", name: "Quick Question", subject: "Quick question about {business_name}", opens: 45, replies: 9, category: "opener" },
  { id: "5", name: "Value-First Intro", subject: "Free audit for {business_name}", opens: 56, replies: 14, category: "value" },
  { id: "6", name: "Social Proof", subject: "{industry} owners are switching to this", opens: 33, replies: 5, category: "social" },
  { id: "7", name: "Follow Up #1", subject: "Following up - {business_name}", opens: 29, replies: 7, category: "followup" },
  { id: "8", name: "Follow Up #2", subject: "Last try - free audit", opens: 24, replies: 4, category: "followup" },
  { id: "9", name: "Breakup Email", subject: "Closing your file, {name}", opens: 61, replies: 16, category: "followup" },
  { id: "10", name: "Video Loom", subject: "Made you a quick video, {name}", opens: 67, replies: 19, category: "value" },
  { id: "11", name: "Referral Ask", subject: "Know anyone who needs more clients?", opens: 35, replies: 8, category: "referral" },
  { id: "12", name: "Holiday Special", subject: "Special offer for {industry} businesses", opens: 41, replies: 7, category: "promo" },
];

const AB_TESTS = [
  { id: "1", subjectA: "Quick question about {business}", subjectB: "I found something about {business}", openA: 42, openB: 51, replyA: 8, replyB: 11, winner: "B", status: "complete" },
  { id: "2", subjectA: "Free audit for your business", subjectB: "3 things holding {business} back", openA: 38, openB: 44, replyA: 6, replyB: 9, winner: "B", status: "complete" },
  { id: "3", subjectA: "Can we chat this week?", subjectB: "15 minutes to 2x your clients", openA: 31, openB: 35, replyA: 5, replyB: 5, winner: "tie", status: "running" },
];

const SEND_TIME_DATA = [
  { hour: "6 AM", score: 12 }, { hour: "7 AM", score: 25 }, { hour: "8 AM", score: 58 },
  { hour: "9 AM", score: 82 }, { hour: "10 AM", score: 91 }, { hour: "11 AM", score: 75 },
  { hour: "12 PM", score: 45 }, { hour: "1 PM", score: 55 }, { hour: "2 PM", score: 68 },
  { hour: "3 PM", score: 72 }, { hour: "4 PM", score: 60 }, { hour: "5 PM", score: 40 },
  { hour: "6 PM", score: 28 }, { hour: "7 PM", score: 35 }, { hour: "8 PM", score: 22 },
];

const WARMUP_DOMAINS = [
  { domain: "outreach@shortstackhq.com", health: 94, sent: 1250, reputation: "Excellent", age: "45 days", dailyLimit: 50 },
  { domain: "team@shortstackhq.com", health: 87, sent: 890, reputation: "Good", age: "30 days", dailyLimit: 40 },
  { domain: "hello@shortstack.io", health: 72, sent: 340, reputation: "Warming", age: "12 days", dailyLimit: 20 },
];

const AUTOMATION_RULES = [
  { id: "1", trigger: "Lead replies", action: "Move to Hot tier + notify Slack", enabled: true },
  { id: "2", trigger: "No reply after 7 days", action: "Send follow-up #2 automatically", enabled: true },
  { id: "3", trigger: "Email bounced", action: "Move to Dead tier + enrich email", enabled: true },
  { id: "4", trigger: "Lead opens 3+ emails", action: "Flag as warm + add to call queue", enabled: false },
  { id: "5", trigger: "Unsubscribe request", action: "Remove from all sequences + log", enabled: true },
  { id: "6", trigger: "Lead books a call", action: "Pause all sequences + notify team", enabled: true },
];

const ENRICHMENT_CONTACTS = [
  { id: "1", name: "Bright Smile Dental", email: "info@brightsmile.com", phone: "+1 (555) 234-5678", industry: "Dental", city: "Miami", score: 85, enriched: true },
  { id: "2", name: "Peak Fitness Gym", email: "owner@peakfitness.com", phone: "+1 (555) 345-6789", industry: "Fitness", city: "Austin", score: 72, enriched: true },
  { id: "3", name: "Swift Plumbing Co", email: "—", phone: "+1 (555) 456-7890", industry: "Plumbing", city: "Dallas", score: 45, enriched: false },
  { id: "4", name: "Green Lawn Masters", email: "contact@greenlawn.com", phone: "—", industry: "Landscaping", city: "Tampa", score: 58, enriched: false },
  { id: "5", name: "Atlas Legal Group", email: "info@atlaslegal.com", phone: "+1 (555) 567-8901", industry: "Legal", city: "Chicago", score: 91, enriched: true },
  { id: "6", name: "CloudNine HVAC", email: "service@cloudninehvac.com", phone: "+1 (555) 678-9012", industry: "HVAC", city: "Phoenix", score: 67, enriched: false },
];

export default function OutreachHubPage() {
  const [activeTab, setActiveTab] = useState<MainTab>("dashboard");
  const [search, setSearch] = useState("");
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);
  const [templateCategory, setTemplateCategory] = useState("all");
  const [automationRules, setAutomationRules] = useState(AUTOMATION_RULES);
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

  const filteredTemplates = COLD_TEMPLATES.filter(t =>
    (templateCategory === "all" || t.category === templateCategory) &&
    (!search || t.name.toLowerCase().includes(search.toLowerCase()) || t.subject.toLowerCase().includes(search.toLowerCase()))
  );

  const unsubList = [
    { email: "john@example.com", date: "2026-04-10", reason: "Manual" },
    { email: "sarah@dental.co", date: "2026-04-08", reason: "Link click" },
    { email: "mike@gym.com", date: "2026-04-05", reason: "Spam complaint" },
    { email: "lisa@legal.io", date: "2026-04-02", reason: "Link click" },
    { email: "tom@hvac.net", date: "2026-03-28", reason: "Manual" },
  ].filter(u => !unsubSearch || u.email.includes(unsubSearch));

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
              { label: "Emails Sent", value: "4,521", icon: <Send size={14} />, change: "+12%", color: "text-gold" },
              { label: "Open Rate", value: "38.2%", icon: <Eye size={14} />, change: "+3.1%", color: "text-blue-400" },
              { label: "Reply Rate", value: "6.8%", icon: <MessageCircle size={14} />, change: "+1.2%", color: "text-green-400" },
              { label: "Bounce Rate", value: "2.1%", icon: <XCircle size={14} />, change: "-0.5%", color: "text-red-400" },
              { label: "Meetings Booked", value: "47", icon: <Calendar size={14} />, change: "+8", color: "text-purple-400" },
              { label: "Pipeline Added", value: "$124K", icon: <TrendingUp size={14} />, change: "+$18K", color: "text-gold" },
            ].map((stat, i) => (
              <div key={i} className="card text-center p-3">
                <div className={`w-8 h-8 rounded-lg mx-auto mb-2 flex items-center justify-center ${stat.color} bg-white/5`}>
                  {stat.icon}
                </div>
                <p className="text-lg font-bold">{stat.value}</p>
                <p className="text-[10px] text-muted">{stat.label}</p>
                <p className={`text-[9px] mt-1 ${stat.change.startsWith("+") ? "text-green-400" : "text-red-400"}`}>{stat.change}</p>
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
              <div className="space-y-2">
                {[
                  { from: "Dr. Smith (Bright Smile)", preview: "Yes, I'd love to learn more about...", time: "2h ago", sentiment: "positive" },
                  { from: "Mike (Peak Fitness)", preview: "Not interested at this time, thanks.", time: "5h ago", sentiment: "negative" },
                  { from: "Sarah (Atlas Legal)", preview: "Can you send me more info?", time: "8h ago", sentiment: "positive" },
                  { from: "Tom (Swift Plumbing)", preview: "Please remove me from your list.", time: "1d ago", sentiment: "negative" },
                  { from: "Lisa (Green Lawn)", preview: "Interesting! Let's set up a call.", time: "1d ago", sentiment: "positive" },
                ].map((reply, i) => (
                  <div key={i} className="flex items-center gap-3 p-2.5 rounded-lg bg-surface-light border border-border">
                    <div className={`w-2 h-2 rounded-full flex-shrink-0 ${reply.sentiment === "positive" ? "bg-green-400" : "bg-red-400"}`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium truncate">{reply.from}</p>
                      <p className="text-[10px] text-muted truncate">{reply.preview}</p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <span className={`text-[9px] px-1.5 py-0.5 rounded-full ${
                        reply.sentiment === "positive" ? "bg-green-400/10 text-green-400" : "bg-red-400/10 text-red-400"
                      }`}>{reply.sentiment}</span>
                      <p className="text-[9px] text-muted mt-0.5">{reply.time}</p>
                    </div>
                  </div>
                ))}
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
                  <p className="text-lg font-bold text-red-400">23</p>
                  <p className="text-[9px] text-muted">Hard Bounces</p>
                </div>
                <div className="bg-surface-light rounded-lg p-2 text-center">
                  <p className="text-lg font-bold text-yellow-400">18</p>
                  <p className="text-[9px] text-muted">Soft Bounces</p>
                </div>
                <div className="bg-surface-light rounded-lg p-2 text-center">
                  <p className="text-lg font-bold text-green-400">97.8%</p>
                  <p className="text-[9px] text-muted">Delivery Rate</p>
                </div>
              </div>
              <div className="space-y-1.5">
                {[
                  { email: "old@defunct-biz.com", type: "Hard", reason: "Mailbox not found", date: "Apr 12" },
                  { email: "spam@blocked.net", type: "Hard", reason: "Domain blocked", date: "Apr 11" },
                  { email: "full@inbox.com", type: "Soft", reason: "Mailbox full", date: "Apr 11" },
                  { email: "temp@down.org", type: "Soft", reason: "Server timeout", date: "Apr 10" },
                ].filter(b => bounceFilter === "all" || b.type.toLowerCase() === bounceFilter).map((b, i) => (
                  <div key={i} className="flex items-center justify-between p-2 rounded bg-surface-light text-[10px]">
                    <span className="text-muted font-mono">{b.email}</span>
                    <span className={`px-1.5 py-0.5 rounded ${b.type === "Hard" ? "bg-red-400/10 text-red-400" : "bg-yellow-400/10 text-yellow-400"}`}>{b.type}</span>
                    <span className="text-muted">{b.reason}</span>
                    <span className="text-muted">{b.date}</span>
                  </div>
                ))}
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
              {SEND_TIME_DATA.map((d, i) => (
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
            {MOCK_SEQUENCES.map(seq => (
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
            <h4 className="text-xs font-semibold mb-3">Sequence Visual: Cold Outreach (5 touches)</h4>
            <div className="flex items-center gap-2 overflow-x-auto pb-2">
              {[
                { type: "email", label: "Initial Email", delay: "Day 0" },
                { type: "wait", label: "Wait 3 days", delay: "" },
                { type: "email", label: "Follow Up #1", delay: "Day 3" },
                { type: "wait", label: "Wait 4 days", delay: "" },
                { type: "sms", label: "SMS Nudge", delay: "Day 7" },
                { type: "wait", label: "Wait 5 days", delay: "" },
                { type: "email", label: "Breakup Email", delay: "Day 12" },
              ].map((step, i) => (
                <div key={i} className="flex items-center gap-2 flex-shrink-0">
                  <div className={`p-3 rounded-lg border text-center min-w-[100px] ${
                    step.type === "email" ? "border-blue-500/20 bg-blue-500/5" :
                    step.type === "sms" ? "border-green-500/20 bg-green-500/5" :
                    "border-border bg-surface-light"
                  }`}>
                    <div className={`text-[8px] uppercase font-bold mb-1 ${
                      step.type === "email" ? "text-blue-400" : step.type === "sms" ? "text-green-400" : "text-muted"
                    }`}>{step.type}</div>
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
            {AB_TESTS.map(test => (
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
              <div className="w-24 h-24 rounded-full border-4 border-green-400 flex items-center justify-center mx-auto mb-3">
                <div>
                  <p className="text-3xl font-bold text-green-400">92</p>
                  <p className="text-[9px] text-muted">/ 100</p>
                </div>
              </div>
              <h3 className="text-sm font-semibold">Deliverability Score</h3>
              <p className="text-[10px] text-green-400 mt-1">Excellent</p>
            </div>
            {/* Breakdown */}
            <div className="card col-span-1 lg:col-span-2">
              <h3 className="text-sm font-semibold mb-3">Score Breakdown</h3>
              <div className="space-y-3">
                {[
                  { label: "SPF Record", status: "pass", score: "100%" },
                  { label: "DKIM Signing", status: "pass", score: "100%" },
                  { label: "DMARC Policy", status: "pass", score: "100%" },
                  { label: "Bounce Rate", status: "pass", score: "97.9%" },
                  { label: "Spam Complaints", status: "warning", score: "0.08%" },
                  { label: "Blacklist Check", status: "pass", score: "Clean" },
                  { label: "Content Score", status: "pass", score: "95%" },
                  { label: "Link Reputation", status: "pass", score: "Good" },
                ].map((item, i) => (
                  <div key={i} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {item.status === "pass" ? <CheckCircle size={12} className="text-green-400" /> : <AlertTriangle size={12} className="text-yellow-400" />}
                      <span className="text-xs">{item.label}</span>
                    </div>
                    <span className={`text-xs font-mono ${item.status === "pass" ? "text-green-400" : "text-yellow-400"}`}>{item.score}</span>
                  </div>
                ))}
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
            {WARMUP_DOMAINS.map((d, i) => (
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
                {ENRICHMENT_CONTACTS.map(c => (
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
                { label: "Auto Follow-ups Sent", value: "1,284", icon: <Send size={12} /> },
                { label: "Auto-replies Detected", value: "89", icon: <Inbox size={12} /> },
                { label: "Leads Auto-upgraded", value: "156", icon: <TrendingUp size={12} /> },
                { label: "Bounces Auto-cleaned", value: "41", icon: <Trash2 size={12} /> },
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
