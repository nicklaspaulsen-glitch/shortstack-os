"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { createClient } from "@/lib/supabase/client";
import { formatCurrency } from "@/lib/utils";
import {
  DollarSign, Plus, Loader
} from "lucide-react";
import Modal from "@/components/ui/modal";
import toast from "react-hot-toast";

interface Deal {
  id: string;
  client_id: string | null;
  title: string;
  amount: number;
  status: "open" | "won" | "lost";
  stage: string;
  source: string | null;
  created_at: string;
}

const STAGES = [
  { key: "prospect", label: "Prospect", color: "#3b82f6" },
  { key: "qualified", label: "Qualified", color: "#8b5cf6" },
  { key: "proposal", label: "Proposal Sent", color: "#f59e0b" },
  { key: "negotiation", label: "Negotiation", color: "#f97316" },
  { key: "closed_won", label: "Closed Won", color: "#10b981" },
  { key: "closed_lost", label: "Closed Lost", color: "#ef4444" },
];

export default function DealsPage() {
  useAuth();
  const supabase = createClient();
  const [deals, setDeals] = useState<Deal[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [clients, setClients] = useState<Array<{ id: string; business_name: string }>>([]);
  const [form, setForm] = useState({
    title: "", amount: "", client_id: "", stage: "prospect", source: "",
  });

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { fetchData(); }, []);

  async function fetchData() {
    setLoading(true);
    const [{ data: d }, { data: cl }] = await Promise.all([
      supabase.from("deals").select("*").order("created_at", { ascending: false }),
      supabase.from("clients").select("id, business_name").eq("is_active", true),
    ]);
    setDeals(d || []);
    setClients(cl || []);
    setLoading(false);
  }

  async function createDeal() {
    if (!form.title || !form.amount) { toast.error("Title and amount required"); return; }
    setCreating(true);
    await supabase.from("deals").insert({
      title: form.title,
      amount: parseFloat(form.amount) || 0,
      client_id: form.client_id || null,
      status: "open",
      stage: form.stage,
      source: form.source || null,
    });
    toast.success("Deal created!");
    setShowCreate(false);
    setForm({ title: "", amount: "", client_id: "", stage: "prospect", source: "" });
    fetchData();
    setCreating(false);
  }

  async function updateStage(dealId: string, stage: string) {
    const status = stage === "closed_won" ? "won" : stage === "closed_lost" ? "lost" : "open";
    await supabase.from("deals").update({ stage, status }).eq("id", dealId);
    toast.success("Deal updated!");
    fetchData();
  }

  const totalValue = deals.filter(d => d.status === "open").reduce((s, d) => s + d.amount, 0);
  const wonValue = deals.filter(d => d.status === "won").reduce((s, d) => s + d.amount, 0);
  const lostValue = deals.filter(d => d.status === "lost").reduce((s, d) => s + d.amount, 0);
  const winRate = deals.length > 0 ? Math.round((deals.filter(d => d.status === "won").length / deals.filter(d => d.status !== "open").length) * 100) || 0 : 0;

  if (loading) return <div className="flex items-center justify-center py-20"><Loader size={20} className="animate-spin text-gold" /></div>;

  return (
    <div className="fade-in space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-header mb-0 flex items-center gap-2">
            <DollarSign size={18} className="text-gold" /> Deals Pipeline
          </h1>
          <p className="text-xs text-muted mt-0.5">Track deals from prospect to closed</p>
        </div>
        <button onClick={() => setShowCreate(true)} className="btn-primary text-xs flex items-center gap-1.5">
          <Plus size={12} /> New Deal
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-3">
        <div className="card text-center">
          <div className="flex items-center justify-center gap-1.5 mb-1">
            <div className="w-6 h-6 rounded-lg bg-gold/10 flex items-center justify-center">
              <DollarSign size={12} className="text-gold" />
            </div>
          </div>
          <p className="text-xl font-bold text-gold">{formatCurrency(totalValue)}</p>
          <p className="text-[10px] text-muted">Pipeline Value</p>
        </div>
        <div className="card text-center">
          <div className="flex items-center justify-center gap-1.5 mb-1">
            <div className="w-6 h-6 rounded-lg bg-success/10 flex items-center justify-center">
              <DollarSign size={12} className="text-success" />
            </div>
          </div>
          <p className="text-xl font-bold text-success">{formatCurrency(wonValue)}</p>
          <p className="text-[10px] text-muted">Won</p>
        </div>
        <div className="card text-center">
          <div className="flex items-center justify-center gap-1.5 mb-1">
            <div className="w-6 h-6 rounded-lg bg-danger/10 flex items-center justify-center">
              <DollarSign size={12} className="text-danger" />
            </div>
          </div>
          <p className="text-xl font-bold text-danger">{formatCurrency(lostValue)}</p>
          <p className="text-[10px] text-muted">Lost</p>
        </div>
        <div className="card text-center">
          <div className="flex items-center justify-center gap-1.5 mb-1">
            <div className="w-6 h-6 rounded-lg bg-info/10 flex items-center justify-center">
              <DollarSign size={12} className="text-info" />
            </div>
          </div>
          <p className="text-xl font-bold">{winRate}%</p>
          <p className="text-[10px] text-muted">Win Rate</p>
        </div>
      </div>

      {/* Pipeline Kanban */}
      <div className="flex gap-3 overflow-x-auto pb-4">
        {STAGES.map(stage => {
          const stageDeals = deals.filter(d => (d.stage || "prospect") === stage.key);
          const stageValue = stageDeals.reduce((s, d) => s + d.amount, 0);

          return (
            <div key={stage.key} className="flex-shrink-0 w-[220px]">
              <div className="flex items-center justify-between mb-2 px-1">
                <div className="flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full" style={{ background: stage.color }} />
                  <span className="text-[10px] font-bold uppercase tracking-wider">{stage.label}</span>
                </div>
                <span className="text-[9px] font-mono" style={{ color: stage.color }}>{stageDeals.length}</span>
              </div>
              <p className="text-[9px] text-muted mb-2 px-1">{formatCurrency(stageValue)}</p>

              <div className="space-y-2 max-h-[400px] overflow-y-auto">
                {stageDeals.length === 0 && (
                  <div className="text-center py-6 border border-dashed rounded-lg" style={{ borderColor: `${stage.color}20` }}>
                    <p className="text-[9px] text-muted">No deals</p>
                  </div>
                )}
                {stageDeals.map(deal => (
                  <div key={deal.id} className="p-3 rounded-lg space-y-1.5 bg-surface-light border border-border">
                    <p className="text-[11px] font-semibold truncate">{deal.title}</p>
                    <p className="text-sm font-bold" style={{ color: stage.color }}>{formatCurrency(deal.amount)}</p>
                    {deal.source && <p className="text-[8px] text-muted">Source: {deal.source}</p>}
                    <div className="flex gap-1 pt-1">
                      {STAGES.filter(s => s.key !== stage.key && s.key !== "closed_lost").slice(0, 3).map(s => (
                        <button key={s.key} onClick={() => updateStage(deal.id, s.key)}
                          className="text-[7px] px-1.5 py-0.5 rounded transition-all hover:opacity-80"
                          style={{ background: `${s.color}15`, color: s.color, border: `1px solid ${s.color}20` }}>
                          {s.label.split(" ")[0]}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* Create Deal Modal */}
      <Modal isOpen={showCreate} onClose={() => setShowCreate(false)} title="New Deal" size="md">
        <div className="space-y-3">
          <div>
            <label className="block text-[10px] text-muted mb-1 uppercase tracking-wider font-semibold">Deal Title *</label>
            <input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })}
              className="input w-full" placeholder="e.g. Growth Package — Bright Smile Dental" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] text-muted mb-1 uppercase tracking-wider font-semibold">Amount *</label>
              <input type="number" value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })}
                className="input w-full" placeholder="2497" />
            </div>
            <div>
              <label className="block text-[10px] text-muted mb-1 uppercase tracking-wider font-semibold">Stage</label>
              <select value={form.stage} onChange={e => setForm({ ...form, stage: e.target.value })} className="input w-full">
                {STAGES.filter(s => !s.key.startsWith("closed")).map(s => (
                  <option key={s.key} value={s.key}>{s.label}</option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-[10px] text-muted mb-1 uppercase tracking-wider font-semibold">Client</label>
            <select value={form.client_id} onChange={e => setForm({ ...form, client_id: e.target.value })} className="input w-full">
              <option value="">Select client</option>
              {clients.map(c => <option key={c.id} value={c.id}>{c.business_name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-[10px] text-muted mb-1 uppercase tracking-wider font-semibold">Source</label>
            <select value={form.source} onChange={e => setForm({ ...form, source: e.target.value })} className="input w-full">
              <option value="">Select source</option>
              <option value="cold_outreach">Cold Outreach</option>
              <option value="referral">Referral</option>
              <option value="website">Website</option>
              <option value="social_media">Social Media</option>
              <option value="ads">Paid Ads</option>
              <option value="other">Other</option>
            </select>
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <button onClick={() => setShowCreate(false)} className="btn-secondary text-xs">Cancel</button>
            <button onClick={createDeal} disabled={creating} className="btn-primary text-xs flex items-center gap-1.5 disabled:opacity-50">
              {creating ? <Loader size={12} className="animate-spin" /> : <DollarSign size={12} />}
              {creating ? "Creating..." : "Create Deal"}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
