"use client";

import { useState, useRef, useEffect } from "react";
import {
  FolderKanban,
  Clock,
  MessageSquare,
  CalendarDays,
  CheckCircle,
  Eye,
  Rocket,
  FileBarChart,
  TrendingUp,
  Share2,
  Search,
  Send,
  Bot,
  User,
  Download,
  RefreshCw,
  Phone,
  Upload,
  MessageCircle,
  Bell,
  X,
  ChevronRight,
  Sparkles,
  BarChart3,
  Circle,
} from "lucide-react";
import toast from "react-hot-toast";

/* ══════════════════════════════════════════════════════════════════
   DEMO DATA — this is the client-facing portal preview.
   TODO: Fetch each section from /api/portal/[clientId]/* once the real
   portal endpoints ship (projects, reports, deliverables, activity,
   notifications). Until then these constants render a demo experience
   so agencies can show prospects what the portal looks like.
   Button handlers below intentionally return toast-only feedback; the
   backing actions will be wired once the real data layer lands.
   ══════════════════════════════════════════════════════════════════ */

const MOCK_CLIENT = {
  companyName: "Acme Corp",
  contactName: "Jordan Mitchell",
  accountManager: "Sarah Chen",
  accountManagerAvatar: "SC",
  nextMeeting: "Apr 18, 2026 at 2:00 PM",
  plan: "Growth",
};

const MOCK_PROJECTS = [
  { id: "p1", name: "Website Redesign", status: "Active" as const, progress: 72,
    deadline: "May 15, 2026", assignee: "Sarah Chen", assigneeInitials: "SC",
    description: "Complete overhaul of corporate website with new branding" },
  { id: "p2", name: "Q2 Ad Campaign", status: "Active" as const, progress: 45,
    deadline: "Jun 1, 2026", assignee: "Mike Torres", assigneeInitials: "MT",
    description: "Multi-channel paid advertising campaign for Q2 launch" },
  { id: "p3", name: "Brand Guidelines V2", status: "Review" as const, progress: 90,
    deadline: "Apr 20, 2026", assignee: "Lina Park", assigneeInitials: "LP",
    description: "Updated brand guidelines including new color palette" },
  { id: "p4", name: "SEO Content Strategy", status: "Active" as const, progress: 35,
    deadline: "Jul 10, 2026", assignee: "Alex Rivera", assigneeInitials: "AR",
    description: "12-month content roadmap targeting high-value keywords" },
  { id: "p5", name: "Social Media Audit", status: "Completed" as const, progress: 100,
    deadline: "Apr 5, 2026", assignee: "Lina Park", assigneeInitials: "LP",
    description: "Full audit of all social media channels and performance" },
  { id: "p6", name: "Email Automation Flow", status: "Active" as const, progress: 60,
    deadline: "May 28, 2026", assignee: "Sarah Chen", assigneeInitials: "SC",
    description: "Drip campaign and lead nurturing automation setup" },
];

const MOCK_STATS = { totalProjects: 6, pendingApprovals: 3, unreadMessages: 5, upcomingMeetings: 2 };

const MOCK_ACTIVITY = [
  { id: "a1", type: "delivery", title: "Website mockups delivered",
    description: "Homepage and 3 inner page designs ready for review", time: "2 hours ago", icon: "check" },
  { id: "a2", type: "report", title: "Monthly performance report generated",
    description: "March 2026 report is available in your Reports section", time: "5 hours ago", icon: "chart" },
  { id: "a3", type: "campaign", title: "Google Ads campaign launched",
    description: "Q2 Search campaign is now live across 12 ad groups", time: "1 day ago", icon: "rocket" },
  { id: "a4", type: "message", title: "New message from Sarah Chen",
    description: "Regarding the brand color options for the website", time: "1 day ago", icon: "message" },
  { id: "a5", type: "delivery", title: "Social media audit completed",
    description: "Full report with recommendations is now available", time: "3 days ago", icon: "check" },
  { id: "a6", type: "campaign", title: "Email sequence activated",
    description: "Welcome series now live for new leads", time: "4 days ago", icon: "rocket" },
];

