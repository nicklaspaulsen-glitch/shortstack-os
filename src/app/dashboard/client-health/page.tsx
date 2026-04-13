"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { createClient } from "@/lib/supabase/client";
import { Client } from "@/lib/types";
import { formatCurrency } from "@/lib/utils";
import {
  Heart, AlertTriangle, TrendingUp, Users,
  Clock, CheckCircle, ArrowRight, Loader
} from "lucide-react";
import Link from "next/link";

export default function ClientHealthPage() {
  useAuth();
  const supabase = createClient();
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { fetchClients(); }, []);

  async function fetchClients() {
    try {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (!authUser) return;
      setLoading(true);
      const { data } = await supabase
        .from("clients")
        .select("*")
        .eq("is_active", true)
        .order("health_score", { ascending: true });
      setClients(data || []);
    } catch (err) {
      console.error("[ClientHealth] fetchClients error:", err);
    } finally {
      setLoading(false);
    }
  }

  const atRisk = clients.filter(c => c.health_score < 50);
  const healthy = clients.filter(c => c.health_score >= 50 && c.health_score < 80);
  const thriving = clients.filter(c => c.health_score >= 80);
  const totalMRR = clients.reduce((sum, c) => sum + (c.mrr || 0), 0);
  const atRiskMRR = atRisk.reduce((sum, c) => sum + (c.mrr || 0), 0);
  const avgHealth = clients.length > 0 ? Math.round(clients.reduce((sum, c) => sum + c.health_score, 0) / clients.length) : 0;

  if (loading) return <div className="flex items-center justify-center py-20"><Loader size={20} className="animate-spin text-gold" /></div>;

  return (
    <div className="fade-in space-y-5">
      <div>
        <h1 className="page-header mb-0 flex items-center gap-2">
          <Heart size={18} className="text-gold" /> Client Health
        </h1>
        <p className="text-xs text-muted mt-0.5">Monitor client satisfaction, identify churn risk, take action</p>
      </div>

      {/* Overview Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <div className="card text-center">
          <p className="text-[10px] text-muted mb-1">Avg Health</p>
          <p className={`text-2xl font-bold ${avgHealth >= 70 ? "text-success" : avgHealth >= 50 ? "text-warning" : "text-danger"}`}>{avgHealth}%</p>
        </div>
        <div className="card text-center">
          <p className="text-[10px] text-muted mb-1">Total MRR</p>
          <p className="text-2xl font-bold text-gold">{formatCurrency(totalMRR)}</p>
        </div>
        <div className="card text-center">
          <p className="text-[10px] text-muted mb-1">At Risk</p>
          <p className="text-2xl font-bold text-danger">{atRisk.length}</p>
          <p className="text-[9px] text-danger/60">{formatCurrency(atRiskMRR)} MRR at risk</p>
        </div>
        <div className="card text-center">
          <p className="text-[10px] text-muted mb-1">Stable</p>
          <p className="text-2xl font-bold text-warning">{healthy.length}</p>
        </div>
        <div className="card text-center">
          <p className="text-[10px] text-muted mb-1">Thriving</p>
          <p className="text-2xl font-bold text-success">{thriving.length}</p>
        </div>
      </div>

      {/* At Risk Clients */}
      {atRisk.length > 0 && (
        <div className="card border-danger/10">
          <h2 className="section-header flex items-center gap-2">
            <AlertTriangle size={14} className="text-danger" /> At Risk — Needs Immediate Attention
          </h2>
          <div className="space-y-2">
            {atRisk.map(client => (
              <Link key={client.id} href={`/dashboard/clients/${client.id}`}
                className="flex items-center justify-between p-3 rounded-lg hover:bg-danger/[0.03] transition-colors group"
                style={{ border: "1px solid rgba(244,63,94,0.1)" }}>
                <div className="flex items-center gap-3">
                  <div className="relative w-10 h-10 rounded-full flex items-center justify-center" style={{ background: "rgba(244,63,94,0.1)" }}>
                    <span className="text-danger font-bold text-sm">{client.health_score}%</span>
                  </div>
                  <div>
                    <p className="text-sm font-semibold">{client.business_name}</p>
                    <p className="text-[10px] text-muted">{client.package_tier || "Standard"} · {formatCurrency(client.mrr)}/mo</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-24 bg-white/[0.03] rounded-full h-2">
                    <div className="h-2 rounded-full bg-danger" style={{ width: `${client.health_score}%` }} />
                  </div>
                  <ArrowRight size={14} className="text-muted group-hover:text-danger transition-colors" />
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Stable Clients */}
      {healthy.length > 0 && (
        <div className="card">
          <h2 className="section-header flex items-center gap-2">
            <Clock size={14} className="text-warning" /> Stable — Monitor Regularly
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {healthy.map(client => (
              <Link key={client.id} href={`/dashboard/clients/${client.id}`}
                className="flex items-center justify-between p-3 rounded-lg hover:bg-white/[0.02] transition-colors border border-border">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ background: "rgba(245,158,11,0.1)" }}>
                    <span className="text-warning text-[10px] font-bold">{client.health_score}</span>
                  </div>
                  <div>
                    <p className="text-xs font-semibold">{client.business_name}</p>
                    <p className="text-[9px] text-muted">{formatCurrency(client.mrr)}/mo</p>
                  </div>
                </div>
                <div className="w-16 bg-white/[0.03] rounded-full h-1.5">
                  <div className="h-1.5 rounded-full bg-warning" style={{ width: `${client.health_score}%` }} />
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Thriving Clients */}
      {thriving.length > 0 && (
        <div className="card border-success/10">
          <h2 className="section-header flex items-center gap-2">
            <TrendingUp size={14} className="text-success" /> Thriving — Keep It Up
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
            {thriving.map(client => (
              <Link key={client.id} href={`/dashboard/clients/${client.id}`}
                className="flex items-center gap-2.5 p-3 rounded-lg hover:bg-white/[0.02] transition-colors border border-border">
                <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ background: "rgba(16,185,129,0.1)" }}>
                  <CheckCircle size={14} className="text-success" />
                </div>
                <div>
                  <p className="text-xs font-semibold">{client.business_name}</p>
                  <p className="text-[9px] text-success">{client.health_score}% · {formatCurrency(client.mrr)}/mo</p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {clients.length === 0 && (
        <div className="card text-center py-12">
          <Users size={24} className="mx-auto mb-2 text-muted/30" />
          <p className="text-xs text-muted">No active clients yet</p>
        </div>
      )}
    </div>
  );
}
