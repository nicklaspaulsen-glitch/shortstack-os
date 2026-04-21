"use client";

import { useEffect, useState, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import { Campaign, AdCreative, Client, AdAction } from "@/lib/types";
import StatCard from "@/components/ui/stat-card";
import StatusBadge from "@/components/ui/status-badge";
import Modal from "@/components/ui/modal";
import { PageLoading } from "@/components/ui/loading";
import { formatCurrency } from "@/lib/utils";
import {
  DollarSign, MousePointer, TrendingUp, Plus,
  Sparkles, Target, Filter, ChevronDown,
  Copy, Wand2, Loader, Pause, Play,
  Megaphone, RefreshCw, Zap,
} from "lucide-react";
import PageHero from "@/components/ui/page-hero";
import {
  Image as ImageIcon, Type, Globe,
  Bot, CheckCircle2, XCircle, ArrowUpRight,
  Shield, Clock, Plug, BarChart3,
  Gauge, Settings2, ToggleLeft, ToggleRight,
  Activity, Users
} from "lucide-react";
import toast from "react-hot-toast";
import PageAI from "@/components/page-ai";
import { MetaIcon, GoogleAdsIcon, TikTokIcon } from "@/components/ui/platform-icons";

type Tab = "overview" | "campaigns" | "creatives" | "copy-lab" | "copilot";

const PLATFORM_META = { id: "meta_ads", label: "Meta Ads", color: "#1877F2", icon: "M" };
const PLATFORM_GOOGLE = { id: "google_ads", label: "Google Ads", color: "#34A853", icon: "G" };
const PLATFORM_TIKTOK = { id: "tiktok_ads", label: "TikTok Ads", color: "#FF0050", icon: "T" };
const PLATFORMS = [PLATFORM_META, PLATFORM_GOOGLE, PLATFORM_TIKTOK];

function getBrandIcon(platformId: string, size = 20): React.ReactNode {
  if (platformId === "meta_ads") return <MetaIcon size={size} />;
  if (platformId === "google_ads") return <GoogleAdsIcon size={size} />;
  if (platformId === "tiktok_ads") return <TikTokIcon size={size} />;
  return <MetaIcon size={size} />;
}

function getPlatformInfo(id: string) {
  return PLATFORMS.find(p => p.id === id) || PLATFORM_META;
}

export default function AdsPage() {
  const [tab, setTab] = useState<Tab>("overview");
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [creatives, setCreatives] = useState<AdCreative[]>([]);
  const [clients, setClients] = useState<Pick<Client, "id" | "business_name">[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddCampaign, setShowAddCampaign] = useState(false);
  const [expandedCampaign, setExpandedCampaign] = useState<string | null>(null);
  const [optimizingId, setOptimizingId] = useState<string | null>(null);

  // Filters
  const [clientFilter, setClientFilter] = useState<string>("all");
  const [platformFilter, setPlatformFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  // Copy Lab state
  const [copyPlatform, setCopyPlatform] = useState("meta_ads");
  const [copyClient, setCopyClient] = useState("");
  const [copyObjective, setCopyObjective] = useState("Lead generation");
  const [copyAudience, setCopyAudience] = useState("");
  const [copyOffer, setCopyOffer] = useState("");
  const [copyTone, setCopyTone] = useState("professional, urgent, benefit-focused");
  const [generatingCopy, setGeneratingCopy] = useState(false);
  const [generatedCopy, setGeneratedCopy] = useState<Record<string, unknown> | null>(null);

  // AI Copilot state
  const [actions, setActions] = useState<AdAction[]>([]);
  const [loadingActions, setLoadingActions] = useState(false);
  const [insights, setInsights] = useState<Record<string, unknown> | null>(null);
  const [loadingInsights, setLoadingInsights] = useState(false);
  const [syncing, setSyncing] = useState<string | null>(null);
  const [processingAction, setProcessingAction] = useState<string | null>(null);

  // Ad account connections
  const [adConnections, setAdConnections] = useState<Record<string, string[]>>({});

  // Autopilot state
  const [autopilotConfig, setAutopilotConfig] = useState<Record<string, unknown>>({});
  const [autopilotRunning, setAutopilotRunning] = useState(false);
  const [savingAutopilot, setSavingAutopilot] = useState(false);

  // Client MRR for overview
  const [clientMrr, setClientMrr] = useState<Record<string, number>>({});

  const supabase = createClient();

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { fetchData(); fetchActions(); fetchAdConnections(); fetchAutopilotConfig(); }, []);

  async function fetchData() {
    try {
      setLoading(true);
      const [{ data: c }, { data: cr }, { data: cl }] = await Promise.all([
        supabase.from("campaigns").select("*").order("created_at", { ascending: false }),
        supabase.from("ad_creatives").select("*").order("created_at", { ascending: false }),
        supabase.from("clients").select("id, business_name").eq("is_active", true),
      ]);
      setCampaigns(c || []);
      setCreatives(cr || []);
      setClients(cl || []);
    } catch (err) {
      console.error("[AdsPage] fetch error:", err);
    } finally {
      setLoading(false);
    }
  }

  async function fetchAdConnections() {
    const { data } = await supabase
      .from("social_accounts")
      .select("client_id, platform")
      .in("platform", ["meta_ads", "google_ads", "tiktok_ads"])
      .eq("is_active", true);
    const map: Record<string, string[]> = {};
    for (const row of data || []) {
      if (!map[row.client_id]) map[row.client_id] = [];
      if (!map[row.client_id].includes(row.platform)) map[row.client_id].push(row.platform);
    }
    setAdConnections(map);
  }

  function connectAdPlatform(clientId: string, platform: string) {
    const baseUrl = window.location.origin;
    if (platform === "meta_ads") {
      window.location.href = `${baseUrl}/api/oauth/meta?client_id=${clientId}`;
    } else if (platform === "google_ads") {
      window.location.href = `${baseUrl}/api/oauth/google?client_id=${clientId}&platform=google_ads`;
    } else if (platform === "tiktok_ads") {
      window.location.href = `${baseUrl}/api/oauth/tiktok-ads?client_id=${clientId}`;
    }
  }

  async function fetchAutopilotConfig() {
    try {
      const res = await fetch("/api/ads/autopilot");
      const data = await res.json();
      setAutopilotConfig(data.config || {});
    } catch (err) { console.error("[Ads] fetchAutopilotConfig:", err); }
    // Also get client MRR data
    const { data: cl } = await supabase.from("clients").select("id, mrr").eq("is_active", true);
    const mrrMap: Record<string, number> = {};
    for (const c of cl || []) mrrMap[c.id] = c.mrr || 0;
    setClientMrr(mrrMap);
  }

  async function saveAutopilotConfig(updates: Record<string, unknown>) {
    setSavingAutopilot(true);
    const newConfig = { ...autopilotConfig, ...updates };
    setAutopilotConfig(newConfig);
    try {
      await fetch("/api/ads/autopilot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "save_config", config: newConfig }),
      });
      toast.success("Autopilot settings saved");
    } catch { toast.error("Failed to save"); }
    setSavingAutopilot(false);
  }

  async function runAutopilot() {
    setAutopilotRunning(true);
    try {
      const res = await fetch("/api/ads/autopilot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "run" }),
      });
      const data = await res.json();
      if (data.skipped) { toast.error(data.reason || "Autopilot skipped"); }
      else {
        toast.success(`Autopilot: ${data.actions_taken || 0} actions, ${data.ads_created || 0} ads created`);
        fetchData(); fetchActions();
      }
    } catch { toast.error("Autopilot error"); }
    setAutopilotRunning(false);
  }

  // Filtered campaigns
  const filtered = useMemo(() => {
    return campaigns.filter(c => {
      if (clientFilter !== "all" && c.client_id !== clientFilter) return false;
      if (platformFilter !== "all" && c.platform !== platformFilter) return false;
      if (statusFilter !== "all" && c.status !== statusFilter) return false;
      return true;
    });
  }, [campaigns, clientFilter, platformFilter, statusFilter]);

  // Stats
  const totalSpend = filtered.reduce((s, c) => s + c.spend, 0);
  const totalConversions = filtered.reduce((s, c) => s + c.conversions, 0);
  const avgROAS = filtered.filter(c => c.roas > 0).reduce((s, c) => s + c.roas, 0) / (filtered.filter(c => c.roas > 0).length || 1);
  const avgCTR = filtered.filter(c => c.ctr > 0).reduce((s, c) => s + c.ctr, 0) / (filtered.filter(c => c.ctr > 0).length || 1);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const totalImpressions = filtered.reduce((s, c) => s + c.impressions, 0);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const totalClicks = filtered.reduce((s, c) => s + c.clicks, 0);

  // Platform breakdown
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const platformBreakdown = useMemo(() => {
    return PLATFORMS.map(p => {
      const platCampaigns = filtered.filter(c => c.platform === p.id);
      return {
        ...p,
        count: platCampaigns.length,
        spend: platCampaigns.reduce((s, c) => s + c.spend, 0),
        conversions: platCampaigns.reduce((s, c) => s + c.conversions, 0),
        roas: platCampaigns.filter(c => c.roas > 0).reduce((s, c) => s + c.roas, 0) / (platCampaigns.filter(c => c.roas > 0).length || 1),
      };
    }).filter(p => p.count > 0);
  }, [filtered]);

  async function addCampaign(formData: FormData) {
    const { error } = await supabase.from("campaigns").insert({
      client_id: formData.get("client_id"),
      name: formData.get("name"),
      platform: formData.get("platform"),
      budget_daily: parseFloat(formData.get("budget_daily") as string) || null,
      budget_total: parseFloat(formData.get("budget_total") as string) || null,
      start_date: formData.get("start_date") || null,
      end_date: formData.get("end_date") || null,
    });
    if (error) toast.error("Failed to create campaign");
    else { toast.success("Campaign created"); setShowAddCampaign(false); fetchData(); }
  }

  async function updateCampaignStatus(id: string, status: string) {
    const { error } = await supabase.from("campaigns").update({ status }).eq("id", id);
    if (error) toast.error("Failed to update");
    else { toast.success(`Campaign ${status}`); fetchData(); }
  }

  async function generateAISuggestions(campaignId: string) {
    setOptimizingId(campaignId);
    try {
      const res = await fetch("/api/ads/optimize", {
        method: "POST",
        body: JSON.stringify({ campaign_id: campaignId }),
        headers: { "Content-Type": "application/json" },
      });
      if (res.ok) {
        toast.success("AI suggestions generated");
        fetchData();
      } else {
        toast.error("Failed to generate suggestions");
      }
    } catch {
      toast.error("Connection error");
    }
    setOptimizingId(null);
  }

  async function generateAdCopy() {
    setGeneratingCopy(true);
    try {
      const res = await fetch("/api/ads/generate-copy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          client_id: copyClient || null,
          platform: copyPlatform,
          objective: copyObjective,
          target_audience: copyAudience,
          offer: copyOffer,
          tone: copyTone,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setGeneratedCopy(data.adCopy);
        toast.success("Ad copy generated!");
      } else {
        toast.error(data.error || "Failed to generate copy");
      }
    } catch {
      toast.error("Connection error");
    }
    setGeneratingCopy(false);
  }

  async function fetchActions() {
    setLoadingActions(true);
    try {
      const res = await fetch("/api/ads/actions");
      const data = await res.json();
      setActions(data.actions || []);
    } catch (err) { console.error("[Ads] fetchActions:", err); }
    setLoadingActions(false);
  }

  async function handleAction(actionId: string, operation: "approve" | "reject" | "execute") {
    setProcessingAction(actionId);
    try {
      const res = await fetch("/api/ads/actions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action_id: actionId, operation }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success(operation === "approve" ? "Action approved" : operation === "reject" ? "Action rejected" : "Action executed");
        fetchActions();
        if (operation === "execute") fetchData();
      } else {
        toast.error(data.error || "Failed");
      }
    } catch { toast.error("Error"); }
    setProcessingAction(null);
  }

  async function fetchInsights() {
    setLoadingInsights(true);
    try {
      const res = await fetch("/api/ads/optimize");
      const data = await res.json();
      setInsights(data);
    } catch { toast.error("Failed to load insights"); }
    setLoadingInsights(false);
  }

  async function syncPlatform(clientId: string, platform?: string) {
    setSyncing(platform || "all");
    try {
      const res = await fetch("/api/ads/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ client_id: clientId, platform }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success("Sync complete");
        fetchData();
      } else {
        toast.error(data.error || "Sync failed");
      }
    } catch { toast.error("Sync error"); }
    setSyncing(null);
  }

  const pendingActions = actions.filter(a => a.status === "proposed");
  const approvedActions = actions.filter(a => a.status === "approved");
  const recentActions = actions.filter(a => ["executed", "rejected", "failed"].includes(a.status)).slice(0, 10);

  function getClientName(clientId: string) {
    return clients.find(c => c.id === clientId)?.business_name || "—";
  }

  if (loading) return <PageLoading />;

  return (
    <div className="fade-in space-y-6 max-w-[1400px] mx-auto">
      <PageHero
        icon={<Megaphone size={28} />}
        title="Ads Center"
        subtitle="Manage Meta, Google & TikTok campaigns with AI."
        gradient="sunset"
        actions={
          <>
            <button onClick={fetchData} className="px-3 py-1.5 rounded-lg bg-white/10 border border-white/20 text-white text-xs font-medium hover:bg-white/20 transition-all flex items-center gap-1.5">
              <RefreshCw size={12} /> Sync
            </button>
            <button onClick={() => setShowAddCampaign(true)} className="px-3 py-1.5 rounded-lg bg-white/15 border border-white/25 text-white text-xs font-semibold hover:bg-white/25 transition-all flex items-center gap-1.5">
              <Plus size={12} /> New Campaign
            </button>
          </>
        }
      />

      {/* Tabs + Filters */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex gap-1 bg-surface rounded-xl p-1">
          {([
            { id: "overview", label: "Overview", icon: <Gauge size={13} /> },
            { id: "campaigns", label: "Campaigns", icon: <Megaphone size={13} /> },
            { id: "creatives", label: "Creatives", icon: <ImageIcon size={13} /> },
            { id: "copy-lab", label: "Copy Lab", icon: <Wand2 size={13} /> },
            { id: "copilot", label: "AI Copilot", icon: <Bot size={13} /> },
          ] as const).map(t => (
            <button key={t.id} onClick={() => { setTab(t.id); if (t.id === "copilot") fetchActions(); }}
              className={`flex items-center gap-1.5 px-3.5 py-2 text-xs rounded-lg transition-all ${
                tab === t.id ? "bg-gold text-black font-medium shadow-sm" : "text-muted hover:text-foreground"
              }`}
            >
              {t.icon} {t.label}
              {t.id === "copilot" && pendingActions.length > 0 && (
                <span className="ml-1 w-4 h-4 rounded-full bg-danger text-white text-[8px] font-bold flex items-center justify-center">
                  {pendingActions.length}
                </span>
              )}
            </button>
          ))}
        </div>

        {tab === "campaigns" && (
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 text-[10px] text-muted">
              <Filter size={11} />
            </div>
            <select value={clientFilter} onChange={e => setClientFilter(e.target.value)}
              className="input text-xs py-1.5 px-2.5 min-w-0 w-auto">
              <option value="all">All Clients</option>
              {clients.map(c => <option key={c.id} value={c.id}>{c.business_name}</option>)}
            </select>
            <select value={platformFilter} onChange={e => setPlatformFilter(e.target.value)}
              className="input text-xs py-1.5 px-2.5 min-w-0 w-auto">
              <option value="all">All Platforms</option>
              {PLATFORMS.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
            </select>
            <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
              className="input text-xs py-1.5 px-2.5 min-w-0 w-auto">
              <option value="all">All Status</option>
              <option value="active">Active</option>
              <option value="paused">Paused</option>
              <option value="draft">Draft</option>
              <option value="completed">Completed</option>
            </select>
          </div>
        )}
      </div>

      {/* ── Overview Tab ── */}
      {tab === "overview" && (
        <div className="space-y-5">
          {/* KPI Cards */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            <StatCard label="Total Spend" value={formatCurrency(totalSpend)} icon={<DollarSign size={16} />} />
            <StatCard label="Avg ROAS" value={`${avgROAS.toFixed(1)}x`} icon={<TrendingUp size={16} />} changeType={avgROAS >= 2 ? "positive" : avgROAS >= 1 ? "neutral" : "negative"} />
            <StatCard label="Avg CTR" value={`${(avgCTR * 100).toFixed(2)}%`} icon={<MousePointer size={16} />} changeType={avgCTR >= 0.02 ? "positive" : "neutral"} />
            <StatCard label="Conversions" value={totalConversions} icon={<Target size={16} />} />
            <StatCard label="Active Campaigns" value={campaigns.filter(c => c.status === "active").length} icon={<Activity size={16} />} />
            <StatCard label="Client MRR" value={formatCurrency(Object.values(clientMrr).reduce((s, v) => s + v, 0))} icon={<Users size={16} />} />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            {/* Left: Performance by platform + client */}
            <div className="lg:col-span-2 space-y-4">
              {/* Platform Performance */}
              <div className="card-static">
                <h2 className="text-sm font-semibold mb-3 flex items-center gap-2"><BarChart3 size={14} className="text-gold" /> Platform Performance</h2>
                <div className="space-y-2">
                  {PLATFORMS.map(p => {
                    const platCampaigns = campaigns.filter(c => c.platform === p.id);
                    const platSpend = platCampaigns.reduce((s, c) => s + c.spend, 0);
                    const platRoas = platCampaigns.filter(c => c.roas > 0).length > 0
                      ? platCampaigns.filter(c => c.roas > 0).reduce((s, c) => s + c.roas, 0) / platCampaigns.filter(c => c.roas > 0).length : 0;
                    const platConv = platCampaigns.reduce((s, c) => s + c.conversions, 0);
                    const platCtr = platCampaigns.filter(c => c.ctr > 0).length > 0
                      ? platCampaigns.filter(c => c.ctr > 0).reduce((s, c) => s + c.ctr, 0) / platCampaigns.filter(c => c.ctr > 0).length : 0;
                    const platClicks = platCampaigns.reduce((s, c) => s + c.clicks, 0);
                    return (
                      <div key={p.id} className="p-3 rounded-xl bg-surface-light border border-border">
                        <div className="flex items-center gap-3 mb-2">
                          <div className="w-8 h-8 rounded-lg flex items-center justify-center overflow-hidden">{getBrandIcon(p.id, 32)}</div>
                          <div className="flex-1">
                            <p className="text-xs font-semibold">{p.label}</p>
                            <p className="text-[9px] text-muted">{platCampaigns.length} campaign{platCampaigns.length !== 1 ? "s" : ""}</p>
                          </div>
                          {platSpend > 0 && <div className="w-24 h-2 bg-surface rounded-full overflow-hidden">
                            <div className="h-full rounded-full" style={{ backgroundColor: p.color, width: `${totalSpend > 0 ? (platSpend / totalSpend) * 100 : 0}%` }} />
                          </div>}
                        </div>
                        {platCampaigns.length > 0 && (
                          <div className="grid grid-cols-5 gap-2">
                            {[
                              { label: "Spend", value: formatCurrency(platSpend) },
                              { label: "ROAS", value: `${platRoas.toFixed(1)}x`, good: platRoas >= 2 },
                              { label: "CTR", value: `${(platCtr * 100).toFixed(2)}%` },
                              { label: "Clicks", value: platClicks.toLocaleString() },
                              { label: "Conv.", value: platConv.toString() },
                            ].map(m => (
                              <div key={m.label} className="text-center">
                                <p className={`text-[11px] font-bold font-mono ${(m as {good?: boolean}).good ? "text-success" : ""}`}>{m.value}</p>
                                <p className="text-[8px] text-muted">{m.label}</p>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Per-client breakdown */}
              <div className="card-static">
                <h2 className="text-sm font-semibold mb-3 flex items-center gap-2"><Users size={14} className="text-gold" /> Client Ad Performance</h2>
                {clients.length > 0 ? (
                  <div className="space-y-2">
                    {clients.map(cl => {
                      const clCampaigns = campaigns.filter(c => c.client_id === cl.id);
                      if (clCampaigns.length === 0) return null;
                      const clSpend = clCampaigns.reduce((s, c) => s + c.spend, 0);
                      const clRoas = clCampaigns.filter(c => c.roas > 0).length > 0
                        ? clCampaigns.reduce((s, c) => s + c.roas, 0) / clCampaigns.filter(c => c.roas > 0).length : 0;
                      const clConv = clCampaigns.reduce((s, c) => s + c.conversions, 0);
                      const mrr = clientMrr[cl.id] || 0;
                      return (
                        <div key={cl.id} className="flex items-center gap-3 p-2.5 rounded-lg bg-surface-light border border-border">
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium truncate">{cl.business_name}</p>
                            <div className="flex items-center gap-3 mt-0.5">
                              {clCampaigns.map(c => (
                                <span key={c.id} className="w-3 h-3 rounded-sm flex items-center justify-center text-white text-[6px] font-bold" style={{ backgroundColor: getPlatformInfo(c.platform).color }}>{getPlatformInfo(c.platform).icon}</span>
                              ))}
                            </div>
                          </div>
                          <div className="grid grid-cols-4 gap-4 text-center shrink-0">
                            <div><p className="text-[10px] font-bold font-mono">{formatCurrency(clSpend)}</p><p className="text-[7px] text-muted">Spend</p></div>
                            <div><p className={`text-[10px] font-bold font-mono ${clRoas >= 2 ? "text-success" : clRoas < 1 ? "text-danger" : ""}`}>{clRoas.toFixed(1)}x</p><p className="text-[7px] text-muted">ROAS</p></div>
                            <div><p className="text-[10px] font-bold font-mono">{clConv}</p><p className="text-[7px] text-muted">Conv.</p></div>
                            <div><p className="text-[10px] font-bold font-mono">{formatCurrency(mrr)}</p><p className="text-[7px] text-muted">MRR</p></div>
                          </div>
                        </div>
                      );
                    }).filter(Boolean)}
                  </div>
                ) : <p className="text-xs text-muted text-center py-4">No clients with campaigns</p>}
              </div>
            </div>

            {/* Right: Autopilot Controls */}
            <div className="space-y-4">
              <div className="card-static border-gold/20">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Bot size={16} className="text-gold" />
                    <h2 className="text-sm font-semibold">AI Autopilot</h2>
                  </div>
                  <button
                    onClick={() => saveAutopilotConfig({ enabled: !autopilotConfig.enabled })}
                    disabled={savingAutopilot}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                      autopilotConfig.enabled
                        ? "bg-success/10 text-success border border-success/20"
                        : "bg-surface-light text-muted border border-border"
                    }`}>
                    {autopilotConfig.enabled ? <ToggleRight size={14} /> : <ToggleLeft size={14} />}
                    {autopilotConfig.enabled ? "ON" : "OFF"}
                  </button>
                </div>

                <p className="text-[10px] text-muted mb-3">AI analyzes campaigns and auto-executes allowed actions. Control exactly what it can do.</p>

                <button onClick={runAutopilot} disabled={autopilotRunning || !autopilotConfig.enabled}
                  className="btn-primary w-full text-xs flex items-center justify-center gap-2 mb-4 disabled:opacity-50">
                  {autopilotRunning ? <><Loader size={12} className="animate-spin" /> Running...</> : <><Zap size={12} /> Run Autopilot Now</>}
                </button>

                {/* Permission toggles */}
                <div className="space-y-2">
                  <p className="text-[9px] text-muted font-semibold uppercase tracking-wider">Allowed Actions</p>
                  {[
                    { key: "allow_budget_increase", label: "Increase budgets", desc: "On high-ROAS campaigns" },
                    { key: "allow_budget_decrease", label: "Decrease budgets", desc: "On low-ROAS campaigns" },
                    { key: "allow_pause", label: "Pause campaigns", desc: "Auto-pause terrible performers" },
                    { key: "allow_activate", label: "Reactivate campaigns", desc: "Reactivate improved campaigns" },
                    { key: "allow_create_ads", label: "Create new ads", desc: "AI generates copy & creates ads" },
                    { key: "auto_sync", label: "Auto-sync data", desc: "Pull latest data before analysis" },
                  ].map(toggle => (
                    <div key={toggle.key} className="flex items-center justify-between p-2 rounded-lg border border-border hover:border-gold/10 transition-all">
                      <div>
                        <p className="text-[10px] font-medium">{toggle.label}</p>
                        <p className="text-[8px] text-muted">{toggle.desc}</p>
                      </div>
                      <button
                        onClick={() => saveAutopilotConfig({ [toggle.key]: !autopilotConfig[toggle.key] })}
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

                {/* Thresholds */}
                <div className="mt-4 space-y-2">
                  <p className="text-[9px] text-muted font-semibold uppercase tracking-wider">Thresholds</p>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[8px] text-muted">Max budget change %</label>
                      <input type="number" value={Number(autopilotConfig.max_budget_change_pct) || 20}
                        onChange={e => saveAutopilotConfig({ max_budget_change_pct: parseInt(e.target.value) || 20 })}
                        className="input w-full text-xs py-1" />
                    </div>
                    <div>
                      <label className="text-[8px] text-muted">Min ROAS for increase</label>
                      <input type="number" step="0.1" value={Number(autopilotConfig.min_roas_for_increase) || 2}
                        onChange={e => saveAutopilotConfig({ min_roas_for_increase: parseFloat(e.target.value) || 2 })}
                        className="input w-full text-xs py-1" />
                    </div>
                    <div>
                      <label className="text-[8px] text-muted">Max ROAS for decrease</label>
                      <input type="number" step="0.1" value={Number(autopilotConfig.max_roas_for_decrease) || 0.8}
                        onChange={e => saveAutopilotConfig({ max_roas_for_decrease: parseFloat(e.target.value) || 0.8 })}
                        className="input w-full text-xs py-1" />
                    </div>
                    <div>
                      <label className="text-[8px] text-muted">Pause if ROAS below</label>
                      <input type="number" step="0.1" value={Number(autopilotConfig.pause_roas_threshold) || 0.3}
                        onChange={e => saveAutopilotConfig({ pause_roas_threshold: parseFloat(e.target.value) || 0.3 })}
                        className="input w-full text-xs py-1" />
                    </div>
                  </div>
                </div>
              </div>

              {/* Recent autopilot actions */}
              {actions.filter(a => a.status === "executed").length > 0 && (
                <div className="card-static">
                  <h3 className="text-xs font-semibold mb-2 flex items-center gap-2"><Activity size={12} className="text-success" /> Recent AI Actions</h3>
                  <div className="space-y-1.5 max-h-48 overflow-y-auto">
                    {actions.filter(a => a.status === "executed").slice(0, 8).map(a => (
                      <div key={a.id} className="flex items-center gap-2 text-[10px] py-1 border-b border-border/50 last:border-0">
                        <CheckCircle2 size={10} className="text-success shrink-0" />
                        <span className="truncate flex-1">{a.title}</span>
                        <span className="text-[8px] text-muted shrink-0">{new Date(a.executed_at || a.created_at).toLocaleDateString()}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Quick stats */}
              <div className="card-static bg-gold/[0.02] border-gold/10">
                <h3 className="text-xs font-semibold mb-2 flex items-center gap-2"><Settings2 size={12} className="text-gold" /> How Autopilot Works</h3>
                <ol className="space-y-1 text-[10px] text-muted">
                  <li className="flex gap-2"><span className="text-gold font-bold">1.</span> Syncs latest campaign data from all platforms</li>
                  <li className="flex gap-2"><span className="text-gold font-bold">2.</span> AI analyzes performance vs benchmarks</li>
                  <li className="flex gap-2"><span className="text-gold font-bold">3.</span> Proposes budget/status changes within your limits</li>
                  <li className="flex gap-2"><span className="text-gold font-bold">4.</span> Auto-executes only actions you&apos;ve allowed above</li>
                  <li className="flex gap-2"><span className="text-gold font-bold">5.</span> Optionally creates new AI-generated ads</li>
                </ol>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Campaigns Tab ── */}
      {tab === "campaigns" && (
        <div className="space-y-2">
          {filtered.length === 0 ? (
            <div className="card-static text-center py-16">
              <Megaphone size={32} className="mx-auto mb-3 text-muted/30" />
              <p className="text-sm font-medium text-muted">No campaigns found</p>
              <p className="text-xs text-muted mt-1">
                {campaigns.length > 0 ? "Try adjusting your filters" : "Connect client ad accounts from the AI Copilot tab, then sync to pull campaigns"}
              </p>
              <div className="flex items-center justify-center gap-2 mt-4">
                {campaigns.length === 0 && (
                  <button onClick={() => setTab("copilot")} className="btn-primary text-xs inline-flex items-center gap-1.5">
                    <Plug size={12} /> Connect Ad Accounts
                  </button>
                )}
                <button onClick={() => setShowAddCampaign(true)} className="btn-secondary text-xs inline-flex items-center gap-1.5">
                  <Plus size={12} /> Manual Campaign
                </button>
              </div>
            </div>
          ) : (
            filtered.map(campaign => {
              const platform = getPlatformInfo(campaign.platform);
              const isExpanded = expandedCampaign === campaign.id;
              const campaignCreatives = creatives.filter(cr => cr.campaign_id === campaign.id);

              return (
                <div key={campaign.id} className="card-static overflow-hidden">
                  {/* Campaign Row */}
                  <div
                    className="flex items-center gap-4 p-4 cursor-pointer hover:bg-surface-light/50 transition-colors -m-4"
                    onClick={() => setExpandedCampaign(isExpanded ? null : campaign.id)}
                  >
                    {/* Platform Badge */}
                    <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0 overflow-hidden">
                      {getBrandIcon(platform.id, 36)}
                    </div>

                    {/* Name + Client */}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold truncate">{campaign.name}</p>
                        <StatusBadge status={campaign.status} />
                      </div>
                      <p className="text-[10px] text-muted truncate">{getClientName(campaign.client_id)} · {platform.label}</p>
                    </div>

                    {/* Metrics Strip */}
                    <div className="hidden lg:flex items-center gap-6 text-center">
                      <div>
                        <p className="text-xs font-bold font-mono">{formatCurrency(campaign.spend)}</p>
                        <p className="text-[9px] text-muted">Spend</p>
                      </div>
                      <div>
                        <p className="text-xs font-bold font-mono">{campaign.impressions.toLocaleString()}</p>
                        <p className="text-[9px] text-muted">Impr.</p>
                      </div>
                      <div>
                        <p className="text-xs font-bold font-mono">{campaign.clicks.toLocaleString()}</p>
                        <p className="text-[9px] text-muted">Clicks</p>
                      </div>
                      <div>
                        <p className={`text-xs font-bold font-mono ${campaign.roas >= 2 ? "text-success" : campaign.roas >= 1 ? "text-warning" : "text-danger"}`}>
                          {campaign.roas.toFixed(1)}x
                        </p>
                        <p className="text-[9px] text-muted">ROAS</p>
                      </div>
                      <div>
                        <p className="text-xs font-bold font-mono">{(campaign.ctr * 100).toFixed(2)}%</p>
                        <p className="text-[9px] text-muted">CTR</p>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1 shrink-0" onClick={e => e.stopPropagation()}>
                      {campaign.status === "active" ? (
                        <button onClick={() => updateCampaignStatus(campaign.id, "paused")}
                          className="p-2 rounded-lg hover:bg-surface border border-transparent hover:border-border transition-all" title="Pause">
                          <Pause size={13} className="text-muted" />
                        </button>
                      ) : campaign.status === "paused" || campaign.status === "draft" ? (
                        <button onClick={() => updateCampaignStatus(campaign.id, "active")}
                          className="p-2 rounded-lg hover:bg-surface border border-transparent hover:border-border transition-all" title="Activate">
                          <Play size={13} className="text-success" />
                        </button>
                      ) : null}
                      <button
                        onClick={() => generateAISuggestions(campaign.id)}
                        disabled={optimizingId === campaign.id}
                        className="p-2 rounded-lg hover:bg-gold/5 border border-transparent hover:border-gold/20 transition-all disabled:opacity-50"
                        title="AI Optimize"
                      >
                        {optimizingId === campaign.id
                          ? <Loader size={13} className="text-gold animate-spin" />
                          : <Sparkles size={13} className="text-gold" />
                        }
                      </button>
                      <ChevronDown size={14} className={`text-muted transition-transform duration-200 ${isExpanded ? "rotate-180" : ""}`} />
                    </div>
                  </div>

                  {/* Expanded Detail */}
                  {isExpanded && (
                    <div className="mt-4 pt-4 border-t border-border space-y-4 animate-in slide-in-from-top-2 duration-200">
                      {/* Metrics Grid */}
                      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
                        {[
                          { label: "Spend", value: formatCurrency(campaign.spend) },
                          { label: "Impressions", value: campaign.impressions.toLocaleString() },
                          { label: "Clicks", value: campaign.clicks.toLocaleString() },
                          { label: "CTR", value: `${(campaign.ctr * 100).toFixed(2)}%` },
                          { label: "CPC", value: formatCurrency(campaign.cpc) },
                          { label: "Conversions", value: campaign.conversions.toString() },
                          { label: "ROAS", value: `${campaign.roas.toFixed(1)}x`, highlight: campaign.roas >= 2 },
                        ].map(m => (
                          <div key={m.label} className="bg-surface-light rounded-lg p-3 text-center">
                            <p className={`text-sm font-bold font-mono ${(m as {highlight?: boolean}).highlight ? "text-success" : ""}`}>{m.value}</p>
                            <p className="text-[9px] text-muted mt-0.5">{m.label}</p>
                          </div>
                        ))}
                      </div>

                      {/* Budget Info */}
                      <div className="flex items-center gap-6 text-xs text-muted">
                        {campaign.budget_daily && <span>Daily Budget: <strong className="text-foreground">{formatCurrency(campaign.budget_daily)}</strong></span>}
                        {campaign.budget_total && <span>Total Budget: <strong className="text-foreground">{formatCurrency(campaign.budget_total)}</strong></span>}
                        {campaign.start_date && <span>Start: <strong className="text-foreground">{new Date(campaign.start_date).toLocaleDateString()}</strong></span>}
                        {campaign.end_date && <span>End: <strong className="text-foreground">{new Date(campaign.end_date).toLocaleDateString()}</strong></span>}
                      </div>

                      {/* Creatives for this campaign */}
                      {campaignCreatives.length > 0 && (
                        <div>
                          <p className="text-[10px] text-muted font-semibold uppercase tracking-wider mb-2">Linked Creatives</p>
                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                            {campaignCreatives.map(cr => (
                              <div key={cr.id} className="flex items-center gap-3 p-3 rounded-lg bg-surface-light border border-border">
                                {cr.image_url ? (
                                  /* eslint-disable-next-line @next/next/no-img-element */
                                  <img src={cr.image_url} alt="" className="w-12 h-12 rounded-lg object-cover shrink-0" />
                                ) : (
                                  <div className="w-12 h-12 rounded-lg bg-surface flex items-center justify-center shrink-0">
                                    <ImageIcon size={16} className="text-muted" />
                                  </div>
                                )}
                                <div className="min-w-0 flex-1">
                                  <p className="text-xs font-medium truncate">{cr.title}</p>
                                  {cr.headline && <p className="text-[10px] text-muted truncate">{cr.headline}</p>}
                                  <StatusBadge status={cr.status} />
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* AI Suggestions */}
                      {campaign.ai_suggestions && (
                        <div className="bg-gold/[0.04] border border-gold/10 rounded-xl p-4">
                          <div className="flex items-center gap-2 mb-2">
                            <Sparkles size={14} className="text-gold" />
                            <p className="text-xs font-semibold">AI Optimization Suggestions</p>
                          </div>
                          <p className="text-xs text-muted whitespace-pre-wrap leading-relaxed">{campaign.ai_suggestions}</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}

      {/* ── Creatives Tab ── */}
      {tab === "creatives" && (
        <div>
          {creatives.length === 0 ? (
            <div className="card-static text-center py-16">
              <ImageIcon size={32} className="mx-auto mb-3 text-muted/30" />
              <p className="text-sm font-medium text-muted">No creatives yet</p>
              <p className="text-xs text-muted mt-1">Ad creatives will appear here once linked to campaigns</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {creatives.map(cr => {
                const platform = getPlatformInfo(cr.platform);
                return (
                  <div key={cr.id} className="card group">
                    {/* Preview */}
                    <div className="aspect-video rounded-lg bg-surface-light border border-border mb-3 overflow-hidden relative">
                      {cr.image_url ? (
                        /* eslint-disable-next-line @next/next/no-img-element */
                        <img src={cr.image_url} alt="" className="w-full h-full object-cover" />
                      ) : cr.video_url ? (
                        <video src={cr.video_url} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <ImageIcon size={24} className="text-muted/30" />
                        </div>
                      )}
                      <div className="absolute top-2 right-2">
                        <div className="w-6 h-6 rounded-md flex items-center justify-center overflow-hidden">
                          {getBrandIcon(platform.id, 24)}
                        </div>
                      </div>
                    </div>

                    {/* Info */}
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-semibold truncate">{cr.title}</p>
                        <StatusBadge status={cr.status} />
                      </div>
                      {cr.headline && (
                        <p className="text-xs text-muted line-clamp-2">{cr.headline}</p>
                      )}
                      {cr.body_text && (
                        <p className="text-[10px] text-muted line-clamp-2">{cr.body_text}</p>
                      )}
                      {cr.cta_text && (
                        <div className="inline-block bg-gold/10 text-gold text-[9px] font-semibold px-2 py-0.5 rounded-full">
                          {cr.cta_text}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── Copy Lab Tab ── */}
      {tab === "copy-lab" && (
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          {/* Config Panel */}
          <div className="lg:col-span-2 card-static space-y-4">
            <div className="flex items-center gap-2 mb-1">
              <Wand2 size={16} className="text-gold" />
              <h2 className="text-sm font-semibold">AI Copy Generator</h2>
            </div>
            <p className="text-[10px] text-muted -mt-2">Generate high-converting ad copy variations with AI. Pick your platform, audience, and offer.</p>

            <div>
              <label className="block text-[10px] text-muted mb-1 font-semibold uppercase tracking-wider">Client</label>
              <select value={copyClient} onChange={e => setCopyClient(e.target.value)} className="input w-full text-xs">
                <option value="">General / No client</option>
                {clients.map(c => <option key={c.id} value={c.id}>{c.business_name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[10px] text-muted mb-1 font-semibold uppercase tracking-wider">Platform</label>
              <div className="flex gap-2">
                {PLATFORMS.map(p => (
                  <button key={p.id} onClick={() => setCopyPlatform(p.id)}
                    className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-medium border transition-all ${
                      copyPlatform === p.id
                        ? "border-gold/30 bg-gold/5 text-foreground"
                        : "border-border bg-surface-light text-muted hover:text-foreground"
                    }`}>
                    <span className="w-5 h-5 rounded-md flex items-center justify-center text-white text-[8px] font-bold" style={{ backgroundColor: p.color }}>
                      {p.icon}
                    </span>
                    {p.label.split(" ")[0]}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-[10px] text-muted mb-1 font-semibold uppercase tracking-wider">Objective</label>
              <select value={copyObjective} onChange={e => setCopyObjective(e.target.value)} className="input w-full text-xs">
                <option>Lead generation</option>
                <option>Brand awareness</option>
                <option>Website traffic</option>
                <option>Conversions / Sales</option>
                <option>App installs</option>
                <option>Video views</option>
              </select>
            </div>
            <div>
              <label className="block text-[10px] text-muted mb-1 font-semibold uppercase tracking-wider">Target Audience</label>
              <input value={copyAudience} onChange={e => setCopyAudience(e.target.value)}
                className="input w-full text-xs" placeholder="e.g. Homeowners 25-55, local area" />
            </div>
            <div>
              <label className="block text-[10px] text-muted mb-1 font-semibold uppercase tracking-wider">Offer / Hook</label>
              <input value={copyOffer} onChange={e => setCopyOffer(e.target.value)}
                className="input w-full text-xs" placeholder="e.g. Free consultation, 20% off first month" />
            </div>
            <div>
              <label className="block text-[10px] text-muted mb-1 font-semibold uppercase tracking-wider">Tone</label>
              <input value={copyTone} onChange={e => setCopyTone(e.target.value)}
                className="input w-full text-xs" placeholder="professional, urgent, benefit-focused" />
            </div>

            <button onClick={generateAdCopy} disabled={generatingCopy}
              className="btn-primary w-full text-xs flex items-center justify-center gap-2 disabled:opacity-50">
              {generatingCopy ? <><Loader size={13} className="animate-spin" /> Generating...</> : <><Sparkles size={13} /> Generate Ad Copy</>}
            </button>
          </div>

          {/* Results Panel */}
          <div className="lg:col-span-3 space-y-4">
            {!generatedCopy ? (
              <div className="card-static text-center py-20">
                <Wand2 size={32} className="mx-auto mb-3 text-muted/20" />
                <p className="text-sm text-muted">Configure your ad and hit generate</p>
                <p className="text-[10px] text-muted mt-1">AI will create 5 copy variations with headlines, body text, CTAs, and image suggestions</p>
              </div>
            ) : (
              <>
                {/* Variations */}
                {(generatedCopy as Record<string, unknown>).variations && (
                  <div className="space-y-3">
                    <h3 className="text-xs font-semibold flex items-center gap-2">
                      <Type size={13} /> Copy Variations
                    </h3>
                    {((generatedCopy as Record<string, unknown>).variations as Array<Record<string, string>>).map((v, i) => {
                      const perfLevel = (v.estimated_performance || "").toLowerCase();
                      const isHigh = perfLevel.startsWith("high");
                      const isMedium = perfLevel.startsWith("medium");
                      return (
                      <div key={i} className="card group">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <span className="w-5 h-5 rounded-full bg-gold/10 text-gold text-[9px] font-bold flex items-center justify-center">{i + 1}</span>
                            <span className="text-[9px] text-muted uppercase tracking-wider">{v.hook_type}</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            {isHigh && (
                              <span className="text-[8px] bg-success/10 text-success font-bold px-1.5 py-0.5 rounded-full">HIGH</span>
                            )}
                            {isMedium && (
                              <span className="text-[8px] bg-warning/10 text-warning font-bold px-1.5 py-0.5 rounded-full">MED</span>
                            )}
                            <button onClick={() => {
                              navigator.clipboard.writeText(`${v.headline}\n\n${v.primary_text}\n\n${v.cta}`);
                              toast.success("Copied!");
                            }} className="p-1 rounded hover:bg-surface-light opacity-0 group-hover:opacity-100 transition-all">
                              <Copy size={11} className="text-muted" />
                            </button>
                          </div>
                        </div>
                        <p className="text-sm font-bold mb-1">{v.headline}</p>
                        <p className="text-xs text-muted leading-relaxed">{v.primary_text}</p>
                        <div className="flex items-center justify-between mt-2 pt-2 border-t border-border">
                          <span className="text-[9px] text-muted">{v.description}</span>
                          <span className="text-[10px] bg-gold/10 text-gold font-semibold px-2 py-0.5 rounded-full">{v.cta}</span>
                        </div>
                        {v.image_concept && (
                          <div className="mt-2 pt-2 border-t border-border">
                            <div className="flex items-center gap-1.5">
                              <ImageIcon size={10} className="text-muted shrink-0" />
                              <span className="text-[9px] text-muted">{v.image_concept}</span>
                            </div>
                          </div>
                        )}
                      </div>
                      );
                    })}
                  </div>
                )}

                {/* Image Suggestions */}
                {(generatedCopy as Record<string, unknown>).image_suggestions && (
                  <div className="card-static">
                    <h3 className="text-xs font-semibold flex items-center gap-2 mb-3">
                      <ImageIcon size={13} /> Image Concepts
                    </h3>
                    <div className="space-y-2">
                      {((generatedCopy as Record<string, unknown>).image_suggestions as Array<Record<string, string>>).map((img, i) => (
                        <div key={i} className="p-3 rounded-lg bg-surface-light border border-border">
                          <p className="text-xs">{typeof img === "string" ? img : img.concept || img.description || JSON.stringify(img)}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* A/B Test Plan */}
                {(generatedCopy as Record<string, unknown>).a_b_test_plan && (
                  <div className="card-static bg-gold/[0.03] border-gold/10">
                    <h3 className="text-xs font-semibold flex items-center gap-2 mb-2">
                      <Zap size={13} className="text-gold" /> A/B Test Recommendation
                    </h3>
                    <p className="text-xs text-muted leading-relaxed">
                      {typeof (generatedCopy as Record<string, unknown>).a_b_test_plan === "string"
                        ? (generatedCopy as Record<string, unknown>).a_b_test_plan as string
                        : JSON.stringify((generatedCopy as Record<string, unknown>).a_b_test_plan)}
                    </p>
                  </div>
                )}

                {/* Platform Tips */}
                {(generatedCopy as Record<string, unknown>).platform_tips && (
                  <div className="card-static">
                    <h3 className="text-xs font-semibold flex items-center gap-2 mb-2">
                      <Globe size={13} /> Platform Tips
                    </h3>
                    <p className="text-xs text-muted leading-relaxed">
                      {typeof (generatedCopy as Record<string, unknown>).platform_tips === "string"
                        ? (generatedCopy as Record<string, unknown>).platform_tips as string
                        : JSON.stringify((generatedCopy as Record<string, unknown>).platform_tips)}
                    </p>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {/* ── AI Copilot Tab ── */}
      {tab === "copilot" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left: Controls + Sync */}
          <div className="space-y-4">
            {/* AI Controls */}
            <div className="card-static space-y-3">
              <div className="flex items-center gap-2">
                <Bot size={16} className="text-gold" />
                <h2 className="text-sm font-semibold">AI Ad Copilot</h2>
              </div>
              <p className="text-[10px] text-muted">AI analyzes your campaigns and proposes optimizations. Review and approve actions before they execute.</p>

              <button onClick={fetchInsights} disabled={loadingInsights || campaigns.length === 0}
                className="btn-primary w-full text-xs flex items-center justify-center gap-2 disabled:opacity-50">
                {loadingInsights ? <><Loader size={12} className="animate-spin" /> Analyzing...</> : <><BarChart3 size={12} /> Run Portfolio Analysis</>}
              </button>

              {/* Per-campaign optimize */}
              <div>
                <label className="block text-[10px] text-muted mb-1 font-semibold uppercase tracking-wider">Optimize Campaign</label>
                <div className="space-y-1.5 max-h-48 overflow-y-auto">
                  {campaigns.map(c => (
                    <button key={c.id} onClick={() => generateAISuggestions(c.id)}
                      disabled={optimizingId === c.id}
                      className="w-full flex items-center gap-2 p-2 rounded-lg border border-border hover:border-gold/30 hover:bg-gold/[0.03] transition-all text-left">
                      <div className="w-6 h-6 rounded-md flex items-center justify-center text-white text-[8px] font-bold shrink-0"
                        style={{ backgroundColor: getPlatformInfo(c.platform).color }}>
                        {getPlatformInfo(c.platform).icon}
                      </div>
                      <span className="text-[10px] truncate flex-1">{c.name}</span>
                      {optimizingId === c.id
                        ? <Loader size={10} className="text-gold animate-spin shrink-0" />
                        : <Sparkles size={10} className="text-gold shrink-0" />}
                    </button>
                  ))}
                  {campaigns.length === 0 && <p className="text-[10px] text-muted text-center py-2">No campaigns to optimize</p>}
                </div>
              </div>
            </div>

            {/* Platform Connections & Sync */}
            <div className="card-static space-y-3">
              <div className="flex items-center gap-2">
                <Plug size={14} className="text-info" />
                <h2 className="text-sm font-semibold">Ad Accounts</h2>
              </div>
              <p className="text-[10px] text-muted">Connect client ad accounts, then sync campaign data.</p>
              {clients.length > 0 ? (
                <div className="space-y-2">
                  {clients.map(client => {
                    const connected = adConnections[client.id] || [];
                    return (
                      <div key={client.id} className="p-2.5 rounded-lg border border-border">
                        <p className="text-[10px] font-medium mb-2">{client.business_name}</p>
                        <div className="space-y-1.5">
                          {PLATFORMS.map(p => {
                            const isConnected = connected.includes(p.id);
                            return (
                              <div key={p.id} className="flex items-center gap-2">
                                <span className="w-4 h-4 rounded-sm flex items-center justify-center text-white text-[7px] font-bold shrink-0" style={{ backgroundColor: p.color }}>{p.icon}</span>
                                <span className="text-[10px] flex-1">{p.label}</span>
                                {isConnected ? (
                                  <div className="flex items-center gap-1">
                                    <span className="text-[8px] bg-success/10 text-success font-bold px-1.5 py-0.5 rounded-full flex items-center gap-0.5">
                                      <CheckCircle2 size={8} /> Connected
                                    </span>
                                    <button
                                      onClick={() => syncPlatform(client.id, p.id)}
                                      disabled={syncing !== null}
                                      className="text-[9px] px-2 py-1 rounded-md font-medium border border-border hover:border-gold/20 hover:bg-gold/5 transition-all disabled:opacity-50 flex items-center gap-1">
                                      {syncing === p.id ? <Loader size={8} className="animate-spin" /> : <RefreshCw size={8} />}
                                      Sync
                                    </button>
                                  </div>
                                ) : (
                                  <button
                                    onClick={() => connectAdPlatform(client.id, p.id)}
                                    className="text-[9px] px-2 py-1 rounded-md font-medium bg-gold/10 text-gold hover:bg-gold/20 transition-all flex items-center gap-1">
                                    <Plug size={8} /> Connect
                                  </button>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : <p className="text-[10px] text-muted text-center">No clients yet</p>}
            </div>

            {/* How It Works */}
            <div className="card-static bg-gold/[0.02] border-gold/10">
              <div className="flex items-center gap-2 mb-2">
                <Shield size={14} className="text-gold" />
                <h3 className="text-xs font-semibold">How Copilot Works</h3>
              </div>
              <ol className="space-y-1.5 text-[10px] text-muted">
                <li className="flex gap-2"><span className="text-gold font-bold">1.</span> AI analyzes campaign performance data</li>
                <li className="flex gap-2"><span className="text-gold font-bold">2.</span> Proposes optimizations with reasoning</li>
                <li className="flex gap-2"><span className="text-gold font-bold">3.</span> You review and approve/reject each action</li>
                <li className="flex gap-2"><span className="text-gold font-bold">4.</span> Approved actions execute on the ad platform</li>
              </ol>
            </div>
          </div>

          {/* Right: Action Queue + Insights */}
          <div className="lg:col-span-2 space-y-4">
            {/* Portfolio Insights */}
            {insights && (
              <div className="card-static border-gold/20 bg-gold/[0.02] fade-in">
                <div className="flex items-center gap-2 mb-3">
                  <BarChart3 size={14} className="text-gold" />
                  <h2 className="text-sm font-semibold">Portfolio Insights</h2>
                </div>
                <pre className="whitespace-pre-wrap text-xs text-foreground leading-relaxed font-sans bg-surface-light rounded-xl p-4 border border-border/30 max-h-[300px] overflow-y-auto">
                  {(insights as Record<string, unknown>).summary as string || JSON.stringify(insights, null, 2)}
                </pre>
                {String((insights as Record<string, unknown>).budget_recommendations || "") && (
                  <div className="mt-3 p-3 rounded-lg bg-gold/5 border border-gold/10">
                    <p className="text-[10px] font-semibold text-gold mb-1">Budget Recommendations</p>
                    <p className="text-[10px] text-muted">{String((insights as Record<string, unknown>).budget_recommendations)}</p>
                  </div>
                )}
              </div>
            )}

            {/* Pending Actions */}
            <div className="card-static">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Clock size={14} className="text-warning" />
                  <h2 className="text-sm font-semibold">Pending Actions</h2>
                  {pendingActions.length > 0 && (
                    <span className="text-[9px] bg-warning/10 text-warning font-bold px-2 py-0.5 rounded-full">{pendingActions.length}</span>
                  )}
                </div>
                <button onClick={fetchActions} className="btn-ghost text-[10px] flex items-center gap-1">
                  <RefreshCw size={10} /> Refresh
                </button>
              </div>

              {loadingActions ? (
                <div className="flex items-center justify-center py-8"><Loader size={16} className="animate-spin text-muted" /></div>
              ) : pendingActions.length === 0 ? (
                <div className="text-center py-8">
                  <CheckCircle2 size={24} className="text-success/30 mx-auto mb-2" />
                  <p className="text-xs text-muted">No pending actions</p>
                  <p className="text-[10px] text-muted/60 mt-1">Run AI optimization on a campaign to get recommendations</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {pendingActions.map(action => (
                    <div key={action.id} className={`border rounded-xl p-4 transition-all ${
                      action.priority === "critical" ? "border-danger/30 bg-danger/[0.02]" :
                      action.priority === "high" ? "border-warning/30 bg-warning/[0.02]" :
                      "border-border"
                    }`}>
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className={`text-[8px] font-bold uppercase px-1.5 py-0.5 rounded-full ${
                              action.priority === "critical" ? "bg-danger/10 text-danger" :
                              action.priority === "high" ? "bg-warning/10 text-warning" :
                              action.priority === "medium" ? "bg-info/10 text-info" :
                              "bg-surface-light text-muted"
                            }`}>{action.priority}</span>
                            <span className="text-[9px] text-muted">{action.action_type.replace(/_/g, " ")}</span>
                            {action.platform && (
                              <span className="w-4 h-4 rounded-sm flex items-center justify-center text-white text-[7px] font-bold"
                                style={{ backgroundColor: getPlatformInfo(action.platform).color }}>
                                {getPlatformInfo(action.platform).icon}
                              </span>
                            )}
                          </div>
                          <p className="text-xs font-semibold">{action.title}</p>
                          {action.description && <p className="text-[10px] text-muted mt-0.5">{action.description}</p>}
                          {action.ai_reasoning && (
                            <div className="mt-2 p-2 rounded-lg bg-gold/[0.04] border border-gold/10">
                              <p className="text-[9px] text-gold font-medium mb-0.5">AI Reasoning</p>
                              <p className="text-[10px] text-muted leading-relaxed">{action.ai_reasoning}</p>
                            </div>
                          )}
                          {action.estimated_impact && (
                            <p className="text-[10px] text-success mt-1.5 flex items-center gap-1">
                              <ArrowUpRight size={10} /> Expected: {action.estimated_impact}
                            </p>
                          )}
                        </div>
                        <div className="flex flex-col gap-1.5 shrink-0">
                          <button onClick={() => handleAction(action.id, "approve")}
                            disabled={processingAction === action.id}
                            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[10px] font-medium bg-success/10 text-success hover:bg-success/20 transition-all disabled:opacity-50">
                            <CheckCircle2 size={11} /> Approve
                          </button>
                          <button onClick={() => handleAction(action.id, "reject")}
                            disabled={processingAction === action.id}
                            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[10px] font-medium bg-danger/10 text-danger hover:bg-danger/20 transition-all disabled:opacity-50">
                            <XCircle size={11} /> Reject
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Approved (ready to execute) */}
            {approvedActions.length > 0 && (
              <div className="card-static border-success/20">
                <div className="flex items-center gap-2 mb-3">
                  <CheckCircle2 size={14} className="text-success" />
                  <h2 className="text-sm font-semibold">Ready to Execute</h2>
                  <span className="text-[9px] bg-success/10 text-success font-bold px-2 py-0.5 rounded-full">{approvedActions.length}</span>
                </div>
                <div className="space-y-2">
                  {approvedActions.map(action => (
                    <div key={action.id} className="flex items-center justify-between p-3 rounded-lg border border-success/20 bg-success/[0.02]">
                      <div className="flex items-center gap-2">
                        <span className="w-5 h-5 rounded-md flex items-center justify-center text-white text-[8px] font-bold"
                          style={{ backgroundColor: getPlatformInfo(action.platform).color }}>
                          {getPlatformInfo(action.platform).icon}
                        </span>
                        <div>
                          <p className="text-xs font-medium">{action.title}</p>
                          <p className="text-[9px] text-muted">{action.action_type.replace(/_/g, " ")}</p>
                        </div>
                      </div>
                      <button onClick={() => handleAction(action.id, "execute")}
                        disabled={processingAction === action.id}
                        className="btn-primary text-[10px] px-3 py-1.5 flex items-center gap-1 disabled:opacity-50">
                        {processingAction === action.id ? <Loader size={10} className="animate-spin" /> : <Zap size={10} />}
                        Execute
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Recent Action History */}
            {recentActions.length > 0 && (
              <div className="card-static">
                <div className="flex items-center gap-2 mb-3">
                  <Clock size={14} className="text-muted" />
                  <h2 className="text-sm font-semibold">Recent History</h2>
                </div>
                <div className="space-y-1.5">
                  {recentActions.map(action => (
                    <div key={action.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-surface-light transition-colors">
                      <div className={`w-5 h-5 rounded-full flex items-center justify-center ${
                        action.status === "executed" ? "bg-success/10" : action.status === "failed" ? "bg-danger/10" : "bg-surface-light"
                      }`}>
                        {action.status === "executed" ? <CheckCircle2 size={10} className="text-success" /> :
                         action.status === "failed" ? <XCircle size={10} className="text-danger" /> :
                         <XCircle size={10} className="text-muted" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[10px] font-medium truncate">{action.title}</p>
                        <p className="text-[9px] text-muted">{action.action_type.replace(/_/g, " ")} · {new Date(action.created_at).toLocaleDateString()}</p>
                      </div>
                      <span className={`text-[8px] font-bold uppercase px-1.5 py-0.5 rounded-full ${
                        action.status === "executed" ? "bg-success/10 text-success" :
                        action.status === "failed" ? "bg-danger/10 text-danger" :
                        "bg-surface-light text-muted"
                      }`}>{action.status}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Add Campaign Modal */}
      <Modal isOpen={showAddCampaign} onClose={() => setShowAddCampaign(false)} title="New Campaign" size="md">
        <form onSubmit={e => { e.preventDefault(); addCampaign(new FormData(e.currentTarget)); }} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="block text-[10px] text-muted mb-1 font-semibold uppercase tracking-wider">Campaign Name *</label>
              <input name="name" className="input w-full" required placeholder="e.g. Spring Sale - Meta Lead Gen" />
            </div>
            <div>
              <label className="block text-[10px] text-muted mb-1 font-semibold uppercase tracking-wider">Client *</label>
              <select name="client_id" className="input w-full" required>
                <option value="">Select client...</option>
                {clients.map(c => <option key={c.id} value={c.id}>{c.business_name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[10px] text-muted mb-1 font-semibold uppercase tracking-wider">Platform *</label>
              <select name="platform" className="input w-full" required>
                {PLATFORMS.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[10px] text-muted mb-1 font-semibold uppercase tracking-wider">Daily Budget ($)</label>
              <input name="budget_daily" type="number" step="0.01" className="input w-full" placeholder="50.00" />
            </div>
            <div>
              <label className="block text-[10px] text-muted mb-1 font-semibold uppercase tracking-wider">Total Budget ($)</label>
              <input name="budget_total" type="number" step="0.01" className="input w-full" placeholder="1500.00" />
            </div>
            <div>
              <label className="block text-[10px] text-muted mb-1 font-semibold uppercase tracking-wider">Start Date</label>
              <input name="start_date" type="date" className="input w-full" />
            </div>
            <div>
              <label className="block text-[10px] text-muted mb-1 font-semibold uppercase tracking-wider">End Date</label>
              <input name="end_date" type="date" className="input w-full" />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={() => setShowAddCampaign(false)} className="btn-secondary text-xs">Cancel</button>
            <button type="submit" className="btn-primary text-xs flex items-center gap-1.5">
              <Plus size={12} /> Create Campaign
            </button>
          </div>
        </form>
      </Modal>

      <PageAI pageName="Ads Center" context="Ad campaign management across Meta, Google, and TikTok with AI-powered optimization and copy generation." suggestions={[
        "Optimize my ad budget allocation",
        "Write 3 ad headlines for a roofing company",
        "What's my best performing campaign?",
        "Suggest targeting improvements for my ads"
      ]} />
    </div>
  );
}
