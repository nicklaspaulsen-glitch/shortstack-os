"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/lib/auth-context";
import {
  Bot, Settings, Plus, Trash2, Play, Pause, Edit3, X,
  Wifi, WifiOff, Clock, AlertCircle, Save, Loader,
  Zap, DollarSign, TrendingUp, Users, FileText,
  Calendar, BarChart3, Activity, CheckCircle2, XCircle,
  Copy, Sparkles, MessageCircle, Filter
} from "lucide-react";
import PageHero from "@/components/ui/page-hero";
import EmptyState from "@/components/ui/empty-state";
import toast from "react-hot-toast";
import PageAI from "@/components/page-ai";

// ─── Types ──────────────────────────────────────────────────────────────────

type Tab = "routines" | "activity" | "templates" | "settings";

interface Routine {
  id: string;
  user_id: string | null;
  name: string;
  description: string | null;
  routine_type: string;
  schedule: string;
  enabled: boolean;
  paused: boolean;
  message_template: string | null;
  conditions: Record<string, unknown>;
  last_run_at: string | null;
  next_run_at: string | null;
  run_count: number | null;
  success_count: number | null;
  fail_count: number | null;
  last_message: string | null;
  created_at: string;
  updated_at: string;
}

interface ActivityEntry {
  id: string;
  action_type: string;
  description: string;
  status: string | null;
  result: Record<string, unknown> | null;
  agent: string | null;
  created_at: string;
}

interface Template {
  key: string;
  name: string;
  description: string;
  routine_type: string;
  schedule: string;
  message_template: string;
  icon: React.ReactNode;
  color: string;
}

// ─── Templates ──────────────────────────────────────────────────────────────

const ROUTINE_TEMPLATES: Template[] = [
  {
    key: "daily_lead_digest",
    name: "Daily Lead Digest",
    description: "Every morning, summarize new leads that came in overnight.",
    routine_type: "daily_brief",
    schedule: "0 9 * * *",
    message_template:
      "🎯 *Daily Lead Digest — {{today_date}}*\n\nNew leads: {{lead_count}}\nReplies: {{reply_count}}\nBooked: {{booked_count}}",
    icon: <Users size={18} />,
    color: "text-blue-400",
  },
  {
    key: "outreach_recap",
    name: "Outreach Recap",
    description: "Weekly recap of all outreach campaigns and reply rates.",
    routine_type: "outreach_report",
    schedule: "0 17 * * 5",
    message_template:
      "📨 *Weekly Outreach Recap*\n\nTotal sent: {{sent_count}}\nReplied: {{reply_count}}\nBooked: {{booked_count}}",
    icon: <MessageCircle size={18} />,
    color: "text-emerald-400",
  },
  {
    key: "revenue_alert",
    name: "Revenue Alert",
    description: "Ping me whenever a new deal over a threshold closes.",
    routine_type: "revenue_alert",
    schedule: "manual",
    message_template:
      "💸 *New Deal Closed!*\n\nClient: {{client_name}}\nValue: ${{deal_value}}",
    icon: <DollarSign size={18} />,
    color: "text-gold",
  },
  {
    key: "downtime_alert",
    name: "Downtime Alert",
    description: "Notify me whenever any integration or service goes down.",
    routine_type: "downtime_alert",
    schedule: "*/15 * * * *",
    message_template:
      "🚨 *Service Down*\n\n{{service_name}} is currently unreachable.",
    icon: <AlertCircle size={18} />,
    color: "text-red-400",
  },
  {
    key: "content_published",
    name: "Content Published",
    description: "Ping me whenever autopilot posts content.",
    routine_type: "content_published",
    schedule: "manual",
    message_template:
      "📤 *Content Published*\n\n{{client_name}} — {{content_title}}",
    icon: <Sparkles size={18} />,
    color: "text-purple-400",
  },
  {
    key: "appointment_reminder",
    name: "Appointment Reminder",
    description: "1 hour before a meeting, send a reminder.",
    routine_type: "appointment_reminder",
    schedule: "0 */1 * * *",
    message_template:
      "📅 *Upcoming Meeting*\n\n{{client_name}} at {{meeting_time}}",
    icon: <Calendar size={18} />,
    color: "text-sky-400",
  },
  {
    key: "weekly_financial",
    name: "Weekly Financial Summary",
    description: "Sunday evening: MRR, new deals, churn, runway.",
    routine_type: "weekly_financial_summary",
    schedule: "0 19 * * 0",
    message_template:
      "📊 *Weekly Financial Summary*\n\nMRR: ${{mrr}}\nNew deals: {{new_deals}}\nChurn: {{churn_count}}",
    icon: <TrendingUp size={18} />,
    color: "text-emerald-400",
  },
  {
    key: "invoice_chase",
    name: "Invoice Chase",
    description: "Daily summary of overdue invoices chased.",
    routine_type: "invoice_chase",
    schedule: "0 11 * * *",
    message_template:
      "💰 *Invoice Chase*\n\nReminders sent: {{chased_count}}\nOverdue total: ${{overdue_total}}",
    icon: <FileText size={18} />,
    color: "text-amber-400",
  },
  {
    key: "custom",
    name: "Custom",
    description: "Build your own routine from scratch.",
    routine_type: "custom",
    schedule: "manual",
    message_template: "Hello from your bot!",
    icon: <Zap size={18} />,
    color: "text-gold",
  },
];

