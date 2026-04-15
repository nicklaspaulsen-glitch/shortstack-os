"use client";

import { useState } from "react";
import {
  Zap, Play, Sparkles, Clock, GitBranch, Bot, Check,
  Users, Plus, Trash2, Pause, BarChart3, ArrowRight,
  AlertTriangle, RefreshCw, Settings, Target,
  Mail, Phone, Tag, ChevronRight, Power,
  FileText, Inbox, Star, DollarSign, UserPlus,
  MessageSquare, Layers, ArrowDown, Copy, X
} from "lucide-react";
import Modal from "@/components/ui/modal";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */
interface FlowNode {
  id: string;
  type: "trigger" | "condition" | "action";
  label: string;
  icon: string;
  config: Record<string, string>;
}

interface Automation {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  trigger: string;
  triggerIcon: string;
  conditions: string[];
  actions: string[];
  runs: number;
  successRate: number;
  lastRun: string;
}

interface LogEntry {
  id: string;
  automationName: string;
  triggerEvent: string;
  status: "success" | "failed" | "skipped";
  contact: string;
  timestamp: string;
  duration: string;
  stepsRun: number;
}

type Tab = "automations" | "builder" | "templates" | "logs";

/* ------------------------------------------------------------------ */
/*  Mock Data                                                          */
/* ------------------------------------------------------------------ */
const TRIGGERS = [
  { id: "new_lead", label: "New Lead", icon: "UserPlus", description: "When a new lead enters your CRM" },
  { id: "deal_won", label: "Deal Won", icon: "DollarSign", description: "When a deal is marked as won" },
  { id: "deal_lost", label: "Deal Lost", icon: "AlertTriangle", description: "When a deal is marked as lost" },
  { id: "new_client", label: "New Client", icon: "Users", description: "When a client is onboarded" },
  { id: "invoice_overdue", label: "Invoice Overdue", icon: "Clock", description: "When an invoice passes due date" },
  { id: "form_submitted", label: "Form Submitted", icon: "FileText", description: "When a form is completed" },
  { id: "review_received", label: "Review Received", icon: "Star", description: "When a new review comes in" },
];

const CONDITIONS = [
  { id: "value_gt", label: "If value > X", icon: "BarChart3", description: "Check if a numeric value exceeds threshold" },
  { id: "status_eq", label: "If status = Y", icon: "GitBranch", description: "Check if status matches a value" },
  { id: "client_eq", label: "If client = Z", icon: "Users", description: "Check if a specific client is involved" },
  { id: "tag_has", label: "If has tag", icon: "Tag", description: "Check if contact has a specific tag" },
  { id: "time_delay", label: "Wait / Delay", icon: "Clock", description: "Wait a specific amount of time" },
];

const ACTIONS = [
  { id: "send_email", label: "Send Email", icon: "Mail", description: "Send an automated email" },
  { id: "send_sms", label: "Send SMS", icon: "Phone", description: "Send a text message" },
  { id: "create_task", label: "Create Task", icon: "FileText", description: "Create a task for your team" },
  { id: "assign_member", label: "Assign Team Member", icon: "UserPlus", description: "Assign to a team member" },
  { id: "update_deal", label: "Update Deal Stage", icon: "RefreshCw", description: "Move deal to another stage" },
  { id: "slack_notify", label: "Send Slack Notification", icon: "MessageSquare", description: "Post to a Slack channel" },
  { id: "add_tag", label: "Add Tag", icon: "Tag", description: "Add a tag to the contact" },
];

const MOCK_AUTOMATIONS: Automation[] = [
  {
    id: "a1", name: "Welcome New Client", description: "Send welcome email and create onboarding tasks when a new client is added",
    enabled: true, trigger: "New Client", triggerIcon: "Users",
    conditions: [], actions: ["Send Email", "Create Task"],
    runs: 47, successRate: 100, lastRun: "2 hours ago",
  },
  {
    id: "a2", name: "Follow Up Cold Lead", description: "Wait 3 days then send a follow-up email to new leads",
    enabled: true, trigger: "New Lead", triggerIcon: "UserPlus",
    conditions: ["Wait 3 days"], actions: ["Send Email"],
    runs: 234, successRate: 96.2, lastRun: "35 min ago",
  },
  {
    id: "a3", name: "Win Notification", description: "Notify Slack and create invoice when a deal is won",
    enabled: true, trigger: "Deal Won", triggerIcon: "DollarSign",
    conditions: [], actions: ["Send Slack Notification", "Create Task"],
    runs: 18, successRate: 100, lastRun: "1 day ago",
  },
  {
    id: "a4", name: "Review Request", description: "Wait 7 days after project completion, then request a review",
    enabled: false, trigger: "Deal Won", triggerIcon: "DollarSign",
    conditions: ["Wait 7 days"], actions: ["Send Email"],
    runs: 12, successRate: 91.7, lastRun: "5 days ago",
  },
  {
    id: "a5", name: "Overdue Invoice Escalation", description: "Alert team when an invoice is overdue, then send reminder to client",
    enabled: true, trigger: "Invoice Overdue", triggerIcon: "Clock",
    conditions: ["If value > $500"], actions: ["Send Slack Notification", "Send Email", "Assign Team Member"],
    runs: 9, successRate: 100, lastRun: "3 days ago",
  },
];

