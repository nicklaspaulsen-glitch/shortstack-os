"use client";

import { useState } from "react";
import {
  FileText, Sparkles, Building, DollarSign,
  Plus, Eye, Clock, CheckCircle, Download, Send,
  Palette, BarChart3, Edit3, Copy, Layers, TrendingUp,
  X, ChevronRight, Trash2,
  FileCheck, Calendar, PenTool, Star
} from "lucide-react";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */
type MainTab = "list" | "builder" | "preview" | "templates" | "analytics";

type ProposalStatus = "draft" | "sent" | "viewed" | "accepted" | "declined";

interface Proposal {
  id: string;
  client: string;
  projectTitle: string;
  date: string;
  status: ProposalStatus;
  amount: number;
  views: number;
  lastViewed: string | null;
  signedDate: string | null;
}

interface LineItem {
  id: string;
  service: string;
  hours: number;
  rate: number;
}

interface ProposalSection {
  id: string;
  type: string;
  title: string;
  content: string;
  enabled: boolean;
}

/* ------------------------------------------------------------------ */
/*  Mock Data                                                          */
/* ------------------------------------------------------------------ */
const MOCK_PROPOSALS: Proposal[] = [];

const STATUS_CONFIG: Record<ProposalStatus, { label: string; color: string; bg: string }> = {
  draft: { label: "Draft", color: "text-muted", bg: "bg-white/5" },
  sent: { label: "Sent", color: "text-blue-400", bg: "bg-blue-400/10" },
  viewed: { label: "Viewed", color: "text-purple-400", bg: "bg-purple-400/10" },
  accepted: { label: "Accepted", color: "text-green-400", bg: "bg-green-400/10" },
  declined: { label: "Declined", color: "text-red-400", bg: "bg-red-400/10" },
};

const DEFAULT_SECTIONS: ProposalSection[] = [
  { id: "s1", type: "summary", title: "Executive Summary", content: "", enabled: true },
  { id: "s2", type: "scope", title: "Scope of Work", content: "", enabled: true },
  { id: "s3", type: "pricing", title: "Pricing Table", content: "", enabled: true },
  { id: "s4", type: "timeline", title: "Timeline & Milestones", content: "", enabled: true },
  { id: "s5", type: "terms", title: "Terms & Conditions", content: "", enabled: true },
];

const TEMPLATE_STYLES = [
  { id: "t1", name: "Modern Minimal", desc: "Clean white-space, professional", color: "#c8a855" },
  { id: "t2", name: "Bold & Dark", desc: "Dark theme with gold accents", color: "#1a1a2e" },
  { id: "t3", name: "Corporate Blue", desc: "Traditional business style", color: "#3b82f6" },
  { id: "t4", name: "Startup Fresh", desc: "Colorful modern aesthetic", color: "#10b981" },
];

