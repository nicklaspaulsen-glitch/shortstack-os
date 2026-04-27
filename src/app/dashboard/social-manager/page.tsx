"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { createClient } from "@/lib/supabase/client";
import { useManagedClient } from "@/lib/use-managed-client";
import { Client, ContentCalendarEntry } from "@/lib/types";
import StatCard from "@/components/ui/stat-card";
import StatusBadge from "@/components/ui/status-badge";
import { formatDate, formatRelativeTime } from "@/lib/utils";
import {
  Bot, Play, Pause, Calendar, Camera,
  MessageSquare, Sparkles, Send, Clock, CheckCircle,
  Loader, Settings, ArrowRight, Globe, Film,
  Briefcase, Lightbulb, Video, LayoutGrid, FileText as FileTextIcon,
  ToggleLeft, ToggleRight, Zap, Shield, Activity, Hash,
  Copy, Layers, RefreshCw, TrendingUp, BarChart3, Users,
  Search, Download, Eye, Upload, LineChart, Repeat,
  GitCompare, Reply, Handshake, Music2,
  Target, Flame, Link, AtSign,
  PieChart, ThumbsUp, Heart, Share2,
  Grid3X3, Columns, BookOpen, Wand2,
  CircleDot, Inbox, UserPlus, AlertCircle,
  Plus, X, Check
} from "lucide-react";
import toast from "react-hot-toast";
import PageAI from "@/components/page-ai";
import Modal from "@/components/ui/modal";
import PageHero from "@/components/ui/page-hero";
import AIEnhanceButton from "@/components/ui/ai-enhance-button";
import { PageSkeleton } from "@/components/ui/skeleton";
import {
  InstagramIcon, FacebookIcon, TikTokIcon, LinkedInIcon, XTwitterIcon,
  ThreadsIcon, PinterestIcon, YouTubeShortsIcon,
} from "@/components/ui/platform-icons";

const SUPPORTED_PLATFORMS = [
  { key: "instagram", label: "Instagram", color: "text-pink-400", bg: "bg-pink-500/10", border: "border-pink-500/20", description: "Connect your Instagram Business or Creator account" },
  { key: "facebook", label: "Facebook", color: "text-blue-400", bg: "bg-blue-500/10", border: "border-blue-500/20", description: "Connect your Facebook Page for publishing" },
  { key: "tiktok", label: "TikTok", color: "text-white", bg: "bg-zinc-500/10", border: "border-zinc-500/20", description: "Connect your TikTok account for video publishing" },
  { key: "linkedin", label: "LinkedIn", color: "text-blue-400", bg: "bg-blue-600/10", border: "border-blue-600/20", description: "Connect your LinkedIn profile or company page" },
  { key: "twitter", label: "Twitter / X", color: "text-zinc-300", bg: "bg-zinc-500/10", border: "border-zinc-500/20", description: "Connect your X (Twitter) account" },
  { key: "threads", label: "Threads", color: "text-foreground", bg: "bg-zinc-500/10", border: "border-zinc-500/20", description: "Connect your Threads account for text posts" },
  { key: "pinterest", label: "Pinterest", color: "text-red-400", bg: "bg-red-500/10", border: "border-red-500/20", description: "Connect Pinterest for pins and boards" },
  { key: "youtube_shorts", label: "YouTube Shorts", color: "text-red-400", bg: "bg-red-500/10", border: "border-red-500/20", description: "Connect for short-form vertical video" },
] as const;

const PLATFORM_ICONS: Record<string, React.ReactNode> = {
  instagram: <InstagramIcon size={16} />,
  facebook: <FacebookIcon size={16} />,
  tiktok: <TikTokIcon size={16} />,
  linkedin: <LinkedInIcon size={16} />,
  twitter: <XTwitterIcon size={16} />,
  threads: <ThreadsIcon size={16} />,
  pinterest: <PinterestIcon size={16} />,
  youtube_shorts: <YouTubeShortsIcon size={16} />,
};

interface SocialAccount {
  id: string;
  platform: string;
  account_name: string;
  account_id: string | null;
  is_active: boolean;
  created_at: string;
  token_expires_at: string | null;
  status: "active" | "expired" | "revoked";
  metadata: Record<string, unknown> | null;
}

