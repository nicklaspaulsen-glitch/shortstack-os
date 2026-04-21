"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import {
  FolderKanban,
  Clock,
  MessageSquare,
  CalendarDays,
  CheckCircle,
  Rocket,
  FileText,
  RefreshCw,
  Send,
  Bot,
  User,
  Phone,
  Upload,
  MessageCircle,
  Bell,
  X,
  Sparkles,
  CheckSquare,
  Square,
  ThumbsUp,
  ThumbsDown,
  Receipt,
  AlertCircle,
  Loader2,
} from "lucide-react";
import toast from "react-hot-toast";

/* ══════════════════════════════════════════════════════════════════
   Real-data client portal.
   Fetches from:
     /api/portal/[clientId]/overview  — client info + projects + milestones + latest invoice
     /api/portal/[clientId]/tasks     — client_tasks (mark complete)
     /api/portal/[clientId]/content   — content_calendar approvals
     /api/portal/[clientId]/invoices  — client_invoices
     /api/portal/[clientId]/messages  — client-agency thread
   ══════════════════════════════════════════════════════════════════ */

type OverviewProject = {
  id: string;
  name: string;
  icon: string | null;
  color: string | null;
  progress: number;
  taskCount: number;
  doneCount: number;
  nextDueDate: string | null;
};

type OverviewMilestone = {
  id: string;
  title: string;
  status: string;
  priority: string;
  dueDate: string | null;
  boardId: string;
  boardName: string | null;
};

type OverviewInvoice = {
  id: string;
  amount: number;
  currency: string;
  status: string;
  hostedUrl: string | null;
  dueDate: string | null;
  paidAt: string | null;
  createdAt: string | null;
  source: "stripe_connect" | "legacy";
};

type OverviewResponse = {
  client: {
    id: string;
    businessName: string | null;
    contactName: string | null;
    email: string | null;
    phone: string | null;
    industry: string | null;
    plan: string | null;
    mrr: number | null;
    healthScore: number | null;
    onboardedAt: string | null;
  };
  projects: OverviewProject[];
  milestones: OverviewMilestone[];
  latestInvoice: OverviewInvoice | null;
};

type Task = {
  id: string;
  title: string;
  description: string | null;
  is_completed: boolean;
  completed_at: string | null;
  due_date: string | null;
  created_at: string | null;
};

type ContentItem = {
  id: string;
  title: string;
  platform: string;
  status: string;
  scheduled_at: string | null;
  published_at: string | null;
  live_url: string | null;
  notes: string | null;
};

type Invoice = {
  id: string;
  amount: number;
  currency: string;
  status: string;
  hostedUrl: string | null;
  dueDate: string | null;
  paidAt: string | null;
  createdAt: string | null;
};

type Message = {
  id: string;
  sender_role: "client" | "agency" | "ai";
  body: string;
  created_at: string;
  read_at: string | null;
};

/* ══════════════════════════════════════════════════════════════════
   PAGE COMPONENT
   ══════════════════════════════════════════════════════════════════ */

