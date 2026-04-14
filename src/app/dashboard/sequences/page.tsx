"use client";

import { useState } from "react";
import {
  Mail, Plus, Clock, Sparkles, Play, Pause, Trash2,
  ArrowDown, Phone, MessageSquare, Share2, GitBranch,
  Copy, BarChart3, Users, Target, Settings, Zap,
  CheckCircle, XCircle, Eye,
  ArrowRight
} from "lucide-react";

type MainTab = "builder" | "templates" | "analytics" | "enrollment" | "settings";

interface SequenceStep {
  id: string;
  type: "email" | "sms" | "call" | "social" | "wait" | "condition";
  subject?: string;
  body: string;
  delay_days: number;
  channel?: string;
  conditionType?: string;
  conditionValue?: string;
}

interface Sequence {
  id: string;
  name: string;
  steps: SequenceStep[];
  active: boolean;
  enrolled: number;
  completed: number;
  replied: number;
}

const TEMPLATE_LIBRARY: { name: string; description: string; steps: SequenceStep[]; category: string; performance: string }[] = [
  { name: "Cold Outreach (5 touches)", description: "Multi-channel cold outreach with email, SMS and social", category: "Outreach", performance: "6.8% reply rate",
    steps: [
      { id: "1", type: "email", subject: "Quick question about {business_name}", body: "Hey {name}, I came across {business_name}...", delay_days: 0 },
      { id: "2", type: "wait", body: "", delay_days: 3 },
      { id: "3", type: "email", subject: "Following up - {business_name}", body: "Hey {name}, Just bumping this...", delay_days: 0 },
      { id: "4", type: "wait", body: "", delay_days: 4 },
      { id: "5", type: "sms", body: "Hey {name}! Sent you a couple emails...", delay_days: 0 },
    ] },
  { name: "Post-Call Follow Up", description: "Nurture after discovery call with proposal", category: "Sales", performance: "12.4% reply rate",
    steps: [
      { id: "1", type: "email", subject: "Great talking today!", body: "Hey {name}, Really enjoyed our call...", delay_days: 0 },
      { id: "2", type: "wait", body: "", delay_days: 2 },
      { id: "3", type: "email", subject: "Proposal ready", body: "Here's the proposal we discussed...", delay_days: 0 },
    ] },
  { name: "Client Onboarding", description: "Welcome sequence for new clients", category: "Onboarding", performance: "32% completion",
    steps: [
      { id: "1", type: "email", subject: "Welcome to ShortStack!", body: "Welcome aboard!", delay_days: 0 },
      { id: "2", type: "wait", body: "", delay_days: 1 },
      { id: "3", type: "email", subject: "Your onboarding checklist", body: "Here's what we need...", delay_days: 0 },
    ] },
  { name: "Re-engagement", description: "Win back cold leads who went silent", category: "Nurture", performance: "4.2% reply rate",
    steps: [
      { id: "1", type: "email", subject: "Been a while, {name}", body: "Hey {name}, it's been a while...", delay_days: 0 },
      { id: "2", type: "wait", body: "", delay_days: 5 },
      { id: "3", type: "sms", body: "Hey {name}! Quick check-in...", delay_days: 0 },
    ] },
  { name: "Free Audit Offer", description: "Offer free marketing audit to prospects", category: "Outreach", performance: "8.1% reply rate",
    steps: [
      { id: "1", type: "email", subject: "Free audit for {business_name}", body: "I put together a free audit...", delay_days: 0 },
      { id: "2", type: "wait", body: "", delay_days: 3 },
      { id: "3", type: "email", subject: "Your audit is ready", body: "Did you see the audit...", delay_days: 0 },
      { id: "4", type: "wait", body: "", delay_days: 4 },
      { id: "5", type: "call", body: "Follow up call about audit results", delay_days: 0 },
    ] },
  { name: "Referral Ask", description: "Ask happy clients for referrals", category: "Retention", performance: "18% reply rate",
    steps: [
      { id: "1", type: "email", subject: "Quick favor, {name}?", body: "Love working with {business_name}...", delay_days: 0 },
      { id: "2", type: "wait", body: "", delay_days: 7 },
      { id: "3", type: "sms", body: "Hey {name}! Know anyone who needs marketing help?", delay_days: 0 },
    ] },
  { name: "Event Follow Up", description: "Follow up with contacts met at events", category: "Networking", performance: "15% reply rate",
    steps: [
      { id: "1", type: "email", subject: "Great meeting you!", body: "Hey {name}, loved chatting...", delay_days: 0 },
      { id: "2", type: "social", body: "Connect on LinkedIn", delay_days: 1, channel: "linkedin" },
      { id: "3", type: "wait", body: "", delay_days: 3 },
      { id: "4", type: "email", subject: "Following up from the event", body: "As I mentioned...", delay_days: 0 },
    ] },
  { name: "Case Study Drip", description: "Send relevant case studies over time", category: "Nurture", performance: "5.6% reply rate",
    steps: [
      { id: "1", type: "email", subject: "How we helped a {industry} business", body: "Check out this case study...", delay_days: 0 },
      { id: "2", type: "wait", body: "", delay_days: 7 },
      { id: "3", type: "email", subject: "Another {industry} success story", body: "Here's another one...", delay_days: 0 },
      { id: "4", type: "wait", body: "", delay_days: 7 },
      { id: "5", type: "email", subject: "Ready to be next?", body: "Want results like these?", delay_days: 0 },
    ] },
];

