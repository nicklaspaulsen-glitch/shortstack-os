"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/lib/auth-context";
import { createClient } from "@/lib/supabase/client";
import { formatRelativeTime } from "@/lib/utils";
import Link from "next/link";
import PageAI from "@/components/page-ai";
import EmptyState from "@/components/empty-state";
import toast from "react-hot-toast";
import {
  Bell, Search, Zap, Send, Sparkles, Activity, AlertTriangle,
  CheckCircle2, Eye, ExternalLink, Loader, RefreshCw,
  Info, XCircle, ChevronRight, Filter, Check,
} from "lucide-react";
import PageHero from "@/components/ui/page-hero";

/* ── Types ── */
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

/* ── Tab configuration ── */
const TABS: { key: NotifType; label: string; icon: React.ReactNode }[] = [
  { key: "all",       label: "All",        icon: <Bell size={13} /> },
  { key: "lead",      label: "Leads",      icon: <Zap size={13} /> },
  { key: "outreach",  label: "Outreach",   icon: <Send size={13} /> },
  { key: "autopilot", label: "Auto-Pilot", icon: <Sparkles size={13} /> },
  { key: "system",    label: "System",     icon: <Activity size={13} /> },
  { key: "alert",     label: "Alerts",     icon: <AlertTriangle size={13} /> },
];

