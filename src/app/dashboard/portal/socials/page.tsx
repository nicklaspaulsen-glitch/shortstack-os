"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/lib/auth-context";
import {
  Link2, Check, Unlink, Loader, MessageSquare,
  RefreshCw, Shield, Globe,
} from "lucide-react";
import toast from "react-hot-toast";

interface SocialAccount {
  id: string;
  platform: string;
  account_name: string;
  account_id: string;
  is_active: boolean;
  metadata: Record<string, unknown>;
  created_at: string;
}

// Zernio supports: Facebook, Instagram, TikTok, LinkedIn, YouTube, X/Twitter,
// Pinterest. Google Business / Snapchat / Reddit / Tumblr are not yet wired
// — flag them as comingSoon so the buttons render disabled with a clear
// "Coming soon" toast instead of bouncing through Zernio and 500-ing.
const PLATFORMS = [
  { id: "facebook", name: "Facebook", color: "#1877F2", dm: true, desc: "Pages, posts, ads, and Messenger", comingSoon: false },
  { id: "instagram", name: "Instagram", color: "#E4405F", dm: true, desc: "Posts, reels, stories, and DMs", comingSoon: false },
  { id: "tiktok", name: "TikTok", color: "#ffffff", dm: true, desc: "Videos, analytics, and engagement", comingSoon: false },
  { id: "linkedin", name: "LinkedIn", color: "#0A66C2", dm: true, desc: "Company page, posts, and InMail", comingSoon: false },
  { id: "youtube", name: "YouTube", color: "#FF0000", dm: false, desc: "Videos, shorts, and channel analytics", comingSoon: false },
  { id: "x_twitter", name: "X / Twitter", color: "#000000", dm: true, desc: "Tweets, analytics, and DMs", comingSoon: false },
  { id: "google_business", name: "Google Business", color: "#4285F4", dm: false, desc: "Listings, reviews, and local SEO", comingSoon: true },
  { id: "pinterest", name: "Pinterest", color: "#E60023", dm: false, desc: "Pins, boards, and traffic analytics", comingSoon: false },
];

