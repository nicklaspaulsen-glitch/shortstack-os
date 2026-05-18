"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/lib/auth-context";
import { createClient } from "@/lib/supabase/client";
import { formatRelativeTime } from "@/lib/utils";
import Link from "next/link";
import PageAI from "@/components/page-ai";
import EmptyState from "@/components/empty-state";
import toast from "react-hot-toast";
import { motion } from "framer-motion";
import {
  Bell, Search, Zap, Send, Sparkles, Activity, AlertTriangle,
  CheckCircle2, Eye, ExternalLink, Loader, RefreshCw,
  Info, XCircle, ChevronRight, Filter, Check,
} from "lucide-react";
import { MotionPage } from "@/components/motion/motion-page";

/* -- Types -- */
type NotifType = "all" | "lead" | "outreach" | "autopilot" | "system" | "alert";

interface Notification {
  id: string;
  user_id: string;
  title: string;
  message: string | null;
  type: string;       // info | warning | success | error | lead | outreach | autopilot | system | alert
  read: boolean;
  link: string | null;
  created_at: string;
}

/* -- Tab configuration -- */
const TABS: { key: NotifType; label: string; icon: React.ReactNode }[] = [
  { key: "all",       label: "All",        icon: <Bell size={13} /> },
  { key: "lead",      label: "Leads",      icon: <Zap size={13} /> },
  { key: "outreach",  label: "Outreach",   icon: <Send size={13} /> },
  { key: "autopilot", label: "Auto-Pilot", icon: <Sparkles size={13} /> },
  { key: "system",    label: "System",     icon: <Activity size={13} /> },
  { key: "alert",     label: "Alerts",     icon: <AlertTriangle size={13} /> },
];

/* -- Notification type styling -- */
const TYPE_CONFIG: Record<string, {
  icon: React.ReactNode;
  color: string;
  bg: string;
  border: string;
  label: string;
}> = {
  lead: {
    icon: <Zap size={16} />,
    color: "text-emerald-400",
    bg: "bg-emerald-500/10",
    border: "border-emerald-500/30",
    label: "Lead",
  },
  outreach: {
    icon: <Send size={16} />,
    color: "text-brand-accent",
    bg: "bg-[rgba(59,130,246,0.08)]",
    border: "border-[rgba(59,130,246,0.25)]",
    label: "Outreach",
  },
  autopilot: {
    icon: <Sparkles size={16} />,
    color: "text-brand-accent",
    bg: "bg-[rgba(59,130,246,0.08)]",
    border: "border-[rgba(59,130,246,0.25)]",
    label: "Auto-Pilot",
  },
  system: {
    icon: <Activity size={16} />,
    color: "text-text-muted",
    bg: "bg-gray-500/10",
    border: "border-gray-500/30",
    label: "System",
  },
  alert: {
    icon: <AlertTriangle size={16} />,
    color: "text-red-400",
    bg: "bg-red-500/10",
    border: "border-red-500/30",
    label: "Alert",
  },
  info: {
    icon: <Info size={16} />,
    color: "text-brand-accent",
    bg: "bg-[rgba(59,130,246,0.08)]",
    border: "border-[rgba(59,130,246,0.25)]",
    label: "Info",
  },
  success: {
    icon: <CheckCircle2 size={16} />,
    color: "text-emerald-400",
    bg: "bg-emerald-500/10",
    border: "border-emerald-500/30",
    label: "Success",
  },
  warning: {
    icon: <AlertTriangle size={16} />,
    color: "text-brand-accent",
    bg: "bg-[rgba(59,130,246,0.08)]",
    border: "border-[rgba(59,130,246,0.25)]",
    label: "Warning",
  },
  error: {
    icon: <XCircle size={16} />,
    color: "text-red-400",
    bg: "bg-red-500/10",
    border: "border-red-500/30",
    label: "Error",
  },
};

/* Map standard types to filter tabs */
function typeToTab(type: string): NotifType {
  if (type === "lead" || type === "success") return "lead";
  if (type === "outreach") return "outreach";
  if (type === "autopilot") return "autopilot";
  if (type === "system" || type === "info") return "system";
  if (type === "alert" || type === "error" || type === "warning") return "alert";
  return "system";
}

/* -- Action button labels by type -- */
function getActionLabel(type: string): string | null {
  switch (type) {
    case "lead": return "View Leads";
    case "outreach": return "Open Report";
    case "autopilot": return "View Tasks";
    case "alert":
    case "error": return "Investigate";
    default: return null;
  }
}

/* -- Date grouping -- */
function getDateGroup(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterdayStart = new Date(todayStart.getTime() - 86400000);
  const weekStart = new Date(todayStart.getTime() - 7 * 86400000);

  if (date >= todayStart) return "Today";
  if (date >= yesterdayStart) return "Yesterday";
  if (date >= weekStart) return "This Week";
  return "Earlier";
}