const MOCK_REPORTS = [
  { id: "r1", name: "Monthly Performance", description: "Overall KPIs, traffic, and conversion metrics",
    period: "March 2026", icon: FileBarChart, color: "#C9A84C" },
  { id: "r2", name: "Ad Spend Analysis", description: "ROAS breakdown across all paid channels",
    period: "Q1 2026", icon: TrendingUp, color: "#3B82F6" },
  { id: "r3", name: "Social Media Growth", description: "Follower growth, engagement, and reach analytics",
    period: "March 2026", icon: Share2, color: "#8B5CF6" },
  { id: "r4", name: "SEO Progress", description: "Keyword rankings, organic traffic, and backlinks",
    period: "March 2026", icon: Search, color: "#10B981" },
];

const MOCK_DELIVERABLES = [
  { id: "d1", title: "Homepage final design", project: "Website Redesign",
    dueDate: "Apr 18, 2026", status: "In Progress" as const },
  { id: "d2", title: "Brand guidelines PDF", project: "Brand Guidelines V2",
    dueDate: "Apr 20, 2026", status: "Review" as const },
  { id: "d3", title: "Ad creative set A", project: "Q2 Ad Campaign",
    dueDate: "Apr 25, 2026", status: "Pending" as const },
  { id: "d4", title: "Blog post batch (5 articles)", project: "SEO Content Strategy",
    dueDate: "May 1, 2026", status: "In Progress" as const },
  { id: "d5", title: "Email template designs", project: "Email Automation Flow",
    dueDate: "May 5, 2026", status: "Pending" as const },
];

const MOCK_NOTIFICATIONS = [
  { id: "n1", title: "Design mockups ready for review", time: "2 hours ago", read: false },
  { id: "n2", title: "March report is available", time: "5 hours ago", read: false },
  { id: "n3", title: "Meeting rescheduled to Apr 18", time: "1 day ago", read: true },
  { id: "n4", title: "Invoice #1042 paid successfully", time: "2 days ago", read: true },
];

const AI_RESPONSES = [
  "The Website Redesign is at 72% completion. Homepage mockups were just delivered for your review.",
  "Your Q2 Ad Campaign launched yesterday with promising early results. I can pull the latest metrics.",
  "Brand Guidelines V2 is at 90% in review. Once you approve the color palette, the team will finalize.",
  "Sarah Chen is your primary contact for the Website Redesign and Email Automation projects.",
  "You have 2 deliverables due this week and 3 more in the next two weeks. Everything is on track.",
];

/* ══════════════════════════════════════════════════════════════════
   PAGE COMPONENT
   ══════════════════════════════════════════════════════════════════ */

