"use client";

import { useEffect, useState } from "react";
import {
  Globe, Camera, MessageCircle, Music, Briefcase, Play, Megaphone,
  Plus, Check, Loader, Link2, Unlink, Hash, Zap
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
  { id: "instagram", name: "Instagram", icon: <Camera size={16} />, color: "text-pink-400", bg: "bg-pink-400/10 border-pink-400/20", urlPrefix: "instagram.com/", placeholder: "@handle" },
  { id: "facebook", name: "Facebook", icon: <MessageCircle size={16} />, color: "text-blue-400", bg: "bg-blue-400/10 border-blue-400/20", urlPrefix: "facebook.com/", placeholder: "Page name or URL" },
  { id: "tiktok", name: "TikTok", icon: <Music size={16} />, color: "text-foreground", bg: "bg-white/10 border-white/20", urlPrefix: "tiktok.com/@", placeholder: "@handle" },
  { id: "linkedin", name: "LinkedIn", icon: <Briefcase size={16} />, color: "text-blue-600", bg: "bg-blue-300/10 border-blue-300/20", urlPrefix: "linkedin.com/company/", placeholder: "Company page URL" },
  { id: "youtube", name: "YouTube", icon: <Play size={16} />, color: "text-red-400", bg: "bg-red-400/10 border-red-400/20", urlPrefix: "youtube.com/@", placeholder: "@channel or URL" },
  { id: "google_ads", name: "Google Ads", icon: <Megaphone size={16} />, color: "text-green-400", bg: "bg-green-400/10 border-green-400/20", urlPrefix: "", placeholder: "Account ID (xxx-xxx-xxxx)" },
  { id: "meta_ads", name: "Meta Ads", icon: <Megaphone size={16} />, color: "text-blue-400", bg: "bg-blue-400/10 border-blue-400/20", urlPrefix: "", placeholder: "Ad Account ID" },
  { id: "tiktok_ads", name: "TikTok Ads", icon: <Megaphone size={16} />, color: "text-cyan-400", bg: "bg-cyan-400/10 border-cyan-400/20", urlPrefix: "", placeholder: "Advertiser ID" },
  { id: "x_twitter", name: "X (Twitter)", icon: <Hash size={16} />, color: "text-foreground", bg: "bg-white/10 border-white/20", urlPrefix: "x.com/", placeholder: "@handle" },
  { id: "website", name: "Website", icon: <Globe size={16} />, color: "text-gold", bg: "bg-gold/10 border-gold/20", urlPrefix: "", placeholder: "https://example.com" },
];

