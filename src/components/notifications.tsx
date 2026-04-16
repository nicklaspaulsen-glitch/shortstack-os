"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useAuth } from "@/lib/auth-context";
import { createClient } from "@/lib/supabase/client";
import { formatRelativeTime } from "@/lib/utils";
import Link from "next/link";
import {
  Bell, Zap, CheckCircle, CreditCard, Activity,
  Film, MessageSquare, Briefcase, Trash2,
  Info, AlertTriangle, CheckCircle2, XCircle,
} from "lucide-react";

interface Notification {
  id: string;
  user_id: string;
  title: string;
  message: string | null;
  type: string;
  read: boolean;
  link: string | null;
  created_at: string;
}

/* Map notification type to an icon */
const TYPE_ICONS: Record<string, React.ReactNode> = {
  // New standard types
  info:    <Info size={14} className="text-blue-400" />,
  warning: <AlertTriangle size={14} className="text-warning" />,
  success: <CheckCircle2 size={14} className="text-success" />,
  error:   <XCircle size={14} className="text-danger" />,
  // Legacy / domain-specific types
  lead:    <Zap size={14} className="text-gold" />,
  task:    <CheckCircle size={14} className="text-success" />,
  invoice: <CreditCard size={14} className="text-warning" />,
  system:  <Activity size={14} className="text-gold" />,
  content: <Film size={14} className="text-pink-400" />,
  message: <MessageSquare size={14} className="text-blue-400" />,
  deal:    <Briefcase size={14} className="text-emerald-400" />,
};

export default function Notifications() {
  const { profile } = useAuth();
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const supabase = createClient();
  const dropdownRef = useRef<HTMLDivElement>(null);

  const fetchNotifications = useCallback(async () => {
    if (!profile) return;
    const { data } = await supabase
      .from("notifications")
      .select("*")
      .eq("user_id", profile.id)
      .order("created_at", { ascending: false })
      .limit(20);
    if (data) setNotifications(data as Notification[]);
  }, [profile, supabase]);

  // Initial fetch + polling every 30s
  useEffect(() => {
    if (profile) {
      fetchNotifications();
      const interval = setInterval(fetchNotifications, 30000);
      return () => clearInterval(interval);
    }
  }, [profile, fetchNotifications]);

  // Real-time subscription for new notifications
  useEffect(() => {
    if (!profile) return;
    const channel = supabase
      .channel("notifications")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${profile.id}`,
        },
        (payload: any) => {
          setNotifications((prev) => [payload.new as Notification, ...prev]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile]);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener("mousedown", handleClick);
      return () => document.removeEventListener("mousedown", handleClick);
    }
  }, [open]);

  async function markRead(id: string) {
    await supabase.from("notifications").update({ read: true }).eq("id", id);
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n))
    );
  }

  async function markAllRead() {
    if (!profile) return;
    await supabase
      .from("notifications")
      .update({ read: true })
      .eq("user_id", profile.id)
      .eq("read", false);
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  }

  async function clearAll() {
    if (!profile) return;
    await supabase.from("notifications").delete().eq("user_id", profile.id);
    setNotifications([]);
  }

  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Bell trigger */}
      <button
        onClick={() => setOpen(!open)}
        className="relative p-2 rounded-lg text-muted hover:text-foreground hover:bg-surface-light/50 transition-all"
      >
        <Bell size={16} />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-danger text-white text-[9px] font-bold rounded-full flex items-center justify-center animate-bounce">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown panel */}
      {open && (
        <>
          {/* Backdrop for mobile */}
          <div
            className="fixed inset-0 z-40 lg:hidden"
            onClick={() => setOpen(false)}
          />
          <div className="absolute right-0 top-full mt-2 z-50 w-80 bg-surface border border-border/50 rounded-xl shadow-2xl shadow-black/50 fade-in overflow-hidden">
            {/* Header */}
            <div className="px-4 py-2.5 border-b border-border/20 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Bell size={13} className="text-gold" />
                <span className="text-xs font-semibold">Notifications</span>
                {unreadCount > 0 && (
                  <span className="text-[9px] bg-danger/10 text-danger px-1.5 py-0.5 rounded-full font-medium">
                    {unreadCount} new
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1">
                {unreadCount > 0 && (
                  <button
                    onClick={markAllRead}
                    className="text-[9px] text-gold hover:text-gold-light"
                  >
                    Mark all read
                  </button>
                )}
                {notifications.length > 0 && (
                  <button
                    onClick={clearAll}
                    className="text-muted hover:text-danger ml-2"
                  >
                    <Trash2 size={12} />
                  </button>
                )}
              </div>
            </div>

            {/* Notifications list */}
            <div className="max-h-[380px] overflow-y-auto">
              {notifications.length === 0 ? (
                <div className="py-8 text-center">
                  <Bell size={20} className="mx-auto mb-2 text-muted/30" />
                  <p className="text-[10px] text-muted">
                    No notifications yet
                  </p>
                </div>
              ) : (
                notifications.map((n) => (
                  <button
                    key={n.id}
                    onClick={() => {
                      markRead(n.id);
                      if (n.link) window.location.href = n.link;
                    }}
                    className={`w-full text-left px-4 py-2.5 border-b border-border/10 hover:bg-surface-light/30 transition-colors flex items-start gap-2.5 ${
                      !n.read ? "bg-gold/[0.02]" : ""
                    }`}
                  >
                    <div className="mt-0.5 shrink-0">
                      {TYPE_ICONS[n.type] || (
                        <Bell size={14} className="text-muted" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <p
                          className={`text-xs font-medium truncate ${
                            !n.read
                              ? "text-foreground"
                              : "text-muted-light"
                          }`}
                        >
                          {n.title}
                        </p>
                        {!n.read && (
                          <div className="w-1.5 h-1.5 rounded-full bg-gold shrink-0" />
                        )}
                      </div>
                      {n.message && (
                        <p className="text-[10px] text-muted truncate mt-0.5">
                          {n.message}
                        </p>
                      )}
                      <p className="text-[9px] text-muted/60 mt-0.5">
                        {formatRelativeTime(n.created_at)}
                      </p>
                    </div>
                  </button>
                ))
              )}
            </div>

            {/* Footer — View all link */}
            <div className="px-4 py-2 border-t border-border/20">
              <Link
                href="/dashboard"
                onClick={() => setOpen(false)}
                className="block text-center text-[10px] text-gold hover:text-gold-light font-medium transition-colors"
              >
                View all notifications
              </Link>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