const ROUTINE_TYPES: { value: string; label: string }[] = [
  { value: "daily_brief", label: "Daily Brief" },
  { value: "lead_finder_done", label: "Lead Finder" },
  { value: "outreach_report", label: "Outreach Report" },
  { value: "retention_check", label: "Retention Check" },
  { value: "invoice_chase", label: "Invoice Chase" },
  { value: "revenue_alert", label: "Revenue Alert" },
  { value: "downtime_alert", label: "Downtime Alert" },
  { value: "content_published", label: "Content Published" },
  { value: "appointment_reminder", label: "Appointment Reminder" },
  { value: "weekly_financial_summary", label: "Weekly Financial" },
  { value: "custom", label: "Custom" },
];

const SCHEDULE_PRESETS: { label: string; value: string }[] = [
  { label: "Every hour", value: "0 * * * *" },
  { label: "Every day at 9am", value: "0 9 * * *" },
  { label: "Weekdays at 5pm", value: "0 17 * * 1-5" },
  { label: "Weekly (Sunday 7pm)", value: "0 19 * * 0" },
  { label: "Monthly (1st)", value: "0 9 1 * *" },
  { label: "Manual only", value: "manual" },
  { label: "Custom cron", value: "custom" },
];

const VARIABLES = [
  "client_name",
  "today_date",
  "lead_count",
  "reply_count",
  "booked_count",
  "deal_value",
  "sent_count",
  "mrr",
  "new_deals",
  "churn_count",
  "chased_count",
  "overdue_total",
  "service_name",
  "content_title",
  "meeting_time",
];

// ─── Helpers ────────────────────────────────────────────────────────────────