export default function ClientPortalDashboard({
  params: _params,
}: {
  params: { clientId: string };
}) {
  const [chatOpen, setChatOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState<
    Array<{ role: "user" | "assistant"; content: string }>
  >([
    {
      role: "assistant",
      content:
        "Hi there! I'm your account assistant. Ask me anything about your projects, deliverables, or reports.",
    },
  ]);
  const [chatInput, setChatInput] = useState("");
  const [chatTyping, setChatTyping] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [notifications, setNotifications] = useState(MOCK_NOTIFICATIONS);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const chatInputRef = useRef<HTMLInputElement>(null);

  const unreadCount = notifications.filter((n) => !n.read).length;

  /* Auto-scroll chat to bottom */
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages, chatTyping]);

  /* Focus chat input when opened */
  useEffect(() => {
    if (chatOpen) {
      setTimeout(() => chatInputRef.current?.focus(), 100);
    }
  }, [chatOpen]);

  /* ── Send chat message ──
     TODO: Wire to a real /api/portal/chat endpoint once it ships.
     For now we pick a canned response from AI_RESPONSES so the UX still
     demos cleanly without pretending to be a live LLM. */
  function handleSendMessage() {
    const text = chatInput.trim();
    if (!text) return;

    setChatMessages((prev) => [...prev, { role: "user", content: text }]);
    setChatInput("");
    setChatTyping(true);

    setTimeout(() => {
      const response =
        AI_RESPONSES[Math.floor(Math.random() * AI_RESPONSES.length)];
      setChatMessages((prev) => [
        ...prev,
        { role: "assistant", content: response },
      ]);
      setChatTyping(false);
    }, 1200 + Math.random() * 800);
  }

  function handleChatKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  }

  /* ── Mark all notifications as read ── */
  function markAllRead() {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  }

  /* ── Quick action handlers ── */
  function handleQuickAction(action: string) {
    toast.success(`${action} request submitted`);
  }

  /* ── Activity icon mapper ── */
  function getActivityIcon(type: string) {
    switch (type) {
      case "check":
        return <CheckCircle size={16} className="text-success" />;
      case "chart":
        return <BarChart3 size={16} className="text-info" />;
      case "rocket":
        return <Rocket size={16} className="text-gold" />;
      case "message":
        return <MessageSquare size={16} className="text-purple-400" />;
      default:
        return <Circle size={16} className="text-muted" />;
    }
  }

  /* ── Status badge color ── */
  function getStatusStyle(status: string) {
    switch (status) {
      case "Active":
      case "In Progress":
        return "bg-gold/10 text-gold border-gold/20";
      case "Review":
        return "bg-info/10 text-info border-info/20";
      case "Completed":
        return "bg-success/10 text-success border-success/20";
      case "Pending":
        return "bg-muted/10 text-muted border-muted/20";
      default:
        return "bg-muted/10 text-muted border-muted/20";
    }
  }

  /* ── Progress bar color ── */
  function getProgressColor(progress: number) {
    if (progress >= 80) return "bg-success";
    if (progress >= 50) return "bg-gold";
    return "bg-info";
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* ════════════════════════════════════════════
          HEADER — Welcome + Notifications
          ════════════════════════════════════════════ */}
      <div className="flex items-start justify-between gap-4 fade-in">
        <div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight">
            Welcome back, {MOCK_CLIENT.contactName}
          </h1>
          <p className="text-sm text-muted mt-1">
            Here&apos;s what&apos;s happening with{" "}
            <span className="text-foreground font-medium">
              {MOCK_CLIENT.companyName}
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

          {/* Notifications dropdown */}
          {notificationsOpen && (
            <div className="absolute right-0 top-12 w-80 rounded-2xl bg-surface border border-border shadow-elevated z-50 scale-in overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 border-b border-border">
                <p className="text-sm font-semibold text-foreground">
                  Notifications
                </p>
                <button
                  onClick={markAllRead}
                  className="text-[11px] text-gold hover:text-gold/80 font-medium transition-colors"
                >
                  Mark all read
                </button>
              </div>
              <div className="max-h-72 overflow-y-auto">
                {notifications.map((n) => (
                  <div
                    key={n.id}
                    className={`flex items-start gap-3 px-4 py-3 border-b border-border/50 last:border-0 transition-colors ${
                      n.read
                        ? "opacity-60"
                        : "bg-gold/[0.03]"
                    }`}
                  >
                    <div
                      className={`mt-1 w-2 h-2 rounded-full shrink-0 ${
                        n.read ? "bg-transparent" : "bg-gold"
                      }`}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-foreground leading-snug">
                        {n.title}
                      </p>
                      <p className="text-[10px] text-muted mt-0.5">{n.time}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ════════════════════════════════════════════
          WELCOME BANNER
          ════════════════════════════════════════════ */}
      <div
        className="card fade-in stagger-1 relative overflow-hidden"
        style={{
          background:
            "linear-gradient(135deg, var(--color-surface) 0%, color-mix(in srgb, var(--color-surface) 92%, var(--color-accent)) 100%)",
        }}
      >
        {/* Decorative element */}
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
                  {MOCK_CLIENT.companyName}
                </p>
                <p className="text-xs text-muted">
                  {MOCK_CLIENT.plan} Plan
                </p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-muted">
              <span className="flex items-center gap-1.5">
                <User size={13} className="text-gold/70" />
                Account Manager:{" "}
                <span className="text-foreground font-medium">
                  {MOCK_CLIENT.accountManager}
                </span>
              </span>
              <span className="flex items-center gap-1.5">
                <CalendarDays size={13} className="text-gold/70" />
                Next Meeting:{" "}
                <span className="text-foreground font-medium">
                  {MOCK_CLIENT.nextMeeting}
                </span>
              </span>
            </div>
          </div>
          <button
            onClick={() => handleQuickAction("Schedule Call")}
            className="btn-primary flex items-center gap-2 text-sm shrink-0 self-start md:self-center"
          >
            <Phone size={14} />
            Schedule Call
          </button>
        </div>
      </div>

      {/* ════════════════════════════════════════════
          QUICK STATS ROW
          ════════════════════════════════════════════ */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 fade-in stagger-2">
        <QuickStat
          label="Total Projects"
          value={MOCK_STATS.totalProjects}
          icon={<FolderKanban size={16} />}
          color="gold"
        />
        <QuickStat
          label="Pending Approvals"
          value={MOCK_STATS.pendingApprovals}
          icon={<Clock size={16} />}
          color="warning"
          highlight
        />
        <QuickStat
          label="Unread Messages"
          value={MOCK_STATS.unreadMessages}
          icon={<MessageSquare size={16} />}
          color="info"
        />
        <QuickStat
          label="Upcoming Meetings"
          value={MOCK_STATS.upcomingMeetings}
          icon={<CalendarDays size={16} />}
          color="accent"
        />
      </div>

      {/* ════════════════════════════════════════════
          PROJECT STATUS CARDS
          ════════════════════════════════════════════ */}
      <div className="space-y-3 fade-in stagger-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-foreground uppercase tracking-wider">
            Active Projects
          </h2>
          <button className="link-accent">
            View all <ChevronRight size={12} />
          </button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {MOCK_PROJECTS.map((project) => (
            <div
              key={project.id}
              className="card group cursor-pointer"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-foreground truncate group-hover:text-gold transition-colors">
                    {project.name}
                  </p>
                  <p className="text-[11px] text-muted mt-0.5 line-clamp-1">
                    {project.description}
                  </p>
                </div>
                <span
                  className={`badge border text-[10px] ml-2 shrink-0 ${getStatusStyle(
                    project.status
                  )}`}
                >
                  {project.status}
                </span>
              </div>

              {/* Progress bar */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-[10px]">
                  <span className="text-muted">Progress</span>
                  <span className="text-foreground font-medium">
                    {project.progress}%
                  </span>
                </div>
                <div className="h-1.5 bg-surface-light rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-700 ${getProgressColor(
                      project.progress
                    )}`}
                    style={{ width: `${project.progress}%` }}
                  />
                </div>
              </div>

              {/* Footer */}
              <div className="flex items-center justify-between mt-3 pt-3 border-t border-border/50">
                <div className="flex items-center gap-2">
                  <div className="h-6 w-6 rounded-full bg-gold/10 border border-gold/20 flex items-center justify-center">
                    <span className="text-[9px] text-gold font-semibold">
                      {project.assigneeInitials}
                    </span>
                  </div>
                  <span className="text-[11px] text-muted">
                    {project.assignee}
                  </span>
                </div>
                <span className="text-[10px] text-muted flex items-center gap-1">
                  <Clock size={10} />
                  {project.deadline}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ════════════════════════════════════════════
          TWO-COLUMN: ACTIVITY FEED + DELIVERABLES
          ════════════════════════════════════════════ */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 fade-in stagger-4">
        {/* ── Activity Feed ── */}
        <div className="card space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-foreground uppercase tracking-wider">
              Recent Activity
            </h2>
            <span className="text-[10px] text-muted bg-surface-light px-2 py-0.5 rounded-full">
              Last 7 days
            </span>
          </div>
          <div className="space-y-0">
            {MOCK_ACTIVITY.map((activity, idx) => (
              <div
                key={activity.id}
                className={`flex items-start gap-3 py-3 ${
                  idx < MOCK_ACTIVITY.length - 1
                    ? "border-b border-border/40"
                    : ""
                }`}
              >
                <div className="mt-0.5 p-1.5 rounded-lg bg-surface-light shrink-0">
                  {getActivityIcon(activity.icon)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-foreground leading-snug">
                    {activity.title}
                  </p>
                  <p className="text-[11px] text-muted mt-0.5 line-clamp-1">
                    {activity.description}
                  </p>
                </div>
                <span className="text-[10px] text-muted whitespace-nowrap shrink-0 mt-0.5">
                  {activity.time}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* ── Upcoming Deliverables ── */}
        <div className="card space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-foreground uppercase tracking-wider">
              Upcoming Deliverables
            </h2>
            <span className="text-[10px] text-muted bg-surface-light px-2 py-0.5 rounded-full">
              {MOCK_DELIVERABLES.length} items
            </span>
          </div>
          <div className="space-y-0">
            {MOCK_DELIVERABLES.map((deliverable, idx) => (
              <div
                key={deliverable.id}
                className={`flex items-start gap-3 py-3 ${
                  idx < MOCK_DELIVERABLES.length - 1
                    ? "border-b border-border/40"
                    : ""
                }`}
              >
                {/* Timeline dot + line */}
                <div className="flex flex-col items-center shrink-0">
                  <div
                    className={`w-2.5 h-2.5 rounded-full border-2 mt-1 ${
                      deliverable.status === "In Progress"
                        ? "border-gold bg-gold/30"
                        : deliverable.status === "Review"
                        ? "border-info bg-info/30"
                        : "border-muted/40 bg-transparent"
                    }`}
                  />
                  {idx < MOCK_DELIVERABLES.length - 1 && (
                    <div className="w-px h-full bg-border/60 mt-1" />
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-xs font-medium text-foreground leading-snug">
                        {deliverable.title}
                      </p>
                      <p className="text-[10px] text-muted mt-0.5">
                        {deliverable.project}
                      </p>
                    </div>
                    <span
                      className={`badge border text-[9px] shrink-0 ${getStatusStyle(
                        deliverable.status
                      )}`}
                    >
                      {deliverable.status}
                    </span>
                  </div>
                  <p className="text-[10px] text-muted mt-1 flex items-center gap-1">
                    <CalendarDays size={10} />
                    Due: {deliverable.dueDate}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ════════════════════════════════════════════
          REPORTS SECTION
          ════════════════════════════════════════════ */}
      <div className="space-y-3 fade-in">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-foreground uppercase tracking-wider">
            Reports
          </h2>
          <button className="link-accent">
            View all reports <ChevronRight size={12} />
          </button>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
          {MOCK_REPORTS.map((report) => {
            const Icon = report.icon;
            return (
              <div key={report.id} className="card group">
                <div className="flex items-start gap-3 mb-3">
                  <div
                    className="p-2 rounded-xl shrink-0"
                    style={{
                      background: `${report.color}12`,
                      border: `1px solid ${report.color}20`,
                    }}
                  >
                    <Icon size={16} style={{ color: report.color }} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-foreground leading-snug">
                      {report.name}
                    </p>
                    <p className="text-[10px] text-muted mt-0.5 line-clamp-2">
                      {report.description}
                    </p>
                  </div>
                </div>
                <p className="text-[10px] text-muted mb-3">{report.period}</p>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() =>
                      toast.success(`Opening ${report.name} report`)
                    }
                    className="flex-1 flex items-center justify-center gap-1.5 text-[11px] font-medium text-foreground bg-surface-light hover:bg-border/50 rounded-lg py-2 transition-colors"
                  >
                    <Eye size={12} />
                    View
                  </button>
                  <button
                    onClick={() =>
                      toast.success(`Downloading ${report.name} PDF`)
                    }
                    className="flex-1 flex items-center justify-center gap-1.5 text-[11px] font-medium text-gold bg-gold/8 hover:bg-gold/15 rounded-lg py-2 transition-colors"
                  >
                    <Download size={12} />
                    PDF
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ════════════════════════════════════════════
          QUICK ACTIONS
          ════════════════════════════════════════════ */}
      <div className="space-y-3 fade-in">
        <h2 className="text-sm font-semibold text-foreground uppercase tracking-wider">
          Quick Actions
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <QuickActionButton
            icon={<RefreshCw size={16} />}
            label="Request Revision"
            description="Ask for changes on a deliverable"
            onClick={() => handleQuickAction("Request Revision")}
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
            icon={<MessageCircle size={16} />}
            label="Leave Feedback"
            description="Rate your experience"
            onClick={() => handleQuickAction("Leave Feedback")}
          />
        </div>
      </div>

      {/* ════════════════════════════════════════════
          AI CHAT WIDGET (floating)
          ════════════════════════════════════════════ */}
      {/* Chat toggle button */}
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
        {!chatOpen && (
          <span className="absolute -top-1 -right-1 w-3 h-3 bg-success rounded-full border-2 border-white" />
        )}
      </button>

      {/* Chat panel */}
      {chatOpen && (
        <div className="fixed bottom-20 right-6 z-40 w-[380px] max-h-[520px] rounded-2xl bg-surface border border-border shadow-elevated flex flex-col scale-in overflow-hidden">
          {/* Chat header */}
          <div className="flex items-center gap-3 px-4 py-3 border-b border-border shrink-0"
            style={{
              background:
                "linear-gradient(135deg, var(--color-surface) 0%, color-mix(in srgb, var(--color-surface) 94%, var(--color-accent)) 100%)",
            }}
          >
            <div className="relative">
              <div className="h-9 w-9 rounded-xl bg-gold/10 border border-gold/20 flex items-center justify-center">
                <Bot size={16} className="text-gold" />
              </div>
              <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-success rounded-full border-2 border-surface" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold text-foreground">
                Account Assistant
              </p>
              <p className="text-[10px] text-success flex items-center gap-1">
                <span className="w-1 h-1 rounded-full bg-success" />
                Online
              </p>
            </div>
            <button
              onClick={() => setChatOpen(false)}
              aria-label="Close assistant"
              className="p-1.5 rounded-lg text-muted hover:text-foreground hover:bg-surface-light transition-colors"
            >
              <X size={14} />
            </button>
          </div>

          {/* Chat messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-[280px]">
            {chatMessages.map((msg, idx) => (
              <div
                key={idx}
                className={`flex ${
                  msg.role === "user" ? "justify-end" : "justify-start"
                }`}
              >
                <div
                  className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-xs leading-relaxed ${
                    msg.role === "user"
                      ? "bg-gold text-white rounded-br-md"
                      : "bg-surface-light text-foreground rounded-bl-md border border-border/50"
                  }`}
                >
                  {msg.content}
                </div>
              </div>
            ))}
            {chatTyping && (
              <div className="flex justify-start">
                <div className="bg-surface-light border border-border/50 rounded-2xl rounded-bl-md px-4 py-3">
                  <div className="flex items-center gap-1.5">
                    <div className="w-1.5 h-1.5 rounded-full bg-muted animate-bounce" style={{ animationDelay: "0ms" }} />
                    <div className="w-1.5 h-1.5 rounded-full bg-muted animate-bounce" style={{ animationDelay: "150ms" }} />
                    <div className="w-1.5 h-1.5 rounded-full bg-muted animate-bounce" style={{ animationDelay: "300ms" }} />
                  </div>
                </div>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          {/* Chat input */}
          <div className="border-t border-border p-3 shrink-0">
            <div className="flex items-center gap-2">
              <input
                ref={chatInputRef}
                type="text"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={handleChatKeyDown}
                placeholder="Ask about your projects..."
                className="input flex-1 text-xs py-2.5"
              />
              <button
                onClick={handleSendMessage}
                disabled={!chatInput.trim()}
                className={`p-2.5 rounded-xl transition-all ${
                  chatInput.trim()
                    ? "bg-gold text-white hover:bg-gold/90"
                    : "bg-surface-light text-muted cursor-not-allowed"
                }`}
              >
                <Send size={14} />
              </button>
            </div>
            <p className="text-[9px] text-muted/50 text-center mt-2">
              AI assistant - responses may not be 100% accurate
            </p>
          </div>
        </div>
      )}

      {/* Close notifications on outside click */}
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
   QUICK STAT COMPONENT
   ══════════════════════════════════════════════════════════════════ */

function QuickStat({
  label,
  value,
  icon,
  color,
  highlight,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
  color: string;
  highlight?: boolean;
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
      className={`card flex items-center gap-3 ${
        highlight ? "border-warning/30" : ""
      }`}
    >
      <div
        className={`p-2 rounded-xl border shrink-0 ${
          colorMap[color] || colorMap.gold
        }`}
      >
        {icon}
      </div>
      <div>
        <p className="text-xl font-bold text-foreground tracking-tight tabular-nums">
          {value}
        </p>
        <p className="text-[10px] text-muted font-medium uppercase tracking-wider">
          {label}
        </p>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════
   QUICK ACTION BUTTON COMPONENT
   ══════════════════════════════════════════════════════════════════ */

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