const TEMPLATES = [
  {
    id: "t1", name: "Welcome New Client", description: "New client → send welcome email → create onboarding task",
    trigger: "new_client", conditions: [] as string[], actions: ["send_email", "create_task"],
    icon: "Users", popular: true,
  },
  {
    id: "t2", name: "Follow Up Cold Lead", description: "Lead created → wait 3 days → send follow-up email",
    trigger: "new_lead", conditions: ["time_delay"], actions: ["send_email"],
    icon: "UserPlus", popular: true,
  },
  {
    id: "t3", name: "Win Notification", description: "Deal won → send Slack message → create invoice",
    trigger: "deal_won", conditions: [] as string[], actions: ["slack_notify", "create_task"],
    icon: "DollarSign", popular: true,
  },
  {
    id: "t4", name: "Review Request", description: "Project completed → wait 7 days → send review request",
    trigger: "deal_won", conditions: ["time_delay"], actions: ["send_email"],
    icon: "Star", popular: false,
  },
  {
    id: "t5", name: "Lost Deal Recovery", description: "Deal lost → wait 14 days → send re-engagement email",
    trigger: "deal_lost", conditions: ["time_delay"], actions: ["send_email", "add_tag"],
    icon: "AlertTriangle", popular: false,
  },
  {
    id: "t6", name: "Form Follow-Up", description: "Form submitted → send thank-you email → create task → assign member",
    trigger: "form_submitted", conditions: [] as string[], actions: ["send_email", "create_task", "assign_member"],
    icon: "FileText", popular: false,
  },
  {
    id: "t7", name: "High-Value Alert", description: "New lead → if value > $5K → notify Slack → assign senior rep",
    trigger: "new_lead", conditions: ["value_gt"], actions: ["slack_notify", "assign_member"],
    icon: "Target", popular: false,
  },
  {
    id: "t8", name: "Review Thank You", description: "Review received → send thank you email → add VIP tag",
    trigger: "review_received", conditions: [] as string[], actions: ["send_email", "add_tag"],
    icon: "Star", popular: false,
  },
];

const MOCK_LOGS: LogEntry[] = [
  { id: "l1", automationName: "Follow Up Cold Lead", triggerEvent: "New lead: Sarah's Bakery", status: "success", contact: "Sarah Mitchell", timestamp: "2026-04-15T09:45:00Z", duration: "0.3s", stepsRun: 3 },
  { id: "l2", automationName: "Welcome New Client", triggerEvent: "Client onboarded: Peak Fitness", status: "success", contact: "Mike Torres", timestamp: "2026-04-15T08:30:00Z", duration: "0.8s", stepsRun: 2 },
  { id: "l3", automationName: "Win Notification", triggerEvent: "Deal won: Website Redesign $4,500", status: "success", contact: "Elite Auto Detailing", timestamp: "2026-04-14T16:20:00Z", duration: "0.5s", stepsRun: 2 },
  { id: "l4", automationName: "Follow Up Cold Lead", triggerEvent: "New lead: Metro Legal Group", status: "success", contact: "David Chen", timestamp: "2026-04-14T14:15:00Z", duration: "0.2s", stepsRun: 3 },
  { id: "l5", automationName: "Overdue Invoice Escalation", triggerEvent: "Invoice #1042 overdue ($850)", status: "success", contact: "Bright Smiles Dental", timestamp: "2026-04-14T10:00:00Z", duration: "1.1s", stepsRun: 3 },
  { id: "l6", automationName: "Follow Up Cold Lead", triggerEvent: "New lead: Fresh Flowers LLC", status: "failed", contact: "Amy Lin", timestamp: "2026-04-13T22:00:00Z", duration: "0.1s", stepsRun: 1 },
  { id: "l7", automationName: "Welcome New Client", triggerEvent: "Client onboarded: Golden Spa", status: "success", contact: "Rosa Vega", timestamp: "2026-04-13T11:30:00Z", duration: "0.6s", stepsRun: 2 },
  { id: "l8", automationName: "Review Request", triggerEvent: "Deal completed: SEO Package", status: "skipped", contact: "Tech Startup Inc", timestamp: "2026-04-12T17:45:00Z", duration: "0.0s", stepsRun: 0 },
  { id: "l9", automationName: "Overdue Invoice Escalation", triggerEvent: "Invoice #1038 overdue ($320)", status: "skipped", contact: "Budget Print Co", timestamp: "2026-04-12T10:00:00Z", duration: "0.0s", stepsRun: 0 },
  { id: "l10", automationName: "Win Notification", triggerEvent: "Deal won: Monthly Retainer $2,000", status: "success", contact: "Sunrise Yoga", timestamp: "2026-04-11T15:00:00Z", duration: "0.4s", stepsRun: 2 },
];

