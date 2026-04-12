"use client";

import { useEffect, useState, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import { Campaign, AdCreative, Client } from "@/lib/types";
import StatCard from "@/components/ui/stat-card";
import StatusBadge from "@/components/ui/status-badge";
import Modal from "@/components/ui/modal";
import { PageLoading } from "@/components/ui/loading";
import { formatCurrency } from "@/lib/utils";
import {
  DollarSign, MousePointer, TrendingUp, Plus,
  Sparkles, Target, Filter, ChevronDown,
  Copy, Wand2, Loader, Pause, Play,
  Eye, Megaphone, RefreshCw, Zap,
  Image as ImageIcon, Type, Globe
} from "lucide-react";
import toast from "react-hot-toast";
import PageAI from "@/components/page-ai";

type Tab = "campaigns" | "creatives" | "copy-lab";

const PLATFORM_META = { id: "meta_ads", label: "Meta Ads", color: "#1877F2", icon: "M" };
const PLATFORM_GOOGLE = { id: "google_ads", label: "Google Ads", color: "#34A853", icon: "G" };
const PLATFORM_TIKTOK = { id: "tiktok_ads", label: "TikTok Ads", color: "#FF0050", icon: "T" };
const PLATFORMS = [PLATFORM_META, PLATFORM_GOOGLE, PLATFORM_TIKTOK];

function getPlatformInfo(id: string) {
  return PLATFORMS.find(p => p.id === id) || PLATFORM_META;
}

export default function AdsPage() {
  const [tab, setTab] = useState<Tab>("campaigns");
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

  const supabase = createClient();

  useEffect(() => { fetchData(); }, []);

  async function fetchData() {
    setLoading(true);
    const [{ data: c }, { data: cr }, { data: cl }] = await Promise.all([
      supabase.from("campaigns").select("*").order("created_at", { ascending: false }),
      supabase.from("ad_creatives").select("*").order("created_at", { ascending: false }),
      supabase.from("clients").select("id, business_name").eq("is_active", true),
    ]);
    setCampaigns(c || []);
    setCreatives(cr || []);
    setClients(cl || []);
    setLoading(false);
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
  const totalImpressions = filtered.reduce((s, c) => s + c.impressions, 0);
  const totalClicks = filtered.reduce((s, c) => s + c.clicks, 0);

  // Platform breakdown
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

  function getClientName(clientId: string) {
    return clients.find(c => c.id === clientId)?.business_name || "—";
  }

  if (loading) return <PageLoading />;

  return (
    <div className="fade-in space-y-6 max-w-[1400px] mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gold/10 rounded-xl flex items-center justify-center">
            <Megaphone size={20} className="text-gold" />
          </div>
          <div>
            <h1 className="page-header mb-0">Ads Center</h1>
            <p className="text-xs text-muted">Manage campaigns across Meta, Google & TikTok with AI optimization</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={fetchData} className="btn-ghost text-xs flex items-center gap-1.5">
            <RefreshCw size={12} /> Sync
          </button>
          <button onClick={() => setShowAddCampaign(true)} className="btn-primary text-xs flex items-center gap-1.5">
            <Plus size={12} /> New Campaign
          </button>
        </div>
      </div>

      {/* Top Stats */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <StatCard label="Total Spend" value={formatCurrency(totalSpend)} icon={<DollarSign size={16} />} />
        <StatCard label="Impressions" value={totalImpressions} icon={<Eye size={16} />} />
        <StatCard label="Clicks" value={totalClicks} icon={<MousePointer size={16} />} />
        <StatCard label="Conversions" value={totalConversions} icon={<Target size={16} />} />
        <StatCard label="Avg ROAS" value={`${avgROAS.toFixed(1)}x`} icon={<TrendingUp size={16} />} changeType={avgROAS >= 2 ? "positive" : avgROAS >= 1 ? "neutral" : "negative"} />
        <StatCard label="Avg CTR" value={`${(avgCTR * 100).toFixed(2)}%`} icon={<MousePointer size={16} />} changeType={avgCTR >= 0.02 ? "positive" : "neutral"} />
      </div>

      {/* Platform Breakdown */}
      {platformBreakdown.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {platformBreakdown.map(p => (
            <div key={p.id} className="card-static flex items-center gap-4">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm text-white shrink-0" style={{ backgroundColor: p.color }}>
                {p.icon}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold">{p.label}</p>
                <div className="flex items-center gap-4 text-[10px] text-muted mt-0.5">
                  <span>{p.count} campaign{p.count !== 1 ? "s" : ""}</span>
                  <span>{formatCurrency(p.spend)} spent</span>
                  <span className={p.roas >= 2 ? "text-success font-bold" : ""}>{p.roas.toFixed(1)}x ROAS</span>
                </div>
              </div>
              {/* Spend bar */}
              <div className="w-20 h-2 bg-surface-light rounded-full overflow-hidden">
                <div className="h-full rounded-full transition-all duration-500" style={{
                  backgroundColor: p.color,
                  width: `${totalSpend > 0 ? (p.spend / totalSpend) * 100 : 0}%`
                }} />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Tabs + Filters */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex gap-1 bg-surface rounded-xl p-1">
          {([
            { id: "campaigns", label: "Campaigns", icon: <Megaphone size={13} /> },
            { id: "creatives", label: "Creatives", icon: <ImageIcon size={13} /> },
            { id: "copy-lab", label: "Copy Lab", icon: <Wand2 size={13} /> },
          ] as const).map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`flex items-center gap-1.5 px-3.5 py-2 text-xs rounded-lg transition-all ${
                tab === t.id ? "bg-gold text-black font-medium shadow-sm" : "text-muted hover:text-foreground"
              }`}
            >{t.icon} {t.label}</button>
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

      {/* ── Campaigns Tab ── */}
      {tab === "campaigns" && (
        <div className="space-y-2">
          {filtered.length === 0 ? (
            <div className="card-static text-center py-16">
              <Megaphone size={32} className="mx-auto mb-3 text-muted/30" />
              <p className="text-sm font-medium text-muted">No campaigns found</p>
              <p className="text-xs text-muted mt-1">
                {campaigns.length > 0 ? "Try adjusting your filters" : "Create your first campaign to get started"}
              </p>
              {campaigns.length === 0 && (
                <button onClick={() => setShowAddCampaign(true)} className="btn-primary text-xs mt-4 inline-flex items-center gap-1.5">
                  <Plus size={12} /> Create Campaign
                </button>
              )}
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
                    <div className="w-9 h-9 rounded-lg flex items-center justify-center text-white text-xs font-bold shrink-0"
                      style={{ backgroundColor: platform.color }}>
                      {platform.icon}
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
                        <img src={cr.image_url} alt="" className="w-full h-full object-cover" />
                      ) : cr.video_url ? (
                        <video src={cr.video_url} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <ImageIcon size={24} className="text-muted/30" />
                        </div>
                      )}
                      <div className="absolute top-2 right-2">
                        <div className="w-6 h-6 rounded-md flex items-center justify-center text-white text-[9px] font-bold"
                          style={{ backgroundColor: platform.color }}>
                          {platform.icon}
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
                    {((generatedCopy as Record<string, unknown>).variations as Array<Record<string, string>>).map((v, i) => (
                      <div key={i} className="card group">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <span className="w-5 h-5 rounded-full bg-gold/10 text-gold text-[9px] font-bold flex items-center justify-center">{i + 1}</span>
                            <span className="text-[9px] text-muted uppercase tracking-wider">{v.hook_type}</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            {v.estimated_performance === "high" && (
                              <span className="text-[8px] bg-success/10 text-success font-bold px-1.5 py-0.5 rounded-full">HIGH</span>
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
                      </div>
                    ))}
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
