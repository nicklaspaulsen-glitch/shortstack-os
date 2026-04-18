"use client";

import { useEffect, useState, useMemo, useCallback, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import StatCard from "@/components/ui/stat-card";
import { formatCurrency, formatRelativeTime } from "@/lib/utils";
import {
  BarChart3, Users, DollarSign, Zap, Film, Phone, MessageSquare, ArrowUp, ArrowDown,
  TrendingUp, AlertTriangle, Target, Trophy, Calendar, Download, Activity,
  ChevronDown, ChevronRight, Flame, Star, Clock, Filter
} from "lucide-react";
import {
  AreaChart, Area, BarChart, Bar, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend
} from "recharts";
import PageHero from "@/components/ui/page-hero";

const CHART_COLORS = ["#C9A84C", "#38bdf8", "#10b981", "#f43f5e", "#f59e0b", "#8b5cf6"];

// --- Types ---
interface ChurnClient { name: string; risk: "high" | "medium" | "low"; score: number; reason: string; mrr: number }
interface GoalEntry { label: string; current: number; target: number; unit: string }
interface TeamMember { name: string; leads: number; deals: number; revenue: number; calls: number; score: number }
interface ActivityItem { id: string; type: "lead" | "payment" | "post" | "deal" | "call"; message: string; time: string }

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

  // --- New feature state ---
  const [dateRange, setDateRange] = useState<"7d" | "30d" | "90d" | "custom">("30d");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");
  const [expandedSection, setExpandedSection] = useState<string | null>(null);
  const [activityFeed, setActivityFeed] = useState<ActivityItem[]>([]);
  const activityRef = useRef<HTMLDivElement>(null);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { fetchAnalytics(); }, [dateRange, customStart, customEnd]);

  // Real-time activity feed polling
  useEffect(() => {
    const interval = setInterval(() => {
      fetchActivityFeed();
    }, 15000);
    fetchActivityFeed();
    return () => clearInterval(interval);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function fetchActivityFeed() {
    const fiveMinAgo = new Date(Date.now() - 5 * 60000).toISOString();
    const [
      { data: newLeads },
      { data: newContent },
    ] = await Promise.all([
      supabase.from("leads").select("id, business_name, scraped_at").gte("scraped_at", fiveMinAgo).order("scraped_at", { ascending: false }).limit(10),
      supabase.from("content_calendar").select("id, title, updated_at").gte("updated_at", fiveMinAgo).order("updated_at", { ascending: false }).limit(5),
    ]);
    const items: ActivityItem[] = [];
    (newLeads || []).forEach((l: Record<string, string>) => items.push({ id: `lead-${l.id}`, type: "lead", message: `New lead: ${l.business_name}`, time: l.scraped_at }));
    (newContent || []).forEach((c: Record<string, string>) => items.push({ id: `post-${c.id}`, type: "post", message: `Content updated: ${c.title}`, time: c.updated_at }));
    items.sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime());
    setActivityFeed(items.slice(0, 15));
  }

  function getDateRange() {
    const now = new Date();
    if (dateRange === "custom" && customStart && customEnd) {
      return { start: new Date(customStart).toISOString(), end: new Date(customEnd).toISOString() };
    }
    const days = dateRange === "7d" ? 7 : dateRange === "90d" ? 90 : 30;
    return { start: new Date(Date.now() - days * 86400000).toISOString(), end: now.toISOString() };
  }

  async function fetchAnalytics() {
    const now = new Date();
    const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString();
    const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0).toISOString();
    const { start: rangeStart } = getDateRange();

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
      supabase.from("clients").select("mrr, health_score, business_name, created_at, services, package_tier").eq("is_active", true),
      supabase.from("deals").select("*", { count: "exact", head: true }).eq("status", "won"),
      supabase.from("deals").select("amount, created_at, source").eq("status", "won"),
      supabase.from("outreach_log").select("*", { count: "exact", head: true }).gte("sent_at", rangeStart),
      supabase.from("outreach_log").select("*", { count: "exact", head: true }).eq("status", "replied").gte("sent_at", rangeStart),
      supabase.from("leads").select("*", { count: "exact", head: true }).eq("status", "booked"),
      supabase.from("content_calendar").select("*", { count: "exact", head: true }).eq("status", "published"),
      supabase.from("leads").select("scraped_at, source, industry, status").gte("scraped_at", rangeStart).order("scraped_at"),
      supabase.from("outreach_log").select("sent_at, status, platform").gte("sent_at", rangeStart).order("sent_at"),
    ]);

    const totalMRR = clients?.reduce((s: number, c: Record<string, number>) => s + (c.mrr || 0), 0) || 0;
    const dealValue = deals?.reduce((s: number, d: Record<string, number>) => s + (d.amount || 0), 0) || 0;

    setStats({
      totalLeads: totalLeads || 0, leadsThisMonth: leadsThisMonth || 0, leadsLastMonth: leadsLastMonth || 0,
      totalClients: totalClients || 0, activeClients: activeClients || 0,
      totalMRR, lastMonthMRR: 0,
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

    // Revenue data (populated from real invoices when available)
    setRevenueByMonth([]);
  }

  const leadGrowth = stats.leadsLastMonth > 0
    ? Math.round(((stats.leadsThisMonth - stats.leadsLastMonth) / stats.leadsLastMonth) * 100)
    : 0;
  const replyRate = stats.dmsSent > 0 ? Math.round((stats.replies / stats.dmsSent) * 100) : 0;

  const chartTooltipStyle = {
    contentStyle: { background: "var(--color-surface, #FFFFFF)", border: "1px solid var(--color-border, #E8E5E0)", borderRadius: "12px", fontSize: "11px", color: "var(--color-text, #374151)", boxShadow: "0 4px 12px rgba(0,0,0,0.12)" },
    labelStyle: { color: "var(--color-muted, #6B7280)", fontSize: "10px" },
  };

  // --- Feature 1: Revenue Forecasting ---
  const revenueForecast = useMemo(() => {
    if (revenueByMonth.length < 2) return [];
    const mrrValues = revenueByMonth.map(r => r.mrr);
    const avgGrowth = mrrValues.length > 1
      ? mrrValues.slice(1).reduce((s, v, i) => s + (v - mrrValues[i]) / (mrrValues[i] || 1), 0) / (mrrValues.length - 1)
      : 0.05;
    const lastMRR = mrrValues[mrrValues.length - 1] || stats.totalMRR;
    const months = ["May", "Jun", "Jul"];
    return months.map((month, i) => ({
      month,
      projected: Math.round(lastMRR * Math.pow(1 + avgGrowth, i + 1)),
      conservative: Math.round(lastMRR * Math.pow(1 + avgGrowth * 0.5, i + 1)),
      optimistic: Math.round(lastMRR * Math.pow(1 + avgGrowth * 1.5, i + 1)),
    }));
  }, [revenueByMonth, stats.totalMRR]);

  // --- Feature 2: Client Churn Risk ---
  const churnRiskClients = useMemo((): ChurnClient[] => {
    // TODO: Compute from real client activity data once available
    return [];
  }, []);

  // --- Feature 3: Platform ROI ---
  const platformROI = useMemo(() => [
    // TODO: Pull from real ad platform data once connected
    { platform: "Meta", spend: 0, revenue: 0, roi: 0, leads: 0, cpl: 0 },
    { platform: "TikTok", spend: 0, revenue: 0, roi: 0, leads: 0, cpl: 0 },
    { platform: "Google", spend: 0, revenue: 0, roi: 0, leads: 0, cpl: 0 },
    { platform: "LinkedIn", spend: 0, revenue: 0, roi: 0, leads: 0, cpl: 0 },
    { platform: "Email", spend: 0, revenue: 0, roi: 0, leads: 0, cpl: 0 },
  ], []);

  // --- Feature 4: Content Heatmap ---
  const contentHeatmap = useMemo(() => {
    const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
    const hours = ["9am", "12pm", "3pm", "6pm", "9pm"];
    return days.map(day => {
      const row: Record<string, string | number> = { day };
      hours.forEach(hour => {
        row[hour] = 0;
      });
      return row;
    });
  }, []);

  // --- Feature 5: Funnel Data ---
  const funnelData = useMemo(() => [
    { name: "Leads", value: stats.totalLeads || 0, fill: "#C9A84C" },
    { name: "Contacted", value: stats.dmsSent || 0, fill: "#38bdf8" },
    { name: "Calls Booked", value: stats.callsBooked || 0, fill: "#8b5cf6" },
    // TODO: Wire Proposals from real deals/proposals data once tracked
    { name: "Proposals", value: 0, fill: "#f59e0b" },
    { name: "Closed Won", value: stats.totalDeals || 0, fill: "#10b981" },
  ], [stats]);

  // --- Feature 6: Goal Tracker ---
  const [goals] = useState<GoalEntry[]>([
    { label: "Monthly Revenue", current: stats.totalMRR, target: 50000, unit: "$" },
    { label: "New Clients", current: stats.activeClients, target: 25, unit: "" },
    { label: "Leads Generated", current: stats.leadsThisMonth, target: 200, unit: "" },
    { label: "Content Published", current: stats.contentPublished, target: 30, unit: "" },
    { label: "Calls Booked", current: stats.callsBooked, target: 40, unit: "" },
    { label: "Reply Rate", current: replyRate, target: 10, unit: "%" },
  ]);

  // --- Feature 7: Team Leaderboard ---
  const teamMembers = useMemo((): TeamMember[] => [
    // TODO: Pull from real team/user activity data
  ], []);

  // --- Feature 8: Client Lifetime Value ---
  const clvData = useMemo(() => [
    // TODO: Compute from real client billing history
    { name: "Enterprise", avgCLV: 0, avgMonths: 0, count: 0 },
    { name: "Growth", avgCLV: 0, avgMonths: 0, count: 0 },
    { name: "Starter", avgCLV: 0, avgMonths: 0, count: 0 },
  ], []);

  // --- Feature 9: Engagement Benchmarks ---
  const benchmarks = useMemo(() => [
    { metric: "Reply Rate", yours: replyRate || 0, industry: 5.0, max: 20 },
    { metric: "Call Book Rate", yours: stats.callsBooked > 0 ? Math.round((stats.callsBooked / (stats.dmsSent || 1)) * 100) : 0, industry: 3.2, max: 15 },
    { metric: "Close Rate", yours: stats.totalDeals > 0 ? Math.round((stats.totalDeals / (stats.callsBooked || 1)) * 100) : 0, industry: 22, max: 50 },
    { metric: "Content Engagement", yours: 0, industry: 3.2, max: 10 },
    { metric: "Client Retention", yours: 0, industry: 85, max: 100 },
  ], [replyRate, stats]);

  // --- Feature 10: Revenue by Service ---
  const revenueByService = useMemo(() => [
    // TODO: Pull from real service/invoice categories
    { service: "Social Media Mgmt", revenue: 0, clients: 0 },
    { service: "Paid Ads", revenue: 0, clients: 0 },
    { service: "Content Creation", revenue: 0, clients: 0 },
    { service: "Web Development", revenue: 0, clients: 0 },
    { service: "SEO", revenue: 0, clients: 0 },
  ], []);

  // --- Feature 11: Campaign Attribution ---
  const campaignData = useMemo((): Array<{ campaign: string; conversions: number; spend: number; revenue: number; roas: number }> => [], []);

  // --- Feature 12: Monthly Comparison ---
  const monthlyComparison = useMemo(() => {
    // TODO: Populate historical "last" and "threeAgo" buckets from real per-month aggregates
    const current = { leads: stats.leadsThisMonth, mrr: stats.totalMRR, deals: stats.totalDeals, replies: stats.replies };
    const last = { leads: stats.leadsLastMonth, mrr: stats.lastMonthMRR, deals: 0, replies: 0 };
    const threeAgo = { leads: 0, mrr: 0, deals: 0, replies: 0 };
    return { current, last, threeAgo };
  }, [stats]);

  // --- Feature 13: Export ---
  const handleExport = useCallback(() => {
    const report = {
      generated: new Date().toISOString(),
      summary: stats,
      leadGrowth,
      replyRate,
      revenueByMonth,
      leadsBySource,
      forecast: revenueForecast,
      churnRisk: churnRiskClients,
      platformROI,
      funnelData,
      teamMembers,
    };
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `analytics-report-${new Date().toISOString().split("T")[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [stats, leadGrowth, replyRate, revenueByMonth, leadsBySource, revenueForecast, churnRiskClients, platformROI, funnelData, teamMembers]);

  const toggleSection = (section: string) => {
    setExpandedSection(prev => prev === section ? null : section);
  };

  const activityIcon = (type: string) => {
    switch (type) {
      case "lead": return <Zap size={10} className="text-gold" />;
      case "payment": return <DollarSign size={10} className="text-success" />;
      case "post": return <Film size={10} className="text-info" />;
      case "deal": return <Trophy size={10} className="text-gold" />;
      case "call": return <Phone size={10} className="text-purple-400" />;
      default: return <Activity size={10} className="text-muted" />;
    }
  };

  return (
    <div className="fade-in space-y-5">
      {/* Hero Header */}
      <PageHero
        icon={<BarChart3 size={22} />}
        title="Analytics"
        subtitle="See what's working — leads, revenue, and content ROI at a glance."
        gradient="blue"
      />
      {/* Date Range Picker + Export */}
      <div className="flex items-start justify-end flex-wrap gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          {/* Feature 14: Custom Date Range Picker */}
          <div className="flex items-center gap-1 bg-surface rounded-lg p-0.5">
            {(["7d", "30d", "90d", "custom"] as const).map(r => (
              <button key={r} onClick={() => setDateRange(r)}
                className={`px-2.5 py-1 text-[10px] rounded-md transition-all ${dateRange === r ? "bg-gold text-black font-medium" : "text-muted hover:text-foreground"}`}>
                {r === "custom" ? "Custom" : r}
              </button>
            ))}
          </div>
          {dateRange === "custom" && (
            <div className="flex items-center gap-1.5">
              <input type="date" value={customStart} onChange={e => setCustomStart(e.target.value)}
                className="input text-[10px] px-2 py-1 w-28" />
              <span className="text-muted text-[10px]">to</span>
              <input type="date" value={customEnd} onChange={e => setCustomEnd(e.target.value)}
                className="input text-[10px] px-2 py-1 w-28" />
            </div>
          )}
          {/* Feature 13: Export */}
          <button onClick={handleExport} className="btn-secondary text-[10px] px-2.5 py-1.5 flex items-center gap-1.5">
            <Download size={12} /> Export Report
          </button>
        </div>
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
          <h2 className="section-header">Leads ({dateRange === "custom" ? "Custom" : dateRange})</h2>
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

      {/* Feature 1: Revenue Forecasting */}
      <div className="card">
        <button onClick={() => toggleSection("forecast")} className="flex items-center justify-between w-full">
          <h2 className="section-header flex items-center gap-2 mb-0">
            <TrendingUp size={14} className="text-gold" /> Revenue Forecast (Next 3 Months)
          </h2>
          {expandedSection === "forecast" ? <ChevronDown size={14} className="text-muted" /> : <ChevronRight size={14} className="text-muted" />}
        </button>
        {expandedSection === "forecast" && (
          <div className="mt-4">
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={[...revenueByMonth.map(r => ({ month: r.month, projected: r.mrr, conservative: r.mrr, optimistic: r.mrr })), ...revenueForecast]}>
                  <defs>
                    <linearGradient id="forecastGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#10b981" stopOpacity={0.2} />
                      <stop offset="100%" stopColor="#10b981" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border, #E8E5E0)" />
                  <XAxis dataKey="month" tick={{ fontSize: 9, fill: "var(--color-muted, #9CA3AF)" }} />
                  <YAxis tick={{ fontSize: 9, fill: "var(--color-muted, #9CA3AF)" }} tickFormatter={v => `$${(v / 1000).toFixed(0)}k`} />
                  <Tooltip {...chartTooltipStyle} formatter={(v) => formatCurrency(Number(v) || 0)} />
                  <Area type="monotone" dataKey="optimistic" stroke="#10b981" fill="none" strokeWidth={1} strokeDasharray="4 4" name="Optimistic" />
                  <Area type="monotone" dataKey="projected" stroke="#C9A84C" fill="url(#forecastGrad)" strokeWidth={2} name="Projected" />
                  <Area type="monotone" dataKey="conservative" stroke="#f59e0b" fill="none" strokeWidth={1} strokeDasharray="4 4" name="Conservative" />
                  <Legend wrapperStyle={{ fontSize: "10px" }} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
            <div className="grid grid-cols-3 gap-3 mt-3">
              {revenueForecast.map(f => (
                <div key={f.month} className="bg-surface-light rounded-lg p-3 text-center">
                  <p className="text-[10px] text-muted uppercase tracking-wider">{f.month} Forecast</p>
                  <p className="text-lg font-bold text-gold mt-1">{formatCurrency(f.projected)}</p>
                  <p className="text-[9px] text-muted">{formatCurrency(f.conservative)} - {formatCurrency(f.optimistic)}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Feature 5: Funnel + Feature 2: Churn Risk side by side */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Funnel Visualization */}
        <div className="card">
          <h2 className="section-header flex items-center gap-2">
            <Filter size={14} className="text-gold" /> Conversion Funnel
          </h2>
          <div className="space-y-2 mt-3">
            {funnelData.map((stage, i) => {
              const maxVal = funnelData[0].value;
              const pct = maxVal > 0 ? (stage.value / maxVal) * 100 : 0;
              const convRate = i > 0 && funnelData[i - 1].value > 0
                ? Math.round((stage.value / funnelData[i - 1].value) * 100)
                : 100;
              return (
                <div key={stage.name} className="flex items-center gap-3">
                  <div className="w-20 text-[10px] text-muted text-right shrink-0">{stage.name}</div>
                  <div className="flex-1 relative">
                    <div className="h-7 bg-surface-light rounded-md overflow-hidden">
                      <div className="h-full rounded-md transition-all duration-700 flex items-center px-2"
                        style={{ width: `${Math.max(pct, 8)}%`, background: stage.fill }}>
                        <span className="text-[10px] font-bold text-black whitespace-nowrap">{stage.value}</span>
                      </div>
                    </div>
                  </div>
                  <span className="text-[9px] text-muted w-10 shrink-0">{convRate}%</span>
                </div>
              );
            })}
          </div>
          <div className="mt-3 pt-3 border-t border-border flex items-center justify-between">
            <span className="text-[10px] text-muted">Overall conversion</span>
            <span className="text-sm font-bold text-gold">
              {funnelData[0].value > 0 ? ((funnelData[funnelData.length - 1].value / funnelData[0].value) * 100).toFixed(1) : 0}%
            </span>
          </div>
        </div>

        {/* Churn Risk Scores */}
        <div className="card">
          <h2 className="section-header flex items-center gap-2">
            <AlertTriangle size={14} className="text-warning" /> Client Churn Risk
          </h2>
          <div className="space-y-2 mt-3">
            {churnRiskClients.map(client => (
              <div key={client.name} className="flex items-center gap-3 p-2 rounded-lg bg-surface-light">
                <div className={`w-2 h-2 rounded-full shrink-0 ${
                  client.risk === "high" ? "bg-danger" : client.risk === "medium" ? "bg-warning" : "bg-success"
                }`} />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium truncate">{client.name}</p>
                  <p className="text-[9px] text-muted">{client.reason}</p>
                </div>
                <div className="text-right shrink-0">
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                    client.risk === "high" ? "bg-danger/10 text-danger" : client.risk === "medium" ? "bg-warning/10 text-warning" : "bg-success/10 text-success"
                  }`}>
                    {client.score}%
                  </span>
                  <p className="text-[9px] text-muted mt-0.5">{formatCurrency(client.mrr)}/mo</p>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-3 pt-3 border-t border-border flex items-center justify-between">
            <span className="text-[10px] text-muted">At-risk MRR</span>
            <span className="text-sm font-bold text-danger">
              {formatCurrency(churnRiskClients.filter(c => c.risk !== "low").reduce((s, c) => s + c.mrr, 0))}
            </span>
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

      {/* Feature 3: Platform ROI Comparison */}
      <div className="card">
        <button onClick={() => toggleSection("roi")} className="flex items-center justify-between w-full">
          <h2 className="section-header flex items-center gap-2 mb-0">
            <Target size={14} className="text-gold" /> Platform ROI Comparison
          </h2>
          {expandedSection === "roi" ? <ChevronDown size={14} className="text-muted" /> : <ChevronRight size={14} className="text-muted" />}
        </button>
        {expandedSection === "roi" && (
          <div className="mt-4">
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-2 text-[10px] text-muted font-medium uppercase tracking-wider">Platform</th>
                    <th className="text-right py-2 text-[10px] text-muted font-medium uppercase tracking-wider">Spend</th>
                    <th className="text-right py-2 text-[10px] text-muted font-medium uppercase tracking-wider">Revenue</th>
                    <th className="text-right py-2 text-[10px] text-muted font-medium uppercase tracking-wider">ROI</th>
                    <th className="text-right py-2 text-[10px] text-muted font-medium uppercase tracking-wider">Leads</th>
                    <th className="text-right py-2 text-[10px] text-muted font-medium uppercase tracking-wider">CPL</th>
                  </tr>
                </thead>
                <tbody>
                  {platformROI.map(p => (
                    <tr key={p.platform} className="border-b border-border/50 hover:bg-surface-light transition-colors">
                      <td className="py-2.5 font-medium">{p.platform}</td>
                      <td className="py-2.5 text-right text-muted">{formatCurrency(p.spend)}</td>
                      <td className="py-2.5 text-right font-medium text-success">{formatCurrency(p.revenue)}</td>
                      <td className="py-2.5 text-right">
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${p.roi > 200 ? "bg-success/10 text-success" : p.roi > 100 ? "bg-warning/10 text-warning" : "bg-danger/10 text-danger"}`}>
                          {p.roi}%
                        </span>
                      </td>
                      <td className="py-2.5 text-right">{p.leads}</td>
                      <td className="py-2.5 text-right text-muted">{formatCurrency(p.cpl)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="h-48 mt-4">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={platformROI}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border, #E8E5E0)" />
                  <XAxis dataKey="platform" tick={{ fontSize: 9, fill: "var(--color-muted, #9CA3AF)" }} />
                  <YAxis tick={{ fontSize: 9, fill: "var(--color-muted, #9CA3AF)" }} />
                  <Tooltip {...chartTooltipStyle} />
                  <Bar dataKey="spend" fill="#f43f5e" radius={[4, 4, 0, 0]} name="Spend" />
                  <Bar dataKey="revenue" fill="#10b981" radius={[4, 4, 0, 0]} name="Revenue" />
                  <Legend wrapperStyle={{ fontSize: "10px" }} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </div>

      {/* Feature 4: Content Heatmap + Feature 11: Campaign Attribution */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Content Performance Heatmap */}
        <div className="card">
          <h2 className="section-header flex items-center gap-2">
            <Flame size={14} className="text-orange-400" /> Content Performance Heatmap
          </h2>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr>
                  <th className="text-[9px] text-muted font-medium py-1 text-left w-12"></th>
                  {["9am", "12pm", "3pm", "6pm", "9pm"].map(h => (
                    <th key={h} className="text-[9px] text-muted font-medium py-1 text-center">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {contentHeatmap.map(row => (
                  <tr key={row.day as string}>
                    <td className="text-[9px] text-muted py-0.5 font-medium">{row.day as string}</td>
                    {["9am", "12pm", "3pm", "6pm", "9pm"].map(h => {
                      const val = row[h] as number;
                      const intensity = val / 100;
                      return (
                        <td key={h} className="py-0.5 px-0.5">
                          <div className="h-7 rounded-md flex items-center justify-center text-[9px] font-bold transition-all hover:scale-105"
                            style={{
                              background: `rgba(201, 168, 76, ${intensity * 0.6 + 0.05})`,
                              color: intensity > 0.5 ? "#000" : "var(--color-muted, #9CA3AF)",
                            }}>
                            {val}
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="text-[9px] text-muted mt-2 text-center">Engagement score by day and time (higher = better performance)</p>
          </div>
        </div>

        {/* Campaign Attribution */}
        <div className="card">
          <h2 className="section-header flex items-center gap-2">
            <Target size={14} className="text-info" /> Campaign Attribution
          </h2>
          <div className="space-y-2 mt-3">
            {campaignData.length > 0 ? campaignData.map((c, i) => (
              <div key={c.campaign} className="flex items-center gap-3 p-2 rounded-lg bg-surface-light hover:bg-surface-light/80 transition-colors">
                <div className="w-5 h-5 rounded flex items-center justify-center text-[9px] font-bold"
                  style={{ background: CHART_COLORS[i % CHART_COLORS.length] + "22", color: CHART_COLORS[i % CHART_COLORS.length] }}>
                  {i + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] font-medium truncate">{c.campaign}</p>
                  <p className="text-[9px] text-muted">{c.conversions} conversions</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-[11px] font-bold text-success">{c.roas.toFixed(1)}x ROAS</p>
                  <p className="text-[9px] text-muted">{formatCurrency(c.revenue)} rev</p>
                </div>
              </div>
            )) : (
              <p className="text-xs text-muted text-center py-4">No campaign data yet. Attribution data will appear once campaigns are tracked.</p>
            )}
          </div>
        </div>
      </div>

      {/* Feature 6: Goal Tracker + Feature 7: Team Leaderboard */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Goal Tracker */}
        <div className="card">
          <h2 className="section-header flex items-center gap-2">
            <Target size={14} className="text-gold" /> Monthly Goals
          </h2>
          <div className="space-y-3 mt-3">
            {goals.map(goal => {
              const pct = goal.target > 0 ? Math.min((goal.current / goal.target) * 100, 100) : 0;
              return (
                <div key={goal.label}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] text-muted">{goal.label}</span>
                    <span className="text-[10px] font-mono">
                      <span className="font-bold">{goal.unit === "$" ? formatCurrency(goal.current) : `${goal.current}${goal.unit}`}</span>
                      <span className="text-muted"> / {goal.unit === "$" ? formatCurrency(goal.target) : `${goal.target}${goal.unit}`}</span>
                    </span>
                  </div>
                  <div className="h-2 bg-surface-light rounded-full overflow-hidden">
                    <div className={`h-full rounded-full transition-all duration-700 ${pct >= 100 ? "bg-success" : pct >= 70 ? "bg-gold" : pct >= 40 ? "bg-warning" : "bg-danger"}`}
                      style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Team Leaderboard */}
        <div className="card">
          <h2 className="section-header flex items-center gap-2">
            <Trophy size={14} className="text-gold" /> Team Leaderboard
          </h2>
          <div className="space-y-2 mt-3">
            {teamMembers.map((member, i) => (
              <div key={member.name} className="flex items-center gap-3 p-2 rounded-lg bg-surface-light">
                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold ${
                  i === 0 ? "bg-gold/20 text-gold" : i === 1 ? "bg-gray-300/20 text-gray-400" : i === 2 ? "bg-orange-300/20 text-orange-400" : "bg-surface text-muted"
                }`}>
                  {i + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-xs font-medium">{member.name}</p>
                    {i === 0 && <Star size={10} className="text-gold" />}
                  </div>
                  <p className="text-[9px] text-muted">{member.leads} leads / {member.deals} deals / {member.calls} calls</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-xs font-bold text-gold">{formatCurrency(member.revenue)}</p>
                  <div className="flex items-center gap-1 justify-end">
                    <div className="w-10 bg-surface rounded-full h-1.5">
                      <div className="h-full rounded-full bg-gold" style={{ width: `${member.score}%` }} />
                    </div>
                    <span className="text-[9px] text-muted">{member.score}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Feature 8: CLV + Feature 10: Revenue by Service */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Client Lifetime Value */}
        <div className="card">
          <h2 className="section-header flex items-center gap-2">
            <DollarSign size={14} className="text-gold" /> Client Lifetime Value
          </h2>
          <div className="space-y-3 mt-3">
            {clvData.map(tier => (
              <div key={tier.name} className="p-3 rounded-lg bg-surface-light">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-medium">{tier.name}</span>
                  <span className="text-[10px] text-muted">{tier.count} clients</span>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-[9px] text-muted uppercase">Avg CLV</p>
                    <p className="text-sm font-bold text-gold">{formatCurrency(tier.avgCLV)}</p>
                  </div>
                  <div>
                    <p className="text-[9px] text-muted uppercase">Avg Lifetime</p>
                    <p className="text-sm font-bold">{tier.avgMonths} months</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-3 pt-3 border-t border-border flex items-center justify-between">
            <span className="text-[10px] text-muted">Total portfolio CLV</span>
            <span className="text-sm font-bold text-gold">
              {formatCurrency(clvData.reduce((s, t) => s + (t.avgCLV * t.count), 0))}
            </span>
          </div>
        </div>

        {/* Revenue by Service */}
        <div className="card">
          <h2 className="section-header flex items-center gap-2">
            <BarChart3 size={14} className="text-gold" /> Revenue by Service
          </h2>
          <div className="h-48 mt-3">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={revenueByService} dataKey="revenue" nameKey="service" cx="50%" cy="50%" outerRadius={70} innerRadius={40} paddingAngle={2}>
                  {revenueByService.map((_, i) => (
                    <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip {...chartTooltipStyle} formatter={(v) => formatCurrency(Number(v) || 0)} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="space-y-1.5 mt-2">
            {revenueByService.map((s, i) => (
              <div key={s.service} className="flex items-center justify-between text-[10px]">
                <div className="flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-sm" style={{ background: CHART_COLORS[i % CHART_COLORS.length] }} />
                  <span className="text-muted">{s.service}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-mono font-medium">{formatCurrency(s.revenue)}</span>
                  <span className="text-muted">{s.clients} clients</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Feature 9: Engagement Benchmarks */}
      <div className="card">
        <button onClick={() => toggleSection("benchmarks")} className="flex items-center justify-between w-full">
          <h2 className="section-header flex items-center gap-2 mb-0">
            <BarChart3 size={14} className="text-gold" /> Engagement Rate Benchmarks
          </h2>
          {expandedSection === "benchmarks" ? <ChevronDown size={14} className="text-muted" /> : <ChevronRight size={14} className="text-muted" />}
        </button>
        {expandedSection === "benchmarks" && (
          <div className="mt-4 grid grid-cols-1 md:grid-cols-5 gap-3">
            {benchmarks.map(b => {
              const yourPct = (b.yours / b.max) * 100;
              const indPct = (b.industry / b.max) * 100;
              const isAbove = b.yours >= b.industry;
              return (
                <div key={b.metric} className="p-3 rounded-lg bg-surface-light text-center">
                  <p className="text-[9px] text-muted uppercase tracking-wider mb-2">{b.metric}</p>
                  <div className="relative h-24 flex items-end justify-center gap-2 mb-2">
                    <div className="flex flex-col items-center gap-1">
                      <span className="text-[9px] text-muted">Industry</span>
                      <div className="w-8 rounded-t-md bg-border" style={{ height: `${indPct}%` }} />
                      <span className="text-[9px] text-muted font-mono">{b.industry}%</span>
                    </div>
                    <div className="flex flex-col items-center gap-1">
                      <span className="text-[9px] font-medium">You</span>
                      <div className={`w-8 rounded-t-md ${isAbove ? "bg-gold" : "bg-danger"}`} style={{ height: `${yourPct}%` }} />
                      <span className={`text-[9px] font-mono font-bold ${isAbove ? "text-gold" : "text-danger"}`}>{b.yours}%</span>
                    </div>
                  </div>
                  {isAbove ? (
                    <span className="text-[9px] text-success flex items-center justify-center gap-0.5"><ArrowUp size={8} /> Above avg</span>
                  ) : (
                    <span className="text-[9px] text-danger flex items-center justify-center gap-0.5"><ArrowDown size={8} /> Below avg</span>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Feature 12: Monthly Trends Comparison */}
      <div className="card">
        <button onClick={() => toggleSection("monthly")} className="flex items-center justify-between w-full">
          <h2 className="section-header flex items-center gap-2 mb-0">
            <Calendar size={14} className="text-gold" /> Monthly Trends Comparison
          </h2>
          {expandedSection === "monthly" ? <ChevronDown size={14} className="text-muted" /> : <ChevronRight size={14} className="text-muted" />}
        </button>
        {expandedSection === "monthly" && (
          <div className="mt-4">
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-2 text-[10px] text-muted font-medium uppercase tracking-wider">Metric</th>
                    <th className="text-right py-2 text-[10px] text-muted font-medium uppercase tracking-wider">3 Months Ago</th>
                    <th className="text-right py-2 text-[10px] text-muted font-medium uppercase tracking-wider">Last Month</th>
                    <th className="text-right py-2 text-[10px] text-muted font-medium uppercase tracking-wider">This Month</th>
                    <th className="text-right py-2 text-[10px] text-muted font-medium uppercase tracking-wider">Trend</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    { label: "Leads", three: monthlyComparison.threeAgo.leads, last: monthlyComparison.last.leads, current: monthlyComparison.current.leads },
                    { label: "MRR", three: monthlyComparison.threeAgo.mrr, last: monthlyComparison.last.mrr, current: monthlyComparison.current.mrr, isCurrency: true },
                    { label: "Deals Won", three: monthlyComparison.threeAgo.deals, last: monthlyComparison.last.deals, current: monthlyComparison.current.deals },
                    { label: "Replies", three: monthlyComparison.threeAgo.replies, last: monthlyComparison.last.replies, current: monthlyComparison.current.replies },
                  ].map(row => {
                    const growth = row.last > 0 ? Math.round(((row.current - row.last) / row.last) * 100) : 0;
                    return (
                      <tr key={row.label} className="border-b border-border/50">
                        <td className="py-2.5 font-medium">{row.label}</td>
                        <td className="py-2.5 text-right text-muted">{row.isCurrency ? formatCurrency(row.three) : row.three}</td>
                        <td className="py-2.5 text-right text-muted">{row.isCurrency ? formatCurrency(row.last) : row.last}</td>
                        <td className="py-2.5 text-right font-bold">{row.isCurrency ? formatCurrency(row.current) : row.current}</td>
                        <td className="py-2.5 text-right">
                          <span className={`flex items-center justify-end gap-0.5 text-[10px] font-bold ${growth >= 0 ? "text-success" : "text-danger"}`}>
                            {growth >= 0 ? <ArrowUp size={10} /> : <ArrowDown size={10} />}
                            {Math.abs(growth)}%
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
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

      {/* Feature 15: Real-time Activity Feed */}
      <div className="card">
        <div className="flex items-center justify-between mb-3">
          <h2 className="section-header flex items-center gap-2 mb-0">
            <Activity size={14} className="text-success" /> Real-time Activity Feed
          </h2>
          <div className="flex items-center gap-1.5 text-[9px] text-success">
            <span className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" />
            Live
          </div>
        </div>
        <div ref={activityRef} className="max-h-48 overflow-y-auto space-y-1.5">
          {activityFeed.length > 0 ? activityFeed.map(item => (
            <div key={item.id} className="flex items-center gap-2.5 p-2 rounded-lg bg-surface-light hover:bg-surface-light/80 transition-colors">
              <div className="w-5 h-5 rounded-full bg-surface flex items-center justify-center shrink-0">
                {activityIcon(item.type)}
              </div>
              <p className="text-[11px] flex-1 min-w-0 truncate">{item.message}</p>
              <span className="text-[9px] text-muted shrink-0 flex items-center gap-1">
                <Clock size={8} /> {formatRelativeTime(item.time)}
              </span>
            </div>
          )) : (
            <div className="text-center py-6 text-muted text-xs">
              <Activity size={16} className="mx-auto mb-2 opacity-40" />
              No recent activity. New events will appear here in real-time.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