/* ── Notification type styling ── */
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
    color: "text-blue-400",
    bg: "bg-blue-500/10",
    border: "border-blue-500/30",
    label: "Outreach",
  },
  autopilot: {
    icon: <Sparkles size={16} />,
    color: "text-gold",
    bg: "bg-gold/10",
    border: "border-gold/30",
    label: "Auto-Pilot",
  },
  system: {
    icon: <Activity size={16} />,
    color: "text-gray-400",
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
    color: "text-blue-400",
    bg: "bg-blue-500/10",
    border: "border-blue-500/30",
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
    color: "text-amber-400",
    bg: "bg-amber-500/10",
    border: "border-amber-500/30",
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

/* ── Action button labels by type ── */
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

/* ── Date grouping ── */
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

/* ── Loading skeleton ── */
function NotificationSkeleton() {
  return (
    <div className="space-y-3">
      {[...Array(5)].map((_, i) => (
        <div key={i} className="card p-4 animate-pulse">
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

/* ══════════════════════════════════════════════════════════════
   Notifications Page
   ══════════════════════════════════════════════════════════════ */
export default function NotificationsPage() {
  const { user } = useAuth();
  const supabase = createClient();

  /* ── State ── */
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<NotifType>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [markingAll, setMarkingAll] = useState(false);

  /* ── Fetch notifications ── */
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
    } catch (err: any) {
      setError(err.message || "Failed to load notifications");
    } finally {
      setLoading(false);
    }
  }, [user, supabase]);

  /* ── Initial fetch + polling ── */
  useEffect(() => {
    if (user) {
      fetchNotifications();
      const interval = setInterval(fetchNotifications, 30000);
      return () => clearInterval(interval);
    }
  }, [user, fetchNotifications]);

  /* ── Realtime subscription ── */
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
        (payload: any) => {
          setNotifications((prev) => [payload.new as Notification, ...prev]);
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  /* ── Mark single as read ── */
  async function markRead(id: string) {
    await supabase.from("notifications").update({ read: true }).eq("id", id);
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n))
    );
  }

  /* ── Mark all as read ── */
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

  /* ── Filtered & grouped ── */
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

  /* ── Group by date ── */
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

  /* ── Render ── */
  return (
    <div className="fade-in space-y-6">
      <PageHero
        icon={<Bell size={28} />}
        title="Notifications"
        subtitle="Stay informed about tasks, leads & events."
        gradient="sunset"
        actions={
          <>
            {unreadCount > 0 && (
              <span className="text-[10px] font-medium text-white bg-white/15 border border-white/25 px-2.5 py-1 rounded-full">
                {unreadCount} unread
              </span>
            )}
            <button
              onClick={() => fetchNotifications()}
              className="p-2 rounded-xl text-white bg-white/10 border border-white/20 hover:bg-white/20 transition-colors"
              title="Refresh"
            >
              <RefreshCw size={14} />
            </button>
            {unreadCount > 0 && (
              <button
                onClick={markAllRead}
                disabled={markingAll}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium text-white bg-white/15 border border-white/25 hover:bg-white/25 transition-colors disabled:opacity-50"
              >
                {markingAll ? <Loader size={12} className="animate-spin" /> : <Check size={12} />}
                Mark All Read
              </button>
            )}
          </>
        }
      />

      {/* ─── Search + Filter Tabs ─── */}
      <div className="space-y-3">
        {/* Search */}
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <input
            type="text"
            placeholder="Search notifications..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-surface border border-border/50 text-xs text-foreground placeholder:text-muted focus:outline-none focus:ring-1 focus:ring-gold/30 focus:border-gold/30 transition-all"
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
                  ? "text-gold bg-gold/10 border border-gold/20"
                  : "text-muted hover:text-foreground hover:bg-surface-light border border-transparent"
              }`}
            >
              {tab.icon}
              {tab.label}
              {tabCounts[tab.key] > 0 && (
                <span className={`text-[9px] px-1.5 py-0.5 rounded-full ${
                  activeTab === tab.key ? "bg-gold/20 text-gold" : "bg-surface-light text-muted"
                }`}>
                  {tabCounts[tab.key]}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* ─── Content ─── */}
      {loading ? (
        <NotificationSkeleton />
      ) : error ? (
        <div className="card p-8 text-center">
          <AlertTriangle size={24} className="mx-auto mb-2 text-danger" />
          <p className="text-sm text-foreground font-medium mb-1">Failed to load notifications</p>
          <p className="text-xs text-muted mb-4">{error}</p>
          <button
            onClick={fetchNotifications}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-medium text-gold bg-gold/10 hover:bg-gold/20 transition-colors"
          >
            <RefreshCw size={12} />
            Try Again
          </button>
        </div>
      ) : filtered.length === 0 ? (
        searchQuery || activeTab !== "all" ? (
          <div className="card p-8 text-center">
            <Filter size={20} className="mx-auto mb-2 text-muted/30" />
            <p className="text-sm text-foreground font-medium mb-1">No matching notifications</p>
            <p className="text-xs text-muted">
              {searchQuery ? `No results for "${searchQuery}"` : `No ${activeTab} notifications yet`}
            </p>
            <button
              onClick={() => { setSearchQuery(""); setActiveTab("all"); }}
              className="mt-3 text-xs text-gold hover:text-gold-light font-medium transition-colors"
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
                <span className="text-[10px] font-semibold text-muted uppercase tracking-[0.15em]">
                  {group.label}
                </span>
                <div className="flex-1 h-px bg-border/30" />
                <span className="text-[9px] text-muted">
                  {group.items.length} {group.items.length === 1 ? "notification" : "notifications"}
                </span>
              </div>

              {/* Notification cards */}
              <div className="space-y-2">
                {group.items.map((n) => {
                  const config = TYPE_CONFIG[n.type] || TYPE_CONFIG.info;
                  const actionLabel = getActionLabel(n.type);
                  return (
                    <div
                      key={n.id}
                      className={`card group relative overflow-hidden transition-all duration-200 hover:shadow-md ${
                        !n.read
                          ? "bg-surface border-l-2 border-l-gold"
                          : "bg-surface/60 opacity-75 hover:opacity-100"
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
                              !n.read ? "text-foreground" : "text-muted-light"
                            }`}>
                              {n.title}
                            </p>
                            {!n.read && (
                              <div className="w-2 h-2 rounded-full bg-gold shrink-0 animate-pulse" />
                            )}
                            <span className={`text-[8px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full ${config.bg} ${config.color}`}>
                              {config.label}
                            </span>
                          </div>
                          {n.message && (
                            <p className={`text-xs mt-0.5 line-clamp-2 ${
                              !n.read ? "text-muted" : "text-muted/60"
                            }`}>
                              {n.message}
                            </p>
                          )}
                          <div className="flex items-center gap-3 mt-2">
                            <span className="text-[10px] text-muted/60">
                              {formatRelativeTime(n.created_at)}
                            </span>
                            {!n.read && (
                              <button
                                onClick={() => markRead(n.id)}
                                className="text-[10px] text-muted hover:text-foreground flex items-center gap-1 transition-colors"
                              >
                                <Eye size={10} />
                                Mark read
                              </button>
                            )}
                            {actionLabel && n.link && (
                              <Link
                                href={n.link}
                                onClick={() => markRead(n.id)}
                                className="text-[10px] text-gold hover:text-gold-light flex items-center gap-1 font-medium transition-colors"
                              >
                                {actionLabel}
                                <ExternalLink size={9} />
                              </Link>
                            )}
                            {actionLabel && !n.link && (
                              <span className="text-[10px] text-gold/50 flex items-center gap-1">
                                {actionLabel}
                                <ChevronRight size={9} />
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ─── Stats bar ─── */}
      {!loading && notifications.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          {TABS.filter((t) => t.key !== "all").map((tab) => {
            const count = tabCounts[tab.key];
            const unread = notifications.filter(
              (n) => typeToTab(n.type) === tab.key && !n.read
            ).length;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`card p-3 text-center hover:shadow-md transition-all ${
                  activeTab === tab.key ? "ring-1 ring-gold/30" : ""
                }`}
              >
                <div className="flex items-center justify-center gap-1.5 mb-1">
                  <span className="text-muted">{tab.icon}</span>
                  <span className="text-lg font-bold text-foreground">{count}</span>
                </div>
                <p className="text-[10px] text-muted">{tab.label}</p>
                {unread > 0 && (
                  <span className="text-[8px] text-gold bg-gold/10 px-1.5 py-0.5 rounded-full mt-1 inline-block">
                    {unread} new
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}

      {/* ─── PageAI ─── */}
      <PageAI
        pageName="Notifications"
        context="This is the notifications center showing alerts from lead scraping, outreach campaigns, auto-pilot actions, and system events. The user can filter by type, mark as read, and navigate to relevant pages."
        suggestions={[
          "Summarize my unread notifications",
          "Which alerts need my attention?",
          "How many leads were scraped this week?",
          "Show me outreach delivery stats",
        ]}
      />
    </div>
  );
}
