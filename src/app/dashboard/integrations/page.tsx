"use client";

import { Suspense, useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  Link2, Camera, MessageCircle, Music, Briefcase, Play,
  Globe, Loader, Check, Unlink, LogIn, Shield, Clock, AlertCircle
} from "lucide-react";
import toast from "react-hot-toast";

interface SocialAccount {
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
    id: "facebook",
    name: "Facebook",
    icon: <MessageCircle size={22} />,
    color: "text-blue-400",
    bg: "bg-gradient-to-br from-blue-500/10 to-blue-600/10 border-blue-400/20",
    oauthUrl: "/api/oauth/meta",
    oauthParams: { platform: "facebook" },
    description: "Post content, manage ads, view page insights",
  },
  {
    id: "instagram",
    name: "Instagram",
    icon: <Camera size={22} />,
    color: "text-pink-400",
    bg: "bg-gradient-to-br from-pink-500/10 to-purple-500/10 border-pink-400/20",
    oauthUrl: "/api/oauth/meta",
    oauthParams: { platform: "instagram" },
    description: "Publish posts & reels, view analytics, manage DMs",
  },
  {
    id: "tiktok",
    name: "TikTok",
    icon: <Music size={22} />,
    color: "text-white",
    bg: "bg-gradient-to-br from-white/5 to-pink-500/5 border-white/15",
    oauthUrl: "/api/oauth/tiktok",
    description: "Upload videos, track views, manage ad campaigns",
  },
  {
    id: "linkedin",
    name: "LinkedIn",
    icon: <Briefcase size={22} />,
    color: "text-blue-300",
    bg: "bg-gradient-to-br from-blue-400/10 to-blue-300/10 border-blue-300/20",
    oauthUrl: "/api/oauth/linkedin",
    description: "Share posts, manage company page, B2B networking",
  },
  {
    id: "youtube",
    name: "YouTube",
    icon: <Play size={22} />,
    color: "text-red-400",
    bg: "bg-gradient-to-br from-red-500/10 to-red-600/10 border-red-400/20",
    oauthUrl: "/api/oauth/google",
    oauthParams: { platform: "youtube" },
    description: "Upload videos, view channel analytics, manage playlists",
  },
  {
    id: "google_business",
    name: "Google Business",
    icon: <Globe size={22} />,
    color: "text-emerald-400",
    bg: "bg-gradient-to-br from-emerald-500/10 to-green-500/10 border-emerald-400/20",
    oauthUrl: "/api/oauth/google",
    oauthParams: { platform: "google_business" },
    description: "Manage reviews, update business info, local SEO",
  },
];

export default function SocialAccountsPageWrapper() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center py-20"><Loader size={20} className="animate-spin text-gold" /></div>}>
      <SocialAccountsPage />
    </Suspense>
  );
}

