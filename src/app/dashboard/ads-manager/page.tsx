"use client";

import { useState, useEffect, useMemo } from "react";
import {
  Target, DollarSign, MousePointer, TrendingUp, Eye, BarChart3,
  Plus, Play, Pause, Copy, Sparkles, Bot, Zap,
  Settings2, Activity, Users, RefreshCw, CheckCircle2,
  XCircle, ArrowUpRight,
  ToggleLeft, ToggleRight, AlertTriangle, Loader, Image as ImageIcon,
  Video, Type, Search, Wand2,
} from "lucide-react";
import toast from "react-hot-toast";
import { MetaIcon, GoogleAdsIcon, TikTokIcon } from "@/components/ui/platform-icons";
import PageHero from "@/components/ui/page-hero";

function getAdBrandIcon(platformId: string, size = 20): React.ReactNode {
  if (platformId === "meta_ads") return <MetaIcon size={size} />;
  if (platformId === "google_ads") return <GoogleAdsIcon size={size} />;
  if (platformId === "tiktok_ads") return <TikTokIcon size={size} />;
  return <MetaIcon size={size} />;
}

// ---------------------------------------------------------------------------
// Page description (for sidebar / search / SEO)
// ---------------------------------------------------------------------------
// Ads Manager: AI-powered multi-platform advertising hub. Manage Facebook Ads,
// Google Ads, and TikTok Ads campaigns through Zernio. AI auto-optimizes bids,
// budgets, creatives, and audience targeting across all connected ad accounts.
// ---------------------------------------------------------------------------

type Tab = "overview" | "campaigns" | "creatives" | "audiences" | "autopilot";

interface Campaign {
  id: string;
  name: string;
  platform: string;
  status: string;
  objective: string;
  daily_budget: number;
  total_spend: number;
  impressions: number;
  clicks: number;
  ctr: number;
  conversions: number;
  cpa: number;
  roas: number;
  start_date: string;
  end_date: string | null;
  ai_optimized: boolean;
  audience: string;
  created_at: string;
}

interface Creative {
  id: string;
  campaign_id: string;
  headline: string;
  description: string;
  cta: string;
  format: string;
  ctr: number;
  conversion_rate: number;
  preview_url: string | null;
  ab_status: string | null;
  status: string;
}

interface Audience {
  id: string;
  name: string;
  type: string;
  size: number;
  platform: string;
  campaigns_using: number;
}

interface AILogEntry {
  id: string;
  timestamp: string;
  action: string;
  platform: string;
  type: string;
}

interface Overview {
  total_spend: number;
  total_impressions: number;
  total_clicks: number;
  total_conversions: number;
  avg_roas: number;
  ctr: number;
}

interface AutopilotRule {
  id: string;
  condition: string;
  action: string;
  platform: string;
  enabled: boolean;
}

// ---------------------------------------------------------------------------
// Platform helpers
// ---------------------------------------------------------------------------
const PLATFORMS = [
  { id: "meta_ads", label: "Meta Ads", color: "#1877F2", icon: "M", gradient: "from-[#1877F2]/20 to-[#1877F2]/5" },
  { id: "google_ads", label: "Google Ads", color: "#34A853", icon: "G", gradient: "from-[#34A853]/20 to-[#34A853]/5" },
  { id: "tiktok_ads", label: "TikTok Ads", color: "#FF0050", icon: "T", gradient: "from-[#FF0050]/20 to-[#FF0050]/5" },
];

function getPlatform(id: string) {
  return PLATFORMS.find(p => p.id === id) || PLATFORMS[0];
}

const OBJECTIVES = ["awareness", "traffic", "conversions", "leads"];

