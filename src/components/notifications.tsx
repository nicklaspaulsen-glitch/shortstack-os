"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { createClient } from "@/lib/supabase/client";
import { formatRelativeTime } from "@/lib/utils";
import {
  Bell, Zap, CheckCircle, CreditCard, Activity,
  Film, MessageSquare, Briefcase, Trash2
} from "lucide-react";

interface Notification {
  id: string;
  type: string;
  title: string;
  description: string | null;
  link: string | null;
  is_read: boolean;
  created_at: string;
}

const TYPE_ICONS: Record<string, React.ReactNode> = {
  lead: <Zap size={14} className="text-gold" />,
  task: <CheckCircle size={14} className="text-success" />,
  invoice: <CreditCard size={14} className="text-warning" />,
  system: <Activity size={14} className="text-gold" />,
  content: <Film size={14} className="text-pink-400" />,
  message: <MessageSquare size={14} className="text-blue-400" />,
  deal: <Briefcase size={14} className="text-emerald-400" />,
};

export default function Notifications() {
  const { profile } = useAuth();
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const supabase = createClient();

  useEffect(() => {
    if (profile) {
      fetchNotifications();
      // Poll every 30 seconds
      const interval = setInterval(fetchNotifications, 30000);
      return () => clearInterval(interval);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile]);

  // Real-time subscription
  useEffect(() => {
    if (!profile) return;
    const channel = supabase.channel("notifications")
      .on("postgres_changes", {
        event: "INSERT",
        schema: "public",
        table: "notifications",
        filter: `user_id=eq.${profile.id}`,
      }, (payload) => {
        setNotifications(prev => [payload.new as Notification, ...prev]);
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile]);

  async function fetchNotifications() {
    if (!profile) return;
    const { data } = await supabase
      .from("notifications")
      .select("*")
      .eq("user_id", profile.id)
      .order("created_at", { ascending: false })
      .limit(20);
    setNotifications(data || []);
  }

  async function markRead(id: string) {
    await supabase.from("notifications").update({ is_read: true }).eq("id", id);
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
  }

  async function markAllRead() {
    if (!profile) return;
    await supabase.from("notifications").update({ is_read: true }).eq("user_id", profile.id).eq("is_read", false);
    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
  }

  async function clearAll() {
    if (!profile) return;
    await supabase.from("notifications").delete().eq("user_id", profile.id);
    setNotifications([]);
  }

  const unreadCount = notifications.filter(n => !n.is_read).length;

  return (
    <div className="relative">
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

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-2 z-50 w-80 bg-surface border border-border/50 rounded-xl shadow-2xl shadow-black/50 fade-in overflow-hidden">
            {/* Header */}
            <div className="px-4 py-2.5 border-b border-border/20 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Bell size={13} className="text-gold" />
                <span className="text-xs font-semibold">Notifications</span>
                {unreadCount > 0 && (
                  <span className="text-[9px] bg-danger/10 text-danger px-1.5 py-0.5 rounded-full font-medium">{unreadCount} new</span>
                )}
              </div>
              <div className="flex items-center gap-1">
                {unreadCount > 0 && (
                  <button onClick={markAllRead} className="text-[9px] text-gold hover:text-gold-light">Mark all read</button>
                )}
                {notifications.length > 0 && (
                  <button onClick={clearAll} className="text-muted hover:text-danger ml-2"><Trash2 size={12} /></button>
                )}
              </div>
            </div>

            {/* Notifications list */}
            <div className="max-h-[380px] overflow-y-auto">
              {notifications.length === 0 ? (
                <div className="py-8 text-center">
                  <Bell size={20} className="mx-auto mb-2 text-muted/30" />
                  <p className="text-[10px] text-muted">No notifications yet</p>
                </div>
              ) : (
                notifications.map(n => (
                  <button
                    key={n.id}
                    onClick={() => {
                      markRead(n.id);
                      if (n.link) window.location.href = n.link;
                    }}
                    className={`w-full text-left px-4 py-2.5 border-b border-border/10 hover:bg-surface-light/30 transition-colors flex items-start gap-2.5 ${
                      !n.is_read ? "bg-gold/[0.02]" : ""
                    }`}
                  >
                    <div className="mt-0.5 shrink-0">
                      {TYPE_ICONS[n.type] || <Bell size={14} className="text-muted" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <p className={`text-xs font-medium truncate ${!n.is_read ? "text-foreground" : "text-muted-light"}`}>
                          {n.title}
                        </p>
                        {!n.is_read && <div className="w-1.5 h-1.5 rounded-full bg-gold shrink-0" />}
                      </div>
                      {n.description && (
                        <p className="text-[10px] text-muted truncate mt-0.5">{n.description}</p>
                      )}
                      <p className="text-[9px] text-muted/60 mt-0.5">{formatRelativeTime(n.created_at)}</p>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