export default function ClientPortalDashboard({
  params,
}: {
  params: { clientId: string };
}) {
  const clientId = params.clientId;

  const [overview, setOverview] = useState<OverviewResponse | null>(null);
  const [overviewLoading, setOverviewLoading] = useState(true);
  const [overviewError, setOverviewError] = useState<string | null>(null);

  const [tasks, setTasks] = useState<Task[]>([]);
  const [tasksLoading, setTasksLoading] = useState(true);

  const [contentItems, setContentItems] = useState<ContentItem[]>([]);
  const [contentLoading, setContentLoading] = useState(true);

  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [invoicesLoading, setInvoicesLoading] = useState(true);

  const [chatOpen, setChatOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [chatInput, setChatInput] = useState("");
  const [chatSending, setChatSending] = useState(false);
  const [senderRole, setSenderRole] = useState<"client" | "agency">("client");

  const [notificationsOpen, setNotificationsOpen] = useState(false);

  const chatEndRef = useRef<HTMLDivElement>(null);
  const chatInputRef = useRef<HTMLInputElement>(null);

  /* ── Fetchers ── */
  const loadOverview = useCallback(async () => {
    try {
      setOverviewLoading(true);
      setOverviewError(null);
      const res = await fetch(`/api/portal/${clientId}/overview`, { cache: "no-store" });
      if (!res.ok) {
        const json = await res.json().catch(() => ({ error: "Failed" }));
        throw new Error(json.error || `Error ${res.status}`);
      }
      setOverview((await res.json()) as OverviewResponse);
    } catch (err) {
      setOverviewError(err instanceof Error ? err.message : "Failed to load");
    } finally {
      setOverviewLoading(false);
    }
  }, [clientId]);

  const loadTasks = useCallback(async () => {
    try {
      setTasksLoading(true);
      const res = await fetch(`/api/portal/${clientId}/tasks`, { cache: "no-store" });
      if (!res.ok) throw new Error("Failed to load tasks");
      const json = await res.json();
      setTasks(json.tasks || []);
    } catch (err) {
      console.error(err);
    } finally {
      setTasksLoading(false);
    }
  }, [clientId]);

  const loadContent = useCallback(async () => {
    try {
      setContentLoading(true);
      const res = await fetch(`/api/portal/${clientId}/content`, { cache: "no-store" });
      if (!res.ok) throw new Error("Failed to load content");
      const json = await res.json();
      setContentItems(json.items || []);
    } catch (err) {
      console.error(err);
    } finally {
      setContentLoading(false);
    }
  }, [clientId]);

  const loadInvoices = useCallback(async () => {
    try {
      setInvoicesLoading(true);
      const res = await fetch(`/api/portal/${clientId}/invoices`, { cache: "no-store" });
      if (!res.ok) throw new Error("Failed to load invoices");
      const json = await res.json();
      setInvoices(json.invoices || []);
    } catch (err) {
      console.error(err);
    } finally {
      setInvoicesLoading(false);
    }
  }, [clientId]);

  const loadMessages = useCallback(async () => {
    try {
      setMessagesLoading(true);
      const res = await fetch(`/api/portal/${clientId}/messages`, { cache: "no-store" });
      if (!res.ok) throw new Error("Failed to load messages");
      const json = await res.json();
      setMessages(json.messages || []);
      if (json.role === "client" || json.role === "agency") {
        setSenderRole(json.role);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setMessagesLoading(false);
    }
  }, [clientId]);

  useEffect(() => {
    loadOverview();
    loadTasks();
    loadContent();
    loadInvoices();
  }, [loadOverview, loadTasks, loadContent, loadInvoices]);

  /* ── Auto-scroll chat to bottom ── */
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, chatSending]);

  /* ── Lazy-load messages when chat opens ── */
  useEffect(() => {
    if (chatOpen) {
      loadMessages();
      setTimeout(() => chatInputRef.current?.focus(), 100);
    }
  }, [chatOpen, loadMessages]);

  /* ── Derived counts ── */
  const pendingApprovals = contentItems.filter(
    (c) => c.status === "ready_to_publish" || c.status === "scripted" || c.status === "editing",
  ).length;
  const unreadCount = messages.filter((m) => !m.read_at && m.sender_role !== senderRole).length;
  const openTasks = tasks.filter((t) => !t.is_completed).length;
  const pendingInvoices = invoices.filter(
    (i) => i.status !== "paid" && i.status !== "void" && i.status !== "uncollectible",
  ).length;

  /* ── Send chat message ── */
  async function handleSendMessage() {
    const text = chatInput.trim();
    if (!text || chatSending) return;
    setChatSending(true);
    setChatInput("");

    // Optimistic append
    const tempId = `tmp-${Date.now()}`;
    setMessages((prev) => [
      ...prev,
      {
        id: tempId,
        sender_role: senderRole,
        body: text,
        created_at: new Date().toISOString(),
        read_at: null,
      },
    ]);

    try {
      const res = await fetch(`/api/portal/${clientId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: text }),
      });
      if (!res.ok) throw new Error("Failed to send");
      const json = await res.json();
      setMessages((prev) =>
        prev.map((m) => (m.id === tempId ? (json.message as Message) : m)),
      );
    } catch (err) {
      setMessages((prev) => prev.filter((m) => m.id !== tempId));
      toast.error(err instanceof Error ? err.message : "Failed to send message");
    } finally {
      setChatSending(false);
    }
  }

  function handleChatKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  }

  /* ── Toggle task complete ── */
  async function toggleTask(t: Task) {
    setTasks((prev) =>
      prev.map((x) => (x.id === t.id ? { ...x, is_completed: !x.is_completed } : x)),
    );
    try {
      const res = await fetch(`/api/portal/${clientId}/tasks`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: t.id, is_completed: !t.is_completed }),
      });
      if (!res.ok) throw new Error("Failed to update");
    } catch (err) {
      setTasks((prev) =>
        prev.map((x) => (x.id === t.id ? { ...x, is_completed: t.is_completed } : x)),
      );
      toast.error(err instanceof Error ? err.message : "Could not update task");
    }
  }

  /* ── Approve / reject content ── */
  async function decideContent(id: string, action: "approve" | "reject") {
    try {
      const res = await fetch(`/api/portal/${clientId}/content`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, action }),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({ error: "Failed" }));
        throw new Error(json.error || "Failed");
      }
      toast.success(action === "approve" ? "Approved" : "Sent back for edits");
      loadContent();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not update");
    }
  }

  function handleQuickAction(action: string) {
    if (action === "Leave Feedback" || action === "Schedule Call") {
      setChatOpen(true);
      toast.success(`Ask your account manager in chat`);
      return;
    }
    toast.success(`${action} coming soon`);
  }

  /* ── Helpers ── */
  function formatDate(d: string | null) {
    if (!d) return "—";
    try {
      return new Date(d).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      });
    } catch {
      return d;
    }
  }

  function formatCurrency(amount: number, currency = "usd") {
    try {
      return new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: currency.toUpperCase(),
      }).format(amount);
    } catch {
      return `$${amount.toFixed(2)}`;
    }
  }

  function getStatusStyle(status: string) {
    const s = status.toLowerCase();
    if (s === "active" || s === "in_progress" || s === "todo" || s === "scheduled")
      return "bg-gold/10 text-gold border-gold/20";
    if (s === "review" || s === "ready_to_publish" || s === "editing" || s === "open")
      return "bg-info/10 text-info border-info/20";
    if (
      s === "done" ||
      s === "completed" ||
      s === "published" ||
      s === "posted" ||
      s === "paid" ||
      s === "approved_for_publish"
    )
      return "bg-success/10 text-success border-success/20";
    if (s === "failed" || s === "past_due" || s === "uncollectible")
      return "bg-danger/10 text-danger border-danger/20";
    return "bg-muted/10 text-muted border-muted/20";
  }

  function getProgressColor(progress: number) {
    if (progress >= 80) return "bg-success";
    if (progress >= 50) return "bg-gold";
    return "bg-info";
  }

  function prettyStatus(s: string) {
    return s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  }

  const client = overview?.client;
  const contactFirstName = (client?.contactName || "").split(" ")[0] || "there";

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* ═══════════════ Live Data banner ═══════════════ */}
      <div className="card fade-in flex items-center gap-3 border-success/20 bg-success/[0.03]">
        <div className="h-8 w-8 rounded-xl bg-success/10 border border-success/20 flex items-center justify-center">
          <Sparkles size={14} className="text-success" />
        </div>
        <div className="flex-1">
          <p className="text-xs font-semibold text-foreground">Live data</p>
          <p className="text-[10px] text-muted">
            Everything on this page is pulled in real time from your account.
          </p>
        </div>
        <button
          onClick={() => {
            loadOverview();
            loadTasks();
            loadContent();
            loadInvoices();
          }}
          className="p-1.5 rounded-lg text-muted hover:text-foreground hover:bg-surface-light transition-colors"
          aria-label="Refresh"
        >
          <RefreshCw size={14} />
        </button>
      </div>

      {/* ═══════════════ HEADER ═══════════════ */}
      <div className="flex items-start justify-between gap-4 fade-in">
        <div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight">
            {overviewLoading ? "Loading…" : `Welcome back, ${contactFirstName}`}
          </h1>
          <p className="text-sm text-muted mt-1">
            Here&apos;s what&apos;s happening with{" "}
            <span className="text-foreground font-medium">
              {client?.businessName || "your account"}
            </span>{" "}
            today.
          </p>
        </div>

        {/* Notifications bell */}
        <div className="relative">
          <button
            onClick={() => setNotificationsOpen(!notificationsOpen)}
            aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ""}`}
            className="relative p-2.5 rounded-xl bg-surface border border-border hover:border-gold/30 transition-all"
          >
            <Bell size={18} className="text-muted" />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 flex items-center justify-center min-w-[18px] h-[18px] rounded-full bg-gold text-[10px] font-bold text-white px-1">
                {unreadCount}
              </span>
            )}
          </button>

          {notificationsOpen && (
            <div className="absolute right-0 top-12 w-80 rounded-2xl bg-surface border border-border shadow-elevated z-50 scale-in overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 border-b border-border">
                <p className="text-sm font-semibold text-foreground">Notifications</p>
                <button
                  onClick={() => {
                    setChatOpen(true);
                    setNotificationsOpen(false);
                  }}
                  className="text-[11px] text-gold hover:text-gold/80 font-medium transition-colors"
                >
                  Open messages
                </button>
              </div>
              <div className="max-h-72 overflow-y-auto">
                {unreadCount === 0 ? (
                  <div className="px-4 py-8 text-center">
                    <p className="text-xs text-muted">You&apos;re all caught up.</p>
                  </div>
                ) : (
                  messages
                    .filter((m) => !m.read_at && m.sender_role !== senderRole)
                    .slice(0, 10)
                    .map((m) => (
                      <div
                        key={m.id}
                        className="flex items-start gap-3 px-4 py-3 border-b border-border/50 last:border-0 bg-gold/[0.03]"
                      >
                        <div className="mt-1 w-2 h-2 rounded-full bg-gold shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs text-foreground leading-snug line-clamp-2">
                            {m.body}
                          </p>
                          <p className="text-[10px] text-muted mt-0.5">
                            {formatDate(m.created_at)}
                          </p>
                        </div>
                      </div>
                    ))
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ═══════════════ WELCOME BANNER ═══════════════ */}
      <div
        className="card fade-in stagger-1 relative overflow-hidden"
        style={{
          background:
            "linear-gradient(135deg, var(--color-surface) 0%, color-mix(in srgb, var(--color-surface) 92%, var(--color-accent)) 100%)",
        }}
      >
        <div className="absolute top-0 right-0 w-48 h-48 rounded-full bg-gold/[0.04] -translate-y-1/2 translate-x-1/3" />
        <div className="absolute bottom-0 right-24 w-24 h-24 rounded-full bg-gold/[0.03]" />

        <div className="relative flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <div className="h-10 w-10 rounded-xl bg-gold/10 border border-gold/20 flex items-center justify-center">
                <Sparkles size={18} className="text-gold" />
              </div>
              <div>
                <p className="text-lg font-semibold text-foreground">
                  {client?.businessName || "—"}
                </p>
                <p className="text-xs text-muted">
                  {client?.plan ? `${client.plan} Plan` : "Plan"}
                </p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-muted">
              {client?.contactName && (
                <span className="flex items-center gap-1.5">
                  <User size={13} className="text-gold/70" />
                  Contact:{" "}
                  <span className="text-foreground font-medium">{client.contactName}</span>
                </span>
              )}
              {client?.email && (
                <span className="flex items-center gap-1.5">
                  <MessageSquare size={13} className="text-gold/70" />
                  <span className="text-foreground font-medium">{client.email}</span>
                </span>
              )}
            </div>
          </div>
          <button
            onClick={() => handleQuickAction("Schedule Call")}
            className="btn-primary flex items-center gap-2 text-sm shrink-0 self-start md:self-center"
          >
            <Phone size={14} />
            Message Account Manager
          </button>
        </div>
      </div>

      {/* ═══════════════ QUICK STATS ═══════════════ */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 fade-in stagger-2">
        <QuickStat
          label="Active Projects"
          value={overview?.projects.length ?? 0}
          icon={<FolderKanban size={16} />}
          color="gold"
          loading={overviewLoading}
        />
        <QuickStat
          label="Pending Approvals"
          value={pendingApprovals}
          icon={<Clock size={16} />}
          color="warning"
          highlight={pendingApprovals > 0}
          loading={contentLoading}
        />
        <QuickStat
          label="Open Tasks"
          value={openTasks}
          icon={<CheckSquare size={16} />}
          color="info"
          loading={tasksLoading}
        />
        <QuickStat
          label="Open Invoices"
          value={pendingInvoices}
          icon={<Receipt size={16} />}
          color="accent"
          loading={invoicesLoading}
        />
      </div>

      {/* ═══════════════ PROJECTS ═══════════════ */}
      <div className="space-y-3 fade-in stagger-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-foreground uppercase tracking-wider">
            Active Projects
          </h2>
        </div>
        {overviewLoading ? (
          <div className="card flex items-center gap-3 text-muted text-xs">
            <Loader2 size={14} className="animate-spin" /> Loading projects…
          </div>
        ) : overviewError ? (
          <ErrorBlock message={overviewError} onRetry={loadOverview} />
        ) : overview && overview.projects.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {overview.projects.map((project) => (
              <div key={project.id} className="card group cursor-pointer">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-foreground truncate group-hover:text-gold transition-colors">
                      {project.name}
                    </p>
                    <p className="text-[11px] text-muted mt-0.5">
                      {project.doneCount} / {project.taskCount} tasks complete
                    </p>
                  </div>
                  <span className="badge border text-[10px] ml-2 shrink-0 bg-gold/10 text-gold border-gold/20">
                    Active
                  </span>
                </div>
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-[10px]">
                    <span className="text-muted">Progress</span>
                    <span className="text-foreground font-medium">{project.progress}%</span>
                  </div>
                  <div className="h-1.5 bg-surface-light rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-700 ${getProgressColor(
                        project.progress,
                      )}`}
                      style={{ width: `${project.progress}%` }}
                    />
                  </div>
                </div>
                {project.nextDueDate && (
                  <div className="flex items-center justify-between mt-3 pt-3 border-t border-border/50">
                    <span className="text-[10px] text-muted flex items-center gap-1">
                      <Clock size={10} />
                      Next due: {formatDate(project.nextDueDate)}
                    </span>
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <EmptyBlock
            icon={<FolderKanban size={18} />}
            title="No active projects yet"
            description="When your agency creates a project board for you it'll show up here."
          />
        )}
      </div>

      {/* ═══════════════ TWO-COLUMN: TASKS + MILESTONES ═══════════════ */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 fade-in stagger-4">
        {/* ── Tasks ── */}
        <div className="card space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-foreground uppercase tracking-wider">
              Your Tasks
            </h2>
            <span className="text-[10px] text-muted bg-surface-light px-2 py-0.5 rounded-full">
              {openTasks} open
            </span>
          </div>
          {tasksLoading ? (
            <div className="flex items-center gap-3 text-muted text-xs">
              <Loader2 size={14} className="animate-spin" /> Loading…
            </div>
          ) : tasks.length === 0 ? (
            <EmptyBlock
              icon={<CheckCircle size={18} />}
              title="No tasks"
              description="You're all caught up."
              compact
            />
          ) : (
            <div className="space-y-0">
              {tasks.slice(0, 10).map((t, idx) => (
                <div
                  key={t.id}
                  className={`flex items-start gap-3 py-2.5 ${
                    idx < tasks.length - 1 ? "border-b border-border/40" : ""
                  }`}
                >
                  <button
                    onClick={() => toggleTask(t)}
                    className="mt-0.5 p-0.5 rounded-md text-muted hover:text-gold transition-colors"
                    aria-label={t.is_completed ? "Mark incomplete" : "Mark complete"}
                  >
                    {t.is_completed ? (
                      <CheckSquare size={16} className="text-gold" />
                    ) : (
                      <Square size={16} />
                    )}
                  </button>
                  <div className="flex-1 min-w-0">
                    <p
                      className={`text-xs font-medium leading-snug ${
                        t.is_completed ? "text-muted line-through" : "text-foreground"
                      }`}
                    >
                      {t.title}
                    </p>
                    {t.description && (
                      <p className="text-[11px] text-muted mt-0.5 line-clamp-2">{t.description}</p>
                    )}
                    {t.due_date && (
                      <p className="text-[10px] text-muted mt-1 flex items-center gap-1">
                        <CalendarDays size={10} />
                        Due: {formatDate(t.due_date)}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── Upcoming Milestones ── */}
        <div className="card space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-foreground uppercase tracking-wider">
              Upcoming Milestones
            </h2>
            <span className="text-[10px] text-muted bg-surface-light px-2 py-0.5 rounded-full">
              Next 30 days
            </span>
          </div>
          {overviewLoading ? (
            <div className="flex items-center gap-3 text-muted text-xs">
              <Loader2 size={14} className="animate-spin" /> Loading…
            </div>
          ) : !overview?.milestones.length ? (
            <EmptyBlock
              icon={<CalendarDays size={18} />}
              title="No milestones due"
              description="Nothing coming up in the next 30 days."
              compact
            />
          ) : (
            <div className="space-y-0">
              {overview.milestones.slice(0, 8).map((m, idx) => (
                <div
                  key={m.id}
                  className={`flex items-start gap-3 py-3 ${
                    idx < overview.milestones.length - 1 ? "border-b border-border/40" : ""
                  }`}
                >
                  <div className="flex flex-col items-center shrink-0">
                    <div
                      className={`w-2.5 h-2.5 rounded-full border-2 mt-1 ${
                        m.priority === "urgent" || m.priority === "high"
                          ? "border-gold bg-gold/30"
                          : m.status === "review"
                          ? "border-info bg-info/30"
                          : "border-muted/40 bg-transparent"
                      }`}
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-xs font-medium text-foreground leading-snug">
                          {m.title}
                        </p>
                        <p className="text-[10px] text-muted mt-0.5">
                          {m.boardName || "Project"}
                        </p>
                      </div>
                      <span
                        className={`badge border text-[9px] shrink-0 ${getStatusStyle(m.status)}`}
                      >
                        {prettyStatus(m.status)}
                      </span>
                    </div>
                    {m.dueDate && (
                      <p className="text-[10px] text-muted mt-1 flex items-center gap-1">
                        <CalendarDays size={10} />
                        Due: {formatDate(m.dueDate)}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ═══════════════ CONTENT APPROVALS ═══════════════ */}
      <div className="space-y-3 fade-in">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-foreground uppercase tracking-wider">
            Content Approvals
          </h2>
          <span className="text-[10px] text-muted bg-surface-light px-2 py-0.5 rounded-full">
            {pendingApprovals} pending
          </span>
        </div>
        {contentLoading ? (
          <div className="card flex items-center gap-3 text-muted text-xs">
            <Loader2 size={14} className="animate-spin" /> Loading…
          </div>
        ) : contentItems.length === 0 ? (
          <EmptyBlock
            icon={<FileText size={18} />}
            title="No content queued"
            description="Once your agency adds content for this month it'll appear here for approval."
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {contentItems.slice(0, 8).map((item) => {
              const actionable =
                item.status === "ready_to_publish" ||
                item.status === "scripted" ||
                item.status === "editing";
              return (
                <div key={item.id} className="card space-y-3">
                  <div className="flex items-start gap-3">
                    <div className="p-2 rounded-xl bg-gold/8 border border-gold/15 shrink-0">
                      <Rocket size={14} className="text-gold" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-semibold text-foreground leading-snug">
                        {item.title}
                      </p>
                      <p className="text-[10px] text-muted mt-0.5">
                        {item.platform} · {prettyStatus(item.status)}
                      </p>
                    </div>
                    <span className={`badge border text-[9px] ${getStatusStyle(item.status)}`}>
                      {prettyStatus(item.status)}
                    </span>
                  </div>
                  {item.scheduled_at && (
                    <p className="text-[10px] text-muted flex items-center gap-1">
                      <CalendarDays size={10} />
                      Scheduled: {formatDate(item.scheduled_at)}
                    </p>
                  )}
                  {actionable && (
                    <div className="flex items-center gap-2 pt-2 border-t border-border/40">
                      <button
                        onClick={() => decideContent(item.id, "approve")}
                        className="flex-1 flex items-center justify-center gap-1.5 text-[11px] font-medium text-success bg-success/10 hover:bg-success/20 rounded-lg py-2 transition-colors"
                      >
                        <ThumbsUp size={12} />
                        Approve
                      </button>
                      <button
                        onClick={() => decideContent(item.id, "reject")}
                        className="flex-1 flex items-center justify-center gap-1.5 text-[11px] font-medium text-muted bg-surface-light hover:bg-border/50 rounded-lg py-2 transition-colors"
                      >
                        <ThumbsDown size={12} />
                        Request Edits
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ═══════════════ INVOICES ═══════════════ */}
      <div className="space-y-3 fade-in">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-foreground uppercase tracking-wider">
            Invoices
          </h2>
          {overview?.latestInvoice && (
            <span className="text-[10px] text-muted bg-surface-light px-2 py-0.5 rounded-full">
              Most recent: {prettyStatus(overview.latestInvoice.status)}
            </span>
          )}
        </div>
        {invoicesLoading ? (
          <div className="card flex items-center gap-3 text-muted text-xs">
            <Loader2 size={14} className="animate-spin" /> Loading…
          </div>
        ) : invoices.length === 0 ? (
          <EmptyBlock
            icon={<Receipt size={18} />}
            title="No invoices yet"
            description="You'll see invoices here as soon as your agency sends one."
          />
        ) : (
          <div className="card space-y-0">
            {invoices.slice(0, 6).map((inv, idx) => (
              <div
                key={inv.id}
                className={`flex items-center gap-3 py-3 ${
                  idx < invoices.length - 1 ? "border-b border-border/40" : ""
                }`}
              >
                <div className="p-2 rounded-xl bg-gold/8 border border-gold/15 shrink-0">
                  <Receipt size={14} className="text-gold" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-foreground">
                    {formatCurrency(inv.amount, inv.currency)}
                  </p>
                  <p className="text-[10px] text-muted mt-0.5">
                    {inv.dueDate
                      ? `Due ${formatDate(inv.dueDate)}`
                      : inv.createdAt
                      ? `Sent ${formatDate(inv.createdAt)}`
                      : ""}
                  </p>
                </div>
                <span className={`badge border text-[9px] ${getStatusStyle(inv.status)}`}>
                  {prettyStatus(inv.status)}
                </span>
                {inv.hostedUrl && (
                  <a
                    href={inv.hostedUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-[11px] text-gold hover:text-gold/80 font-medium ml-2"
                  >
                    View
                  </a>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ═══════════════ QUICK ACTIONS ═══════════════ */}
      <div className="space-y-3 fade-in">
        <h2 className="text-sm font-semibold text-foreground uppercase tracking-wider">
          Quick Actions
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <QuickActionButton
            icon={<MessageCircle size={16} />}
            label="Message Team"
            description="Open the chat with your agency"
            onClick={() => setChatOpen(true)}
          />
          <QuickActionButton
            icon={<Phone size={16} />}
            label="Schedule Call"
            description="Book time with your team"
            onClick={() => handleQuickAction("Schedule Call")}
          />
          <QuickActionButton
            icon={<Upload size={16} />}
            label="Upload Files"
            description="Share assets or documents"
            onClick={() => handleQuickAction("Upload Files")}
          />
          <QuickActionButton
            icon={<RefreshCw size={16} />}
            label="Request Revision"
            description="Reject a pending content item"
            onClick={() => handleQuickAction("Request Revision")}
          />
        </div>
      </div>

      {/* ═══════════════ CHAT WIDGET ═══════════════ */}
      <button
        onClick={() => setChatOpen(!chatOpen)}
        aria-label={chatOpen ? "Close assistant" : "Open assistant"}
        className={`fixed bottom-6 right-6 z-40 p-3.5 rounded-2xl shadow-elevated transition-all duration-300 ${
          chatOpen
            ? "bg-surface border border-border text-muted hover:text-foreground scale-90"
            : "bg-gold text-white hover:bg-gold/90 scale-100"
        }`}
        style={
          !chatOpen
            ? {
                boxShadow:
                  "0 4px 20px rgba(201, 168, 76, 0.3), 0 0 40px rgba(201, 168, 76, 0.1)",
              }
            : undefined
        }
      >
        {chatOpen ? <X size={20} /> : <Bot size={20} />}
        {!chatOpen && unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 flex items-center justify-center min-w-[18px] h-[18px] rounded-full bg-danger text-[10px] font-bold text-white px-1 border-2 border-white">
            {unreadCount}
          </span>
        )}
      </button>

      {chatOpen && (
        <div className="fixed bottom-20 right-6 z-40 w-[380px] max-h-[520px] rounded-2xl bg-surface border border-border shadow-elevated flex flex-col scale-in overflow-hidden">
          <div
            className="flex items-center gap-3 px-4 py-3 border-b border-border shrink-0"
            style={{
              background:
                "linear-gradient(135deg, var(--color-surface) 0%, color-mix(in srgb, var(--color-surface) 94%, var(--color-accent)) 100%)",
            }}
          >
            <div className="relative">
              <div className="h-9 w-9 rounded-xl bg-gold/10 border border-gold/20 flex items-center justify-center">
                <MessageSquare size={16} className="text-gold" />
              </div>
              <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-success rounded-full border-2 border-surface" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold text-foreground">Your Agency</p>
              <p className="text-[10px] text-success flex items-center gap-1">
                <span className="w-1 h-1 rounded-full bg-success" />
                Connected
              </p>
            </div>
            <button
              onClick={() => setChatOpen(false)}
              aria-label="Close"
              className="p-1.5 rounded-lg text-muted hover:text-foreground hover:bg-surface-light transition-colors"
            >
              <X size={14} />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-[280px]">
            {messagesLoading && messages.length === 0 ? (
              <div className="flex items-center gap-2 text-muted text-xs">
                <Loader2 size={12} className="animate-spin" /> Loading messages…
              </div>
            ) : messages.length === 0 ? (
              <div className="text-center py-6">
                <Bot size={24} className="text-muted/40 mx-auto mb-2" />
                <p className="text-xs text-muted">
                  Start the conversation — your agency will reply here.
                </p>
              </div>
            ) : (
              messages.map((msg) => {
                const isMe = msg.sender_role === senderRole;
                return (
                  <div
                    key={msg.id}
                    className={`flex ${isMe ? "justify-end" : "justify-start"}`}
                  >
                    <div
                      className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-xs leading-relaxed ${
                        isMe
                          ? "bg-gold text-white rounded-br-md"
                          : "bg-surface-light text-foreground rounded-bl-md border border-border/50"
                      }`}
                    >
                      {msg.body}
                    </div>
                  </div>
                );
              })
            )}
            {chatSending && (
              <div className="flex justify-end">
                <div className="bg-gold/50 text-white rounded-2xl rounded-br-md px-4 py-3 text-xs">
                  Sending…
                </div>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          <div className="border-t border-border p-3 shrink-0">
            <div className="flex items-center gap-2">
              <input
                ref={chatInputRef}
                type="text"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={handleChatKeyDown}
                placeholder="Write a message…"
                disabled={chatSending}
                className="input flex-1 text-xs py-2.5"
              />
              <button
                onClick={handleSendMessage}
                disabled={!chatInput.trim() || chatSending}
                className={`p-2.5 rounded-xl transition-all ${
                  chatInput.trim() && !chatSending
                    ? "bg-gold text-white hover:bg-gold/90"
                    : "bg-surface-light text-muted cursor-not-allowed"
                }`}
              >
                <Send size={14} />
              </button>
            </div>
          </div>
        </div>
      )}

      {notificationsOpen && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setNotificationsOpen(false)}
        />
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════
   Sub-components
   ══════════════════════════════════════════════════════════════════ */

function QuickStat({
  label,
  value,
  icon,
  color,
  highlight,
  loading,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
  color: string;
  highlight?: boolean;
  loading?: boolean;
}) {
  const colorMap: Record<string, string> = {
    gold: "bg-gold/10 text-gold border-gold/20",
    warning: "bg-warning/10 text-warning border-warning/20",
    info: "bg-info/10 text-info border-info/20",
    accent: "bg-accent/10 text-accent border-accent/20",
    success: "bg-success/10 text-success border-success/20",
  };

  return (
    <div
      className={`card flex items-center gap-3 ${highlight ? "border-warning/30" : ""}`}
    >
      <div
        className={`p-2 rounded-xl border shrink-0 ${colorMap[color] || colorMap.gold}`}
      >
        {icon}
      </div>
      <div>
        <p className="text-xl font-bold text-foreground tracking-tight tabular-nums">
          {loading ? (
            <Loader2 size={16} className="animate-spin text-muted" />
          ) : (
            value
          )}
        </p>
        <p className="text-[10px] text-muted font-medium uppercase tracking-wider">
          {label}
        </p>
      </div>
    </div>
  );
}

function QuickActionButton({
  icon,
  label,
  description,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  description: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="card text-left group cursor-pointer hover:border-gold/30"
    >
      <div className="flex items-center gap-2.5 mb-2">
        <div className="p-2 rounded-xl bg-gold/8 text-gold border border-gold/15 group-hover:bg-gold/15 transition-colors">
          {icon}
        </div>
        <p className="text-xs font-semibold text-foreground">{label}</p>
      </div>
      <p className="text-[10px] text-muted leading-relaxed">{description}</p>
    </button>
  );
}

function EmptyBlock({
  icon,
  title,
  description,
  compact,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  compact?: boolean;
}) {
  return (
    <div
      className={`card flex flex-col items-center justify-center text-center ${
        compact ? "py-5" : "py-10"
      }`}
    >
      <div className="h-10 w-10 rounded-xl bg-muted/10 border border-muted/20 flex items-center justify-center mb-2 text-muted">
        {icon}
      </div>
      <p className="text-sm font-semibold text-foreground">{title}</p>
      <p className="text-[11px] text-muted mt-1 max-w-xs">{description}</p>
    </div>
  );
}

function ErrorBlock({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="card flex items-start gap-3 border-danger/20 bg-danger/[0.03]">
      <div className="h-9 w-9 rounded-xl bg-danger/10 border border-danger/20 flex items-center justify-center shrink-0">
        <AlertCircle size={16} className="text-danger" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-semibold text-foreground">Couldn&apos;t load</p>
        <p className="text-[11px] text-muted mt-0.5">{message}</p>
      </div>
      <button
        onClick={onRetry}
        className="text-[11px] text-gold hover:text-gold/80 font-medium"
      >
        Retry
      </button>
    </div>
  );
}
