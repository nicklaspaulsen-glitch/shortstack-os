"use client";

import { useEffect, useState } from "react";
import {
  Globe, Camera, MessageCircle, Music, Briefcase, Play, Megaphone,
  Plus, Check, Loader, Link2, Unlink
} from "lucide-react";
import Modal from "@/components/ui/modal";
import toast from "react-hot-toast";

interface ConnectedAccount {
  id: string;
  platform: string;
  account_name: string;
  account_id: string;
  is_active: boolean;
  created_at: string;
  metadata: Record<string, unknown>;
}

const PLATFORMS = [
  { id: "instagram", name: "Instagram", icon: <Camera size={16} />, color: "text-pink-400", bg: "bg-pink-400/10 border-pink-400/20" },
  { id: "facebook", name: "Facebook", icon: <MessageCircle size={16} />, color: "text-blue-400", bg: "bg-blue-400/10 border-blue-400/20" },
  { id: "tiktok", name: "TikTok", icon: <Music size={16} />, color: "text-white", bg: "bg-white/10 border-white/20" },
  { id: "linkedin", name: "LinkedIn", icon: <Briefcase size={16} />, color: "text-blue-300", bg: "bg-blue-300/10 border-blue-300/20" },
  { id: "youtube", name: "YouTube", icon: <Play size={16} />, color: "text-red-400", bg: "bg-red-400/10 border-red-400/20" },
  { id: "google_ads", name: "Google Ads", icon: <Megaphone size={16} />, color: "text-green-400", bg: "bg-green-400/10 border-green-400/20" },
  { id: "meta_ads", name: "Meta Ads", icon: <Megaphone size={16} />, color: "text-blue-400", bg: "bg-blue-400/10 border-blue-400/20" },
  { id: "tiktok_ads", name: "TikTok Ads", icon: <Megaphone size={16} />, color: "text-cyan-400", bg: "bg-cyan-400/10 border-cyan-400/20" },
  { id: "website", name: "Website", icon: <Globe size={16} />, color: "text-gold", bg: "bg-gold/10 border-gold/20" },
];

interface SocialConnectProps {
  clientId: string;
  clientName?: string;
}

