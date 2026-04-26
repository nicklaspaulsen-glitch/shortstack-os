"use client";

import { Suspense, useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  Link2, Globe, Loader, Check, Unlink, LogIn, Shield, Clock, AlertCircle,
  MessageSquare, Mail, Phone, ExternalLink, Zap, RefreshCw,
  X, Key, Settings2, ArrowUpRight, Copy, Bot, Bell, Sparkles, Terminal,
  CreditCard, Megaphone, Wrench, Search, Filter, Plug
} from "lucide-react";
import { CardSkeleton } from "@/components/ui/skeleton";
import Link from "next/link";
import toast from "react-hot-toast";
import {
  CalendlyIcon, WhatsAppIcon, NotionIcon, GoogleAdsIcon, GoogleMapsIcon,
  TikTokIcon, FacebookIcon, GoogleIcon,
} from "@/components/ui/platform-icons";
import PageHero from "@/components/ui/page-hero";
import StatCard from "@/components/ui/stat-card";

// Real brand logos as inline SVGs
const StripeLogo = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
    <path d="M13.479 9.883c-1.626-.604-2.512-1.067-2.512-1.803 0-.622.511-.977 1.423-.977 1.667 0 3.379.642 4.558 1.221l.666-4.111c-.935-.446-2.847-1.177-5.49-1.177-1.87 0-3.425.489-4.536 1.401-1.155.955-1.754 2.334-1.754 4.003 0 3.022 1.847 4.312 4.848 5.403 1.936.688 2.579 1.177 2.579 1.934 0 .733-.629 1.155-1.762 1.155-1.443 0-3.818-.71-5.38-1.622l-.672 4.157c1.335.756 3.801 1.533 6.356 1.533 1.976 0 3.624-.467 4.735-1.355 1.245-.988 1.889-2.445 1.889-4.336 0-3.091-1.889-4.38-4.948-5.426z"/>
  </svg>
);
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

type SocialTier = "available" | "coming_soon";

interface SocialPlatform {
  id: string;
  name: string;
  icon: React.ReactNode;
  color: string;
  bg: string;
  description: string;
  supportsDM: boolean;
  tier: SocialTier;
}

