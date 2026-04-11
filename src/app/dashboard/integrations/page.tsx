"use client";

import { Suspense, useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  Link2, Globe, Loader, Check, Unlink, LogIn, Shield, Clock, AlertCircle
} from "lucide-react";
import toast from "react-hot-toast";

// Real brand logos as inline SVGs
const FacebookLogo = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
);
const InstagramLogo = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/></svg>
);
const TikTokLogo = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1v-3.5a6.37 6.37 0 00-.79-.05A6.34 6.34 0 003.15 15.2a6.34 6.34 0 0010.86 4.48v-7.15a8.16 8.16 0 005.58 2.18v-3.45a4.85 4.85 0 01-3.58-1.59l.02.01h-.01l.01.01z"/></svg>
);
const LinkedInLogo = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>
);
const YouTubeLogo = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><path d="M23.498 6.186a3.016 3.016 0 00-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 00.502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 002.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 002.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg>
);
const GoogleBusinessLogo = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
);

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
    icon: <FacebookLogo />,
    color: "text-[#1877F2]",
    bg: "bg-gradient-to-br from-[#1877F2]/10 to-[#1877F2]/5 border-[#1877F2]/20",
    oauthUrl: "/api/oauth/meta",
    oauthParams: { platform: "facebook" },
    description: "Post content, manage ads, view page insights",
  },
  {
    id: "instagram",
    name: "Instagram",
    icon: <InstagramLogo />,
    color: "text-[#E4405F]",
    bg: "bg-gradient-to-br from-[#E4405F]/10 to-[#833AB4]/10 border-[#E4405F]/20",
    oauthUrl: "/api/oauth/meta",
    oauthParams: { platform: "instagram" },
    description: "Publish posts & reels, view analytics, manage DMs",
  },
  {
    id: "tiktok",
    name: "TikTok",
    icon: <TikTokLogo />,
    color: "text-white",
    bg: "bg-gradient-to-br from-white/5 to-[#FE2C55]/5 border-white/15",
    oauthUrl: "/api/oauth/tiktok",
    description: "Upload videos, track views, manage ad campaigns",
  },
  {
    id: "linkedin",
    name: "LinkedIn",
    icon: <LinkedInLogo />,
    color: "text-[#0A66C2]",
    bg: "bg-gradient-to-br from-[#0A66C2]/10 to-[#0A66C2]/5 border-[#0A66C2]/20",
    oauthUrl: "/api/oauth/linkedin",
    description: "Share posts, manage company page, B2B networking",
  },
  {
    id: "youtube",
    name: "YouTube",
    icon: <YouTubeLogo />,
    color: "text-[#FF0000]",
    bg: "bg-gradient-to-br from-[#FF0000]/10 to-[#FF0000]/5 border-[#FF0000]/20",
    oauthUrl: "/api/oauth/google",
    oauthParams: { platform: "youtube" },
    description: "Upload videos, view channel analytics, manage playlists",
  },
  {
    id: "google_business",
    name: "Google Business",
    icon: <GoogleBusinessLogo />,
    color: "text-[#4285F4]",
    bg: "bg-gradient-to-br from-[#4285F4]/10 to-[#34A853]/10 border-[#4285F4]/20",
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
              {profile?.role !== "client" && manualConnect === platform.id ? (
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
                    <LogIn size={10} /> Sign in with {platform.name}
                  </button>
                  {profile?.role !== "client" && (
                    <button onClick={(e) => { e.stopPropagation(); setManualConnect(platform.id); setManualHandle(""); }}
                      className="text-[10px] text-muted hover:text-white flex items-center gap-1">
                      <Link2 size={10} /> Manual
                    </button>
                  )}
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
