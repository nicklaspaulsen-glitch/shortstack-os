"use client";

import { useState } from "react";
import { useAuth } from "@/lib/auth-context";
import Modal from "@/components/ui/modal";
import {
  MessageSquare, Zap, Play, Sparkles, Send, Clock, GitBranch, Bot, Check,
  Camera, Music, Star, Users, Gift, Calendar, Plus, Trash2, Pause, BarChart3,
  AlertTriangle, Bell, RefreshCw, Settings, Layers, Target,
  Hash, Webhook, Mail, Phone,
  FileText, Database
} from "lucide-react";
import toast from "react-hot-toast";

/* ─── Types ─── */
interface AutomationStep {
  type: "message" | "delay" | "condition" | "action" | "webhook";
  content: string;
  delay?: string;
}

interface AutomationTemplate {
  id: string;
  name: string;
  description: string;
  platform: string;
  category: string;
  trigger: string;
  icon: React.ReactNode;
  color: string;
  steps: AutomationStep[];
}

interface RunLogEntry {
  id: string;
  automation_name: string;
  trigger_event: string;
  status: "completed" | "failed" | "skipped";
  lead_name: string;
  timestamp: string;
  steps_executed: number;
  error?: string;
}

interface AutomationAnalytics {
  total_runs: number;
  success_rate: number;
  avg_response_time: string;
  leads_captured: number;
  messages_sent: number;
  conversions: number;
}

type Tab = "templates" | "builder" | "active" | "logs" | "analytics";