const fmtCurrency = (n: number) => "$" + n.toLocaleString();

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */
export default function ProposalsPage() {
  const [activeTab, setActiveTab] = useState<MainTab>("list");
  const [proposals, setProposals] = useState<Proposal[]>(MOCK_PROPOSALS);
  const [statusFilter, setStatusFilter] = useState<ProposalStatus | "all">("all");
  const [selectedStyle, setSelectedStyle] = useState("t1");

  // Builder state
  const [builderClient, setBuilderClient] = useState("");
  const [builderProject, setBuilderProject] = useState("");
  const [builderDate, setBuilderDate] = useState("2026-04-15");
  const [sections, setSections] = useState<ProposalSection[]>(DEFAULT_SECTIONS);
  const [lineItems, setLineItems] = useState<LineItem[]>([]);
  const [aiGenerating, setAiGenerating] = useState<string | null>(null);
  const [aiBrief, setAiBrief] = useState("");

  // e-Sign state
  const [signatureName, setSignatureName] = useState("");
  const [signatureAgreed, setSignatureAgreed] = useState(false);

  // Preview state
  const [previewProposal, setPreviewProposal] = useState<Proposal | null>(null);

  // Send modal
  const [showSendModal, setShowSendModal] = useState(false);
  const [sendEmail, setSendEmail] = useState("");
  const [sendMessage, setSendMessage] = useState("Hi, please review the attached proposal at your convenience.");

  /* ------- Derived ------- */
  const filtered = statusFilter === "all" ? proposals : proposals.filter(p => p.status === statusFilter);
  const totalValue = proposals.reduce((s, p) => s + p.amount, 0);
  const accepted = proposals.filter(p => p.status === "accepted");
  const wonValue = accepted.reduce((s, p) => s + p.amount, 0);
  const convRate = proposals.length > 0 ? Math.round((accepted.length / proposals.length) * 100) : 0;
  const pending = proposals.filter(p => p.status === "sent" || p.status === "viewed");
  const lineTotal = lineItems.reduce((s, li) => s + li.hours * li.rate, 0);

  /* ------- Handlers ------- */
  const addLineItem = () => {
    setLineItems(prev => [...prev, { id: `li${Date.now()}`, service: "", hours: 0, rate: 0 }]);
  };
  const removeLineItem = (id: string) => {
    setLineItems(prev => prev.filter(li => li.id !== id));
  };
  const updateLineItem = (id: string, field: keyof LineItem, value: string | number) => {
    setLineItems(prev => prev.map(li => li.id === id ? { ...li, [field]: value } : li));
  };

  const toggleSection = (id: string) => {
    setSections(prev => prev.map(s => s.id === id ? { ...s, enabled: !s.enabled } : s));
  };

  const updateSectionContent = (id: string, content: string) => {
    setSections(prev => prev.map(s => s.id === id ? { ...s, content } : s));
  };

  const handleAiGenerate = (sectionId: string) => {
    setAiGenerating(sectionId);
    setTimeout(() => {
      const generated: Record<string, string> = {
        s1: `We propose a comprehensive digital strategy for ${builderClient || "your organization"} focused on driving measurable growth. Our approach combines data-driven marketing with creative excellence to deliver results within the first 90 days.`,
        s2: `Phase 1: Discovery & audit of current digital presence. Phase 2: Strategy development and asset creation. Phase 3: Launch campaigns across selected channels. Phase 4: Ongoing optimization with monthly reporting and ROI tracking.`,
        s3: "See pricing table below for detailed line-item breakdown.",
        s4: `Week 1-2: Onboarding & discovery. Week 3-4: Strategy presentation. Week 5-8: Asset creation & campaign setup. Week 9-12: Launch & initial optimization. Ongoing: Monthly reporting & continuous improvement.`,
        s5: "Payment terms: 50% upfront, 50% upon project completion. Monthly retainers billed on the 1st. 30-day cancellation notice required. All work remains property of client upon final payment.",
      };
      updateSectionContent(sectionId, generated[sectionId] || "Generated content placeholder.");
      setAiGenerating(null);
    }, 1200);
  };

  const handleSendProposal = () => {
    if (!builderClient || !builderProject) return;
    const newProposal: Proposal = {
      id: `p${Date.now()}`,
      client: builderClient,
      projectTitle: builderProject,
      date: builderDate,
      status: "sent",
      amount: lineTotal,
      views: 0,
      lastViewed: null,
      signedDate: null,
    };
    setProposals(prev => [newProposal, ...prev]);
    setShowSendModal(false);
    setActiveTab("list");
  };

  const openPreview = (p: Proposal) => {
    setPreviewProposal(p);
    setActiveTab("preview");
  };

  /* ------- Tabs ------- */
  const TABS: { key: MainTab; label: string; icon: React.ReactNode }[] = [
    { key: "list", label: "All Proposals", icon: <FileText size={14} /> },
    { key: "builder", label: "Proposal Builder", icon: <PenTool size={14} /> },
    { key: "preview", label: "Preview", icon: <Eye size={14} /> },
    { key: "templates", label: "Templates", icon: <Palette size={14} /> },
    { key: "analytics", label: "Analytics", icon: <BarChart3 size={14} /> },
  ];

  return (
    <div className="fade-in space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-header mb-0 flex items-center gap-2">
            <FileText size={18} className="text-gold" /> Proposals
          </h1>
          <p className="text-xs text-muted mt-0.5">Build, send, track, and close proposals</p>
        </div>
        <button onClick={() => setActiveTab("builder")} className="btn-primary text-xs flex items-center gap-1.5">
          <Plus size={12} /> New Proposal
        </button>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {[
          { label: "Total Proposals", value: proposals.length, icon: <FileText size={12} />, color: "text-gold" },
          { label: "Pipeline Value", value: fmtCurrency(totalValue), icon: <DollarSign size={12} />, color: "text-blue-400" },
          { label: "Won Value", value: fmtCurrency(wonValue), icon: <CheckCircle size={12} />, color: "text-green-400" },
          { label: "Conversion Rate", value: `${convRate}%`, icon: <TrendingUp size={12} />, color: "text-purple-400" },
          { label: "Pending Review", value: pending.length, icon: <Clock size={12} />, color: "text-gold" },
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

      {/* ============================================================ */}
      {/*  LIST VIEW                                                    */}
      {/* ============================================================ */}
      {activeTab === "list" && (
        <div className="space-y-4">
          {/* Status filter pills */}
          <div className="flex gap-1.5 flex-wrap">
            {(["all", "draft", "sent", "viewed", "accepted", "declined"] as const).map(s => {
              const count = s === "all" ? proposals.length : proposals.filter(p => p.status === s).length;
              return (
                <button key={s} onClick={() => setStatusFilter(s)}
                  className={`px-3 py-1.5 text-[10px] rounded-lg border transition-all capitalize ${
                    statusFilter === s ? "bg-gold/10 border-gold/20 text-gold font-medium" : "border-border text-muted hover:border-gold/10"
                  }`}>
                  {s === "all" ? "All" : STATUS_CONFIG[s].label} ({count})
                </button>
              );
            })}
          </div>

          {/* Proposal cards */}
          <div className="space-y-2">
            {filtered.map(p => {
              const cfg = STATUS_CONFIG[p.status];
              return (
                <div key={p.id} className="card p-4 flex items-center justify-between group">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${cfg.bg}`}>
                      {p.status === "accepted" ? <CheckCircle size={16} className={cfg.color} /> :
                       p.status === "viewed" ? <Eye size={16} className={cfg.color} /> :
                       p.status === "declined" ? <X size={16} className={cfg.color} /> :
                       p.status === "sent" ? <Send size={16} className={cfg.color} /> :
                       <Edit3 size={16} className={cfg.color} />}
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-semibold truncate">{p.client}</p>
                      <p className="text-[10px] text-muted truncate">{p.projectTitle}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-5 text-[10px] flex-shrink-0">
                    <div className="text-center hidden sm:block">
                      <p className="font-bold text-gold">{fmtCurrency(p.amount)}</p>
                      <p className="text-[8px] text-muted">Value</p>
                    </div>
                    <div className="text-center hidden md:block">
                      <p className="font-bold">{p.views}</p>
                      <p className="text-[8px] text-muted">Views</p>
                    </div>
                    <div className="text-center hidden md:block">
                      <p className="font-bold text-muted">{p.date}</p>
                      <p className="text-[8px] text-muted">Created</p>
                    </div>
                    <span className={`text-[9px] px-2.5 py-1 rounded-full font-medium ${cfg.bg} ${cfg.color}`}>
                      {cfg.label}
                    </span>
                    <button onClick={() => openPreview(p)} className="opacity-0 group-hover:opacity-100 transition-opacity text-muted hover:text-gold">
                      <ChevronRight size={14} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/*  PROPOSAL BUILDER                                             */}
      {/* ============================================================ */}
      {activeTab === "builder" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Main builder area */}
          <div className="lg:col-span-2 space-y-4">
            {/* Client & Project Details */}
            <div className="card space-y-3">
              <h2 className="text-sm font-semibold flex items-center gap-2">
                <Building size={14} className="text-gold" /> Client & Project Details
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[9px] text-muted mb-1 uppercase tracking-wider">Client Name *</label>
                  <input value={builderClient} onChange={e => setBuilderClient(e.target.value)}
                    className="input w-full text-xs" placeholder="e.g., Bright Smile Dental" />
                </div>
                <div>
                  <label className="block text-[9px] text-muted mb-1 uppercase tracking-wider">Project Title *</label>
                  <input value={builderProject} onChange={e => setBuilderProject(e.target.value)}
                    className="input w-full text-xs" placeholder="e.g., Full Marketing Package" />
                </div>
                <div>
                  <label className="block text-[9px] text-muted mb-1 uppercase tracking-wider">Date</label>
                  <input type="date" value={builderDate} onChange={e => setBuilderDate(e.target.value)}
                    className="input w-full text-xs" />
                </div>
              </div>
            </div>

            {/* Sections with AI generate */}
            <div className="card space-y-3">
              <h2 className="text-sm font-semibold flex items-center gap-2">
                <Layers size={14} className="text-gold" /> Proposal Sections
              </h2>
              {sections.map(section => (
                <div key={section.id} className={`rounded-xl border p-3 transition-all ${
                  section.enabled ? "border-border bg-surface-light" : "border-border/50 opacity-50"
                }`}>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <button onClick={() => toggleSection(section.id)}
                        className={`w-8 h-4 rounded-full transition-all flex items-center ${
                          section.enabled ? "bg-gold justify-end" : "bg-surface justify-start"
                        }`}>
                        <div className="w-3 h-3 bg-white rounded-full mx-0.5 shadow" />
                      </button>
                      <span className="text-[11px] font-semibold">{section.title}</span>
                    </div>
                    {section.enabled && section.type !== "pricing" && (
                      <button onClick={() => handleAiGenerate(section.id)}
                        disabled={aiGenerating === section.id}
                        className="text-[9px] text-gold flex items-center gap-1 hover:underline disabled:opacity-50">
                        <Sparkles size={10} />
                        {aiGenerating === section.id ? "Generating..." : "AI Generate"}
                      </button>
                    )}
                  </div>
                  {section.enabled && section.type !== "pricing" && (
                    <div>
                      {!section.content && (
                        <div className="mb-2">
                          <input value={aiBrief} onChange={e => setAiBrief(e.target.value)}
                            className="input w-full text-[10px]"
                            placeholder="Optional: describe what this section should cover..." />
                        </div>
                      )}
                      <textarea
                        value={section.content}
                        onChange={e => updateSectionContent(section.id, e.target.value)}
                        className="input w-full text-[10px] h-20 resize-none"
                        placeholder={`Write or AI-generate ${section.title.toLowerCase()} content...`}
                      />
                    </div>
                  )}
                  {section.enabled && section.type === "pricing" && (
                    <p className="text-[9px] text-muted">Pricing is managed in the table below.</p>
                  )}
                </div>
              ))}
            </div>

            {/* Pricing Line Items */}
            <div className="card">
              <h2 className="text-sm font-semibold mb-3 flex items-center gap-2">
                <DollarSign size={14} className="text-gold" /> Pricing Table
              </h2>
              <div className="overflow-x-auto">
                <table className="w-full text-[10px]">
                  <thead>
                    <tr className="text-[9px] text-muted uppercase tracking-wider border-b border-border">
                      <th className="text-left py-2 pr-2">Service</th>
                      <th className="text-center py-2 w-20">Hours</th>
                      <th className="text-center py-2 w-24">Rate ($/hr)</th>
                      <th className="text-center py-2 w-24">Total</th>
                      <th className="w-8"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {lineItems.map(li => (
                      <tr key={li.id} className="border-b border-border/50">
                        <td className="py-2 pr-2">
                          <input value={li.service}
                            onChange={e => updateLineItem(li.id, "service", e.target.value)}
                            className="input w-full text-[10px]" placeholder="Service name" />
                        </td>
                        <td className="py-2">
                          <input type="number" value={li.hours}
                            onChange={e => updateLineItem(li.id, "hours", Number(e.target.value))}
                            className="input w-full text-[10px] text-center" />
                        </td>
                        <td className="py-2">
                          <input type="number" value={li.rate}
                            onChange={e => updateLineItem(li.id, "rate", Number(e.target.value))}
                            className="input w-full text-[10px] text-center" />
                        </td>
                        <td className="py-2 text-center font-bold text-gold">
                          {fmtCurrency(li.hours * li.rate)}
                        </td>
                        <td className="py-2">
                          <button onClick={() => removeLineItem(li.id)} className="text-muted hover:text-red-400">
                            <Trash2 size={10} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="font-bold text-xs">
                      <td className="py-3" colSpan={3}>Total</td>
                      <td className="py-3 text-center text-gold text-sm">{fmtCurrency(lineTotal)}</td>
                      <td></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
              <button onClick={addLineItem} className="btn-secondary text-xs mt-3 flex items-center gap-1.5">
                <Plus size={10} /> Add Line Item
              </button>
            </div>

            {/* e-Sign Placeholder */}
            <div className="card">
              <h2 className="text-sm font-semibold mb-3 flex items-center gap-2">
                <Edit3 size={14} className="text-gold" /> e-Signature
              </h2>
              <p className="text-[10px] text-muted mb-3">Client signs digitally when they accept the proposal.</p>
              <div className="border-2 border-dashed border-border rounded-xl p-6 text-center mb-3">
                <p className="text-sm text-muted italic font-serif">
                  {signatureName || "Client Signature"}
                </p>
                <div className="w-48 mx-auto mt-2 border-b border-muted/30" />
                <p className="text-[9px] text-muted mt-1">Signature Line</p>
              </div>
              <div className="flex gap-3 items-end">
                <div className="flex-1">
                  <label className="block text-[9px] text-muted mb-1 uppercase tracking-wider">Signer Full Name</label>
                  <input value={signatureName} onChange={e => setSignatureName(e.target.value)}
                    className="input w-full text-xs" placeholder="John Smith" />
                </div>
                <label className="flex items-center gap-2 text-[10px] text-muted cursor-pointer pb-2">
                  <input type="checkbox" checked={signatureAgreed}
                    onChange={e => setSignatureAgreed(e.target.checked)}
                    className="rounded" />
                  I agree to the terms
                </label>
              </div>
            </div>
          </div>

          {/* Right Sidebar */}
          <div className="space-y-4">
            {/* Send Proposal CTA */}
            <div className="card border-gold/10 text-center p-5 relative overflow-hidden">
              <div className="w-14 h-14 bg-gold/10 rounded-2xl flex items-center justify-center mx-auto mb-3">
                <Send size={24} className="text-gold" />
              </div>
              <h3 className="text-sm font-semibold mb-1">Ready to Send?</h3>
              <p className="text-[10px] text-muted mb-1">Total Value: <span className="text-gold font-bold">{fmtCurrency(lineTotal)}</span></p>
              <p className="text-[10px] text-muted mb-4">{sections.filter(s => s.enabled).length} sections enabled</p>
              <button
                onClick={() => setShowSendModal(true)}
                disabled={!builderClient || !builderProject}
                className="btn-primary w-full text-xs flex items-center justify-center gap-1.5 disabled:opacity-40">
                <Send size={12} /> Send Proposal
              </button>
            </div>

            {/* Actions */}
            <div className="card space-y-2">
              <h3 className="text-xs font-semibold">Quick Actions</h3>
              <button className="btn-secondary w-full text-xs flex items-center justify-center gap-1.5"><Download size={12} /> Export as PDF</button>
              <button className="btn-secondary w-full text-xs flex items-center justify-center gap-1.5"><Copy size={12} /> Copy Link</button>
              <button onClick={() => setActiveTab("preview")} className="btn-secondary w-full text-xs flex items-center justify-center gap-1.5"><Eye size={12} /> Preview</button>
            </div>

            {/* Status Tracking */}
            <div className="card">
              <h3 className="text-xs font-semibold mb-2 flex items-center gap-1.5">
                <BarChart3 size={12} className="text-gold" /> Status Tracking
              </h3>
              <div className="space-y-1.5">
                {[
                  { step: "Created", done: true },
                  { step: "Sections Written", done: sections.some(s => s.content.length > 0) },
                  { step: "Pricing Added", done: lineItems.length > 0 },
                  { step: "Sent to Client", done: false },
                  { step: "Client Opened", done: false },
                  { step: "Client Signed", done: false },
                ].map((s, i) => (
                  <div key={i} className="flex items-center gap-2 text-[10px] p-2 rounded-lg bg-surface-light">
                    {s.done
                      ? <CheckCircle size={12} className="text-green-400" />
                      : <div className="w-3 h-3 rounded-full border border-border" />
                    }
                    <span className={s.done ? "text-foreground" : "text-muted"}>{s.step}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Auto Follow-up */}
            <div className="card">
              <h3 className="text-xs font-semibold mb-2 flex items-center gap-1.5"><Clock size={12} /> Follow-up Rules</h3>
              <div className="space-y-1.5">
                {[
                  { delay: "3 days", action: "Reminder if not viewed" },
                  { delay: "7 days", action: "Follow-up with urgency" },
                  { delay: "14 days", action: "Mark as expired" },
                ].map((rule, i) => (
                  <div key={i} className="flex items-center gap-2 text-[9px] p-2 rounded-lg bg-surface-light">
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

      {/* ============================================================ */}
      {/*  PREVIEW                                                      */}
      {/* ============================================================ */}
      {activeTab === "preview" && (
        <div className="max-w-3xl mx-auto space-y-4">
          <div className="card p-8 space-y-6" style={{ background: "var(--color-surface)", borderColor: "var(--color-border)" }}>
            {/* Letterhead */}
            <div className="border-b border-border pb-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold tracking-tight">PROPOSAL</h2>
                  <p className="text-[10px] text-muted mt-1">ShortStack Digital Agency</p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-muted">Prepared for</p>
                  <p className="text-sm font-bold text-gold">{previewProposal?.client || builderClient || "Client Name"}</p>
                  <p className="text-[10px] text-muted mt-1">{previewProposal?.date || builderDate}</p>
                </div>
              </div>
              <div className="mt-3 h-1 w-24 rounded-full bg-gold" />
            </div>

            {/* Project Title */}
            <div>
              <p className="text-[9px] text-muted uppercase tracking-widest">Project</p>
              <h3 className="text-lg font-bold mt-0.5">{previewProposal?.projectTitle || builderProject || "Project Title"}</h3>
            </div>

            {/* Sections */}
            {sections.filter(s => s.enabled && s.type !== "pricing").map(section => (
              <div key={section.id} className="space-y-1">
                <h4 className="text-xs font-bold uppercase tracking-wider text-gold">{section.title}</h4>
                <p className="text-[11px] text-muted leading-relaxed">
                  {section.content || `[${section.title} content will appear here]`}
                </p>
              </div>
            ))}

            {/* Pricing in Preview */}
            {sections.find(s => s.type === "pricing" && s.enabled) && (
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-gold mb-2">Investment</h4>
                <table className="w-full text-[10px]">
                  <thead>
                    <tr className="border-b border-border text-[9px] text-muted uppercase">
                      <th className="text-left py-2">Service</th>
                      <th className="text-center py-2">Hours</th>
                      <th className="text-center py-2">Rate</th>
                      <th className="text-right py-2">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lineItems.map(li => (
                      <tr key={li.id} className="border-b border-border/30">
                        <td className="py-2">{li.service || "Service"}</td>
                        <td className="py-2 text-center">{li.hours}</td>
                        <td className="py-2 text-center">{fmtCurrency(li.rate)}/hr</td>
                        <td className="py-2 text-right font-semibold">{fmtCurrency(li.hours * li.rate)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr>
                      <td colSpan={3} className="py-3 text-right font-bold text-xs">Total Investment</td>
                      <td className="py-3 text-right text-sm font-bold text-gold">{fmtCurrency(previewProposal?.amount || lineTotal)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}

            {/* Signature Block */}
            <div className="border-t border-border pt-6 mt-6">
              <h4 className="text-xs font-bold uppercase tracking-wider text-gold mb-4">Acceptance & Signature</h4>
              <div className="grid grid-cols-2 gap-8">
                <div>
                  <p className="text-[9px] text-muted mb-8">Agency Representative</p>
                  <div className="border-b border-muted/30 mb-1" />
                  <p className="text-[10px]">ShortStack Agency</p>
                  <p className="text-[9px] text-muted">Date: {builderDate}</p>
                </div>
                <div>
                  <p className="text-[9px] text-muted mb-8">Client Signature</p>
                  <div className="border-b border-muted/30 mb-1" />
                  <p className="text-[10px]">{signatureName || "________________________"}</p>
                  <p className="text-[9px] text-muted">Date: _______________</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/*  TEMPLATES                                                    */}
      {/* ============================================================ */}
      {activeTab === "templates" && (
        <div className="space-y-4">
          <h3 className="text-sm font-semibold">Choose a Template Style</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {TEMPLATE_STYLES.map(style => (
              <div key={style.id} onClick={() => setSelectedStyle(style.id)}
                className={`p-4 rounded-2xl border cursor-pointer transition-all ${
                  selectedStyle === style.id ? "border-gold/30 bg-gold/5" : "border-border bg-surface-light hover:border-gold/10"
                }`}>
                <div className="h-28 rounded-lg mb-3 flex items-center justify-center"
                  style={{ background: `${style.color}15`, border: `2px solid ${style.color}30` }}>
                  <FileCheck size={24} style={{ color: style.color }} />
                </div>
                <p className="text-xs font-semibold">{style.name}</p>
                <p className="text-[10px] text-muted mt-0.5">{style.desc}</p>
                {selectedStyle === style.id && (
                  <p className="text-[9px] text-gold mt-1.5 flex items-center gap-1"><CheckCircle size={9} /> Selected</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/*  ANALYTICS                                                    */}
      {/* ============================================================ */}
      {activeTab === "analytics" && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Performance Metrics */}
            <div className="card">
              <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                <BarChart3 size={13} className="text-gold" /> Proposal Performance
              </h3>
              <div className="space-y-3">
                {[
                  { label: "View-to-Accept Rate", value: "57%", bar: 57 },
                  { label: "Avg Time to Decision", value: "3.8 days", bar: 48 },
                  { label: "Most Viewed Section", value: "Pricing (94%)", bar: 94 },
                  { label: "Avg Sections Read", value: "4.2 / 5", bar: 84 },
                ].map((m, i) => (
                  <div key={i}>
                    <div className="flex justify-between text-[10px] mb-1">
                      <span>{m.label}</span>
                      <span className="text-gold font-bold">{m.value}</span>
                    </div>
                    <div className="w-full bg-surface-light rounded-full h-1.5">
                      <div className="bg-gold rounded-full h-1.5 transition-all" style={{ width: `${m.bar}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Revenue from Proposals */}
            <div className="card">
              <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                <DollarSign size={13} className="text-green-400" /> Revenue from Proposals
              </h3>
              <div className="grid grid-cols-2 gap-3 mb-3">
                <div className="bg-surface-light rounded-xl p-3 text-center">
                  <p className="text-xl font-bold text-gold">{fmtCurrency(wonValue)}</p>
                  <p className="text-[9px] text-muted">Won revenue</p>
                </div>
                <div className="bg-surface-light rounded-xl p-3 text-center">
                  <p className="text-xl font-bold text-purple-400">{fmtCurrency(wonValue * 12)}</p>
                  <p className="text-[9px] text-muted">Annual projection</p>
                </div>
              </div>
              <div className="bg-surface-light rounded-xl p-3 text-center">
                <p className="text-xl font-bold text-muted">{fmtCurrency(proposals.filter(p => p.status === "declined").reduce((s, p) => s + p.amount, 0))}</p>
                <p className="text-[9px] text-muted">Lost from declined</p>
              </div>
            </div>
          </div>

          {/* Monthly trend - CSS bar chart */}
          <div className="card">
            <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
              <Calendar size={13} className="text-blue-400" /> Monthly Proposal Activity
            </h3>
            <div className="flex items-end gap-2 h-32">
              {[
                { month: "Jan", sent: 3, won: 1 },
                { month: "Feb", sent: 5, won: 3 },
                { month: "Mar", sent: 4, won: 2 },
                { month: "Apr", sent: 7, won: 2 },
              ].map((m, i) => (
                <div key={i} className="flex-1 flex flex-col items-center gap-1">
                  <div className="w-full flex gap-0.5 items-end justify-center" style={{ height: "100px" }}>
                    <div className="w-1/3 rounded-t bg-blue-400/60" style={{ height: `${(m.sent / 7) * 100}%`, minHeight: 4 }} />
                    <div className="w-1/3 rounded-t bg-green-400/60" style={{ height: `${(m.won / 7) * 100}%`, minHeight: 4 }} />
                  </div>
                  <span className="text-[8px] text-muted">{m.month}</span>
                </div>
              ))}
            </div>
            <div className="flex justify-center gap-4 mt-2">
              <span className="text-[9px] flex items-center gap-1"><div className="w-3 h-2 rounded bg-blue-400/60" /> Sent</span>
              <span className="text-[9px] flex items-center gap-1"><div className="w-3 h-2 rounded bg-green-400/60" /> Won</span>
            </div>
          </div>

          {/* Top proposals */}
          <div className="card">
            <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
              <Star size={13} className="text-gold" /> Top Proposals by Value
            </h3>
            <div className="space-y-2">
              {[...proposals].sort((a, b) => b.amount - a.amount).slice(0, 5).map((p, i) => {
                const maxAmt = Math.max(...proposals.map(pr => pr.amount), 1);
                const cfg = STATUS_CONFIG[p.status];
                return (
                  <div key={p.id} className="flex items-center gap-3">
                    <span className="text-[10px] text-muted w-4">#{i + 1}</span>
                    <div className="flex-1">
                      <div className="flex justify-between text-[10px] mb-0.5">
                        <span className="font-medium">{p.client}</span>
                        <span className="font-bold text-gold">{fmtCurrency(p.amount)}</span>
                      </div>
                      <div className="h-1.5 rounded-full bg-surface-light overflow-hidden">
                        <div className="h-full rounded-full bg-gold/70" style={{ width: `${(p.amount / maxAmt) * 100}%` }} />
                      </div>
                    </div>
                    <span className={`text-[8px] px-2 py-0.5 rounded-full ${cfg.bg} ${cfg.color}`}>{cfg.label}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/*  SEND MODAL                                                   */}
      {/* ============================================================ */}
      {showSendModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="card w-full max-w-md p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold flex items-center gap-2">
                <Send size={14} className="text-gold" /> Send Proposal
              </h3>
              <button onClick={() => setShowSendModal(false)} className="text-muted hover:text-foreground">
                <X size={16} />
              </button>
            </div>
            <div className="p-3 rounded-xl bg-surface-light text-[10px]">
              <p className="font-semibold">{builderClient}</p>
              <p className="text-muted">{builderProject} &middot; {fmtCurrency(lineTotal)}</p>
            </div>
            <div>
              <label className="block text-[9px] text-muted mb-1 uppercase tracking-wider">Recipient Email</label>
              <input value={sendEmail} onChange={e => setSendEmail(e.target.value)}
                className="input w-full text-xs" placeholder="client@company.com" />
            </div>
            <div>
              <label className="block text-[9px] text-muted mb-1 uppercase tracking-wider">Message</label>
              <textarea value={sendMessage} onChange={e => setSendMessage(e.target.value)}
                className="input w-full text-xs h-20 resize-none" />
            </div>
            <div className="flex gap-2">
              <button onClick={() => setShowSendModal(false)} className="btn-secondary flex-1 text-xs">Cancel</button>
              <button onClick={handleSendProposal} className="btn-primary flex-1 text-xs flex items-center justify-center gap-1.5">
                <Send size={12} /> Send Now
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