/* ------------------------------------------------------------------ */
/*  Icon resolver                                                      */
/* ------------------------------------------------------------------ */
function IconFor({ name, size = 14, className = "" }: { name: string; size?: number; className?: string }) {
  const map: Record<string, React.ReactNode> = {
    UserPlus: <UserPlus size={size} className={className} />,
    Users: <Users size={size} className={className} />,
    DollarSign: <DollarSign size={size} className={className} />,
    AlertTriangle: <AlertTriangle size={size} className={className} />,
    Clock: <Clock size={size} className={className} />,
    FileText: <FileText size={size} className={className} />,
    Star: <Star size={size} className={className} />,
    BarChart3: <BarChart3 size={size} className={className} />,
    GitBranch: <GitBranch size={size} className={className} />,
    Tag: <Tag size={size} className={className} />,
    Mail: <Mail size={size} className={className} />,
    Phone: <Phone size={size} className={className} />,
    RefreshCw: <RefreshCw size={size} className={className} />,
    MessageSquare: <MessageSquare size={size} className={className} />,
    Target: <Target size={size} className={className} />,
    Zap: <Zap size={size} className={className} />,
  };
  return <>{map[name] || <Zap size={size} className={className} />}</>;
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */
export default function AutomationsPage() {
  const [tab, setTab] = useState<Tab>("automations");
  const [automations, setAutomations] = useState(MOCK_AUTOMATIONS);
  const [logs] = useState(MOCK_LOGS);

  // Builder state
  const [builderName, setBuilderName] = useState("");
  const [builderDescription, setBuilderDescription] = useState("");
  const [flowNodes, setFlowNodes] = useState<FlowNode[]>([]);
  const [showNodePicker, setShowNodePicker] = useState<"trigger" | "condition" | "action" | null>(null);
  const [showTemplatePreview, setShowTemplatePreview] = useState<string | null>(null);

  // Stats
  const totalRuns = automations.reduce((s, a) => s + a.runs, 0);
  const activeCount = automations.filter(a => a.enabled).length;
  const avgSuccess = automations.length > 0
    ? (automations.reduce((s, a) => s + a.successRate, 0) / automations.length).toFixed(1)
    : "0";

  function toggleAutomation(id: string) {
    setAutomations(prev => prev.map(a => a.id === id ? { ...a, enabled: !a.enabled } : a));
  }

  function deleteAutomation(id: string) {
    setAutomations(prev => prev.filter(a => a.id !== id));
  }

  function addNode(type: "trigger" | "condition" | "action", item: { id: string; label: string; icon: string }) {
    const node: FlowNode = {
      id: `${type}-${Date.now()}`,
      type,
      label: item.label,
      icon: item.icon,
      config: {},
    };
    setFlowNodes(prev => [...prev, node]);
    setShowNodePicker(null);
  }

  function removeNode(id: string) {
    setFlowNodes(prev => prev.filter(n => n.id !== id));
  }

  function loadTemplate(templateId: string) {
    const tmpl = TEMPLATES.find(t => t.id === templateId);
    if (!tmpl) return;
    setBuilderName(tmpl.name);
    setBuilderDescription(tmpl.description);
    const nodes: FlowNode[] = [];
    const trig = TRIGGERS.find(t => t.id === tmpl.trigger);
    if (trig) nodes.push({ id: `trigger-${Date.now()}`, type: "trigger", label: trig.label, icon: trig.icon, config: {} });
    tmpl.conditions.forEach((cId, i) => {
      const c = CONDITIONS.find(x => x.id === cId);
      if (c) nodes.push({ id: `condition-${Date.now() + i}`, type: "condition", label: c.label, icon: c.icon, config: {} });
    });
    tmpl.actions.forEach((aId, i) => {
      const a = ACTIONS.find(x => x.id === aId);
      if (a) nodes.push({ id: `action-${Date.now() + i + 100}`, type: "action", label: a.label, icon: a.icon, config: {} });
    });
    setFlowNodes(nodes);
    setTab("builder");
    setShowTemplatePreview(null);
  }

  function saveAutomation() {
    if (!builderName.trim() || flowNodes.length === 0) return;
    const triggerNode = flowNodes.find(n => n.type === "trigger");
    const newAuto: Automation = {
      id: `a${Date.now()}`,
      name: builderName,
      description: builderDescription,
      enabled: true,
      trigger: triggerNode?.label || "Manual",
      triggerIcon: triggerNode?.icon || "Zap",
      conditions: flowNodes.filter(n => n.type === "condition").map(n => n.label),
      actions: flowNodes.filter(n => n.type === "action").map(n => n.label),
      runs: 0,
      successRate: 0,
      lastRun: "Never",
    };
    setAutomations(prev => [newAuto, ...prev]);
    setBuilderName("");
    setBuilderDescription("");
    setFlowNodes([]);
    setTab("automations");
  }

  const nodeColor = (type: string) => {
    switch (type) {
      case "trigger": return { bg: "bg-emerald-500/10", border: "border-emerald-500/20", text: "text-emerald-400", dot: "bg-emerald-400" };
      case "condition": return { bg: "bg-amber-500/10", border: "border-amber-500/20", text: "text-amber-400", dot: "bg-amber-400" };
      case "action": return { bg: "bg-blue-500/10", border: "border-blue-500/20", text: "text-blue-400", dot: "bg-blue-400" };
      default: return { bg: "bg-surface-light", border: "border-border", text: "text-muted", dot: "bg-muted" };
    }
  };

  const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: "automations", label: `Active (${activeCount})`, icon: <Zap size={13} /> },
    { id: "builder", label: "Flow Builder", icon: <Settings size={13} /> },
    { id: "templates", label: "Templates", icon: <Layers size={13} /> },
    { id: "logs", label: "Execution Log", icon: <FileText size={13} /> },
  ];

  return (
    <div className="fade-in space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gold/10 rounded-xl flex items-center justify-center">
            <Bot size={20} className="text-gold" />
          </div>
          <div>
            <h1 className="page-header mb-0">Smart Automations</h1>
            <p className="text-xs text-muted">Build Zapier-style workflows with triggers, conditions, and actions</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 text-[10px] bg-emerald-400/[0.08] text-emerald-400 px-2.5 py-1 rounded-md border border-emerald-400/15">
            <Power size={10} /><span className="font-medium">{activeCount} active</span>
          </div>
          <button onClick={() => { setFlowNodes([]); setBuilderName(""); setBuilderDescription(""); setTab("builder"); }}
            className="btn-primary text-xs flex items-center gap-1.5">
            <Plus size={12} /> New Automation
          </button>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-4 gap-3">
        <div className="card p-3 text-center">
          <p className="text-lg font-bold text-gold">{activeCount}</p>
          <p className="text-[10px] text-muted">Active Flows</p>
        </div>
        <div className="card p-3 text-center">
          <p className="text-lg font-bold">{totalRuns.toLocaleString()}</p>
          <p className="text-[10px] text-muted">Total Runs</p>
        </div>
        <div className="card p-3 text-center">
          <p className="text-lg font-bold text-emerald-400">{avgSuccess}%</p>
          <p className="text-[10px] text-muted">Avg Success Rate</p>
        </div>
        <div className="card p-3 text-center">
          <p className="text-lg font-bold text-blue-400">{logs.filter(l => l.status === "success").length}</p>
          <p className="text-[10px] text-muted">Runs Today</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-surface rounded-lg p-1 w-fit">
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-md transition-all ${
              tab === t.id ? "bg-gold/10 text-gold font-medium" : "text-muted hover:text-foreground"
            }`}>
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {/* ---- TAB: ACTIVE AUTOMATIONS ---- */}
      {tab === "automations" && (
        <div className="space-y-3">
          {automations.length === 0 ? (
            <div className="card text-center py-16">
              <Zap size={32} className="mx-auto text-muted/20 mb-3" />
              <p className="text-sm text-muted mb-1">No automations yet</p>
              <p className="text-[10px] text-muted/50 mb-4">Create your first automation or start from a template</p>
              <button onClick={() => setTab("templates")} className="btn-primary text-xs">Browse Templates</button>
            </div>
          ) : (
            automations.map(auto => (
              <div key={auto.id} className={`card p-0 overflow-hidden transition-all ${!auto.enabled ? "opacity-60" : ""}`}>
                <div className="p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center border ${auto.enabled ? "bg-emerald-400/10 border-emerald-400/20" : "bg-surface-light border-border"}`}>
                        <IconFor name={auto.triggerIcon} size={18} className={auto.enabled ? "text-emerald-400" : "text-muted"} />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-semibold">{auto.name}</p>
                          <span className={`text-[8px] px-1.5 py-0.5 rounded-full font-medium ${auto.enabled ? "bg-emerald-400/10 text-emerald-400" : "bg-surface-light text-muted"}`}>
                            {auto.enabled ? "Active" : "Paused"}
                          </span>
                        </div>
                        <p className="text-[10px] text-muted">{auto.description}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button onClick={() => toggleAutomation(auto.id)}
                        className={`w-10 h-5 rounded-full transition-all relative ${auto.enabled ? "bg-gold" : "bg-white/10"}`}>
                        <div className="w-4 h-4 rounded-full bg-white absolute top-0.5 transition-all"
                          style={{ left: auto.enabled ? 22 : 2 }} />
                      </button>
                      <button onClick={() => deleteAutomation(auto.id)}
                        className="p-1.5 rounded-lg text-muted hover:text-red-400 hover:bg-red-400/10 transition-all">
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </div>

                  {/* Visual Flow */}
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {/* Trigger */}
                    <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                      <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                      <IconFor name={auto.triggerIcon} size={11} className="text-emerald-400" />
                      <span className="text-[10px] font-medium text-emerald-400">{auto.trigger}</span>
                    </div>

                    {/* Conditions */}
                    {auto.conditions.map((c, i) => (
                      <div key={i} className="flex items-center gap-1.5">
                        <ArrowRight size={12} className="text-muted/30" />
                        <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/20">
                          <div className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                          <GitBranch size={11} className="text-amber-400" />
                          <span className="text-[10px] font-medium text-amber-400">{c}</span>
                        </div>
                      </div>
                    ))}

                    {/* Actions */}
                    {auto.actions.map((a, i) => (
                      <div key={i} className="flex items-center gap-1.5">
                        <ArrowRight size={12} className="text-muted/30" />
                        <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-blue-500/10 border border-blue-500/20">
                          <div className="w-1.5 h-1.5 rounded-full bg-blue-400" />
                          <Zap size={11} className="text-blue-400" />
                          <span className="text-[10px] font-medium text-blue-400">{a}</span>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Stats Row */}
                  <div className="flex items-center gap-4 mt-3 pt-3 border-t border-border/50">
                    <div className="flex items-center gap-1.5 text-[10px] text-muted">
                      <Play size={9} /> {auto.runs} runs
                    </div>
                    <div className="flex items-center gap-1.5 text-[10px] text-emerald-400">
                      <Check size={9} /> {auto.successRate}% success
                    </div>
                    <div className="flex items-center gap-1.5 text-[10px] text-muted">
                      <Clock size={9} /> Last run: {auto.lastRun}
                    </div>
                    <div className="ml-auto flex items-center gap-1">
                      <button onClick={() => {
                        const a = auto;
                        const nodes: FlowNode[] = [];
                        const trig = TRIGGERS.find(t => t.label === a.trigger);
                        if (trig) nodes.push({ id: `trigger-${Date.now()}`, type: "trigger", label: trig.label, icon: trig.icon, config: {} });
                        a.conditions.forEach((c, i) => {
                          nodes.push({ id: `condition-${Date.now() + i}`, type: "condition", label: c, icon: "GitBranch", config: {} });
                        });
                        a.actions.forEach((act, i) => {
                          const found = ACTIONS.find(x => x.label === act);
                          nodes.push({ id: `action-${Date.now() + i + 100}`, type: "action", label: act, icon: found?.icon || "Zap", config: {} });
                        });
                        setFlowNodes(nodes);
                        setBuilderName(a.name);
                        setBuilderDescription(a.description);
                        setTab("builder");
                      }}
                        className="text-[10px] px-2 py-1 rounded-lg border border-border text-muted hover:text-foreground hover:border-gold/20 transition-all flex items-center gap-1">
                        <Copy size={9} /> Duplicate
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* ---- TAB: FLOW BUILDER ---- */}
      {tab === "builder" && (
        <div className="space-y-4">
          {/* Name & Description */}
          <div className="card p-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] text-muted mb-1 font-semibold uppercase tracking-wider">Automation Name</label>
                <input value={builderName} onChange={e => setBuilderName(e.target.value)}
                  placeholder="e.g. Welcome New Client Flow"
                  className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-xs text-foreground focus:border-gold/30 focus:outline-none transition-all" />
              </div>
              <div>
                <label className="block text-[10px] text-muted mb-1 font-semibold uppercase tracking-wider">Description</label>
                <input value={builderDescription} onChange={e => setBuilderDescription(e.target.value)}
                  placeholder="What does this automation do?"
                  className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-xs text-foreground focus:border-gold/30 focus:outline-none transition-all" />
              </div>
            </div>
          </div>

          {/* Visual Flow Canvas */}
          <div className="card p-6">
            <h3 className="text-xs font-semibold mb-4 flex items-center gap-2">
              <Sparkles size={12} className="text-gold" /> Automation Flow
            </h3>

            <div className="flex flex-col items-center gap-0">
              {flowNodes.length === 0 ? (
                <div className="w-full border-2 border-dashed border-border rounded-2xl p-10 text-center">
                  <Bot size={32} className="mx-auto mb-3 text-muted/20" />
                  <p className="text-sm text-muted mb-1">Start building your automation</p>
                  <p className="text-[10px] text-muted/50 mb-4">Add a trigger to get started, then chain conditions and actions</p>
                  <button onClick={() => setShowNodePicker("trigger")}
                    className="px-4 py-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold hover:bg-emerald-500/20 transition-all flex items-center gap-1.5 mx-auto">
                    <Plus size={12} /> Add Trigger
                  </button>
                </div>
              ) : (
                <>
                  {flowNodes.map((node, idx) => {
                    const colors = nodeColor(node.type);
                    return (
                      <div key={node.id} className="flex flex-col items-center">
                        {idx > 0 && (
                          <div className="flex flex-col items-center py-1">
                            <div className="w-px h-4 bg-border" />
                            <ArrowDown size={14} className="text-muted/30 -my-1" />
                            <div className="w-px h-2 bg-border" />
                          </div>
                        )}
                        <div className={`relative flex items-center gap-3 px-5 py-3 rounded-2xl border ${colors.bg} ${colors.border} min-w-[280px] group transition-all hover:shadow-lg`}>
                          <div className={`w-2 h-2 rounded-full ${colors.dot}`} />
                          <IconFor name={node.icon} size={16} className={colors.text} />
                          <div className="flex-1">
                            <p className={`text-[9px] uppercase tracking-wider font-semibold ${colors.text}`}>{node.type}</p>
                            <p className="text-xs font-medium">{node.label}</p>
                          </div>
                          <button onClick={() => removeNode(node.id)}
                            className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-red-500/20 text-red-400 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all hover:bg-red-500/30">
                            <X size={10} />
                          </button>
                        </div>
                      </div>
                    );
                  })}

                  {/* Add more nodes */}
                  <div className="flex flex-col items-center py-1">
                    <div className="w-px h-4 bg-border" />
                    <ArrowDown size={14} className="text-muted/30 -my-1" />
                    <div className="w-px h-2 bg-border" />
                  </div>
                  <div className="flex items-center gap-2">
                    {!flowNodes.some(n => n.type === "trigger") && (
                      <button onClick={() => setShowNodePicker("trigger")}
                        className="px-3 py-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[10px] font-medium hover:bg-emerald-500/20 transition-all flex items-center gap-1.5">
                        <Plus size={10} /> Trigger
                      </button>
                    )}
                    <button onClick={() => setShowNodePicker("condition")}
                      className="px-3 py-2 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 text-[10px] font-medium hover:bg-amber-500/20 transition-all flex items-center gap-1.5">
                      <Plus size={10} /> Condition
                    </button>
                    <button onClick={() => setShowNodePicker("action")}
                      className="px-3 py-2 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400 text-[10px] font-medium hover:bg-blue-500/20 transition-all flex items-center gap-1.5">
                      <Plus size={10} /> Action
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Save / Reset */}
          <div className="flex items-center justify-between">
            <button onClick={() => { setFlowNodes([]); setBuilderName(""); setBuilderDescription(""); }}
              className="btn-secondary text-xs">
              Reset Flow
            </button>
            <div className="flex gap-2">
              <button onClick={saveAutomation}
                disabled={!builderName.trim() || flowNodes.length === 0}
                className="btn-primary text-xs flex items-center gap-1.5 disabled:opacity-50">
                <Sparkles size={12} /> Save & Activate
              </button>
            </div>
          </div>

          {/* Legend */}
          <div className="card p-3 flex items-center gap-4 justify-center">
            <div className="flex items-center gap-1.5 text-[10px]">
              <div className="w-2 h-2 rounded-full bg-emerald-400" /> <span className="text-muted">Trigger</span>
            </div>
            <div className="flex items-center gap-1.5 text-[10px]">
              <div className="w-2 h-2 rounded-full bg-amber-400" /> <span className="text-muted">Condition</span>
            </div>
            <div className="flex items-center gap-1.5 text-[10px]">
              <div className="w-2 h-2 rounded-full bg-blue-400" /> <span className="text-muted">Action</span>
            </div>
          </div>
        </div>
      )}

      {/* ---- TAB: TEMPLATES ---- */}
      {tab === "templates" && (
        <div className="space-y-4">
          {/* Popular Templates */}
          <div>
            <h3 className="text-xs font-semibold mb-3 flex items-center gap-2">
              <Star size={12} className="text-gold" /> Popular Templates
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
              {TEMPLATES.filter(t => t.popular).map(tmpl => (
                <button key={tmpl.id} onClick={() => setShowTemplatePreview(tmpl.id)}
                  className="text-left card p-4 hover:border-gold/20 transition-all hover:-translate-y-[1px] group">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-9 h-9 rounded-xl bg-gold/10 flex items-center justify-center border border-gold/20">
                      <IconFor name={tmpl.icon} size={16} className="text-gold" />
                    </div>
                    <div className="flex-1">
                      <p className="text-xs font-semibold">{tmpl.name}</p>
                      <div className="flex items-center gap-1 text-[8px] text-gold">
                        <Star size={8} /> Popular
                      </div>
                    </div>
                    <ChevronRight size={14} className="text-muted/30 group-hover:text-gold transition-all" />
                  </div>
                  <p className="text-[10px] text-muted leading-relaxed">{tmpl.description}</p>
                  <div className="flex items-center gap-2 mt-3 text-[9px] text-muted">
                    <span>{tmpl.conditions.length + 1 + tmpl.actions.length} steps</span>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* All Templates */}
          <div>
            <h3 className="text-xs font-semibold mb-3 flex items-center gap-2">
              <Layers size={12} className="text-gold" /> All Templates
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {TEMPLATES.filter(t => !t.popular).map(tmpl => (
                <button key={tmpl.id} onClick={() => setShowTemplatePreview(tmpl.id)}
                  className="text-left card p-4 hover:border-gold/20 transition-all group">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-surface-light flex items-center justify-center border border-border">
                      <IconFor name={tmpl.icon} size={16} className="text-gold" />
                    </div>
                    <div className="flex-1">
                      <p className="text-xs font-semibold">{tmpl.name}</p>
                      <p className="text-[10px] text-muted">{tmpl.description}</p>
                    </div>
                    <ChevronRight size={14} className="text-muted/30 group-hover:text-gold transition-all" />
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ---- TAB: EXECUTION LOG ---- */}
      {tab === "logs" && (
        <div className="space-y-4">
          {/* Log Stats */}
          <div className="grid grid-cols-3 gap-3">
            <div className="card p-3 text-center">
              <p className="text-lg font-bold text-emerald-400">{logs.filter(l => l.status === "success").length}</p>
              <p className="text-[10px] text-muted">Successful</p>
            </div>
            <div className="card p-3 text-center">
              <p className="text-lg font-bold text-red-400">{logs.filter(l => l.status === "failed").length}</p>
              <p className="text-[10px] text-muted">Failed</p>
            </div>
            <div className="card p-3 text-center">
              <p className="text-lg font-bold text-amber-400">{logs.filter(l => l.status === "skipped").length}</p>
              <p className="text-[10px] text-muted">Skipped</p>
            </div>
          </div>

          {/* Log Entries */}
          <div className="card p-4">
            <h3 className="text-xs font-semibold mb-3 flex items-center gap-2">
              <FileText size={12} className="text-gold" /> Recent Automation Runs
            </h3>
            <div className="space-y-2">
              {logs.map(entry => (
                <div key={entry.id} className={`p-3 rounded-xl border transition-all ${
                  entry.status === "failed" ? "border-red-500/20 bg-red-500/[0.03]" :
                  entry.status === "skipped" ? "border-amber-500/20 bg-amber-500/[0.03]" :
                  "border-border hover:border-border/80"
                }`}>
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-2">
                      <span className={`text-[8px] px-2 py-0.5 rounded-full font-semibold uppercase tracking-wider ${
                        entry.status === "success" ? "bg-emerald-400/10 text-emerald-400" :
                        entry.status === "failed" ? "bg-red-400/10 text-red-400" :
                        "bg-amber-400/10 text-amber-400"
                      }`}>
                        {entry.status === "success" ? <Check size={8} className="inline mr-0.5 -mt-px" /> :
                         entry.status === "failed" ? <AlertTriangle size={8} className="inline mr-0.5 -mt-px" /> :
                         <Pause size={8} className="inline mr-0.5 -mt-px" />}
                        {entry.status}
                      </span>
                      <span className="text-xs font-medium">{entry.automationName}</span>
                    </div>
                    <span className="text-[10px] text-muted">
                      {new Date(entry.timestamp).toLocaleDateString("en-US", { month: "short", day: "numeric" })} at {new Date(entry.timestamp).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
                    </span>
                  </div>
                  <div className="flex items-center gap-4 text-[10px] text-muted">
                    <span className="flex items-center gap-1"><Inbox size={9} /> {entry.triggerEvent}</span>
                    <span className="flex items-center gap-1"><Users size={9} /> {entry.contact}</span>
                    <span className="flex items-center gap-1"><Play size={9} /> {entry.stepsRun} steps</span>
                    <span className="flex items-center gap-1"><Clock size={9} /> {entry.duration}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ---- NODE PICKER MODAL ---- */}
      <Modal isOpen={!!showNodePicker} onClose={() => setShowNodePicker(null)}
        title={`Add ${showNodePicker === "trigger" ? "Trigger" : showNodePicker === "condition" ? "Condition" : "Action"}`} size="md">
        <div className="space-y-2">
          {(showNodePicker === "trigger" ? TRIGGERS : showNodePicker === "condition" ? CONDITIONS : ACTIONS).map(item => (
            <button key={item.id} onClick={() => addNode(showNodePicker!, item)}
              className="w-full flex items-center gap-3 p-3 rounded-xl border border-border hover:border-gold/20 hover:bg-gold/[0.02] transition-all text-left">
              <div className={`w-9 h-9 rounded-lg flex items-center justify-center border ${
                showNodePicker === "trigger" ? "bg-emerald-500/10 border-emerald-500/20" :
                showNodePicker === "condition" ? "bg-amber-500/10 border-amber-500/20" :
                "bg-blue-500/10 border-blue-500/20"
              }`}>
                <IconFor name={item.icon} size={16} className={
                  showNodePicker === "trigger" ? "text-emerald-400" :
                  showNodePicker === "condition" ? "text-amber-400" :
                  "text-blue-400"
                } />
              </div>
              <div className="flex-1">
                <p className="text-xs font-semibold">{item.label}</p>
                <p className="text-[10px] text-muted">{item.description}</p>
              </div>
              <ChevronRight size={14} className="text-muted/30" />
            </button>
          ))}
        </div>
      </Modal>

      {/* ---- TEMPLATE PREVIEW MODAL ---- */}
      <Modal isOpen={!!showTemplatePreview} onClose={() => setShowTemplatePreview(null)}
        title={TEMPLATES.find(t => t.id === showTemplatePreview)?.name || ""} size="md">
        {(() => {
          const tmpl = TEMPLATES.find(t => t.id === showTemplatePreview);
          if (!tmpl) return null;
          const trig = TRIGGERS.find(t => t.id === tmpl.trigger);
          return (
            <div className="space-y-4">
              <p className="text-xs text-muted">{tmpl.description}</p>

              {/* Visual Flow Preview */}
              <div className="flex flex-col items-center gap-0">
                {trig && (
                  <div className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/20">
                    <div className="w-2 h-2 rounded-full bg-emerald-400" />
                    <IconFor name={trig.icon} size={14} className="text-emerald-400" />
                    <span className="text-xs font-medium text-emerald-400">{trig.label}</span>
                  </div>
                )}

                {tmpl.conditions.map((cId, i) => {
                  const c = CONDITIONS.find(x => x.id === cId);
                  return (
                    <div key={i} className="flex flex-col items-center">
                      <div className="w-px h-4 bg-border" />
                      <ArrowDown size={12} className="text-muted/30 -my-0.5" />
                      <div className="w-px h-2 bg-border" />
                      <div className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-amber-500/10 border border-amber-500/20">
                        <div className="w-2 h-2 rounded-full bg-amber-400" />
                        {c && <IconFor name={c.icon} size={14} className="text-amber-400" />}
                        <span className="text-xs font-medium text-amber-400">{c?.label || cId}</span>
                      </div>
                    </div>
                  );
                })}

                {tmpl.actions.map((aId, i) => {
                  const a = ACTIONS.find(x => x.id === aId);
                  return (
                    <div key={i} className="flex flex-col items-center">
                      <div className="w-px h-4 bg-border" />
                      <ArrowDown size={12} className="text-muted/30 -my-0.5" />
                      <div className="w-px h-2 bg-border" />
                      <div className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-blue-500/10 border border-blue-500/20">
                        <div className="w-2 h-2 rounded-full bg-blue-400" />
                        {a && <IconFor name={a.icon} size={14} className="text-blue-400" />}
                        <span className="text-xs font-medium text-blue-400">{a?.label || aId}</span>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-border">
                <button onClick={() => setShowTemplatePreview(null)} className="btn-secondary text-xs">Cancel</button>
                <button onClick={() => loadTemplate(tmpl.id)} className="btn-primary text-xs flex items-center gap-1.5">
                  <Play size={12} /> Use Template
                </button>
              </div>
            </div>
          );
        })()}
      </Modal>
    </div>
  );
}