// Platforms that have OAuth ready
const OAUTH_PLATFORMS = ["instagram", "facebook", "meta_ads", "youtube", "google_ads", "tiktok", "linkedin"];

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
  // eslint-disable-next-line react-hooks/exhaustive-deps
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
          profile_url: formData.get("profile_url") || null,
        }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success(`${connectPlatform.name} linked`);
        setShowConnect(false);
        setConnectPlatform(null);
        fetchAccounts();
      } else {
        toast.error("Failed to link");
      }
    } catch {
      toast.error("Connection error");
    }
    setConnecting(false);
  }

  async function startOAuth(platform: typeof PLATFORMS[0]) {
    // Map platform → OAuth start route. Surface a visible toast if the
    // platform reaches this function but has no route wired (e.g. a future
    // maintainer adds it to OAUTH_PLATFORMS without adding a branch here)
    // so the click never silently fails.
    let url: string | null = null;
    if (["instagram", "facebook", "meta_ads"].includes(platform.id)) {
      url = `/api/oauth/meta?client_id=${clientId}&platform=${platform.id}`;
    } else if (["youtube", "google_ads"].includes(platform.id)) {
      url = `/api/oauth/google?client_id=${clientId}&platform=${platform.id}`;
    } else if (platform.id === "tiktok") {
      url = `/api/oauth/tiktok?client_id=${clientId}`;
    } else if (platform.id === "linkedin") {
      url = `/api/oauth/linkedin?client_id=${clientId}`;
    }

    if (url) {
      window.location.href = url;
    } else {
      toast.error(
        `${platform.name} OAuth isn't wired yet — please use manual link above.`,
      );
    }
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

  function hasOAuthToken(account: ConnectedAccount) {
    return !!(account.metadata?.access_token);
  }

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
          <Plus size={11} /> Link Account
        </button>
      </div>

      {/* Connected accounts grid */}
      {loading ? (
        <div className="text-xs text-muted py-4 text-center">Loading...</div>
      ) : accounts.filter(a => a.is_active).length === 0 ? (
        <div className="text-center py-6 border border-dashed border-border/50 rounded-lg">
          <Link2 size={20} className="mx-auto mb-2 text-muted/50" />
          <p className="text-xs text-muted">No accounts linked yet</p>
          <button onClick={() => setShowConnect(true)} className="text-[10px] text-gold mt-1 hover:underline">
            Link first account
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {accounts.filter(a => a.is_active).map(account => {
            const platform = PLATFORMS.find(p => p.id === account.platform);
            const hasApi = hasOAuthToken(account);
            return (
              <div key={account.id} className={`flex items-center gap-2.5 p-2.5 rounded-lg border ${platform?.bg || "bg-surface-light/50 border-border/30"}`}>
                <span className={platform?.color || "text-muted"}>
                  {platform?.icon || <Globe size={16} />}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium truncate">{account.account_name}</p>
                  <div className="flex items-center gap-1.5">
                    <p className="text-[10px] text-muted capitalize">{account.platform.replace(/_/g, " ")}</p>
                    {hasApi ? (
                      <span className="text-[8px] px-1 py-px rounded bg-success/10 text-success font-semibold uppercase tracking-wider">API</span>
                    ) : (
                      <span className="text-[8px] px-1 py-px rounded bg-gold/10 text-gold font-semibold uppercase tracking-wider">Linked</span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  {hasApi ? (
                    <div className="glow-dot bg-success text-success" />
                  ) : (
                    <div className="w-1.5 h-1.5 rounded-full bg-gold" />
                  )}
                  {/* Upgrade to OAuth if available and not yet connected via API */}
                  {!hasApi && OAUTH_PLATFORMS.includes(account.platform) && (
                    <button
                      onClick={() => {
                        const p = PLATFORMS.find(pl => pl.id === account.platform);
                        if (p) startOAuth(p);
                      }}
                      className="p-1 rounded hover:bg-gold/10 text-muted hover:text-gold transition-colors"
                      title="Upgrade to API access"
                    >
                      <Zap size={12} />
                    </button>
                  )}
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
      <Modal isOpen={showConnect} onClose={() => { setShowConnect(false); setConnectPlatform(null); }} title={connectPlatform ? `Link ${connectPlatform.name}` : "Link Account"} size="md">
        {!connectPlatform ? (
          <div className="space-y-2">
            <p className="text-xs text-muted mb-3">
              Choose a platform to link{clientName ? ` for ${clientName}` : ""}
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
                  All platforms linked
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div className={`flex items-center gap-2.5 p-3 rounded-lg border ${connectPlatform.bg}`}>
              <span className={connectPlatform.color}>{connectPlatform.icon}</span>
              <div>
                <span className="text-xs font-bold">{connectPlatform.name}</span>
                <p className="text-[9px] text-muted">Link {clientName ? `${clientName}'s` : "the client's"} {connectPlatform.name} account</p>
              </div>
            </div>

            {/* Manual link form — primary path */}
            <form onSubmit={(e) => { e.preventDefault(); connectAccount(new FormData(e.currentTarget)); }} className="space-y-2">
              <div>
                <label className="block text-[10px] text-muted mb-1 uppercase tracking-wider font-semibold">Account Name / Handle *</label>
                <input name="account_name" className="input w-full" placeholder={connectPlatform.placeholder} required />
              </div>
              {connectPlatform.urlPrefix && (
                <div>
                  <label className="block text-[10px] text-muted mb-1 uppercase tracking-wider font-semibold">Profile URL</label>
                  <div className="flex items-center gap-0">
                    <span className="text-[10px] text-muted bg-surface-light border border-border border-r-0 rounded-l px-2 py-[7px]">
                      {connectPlatform.urlPrefix}
                    </span>
                    <input name="profile_url" className="input w-full rounded-l-none" placeholder="username" />
                  </div>
                </div>
              )}
              {!connectPlatform.urlPrefix && connectPlatform.id === "website" && (
                <div>
                  <label className="block text-[10px] text-muted mb-1 uppercase tracking-wider font-semibold">Website URL</label>
                  <input name="profile_url" className="input w-full" placeholder="https://example.com" />
                </div>
              )}
              {["google_ads", "meta_ads", "tiktok_ads"].includes(connectPlatform.id) && (
                <div>
                  <label className="block text-[10px] text-muted mb-1 uppercase tracking-wider font-semibold">Account / Advertiser ID</label>
                  <input name="account_id" className="input w-full" placeholder={connectPlatform.placeholder} />
                </div>
              )}

              <div className="flex justify-end gap-2 pt-1">
                <button type="button" onClick={() => setConnectPlatform(null)} className="btn-secondary text-xs">Back</button>
                <button type="submit" disabled={connecting} className="btn-primary text-xs flex items-center gap-1.5">
                  {connecting ? <Loader size={12} className="animate-spin" /> : <Link2 size={12} />}
                  {connecting ? "Linking..." : "Link Account"}
                </button>
              </div>
            </form>

            {/* OAuth upgrade option — secondary */}
            {OAUTH_PLATFORMS.includes(connectPlatform.id) && (
              <>
                <div className="flex items-center gap-2 py-1">
                  <div className="flex-1 h-px bg-border" />
                  <span className="text-[9px] text-muted">or connect with API access</span>
                  <div className="flex-1 h-px bg-border" />
                </div>

                <button
                  onClick={() => startOAuth(connectPlatform)}
                  className="w-full py-2.5 bg-surface-light hover:bg-surface-light/80 border border-border rounded-lg text-xs font-medium flex items-center justify-center gap-2 transition-all text-muted hover:text-foreground"
                >
                  <Zap size={13} />
                  Sign in with {["instagram", "facebook", "meta_ads"].includes(connectPlatform.id) ? "Meta" : ["youtube", "google_ads"].includes(connectPlatform.id) ? "Google" : connectPlatform.name}
                  <span className="text-[9px] text-muted ml-1">— enables analytics & posting</span>
                </button>
              </>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