export default function ClientSocialsPage() {
  const { profile } = useAuth();
  const supabase = createClient();
  const [accounts, setAccounts] = useState<SocialAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState<string | null>(null);
  const [clientId, setClientId] = useState<string | null>(null);

  useEffect(() => {
    init();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function init() {
    if (!profile?.id) {
      setLoading(false);
      return;
    }
    try {
      // Find this user's client record
      const { data: client, error } = await supabase
        .from("clients")
        .select("id")
        .eq("profile_id", profile.id)
        .single();

      if (error && error.code !== "PGRST116") throw error; // PGRST116 = no rows
      if (client) {
        setClientId(client.id);
        await fetchAccounts(client.id);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load account data");
    } finally {
      setLoading(false);
    }
  }

  async function fetchAccounts(cid?: string) {
    const id = cid || clientId;
    if (!id) return;

    try {
      const { data, error } = await supabase
        .from("social_accounts")
        .select("*")
        .eq("client_id", id)
        .order("platform");

      if (error) throw error;
      setAccounts((data || []) as SocialAccount[]);
    } catch {
      toast.error("Failed to load social accounts");
    }
  }

  async function connectPlatform(platformId: string) {
    if (!clientId) {
      toast.error("Client profile not found");
      return;
    }

    // Coming-soon platforms: short-circuit with a friendly toast so the
    // button never silently fails or bounces through a 500 from Zernio.
    const platform = PLATFORMS.find((p) => p.id === platformId);
    if (platform?.comingSoon) {
      toast(`${platform.name} support is coming soon.`, { icon: "🛠️" });
      return;
    }

    setConnecting(platformId);
    try {
      const res = await fetch("/api/social/zernio", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          client_id: clientId,
          platform: platformId,
          callback_url: `${window.location.origin}/dashboard/portal/socials?connected=${platformId}`,
        }),
      });

      const data = await res.json();
      if (data.error) throw new Error(data.error);
      if (!data.auth_url && !data.oauth_url) {
        throw new Error("Couldn't start connection — please try again or contact support.");
      }
      window.location.href = data.auth_url || data.oauth_url;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Connection failed");
    } finally {
      setConnecting(null);
    }
  }

  async function disconnectAccount(accountId: string, platform: string) {
    try {
      await supabase.from("social_accounts").delete().eq("id", accountId);
      toast.success(`${platform} disconnected`);
      await fetchAccounts();
    } catch {
      toast.error("Failed to disconnect");
    }
  }

  async function syncAccounts() {
    if (!clientId) return;
    try {
      toast.loading("Syncing accounts...");
      const res = await fetch(`/api/social/zernio?client_id=${clientId}`);
      const data = await res.json();
      toast.dismiss();
      if (data.error) throw new Error(data.error);
      toast.success(`Synced ${data.synced || 0} accounts`);
      await fetchAccounts();
    } catch (err) {
      toast.dismiss();
      toast.error(err instanceof Error ? err.message : "Sync failed");
    }
  }

  // Check for callback
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("connected")) {
      toast.success(`${params.get("connected")} connected successfully!`);
      window.history.replaceState({}, "", "/dashboard/portal/socials");
      if (clientId) fetchAccounts();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientId]);

  const getAccount = (platformId: string) => accounts.find((a) => a.platform === platformId && a.is_active);

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[60vh]">
        <Loader size={20} className="animate-spin text-muted" />
      </div>
    );
  }

  if (!clientId) {
    return (
      <div className="p-6 flex flex-col items-center justify-center min-h-[60vh] text-center">
        <Link2 size={32} className="text-muted/30 mb-3" />
        <h2 className="text-sm font-semibold mb-1">No Client Profile Found</h2>
        <p className="text-xs text-muted max-w-xs">
          Your account is not linked to a client profile yet. Please complete onboarding or contact your account manager.
        </p>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <Link2 size={20} className="text-gold" />
            Connected Accounts
          </h1>
          <p className="text-xs text-muted mt-1">Connect your social media accounts to enable posting, DMs, and analytics</p>
        </div>
        <button onClick={syncAccounts} className="btn-secondary text-xs px-3 py-1.5 flex items-center gap-1.5">
          <RefreshCw size={12} /> Sync All
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="card flex items-center gap-3 py-3">
          <Check size={14} className="text-success" />
          <div>
            <p className="text-lg font-bold">{accounts.filter((a) => a.is_active).length}</p>
            <p className="text-[9px] text-muted uppercase tracking-wider">Connected</p>
          </div>
        </div>
        <div className="card flex items-center gap-3 py-3">
          <MessageSquare size={14} className="text-gold" />
          <div>
            <p className="text-lg font-bold">{accounts.filter((a) => a.is_active && PLATFORMS.find((p) => p.id === a.platform)?.dm).length}</p>
            <p className="text-[9px] text-muted uppercase tracking-wider">DM Enabled</p>
          </div>
        </div>
        <div className="card flex items-center gap-3 py-3">
          <Globe size={14} className="text-info" />
          <div>
            <p className="text-lg font-bold">{PLATFORMS.length - accounts.filter((a) => a.is_active).length}</p>
            <p className="text-[9px] text-muted uppercase tracking-wider">Available</p>
          </div>
        </div>
      </div>

      {/* Platform Grid */}
      <div className="grid grid-cols-2 gap-3">
        {PLATFORMS.map((platform) => {
          const account = getAccount(platform.id);
          const isConnected = !!account;

          return (
            <div
              key={platform.id}
              className={`card flex items-center gap-4 transition-all ${
                isConnected ? "border-success/20 bg-success/[0.02]" : ""
              }`}
            >
              {/* Platform icon circle */}
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                style={{ background: `${platform.color}15` }}
              >
                <span className="text-sm font-bold" style={{ color: platform.color }}>
                  {platform.name.charAt(0)}
                </span>
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold">{platform.name}</span>
                  {platform.dm && (
                    <span className="text-[7px] px-1.5 py-0.5 bg-gold/10 text-gold rounded-full uppercase font-bold tracking-wider">DM</span>
                  )}
                </div>
                {isConnected ? (
                  <p className="text-[10px] text-success flex items-center gap-1 mt-0.5">
                    <Check size={9} /> {account.account_name || "Connected"}
                  </p>
                ) : (
                  <p className="text-[10px] text-muted mt-0.5">{platform.desc}</p>
                )}
              </div>

              {/* Action */}
              {isConnected ? (
                <button
                  onClick={() => disconnectAccount(account.id, platform.name)}
                  className="text-[10px] px-2.5 py-1.5 rounded-lg text-danger hover:bg-danger/10 flex items-center gap-1 transition-colors"
                >
                  <Unlink size={10} /> Disconnect
                </button>
              ) : platform.comingSoon ? (
                <button
                  onClick={() => connectPlatform(platform.id)}
                  aria-disabled
                  title={`${platform.name} support is coming soon`}
                  className="text-[10px] px-3 py-1.5 rounded-lg border border-border text-muted bg-surface-light/50 hover:bg-surface-light flex items-center gap-1.5 cursor-not-allowed"
                >
                  <Link2 size={10} /> Coming soon
                </button>
              ) : (
                <button
                  onClick={() => connectPlatform(platform.id)}
                  disabled={connecting === platform.id}
                  aria-label={`Connect ${platform.name}`}
                  className="btn-primary text-[10px] px-3 py-1.5 flex items-center gap-1.5"
                >
                  {connecting === platform.id ? (
                    <Loader size={10} className="animate-spin" />
                  ) : (
                    <Link2 size={10} />
                  )}
                  Connect
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* Security note */}
      <div className="card bg-info/5 border-info/15">
        <p className="text-[10px] text-info flex items-center gap-1.5 mb-1">
          <Shield size={11} /> Secure OAuth Connection
        </p>
        <p className="text-[9px] text-muted">
          Your accounts are connected via Zernio OAuth. We never store your passwords.
          You can disconnect any account at any time.
        </p>
      </div>
    </div>
  );
}
