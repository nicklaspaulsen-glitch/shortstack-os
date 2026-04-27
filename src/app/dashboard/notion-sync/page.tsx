"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { createClient } from "@/lib/supabase/client";
import PageHero from "@/components/ui/page-hero";
import {
  RefreshCw, CheckCircle2, Link2, Clock, ToggleLeft, ToggleRight,
  Loader2, ExternalLink, Unlink, AlertCircle,
} from "lucide-react";
import toast from "react-hot-toast";

// Notion icon (inline)
const NotionIcon = () => (
  <svg width="22" height="22" viewBox="0 0 100 100" fill="currentColor">
    <path d="M6 4.75C6 2.126 8.12 0 10.75 0h78.5C91.875 0 94 2.126 94 4.75v90.5c0 2.625-2.125 4.75-4.75 4.75H10.75C8.12 100 6 97.875 6 95.25V4.75zM20.5 16.25v63.5h59V16.25h-59z"/>
    <rect x="26" y="30" width="48" height="6" rx="3"/>
    <rect x="26" y="44" width="48" height="6" rx="3"/>
    <rect x="26" y="58" width="30" height="6" rx="3"/>
  </svg>
);

interface NotionConnection {
  id: string;
  platform: string;
  account_name: string | null;
  account_id: string | null;
  is_active: boolean;
  metadata: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

export default function NotionSyncPage() {
  const { user } = useAuth();
  const [connection, setConnection] = useState<NotionConnection | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [autoSync, setAutoSync] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const supabase = createClient();

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase
        .from("oauth_connections")
        .select("*")
        .eq("user_id", user.id)
        .eq("platform", "notion")
        .maybeSingle();
      if (data) {
        setConnection(data as NotionConnection);
        setAutoSync(!!(data.metadata as Record<string, unknown> | null)?.auto_sync);
      }
      setLoading(false);
    })();
  }, [user]);

  const handleSyncNow = async () => {
    setSyncing(true);
    try {
      const res = await fetch("/api/integrations/notion/sync", { method: "POST" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Sync failed");
      toast.success(json.message || `Synced ${json.synced} items`);
      // refresh updated_at
      const { data } = await supabase
        .from("oauth_connections")
        .select("*")
        .eq("user_id", user!.id)
        .eq("platform", "notion")
        .maybeSingle();
      if (data) setConnection(data as NotionConnection);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Sync failed");
    } finally {
      setSyncing(false);
    }
  };

  const handleToggleAutoSync = async () => {
    if (!connection) return;
    const next = !autoSync;
    setAutoSync(next);
    await supabase
      .from("oauth_connections")
      .update({ metadata: { ...(connection.metadata ?? {}), auto_sync: next } })
      .eq("id", connection.id);
    toast.success(next ? "Auto-sync enabled" : "Auto-sync disabled");
  };

  const handleDisconnect = async () => {
    if (!connection) return;
    setDisconnecting(true);
    await supabase.from("oauth_connections").delete().eq("id", connection.id);
    setConnection(null);
    setDisconnecting(false);
    toast.success("Notion disconnected");
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-[#C9A84C]" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 p-4 sm:p-6 max-w-3xl mx-auto">
      <PageHero
        title="Notion Sync"
        subtitle="Two-way sync between your CRM, content library, and Notion databases."
        icon={<RefreshCw className="w-6 h-6" />}
        gradient="gold"
      />

      {connection ? (
        /* Connected state */
        <div className="flex flex-col gap-4">
          {/* Status card */}
          <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-5 flex items-start gap-4">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center shrink-0">
              <CheckCircle2 className="w-5 h-5 text-emerald-400" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-white">Connected to Notion</p>
              <p className="text-sm text-white/60 mt-0.5 truncate">
                Workspace:{" "}
                <span className="text-white/80">
                  {connection.account_name || connection.account_id || "Unknown workspace"}
                </span>
              </p>
              <div className="flex items-center gap-1.5 mt-1.5 text-xs text-white/40">
                <Clock className="w-3.5 h-3.5" />
                Last synced:{" "}
                {connection.updated_at
                  ? new Date(connection.updated_at).toLocaleString()
                  : "Never"}
              </div>
            </div>
            <div className="text-white/20">
              <NotionIcon />
            </div>
          </div>

          {/* Actions */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Sync now */}
            <div className="rounded-xl border border-white/8 bg-white/3 p-5 flex flex-col gap-3">
              <div className="flex items-center gap-2">
                <RefreshCw className="w-4 h-4 text-[#C9A84C]" />
                <p className="text-sm font-semibold text-white">Sync Now</p>
              </div>
              <p className="text-xs text-white/50">
                Pull latest changes from all connected Notion databases immediately.
              </p>
              <button
                onClick={handleSyncNow}
                disabled={syncing}
                className="flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-[#C9A84C] hover:bg-[#d4b55d] text-black transition-all disabled:opacity-60"
              >
                {syncing ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <RefreshCw className="w-4 h-4" />
                )}
                {syncing ? "Syncing…" : "Sync Now"}
              </button>
            </div>

            {/* Auto-sync toggle */}
            <div className="rounded-xl border border-white/8 bg-white/3 p-5 flex flex-col gap-3">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-[#C9A84C]" />
                <p className="text-sm font-semibold text-white">Auto-Sync</p>
              </div>
              <p className="text-xs text-white/50">
                Automatically sync with Notion every 15 minutes in the background.
              </p>
              <div className="flex items-center gap-3 mt-1">
                <button onClick={handleToggleAutoSync} className="shrink-0">
                  {autoSync ? (
                    <ToggleRight className="w-9 h-9 text-[#C9A84C]" />
                  ) : (
                    <ToggleLeft className="w-9 h-9 text-white/30" />
                  )}
                </button>
                <span className="text-sm text-white/60">
                  {autoSync ? "Auto-sync on (every 15 min)" : "Auto-sync off"}
                </span>
              </div>
            </div>
          </div>

          {/* What is synced */}
          <div className="rounded-xl border border-white/8 bg-white/3 p-5">
            <p className="text-xs font-semibold uppercase tracking-widest text-white/40 mb-3">
              Synced Resources
            </p>
            <div className="flex flex-col gap-2">
              {[
                "CRM Clients → Notion database",
                "Leads pipeline → Notion board",
                "Content calendar → Notion calendar",
                "Tasks & projects → Notion tasks",
              ].map((item) => (
                <div key={item} className="flex items-center gap-2 text-sm text-white/60">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  {item}
                </div>
              ))}
            </div>
          </div>

          {/* Disconnect */}
          <div className="flex justify-end">
            <button
              onClick={handleDisconnect}
              disabled={disconnecting}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium text-red-400 border border-red-400/20 bg-red-400/5 hover:bg-red-400/10 transition-all disabled:opacity-60"
            >
              {disconnecting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Unlink className="w-4 h-4" />
              )}
              Disconnect Notion
            </button>
          </div>
        </div>
      ) : (
        /* Not connected state */
        <div className="flex flex-col items-center gap-6 py-10">
          <div className="w-20 h-20 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-white/30">
            <NotionIcon />
          </div>
          <div className="text-center">
            <h2 className="text-xl font-bold text-white">Connect Your Notion Workspace</h2>
            <p className="text-white/50 mt-2 max-w-md text-sm">
              Link Notion to automatically sync your CRM, content calendar, tasks, and leads — all in one place.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 w-full max-w-xl">
            {[
              { icon: <RefreshCw className="w-5 h-5" />, label: "Two-way sync", desc: "Changes in either direction stay in sync" },
              { icon: <Link2 className="w-5 h-5" />, label: "Field mapping", desc: "Map ShortStack fields to Notion properties" },
              { icon: <Clock className="w-5 h-5" />, label: "Auto-sync", desc: "Background sync every 15 minutes" },
            ].map((f) => (
              <div key={f.label} className="rounded-xl border border-white/8 bg-white/3 p-4 flex flex-col gap-2">
                <div className="text-[#C9A84C]">{f.icon}</div>
                <p className="text-sm font-semibold text-white">{f.label}</p>
                <p className="text-xs text-white/50">{f.desc}</p>
              </div>
            ))}
          </div>

          <div className="flex flex-col items-center gap-2">
            <button
              type="button"
              aria-disabled
              onClick={() =>
                toast(
                  "Notion OAuth is coming soon — we'll email you when it goes live.",
                  { icon: "🛠️" },
                )
              }
              title="Notion OAuth is coming soon"
              className="flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-semibold bg-white/10 text-white/40 border border-white/10 cursor-not-allowed"
            >
              <NotionIcon />
              Connect Notion Workspace
              <ExternalLink className="w-4 h-4 ml-1 opacity-60" />
            </button>
            <p className="text-xs text-white/30">
              Coming soon — you&apos;ll be able to sync clients, leads, and content.
            </p>
          </div>

          <div className="flex items-start gap-2 text-xs text-amber-400/70 bg-amber-400/5 border border-amber-400/15 rounded-lg px-4 py-3 max-w-md">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            Notion OAuth is coming soon — join the waitlist to be notified when it goes live.
          </div>
        </div>
      )}
    </div>
  );
}
