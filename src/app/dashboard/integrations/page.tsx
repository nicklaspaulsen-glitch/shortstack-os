"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { createClient } from "@/lib/supabase/client";
import Modal from "@/components/ui/modal";
import {
  Link2, Camera, MessageCircle, Music, Briefcase, Play, Megaphone,
  Globe, Unlink, Plus, Loader, Check, Shield,
  Eye, EyeOff, AlertTriangle, Clock
} from "lucide-react";
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
  {
    id: "instagram",
    name: "Instagram",
    icon: <Camera size={22} />,
    color: "text-pink-400",
    bg: "bg-gradient-to-br from-pink-500/10 to-purple-500/10 border-pink-400/20",
    description: "Connect your Instagram business account for content scheduling and analytics",
    fields: ["account_name"],
  },
  {
    id: "facebook",
    name: "Facebook",
    icon: <MessageCircle size={22} />,
    color: "text-blue-400",
    bg: "bg-gradient-to-br from-blue-500/10 to-blue-600/10 border-blue-400/20",
    description: "Connect your Facebook Page for posting, ads, and audience insights",
    fields: ["account_name", "access_token"],
  },
  {
    id: "tiktok",
    name: "TikTok",
    icon: <Music size={22} />,
    color: "text-white",
    bg: "bg-gradient-to-br from-white/5 to-pink-500/5 border-white/15",
    description: "Connect TikTok for video publishing and ad campaigns",
    fields: ["account_name"],
  },
  {
    id: "linkedin",
    name: "LinkedIn",
    icon: <Briefcase size={22} />,
    color: "text-blue-300",
    bg: "bg-gradient-to-br from-blue-400/10 to-blue-300/10 border-blue-300/20",
    description: "Connect your LinkedIn company page for B2B content and lead gen",
    fields: ["account_name"],
  },
  {
    id: "youtube",
    name: "YouTube",
    icon: <Play size={22} />,
    color: "text-red-400",
    bg: "bg-gradient-to-br from-red-500/10 to-red-600/10 border-red-400/20",
    description: "Connect YouTube for video uploads and channel analytics",
    fields: ["account_name"],
  },
  {
    id: "google_ads",
    name: "Google Ads",
    icon: <Megaphone size={22} />,
    color: "text-green-400",
    bg: "bg-gradient-to-br from-green-500/10 to-blue-500/10 border-green-400/20",
    description: "Connect Google Ads account for campaign management and reporting",
    fields: ["account_name", "account_id", "access_token"],
  },
  {
    id: "meta_ads",
    name: "Meta Ads",
    icon: <Megaphone size={22} />,
    color: "text-blue-400",
    bg: "bg-gradient-to-br from-blue-500/10 to-indigo-500/10 border-blue-400/20",
    description: "Connect Meta Business Suite for Facebook & Instagram ad management",
    fields: ["account_name", "account_id", "access_token"],
  },
  {
    id: "tiktok_ads",
    name: "TikTok Ads",
    icon: <Megaphone size={22} />,
    color: "text-cyan-400",
    bg: "bg-gradient-to-br from-cyan-500/10 to-pink-500/10 border-cyan-400/20",
    description: "Connect TikTok Ads Manager for ad campaigns and performance tracking",
    fields: ["account_name", "account_id", "access_token"],
  },
  {
    id: "google_business",
    name: "Google Business",
    icon: <Globe size={22} />,
    color: "text-emerald-400",
    bg: "bg-gradient-to-br from-emerald-500/10 to-green-500/10 border-emerald-400/20",
    description: "Connect Google Business Profile for reviews, local SEO, and map listings",
    fields: ["account_name"],
  },
  {
    id: "website",
    name: "Website",
    icon: <Globe size={22} />,
    color: "text-gold",
    bg: "bg-gradient-to-br from-gold/10 to-amber-500/10 border-gold/20",
    description: "Link your website for analytics tracking and landing pages",
    fields: ["account_name"],
  },
];

