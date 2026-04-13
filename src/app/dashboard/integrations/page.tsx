"use client";

import { Suspense, useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  Link2, Globe, Loader, Check, Unlink, LogIn, Shield, Clock, AlertCircle,
  Calendar, MessageSquare, Mail, Phone, BookOpen, Megaphone, MapPin, ExternalLink, Zap, RefreshCw
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
const XTwitterLogo = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
);
const PinterestLogo = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><path d="M12.017 0C5.396 0 .029 5.367.029 11.987c0 5.079 3.158 9.417 7.618 11.162-.105-.949-.199-2.403.041-3.439.219-.937 1.406-5.957 1.406-5.957s-.359-.72-.359-1.781c0-1.668.967-2.914 2.171-2.914 1.023 0 1.518.769 1.518 1.69 0 1.029-.655 2.568-.994 3.995-.283 1.194.599 2.169 1.777 2.169 2.133 0 3.772-2.249 3.772-5.495 0-2.873-2.064-4.882-5.012-4.882-3.414 0-5.418 2.561-5.418 5.207 0 1.031.397 2.138.893 2.738a.36.36 0 01.083.345l-.333 1.36c-.053.22-.174.267-.402.161-1.499-.698-2.436-2.889-2.436-4.649 0-3.785 2.75-7.262 7.929-7.262 4.163 0 7.398 2.967 7.398 6.931 0 4.136-2.607 7.464-6.227 7.464-1.216 0-2.359-.631-2.75-1.378l-.748 2.853c-.271 1.043-1.002 2.35-1.492 3.146C9.57 23.812 10.763 24 12.017 24c6.624 0 11.99-5.367 11.99-11.988C24.007 5.367 18.641 0 12.017 0z"/></svg>
);
const SnapchatLogo = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><path d="M12.206.793c.99 0 4.347.276 5.93 3.821.529 1.193.403 3.219.299 4.847l-.003.06c-.012.18-.022.345-.03.51.075.045.203.09.401.09.3-.016.659-.12.97-.229.185-.067.37-.132.52-.158.209-.04.403-.06.581-.06.29 0 .558.056.783.17.387.196.577.54.577.944 0 .566-.516.99-1.024 1.205a4.02 4.02 0 01-.495.19c-.298.09-.625.168-.848.228-.117.03-.22.057-.293.08-.203.066-.36.15-.46.28-.12.168-.12.376-.013.573.24.46.595.876.97 1.262.256.27.535.508.82.723.63.48 1.34.84 2.069 1.048.152.044.31.08.472.112.203.04.345.188.36.396.02.324-.208.61-.55.79-.498.258-1.14.412-1.943.468a1.476 1.476 0 00-.138.023c-.1.024-.2.048-.278.1-.138.087-.216.24-.256.553a.49.49 0 01-.088.221c-.218.272-.634.37-1.204.37-.33 0-.71-.04-1.14-.112a7.07 7.07 0 00-1.16-.12c-.234 0-.451.019-.657.057-.513.096-.996.37-1.546.678-.656.367-1.4.783-2.368.783h-.06c-.97 0-1.713-.416-2.37-.783-.548-.308-1.032-.582-1.545-.678a3.66 3.66 0 00-.657-.057c-.41 0-.816.044-1.16.12-.428.072-.81.112-1.14.112-.57 0-.986-.098-1.204-.37a.49.49 0 01-.088-.221c-.04-.313-.118-.466-.256-.553-.078-.052-.178-.076-.278-.1l-.138-.023c-.804-.056-1.445-.21-1.943-.468-.342-.18-.57-.466-.55-.79.016-.208.158-.356.36-.396a5.1 5.1 0 00.472-.112c.728-.208 1.438-.568 2.069-1.048.285-.215.564-.453.82-.723.375-.386.73-.802.97-1.262.108-.197.108-.405-.013-.573-.1-.13-.257-.214-.46-.28a7.483 7.483 0 01-.293-.08c-.223-.06-.55-.138-.848-.228a4.02 4.02 0 01-.495-.19c-.508-.216-1.024-.64-1.024-1.205 0-.404.19-.748.577-.944.225-.114.493-.17.783-.17.178 0 .372.02.58.06.152.026.336.091.52.158.312.11.67.213.972.229.197 0 .325-.045.4-.09a12.68 12.68 0 01-.03-.51l-.003-.06c-.104-1.628-.23-3.654.3-4.847C7.86 1.069 11.216.793 12.206.793z"/></svg>
);
const RedditLogo = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0zm5.01 4.744c.688 0 1.25.561 1.25 1.249a1.25 1.25 0 0 1-2.498.056l-2.597-.547-.8 3.747c1.824.07 3.48.632 4.674 1.488.308-.309.73-.491 1.207-.491.968 0 1.754.786 1.754 1.754 0 .716-.435 1.333-1.01 1.614a3.111 3.111 0 0 1 .042.52c0 2.694-3.13 4.87-7.004 4.87-3.874 0-7.004-2.176-7.004-4.87 0-.183.015-.366.043-.534A1.748 1.748 0 0 1 4.028 12c0-.968.786-1.754 1.754-1.754.463 0 .898.196 1.207.49 1.207-.883 2.878-1.43 4.744-1.487l.885-4.182a.342.342 0 0 1 .14-.197.35.35 0 0 1 .238-.042l2.906.617a1.214 1.214 0 0 1 1.108-.701zM9.25 12C8.561 12 8 12.562 8 13.25c0 .687.561 1.248 1.25 1.248.687 0 1.248-.561 1.248-1.249 0-.688-.561-1.249-1.249-1.249zm5.5 0c-.687 0-1.248.561-1.248 1.25 0 .687.561 1.248 1.249 1.248.688 0 1.249-.561 1.249-1.249 0-.687-.562-1.249-1.25-1.249zm-5.466 3.99a.327.327 0 0 0-.231.094.33.33 0 0 0 0 .463c.842.842 2.484.913 2.961.913.477 0 2.105-.056 2.961-.913a.361.361 0 0 0 .029-.463.33.33 0 0 0-.464 0c-.547.533-1.684.73-2.512.73-.828 0-1.979-.196-2.512-.73a.326.326 0 0 0-.232-.095z"/></svg>
);
const TumblrLogo = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><path d="M14.563 24c-5.093 0-7.031-3.756-7.031-6.411V9.747H5.116V6.648c3.63-1.313 4.512-4.596 4.71-6.469C9.84.051 9.941 0 9.999 0h3.517v6.114h4.801v3.633h-4.82v7.47c.016 1.001.375 2.371 2.207 2.371h.09c.631-.02 1.486-.205 1.936-.419l1.156 3.425c-.436.636-2.4 1.374-4.156 1.404h-.168z"/></svg>
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
    description: "Post content, manage ads, view page insights",
    supportsDM: true,
  },
  {
    id: "instagram",
    name: "Instagram",
    icon: <InstagramLogo />,
    color: "text-[#E4405F]",
    bg: "bg-gradient-to-br from-[#E4405F]/10 to-[#833AB4]/10 border-[#E4405F]/20",
    description: "Publish posts & reels, view analytics, manage DMs",
    supportsDM: true,
  },
  {
    id: "tiktok",
    name: "TikTok",
    icon: <TikTokLogo />,
    color: "text-white",
    bg: "bg-gradient-to-br from-white/5 to-[#FE2C55]/5 border-white/15",
    description: "Upload videos, track views, manage ad campaigns",
    supportsDM: false,
  },
  {
    id: "linkedin",
    name: "LinkedIn",
    icon: <LinkedInLogo />,
    color: "text-[#0A66C2]",
    bg: "bg-gradient-to-br from-[#0A66C2]/10 to-[#0A66C2]/5 border-[#0A66C2]/20",
    description: "Share posts, manage company page, B2B networking",
    supportsDM: true,
  },
  {
    id: "youtube",
    name: "YouTube",
    icon: <YouTubeLogo />,
    color: "text-[#FF0000]",
    bg: "bg-gradient-to-br from-[#FF0000]/10 to-[#FF0000]/5 border-[#FF0000]/20",
    description: "Upload videos, view channel analytics, manage playlists",
    supportsDM: false,
  },
  {
    id: "twitter",
    name: "X / Twitter",
    icon: <XTwitterLogo />,
    color: "text-foreground",
    bg: "bg-gradient-to-br from-white/5 to-white/[0.02] border-white/15",
    description: "Post tweets, track engagement, manage replies",
    supportsDM: true,
  },
  {
    id: "pinterest",
    name: "Pinterest",
    icon: <PinterestLogo />,
    color: "text-[#E60023]",
    bg: "bg-gradient-to-br from-[#E60023]/10 to-[#E60023]/5 border-[#E60023]/20",
    description: "Create pins, manage boards, drive traffic",
    supportsDM: true,
  },
  {
    id: "snapchat",
    name: "Snapchat",
    icon: <SnapchatLogo />,
    color: "text-[#FFFC00]",
    bg: "bg-gradient-to-br from-[#FFFC00]/10 to-[#FFFC00]/5 border-[#FFFC00]/20",
    description: "Manage ads, stories, spotlight content",
    supportsDM: true,
  },
  {
    id: "reddit",
    name: "Reddit",
    icon: <RedditLogo />,
    color: "text-[#FF4500]",
    bg: "bg-gradient-to-br from-[#FF4500]/10 to-[#FF4500]/5 border-[#FF4500]/20",
    description: "Post content, manage communities, track engagement",
    supportsDM: true,
  },
  {
    id: "tumblr",
    name: "Tumblr",
    icon: <TumblrLogo />,
    color: "text-[#36465D]",
    bg: "bg-gradient-to-br from-[#36465D]/10 to-[#36465D]/5 border-[#36465D]/20",
    description: "Publish posts, manage blogs, share multimedia",
    supportsDM: false,
  },
  {
    id: "google_business",
    name: "Google Business",
    icon: <GoogleBusinessLogo />,
    color: "text-[#4285F4]",
    bg: "bg-gradient-to-br from-[#4285F4]/10 to-[#34A853]/10 border-[#4285F4]/20",
    description: "Manage reviews, update business info, local SEO",
    supportsDM: false,
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
  const [connecting, setConnecting] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const supabase = createClient();

  // Show toast on OAuth callback
  useEffect(() => {
    const connected = searchParams.get("connected");
    const error = searchParams.get("error");
    if (connected) {
      toast.success(`${connected} connected successfully via Zernio!`);
      // Sync accounts after successful OAuth callback
      if (clientId) syncZernioAccounts();
    }
    if (error) toast.error(error === "denied" ? "Authorization was denied" : `Connection failed: ${error}`);
  }, [searchParams]);

  useEffect(() => {
    if (profile) fetchClients();
  }, [profile]);

  useEffect(() => {
    if (clientId) {
      fetchAccounts();
      syncZernioAccounts();
    }
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

  // Sync accounts from Zernio to keep local state in sync
  async function syncZernioAccounts() {
    if (!clientId) return;
    setSyncing(true);
    try {
      await fetch(`/api/social/zernio?client_id=${clientId}`);
      // Re-fetch local accounts after sync
      await fetchAccounts();
    } catch {
      // Zernio sync is best-effort; local accounts still show
    } finally {
      setSyncing(false);
    }
  }

  async function connectViaZernio(platformId: string) {
    if (!clientId) {
      toast.error("No client profile found");
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
          callback_url: `${window.location.origin}/dashboard/integrations?connected=${platformId}`,
        }),
      });
      const data = await res.json();
      if (data.oauth_url) {
        window.location.href = data.oauth_url;
      } else if (data.error) {
        toast.error(data.error);
      }
    } catch {
      toast.error("Failed to initiate connection");
    } finally {
      setConnecting(null);
    }
  }

  async function disconnect(account: SocialAccount) {
    try {
      // Disconnect via Zernio API
      await fetch("/api/social/zernio", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          client_id: clientId,
          account_id: account.account_id,
          local_account_id: account.id,
        }),
      });
      // Also disconnect locally via existing endpoint
      await fetch("/api/social/connect", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ account_id: account.id }),
      });
      toast.success(`${account.account_name} disconnected`);
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
          <p className="text-xs text-muted mt-0.5">Connect social accounts via Zernio for unified AI-powered management</p>
        </div>
        <div className="flex items-center gap-2">
          {/* Client selector for admins */}
          {profile?.role !== "client" && clients.length > 0 && (
            <select value={clientId || ""} onChange={e => setClientId(e.target.value)}
              className="input text-xs py-1.5 min-w-[160px]">
              {clients.map(c => <option key={c.id} value={c.id}>{c.business_name}</option>)}
            </select>
          )}
          <button onClick={() => syncZernioAccounts()} disabled={syncing}
            className="flex items-center gap-1.5 text-[10px] bg-surface-light text-muted hover:text-foreground px-2.5 py-1 rounded-md border border-border hover:border-gold/20 transition-all disabled:opacity-50">
            <RefreshCw size={10} className={syncing ? "animate-spin" : ""} />
            <span className="font-medium">Sync</span>
          </button>
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
              const isZernio = account.metadata?.zernio === true;
              const isOAuth = account.metadata?.oauth === true;
              return (
                <div key={account.id} className={`rounded-xl p-4 border ${platform?.bg || "bg-surface-light/50 border-border"} relative overflow-hidden`}>
                  <div className="absolute top-0 right-0 w-20 h-20 bg-white/[0.02] rounded-full -translate-y-1/2 translate-x-1/2" />
                  <div className="relative">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2.5">
                        <span className={platform?.color || "text-muted"}>{platform?.icon || <Globe size={22} />}</span>
                        <div>
                          <p className="text-xs font-semibold">{platform?.name || account.platform}</p>
                          <p className="text-[11px] text-foreground font-medium">{account.account_name}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        {isZernio ? (
                          <div className="flex items-center gap-1 text-[9px] text-[#C9A84C] bg-[#C9A84C]/10 px-1.5 py-0.5 rounded">
                            <Shield size={8} /> Zernio
                          </div>
                        ) : isOAuth ? (
                          <div className="flex items-center gap-1 text-[9px] text-success bg-success/10 px-1.5 py-0.5 rounded">
                            <Shield size={8} /> OAuth
                          </div>
                        ) : (
                          <div className="flex items-center gap-1 text-[9px] text-muted bg-surface-light px-1.5 py-0.5 rounded">
                            <Link2 size={8} /> Linked
                          </div>
                        )}
                        {platform?.supportsDM && (
                          <div className="flex items-center gap-1 text-[9px] text-accent bg-accent/10 px-1.5 py-0.5 rounded">
                            <MessageSquare size={8} /> DM
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center justify-between mt-2">
                      <span className="text-[9px] text-muted flex items-center gap-1">
                        <Clock size={9} /> {new Date(account.created_at).toLocaleDateString()}
                      </span>
                      <div className="flex items-center gap-2">
                        {!isZernio && (
                          <button onClick={() => connectViaZernio(account.platform)}
                            className="text-[10px] text-[#C9A84C] hover:text-[#d4b85c] flex items-center gap-0.5 transition-colors">
                            <LogIn size={10} /> Upgrade to Zernio
                          </button>
                        )}
                        <button onClick={() => disconnect(account)}
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
        <p className="text-[10px] text-muted mb-3">Click to connect via Zernio — unified OAuth for 14+ social platforms with DM support on 7</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {PLATFORMS.filter(p => !connectedIds.includes(p.id)).map(platform => (
            <button
              key={platform.id}
              onClick={() => connectViaZernio(platform.id)}
              disabled={connecting === platform.id}
              className={`text-left rounded-xl p-4 border border-border bg-surface hover:border-gold/20 hover:shadow-card-hover hover:-translate-y-[1px] transition-all group disabled:opacity-60 disabled:pointer-events-none`}
            >
              <div className="flex items-center gap-3 mb-2">
                <div className="w-11 h-11 rounded-xl flex items-center justify-center bg-surface-light border border-border group-hover:border-gold/20 transition-colors">
                  <span className="text-muted group-hover:text-foreground transition-colors">{platform.icon}</span>
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <p className="text-xs font-semibold">{platform.name}</p>
                    {platform.supportsDM && (
                      <span className="text-[8px] text-accent bg-accent/10 px-1 py-0.5 rounded font-medium">DM</span>
                    )}
                  </div>
                  <p className="text-[10px] text-muted">{platform.description}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 mt-1">
                {connecting === platform.id ? (
                  <span className="text-[10px] text-[#C9A84C] font-medium flex items-center gap-1">
                    <Loader size={10} className="animate-spin" /> Connecting...
                  </span>
                ) : (
                  <span className="text-[10px] text-[#C9A84C] font-medium flex items-center gap-1">
                    <LogIn size={10} /> Connect via Zernio
                  </span>
                )}
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* No client warning -- only for clients, not admins */}
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

      {/* Business Integrations */}
      {profile?.role !== "client" && <BusinessIntegrations />}

      {/* Security note */}
      <div className="card border-border bg-surface-light">
        <div className="flex items-start gap-3">
          <Shield size={14} className="text-gold shrink-0 mt-0.5" />
          <p className="text-[10px] text-muted leading-relaxed">
            All social accounts connect through Zernio&apos;s unified OAuth flow. ShortStack never sees your password &mdash;
            you sign in directly with each platform via Zernio&apos;s secure authentication. You can revoke access anytime from here or from your account settings on each platform.
            Business integrations use API keys stored securely in environment variables.
          </p>
        </div>
      </div>

      {/* Powered by Zernio badge */}
      <div className="flex items-center justify-center py-2">
        <div className="flex items-center gap-2 text-[10px] text-muted/60 bg-surface-light/50 border border-border/50 rounded-full px-4 py-1.5">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-[#C9A84C]/60">
            <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/>
          </svg>
          <span>Powered by <span className="text-[#C9A84C]/80 font-medium">Zernio</span> &mdash; Unified Social Media API for 14+ platforms</span>
        </div>
      </div>
    </div>
  );
}

const BUSINESS_INTEGRATIONS = [
  {
    id: "google_ads",
    name: "Google Ads",
    icon: <Megaphone size={16} />,
    color: "text-[#4285F4]",
    bg: "from-[#4285F4]/10 to-[#34A853]/5 border-[#4285F4]/20",
    description: "Campaign management, performance data, bid optimization",
    endpoint: "/api/integrations/google-ads",
    envKeys: ["GOOGLE_ADS_DEVELOPER_TOKEN", "GOOGLE_CLIENT_ID"],
    docsUrl: "https://developers.google.com/google-ads/api/docs/start",
  },
  {
    id: "google_business",
    name: "Google Business",
    icon: <MapPin size={16} />,
    color: "text-[#34A853]",
    bg: "from-[#34A853]/10 to-[#4285F4]/5 border-[#34A853]/20",
    description: "Review management, local posts, business insights",
    endpoint: "/api/integrations/google-business",
    envKeys: ["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET"],
    docsUrl: "https://developers.google.com/my-business",
  },
  {
    id: "calendly",
    name: "Calendly",
    icon: <Calendar size={16} />,
    color: "text-[#006BFF]",
    bg: "from-[#006BFF]/10 to-[#006BFF]/5 border-[#006BFF]/20",
    description: "Scheduling, event types, booking management",
    endpoint: "/api/integrations/calendly",
    envKeys: ["CALENDLY_API_TOKEN"],
    docsUrl: "https://developer.calendly.com",
  },
  {
    id: "whatsapp",
    name: "WhatsApp Business",
    icon: <MessageSquare size={16} />,
    color: "text-[#25D366]",
    bg: "from-[#25D366]/10 to-[#25D366]/5 border-[#25D366]/20",
    description: "Send messages, templates, media to clients",
    endpoint: "/api/integrations/whatsapp",
    envKeys: ["WHATSAPP_ACCESS_TOKEN", "WHATSAPP_PHONE_NUMBER_ID"],
    docsUrl: "https://developers.facebook.com/docs/whatsapp/cloud-api",
  },
  {
    id: "email_marketing",
    name: "Mailchimp / SendGrid",
    icon: <Mail size={16} />,
    color: "text-[#FFE01B]",
    bg: "from-[#FFE01B]/10 to-[#FFE01B]/5 border-[#FFE01B]/20",
    description: "Email lists, campaigns, transactional emails",
    endpoint: "/api/integrations/email-marketing",
    envKeys: ["MAILCHIMP_API_KEY", "SENDGRID_API_KEY"],
    docsUrl: "https://mailchimp.com/developer/",
  },
  {
    id: "twilio",
    name: "Twilio",
    icon: <Phone size={16} />,
    color: "text-[#F22F46]",
    bg: "from-[#F22F46]/10 to-[#F22F46]/5 border-[#F22F46]/20",
    description: "SMS messaging, voice calls, phone numbers",
    endpoint: "/api/integrations/twilio",
    envKeys: ["TWILIO_ACCOUNT_SID", "TWILIO_AUTH_TOKEN"],
    docsUrl: "https://www.twilio.com/docs",
  },
  {
    id: "notion",
    name: "Notion",
    icon: <BookOpen size={16} />,
    color: "text-foreground",
    bg: "from-white/5 to-white/[0.02] border-white/15",
    description: "Sync databases, create pages, manage tasks",
    endpoint: "/api/integrations/notion",
    envKeys: ["NOTION_API_KEY"],
    docsUrl: "https://developers.notion.com",
  },
];

function BusinessIntegrations() {
  const [statuses, setStatuses] = useState<Record<string, "connected" | "not_configured" | "checking">>({});

  useEffect(() => {
    BUSINESS_INTEGRATIONS.forEach(async (integration) => {
      setStatuses(prev => ({ ...prev, [integration.id]: "checking" }));
      try {
        const res = await fetch(`${integration.endpoint}?action=me&client_id=_check`, { method: "GET" });
        const data = await res.json();
        setStatuses(prev => ({
          ...prev,
          [integration.id]: data.connected === false || data.error?.includes("not configured") ? "not_configured" : "connected",
        }));
      } catch {
        setStatuses(prev => ({ ...prev, [integration.id]: "not_configured" }));
      }
    });
  }, []);

  const configured = Object.values(statuses).filter(s => s === "connected").length;

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h2 className="section-header mb-0 flex items-center gap-2">
          <Zap size={14} className="text-gold" /> Business Integrations
        </h2>
        <span className="text-[10px] text-muted">{configured}/{BUSINESS_INTEGRATIONS.length} configured</span>
      </div>
      <p className="text-[10px] text-muted mb-3">Connect business tools via API keys. Configure in your environment variables.</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {BUSINESS_INTEGRATIONS.map(integration => {
          const status = statuses[integration.id] || "checking";
          return (
            <div key={integration.id}
              className={`rounded-xl p-4 border bg-gradient-to-br ${integration.bg} relative overflow-hidden`}>
              <div className="absolute top-0 right-0 w-16 h-16 bg-white/[0.02] rounded-full -translate-y-1/2 translate-x-1/2" />
              <div className="relative">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2.5">
                    <span className={integration.color}>{integration.icon}</span>
                    <div>
                      <p className="text-xs font-semibold">{integration.name}</p>
                      <p className="text-[9px] text-muted">{integration.description}</p>
                    </div>
                  </div>
                </div>
                <div className="flex items-center justify-between mt-2">
                  <div className="flex items-center gap-1">
                    {status === "checking" ? (
                      <span className="text-[9px] text-muted flex items-center gap-1"><Loader size={8} className="animate-spin" /> Checking...</span>
                    ) : status === "connected" ? (
                      <span className="text-[9px] text-success flex items-center gap-1 bg-success/10 px-1.5 py-0.5 rounded"><Check size={8} /> Connected</span>
                    ) : (
                      <span className="text-[9px] text-muted flex items-center gap-1 bg-surface-light px-1.5 py-0.5 rounded"><AlertCircle size={8} /> Not configured</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[8px] text-muted/60">{integration.envKeys.join(", ")}</span>
                    <a href={integration.docsUrl} target="_blank" rel="noopener noreferrer"
                      className="text-[10px] text-muted hover:text-foreground flex items-center gap-0.5">
                      <ExternalLink size={9} /> Docs
                    </a>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
