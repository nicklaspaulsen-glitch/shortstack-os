"use client";

/**
 * Zernio Connect Panel — drop-in for /dashboard/ads-manager.
 *
 * Lets the user pick one of their clients and connect ad accounts (Meta,
 * Google, TikTok, LinkedIn, Pinterest, X) through Zernio's unified OAuth.
 * Wraps the /api/ads/zernio/* routes added Apr 26.
 *
 * Why this exists alongside the existing direct-OAuth flow: with Zernio,
 * the agency doesn't need to register their own Meta App ID + Google Cloud
 * project + TikTok Business app. One Zernio bearer token covers all 6
 * platforms.
 */

import { useEffect, useState, useCallback } from "react";
import {
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  Loader,
  RefreshCw,
  Sparkles,
} from "lucide-react";
import {
  SiMeta,
  SiGoogleads,
  SiTiktok,
  SiPinterest,
  SiX,
} from "react-icons/si";
import { FaLinkedin } from "react-icons/fa";
import type { IconType } from "react-icons";
import toast from "react-hot-toast";

interface Client {
  id: string;
  business_name: string;
}

interface ZernioConnection {
  platform: "meta" | "google" | "tiktok" | "linkedin" | "pinterest" | "x";
  status: "connected" | "expired" | "error" | "disconnected";
  account_id: string | null;
  account_name: string | null;
  currency?: string | null;
}

const PLATFORMS: Array<{
  key: ZernioConnection["platform"];
  name: string;
  Icon: IconType;
  color: string;
}> = [
  { key: "meta", name: "Meta Ads", Icon: SiMeta, color: "#0866FF" },
  { key: "google", name: "Google Ads", Icon: SiGoogleads, color: "#4285F4" },
  { key: "tiktok", name: "TikTok Ads", Icon: SiTiktok, color: "#FFFFFF" },
  { key: "linkedin", name: "LinkedIn Ads", Icon: FaLinkedin, color: "#0A66C2" },
  { key: "pinterest", name: "Pinterest Ads", Icon: SiPinterest, color: "#E60023" },
  { key: "x", name: "X Ads", Icon: SiX, color: "#FFFFFF" },
];

