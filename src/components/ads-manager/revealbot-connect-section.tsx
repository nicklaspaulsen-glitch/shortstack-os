"use client";

/**
 * RevealbotConnectSection — API-key auth panel for Revealbot.
 *
 * Sits inside the Connect tab of /dashboard/ads-manager alongside
 * the ZernioConnectPanel. Revealbot uses a static API key (not OAuth)
 * stored as `access_token` in oauth_connections with platform="revealbot".
 *
 * Endpoints:
 *   POST   /api/ads/revealbot/connect  — validate + save key
 *   DELETE /api/ads/revealbot/connect  — mark is_active=false
 *   GET    /api/ads/revealbot/accounts — probe connection status
 *   GET    /api/ads/revealbot/campaigns — trigger a manual campaign sync
 */

import { useCallback, useEffect, useState } from "react";
import {
  CheckCircle,
  CircleNotch,
  ArrowsClockwise,
  Key,
  LinkBreak,
  WarningCircle,
} from "@phosphor-icons/react";
import toast from "react-hot-toast";

interface RevealbotStatus {
  connected: boolean;
  accountCount: number;
  firstAccountId?: string;
}

export default function RevealbotConnectSection() {
  const [status, setStatus] = useState<RevealbotStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [apiKey, setApiKey] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [saving, setSaving] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [syncing, setSyncing] = useState(false);

  const checkStatus = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/ads/revealbot/accounts");
      if (res.status === 400 || res.status === 401) {
        setStatus({ connected: false, accountCount: 0 });
        return;
      }
      if (!res.ok) {
        setStatus({ connected: false, accountCount: 0 });
        return;
      }
      const data = (await res.json()) as { accounts: Array<{ id: string }> };
      const accounts = data.accounts ?? [];
      setStatus({
        connected: true,
        accountCount: accounts.length,
        firstAccountId: accounts[0]?.id,
      });
    } catch {
      setStatus({ connected: false, accountCount: 0 });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void checkStatus();
  }, [checkStatus]);

  const handleConnect = async () => {
    const key = apiKey.trim();
    if (!key) {
      toast.error("Enter a Revealbot API key");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/ads/revealbot/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ api_key: key }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(
          (data as { error?: string }).error || "Failed to connect",
        );
      }
      toast.success("Revealbot connected! API key validated.");
      setApiKey("");
      await checkStatus();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Connection failed");
    } finally {
      setSaving(false);
    }
  };

  const handleDisconnect = async () => {
    setDisconnecting(true);
    try {
      const res = await fetch("/api/ads/revealbot/connect", {
        method: "DELETE",
      });
      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        throw new Error(data.error || "Disconnect failed");
      }
      toast.success("Revealbot disconnected");
      setStatus({ connected: false, accountCount: 0 });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Disconnect failed");
    } finally {
      setDisconnecting(false);
    }
  };

  const handleSync = async () => {
    setSyncing(true);
    try {
      const res = await fetch("/api/ads/revealbot/campaigns");
      const data = (await res.json()) as {
        synced?: number;
        accounts?: number;
        error?: string;
      };
      if (!res.ok) throw new Error(data.error || "Sync failed");
      toast.success(
        `Synced ${data.synced ?? 0} campaigns across ${data.accounts ?? 0} account${(data.accounts ?? 0) === 1 ? "" : "s"}`,
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Sync failed");
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div
      className="rounded-xl p-5 space-y-4"
      style={{
        background: "rgba(124,92,252,0.05)",
        border: "1px solid rgba(124,92,252,0.18)",
      }}
    >
      {/* Header row */}
      <div className="flex items-center gap-3">
        <div
          className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
          style={{
            background: "rgba(124,92,252,0.14)",
            border: "1px solid rgba(124,92,252,0.28)",
          }}
        >
          <Key size={18} style={{ color: "#7C5CFC" }} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[13px] font-semibold text-text-primary">
              Revealbot
            </span>
            {!loading && (
              status?.connected ? (
                <span className="text-[9.5px] font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-1">
                  <CheckCircle size={9} weight="fill" /> Connected
                </span>
              ) : (
                <span className="text-[9.5px] font-bold uppercase tracking-wider text-text-muted/60">
                  Not connected
                </span>
              )
            )}
          </div>
          <p className="text-[10.5px] text-text-muted mt-0.5">
            Automation rules engine for Meta, Google &amp; TikTok campaigns
          </p>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-text-muted py-1">
          <CircleNotch size={14} className="animate-spin" />
          Checking connection…
        </div>
      ) : status?.connected ? (
        /* ── Connected state ── */
        <div className="space-y-3">
          <div className="text-[10.5px] text-text-muted space-y-0.5">
            {status.firstAccountId && (
              <p>
                Account:{" "}
                <code className="px-1.5 py-0.5 rounded bg-white/[0.05] text-text-primary/80 font-mono text-[10px]">
                  {status.firstAccountId}
                </code>
              </p>
            )}
            {status.accountCount > 0 && (
              <p>
                {status.accountCount} ad account
                {status.accountCount === 1 ? "" : "s"} accessible
              </p>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => void handleSync()}
              disabled={syncing}
              className="text-[11px] font-semibold flex items-center gap-1.5 px-3 py-1.5 rounded-md transition disabled:opacity-50"
              style={{
                background: "rgba(124,92,252,0.14)",
                border: "1px solid rgba(124,92,252,0.28)",
                color: "#7C5CFC",
              }}
            >
              {syncing ? (
                <CircleNotch size={11} className="animate-spin" />
              ) : (
                <ArrowsClockwise size={11} />
              )}
              {syncing ? "Syncing…" : "Sync Campaigns Now"}
            </button>

            <button
              onClick={() => void handleDisconnect()}
              disabled={disconnecting}
              className="text-[11px] font-semibold flex items-center gap-1.5 px-3 py-1.5 rounded-md transition disabled:opacity-50"
              style={{
                background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(255,255,255,0.10)",
                color: "#A8A8B2",
              }}
            >
              {disconnecting ? (
                <CircleNotch size={11} className="animate-spin" />
              ) : (
                <LinkBreak size={11} />
              )}
              Disconnect
            </button>
          </div>

          <p className="text-[10px] text-text-muted/70 leading-relaxed">
            Campaigns sync automatically every night. Use "Sync Campaigns Now"
            to pull the latest data immediately. Manage automation rules from
            the <strong className="text-text-muted font-semibold">Automation</strong>{" "}
            tab.
          </p>
        </div>
      ) : (
        /* ── Disconnected state ── */
        <div className="space-y-3">
          <p className="text-[11px] text-text-muted leading-relaxed">
            Enter your Revealbot API key to sync campaigns and manage
            automation rules. Find your key in{" "}
            <span
              className="font-medium"
              style={{ color: "#7C5CFC" }}
            >
              Revealbot → Settings → API Access
            </span>
            .
          </p>

          <div className="flex gap-2">
            <div className="relative flex-1">
              <input
                type={showKey ? "text" : "password"}
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && void handleConnect()}
                placeholder="rb_live_xxxxxxxx…"
                className="w-full bg-[rgba(13,17,32,0.9)] border border-[rgba(124,92,252,0.25)] rounded-lg px-3 py-2 pr-10 text-sm text-text-primary placeholder:text-text-muted/50 focus:outline-none focus:border-[rgba(124,92,252,0.55)] font-mono"
              />
              <button
                type="button"
                onClick={() => setShowKey((v) => !v)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-text-muted/50 hover:text-text-muted text-[10px]"
              >
                {showKey ? "hide" : "show"}
              </button>
            </div>

            <button
              onClick={() => void handleConnect()}
              disabled={saving || !apiKey.trim()}
              className="text-[11px] font-semibold px-4 py-2 rounded-lg transition disabled:opacity-50 flex items-center gap-1.5"
              style={{
                background: "rgba(124,92,252,0.22)",
                border: "1px solid rgba(124,92,252,0.38)",
                color: "#7C5CFC",
              }}
            >
              {saving && <CircleNotch size={12} className="animate-spin" />}
              {saving ? "Validating…" : "Connect"}
            </button>
          </div>

          <div
            className="rounded-lg px-3 py-2.5 flex items-start gap-2"
            style={{
              background: "rgba(124,92,252,0.06)",
              border: "1px solid rgba(124,92,252,0.12)",
            }}
          >
            <WarningCircle
              size={13}
              className="shrink-0 mt-0.5"
              style={{ color: "#7C5CFC" }}
            />
            <p className="text-[10.5px] text-text-muted leading-relaxed">
              Your API key is validated against the Revealbot API before
              saving. It&apos;s stored encrypted and never exposed to the
              browser after this setup step.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