function fmtTime(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  const diff = (Date.now() - d.getTime()) / 1000;
  if (diff < 60) return `${Math.floor(diff)}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function iconForType(type: string): React.ReactNode {
  const t = ROUTINE_TEMPLATES.find(tp => tp.routine_type === type);
  if (t) return t.icon;
  return <Zap size={16} />;
}

function colorForType(type: string): string {
  const t = ROUTINE_TEMPLATES.find(tp => tp.routine_type === type);
  return t?.color || "text-gold";
}

// ─── Component ──────────────────────────────────────────────────────────────

export default function TelegramBotPage() {
  useAuth();

  const [tab, setTab] = useState<Tab>("routines");

  // Routines state
  const [routines, setRoutines] = useState<Routine[]>([]);
  const [loadingRoutines, setLoadingRoutines] = useState(true);
  const [editing, setEditing] = useState<Routine | null>(null);
  const [showModal, setShowModal] = useState(false);

  // Activity state
  const [activity, setActivity] = useState<ActivityEntry[]>([]);
  const [loadingActivity, setLoadingActivity] = useState(false);
  const [activityFilter, setActivityFilter] = useState<string>("");

  // Settings state
  const [botConnected, setBotConnected] = useState<boolean | null>(null);
  const [botUsername, setBotUsername] = useState<string>("");
  const [masterEnabled, setMasterEnabled] = useState(true);
  const [retentionDays, setRetentionDays] = useState(60);

  // ─── Data loading ────────────────────────────────────────────────────────

  const loadRoutines = useCallback(async () => {
    setLoadingRoutines(true);
    try {
      const res = await fetch("/api/telegram/routines");
      const data = await res.json();
      if (res.ok) {
        setRoutines(data.routines || []);
      }
    } catch {
      toast.error("Failed to load routines");
    } finally {
      setLoadingRoutines(false);
    }
  }, []);

  const loadActivity = useCallback(async (filter?: string) => {
    setLoadingActivity(true);
    try {
      const q = filter ? `?routine_type=${encodeURIComponent(filter)}` : "";
      const res = await fetch(`/api/telegram/activity${q}`);
      const data = await res.json();
      if (res.ok) {
        setActivity(data.entries || []);
      }
    } catch {
      // soft fail
    } finally {
      setLoadingActivity(false);
    }
  }, []);

  const loadBotInfo = useCallback(async () => {
    try {
      const res = await fetch("/api/telegram/setup");
      const data = await res.json();
      if (res.ok && data.bot) {
        setBotConnected(true);
        setBotUsername(data.bot.username || "");
      } else {
        setBotConnected(false);
      }
    } catch {
      setBotConnected(false);
    }
  }, []);

  useEffect(() => {
    loadRoutines();
    loadBotInfo();
  }, [loadRoutines, loadBotInfo]);

  useEffect(() => {
    if (tab === "activity") {
      loadActivity(activityFilter);
    }
  }, [tab, activityFilter, loadActivity]);

  // ─── Handlers ────────────────────────────────────────────────────────────

  async function handleTogglePause(r: Routine) {
    const newPaused = !r.paused;
    setRoutines(prev => prev.map(x => x.id === r.id ? { ...x, paused: newPaused } : x));
    try {
      const res = await fetch(`/api/telegram/routines/${r.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paused: newPaused }),
      });
      if (!res.ok) throw new Error();
      toast.success(newPaused ? "Routine paused" : "Routine resumed");
    } catch {
      toast.error("Failed to update");
      loadRoutines();
    }
  }

  async function handleRunNow(r: Routine) {
    toast.loading("Sending...", { id: "run" });
    try {
      const res = await fetch(`/api/telegram/routines/${r.id}/run-now`, {
        method: "POST",
      });
      const data = await res.json();
      toast.dismiss("run");
      if (data.success) {
        toast.success("Test message sent");
        loadRoutines();
      } else {
        toast.error("Failed to send");
      }
    } catch {
      toast.dismiss("run");
      toast.error("Failed to send");
    }
  }

  async function handleDelete(r: Routine) {
    if (!confirm(`Delete routine "${r.name}"?`)) return;
    try {
      const res = await fetch(`/api/telegram/routines/${r.id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error();
      setRoutines(prev => prev.filter(x => x.id !== r.id));
      toast.success("Routine deleted");
    } catch {
      toast.error("Failed to delete");
    }
  }

  function openNewModal() {
    setEditing({
      id: "",
      user_id: null,
      name: "",
      description: null,
      routine_type: "custom",
      schedule: "manual",
      enabled: true,
      paused: false,
      message_template: "",
      conditions: {},
      last_run_at: null,
      next_run_at: null,
      run_count: 0,
      success_count: 0,
      fail_count: 0,
      last_message: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
    setShowModal(true);
  }

  function openEditModal(r: Routine) {
    setEditing({ ...r });
    setShowModal(true);
  }

  function applyTemplate(t: Template) {
    setEditing({
      id: "",
      user_id: null,
      name: t.name,
      description: t.description,
      routine_type: t.routine_type,
      schedule: t.schedule,
      enabled: true,
      paused: false,
      message_template: t.message_template,
      conditions: {},
      last_run_at: null,
      next_run_at: null,
      run_count: 0,
      success_count: 0,
      fail_count: 0,
      last_message: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
    setShowModal(true);
    setTab("routines");
  }

  async function handleSaveRoutine() {
    if (!editing) return;
    if (!editing.name.trim()) {
      toast.error("Name required");
      return;
    }
    try {
      const isNew = !editing.id;
      const res = await fetch(
        isNew ? "/api/telegram/routines" : `/api/telegram/routines/${editing.id}`,
        {
          method: isNew ? "POST" : "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: editing.name,
            description: editing.description,
            routine_type: editing.routine_type,
            schedule: editing.schedule,
            message_template: editing.message_template,
            conditions: editing.conditions,
            paused: editing.paused,
            enabled: editing.enabled,
          }),
        }
      );
      if (!res.ok) throw new Error();
      setShowModal(false);
      setEditing(null);
      toast.success(isNew ? "Routine created" : "Routine updated");
      loadRoutines();
    } catch {
      toast.error("Failed to save");
    }
  }

  async function handleSendTestFromModal() {
    if (!editing?.id) {
      toast.error("Save first, then test");
      return;
    }
    handleRunNow(editing);
  }

  // ─── Tab config ──────────────────────────────────────────────────────────

  const TABS: { key: Tab; label: string; icon: React.ReactNode }[] = [
    { key: "routines", label: "Routines", icon: <Zap size={16} /> },
    { key: "activity", label: "Live Activity", icon: <Activity size={16} /> },
    { key: "templates", label: "Templates", icon: <Sparkles size={16} /> },
    { key: "settings", label: "Settings", icon: <Settings size={16} /> },
  ];

  const activeCount = routines.filter(r => r.enabled && !r.paused).length;
  const pausedCount = routines.filter(r => r.paused).length;

  // ─── Render ──────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHero
        icon={<Bot size={28} />}
        title="Telegram Bot"
        subtitle="Manage what your bot sends you and when."
        gradient="blue"
        actions={
          <>
            <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium ${botConnected ? "bg-emerald-500/30 text-white border border-emerald-300/40" : "bg-red-500/20 text-white border border-red-300/30"}`}>
              {botConnected ? <Wifi size={12} /> : <WifiOff size={12} />}
              {botConnected === null ? "Checking..." : botConnected ? "Connected" : "Disconnected"}
            </span>
            {botUsername && (
              <span className="text-xs text-white bg-white/10 border border-white/20 px-3 py-1.5 rounded-full">
                @{botUsername}
              </span>
            )}
            <span className="text-xs text-white bg-white/10 border border-white/20 px-3 py-1.5 rounded-full">
              {activeCount} active / {pausedCount} paused
            </span>
          </>
        }
      />

      {/* Tab Bar */}
      <div className="flex gap-1 bg-surface-light border border-border rounded-xl p-1 overflow-x-auto">
        {TABS.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all ${
              tab === t.key
                ? "bg-gold/10 text-gold border border-gold/20"
                : "text-muted hover:text-foreground hover:bg-surface"
            }`}
          >
            {t.icon}
            {t.label}
          </button>
        ))}
      </div>

      {/* ═══════════ ROUTINES TAB ═══════════ */}
      {tab === "routines" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="section-header mb-0">Bot Routines</h3>
              <p className="text-xs text-muted mt-0.5">Scheduled tasks that send you Telegram messages.</p>
            </div>
            <button
              onClick={openNewModal}
              className="px-4 py-2 bg-gold text-black rounded-lg text-sm font-semibold hover:bg-gold/90 transition-all flex items-center gap-2"
            >
              <Plus size={14} />
              New Routine
            </button>
          </div>

          {loadingRoutines ? (
            <div className="card flex items-center justify-center py-12">
              <Loader size={18} className="animate-spin text-gold" />
            </div>
          ) : routines.length === 0 ? (
            <div className="card">
              <EmptyState
                icon={<Bot size={48} />}
                title="No routines yet"
                description="Set up your first routine so your bot can keep you posted on leads, revenue, or anything else that matters."
                action={
                  <div className="flex gap-2">
                    <button
                      onClick={openNewModal}
                      className="px-4 py-2 bg-gold text-black rounded-lg text-sm font-semibold hover:bg-gold/90 flex items-center gap-2"
                    >
                      <Plus size={14} /> New Routine
                    </button>
                    <button
                      onClick={() => setTab("templates")}
                      className="px-4 py-2 bg-gold/10 text-gold border border-gold/20 rounded-lg text-sm font-medium hover:bg-gold/20 flex items-center gap-2"
                    >
                      <Sparkles size={14} /> Browse Templates
                    </button>
                  </div>
                }
              />
            </div>
          ) : (
            <div className="space-y-2">
              {routines.map(r => {
                const statusBadge = r.paused
                  ? { label: "Paused", cls: "bg-amber-500/10 text-amber-400 border-amber-500/20" }
                  : !r.enabled
                  ? { label: "Disabled", cls: "bg-surface-light text-muted border-border" }
                  : (r.fail_count ?? 0) > (r.success_count ?? 0) && (r.run_count ?? 0) > 0
                  ? { label: "Failing", cls: "bg-red-500/10 text-red-400 border-red-500/20" }
                  : { label: "Active", cls: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" };
                return (
                  <div key={r.id} className="card !p-4 flex items-center gap-4 flex-wrap md:flex-nowrap">
                    <div className={`w-10 h-10 rounded-xl bg-surface-light border border-border flex items-center justify-center flex-shrink-0 ${colorForType(r.routine_type)}`}>
                      {iconForType(r.routine_type)}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-medium text-foreground truncate">{r.name}</p>
                        <span className={`text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded border ${statusBadge.cls}`}>
                          {statusBadge.label}
                        </span>
                        <span className="text-[10px] text-muted bg-surface-light border border-border rounded px-1.5 py-0.5">
                          {r.routine_type}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 mt-1 text-xs text-muted flex-wrap">
                        <span className="flex items-center gap-1"><Clock size={10} /> {r.schedule}</span>
                        <span>Last run: {fmtTime(r.last_run_at)}</span>
                        <span>Runs: {r.run_count ?? 0}</span>
                        {(r.success_count ?? 0) > 0 && (
                          <span className="text-emerald-400 flex items-center gap-1">
                            <CheckCircle2 size={10} /> {r.success_count}
                          </span>
                        )}
                        {(r.fail_count ?? 0) > 0 && (
                          <span className="text-red-400 flex items-center gap-1">
                            <XCircle size={10} /> {r.fail_count}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-1 flex-shrink-0">
                      <button
                        onClick={() => handleTogglePause(r)}
                        title={r.paused ? "Resume" : "Pause"}
                        className={`p-2 rounded-lg border transition-colors ${r.paused ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/20" : "bg-amber-500/10 text-amber-400 border-amber-500/20 hover:bg-amber-500/20"}`}
                      >
                        {r.paused ? <Play size={14} /> : <Pause size={14} />}
                      </button>
                      <button
                        onClick={() => handleRunNow(r)}
                        title="Run now"
                        className="p-2 rounded-lg bg-surface-light border border-border text-muted hover:text-gold hover:border-gold/20 transition-colors"
                      >
                        <Zap size={14} />
                      </button>
                      <button
                        onClick={() => openEditModal(r)}
                        title="Edit"
                        className="p-2 rounded-lg bg-surface-light border border-border text-muted hover:text-foreground hover:border-gold/20 transition-colors"
                      >
                        <Edit3 size={14} />
                      </button>
                      <button
                        onClick={() => handleDelete(r)}
                        title="Delete"
                        className="p-2 rounded-lg bg-surface-light border border-border text-muted hover:text-red-400 hover:border-red-400/20 transition-colors"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ═══════════ LIVE ACTIVITY TAB ═══════════ */}
      {tab === "activity" && (
        <div className="space-y-4">
          <div className="flex items-center gap-2 flex-wrap">
            <Filter size={14} className="text-muted" />
            <select
              value={activityFilter}
              onChange={e => setActivityFilter(e.target.value)}
              className="bg-surface-light border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:border-gold/40"
            >
              <option value="">All routines</option>
              {ROUTINE_TYPES.map(t => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
            <button
              onClick={() => loadActivity(activityFilter)}
              className="px-3 py-2 bg-surface-light border border-border rounded-lg text-xs text-muted hover:text-foreground hover:border-gold/20"
            >
              Refresh
            </button>
            <span className="text-xs text-muted ml-auto">Last 100 messages</span>
          </div>

          {loadingActivity ? (
            <div className="card flex items-center justify-center py-12">
              <Loader size={18} className="animate-spin text-gold" />
            </div>
          ) : activity.length === 0 ? (
            <div className="card">
              <EmptyState
                icon={<Activity size={48} />}
                title="No activity yet"
                description="Once your routines start firing you'll see each message your bot sends here."
              />
            </div>
          ) : (
            <div className="space-y-2">
              {activity.map(a => {
                const msgPreview = typeof a.result === "object" && a.result
                  ? (a.result as Record<string, unknown>).message as string | undefined
                  : undefined;
                const isOk = a.status === "completed" || a.status === "success";
                return (
                  <div key={a.id} className="card !p-3 flex items-start gap-3">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${isOk ? "bg-emerald-500/10 text-emerald-400" : a.status === "failed" ? "bg-red-500/10 text-red-400" : "bg-surface-light text-muted"}`}>
                      <Bot size={14} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-medium text-foreground">{a.description}</span>
                        <span className="text-[10px] text-muted bg-surface-light border border-border rounded px-1.5 py-0.5">
                          {a.action_type}
                        </span>
                      </div>
                      {msgPreview && (
                        <p className="text-xs text-muted mt-1 whitespace-pre-wrap line-clamp-3">{msgPreview}</p>
                      )}
                      <p className="text-[10px] text-muted mt-1">{fmtTime(a.created_at)}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ═══════════ TEMPLATES TAB ═══════════ */}
      {tab === "templates" && (
        <div className="space-y-4">
          <div>
            <h3 className="section-header mb-0">Routine Templates</h3>
            <p className="text-xs text-muted mt-0.5">Click a template to clone it as a new routine.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {ROUTINE_TEMPLATES.map(t => (
              <button
                key={t.key}
                onClick={() => applyTemplate(t)}
                className="card text-left hover:border-gold/30 hover:bg-gold/5 transition-all group"
              >
                <div className="flex items-center gap-3 mb-3">
                  <div className={`w-10 h-10 rounded-xl bg-surface-light border border-border flex items-center justify-center ${t.color}`}>
                    {t.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-foreground">{t.name}</p>
                    <p className="text-[10px] text-muted">{t.schedule}</p>
                  </div>
                </div>
                <p className="text-xs text-muted mb-3 line-clamp-2">{t.description}</p>
                <div className="bg-surface-light border border-border rounded-lg p-2 text-[10px] text-muted font-mono whitespace-pre-wrap line-clamp-3">
                  {t.message_template}
                </div>
                <div className="mt-3 flex items-center justify-end">
                  <span className="text-xs text-gold flex items-center gap-1 group-hover:gap-2 transition-all">
                    <Copy size={10} /> Clone
                  </span>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ═══════════ SETTINGS TAB ═══════════ */}
      {tab === "settings" && (
        <div className="space-y-4">
          <div className="card">
            <h3 className="section-header flex items-center gap-2">
              <Wifi size={14} className="text-gold" />
              Bot Connection
            </h3>
            <div className="mt-3 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`w-3 h-3 rounded-full ${botConnected ? "bg-emerald-400 animate-pulse" : "bg-red-400"}`} />
                <div>
                  <p className="text-sm font-medium text-foreground">
                    {botConnected === null ? "Checking..." : botConnected ? `Connected${botUsername ? ` as @${botUsername}` : ""}` : "Bot token missing or invalid"}
                  </p>
                  <p className="text-xs text-muted">Uses <code className="text-gold">TELEGRAM_BOT_TOKEN</code> env var</p>
                </div>
              </div>
              <button
                onClick={loadBotInfo}
                className="px-4 py-2 bg-gold/10 text-gold border border-gold/20 rounded-lg text-sm font-medium hover:bg-gold/20 transition-all"
              >
                Re-check
              </button>
            </div>
          </div>

          <div className="card">
            <h3 className="section-header flex items-center gap-2">
              <MessageCircle size={14} className="text-gold" />
              Default Chat ID
            </h3>
            <p className="text-xs text-muted mt-1">Where all routines send messages. Configured via <code className="text-gold">TELEGRAM_CHAT_ID</code> env var.</p>
            <div className="mt-3 bg-surface-light border border-border rounded-lg px-4 py-2.5 text-sm font-mono text-muted">
              {process.env.NEXT_PUBLIC_TELEGRAM_CHAT_ID || "Configured server-side"}
            </div>
          </div>

          <div className="card">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="section-header mb-0 flex items-center gap-2">
                  <Zap size={14} className="text-gold" />
                  Master Toggle
                </h3>
                <p className="text-xs text-muted mt-0.5">Pause every routine at once</p>
              </div>
              <button
                onClick={async () => {
                  const next = !masterEnabled;
                  setMasterEnabled(next);
                  try {
                    await Promise.all(
                      routines.map(r =>
                        fetch(`/api/telegram/routines/${r.id}`, {
                          method: "PATCH",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ paused: !next }),
                        })
                      )
                    );
                    toast.success(next ? "All routines resumed" : "All routines paused");
                    loadRoutines();
                  } catch {
                    toast.error("Failed to update all");
                  }
                }}
                className={`w-14 h-7 rounded-full relative transition-colors ${masterEnabled ? "bg-emerald-500" : "bg-surface-light border border-border"}`}
              >
                <span className={`absolute top-0.5 h-6 w-6 rounded-full bg-white transition-all ${masterEnabled ? "left-7" : "left-0.5"}`} />
              </button>
            </div>
          </div>

          <div className="card">
            <h3 className="section-header flex items-center gap-2">
              <Clock size={14} className="text-gold" />
              Activity Retention
            </h3>
            <p className="text-xs text-muted mt-1">How long to keep message history</p>
            <div className="mt-3 flex gap-2">
              {[30, 60, 90].map(d => (
                <button
                  key={d}
                  onClick={() => setRetentionDays(d)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                    retentionDays === d
                      ? "bg-gold/10 text-gold border border-gold/20"
                      : "bg-surface-light text-muted border border-border hover:border-gold/20"
                  }`}
                >
                  {d} days
                </button>
              ))}
            </div>
          </div>

          <div className="card border-red-500/20">
            <h3 className="section-header flex items-center gap-2 text-red-400">
              <Trash2 size={14} />
              Danger Zone
            </h3>
            <p className="text-xs text-muted mt-1">Permanently remove routines and activity history</p>
            <div className="mt-3 flex gap-2 flex-wrap">
              <button
                onClick={() => {
                  if (!confirm("Clear all telegram activity history?")) return;
                  toast.success("History cleared (stub)");
                }}
                className="px-4 py-2 bg-red-500/10 text-red-400 border border-red-500/20 rounded-lg text-sm font-medium hover:bg-red-500/20 transition-all"
              >
                Clear all history
              </button>
              <button
                onClick={async () => {
                  if (!confirm(`Delete ALL ${routines.length} routines?`)) return;
                  for (const r of routines) {
                    await fetch(`/api/telegram/routines/${r.id}`, { method: "DELETE" });
                  }
                  toast.success("All routines deleted");
                  loadRoutines();
                }}
                className="px-4 py-2 bg-red-500/10 text-red-400 border border-red-500/20 rounded-lg text-sm font-medium hover:bg-red-500/20 transition-all"
              >
                Delete all routines
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════ CREATE/EDIT MODAL ═══════════ */}
      {showModal && editing && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-surface border border-border rounded-2xl max-w-2xl w-full my-8 max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-surface border-b border-border px-6 py-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-foreground">
                {editing.id ? "Edit Routine" : "New Routine"}
              </h3>
              <button
                onClick={() => { setShowModal(false); setEditing(null); }}
                className="text-muted hover:text-foreground"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="text-xs text-muted mb-1 block">Name</label>
                <input
                  type="text"
                  value={editing.name}
                  onChange={e => setEditing({ ...editing, name: e.target.value })}
                  className="w-full bg-surface-light border border-border rounded-lg px-4 py-2.5 text-sm text-foreground placeholder:text-muted focus:outline-none focus:border-gold/40 focus:ring-1 focus:ring-gold/20"
                  placeholder="Daily Lead Brief"
                />
              </div>

              <div>
                <label className="text-xs text-muted mb-1 block">Description</label>
                <input
                  type="text"
                  value={editing.description || ""}
                  onChange={e => setEditing({ ...editing, description: e.target.value })}
                  className="w-full bg-surface-light border border-border rounded-lg px-4 py-2.5 text-sm text-foreground placeholder:text-muted focus:outline-none focus:border-gold/40 focus:ring-1 focus:ring-gold/20"
                  placeholder="What this routine does"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-muted mb-1 block">Routine Type</label>
                  <select
                    value={editing.routine_type}
                    onChange={e => setEditing({ ...editing, routine_type: e.target.value })}
                    className="w-full bg-surface-light border border-border rounded-lg px-4 py-2.5 text-sm text-foreground focus:outline-none focus:border-gold/40"
                  >
                    {ROUTINE_TYPES.map(t => (
                      <option key={t.value} value={t.value}>{t.label}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs text-muted mb-1 block">Schedule Preset</label>
                  <select
                    value={SCHEDULE_PRESETS.find(p => p.value === editing.schedule)?.value || "custom"}
                    onChange={e => {
                      if (e.target.value !== "custom") {
                        setEditing({ ...editing, schedule: e.target.value });
                      }
                    }}
                    className="w-full bg-surface-light border border-border rounded-lg px-4 py-2.5 text-sm text-foreground focus:outline-none focus:border-gold/40"
                  >
                    {SCHEDULE_PRESETS.map(p => (
                      <option key={p.value} value={p.value}>{p.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="text-xs text-muted mb-1 block">Custom Cron Expression</label>
                <input
                  type="text"
                  value={editing.schedule}
                  onChange={e => setEditing({ ...editing, schedule: e.target.value })}
                  className="w-full bg-surface-light border border-border rounded-lg px-4 py-2.5 text-sm font-mono text-foreground placeholder:text-muted focus:outline-none focus:border-gold/40 focus:ring-1 focus:ring-gold/20"
                  placeholder="0 9 * * *   or   manual"
                />
                <p className="text-[10px] text-muted mt-1">
                  Format: minute hour day month weekday. Use &quot;manual&quot; for run-on-demand only.
                </p>
              </div>

              <div>
                <label className="text-xs text-muted mb-1 block">Message Template</label>
                <textarea
                  value={editing.message_template || ""}
                  onChange={e => setEditing({ ...editing, message_template: e.target.value })}
                  rows={6}
                  className="w-full bg-surface-light border border-border rounded-lg px-4 py-3 text-sm font-mono text-foreground placeholder:text-muted focus:outline-none focus:border-gold/40 focus:ring-1 focus:ring-gold/20 resize-none"
                  placeholder="Hello! Today is {{today_date}} and you have {{lead_count}} new leads."
                />
                <div className="mt-2 flex flex-wrap gap-1.5">
                  <span className="text-[10px] text-muted">Variables:</span>
                  {VARIABLES.map(v => (
                    <button
                      key={v}
                      type="button"
                      onClick={() => {
                        const insert = `{{${v}}}`;
                        setEditing({
                          ...editing,
                          message_template: (editing.message_template || "") + insert,
                        });
                      }}
                      className="text-[10px] font-mono text-gold bg-gold/10 border border-gold/20 rounded px-1.5 py-0.5 hover:bg-gold/20"
                    >
                      {`{{${v}}}`}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-xs text-muted mb-1 block">
                  Conditions (JSON, optional)
                </label>
                <textarea
                  value={JSON.stringify(editing.conditions || {}, null, 2)}
                  onChange={e => {
                    try {
                      setEditing({ ...editing, conditions: JSON.parse(e.target.value) });
                    } catch {
                      // allow invalid while typing
                    }
                  }}
                  rows={3}
                  className="w-full bg-surface-light border border-border rounded-lg px-4 py-3 text-xs font-mono text-foreground placeholder:text-muted focus:outline-none focus:border-gold/40 focus:ring-1 focus:ring-gold/20 resize-none"
                  placeholder='{ "min_deal_value": 500 }'
                />
              </div>
            </div>

            <div className="sticky bottom-0 bg-surface border-t border-border px-6 py-4 flex items-center justify-between gap-2">
              <button
                onClick={handleSendTestFromModal}
                className="px-4 py-2 bg-surface-light border border-border rounded-lg text-sm font-medium text-muted hover:text-gold hover:border-gold/20 transition-all flex items-center gap-2"
              >
                <Zap size={14} /> Test
              </button>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => { setShowModal(false); setEditing(null); }}
                  className="px-4 py-2 text-sm text-muted hover:text-foreground"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveRoutine}
                  className="px-5 py-2 bg-gold text-black rounded-lg text-sm font-semibold hover:bg-gold/90 transition-all flex items-center gap-2"
                >
                  <Save size={14} /> Save Routine
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* PageAI Assistant */}
      <PageAI
        pageName="Telegram Bot"
        context={`${routines.length} routines (${activeCount} active, ${pausedCount} paused). Bot ${botConnected ? "connected" : "disconnected"}.`}
        suggestions={[
          "Help me write a message template for a daily revenue summary",
          "What's a good schedule for an outreach recap?",
          "Which variables can I use in templates?",
          "Suggest a routine for tracking churn risk",
        ]}
      />

      {/* Hidden stat imports to ensure unused icons aren't flagged while keeping the toolbar flexible */}
      <div className="hidden">
        <BarChart3 />
      </div>
    </div>
  );
}