export default function ZernioConnectPanel() {
  const [clients, setClients] = useState<Client[]>([]);
  const [selectedClientId, setSelectedClientId] = useState<string>("");
  const [connections, setConnections] = useState<ZernioConnection[]>([]);
  const [profileId, setProfileId] = useState<string | null>(null);
  const [loadingClients, setLoadingClients] = useState(true);
  const [loadingConnections, setLoadingConnections] = useState(false);
  const [connectingPlatform, setConnectingPlatform] = useState<string | null>(null);

  // Load the agency's clients on mount.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/clients");
        if (!res.ok) throw new Error("Failed to load clients");
        const data = (await res.json()) as { clients?: Client[] };
        if (cancelled) return;
        const list = (data.clients || []).map((c) => ({
          id: c.id,
          business_name: c.business_name,
        }));
        setClients(list);
        if (list[0]) setSelectedClientId(list[0].id);
      } catch (err) {
        toast.error(`Couldn't load clients: ${(err as Error).message}`);
      } finally {
        if (!cancelled) setLoadingClients(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Load Zernio connections whenever the selected client changes.
  const loadConnections = useCallback(async (clientId: string) => {
    if (!clientId) return;
    setLoadingConnections(true);
    try {
      const res = await fetch(`/api/ads/zernio/connections?client_id=${clientId}`);
      const data = (await res.json()) as {
        profile_id: string | null;
        connections: ZernioConnection[];
        warning?: string;
      };
      setProfileId(data.profile_id);
      setConnections(data.connections || []);
      if (data.warning) toast(data.warning, { icon: "⚠️" });
    } catch (err) {
      toast.error(`Couldn't load connections: ${(err as Error).message}`);
    } finally {
      setLoadingConnections(false);
    }
  }, []);

  useEffect(() => {
    if (selectedClientId) loadConnections(selectedClientId);
  }, [selectedClientId, loadConnections]);

  const handleConnect = async (platform: ZernioConnection["platform"]) => {
    if (!selectedClientId) return;
    setConnectingPlatform(platform);
    try {
      const res = await fetch("/api/ads/zernio/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          client_id: selectedClientId,
          platform,
          return_to: window.location.href,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.url) {
        throw new Error(data.error || "Could not generate connect URL");
      }
      // Open in new tab so the user can complete OAuth without losing state
      window.open(data.url, "_blank", "noopener,noreferrer");
      toast.success("Opening Zernio connection flow…");
    } catch (err) {
      toast.error(`Connect failed: ${(err as Error).message}`);
    } finally {
      setConnectingPlatform(null);
    }
  };

  const selectedClient = clients.find((c) => c.id === selectedClientId);

  return (
    <div className="space-y-5">
      {/* Why-this-exists banner */}
      <div
        className="rounded-xl p-4 flex items-start gap-3"
        style={{
          background:
            "linear-gradient(135deg, rgba(200,168,85,0.06), rgba(200,168,85,0.02))",
          border: "1px solid rgba(200,168,85,0.2)",
        }}
      >
        <div
          className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
          style={{ background: "rgba(200,168,85,0.12)" }}
        >
          <Sparkles size={16} style={{ color: "#c8a855" }} />
        </div>
        <div className="text-[12.5px] leading-relaxed">
          <p className="font-semibold text-white mb-1">
            One bearer token. All six ad platforms.
          </p>
          <p className="text-muted">
            Skip building your own Meta App ID + Google Cloud project + TikTok
            Business app. Zernio handles the OAuth dance for Meta, Google,
            TikTok, LinkedIn, Pinterest, and X — your agency stays one step
            removed from the platform-app approval cycle. The direct-OAuth
            tabs above still work if you prefer to manage your own apps.
          </p>
        </div>
      </div>

      {/* Client picker */}
      <div className="flex items-end gap-3">
        <div className="flex-1">
          <label className="block text-[11px] font-semibold text-muted mb-1.5 uppercase tracking-wider">
            Pick a client
          </label>
          {loadingClients ? (
            <div className="h-10 rounded-lg bg-white/[0.03] animate-pulse" />
          ) : (
            <select
              value={selectedClientId}
              onChange={(e) => setSelectedClientId(e.target.value)}
              className="w-full bg-card border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:border-gold/40"
            >
              {clients.length === 0 && <option value="">No clients yet</option>}
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.business_name}
                </option>
              ))}
            </select>
          )}
        </div>
        <button
          onClick={() => selectedClientId && loadConnections(selectedClientId)}
          disabled={!selectedClientId || loadingConnections}
          className="px-3 py-2 rounded-lg bg-white/[0.03] border border-border text-xs text-muted hover:text-foreground hover:bg-white/[0.06] transition flex items-center gap-1.5 disabled:opacity-50"
        >
          {loadingConnections ? (
            <Loader size={12} className="animate-spin" />
          ) : (
            <RefreshCw size={12} />
          )}
          Refresh
        </button>
      </div>

      {/* Profile info */}
      {profileId && selectedClient && (
        <p className="text-[10.5px] text-muted">
          Connected to Zernio profile{" "}
          <code className="px-1.5 py-0.5 rounded bg-white/[0.04] text-foreground/80 font-mono text-[10px]">
            {profileId.slice(0, 8)}…
          </code>{" "}
          for{" "}
          <span className="text-foreground font-semibold">
            {selectedClient.business_name}
          </span>
          .
        </p>
      )}

      {/* Platform grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {PLATFORMS.map((p) => {
          const conn = connections.find((c) => c.platform === p.key);
          const status = conn?.status || "disconnected";
          const isConnecting = connectingPlatform === p.key;
          return (
            <div
              key={p.key}
              className="rounded-xl p-4 flex items-start gap-3 transition-all"
              style={{
                background: "rgba(255,255,255,0.02)",
                border: "1px solid rgba(255,255,255,0.05)",
              }}
            >
              <div
                className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
                style={{
                  background: `${p.color}14`,
                  border: `1px solid ${p.color}30`,
                }}
              >
                <p.Icon size={18} style={{ color: p.color }} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2 mb-0.5">
                  <span className="text-[13px] font-semibold text-foreground">
                    {p.name}
                  </span>
                  <ConnStatusBadge status={status} />
                </div>
                {conn?.account_name ? (
                  <p className="text-[10.5px] text-muted truncate mb-2">
                    {conn.account_name}
                    {conn.currency ? ` · ${conn.currency}` : ""}
                  </p>
                ) : (
                  <p className="text-[10.5px] text-muted/70 mb-2">
                    Not connected yet
                  </p>
                )}
                <button
                  onClick={() => handleConnect(p.key)}
                  disabled={isConnecting || !selectedClientId}
                  className="w-full text-[11px] font-semibold flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md transition disabled:opacity-50"
                  style={{
                    background:
                      status === "connected"
                        ? "rgba(255,255,255,0.04)"
                        : `${p.color}14`,
                    border:
                      status === "connected"
                        ? "1px solid rgba(255,255,255,0.06)"
                        : `1px solid ${p.color}30`,
                    color:
                      status === "connected" ? "var(--color-foreground)" : p.color,
                  }}
                >
                  {isConnecting ? (
                    <>
                      <Loader size={11} className="animate-spin" /> Opening…
                    </>
                  ) : status === "connected" ? (
                    <>
                      Reconnect <ExternalLink size={10} />
                    </>
                  ) : (
                    <>
                      Connect via Zernio <ExternalLink size={10} />
                    </>
                  )}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer note */}
      <p className="text-[10.5px] text-muted/80">
        After clicking Connect, complete the platform&apos;s OAuth in the new tab.
        Connection state syncs back automatically. You can manage multiple ad
        accounts per client by reconnecting any time.
      </p>
    </div>
  );
}

function ConnStatusBadge({ status }: { status: ZernioConnection["status"] }) {
  if (status === "connected") {
    return (
      <span className="text-[9.5px] font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-1">
        <CheckCircle2 size={9} /> Live
      </span>
    );
  }
  if (status === "expired" || status === "error") {
    return (
      <span className="text-[9.5px] font-bold uppercase tracking-wider text-amber-400 flex items-center gap-1">
        <AlertCircle size={9} /> {status}
      </span>
    );
  }
  return (
    <span className="text-[9.5px] font-bold uppercase tracking-wider text-muted/70">
      Off
    </span>
  );
}