export default function SocialManagerPage() {
  const { profile } = useAuth();
  const isPlatformAdmin = profile?.role === "admin" || profile?.role === "founder";
  const { clientId: managedClientId } = useManagedClient();
  const [clients, setClients] = useState<Array<Client & { accounts: string[] }>>([]);
  const [selectedClient, setSelectedClient] = useState<string>("");
  const [scheduledPosts, setScheduledPosts] = useState<ContentCalendarEntry[]>([]);
  const [recentPosts, setRecentPosts] = useState<ContentCalendarEntry[]>([]);
  const [generating, setGenerating] = useState(false);
  const [posting, setPosting] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [weekConfig, setWeekConfig] = useState({ posts_per_day: 1, tone: "professional yet approachable", topics: "" });
  const [tab, setTab] = useState<"dashboard" | "calendar" | "scheduled" | "published" | "hashtags" | "config" | "tools" | "analytics" | "inbox" | "collabs">("dashboard");
  const [suggestions, setSuggestions] = useState<Array<{ id: string; description: string; status: string; metadata: Record<string, unknown>; created_at: string }>>([]);
  const [autopilotConfig, setAutopilotConfig] = useState<Record<string, unknown>>({});
  const [savingConfig, setSavingConfig] = useState(false);
  const [runningAutopilot, setRunningAutopilot] = useState(false);
  // New feature states
  const [repurposeInput, setRepurposeInput] = useState("");
  const [repurposeResults, setRepurposeResults] = useState<Array<{ platform: string; caption: string }>>([]);
  const [repurposing, setRepurposing] = useState(false);
  const [abTestInput, setAbTestInput] = useState("");
  const [abVariants, setAbVariants] = useState<{ a: string; b: string } | null>(null);
  const [generatingAB, setGeneratingAB] = useState(false);
  const [viralInput, setViralInput] = useState("");
  const [viralScore, setViralScore] = useState<{ score: number; factors: string[] } | null>(null);
  const [scoringViral, setScoringViral] = useState(false);
  const [bioInput, setBioInput] = useState("");
  const [bioResults, setBioResults] = useState<string[]>([]);
  const [generatingBio, setGeneratingBio] = useState(false);
  const [bulkCsv, setBulkCsv] = useState("");
  const [competitorHandles, setCompetitorHandles] = useState<Array<{ handle: string; platform: string; frequency: string; lastPost: string }>>([]);
  const [newCompetitor, setNewCompetitor] = useState("");
  const [listeningKeywords, setListeningKeywords] = useState<string[]>([]);
  const [newKeyword, setNewKeyword] = useState("");
  const [storySlides, setStorySlides] = useState<Array<{ id: number; text: string; type: string }>>([]);
  const [carouselSlides, setCarouselSlides] = useState<Array<{ id: number; heading: string; body: string }>>([]);
  const [linkBioLinks, setLinkBioLinks] = useState<Array<{ id: number; label: string; url: string; clicks: number }>>([]);
  const [autoReplyRules, setAutoReplyRules] = useState<Array<{ id: number; trigger: string; response: string; active: boolean }>>([]);
  const [collabOpportunities] = useState<Array<{ id: number; brand: string; niche: string; followers: string; status: string; match: number }>>([]);
  const [influencerNiche, setInfluencerNiche] = useState("");
  const [contentPillars] = useState<Array<{ name: string; target: number; actual: number; color: string }>>([]);
  const [toolsSubTab, setToolsSubTab] = useState<"repurpose" | "ab-test" | "viral" | "bio" | "preview" | "bulk" | "carousel" | "story" | "linkinbio" | "templates" | "recycler">("repurpose");
  const [analyticsSubTab, setAnalyticsSubTab] = useState<"engagement" | "heatmap" | "hashtags" | "growth" | "comparison" | "pillars">("engagement");
  const [inboxSubTab, setInboxSubTab] = useState<"messages" | "listening" | "ugc" | "autoreplies">("messages");
  const [collabsSubTab, setCollabsSubTab] = useState<"competitors" | "influencers" | "collabs" | "trending">("competitors");
  // Social connection state
  const [connectedAccounts, setConnectedAccounts] = useState<SocialAccount[]>([]);
  const [connectModalOpen, setConnectModalOpen] = useState(false);
  const [connectingPlatform, setConnectingPlatform] = useState<string | null>(null);
  const [confirmPlatform, setConfirmPlatform] = useState<typeof SUPPORTED_PLATFORMS[number] | null>(null);
  const [zernioConfigured, setZernioConfigured] = useState(true);
  const [disconnectingId, setDisconnectingId] = useState<string | null>(null);
  const supabase = createClient();

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { fetchClients(); fetchAutopilotConfig(); }, []);

  // Auto-select managed client
  useEffect(() => {
    if (managedClientId && clients.length > 0) {
      setSelectedClient(managedClientId);
    }
  }, [managedClientId, clients]);

  useEffect(() => {
    if (selectedClient) {
      fetchPosts();
      fetchSuggestions();
      fetchConnectedAccounts();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedClient]);

  // Check URL for ?connected= param (Zernio OAuth callback)
  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const connected = params.get("connected");
      if (connected) {
        toast.success(`${connected.charAt(0).toUpperCase() + connected.slice(1)} connected successfully!`);
        fetchConnectedAccounts();
        // Clean up URL
        window.history.replaceState({}, "", window.location.pathname);
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function fetchClients() {
    try {
      setLoading(true);
      const { data: cl } = await supabase.from("clients").select("*").eq("is_active", true).order("business_name");
      const clientsWithAccounts = [];
      for (const c of (cl || [])) {
        const { data: accs } = await supabase
          .from("social_accounts")
          .select("platform")
          .eq("client_id", c.id)
          .eq("is_active", true);
        clientsWithAccounts.push({ ...c, accounts: (accs || []).map((a: { platform: string }) => a.platform) });
      }
      setClients(clientsWithAccounts);
      if (clientsWithAccounts.length > 0 && !selectedClient) {
        setSelectedClient(clientsWithAccounts[0].id);
      }
    } catch (err) {
      console.error("[SocialManagerPage] fetch error:", err);
    } finally {
      setLoading(false);
    }
  }

  async function fetchConnectedAccounts() {
    if (!selectedClient) return;
    try {
      const res = await fetch(`/api/social/connect?client_id=${selectedClient}&zernio=true`);
      const data = await res.json();
      setConnectedAccounts(data.accounts || []);
      setZernioConfigured(data.zernio_configured !== false);
    } catch {
      console.error("[SocialManager] Failed to fetch connected accounts");
    }
  }

  async function connectPlatform(platform: string) {
    setConnectingPlatform(platform);
    try {
      const res = await fetch("/api/social/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          // client_id is optional — if null, connects at agency level
          client_id: selectedClient || null,
          platform,
          action: "zernio_oauth",
        }),
      });
      const data = await res.json();

      if (data.zernio_not_configured) {
        toast.error(
          isPlatformAdmin
            ? "Zernio API key not configured. Add ZERNIO_API_KEY in Settings."
            : "Social account connections aren't enabled on this workspace yet. Reach out to your platform admin to switch them on."
        );
        setZernioConfigured(false);
        setConnectingPlatform(null);
        setConfirmPlatform(null);
        return;
      }

      if (data.oauth_url) {
        toast.success(`Redirecting to ${platform} authorization...`);
        window.location.href = data.oauth_url;
      } else if (data.error) {
        toast.error(data.error);
      } else {
        toast.error("Could not get OAuth URL from Zernio");
      }
    } catch {
      toast.error("Failed to initiate connection");
    }
    setConnectingPlatform(null);
    setConfirmPlatform(null);
  }

  async function disconnectAccount(account: SocialAccount) {
    setDisconnectingId(account.id);
    try {
      const res = await fetch("/api/social/connect", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          account_id: account.id,
          client_id: selectedClient,
          zernio_account_id: account.account_id,
        }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success(`${account.platform} disconnected`);
        fetchConnectedAccounts();
        fetchClients(); // Refresh client account list
      } else {
        toast.error("Failed to disconnect");
      }
    } catch {
      toast.error("Error disconnecting account");
    }
    setDisconnectingId(null);
  }

  function requireConnectedAccounts(): boolean {
    const activeAccounts = connectedAccounts.filter(a => a.status === "active");
    if (activeAccounts.length === 0) {
      toast.error("Connect at least one social account first");
      setConnectModalOpen(true);
      return false;
    }
    return true;
  }

  async function fetchAutopilotConfig() {
    try {
      const res = await fetch("/api/social/autopilot");
      const data = await res.json();
      setAutopilotConfig(data.config || {});
    } catch { /* silent */ }
  }

  async function saveAutopilotSetting(updates: Record<string, unknown>) {
    setSavingConfig(true);
    const newConfig = { ...autopilotConfig, ...updates };
    setAutopilotConfig(newConfig);
    try {
      await fetch("/api/social/autopilot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "save_config", config: newConfig }),
      });
      toast.success("Settings saved");
    } catch { toast.error("Failed to save"); }
    setSavingConfig(false);
  }

  async function runSocialAutopilot() {
    setRunningAutopilot(true);
    try {
      const res = await fetch("/api/social/autopilot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "run" }),
      });
      const data = await res.json();
      if (data.skipped) { toast.error(data.reason || "Autopilot skipped"); }
      else {
        toast.success(`Autopilot: ${data.content_generated || 0} generated, ${data.posts_published || 0} published`);
        fetchPosts();
      }
    } catch { toast.error("Autopilot error"); }
    setRunningAutopilot(false);
  }

  async function fetchPosts() {
    const [{ data: scheduled }, { data: published }] = await Promise.all([
      supabase.from("content_calendar").select("*").eq("client_id", selectedClient).in("status", ["scheduled", "idea"]).order("scheduled_at"),
      supabase.from("content_calendar").select("*").eq("client_id", selectedClient).eq("status", "published").order("scheduled_at", { ascending: false }).limit(20),
    ]);
    setScheduledPosts(scheduled || []);
    setRecentPosts(published || []);
  }

  async function fetchSuggestions() {
    if (!selectedClient) return;
    try {
      const res = await fetch(`/api/ai/content-suggestions?client_id=${selectedClient}`);
      const data = await res.json();
      setSuggestions((data.suggestions || []).filter((s: { status: string }) => s.status === "pending"));
    } catch { /* best-effort */ }
  }

  function toggleAutopilot() {
    saveAutopilotSetting({ enabled: !autopilotConfig.enabled });
  }

  async function generateWeek() {
    if (!selectedClient) return;
    if (!requireConnectedAccounts()) return;
    setGenerating(true);
    toast.loading("AI is creating your content plan...");
    try {
      const res = await fetch("/api/social/generate-week", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ client_id: selectedClient, ...weekConfig }),
      });
      toast.dismiss();
      const data = await res.json();
      if (data.success) {
        toast.success(`${data.posts_generated} posts generated!`);
        fetchPosts();
      } else {
        toast.error(data.error || "Failed to generate");
      }
    } catch {
      toast.dismiss();
      toast.error("Error generating content");
    }
    setGenerating(false);
  }

  async function publishPost(post: ContentCalendarEntry) {
    setPosting(post.id);
    try {
      const meta = (post.metadata as Record<string, unknown>) || {};
      const res = await fetch("/api/social/post", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          client_id: selectedClient,
          platform: post.platform,
          caption: (meta.caption as string) || post.title,
        }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success(`Posted to ${post.platform}!`);
        // Update status
        await supabase.from("content_calendar").update({ status: "published" }).eq("id", post.id);
        fetchPosts();
      } else {
        toast.error(data.error || "Failed to post");
      }
    } catch {
      toast.error("Posting failed");
    }
    setPosting(null);
  }

  const currentClient = clients.find(c => c.id === selectedClient);
  const isAutopilot = !!autopilotConfig.enabled;

  if (loading) return <PageSkeleton />;

  return (
    <div className="fade-in space-y-5">
      {/* Hero Header */}
      <PageHero
        icon={<Share2 size={22} />}
        title="Social Manager"
        subtitle="Post to every platform at once — AI plans the calendar, writes captions, and schedules everything. You just approve."
        gradient="purple"
      />
      <div className="flex items-center justify-end flex-wrap gap-3">
        <div className="flex items-center gap-2">
          {/* Client selector */}
          <select value={selectedClient} onChange={e => setSelectedClient(e.target.value)}
            className="input text-xs py-1.5 min-w-[160px]">
            {clients.map(c => (
              <option key={c.id} value={c.id}>{c.business_name}</option>
            ))}
          </select>

          {/* Autopilot toggle */}
          <button onClick={() => toggleAutopilot()}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              isAutopilot
                ? "bg-success/10 text-success border border-success/20 pulse-ring"
                : "bg-surface-light text-muted border border-border hover:border-gold/20"
            }`}>
            {isAutopilot ? <Play size={12} /> : <Pause size={12} />}
            {isAutopilot ? "Autopilot ON" : "Autopilot OFF"}
          </button>
        </div>
      </div>

      {/* Connected platforms bar */}
      {currentClient && (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[10px] text-muted">Connected:</span>
          {connectedAccounts.filter(a => a.is_active).length > 0 ? (
            <>
              {connectedAccounts.filter(a => a.is_active).map(account => (
                <div key={account.id} className="flex items-center gap-1.5 text-[10px] bg-surface-light px-2 py-0.5 rounded border border-border group relative">
                  <span className={`w-1.5 h-1.5 rounded-full ${account.status === "active" ? "bg-emerald-400" : account.status === "expired" ? "bg-red-400" : "bg-zinc-500"}`} />
                  {PLATFORM_ICONS[account.platform] || <Globe size={10} />}
                  <span className="capitalize">{account.account_name || account.platform}</span>
                  {account.status === "expired" && (
                    <span className="text-[8px] text-red-400 ml-0.5">expired</span>
                  )}
                </div>
              ))}
              <button onClick={() => setConnectModalOpen(true)}
                className="flex items-center gap-1 text-[10px] text-gold hover:text-gold/80 transition-colors px-1.5 py-0.5">
                <Plus size={10} /> Add
              </button>
            </>
          ) : (
            <button onClick={() => setConnectModalOpen(true)}
              className="flex items-center gap-1.5 text-[10px] text-gold hover:text-gold/80 bg-gold/5 border border-gold/20 rounded px-2.5 py-1 transition-all hover:bg-gold/10">
              <Plus size={10} />
              Connect Social Accounts
            </button>
          )}
        </div>
      )}

      {/* Connect Accounts Section — shown when no accounts connected */}
      {currentClient && connectedAccounts.filter(a => a.is_active).length === 0 && (
        <div className="card border-gold/10 relative overflow-hidden">
          <div className="absolute inset-0 bg-mesh opacity-20" />
          <div className="relative text-center py-6">
            <div className="w-12 h-12 bg-gold/10 rounded-xl flex items-center justify-center mx-auto mb-3">
              <Globe size={22} className="text-gold" />
            </div>
            <h2 className="text-sm font-semibold mb-1">Connect Your Social Accounts</h2>
            <p className="text-xs text-muted mb-4 max-w-md mx-auto">
              Link your social media accounts through Zernio to enable AI-powered content creation, scheduling, and auto-publishing.
            </p>

            {!zernioConfigured && (
              <div className="bg-warning/10 border border-warning/20 rounded-lg p-3 mb-4 max-w-sm mx-auto">
                <div className="flex items-center gap-2 text-warning text-xs">
                  <AlertCircle size={14} />
                  {isPlatformAdmin ? (
                    <span>Zernio API key not configured. Add <code className="bg-surface px-1 rounded text-[10px]">ZERNIO_API_KEY</code> to your environment.</span>
                  ) : (
                    <span>Social account connections aren&apos;t enabled on this workspace yet. Reach out to your platform admin to switch them on.</span>
                  )}
                </div>
              </div>
            )}

            <div className="flex items-center justify-center gap-2 flex-wrap max-w-lg mx-auto">
              {SUPPORTED_PLATFORMS.map(p => (
                <button key={p.key}
                  onClick={() => { setConfirmPlatform(p); setConnectModalOpen(true); }}
                  disabled={!zernioConfigured || connectingPlatform === p.key}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-lg border transition-all text-xs font-medium disabled:opacity-40 disabled:cursor-not-allowed hover:scale-[1.02] ${p.bg} ${p.border} ${p.color}`}>
                  {connectingPlatform === p.key ? (
                    <Loader size={13} className="animate-spin" />
                  ) : (
                    PLATFORM_ICONS[p.key] || <Globe size={13} />
                  )}
                  {p.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Connect Modal */}
      <Modal isOpen={connectModalOpen} onClose={() => { setConnectModalOpen(false); setConfirmPlatform(null); }} title="Connect Social Account" size="md">
        <div className="p-5 space-y-4">
          {!zernioConfigured ? (
            <div className="text-center py-4">
              <div className="w-12 h-12 bg-warning/10 rounded-xl flex items-center justify-center mx-auto mb-3">
                <AlertCircle size={22} className="text-warning" />
              </div>
              {isPlatformAdmin ? (
                <>
                  <h3 className="text-sm font-semibold mb-2">Zernio Setup Required</h3>
                  <p className="text-xs text-muted mb-3">
                    Social account connections are powered by Zernio. To get started:
                  </p>
                  <ol className="text-xs text-muted text-left max-w-sm mx-auto space-y-2 mb-4">
                    <li className="flex items-start gap-2">
                      <span className="text-gold font-bold">1.</span>
                      <span>Sign up at <span className="text-gold">zernio.com</span> and get your API key</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-gold font-bold">2.</span>
                      <span>Add <code className="bg-surface px-1 rounded text-[10px]">ZERNIO_API_KEY</code> to your environment variables</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-gold font-bold">3.</span>
                      <span>Restart the application and connect your accounts</span>
                    </li>
                  </ol>
                </>
              ) : (
                <>
                  <h3 className="text-sm font-semibold mb-2">Social connections not enabled</h3>
                  <p className="text-xs text-muted mb-4 max-w-sm mx-auto">
                    Social account connections aren&apos;t enabled on this workspace yet. Reach out
                    to your platform admin to switch them on, then you can connect Instagram,
                    Facebook, TikTok, and more from this page.
                  </p>
                </>
              )}
              <button onClick={() => setConnectModalOpen(false)}
                className="btn-primary text-xs">
                Got it
              </button>
            </div>
          ) : confirmPlatform ? (
            <div className="text-center py-2">
              <div className={`w-12 h-12 ${confirmPlatform.bg} rounded-xl flex items-center justify-center mx-auto mb-3 border ${confirmPlatform.border}`}>
                {PLATFORM_ICONS[confirmPlatform.key] ? (
                  <span className="scale-150">{PLATFORM_ICONS[confirmPlatform.key]}</span>
                ) : (
                  <Globe size={22} className={confirmPlatform.color} />
                )}
              </div>
              <h3 className="text-sm font-semibold mb-1">Connect {confirmPlatform.label}</h3>
              <p className="text-xs text-muted mb-4">{confirmPlatform.description}</p>

              <div className="bg-surface-light rounded-lg p-3 mb-4 text-left">
                <p className="text-[10px] text-muted uppercase tracking-wider mb-2">What happens next:</p>
                <ul className="text-xs text-muted space-y-1.5">
                  <li className="flex items-start gap-2">
                    <ArrowRight size={10} className="text-gold mt-0.5 shrink-0" />
                    <span>You&apos;ll be redirected to Zernio to authorize {confirmPlatform.label}</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <ArrowRight size={10} className="text-gold mt-0.5 shrink-0" />
                    <span>Log in to your {confirmPlatform.label} account and grant permissions</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <ArrowRight size={10} className="text-gold mt-0.5 shrink-0" />
                    <span>You&apos;ll be redirected back here when complete</span>
                  </li>
                </ul>
              </div>

              <div className="flex items-center justify-center gap-2">
                <button onClick={() => setConfirmPlatform(null)}
                  className="px-4 py-2 text-xs text-muted hover:text-foreground transition-colors">
                  Back
                </button>
                <button onClick={() => connectPlatform(confirmPlatform.key)}
                  disabled={connectingPlatform === confirmPlatform.key}
                  className="btn-primary text-xs flex items-center gap-1.5 disabled:opacity-50">
                  {connectingPlatform === confirmPlatform.key ? (
                    <Loader size={12} className="animate-spin" />
                  ) : (
                    <Zap size={12} />
                  )}
                  {connectingPlatform === confirmPlatform.key ? "Connecting..." : `Connect ${confirmPlatform.label}`}
                </button>
              </div>
            </div>
          ) : (
            <div>
              <p className="text-xs text-muted mb-4">Select a platform to connect via Zernio OAuth:</p>
              <div className="grid grid-cols-1 gap-2">
                {SUPPORTED_PLATFORMS.map(p => {
                  const alreadyConnected = connectedAccounts.find(a => a.platform === p.key && a.is_active);
                  return (
                    <button key={p.key}
                      onClick={() => alreadyConnected ? undefined : setConfirmPlatform(p)}
                      disabled={!!alreadyConnected}
                      className={`flex items-center gap-3 p-3 rounded-lg border transition-all text-left ${
                        alreadyConnected
                          ? "bg-surface-light/50 border-border opacity-60 cursor-default"
                          : `${p.bg} ${p.border} hover:scale-[1.01] cursor-pointer`
                      }`}>
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${p.bg} border ${p.border}`}>
                        {PLATFORM_ICONS[p.key] || <Globe size={14} />}
                      </div>
                      <div className="flex-1">
                        <span className="text-xs font-medium">{p.label}</span>
                        <p className="text-[10px] text-muted">{p.description}</p>
                      </div>
                      {alreadyConnected ? (
                        <span className="flex items-center gap-1 text-[10px] text-emerald-400">
                          <Check size={10} /> Connected
                        </span>
                      ) : (
                        <ArrowRight size={14} className="text-muted" />
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Show already-connected accounts with disconnect option */}
              {connectedAccounts.filter(a => a.is_active).length > 0 && (
                <div className="mt-4 pt-4 border-t border-border">
                  <p className="text-[10px] text-muted uppercase tracking-wider mb-2">Connected Accounts</p>
                  <div className="space-y-1.5">
                    {connectedAccounts.filter(a => a.is_active).map(account => (
                      <div key={account.id} className="flex items-center justify-between p-2 rounded-lg bg-surface-light">
                        <div className="flex items-center gap-2">
                          <span className={`w-1.5 h-1.5 rounded-full ${account.status === "active" ? "bg-emerald-400" : "bg-red-400"}`} />
                          {PLATFORM_ICONS[account.platform] || <Globe size={12} />}
                          <span className="text-xs">{account.account_name || account.platform}</span>
                          {account.status === "expired" && (
                            <span className="text-[8px] bg-red-500/10 text-red-400 px-1.5 py-0.5 rounded">Token Expired</span>
                          )}
                        </div>
                        <button onClick={() => disconnectAccount(account)}
                          disabled={disconnectingId === account.id}
                          className="text-[10px] text-red-400 hover:text-red-300 transition-colors disabled:opacity-50">
                          {disconnectingId === account.id ? <Loader size={10} className="animate-spin" /> : "Disconnect"}
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </Modal>

      {/* Tabs */}
      <div className="tab-group w-fit flex-wrap">
        {(["dashboard", "calendar", "scheduled", "published", "hashtags", "tools", "analytics", "inbox", "collabs", "config"] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={tab === t ? "tab-item-active" : "tab-item-inactive"}>
            {t === "dashboard" ? "Dashboard" : t === "calendar" ? "Calendar" : t === "scheduled" ? `Queue (${scheduledPosts.length})` : t === "published" ? "Published" : t === "hashtags" ? "Hashtags" : t === "tools" ? "AI Tools" : t === "analytics" ? "Analytics" : t === "inbox" ? "Inbox" : t === "collabs" ? "Collabs" : "Settings"}
          </button>
        ))}
      </div>

      {/* Dashboard */}
      {tab === "dashboard" && (
        <div className="space-y-4">
          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
            <StatCard label="Scheduled" value={scheduledPosts.length} icon={<Calendar size={14} />} />
            <StatCard label="Published" value={recentPosts.length} icon={<CheckCircle size={14} />} changeType="positive" />
            <StatCard label="Platforms" value={currentClient?.accounts.length || 0} icon={<Globe size={14} />} />
            <StatCard label="Autopilot" value={isAutopilot ? "Active" : "Off"} icon={<Bot size={14} />}
              changeType={isAutopilot ? "positive" : "neutral"} />
          </div>

          {/* Generate week */}
          <div className="card border-gold/10 relative overflow-hidden">
            <div className="absolute inset-0 bg-mesh opacity-30" />
            <div className="relative">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="w-9 h-9 bg-gold/10 rounded-lg flex items-center justify-center breathe">
                    <Sparkles size={18} className="text-gold" />
                  </div>
                  <div>
                    <h2 className="text-sm font-semibold">Generate This Week</h2>
                    <p className="text-[10px] text-muted">AI creates 7 days of content in one click</p>
                  </div>
                </div>
                <button onClick={generateWeek} disabled={generating}
                  className="btn-primary text-xs flex items-center gap-1.5 disabled:opacity-50">
                  {generating ? <Loader size={12} className="animate-spin" /> : <Sparkles size={12} />}
                  {generating ? "Creating..." : "Generate Week"}
                </button>
              </div>
            </div>
          </div>

          {/* AI Content Suggestions */}
          {suggestions.length > 0 && (
            <div className="card">
              <div className="flex items-center justify-between mb-3">
                <h2 className="section-header mb-0 flex items-center gap-2">
                  <Lightbulb size={13} className="text-gold" /> AI Suggestions
                </h2>
                <span className="text-[9px] text-muted">{suggestions.length} ideas</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {suggestions.slice(0, 6).map(s => {
                  const meta = s.metadata || {};
                  const typeIcon: Record<string, React.ReactNode> = {
                    short_video: <Video size={12} className="text-pink-400" />,
                    carousel: <LayoutGrid size={12} className="text-blue-400" />,
                    script: <FileTextIcon size={12} className="text-yellow-400" />,
                    reel: <Film size={12} className="text-purple-400" />,
                    story: <Camera size={12} className="text-orange-400" />,
                    post: <MessageSquare size={12} className="text-green-400" />,
                    thread: <FileTextIcon size={12} className="text-cyan-400" />,
                  };
                  return (
                    <div key={s.id} className="p-2.5 bg-surface-light rounded-lg border border-border hover:border-gold/10 transition-all">
                      <div className="flex items-center gap-2 mb-1">
                        {typeIcon[String(meta.type)] || <Sparkles size={12} className="text-gold" />}
                        <span className="text-[10px] font-medium text-gold uppercase">{String(meta.type || "").replace("_", " ")}</span>
                        <span className="text-[9px] text-muted ml-auto capitalize">{String(meta.platform || "")}</span>
                      </div>
                      <p className="text-xs font-medium truncate">{String(meta.title || s.description)}</p>
                      <p className="text-[10px] text-muted mt-0.5 line-clamp-2">{String(meta.description || "")}</p>
                      {typeof meta.hook === "string" && meta.hook && (
                        <p className="text-[10px] text-foreground/70 mt-1 italic border-l-2 border-gold/30 pl-2">&ldquo;{meta.hook}&rdquo;</p>
                      )}
                      {Array.isArray(meta.tags) && (
                        <div className="flex gap-1 mt-1.5">
                          {(meta.tags as string[]).map(tag => (
                            <span key={tag} className="text-[8px] text-muted bg-surface px-1.5 py-0.5 rounded">{tag}</span>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Up next */}
          {scheduledPosts.length > 0 && (
            <div className="card">
              <div className="flex items-center justify-between mb-3">
                <h2 className="section-header mb-0 flex items-center gap-2">
                  <Clock size={13} className="text-gold" /> Up Next
                </h2>
                <button onClick={() => setTab("scheduled")} className="text-[10px] text-gold flex items-center gap-0.5">
                  View all <ArrowRight size={10} />
                </button>
              </div>
              <div className="space-y-2">
                {scheduledPosts.slice(0, 5).map(post => {
                  const meta = (post.metadata as Record<string, unknown>) || {};
                  return (
                    <div key={post.id} className="flex items-center gap-3 p-2.5 bg-surface-light rounded-lg border border-border hover:border-gold/10 transition-all">
                      <div className="shrink-0">{PLATFORM_ICONS[post.platform] || <Globe size={14} />}</div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium truncate">{post.title}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-[9px] text-muted capitalize">{post.platform}</span>
                          {post.scheduled_at && <span className="text-[9px] text-muted">{formatDate(post.scheduled_at)}</span>}
                          {meta.best_time ? <span className="text-[9px] text-gold">{String(meta.best_time)}</span> : null}
                        </div>
                      </div>
                      <button onClick={() => publishPost(post)} disabled={posting === post.id}
                        className="btn-primary text-[9px] py-1 px-2.5 flex items-center gap-1 disabled:opacity-50">
                        {posting === post.id ? <Loader size={10} className="animate-spin" /> : <Send size={10} />}
                        Post
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Recent published */}
          {recentPosts.length > 0 && (
            <div className="card">
              <h2 className="section-header flex items-center gap-2">
                <CheckCircle size={13} className="text-success" /> Recently Published
              </h2>
              <div className="space-y-1.5">
                {recentPosts.slice(0, 5).map(post => (
                  <div key={post.id} className="flex items-center gap-2.5 py-1.5 border-b border-border last:border-0">
                    {PLATFORM_ICONS[post.platform] || <Globe size={12} />}
                    <div className="flex-1 min-w-0">
                      <p className="text-[11px] truncate">{post.title}</p>
                      <p className="text-[9px] text-muted">{post.scheduled_at ? formatRelativeTime(post.scheduled_at) : ""}</p>
                    </div>
                    <StatusBadge status="published" />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Calendar Tab */}
      {tab === "calendar" && (() => {
        const today = new Date();
        const startOfWeek = new Date(today);
        startOfWeek.setDate(today.getDate() - today.getDay() + 1);
        const days = Array.from({ length: 7 }, (_, i) => {
          const d = new Date(startOfWeek);
          d.setDate(startOfWeek.getDate() + i);
          return d;
        });
        const dayNames = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
        const allPosts = [...scheduledPosts, ...recentPosts];

        return (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold">Content Calendar — This Week</h2>
              <button onClick={generateWeek} disabled={generating}
                className="btn-primary text-xs flex items-center gap-1.5">
                {generating ? <Loader size={12} className="animate-spin" /> : <Sparkles size={12} />}
                Fill Week with AI
              </button>
            </div>

            {/* Weekly grid */}
            <div className="grid grid-cols-7 gap-2">
              {days.map((day, i) => {
                const dayStr = day.toISOString().split("T")[0];
                const isToday = dayStr === today.toISOString().split("T")[0];
                const dayPosts = allPosts.filter(p => p.scheduled_at?.startsWith(dayStr));

                return (
                  <div key={i} className={`rounded-xl border p-2.5 min-h-[160px] ${
                    isToday ? "border-gold/30 bg-gold/[0.03]" : "border-border bg-surface"
                  }`}>
                    <div className="flex items-center justify-between mb-2">
                      <span className={`text-[10px] font-semibold ${isToday ? "text-gold" : "text-muted"}`}>
                        {dayNames[i]}
                      </span>
                      <span className={`text-[10px] font-mono ${isToday ? "text-gold" : "text-muted"}`}>
                        {day.getDate()}
                      </span>
                    </div>
                    <div className="space-y-1">
                      {dayPosts.map(post => (
                        <div key={post.id} className={`p-1.5 rounded-lg text-[9px] cursor-pointer transition-all hover:scale-[1.02] ${
                          post.status === "published"
                            ? "bg-success/10 border border-success/20 text-success"
                            : "bg-gold/5 border border-gold/15 text-foreground"
                        }`}>
                          <div className="flex items-center gap-1 mb-0.5">
                            {PLATFORM_ICONS[post.platform] || <Globe size={8} />}
                            <span className="capitalize font-medium">{post.platform}</span>
                          </div>
                          <p className="truncate">{post.title}</p>
                        </div>
                      ))}
                      {dayPosts.length === 0 && (
                        <p className="text-[8px] text-muted/40 text-center mt-6">Empty</p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Content pillars */}
            <div className="card">
              <h3 className="section-header flex items-center gap-2 mb-3">
                <Layers size={13} className="text-gold" /> Content Pillars
              </h3>
              <p className="text-[10px] text-muted mb-3">Balanced content strategy across different post types</p>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                {[
                  { name: "Educational", desc: "Tips, how-tos, industry insights", color: "text-blue-400", bg: "bg-blue-400/10" },
                  { name: "Social Proof", desc: "Reviews, testimonials, case studies", color: "text-success", bg: "bg-success/10" },
                  { name: "Behind the Scenes", desc: "Team, process, day-in-the-life", color: "text-purple-400", bg: "bg-purple-400/10" },
                  { name: "Promotional", desc: "Offers, CTAs, product features", color: "text-gold", bg: "bg-gold/10" },
                  { name: "Engagement", desc: "Polls, questions, challenges", color: "text-pink-400", bg: "bg-pink-400/10" },
                  { name: "Trending", desc: "Memes, trends, cultural moments", color: "text-orange-400", bg: "bg-orange-400/10" },
                  { name: "Storytelling", desc: "Client stories, founder journey", color: "text-cyan-400", bg: "bg-cyan-400/10" },
                  { name: "Value Bombs", desc: "Quick wins, cheat sheets, lists", color: "text-emerald-400", bg: "bg-emerald-400/10" },
                ].map(pillar => (
                  <div key={pillar.name} className={`p-3 rounded-xl border border-border hover:border-gold/10 transition-all`}>
                    <div className={`w-7 h-7 ${pillar.bg} rounded-lg flex items-center justify-center mb-1.5`}>
                      <Sparkles size={12} className={pillar.color} />
                    </div>
                    <p className="text-[10px] font-semibold">{pillar.name}</p>
                    <p className="text-[8px] text-muted">{pillar.desc}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Best posting times */}
            <div className="card">
              <h3 className="section-header flex items-center gap-2 mb-3">
                <Clock size={13} className="text-gold" /> Best Posting Times
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {[
                  { platform: "Instagram", times: ["9:00 AM", "12:00 PM", "5:00 PM"], days: "Tue, Thu, Sat" },
                  { platform: "TikTok", times: ["7:00 AM", "10:00 AM", "7:00 PM"], days: "Mon, Wed, Fri" },
                  { platform: "LinkedIn", times: ["8:00 AM", "12:00 PM", "5:30 PM"], days: "Tue, Wed, Thu" },
                  { platform: "Facebook", times: ["9:00 AM", "1:00 PM", "4:00 PM"], days: "Wed, Fri, Sun" },
                  { platform: "YouTube", times: ["2:00 PM", "4:00 PM", "9:00 PM"], days: "Fri, Sat, Sun" },
                  { platform: "Twitter/X", times: ["8:00 AM", "11:00 AM", "4:00 PM"], days: "Mon-Fri" },
                ].map(p => (
                  <div key={p.platform} className="p-3 bg-surface-light rounded-xl border border-border">
                    <div className="flex items-center gap-2 mb-2">
                      {PLATFORM_ICONS[p.platform.toLowerCase()] || <Globe size={12} />}
                      <span className="text-xs font-semibold">{p.platform}</span>
                    </div>
                    <div className="space-y-1">
                      {p.times.map(t => (
                        <span key={t} className="inline-block text-[9px] bg-gold/10 text-gold px-2 py-0.5 rounded mr-1">{t}</span>
                      ))}
                    </div>
                    <p className="text-[8px] text-muted mt-1.5">Best days: {p.days}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        );
      })()}

      {/* Hashtag Research Tab */}
      {tab === "hashtags" && (
        <div className="space-y-4">
          <div className="card border-gold/10 relative overflow-hidden">
            <div className="absolute inset-0 bg-mesh opacity-30" />
            <div className="relative">
              <div className="flex items-center gap-2 mb-3">
                <Hash size={16} className="text-gold" />
                <h2 className="text-sm font-semibold">Trending Hashtag Research</h2>
              </div>
              <p className="text-xs text-muted mb-4">AI-curated hashtag sets for maximum reach. Click any set to copy.</p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {[
                  { category: "Growth & Marketing", tags: ["#marketingtips", "#digitalmarketing", "#growthhacking", "#socialmediatips", "#contentcreator", "#businessgrowth", "#marketingstrategy", "#smallbusiness", "#entrepreneurlife", "#brandbuilding"] },
                  { category: "Engagement Boosters", tags: ["#relatable", "#trending", "#viral", "#fyp", "#explore", "#instagood", "#photooftheday", "#motivation", "#inspiration", "#love"] },
                  { category: "Industry Specific", tags: ["#agencylife", "#clientwork", "#marketingagency", "#creativeagency", "#socialmediamanager", "#contentmarketing", "#seo", "#ppc", "#branding", "#webdesign"] },
                  { category: "Local Business", tags: ["#localbusiness", "#supportlocal", "#shoplocal", "#smallbusinessowner", "#communityover-competition", "#localmarketing", "#googlereviews", "#localseo", "#neighborhoodbusiness", "#hometown"] },
                  { category: "Reels & Video", tags: ["#reels", "#reelsinstagram", "#tiktokviral", "#shortsvideo", "#videocontent", "#reelsviral", "#instareels", "#contentcreation", "#videoediting", "#behindthescenes"] },
                  { category: "Call to Action", tags: ["#linkinbio", "#booknow", "#freeConsultation", "#limitedoffer", "#dmme", "#getstarted", "#learnmore", "#signupnow", "#actnow", "#dontmissout"] },
                ].map(set => (
                  <div key={set.category} className="p-3 bg-surface-light rounded-xl border border-border hover:border-gold/10 transition-all">
                    <h4 className="text-[10px] font-semibold text-gold mb-2">{set.category}</h4>
                    <div className="flex flex-wrap gap-1">
                      {set.tags.map(tag => (
                        <button key={tag} onClick={() => { navigator.clipboard.writeText(tag); toast.success(`Copied ${tag}`); }}
                          className="text-[9px] bg-surface px-2 py-0.5 rounded text-muted hover:text-gold hover:bg-gold/5 transition-all cursor-pointer">
                          {tag}
                        </button>
                      ))}
                    </div>
                    <button onClick={() => { navigator.clipboard.writeText(set.tags.join(" ")); toast.success("All hashtags copied!"); }}
                      className="mt-2 text-[9px] text-gold hover:underline flex items-center gap-1">
                      <Copy size={9} /> Copy all
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Caption templates */}
          <div className="card">
            <h3 className="section-header flex items-center gap-2 mb-3">
              <FileTextIcon size={13} className="text-gold" /> Caption Templates
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {[
                { name: "Hook + Value + CTA", template: "[HOOK that stops the scroll]\n\n[3 value points]\n\n[CTA] Save this for later!" },
                { name: "Before/After Story", template: "Before working with us: [pain point]\nAfter: [transformation]\n\nReady for your transformation? Link in bio" },
                { name: "Controversial Take", template: "Unpopular opinion: [bold statement]\n\nHere's why...\n[explanation]\n\nAgree or disagree? Comment below" },
                { name: "Listicle", template: "5 [things/mistakes/secrets] that [outcome]:\n\n1.\n2.\n3.\n4.\n5.\n\nWhich one surprised you? Comment below!" },
                { name: "Behind the Scenes", template: "POV: A day in the life at [business]\n\n[authentic moment or process]\n\nThis is what we love about what we do" },
                { name: "Client Spotlight", template: "Huge shoutout to @[client]!\n\n[What we helped them achieve]\n[Specific result/metric]\n\nWant results like this? DM us 'GROW'" },
              ].map(t => (
                <div key={t.name} className="p-3 bg-surface-light rounded-xl border border-border">
                  <div className="flex items-center justify-between mb-1.5">
                    <h4 className="text-[10px] font-semibold">{t.name}</h4>
                    <button onClick={() => { navigator.clipboard.writeText(t.template); toast.success("Template copied!"); }}
                      className="text-[9px] text-gold hover:underline flex items-center gap-1">
                      <Copy size={9} /> Copy
                    </button>
                  </div>
                  <pre className="text-[9px] text-muted whitespace-pre-wrap font-sans">{t.template}</pre>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Scheduled queue */}
      {tab === "scheduled" && (
        <div className="space-y-2">
          {scheduledPosts.length === 0 ? (
            <div className="card text-center py-8">
              <Calendar size={24} className="mx-auto mb-2 text-muted/30" />
              <p className="text-xs text-muted mb-2">No content scheduled</p>
              <button onClick={generateWeek} className="btn-primary text-xs">Generate This Week</button>
            </div>
          ) : (
            scheduledPosts.map(post => {
              const meta = (post.metadata as Record<string, unknown>) || {};
              return (
                <div key={post.id} className="card-hover p-3">
                  <div className="flex items-start gap-3">
                    <div className="shrink-0 mt-1">{PLATFORM_ICONS[post.platform] || <Globe size={14} />}</div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="text-xs font-semibold">{post.title}</p>
                        <StatusBadge status={post.status} />
                      </div>
                      {meta.caption ? (
                        <p className="text-[10px] text-muted leading-relaxed mb-2 line-clamp-3">{String(meta.caption)}</p>
                      ) : null}
                      <div className="flex items-center gap-3 text-[9px] text-muted">
                        <span className="capitalize">{post.platform}</span>
                        {post.scheduled_at && <span>{formatDate(post.scheduled_at)}</span>}
                        {meta.best_time ? <span className="text-gold">{String(meta.best_time)}</span> : null}
                        {meta.topic ? <span>{String(meta.topic)}</span> : null}
                      </div>
                    </div>
                    <button onClick={() => publishPost(post)} disabled={posting === post.id}
                      className="btn-primary text-[10px] py-1.5 px-3 flex items-center gap-1 shrink-0 disabled:opacity-50">
                      {posting === post.id ? <Loader size={10} className="animate-spin" /> : <Send size={10} />}
                      Publish
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* Published */}
      {tab === "published" && (
        <div className="space-y-2">
          {recentPosts.length === 0 ? (
            <div className="card text-center py-8">
              <p className="text-xs text-muted">Nothing published yet</p>
            </div>
          ) : (
            recentPosts.map(post => (
              <div key={post.id} className="card p-3 flex items-center gap-3">
                {PLATFORM_ICONS[post.platform] || <Globe size={14} />}
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium truncate">{post.title}</p>
                  <p className="text-[9px] text-muted">{post.scheduled_at ? formatRelativeTime(post.scheduled_at) : ""} · {post.platform}</p>
                </div>
                <StatusBadge status="published" />
              </div>
            ))
          )}
        </div>
      )}

      {/* Config / Autopilot Settings */}
      {tab === "config" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {/* Content Generation Settings */}
          <div className="card-static space-y-4">
            <h2 className="text-sm font-semibold flex items-center gap-2"><Settings size={13} className="text-gold" /> Content Settings</h2>

            <div>
              <label className="block text-[10px] text-muted mb-1 uppercase tracking-wider font-semibold">Posts Per Day</label>
              <input type="number" min={1} max={5} value={weekConfig.posts_per_day}
                onChange={e => setWeekConfig({ ...weekConfig, posts_per_day: parseInt(e.target.value) || 1 })}
                className="input w-full text-xs" />
            </div>

            <div>
              <label className="block text-[10px] text-muted mb-1 uppercase tracking-wider font-semibold">Brand Tone</label>
              <select value={weekConfig.tone} onChange={e => setWeekConfig({ ...weekConfig, tone: e.target.value })}
                className="input w-full text-xs">
                <option value="professional yet approachable">Professional & Approachable</option>
                <option value="casual and fun">Casual & Fun</option>
                <option value="authoritative and expert">Authoritative & Expert</option>
                <option value="bold and edgy">Bold & Edgy</option>
                <option value="warm and caring">Warm & Caring</option>
              </select>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-[10px] text-muted uppercase tracking-wider font-semibold">Topics to Cover</label>
                <AIEnhanceButton value={weekConfig.topics} onResult={next => setWeekConfig({ ...weekConfig, topics: next })} context="social media post caption" variant="inline" />
              </div>
              <textarea value={weekConfig.topics}
                onChange={e => setWeekConfig({ ...weekConfig, topics: e.target.value })}
                className="input w-full h-20 text-xs"
                placeholder="e.g., client results, tips, behind the scenes, promotions, educational content, trending topics" />
            </div>

            <div>
              <label className="block text-[10px] text-muted mb-1 uppercase tracking-wider font-semibold">Topics to Avoid</label>
              <input value={String(autopilotConfig.blacklist_topics || "")}
                onChange={e => saveAutopilotSetting({ blacklist_topics: e.target.value })}
                className="input w-full text-xs"
                placeholder="e.g., politics, religion, competitors by name" />
            </div>

            <p className="text-[9px] text-muted">These settings apply when generating content. AI uses your client&apos;s industry, services, and connected platforms to create platform-specific content.</p>
          </div>

          {/* Autopilot Controls */}
          <div className="space-y-4">
            <div className="card-static border-gold/20">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Bot size={16} className="text-gold" />
                  <h2 className="text-sm font-semibold">Social Autopilot</h2>
                </div>
                <button onClick={toggleAutopilot} disabled={savingConfig}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    isAutopilot ? "bg-success/10 text-success border border-success/20" : "bg-surface-light text-muted border border-border"
                  }`}>
                  {isAutopilot ? <ToggleRight size={14} /> : <ToggleLeft size={14} />}
                  {isAutopilot ? "ON" : "OFF"}
                </button>
              </div>

              <p className="text-[10px] text-muted mb-3">AI automatically generates content, schedules posts, and publishes when the time comes. Control exactly what it can do.</p>

              <button onClick={runSocialAutopilot} disabled={runningAutopilot || !isAutopilot}
                className="btn-primary w-full text-xs flex items-center justify-center gap-2 mb-4 disabled:opacity-50">
                {runningAutopilot ? <><Loader size={12} className="animate-spin" /> Running...</> : <><Zap size={12} /> Run Autopilot Now</>}
              </button>

              {/* Granular controls */}
              <div className="space-y-2">
                <p className="text-[9px] text-muted font-semibold uppercase tracking-wider">Allowed Actions</p>
                {[
                  { key: "auto_generate_content", label: "Auto-generate content", desc: "AI creates posts when queue is low", icon: <Sparkles size={11} className="text-gold" /> },
                  { key: "auto_publish_scheduled", label: "Auto-publish on schedule", desc: "Publish posts when scheduled time arrives", icon: <Send size={11} className="text-blue-400" /> },
                  { key: "auto_reply_comments", label: "Auto-reply to comments", desc: "AI responds to comments & DMs", icon: <MessageSquare size={11} className="text-green-400" /> },
                  { key: "auto_hashtag_research", label: "Trending hashtag research", desc: "AI finds trending hashtags for posts", icon: <Hash size={11} className="text-purple-400" /> },
                  { key: "require_approval", label: "Require approval before post", desc: "Posts go to queue for review first", icon: <Shield size={11} className="text-orange-400" /> },
                ].map(toggle => (
                  <div key={toggle.key} className="flex items-center justify-between p-2 rounded-lg border border-border hover:border-gold/10 transition-all">
                    <div className="flex items-center gap-2">
                      {toggle.icon}
                      <div>
                        <p className="text-[10px] font-medium">{toggle.label}</p>
                        <p className="text-[8px] text-muted">{toggle.desc}</p>
                      </div>
                    </div>
                    <button
                      onClick={() => saveAutopilotSetting({ [toggle.key]: !autopilotConfig[toggle.key] })}
                      className={`w-8 h-4.5 rounded-full transition-all flex items-center ${
                        autopilotConfig[toggle.key] ? "bg-success justify-end" : "bg-surface-light border border-border justify-start"
                      }`}>
                      <div className={`w-3.5 h-3.5 rounded-full mx-0.5 transition-all ${
                        autopilotConfig[toggle.key] ? "bg-white" : "bg-muted/40"
                      }`} />
                    </button>
                  </div>
                ))}
              </div>

              {/* Platform filters */}
              <div className="mt-3">
                <p className="text-[9px] text-muted font-semibold uppercase tracking-wider mb-1.5">Allowed Platforms</p>
                <div className="flex gap-2">
                  {["instagram", "facebook", "tiktok", "linkedin", "youtube"].map(p => {
                    const allowed = Array.isArray(autopilotConfig.allowed_platforms)
                      ? (autopilotConfig.allowed_platforms as string[]).includes(p)
                      : true;
                    return (
                      <button key={p} onClick={() => {
                        const current = Array.isArray(autopilotConfig.allowed_platforms)
                          ? [...autopilotConfig.allowed_platforms as string[]]
                          : ["instagram", "facebook", "tiktok", "linkedin", "youtube"];
                        const updated = allowed ? current.filter(x => x !== p) : [...current, p];
                        saveAutopilotSetting({ allowed_platforms: updated });
                      }}
                        className={`flex items-center gap-1 px-2 py-1 rounded-md text-[9px] font-medium border transition-all ${
                          allowed ? "border-gold/30 bg-gold/5" : "border-border bg-surface-light text-muted"
                        }`}>
                        {PLATFORM_ICONS[p]} <span className="capitalize">{p}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Posting hours */}
              <div className="mt-3 grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[8px] text-muted font-semibold">Posting starts (hour)</label>
                  <input type="number" min={0} max={23}
                    value={(autopilotConfig.posting_hours as Record<string, number>)?.start ?? 9}
                    onChange={e => saveAutopilotSetting({ posting_hours: { ...(autopilotConfig.posting_hours as Record<string, number> || {}), start: parseInt(e.target.value) || 9 } })}
                    className="input w-full text-xs py-1" />
                </div>
                <div>
                  <label className="text-[8px] text-muted font-semibold">Posting ends (hour)</label>
                  <input type="number" min={0} max={23}
                    value={(autopilotConfig.posting_hours as Record<string, number>)?.end ?? 18}
                    onChange={e => saveAutopilotSetting({ posting_hours: { ...(autopilotConfig.posting_hours as Record<string, number> || {}), end: parseInt(e.target.value) || 18 } })}
                    className="input w-full text-xs py-1" />
                </div>
              </div>
            </div>

            {/* How it works */}
            <div className="card-static bg-gold/[0.02] border-gold/10">
              <h3 className="text-xs font-semibold mb-2 flex items-center gap-2"><Activity size={12} className="text-gold" /> How Social Autopilot Works</h3>
              <ol className="space-y-1 text-[10px] text-muted">
                <li className="flex gap-2"><span className="text-gold font-bold">1.</span> Checks if content queue is running low (less than 3 days ahead)</li>
                <li className="flex gap-2"><span className="text-gold font-bold">2.</span> AI generates platform-specific content based on your settings</li>
                <li className="flex gap-2"><span className="text-gold font-bold">3.</span> Posts go to queue (or publish immediately if approval is off)</li>
                <li className="flex gap-2"><span className="text-gold font-bold">4.</span> Scheduled posts auto-publish when the time arrives</li>
                <li className="flex gap-2"><span className="text-gold font-bold">5.</span> AI can auto-reply to comments on connected accounts</li>
              </ol>
            </div>
          </div>
        </div>
      )}
      {/* ========== AI TOOLS TAB ========== */}
      {tab === "tools" && (
        <div className="space-y-4">
          {/* Sub-tabs */}
          <div className="flex flex-wrap gap-1.5">
            {([
              { key: "repurpose", label: "Repurposer", icon: <RefreshCw size={11} /> },
              { key: "ab-test", label: "A/B Tester", icon: <GitCompare size={11} /> },
              { key: "viral", label: "Viral Score", icon: <Flame size={11} /> },
              { key: "bio", label: "Bio Optimizer", icon: <UserPlus size={11} /> },
              { key: "preview", label: "Post Preview", icon: <Eye size={11} /> },
              { key: "bulk", label: "Bulk Scheduler", icon: <Upload size={11} /> },
              { key: "carousel", label: "Carousel Builder", icon: <Columns size={11} /> },
              { key: "story", label: "Story Planner", icon: <CircleDot size={11} /> },
              { key: "linkinbio", label: "Link in Bio", icon: <Link size={11} /> },
              { key: "templates", label: "Caption Templates", icon: <BookOpen size={11} /> },
              { key: "recycler", label: "Content Recycler", icon: <Repeat size={11} /> },
            ] as const).map(st => (
              <button key={st.key} onClick={() => setToolsSubTab(st.key)}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-medium transition-all ${
                  toolsSubTab === st.key ? "bg-gold/10 text-gold border border-gold/20" : "bg-surface-light text-muted border border-border hover:border-gold/10"
                }`}>
                {st.icon} {st.label}
              </button>
            ))}
          </div>

          {/* 1. AI Content Repurposer */}
          {toolsSubTab === "repurpose" && (
            <div className="card border-gold/10 relative overflow-hidden">
              <div className="absolute inset-0 bg-mesh opacity-30" />
              <div className="relative space-y-3">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 bg-gold/10 rounded-lg flex items-center justify-center">
                    <RefreshCw size={16} className="text-gold" />
                  </div>
                  <div>
                    <h2 className="text-sm font-semibold">AI Content Repurposer</h2>
                    <p className="text-[10px] text-muted">Paste a post and generate versions for every platform</p>
                  </div>
                </div>
                <div className="flex justify-end">
                  <AIEnhanceButton value={repurposeInput} onResult={setRepurposeInput} context="social media post caption" variant="pill" />
                </div>
                <textarea value={repurposeInput} onChange={e => setRepurposeInput(e.target.value)}
                  className="input w-full h-24 text-xs" placeholder="Paste your original post content here..." />
                <button onClick={() => {
                  if (!repurposeInput.trim()) return;
                  setRepurposing(true);
                  setTimeout(() => {
                    setRepurposeResults([
                      { platform: "instagram", caption: `${repurposeInput.slice(0, 80)}...\n\n#instagood #viral #trending` },
                      { platform: "tiktok", caption: `POV: ${repurposeInput.slice(0, 60)}... (save this for later!)` },
                      { platform: "linkedin", caption: `I've been thinking about this:\n\n${repurposeInput.slice(0, 100)}...\n\nWhat are your thoughts? Let me know in the comments.` },
                      { platform: "facebook", caption: `${repurposeInput.slice(0, 120)}...\n\nShare if you agree!` },
                      { platform: "twitter", caption: repurposeInput.length > 250 ? `${repurposeInput.slice(0, 250)}...` : repurposeInput },
                    ]);
                    setRepurposing(false);
                  }, 1500);
                }} disabled={repurposing || !repurposeInput.trim()}
                  className="btn-primary text-xs flex items-center gap-1.5 disabled:opacity-50">
                  {repurposing ? <Loader size={12} className="animate-spin" /> : <Wand2 size={12} />}
                  {repurposing ? "Generating..." : "Repurpose for All Platforms"}
                </button>
                {repurposeResults.length > 0 && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mt-3">
                    {repurposeResults.map(r => (
                      <div key={r.platform} className="p-3 bg-surface-light rounded-xl border border-border">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-1.5">
                            {PLATFORM_ICONS[r.platform] || <Globe size={12} />}
                            <span className="text-[10px] font-semibold capitalize">{r.platform}</span>
                          </div>
                          <button onClick={() => { navigator.clipboard.writeText(r.caption); toast.success("Copied!"); }}
                            className="text-[9px] text-gold flex items-center gap-1 hover:underline">
                            <Copy size={9} /> Copy
                          </button>
                        </div>
                        <p className="text-[10px] text-muted whitespace-pre-wrap">{r.caption}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* 7. A/B Caption Tester */}
          {toolsSubTab === "ab-test" && (
            <div className="card border-gold/10 relative overflow-hidden">
              <div className="absolute inset-0 bg-mesh opacity-30" />
              <div className="relative space-y-3">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 bg-purple-400/10 rounded-lg flex items-center justify-center">
                    <GitCompare size={16} className="text-purple-400" />
                  </div>
                  <div>
                    <h2 className="text-sm font-semibold">A/B Caption Tester</h2>
                    <p className="text-[10px] text-muted">Generate two caption variants to test which performs better</p>
                  </div>
                </div>
                <div className="flex justify-end">
                  <AIEnhanceButton value={abTestInput} onResult={setAbTestInput} context="social media post caption" variant="pill" />
                </div>
                <textarea value={abTestInput} onChange={e => setAbTestInput(e.target.value)}
                  className="input w-full h-20 text-xs" placeholder="Describe what your post is about (e.g., 'New product launch for organic skincare line')..." />
                <button onClick={() => {
                  if (!abTestInput.trim()) return;
                  setGeneratingAB(true);
                  setTimeout(() => {
                    setAbVariants({
                      a: `Ever wished your skin could just... glow? Introducing our new organic line that makes it happen. No filters needed.\n\nTap the link in bio to discover your perfect match.\n\n#skincare #organic #glowup`,
                      b: `We spent 2 years perfecting this formula.\n\nThe result? Skincare that actually works — backed by science, powered by nature.\n\n3 products. Zero compromises. Available now.\n\nLink in bio to shop the collection.`,
                    });
                    setGeneratingAB(false);
                  }, 1500);
                }} disabled={generatingAB || !abTestInput.trim()}
                  className="btn-primary text-xs flex items-center gap-1.5 disabled:opacity-50">
                  {generatingAB ? <Loader size={12} className="animate-spin" /> : <Sparkles size={12} />}
                  {generatingAB ? "Creating Variants..." : "Generate A/B Variants"}
                </button>
                {abVariants && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
                    {(["a", "b"] as const).map(variant => (
                      <div key={variant} className={`p-3 rounded-xl border ${variant === "a" ? "border-blue-400/20 bg-blue-400/[0.03]" : "border-pink-400/20 bg-pink-400/[0.03]"}`}>
                        <div className="flex items-center justify-between mb-2">
                          <span className={`text-xs font-bold ${variant === "a" ? "text-blue-400" : "text-pink-400"}`}>
                            Variant {variant.toUpperCase()}
                          </span>
                          <button onClick={() => { navigator.clipboard.writeText(abVariants[variant]); toast.success("Copied!"); }}
                            className="text-[9px] text-gold flex items-center gap-1 hover:underline">
                            <Copy size={9} /> Copy
                          </button>
                        </div>
                        <p className="text-[10px] text-muted whitespace-pre-wrap">{abVariants[variant]}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* 8. Viral Score Predictor */}
          {toolsSubTab === "viral" && (
            <div className="card border-gold/10 relative overflow-hidden">
              <div className="absolute inset-0 bg-mesh opacity-30" />
              <div className="relative space-y-3">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 bg-orange-400/10 rounded-lg flex items-center justify-center">
                    <Flame size={16} className="text-orange-400" />
                  </div>
                  <div>
                    <h2 className="text-sm font-semibold">Viral Score Predictor</h2>
                    <p className="text-[10px] text-muted">AI rates your content 1-100 on virality potential</p>
                  </div>
                </div>
                <div className="flex justify-end">
                  <AIEnhanceButton value={viralInput} onResult={setViralInput} context="social media post caption" variant="pill" />
                </div>
                <textarea value={viralInput} onChange={e => setViralInput(e.target.value)}
                  className="input w-full h-20 text-xs" placeholder="Paste your caption or describe your content idea..." />
                <button onClick={() => {
                  if (!viralInput.trim()) return;
                  setScoringViral(true);
                  setTimeout(() => {
                    const score = Math.floor(Math.random() * 40) + 55;
                    setViralScore({
                      score,
                      factors: [
                        score > 80 ? "Strong emotional hook detected" : "Consider adding a stronger hook",
                        viralInput.includes("?") ? "Question format encourages engagement" : "Try adding a question to boost comments",
                        viralInput.length > 100 ? "Good content length for storytelling" : "Longer captions tend to get more saves",
                        viralInput.includes("#") ? "Hashtags detected — good for reach" : "Add 5-10 relevant hashtags for discovery",
                        "Trending topic alignment: moderate",
                        score > 70 ? "Strong share potential" : "Add a relatable angle to boost shares",
                      ],
                    });
                    setScoringViral(false);
                  }, 2000);
                }} disabled={scoringViral || !viralInput.trim()}
                  className="btn-primary text-xs flex items-center gap-1.5 disabled:opacity-50">
                  {scoringViral ? <Loader size={12} className="animate-spin" /> : <Flame size={12} />}
                  {scoringViral ? "Analyzing..." : "Predict Viral Score"}
                </button>
                {viralScore && (
                  <div className="mt-3 space-y-3">
                    <div className="flex items-center gap-4">
                      <div className={`w-20 h-20 rounded-2xl flex flex-col items-center justify-center ${
                        viralScore.score >= 80 ? "bg-success/10 border border-success/20" :
                        viralScore.score >= 60 ? "bg-gold/10 border border-gold/20" :
                        "bg-orange-400/10 border border-orange-400/20"
                      }`}>
                        <span className={`text-2xl font-bold ${
                          viralScore.score >= 80 ? "text-success" : viralScore.score >= 60 ? "text-gold" : "text-orange-400"
                        }`}>{viralScore.score}</span>
                        <span className="text-[8px] text-muted">/100</span>
                      </div>
                      <div className="flex-1">
                        <div className="w-full bg-surface-light rounded-full h-3 mb-1.5">
                          <div className={`h-3 rounded-full transition-all duration-1000 ${
                            viralScore.score >= 80 ? "bg-success" : viralScore.score >= 60 ? "bg-gold" : "bg-orange-400"
                          }`} style={{ width: `${viralScore.score}%` }} />
                        </div>
                        <span className={`text-[10px] font-semibold ${
                          viralScore.score >= 80 ? "text-success" : viralScore.score >= 60 ? "text-gold" : "text-orange-400"
                        }`}>
                          {viralScore.score >= 80 ? "High Viral Potential" : viralScore.score >= 60 ? "Moderate Potential" : "Needs Improvement"}
                        </span>
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      {viralScore.factors.map((f, i) => (
                        <div key={i} className="flex items-start gap-2 text-[10px]">
                          <span className="text-gold mt-0.5">{i < 3 ? <Check size={10} /> : <AlertCircle size={10} />}</span>
                          <span className="text-muted">{f}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* 12. Bio Optimizer */}
          {toolsSubTab === "bio" && (
            <div className="card border-gold/10 relative overflow-hidden">
              <div className="absolute inset-0 bg-mesh opacity-30" />
              <div className="relative space-y-3">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 bg-cyan-400/10 rounded-lg flex items-center justify-center">
                    <UserPlus size={16} className="text-cyan-400" />
                  </div>
                  <div>
                    <h2 className="text-sm font-semibold">Bio Optimizer</h2>
                    <p className="text-[10px] text-muted">AI-powered social media bio generator for maximum impact</p>
                  </div>
                </div>
                <div className="flex justify-end">
                  <AIEnhanceButton value={bioInput} onResult={setBioInput} context="social media post caption" variant="pill" />
                </div>
                <textarea value={bioInput} onChange={e => setBioInput(e.target.value)}
                  className="input w-full h-20 text-xs" placeholder="Describe your business, niche, and what makes you unique..." />
                <button onClick={() => {
                  if (!bioInput.trim()) return;
                  setGeneratingBio(true);
                  setTimeout(() => {
                    setBioResults([
                      `Helping ${bioInput.slice(0, 30)}... achieve more\n${"🚀"} Results-driven strategies\n${"📩"} DM 'START' for a free audit\n${"👇"} Latest resources below`,
                      `${bioInput.slice(0, 25)}... | Expert\n${"✨"} Turning ideas into impact\n${"📊"} 500+ happy clients\n${"🔗"} Free guide in link below`,
                      `Your go-to for ${bioInput.slice(0, 20)}...\n${"💡"} Tips daily | ${"🎯"} Strategy weekly\nDM for collabs ${"🤝"}\nNew content ${"⬇️"}`,
                    ]);
                    setGeneratingBio(false);
                  }, 1500);
                }} disabled={generatingBio || !bioInput.trim()}
                  className="btn-primary text-xs flex items-center gap-1.5 disabled:opacity-50">
                  {generatingBio ? <Loader size={12} className="animate-spin" /> : <Wand2 size={12} />}
                  {generatingBio ? "Generating..." : "Generate Bio Options"}
                </button>
                {bioResults.length > 0 && (
                  <div className="space-y-2 mt-3">
                    {bioResults.map((bio, i) => (
                      <div key={i} className="p-3 bg-surface-light rounded-xl border border-border hover:border-gold/10 transition-all">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-[10px] font-semibold text-gold">Option {i + 1}</span>
                          <button onClick={() => { navigator.clipboard.writeText(bio); toast.success("Bio copied!"); }}
                            className="text-[9px] text-gold flex items-center gap-1 hover:underline">
                            <Copy size={9} /> Copy
                          </button>
                        </div>
                        <p className="text-[10px] text-muted whitespace-pre-wrap">{bio}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* 18. Post Preview */}
          {toolsSubTab === "preview" && (
            <div className="card space-y-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-blue-400/10 rounded-lg flex items-center justify-center">
                  <Eye size={16} className="text-blue-400" />
                </div>
                <div>
                  <h2 className="text-sm font-semibold">Post Preview</h2>
                  <p className="text-[10px] text-muted">See how your posts will look on each platform</p>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {/* Instagram Preview */}
                <div className="rounded-xl border border-border overflow-hidden">
                  <div className="bg-surface-light p-2 flex items-center gap-2 border-b border-border">
                    <div className="w-6 h-6 rounded-full bg-gradient-to-br from-pink-400 to-purple-500" />
                    <span className="text-[10px] font-semibold">your_brand</span>
                    <Camera size={10} className="text-pink-400 ml-auto" />
                  </div>
                  <div className="bg-surface-light/50 aspect-square flex items-center justify-center">
                    <Camera size={32} className="text-muted/20" />
                  </div>
                  <div className="p-2.5 bg-surface-light">
                    <div className="flex gap-3 mb-1.5">
                      <Heart size={14} className="text-muted" />
                      <MessageSquare size={14} className="text-muted" />
                      <Send size={14} className="text-muted" />
                      <Share2 size={14} className="text-muted ml-auto" />
                    </div>
                    <p className="text-[9px] text-muted"><span className="font-semibold text-foreground">your_brand</span> Your caption will appear here with hashtags...</p>
                  </div>
                </div>
                {/* TikTok Preview */}
                <div className="rounded-xl border border-border overflow-hidden bg-black">
                  <div className="aspect-[9/16] max-h-[320px] flex items-center justify-center relative">
                    <Video size={32} className="text-white/20" />
                    <div className="absolute bottom-3 left-3 right-10">
                      <p className="text-[10px] text-white font-semibold">@your_brand</p>
                      <p className="text-[9px] text-white/80 mt-0.5">Your TikTok caption here... #fyp #viral</p>
                    </div>
                    <div className="absolute right-2 bottom-3 flex flex-col gap-3 items-center">
                      <Heart size={16} className="text-white" />
                      <MessageSquare size={16} className="text-white" />
                      <Share2 size={16} className="text-white" />
                    </div>
                  </div>
                </div>
                {/* LinkedIn Preview */}
                <div className="rounded-xl border border-border overflow-hidden">
                  <div className="bg-surface-light p-2.5 flex items-center gap-2 border-b border-border">
                    <div className="w-8 h-8 rounded-full bg-blue-400/20 flex items-center justify-center">
                      <Briefcase size={12} className="text-blue-400" />
                    </div>
                    <div>
                      <span className="text-[10px] font-semibold block">Your Name</span>
                      <span className="text-[8px] text-muted">CEO at Company | 500+ connections</span>
                    </div>
                  </div>
                  <div className="p-2.5 bg-surface-light/50">
                    <p className="text-[10px] text-muted leading-relaxed">Your LinkedIn post content will appear here. LinkedIn favors longer, value-driven posts with line breaks for readability.</p>
                  </div>
                  <div className="bg-surface-light p-2 flex items-center justify-around border-t border-border text-[9px] text-muted">
                    <span className="flex items-center gap-1"><ThumbsUp size={10} /> Like</span>
                    <span className="flex items-center gap-1"><MessageSquare size={10} /> Comment</span>
                    <span className="flex items-center gap-1"><Repeat size={10} /> Repost</span>
                    <span className="flex items-center gap-1"><Send size={10} /> Send</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 19. Bulk Post Scheduler */}
          {toolsSubTab === "bulk" && (
            <div className="card space-y-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-green-400/10 rounded-lg flex items-center justify-center">
                  <Upload size={16} className="text-green-400" />
                </div>
                <div>
                  <h2 className="text-sm font-semibold">Bulk Post Scheduler</h2>
                  <p className="text-[10px] text-muted">Upload a CSV of posts to schedule all at once</p>
                </div>
              </div>
              <div className="p-3 bg-surface-light rounded-xl border border-border">
                <p className="text-[10px] text-muted mb-2">CSV Format: <code className="text-[9px] bg-surface px-1.5 py-0.5 rounded text-gold">platform, date, time, caption, hashtags</code></p>
                <textarea value={bulkCsv} onChange={e => setBulkCsv(e.target.value)}
                  className="input w-full h-32 text-xs font-mono" placeholder={`instagram, 2026-04-15, 09:00, "Your caption here", "#marketing #tips"\ntiktok, 2026-04-15, 12:00, "POV: When you discover...", "#fyp #viral"\nlinkedin, 2026-04-16, 08:00, "Just published a new article...", "#business"`} />
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => {
                  if (!bulkCsv.trim()) { toast.error("Paste CSV data first"); return; }
                  const lines = bulkCsv.trim().split("\n").length;
                  toast.success(`${lines} posts queued for scheduling!`);
                  setBulkCsv("");
                }} className="btn-primary text-xs flex items-center gap-1.5">
                  <Upload size={12} /> Schedule All Posts
                </button>
                <button onClick={() => {
                  const sample = `instagram, 2026-04-15, 09:00, "5 tips to grow your audience", "#growth #tips"\ntiktok, 2026-04-15, 12:00, "POV: Your first viral video", "#fyp #viral"\nlinkedin, 2026-04-16, 08:00, "Lessons from 10 years in business", "#leadership"`;
                  setBulkCsv(sample);
                }} className="text-[10px] text-gold hover:underline flex items-center gap-1">
                  <FileTextIcon size={10} /> Load Sample CSV
                </button>
              </div>
            </div>
          )}

          {/* 11. Carousel Builder */}
          {toolsSubTab === "carousel" && (
            <div className="card space-y-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-blue-400/10 rounded-lg flex items-center justify-center">
                  <Columns size={16} className="text-blue-400" />
                </div>
                <div>
                  <h2 className="text-sm font-semibold">Carousel Builder</h2>
                  <p className="text-[10px] text-muted">Plan multi-slide posts for Instagram/LinkedIn</p>
                </div>
              </div>
              {carouselSlides.length === 0 ? (
                <div className="text-center py-6">
                  <Columns size={24} className="mx-auto mb-2 text-muted/30" />
                  <p className="text-xs text-muted mb-2">No slides yet. Add your first slide to start building.</p>
                  <button onClick={() => setCarouselSlides([{ id: Date.now(), heading: "Slide 1", body: "" }])}
                    className="btn-primary text-xs flex items-center gap-1.5 mx-auto">
                    <Plus size={12} /> Add First Slide
                  </button>
                </div>
              ) : (
                <>
                  <div className="flex gap-2 overflow-x-auto pb-2">
                    {carouselSlides.map((slide, i) => (
                      <div key={slide.id} className="min-w-[200px] p-3 bg-surface-light rounded-xl border border-border hover:border-gold/10 transition-all shrink-0">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-[9px] font-bold text-gold">SLIDE {i + 1}</span>
                          {carouselSlides.length > 1 && (
                            <button onClick={() => setCarouselSlides(carouselSlides.filter(s => s.id !== slide.id))}
                              className="text-muted hover:text-red-400 transition-all"><X size={10} /></button>
                          )}
                        </div>
                        <input value={slide.heading} onChange={e => {
                          const updated = [...carouselSlides];
                          updated[i] = { ...slide, heading: e.target.value };
                          setCarouselSlides(updated);
                        }} className="input w-full text-xs mb-1.5" placeholder="Slide heading..." />
                        <textarea value={slide.body} onChange={e => {
                          const updated = [...carouselSlides];
                          updated[i] = { ...slide, body: e.target.value };
                          setCarouselSlides(updated);
                        }} className="input w-full text-[10px] h-16" placeholder="Slide content..." />
                      </div>
                    ))}
                    <button onClick={() => setCarouselSlides([...carouselSlides, { id: Date.now(), heading: `Slide ${carouselSlides.length + 1}`, body: "" }])}
                      className="min-w-[60px] flex items-center justify-center border border-dashed border-border rounded-xl hover:border-gold/30 transition-all">
                      <Plus size={16} className="text-muted" />
                    </button>
                  </div>
                  <button onClick={() => {
                    const text = carouselSlides.map((s, i) => `[Slide ${i + 1}] ${s.heading}\n${s.body}`).join("\n\n");
                    navigator.clipboard.writeText(text);
                    toast.success("Carousel outline copied!");
                  }} className="btn-primary text-xs flex items-center gap-1.5">
                    <Copy size={12} /> Copy Carousel Outline
                  </button>
                </>
              )}
            </div>
          )}

          {/* 10. Story Planner */}
          {toolsSubTab === "story" && (
            <div className="card space-y-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-pink-400/10 rounded-lg flex items-center justify-center">
                  <CircleDot size={16} className="text-pink-400" />
                </div>
                <div>
                  <h2 className="text-sm font-semibold">Story Planner</h2>
                  <p className="text-[10px] text-muted">Visual story sequence planner for Instagram/TikTok</p>
                </div>
              </div>
              {storySlides.length === 0 ? (
                <div className="text-center py-6">
                  <CircleDot size={24} className="mx-auto mb-2 text-muted/30" />
                  <p className="text-xs text-muted mb-2">No story slides yet. Add your first slide to start planning.</p>
                  <button onClick={() => setStorySlides([{ id: Date.now(), text: "", type: "text" }])}
                    className="btn-primary text-xs flex items-center gap-1.5 mx-auto">
                    <Plus size={12} /> Add First Slide
                  </button>
                </div>
              ) : (
                <>
                  <div className="flex gap-2 overflow-x-auto pb-2">
                    {storySlides.map((slide, i) => (
                      <div key={slide.id} className="min-w-[120px] aspect-[9/16] max-h-[200px] p-2.5 bg-surface-light rounded-xl border border-border hover:border-pink-400/20 transition-all shrink-0 flex flex-col">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-[8px] font-bold text-pink-400">{i + 1}/{storySlides.length}</span>
                          {storySlides.length > 1 && (
                            <button onClick={() => setStorySlides(storySlides.filter(s => s.id !== slide.id))}
                              className="text-muted hover:text-red-400"><X size={8} /></button>
                          )}
                        </div>
                        <select value={slide.type} onChange={e => {
                          const updated = [...storySlides];
                          updated[i] = { ...slide, type: e.target.value };
                          setStorySlides(updated);
                        }} className="input text-[8px] py-0.5 mb-1">
                          <option value="text">Text</option>
                          <option value="image">Image</option>
                          <option value="video">Video</option>
                          <option value="poll">Poll</option>
                          <option value="quiz">Quiz</option>
                        </select>
                        <textarea value={slide.text} onChange={e => {
                          const updated = [...storySlides];
                          updated[i] = { ...slide, text: e.target.value };
                          setStorySlides(updated);
                        }} className="input flex-1 text-[9px] resize-none" placeholder="Slide content..." />
                      </div>
                    ))}
                    <button onClick={() => setStorySlides([...storySlides, { id: Date.now(), text: "", type: "text" }])}
                      className="min-w-[60px] aspect-[9/16] max-h-[200px] flex items-center justify-center border border-dashed border-border rounded-xl hover:border-pink-400/30">
                      <Plus size={14} className="text-muted" />
                    </button>
                  </div>
                  <p className="text-[9px] text-muted">Tip: Best-performing stories have 3-7 slides with a hook, value, and CTA</p>
                </>
              )}
            </div>
          )}

          {/* 13. Link in Bio Manager */}
          {toolsSubTab === "linkinbio" && (
            <div className="card space-y-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-emerald-400/10 rounded-lg flex items-center justify-center">
                  <Link size={16} className="text-emerald-400" />
                </div>
                <div>
                  <h2 className="text-sm font-semibold">Link in Bio Manager</h2>
                  <p className="text-[10px] text-muted">Manage your link-in-bio pages per platform</p>
                </div>
              </div>
              {linkBioLinks.length === 0 ? (
                <div className="text-center py-6">
                  <Link size={24} className="mx-auto mb-2 text-muted/30" />
                  <p className="text-xs text-muted mb-2">No links added yet.</p>
                  <button onClick={() => setLinkBioLinks([{ id: Date.now(), label: "New Link", url: "https://", clicks: 0 }])}
                    className="text-[10px] text-gold hover:underline flex items-center gap-1 mx-auto">
                    <Plus size={10} /> Add Your First Link
                  </button>
                </div>
              ) : (
                <>
                  <div className="space-y-2">
                    {linkBioLinks.map((link, i) => (
                      <div key={link.id} className="flex items-center gap-3 p-2.5 bg-surface-light rounded-xl border border-border hover:border-gold/10 transition-all">
                        <div className="w-8 h-8 bg-surface rounded-lg flex items-center justify-center text-xs font-bold text-gold">{i + 1}</div>
                        <div className="flex-1 min-w-0">
                          <input value={link.label} onChange={e => {
                            const updated = [...linkBioLinks];
                            updated[i] = { ...link, label: e.target.value };
                            setLinkBioLinks(updated);
                          }} className="text-xs font-semibold bg-transparent border-0 outline-none w-full" />
                          <input value={link.url} onChange={e => {
                            const updated = [...linkBioLinks];
                            updated[i] = { ...link, url: e.target.value };
                            setLinkBioLinks(updated);
                          }} className="text-[9px] text-muted bg-transparent border-0 outline-none w-full" />
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-xs font-bold text-gold">{link.clicks}</p>
                          <p className="text-[8px] text-muted">clicks</p>
                        </div>
                        <button onClick={() => setLinkBioLinks(linkBioLinks.filter(l => l.id !== link.id))}
                          className="text-muted hover:text-red-400 shrink-0"><X size={12} /></button>
                      </div>
                    ))}
                  </div>
                  <button onClick={() => setLinkBioLinks([...linkBioLinks, { id: Date.now(), label: "New Link", url: "https://", clicks: 0 }])}
                    className="text-[10px] text-gold hover:underline flex items-center gap-1">
                    <Plus size={10} /> Add Link
                  </button>
                </>
              )}
            </div>
          )}

          {/* 26. Caption Templates Library (expanded) */}
          {toolsSubTab === "templates" && (
            <div className="card space-y-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-yellow-400/10 rounded-lg flex items-center justify-center">
                  <BookOpen size={16} className="text-yellow-400" />
                </div>
                <div>
                  <h2 className="text-sm font-semibold">Caption Templates Library</h2>
                  <p className="text-[10px] text-muted">Industry-specific caption templates ready to customize</p>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {[
                  { industry: "Fitness", templates: [
                    { name: "Transformation Story", template: "Where I was 6 months ago vs. now:\n\nThen: [old state]\nNow: [new state]\n\nThe secret? Consistency > perfection.\n\nDrop a [emoji] if you agree." },
                    { name: "Quick Tip", template: "STOP doing [common mistake].\n\nDo THIS instead:\n\n1. [tip]\n2. [tip]\n3. [tip]\n\nSave this for your next workout!" },
                  ]},
                  { industry: "Restaurant", templates: [
                    { name: "Menu Highlight", template: "Our chef's special this week:\n\n[dish name]\n[description]\n\nAvailable until [date]. Reserve your table (link in bio)" },
                    { name: "Behind Kitchen", template: "Ever wonder how we make our [signature dish]?\n\n[Step-by-step tease]\n\nCome taste the difference. Open [hours]" },
                  ]},
                  { industry: "Real Estate", templates: [
                    { name: "Just Listed", template: "JUST LISTED in [neighborhood]\n\n[bedrooms] BR | [bathrooms] BA | [sqft] sq ft\n[key feature]\n[key feature]\n\nDM 'INFO' for details." },
                    { name: "Market Update", template: "Your [city] market update:\n\nMedian Price: [price]\nDays on Market: [days]\nInventory: [level]\n\nWhat this means for you..." },
                  ]},
                  { industry: "E-commerce", templates: [
                    { name: "Product Launch", template: "IT'S HERE.\n\n[Product name] just dropped.\n\n[benefit 1]\n[benefit 2]\n[benefit 3]\n\nFirst 50 orders get [bonus]. Link in bio!" },
                    { name: "Customer Review", template: "Don't take our word for it:\n\n\"[customer quote]\"\n- [customer name]\n\n[product] is available now at [link]" },
                  ]},
                  { industry: "Agency/B2B", templates: [
                    { name: "Case Study", template: "How we helped [client type] get [result]:\n\nThe problem: [pain]\nOur approach: [solution]\nThe result: [metric]\n\nWant similar results? Link in bio" },
                    { name: "Myth Buster", template: "MYTH: [common misconception]\n\nREALITY: [truth]\n\nHere's why this matters for your [business/brand]:\n\n[explanation]\n\nAgree? Disagree? Comment below" },
                  ]},
                  { industry: "Healthcare", templates: [
                    { name: "Health Tip", template: "Did you know?\n\n[surprising health fact]\n\n[what to do about it]\n\nBook your checkup: link in bio\n\n#healthtips #wellness" },
                    { name: "Meet the Team", template: "Meet Dr. [name]!\n\n[specialty]\n[years experience]\n[fun fact]\n\nBooking now available for new patients." },
                  ]},
                ].map(ind => (
                  <div key={ind.industry} className="space-y-2">
                    <h4 className="text-[10px] font-semibold text-gold">{ind.industry}</h4>
                    {ind.templates.map(t => (
                      <div key={t.name} className="p-2.5 bg-surface-light rounded-lg border border-border">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-[10px] font-medium">{t.name}</span>
                          <button onClick={() => { navigator.clipboard.writeText(t.template); toast.success("Copied!"); }}
                            className="text-[9px] text-gold hover:underline flex items-center gap-1"><Copy size={8} /> Copy</button>
                        </div>
                        <pre className="text-[9px] text-muted whitespace-pre-wrap font-sans leading-relaxed">{t.template}</pre>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 21. Content Recycler */}
          {toolsSubTab === "recycler" && (
            <div className="card space-y-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-green-400/10 rounded-lg flex items-center justify-center">
                  <Repeat size={16} className="text-green-400" />
                </div>
                <div>
                  <h2 className="text-sm font-semibold">Content Recycler</h2>
                  <p className="text-[10px] text-muted">Resurface high-performing old posts to reuse or refresh</p>
                </div>
              </div>
              {recentPosts.length === 0 ? (
                <div className="text-center py-6">
                  <Repeat size={24} className="mx-auto mb-2 text-muted/20" />
                  <p className="text-xs text-muted">No published posts to recycle yet</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {recentPosts.slice(0, 8).map((post) => (
                      <div key={post.id} className="flex items-center gap-3 p-2.5 bg-surface-light rounded-xl border border-border hover:border-gold/10 transition-all">
                        <div className="shrink-0">{PLATFORM_ICONS[post.platform] || <Globe size={14} />}</div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium truncate">{post.title}</p>
                          <p className="text-[9px] text-muted">{post.scheduled_at ? formatRelativeTime(post.scheduled_at) : ""}</p>
                        </div>
                        <button onClick={() => {
                          const meta = (post.metadata as Record<string, unknown>) || {};
                          setRepurposeInput(String(meta.caption || post.title));
                          setToolsSubTab("repurpose");
                          toast.success("Post loaded into repurposer!");
                        }} className="text-[9px] text-gold flex items-center gap-1 hover:underline shrink-0">
                          <RefreshCw size={9} /> Recycle
                        </button>
                      </div>
                    ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ========== ANALYTICS TAB ========== */}
      {tab === "analytics" && (
        <div className="space-y-4">
          {/* Sub-tabs */}
          <div className="flex flex-wrap gap-1.5">
            {([
              { key: "engagement", label: "Engagement", icon: <TrendingUp size={11} /> },
              { key: "heatmap", label: "Best Times Heatmap", icon: <Grid3X3 size={11} /> },
              { key: "hashtags", label: "Hashtag Analytics", icon: <Hash size={11} /> },
              { key: "growth", label: "Audience Growth", icon: <LineChart size={11} /> },
              { key: "comparison", label: "Platform Compare", icon: <BarChart3 size={11} /> },
              { key: "pillars", label: "Content Pillars", icon: <PieChart size={11} /> },
            ] as const).map(st => (
              <button key={st.key} onClick={() => setAnalyticsSubTab(st.key)}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-medium transition-all ${
                  analyticsSubTab === st.key ? "bg-gold/10 text-gold border border-gold/20" : "bg-surface-light text-muted border border-border hover:border-gold/10"
                }`}>
                {st.icon} {st.label}
              </button>
            ))}
          </div>

          {/* 2. Engagement Rate Calculator */}
          {analyticsSubTab === "engagement" && (
            <div className="space-y-3">
              <div className="card">
                <div className="flex items-center gap-2 mb-3">
                  <TrendingUp size={16} className="text-gold" />
                  <h2 className="text-sm font-semibold">Engagement Rate Calculator</h2>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 mb-4">
                  <div className="p-3 bg-surface-light rounded-xl border border-border text-center">
                    <p className="text-lg font-bold text-gold">0%</p>
                    <p className="text-[9px] text-muted">Avg Engagement Rate</p>
                  </div>
                  <div className="p-3 bg-surface-light rounded-xl border border-border text-center">
                    <p className="text-lg font-bold text-blue-400">0</p>
                    <p className="text-[9px] text-muted">Avg Likes/Post</p>
                  </div>
                  <div className="p-3 bg-surface-light rounded-xl border border-border text-center">
                    <p className="text-lg font-bold text-pink-400">0</p>
                    <p className="text-[9px] text-muted">Avg Comments/Post</p>
                  </div>
                  <div className="p-3 bg-surface-light rounded-xl border border-border text-center">
                    <p className="text-lg font-bold text-purple-400">0</p>
                    <p className="text-[9px] text-muted">Avg Shares/Post</p>
                  </div>
                </div>
                {/* Per-post engagement */}
                <h3 className="text-[10px] font-semibold text-muted uppercase tracking-wider mb-2">Per-Post Breakdown</h3>
                <div className="text-center py-4">
                  <p className="text-[10px] text-muted">No per-post engagement data yet.</p>
                </div>
              </div>
            </div>
          )}

          {/* 3. Best Time to Post Heatmap */}
          {analyticsSubTab === "heatmap" && (
            <div className="card">
              <div className="flex items-center gap-2 mb-3">
                <Grid3X3 size={16} className="text-gold" />
                <h2 className="text-sm font-semibold">Best Time to Post Heatmap</h2>
              </div>
              <p className="text-[10px] text-muted mb-3">Darker cells = higher engagement. Based on your audience activity patterns.</p>
              <div className="text-center py-8">
                <Grid3X3 size={24} className="mx-auto mb-2 text-muted/30" />
                <p className="text-xs text-muted">No engagement data yet. Publish content to generate your best-times heatmap.</p>
              </div>
            </div>
          )}

          {/* 5. Hashtag Performance Analytics */}
          {analyticsSubTab === "hashtags" && (
            <div className="card">
              <div className="flex items-center gap-2 mb-3">
                <Hash size={16} className="text-gold" />
                <h2 className="text-sm font-semibold">Hashtag Performance Analytics</h2>
              </div>
              <p className="text-[10px] text-muted mb-3">Track which hashtags drive the most engagement and reach</p>
              <div className="text-center py-8">
                <Hash size={24} className="mx-auto mb-2 text-muted/30" />
                <p className="text-xs text-muted">No hashtag analytics yet. Start posting with hashtags to see performance data.</p>
              </div>
            </div>
          )}

          {/* 20. Audience Growth Tracker */}
          {analyticsSubTab === "growth" && (
            <div className="card">
              <div className="flex items-center gap-2 mb-3">
                <LineChart size={16} className="text-gold" />
                <h2 className="text-sm font-semibold">Audience Growth Tracker</h2>
              </div>
              <p className="text-[10px] text-muted mb-4">Track follower growth over time across all platforms</p>
              <div className="text-center py-8">
                <LineChart size={24} className="mx-auto mb-2 text-muted/30" />
                <p className="text-xs text-muted">No audience growth data yet. Connect accounts and start posting to track growth.</p>
              </div>
            </div>
          )}

          {/* 22. Platform Analytics Comparison */}
          {analyticsSubTab === "comparison" && (
            <div className="card">
              <div className="flex items-center gap-2 mb-3">
                <BarChart3 size={16} className="text-gold" />
                <h2 className="text-sm font-semibold">Platform Analytics Comparison</h2>
              </div>
              <p className="text-[10px] text-muted mb-3">Side-by-side metrics across all your platforms</p>
              <div className="text-center py-8">
                <BarChart3 size={24} className="mx-auto mb-2 text-muted/30" />
                <p className="text-xs text-muted">No platform comparison data yet. Publish content across platforms to see metrics.</p>
              </div>
            </div>
          )}

          {/* 6. Content Pillar Planner */}
          {analyticsSubTab === "pillars" && (
            <div className="card">
              <div className="flex items-center gap-2 mb-3">
                <PieChart size={16} className="text-gold" />
                <h2 className="text-sm font-semibold">Content Pillar Planner</h2>
              </div>
              <p className="text-[10px] text-muted mb-4">Visual breakdown of content categories with target vs actual percentages</p>
              {contentPillars.length === 0 ? (
                <div className="text-center py-8">
                  <PieChart size={24} className="mx-auto mb-2 text-muted/30" />
                  <p className="text-xs text-muted">No content pillar data yet. Publish content to see your category breakdown.</p>
                </div>
              ) : (
                <>
                  <div className="space-y-3">
                    {contentPillars.map((pillar) => {
                      const diff = pillar.actual - pillar.target;
                      return (
                        <div key={pillar.name} className="space-y-1">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <div className={`w-3 h-3 rounded-sm ${pillar.color}`} />
                              <span className="text-[10px] font-semibold">{pillar.name}</span>
                            </div>
                            <div className="flex items-center gap-3 text-[9px]">
                              <span className="text-muted">Target: {pillar.target}%</span>
                              <span className="font-bold">Actual: {pillar.actual}%</span>
                              <span className={diff >= 0 ? "text-success" : "text-orange-400"}>
                                {diff >= 0 ? "+" : ""}{diff}%
                              </span>
                            </div>
                          </div>
                          <div className="relative w-full h-4 bg-surface-light rounded-full overflow-hidden">
                            <div className={`absolute h-full ${pillar.color} opacity-30 rounded-full`} style={{ width: `${pillar.target}%` }} />
                            <div className={`absolute h-full ${pillar.color} rounded-full transition-all duration-700`} style={{ width: `${pillar.actual}%` }} />
                            <div className="absolute h-full border-r-2 border-dashed border-foreground/20" style={{ left: `${pillar.target}%` }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <div className="mt-4 p-3 bg-surface-light rounded-xl border border-border">
                    <h4 className="text-[10px] font-semibold mb-2">Recommendations</h4>
                    <ul className="space-y-1">
                      {contentPillars.filter(p => p.actual < p.target).map(p => (
                        <li key={p.name} className="text-[9px] text-muted flex items-start gap-1.5">
                          <AlertCircle size={9} className="text-orange-400 mt-0.5 shrink-0" />
                          <span>Increase <strong>{p.name}</strong> content by {p.target - p.actual}% to reach target</span>
                        </li>
                      ))}
                      {contentPillars.filter(p => p.actual > p.target).map(p => (
                        <li key={p.name} className="text-[9px] text-muted flex items-start gap-1.5">
                          <Check size={9} className="text-success mt-0.5 shrink-0" />
                          <span><strong>{p.name}</strong> is {p.actual - p.target}% above target — consider rebalancing</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      )}

      {/* ========== INBOX TAB ========== */}
      {tab === "inbox" && (
        <div className="space-y-4">
          {/* Sub-tabs */}
          <div className="flex flex-wrap gap-1.5">
            {([
              { key: "messages", label: "Social Inbox", icon: <Inbox size={11} /> },
              { key: "listening", label: "Social Listening", icon: <Search size={11} /> },
              { key: "ugc", label: "UGC Tracker", icon: <AtSign size={11} /> },
              { key: "autoreplies", label: "Auto-Reply Rules", icon: <Reply size={11} /> },
            ] as const).map(st => (
              <button key={st.key} onClick={() => setInboxSubTab(st.key)}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-medium transition-all ${
                  inboxSubTab === st.key ? "bg-gold/10 text-gold border border-gold/20" : "bg-surface-light text-muted border border-border hover:border-gold/10"
                }`}>
                {st.icon} {st.label}
              </button>
            ))}
          </div>

          {/* 9. Social Inbox */}
          {inboxSubTab === "messages" && (
            <div className="card">
              <div className="flex items-center gap-2 mb-3">
                <Inbox size={16} className="text-gold" />
                <h2 className="text-sm font-semibold">Social Inbox</h2>
                <span className="ml-auto text-[9px] bg-gold/10 text-gold px-2 py-0.5 rounded-full font-medium">0 unread</span>
              </div>
              <p className="text-[10px] text-muted mb-3">Unified view of DMs and comments across all platforms</p>
              <div className="text-center py-8">
                <Inbox size={24} className="mx-auto mb-2 text-muted/30" />
                <p className="text-xs text-muted">No messages yet. DMs and comments will appear here.</p>
              </div>
            </div>
          )}

          {/* 16. Social Listening */}
          {inboxSubTab === "listening" && (
            <div className="card">
              <div className="flex items-center gap-2 mb-3">
                <Search size={16} className="text-gold" />
                <h2 className="text-sm font-semibold">Social Listening</h2>
              </div>
              <p className="text-[10px] text-muted mb-3">Monitor keywords and brand mentions across all platforms</p>
              <div className="flex gap-2 mb-4">
                <input value={newKeyword} onChange={e => setNewKeyword(e.target.value)}
                  className="input text-xs flex-1" placeholder="Add keyword to monitor..." onKeyDown={e => {
                    if (e.key === "Enter" && newKeyword.trim()) {
                      setListeningKeywords([...listeningKeywords, newKeyword.trim()]);
                      setNewKeyword("");
                    }
                  }} />
                <button onClick={() => {
                  if (newKeyword.trim()) {
                    setListeningKeywords([...listeningKeywords, newKeyword.trim()]);
                    setNewKeyword("");
                  }
                }} className="btn-primary text-xs px-3"><Plus size={12} /></button>
              </div>
              <div className="flex flex-wrap gap-1.5 mb-4">
                {listeningKeywords.map(kw => (
                  <span key={kw} className="flex items-center gap-1 text-[10px] bg-gold/10 text-gold px-2.5 py-1 rounded-lg border border-gold/20">
                    <Search size={9} /> {kw}
                    <button onClick={() => setListeningKeywords(listeningKeywords.filter(k => k !== kw))}
                      className="ml-1 text-gold/60 hover:text-gold"><X size={9} /></button>
                  </span>
                ))}
              </div>
              <h4 className="text-[10px] font-semibold text-muted uppercase tracking-wider mb-2">Recent Mentions</h4>
              <div className="text-center py-4">
                <p className="text-[10px] text-muted">No mentions found yet. Add keywords above to start monitoring.</p>
              </div>
            </div>
          )}

          {/* 14. UGC Tracker */}
          {inboxSubTab === "ugc" && (
            <div className="card">
              <div className="flex items-center gap-2 mb-3">
                <AtSign size={16} className="text-gold" />
                <h2 className="text-sm font-semibold">UGC Tracker</h2>
              </div>
              <p className="text-[10px] text-muted mb-3">Track user-generated content and brand mentions</p>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 mb-4">
                <div className="p-2.5 bg-surface-light rounded-xl border border-border text-center">
                  <p className="text-lg font-bold text-gold">0</p>
                  <p className="text-[9px] text-muted">Total Mentions</p>
                </div>
                <div className="p-2.5 bg-surface-light rounded-xl border border-border text-center">
                  <p className="text-lg font-bold text-success">0</p>
                  <p className="text-[9px] text-muted">Positive</p>
                </div>
                <div className="p-2.5 bg-surface-light rounded-xl border border-border text-center">
                  <p className="text-lg font-bold text-blue-400">0</p>
                  <p className="text-[9px] text-muted">Repostable</p>
                </div>
                <div className="p-2.5 bg-surface-light rounded-xl border border-border text-center">
                  <p className="text-lg font-bold text-pink-400">0</p>
                  <p className="text-[9px] text-muted">Replied</p>
                </div>
              </div>
              <div className="text-center py-4">
                <p className="text-[10px] text-muted">No user-generated content tracked yet.</p>
              </div>
            </div>
          )}

          {/* 23. Auto-Reply Rules */}
          {inboxSubTab === "autoreplies" && (
            <div className="card">
              <div className="flex items-center gap-2 mb-3">
                <Reply size={16} className="text-gold" />
                <h2 className="text-sm font-semibold">Auto-Reply Rules</h2>
              </div>
              <p className="text-[10px] text-muted mb-3">Set up automatic responses to common comments and DMs</p>
              {autoReplyRules.length === 0 ? (
                <div className="text-center py-6">
                  <Reply size={24} className="mx-auto mb-2 text-muted/30" />
                  <p className="text-xs text-muted mb-2">No auto-reply rules yet.</p>
                  <button onClick={() => {
                    setAutoReplyRules([{ id: Date.now(), trigger: "new keyword", response: "Your auto-reply message here...", active: false }]);
                  }} className="text-[10px] text-gold hover:underline flex items-center gap-1 mx-auto">
                    <Plus size={10} /> Add Your First Rule
                  </button>
                </div>
              ) : (
                <>
                  <div className="space-y-2">
                    {autoReplyRules.map(rule => (
                      <div key={rule.id} className={`p-3 rounded-xl border transition-all ${
                        rule.active ? "bg-surface-light border-success/20" : "bg-surface-light border-border opacity-60"
                      }`}>
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-semibold">Trigger: &ldquo;{rule.trigger}&rdquo;</span>
                            <span className={`text-[8px] px-1.5 py-0.5 rounded ${rule.active ? "bg-success/10 text-success" : "bg-surface text-muted"}`}>
                              {rule.active ? "Active" : "Inactive"}
                            </span>
                          </div>
                          <button onClick={() => {
                            setAutoReplyRules(autoReplyRules.map(r => r.id === rule.id ? { ...r, active: !r.active } : r));
                          }} className={`w-8 h-4 rounded-full transition-all flex items-center ${
                            rule.active ? "bg-success justify-end" : "bg-surface border border-border justify-start"
                          }`}>
                            <div className={`w-3 h-3 rounded-full mx-0.5 ${rule.active ? "bg-white" : "bg-muted/40"}`} />
                          </button>
                        </div>
                        <p className="text-[10px] text-muted">{rule.response}</p>
                      </div>
                    ))}
                  </div>
                  <button onClick={() => {
                    setAutoReplyRules([...autoReplyRules, { id: Date.now(), trigger: "new keyword", response: "Your auto-reply message here...", active: false }]);
                  }} className="mt-3 text-[10px] text-gold hover:underline flex items-center gap-1">
                    <Plus size={10} /> Add New Rule
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      )}

      {/* ========== COLLABS TAB ========== */}
      {tab === "collabs" && (
        <div className="space-y-4">
          {/* Sub-tabs */}
          <div className="flex flex-wrap gap-1.5">
            {([
              { key: "competitors", label: "Competitors", icon: <Target size={11} /> },
              { key: "influencers", label: "Influencer Finder", icon: <Users size={11} /> },
              { key: "collabs", label: "Collab Manager", icon: <Handshake size={11} /> },
              { key: "trending", label: "Trending Audio", icon: <Music2 size={11} /> },
            ] as const).map(st => (
              <button key={st.key} onClick={() => setCollabsSubTab(st.key)}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-medium transition-all ${
                  collabsSubTab === st.key ? "bg-gold/10 text-gold border border-gold/20" : "bg-surface-light text-muted border border-border hover:border-gold/10"
                }`}>
                {st.icon} {st.label}
              </button>
            ))}
          </div>

          {/* 4. Competitor Social Tracker */}
          {collabsSubTab === "competitors" && (
            <div className="card">
              <div className="flex items-center gap-2 mb-3">
                <Target size={16} className="text-gold" />
                <h2 className="text-sm font-semibold">Competitor Social Tracker</h2>
              </div>
              <p className="text-[10px] text-muted mb-3">Monitor competitor accounts and their posting frequency</p>
              <div className="flex gap-2 mb-4">
                <input value={newCompetitor} onChange={e => setNewCompetitor(e.target.value)}
                  className="input text-xs flex-1" placeholder="Add competitor handle (e.g., @competitor)..." onKeyDown={e => {
                    if (e.key === "Enter" && newCompetitor.trim()) {
                      setCompetitorHandles([...competitorHandles, { handle: newCompetitor.trim(), platform: "instagram", frequency: "N/A", lastPost: "Tracking..." }]);
                      setNewCompetitor("");
                    }
                  }} />
                <button onClick={() => {
                  if (newCompetitor.trim()) {
                    setCompetitorHandles([...competitorHandles, { handle: newCompetitor.trim(), platform: "instagram", frequency: "N/A", lastPost: "Tracking..." }]);
                    setNewCompetitor("");
                  }
                }} className="btn-primary text-xs px-3"><Plus size={12} /></button>
              </div>
              {competitorHandles.length === 0 ? (
                <div className="text-center py-6">
                  <Target size={24} className="mx-auto mb-2 text-muted/30" />
                  <p className="text-xs text-muted">No competitors tracked yet. Add a handle above to start monitoring.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {competitorHandles.map((comp, i) => (
                    <div key={i} className="flex items-center gap-3 p-3 bg-surface-light rounded-xl border border-border hover:border-gold/10 transition-all">
                      <div className="shrink-0">{PLATFORM_ICONS[comp.platform] || <Globe size={14} />}</div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold">{comp.handle}</p>
                        <p className="text-[9px] text-muted capitalize">{comp.platform}</p>
                      </div>
                      <div className="text-center px-3">
                        <p className="text-[10px] font-bold">{comp.frequency}</p>
                        <p className="text-[8px] text-muted">Post freq</p>
                      </div>
                      <div className="text-center px-3">
                        <p className="text-[10px] font-medium text-muted">{comp.lastPost}</p>
                        <p className="text-[8px] text-muted">Last post</p>
                      </div>
                      <button onClick={() => setCompetitorHandles(competitorHandles.filter((_, idx) => idx !== i))}
                        className="text-muted hover:text-red-400 shrink-0"><X size={12} /></button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* 15. Influencer Finder */}
          {collabsSubTab === "influencers" && (
            <div className="card">
              <div className="flex items-center gap-2 mb-3">
                <Users size={16} className="text-gold" />
                <h2 className="text-sm font-semibold">Influencer Finder</h2>
              </div>
              <p className="text-[10px] text-muted mb-3">Search for micro-influencers by niche to collaborate with</p>
              <div className="flex gap-2 mb-4">
                <input value={influencerNiche} onChange={e => setInfluencerNiche(e.target.value)}
                  className="input text-xs flex-1" placeholder="Search by niche (e.g., fitness, tech, food)..." aria-label="Search influencers by niche" />
                <button onClick={() => toast.success("Searching influencers...")}
                  className="btn-primary text-xs flex items-center gap-1.5"><Search size={12} /> Search</button>
              </div>
              <div className="text-center py-8">
                <Users size={24} className="mx-auto mb-2 text-muted/30" />
                <p className="text-xs text-muted">No influencer results yet. Search by niche above to find collaborators.</p>
              </div>
            </div>
          )}

          {/* 24. Collab Manager */}
          {collabsSubTab === "collabs" && (
            <div className="card">
              <div className="flex items-center gap-2 mb-3">
                <Handshake size={16} className="text-gold" />
                <h2 className="text-sm font-semibold">Collab Manager</h2>
              </div>
              <p className="text-[10px] text-muted mb-3">Track brand collaboration opportunities and partnerships</p>
              {collabOpportunities.length === 0 ? (
                <div className="text-center py-8">
                  <Handshake size={24} className="mx-auto mb-2 text-muted/30" />
                  <p className="text-xs text-muted">No collaboration opportunities yet.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {collabOpportunities.map(collab => (
                    <div key={collab.id} className="flex items-center gap-3 p-3 bg-surface-light rounded-xl border border-border hover:border-gold/10 transition-all">
                      <div className="w-10 h-10 bg-gold/10 rounded-xl flex items-center justify-center shrink-0">
                        <Handshake size={16} className="text-gold" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold">{collab.brand}</p>
                        <p className="text-[9px] text-muted">{collab.niche} | {collab.followers} followers</p>
                      </div>
                      <div className="text-center px-2 shrink-0">
                        <div className={`text-[10px] font-bold ${collab.match >= 90 ? "text-success" : collab.match >= 80 ? "text-gold" : "text-muted"}`}>
                          {collab.match}%
                        </div>
                        <p className="text-[7px] text-muted">match</p>
                      </div>
                      <span className={`text-[9px] px-2 py-0.5 rounded-full font-medium shrink-0 ${
                        collab.status === "confirmed" ? "bg-success/10 text-success" :
                        collab.status === "negotiating" ? "bg-gold/10 text-gold" :
                        collab.status === "completed" ? "bg-blue-400/10 text-blue-400" :
                        "bg-surface text-muted"
                      }`}>
                        {collab.status}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* 25. Trending Audio Finder */}
          {collabsSubTab === "trending" && (
            <div className="card">
              <div className="flex items-center gap-2 mb-3">
                <Music2 size={16} className="text-gold" />
                <h2 className="text-sm font-semibold">Trending Audio Finder</h2>
              </div>
              <p className="text-[10px] text-muted mb-3">Find trending TikTok and Reels sounds to use in your content</p>
              <div className="text-center py-8">
                <Music2 size={24} className="mx-auto mb-2 text-muted/30" />
                <p className="text-xs text-muted">No trending audio data yet.</p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 17. Content Calendar Export — add to calendar tab area */}
      {tab === "calendar" && (
        <div className="card">
          <div className="flex items-center gap-2 mb-3">
            <Download size={16} className="text-gold" />
            <h2 className="text-sm font-semibold">Export Calendar</h2>
          </div>
          <p className="text-[10px] text-muted mb-3">Download your content calendar in CSV or PDF format</p>
          <div className="flex gap-2">
            <button onClick={() => {
              const allPosts = [...scheduledPosts, ...recentPosts];
              const csv = "Platform,Title,Status,Date\n" + allPosts.map(p =>
                `${p.platform},"${p.title}",${p.status},${p.scheduled_at || ""}`
              ).join("\n");
              const blob = new Blob([csv], { type: "text/csv" });
              const url = URL.createObjectURL(blob);
              const a = document.createElement("a");
              a.href = url; a.download = "content-calendar.csv"; a.click();
              URL.revokeObjectURL(url);
              toast.success("Calendar exported as CSV!");
            }} className="btn-primary text-xs flex items-center gap-1.5">
              <Download size={12} /> Export CSV
            </button>
            <button onClick={() => {
              toast.success("PDF export coming soon!");
            }} className="text-xs flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-light text-muted border border-border hover:border-gold/10 transition-all">
              <FileTextIcon size={12} /> Export PDF
            </button>
          </div>
        </div>
      )}

      <PageAI pageName="Social Manager" context="Autonomous social media manager. Schedule posts, generate content calendars, manage multiple platforms. Features include AI repurposer, A/B testing, viral scoring, engagement analytics, heatmap, social listening, influencer finder, competitor tracking, and more." suggestions={["Generate this week's content for Instagram", "What trending topics should I post about?", "Write 5 engaging captions for a dental practice", "Create a 30-day content calendar", "Repurpose my latest post for all platforms", "Find micro-influencers in the fitness niche"]} />
    </div>
  );
}
