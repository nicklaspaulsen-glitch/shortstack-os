"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/lib/auth-context";
import { createClient } from "@/lib/supabase/client";
import { useAppStore } from "@/lib/store";
import { formatCurrency } from "@/lib/utils";
import {
  Activity, Heart, AlertTriangle, CheckCircle,
  Users, DollarSign, Loader, ChevronRight
} from "lucide-react";

interface ClientHealth {
  id: string;
  business_name: string;
  contact_name: string;
  email: string;
  package_tier: string;
  mrr: number;
  health_score: number;
  is_active: boolean;
  tasks_done: number;
  tasks_total: number;
  content_count: number;
  invoices_pending: number;
}

export default function ClientHealthPage() {
  const { profile } = useAuth();
  const { setManagedClient } = useAppStore();
  const supabase = createClient();
  const [clients, setClients] = useState<ClientHealth[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "healthy" | "warning" | "critical">("all");
  const [sort, setSort] = useState<"health" | "mrr" | "name">("health");

  useEffect(() => {
    fetchHealth();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function fetchHealth() {
    setLoading(true);
    try {
      const { data: clientsData } = await supabase
        .from("clients")
        .select("id, business_name, contact_name, email, package_tier, mrr, health_score, is_active")
        .eq("is_active", true)
        .order("health_score", { ascending: true });

      if (!clientsData) { setLoading(false); return; }

      const enriched = await Promise.all(clientsData.map(async (c) => {
        const [
          { count: tasksDone },
          { count: tasksTotal },
          { count: contentCount },
          { count: invoicesPending },
        ] = await Promise.all([
          supabase.from("client_tasks").select("*", { count: "exact", head: true }).eq("client_id", c.id).eq("status", "done"),
          supabase.from("client_tasks").select("*", { count: "exact", head: true }).eq("client_id", c.id),
          supabase.from("content_scripts").select("*", { count: "exact", head: true }).eq("client_id", c.id),
          supabase.from("invoices").select("*", { count: "exact", head: true }).eq("client_id", c.id).eq("status", "sent"),
        ]);
        return {
          ...c,
          tasks_done: tasksDone || 0,
          tasks_total: tasksTotal || 0,
          content_count: contentCount || 0,
          invoices_pending: invoicesPending || 0,
        };
      }));

      setClients(enriched);
    } catch (err) {
      console.error("[ClientHealth] Error:", err);
    }
    setLoading(false);
  }

  function getHealthColor(score: number) {
    if (score >= 75) return "text-success";
    if (score >= 50) return "text-warning";
    return "text-danger";
  }

  function getHealthBg(score: number) {
    if (score >= 75) return "bg-success/10";
    if (score >= 50) return "bg-warning/10";
    return "bg-danger/10";
  }

  function getHealthLabel(score: number) {
    if (score >= 75) return "Healthy";
    if (score >= 50) return "Needs Attention";
    return "Critical";
  }

  const filtered = clients
    .filter(c => {
      if (filter === "healthy") return c.health_score >= 75;
      if (filter === "warning") return c.health_score >= 50 && c.health_score < 75;
      if (filter === "critical") return c.health_score < 50;
      return true;
    })
    .sort((a, b) => {
      if (sort === "health") return a.health_score - b.health_score;
      if (sort === "mrr") return b.mrr - a.mrr;
      return a.business_name.localeCompare(b.business_name);
    });

  const avgHealth = clients.length > 0 ? Math.round(clients.reduce((s, c) => s + c.health_score, 0) / clients.length) : 0;
  const totalMRR = clients.reduce((s, c) => s + c.mrr, 0);
  const criticalCount = clients.filter(c => c.health_score < 50).length;
  const healthyCount = clients.filter(c => c.health_score >= 75).length;

  if (profile?.role !== "admin") {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <p className="text-sm text-muted">Admin access required</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader size={20} className="animate-spin text-gold" />
      </div>
    );
  }

  return (
    <div className="fade-in space-y-5">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-gold/10 rounded-xl flex items-center justify-center">
          <Heart size={20} className="text-gold" />
        </div>
        <div>
          <h1 className="page-header mb-0">Client Health Monitor</h1>
          <p className="text-xs text-muted">Track client satisfaction, task progress, and account health</p>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="card p-4">
          <div className="flex items-center gap-2 mb-2">
            <Activity size={14} className="text-gold" />
            <span className="text-[9px] text-muted uppercase tracking-wider">Avg Health</span>
          </div>
          <p className={`text-2xl font-bold font-mono ${getHealthColor(avgHealth)}`}>{avgHealth}%</p>
        </div>
        <div className="card p-4">
          <div className="flex items-center gap-2 mb-2">
            <DollarSign size={14} className="text-gold" />
            <span className="text-[9px] text-muted uppercase tracking-wider">Total MRR</span>
          </div>
          <p className="text-2xl font-bold font-mono">{formatCurrency(totalMRR)}</p>
        </div>
        <div className="card p-4">
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle size={14} className="text-success" />
            <span className="text-[9px] text-muted uppercase tracking-wider">Healthy</span>
          </div>
          <p className="text-2xl font-bold font-mono text-success">{healthyCount}</p>
        </div>
        <div className="card p-4">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle size={14} className="text-danger" />
            <span className="text-[9px] text-muted uppercase tracking-wider">Critical</span>
          </div>
          <p className="text-2xl font-bold font-mono text-danger">{criticalCount}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex gap-1.5">
          {(["all", "critical", "warning", "healthy"] as const).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`text-[10px] px-3 py-1.5 rounded-lg border transition-all ${
                filter === f ? "border-gold/30 bg-gold/[0.05] text-gold font-medium" : "border-border text-muted hover:text-foreground"
              }`}
            >
              {f === "all" ? `All (${clients.length})` :
               f === "critical" ? `Critical (${clients.filter(c => c.health_score < 50).length})` :
               f === "warning" ? `Warning (${clients.filter(c => c.health_score >= 50 && c.health_score < 75).length})` :
               `Healthy (${healthyCount})`}
            </button>
          ))}
        </div>
        <select value={sort} onChange={e => setSort(e.target.value as typeof sort)} className="input text-[10px] py-1">
          <option value="health">Sort: Health (worst first)</option>
          <option value="mrr">Sort: MRR (highest)</option>
          <option value="name">Sort: Name (A-Z)</option>
        </select>
      </div>

      {/* Client list */}
      <div className="space-y-2">
        {filtered.map(client => (
          <div key={client.id} className="card card-hover p-4">
            <div className="flex items-center gap-4">
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${getHealthBg(client.health_score)}`}>
                <span className={`text-lg font-bold font-mono ${getHealthColor(client.health_score)}`}>
                  {client.health_score}
                </span>
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <h3 className="text-sm font-semibold truncate">{client.business_name}</h3>
                  <span className={`text-[8px] px-1.5 py-0.5 rounded font-medium ${getHealthBg(client.health_score)} ${getHealthColor(client.health_score)}`}>
                    {getHealthLabel(client.health_score)}
                  </span>
                  <span className="text-[8px] bg-gold/10 text-gold px-1.5 py-0.5 rounded">
                    {client.package_tier || "No tier"}
                  </span>
                </div>
                <p className="text-[10px] text-muted">{client.contact_name}</p>
              </div>

              <div className="hidden md:flex items-center gap-4 shrink-0">
                <div className="text-center">
                  <p className="text-[8px] text-muted uppercase">MRR</p>
                  <p className="text-xs font-bold font-mono">{formatCurrency(client.mrr)}</p>
                </div>
                <div className="text-center">
                  <p className="text-[8px] text-muted uppercase">Tasks</p>
                  <p className="text-xs font-bold font-mono">{client.tasks_done}/{client.tasks_total}</p>
                </div>
                <div className="text-center">
                  <p className="text-[8px] text-muted uppercase">Content</p>
                  <p className="text-xs font-bold font-mono">{client.content_count}</p>
                </div>
                <div className="text-center">
                  <p className="text-[8px] text-muted uppercase">Unpaid</p>
                  <p className={`text-xs font-bold font-mono ${client.invoices_pending > 0 ? "text-warning" : ""}`}>
                    {client.invoices_pending}
                  </p>
                </div>
              </div>

              <button
                onClick={() => {
                  setManagedClient({
                    id: client.id,
                    business_name: client.business_name,
                    contact_name: client.contact_name,
                    email: client.email,
                    package_tier: client.package_tier,
                  });
                }}
                className="btn-secondary text-[10px] flex items-center gap-1 shrink-0"
              >
                Manage <ChevronRight size={10} />
              </button>
            </div>

            {client.tasks_total > 0 && (
              <div className="mt-3 pt-2 border-t border-border/20">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[8px] text-muted">Task Progress</span>
                  <span className="text-[8px] text-muted">{Math.round((client.tasks_done / client.tasks_total) * 100)}%</span>
                </div>
                <div className="w-full bg-surface-light rounded-full h-1.5 overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{
                      width: `${(client.tasks_done / client.tasks_total) * 100}%`,
                      background: client.tasks_done / client.tasks_total >= 0.75 ? "var(--color-success)" :
                                  client.tasks_done / client.tasks_total >= 0.5 ? "var(--color-warning)" : "var(--color-danger)",
                    }}
                  />
                </div>
              </div>
            )}
          </div>
        ))}

        {filtered.length === 0 && (
          <div className="card-static text-center py-12">
            <Users size={24} className="text-muted mx-auto mb-2" />
            <p className="text-sm text-muted">No clients match this filter</p>
          </div>
        )}
      </div>
    </div>
  );
}
