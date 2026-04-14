"use client";

import { useState } from "react";
import {
  FileText, Sparkles, Building, MapPin, Target, DollarSign,
  Plus, Eye, Clock, CheckCircle, Download, Send, Users,
  Palette, BarChart3, Edit3, Copy,
  Layers, TrendingUp,
  X, AlertTriangle
} from "lucide-react";

type MainTab = "builder" | "templates" | "tracking" | "history" | "analytics" | "acceptance";

const SERVICES = [
  "Short-Form Content", "Long-Form Content", "Paid Ads (Meta/Google/TikTok)",
  "SEO & Content Marketing", "Web Design & Funnels", "AI Receptionist",
  "Automation Workflows", "Branding & Creative", "Social Media Management",
  "Email Marketing", "Cold DM Outreach",
];

const TEMPLATE_STYLES = [
  { id: "1", name: "Modern Minimal", description: "Clean, white-space heavy, professional", color: "#c8a855", preview: "Minimal" },
  { id: "2", name: "Bold & Dark", description: "Dark theme with gold accents", color: "#1a1a2e", preview: "Dark" },
  { id: "3", name: "Corporate Blue", description: "Traditional business proposal style", color: "#3b82f6", preview: "Corporate" },
  { id: "4", name: "Startup Fresh", description: "Colorful, modern startup aesthetic", color: "#10b981", preview: "Fresh" },
  { id: "5", name: "Premium Gold", description: "Luxury feel with gold elements", color: "#f59e0b", preview: "Premium" },
  { id: "6", name: "Clean Slate", description: "Ultra minimal, content-first", color: "#6b7280", preview: "Slate" },
];

const MOCK_PROPOSALS = [
  { id: "1", client: "Bright Smile Dental", amount: "$2,497/mo", status: "viewed", views: 5, timeSpent: "12m 34s", sentDate: "Apr 10", services: ["Content", "Ads"], version: 2 },
  { id: "2", client: "Peak Fitness Gym", amount: "$4,997/mo", status: "accepted", views: 8, timeSpent: "28m 12s", sentDate: "Apr 8", services: ["Full Stack"], version: 1 },
  { id: "3", client: "Atlas Legal Group", amount: "$1,997/mo", status: "sent", views: 0, timeSpent: "0s", sentDate: "Apr 12", services: ["Social", "SEO"], version: 1 },
  { id: "4", client: "Swift Plumbing Co", amount: "$3,497/mo", status: "expired", views: 2, timeSpent: "4m 56s", sentDate: "Mar 28", services: ["Ads", "Web"], version: 1 },
  { id: "5", client: "CloudNine HVAC", amount: "$3,997/mo", status: "declined", views: 3, timeSpent: "8m 22s", sentDate: "Apr 5", services: ["Content", "AI"], version: 3 },
];

interface ProposalSection {
  id: string;
  type: string;
  title: string;
  enabled: boolean;
  order: number;
}

const DEFAULT_SECTIONS: ProposalSection[] = [
  { id: "1", type: "intro", title: "Introduction & About Us", enabled: true, order: 1 },
  { id: "2", type: "analysis", title: "Situation Analysis", enabled: true, order: 2 },
  { id: "3", type: "services", title: "Proposed Services", enabled: true, order: 3 },
  { id: "4", type: "pricing", title: "Investment & Pricing", enabled: true, order: 4 },
  { id: "5", type: "timeline", title: "Timeline & Milestones", enabled: true, order: 5 },
  { id: "6", type: "results", title: "Expected Results", enabled: true, order: 6 },
  { id: "7", type: "testimonials", title: "Client Testimonials", enabled: true, order: 7 },
  { id: "8", type: "terms", title: "Terms & Conditions", enabled: true, order: 8 },
  { id: "9", type: "signature", title: "Digital Signature", enabled: true, order: 9 },
  { id: "10", type: "custom", title: "Custom Section", enabled: false, order: 10 },
];