/* ─── Static data ─── */
const TEMPLATES: AutomationTemplate[] = [
  { id: "ig-welcome", name: "Welcome New Followers", description: "Automatically send a welcome DM when someone follows you", platform: "instagram", category: "engagement", trigger: "New follower", icon: <Camera size={16} />, color: "text-pink-400", steps: [{ type: "delay", content: "Wait 2 minutes", delay: "2m" }, { type: "message", content: "Hey {first_name}! Thanks for following us! We help businesses like yours grow with proven marketing strategies. Would you like to learn more?" }, { type: "condition", content: "If they reply YES" }, { type: "message", content: "Awesome! Here's a quick overview of our services:\n\nSocial Media Management\nPaid Ads\nContent Creation\nWebsite & SEO\n\nWant to book a free strategy call? Just say 'BOOK'!" }] },
  { id: "ig-comment-reply", name: "Comment Auto-Reply", description: "Reply to comments with a DM containing more info", platform: "instagram", category: "engagement", trigger: "Comment with keyword", icon: <MessageSquare size={16} />, color: "text-pink-400", steps: [{ type: "message", content: "Hey {first_name}! Thanks for your comment! I just sent you more info in your DMs!" }, { type: "delay", content: "Wait 30 seconds", delay: "30s" }, { type: "message", content: "Here's the link you asked about: {link}\n\nLet me know if you have any questions!" }] },
  { id: "ig-story-reply", name: "Story Mention Thank You", description: "Send a thank you DM when someone mentions you in their story", platform: "instagram", category: "engagement", trigger: "Story mention", icon: <Star size={16} />, color: "text-pink-400", steps: [{ type: "message", content: "Hey {first_name}! We saw you mentioned us in your story - that means so much! Thank you!" }, { type: "delay", content: "Wait 1 minute", delay: "1m" }, { type: "message", content: "As a thank you, here's a special {discount}% off! Use code: THANKYOU{discount}" }] },
  { id: "ig-lead-capture", name: "Lead Capture Funnel", description: "Qualify leads through DMs with automated questions", platform: "instagram", category: "lead_gen", trigger: "DM keyword: INFO", icon: <Users size={16} />, color: "text-pink-400", steps: [{ type: "message", content: "Hey {first_name}! Thanks for reaching out. What industry are you in?" }, { type: "condition", content: "Wait for reply" }, { type: "message", content: "And what's your biggest challenge right now with getting new customers?" }, { type: "condition", content: "Wait for reply" }, { type: "message", content: "We've helped tons of businesses like yours! Want to book a free 15-min strategy call?\n\nBook here: {booking_link}" }] },
  { id: "ig-promo", name: "Promotional Campaign", description: "Send a promo offer to engaged followers", platform: "instagram", category: "sales", trigger: "Manual broadcast", icon: <Gift size={16} />, color: "text-pink-400", steps: [{ type: "message", content: "Hey {first_name}! We have something special for you this week!\n\n{promo_details}\n\nReply 'YES' if you want in!" }, { type: "condition", content: "If they reply YES" }, { type: "message", content: "You're in! Here's your exclusive link: {promo_link}" }] },
  { id: "ig-appointment", name: "Appointment Reminder", description: "Send automated appointment reminders via DM", platform: "instagram", category: "operations", trigger: "24h before appointment", icon: <Calendar size={16} />, color: "text-pink-400", steps: [{ type: "message", content: "Hey {first_name}! Reminder: you have an appointment tomorrow at {time}.\n\nReply 'CONFIRM' or 'RESCHEDULE'." }, { type: "condition", content: "If RESCHEDULE" }, { type: "message", content: "No problem! Pick a new time: {booking_link}" }] },
  { id: "tt-welcome", name: "TikTok Comment Funnel", description: "Reply to TikTok comments and drive to DMs", platform: "tiktok", category: "lead_gen", trigger: "Comment with keyword", icon: <Music size={16} />, color: "text-white", steps: [{ type: "message", content: "Thanks for commenting! I just sent you a DM with more details!" }, { type: "delay", content: "Wait 10 seconds", delay: "10s" }, { type: "message", content: "Hey {first_name}! Here's the info from the video:\n\n{video_info}\n\nReply YES to get started!" }] },
  { id: "fb-messenger-bot", name: "Facebook Messenger Bot", description: "Auto-respond to Facebook page messages", platform: "facebook", category: "engagement", trigger: "New page message", icon: <MessageSquare size={16} />, color: "text-blue-400", steps: [{ type: "message", content: "Hey {first_name}! How can we help?\n\n1 Learn about services\n2 Get a free quote\n3 Book appointment\n4 Talk to a human\n\nReply with the number!" }, { type: "condition", content: "Route based on reply" }, { type: "message", content: "{selected_option_response}" }] },
  { id: "new-lead-nurture", name: "New Lead Nurture Sequence", description: "3-day nurture sequence for new leads", platform: "email", category: "lead_gen", trigger: "New lead added", icon: <Mail size={16} />, color: "text-cyan-400", steps: [{ type: "message", content: "Welcome email: introduce your services and value prop" }, { type: "delay", content: "Wait 1 day", delay: "1d" }, { type: "message", content: "Case study email: show results you've achieved" }, { type: "delay", content: "Wait 2 days", delay: "2d" }, { type: "message", content: "CTA email: book a call or claim an offer" }] },
  { id: "status-change-notify", name: "Status Change Notification", description: "Alert team when lead status changes", platform: "system", category: "operations", trigger: "Lead status change", icon: <Bell size={16} />, color: "text-warning", steps: [{ type: "action", content: "Send Slack notification to #sales channel" }, { type: "condition", content: "If status is 'qualified'" }, { type: "action", content: "Create task for sales team" }, { type: "action", content: "Update CRM pipeline stage" }] },
  { id: "webhook-inbound", name: "Webhook Processor", description: "Process inbound webhooks and trigger actions", platform: "system", category: "operations", trigger: "Webhook received", icon: <Webhook size={16} />, color: "text-yellow-400", steps: [{ type: "condition", content: "Parse webhook payload" }, { type: "action", content: "Create or update lead in CRM" }, { type: "action", content: "Send Telegram notification" }, { type: "delay", content: "Wait 5 minutes", delay: "5m" }, { type: "action", content: "Trigger follow-up automation" }] },
  { id: "date-based-followup", name: "Date-Based Follow-Up", description: "Trigger actions on specific dates (birthdays, anniversaries)", platform: "system", category: "engagement", trigger: "Date field matches", icon: <Calendar size={16} />, color: "text-purple-400", steps: [{ type: "message", content: "Happy anniversary! It's been {years} year(s) since you joined us!" }, { type: "action", content: "Generate special offer coupon" }, { type: "message", content: "As a thank you, here's an exclusive {discount}% off: {coupon_code}" }] },
];

const CATEGORIES = [
  { id: "all", label: "All" },
  { id: "engagement", label: "Engagement" },
  { id: "lead_gen", label: "Lead Gen" },
  { id: "sales", label: "Sales" },
  { id: "operations", label: "Operations" },
];