export default function IntegrationsPage() {
  const { profile } = useAuth();
  const [accounts, setAccounts] = useState<ConnectedAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [clientId, setClientId] = useState<string | null>(null);
  const [connectModal, setConnectModal] = useState<(typeof PLATFORMS)[0] | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [showToken, setShowToken] = useState(false);
  const supabase = createClient();

  useEffect(() => {
    fetchData();
  }, [profile]);

  async function fetchData() {
    if (!profile) return;

    // Find client ID — admins can manage any, clients only their own
    let cId: string | null = null;
    if (profile.role === "client") {
      const { data: clientData } = await supabase.from("clients").select("id").eq("profile_id", profile.id).single();
      cId = clientData?.id || null;
    } else {
      // For admins, get first client or use impersonated
      const { data: clients } = await supabase.from("clients").select("id").eq("is_active", true).limit(1);
      cId = clients?.[0]?.id || null;
    }

    setClientId(cId);

    if (cId) {
      const res = await fetch(`/api/social/connect?client_id=${cId}`);
      const data = await res.json();
      setAccounts(data.accounts || []);
    }
    setLoading(false);
  }

  async function connectAccount(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!connectModal || !clientId) return;
    setConnecting(true);

    const fd = new FormData(e.currentTarget);
    try {
      const res = await fetch("/api/social/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          client_id: clientId,
          platform: connectModal.id,
          account_name: fd.get("account_name"),
          account_id: fd.get("account_id") || null,
          access_token: fd.get("access_token") || null,
          refresh_token: fd.get("refresh_token") || null,
        }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success(`${connectModal.name} connected!`);
        setConnectModal(null);
        fetchData();
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
        fetchData();
      }
    } catch {
      toast.error("Failed to disconnect");
    }
  }

  const connectedIds = accounts.filter(a => a.is_active).map(a => a.platform);

  if (loading) return (
    <div className="flex items-center justify-center py-20">
      <Loader size={20} className="animate-spin text-gold" />
    </div>
  );

  return (
    <div className="fade-in space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-header mb-0 flex items-center gap-2">
            <Link2 size={18} className="text-gold" /> Integrations
          </h1>
          <p className="text-xs text-muted mt-0.5">Connect your social media accounts and ad platforms</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 text-[10px] bg-success/[0.08] text-success px-2.5 py-1 rounded-md border border-success/15">
            <Check size={10} />
            <span className="font-medium">{connectedIds.length} connected</span>
          </div>
        </div>
      </div>

      {/* Connected accounts */}
      {accounts.filter(a => a.is_active).length > 0 && (
        <div>
          <h2 className="section-header">Connected Accounts</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {accounts.filter(a => a.is_active).map(account => {
              const platform = PLATFORMS.find(p => p.id === account.platform);
              return (
                <div key={account.id} className={`rounded-xl p-4 border ${platform?.bg || "bg-surface-light/50 border-border/30"} relative overflow-hidden`}>
                  <div className="absolute top-0 right-0 w-24 h-24 bg-white/[0.02] rounded-full -translate-y-1/2 translate-x-1/2" />
                  <div className="relative">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2.5">
                        <span className={platform?.color || "text-muted"}>{platform?.icon || <Globe size={22} />}</span>
                        <div>
                          <p className="text-xs font-semibold">{platform?.name || account.platform}</p>
                          <p className="text-[10px] text-muted">@{account.account_name}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <div className="w-2 h-2 rounded-full bg-success shadow-[0_0_6px_rgba(16,185,129,0.5)]" />
                      </div>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-[9px] text-muted flex items-center gap-1">
                        <Clock size={9} />
                        Connected {new Date(account.created_at).toLocaleDateString()}
                      </span>
                      <button
                        onClick={() => disconnectAccount(account.id, account.account_name)}
                        className="text-[10px] text-muted hover:text-danger flex items-center gap-1 transition-colors"
                      >
                        <Unlink size={10} /> Disconnect
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Available platforms */}
      <div>
        <h2 className="section-header">
          {connectedIds.length > 0 ? "Connect More" : "Connect Your Accounts"}
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {PLATFORMS.map(platform => {
            const isConnected = connectedIds.includes(platform.id);
            return (
              <button
                key={platform.id}
                onClick={() => !isConnected && setConnectModal(platform)}
                disabled={isConnected}
                className={`text-left rounded-xl p-4 border transition-all ${
                  isConnected
                    ? `${platform.bg} opacity-60`
                    : `border-border/30 bg-surface hover:border-gold/20 hover:shadow-card-hover hover:-translate-y-[1px]`
                }`}
              >
                <div className="flex items-center gap-3 mb-2">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${isConnected ? platform.bg : "bg-surface-light"} border ${isConnected ? "" : "border-border/30"}`}>
                    <span className={isConnected ? platform.color : "text-muted"}>{platform.icon}</span>
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-1.5">
                      <p className="text-xs font-semibold">{platform.name}</p>
                      {isConnected && <Check size={12} className="text-success" />}
                    </div>
                  </div>
                  {!isConnected && (
                    <Plus size={16} className="text-muted" />
                  )}
                </div>
                <p className="text-[10px] text-muted leading-relaxed">{platform.description}</p>
              </button>
            );
          })}
        </div>
      </div>

      {/* Security note */}
      <div className="card border-border/20 bg-surface-light/20">
        <div className="flex items-start gap-3">
          <Shield size={16} className="text-gold shrink-0 mt-0.5" />
          <div>
            <p className="text-xs font-medium mb-0.5">Secure Connections</p>
            <p className="text-[10px] text-muted leading-relaxed">
              Your credentials are encrypted and stored securely. Access tokens expire after 60 days and are automatically refreshed.
              We never share your data with third parties. You can disconnect any account at any time.
            </p>
          </div>
        </div>
      </div>

      {/* Connect Modal */}
      <Modal isOpen={!!connectModal} onClose={() => { setConnectModal(null); setShowToken(false); }} title={`Connect ${connectModal?.name || ""}`} size="md">
        {connectModal && (
          <form onSubmit={connectAccount} className="space-y-4">
            {/* Platform header */}
            <div className={`flex items-center gap-3 p-3 rounded-xl border ${connectModal.bg}`}>
              <span className={connectModal.color}>{connectModal.icon}</span>
              <div>
                <p className="text-xs font-semibold">{connectModal.name}</p>
                <p className="text-[10px] text-muted">{connectModal.description}</p>
              </div>
            </div>

            {/* Account name — always required */}
            <div>
              <label className="block text-[10px] text-muted mb-1 uppercase tracking-wider font-medium">
                Account Name / Handle <span className="text-danger">*</span>
              </label>
              <input name="account_name" className="input w-full text-xs" placeholder={`@your${connectModal.id}handle`} required />
            </div>

            {/* Account ID — for ads platforms */}
            {connectModal.fields.includes("account_id") && (
              <div>
                <label className="block text-[10px] text-muted mb-1 uppercase tracking-wider font-medium">Account / Advertiser ID</label>
                <input name="account_id" className="input w-full text-xs" placeholder="Platform account or advertiser ID" />
              </div>
            )}

            {/* Access token */}
            {connectModal.fields.includes("access_token") && (
              <div>
                <label className="flex items-center justify-between mb-1">
                  <span className="text-[10px] text-muted uppercase tracking-wider font-medium">Access Token</span>
                  <button type="button" onClick={() => setShowToken(!showToken)} className="text-[10px] text-muted hover:text-white flex items-center gap-0.5">
                    {showToken ? <EyeOff size={10} /> : <Eye size={10} />}
                    {showToken ? "Hide" : "Show"}
                  </button>
                </label>
                <input name="access_token" type={showToken ? "text" : "password"} className="input w-full text-xs" placeholder="OAuth access token" />
              </div>
            )}

            {/* Refresh token */}
            {connectModal.fields.includes("access_token") && (
              <div>
                <label className="block text-[10px] text-muted mb-1 uppercase tracking-wider font-medium">Refresh Token (optional)</label>
                <input name="refresh_token" type={showToken ? "text" : "password"} className="input w-full text-xs" placeholder="OAuth refresh token for auto-renewal" />
              </div>
            )}

            {/* Help text */}
            <div className="bg-surface-light/50 rounded-lg p-3 border border-border/20 flex items-start gap-2">
              <AlertTriangle size={12} className="text-warning shrink-0 mt-0.5" />
              <p className="text-[10px] text-muted leading-relaxed">
                For the best experience, use your platform&apos;s developer tools or business manager to generate access tokens.
                If you&apos;re not sure how, your account manager can help set this up for you.
              </p>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => { setConnectModal(null); setShowToken(false); }} className="btn-secondary text-xs">Cancel</button>
              <button type="submit" disabled={connecting} className="btn-primary text-xs flex items-center gap-1.5">
                {connecting ? <Loader size={12} className="animate-spin" /> : <Link2 size={12} />}
                {connecting ? "Connecting..." : "Connect"}
              </button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
}