const STEP_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  email: { bg: "bg-blue-500/10", text: "text-blue-400", border: "border-blue-500/20" },
  sms: { bg: "bg-green-500/10", text: "text-green-400", border: "border-green-500/20" },
  call: { bg: "bg-yellow-500/10", text: "text-yellow-400", border: "border-yellow-500/20" },
  social: { bg: "bg-pink-500/10", text: "text-pink-400", border: "border-pink-500/20" },
  wait: { bg: "bg-gray-500/10", text: "text-gray-400", border: "border-border" },
  condition: { bg: "bg-purple-500/10", text: "text-purple-400", border: "border-purple-500/20" },
};

const STEP_ICONS: Record<string, React.ReactNode> = {
  email: <Mail size={12} />,
  sms: <MessageSquare size={12} />,
  call: <Phone size={12} />,
  social: <Share2 size={12} />,
  wait: <Clock size={12} />,
  condition: <GitBranch size={12} />,
};

export default function SequencesPage() {
  const [activeTab, setActiveTab] = useState<MainTab>("builder");
  const [sequences, setSequences] = useState<Sequence[]>([
    { id: "1", name: "Cold Outreach (5 touches)", steps: TEMPLATE_LIBRARY[0].steps, active: true, enrolled: 234, completed: 89, replied: 16 },
    { id: "2", name: "Post-Call Follow Up", steps: TEMPLATE_LIBRARY[1].steps, active: true, enrolled: 67, completed: 45, replied: 8 },
    { id: "3", name: "Client Onboarding", steps: TEMPLATE_LIBRARY[2].steps, active: false, enrolled: 23, completed: 23, replied: 19 },
  ]);
  const [activeSequence, setActiveSequence] = useState<Sequence | null>(null);
  const [templateFilter, setTemplateFilter] = useState("all");
  const [abEnabled, setAbEnabled] = useState(false);

  function createFromTemplate(template: typeof TEMPLATE_LIBRARY[0]) {
    const seq: Sequence = {
      id: `seq_${Date.now()}`,
      name: template.name,
      steps: template.steps,
      active: false,
      enrolled: 0, completed: 0, replied: 0,
    };
    setSequences(prev => [...prev, seq]);
    setActiveSequence(seq);
  }

  function addStep(type: SequenceStep["type"]) {
    if (!activeSequence) return;
    const step: SequenceStep = {
      id: `s_${Date.now()}`,
      type,
      subject: type === "email" ? "Subject line" : undefined,
      body: type === "wait" ? "" : type === "condition" ? "" : "Message content...",
      delay_days: type === "wait" ? 2 : 0,
      channel: type === "social" ? "linkedin" : undefined,
      conditionType: type === "condition" ? "replied" : undefined,
    };
    const updated = { ...activeSequence, steps: [...activeSequence.steps, step] };
    setActiveSequence(updated);
    setSequences(prev => prev.map(s => s.id === updated.id ? updated : s));
  }

  function removeStep(stepId: string) {
    if (!activeSequence) return;
    const updated = { ...activeSequence, steps: activeSequence.steps.filter(s => s.id !== stepId) };
    setActiveSequence(updated);
    setSequences(prev => prev.map(s => s.id === updated.id ? updated : s));
  }

  function toggleSequence() {
    if (!activeSequence) return;
    const updated = { ...activeSequence, active: !activeSequence.active };
    setActiveSequence(updated);
    setSequences(prev => prev.map(s => s.id === updated.id ? updated : s));
  }

  function cloneSequence(seq: Sequence) {
    const cloned: Sequence = {
      ...seq,
      id: `seq_${Date.now()}`,
      name: `${seq.name} (Copy)`,
      active: false,
      enrolled: 0, completed: 0, replied: 0,
    };
    setSequences(prev => [...prev, cloned]);
  }

  const templateCategories = ["all", ...Array.from(new Set(TEMPLATE_LIBRARY.map(t => t.category)))];
  const filteredTemplates = templateFilter === "all" ? TEMPLATE_LIBRARY : TEMPLATE_LIBRARY.filter(t => t.category === templateFilter);

  const TABS: { key: MainTab; label: string; icon: React.ReactNode }[] = [
    { key: "builder", label: "Sequence Builder", icon: <Zap size={14} /> },
    { key: "templates", label: "Templates", icon: <Copy size={14} /> },
    { key: "analytics", label: "Performance", icon: <BarChart3 size={14} /> },
    { key: "enrollment", label: "Enrollment Rules", icon: <Users size={14} /> },
    { key: "settings", label: "Settings", icon: <Settings size={14} /> },
  ];

  return (
    <div className="fade-in space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-header mb-0 flex items-center gap-2">
            <Mail size={18} className="text-gold" /> Email Sequences
          </h1>
          <p className="text-xs text-muted mt-0.5">Multi-channel drip campaigns with AI, conditions, and A/B testing</p>
        </div>
        <div className="flex gap-2">
          <button className="btn-primary text-xs flex items-center gap-1.5" onClick={() => setActiveSequence(null)}>
            <Plus size={12} /> New Sequence
          </button>
        </div>
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

      {/* ===== SEQUENCE BUILDER ===== */}
      {activeTab === "builder" && (
        <div className="space-y-4">
          {!activeSequence ? (
            <>
              {/* Sequence List */}
              <div className="space-y-2">
                {sequences.map(seq => (
                  <div key={seq.id} className="card p-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`w-2.5 h-2.5 rounded-full ${seq.active ? "bg-green-400 animate-pulse" : "bg-muted"}`} />
                      <div>
                        <p className="text-xs font-semibold">{seq.name}</p>
                        <p className="text-[10px] text-muted">{seq.steps.length} steps | {seq.steps.filter(s => s.type === "email").length} emails, {seq.steps.filter(s => s.type === "sms").length} SMS, {seq.steps.filter(s => s.type === "call").length} calls</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="grid grid-cols-3 gap-4 text-center text-[10px]">
                        <div><p className="font-bold">{seq.enrolled}</p><p className="text-[8px] text-muted">Enrolled</p></div>
                        <div><p className="font-bold text-green-400">{seq.replied}</p><p className="text-[8px] text-muted">Replied</p></div>
                        <div><p className="font-bold text-gold">{seq.enrolled > 0 ? ((seq.replied / seq.enrolled) * 100).toFixed(1) : 0}%</p><p className="text-[8px] text-muted">Rate</p></div>
                      </div>
                      <div className="flex gap-1.5">
                        <button onClick={() => setActiveSequence(seq)} className="btn-secondary text-[9px] py-1 px-2">Edit</button>
                        <button onClick={() => cloneSequence(seq)} className="btn-ghost text-[9px] py-1 px-2"><Copy size={10} /></button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              {/* Quick create from template hint */}
              <div className="card border-gold/10 text-center py-6">
                <Sparkles size={24} className="mx-auto mb-2 text-gold" />
                <p className="text-sm font-semibold">Create a new sequence</p>
                <p className="text-[10px] text-muted mt-1">Pick a template from the Templates tab, or build from scratch</p>
                <button onClick={() => setActiveTab("templates")} className="btn-secondary text-xs mt-3">Browse Templates</button>
              </div>
            </>
          ) : (
            <div className="space-y-4">
              {/* Sequence Editor Header */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <button onClick={() => setActiveSequence(null)} className="btn-ghost text-xs">Back</button>
                  <input value={activeSequence.name}
                    onChange={e => {
                      const updated = { ...activeSequence, name: e.target.value };
                      setActiveSequence(updated);
                      setSequences(prev => prev.map(s => s.id === updated.id ? updated : s));
                    }}
                    className="input text-sm font-semibold w-64" />
                </div>
                <div className="flex gap-2">
                  <button onClick={toggleSequence}
                    className={`text-xs flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium ${
                      activeSequence.active ? "bg-red-400/10 text-red-400 border border-red-400/20" : "btn-primary"
                    }`}>
                    {activeSequence.active ? <><Pause size={12} /> Pause</> : <><Play size={12} /> Activate</>}
                  </button>
                </div>
              </div>

              {/* A/B Test Toggle */}
              <div className="card p-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Target size={14} className="text-gold" />
                  <div>
                    <p className="text-xs font-semibold">A/B Testing</p>
                    <p className="text-[9px] text-muted">Split test subject lines and content</p>
                  </div>
                </div>
                <button onClick={() => setAbEnabled(!abEnabled)}
                  className={`w-10 h-5 rounded-full transition-all flex items-center ${abEnabled ? "bg-gold justify-end" : "bg-surface-light justify-start"}`}>
                  <div className="w-4 h-4 bg-white rounded-full mx-0.5 shadow" />
                </button>
              </div>

              {/* Visual Step Builder */}
              <div className="space-y-2">
                {activeSequence.steps.map((step, i) => {
                  const colors = STEP_COLORS[step.type];
                  return (
                    <div key={step.id}>
                      <div className={`p-4 rounded-xl border ${colors.border} ${colors.bg}`}>
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <span className={`text-[9px] px-2 py-0.5 rounded-full font-bold uppercase flex items-center gap-1 ${colors.text}`}>
                              {STEP_ICONS[step.type]} {step.type === "wait" ? `Wait ${step.delay_days}d` : step.type === "condition" ? "Condition" : step.type}
                            </span>
                            <span className="text-[9px] text-muted">Step {i + 1}</span>
                            {step.channel && <span className="text-[8px] px-1.5 py-0.5 rounded bg-white/5 text-muted capitalize">{step.channel}</span>}
                          </div>
                          <button onClick={() => removeStep(step.id)} className="text-muted hover:text-red-400 p-1"><Trash2 size={12} /></button>
                        </div>

                        {step.type === "wait" ? (
                          <div className="flex items-center gap-2">
                            <Clock size={14} className="text-muted" />
                            <input type="number" min={1} max={30} value={step.delay_days}
                              onChange={e => {
                                const steps = [...activeSequence.steps];
                                steps[i] = { ...steps[i], delay_days: parseInt(e.target.value) || 1 };
                                const updated = { ...activeSequence, steps };
                                setActiveSequence(updated);
                                setSequences(prev => prev.map(s => s.id === updated.id ? updated : s));
                              }}
                              className="input w-16 text-xs text-center" />
                            <span className="text-xs text-muted">days</span>
                          </div>
                        ) : step.type === "condition" ? (
                          <div className="flex items-center gap-2">
                            <GitBranch size={14} className="text-purple-400" />
                            <select className="input text-xs" value={step.conditionType || "replied"}
                              onChange={e => {
                                const steps = [...activeSequence.steps];
                                steps[i] = { ...steps[i], conditionType: e.target.value };
                                const updated = { ...activeSequence, steps };
                                setActiveSequence(updated);
                                setSequences(prev => prev.map(s => s.id === updated.id ? updated : s));
                              }}>
                              <option value="replied">If replied</option>
                              <option value="opened">If opened email</option>
                              <option value="clicked">If clicked link</option>
                              <option value="not_replied">If no reply</option>
                              <option value="booked">If booked call</option>
                            </select>
                            <ArrowRight size={12} className="text-muted" />
                            <span className="text-[10px] text-muted">Then continue / Exit sequence</span>
                          </div>
                        ) : (
                          <div className="space-y-2">
                            {step.type === "email" && (
                              <input value={step.subject || ""} onChange={e => {
                                const steps = [...activeSequence.steps];
                                steps[i] = { ...steps[i], subject: e.target.value };
                                const updated = { ...activeSequence, steps };
                                setActiveSequence(updated);
                                setSequences(prev => prev.map(s => s.id === updated.id ? updated : s));
                              }} className="input w-full text-xs" placeholder="Subject line..." />
                            )}
                            {abEnabled && step.type === "email" && (
                              <input className="input w-full text-xs border-dashed" placeholder="Variant B subject line (A/B test)..." />
                            )}
                            <textarea value={step.body} onChange={e => {
                              const steps = [...activeSequence.steps];
                              steps[i] = { ...steps[i], body: e.target.value };
                              const updated = { ...activeSequence, steps };
                              setActiveSequence(updated);
                              setSequences(prev => prev.map(s => s.id === updated.id ? updated : s));
                            }} className="input w-full text-xs h-20 resize-none" placeholder="Message body..." />
                          </div>
                        )}
                      </div>
                      {i < activeSequence.steps.length - 1 && (
                        <div className="flex justify-center py-1">
                          <ArrowDown size={14} className="text-muted/30" />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Add Step Buttons */}
              <div className="flex gap-2 justify-center pt-2 flex-wrap">
                {[
                  { type: "email" as const, label: "Email", icon: <Mail size={10} /> },
                  { type: "sms" as const, label: "SMS", icon: <MessageSquare size={10} /> },
                  { type: "call" as const, label: "Call", icon: <Phone size={10} /> },
                  { type: "social" as const, label: "Social", icon: <Share2 size={10} /> },
                  { type: "wait" as const, label: "Wait", icon: <Clock size={10} /> },
                  { type: "condition" as const, label: "Condition", icon: <GitBranch size={10} /> },
                ].map(s => (
                  <button key={s.type} onClick={() => addStep(s.type)}
                    className="btn-secondary text-[10px] flex items-center gap-1 px-3 py-1.5">
                    <Plus size={10} /> {s.icon} {s.label}
                  </button>
                ))}
              </div>

              {/* Exit Conditions */}
              <div className="card">
                <h4 className="text-xs font-semibold mb-2 flex items-center gap-2">
                  <XCircle size={12} className="text-red-400" /> Exit Conditions
                </h4>
                <div className="space-y-1.5">
                  {[
                    { label: "Contact replies to any message", enabled: true },
                    { label: "Contact books a meeting", enabled: true },
                    { label: "Contact unsubscribes", enabled: true },
                    { label: "Email bounces (hard bounce)", enabled: true },
                    { label: "Contact marked as client", enabled: false },
                  ].map((ex, i) => (
                    <div key={i} className="flex items-center justify-between p-2 rounded bg-surface-light text-[10px]">
                      <div className="flex items-center gap-2">
                        <CheckCircle size={10} className={ex.enabled ? "text-green-400" : "text-muted"} />
                        <span>{ex.label}</span>
                      </div>
                      <div className={`w-6 h-3 rounded-full ${ex.enabled ? "bg-green-400" : "bg-surface"}`}>
                        <div className={`w-2.5 h-2.5 bg-white rounded-full mt-px ${ex.enabled ? "ml-3" : "ml-0.5"}`} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ===== TEMPLATE LIBRARY ===== */}
      {activeTab === "templates" && (
        <div className="space-y-4">
          <div className="flex gap-1.5 flex-wrap">
            {templateCategories.map(c => (
              <button key={c} onClick={() => setTemplateFilter(c)}
                className={`text-[10px] px-3 py-1.5 rounded-lg capitalize ${
                  templateFilter === c ? "bg-gold/10 text-gold border border-gold/20" : "text-muted border border-white/[0.05]"
                }`}>{c}</button>
            ))}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {filteredTemplates.map((t, i) => (
              <div key={i} className="card p-4 hover:border-gold/10 transition-all">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <p className="text-xs font-semibold">{t.name}</p>
                    <p className="text-[10px] text-muted mt-0.5">{t.description}</p>
                  </div>
                  <span className="text-[8px] px-1.5 py-0.5 rounded bg-gold/10 text-gold">{t.category}</span>
                </div>
                <div className="flex gap-1 mt-2 mb-3">
                  {t.steps.map((s, j) => (
                    <div key={j} className={`w-6 h-6 rounded flex items-center justify-center ${STEP_COLORS[s.type].bg}`}>
                      <span className={STEP_COLORS[s.type].text}>{STEP_ICONS[s.type]}</span>
                    </div>
                  ))}
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[9px] text-green-400 flex items-center gap-1"><BarChart3 size={9} /> {t.performance}</span>
                  <button onClick={() => { createFromTemplate(t); setActiveTab("builder"); }}
                    className="btn-primary text-[9px] px-2 py-1 flex items-center gap-1"><Plus size={9} /> Use Template</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ===== PERFORMANCE ANALYTICS ===== */}
      {activeTab === "analytics" && (
        <div className="space-y-4">
          {/* Overview stats */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {[
              { label: "Total Enrolled", value: sequences.reduce((s, seq) => s + seq.enrolled, 0), color: "text-gold" },
              { label: "Completed", value: sequences.reduce((s, seq) => s + seq.completed, 0), color: "text-green-400" },
              { label: "Replied", value: sequences.reduce((s, seq) => s + seq.replied, 0), color: "text-blue-400" },
              { label: "Avg Reply Rate", value: `${(sequences.reduce((s, seq) => s + (seq.enrolled > 0 ? seq.replied / seq.enrolled : 0), 0) / sequences.length * 100).toFixed(1)}%`, color: "text-purple-400" },
              { label: "Active Sequences", value: sequences.filter(s => s.active).length, color: "text-gold" },
            ].map((stat, i) => (
              <div key={i} className="card text-center p-3">
                <p className={`text-xl font-bold ${stat.color}`}>{stat.value}</p>
                <p className="text-[9px] text-muted">{stat.label}</p>
              </div>
            ))}
          </div>
          {/* Per-sequence breakdown */}
          <div className="card">
            <h3 className="text-sm font-semibold mb-3">Sequence Performance</h3>
            <div className="space-y-3">
              {sequences.map(seq => {
                const replyRate = seq.enrolled > 0 ? ((seq.replied / seq.enrolled) * 100) : 0;
                return (
                  <div key={seq.id} className="p-3 rounded-lg bg-surface-light border border-border">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-xs font-semibold flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full ${seq.active ? "bg-green-400" : "bg-muted"}`} />
                        {seq.name}
                      </p>
                      <span className="text-[9px] text-muted">{seq.steps.length} steps</span>
                    </div>
                    <div className="grid grid-cols-4 gap-2 text-center text-[10px]">
                      <div><p className="font-bold">{seq.enrolled}</p><p className="text-[8px] text-muted">Enrolled</p></div>
                      <div><p className="font-bold text-green-400">{seq.completed}</p><p className="text-[8px] text-muted">Completed</p></div>
                      <div><p className="font-bold text-blue-400">{seq.replied}</p><p className="text-[8px] text-muted">Replied</p></div>
                      <div><p className="font-bold text-gold">{replyRate.toFixed(1)}%</p><p className="text-[8px] text-muted">Reply Rate</p></div>
                    </div>
                    <div className="w-full bg-surface rounded-full h-1.5 mt-2">
                      <div className="bg-gold rounded-full h-1.5" style={{ width: `${seq.enrolled > 0 ? (seq.completed / seq.enrolled) * 100 : 0}%` }} />
                    </div>
                    {/* Step-by-step metrics */}
                    <div className="flex gap-1 mt-2">
                      {seq.steps.map((step, j) => (
                        <div key={j} className={`flex-1 text-center p-1.5 rounded text-[8px] ${STEP_COLORS[step.type].bg}`}>
                          <span className={STEP_COLORS[step.type].text}>{step.type}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ===== ENROLLMENT RULES ===== */}
      {activeTab === "enrollment" && (
        <div className="space-y-4">
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <Users size={14} className="text-gold" /> Contact Enrollment Rules
          </h3>
          <div className="space-y-2">
            {[
              { rule: "New leads with email automatically enroll in 'Cold Outreach'", sequence: "Cold Outreach", active: true },
              { rule: "Leads who replied get enrolled in 'Post-Call Follow Up'", sequence: "Post-Call Follow Up", active: true },
              { rule: "New clients auto-enroll in 'Client Onboarding'", sequence: "Client Onboarding", active: true },
              { rule: "Leads with score < 30 enroll in 'Re-engagement'", sequence: "Re-engagement", active: false },
              { rule: "Leads from referrals skip to 'Post-Call Follow Up'", sequence: "Post-Call Follow Up", active: false },
            ].map((rule, i) => (
              <div key={i} className={`card p-4 flex items-center justify-between ${!rule.active ? "opacity-50" : ""}`}>
                <div className="flex items-center gap-3">
                  <Zap size={14} className="text-gold" />
                  <div>
                    <p className="text-xs">{rule.rule}</p>
                    <p className="text-[9px] text-muted">Sequence: {rule.sequence}</p>
                  </div>
                </div>
                <div className={`w-8 h-4 rounded-full ${rule.active ? "bg-gold" : "bg-surface-light"}`}>
                  <div className={`w-3 h-3 bg-white rounded-full mt-0.5 ${rule.active ? "ml-4" : "ml-0.5"}`} />
                </div>
              </div>
            ))}
          </div>
          {/* Reply Detection Rules */}
          <div className="card">
            <h4 className="text-xs font-semibold mb-3 flex items-center gap-2">
              <Eye size={12} className="text-gold" /> Reply Detection Rules
            </h4>
            <div className="space-y-1.5">
              {[
                { condition: "Positive reply detected", action: "Pause sequence + notify owner + move to Hot", active: true },
                { condition: "Negative reply (not interested)", action: "Remove from sequence + tag 'not-interested'", active: true },
                { condition: "Out-of-office reply", action: "Pause for 7 days then resume", active: true },
                { condition: "Unsubscribe request", action: "Immediately exit all sequences", active: true },
              ].map((rule, i) => (
                <div key={i} className="flex items-center justify-between p-2.5 rounded bg-surface-light text-[10px]">
                  <div>
                    <p className="font-semibold">{rule.condition}</p>
                    <p className="text-[9px] text-muted">{rule.action}</p>
                  </div>
                  <div className={`w-6 h-3 rounded-full ${rule.active ? "bg-green-400" : "bg-surface"}`}>
                    <div className={`w-2.5 h-2.5 bg-white rounded-full mt-px ${rule.active ? "ml-3" : "ml-0.5"}`} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ===== SETTINGS ===== */}
      {activeTab === "settings" && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Sending limits */}
            <div className="card">
              <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                <Settings size={14} className="text-gold" /> Sending Limits
              </h3>
              <div className="space-y-3">
                {[
                  { label: "Max emails per day", value: 50 },
                  { label: "Max SMS per day", value: 20 },
                  { label: "Min delay between sends (minutes)", value: 5 },
                  { label: "Send window start", value: "9:00 AM" },
                  { label: "Send window end", value: "6:00 PM" },
                ].map((setting, i) => (
                  <div key={i} className="flex items-center justify-between text-[10px]">
                    <span>{setting.label}</span>
                    <span className="text-gold font-semibold">{setting.value}</span>
                  </div>
                ))}
              </div>
            </div>
            {/* Pause/Resume controls */}
            <div className="card">
              <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                <Pause size={14} className="text-gold" /> Pause / Resume Controls
              </h3>
              <div className="space-y-2">
                {sequences.map(seq => (
                  <div key={seq.id} className="flex items-center justify-between p-2.5 rounded bg-surface-light text-[10px]">
                    <div className="flex items-center gap-2">
                      <div className={`w-2 h-2 rounded-full ${seq.active ? "bg-green-400" : "bg-muted"}`} />
                      <span className="font-semibold">{seq.name}</span>
                      <span className="text-muted">({seq.enrolled} enrolled)</span>
                    </div>
                    <button className={`text-[9px] px-2 py-1 rounded flex items-center gap-1 ${
                      seq.active ? "bg-red-400/10 text-red-400" : "bg-green-400/10 text-green-400"
                    }`}>
                      {seq.active ? <><Pause size={8} /> Pause</> : <><Play size={8} /> Resume</>}
                    </button>
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