const UserPlus = Users; // Reuse Users icon

const TRIGGER_TYPES = [
  { id: "new_lead", label: "New Lead Added", icon: <UserPlus size={14} />, desc: "When a new lead enters the system" },
  { id: "status_change", label: "Status Change", icon: <RefreshCw size={14} />, desc: "When a lead's status changes" },
  { id: "date_based", label: "Date-Based", icon: <Calendar size={14} />, desc: "On a specific date or anniversary" },
  { id: "webhook", label: "Webhook", icon: <Webhook size={14} />, desc: "When an external webhook is received" },
  { id: "keyword_dm", label: "DM Keyword", icon: <Hash size={14} />, desc: "When a DM contains a keyword" },
  { id: "new_follower", label: "New Follower", icon: <Users size={14} />, desc: "When someone follows your account" },
  { id: "comment", label: "Comment Trigger", icon: <MessageSquare size={14} />, desc: "When someone comments on a post" },
  { id: "form_submit", label: "Form Submission", icon: <FileText size={14} />, desc: "When a form is submitted" },
  { id: "invoice_paid", label: "Invoice Paid", icon: <Check size={14} />, desc: "When a client pays an invoice" },
  { id: "manual", label: "Manual Trigger", icon: <Play size={14} />, desc: "Manually triggered by you" },
];

const ACTION_TYPES = [
  { id: "send_dm", label: "Send DM", icon: <Send size={14} /> },
  { id: "send_email", label: "Send Email", icon: <Mail size={14} /> },
  { id: "send_sms", label: "Send SMS", icon: <Phone size={14} /> },
  { id: "create_task", label: "Create Task", icon: <FileText size={14} /> },
  { id: "update_status", label: "Update Status", icon: <RefreshCw size={14} /> },
  { id: "add_tag", label: "Add Tag", icon: <Hash size={14} /> },
  { id: "webhook_call", label: "Call Webhook", icon: <Webhook size={14} /> },
  { id: "notify_slack", label: "Notify Slack", icon: <Bell size={14} /> },
  { id: "notify_telegram", label: "Notify Telegram", icon: <Send size={14} /> },
  { id: "generate_content", label: "Generate Content", icon: <Sparkles size={14} /> },
  { id: "create_invoice", label: "Create Invoice", icon: <Database size={14} /> },
  { id: "assign_agent", label: "Assign to Agent", icon: <Bot size={14} /> },
];

