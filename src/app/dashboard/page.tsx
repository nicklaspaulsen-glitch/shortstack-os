"use client";

import { useAuth } from "@/lib/auth-context";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import StatCard from "@/components/ui/stat-card";
import StatusBadge from "@/components/ui/status-badge";
import { formatCurrency, formatRelativeTime } from "@/lib/utils";
import {
  Zap, Users, DollarSign, MessageSquare, Activity, TrendingUp,
  Phone, Bot, AlertTriangle
} from "lucide-react";

interface DashboardStats {
  leadsToday: number;
  totalLeads: number;
  dmsSentToday: number;
  dmsTarget: number;
  repliesThisWeek: number;
  activeClients: number;
  totalMRR: number;
  callsBooked: number;
  systemIssues: number;
  trinityActions: number;
}

export default function DashboardPage() {
  const { profile } = useAuth();
  const [stats, setStats] = useState<DashboardStats>({
    leadsToday: 0, totalLeads: 0, dmsSentToday: 0, dmsTarget: 80,
    repliesThisWeek: 0, activeClients: 0, totalMRR: 0, callsBooked: 0,
    systemIssues: 0, trinityActions: 0,
  });
  const [recentLeads, setRecentLeads] = useState<Array<{ business_name: string; industry: string; source: string; scraped_at: string }>>([]);
  const [healthItems, setHealthItems] = useState<Array<{ integration_name: string; status: string; last_check_at: string }>>([]);
  const supabase = createClient();

  useEffect(() => {
    fetchDashboardData();
  }, []);

  async function fetchDashboardData() {
    const today = new Date().toISOString().split("T")[0];
    const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString();

    const [
      { count: leadsToday },
      { count: totalLeads },
      { count: dmsSentToday },
      { count: repliesThisWeek },
      { count: activeClients },
      { data: clients },
      { count: callsBooked },
      { count: systemIssues },
      { count: trinityActions },
      { data: leads },
      { data: health },
    ] = await Promise.all([
      supabase.from("leads").select("*", { count: "exact", head: true }).gte("scraped_at", today),
      supabase.from("leads").select("*", { count: "exact", head: true }),
      supabase.from("outreach_log").select("*", { count: "exact", head: true }).gte("sent_at", today),
      supabase.from("outreach_log").select("*", { count: "exact", head: true }).eq("status", "replied").gte("sent_at", weekAgo),
      supabase.from("clients").select("*", { count: "exact", head: true }).eq("is_active", true),
      supabase.from("clients").select("mrr").eq("is_active", true),
      supabase.from("leads").select("*", { count: "exact", head: true }).eq("status", "booked"),
      supabase.from("system_health").select("*", { count: "exact", head: true }).eq("status", "down"),
      supabase.from("trinity_log").select("*", { count: "exact", head: true }).gte("created_at", today),
      supabase.from("leads").select("business_name, industry, source, scraped_at").order("scraped_at", { ascending: false }).limit(5),
      supabase.from("system_health").select("integration_name, status, last_check_at").order("integration_name"),
    ]);

    const totalMRR = clients?.reduce((sum, c) => sum + (c.mrr || 0), 0) || 0;

    setStats({
      leadsToday: leadsToday || 0,
      totalLeads: totalLeads || 0,
      dmsSentToday: dmsSentToday || 0,
      dmsTarget: 80,
      repliesThisWeek: repliesThisWeek || 0,
      activeClients: activeClients || 0,
      totalMRR,
      callsBooked: callsBooked || 0,
      systemIssues: systemIssues || 0,
      trinityActions: trinityActions || 0,
    });
    setRecentLeads(leads || []);
    setHealthItems(health || []);
  }

  if (profile?.role === "client") {
    return <ClientDashboard />;
  }

  return (
    <div className="fade-in space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-header mb-0">Welcome back, {profile?.full_name?.split(" ")[0]}</h1>
          <p className="text-muted text-sm">Here&apos;s your agency overview</p>
        </div>
        <div className="text-sm text-muted">
          {new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
        </div>
      </div>

      {/* Key Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
        <StatCard label="Leads Today" value={stats.leadsToday} icon={<Zap size={18} />} change={`${stats.totalLeads} total`} />
        <StatCard label="DMs Sent Today" value={`${stats.dmsSentToday}/${stats.dmsTarget}`} icon={<MessageSquare size={18} />} />
        <StatCard label="Replies This Week" value={stats.repliesThisWeek} icon={<TrendingUp size={18} />} changeType="positive" />
        <StatCard label="Active Clients" value={stats.activeClients} icon={<Users size={18} />} />
        <StatCard label="Monthly Revenue" value={formatCurrency(stats.totalMRR)} icon={<DollarSign size={18} />} changeType="positive" />
      </div>

      {/* Second Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Calls Booked" value={stats.callsBooked} icon={<Phone size={18} />} />
        <StatCard label="Trinity Actions Today" value={stats.trinityActions} icon={<Bot size={18} />} />
        <StatCard
          label="System Issues"
          value={stats.systemIssues}
          icon={stats.systemIssues > 0 ? <AlertTriangle size={18} /> : <Activity size={18} />}
          changeType={stats.systemIssues > 0 ? "negative" : "positive"}
          change={stats.systemIssues > 0 ? "Needs attention" : "All systems healthy"}
        />
        <StatCard label="DM Progress" value={`${Math.round((stats.dmsSentToday / stats.dmsTarget) * 100)}%`} icon={<MessageSquare size={18} />} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Leads */}
        <div className="card">
          <h2 className="section-header">Recent Leads</h2>
          <div className="space-y-3">
            {recentLeads.length === 0 ? (
              <p className="text-muted text-sm">No leads scraped yet today</p>
            ) : (
              recentLeads.map((lead, i) => (
                <div key={i} className="flex items-center justify-between py-2 border-b border-border/50 last:border-0">
                  <div>
                    <p className="text-sm font-medium">{lead.business_name}</p>
                    <p className="text-xs text-muted">{lead.industry || "Unknown"} · {lead.source}</p>
                  </div>
                  <span className="text-xs text-muted">{formatRelativeTime(lead.scraped_at)}</span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* System Health */}
        <div className="card">
          <h2 className="section-header">System Health</h2>
          <div className="space-y-2">
            {healthItems.length === 0 ? (
              <p className="text-muted text-sm">No integrations configured yet</p>
            ) : (
              healthItems.map((item, i) => (
                <div key={i} className="flex items-center justify-between py-2 border-b border-border/50 last:border-0">
                  <span className="text-sm">{item.integration_name}</span>
                  <StatusBadge status={item.status} />
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function ClientDashboard() {
  return (
    <div className="fade-in">
      <h1 className="page-header">Welcome to your Portal</h1>
      <p className="text-muted">View your services, tasks, and invoices from the sidebar.</p>
    </div>
  );
}