// ---------------------------------------------------------------------------
// Formatting helpers
// ---------------------------------------------------------------------------
const fmt = (n: number) => n.toLocaleString();
const fmtCurrency = (n: number) => `$${n.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
const fmtPct = (n: number) => `${n.toFixed(2)}%`;

// ---------------------------------------------------------------------------
// Default autopilot rules
// ---------------------------------------------------------------------------
const DEFAULT_RULES: AutopilotRule[] = [
  { id: "rule_1", condition: "CPA > $50", action: "Pause ad set", platform: "all", enabled: true },
  { id: "rule_2", condition: "CTR < 1%", action: "Test new creative variant", platform: "all", enabled: true },
  { id: "rule_3", condition: "Frequency > 3.5", action: "Expand audience or refresh creative", platform: "meta_ads", enabled: true },
  { id: "rule_4", condition: "ROAS < 2.0 for 3 days", action: "Reduce budget by 20%", platform: "all", enabled: false },
  { id: "rule_5", condition: "ROAS > 5.0 for 3 days", action: "Increase budget by 15%", platform: "all", enabled: true },
  { id: "rule_6", condition: "Ad set spend > $200 with 0 conversions", action: "Pause ad set", platform: "all", enabled: true },
];

// ---------------------------------------------------------------------------
// Mock daily chart data
// ---------------------------------------------------------------------------
const DAILY_DATA: { date: string; spend: number; conversions: number }[] = [];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export default function AdsManagerPage() {
  const [tab, setTab] = useState<Tab>("overview");
  const [loading, setLoading] = useState(true);
  const [overview, setOverview] = useState<Overview | null>(null);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [creatives, setCreatives] = useState<Creative[]>([]);
  const [audiences, setAudiences] = useState<Audience[]>([]);
  const [aiLog, setAiLog] = useState<AILogEntry[]>([]);
  const [platformsConnected, setPlatformsConnected] = useState<Record<string, boolean>>({});
  const [platformsLastSynced, setPlatformsLastSynced] = useState<Record<string, string | null>>({});
  const [refreshingPlatform, setRefreshingPlatform] = useState<string | null>(null);

  // Campaign filters
  const [platformFilter, setPlatformFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");

  // Create campaign modal
  const [showCreate, setShowCreate] = useState(false);
  const [newCampaign, setNewCampaign] = useState({
    name: "",
    platform: "meta_ads",
    objective: "conversions",
    daily_budget: 50,
    start_date: new Date().toISOString().split("T")[0],
    end_date: "",
    audience: "",
    ai_optimized: true,
  });

  // Selected campaigns for bulk
  const [selected, setSelected] = useState<Set<string>>(new Set());

  // AI generate copy modal
  const [showGenerateCopy, setShowGenerateCopy] = useState(false);
  const [generatingCopy, setGeneratingCopy] = useState(false);
  const [generatedVariations, setGeneratedVariations] = useState<{ headline: string; description: string; cta: string }[]>([]);

  // Autopilot
  const [rules, setRules] = useState<AutopilotRule[]>(DEFAULT_RULES);
  const [autoOptimize, setAutoOptimize] = useState<Record<string, boolean>>({
    meta_ads: true,
    google_ads: true,
    tiktok_ads: false,
  });

  // New rule form
  const [showNewRule, setShowNewRule] = useState(false);
  const [newRule, setNewRule] = useState({ condition: "", action: "", platform: "all" });

  // ---------------------------------------------------------------------------
  // Fetch data
  // ---------------------------------------------------------------------------
  useEffect(() => {
    fetchData();
    // Handle OAuth callback redirect toasts (?connected=meta_ads or ?error=...)
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const connected = params.get("connected");
      const errorMsg = params.get("error");
      const platformParam = params.get("platform");
      if (connected) {
        const label = connected === "meta_ads" ? "Meta Ads"
          : connected === "google_ads" ? "Google Ads"
          : connected === "tiktok_ads" ? "TikTok Ads"
          : connected;
        toast.success(`${label} connected`);
        // Strip params from URL
        window.history.replaceState({}, "", window.location.pathname);
      } else if (errorMsg) {
        const platformLabel = platformParam === "meta_ads" ? "Meta Ads"
          : platformParam === "google_ads" ? "Google Ads"
          : platformParam === "tiktok_ads" ? "TikTok Ads"
          : "OAuth";
        toast.error(`${platformLabel} connection failed: ${decodeURIComponent(errorMsg)}`);
        window.history.replaceState({}, "", window.location.pathname);
      }
    }
  }, []);

  async function fetchData(refresh = false) {
    setLoading(true);
    try {
      const res = await fetch(`/api/ads-manager${refresh ? "?refresh=1" : ""}`);
      const data = await res.json();
      setOverview(data.overview);
      setCampaigns(data.campaigns || []);
      setCreatives(data.creatives || []);
      setAudiences(data.audiences || []);
      setAiLog(data.ai_log || []);
      setPlatformsConnected(data.platforms_connected || {});
      setPlatformsLastSynced(data.platforms_last_synced || {});
    } catch (err) {
      console.error("[AdsManager] fetch error:", err);
      toast.error("Failed to load ads data");
    } finally {
      setLoading(false);
    }
  }

  // Connect / refresh helpers
  function connectPlatform(platformId: string) {
    const slug = platformId.replace("_", "-");
    window.location.href = `/api/oauth/${slug}/start?return_to=${encodeURIComponent("/dashboard/ads-manager")}`;
  }

  async function refreshPlatform(platformId: string) {
    setRefreshingPlatform(platformId);
    try {
      const slug = platformId.replace("_", "-");
      const res = await fetch(`/api/ads/${slug}/campaigns`, { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Refresh failed");
        return;
      }
      toast.success(`Synced ${data.count || 0} campaigns`);
      await fetchData();
    } catch {
      toast.error("Refresh failed");
    } finally {
      setRefreshingPlatform(null);
    }
  }

  function formatSyncedAgo(iso: string | null): string {
    if (!iso) return "Never synced";
    const diffMs = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diffMs / 60000);
    if (mins < 1) return "Just now";
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  }

  // ---------------------------------------------------------------------------
  // Actions
  // ---------------------------------------------------------------------------
  async function createCampaign() {
    try {
      const res = await fetch("/api/ads-manager", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "create_campaign", campaign: { ...newCampaign, status: "active" } }),
      });
      const data = await res.json();
      if (data.success) {
        setCampaigns(prev => [data.campaign, ...prev]);
        setShowCreate(false);
        setNewCampaign({ name: "", platform: "meta_ads", objective: "conversions", daily_budget: 50, start_date: new Date().toISOString().split("T")[0], end_date: "", audience: "", ai_optimized: true });
        toast.success("Campaign created");
      } else {
        toast.error(data.error || "Failed to create campaign");
      }
    } catch { toast.error("Failed to create campaign"); }
  }

  async function bulkAction(action: string) {
    if (selected.size === 0) return;
    try {
      const res = await fetch("/api/ads-manager", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "bulk_action", campaign_ids: Array.from(selected), bulk_action: action }),
      });
      const data = await res.json();
      if (data.success) {
        if (action === "pause" || action === "resume") {
          setCampaigns(prev => prev.map(c =>
            selected.has(c.id) ? { ...c, status: action === "pause" ? "paused" : "active" } : c,
          ));
        }
        if (action === "duplicate") {
          const dupes = campaigns.filter(c => selected.has(c.id)).map(c => ({
            ...c,
            id: `cmp_dup_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
            name: `${c.name} (Copy)`,
            total_spend: 0,
            impressions: 0,
            clicks: 0,
            conversions: 0,
          }));
          setCampaigns(prev => [...dupes, ...prev]);
        }
        setSelected(new Set());
        toast.success(`${action} applied to ${data.affected} campaigns`);
      }
    } catch { toast.error("Bulk action failed"); }
  }

  async function generateAdCopy() {
    setGeneratingCopy(true);
    try {
      const res = await fetch("/api/ads-manager", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "generate_copy" }),
      });
      const data = await res.json();
      if (data.success) {
        setGeneratedVariations(data.variations);
      }
    } catch { toast.error("Failed to generate copy"); }
    setGeneratingCopy(false);
  }

  async function saveNewRule() {
    if (!newRule.condition || !newRule.action) return;
    try {
      const res = await fetch("/api/ads-manager", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "save_rule", rule: newRule }),
      });
      const data = await res.json();
      if (data.success) {
        setRules(prev => [...prev, { ...data.rule, enabled: true }]);
        setShowNewRule(false);
        setNewRule({ condition: "", action: "", platform: "all" });
        toast.success("Rule saved");
      }
    } catch { toast.error("Failed to save rule"); }
  }

  // ---------------------------------------------------------------------------
  // Filtered campaigns
  // ---------------------------------------------------------------------------
  const filtered = useMemo(() => {
    return campaigns.filter(c => {
      if (platformFilter !== "all" && c.platform !== platformFilter) return false;
      if (statusFilter !== "all" && c.status !== statusFilter) return false;
      if (searchQuery && !c.name.toLowerCase().includes(searchQuery.toLowerCase())) return false;
      return true;
    });
  }, [campaigns, platformFilter, statusFilter, searchQuery]);

  // ---------------------------------------------------------------------------
  // AI Recommendations (computed from data)
  // ---------------------------------------------------------------------------
  const recommendations = useMemo(() => {
    const recs: { text: string; type: "warning" | "success" | "info" }[] = [];
    for (const c of campaigns) {
      if (c.status === "active" && c.cpa > 40) {
        recs.push({ text: `Pause underperforming ad set in "${c.name}" - CPA is ${fmtCurrency(c.cpa)}, above $40 threshold`, type: "warning" });
      }
      if (c.status === "active" && c.roas > 5) {
        recs.push({ text: `Increase budget for "${c.name}" - ROAS is ${c.roas}x, strong performer`, type: "success" });
      }
      if (c.status === "active" && c.ctr < 1) {
        recs.push({ text: `Test new creatives for "${c.name}" - CTR is ${fmtPct(c.ctr)}, below benchmark`, type: "info" });
      }
    }
    if (recs.length === 0) {
      recs.push({ text: "All campaigns performing within acceptable parameters. Keep monitoring.", type: "info" });
    }
    return recs;
  }, [campaigns]);

  // Top campaigns by ROAS
  const topCampaigns = useMemo(() => {
    return [...campaigns]
      .filter(c => c.status === "active" && c.roas > 0)
      .sort((a, b) => b.roas - a.roas)
      .slice(0, 5);
  }, [campaigns]);

  // Platform spend breakdown
  const platformBreakdown = useMemo(() => {
    const map: Record<string, { spend: number; conversions: number; impressions: number; clicks: number }> = {};
    for (const c of campaigns) {
      if (!map[c.platform]) map[c.platform] = { spend: 0, conversions: 0, impressions: 0, clicks: 0 };
      map[c.platform].spend += c.total_spend;
      map[c.platform].conversions += c.conversions;
      map[c.platform].impressions += c.impressions;
      map[c.platform].clicks += c.clicks;
    }
    return map;
  }, [campaigns]);

  // Max spend for chart scaling
  const maxSpend = Math.max(...DAILY_DATA.map(d => d.spend), 1);
  const maxConv = Math.max(...DAILY_DATA.map(d => d.conversions), 1);

  // ---------------------------------------------------------------------------
  // Loading state
  // ---------------------------------------------------------------------------
  if (loading) {
    return (
      <div className="flex items-center justify-center h-[70vh]">
        <div className="text-center space-y-3">
          <Loader className="w-8 h-8 animate-spin text-gold mx-auto" />
          <p className="text-muted text-sm">Loading Ads Manager...</p>
        </div>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // Tab bar
  // ---------------------------------------------------------------------------
  const TABS: { key: Tab; label: string; icon: React.ReactNode }[] = [
    { key: "overview", label: "Overview", icon: <BarChart3 size={14} /> },
    { key: "campaigns", label: "Campaigns", icon: <Target size={14} /> },
    { key: "creatives", label: "Creatives", icon: <ImageIcon size={14} /> },
    { key: "audiences", label: "Audiences", icon: <Users size={14} /> },
    { key: "autopilot", label: "AI Autopilot", icon: <Bot size={14} /> },
  ];

  return (
    <div className="fade-in space-y-6">
      <PageHero
        icon={<Target size={28} />}
        title="Ads Manager"
        subtitle="Launch Meta, Google & TikTok ads. AI writes the copy and tests creatives."
        gradient="sunset"
        actions={
          <button
            onClick={() => fetchData()}
            className="px-3 py-1.5 rounded-lg bg-white/15 border border-white/20 text-white text-xs font-medium hover:bg-white/25 transition flex items-center gap-1.5"
          >
            <RefreshCw size={12} /> Refresh
          </button>
        }
      />

      {/* Tab bar */}
      <div className="flex gap-1 bg-card border border-border rounded-xl p-1 overflow-x-auto">
        {TABS.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-medium transition whitespace-nowrap ${
              tab === t.key
                ? "bg-gold/10 text-gold border border-gold/30"
                : "text-muted hover:text-foreground hover:bg-white/[0.03]"
            }`}
          >
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {/* ── OVERVIEW TAB ── */}
      {tab === "overview" && overview && (
        <div className="space-y-6">
          {/* Stat cards */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            {[
              { label: "Ad Spend", value: fmtCurrency(overview.total_spend), icon: <DollarSign size={14} /> },
              { label: "Impressions", value: fmt(overview.total_impressions), icon: <Eye size={14} /> },
              { label: "Clicks", value: fmt(overview.total_clicks), icon: <MousePointer size={14} /> },
              { label: "Conversions", value: fmt(overview.total_conversions), icon: <TrendingUp size={14} /> },
              { label: "Avg ROAS", value: `${overview.avg_roas}x`, icon: <ArrowUpRight size={14} /> },
              { label: "Avg CTR", value: fmtPct(overview.ctr), icon: <BarChart3 size={14} /> },
            ].map((s, i) => (
              <div key={i} className="bg-card border border-border rounded-xl p-4 hover:border-gold/30 transition">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-muted text-[11px] uppercase tracking-wider">{s.label}</span>
                  <span className="text-gold/60">{s.icon}</span>
                </div>
                <p className="text-xl font-bold text-foreground">{s.value}</p>
                <p className="text-[10px] mt-1 text-muted">
                  {campaigns.length === 0 ? "No data yet" : "This period"}
                </p>
              </div>
            ))}
          </div>

          {/* Platform breakdown + chart */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Platform cards */}
            <div className="space-y-3">
              <h3 className="text-xs font-semibold text-muted uppercase tracking-wider">Platform Breakdown</h3>
              {PLATFORMS.map(p => {
                const stats = platformBreakdown[p.id];
                const connected = platformsConnected[p.id];
                const syncedAt = platformsLastSynced[p.id];
                const refreshing = refreshingPlatform === p.id;
                return (
                  <div key={p.id} className={`bg-gradient-to-br ${p.gradient} border border-white/[0.06] rounded-xl p-4`}>
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <span className="w-7 h-7 rounded-lg flex items-center justify-center overflow-hidden">
                          {getAdBrandIcon(p.id, 28)}
                        </span>
                        <span className="text-sm font-medium text-foreground">{p.label}</span>
                      </div>
                      {connected ? (
                        <span className="text-[10px] text-emerald-400 flex items-center gap-1">
                          <CheckCircle2 size={10} /> Connected
                        </span>
                      ) : (
                        <button
                          onClick={() => connectPlatform(p.id)}
                          className="text-[10px] px-2 py-1 rounded-md bg-gold/10 text-gold border border-gold/30 hover:bg-gold/20 transition"
                        >
                          Connect {p.label}
                        </button>
                      )}
                    </div>
                    {stats ? (
                      <div className="grid grid-cols-2 gap-2 text-[11px]">
                        <div><span className="text-muted">Spend:</span> <span className="text-foreground font-medium">{fmtCurrency(stats.spend)}</span></div>
                        <div><span className="text-muted">Conv:</span> <span className="text-foreground font-medium">{fmt(stats.conversions)}</span></div>
                        <div><span className="text-muted">Impr:</span> <span className="text-foreground font-medium">{fmt(stats.impressions)}</span></div>
                        <div><span className="text-muted">Clicks:</span> <span className="text-foreground font-medium">{fmt(stats.clicks)}</span></div>
                      </div>
                    ) : (
                      <p className="text-muted text-[11px]">No campaign data yet</p>
                    )}
                    {connected && (
                      <div className="flex items-center justify-between mt-3 pt-3 border-t border-white/[0.06]">
                        <span className="text-[10px] text-muted">
                          {syncedAt ? `Last synced ${formatSyncedAgo(syncedAt)}` : "Never synced"}
                        </span>
                        <button
                          onClick={() => refreshPlatform(p.id)}
                          disabled={refreshing}
                          className="text-[10px] px-2 py-1 rounded-md bg-white/[0.04] border border-white/[0.08] text-foreground hover:bg-white/[0.08] transition flex items-center gap-1 disabled:opacity-50"
                        >
                          <RefreshCw size={10} className={refreshing ? "animate-spin" : ""} />
                          {refreshing ? "Syncing..." : "Refresh"}
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Daily Spend vs Conversions Chart */}
            <div className="lg:col-span-2 bg-card border border-border rounded-xl p-5">
              <h3 className="text-xs font-semibold text-muted uppercase tracking-wider mb-4">Daily Spend vs Conversions (14 days)</h3>
              <div className="flex items-end gap-1 h-48">
                {DAILY_DATA.map((d, i) => (
                  <div key={i} className="flex-1 flex flex-col items-center gap-1 group relative">
                    {/* Tooltip */}
                    <div className="absolute -top-14 left-1/2 -translate-x-1/2 bg-zinc-800 border border-border rounded-lg px-2 py-1 text-[10px] opacity-0 group-hover:opacity-100 transition pointer-events-none whitespace-nowrap z-10">
                      <p className="text-gold font-medium">{fmtCurrency(d.spend)}</p>
                      <p className="text-emerald-400">{d.conversions} conv</p>
                    </div>
                    {/* Bars */}
                    <div className="w-full flex gap-0.5 items-end h-40">
                      <div
                        className="flex-1 bg-gold/30 rounded-t-sm hover:bg-gold/50 transition"
                        style={{ height: `${(d.spend / maxSpend) * 100}%` }}
                      />
                      <div
                        className="flex-1 bg-emerald-500/40 rounded-t-sm hover:bg-emerald-500/60 transition"
                        style={{ height: `${(d.conversions / maxConv) * 100}%` }}
                      />
                    </div>
                    <span className="text-[8px] text-muted">{d.date}</span>
                  </div>
                ))}
              </div>
              <div className="flex gap-4 mt-3 justify-center">
                <span className="flex items-center gap-1.5 text-[10px] text-muted"><span className="w-2.5 h-2.5 rounded-sm bg-gold/40" /> Spend</span>
                <span className="flex items-center gap-1.5 text-[10px] text-muted"><span className="w-2.5 h-2.5 rounded-sm bg-emerald-500/50" /> Conversions</span>
              </div>
            </div>
          </div>

          {/* Top campaigns + AI recommendations */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Top campaigns */}
            <div className="bg-card border border-border rounded-xl p-5">
              <h3 className="text-xs font-semibold text-muted uppercase tracking-wider mb-3">Top Performing Campaigns</h3>
              <div className="space-y-2">
                {topCampaigns.length === 0 ? (
                  <div className="py-8 text-center">
                    <Target size={24} className="text-muted/30 mx-auto mb-2" />
                    <p className="text-xs text-muted">No campaigns yet</p>
                    <p className="text-[10px] text-muted/70 mt-1">Connect an ad platform and launch a campaign to see performance here</p>
                  </div>
                ) : topCampaigns.map((c, i) => {
                  const p = getPlatform(c.platform);
                  return (
                    <div key={c.id} className="flex items-center gap-3 p-3 rounded-lg bg-white/[0.02] hover:bg-white/[0.04] transition">
                      <span className="text-gold/50 text-sm font-bold w-5">#{i + 1}</span>
                      <span className="w-6 h-6 rounded flex items-center justify-center shrink-0 overflow-hidden">
                        {getAdBrandIcon(p.id, 24)}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-foreground truncate">{c.name}</p>
                        <p className="text-[10px] text-muted">{fmtCurrency(c.total_spend)} spend</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-bold text-emerald-400">{c.roas}x</p>
                        <p className="text-[10px] text-muted">ROAS</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* AI Recommendations */}
            <div className="bg-card border border-border rounded-xl p-5">
              <h3 className="text-xs font-semibold text-muted uppercase tracking-wider mb-3 flex items-center gap-1.5">
                <Sparkles size={12} className="text-gold" /> AI Recommendations
              </h3>
              <div className="space-y-2">
                {recommendations.length === 0 ? (
                  <div className="py-8 text-center">
                    <Sparkles size={24} className="text-muted/30 mx-auto mb-2" />
                    <p className="text-xs text-muted">No recommendations yet</p>
                    <p className="text-[10px] text-muted/70 mt-1">Once you have active campaigns, AI will suggest budget shifts and optimizations</p>
                  </div>
                ) : recommendations.map((r, i) => (
                  <div
                    key={i}
                    className={`p-3 rounded-lg border text-xs ${
                      r.type === "warning"
                        ? "bg-amber-500/5 border-amber-500/20 text-amber-300"
                        : r.type === "success"
                        ? "bg-emerald-500/5 border-emerald-500/20 text-emerald-300"
                        : "bg-blue-500/5 border-blue-500/20 text-blue-300"
                    }`}
                  >
                    <div className="flex items-start gap-2">
                      {r.type === "warning" && <AlertTriangle size={12} className="mt-0.5 shrink-0" />}
                      {r.type === "success" && <TrendingUp size={12} className="mt-0.5 shrink-0" />}
                      {r.type === "info" && <Sparkles size={12} className="mt-0.5 shrink-0" />}
                      <span>{r.text}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── CAMPAIGNS TAB ── */}
      {tab === "campaigns" && (
        <div className="space-y-4">
          {/* Toolbar */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative flex-1 min-w-[200px] max-w-xs">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search campaigns..."
                className="w-full pl-8 pr-3 py-2 bg-card border border-border rounded-lg text-xs text-foreground placeholder:text-muted focus:border-gold/40 focus:outline-none transition"
              />
            </div>
            <select
              value={platformFilter}
              onChange={e => setPlatformFilter(e.target.value)}
              className="px-3 py-2 bg-card border border-border rounded-lg text-xs text-foreground focus:border-gold/40 focus:outline-none"
            >
              <option value="all">All Platforms</option>
              {PLATFORMS.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
            </select>
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
              className="px-3 py-2 bg-card border border-border rounded-lg text-xs text-foreground focus:border-gold/40 focus:outline-none"
            >
              <option value="all">All Statuses</option>
              <option value="active">Active</option>
              <option value="paused">Paused</option>
              <option value="ended">Ended</option>
            </select>
            <div className="flex-1" />
            {selected.size > 0 && (
              <div className="flex items-center gap-1">
                <span className="text-[10px] text-muted mr-1">{selected.size} selected</span>
                <button onClick={() => bulkAction("pause")} className="px-2 py-1.5 rounded-md bg-amber-500/10 text-amber-400 border border-amber-500/20 text-[10px] hover:bg-amber-500/20 transition">
                  <Pause size={10} className="inline mr-1" />Pause
                </button>
                <button onClick={() => bulkAction("resume")} className="px-2 py-1.5 rounded-md bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[10px] hover:bg-emerald-500/20 transition">
                  <Play size={10} className="inline mr-1" />Resume
                </button>
                <button onClick={() => bulkAction("duplicate")} className="px-2 py-1.5 rounded-md bg-blue-500/10 text-blue-400 border border-blue-500/20 text-[10px] hover:bg-blue-500/20 transition">
                  <Copy size={10} className="inline mr-1" />Duplicate
                </button>
              </div>
            )}
            <button
              onClick={() => setShowCreate(true)}
              className="px-3 py-2 rounded-lg bg-gold/10 text-gold border border-gold/30 text-xs font-medium hover:bg-gold/20 transition flex items-center gap-1.5"
            >
              <Plus size={12} /> Create Campaign
            </button>
          </div>

          {/* Campaign table */}
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border text-muted text-[10px] uppercase tracking-wider">
                    <th className="p-3 text-left w-8">
                      <input
                        type="checkbox"
                        checked={selected.size === filtered.length && filtered.length > 0}
                        onChange={() => {
                          if (selected.size === filtered.length) setSelected(new Set());
                          else setSelected(new Set(filtered.map(c => c.id)));
                        }}
                        className="accent-gold"
                      />
                    </th>
                    <th className="p-3 text-left">Campaign</th>
                    <th className="p-3 text-left">Platform</th>
                    <th className="p-3 text-center">Status</th>
                    <th className="p-3 text-right">Budget</th>
                    <th className="p-3 text-right">Spend</th>
                    <th className="p-3 text-right">Impr</th>
                    <th className="p-3 text-right">Clicks</th>
                    <th className="p-3 text-right">CTR</th>
                    <th className="p-3 text-right">Conv</th>
                    <th className="p-3 text-right">CPA</th>
                    <th className="p-3 text-center">AI</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(c => {
                    const p = getPlatform(c.platform);
                    return (
                      <tr key={c.id} className="border-b border-border/50 hover:bg-white/[0.02] transition">
                        <td className="p-3">
                          <input
                            type="checkbox"
                            checked={selected.has(c.id)}
                            onChange={() => {
                              const next = new Set(selected);
                              if (next.has(c.id)) { next.delete(c.id); } else { next.add(c.id); }
                              setSelected(next);
                            }}
                            className="accent-gold"
                          />
                        </td>
                        <td className="p-3">
                          <p className="font-medium text-foreground">{c.name}</p>
                          <p className="text-[10px] text-muted mt-0.5">{c.objective} | {c.audience}</p>
                        </td>
                        <td className="p-3">
                          <span className="flex items-center gap-1.5">
                            <span
                              className="w-5 h-5 rounded flex items-center justify-center text-[9px] font-bold text-white"
                              style={{ backgroundColor: p.color }}
                            >
                              {p.icon}
                            </span>
                            <span className="text-muted">{p.label}</span>
                          </span>
                        </td>
                        <td className="p-3 text-center">
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium ${
                            c.status === "active"
                              ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                              : c.status === "paused"
                              ? "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                              : "bg-zinc-500/10 text-zinc-400 border border-zinc-500/20"
                          }`}>
                            {c.status === "active" && <Play size={8} />}
                            {c.status === "paused" && <Pause size={8} />}
                            {c.status === "ended" && <XCircle size={8} />}
                            {c.status}
                          </span>
                        </td>
                        <td className="p-3 text-right text-foreground">{fmtCurrency(c.daily_budget)}/d</td>
                        <td className="p-3 text-right text-foreground font-medium">{fmtCurrency(c.total_spend)}</td>
                        <td className="p-3 text-right text-muted">{fmt(c.impressions)}</td>
                        <td className="p-3 text-right text-muted">{fmt(c.clicks)}</td>
                        <td className="p-3 text-right">
                          <span className={c.ctr >= 2 ? "text-emerald-400" : c.ctr >= 1 ? "text-foreground" : "text-amber-400"}>
                            {fmtPct(c.ctr)}
                          </span>
                        </td>
                        <td className="p-3 text-right text-foreground font-medium">{fmt(c.conversions)}</td>
                        <td className="p-3 text-right">
                          {c.cpa > 0 ? (
                            <span className={c.cpa <= 25 ? "text-emerald-400" : c.cpa <= 40 ? "text-foreground" : "text-red-400"}>
                              {fmtCurrency(c.cpa)}
                            </span>
                          ) : (
                            <span className="text-muted">-</span>
                          )}
                        </td>
                        <td className="p-3 text-center">
                          {c.ai_optimized ? (
                            <span className="text-gold" title="AI Optimized"><Bot size={14} /></span>
                          ) : (
                            <span className="text-muted/30">-</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                  {filtered.length === 0 && (
                    <tr>
                      <td colSpan={12} className="p-8 text-center text-muted text-sm">
                        No campaigns match your filters
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Create campaign modal */}
          {showCreate && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setShowCreate(false)}>
              <div className="bg-card border border-border rounded-2xl p-6 w-full max-w-lg mx-4 shadow-2xl" onClick={e => e.stopPropagation()}>
                <h2 className="text-lg font-bold text-foreground mb-4 flex items-center gap-2">
                  <Plus size={16} className="text-gold" /> Create Campaign
                </h2>
                <div className="space-y-3">
                  <div>
                    <label className="text-[10px] text-muted uppercase tracking-wider mb-1 block">Campaign Name</label>
                    <input
                      type="text"
                      value={newCampaign.name}
                      onChange={e => setNewCampaign(p => ({ ...p, name: e.target.value }))}
                      placeholder="e.g., Spring Sale - Conversions"
                      className="w-full px-3 py-2 bg-black/30 border border-border rounded-lg text-xs text-foreground placeholder:text-muted focus:border-gold/40 focus:outline-none"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[10px] text-muted uppercase tracking-wider mb-1 block">Platform</label>
                      <select
                        value={newCampaign.platform}
                        onChange={e => setNewCampaign(p => ({ ...p, platform: e.target.value }))}
                        className="w-full px-3 py-2 bg-black/30 border border-border rounded-lg text-xs text-foreground focus:border-gold/40 focus:outline-none"
                      >
                        {PLATFORMS.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="text-[10px] text-muted uppercase tracking-wider mb-1 block">Objective</label>
                      <select
                        value={newCampaign.objective}
                        onChange={e => setNewCampaign(p => ({ ...p, objective: e.target.value }))}
                        className="w-full px-3 py-2 bg-black/30 border border-border rounded-lg text-xs text-foreground focus:border-gold/40 focus:outline-none"
                      >
                        {OBJECTIVES.map(o => <option key={o} value={o}>{o.charAt(0).toUpperCase() + o.slice(1)}</option>)}
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="text-[10px] text-muted uppercase tracking-wider mb-1 block">Daily Budget ($)</label>
                    <input
                      type="number"
                      value={newCampaign.daily_budget}
                      onChange={e => setNewCampaign(p => ({ ...p, daily_budget: Number(e.target.value) }))}
                      className="w-full px-3 py-2 bg-black/30 border border-border rounded-lg text-xs text-foreground focus:border-gold/40 focus:outline-none"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[10px] text-muted uppercase tracking-wider mb-1 block">Start Date</label>
                      <input
                        type="date"
                        value={newCampaign.start_date}
                        onChange={e => setNewCampaign(p => ({ ...p, start_date: e.target.value }))}
                        className="w-full px-3 py-2 bg-black/30 border border-border rounded-lg text-xs text-foreground focus:border-gold/40 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-muted uppercase tracking-wider mb-1 block">End Date (optional)</label>
                      <input
                        type="date"
                        value={newCampaign.end_date}
                        onChange={e => setNewCampaign(p => ({ ...p, end_date: e.target.value }))}
                        className="w-full px-3 py-2 bg-black/30 border border-border rounded-lg text-xs text-foreground focus:border-gold/40 focus:outline-none"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="text-[10px] text-muted uppercase tracking-wider mb-1 block">Target Audience</label>
                    <input
                      type="text"
                      value={newCampaign.audience}
                      onChange={e => setNewCampaign(p => ({ ...p, audience: e.target.value }))}
                      placeholder="e.g., Lookalike 1% - Purchasers"
                      className="w-full px-3 py-2 bg-black/30 border border-border rounded-lg text-xs text-foreground placeholder:text-muted focus:border-gold/40 focus:outline-none"
                    />
                  </div>
                  <div className="flex items-center justify-between p-3 bg-gold/5 border border-gold/20 rounded-lg">
                    <div className="flex items-center gap-2">
                      <Bot size={14} className="text-gold" />
                      <span className="text-xs text-foreground">Let AI optimize this campaign</span>
                    </div>
                    <button
                      onClick={() => setNewCampaign(p => ({ ...p, ai_optimized: !p.ai_optimized }))}
                      className="text-gold"
                    >
                      {newCampaign.ai_optimized ? <ToggleRight size={22} /> : <ToggleLeft size={22} className="text-muted" />}
                    </button>
                  </div>
                  {newCampaign.ai_optimized && (
                    <p className="text-[10px] text-muted -mt-1 ml-1">
                      AI will auto-adjust bids, targeting, and creative delivery based on performance data.
                    </p>
                  )}
                </div>
                <div className="flex justify-end gap-2 mt-5">
                  <button
                    onClick={() => setShowCreate(false)}
                    className="px-4 py-2 rounded-lg bg-white/5 border border-border text-muted text-xs hover:text-foreground transition"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={createCampaign}
                    disabled={!newCampaign.name}
                    className="px-4 py-2 rounded-lg bg-gold/10 text-gold border border-gold/30 text-xs font-medium hover:bg-gold/20 transition disabled:opacity-40"
                  >
                    Create Campaign
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── CREATIVES TAB ── */}
      {tab === "creatives" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-foreground">Ad Creatives</h3>
            <button
              onClick={() => { setShowGenerateCopy(true); setGeneratedVariations([]); }}
              className="px-3 py-2 rounded-lg bg-gold/10 text-gold border border-gold/30 text-xs font-medium hover:bg-gold/20 transition flex items-center gap-1.5"
            >
              <Wand2 size={12} /> Generate with AI
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {creatives.map(cr => {
              const campaign = campaigns.find(c => c.id === cr.campaign_id);
              return (
                <div key={cr.id} className="bg-card border border-border rounded-xl overflow-hidden hover:border-gold/30 transition group">
                  {/* Preview area */}
                  <div className="h-36 bg-gradient-to-br from-white/[0.03] to-white/[0.01] flex items-center justify-center border-b border-border">
                    {cr.format === "video" ? (
                      <div className="flex flex-col items-center gap-2 text-muted">
                        <Video size={28} className="text-gold/40" />
                        <span className="text-[10px]">Video Creative</span>
                      </div>
                    ) : cr.format === "image" ? (
                      <div className="flex flex-col items-center gap-2 text-muted">
                        <ImageIcon size={28} className="text-gold/40" />
                        <span className="text-[10px]">Image Creative</span>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center gap-2 text-muted">
                        <Type size={28} className="text-gold/40" />
                        <span className="text-[10px]">Text Ad</span>
                      </div>
                    )}
                  </div>
                  <div className="p-4">
                    <p className="text-sm font-semibold text-foreground mb-1">{cr.headline}</p>
                    <p className="text-[11px] text-muted mb-3 line-clamp-2">{cr.description}</p>
                    <div className="flex items-center gap-2 mb-3">
                      <span className="px-2 py-0.5 rounded bg-gold/10 text-gold text-[10px] font-medium border border-gold/20">{cr.cta}</span>
                      {cr.ab_status && (
                        <span className={`px-2 py-0.5 rounded text-[10px] font-medium ${
                          cr.ab_status === "winner"
                            ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                            : cr.ab_status === "loser"
                            ? "bg-red-500/10 text-red-400 border border-red-500/20"
                            : "bg-blue-500/10 text-blue-400 border border-blue-500/20"
                        }`}>
                          A/B: {cr.ab_status}
                        </span>
                      )}
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-[11px]">
                      <div className="bg-white/[0.03] rounded-lg p-2 text-center">
                        <p className="text-muted text-[9px] uppercase">CTR</p>
                        <p className={`font-bold ${cr.ctr >= 3 ? "text-emerald-400" : cr.ctr >= 1.5 ? "text-foreground" : "text-amber-400"}`}>{fmtPct(cr.ctr)}</p>
                      </div>
                      <div className="bg-white/[0.03] rounded-lg p-2 text-center">
                        <p className="text-muted text-[9px] uppercase">Conv Rate</p>
                        <p className={`font-bold ${cr.conversion_rate >= 3 ? "text-emerald-400" : cr.conversion_rate >= 1 ? "text-foreground" : "text-muted"}`}>
                          {cr.conversion_rate > 0 ? fmtPct(cr.conversion_rate) : "-"}
                        </p>
                      </div>
                    </div>
                    {campaign && (
                      <p className="text-[10px] text-muted mt-2 truncate">Campaign: {campaign.name}</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Generate copy modal */}
          {showGenerateCopy && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setShowGenerateCopy(false)}>
              <div className="bg-card border border-border rounded-2xl p-6 w-full max-w-lg mx-4 shadow-2xl" onClick={e => e.stopPropagation()}>
                <h2 className="text-lg font-bold text-foreground mb-4 flex items-center gap-2">
                  <Wand2 size={16} className="text-gold" /> Generate Ad Copy with AI
                </h2>
                {generatedVariations.length === 0 ? (
                  <div className="text-center py-6">
                    <p className="text-sm text-muted mb-4">AI will generate 3 ad copy variations optimized for conversions.</p>
                    <button
                      onClick={generateAdCopy}
                      disabled={generatingCopy}
                      className="px-4 py-2 rounded-lg bg-gold/10 text-gold border border-gold/30 text-xs font-medium hover:bg-gold/20 transition disabled:opacity-40 flex items-center gap-2 mx-auto"
                    >
                      {generatingCopy ? <Loader size={12} className="animate-spin" /> : <Sparkles size={12} />}
                      {generatingCopy ? "Generating..." : "Generate Variations"}
                    </button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {generatedVariations.map((v, i) => (
                      <div key={i} className="p-3 bg-white/[0.03] border border-border rounded-lg">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-[10px] text-gold font-medium">Variation {i + 1}</span>
                          <button
                            onClick={() => {
                              navigator.clipboard.writeText(`${v.headline}\n${v.description}`);
                              toast.success("Copied to clipboard");
                            }}
                            className="text-muted hover:text-foreground transition"
                          >
                            <Copy size={11} />
                          </button>
                        </div>
                        <p className="text-sm font-semibold text-foreground">{v.headline}</p>
                        <p className="text-[11px] text-muted mt-1">{v.description}</p>
                        <span className="inline-block mt-2 px-2 py-0.5 rounded bg-gold/10 text-gold text-[10px] border border-gold/20">{v.cta}</span>
                      </div>
                    ))}
                  </div>
                )}
                <div className="flex justify-end mt-4">
                  <button
                    onClick={() => setShowGenerateCopy(false)}
                    className="px-4 py-2 rounded-lg bg-white/5 border border-border text-muted text-xs hover:text-foreground transition"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── AUDIENCES TAB ── */}
      {tab === "audiences" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-foreground">Audience Targeting</h3>
            <div className="flex gap-2">
              <button className="px-3 py-2 rounded-lg bg-card border border-border text-muted text-xs hover:text-foreground hover:border-gold/40 transition flex items-center gap-1.5">
                <Users size={12} /> Build Lookalike
              </button>
            </div>
          </div>

          {/* Retargeting pixel status */}
          <div className="bg-card border border-border rounded-xl p-4">
            <h4 className="text-xs font-semibold text-muted uppercase tracking-wider mb-3">Retargeting Pixel Status</h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {PLATFORMS.map(p => (
                <div key={p.id} className="flex items-center gap-3 p-3 bg-white/[0.02] rounded-lg">
                  <span className="w-7 h-7 rounded flex items-center justify-center overflow-hidden">
                    {getAdBrandIcon(p.id, 28)}
                  </span>
                  <div className="flex-1">
                    <p className="text-xs font-medium text-foreground">{p.label} Pixel</p>
                    <p className="text-[10px] text-muted">Last fire: 2 min ago</p>
                  </div>
                  <span className="flex items-center gap-1 text-[10px] text-emerald-400">
                    <CheckCircle2 size={10} /> Active
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Audiences grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {audiences.map(aud => {
              const p = getPlatform(aud.platform);
              return (
                <div key={aud.id} className="bg-card border border-border rounded-xl p-4 hover:border-gold/30 transition">
                  <div className="flex items-center justify-between mb-3">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${
                      aud.type === "lookalike"
                        ? "bg-purple-500/10 text-purple-400 border border-purple-500/20"
                        : aud.type === "retargeting"
                        ? "bg-blue-500/10 text-blue-400 border border-blue-500/20"
                        : aud.type === "custom"
                        ? "bg-gold/10 text-gold border border-gold/20"
                        : "bg-zinc-500/10 text-zinc-400 border border-zinc-500/20"
                    }`}>
                      {aud.type}
                    </span>
                    <span className="w-5 h-5 rounded flex items-center justify-center overflow-hidden">
                      {getAdBrandIcon(p.id, 20)}
                    </span>
                  </div>
                  <p className="text-sm font-medium text-foreground mb-1">{aud.name}</p>
                  <div className="flex items-center gap-4 text-[11px] text-muted mt-2">
                    <span className="flex items-center gap-1">
                      <Users size={10} /> {aud.size >= 1000000 ? `${(aud.size / 1000000).toFixed(1)}M` : `${(aud.size / 1000).toFixed(0)}K`}
                    </span>
                    <span className="flex items-center gap-1">
                      <Target size={10} /> {aud.campaigns_using} campaign{aud.campaigns_using !== 1 ? "s" : ""}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Lookalike builder */}
          <div className="bg-card border border-gold/20 rounded-xl p-5">
            <div className="flex items-center gap-2 mb-4">
              <Sparkles size={14} className="text-gold" />
              <h4 className="text-sm font-semibold text-foreground">Lookalike Audience Builder</h4>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label className="text-[10px] text-muted uppercase tracking-wider mb-1 block">Source Audience</label>
                <select className="w-full px-3 py-2 bg-black/30 border border-border rounded-lg text-xs text-foreground focus:border-gold/40 focus:outline-none">
                  <option>Purchasers (Last 180 days)</option>
                  <option>Email Subscribers</option>
                  <option>High-Value Customers</option>
                  <option>Website Visitors</option>
                </select>
              </div>
              <div>
                <label className="text-[10px] text-muted uppercase tracking-wider mb-1 block">Similarity</label>
                <select className="w-full px-3 py-2 bg-black/30 border border-border rounded-lg text-xs text-foreground focus:border-gold/40 focus:outline-none">
                  <option>1% (Most similar)</option>
                  <option>2%</option>
                  <option>3%</option>
                  <option>5%</option>
                  <option>10% (Broadest reach)</option>
                </select>
              </div>
              <div>
                <label className="text-[10px] text-muted uppercase tracking-wider mb-1 block">Platform</label>
                <select className="w-full px-3 py-2 bg-black/30 border border-border rounded-lg text-xs text-foreground focus:border-gold/40 focus:outline-none">
                  {PLATFORMS.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
                </select>
              </div>
            </div>
            <button className="mt-3 px-4 py-2 rounded-lg bg-gold/10 text-gold border border-gold/30 text-xs font-medium hover:bg-gold/20 transition">
              Create Lookalike Audience
            </button>
          </div>
        </div>
      )}

      {/* ── AI AUTOPILOT TAB ── */}
      {tab === "autopilot" && (
        <div className="space-y-5">
          {/* Auto-optimize toggles */}
          <div className="bg-card border border-gold/20 rounded-xl p-5">
            <div className="flex items-center gap-2 mb-4">
              <Bot size={16} className="text-gold" />
              <h3 className="text-sm font-semibold text-foreground">AI Auto-Optimize</h3>
              <span className="ml-auto text-[10px] text-muted">Toggle per platform</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {PLATFORMS.map(p => (
                <div key={p.id} className={`flex items-center justify-between p-4 rounded-xl border transition ${
                  autoOptimize[p.id] ? "bg-gold/5 border-gold/30" : "bg-white/[0.02] border-border"
                }`}>
                  <div className="flex items-center gap-3">
                    <span className="w-8 h-8 rounded-lg flex items-center justify-center overflow-hidden">
                      {getAdBrandIcon(p.id, 32)}
                    </span>
                    <div>
                      <p className="text-xs font-medium text-foreground">{p.label}</p>
                      <p className="text-[10px] text-muted">{autoOptimize[p.id] ? "AI managing" : "Manual mode"}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setAutoOptimize(prev => ({ ...prev, [p.id]: !prev[p.id] }))}
                    className={autoOptimize[p.id] ? "text-gold" : "text-muted"}
                  >
                    {autoOptimize[p.id] ? <ToggleRight size={26} /> : <ToggleLeft size={26} />}
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Rules engine */}
          <div className="bg-card border border-border rounded-xl p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Settings2 size={14} className="text-gold" />
                <h3 className="text-sm font-semibold text-foreground">Automation Rules</h3>
              </div>
              <button
                onClick={() => setShowNewRule(true)}
                className="px-3 py-1.5 rounded-lg bg-gold/10 text-gold border border-gold/30 text-xs font-medium hover:bg-gold/20 transition flex items-center gap-1"
              >
                <Plus size={11} /> Add Rule
              </button>
            </div>
            <div className="space-y-2">
              {rules.map(rule => {
                const p = rule.platform === "all" ? null : getPlatform(rule.platform);
                return (
                  <div key={rule.id} className={`flex items-center gap-3 p-3 rounded-lg border transition ${
                    rule.enabled ? "bg-white/[0.02] border-border" : "bg-white/[0.01] border-border/50 opacity-50"
                  }`}>
                    <button
                      onClick={() => setRules(prev => prev.map(r => r.id === rule.id ? { ...r, enabled: !r.enabled } : r))}
                      className={rule.enabled ? "text-gold" : "text-muted"}
                    >
                      {rule.enabled ? <ToggleRight size={20} /> : <ToggleLeft size={20} />}
                    </button>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-foreground">
                        <span className="font-medium text-amber-400">IF</span> {rule.condition}{" "}
                        <span className="font-medium text-emerald-400">THEN</span> {rule.action}
                      </p>
                    </div>
                    {p ? (
                      <span
                        className="w-5 h-5 rounded flex items-center justify-center text-[8px] font-bold text-white shrink-0"
                        style={{ backgroundColor: p.color }}
                      >
                        {p.icon}
                      </span>
                    ) : (
                      <span className="text-[10px] text-muted px-1.5 py-0.5 rounded bg-white/[0.05] border border-border">All</span>
                    )}
                  </div>
                );
              })}
            </div>

            {/* New rule inline form */}
            {showNewRule && (
              <div className="mt-3 p-3 bg-gold/5 border border-gold/20 rounded-lg space-y-2">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                  <div>
                    <label className="text-[10px] text-muted uppercase tracking-wider mb-1 block">IF condition</label>
                    <input
                      type="text"
                      value={newRule.condition}
                      onChange={e => setNewRule(p => ({ ...p, condition: e.target.value }))}
                      placeholder="e.g., CPA > $30"
                      className="w-full px-3 py-2 bg-black/30 border border-border rounded-lg text-xs text-foreground placeholder:text-muted focus:border-gold/40 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-muted uppercase tracking-wider mb-1 block">THEN action</label>
                    <input
                      type="text"
                      value={newRule.action}
                      onChange={e => setNewRule(p => ({ ...p, action: e.target.value }))}
                      placeholder="e.g., Pause ad set"
                      className="w-full px-3 py-2 bg-black/30 border border-border rounded-lg text-xs text-foreground placeholder:text-muted focus:border-gold/40 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-muted uppercase tracking-wider mb-1 block">Platform</label>
                    <select
                      value={newRule.platform}
                      onChange={e => setNewRule(p => ({ ...p, platform: e.target.value }))}
                      className="w-full px-3 py-2 bg-black/30 border border-border rounded-lg text-xs text-foreground focus:border-gold/40 focus:outline-none"
                    >
                      <option value="all">All Platforms</option>
                      {PLATFORMS.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
                    </select>
                  </div>
                </div>
                <div className="flex gap-2 justify-end">
                  <button
                    onClick={() => { setShowNewRule(false); setNewRule({ condition: "", action: "", platform: "all" }); }}
                    className="px-3 py-1.5 rounded-lg text-muted text-xs hover:text-foreground transition"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={saveNewRule}
                    disabled={!newRule.condition || !newRule.action}
                    className="px-3 py-1.5 rounded-lg bg-gold/10 text-gold border border-gold/30 text-xs hover:bg-gold/20 transition disabled:opacity-40"
                  >
                    Save Rule
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Budget allocation AI */}
          <div className="bg-card border border-border rounded-xl p-5">
            <div className="flex items-center gap-2 mb-4">
              <Zap size={14} className="text-gold" />
              <h3 className="text-sm font-semibold text-foreground">AI Budget Allocation</h3>
            </div>
            <p className="text-xs text-muted mb-4">
              AI automatically shifts budget to best-performing channels based on real-time ROAS and CPA data.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
              {PLATFORMS.map(p => {
                const stats = platformBreakdown[p.id];
                const spend = stats?.spend || 0;
                const totalSpend = overview?.total_spend || 1;
                const pct = Math.round((spend / totalSpend) * 100);
                return (
                  <div key={p.id} className="p-3 bg-white/[0.02] rounded-lg border border-border">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="w-5 h-5 rounded flex items-center justify-center text-[9px] font-bold text-white" style={{ backgroundColor: p.color }}>
                          {p.icon}
                        </span>
                        <span className="text-xs text-foreground">{p.label}</span>
                      </div>
                      <span className="text-xs font-bold text-foreground">{pct}%</span>
                    </div>
                    <div className="h-1.5 bg-white/[0.05] rounded-full overflow-hidden">
                      <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: p.color }} />
                    </div>
                    <p className="text-[10px] text-muted mt-1">{fmtCurrency(spend)} allocated</p>
                  </div>
                );
              })}
            </div>
            <div className="p-3 bg-gold/5 border border-gold/20 rounded-lg">
              <p className="text-xs text-gold flex items-center gap-1.5">
                <Sparkles size={12} />
                AI Recommendation: Shift 10% budget from Google Shopping to Meta Retargeting for 15% projected ROAS improvement.
              </p>
            </div>
          </div>

          {/* AI Activity Log */}
          <div className="bg-card border border-border rounded-xl p-5">
            <div className="flex items-center gap-2 mb-4">
              <Activity size={14} className="text-gold" />
              <h3 className="text-sm font-semibold text-foreground">AI Activity Log</h3>
              <span className="ml-auto text-[10px] text-muted">{aiLog.length} actions this week</span>
            </div>
            <div className="space-y-2">
              {aiLog.map(entry => {
                const p = getPlatform(entry.platform);
                const dt = new Date(entry.timestamp);
                return (
                  <div key={entry.id} className="flex items-start gap-3 p-3 rounded-lg bg-white/[0.02] hover:bg-white/[0.04] transition">
                    <div className={`w-6 h-6 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${
                      entry.type === "pause" ? "bg-amber-500/10 text-amber-400" :
                      entry.type === "budget" ? "bg-emerald-500/10 text-emerald-400" :
                      entry.type === "creative" ? "bg-purple-500/10 text-purple-400" :
                      entry.type === "audience" ? "bg-blue-500/10 text-blue-400" :
                      "bg-gold/10 text-gold"
                    }`}>
                      {entry.type === "pause" && <Pause size={11} />}
                      {entry.type === "budget" && <DollarSign size={11} />}
                      {entry.type === "creative" && <ImageIcon size={11} />}
                      {entry.type === "audience" && <Users size={11} />}
                      {entry.type === "bid" && <TrendingUp size={11} />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-foreground leading-relaxed">{entry.action}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-[10px] text-muted">
                          {dt.toLocaleDateString("en-US", { month: "short", day: "numeric" })} at{" "}
                          {dt.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
                        </span>
                        <span
                          className="w-4 h-4 rounded flex items-center justify-center text-[7px] font-bold text-white"
                          style={{ backgroundColor: p.color }}
                        >
                          {p.icon}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
