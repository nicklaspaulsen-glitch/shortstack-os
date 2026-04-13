"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import StatCard from "@/components/ui/stat-card";
import { formatCurrency } from "@/lib/utils";
import {
  BarChart3, Users, DollarSign, Zap, Film,
  Phone, MessageSquare, ArrowUp, ArrowDown
} from "lucide-react";
import {
  AreaChart, Area, BarChart, Bar, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell
} from "recharts";

const CHART_COLORS = ["#C9A84C", "#38bdf8", "#10b981", "#f43f5e", "#f59e0b", "#8b5cf6"];

export default function AnalyticsPage() {
  const [stats, setStats] = useState({
    totalLeads: 0, leadsThisMonth: 0, leadsLastMonth: 0,
    totalClients: 0, activeClients: 0,
    totalMRR: 0, lastMonthMRR: 0,
    totalDeals: 0, dealValue: 0,
    dmsSent: 0, replies: 0, callsBooked: 0,
    contentPublished: 0,
  });
  const [leadsByDay, setLeadsByDay] = useState<Array<{ date: string; count: number }>>([]);
  const [revenueByMonth, setRevenueByMonth] = useState<Array<{ month: string; mrr: number; deals: number }>>([]);
  const [leadsBySource, setLeadsBySource] = useState<Array<{ source: string; count: number }>>([]);
  const [leadsByIndustry, setLeadsByIndustry] = useState<Array<{ industry: string; count: number }>>([]);
  const [outreachByDay, setOutreachByDay] = useState<Array<{ date: string; sent: number; replies: number }>>([]);
  const supabase = createClient();

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { fetchAnalytics(); }, []);

  async function fetchAnalytics() {
    const now = new Date();
    const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString();
    const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0).toISOString();
    const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString();

    const [
      { count: totalLeads },
      { count: leadsThisMonth },
      { count: leadsLastMonth },
      { count: totalClients },
      { count: activeClients },
      { data: clients },
      { count: totalDeals },
      { data: deals },
      { count: dmsSent },
      { count: replies },
      { count: callsBooked },
      { count: contentPublished },
      { data: recentLeads },
      { data: outreach },
    ] = await Promise.all([
      supabase.from("leads").select("*", { count: "exact", head: true }),
      supabase.from("leads").select("*", { count: "exact", head: true }).gte("scraped_at", thisMonth),
      supabase.from("leads").select("*", { count: "exact", head: true }).gte("scraped_at", lastMonth).lte("scraped_at", lastMonthEnd),
      supabase.from("clients").select("*", { count: "exact", head: true }),
      supabase.from("clients").select("*", { count: "exact", head: true }).eq("is_active", true),
      supabase.from("clients").select("mrr").eq("is_active", true),
      supabase.from("deals").select("*", { count: "exact", head: true }).eq("status", "won"),
      supabase.from("deals").select("amount").eq("status", "won"),
      supabase.from("outreach_log").select("*", { count: "exact", head: true }).gte("sent_at", thirtyDaysAgo),
      supabase.from("outreach_log").select("*", { count: "exact", head: true }).eq("status", "replied").gte("sent_at", thirtyDaysAgo),
      supabase.from("leads").select("*", { count: "exact", head: true }).eq("status", "booked"),
      supabase.from("content_calendar").select("*", { count: "exact", head: true }).eq("status", "published"),
      supabase.from("leads").select("scraped_at, source, industry").gte("scraped_at", thirtyDaysAgo).order("scraped_at"),
      supabase.from("outreach_log").select("sent_at, status").gte("sent_at", thirtyDaysAgo).order("sent_at"),
    ]);

    const totalMRR = clients?.reduce((s, c) => s + (c.mrr || 0), 0) || 0;
    const dealValue = deals?.reduce((s, d) => s + (d.amount || 0), 0) || 0;

    setStats({
      totalLeads: totalLeads || 0, leadsThisMonth: leadsThisMonth || 0, leadsLastMonth: leadsLastMonth || 0,
      totalClients: totalClients || 0, activeClients: activeClients || 0,
      totalMRR, lastMonthMRR: totalMRR * 0.9,
      totalDeals: totalDeals || 0, dealValue,
      dmsSent: dmsSent || 0, replies: replies || 0, callsBooked: callsBooked || 0,
      contentPublished: contentPublished || 0,
    });

    // Leads by day
    const dayMap: Record<string, number> = {};
    (recentLeads || []).forEach((l: { scraped_at: string }) => {
      const day = new Date(l.scraped_at).toLocaleDateString("en-US", { month: "short", day: "numeric" });
      dayMap[day] = (dayMap[day] || 0) + 1;
    });
    setLeadsByDay(Object.entries(dayMap).map(([date, count]) => ({ date, count })));

    // Leads by source
    const sourceMap: Record<string, number> = {};
    (recentLeads || []).forEach((l: { source: string }) => {
      sourceMap[l.source || "other"] = (sourceMap[l.source || "other"] || 0) + 1;
    });
    setLeadsBySource(Object.entries(sourceMap).map(([source, count]) => ({ source, count })));

    // Leads by industry
    const indMap: Record<string, number> = {};
    (recentLeads || []).forEach((l: { industry: string }) => {
      indMap[l.industry || "other"] = (indMap[l.industry || "other"] || 0) + 1;
    });
    setLeadsByIndustry(Object.entries(indMap).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([industry, count]) => ({ industry, count })));

    // Outreach by day
    const outMap: Record<string, { sent: number; replies: number }> = {};
    (outreach || []).forEach((o: { sent_at: string; status: string }) => {
      const day = new Date(o.sent_at).toLocaleDateString("en-US", { month: "short", day: "numeric" });
      if (!outMap[day]) outMap[day] = { sent: 0, replies: 0 };
      outMap[day].sent++;
      if (o.status === "replied") outMap[day].replies++;
    });
    setOutreachByDay(Object.entries(outMap).map(([date, v]) => ({ date, ...v })));

    // Revenue mock data (would come from invoices in production)
    setRevenueByMonth([
      { month: "Jan", mrr: totalMRR * 0.6, deals: dealValue * 0.3 },
      { month: "Feb", mrr: totalMRR * 0.7, deals: dealValue * 0.4 },
      { month: "Mar", mrr: totalMRR * 0.85, deals: dealValue * 0.6 },
      { month: "Apr", mrr: totalMRR, deals: dealValue * 0.8 },
    ]);
  }

  const leadGrowth = stats.leadsLastMonth > 0
    ? Math.round(((stats.leadsThisMonth - stats.leadsLastMonth) / stats.leadsLastMonth) * 100)
    : 0;
  const replyRate = stats.dmsSent > 0 ? Math.round((stats.replies / stats.dmsSent) * 100) : 0;

  const chartTooltipStyle = {
    contentStyle: { background: "var(--color-surface, #FFFFFF)", border: "1px solid var(--color-border, #E8E5E0)", borderRadius: "12px", fontSize: "11px", color: "var(--color-text, #374151)", boxShadow: "0 4px 12px rgba(0,0,0,0.12)" },
    labelStyle: { color: "var(--color-muted, #6B7280)", fontSize: "10px" },
  };

  return (
    <div className="fade-in space-y-5">
      <div>
        <h1 className="page-header mb-0 flex items-center gap-2">
          <BarChart3 size={18} className="text-gold" /> Analytics
        </h1>
        <p className="text-xs text-muted mt-0.5">Performance metrics across leads, revenue, outreach, and content</p>
      </div>

      {/* Key metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2.5">
        <StatCard label="Total Leads" value={stats.totalLeads.toLocaleString()} icon={<Zap size={14} />}
          change={leadGrowth > 0 ? `+${leadGrowth}%` : `${leadGrowth}%`} changeType={leadGrowth >= 0 ? "positive" : "negative"} />
        <StatCard label="MRR" value={formatCurrency(stats.totalMRR)} icon={<DollarSign size={14} />} changeType="positive" />
        <StatCard label="Active Clients" value={stats.activeClients} icon={<Users size={14} />}
          change={`${stats.totalClients} total`} />
        <StatCard label="DMs Sent" value={stats.dmsSent} icon={<MessageSquare size={14} />}
          change={`${replyRate}% reply rate`} changeType={replyRate >= 5 ? "positive" : "neutral"} />
        <StatCard label="Calls Booked" value={stats.callsBooked} icon={<Phone size={14} />} />
        <StatCard label="Content" value={stats.contentPublished} icon={<Film size={14} />} change="published" />
      </div>

      {/* Charts row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Leads over time */}
        <div className="card">
          <h2 className="section-header">Leads (30 days)</h2>
          <div className="h-52">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={leadsByDay}>
                <defs>
                  <linearGradient id="goldGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#C9A84C" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="#C9A84C" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border, #E8E5E0)" />
                <XAxis dataKey="date" tick={{ fontSize: 9, fill: "var(--color-muted, #9CA3AF)" }} />
                <YAxis tick={{ fontSize: 9, fill: "var(--color-muted, #9CA3AF)" }} />
                <Tooltip {...chartTooltipStyle} />
                <Area type="monotone" dataKey="count" stroke="#C9A84C" fill="url(#goldGrad)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Revenue */}
        <div className="card">
          <h2 className="section-header">Revenue</h2>
          <div className="h-52">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={revenueByMonth}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border, #E8E5E0)" />
                <XAxis dataKey="month" tick={{ fontSize: 9, fill: "var(--color-muted, #9CA3AF)" }} />
                <YAxis tick={{ fontSize: 9, fill: "var(--color-muted, #9CA3AF)" }} />
                <Tooltip {...chartTooltipStyle} />
                <Bar dataKey="mrr" fill="#C9A84C" radius={[4, 4, 0, 0]} name="MRR" />
                <Bar dataKey="deals" fill="#38bdf8" radius={[4, 4, 0, 0]} name="Deal Revenue" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Charts row 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Lead sources pie */}
        <div className="card">
          <h2 className="section-header">Lead Sources</h2>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={leadsBySource} dataKey="count" nameKey="source" cx="50%" cy="50%" outerRadius={70} innerRadius={40} paddingAngle={2}>
                  {leadsBySource.map((_, i) => (
                    <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip {...chartTooltipStyle} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="flex flex-wrap gap-2 mt-2 justify-center">
            {leadsBySource.map((s, i) => (
              <div key={s.source} className="flex items-center gap-1 text-[9px]">
                <div className="w-2 h-2 rounded-sm" style={{ background: CHART_COLORS[i % CHART_COLORS.length] }} />
                <span className="text-muted capitalize">{s.source.replace(/_/g, " ")}</span>
                <span className="font-mono">{s.count}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Industries bar */}
        <div className="card">
          <h2 className="section-header">Top Industries</h2>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={leadsByIndustry} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border, #E8E5E0)" />
                <XAxis type="number" tick={{ fontSize: 9, fill: "var(--color-muted, #9CA3AF)" }} />
                <YAxis dataKey="industry" type="category" tick={{ fontSize: 9, fill: "var(--color-muted, #9CA3AF)" }} width={80} />
                <Tooltip {...chartTooltipStyle} />
                <Bar dataKey="count" fill="#38bdf8" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Outreach performance */}
        <div className="card">
          <h2 className="section-header">Outreach Performance</h2>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={outreachByDay}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border, #E8E5E0)" />
                <XAxis dataKey="date" tick={{ fontSize: 9, fill: "var(--color-muted, #9CA3AF)" }} />
                <YAxis tick={{ fontSize: 9, fill: "var(--color-muted, #9CA3AF)" }} />
                <Tooltip {...chartTooltipStyle} />
                <Line type="monotone" dataKey="sent" stroke="#C9A84C" strokeWidth={2} dot={false} name="Sent" />
                <Line type="monotone" dataKey="replies" stroke="#10b981" strokeWidth={2} dot={false} name="Replies" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Performance indicators */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
        <div className="card text-center p-3">
          <div className="flex items-center justify-center gap-1 mb-1">
            {leadGrowth >= 0 ? <ArrowUp size={12} className="text-success" /> : <ArrowDown size={12} className="text-danger" />}
            <span className={`text-lg font-bold font-mono ${leadGrowth >= 0 ? "text-success" : "text-danger"}`}>{leadGrowth}%</span>
          </div>
          <p className="text-[9px] text-muted uppercase tracking-wider">Lead Growth</p>
        </div>
        <div className="card text-center p-3">
          <span className="text-lg font-bold font-mono text-gold">{replyRate}%</span>
          <p className="text-[9px] text-muted uppercase tracking-wider">Reply Rate</p>
        </div>
        <div className="card text-center p-3">
          <span className="text-lg font-bold font-mono text-gold">{formatCurrency(stats.dealValue)}</span>
          <p className="text-[9px] text-muted uppercase tracking-wider">Revenue Closed</p>
        </div>
        <div className="card text-center p-3">
          <span className="text-lg font-bold font-mono text-success">{stats.totalDeals}</span>
          <p className="text-[9px] text-muted uppercase tracking-wider">Deals Won</p>
        </div>
      </div>
    </div>
  );
}