export default function ProposalsPage() {
  const [activeTab, setActiveTab] = useState<MainTab>("builder");
  const [form, setForm] = useState({
    business_name: "", industry: "", location: "", services: [] as string[],
    pain_points: "", budget: "", contact_name: "", email: "",
  });
  const [selectedStyle, setSelectedStyle] = useState("1");
  const [sections, setSections] = useState<ProposalSection[]>(DEFAULT_SECTIONS);
  const [showBranding, setShowBranding] = useState(false);
  const [branding, setBranding] = useState({ logo: "", color: "#c8a855", company: "ShortStack" });

  const toggleService = (s: string) => {
    setForm(prev => ({
      ...prev,
      services: prev.services.includes(s) ? prev.services.filter(x => x !== s) : [...prev.services, s],
    }));
  };

  const toggleSection = (id: string) => {
    setSections(prev => prev.map(s => s.id === id ? { ...s, enabled: !s.enabled } : s));
  };

  const TABS: { key: MainTab; label: string; icon: React.ReactNode }[] = [
    { key: "builder", label: "Proposal Builder", icon: <FileText size={14} /> },
    { key: "templates", label: "Template Gallery", icon: <Palette size={14} /> },
    { key: "tracking", label: "Tracking", icon: <Eye size={14} /> },
    { key: "history", label: "Version History", icon: <Layers size={14} /> },
    { key: "analytics", label: "Analytics", icon: <BarChart3 size={14} /> },
    { key: "acceptance", label: "Acceptance Flow", icon: <CheckCircle size={14} /> },
  ];

  const totalSent = MOCK_PROPOSALS.length;
  const accepted = MOCK_PROPOSALS.filter(p => p.status === "accepted").length;
  const viewed = MOCK_PROPOSALS.filter(p => p.views > 0).length;
  const avgTimeSpent = "14m 23s";
  const convRate = totalSent > 0 ? Math.round((accepted / totalSent) * 100) : 0;

  return (
    <div className="fade-in space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-header mb-0 flex items-center gap-2">
            <FileText size={18} className="text-gold" /> Proposals
          </h1>
          <p className="text-xs text-muted mt-0.5">Build, track, and close proposals with AI-powered generation</p>
        </div>
        <button className="btn-primary text-xs flex items-center gap-1.5">
          <Plus size={12} /> New Proposal
        </button>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {[
          { label: "Total Sent", value: totalSent, icon: <Send size={12} />, color: "text-gold" },
          { label: "Viewed", value: viewed, icon: <Eye size={12} />, color: "text-blue-400" },
          { label: "Accepted", value: accepted, icon: <CheckCircle size={12} />, color: "text-green-400" },
          { label: "Conv Rate", value: `${convRate}%`, icon: <TrendingUp size={12} />, color: "text-purple-400" },
          { label: "Avg Time Spent", value: avgTimeSpent, icon: <Clock size={12} />, color: "text-gold" },
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

      {/* ===== PROPOSAL BUILDER ===== */}
      {activeTab === "builder" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 space-y-4">
            {/* Prospect Details */}
            <div className="card space-y-3">
              <h2 className="text-sm font-semibold">Prospect Details</h2>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[9px] text-muted mb-1 uppercase tracking-wider">Business Name *</label>
                  <div className="relative">
                    <Building size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
                    <input value={form.business_name} onChange={e => setForm({ ...form, business_name: e.target.value })} className="input w-full text-xs pl-9" placeholder="e.g., Bright Smile Dental" />
                  </div>
                </div>
                <div>
                  <label className="block text-[9px] text-muted mb-1 uppercase tracking-wider">Contact Name</label>
                  <div className="relative">
                    <Users size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
                    <input value={form.contact_name} onChange={e => setForm({ ...form, contact_name: e.target.value })} className="input w-full text-xs pl-9" placeholder="e.g., Dr. John Smith" />
                  </div>
                </div>
                <div>
                  <label className="block text-[9px] text-muted mb-1 uppercase tracking-wider">Industry *</label>
                  <div className="relative">
                    <Target size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
                    <input value={form.industry} onChange={e => setForm({ ...form, industry: e.target.value })} className="input w-full text-xs pl-9" placeholder="Dental, HVAC, Legal" />
                  </div>
                </div>
                <div>
                  <label className="block text-[9px] text-muted mb-1 uppercase tracking-wider">Location</label>
                  <div className="relative">
                    <MapPin size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
                    <input value={form.location} onChange={e => setForm({ ...form, location: e.target.value })} className="input w-full text-xs pl-9" placeholder="Miami, FL" />
                  </div>
                </div>
                <div>
                  <label className="block text-[9px] text-muted mb-1 uppercase tracking-wider">Budget Range</label>
                  <div className="relative">
                    <DollarSign size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
                    <input value={form.budget} onChange={e => setForm({ ...form, budget: e.target.value })} className="input w-full text-xs pl-9" placeholder="$1,000 - $2,500/mo" />
                  </div>
                </div>
                <div>
                  <label className="block text-[9px] text-muted mb-1 uppercase tracking-wider">Email</label>
                  <input value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} className="input w-full text-xs" placeholder="contact@business.com" />
                </div>
              </div>
              <div>
                <label className="block text-[9px] text-muted mb-1 uppercase tracking-wider">Pain Points / Challenges</label>
                <textarea value={form.pain_points} onChange={e => setForm({ ...form, pain_points: e.target.value })} className="input w-full h-16 text-xs" placeholder="Not enough new patients, competitors outranking on Google..." />
              </div>
            </div>

            {/* Services */}
            <div className="card">
              <h2 className="text-sm font-semibold mb-2">Services</h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                {SERVICES.map(s => (
                  <button key={s} onClick={() => toggleService(s)}
                    className={`text-[10px] p-2 rounded-lg border text-left transition-all ${
                      form.services.includes(s) ? "bg-gold/10 border-gold/20 text-gold" : "border-border text-muted hover:border-gold/15"
                    }`}>
                    {form.services.includes(s) ? "+" : ""} {s}
                  </button>
                ))}
              </div>
            </div>

            {/* Dynamic Pricing Table */}
            <div className="card">
              <h2 className="text-sm font-semibold mb-3 flex items-center gap-2">
                <DollarSign size={14} className="text-gold" /> Dynamic Pricing Table
              </h2>
              <div className="overflow-x-auto">
                <table className="w-full text-[10px]">
                  <thead>
                    <tr className="text-[9px] text-muted uppercase tracking-wider border-b border-border">
                      <th className="text-left py-2">Service</th>
                      <th className="text-center py-2">Setup Fee</th>
                      <th className="text-center py-2">Monthly</th>
                      <th className="text-center py-2">Included</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(form.services.length > 0 ? form.services : ["Short-Form Content", "Paid Ads (Meta/Google/TikTok)"]).map((service, i) => (
                      <tr key={i} className="border-b border-border/50">
                        <td className="py-2 font-medium">{service}</td>
                        <td className="py-2 text-center text-muted">$500</td>
                        <td className="py-2 text-center text-gold font-bold">$997</td>
                        <td className="py-2 text-center"><CheckCircle size={10} className="text-green-400 mx-auto" /></td>
                      </tr>
                    ))}
                    <tr className="font-bold">
                      <td className="py-2">Total</td>
                      <td className="py-2 text-center">${(form.services.length || 2) * 500}</td>
                      <td className="py-2 text-center text-gold">${(form.services.length || 2) * 997}/mo</td>
                      <td></td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* Proposal Sections */}
            <div className="card">
              <h2 className="text-sm font-semibold mb-3">Proposal Sections</h2>
              <div className="space-y-1.5">
                {sections.map(section => (
                  <div key={section.id} className={`flex items-center justify-between p-2.5 rounded-lg bg-surface-light border border-border ${!section.enabled ? "opacity-50" : ""}`}>
                    <div className="flex items-center gap-2">
                      <span className="text-[9px] text-muted w-5 text-center">{section.order}</span>
                      <span className="text-[10px] font-medium">{section.title}</span>
                    </div>
                    <button onClick={() => toggleSection(section.id)}
                      className={`w-8 h-4 rounded-full transition-all flex items-center ${section.enabled ? "bg-gold justify-end" : "bg-surface justify-start"}`}>
                      <div className="w-3 h-3 bg-white rounded-full mx-0.5 shadow" />
                    </button>
                  </div>
                ))}
              </div>
              <button className="btn-secondary text-xs mt-3 flex items-center gap-1.5"><Plus size={10} /> Add Custom Section</button>
            </div>
          </div>

          {/* Right sidebar */}
          <div className="space-y-4">
            {/* Generate Button */}
            <div className="card border-gold/10 text-center p-5 relative overflow-hidden">
              <div className="w-14 h-14 bg-gold/10 rounded-2xl flex items-center justify-center mx-auto mb-3">
                <Sparkles size={24} className="text-gold" />
              </div>
              <h3 className="text-sm font-semibold mb-1">Generate Proposal</h3>
              <p className="text-[10px] text-muted mb-4">AI writes a custom PDF proposal</p>
              <button className="btn-primary w-full text-xs flex items-center justify-center gap-1.5 disabled:opacity-50">
                <Sparkles size={12} /> Generate PDF Proposal
              </button>
            </div>

            {/* Client Branding */}
            <div className="card">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-xs font-semibold flex items-center gap-1.5"><Palette size={12} /> Client Branding</h3>
                <button onClick={() => setShowBranding(!showBranding)} className="text-[9px] text-gold">{showBranding ? "Collapse" : "Expand"}</button>
              </div>
              {showBranding && (
                <div className="space-y-2">
                  <input value={branding.company} onChange={e => setBranding({ ...branding, company: e.target.value })} className="input w-full text-xs" placeholder="Company name" />
                  <div className="flex items-center gap-2">
                    <label className="text-[9px] text-muted">Brand Color:</label>
                    <input type="color" value={branding.color} onChange={e => setBranding({ ...branding, color: e.target.value })} className="w-6 h-6 rounded cursor-pointer" />
                    <span className="text-[9px] font-mono text-muted">{branding.color}</span>
                  </div>
                  <div className="border-2 border-dashed border-border rounded-lg p-4 text-center">
                    <p className="text-[9px] text-muted">Drop logo here or click to upload</p>
                  </div>
                </div>
              )}
            </div>

            {/* PDF Export + Actions */}
            <div className="card space-y-2">
              <h3 className="text-xs font-semibold">Actions</h3>
              <button className="btn-secondary w-full text-xs flex items-center justify-center gap-1.5"><Download size={12} /> Export as PDF</button>
              <button className="btn-secondary w-full text-xs flex items-center justify-center gap-1.5"><Send size={12} /> Email to Client</button>
              <button className="btn-secondary w-full text-xs flex items-center justify-center gap-1.5"><Copy size={12} /> Copy Shareable Link</button>
              <button className="btn-secondary w-full text-xs flex items-center justify-center gap-1.5"><Eye size={12} /> Preview Live</button>
            </div>

            {/* Auto Follow-up */}
            <div className="card">
              <h3 className="text-xs font-semibold mb-2 flex items-center gap-1.5"><Clock size={12} /> Auto Follow-up</h3>
              <div className="space-y-1.5">
                {[
                  { delay: "3 days", action: "Send reminder email if not viewed" },
                  { delay: "7 days", action: "Send follow-up with urgency" },
                  { delay: "14 days", action: "Mark as expired if no action" },
                ].map((rule, i) => (
                  <div key={i} className="flex items-center gap-2 text-[9px] p-2 rounded bg-surface-light">
                    <Clock size={9} className="text-gold" />
                    <span className="text-gold font-semibold">{rule.delay}</span>
                    <span className="text-muted">{rule.action}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ===== TEMPLATE GALLERY ===== */}
      {activeTab === "templates" && (
        <div className="space-y-4">
          <h3 className="text-sm font-semibold">Proposal Template Styles</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {TEMPLATE_STYLES.map(style => (
              <div key={style.id} onClick={() => setSelectedStyle(style.id)}
                className={`p-4 rounded-xl border cursor-pointer transition-all ${
                  selectedStyle === style.id ? "border-gold/30 bg-gold/5" : "border-border bg-surface-light hover:border-gold/10"
                }`}>
                <div className="h-32 rounded-lg mb-3 flex items-center justify-center" style={{ background: `${style.color}15`, border: `2px solid ${style.color}30` }}>
                  <p className="text-sm font-bold" style={{ color: style.color }}>{style.preview}</p>
                </div>
                <p className="text-xs font-semibold">{style.name}</p>
                <p className="text-[10px] text-muted mt-0.5">{style.description}</p>
                {selectedStyle === style.id && <p className="text-[9px] text-gold mt-1 flex items-center gap-1"><CheckCircle size={9} /> Selected</p>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ===== PROPOSAL TRACKING ===== */}
      {activeTab === "tracking" && (
        <div className="space-y-4">
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <Eye size={14} className="text-gold" /> Proposal Tracking
          </h3>
          <div className="space-y-2">
            {MOCK_PROPOSALS.map(p => (
              <div key={p.id} className="card p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                    p.status === "accepted" ? "bg-green-400/10" : p.status === "viewed" ? "bg-blue-400/10" : p.status === "declined" ? "bg-red-400/10" : "bg-surface-light"
                  }`}>
                    {p.status === "accepted" ? <CheckCircle size={16} className="text-green-400" /> :
                     p.status === "viewed" ? <Eye size={16} className="text-blue-400" /> :
                     p.status === "declined" ? <X size={16} className="text-red-400" /> :
                     <Clock size={16} className="text-muted" />}
                  </div>
                  <div>
                    <p className="text-xs font-semibold">{p.client}</p>
                    <p className="text-[10px] text-muted">{p.services.join(", ")} | {p.amount}</p>
                  </div>
                </div>
                <div className="flex items-center gap-6 text-[10px]">
                  <div className="text-center">
                    <p className="font-bold">{p.views}</p>
                    <p className="text-[8px] text-muted">Views</p>
                  </div>
                  <div className="text-center">
                    <p className="font-bold">{p.timeSpent}</p>
                    <p className="text-[8px] text-muted">Time Spent</p>
                  </div>
                  <div className="text-center">
                    <p className="font-bold text-muted">{p.sentDate}</p>
                    <p className="text-[8px] text-muted">Sent</p>
                  </div>
                  <span className={`text-[9px] px-2 py-0.5 rounded-full ${
                    p.status === "accepted" ? "bg-green-400/10 text-green-400" :
                    p.status === "viewed" ? "bg-blue-400/10 text-blue-400" :
                    p.status === "declined" ? "bg-red-400/10 text-red-400" :
                    p.status === "expired" ? "bg-muted/10 text-muted" :
                    "bg-yellow-400/10 text-yellow-400"
                  }`}>{p.status}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ===== VERSION HISTORY ===== */}
      {activeTab === "history" && (
        <div className="space-y-4">
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <Layers size={14} className="text-gold" /> Proposal Version History
          </h3>
          {MOCK_PROPOSALS.filter(p => p.version > 1).map(p => (
            <div key={p.id} className="card">
              <p className="text-xs font-semibold mb-3">{p.client} - {p.amount}</p>
              <div className="space-y-1.5">
                {Array.from({ length: p.version }, (_, i) => p.version - i).map(v => (
                  <div key={v} className="flex items-center justify-between p-2 rounded bg-surface-light text-[10px]">
                    <div className="flex items-center gap-2">
                      <div className={`w-2 h-2 rounded-full ${v === p.version ? "bg-gold" : "bg-muted"}`} />
                      <span className={v === p.version ? "font-semibold" : "text-muted"}>Version {v}</span>
                      {v === p.version && <span className="text-[8px] px-1 py-0.5 rounded bg-gold/10 text-gold">Current</span>}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-muted">{v === p.version ? p.sentDate : `Mar ${20 + v}`}</span>
                      {v !== p.version && <button className="text-[9px] px-2 py-0.5 rounded bg-white/5 text-muted hover:text-gold">Restore</button>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ===== ANALYTICS ===== */}
      {activeTab === "analytics" && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="card">
              <h3 className="text-sm font-semibold mb-3">Proposal Performance</h3>
              <div className="space-y-3">
                {[
                  { label: "View-to-Accept Rate", value: `${viewed > 0 ? Math.round((accepted / viewed) * 100) : 0}%`, bar: viewed > 0 ? (accepted / viewed) * 100 : 0 },
                  { label: "Avg Time to Decision", value: "4.2 days", bar: 58 },
                  { label: "Most Viewed Section", value: "Pricing (92%)", bar: 92 },
                  { label: "Avg Sections Read", value: "6.4 / 9", bar: 71 },
                ].map((m, i) => (
                  <div key={i}>
                    <div className="flex justify-between text-[10px] mb-1">
                      <span>{m.label}</span>
                      <span className="text-gold font-bold">{m.value}</span>
                    </div>
                    <div className="w-full bg-surface-light rounded-full h-1.5">
                      <div className="bg-gold rounded-full h-1.5" style={{ width: `${m.bar}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="card">
              <h3 className="text-sm font-semibold mb-3">Revenue from Proposals</h3>
              <div className="space-y-2">
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-surface-light rounded-lg p-3 text-center">
                    <p className="text-xl font-bold text-gold">$16,885</p>
                    <p className="text-[9px] text-muted">Monthly from accepted</p>
                  </div>
                  <div className="bg-surface-light rounded-lg p-3 text-center">
                    <p className="text-xl font-bold text-purple-400">$202,620</p>
                    <p className="text-[9px] text-muted">Annual projected</p>
                  </div>
                </div>
                <div className="bg-surface-light rounded-lg p-3 text-center">
                  <p className="text-xl font-bold text-muted">$11,888</p>
                  <p className="text-[9px] text-muted">Lost from declined/expired</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ===== ACCEPTANCE FLOW ===== */}
      {activeTab === "acceptance" && (
        <div className="space-y-4">
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <CheckCircle size={14} className="text-gold" /> Proposal Acceptance Flow
          </h3>
          <div className="card">
            <p className="text-[10px] text-muted mb-4">Configure what happens when a client views, accepts, or declines a proposal.</p>
            <div className="space-y-3">
              {[
                { trigger: "Client opens proposal link", action: "Send notification to Slack + mark as 'Viewed'", icon: <Eye size={14} className="text-blue-400" /> },
                { trigger: "Client spends 5+ minutes reading", action: "Flag as highly interested + notify team", icon: <Clock size={14} className="text-purple-400" /> },
                { trigger: "Client clicks 'Accept & Sign'", action: "Collect digital signature + generate contract + send welcome email", icon: <CheckCircle size={14} className="text-green-400" /> },
                { trigger: "Client clicks 'Decline'", action: "Ask for reason + schedule follow-up call", icon: <X size={14} className="text-red-400" /> },
                { trigger: "Proposal expires (14 days)", action: "Send 'last chance' email + mark as expired", icon: <AlertTriangle size={14} className="text-yellow-400" /> },
              ].map((step, i) => (
                <div key={i} className="flex items-start gap-3 p-3 rounded-lg bg-surface-light">
                  <div className="w-10 h-10 rounded-lg bg-surface flex items-center justify-center flex-shrink-0">{step.icon}</div>
                  <div>
                    <p className="text-xs font-semibold">{step.trigger}</p>
                    <p className="text-[10px] text-muted">{step.action}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Digital Signature */}
          <div className="card">
            <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
              <Edit3 size={14} className="text-gold" /> Digital Signature
            </h3>
            <p className="text-[10px] text-muted mb-3">Clients can sign proposals digitally. No PDFs or printing needed.</p>
            <div className="border-2 border-dashed border-border rounded-lg p-8 text-center">
              <p className="text-sm text-muted italic">Signature preview area</p>
              <p className="text-[9px] text-muted mt-1">Clients draw or type their signature here</p>
            </div>
            <div className="flex gap-2 mt-3">
              <button className="btn-secondary text-xs flex-1">Type Signature</button>
              <button className="btn-secondary text-xs flex-1">Draw Signature</button>
              <button className="btn-primary text-xs flex-1">Upload Signature</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