const PLATFORMS: SocialPlatform[] = [
  // ----- Available now via Zernio -----
  {
    id: "facebook",
    name: "Facebook",
    icon: <FacebookLogo />,
    color: "text-[#1877F2]",
    bg: "bg-gradient-to-br from-[#1877F2]/10 to-[#1877F2]/5 border-[#1877F2]/20",
    description: "Post content, manage ads, view page insights",
    supportsDM: true,
    tier: "available",
  },
  {
    id: "instagram",
    name: "Instagram",
    icon: <InstagramLogo />,
    color: "text-[#E4405F]",
    bg: "bg-gradient-to-br from-[#E4405F]/10 to-[#833AB4]/10 border-[#E4405F]/20",
    description: "Publish posts & reels, view analytics, manage DMs",
    supportsDM: true,
    tier: "available",
  },
  {
    id: "tiktok",
    name: "TikTok",
    icon: <TikTokLogo />,
    color: "text-white",
    bg: "bg-gradient-to-br from-white/5 to-[#FE2C55]/5 border-white/15",
    description: "Upload videos, track views, manage ad campaigns",
    supportsDM: false,
    tier: "available",
  },
  {
    id: "linkedin",
    name: "LinkedIn",
    icon: <LinkedInLogo />,
    color: "text-[#0A66C2]",
    bg: "bg-gradient-to-br from-[#0A66C2]/10 to-[#0A66C2]/5 border-[#0A66C2]/20",
    description: "Share posts, manage company page, B2B networking",
    supportsDM: true,
    tier: "available",
  },
  {
    id: "youtube",
    name: "YouTube",
    icon: <YouTubeLogo />,
    color: "text-[#FF0000]",
    bg: "bg-gradient-to-br from-[#FF0000]/10 to-[#FF0000]/5 border-[#FF0000]/20",
    description: "Upload videos, view channel analytics, manage playlists",
    supportsDM: false,
    tier: "available",
  },
  {
    id: "twitter",
    name: "X / Twitter",
    icon: <XTwitterLogo />,
    color: "text-foreground",
    bg: "bg-gradient-to-br from-white/5 to-white/[0.02] border-white/15",
    description: "Post tweets, track engagement, manage replies",
    supportsDM: true,
    tier: "available",
  },
  {
    id: "pinterest",
    name: "Pinterest",
    icon: <PinterestLogo />,
    color: "text-[#E60023]",
    bg: "bg-gradient-to-br from-[#E60023]/10 to-[#E60023]/5 border-[#E60023]/20",
    description: "Create pins, manage boards, drive traffic",
    supportsDM: true,
    tier: "available",
  },
  // ----- Coming soon via Zernio (Zernio doesn't expose posting APIs yet) -----
  {
    id: "snapchat",
    name: "Snapchat",
    icon: <SnapchatLogo />,
    color: "text-[#FFFC00]",
    bg: "bg-gradient-to-br from-[#FFFC00]/10 to-[#FFFC00]/5 border-[#FFFC00]/20",
    description: "Manage ads, stories, spotlight content",
    supportsDM: true,
    tier: "coming_soon",
  },
  {
    id: "reddit",
    name: "Reddit",
    icon: <RedditLogo />,
    color: "text-[#FF4500]",
    bg: "bg-gradient-to-br from-[#FF4500]/10 to-[#FF4500]/5 border-[#FF4500]/20",
    description: "Post content, manage communities, track engagement",
    supportsDM: true,
    tier: "coming_soon",
  },
  {
    id: "tumblr",
    name: "Tumblr",
    icon: <TumblrLogo />,
    color: "text-[#36465D]",
    bg: "bg-gradient-to-br from-[#36465D]/10 to-[#36465D]/5 border-[#36465D]/20",
    description: "Publish posts, manage blogs, share multimedia",
    supportsDM: false,
    tier: "coming_soon",
  },
  {
    id: "google_business_social",
    name: "Google Business",
    icon: <GoogleBusinessLogo />,
    color: "text-[#4285F4]",
    bg: "bg-gradient-to-br from-[#4285F4]/10 to-[#34A853]/10 border-[#4285F4]/20",
    description: "Reviews + local posts (full setup in Productivity below)",
    supportsDM: false,
    tier: "coming_soon",
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
    const connected = searchParams?.get("connected");
    const error = searchParams?.get("error");
    const discord = searchParams?.get("discord");
    const discordGuild = searchParams?.get("guild");
    const discordError = searchParams?.get("discord_error");
    if (discord === "connected") {
      toast.success(discordGuild
        ? `Trinity bot installed in ${discordGuild}!`
        : "Trinity bot installed in your Discord server!");
    }
    if (discordError) toast.error(`Discord install failed: ${discordError}`);
    if (connected) {
      toast.success(`${connected} connected successfully via Zernio!`);
      // Sync accounts after successful OAuth callback
      if (clientId) {
        syncZernioAccounts();
        // Fire-and-forget: AI analyzes client profile and generates content suggestions
        fetch("/api/ai/content-suggestions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ client_id: clientId, platform: connected }),
        }).then(() => {
          toast.success("AI is generating content suggestions based on your profile!");
        }).catch(() => { /* best-effort */ });
      }
    }
    if (error) toast.error(error === "denied" ? "Authorization was denied" : `Connection failed: ${error}`);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  useEffect(() => {
    if (profile) fetchClients();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile]);

  useEffect(() => {
    if (clientId) {
      fetchAccounts();
      syncZernioAccounts();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientId]);

  async function fetchClients() {
    try {
      setLoading(true);
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
    } catch (err) {
      console.error("[IntegrationsPage] fetch error:", err);
    } finally {
      setLoading(false);
    }
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
    // Pre-flight: surface visible feedback for every early-return path so the
    // button never silently fails. Previously: missing clientId, missing
    // oauth_url, or a non-2xx without an error string all swallowed the click.
    if (!clientId) {
      toast.error(
        clients.length === 0
          ? "Create a client first, then come back to connect their accounts."
          : "Pick a client from the dropdown above, then click Connect again."
      );
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
      let data: { oauth_url?: string; error?: string } = {};
      try {
        data = await res.json();
      } catch {
        // Non-JSON body (e.g. 502 HTML) — fall through to the generic
        // error toast below so the user still gets feedback.
      }
      if (data.oauth_url) {
        window.location.href = data.oauth_url;
        return;
      }
      if (data.error) {
        toast.error(data.error);
        return;
      }
      // Server returned without an oauth_url AND without an error string —
      // treat as misconfigured / not-yet-shipped Zernio integration so the
      // button never looks dead.
      toast.error(
        res.ok
          ? `${platformId} connection isn't available yet — Zernio hasn't returned an OAuth URL for this platform.`
          : `Connection failed (${res.status}) — please try again or contact support.`
      );
    } catch (err) {
      console.warn("[IntegrationsPage] connectViaZernio failed:", err);
      toast.error("Failed to initiate connection — please try again");
    } finally {
      setConnecting(null);
    }
  }

  async function disconnect(account: SocialAccount) {
    // Optimistically remove the tile so the user gets instant feedback;
    // we re-sync with the server below and restore on failure.
    const prev = accounts;
    setAccounts(a => a.filter(x => x.id !== account.id));
    try {
      // Disconnect via Zernio API
      const zRes = await fetch("/api/social/zernio", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          client_id: clientId,
          account_id: account.account_id,
          local_account_id: account.id,
        }),
      });
      // Also disconnect locally via existing endpoint (hard-deletes the row).
      const cRes = await fetch("/api/social/connect", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          account_id: account.id,
          client_id: clientId,
          zernio_account_id: account.account_id,
        }),
      });
      if (!zRes.ok && !cRes.ok) {
        // Both failed — restore UI and surface the error.
        setAccounts(prev);
        toast.error("Failed to disconnect");
        return;
      }
      toast.success(`${account.account_name} disconnected`);
      // Await the refetch so the UI stays in sync; previously this was
      // fire-and-forget and the user could see a stale tile flash back.
      await fetchAccounts();
    } catch {
      setAccounts(prev);
      toast.error("Failed to disconnect");
    }
  }

  const connectedIds = accounts.filter(a => a.is_active).map(a => a.platform);

  return (
    <div className="fade-in space-y-5">
      <PageHero
        icon={<Link2 size={28} />}
        title="Connected Accounts"
        subtitle="Connect Meta, TikTok, LinkedIn, and more. One-click OAuth, always in sync."
        gradient="green"
        actions={
          <>
            {profile?.role !== "client" && clients.length > 0 && (
              <select value={clientId || ""} onChange={e => setClientId(e.target.value)}
                className="rounded-lg border border-white/20 bg-white/10 px-3 py-1.5 text-xs text-white min-w-[160px]">
                {clients.map(c => <option key={c.id} value={c.id} className="bg-slate-800">{c.business_name}</option>)}
              </select>
            )}
            <button onClick={() => syncZernioAccounts()} disabled={syncing}
              className="flex items-center gap-1.5 text-[10px] bg-white/10 border border-white/20 text-white px-2.5 py-1 rounded-md hover:bg-white/20 transition-all disabled:opacity-50">
              <RefreshCw size={10} className={syncing ? "animate-spin" : ""} />
              <span className="font-medium">Sync</span>
            </button>
            <div className="flex items-center gap-1.5 text-[10px] bg-white/15 border border-white/25 text-white px-2.5 py-1 rounded-md">
              <Check size={10} />
              <span className="font-medium">{connectedIds.length} connected</span>
            </div>
          </>
        }
      />

      {/* Loading skeleton — keeps PageHero visible */}
      {loading && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {Array.from({ length: 6 }).map((_, i) => <CardSkeleton key={i} />)}
        </div>
      )}

      {/* Connected accounts */}
      {!loading && accounts.filter(a => a.is_active).length > 0 && (
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
                          <div className="flex items-center gap-1 text-[9px] text-gold bg-gold/10 px-1.5 py-0.5 rounded">
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

      {/* Trinity Discord Bot (public) */}
      <TrinityDiscordInstallCard />

      {/* Social Channels — split into "Available now" and "Coming soon via Zernio" */}
      {!loading && (() => {
        const availableNow = PLATFORMS.filter(p => p.tier === "available" && !connectedIds.includes(p.id));
        const comingSoonSocial = PLATFORMS.filter(p => p.tier === "coming_soon");
        return (
          <div className="space-y-5">
            {availableNow.length > 0 && (
              <div>
                <h2 className="section-header flex items-center gap-2">
                  <Globe size={14} className="text-gold" /> Social Channels
                  <span className="text-[10px] font-normal text-muted ml-1">Available now</span>
                </h2>
                <p className="text-[10px] text-muted mb-3">
                  Click to connect via Zernio — unified OAuth, DM-enabled platforms tagged.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {availableNow.map(platform => (
                    <button
                      key={platform.id}
                      onClick={() => connectViaZernio(platform.id)}
                      disabled={connecting === platform.id}
                      className="text-left rounded-xl p-4 border border-border bg-surface hover:border-gold/20 hover:shadow-card-hover hover:-translate-y-[1px] transition-all group disabled:opacity-60 disabled:pointer-events-none"
                    >
                      <div className="flex items-center gap-3 mb-2">
                        <div className="w-11 h-11 rounded-xl flex items-center justify-center bg-surface-light border border-border group-hover:border-gold/20 transition-colors">
                          <span className="text-muted group-hover:text-foreground transition-colors">{platform.icon}</span>
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <p className="text-xs font-semibold">{platform.name}</p>
                            {platform.supportsDM && (
                              <span className="text-[8px] text-gold bg-gold/10 px-1 py-0.5 rounded font-medium">DM</span>
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
            )}

            {comingSoonSocial.length > 0 && (
              <div>
                <h2 className="section-header flex items-center gap-2">
                  <Clock size={14} className="text-muted" /> Coming soon via Zernio
                  <span className="text-[10px] font-normal text-muted ml-1">
                    Posting support pending — connect later
                  </span>
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {comingSoonSocial.map(platform => (
                    <div
                      key={platform.id}
                      className="rounded-xl p-4 border border-dashed border-border/50 bg-surface/40 opacity-70 cursor-not-allowed"
                      title="Coming soon — Zernio doesn't yet expose posting APIs for this platform"
                    >
                      <div className="flex items-center gap-3 mb-2">
                        <div className="w-11 h-11 rounded-xl flex items-center justify-center bg-surface-light/50 border border-border/40">
                          <span className="text-muted">{platform.icon}</span>
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <p className="text-xs font-semibold text-muted">{platform.name}</p>
                            <span className="text-[8px] text-muted bg-surface-light px-1 py-0.5 rounded font-medium">SOON</span>
                          </div>
                          <p className="text-[10px] text-muted/70">{platform.description}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 mt-1">
                        <span className="text-[10px] text-muted/70 font-medium flex items-center gap-1">
                          <Clock size={10} /> Pending Zernio support
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        );
      })()}

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
        <div className="card border-gold/15 bg-gold/[0.03]">
          <div className="flex items-center gap-2">
            <AlertCircle size={14} className="text-gold" />
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
            All social accounts connect through Zernio&apos;s unified OAuth flow. Trinity never sees your password &mdash;
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

interface TrinityIntegrationRow {
  id: string;
  guild_id: string;
  guild_name: string | null;
  icon_hash: string | null;
  installed_at: string;
  notifications_enabled: boolean;
  notify_channel_id: string | null;
}

function TrinityDiscordInstallCard() {
  const [integrations, setIntegrations] = useState<TrinityIntegrationRow[]>([]);
  const [installing, setInstalling] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    fetch("/api/integrations/discord/settings")
      .then(r => r.ok ? r.json() : { integrations: [] })
      .then(d => setIntegrations(d.integrations || []))
      .catch(() => setIntegrations([]))
      .finally(() => setLoaded(true));
  }, []);

  async function startInstall() {
    setInstalling(true);
    try {
      const res = await fetch("/api/integrations/discord/install-url");
      const data = await res.json();
      if (data.install_url) {
        window.location.href = data.install_url;
      } else {
        toast.error(data.error || "Discord bot not configured");
      }
    } catch {
      toast.error("Failed to start install");
    } finally {
      setInstalling(false);
    }
  }

  const hasAny = integrations.length > 0;

  return (
    <div>
      <h2 className="section-header flex items-center gap-2">
        <Bot size={14} className="text-[#5865F2]" /> Trinity Discord Bot
      </h2>
      <div className="card p-5 bg-gradient-to-br from-[#5865F2]/10 via-[#5865F2]/5 to-transparent border-[#5865F2]/20">
        <div className="flex flex-col md:flex-row items-start gap-4">
          <div className="w-12 h-12 rounded-xl bg-[#5865F2]/20 flex items-center justify-center shrink-0">
            <Bot size={24} className="text-[#5865F2]" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold mb-1">Install Trinity in your own Discord</p>
            <p className="text-[11px] text-muted leading-relaxed mb-3">
              Get real-time pings for new clients, leads, and payments; run slash commands like
              <code className="mx-1 font-mono">/trinity-status</code> and
              <code className="mx-1 font-mono">/trinity-lead</code> from any channel; and let your team
              tag @Trinity to ask data-backed questions.
            </p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-4">
              {[
                { icon: Bell, label: "Real-time pings" },
                { icon: Terminal, label: "Slash commands" },
                { icon: Sparkles, label: "AI weekly digest" },
                { icon: MessageSquare, label: "@Trinity Q&A" },
              ].map((f, i) => (
                <div key={i} className="flex items-center gap-1.5 text-[10px] text-muted bg-surface/40 border border-border/50 rounded-md px-2 py-1.5">
                  <f.icon size={11} className="text-[#5865F2]" />
                  <span>{f.label}</span>
                </div>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={startInstall}
                disabled={installing}
                className="inline-flex items-center gap-2 text-xs bg-[#5865F2] text-white px-4 py-2 rounded-lg font-medium hover:bg-[#4752C4] disabled:opacity-60"
              >
                {installing ? <Loader size={12} className="animate-spin" /> : <LogIn size={12} />}
                Add Trinity to Discord
              </button>
              <Link
                href="/dashboard/discord"
                className="inline-flex items-center gap-1.5 text-[11px] text-muted hover:text-foreground"
              >
                <Settings2 size={11} /> Manage & configure channels
              </Link>
            </div>
          </div>
        </div>

        {loaded && hasAny && (
          <div className="mt-4 pt-4 border-t border-border/30">
            <p className="text-[10px] text-muted font-semibold uppercase mb-2">Installed in {integrations.length} server{integrations.length === 1 ? "" : "s"}</p>
            <div className="flex flex-wrap gap-2">
              {integrations.map(int => (
                <div key={int.id} className="flex items-center gap-2 bg-surface-light border border-border/60 rounded-md px-2.5 py-1.5 text-[11px]">
                  {int.icon_hash ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={`https://cdn.discordapp.com/icons/${int.guild_id}/${int.icon_hash}.png?size=32`}
                      alt=""
                      className="w-4 h-4 rounded"
                    />
                  ) : (
                    <Bot size={11} className="text-[#5865F2]" />
                  )}
                  <span className="font-medium">{int.guild_name || int.guild_id}</span>
                  {int.notifications_enabled && int.notify_channel_id ? (
                    <span className="text-[9px] text-success bg-success/10 px-1.5 py-0.5 rounded">Active</span>
                  ) : (
                    <span className="text-[9px] text-warning bg-warning/10 px-1.5 py-0.5 rounded">Needs channel</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

const VERCEL_ENV_URL = "https://vercel.com/growth-9598s-projects/shortstack-os/settings/environment-variables";

type IntegrationGroup =
  | "payments"
  | "communications"
  | "marketing_ads"
  | "productivity"
  | "lead_data";

type BusinessIntegration = {
  id: string;
  name: string;
  icon: React.ReactNode;
  color: string;
  bg: string;
  description: string;
  endpoint: string;
  envKeys: string[];
  docsUrl: string;
  instructions: string;
  /** OAuth path (hits /api/oauth/...) when client_id creds are already in env */
  oauthPath?: string;
  /** Which group/category this integration belongs to */
  group: IntegrationGroup;
  /** When true, the card is shown but disabled with a "Coming soon" badge */
  comingSoon?: boolean;
  /** Optional "NEW" badge for newly-added integrations */
  isNew?: boolean;
};

const INTEGRATION_GROUPS: Array<{
  id: IntegrationGroup;
  label: string;
  description: string;
  icon: React.ReactNode;
  accent: string;
}> = [
  {
    id: "payments",
    label: "Payments",
    description: "Accept money — your subscriptions and your client invoices",
    icon: <CreditCard size={14} />,
    accent: "text-[#635BFF]",
  },
  {
    id: "communications",
    label: "Communications",
    description: "Reach leads and clients across email, SMS, voice, and chat",
    icon: <MessageSquare size={14} />,
    accent: "text-[#25D366]",
  },
  {
    id: "marketing_ads",
    label: "Marketing & Ads",
    description: "Run paid campaigns across the major ad networks",
    icon: <Megaphone size={14} />,
    accent: "text-[#4285F4]",
  },
  {
    id: "productivity",
    label: "Productivity & Workspace",
    description: "Calendar, Drive, scheduling, docs, and local SEO surfaces",
    icon: <Wrench size={14} />,
    accent: "text-[#34A853]",
  },
  {
    id: "lead_data",
    label: "Lead Gen & Data",
    description: "Scrapers, enrichment, and prospecting infrastructure",
    icon: <Search size={14} />,
    accent: "text-[#FF9900]",
  },
];

const BUSINESS_INTEGRATIONS: BusinessIntegration[] = [
  // ----- Payments -----
  {
    id: "stripe",
    name: "Stripe (Platform)",
    icon: <StripeLogo />,
    color: "text-[#635BFF]",
    bg: "from-[#635BFF]/10 to-[#635BFF]/5 border-[#635BFF]/20",
    description: "Billing for ShortStack subscriptions",
    endpoint: "/api/billing/checkout",
    envKeys: ["STRIPE_SECRET_KEY", "STRIPE_WEBHOOK_SECRET"],
    docsUrl: "https://stripe.com/docs/api",
    instructions: "Platform billing: users pay Trinity for their ShortStack subscription (Starter/Growth/Pro/Business/Unlimited). Set STRIPE_SECRET_KEY + STRIPE_WEBHOOK_SECRET in Vercel env vars. The /api/billing/webhook endpoint listens for checkout.session.completed, customer.subscription.updated, invoice.payment_failed.",
    group: "payments",
  },
  {
    id: "stripe_connect",
    name: "Stripe Connect",
    icon: <StripeLogo />,
    color: "text-[#635BFF]",
    bg: "from-[#635BFF]/10 to-[#635BFF]/5 border-[#635BFF]/20",
    description: "Agency-to-client payouts — money goes to your bank",
    endpoint: "/api/integrations/stripe-connect/status",
    envKeys: ["STRIPE_SECRET_KEY"],
    docsUrl: "https://stripe.com/docs/connect",
    instructions: "Onboard your agency's connected account at /api/integrations/stripe-connect/onboard — clients pay YOU via /api/clients/[id]/invoices or /api/clients/[id]/payment-links, money flows to your Stripe balance (minus ShortStack's platform fee).",
    oauthPath: "/api/integrations/stripe-connect/onboard",
    group: "payments",
  },

  // ----- Communications -----
  {
    id: "email_marketing",
    name: "Resend",
    icon: <Mail size={16} />,
    color: "text-white",
    bg: "from-white/10 to-white/5 border-white/20",
    description: "Transactional email + audiences",
    endpoint: "/api/integrations/email-marketing",
    envKeys: ["SMTP_PASS"],
    docsUrl: "https://resend.com/docs",
    instructions: "Resend SMTP is wired via SMTP_HOST/USER/PASS/FROM. If you want API-backed features (audiences, contact lists), SMTP_PASS doubles as the API key — or set RESEND_API_KEY separately.",
    group: "communications",
  },
  {
    id: "twilio",
    name: "Twilio",
    icon: <Phone size={16} />,
    color: "text-[#F22F46]",
    bg: "from-[#F22F46]/10 to-[#F22F46]/5 border-[#F22F46]/20",
    description: "SMS, voice, WhatsApp number provisioning",
    endpoint: "/api/integrations/twilio",
    envKeys: ["TWILIO_ACCOUNT_SID", "TWILIO_AUTH_TOKEN"],
    docsUrl: "https://www.twilio.com/docs",
    instructions: "Grab your Account SID and Auth Token from https://console.twilio.com → add as TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN. Also set TWILIO_PHONE_NUMBER for outbound.",
    group: "communications",
  },
  {
    id: "whatsapp",
    name: "WhatsApp Business",
    icon: <WhatsAppIcon size={20} />,
    color: "text-[#25D366]",
    bg: "from-[#25D366]/10 to-[#25D366]/5 border-[#25D366]/20",
    description: "Chat with leads and clients",
    endpoint: "/api/integrations/whatsapp",
    envKeys: ["WHATSAPP_ACCESS_TOKEN", "WHATSAPP_PHONE_NUMBER_ID"],
    docsUrl: "https://developers.facebook.com/docs/whatsapp/cloud-api",
    instructions: "Set up WhatsApp Business in Meta for Developers → get WHATSAPP_ACCESS_TOKEN and WHATSAPP_PHONE_NUMBER_ID → paste both into Vercel env vars.",
    oauthPath: "/api/oauth/meta",
    group: "communications",
  },

  // ----- Marketing & Ads -----
  {
    id: "google_ads",
    name: "Google Ads",
    icon: <GoogleAdsIcon size={20} />,
    color: "text-[#4285F4]",
    bg: "from-[#4285F4]/10 to-[#34A853]/5 border-[#4285F4]/20",
    description: "Campaign management, performance data, bid optimization",
    endpoint: "/api/integrations/google-ads",
    envKeys: ["GOOGLE_ADS_DEVELOPER_TOKEN", "GOOGLE_CLIENT_ID"],
    docsUrl: "https://developers.google.com/google-ads/api/docs/start",
    instructions: "Get a developer token at https://ads.google.com/aw/apicenter → paste into Vercel env vars as GOOGLE_ADS_DEVELOPER_TOKEN. You also need GOOGLE_CLIENT_ID + GOOGLE_CLIENT_SECRET from Google Cloud Console.",
    oauthPath: "/api/oauth/google-ads",
    group: "marketing_ads",
  },
  {
    id: "meta_ads",
    name: "Meta Ads (via Nango)",
    icon: <FacebookIcon size={20} />,
    color: "text-[#1877F2]",
    bg: "from-[#1877F2]/10 to-[#1877F2]/5 border-[#1877F2]/20",
    description: "Facebook + Instagram ad campaigns",
    endpoint: "/api/integrations/meta-ads",
    envKeys: ["NANGO_SECRET_KEY", "NANGO_META_ADS_INTEGRATION_ID"],
    docsUrl: "https://docs.nango.dev/integrations/all/facebook",
    instructions: "Meta Ads will land via Nango — pending integration approval. Once shipped, agencies will OAuth their Meta business account and Trinity can pull spend, ROAS, and creative metrics.",
    group: "marketing_ads",
    comingSoon: true,
  },
  {
    id: "tiktok_ads",
    name: "TikTok Ads",
    icon: <TikTokIcon size={20} />,
    color: "text-white",
    bg: "from-white/5 to-[#FE2C55]/5 border-white/15",
    description: "TikTok ad campaigns and analytics",
    endpoint: "/api/integrations/tiktok-ads",
    envKeys: ["TIKTOK_ADS_APP_ID", "TIKTOK_ADS_SECRET"],
    docsUrl: "https://business-api.tiktok.com",
    instructions: "Pending TikTok Marketing API approval. Once granted, Trinity will OAuth into ad accounts and pull spend, conversions, and creative metrics alongside Google + Meta.",
    group: "marketing_ads",
    comingSoon: true,
  },

  // ----- Productivity & Workspace -----
  {
    id: "google_workspace",
    name: "Google Workspace",
    icon: <GoogleIcon size={20} />,
    color: "text-[#4285F4]",
    bg: "from-[#4285F4]/10 to-[#EA4335]/5 border-[#4285F4]/20",
    description: "Calendar, Drive, Gmail — via Nango google-zanb",
    endpoint: "/api/integrations/google-workspace",
    envKeys: ["NANGO_SECRET_KEY"],
    docsUrl: "https://docs.nango.dev/integrations/all/google",
    instructions: "Connects via Nango's google-zanb integration. The agency-level OAuth grants read/write to Calendar, Drive, and Gmail. Set NANGO_SECRET_KEY in Vercel env vars and use /api/integrations/google-workspace to initiate the OAuth handshake.",
    oauthPath: "/api/integrations/google-workspace/connect",
    group: "productivity",
  },
  {
    id: "google_business",
    name: "Google Business",
    icon: <GoogleMapsIcon size={20} />,
    color: "text-[#34A853]",
    bg: "from-[#34A853]/10 to-[#4285F4]/5 border-[#34A853]/20",
    description: "Reviews, local posts, business insights",
    endpoint: "/api/integrations/google-business",
    envKeys: ["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET"],
    docsUrl: "https://developers.google.com/my-business",
    instructions: "Enable the Business Profile API in Google Cloud Console → create OAuth 2.0 credentials → add GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET to Vercel env vars.",
    oauthPath: "/api/oauth/google",
    group: "productivity",
  },
  {
    id: "calendly",
    name: "Calendly",
    icon: <CalendlyIcon size={20} />,
    color: "text-[#006BFF]",
    bg: "from-[#006BFF]/10 to-[#006BFF]/5 border-[#006BFF]/20",
    description: "Scheduling, event types, booking management",
    endpoint: "/api/integrations/calendly",
    envKeys: ["CALENDLY_API_TOKEN"],
    docsUrl: "https://developer.calendly.com",
    instructions: "Get your personal access token at https://calendly.com/integrations/api_webhooks → add as CALENDLY_API_TOKEN in Vercel env vars.",
    group: "productivity",
  },
  {
    id: "notion",
    name: "Notion",
    icon: <NotionIcon size={20} />,
    color: "text-foreground",
    bg: "from-white/5 to-white/[0.02] border-white/15",
    description: "Sync databases, create pages, manage tasks",
    endpoint: "/api/integrations/notion",
    envKeys: ["NOTION_API_KEY"],
    docsUrl: "https://developers.notion.com",
    instructions: "Create an internal integration at https://notion.so/my-integrations → copy the Internal Integration Secret → add as NOTION_API_KEY. Share the databases you want accessible with the integration.",
    group: "productivity",
  },

  // ----- Lead Gen & Data -----
  {
    id: "apify",
    name: "Apify",
    icon: <Search size={16} />,
    color: "text-[#FF9900]",
    bg: "from-[#FF9900]/10 to-[#FF9900]/5 border-[#FF9900]/20",
    description: "Web scrapers, lead enrichment, contact discovery",
    endpoint: "/api/integrations/apify",
    envKeys: ["APIFY_API_TOKEN"],
    docsUrl: "https://docs.apify.com",
    instructions: "Create an account at https://console.apify.com → Settings → Integrations → copy your API token → add as APIFY_API_TOKEN in Vercel env vars. Trinity can then trigger ready-made actors for Google Maps, LinkedIn, Yellow Pages, and more.",
    group: "lead_data",
    isNew: true,
  },
];

type HealthStatus = "connected" | "not_configured" | "error" | "checking";

interface HealthResult {
  id: string;
  status: HealthStatus;
  detail?: string;
  missing?: string[];
}

type StatusFilter = "all" | "connected" | "not_connected" | "coming_soon";

/**
 * Platform admin = Trinity-internal staff (founder/admin) who own the env-var
 * setup workflow. Agency owners and team_members are shown a customer-facing
 * flow (OAuth or "contact your admin") instead of the dev-style paste-the-key UI.
 */
function isPlatformAdminRole(role: string | null | undefined): boolean {
  return role === "admin" || role === "founder";
}

function BusinessIntegrations() {
  const { profile } = useAuth();
  const isPlatformAdmin = isPlatformAdminRole(profile?.role);
  const [statuses, setStatuses] = useState<Record<string, HealthResult>>({});
  const [activeModal, setActiveModal] = useState<BusinessIntegration | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<StatusFilter>("all");

  async function loadHealth() {
    setRefreshing(true);
    const initial: Record<string, HealthResult> = {};
    BUSINESS_INTEGRATIONS.forEach(i => { initial[i.id] = { id: i.id, status: "checking" }; });
    setStatuses(initial);
    try {
      const res = await fetch("/api/integrations/health");
      const data = await res.json();
      const next: Record<string, HealthResult> = {};
      (data.results || []).forEach((r: HealthResult) => { next[r.id] = r; });
      // Backfill any integration whose endpoint isn't registered yet
      // (e.g. brand-new + coming-soon entries) so the card shows
      // "Not configured" instead of staying stuck on "checking".
      BUSINESS_INTEGRATIONS.forEach(i => {
        if (!next[i.id]) next[i.id] = { id: i.id, status: "not_configured" };
      });
      setStatuses(next);
    } catch {
      const fallback: Record<string, HealthResult> = {};
      BUSINESS_INTEGRATIONS.forEach(i => { fallback[i.id] = { id: i.id, status: "not_configured" }; });
      setStatuses(fallback);
    } finally {
      setRefreshing(false);
    }
  }

  useEffect(() => { loadHealth(); }, []);

  // Filter helpers
  function matchesFilter(i: BusinessIntegration): boolean {
    const s = statuses[i.id]?.status;
    if (filter === "all") return true;
    if (filter === "connected") return s === "connected" && !i.comingSoon;
    if (filter === "coming_soon") return !!i.comingSoon;
    if (filter === "not_connected") return !i.comingSoon && s !== "connected";
    return true;
  }

  // Stats
  const totalAvailable = BUSINESS_INTEGRATIONS.filter(i => !i.comingSoon).length;
  const connectedCount = BUSINESS_INTEGRATIONS.filter(i =>
    !i.comingSoon && statuses[i.id]?.status === "connected"
  ).length;
  const comingSoonCount = BUSINESS_INTEGRATIONS.filter(i => i.comingSoon).length;
  const errorCount = BUSINESS_INTEGRATIONS.filter(i =>
    !i.comingSoon && statuses[i.id]?.status === "error"
  ).length;

  const connectedIntegrations = BUSINESS_INTEGRATIONS.filter(i =>
    !i.comingSoon && statuses[i.id]?.status === "connected"
  );

  const filteredByGroup = (groupId: IntegrationGroup) =>
    BUSINESS_INTEGRATIONS.filter(i => i.group === groupId && matchesFilter(i));

  const filterOptions: Array<{ id: StatusFilter; label: string; count: number }> = [
    { id: "all", label: "All", count: BUSINESS_INTEGRATIONS.length },
    { id: "connected", label: "Connected", count: connectedCount },
    { id: "not_connected", label: "Not connected", count: totalAvailable - connectedCount },
    { id: "coming_soon", label: "Coming soon", count: comingSoonCount },
  ];

  return (
    <div className="space-y-5">
      {/* Section header */}
      <div className="flex items-center justify-between">
        <h2 className="section-header mb-0 flex items-center gap-2">
          <Zap size={14} className="text-gold" /> Business Integrations
        </h2>
        <button
          onClick={loadHealth}
          disabled={refreshing}
          className="flex items-center gap-1 text-[10px] text-muted hover:text-foreground transition-colors disabled:opacity-50"
          title="Re-check all integrations"
        >
          <RefreshCw size={10} className={refreshing ? "animate-spin" : ""} />
          Re-check
        </button>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard
          label="Connected"
          value={connectedCount}
          icon={<Check size={14} />}
          changeType={connectedCount > 0 ? "positive" : "neutral"}
        />
        <StatCard
          label="Available"
          value={totalAvailable}
          icon={<Plug size={14} />}
        />
        <StatCard
          label="Needs attention"
          value={errorCount}
          icon={<AlertCircle size={14} />}
          changeType={errorCount > 0 ? "negative" : "neutral"}
        />
        <StatCard
          label="Coming soon"
          value={comingSoonCount}
          icon={<Clock size={14} />}
        />
      </div>

      {/* Filter toggle */}
      <div className="flex items-center gap-2 flex-wrap">
        <Filter size={12} className="text-muted" />
        <span className="text-[10px] text-muted uppercase tracking-wider font-medium">Filter</span>
        {filterOptions.map(opt => (
          <button
            key={opt.id}
            onClick={() => setFilter(opt.id)}
            className={`text-[10px] px-2.5 py-1 rounded-full border transition-all ${
              filter === opt.id
                ? "bg-gold/15 border-gold/40 text-[#C9A84C] font-semibold"
                : "bg-surface-light border-border/60 text-muted hover:text-foreground hover:border-border"
            }`}
          >
            {opt.label}
            <span className="ml-1.5 text-[9px] text-muted/70">{opt.count}</span>
          </button>
        ))}
      </div>

      {/* Connected (top — at-a-glance summary, only when "all" is active) */}
      {filter === "all" && connectedIntegrations.length > 0 && (
        <div>
          <h3 className="section-header flex items-center gap-2">
            <Check size={13} className="text-success" /> Connected
            <span className="text-[10px] font-normal text-muted ml-1">
              {connectedIntegrations.length} live
            </span>
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {connectedIntegrations.map(integration => (
              <IntegrationCard
                key={`connected-${integration.id}`}
                integration={integration}
                health={statuses[integration.id]}
                onClick={() => setActiveModal(integration)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Grouped sections */}
      {INTEGRATION_GROUPS.map(group => {
        const items = filteredByGroup(group.id);
        if (items.length === 0) return null;
        return (
          <div key={group.id}>
            <h3 className="section-header flex items-center gap-2">
              <span className={group.accent}>{group.icon}</span>
              {group.label}
              <span className="text-[10px] font-normal text-muted ml-1">{group.description}</span>
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {items.map(integration => (
                <IntegrationCard
                  key={integration.id}
                  integration={integration}
                  health={statuses[integration.id]}
                  onClick={() => !integration.comingSoon && setActiveModal(integration)}
                />
              ))}
            </div>
          </div>
        );
      })}

      {activeModal && (
        <IntegrationConnectModal
          integration={activeModal}
          currentStatus={statuses[activeModal.id]}
          isPlatformAdmin={isPlatformAdmin}
          onClose={() => setActiveModal(null)}
          onStatusChange={(result) => setStatuses(prev => ({ ...prev, [activeModal.id]: result }))}
        />
      )}
    </div>
  );
}

interface IntegrationCardProps {
  integration: BusinessIntegration;
  health: HealthResult | undefined;
  onClick: () => void;
}

function IntegrationCard({ integration, health, onClick }: IntegrationCardProps) {
  const status: HealthStatus = integration.comingSoon
    ? "not_configured"
    : (health?.status || "checking");
  const isConnected = status === "connected" && !integration.comingSoon;
  const isError = status === "error" && !integration.comingSoon;

  // Visual treatment for coming-soon: muted, dashed border, no hover lift.
  const baseClasses = integration.comingSoon
    ? "rounded-xl p-4 border border-dashed border-border/40 bg-surface/30 opacity-60 cursor-not-allowed flex flex-col gap-2.5 relative overflow-hidden"
    : `rounded-xl p-4 border bg-gradient-to-br ${integration.bg} relative overflow-hidden flex flex-col gap-2.5 hover:shadow-card-hover hover:-translate-y-[1px] transition-all`;

  return (
    <div className={baseClasses}>
      <div className="absolute top-0 right-0 w-16 h-16 bg-white/[0.02] rounded-full -translate-y-1/2 translate-x-1/2" />

      {/* Top-right status badge — easier to scan than bottom placement */}
      <div className="absolute top-2.5 right-2.5 z-[1]">
        {integration.comingSoon ? (
          <span className="text-[9px] text-muted bg-surface-light/80 border border-border/40 px-1.5 py-0.5 rounded-full flex items-center gap-1">
            <Clock size={8} /> Coming soon
          </span>
        ) : status === "checking" ? (
          <span className="text-[9px] text-muted bg-surface-light/80 px-1.5 py-0.5 rounded-full flex items-center gap-1">
            <Loader size={8} className="animate-spin" />
          </span>
        ) : isConnected ? (
          <span className="text-[9px] text-success bg-success/15 border border-success/30 px-1.5 py-0.5 rounded-full flex items-center gap-1" title={health?.detail}>
            <Check size={8} /> Connected
          </span>
        ) : isError ? (
          <span className="text-[9px] text-warning bg-warning/15 border border-warning/30 px-1.5 py-0.5 rounded-full flex items-center gap-1" title={health?.detail}>
            <AlertCircle size={8} /> Unreachable
          </span>
        ) : (
          <span className="text-[9px] text-muted bg-surface-light/80 border border-border/40 px-1.5 py-0.5 rounded-full flex items-center gap-1">
            <AlertCircle size={8} /> Not configured
          </span>
        )}
      </div>

      <div className="relative pr-20">
        <div className="flex items-center gap-2.5 mb-1">
          <span className={integration.color}>{integration.icon}</span>
          <div className="flex items-center gap-1.5 min-w-0">
            <p className="text-xs font-semibold truncate">{integration.name}</p>
            {integration.isNew && (
              <span className="text-[8px] text-gold bg-gold/10 border border-gold/30 px-1 py-0.5 rounded font-bold uppercase tracking-wide shrink-0">
                New
              </span>
            )}
          </div>
        </div>
        <p className="text-[10px] text-muted">{integration.description}</p>
      </div>

      <div className="relative flex items-center gap-2 pt-1">
        {integration.comingSoon ? (
          <span className="flex-1 text-center text-[10px] text-muted/70 italic">
            Available soon
          </span>
        ) : isConnected ? (
          <button
            onClick={onClick}
            className="flex-1 flex items-center justify-center gap-1 text-[10px] text-muted hover:text-foreground bg-surface/40 hover:bg-surface border border-border/60 px-2 py-1.5 rounded transition-colors"
          >
            <Settings2 size={10} /> Manage
          </button>
        ) : (
          <button
            onClick={onClick}
            className="flex-1 flex items-center justify-center gap-1 text-[10px] font-medium text-[#C9A84C] hover:text-[#d4b85c] bg-gold/10 hover:bg-gold/15 border border-gold/25 px-2 py-1.5 rounded transition-colors"
          >
            <LogIn size={10} /> Connect
          </button>
        )}
        <a
          href={integration.docsUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-[10px] text-muted hover:text-foreground flex items-center gap-0.5 px-1.5 py-1.5"
          onClick={(e) => e.stopPropagation()}
          aria-label={`${integration.name} documentation`}
        >
          <ExternalLink size={10} />
        </a>
      </div>

      <span className="relative text-[8px] text-muted/60 font-mono truncate" title={integration.envKeys.join(", ")}>
        {integration.envKeys.join(", ")}
      </span>
    </div>
  );
}

interface IntegrationConnectModalProps {
  integration: BusinessIntegration;
  currentStatus?: HealthResult;
  onClose: () => void;
  onStatusChange: (result: HealthResult) => void;
}

function IntegrationConnectModal({ integration, currentStatus, onClose, onStatusChange }: IntegrationConnectModalProps) {
  const [testing, setTesting] = useState(false);

  useEffect(() => {
    const onEsc = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onEsc);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onEsc);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  async function testConnection() {
    setTesting(true);
    try {
      const res = await fetch(`/api/integrations/health?id=${integration.id}`);
      const data = await res.json();
      const result: HealthResult = data.result || { id: integration.id, status: "error" };
      onStatusChange(result);
      if (result.status === "connected") {
        toast.success(`${integration.name} is reachable!`);
      } else if (result.status === "error") {
        toast.error(result.detail || `${integration.name} returned an error`);
      } else {
        toast.error(`Missing: ${(result.missing || []).join(", ")}`);
      }
    } catch {
      toast.error("Test failed");
    } finally {
      setTesting(false);
    }
  }

  function copyEnvKey(key: string) {
    navigator.clipboard.writeText(key).then(() => toast.success(`Copied ${key}`));
  }

  function startOAuth() {
    // Business integrations that support OAuth all require per-client linking.
    // Send the user to the Connected Accounts section above with a hash so they
    // can pick the client first, then click Connect via Zernio.
    toast("Pick a client above, then use 'Connect via Zernio' for OAuth-based linking.", { icon: "ℹ️" });
    onClose();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  const isConnected = currentStatus?.status === "connected";
  const hasError = currentStatus?.status === "error";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-md" onClick={onClose} />
      <div className="relative w-full max-w-lg mx-4 bg-surface border border-border/50 rounded-xl shadow-2xl shadow-black/50 fade-in max-h-[85vh] overflow-y-auto">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-border/30 sticky top-0 bg-surface/95 backdrop-blur-sm z-10">
          <div className="flex items-center gap-2.5">
            <span className={integration.color}>{integration.icon}</span>
            <div>
              <h2 className="text-sm font-semibold text-foreground">Connect {integration.name}</h2>
              <p className="text-[10px] text-muted">{integration.description}</p>
            </div>
          </div>
          <button onClick={onClose}
            className="p-1 rounded-md hover:bg-surface-light text-muted hover:text-foreground transition-colors"
            aria-label="Close integration details">
            <X size={16} />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* Status banner */}
          <div className={`rounded-lg border p-3 text-[11px] ${
            isConnected ? "border-success/30 bg-success/5 text-success" :
            hasError ? "border-warning/30 bg-warning/5 text-warning" :
            "border-gold/30 bg-gold/5 text-[#C9A84C]"
          }`}>
            <div className="flex items-start gap-2">
              {isConnected ? <Check size={12} className="mt-0.5 shrink-0" /> :
                hasError ? <AlertCircle size={12} className="mt-0.5 shrink-0" /> :
                <AlertCircle size={12} className="mt-0.5 shrink-0" />}
              <div>
                {isConnected && <span><strong>Connected.</strong> {currentStatus?.detail || `${integration.name} is reachable with the current credentials.`}</span>}
                {hasError && <span><strong>Keys present but provider rejected.</strong> {currentStatus?.detail}</span>}
                {!isConnected && !hasError && <span>Add the environment variables below to enable {integration.name}.</span>}
              </div>
            </div>
          </div>

          {/* Required env vars */}
          <div>
            <p className="text-[11px] font-semibold mb-2 flex items-center gap-1.5 text-foreground">
              <Key size={11} className="text-gold" /> Required environment variables
            </p>
            <div className="space-y-1.5">
              {integration.envKeys.map(key => (
                <div key={key} className="flex items-center gap-2 bg-surface-light border border-border/60 rounded-md px-2.5 py-1.5">
                  <code className="text-[11px] font-mono text-foreground flex-1">{key}</code>
                  <button
                    onClick={() => copyEnvKey(key)}
                    className="text-muted hover:text-foreground transition-colors"
                    title="Copy env var name"
                  >
                    <Copy size={11} />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Instructions */}
          <div>
            <p className="text-[11px] font-semibold mb-1.5 text-foreground">How to get these</p>
            <p className="text-[11px] text-muted leading-relaxed whitespace-pre-line">{integration.instructions}</p>
          </div>

          {/* Action buttons */}
          <div className="flex flex-col gap-2 pt-1">
            {integration.oauthPath && (
              <button
                onClick={startOAuth}
                className="flex items-center justify-center gap-1.5 text-[11px] font-medium text-white bg-gradient-to-br from-[#C9A84C] to-[#b3932f] hover:from-[#d4b85c] hover:to-[#C9A84C] px-3 py-2 rounded-lg border border-gold/40 transition-all"
                title="OAuth requires selecting a client in Connected Accounts"
              >
                <LogIn size={12} /> Connect with OAuth (per-client)
              </button>
            )}

            <div className="flex gap-2">
              <a
                href={VERCEL_ENV_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 flex items-center justify-center gap-1.5 text-[11px] font-medium text-foreground bg-surface-light hover:bg-surface border border-border hover:border-border-light px-3 py-2 rounded-lg transition-colors"
              >
                <ArrowUpRight size={12} /> Open Vercel Settings
              </a>
              <a
                href={integration.docsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-1.5 text-[11px] text-muted hover:text-foreground bg-surface-light hover:bg-surface border border-border hover:border-border-light px-3 py-2 rounded-lg transition-colors"
              >
                <ExternalLink size={11} /> Docs
              </a>
            </div>

            <button
              onClick={testConnection}
              disabled={testing}
              className="flex items-center justify-center gap-1.5 text-[11px] font-medium text-foreground bg-surface-light hover:bg-surface border border-border hover:border-gold/30 px-3 py-2 rounded-lg transition-colors disabled:opacity-60 disabled:pointer-events-none"
            >
              {testing ? <Loader size={12} className="animate-spin" /> : <Zap size={12} className="text-gold" />}
              {testing ? "Testing..." : "Test connection"}
            </button>
          </div>

          <p className="text-[10px] text-muted/70 pt-1 border-t border-border/30">
            After adding env vars in Vercel, redeploy your app (or wait for the next build). Then click <strong className="text-foreground">Test connection</strong> above.
          </p>
        </div>
      </div>
    </div>
  );
}