/* -- Loading skeleton -- */
function NotificationSkeleton() {
  return (
    <div className="space-y-3">
      {[...Array(5)].map((_, i) => (
        <div key={i} className="glass rounded-xl p-4 animate-pulse">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-surface-light/60" />
            <div className="flex-1 space-y-2">
              <div className="h-3.5 bg-surface-light/60 rounded w-2/3" />
              <div className="h-2.5 bg-surface-light/40 rounded w-full" />
              <div className="h-2 bg-surface-light/30 rounded w-1/4" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

/* --------------------------------------------------------------
   Notifications Page
   -------------------------------------------------------------- */
export default function NotificationsPage() {
  const { user } = useAuth();
  const supabase = createClient();

  /* -- State -- */
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<NotifType>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [markingAll, setMarkingAll] = useState(false);

  /* -- Fetch notifications -- */
  const fetchNotifications = useCallback(async () => {
    if (!user) return;
    try {
      const { data, error: fetchErr } = await supabase
        .from("notifications")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(100);

      if (fetchErr) throw fetchErr;
      setNotifications(data || []);
      setError(null);
    } catch (err) {
      console.error("[notifications] fetch failed:", err);
      setError(err instanceof Error ? err.message : "Failed to load notifications");
    } finally {
      setLoading(false);
    }
  }, [user, supabase]);

  /* -- Initial fetch + polling -- */
  useEffect(() => {
    if (user) {
      fetchNotifications();
      const interval = setInterval(fetchNotifications, 30000);
      return () => clearInterval(interval);
    }
  }, [user, fetchNotifications]);

  /* -- Realtime subscription -- */
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel("notifications-page")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${user.id}`,
        },
        (payload: { new: Notification }) => {
          setNotifications((prev) => [payload.new, ...prev]);
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  /* -- Mark single as read -- */
  async function markRead(id: string) {
    await supabase.from("notifications").update({ read: true }).eq("id", id);
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n))
    );
  }

  /* -- Mark all as read -- */
  async function markAllRead() {
    if (!user) return;
    setMarkingAll(true);
    await supabase
      .from("notifications")
      .update({ read: true })
      .eq("user_id", user.id)
      .eq("read", false);
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    setMarkingAll(false);
    toast.success("All notifications marked as read");
  }

  /* -- Filtered & grouped -- */
  const filtered = notifications
    .filter((n) => activeTab === "all" || typeToTab(n.type) === activeTab)
    .filter((n) =>
      !searchQuery ||
      n.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (n.message || "").toLowerCase().includes(searchQuery.toLowerCase())
    );

  const unreadCount = notifications.filter((n) => !n.read).length;
  const tabCounts: Record<NotifType, number> = {
    all: notifications.length,
    lead: notifications.filter((n) => typeToTab(n.type) === "lead").length,
    outreach: notifications.filter((n) => typeToTab(n.type) === "outreach").length,
    autopilot: notifications.filter((n) => typeToTab(n.type) === "autopilot").length,
    system: notifications.filter((n) => typeToTab(n.type) === "system").length,
    alert: notifications.filter((n) => typeToTab(n.type) === "alert").length,
  };

  /* -- Group by date -- */
  const grouped: { label: string; items: Notification[] }[] = [];
  const groupOrder = ["Today", "Yesterday", "This Week", "Earlier"];
  const groupMap: Record<string, Notification[]> = {};
  filtered.forEach((n) => {
    const g = getDateGroup(n.created_at);
    if (!groupMap[g]) groupMap[g] = [];
    groupMap[g].push(n);
  });
  groupOrder.forEach((label) => {
    if (groupMap[label]?.length) {
      grouped.push({ label, items: groupMap[label] });
    }
  });

  /* -- Render -- */
  return (
    <MotionPage className="space-y-6">{/* -- Notifications command strip -- */}
    <div className="flex items-center justify-between gap-4 px-1 py-3 sm:py-4">
      <div className="min-w-0">
        <p className="font-editorial text-[11px] italic text-text-muted mb-0.5">NOTIFICATIONS</p>
        <h1 className="font-display text-xl sm:text-2xl font-bold tracking-tight text-text-primary leading-none">Notifications</h1>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <>
                  {unreadCount > 0 && (
                    <span className="text-[10px] font-medium text-text-primary bg-[rgba(0,0,0,0.07)] border border-[rgba(0,0,0,0.12)] px-2.5 py-1 rounded-full">
                      {unreadCount} unread
                    </span>
                  )}
                  <button
                    onClick={() => fetchNotifications()}
                    className="p-2 rounded-xl text-text-primary bg-[rgba(0,0,0,0.06)] border border-[rgba(0,0,0,0.10)] hover:bg-[rgba(0,0,0,0.09)] transition-colors"
                    title="Refresh"
                  >
                    <RefreshCw size={14} />
                  </button>
                  {unreadCount > 0 && (
                    <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                      <button
                        onClick={markAllRead}
                        disabled={markingAll}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium text-text-primary bg-[rgba(0,0,0,0.07)] border border-[rgba(0,0,0,0.12)] hover:bg-[rgba(0,0,0,0.10)] transition-colors disabled:opacity-50"
                      >
                        {markingAll ? <Loader size={12} className="animate-spin" /> : <Check size={12} />}
                        Mark All Read
                      </button>
                    </motion.div>
                  )}
                </>
      </div>
    </div>{/* --- Search + Filter Tabs --- */}<div className="space-y-3">
              {/* Search */}
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
                <input
                  type="text"
                  placeholder="Search notifications..."
                  aria-label="Search notifications"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="glass w-full pl-9 pr-4 py-2.5 rounded-lg text-xs text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-1 focus:ring-[rgba(59,130,246,0.25)] focus:border-[rgba(59,130,246,0.25)] transition-all"
                />
              </div>

              {/* Tabs */}
              <div className="flex items-center gap-1 overflow-x-auto scrollbar-none pb-1">
                {TABS.map((tab) => (
                  <button
                    key={tab.key}
                    onClick={() => setActiveTab(tab.key)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-medium whitespace-nowrap transition-all ${
                      activeTab === tab.key
                        ? "text-brand-accent bg-[rgba(59,130,246,0.08)] border border-[rgba(59,130,246,0.2)]"
                        : "text-text-muted hover:text-text-primary hover:bg-surface-light border border-transparent"
                    }`}
                  >
                    {tab.icon}
                    {tab.label}
                    {tabCounts[tab.key] > 0 && (
                      <span className={`text-[9px] px-1.5 py-0.5 rounded-full ${
                        activeTab === tab.key ? "bg-[rgba(59,130,246,0.12)] text-brand-accent" : "bg-surface-light text-text-muted"
                      }`}>
                        {tabCounts[tab.key]}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>{/* --- Content --- */}{loading ? (
              <NotificationSkeleton />
            ) : error ? (
              <div className="glass rounded-xl p-8 text-center">
                <AlertTriangle size={24} className="mx-auto mb-2 text-danger" />
                <p className="text-sm text-text-primary font-medium mb-1">Failed to load notifications</p>
                <p className="text-xs text-text-muted mb-4">{error}</p>
                <button
                  onClick={fetchNotifications}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-medium text-brand-accent bg-[rgba(59,130,246,0.08)] hover:bg-[rgba(59,130,246,0.12)] transition-colors"
                >
                  <RefreshCw size={12} />
                  Try Again
                </button>
              </div>
            ) : filtered.length === 0 ? (
              searchQuery || activeTab !== "all" ? (
                <div className="glass rounded-xl p-8 text-center">
                  <Filter size={20} className="mx-auto mb-2 text-text-muted/30" />
                  <p className="text-sm text-text-primary font-medium mb-1">No matching notifications</p>
                  <p className="text-xs text-text-muted">
                    {searchQuery ? `No results for "${searchQuery}"` : `No ${activeTab} notifications yet`}
                  </p>
                  <button
                    onClick={() => { setSearchQuery(""); setActiveTab("all"); }}
                    className="mt-3 text-xs text-brand-accent hover:text-[#3B82F6] font-medium transition-colors"
                  >
                    Clear filters
                  </button>
                </div>
              ) : (
                <EmptyState
                  icon={<Bell size={28} />}
                  title="No notifications yet"
                  description="When your agents complete tasks, scrape leads, or send outreach, you'll see updates here."
                />
              )
            ) : (
              <div className="space-y-6">
                {grouped.map((group) => (
                  <div key={group.label}>
                    {/* Date group header */}
                    <div className="flex items-center gap-3 mb-3">
                      <span className="text-[10px] font-semibold text-text-muted uppercase tracking-[0.15em]">
                        {group.label}
                      </span>
                      <div className="flex-1 h-px bg-border-subtle/30" />
                      <span className="text-[9px] text-text-muted">
                        {group.items.length} {group.items.length === 1 ? "notification" : "notifications"}
                      </span>
                    </div>

                    {/* Notification cards */}
                    <div className="space-y-2">
                      {group.items.map((n, index) => {
                        const config = TYPE_CONFIG[n.type] || TYPE_CONFIG.info;
                        const actionLabel = getActionLabel(n.type);
                        return (
                          <motion.div
                            key={n.id}
                            initial={{ opacity: 0, x: -8 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ duration: 0.18, delay: index * 0.04 }}
                            whileHover={{ backgroundColor: "rgba(0,0,0,0.04)" }}
                            className={`glass rounded-xl group relative overflow-hidden transition-all duration-200 hover:shadow-md ${
                              !n.read
                                ? "border-l-2 border-l-indigo-500"
                                : "opacity-75 hover:opacity-100"
                            }`}
                          >
                            <div className="p-4 flex items-start gap-3.5">
                              {/* Icon */}
                              <div className={`shrink-0 w-10 h-10 rounded-xl ${config.bg} flex items-center justify-center ${config.color}`}>
                                {config.icon}
                              </div>

                              {/* Body */}
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-0.5">
                                  <p className={`text-sm font-medium truncate ${
                                    !n.read ? "text-text-primary" : "text-muted-light"
                                  }`}>
                                    {n.title}
                                  </p>
                                  {!n.read && (
                                    <div className="w-2 h-2 rounded-full bg-brand-accent shrink-0 animate-pulse" />
                                  )}
                                  <span className={`text-[8px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full ${config.bg} ${config.color}`}>
                                    {config.label}
                                  </span>
                                </div>
                                {n.message && (
                                  <p className={`text-xs mt-0.5 line-clamp-2 ${
                                    !n.read ? "text-text-muted" : "text-text-muted/60"
                                  }`}>
                                    {n.message}
                                  </p>
                                )}
                                <div className="flex items-center gap-3 mt-2">
                                  <span className="text-[10px] text-text-muted/60">
                                    {formatRelativeTime(n.created_at)}
                                  </span>
                                  {!n.read && (
                                    <button
                                      onClick={() => markRead(n.id)}
                                      className="text-[10px] text-text-muted hover:text-text-primary flex items-center gap-1 transition-colors"
                                    >
                                      <Eye size={10} />
                                      Mark read
                                    </button>
                                  )}
                                  {actionLabel && n.link && (
                                    <Link
                                      href={n.link}
                                      onClick={() => markRead(n.id)}
                                      className="text-[10px] text-brand-accent hover:text-[#3B82F6] flex items-center gap-1 font-medium transition-colors"
                                    >
                                      {actionLabel}
                                      <ExternalLink size={9} />
                                    </Link>
                                  )}
                                  {actionLabel && !n.link && (
                                    <span className="text-[10px] text-[rgba(59,130,246,0.5)] flex items-center gap-1">
                                      {actionLabel}
                                      <ChevronRight size={9} />
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                          </motion.div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}{/* --- Stats bar --- */}{!loading && notifications.length > 0 && (
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                {TABS.filter((t) => t.key !== "all").map((tab, index) => {
                  const count = tabCounts[tab.key];
                  const unread = notifications.filter(
                    (n) => typeToTab(n.type) === tab.key && !n.read
                  ).length;
                  return (
                    <motion.button
                      key={tab.key}
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.22, delay: index * 0.06 }}
                      whileHover={{ y: -2 }}
                      onClick={() => setActiveTab(tab.key)}
                      onMouseMove={(e) => { const rect = e.currentTarget.getBoundingClientRect(); e.currentTarget.style.setProperty("--mouse-x", `${e.clientX - rect.left}px`); e.currentTarget.style.setProperty("--mouse-y", `${e.clientY - rect.top}px`); }}
                      className={`glass rounded-xl p-3 text-center relative overflow-hidden hover:shadow-md transition-all spotlight-card ${
                        activeTab === tab.key ? "ring-1 ring-indigo-500/30" : ""
                      }`}
                    >
                      <div className="flex items-center justify-center gap-1.5 mb-1 mt-1">
                        <span className="text-text-muted">{tab.icon}</span>
                        <span className="text-lg font-bold text-text-primary">{count}</span>
                      </div>
                      <p className="text-[10px] text-text-muted">{tab.label}</p>
                      {unread > 0 && (
                        <span className="text-[8px] text-brand-accent bg-[rgba(59,130,246,0.08)] px-1.5 py-0.5 rounded-full mt-1 inline-block">
                          {unread} new
                        </span>
                      )}
                    </motion.button>
                  );
                })}
              </div>
            )}{/* --- PageAI --- */}<PageAI
              pageName="Notifications"
              context="This is the notifications center showing alerts from lead scraping, outreach campaigns, auto-pilot actions, and system events. The user can filter by type, mark as read, and navigate to relevant pages."
              suggestions={[
                "Summarize my unread notifications",
                "Which alerts need my attention?",
                "How many leads were scraped this week?",
                "Show me outreach delivery stats",
              ]}
            /></MotionPage>
  );
}