function SocialAccountsPage() {
  const { profile } = useAuth();
  const searchParams = useSearchParams();
  const [accounts, setAccounts] = useState<SocialAccount[]>([]);
  const [clientId, setClientId] = useState<string | null>(null);
  const [clients, setClients] = useState<Array<{ id: string; business_name: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [manualConnect, setManualConnect] = useState<string | null>(null);
  const [manualHandle, setManualHandle] = useState("");
  const supabase = createClient();

  // Show toast on OAuth callback
  useEffect(() => {
    const connected = searchParams.get("connected");
    const error = searchParams.get("error");
    if (connected) toast.success(`${connected} connected successfully!`);
    if (error) toast.error(error === "denied" ? "Authorization was denied" : `Connection failed: ${error}`);
  }, [searchParams]);

  useEffect(() => {
    if (profile) fetchClients();
  }, [profile]);

  useEffect(() => {
    if (clientId) fetchAccounts();
  }, [clientId]);

  async function fetchClients() {
    if (profile?.role === "client") {
      const { data } = await supabase.from("clients").select("id, business_name").eq("profile_id", profile.id).single();
      if (data) {
        setClients([data]);
        setClientId(data.id);
      }
    } else {
      const { data } = await supabase.from("clients").select("id, business_name").eq("is_active", true).order("business_name");
      setClients(data || []);
      if (data && data.length > 0) setClientId(data[0].id);
    }
    setLoading(false);
  }

  async function fetchAccounts() {
    if (!clientId) return;
    const res = await fetch(`/api/social/connect?client_id=${clientId}`);
    const data = await res.json();
    setAccounts(data.accounts || []);
  }

  async function connectManual(platformId: string) {
    if (!manualHandle.trim() || !clientId) return;
    try {
      const res = await fetch("/api/social/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ client_id: clientId, platform: platformId, account_name: manualHandle.trim() }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success(`${platformId} connected!`);
        setManualConnect(null);
        setManualHandle("");
        fetchAccounts();
      }
    } catch { toast.error("Failed"); }
  }

  function startOAuth(platform: (typeof PLATFORMS)[0]) {
    if (!clientId) {
      toast.error("No client profile found");
      return;
    }
    const params = new URLSearchParams({ client_id: clientId, ...(platform.oauthParams || {}) });
    window.location.href = `${platform.oauthUrl}?${params.toString()}`;
  }

  async function disconnect(accountId: string, name: string) {
    try {
      await fetch("/api/social/connect", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ account_id: accountId }),
      });
      toast.success(`${name} disconnected`);
      fetchAccounts();
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
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="page-header mb-0 flex items-center gap-2">
            <Link2 size={18} className="text-gold" /> Connected Accounts
          </h1>
          <p className="text-xs text-muted mt-0.5">Connect social accounts for AI-powered management</p>
        </div>
        <div className="flex items-center gap-2">
          {/* Client selector for admins */}
          {profile?.role !== "client" && clients.length > 0 && (
            <select value={clientId || ""} onChange={e => setClientId(e.target.value)}
              className="input text-xs py-1.5 min-w-[160px]">
              {clients.map(c => <option key={c.id} value={c.id}>{c.business_name}</option>)}
            </select>
          )}
          <div className="flex items-center gap-1.5 text-[10px] bg-success/[0.08] text-success px-2.5 py-1 rounded-md border border-success/15">
            <Check size={10} />
            <span className="font-medium">{connectedIds.length} connected</span>
          </div>
        </div>
      </div>

      {/* Connected accounts */}
      {accounts.filter(a => a.is_active).length > 0 && (
        <div>
          <h2 className="section-header">Active Connections</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {accounts.filter(a => a.is_active).map(account => {
              const platform = PLATFORMS.find(p => p.id === account.platform);
              const isOAuth = account.metadata?.oauth === true;
              return (
                <div key={account.id} className={`rounded-xl p-4 border ${platform?.bg || "bg-surface-light/50 border-border/30"} relative overflow-hidden`}>
                  <div className="absolute top-0 right-0 w-20 h-20 bg-white/[0.02] rounded-full -translate-y-1/2 translate-x-1/2" />
                  <div className="relative">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2.5">
                        <span className={platform?.color || "text-muted"}>{platform?.icon || <Globe size={22} />}</span>
                        <div>
                          <p className="text-xs font-semibold">{platform?.name || account.platform}</p>
                          <p className="text-[11px] text-white/80 font-medium">{account.account_name}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        {isOAuth ? (
                          <div className="flex items-center gap-1 text-[9px] text-success bg-success/10 px-1.5 py-0.5 rounded">
                            <Shield size={8} /> Full access
                          </div>
                        ) : (
                          <div className="flex items-center gap-1 text-[9px] text-muted bg-surface-light px-1.5 py-0.5 rounded">
                            <Link2 size={8} /> Linked
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center justify-between mt-2">
                      <span className="text-[9px] text-muted flex items-center gap-1">
                        <Clock size={9} /> {new Date(account.created_at).toLocaleDateString()}
                      </span>
                      <div className="flex items-center gap-2">
                        {platform?.oauthUrl && !isOAuth && (
                          <button onClick={() => startOAuth(platform)}
                            className="text-[10px] text-gold hover:text-gold-light flex items-center gap-0.5 transition-colors">
                            <LogIn size={10} /> Upgrade
                          </button>
                        )}
                        <button onClick={() => disconnect(account.id, account.account_name)}
                          className="text-[10px] text-muted hover:text-danger flex items-center gap-0.5 transition-colors">
                          <Unlink size={10} /> Remove
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Connect platforms */}
      <div>
        <h2 className="section-header">{connectedIds.length > 0 ? "Connect More" : "Connect Your Accounts"}</h2>
        <p className="text-[10px] text-muted mb-3">Click to sign in — you&apos;ll be redirected to the platform to authorize ShortStack</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {PLATFORMS.filter(p => !connectedIds.includes(p.id)).map(platform => (
            <button
              key={platform.id}
              onClick={() => startOAuth(platform)}
              className={`text-left rounded-xl p-4 border border-border/30 bg-surface hover:border-gold/20 hover:shadow-card-hover hover:-translate-y-[1px] transition-all group`}
            >
              <div className="flex items-center gap-3 mb-2">
                <div className="w-11 h-11 rounded-xl flex items-center justify-center bg-surface-light border border-border/30 group-hover:border-gold/20 transition-colors">
                  <span className="text-muted group-hover:text-white transition-colors">{platform.icon}</span>
                </div>
                <div className="flex-1">
                  <p className="text-xs font-semibold">{platform.name}</p>
                  <p className="text-[10px] text-muted">{platform.description}</p>
                </div>
              </div>
              {manualConnect === platform.id ? (
                <div className="mt-2 flex gap-1.5" onClick={e => e.stopPropagation()}>
                  <input value={manualHandle} onChange={e => setManualHandle(e.target.value)}
                    placeholder="@handle or page name" className="input flex-1 text-[10px] py-1"
                    onKeyDown={e => e.key === "Enter" && connectManual(platform.id)} autoFocus />
                  <button onClick={() => connectManual(platform.id)} className="btn-primary text-[9px] py-1 px-2">Save</button>
                  <button onClick={() => { setManualConnect(null); setManualHandle(""); }} className="btn-ghost text-[9px] py-1 px-1.5">X</button>
                </div>
              ) : (
                <div className="flex items-center gap-3 mt-1">
                  <button onClick={() => startOAuth(platform)} className="text-[10px] text-gold font-medium flex items-center gap-1">
                    <LogIn size={10} /> OAuth
                  </button>
                  <button onClick={(e) => { e.stopPropagation(); setManualConnect(platform.id); setManualHandle(""); }}
                    className="text-[10px] text-muted hover:text-white flex items-center gap-1">
                    <Link2 size={10} /> Manual
                  </button>
                </div>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* No client warning — only for clients, not admins */}
      {!clientId && profile?.role === "client" && (
        <div className="card border-warning/15 bg-warning/[0.03]">
          <div className="flex items-center gap-2">
            <AlertCircle size={14} className="text-warning" />
            <p className="text-xs text-muted">Set up your client profile first before connecting accounts.</p>
          </div>
        </div>
      )}
      {!clientId && profile?.role !== "client" && (
        <div className="card border-accent/15 bg-accent/[0.03]">
          <div className="flex items-center gap-2">
            <AlertCircle size={14} className="text-accent" />
            <p className="text-xs text-muted">Create a client first in the Clients page, then select them above to connect their accounts.</p>
          </div>
        </div>
      )}

      {/* Security note */}
      <div className="card border-border/20 bg-surface-light/20">
        <div className="flex items-start gap-3">
          <Shield size={14} className="text-gold shrink-0 mt-0.5" />
          <p className="text-[10px] text-muted leading-relaxed">
            We use official OAuth to connect your accounts. ShortStack never sees your password —
            you sign in directly with the platform. You can revoke access anytime from here or from your account settings on each platform.
          </p>
        </div>
      </div>
    </div>
  );
}