/* ─── Component ─── */
export default function AutomationsPage() {
  useAuth();
  const [tab, setTab] = useState<Tab>("templates");
  const [activeCategory, setActiveCategory] = useState("all");
  const [selectedTemplate, setSelectedTemplate] = useState<AutomationTemplate | null>(null);
  const [activeAutomations, setActiveAutomations] = useState<string[]>(["ig-welcome", "ig-comment-reply"]);
  const [customizing, setCustomizing] = useState(false);
  const [editedSteps, setEditedSteps] = useState<AutomationStep[]>([]);

  // Builder state
  const [builderName, setBuilderName] = useState("");
  const [builderTrigger, setBuilderTrigger] = useState("");
  const [builderSteps, setBuilderSteps] = useState<AutomationStep[]>([]);
  const [showAddStep, setShowAddStep] = useState(false);
  const [newStepType, setNewStepType] = useState<AutomationStep["type"]>("message");
  const [newStepContent, setNewStepContent] = useState("");
  const [newStepDelay, setNewStepDelay] = useState("1m");

  // Run log
  const [runLog] = useState<RunLogEntry[]>([
    { id: "r1", automation_name: "Welcome New Followers", trigger_event: "New follower: @sarah_design", status: "completed", lead_name: "Sarah Design Co", timestamp: "2026-04-14T10:30:00Z", steps_executed: 4 },
    { id: "r2", automation_name: "Comment Auto-Reply", trigger_event: "Comment: 'How much?'", status: "completed", lead_name: "Mike's Gym", timestamp: "2026-04-14T09:15:00Z", steps_executed: 3 },
    { id: "r3", automation_name: "Lead Capture Funnel", trigger_event: "DM keyword: INFO", status: "completed", lead_name: "Austin Dental", timestamp: "2026-04-14T08:45:00Z", steps_executed: 5 },
    { id: "r4", automation_name: "Welcome New Followers", trigger_event: "New follower: @techstartup", status: "failed", lead_name: "Tech Startup Inc", timestamp: "2026-04-13T22:00:00Z", steps_executed: 1, error: "Rate limit reached" },
    { id: "r5", automation_name: "Promotional Campaign", trigger_event: "Manual broadcast", status: "completed", lead_name: "Batch (24 recipients)", timestamp: "2026-04-13T14:00:00Z", steps_executed: 2 },
    { id: "r6", automation_name: "Comment Auto-Reply", trigger_event: "Comment: 'Link please'", status: "skipped", lead_name: "Bot Account", timestamp: "2026-04-13T11:30:00Z", steps_executed: 0, error: "Detected as bot - skipped" },
    { id: "r7", automation_name: "New Lead Nurture Sequence", trigger_event: "New lead from scraper", status: "completed", lead_name: "Fresh Flowers LLC", timestamp: "2026-04-13T10:00:00Z", steps_executed: 1 },
    { id: "r8", automation_name: "Webhook Processor", trigger_event: "Inbound webhook from GHL", status: "completed", lead_name: "Golden Spa", timestamp: "2026-04-12T16:45:00Z", steps_executed: 4 },
  ]);

  // Analytics
  const [analytics] = useState<AutomationAnalytics>({
    total_runs: 1247,
    success_rate: 94.2,
    avg_response_time: "2.3 min",
    leads_captured: 342,
    messages_sent: 4821,
    conversions: 67,
  });

  // Error notifications
  const [errorNotifications, setErrorNotifications] = useState(true);

  // Priority ordering
  const [priorities, setPriorities] = useState<Record<string, number>>({});

  const filtered = activeCategory === "all" ? TEMPLATES : TEMPLATES.filter(t => t.category === activeCategory);

  function activateTemplate(template: AutomationTemplate) {
    setActiveAutomations(prev => [...prev, template.id]);
    toast.success(`"${template.name}" activated!`);
    setSelectedTemplate(null);
  }

  function deactivateTemplate(id: string) {
    setActiveAutomations(prev => prev.filter(a => a !== id));
    toast.success("Automation deactivated");
  }

  function startCustomize(template: AutomationTemplate) {
    setEditedSteps([...template.steps]);
    setCustomizing(true);
  }

  function addBuilderStep() {
    if (!newStepContent.trim()) { toast.error("Enter step content"); return; }
    const step: AutomationStep = { type: newStepType, content: newStepContent, delay: newStepType === "delay" ? newStepDelay : undefined };
    setBuilderSteps(prev => [...prev, step]);
    setNewStepContent("");
    setShowAddStep(false);
  }

  function saveCustomAutomation() {
    if (!builderName.trim()) { toast.error("Enter automation name"); return; }
    if (!builderTrigger) { toast.error("Select a trigger"); return; }
    if (builderSteps.length === 0) { toast.error("Add at least one step"); return; }
    toast.success(`Automation "${builderName}" created!`);
    setBuilderName("");
    setBuilderTrigger("");
    setBuilderSteps([]);
    setTab("active");
  }

  const getStepIcon = (type: string) => {
    switch (type) {
      case "message": return <Send size={12} className="text-gold" />;
      case "delay": return <Clock size={12} className="text-muted" />;
      case "condition": return <GitBranch size={12} className="text-warning" />;
      case "action": return <Zap size={12} className="text-gold" />;
      case "webhook": return <Webhook size={12} className="text-yellow-400" />;
      default: return <Zap size={12} />;
    }
  };

  const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: "templates", label: "Templates", icon: <Layers size={14} /> },
    { id: "builder", label: "Builder", icon: <Settings size={14} /> },
    { id: "active", label: `Active (${activeAutomations.length})`, icon: <Zap size={14} /> },
    { id: "logs", label: "Run Log", icon: <FileText size={14} /> },
    { id: "analytics", label: "Analytics", icon: <BarChart3 size={14} /> },
  ];

  return (
    <div className="fade-in space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-header mb-0 flex items-center gap-2"><Bot size={18} className="text-gold" /> Automations</h1>
          <p className="text-xs text-muted mt-0.5">Build and manage automated workflows for DMs, emails, leads, and more</p>
        </div>
        <div className="flex items-center gap-2">
          {activeAutomations.length > 0 && (
            <div className="flex items-center gap-1.5 text-[10px] bg-success/[0.08] text-success px-2.5 py-1 rounded-md border border-success/15">
              <Zap size={10} /><span className="font-medium">{activeAutomations.length} active</span>
            </div>
          )}
          <label className="flex items-center gap-1.5 text-[10px] text-muted cursor-pointer">
            <input type="checkbox" checked={errorNotifications} onChange={e => setErrorNotifications(e.target.checked)} className="accent-gold w-3 h-3" />
            <Bell size={10} /> Error alerts
          </label>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-border pb-0">
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-medium rounded-t-lg transition-all ${tab === t.id ? "bg-surface-light border border-b-0 border-border text-gold" : "text-muted hover:text-foreground"}`}>
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {/* ─── TEMPLATES TAB ─── */}
      {tab === "templates" && (
        <div className="space-y-4">
          <div className="tab-group w-fit">
            {CATEGORIES.map(cat => (
              <button key={cat.id} onClick={() => setActiveCategory(cat.id)}
                className={activeCategory === cat.id ? "tab-item-active" : "tab-item-inactive"}>{cat.label}</button>
            ))}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {filtered.map(template => {
              const isActive = activeAutomations.includes(template.id);
              return (
                <button key={template.id} onClick={() => setSelectedTemplate(template)}
                  className={`text-left rounded-xl p-4 border transition-all hover:-translate-y-[1px] ${isActive ? "border-success/20 bg-success/[0.03]" : "border-border bg-surface hover:border-gold/20 hover:shadow-card-hover"}`}>
                  <div className="flex items-center gap-2.5 mb-2">
                    <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${isActive ? "bg-success/10" : "bg-surface-light"} border border-border`}>
                      <span className={template.color}>{template.icon}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <p className="text-xs font-semibold truncate">{template.name}</p>
                        {isActive && <Check size={12} className="text-success shrink-0" />}
                      </div>
                      <p className="text-[9px] text-muted capitalize">{template.platform} - {template.category.replace("_", " ")}</p>
                    </div>
                  </div>
                  <p className="text-[10px] text-muted leading-relaxed mb-2">{template.description}</p>
                  <div className="flex items-center gap-1 text-[9px] text-gold"><Zap size={9} /> {template.trigger}</div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* ─── BUILDER TAB ─── */}
      {tab === "builder" && (
        <div className="space-y-4">
          <div className="card">
            <h3 className="text-sm font-medium mb-4 flex items-center gap-2"><Settings size={14} className="text-gold" /> Automation Builder</h3>
            <div className="space-y-4">
              <div>
                <label className="text-[10px] text-muted uppercase tracking-wider">Automation Name</label>
                <input value={builderName} onChange={e => setBuilderName(e.target.value)} placeholder="e.g. New Lead Welcome Sequence" className="input w-full text-sm mt-1" />
              </div>
              <div>
                <label className="text-[10px] text-muted uppercase tracking-wider mb-2 block">Trigger Type</label>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2">
                  {TRIGGER_TYPES.map(t => (
                    <button key={t.id} onClick={() => setBuilderTrigger(t.id)}
                      className={`p-3 rounded-lg border text-left transition-all ${builderTrigger === t.id ? "border-gold bg-gold/10" : "border-border hover:border-gold/30"}`}>
                      <div className="text-gold mb-1">{t.icon}</div>
                      <p className="text-[10px] font-medium">{t.label}</p>
                      <p className="text-[8px] text-muted">{t.desc}</p>
                    </button>
                  ))}
                </div>
              </div>
              {/* Steps */}
              <div>
                <label className="text-[10px] text-muted uppercase tracking-wider mb-2 block">Steps ({builderSteps.length})</label>
                {builderSteps.length > 0 && (
                  <div className="space-y-2 mb-3">
                    {builderSteps.map((step, i) => (
                      <div key={i} className="flex items-start gap-2">
                        <div className="w-6 h-6 rounded-md bg-surface-light flex items-center justify-center shrink-0 mt-1 border border-border">{getStepIcon(step.type)}</div>
                        <div className="flex-1 bg-surface-light/50 border border-border rounded-lg px-3 py-2">
                          <p className="text-[9px] text-muted uppercase mb-0.5">{step.type}{step.delay ? ` (${step.delay})` : ""}</p>
                          <p className="text-xs">{step.content}</p>
                        </div>
                        <button onClick={() => setBuilderSteps(prev => prev.filter((_, j) => j !== i))} className="text-danger mt-1"><Trash2 size={12} /></button>
                      </div>
                    ))}
                  </div>
                )}
                {showAddStep ? (
                  <div className="border border-gold/20 rounded-lg p-3 space-y-3">
                    <div className="flex gap-2">
                      {(["message", "delay", "condition", "action", "webhook"] as const).map(t => (
                        <button key={t} onClick={() => setNewStepType(t)}
                          className={`text-[10px] px-2.5 py-1 rounded-lg border capitalize ${newStepType === t ? "border-gold bg-gold/10 text-gold" : "border-border text-muted"}`}>{t}</button>
                      ))}
                    </div>
                    {newStepType === "delay" && (
                      <select value={newStepDelay} onChange={e => setNewStepDelay(e.target.value)} className="input text-xs py-1.5 w-full">
                        <option value="30s">30 seconds</option><option value="1m">1 minute</option><option value="5m">5 minutes</option>
                        <option value="15m">15 minutes</option><option value="1h">1 hour</option><option value="1d">1 day</option>
                        <option value="3d">3 days</option><option value="7d">7 days</option>
                      </select>
                    )}
                    <textarea value={newStepContent} onChange={e => setNewStepContent(e.target.value)} placeholder={newStepType === "delay" ? "Description of this delay..." : "Step content..."} rows={3} className="input w-full text-xs" />
                    <div className="flex gap-2">
                      <button onClick={addBuilderStep} className="btn-primary text-xs py-1.5"><Plus size={12} /> Add Step</button>
                      <button onClick={() => setShowAddStep(false)} className="btn-secondary text-xs py-1.5">Cancel</button>
                    </div>
                  </div>
                ) : (
                  <button onClick={() => setShowAddStep(true)} className="w-full border border-dashed border-border rounded-lg py-3 text-muted text-xs hover:border-gold/30 hover:text-gold transition-all flex items-center justify-center gap-2">
                    <Plus size={14} /> Add Step
                  </button>
                )}
              </div>
              <div className="flex gap-2 pt-2 border-t border-border">
                <button onClick={saveCustomAutomation} className="btn-primary flex items-center gap-2"><Sparkles size={14} /> Save & Activate</button>
                <button onClick={() => { setBuilderName(""); setBuilderTrigger(""); setBuilderSteps([]); }} className="btn-secondary">Reset</button>
              </div>
            </div>
          </div>
          {/* Action Reference */}
          <div className="card">
            <h3 className="text-xs font-medium mb-3 flex items-center gap-2"><Zap size={13} className="text-gold" /> Available Actions</h3>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
              {ACTION_TYPES.map(a => (
                <div key={a.id} className="flex items-center gap-2 p-2 rounded-lg border border-border text-xs">
                  <span className="text-gold">{a.icon}</span>{a.label}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ─── ACTIVE TAB ─── */}
      {tab === "active" && (
        <div className="space-y-4">
          {activeAutomations.length === 0 ? (
            <div className="card text-center py-12"><Zap size={32} className="mx-auto text-muted/30 mb-3" /><p className="text-muted text-sm">No active automations. Activate one from Templates.</p></div>
          ) : (
            <div className="space-y-3">
              {activeAutomations.map((id, idx) => {
                const template = TEMPLATES.find(t => t.id === id);
                if (!template) return null;
                return (
                  <div key={id} className="card">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-success/10 rounded-xl flex items-center justify-center border border-success/20">
                          <span className={template.color}>{template.icon}</span>
                        </div>
                        <div>
                          <p className="font-medium text-sm flex items-center gap-2">{template.name}
                            <span className="text-[8px] bg-success/10 text-success px-1.5 py-0.5 rounded-full">Active</span>
                          </p>
                          <p className="text-[10px] text-muted">{template.trigger} - {template.platform}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="text-right text-[10px] text-muted mr-2">
                          <p>Priority: {priorities[id] || idx + 1}</p>
                          <p>{template.steps.length} steps</p>
                        </div>
                        <select value={priorities[id] || idx + 1} onChange={e => setPriorities(prev => ({ ...prev, [id]: parseInt(e.target.value) }))} className="input text-[10px] py-1 w-14">
                          {Array.from({ length: activeAutomations.length }, (_, i) => <option key={i} value={i + 1}>{i + 1}</option>)}
                        </select>
                        <button onClick={() => deactivateTemplate(id)} className="text-[10px] px-2 py-1 rounded bg-danger/10 text-danger border border-danger/20 hover:bg-danger/20">
                          <Pause size={10} />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ─── RUN LOG TAB ─── */}
      {tab === "logs" && (
        <div className="space-y-4">
          <div className="card">
            <h3 className="text-sm font-medium mb-4 flex items-center gap-2"><FileText size={14} className="text-gold" /> Run Log</h3>
            <div className="space-y-2">
              {runLog.map(entry => (
                <div key={entry.id} className={`p-3 border rounded-lg ${entry.status === "failed" ? "border-danger/20 bg-danger/5" : entry.status === "skipped" ? "border-warning/20 bg-warning/5" : "border-border"}`}>
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <span className={`text-[8px] px-1.5 py-0.5 rounded-full font-medium ${entry.status === "completed" ? "bg-success/10 text-success" : entry.status === "failed" ? "bg-danger/10 text-danger" : "bg-warning/10 text-warning"}`}>
                        {entry.status}
                      </span>
                      <span className="text-xs font-medium">{entry.automation_name}</span>
                    </div>
                    <span className="text-[10px] text-muted">{new Date(entry.timestamp).toLocaleString()}</span>
                  </div>
                  <div className="flex items-center gap-3 text-[10px] text-muted">
                    <span>{entry.trigger_event}</span>
                    <span>-</span>
                    <span>{entry.lead_name}</span>
                    <span>-</span>
                    <span>{entry.steps_executed} steps</span>
                  </div>
                  {entry.error && <p className="text-[10px] text-danger mt-1"><AlertTriangle size={10} className="inline mr-1" />{entry.error}</p>}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ─── ANALYTICS TAB ─── */}
      {tab === "analytics" && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            {[
              { label: "Total Runs", value: analytics.total_runs.toLocaleString(), icon: <Play size={16} />, color: "text-gold" },
              { label: "Success Rate", value: `${analytics.success_rate}%`, icon: <Check size={16} />, color: "text-success" },
              { label: "Avg Response", value: analytics.avg_response_time, icon: <Clock size={16} />, color: "text-info" },
              { label: "Leads Captured", value: analytics.leads_captured.toString(), icon: <Users size={16} />, color: "text-purple-400" },
              { label: "Messages Sent", value: analytics.messages_sent.toLocaleString(), icon: <Send size={16} />, color: "text-cyan-400" },
              { label: "Conversions", value: analytics.conversions.toString(), icon: <Target size={16} />, color: "text-success" },
            ].map(stat => (
              <div key={stat.label} className="card text-center p-4">
                <div className={`${stat.color} mx-auto mb-2`}>{stat.icon}</div>
                <p className="text-lg font-bold">{stat.value}</p>
                <p className="text-[10px] text-muted">{stat.label}</p>
              </div>
            ))}
          </div>
          {/* Per-automation stats */}
          <div className="card">
            <h3 className="text-sm font-medium mb-3 flex items-center gap-2"><BarChart3 size={14} className="text-gold" /> Automation Performance</h3>
            <div className="space-y-2">
              {activeAutomations.map(id => {
                const template = TEMPLATES.find(t => t.id === id);
                if (!template) return null;
                const runs = Math.floor(Math.random() * 200) + 50;
                const rate = (85 + Math.random() * 15).toFixed(1);
                return (
                  <div key={id} className="flex items-center justify-between p-3 border border-border rounded-lg">
                    <div className="flex items-center gap-2">
                      <span className={template.color}>{template.icon}</span>
                      <span className="text-xs font-medium">{template.name}</span>
                    </div>
                    <div className="flex items-center gap-4 text-xs">
                      <span className="text-muted">{runs} runs</span>
                      <span className="text-success">{rate}% success</span>
                      <div className="w-24 h-1.5 bg-surface-light rounded-full overflow-hidden">
                        <div className="h-full bg-gold rounded-full" style={{ width: `${rate}%` }} />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
          {/* Batch automation */}
          <div className="card">
            <h3 className="text-sm font-medium mb-3 flex items-center gap-2"><Layers size={14} className="text-gold" /> Batch Automation</h3>
            <p className="text-xs text-muted mb-3">Run an automation on multiple leads at once.</p>
            <div className="grid grid-cols-3 gap-3">
              <button className="p-3 border border-border rounded-lg text-left hover:border-gold/30 transition-all">
                <p className="text-xs font-medium">All New Leads</p>
                <p className="text-[10px] text-muted">Run welcome sequence on all uncontacted leads</p>
              </button>
              <button className="p-3 border border-border rounded-lg text-left hover:border-gold/30 transition-all">
                <p className="text-xs font-medium">Stale Leads</p>
                <p className="text-[10px] text-muted">Re-engage leads with no activity in 7+ days</p>
              </button>
              <button className="p-3 border border-border rounded-lg text-left hover:border-gold/30 transition-all">
                <p className="text-xs font-medium">Hot Leads</p>
                <p className="text-[10px] text-muted">Push high-score leads to booking sequence</p>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Template preview modal */}
      <Modal isOpen={!!selectedTemplate} onClose={() => { setSelectedTemplate(null); setCustomizing(false); }} title={selectedTemplate?.name || ""} size="lg">
        {selectedTemplate && (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-surface-light border border-border">
                <span className={selectedTemplate.color}>{selectedTemplate.icon}</span>
              </div>
              <div>
                <p className="text-xs font-semibold">{selectedTemplate.name}</p>
                <p className="text-[10px] text-muted">{selectedTemplate.description}</p>
              </div>
            </div>
            <div className="bg-gold/[0.05] border border-gold/15 rounded-lg px-3 py-2">
              <p className="text-[9px] text-gold uppercase tracking-wider font-medium mb-0.5">Trigger</p>
              <p className="text-xs">{selectedTemplate.trigger}</p>
            </div>
            <div>
              <p className="text-[10px] text-muted uppercase tracking-wider font-medium mb-2">Message Flow</p>
              <div className="space-y-1.5">
                {(customizing ? editedSteps : selectedTemplate.steps).map((step, i) => (
                  <div key={i}>
                    {i > 0 && <div className="flex justify-center py-0.5"><div className="w-px h-3 bg-border/50" /></div>}
                    <div className="flex items-start gap-2">
                      <div className="w-6 h-6 rounded-md bg-surface-light flex items-center justify-center shrink-0 mt-0.5 border border-border">{getStepIcon(step.type)}</div>
                      <div className={`flex-1 rounded-lg px-3 py-2 border text-xs ${step.type === "message" ? "bg-gold/[0.03] border-gold/10" : step.type === "delay" ? "bg-surface-light/50 border-border" : step.type === "condition" ? "bg-warning/[0.03] border-warning/10" : "bg-gold/[0.03] border-gold/10"}`}>
                        {customizing && step.type === "message" ? (
                          <textarea value={step.content} onChange={e => { const updated = [...editedSteps]; updated[i] = { ...updated[i], content: e.target.value }; setEditedSteps(updated); }} className="w-full bg-transparent text-xs resize-none focus:outline-none min-h-[60px]" />
                        ) : (
                          <p className="whitespace-pre-wrap leading-relaxed">{step.content}</p>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="flex items-center justify-between pt-2 border-t border-border">
              <button onClick={() => startCustomize(selectedTemplate)} className="btn-ghost text-[10px] flex items-center gap-1"><Sparkles size={11} /> {customizing ? "Editing..." : "Customize"}</button>
              <div className="flex gap-2">
                {activeAutomations.includes(selectedTemplate.id) ? (
                  <button onClick={() => { deactivateTemplate(selectedTemplate.id); setSelectedTemplate(null); }} className="btn-danger text-xs">Deactivate</button>
                ) : (
                  <button onClick={() => activateTemplate(selectedTemplate)} className="btn-primary text-xs flex items-center gap-1.5"><Play size={12} /> Activate</button>
                )}
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
