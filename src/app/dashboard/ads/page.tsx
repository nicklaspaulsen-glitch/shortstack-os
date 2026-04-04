"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Campaign, AdCreative, Client } from "@/lib/types";
import StatCard from "@/components/ui/stat-card";
import StatusBadge from "@/components/ui/status-badge";
import DataTable from "@/components/ui/data-table";
import Modal from "@/components/ui/modal";
import { PageLoading } from "@/components/ui/loading";
import { formatCurrency } from "@/lib/utils";
import {
  DollarSign, MousePointer, TrendingUp, Plus, BarChart3,
  Sparkles, Target
} from "lucide-react";
import toast from "react-hot-toast";

type Tab = "campaigns" | "creatives" | "insights";

export default function AdsPage() {
  const [tab, setTab] = useState<Tab>("campaigns");
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [creatives, setCreatives] = useState<AdCreative[]>([]);
  const [clients, setClients] = useState<Pick<Client, "id" | "business_name">[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => { const t = setTimeout(() => setLoading(false), 3000); return () => clearTimeout(t); }, []);
  const [showAddCampaign, setShowAddCampaign] = useState(false);
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

  const totalSpend = campaigns.reduce((s, c) => s + c.spend, 0);
  const totalConversions = campaigns.reduce((s, c) => s + c.conversions, 0);
  const avgROAS = campaigns.filter((c) => c.roas > 0).reduce((s, c) => s + c.roas, 0) / (campaigns.filter((c) => c.roas > 0).length || 1);
  const avgCTR = campaigns.filter((c) => c.ctr > 0).reduce((s, c) => s + c.ctr, 0) / (campaigns.filter((c) => c.ctr > 0).length || 1);

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

  async function generateAISuggestions(campaignId: string) {
    toast.loading("Generating AI suggestions...");
    try {
      const res = await fetch("/api/ads/optimize", {
        method: "POST",
        body: JSON.stringify({ campaign_id: campaignId }),
        headers: { "Content-Type": "application/json" },
      });
      if (res.ok) {
        toast.dismiss();
        toast.success("Suggestions generated");
        fetchData();
      }
    } catch {
      toast.dismiss();
      toast.error("Failed to generate suggestions");
    }
  }

  if (loading) return <PageLoading />;

  return (
    <div className="fade-in space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-header mb-0">Ads Manager</h1>
          <p className="text-muted text-sm">Campaign management with AI optimization</p>
        </div>
        <button onClick={() => setShowAddCampaign(true)} className="btn-primary flex items-center gap-2">
          <Plus size={16} /> New Campaign
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Total Spend" value={formatCurrency(totalSpend)} icon={<DollarSign size={18} />} />
        <StatCard label="Conversions" value={totalConversions} icon={<Target size={18} />} />
        <StatCard label="Avg ROAS" value={`${avgROAS.toFixed(1)}x`} icon={<TrendingUp size={18} />} changeType={avgROAS > 2 ? "positive" : "negative"} />
        <StatCard label="Avg CTR" value={`${(avgCTR * 100).toFixed(2)}%`} icon={<MousePointer size={18} />} />
      </div>

      <div className="flex gap-1 bg-surface rounded-lg p-1 w-fit">
        {(["campaigns", "creatives", "insights"] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm rounded-md capitalize transition-all ${tab === t ? "bg-gold text-black font-medium" : "text-muted hover:text-white"}`}
          >{t}</button>
        ))}
      </div>

      {tab === "campaigns" && (
        <DataTable
          columns={[
            { key: "name", label: "Campaign", render: (c: Campaign) => (
              <div>
                <p className="font-medium">{c.name}</p>
                <p className="text-xs text-muted">{clients.find((cl) => cl.id === c.client_id)?.business_name || "-"}</p>
              </div>
            )},
            { key: "platform", label: "Platform", render: (c: Campaign) => (
              <span className="capitalize">{c.platform.replace("_", " ")}</span>
            )},
            { key: "status", label: "Status", render: (c: Campaign) => <StatusBadge status={c.status} /> },
            { key: "spend", label: "Spend", render: (c: Campaign) => formatCurrency(c.spend) },
            { key: "impressions", label: "Impressions", render: (c: Campaign) => c.impressions.toLocaleString() },
            { key: "clicks", label: "Clicks", render: (c: Campaign) => c.clicks.toLocaleString() },
            { key: "ctr", label: "CTR", render: (c: Campaign) => `${(c.ctr * 100).toFixed(2)}%` },
            { key: "conversions", label: "Conv." },
            { key: "roas", label: "ROAS", render: (c: Campaign) => (
              <span className={c.roas >= 2 ? "text-success font-bold" : c.roas >= 1 ? "text-warning" : "text-danger"}>
                {c.roas.toFixed(1)}x
              </span>
            )},
            { key: "actions", label: "", render: (c: Campaign) => (
              <button onClick={() => generateAISuggestions(c.id)} className="text-gold hover:text-gold-light" title="AI Optimize">
                <Sparkles size={16} />
              </button>
            )},
          ]}
          data={campaigns}
          emptyMessage="No campaigns yet."
        />
      )}

      {tab === "creatives" && (
        <DataTable
          columns={[
            { key: "title", label: "Creative" },
            { key: "headline", label: "Headline" },
            { key: "platform", label: "Platform", render: (c: AdCreative) => <span className="capitalize">{c.platform.replace("_", " ")}</span> },
            { key: "status", label: "Status", render: (c: AdCreative) => <StatusBadge status={c.status} /> },
            { key: "cta_text", label: "CTA" },
          ]}
          data={creatives}
          emptyMessage="No ad creatives yet."
        />
      )}

      {tab === "insights" && (
        <div className="card">
          <h2 className="section-header flex items-center gap-2">
            <BarChart3 size={18} /> AI Weekly Optimization Suggestions
          </h2>
          <div className="space-y-4">
            {campaigns.filter((c) => c.ai_suggestions).map((c) => (
              <div key={c.id} className="bg-surface-light rounded-lg p-4">
                <h3 className="font-medium mb-1">{c.name}</h3>
                <p className="text-sm text-muted whitespace-pre-wrap">{c.ai_suggestions}</p>
              </div>
            ))}
            {campaigns.filter((c) => c.ai_suggestions).length === 0 && (
              <p className="text-muted text-sm">No AI suggestions generated yet. Click the sparkle icon on a campaign to generate.</p>
            )}
          </div>
        </div>
      )}

      {/* Add Campaign Modal */}
      <Modal isOpen={showAddCampaign} onClose={() => setShowAddCampaign(false)} title="New Campaign">
        <form onSubmit={(e) => { e.preventDefault(); addCampaign(new FormData(e.currentTarget)); }} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-muted mb-1">Campaign Name *</label>
              <input name="name" className="input w-full" required />
            </div>
            <div>
              <label className="block text-sm text-muted mb-1">Client *</label>
              <select name="client_id" className="input w-full" required>
                <option value="">Select client...</option>
                {clients.map((c) => <option key={c.id} value={c.id}>{c.business_name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm text-muted mb-1">Platform *</label>
              <select name="platform" className="input w-full" required>
                <option value="meta_ads">Meta Ads</option>
                <option value="tiktok_ads">TikTok Ads</option>
                <option value="google_ads">Google Ads</option>
              </select>
            </div>
            <div>
              <label className="block text-sm text-muted mb-1">Daily Budget ($)</label>
              <input name="budget_daily" type="number" step="0.01" className="input w-full" />
            </div>
            <div>
              <label className="block text-sm text-muted mb-1">Start Date</label>
              <input name="start_date" type="date" className="input w-full" />
            </div>
            <div>
              <label className="block text-sm text-muted mb-1">End Date</label>
              <input name="end_date" type="date" className="input w-full" />
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-4">
            <button type="button" onClick={() => setShowAddCampaign(false)} className="btn-secondary">Cancel</button>
            <button type="submit" className="btn-primary">Create Campaign</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
