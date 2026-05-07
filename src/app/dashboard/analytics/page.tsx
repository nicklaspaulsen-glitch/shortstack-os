"use client";

import { useEffect, useState, useMemo, useCallback, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { formatCurrency, formatRelativeTime } from "@/lib/utils";
import {
  BarChart3, Users, DollarSign, Zap, Film, Phone, MessageSquare, ArrowUp, ArrowDown,
  TrendingUp, AlertTriangle, Target, Trophy, Calendar, Download, Activity,
  ChevronDown, ChevronRight, Flame, Star, Clock, CheckCircle
} from "lucide-react";
import {
  AreaChart, Area, BarChart, Bar, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend
} from "recharts";
import { motion, AnimatePresence } from "framer-motion";
import { MotionPage } from "@/components/motion/motion-page";
import { StatSkeleton, CardSkeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state-illustration";
import PageHero from "@/components/ui/page-hero";
import Link from "next/link";

const CHART_COLORS = ["#FF2D2D", "#FF6B6B", "#7FE5B8", "#F26063", "#FFC062", "#CC2424"];

// ─── Types ─────────────────────────────────────────────────────────────────
interface ChurnClient { name: string; risk: "high" | "medium" | "low"; score: number; reason: string; mrr: number }
interface GoalEntry { label: string; current: number; target: number; unit: string }
interface TeamMember { name: string; leads: number; deals: number; revenue: number; calls: number; score: number }
interface ActivityItem { id: string; type: "lead" | "payment" | "post" | "deal" | "call"; message: string; time: string }

// ─── Tooltip style (shared) ────────────────────────────────────────────────
const TT = {
  contentStyle: {
    background: "#0E0D14",
    border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: "8px",
    fontSize: "11px",
    color: "#F5F4F1",
    boxShadow: "0 12px 32px rgba(0,0,0,0.6)",
    padding: "8px 10px",
  },
  labelStyle: { color: "#6F6D7A", fontSize: "9px", marginBottom: "4px", textTransform: "uppercase" as const, letterSpacing: "0.1em" },
  itemStyle: { color: "#F5F4F1", fontSize: "11px" },
};

// ─── Accordion item ───────────────────────────────────────────────────────
function Accordion({
  id, label, icon, badge, expanded, onToggle, children,
}: {
  id: string; label: string; icon: React.ReactNode; badge?: React.ReactNode;
  expanded: boolean; onToggle: () => void; children: React.ReactNode;
}) {
  return (
    <div
      className=" border border-[rgba(255,255,255,0.1)] overflow-hidden"
      style={{ background: "rgba(255,255,255,0.025)", backdropFilter: "blur(12px)" }}
    >
      <button
        onClick={onToggle}
        className="flex items-center justify-between w-full px-6 py-4 hover:bg-[rgba(255,255,255,0.03)] transition-colors duration-150"
      >
        <div className="flex items-center gap-2.5">
          <span className="text-[#6F6D7A]">{icon}</span>
          <span className="font-display text-sm font-semibold text-[#F5F4F1] tracking-[-0.01em]">{label}</span>
          {badge}
        </div>
        {expanded
          ? <ChevronDown size={13} className="text-[#4F4D58]" />
          : <ChevronRight size={13} className="text-[#4F4D58]" />}
      </button>
      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            key="content"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            style={{ overflow: "hidden" }}
          >
            <div className="px-6 pb-6 border-t border-[rgba(255,255,255,0.04)]">
              {children}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────
export default function AnalyticsPage() {
  const [isLoading, setIsLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
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

  const [dateRange, setDateRange] = useState<"7d" | "30d" | "90d" | "custom">("30d");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");
  const [expandedSection, setExpandedSection] = useState<string | null>(null);
  const [activityFeed, setActivityFeed] = useState<ActivityItem[]>([]);
  const activityRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const cancelled = { current: false };
    setFetchError(null);
    fetchAnalytics(cancelled).catch((err: unknown) => {
      if (!cancelled.current) console.error("[analytics] fetchAnalytics error:", err);
    });
    return () => { cancelled.current = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateRange, customStart, customEnd]);

  useEffect(() => {
    fetchActivityFeed();
    const id = setInterval(() => { fetchActivityFeed(); }, 15000);
    return () => clearInterval(id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function fetchActivityFeed() {
    try {
      const fiveMinAgo = new Date(Date.now() - 5 * 60000).toISOString();
      const [{ data: newLeads }, { data: newContent }] = await Promise.all([
        supabase.from("leads").select("id, business_name, scraped_at").gte("scraped_at", fiveMinAgo).order("scraped_at", { ascending: false }).limit(10),
        supabase.from("content_calendar").select("id, title, updated_at").gte("updated_at", fiveMinAgo).order("updated_at", { ascending: false }).limit(5),
      ]);
      const items: ActivityItem[] = [];
      (newLeads || []).forEach((l: Record<string, string>) => items.push({ id: `lead-${l.id}`, type: "lead", message: `New lead: ${l.business_name}`, time: l.scraped_at }));
      (newContent || []).forEach((c: Record<string, string>) => items.push({ id: `post-${c.id}`, type: "post", message: `Content updated: ${c.title}`, time: c.updated_at }));
      items.sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime());
      setActivityFeed(items.slice(0, 15));
    } catch (err) {
      console.warn("[analytics] activity feed fetch failed:", err);
    }
  }

  function getDateRange() {
    const now = new Date();
    if (dateRange === "custom" && customStart && customEnd) {
      return { start: new Date(customStart).toISOString(), end: new Date(customEnd).toISOString() };
    }
    const days = dateRange === "7d" ? 7 : dateRange === "90d" ? 90 : 30;
    return { start: new Date(Date.now() - days * 86400000).toISOString(), end: now.toISOString() };
  }

  async function fetchAnalytics(cancelled: { current: boolean } = { current: false }) {
    if (!cancelled.current) setIsLoading(true);
    try {
      const now = new Date();
      const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
      const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString();
      const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0).toISOString();
      const { start: rangeStart } = getDateRange();

      const [
        { count: totalLeads }, { count: leadsThisMonth }, { count: leadsLastMonth },
        { count: totalClients }, { count: activeClients }, { data: clients },
        { count: totalDeals }, { data: deals },
        { count: dmsSent }, { count: replies }, { count: callsBooked }, { count: contentPublished },
        { data: recentLeads }, { data: outreach },
        { data: lastMonthInvoices }, { data: revenueHistoryInvoices },
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
        // Invoice queries for lastMonthMRR and revenueByMonth chart
        supabase.from("invoices").select("amount, paid_at").eq("status", "paid").gte("paid_at", lastMonth).lte("paid_at", lastMonthEnd),
        supabase.from("invoices").select("amount, paid_at").eq("status", "paid").gte("paid_at", new Date(now.getFullYear(), now.getMonth() - 5, 1).toISOString()),
      ]);

      const totalMRR = clients?.reduce((s: number, c: Record<string, number>) => s + (c.mrr || 0), 0) || 0;
      const dealValue = deals?.reduce((s: number, d: Record<string, number>) => s + (d.amount || 0), 0) || 0;
      // lastMonthMRR: cash received from paid invoices in the prior calendar month
      const lastMonthMRR = (lastMonthInvoices || []).reduce((s: number, i: Record<string, number>) => s + (i.amount || 0), 0);

      if (cancelled.current) return;

      setStats({
        totalLeads: totalLeads || 0, leadsThisMonth: leadsThisMonth || 0, leadsLastMonth: leadsLastMonth || 0,
        totalClients: totalClients || 0, activeClients: activeClients || 0,
        totalMRR, lastMonthMRR,
        totalDeals: totalDeals || 0, dealValue,
        dmsSent: dmsSent || 0, replies: replies || 0, callsBooked: callsBooked || 0,
        contentPublished: contentPublished || 0,
      });

      const dayMap: Record<string, number> = {};
      (recentLeads || []).forEach((l: { scraped_at: string }) => {
        const day = new Date(l.scraped_at).toLocaleDateString("en-US", { month: "short", day: "numeric" });
        dayMap[day] = (dayMap[day] || 0) + 1;
      });
      setLeadsByDay(Object.entries(dayMap).map(([date, count]) => ({ date, count })));

      const sourceMap: Record<string, number> = {};
      (recentLeads || []).forEach((l: { source: string }) => {
        sourceMap[l.source || "other"] = (sourceMap[l.source || "other"] || 0) + 1;
      });
      setLeadsBySource(Object.entries(sourceMap).map(([source, count]) => ({ source, count })));

      const indMap: Record<string, number> = {};
      (recentLeads || []).forEach((l: { industry: string }) => {
        indMap[l.industry || "other"] = (indMap[l.industry || "other"] || 0) + 1;
      });
      setLeadsByIndustry(Object.entries(indMap).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([industry, count]) => ({ industry, count })));

      const outMap: Record<string, { sent: number; replies: number }> = {};
      (outreach || []).forEach((o: { sent_at: string; status: string }) => {
        const day = new Date(o.sent_at).toLocaleDateString("en-US", { month: "short", day: "numeric" });
        if (!outMap[day]) outMap[day] = { sent: 0, replies: 0 };
        outMap[day].sent++;
        if (o.status === "replied") outMap[day].replies++;
      });
      setOutreachByDay(Object.entries(outMap).map(([date, v]) => ({ date, ...v })));

      // Build revenueByMonth from invoice payments (past 6 months) + won deals
      const monthMap: Record<string, { mrr: number; deals: number }> = {};
      (revenueHistoryInvoices || []).forEach((inv: Record<string, string | number>) => {
        const month = new Date(String(inv.paid_at)).toLocaleString("en-US", { month: "short", year: "2-digit" });
        if (!monthMap[month]) monthMap[month] = { mrr: 0, deals: 0 };
        monthMap[month].mrr += Number(inv.amount) || 0;
      });
      (deals || []).forEach((deal: Record<string, string | number>) => {
        const month = new Date(String(deal.created_at)).toLocaleString("en-US", { month: "short", year: "2-digit" });
        if (!monthMap[month]) monthMap[month] = { mrr: 0, deals: 0 };
        monthMap[month].deals += Number(deal.amount) || 0;
      });
      setRevenueByMonth(Object.entries(monthMap).map(([month, v]) => ({ month, ...v })));
    } catch (err) {
      console.error("[analytics] fetch failed:", err);
      if (!cancelled.current) {
        setFetchError(err instanceof Error ? err.message : "Failed to load analytics");
      }
    } finally {
      if (!cancelled.current) setIsLoading(false);
    }
  }

  const leadGrowth = stats.leadsLastMonth > 0
    ? Math.round(((stats.leadsThisMonth - stats.leadsLastMonth) / stats.leadsLastMonth) * 100)
    : 0;
  const replyRate = stats.dmsSent > 0 ? Math.round((stats.replies / stats.dmsSent) * 100) : 0;

  // ── Computed features ───────────────────────────────────────────────────
  const revenueForecast = useMemo(() => {
    if (revenueByMonth.length < 2) return [];
    const mrrValues = revenueByMonth.map(r => r.mrr);
    const avgGrowth = mrrValues.length > 1
      ? mrrValues.slice(1).reduce((s, v, i) => s + (v - mrrValues[i]) / (mrrValues[i] || 1), 0) / (mrrValues.length - 1)
      : 0.05;
    const lastMRR = mrrValues[mrrValues.length - 1] || stats.totalMRR;
    const nowForecast = new Date();
    const months = Array.from({ length: 3 }, (_, i) => {
      const d = new Date(nowForecast.getFullYear(), nowForecast.getMonth() + i + 1, 1);
      return d.toLocaleString("en-US", { month: "short" });
    });
    return months.map((month, i) => ({
      month,
      projected: Math.round(lastMRR * Math.pow(1 + avgGrowth, i + 1)),
      conservative: Math.round(lastMRR * Math.pow(1 + avgGrowth * 0.5, i + 1)),
      optimistic: Math.round(lastMRR * Math.pow(1 + avgGrowth * 1.5, i + 1)),
    }));
  }, [revenueByMonth, stats.totalMRR]);

  const churnRiskClients = useMemo((): ChurnClient[] => [], []);

  const platformROI = useMemo((): Array<{ platform: string; spend: number; revenue: number; roi: number; leads: number; cpl: number }> => [], []);

  const contentHeatmap = useMemo(() => {
    const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
    const hours = ["9am", "12pm", "3pm", "6pm", "9pm"];
    return days.map(day => {
      const row: Record<string, string | number> = { day };
      hours.forEach(hour => { row[hour] = 0; });
      return row;
    });
  }, []);

  const hasContentHeatmapData = useMemo(() => {
    const hours = ["9am", "12pm", "3pm", "6pm", "9pm"];
    return contentHeatmap.some(row => hours.some(h => (row[h] as number) > 0));
  }, [contentHeatmap]);

  const funnelData = useMemo(() => [
    { name: "Leads", value: stats.totalLeads || 0, fill: "#FF2D2D" },
    { name: "Contacted", value: stats.dmsSent || 0, fill: "#5B5BE6" },
    { name: "Calls Booked", value: stats.callsBooked || 0, fill: "#FF6B6B" },
    { name: "Proposals", value: 0, fill: "#7C3AED" },
    { name: "Closed Won", value: stats.totalDeals || 0, fill: "#7FE5B8" },
  ], [stats]);

  const goals = useMemo<GoalEntry[]>(() => [
    { label: "Monthly Revenue", current: stats.totalMRR, target: 50000, unit: "$" },
    { label: "New Clients", current: stats.activeClients, target: 25, unit: "" },
    { label: "Leads Generated", current: stats.leadsThisMonth, target: 200, unit: "" },
    { label: "Content Published", current: stats.contentPublished, target: 30, unit: "" },
    { label: "Calls Booked", current: stats.callsBooked, target: 40, unit: "" },
    { label: "Reply Rate", current: replyRate, target: 10, unit: "%" },
  ], [stats.totalMRR, stats.activeClients, stats.leadsThisMonth, stats.contentPublished, stats.callsBooked, replyRate]);

  const teamMembers = useMemo((): TeamMember[] => [], []);

  const clvData = useMemo((): Array<{ name: string; avgCLV: number; avgMonths: number; count: number }> => [], []);

  const benchmarks = useMemo(() => [
    { metric: "Reply Rate", yours: replyRate || 0, industry: 5.0, max: 20 },
    { metric: "Call Book Rate", yours: stats.callsBooked > 0 ? Math.round((stats.callsBooked / (stats.dmsSent || 1)) * 100) : 0, industry: 3.2, max: 15 },
    { metric: "Close Rate", yours: stats.totalDeals > 0 ? Math.round((stats.totalDeals / (stats.callsBooked || 1)) * 100) : 0, industry: 22, max: 50 },
    { metric: "Content Eng.", yours: 0, industry: 3.2, max: 10 },
    { metric: "Retention", yours: 0, industry: 85, max: 100 },
  ], [replyRate, stats]);

  const revenueByService = useMemo((): Array<{ service: string; revenue: number; clients: number }> => [], []);

  const campaignData = useMemo((): Array<{ campaign: string; conversions: number; spend: number; revenue: number; roas: number }> => [], []);

  const monthlyComparison = useMemo(() => {
    const current = { leads: stats.leadsThisMonth, mrr: stats.totalMRR, deals: stats.totalDeals, replies: stats.replies };
    const last = { leads: stats.leadsLastMonth, mrr: stats.lastMonthMRR, deals: 0, replies: 0 };
    const threeAgo = { leads: 0, mrr: 0, deals: 0, replies: 0 };
    return { current, last, threeAgo };
  }, [stats]);

  const handleExport = useCallback(() => {
    const report = {
      generated: new Date().toISOString(),
      summary: stats, leadGrowth, replyRate, revenueByMonth, leadsBySource,
      forecast: revenueForecast, churnRisk: churnRiskClients, platformROI, funnelData, teamMembers,
    };
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `analytics-report-${new Date().toISOString().split("T")[0]}.json`; a.click();
    URL.revokeObjectURL(url);
  }, [stats, leadGrowth, replyRate, revenueByMonth, leadsBySource, revenueForecast, churnRiskClients, platformROI, funnelData, teamMembers]);

  const toggleSection = (section: string) =>
    setExpandedSection(prev => prev === section ? null : section);

  const activityIcon = (type: string) => {
    switch (type) {
      case "lead": return <Zap size={10} style={{ color: "#FF2D2D" }} />;
      case "payment": return <DollarSign size={10} style={{ color: "#7FE5B8" }} />;
      case "post": return <Film size={10} style={{ color: "#FF6B6B" }} />;
      case "deal": return <Trophy size={10} style={{ color: "#7FE5B8" }} />;
      case "call": return <Phone size={10} style={{ color: "#FF6B6B" }} />;
      default: return <Activity size={10} style={{ color: "#6F6D7A" }} />;
    }
  };

  const hasData = stats.totalLeads > 0 || stats.totalMRR > 0 || stats.dmsSent > 0 ||
    stats.totalClients > 0 || stats.totalDeals > 0 || stats.replies > 0 ||
    stats.callsBooked > 0 || stats.contentPublished > 0;

  // ─── Prism color map for stat tiles ─────────────────────────────────────
  const PRISM_TILES = [
    { accent: "#FF2D2D", bar: "from-[#FF2D2D] to-transparent" },   // MRR → emerald
    { accent: "#FF2D2D", bar: "from-[#FF2D2D] to-transparent" },   // Leads → blue
    { accent: "#FF5252", bar: "from-[#FF5252] to-transparent" },   // DMs → cyan
    { accent: "#8B5CF6", bar: "from-[#8B5CF6] to-transparent" },   // Deals → violet
  ] as const;

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <MotionPage className="space-y-4">

      <PageHero
        title="Analytics"
        subtitle="Leads · Revenue · Content ROI"
        icon={<BarChart3 size={28} />}
        gradient="blue"
        actions={
          <div className="flex items-center gap-2">
            {stats.totalMRR > 0 && (
              <motion.span
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                className="hidden sm:flex items-center gap-1 text-[10px] font-semibold px-2.5 py-1 rounded-full bg-[rgba(255,255,255,0.08)] border border-[rgba(255,255,255,0.15)] text-[#FF6B6B]"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-[#FF2D2D] animate-pulse" />
                {formatCurrency(stats.totalMRR)} MRR
              </motion.span>
            )}
            {!isLoading && (
              <span className="hidden md:flex items-center gap-1 text-[10px] text-[#6F6F7A] px-2.5 py-1 rounded-md bg-[rgba(255,255,255,0.03)] border border-[rgba(255,255,255,0.05)]">
                {replyRate}% reply rate
              </span>
            )}
            <button
              onClick={handleExport}
              className="flex items-center gap-1.5 rounded-lg border border-[rgba(255,255,255,0.2)] bg-[rgba(255,255,255,0.06)] px-3 py-1.5 text-xs font-semibold text-[#FF2D2D] hover:bg-[rgba(255,255,255,0.12)] transition-colors duration-150"
            >
              <Download size={13} /> Export
            </button>
          </div>
        }
      />

      {/* ── Loading ──────────────────────────────────────────────────────── */}
      {isLoading && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2.5">
            {Array.from({ length: 6 }).map((_, i) => <StatSkeleton key={i} />)}
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <CardSkeleton />
            <CardSkeleton />
          </div>
        </div>
      )}

      {/* ── Error ────────────────────────────────────────────────────────── */}
      {!isLoading && fetchError !== null && (
        <div className="flex flex-col items-center justify-center py-16 text-center space-y-3">
          <p className="text-sm text-danger font-medium">Could not load analytics</p>
          <p className="text-xs text-muted max-w-xs">{fetchError}</p>
          <button
            className="btn-secondary text-xs px-4 py-2"
            onClick={() => {
              setFetchError(null);
              const cancelled = { current: false };
              fetchAnalytics(cancelled).catch((err: unknown) => {
                if (!cancelled.current) console.error("[analytics] retry failed:", err);
              });
            }}
          >
            Retry
          </button>
        </div>
      )}

      {/* ── Empty ────────────────────────────────────────────────────────── */}
      {!isLoading && fetchError === null && !hasData && (
        <EmptyState
          type="no-analytics"
          size={160}
          title="No analytics yet"
          description="Start by adding your first client to see leads, revenue, and content ROI here."
          action={
            <Link href="/dashboard/clients" className="btn-primary text-xs px-4 py-2">
              Add your first client
            </Link>
          }
        />
      )}

      {/* ══════════════════════════════════════════════════════════════════ */}
      {/* Main dashboard                                                     */}
      {/* ══════════════════════════════════════════════════════════════════ */}
      {!isLoading && fetchError === null && hasData && (
        <>

          {/* ── Date range + export ──────────────────────────────────────── */}
          <div className="flex items-center justify-end flex-wrap gap-2.5">
            <div className="flex items-center gap-0.5 bg-[#0E0D14] rounded-lg p-0.5 border border-[rgba(255,255,255,0.06)]">
              {(["7d", "30d", "90d", "custom"] as const).map(r => (
                <button
                  key={r}
                  onClick={() => setDateRange(r)}
                  className={`px-3 py-1 text-[10px] rounded-md transition-colors duration-150 ${
                    dateRange === r
                      ? "bg-[#FF2D2D] text-white font-semibold"
                      : "text-[#6F6D7A] hover:text-[#F5F4F1]"
                  }`}
                >
                  {r === "custom" ? "Custom" : r}
                </button>
              ))}
            </div>
            {dateRange === "custom" && (
              <div className="flex items-center gap-1.5">
                <input type="date" value={customStart} onChange={e => setCustomStart(e.target.value)}
                  className="input text-[10px] px-2 py-1 w-28" aria-label="Start date" />
                <span className="text-[#4F4D58] text-[10px]">–</span>
                <input type="date" value={customEnd} onChange={e => setCustomEnd(e.target.value)}
                  className="input text-[10px] px-2 py-1 w-28" aria-label="End date" />
              </div>
            )}
            <button
              onClick={handleExport}
              className="flex items-center gap-1.5 text-[10px] text-[#9F9DAA] hover:text-[#F5F4F1] transition-colors border border-[rgba(255,255,255,0.06)] px-3 py-1.5 rounded-lg"
            >
              <Download size={11} /> Export
            </button>
          </div>

          {/* ── Zone 1: Hero KPI ─────────────────────────────────────────── */}
          <div className="grid grid-cols-1 lg:grid-cols-[3fr_1fr] gap-4">

            {/* Left — MRR hero with prism top bar */}
            <motion.div
              className="relative  border border-[rgba(255,255,255,0.16)] bg-[rgba(255,255,255,0.035)] px-8 py-8 overflow-hidden"
              style={{ backdropFilter: "blur(16px)" }}
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.48, ease: [0.22, 1, 0.36, 1] }}
            >
              {/* Prism rainbow top bar */}
              <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-[#FF2D2D] via-[#FF2D2D] via-[#FF5252] via-[#8B5CF6] to-[#F59E0B]" />
              {/* Ambient glow */}
              <div className="pointer-events-none absolute -right-20 -top-20 w-56 h-56 rounded-full bg-[#FF2D2D] opacity-[0.06] blur-3xl" />
              <div className="pointer-events-none absolute -left-10 -bottom-10 w-40 h-40 rounded-full bg-[#FF2D2D] opacity-[0.04] blur-2xl" />

              <p className="text-[9px] font-medium uppercase tracking-[0.2em] text-[#6F6D7A] mb-3">
                Monthly Recurring Revenue
              </p>
              <p
                className="font-display font-bold leading-none text-[#FF2D2D]"
                style={{ fontSize: "clamp(40px,6vw,68px)", letterSpacing: "-0.04em", fontVariantNumeric: "tabular-nums" }}
              >
                {formatCurrency(stats.totalMRR)}
              </p>
              <div className="mt-4 flex items-center gap-4">
                <span className="text-[11px] text-[#6F6D7A]">
                  <span className="text-[#F5F4F1] font-medium [font-variant-numeric:tabular-nums]">{stats.activeClients}</span>{" "}
                  active client{stats.activeClients !== 1 ? "s" : ""}
                </span>
                {stats.contentPublished > 0 && (
                  <span className="text-[11px] text-[#6F6D7A]">
                    <span className="text-[#F5F4F1] font-medium [font-variant-numeric:tabular-nums]">{stats.contentPublished}</span>{" "}
                    posts published
                  </span>
                )}
              </div>
            </motion.div>

            {/* Right — 4 prism stat tiles with per-tile color accent bar */}
            <div className="grid grid-cols-2 lg:grid-cols-1 gap-3">
              {[
                { label: "Total Leads", value: stats.totalLeads.toLocaleString(), sub: leadGrowth !== 0 ? `${leadGrowth > 0 ? "+" : ""}${leadGrowth}% vs last mo.` : "—", subOk: leadGrowth >= 0 },
                { label: "DMs Sent", value: stats.dmsSent.toLocaleString(), sub: `${replyRate}% reply rate`, subOk: replyRate >= 5 },
                { label: "Calls Booked", value: stats.callsBooked.toLocaleString(), sub: "this period", subOk: true },
                { label: "Deals Won", value: stats.totalDeals.toLocaleString(), sub: formatCurrency(stats.dealValue) + " closed", subOk: true },
              ].map((cell, i) => {
                const tile = PRISM_TILES[i];
                return (
                  <motion.div
                    key={cell.label}
                    className="relative rounded-xl bg-[rgba(255,255,255,0.035)] border border-[rgba(255,255,255,0.07)] px-4 py-3 overflow-hidden"
                    style={{ backdropFilter: "blur(12px)" }}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.38, delay: 0.07 * (i + 1), ease: [0.22, 1, 0.36, 1] }}
                    whileHover={{ y: -2, borderColor: "rgba(255,255,255,0.14)", transition: { duration: 0.2 } }}
                  >
                    {/* Bottom accent bar (prism color per tile) */}
                    <div className={`absolute bottom-0 left-0 right-0 h-[2px] bg-gradient-to-r ${tile.bar} opacity-70`} />
                    <p className="text-[9px] font-medium uppercase tracking-[0.16em] text-[#6F6D7A]">{cell.label}</p>
                    <p
                      className="font-display text-xl font-bold tracking-[-0.02em] mt-1"
                      style={{ color: tile.accent, fontVariantNumeric: "tabular-nums" }}
                    >
                      {cell.value}
                    </p>
                    <p className="text-[10px] mt-0.5" style={{ color: cell.subOk ? "#6F6D7A" : "#F26063" }}>
                      {cell.sub}
                    </p>
                  </motion.div>
                );
              })}
            </div>
          </div>

          {/* ── Zone 2: Lead velocity + Lead sources ─────────────────────── */}
          <div className="grid grid-cols-1 lg:grid-cols-[7fr_5fr] gap-4">

            {/* Lead velocity area chart */}
            <div className=" border border-[rgba(255,255,255,0.08)] px-6 pt-5 pb-4" style={{ background: "rgba(255,255,255,0.025)", backdropFilter: "blur(12px)" }}>
              <div className="flex items-start justify-between mb-4">
                <div>
                  <p className="text-[9px] font-medium uppercase tracking-[0.2em] text-[#6F6D7A]">Acquisition</p>
                  <h2 className="font-display text-[15px] font-semibold text-[#F5F4F1] tracking-[-0.02em] mt-0.5">
                    Lead Velocity
                    <span className="ml-2 text-[10px] font-normal text-[#4F4D58]">· {dateRange === "custom" ? "Custom" : dateRange}</span>
                  </h2>
                </div>
              </div>
              {leadsByDay.length === 0 ? (
                <div className="h-48 flex items-center justify-center text-[11px] text-[#4F4D58]">
                  No lead data for this period
                </div>
              ) : (
                <div className="h-48">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={leadsByDay} margin={{ top: 4, right: 4, left: -24, bottom: 0 }}>
                      <defs>
                        <linearGradient id="limeAreaGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#FF2D2D" stopOpacity={0.15} />
                          <stop offset="85%" stopColor="#FF2D2D" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="2 6" stroke="rgba(255,255,255,0.04)" vertical={false} />
                      <XAxis dataKey="date" tick={{ fontSize: 9, fill: "#3A3840" }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize: 9, fill: "#3A3840" }} axisLine={false} tickLine={false} width={28} />
                      <Tooltip {...TT} cursor={{ stroke: "rgba(255,255,255,0.15)", strokeDasharray: "2 4" }} />
                      <Area
                        type="monotone" dataKey="count" name="Leads"
                        stroke="#FF2D2D" strokeWidth={1.5}
                        fill="url(#limeAreaGrad)"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>

            {/* Lead sources */}
            <div className=" border border-[rgba(255,255,255,0.08)] px-6 pt-5 pb-5" style={{ background: "rgba(255,255,255,0.025)", backdropFilter: "blur(12px)" }}>
              <p className="text-[9px] font-medium uppercase tracking-[0.2em] text-[#6F6D7A]">Channels</p>
              <h2 className="font-display text-[15px] font-semibold text-[#F5F4F1] tracking-[-0.02em] mt-0.5 mb-5">Lead Sources</h2>
              {leadsBySource.length === 0 ? (
                <div className="flex items-center justify-center h-40 text-[11px] text-[#4F4D58]">
                  No source data yet
                </div>
              ) : (
                <div className="space-y-3">
                  {[...leadsBySource].sort((a, b) => b.count - a.count).slice(0, 7).map((s, i) => {
                    const maxCount = [...leadsBySource].sort((a, b) => b.count - a.count)[0].count;
                    const pct = maxCount > 0 ? (s.count / maxCount) * 100 : 0;
                    return (
                      <div key={s.source} className="flex items-center gap-3">
                        <span className="text-[10px] text-[#9F9DAA] w-20 text-right shrink-0 capitalize truncate">
                          {s.source.replace(/_/g, " ")}
                        </span>
                        <div className="flex-1 h-1.5 bg-[rgba(255,255,255,0.05)] rounded-full overflow-hidden">
                          <motion.div
                            className="h-full rounded-full"
                            style={{ background: CHART_COLORS[i % CHART_COLORS.length] }}
                            initial={{ width: 0 }}
                            animate={{ width: `${pct}%` }}
                            transition={{ duration: 0.6, delay: i * 0.06, ease: [0.22, 1, 0.36, 1] }}
                          />
                        </div>
                        <span
                          className="text-[10px] font-bold text-[#F5F4F1] w-5 text-right shrink-0"
                          style={{ fontVariantNumeric: "tabular-nums" }}
                        >
                          {s.count}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* ── Zone 3: Funnel + Outreach ─────────────────────────────────── */}
          <div className="grid grid-cols-1 lg:grid-cols-[5fr_7fr] gap-4">

            {/* Conversion funnel */}
            <div className=" border border-[rgba(255,255,255,0.08)] px-6 pt-5 pb-5" style={{ background: "rgba(255,255,255,0.025)", backdropFilter: "blur(12px)" }}>
              <p className="text-[9px] font-medium uppercase tracking-[0.2em] text-[#6F6D7A]">Sales Pipeline</p>
              <h2 className="font-display text-[15px] font-semibold text-[#F5F4F1] tracking-[-0.02em] mt-0.5 mb-5">Conversion Funnel</h2>
              <div className="space-y-3">
                {funnelData.map((stage, i) => {
                  const maxVal = funnelData[0].value;
                  const pct = maxVal > 0 ? (stage.value / maxVal) * 100 : 0;
                  const convRate = i > 0 && funnelData[i - 1].value > 0
                    ? Math.round((stage.value / funnelData[i - 1].value) * 100)
                    : null;
                  return (
                    <div key={stage.name}>
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-[10px] text-[#9F9DAA]">{stage.name}</span>
                        <div className="flex items-center gap-2.5">
                          <span
                            className="text-[11px] font-bold text-[#F5F4F1]"
                            style={{ fontVariantNumeric: "tabular-nums" }}
                          >
                            {stage.value.toLocaleString()}
                          </span>
                          {convRate !== null && (
                            <span className="text-[9px] text-[#4F4D58]" style={{ fontVariantNumeric: "tabular-nums" }}>
                              {convRate}%
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="h-1.5 bg-[rgba(255,255,255,0.05)] rounded-full overflow-hidden">
                        <motion.div
                          className="h-full rounded-full"
                          style={{ background: stage.fill }}
                          initial={{ width: 0 }}
                          animate={{ width: `${Math.max(pct, stage.value > 0 ? 3 : 0)}%` }}
                          transition={{ duration: 0.7, delay: i * 0.07, ease: [0.22, 1, 0.36, 1] }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="mt-5 pt-4 border-t border-[rgba(255,255,255,0.05)] flex items-baseline justify-between">
                <span className="text-[10px] text-[#6F6D7A]">Overall conversion</span>
                <span
                  className="font-display text-xl font-bold text-[#F5F4F1] tracking-[-0.02em]"
                  style={{ fontVariantNumeric: "tabular-nums" }}
                >
                  {funnelData[0].value > 0
                    ? ((funnelData[funnelData.length - 1].value / funnelData[0].value) * 100).toFixed(1)
                    : "0"}%
                </span>
              </div>
            </div>

            {/* Outreach performance */}
            <div className=" border border-[rgba(255,255,255,0.08)] px-6 pt-5 pb-4" style={{ background: "rgba(255,255,255,0.025)", backdropFilter: "blur(12px)" }}>
              <p className="text-[9px] font-medium uppercase tracking-[0.2em] text-[#6F6D7A]">Engagement</p>
              <h2 className="font-display text-[15px] font-semibold text-[#F5F4F1] tracking-[-0.02em] mt-0.5 mb-4">Outreach Performance</h2>
              {outreachByDay.length === 0 ? (
                <div className="h-48 flex items-center justify-center text-[11px] text-[#4F4D58]">
                  No outreach data for this period
                </div>
              ) : (
                <div className="h-48">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={outreachByDay} margin={{ top: 4, right: 4, left: -24, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="2 6" stroke="rgba(255,255,255,0.04)" vertical={false} />
                      <XAxis dataKey="date" tick={{ fontSize: 9, fill: "#3A3840" }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize: 9, fill: "#3A3840" }} axisLine={false} tickLine={false} width={28} />
                      <Tooltip {...TT} />
                      <Line type="monotone" dataKey="sent" stroke="#FF2D2D" strokeWidth={1.5} dot={false} name="Sent" />
                      <Line type="monotone" dataKey="replies" stroke="#7FE5B8" strokeWidth={1.5} dot={false} name="Replies" />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}
              <div className="flex items-center gap-5 mt-3">
                <div className="flex items-center gap-1.5">
                  <div className="w-4 h-px bg-[#FF2D2D]" />
                  <span className="text-[9px] text-[#6F6D7A]">Sent</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-4 h-px bg-[#7FE5B8]" />
                  <span className="text-[9px] text-[#6F6D7A]">Replies</span>
                </div>
              </div>
            </div>
          </div>

          {/* ── Zone 4: Industries + Goals + Benchmarks (3-col dense) ──────── */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

            {/* Top industries */}
            <div className=" border border-[rgba(255,255,255,0.08)] px-6 pt-5 pb-5" style={{ background: "rgba(255,255,255,0.025)", backdropFilter: "blur(12px)" }}>
              <p className="text-[9px] font-medium uppercase tracking-[0.2em] text-[#6F6D7A]">Verticals</p>
              <h2 className="font-display text-[15px] font-semibold text-[#F5F4F1] tracking-[-0.02em] mt-0.5 mb-5">Top Industries</h2>
              {leadsByIndustry.length === 0 ? (
                <p className="text-[11px] text-[#4F4D58] py-4">No industry data yet</p>
              ) : (
                <div className="space-y-2.5">
                  {leadsByIndustry.slice(0, 6).map((ind, i) => {
                    const maxInd = leadsByIndustry[0].count;
                    const pct = maxInd > 0 ? (ind.count / maxInd) * 100 : 0;
                    return (
                      <div key={ind.industry} className="flex items-center gap-2.5">
                        <span
                          className="text-[9px] text-[#3A3840] w-3 shrink-0 text-right"
                          style={{ fontVariantNumeric: "tabular-nums" }}
                        >
                          {i + 1}
                        </span>
                        <span className="text-[10px] text-[#9F9DAA] w-20 shrink-0 truncate capitalize">
                          {ind.industry.replace(/_/g, " ")}
                        </span>
                        <div className="flex-1 h-1 bg-[rgba(255,255,255,0.05)] rounded-full overflow-hidden">
                          <motion.div
                            className="h-full rounded-full bg-[#FF6B6B]"
                            initial={{ width: 0 }}
                            animate={{ width: `${pct}%` }}
                            transition={{ duration: 0.6, delay: i * 0.05, ease: [0.22, 1, 0.36, 1] }}
                          />
                        </div>
                        <span
                          className="text-[10px] font-bold text-[#F5F4F1] w-4 shrink-0 text-right"
                          style={{ fontVariantNumeric: "tabular-nums" }}
                        >
                          {ind.count}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Monthly goals */}
            <div className=" border border-[rgba(255,255,255,0.08)] px-6 pt-5 pb-5" style={{ background: "rgba(255,255,255,0.025)", backdropFilter: "blur(12px)" }}>
              <p className="text-[9px] font-medium uppercase tracking-[0.2em] text-[#6F6D7A]">Progress</p>
              <h2 className="font-display text-[15px] font-semibold text-[#F5F4F1] tracking-[-0.02em] mt-0.5 mb-5">Monthly Goals</h2>
              <div className="space-y-3.5">
                {goals.map(goal => {
                  const pct = goal.target > 0 ? Math.min((goal.current / goal.target) * 100, 100) : 0;
                  const barColor = pct >= 100 ? "#7FE5B8" : pct >= 70 ? "#FF2D2D" : pct >= 40 ? "#FF6B6B" : "#4F4D58";
                  return (
                    <div key={goal.label}>
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-[10px] text-[#9F9DAA]">{goal.label}</span>
                        <span
                          className="text-[10px] font-mono"
                          style={{ color: pct >= 70 ? "#7FE5B8" : "#4F4D58", fontVariantNumeric: "tabular-nums" }}
                        >
                          {Math.round(pct)}%
                        </span>
                      </div>
                      <div className="h-1 bg-[rgba(255,255,255,0.05)] rounded-full overflow-hidden">
                        <motion.div
                          className="h-full rounded-full"
                          style={{ background: barColor }}
                          initial={{ width: 0 }}
                          animate={{ width: `${pct}%` }}
                          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Benchmarks */}
            <div className=" border border-[rgba(255,255,255,0.08)] px-6 pt-5 pb-5" style={{ background: "rgba(255,255,255,0.025)", backdropFilter: "blur(12px)" }}>
              <p className="text-[9px] font-medium uppercase tracking-[0.2em] text-[#6F6D7A]">vs Industry</p>
              <h2 className="font-display text-[15px] font-semibold text-[#F5F4F1] tracking-[-0.02em] mt-0.5 mb-5">Benchmarks</h2>
              <div className="space-y-3">
                {benchmarks.map(b => {
                  const isAbove = b.yours >= b.industry;
                  const yourPct = Math.min((b.yours / b.max) * 100, 100);
                  const indPct = Math.min((b.industry / b.max) * 100, 100);
                  return (
                    <div key={b.metric} className="flex items-center gap-2.5">
                      <span className="text-[10px] text-[#6F6D7A] w-24 shrink-0 truncate">{b.metric}</span>
                      <div className="flex-1 relative h-1.5 bg-[rgba(255,255,255,0.05)] rounded-full overflow-hidden">
                        {/* Industry avg */}
                        <div
                          className="absolute h-full rounded-full bg-[rgba(255,255,255,0.1)]"
                          style={{ width: `${indPct}%` }}
                        />
                        {/* Your score */}
                        <motion.div
                          className="absolute h-full rounded-full"
                          style={{ background: isAbove ? "#FF2D2D" : "#F26063" }}
                          initial={{ width: 0 }}
                          animate={{ width: `${yourPct}%` }}
                          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
                        />
                      </div>
                      <span
                        className="text-[9px] font-mono w-7 text-right shrink-0"
                        style={{ color: isAbove ? "#FF2D2D" : "#F26063", fontVariantNumeric: "tabular-nums" }}
                      >
                        {b.yours}%
                      </span>
                    </div>
                  );
                })}
              </div>
              <div className="flex items-center gap-3 mt-4 pt-3 border-t border-[rgba(255,255,255,0.04)]">
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-1.5 rounded-full bg-[rgba(255,255,255,0.1)]" />
                  <span className="text-[9px] text-[#4F4D58]">Industry avg</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-1.5 rounded-full bg-[#FF2D2D]" />
                  <span className="text-[9px] text-[#4F4D58]">Yours</span>
                </div>
              </div>
            </div>
          </div>

          {/* ── Zone 5: Scorecard strip (prism glass, staggered entrance) ── */}
          <motion.div
            className="relative  border border-[rgba(255,255,255,0.1)] overflow-hidden"
            style={{ background: "rgba(255,255,255,0.035)", backdropFilter: "blur(16px)" }}
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.44, ease: [0.22, 1, 0.36, 1] }}
          >
            {/* Prism top bar */}
            <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-[#FF2D2D] via-[#FF2D2D] via-[#FF5252] via-[#8B5CF6] to-[#F59E0B]" />
            <div className="grid grid-cols-2 md:grid-cols-4 md:divide-x divide-[rgba(255,255,255,0.08)]">
              {[
                { label: "Revenue Closed", value: formatCurrency(stats.dealValue), sub: `${stats.totalDeals} deal${stats.totalDeals !== 1 ? "s" : ""} won`, color: "#FF2D2D" },
                { label: "Lead Growth", value: `${leadGrowth >= 0 ? "+" : ""}${leadGrowth}%`, sub: "vs last month", color: leadGrowth >= 0 ? "#FF2D2D" : "#F26063" },
                { label: "Reply Rate", value: `${replyRate}%`, sub: `${stats.dmsSent.toLocaleString()} DMs sent`, color: "#FF5252" },
                { label: "Active Clients", value: String(stats.activeClients), sub: `${formatCurrency(stats.totalMRR)} MRR`, color: "#8B5CF6" },
              ].map((cell, i) => (
                <motion.div
                  key={cell.label}
                  className="px-6 py-5 flex flex-col gap-1.5"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.36, delay: 0.06 * i, ease: [0.22, 1, 0.36, 1] }}
                >
                  <span className="text-[9px] font-medium uppercase tracking-[0.18em] text-[#6F6D7A]">{cell.label}</span>
                  <span
                    className="font-display text-2xl font-bold tracking-[-0.03em] font-mono"
                    style={{ color: cell.color, fontVariantNumeric: "tabular-nums" }}
                  >
                    {cell.value}
                  </span>
                  <span className="text-[10px] text-[#6F6D7A]">{cell.sub}</span>
                </motion.div>
              ))}
            </div>
          </motion.div>

          {/* ── Zone 6: Real-time activity feed ──────────────────────────── */}
          <div className=" border border-[rgba(255,255,255,0.08)] px-6 pt-5 pb-5" style={{ background: "rgba(255,255,255,0.025)", backdropFilter: "blur(12px)" }}>
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-[9px] font-medium uppercase tracking-[0.2em] text-[#6F6D7A]">Live Stream</p>
                <h2 className="font-display text-[15px] font-semibold text-[#F5F4F1] tracking-[-0.02em] mt-0.5">
                  Real-time Activity
                </h2>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-[#7FE5B8] animate-pulse" />
                <span className="text-[9px] text-[#7FE5B8] font-semibold tracking-[0.1em]">LIVE</span>
              </div>
            </div>
            <div ref={activityRef} className="max-h-44 overflow-y-auto space-y-0.5">
              {activityFeed.length > 0 ? activityFeed.map((item, idx) => (
                <motion.div
                  key={item.id}
                  className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-[rgba(255,255,255,0.03)] transition-colors duration-100"
                  initial={{ opacity: 0, x: -4 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.2, delay: idx * 0.025 }}
                >
                  <div className="w-4 h-4 flex items-center justify-center shrink-0">
                    {activityIcon(item.type)}
                  </div>
                  <p className="text-[11px] text-[#9F9DAA] flex-1 min-w-0 truncate">{item.message}</p>
                  <span
                    className="text-[9px] text-[#4F4D58] shrink-0"
                    style={{ fontVariantNumeric: "tabular-nums" }}
                  >
                    {formatRelativeTime(item.time)}
                  </span>
                </motion.div>
              )) : (
                <div className="flex flex-col items-center justify-center py-8 gap-2 text-center">
                  <Activity size={16} className="text-[#3A3840]" />
                  <p className="text-[11px] text-[#4F4D58]">No recent activity. New events appear here in real-time.</p>
                </div>
              )}
            </div>
          </div>

          {/* ─────────────────────────────────────────────────────────────── */}
          {/* Collapsible sections — advanced / data-dependent analytics     */}
          {/* ─────────────────────────────────────────────────────────────── */}

          {/* Revenue Forecast */}
          <Accordion
            id="forecast"
            label="Revenue Forecast"
            icon={<TrendingUp size={13} />}
            badge={
              revenueForecast.length > 0 ? (
                <span className="text-[9px] px-2 py-0.5 rounded-full bg-[rgba(255,255,255,0.12)] text-[#FF2D2D]">
                  {formatCurrency(revenueForecast[0]?.projected || 0)} next mo.
                </span>
              ) : undefined
            }
            expanded={expandedSection === "forecast"}
            onToggle={() => toggleSection("forecast")}
          >
            <div className="mt-4">
              {revenueByMonth.length < 2 ? (
                <p className="text-[11px] text-[#6F6D7A] py-6 text-center">
                  Not enough revenue history to forecast — connect billing data.
                </p>
              ) : (
                <>
                  <div className="h-52">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart
                        data={[
                          ...revenueByMonth.map(r => ({ month: r.month, projected: r.mrr, conservative: r.mrr, optimistic: r.mrr })),
                          ...revenueForecast,
                        ]}
                        margin={{ top: 4, right: 4, left: -24, bottom: 0 }}
                      >
                        <defs>
                          <linearGradient id="forecastGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#FF2D2D" stopOpacity={0.15} />
                            <stop offset="85%" stopColor="#FF2D2D" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="2 6" stroke="rgba(255,255,255,0.04)" vertical={false} />
                        <XAxis dataKey="month" tick={{ fontSize: 9, fill: "#3A3840" }} axisLine={false} tickLine={false} />
                        <YAxis tick={{ fontSize: 9, fill: "#3A3840" }} axisLine={false} tickLine={false} width={32} tickFormatter={v => `$${(v / 1000).toFixed(0)}k`} />
                        <Tooltip {...TT} formatter={(v) => formatCurrency(Number(v) || 0)} />
                        <Area type="monotone" dataKey="optimistic" stroke="#7FE5B8" fill="none" strokeWidth={1} strokeDasharray="3 4" name="Optimistic" />
                        <Area type="monotone" dataKey="projected" stroke="#FF2D2D" fill="url(#forecastGrad)" strokeWidth={1.5} name="Projected" />
                        <Area type="monotone" dataKey="conservative" stroke="#FF2D2D" fill="none" strokeWidth={1} strokeDasharray="3 4" name="Conservative" />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                  {revenueForecast.length > 0 && (
                    <div className="grid grid-cols-3 mt-4 pt-4 border-t border-[rgba(255,255,255,0.04)]">
                      {revenueForecast.map((f, i) => (
                        <div
                          key={f.month}
                          className={`${i > 0 ? "border-l border-[rgba(255,255,255,0.04)] pl-4" : ""} ${i < 2 ? "pr-4" : ""}`}
                        >
                          <p className="text-[9px] text-[#6F6D7A] uppercase tracking-wider">{f.month}</p>
                          <p
                            className="font-display text-lg font-bold text-[#F5F4F1] mt-1"
                            style={{ fontVariantNumeric: "tabular-nums" }}
                          >
                            {formatCurrency(f.projected)}
                          </p>
                          <p className="text-[9px] text-[#4F4D58] mt-0.5">
                            {formatCurrency(f.conservative)} — {formatCurrency(f.optimistic)}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          </Accordion>

          {/* Platform ROI */}
          <Accordion
            id="roi"
            label="Platform ROI"
            icon={<Target size={13} />}
            expanded={expandedSection === "roi"}
            onToggle={() => toggleSection("roi")}
          >
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-[rgba(255,255,255,0.05)]">
                    {["Platform", "Spend", "Revenue", "ROI", "CPL"].map((h, i) => (
                      <th
                        key={h}
                        className={`pb-2.5 text-[9px] text-[#6F6D7A] font-medium uppercase tracking-wider ${i === 0 ? "text-left" : "text-right"}`}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {platformROI.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-8 text-center" style={{ background: "none" }}>
                        <p className="text-[11px] text-[#6F6D7A]">No ad platform data yet</p>
                        <Link href="/dashboard/integrations" className="mt-2 inline-flex items-center gap-1 text-[10px] font-semibold text-[#FF2D2D] hover:opacity-80 transition-opacity">
                          Connect platforms <ArrowUp size={9} className="rotate-45" />
                        </Link>
                      </td>
                    </tr>
                  ) : platformROI.map(p => (
                    <tr key={p.platform} className="border-b border-[rgba(255,255,255,0.04)] hover:bg-[rgba(255,255,255,0.03)] transition-colors group">

                      <td className="py-3 font-medium text-[#F5F4F1]">{p.platform}</td>
                      <td className="py-3 text-right text-[#9F9DAA]" style={{ fontVariantNumeric: "tabular-nums" }}>{formatCurrency(p.spend)}</td>
                      <td className="py-3 text-right text-[#7FE5B8] font-medium" style={{ fontVariantNumeric: "tabular-nums" }}>{formatCurrency(p.revenue)}</td>
                      <td className="py-3 text-right">
                        <span
                          className="text-[10px] font-bold"
                          style={{ color: p.roi > 200 ? "#7FE5B8" : p.roi > 100 ? "#FF2D2D" : "#F26063", fontVariantNumeric: "tabular-nums" }}
                        >
                          {p.roi}%
                        </span>
                      </td>
                      <td className="py-3 text-right text-[#9F9DAA]" style={{ fontVariantNumeric: "tabular-nums" }}>{formatCurrency(p.cpl)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Accordion>

          {/* Churn Risk */}
          <Accordion
            id="churn"
            label="Churn Risk"
            icon={<AlertTriangle size={13} />}
            expanded={expandedSection === "churn"}
            onToggle={() => toggleSection("churn")}
          >
            <div className="mt-4 space-y-2">
              {churnRiskClients.length === 0 ? (
                <div className="flex flex-col items-center gap-2 py-6 text-center">
                  <CheckCircle size={16} className="text-[#7FE5B8]/40" />
                  <p className="text-[11px] text-[#9F9DAA]">All clients healthy</p>
                  <p className="text-[9px] text-[#4F4D58] max-w-[200px] mx-auto">No churn signals detected. At-risk clients appear here when engagement drops.</p>
                </div>
              ) : churnRiskClients.map(client => (
                <div key={client.name} className="flex items-center gap-3 p-3 rounded-xl bg-[rgba(255,255,255,0.03)] border border-[rgba(255,255,255,0.06)]">
                  <div className={`w-2 h-2 rounded-full shrink-0 ${client.risk === "high" ? "bg-[#F26063]" : client.risk === "medium" ? "bg-[#FFC062]" : "bg-[#7FE5B8]"}`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-[#F5F4F1] truncate">{client.name}</p>
                    <p className="text-[9px] text-[#6F6D7A]">{client.reason}</p>
                  </div>
                  <span
                    className="text-[10px] font-bold shrink-0"
                    style={{ color: client.risk === "high" ? "#F26063" : client.risk === "medium" ? "#FFC062" : "#7FE5B8", fontVariantNumeric: "tabular-nums" }}
                  >
                    {client.score}%
                  </span>
                </div>
              ))}
            </div>
          </Accordion>

          {/* Monthly Trends */}
          <Accordion
            id="monthly"
            label="Monthly Trends"
            icon={<Calendar size={13} />}
            expanded={expandedSection === "monthly"}
            onToggle={() => toggleSection("monthly")}
          >
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-[rgba(255,255,255,0.05)]">
                    {["Metric", "3 mo. ago", "Last month", "This month", "Trend"].map((h, i) => (
                      <th
                        key={h}
                        className={`pb-2.5 text-[9px] text-[#6F6D7A] font-medium uppercase tracking-wider ${i === 0 ? "text-left" : "text-right"}`}
                      >
                        {h}
                      </th>
                    ))}
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
                      <tr key={row.label} className="border-b border-[rgba(255,255,255,0.04)] hover:bg-[rgba(255,255,255,0.03)] transition-colors">
                        <td className="py-3 font-medium text-[#F5F4F1]">{row.label}</td>
                        <td className="py-3 text-right text-[#4F4D58]" style={{ fontVariantNumeric: "tabular-nums" }}>
                          {row.isCurrency ? formatCurrency(row.three) : row.three}
                        </td>
                        <td className="py-3 text-right text-[#9F9DAA]" style={{ fontVariantNumeric: "tabular-nums" }}>
                          {row.isCurrency ? formatCurrency(row.last) : row.last}
                        </td>
                        <td className="py-3 text-right font-bold text-[#F5F4F1]" style={{ fontVariantNumeric: "tabular-nums" }}>
                          {row.isCurrency ? formatCurrency(row.current) : row.current}
                        </td>
                        <td className="py-3 text-right">
                          <span
                            className="text-[10px] font-mono font-bold"
                            style={{ color: growth >= 0 ? "#7FE5B8" : "#F26063", fontVariantNumeric: "tabular-nums" }}
                          >
                            {growth >= 0 ? "+" : ""}{growth}%
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Accordion>

          {/* Team Leaderboard */}
          <Accordion
            id="leaderboard"
            label="Team Leaderboard"
            icon={<Trophy size={13} />}
            expanded={expandedSection === "leaderboard"}
            onToggle={() => toggleSection("leaderboard")}
          >
            <div className="mt-4 space-y-2">
              {teamMembers.length === 0 ? (
                <div className="flex flex-col items-center gap-2 py-6 text-center">
                  <Trophy size={16} className="text-[#3A3840]" />
                  <p className="text-[11px] text-[#9F9DAA]">No team activity yet</p>
                  <Link href="/dashboard/settings/team" className="mt-1 inline-flex items-center gap-1 text-[10px] font-semibold text-[#FF2D2D] hover:opacity-80 transition-opacity">
                    Invite team <ArrowUp size={9} className="rotate-45" />
                  </Link>
                </div>
              ) : teamMembers.map((member, i) => (
                <div key={member.name} className="flex items-center gap-3 p-3 rounded-xl bg-[rgba(255,255,255,0.03)] border border-[rgba(255,255,255,0.06)]">
                  <span className="text-[9px] font-mono text-[#4F4D58] w-4 shrink-0" style={{ fontVariantNumeric: "tabular-nums" }}>
                    {i + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <p className="text-xs font-medium text-[#F5F4F1]">{member.name}</p>
                      {i === 0 && <Star size={9} className="text-[#FF2D2D]" />}
                    </div>
                    <p className="text-[9px] text-[#6F6D7A]">{member.leads} leads · {member.deals} deals · {member.calls} calls</p>
                  </div>
                  <p className="text-xs font-bold text-[#FF2D2D] shrink-0" style={{ fontVariantNumeric: "tabular-nums" }}>
                    {formatCurrency(member.revenue)}
                  </p>
                </div>
              ))}
            </div>
          </Accordion>

          {/* Content Heatmap */}
          {hasContentHeatmapData && (
            <Accordion
              id="heatmap"
              label="Content Heatmap"
              icon={<Flame size={13} />}
              expanded={expandedSection === "heatmap"}
              onToggle={() => toggleSection("heatmap")}
            >
              <div className="mt-4 overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr>
                      <th className="text-[9px] text-[#6F6D7A] font-medium py-1 text-left w-12" />
                      {["9am", "12pm", "3pm", "6pm", "9pm"].map(h => (
                        <th key={h} className="text-[9px] text-[#6F6D7A] font-medium py-1 text-center">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {contentHeatmap.map(row => (
                      <tr key={row.day as string}>
                        <td className="text-[9px] text-[#6F6D7A] py-0.5 font-medium">{row.day as string}</td>
                        {["9am", "12pm", "3pm", "6pm", "9pm"].map(h => {
                          const val = row[h] as number;
                          const intensity = val / 100;
                          return (
                            <td key={h} className="py-0.5 px-0.5">
                              <div
                                className="h-7 rounded-md flex items-center justify-center text-[9px] font-bold transition-all hover:scale-105"
                                style={{
                                  background: `rgba(255, 45, 45, ${intensity * 0.6 + 0.04})`,
                                  color: intensity > 0.5 ? "#fff" : "#6F6D7A",
                                }}
                              >
                                {val}
                              </div>
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Accordion>
          )}

          {/* Campaign Attribution */}
          <Accordion
            id="campaigns"
            label="Campaign Attribution"
            icon={<Target size={13} />}
            expanded={expandedSection === "campaigns"}
            onToggle={() => toggleSection("campaigns")}
          >
            <div className="mt-4 space-y-2">
              {campaignData.length === 0 ? (
                <div className="flex flex-col items-center gap-2 py-6 text-center">
                  <Target size={16} className="text-[#3A3840]" />
                  <p className="text-[11px] text-[#9F9DAA]">No campaign data yet</p>
                  <p className="text-[9px] text-[#4F4D58] max-w-[200px]">Attribution appears once campaigns are live and conversions tracked</p>
                </div>
              ) : campaignData.map((c, i) => (
                <div key={c.campaign} className="flex items-center gap-3 p-3 rounded-xl bg-[rgba(255,255,255,0.03)] border border-[rgba(255,255,255,0.06)]">
                  <div
                    className="w-5 h-5 rounded flex items-center justify-center text-[9px] font-bold shrink-0"
                    style={{ background: CHART_COLORS[i % CHART_COLORS.length] + "22", color: CHART_COLORS[i % CHART_COLORS.length] }}
                  >
                    {i + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] font-medium text-[#F5F4F1] truncate">{c.campaign}</p>
                    <p className="text-[9px] text-[#6F6D7A]">{c.conversions} conversions</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-[11px] font-bold text-[#7FE5B8]" style={{ fontVariantNumeric: "tabular-nums" }}>{c.roas.toFixed(1)}x</p>
                    <p className="text-[9px] text-[#6F6D7A]" style={{ fontVariantNumeric: "tabular-nums" }}>{formatCurrency(c.revenue)}</p>
                  </div>
                </div>
              ))}
            </div>
          </Accordion>

          {/* CLV + Revenue by Service */}
          <Accordion
            id="clv"
            label="Client Lifetime Value"
            icon={<DollarSign size={13} />}
            expanded={expandedSection === "clv"}
            onToggle={() => toggleSection("clv")}
          >
            <div className="mt-4">
              {clvData.length === 0 ? (
                <div className="flex flex-col items-center gap-2 py-6 text-center">
                  <DollarSign size={16} className="text-[#3A3840]" />
                  <p className="text-[11px] text-[#9F9DAA]">No CLV data yet</p>
                  <p className="text-[9px] text-[#4F4D58] max-w-[200px]">CLV tiers appear once clients have payment records attached</p>
                  <Link href="/dashboard/clients" className="mt-1 inline-flex items-center gap-1 text-[10px] font-semibold text-[#FF2D2D] hover:opacity-80 transition-opacity">
                    Add clients <ArrowUp size={9} className="rotate-45" />
                  </Link>
                </div>
              ) : (
                <div className="space-y-2">
                  {clvData.map(tier => (
                    <div key={tier.name} className="p-3 rounded-xl bg-[rgba(255,255,255,0.03)] border border-[rgba(255,255,255,0.06)]">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-medium text-[#F5F4F1]">{tier.name}</span>
                        <span className="text-[10px] text-[#6F6D7A]">{tier.count} clients</span>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <p className="text-[9px] text-[#6F6D7A] uppercase">Avg CLV</p>
                          <p className="text-sm font-bold text-[#FF2D2D]" style={{ fontVariantNumeric: "tabular-nums" }}>{formatCurrency(tier.avgCLV)}</p>
                        </div>
                        <div>
                          <p className="text-[9px] text-[#6F6D7A] uppercase">Avg Lifetime</p>
                          <p className="text-sm font-bold text-[#F5F4F1]" style={{ fontVariantNumeric: "tabular-nums" }}>{tier.avgMonths} mo.</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </Accordion>

          {/* Revenue by Service */}
          <Accordion
            id="service"
            label="Revenue by Service"
            icon={<BarChart3 size={13} />}
            expanded={expandedSection === "service"}
            onToggle={() => toggleSection("service")}
          >
            <div className="mt-4">
              {revenueByService.length === 0 ? (
                <div className="flex flex-col items-center gap-2 py-6 text-center">
                  <BarChart3 size={16} className="text-[#3A3840]" />
                  <p className="text-[11px] text-[#9F9DAA]">No service breakdown yet</p>
                  <p className="text-[9px] text-[#4F4D58] max-w-[200px]">Revenue by service type appears once deals are tagged to a service category</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {revenueByService.map((s, i) => (
                    <div key={s.service} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-sm" style={{ background: CHART_COLORS[i % CHART_COLORS.length] }} />
                        <span className="text-[10px] text-[#9F9DAA]">{s.service}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-[10px] font-mono font-medium text-[#F5F4F1]" style={{ fontVariantNumeric: "tabular-nums" }}>{formatCurrency(s.revenue)}</span>
                        <span className="text-[9px] text-[#6F6D7A]">{s.clients} clients</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </Accordion>

        </>
      )}
    </MotionPage>
  );
}