export default function SocialConnect({ clientId, clientName }: SocialConnectProps) {
  const [accounts, setAccounts] = useState<ConnectedAccount[]>([]);
  const [loading, setLoading] = useState(false);
  const [showConnect, setShowConnect] = useState(false);
  const [connectPlatform, setConnectPlatform] = useState<(typeof PLATFORMS)[0] | null>(null);
  const [connecting, setConnecting] = useState(false);

  useEffect(() => {
    fetchAccounts();
  }, [clientId]);

  async function fetchAccounts() {
    setLoading(true);
    try {
      const res = await fetch(`/api/social/connect?client_id=${clientId}`);
      const data = await res.json();
      setAccounts(data.accounts || []);
    } catch {
      // silent
    }
    setLoading(false);
  }

  async function connectAccount(formData: FormData) {
    if (!connectPlatform) return;
    setConnecting(true);
    try {
      const res = await fetch("/api/social/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          client_id: clientId,
          platform: connectPlatform.id,
          account_name: formData.get("account_name"),
          account_id: formData.get("account_id") || null,
          access_token: formData.get("access_token") || null,
          refresh_token: formData.get("refresh_token") || null,
        }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success(`${connectPlatform.name} connected`);
        setShowConnect(false);
        setConnectPlatform(null);
        fetchAccounts();
      } else {
        toast.error("Failed to connect");
      }
    } catch {
      toast.error("Connection error");
    }
    setConnecting(false);
  }

  async function disconnectAccount(accountId: string, name: string) {
    try {
      const res = await fetch("/api/social/connect", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ account_id: accountId }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success(`${name} disconnected`);
        fetchAccounts();
      }
    } catch {
      toast.error("Failed to disconnect");
    }
  }

  const connectedPlatformIds = accounts.filter(a => a.is_active).map(a => a.platform);
  const availablePlatforms = PLATFORMS.filter(p => !connectedPlatformIds.includes(p.id));

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Link2 size={14} className="text-gold" />
          <h3 className="text-sm font-semibold">Connected Accounts</h3>
          <span className="text-[10px] text-muted bg-surface-light px-1.5 py-0.5 rounded">
            {accounts.filter(a => a.is_active).length}
          </span>
        </div>
        <button
          onClick={() => setShowConnect(true)}
          className="btn-secondary text-[10px] py-1 px-2.5 flex items-center gap-1"
        >
          <Plus size={11} /> Connect
        </button>
      </div>

      {/* Connected accounts grid */}
      {loading ? (
        <div className="text-xs text-muted py-4 text-center">Loading...</div>
      ) : accounts.filter(a => a.is_active).length === 0 ? (
        <div className="text-center py-6 border border-dashed border-border/50 rounded-lg">
          <Link2 size={20} className="mx-auto mb-2 text-muted/50" />
          <p className="text-xs text-muted">No accounts connected yet</p>
          <button onClick={() => setShowConnect(true)} className="text-[10px] text-gold mt-1 hover:underline">
            Connect first account
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {accounts.filter(a => a.is_active).map(account => {
            const platform = PLATFORMS.find(p => p.id === account.platform);
            return (
              <div key={account.id} className={`flex items-center gap-2.5 p-2.5 rounded-lg border ${platform?.bg || "bg-surface-light/50 border-border/30"}`}>
                <span className={platform?.color || "text-muted"}>
                  {platform?.icon || <Globe size={16} />}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium truncate">{account.account_name}</p>
                  <p className="text-[10px] text-muted capitalize">{account.platform.replace(/_/g, " ")}</p>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <div className="glow-dot bg-success text-success" />
                  <button
                    onClick={() => disconnectAccount(account.id, account.account_name)}
                    className="p-1 rounded hover:bg-danger/10 text-muted hover:text-danger transition-colors"
                    title="Disconnect"
                  >
                    <Unlink size={12} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Connect Modal */}
      <Modal isOpen={showConnect} onClose={() => { setShowConnect(false); setConnectPlatform(null); }} title={connectPlatform ? `Connect ${connectPlatform.name}` : "Connect Account"} size="md">
        {!connectPlatform ? (
          <div className="space-y-2">
            <p className="text-xs text-muted mb-3">
              Choose a platform to connect{clientName ? ` for ${clientName}` : ""}
            </p>
            <div className="grid grid-cols-3 gap-2">
              {availablePlatforms.map(p => (
                <button
                  key={p.id}
                  onClick={() => setConnectPlatform(p)}
                  className={`flex flex-col items-center gap-2 p-3 rounded-lg border hover:border-gold/30 transition-all ${p.bg}`}
                >
                  <span className={p.color}>{p.icon}</span>
                  <span className="text-[10px] font-medium">{p.name}</span>
                </button>
              ))}
              {availablePlatforms.length === 0 && (
                <div className="col-span-3 py-6 text-center text-xs text-muted">
                  <Check size={16} className="mx-auto mb-1 text-success" />
                  All platforms connected
                </div>
              )}
            </div>
          </div>
        ) : (
          <form onSubmit={(e) => { e.preventDefault(); connectAccount(new FormData(e.currentTarget)); }} className="space-y-3">
            <div className={`flex items-center gap-2.5 p-3 rounded-lg border ${connectPlatform.bg}`}>
              <span className={connectPlatform.color}>{connectPlatform.icon}</span>
              <div>
                <span className="text-xs font-bold">{connectPlatform.name}</span>
                <p className="text-[9px] text-muted">Connect your {connectPlatform.name} account</p>
              </div>
            </div>

            <div>
              <label className="block text-[10px] text-muted mb-1 uppercase tracking-wider font-semibold">Account Name / Handle *</label>
              <input name="account_name" className="input w-full" placeholder={`@your${connectPlatform.name.toLowerCase().replace(/ /g,"")}handle`} required />
            </div>
            <div>
              <label className="block text-[10px] text-muted mb-1 uppercase tracking-wider font-semibold">Profile URL (optional)</label>
              <input name="account_id" className="input w-full" placeholder={`https://${connectPlatform.name.toLowerCase()}.com/yourprofile`} />
            </div>
            <div>
              <label className="block text-[10px] text-muted mb-1 uppercase tracking-wider font-semibold">Access Token (optional)</label>
              <input name="access_token" type="password" className="input w-full" placeholder="For API access — leave blank if unsure" />
            </div>

            <div className="p-2.5 rounded-lg text-[10px] text-muted" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.05)" }}>
              Enter the account handle to track this platform. Access tokens are optional and enable posting/DM features.
            </div>

            <div className="flex justify-end gap-2 pt-1">
              <button type="button" onClick={() => setConnectPlatform(null)} className="btn-secondary text-xs">Back</button>
              <button type="submit" disabled={connecting} className="btn-primary text-xs flex items-center gap-1.5">
                {connecting ? <Loader size={12} className="animate-spin" /> : <Link2 size={12} />}
                {connecting ? "Connecting..." : "Connect Account"}
              </button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
}
