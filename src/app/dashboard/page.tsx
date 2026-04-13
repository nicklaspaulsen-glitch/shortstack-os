"use client";

import { useAuth } from "@/lib/auth-context";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { formatCurrency, formatRelativeTime } from "@/lib/utils";
import {
  Zap, Users, DollarSign, MessageSquare, TrendingUp,
  AlertTriangle, Plus, FileText, Sparkles,
  Send, BarChart3, Globe, Briefcase,
  ArrowRight, Activity, ArrowUpRight, ArrowDownRight,
  Search, Clock, ChevronRight, Target, Mail, PhoneCall,
  Bot, XCircle, Shield
} from "lucide-react";
import toast from "react-hot-toast";
import Link from "next/link";

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
  dealsWon: number;
  totalRevenue: number;
  emailsSent: number;
  smsSent: number;
  callsMade: number;
}

interface LeadPipeline {
  new: number;
  called: number;
  replied: number;
  booked: number;
  converted: number;
}

export default function DashboardPage() {
  const { profile } = useAuth();
  const router = useRouter();
  const [stats, setStats] = useState<DashboardStats>({
    leadsToday: 0, totalLeads: 0, dmsSentToday: 0, dmsTarget: 80,
    repliesThisWeek: 0, activeClients: 0, totalMRR: 0, callsBooked: 0,
    systemIssues: 0, trinityActions: 0, dealsWon: 0, totalRevenue: 0,
    emailsSent: 0, smsSent: 0, callsMade: 0,
  });
  const [pipeline, setPipeline] = useState<LeadPipeline>({ new: 0, called: 0, replied: 0, booked: 0, converted: 0 });
  const [recentActivity, setRecentActivity] = useState<Array<{ description: string; status: string; created_at: string; action_type: string }>>([]);
  const [recentLeads, setRecentLeads] = useState<Array<{ business_name: string; industry: string; source: string; scraped_at: string; lead_score: number | null }>>([]);
  const [topClients, setTopClients] = useState<Array<{ id: string; business_name: string; mrr: number; health_score: number; package_tier: string }>>([]);
  const [agentStatuses, setAgentStatuses] = useState<Array<{ id: string; name: string; status: "working" | "idle" | "error"; actionsToday: number }>>([]);
  const [commandInput, setCommandInput] = useState("");
  const [commandLoading, setCommandLoading] = useState(false);
  const supabase = createClient();

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { fetchDashboardData(); }, []);

  // Show success toast after Stripe checkout redirect
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const subscribed = params.get("subscribed");
    if (subscribed) {
      toast.success(`Welcome to ShortStack OS! Your ${subscribed.charAt(0).toUpperCase() + subscribed.slice(1)} plan is active.`, { duration: 5000 });
      window.history.replaceState({}, "", "/dashboard");
    }
  }, []);

  async function fetchDashboardData() {
    try {
      const today = new Date().toISOString().split("T")[0];
      const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString();

      const [
        { count: leadsToday }, { count: totalLeads }, { count: dmsSentToday },
        { count: repliesThisWeek }, { count: activeClients }, { data: clients },
        { count: callsBooked }, { count: systemIssues }, { count: trinityActions },
        { data: leads }, { data: activity }, { count: dealsWon }, { data: deals },
        { data: topCl },
        { count: emailsSent }, { count: smsSent }, { count: callsMade },
        { count: pNew }, { count: pCalled }, { count: pReplied }, { count: pBooked }, { count: pConverted },
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
        supabase.from("leads").select("business_name, industry, source, scraped_at, lead_score").order("scraped_at", { ascending: false }).limit(6),
        supabase.from("trinity_log").select("description, status, created_at, action_type").order("created_at", { ascending: false }).limit(8),
        supabase.from("deals").select("*", { count: "exact", head: true }).eq("status", "won"),
        supabase.from("deals").select("amount").eq("status", "won"),
        supabase.from("clients").select("id, business_name, mrr, health_score, package_tier").eq("is_active", true).order("mrr", { ascending: false }).limit(5),
        supabase.from("outreach_log").select("*", { count: "exact", head: true }).eq("platform", "email").gte("sent_at", today),
        supabase.from("outreach_log").select("*", { count: "exact", head: true }).eq("platform", "sms").gte("sent_at", today),
        supabase.from("outreach_log").select("*", { count: "exact", head: true }).eq("platform", "call").gte("sent_at", today),
        supabase.from("leads").select("*", { count: "exact", head: true }).eq("status", "new"),
        supabase.from("leads").select("*", { count: "exact", head: true }).eq("status", "called"),
        supabase.from("leads").select("*", { count: "exact", head: true }).eq("status", "replied"),
        supabase.from("leads").select("*", { count: "exact", head: true }).eq("status", "booked"),
        supabase.from("leads").select("*", { count: "exact", head: true }).in("status", ["converted", "closed_won"]),
      ]);

      const totalMRR = clients?.reduce((sum, c) => sum + (c.mrr || 0), 0) || 0;
      const totalRevenue = deals?.reduce((sum, d) => sum + (d.amount || 0), 0) || 0;

      setStats({
        leadsToday: leadsToday || 0, totalLeads: totalLeads || 0,
        dmsSentToday: dmsSentToday || 0, dmsTarget: 80,
        repliesThisWeek: repliesThisWeek || 0, activeClients: activeClients || 0,
        totalMRR, callsBooked: callsBooked || 0,
        systemIssues: systemIssues || 0, trinityActions: trinityActions || 0,
        dealsWon: dealsWon || 0, totalRevenue,
        emailsSent: emailsSent || 0, smsSent: smsSent || 0, callsMade: callsMade || 0,
      });
      setPipeline({ new: pNew || 0, called: pCalled || 0, replied: pReplied || 0, booked: pBooked || 0, converted: pConverted || 0 });
      setRecentLeads(leads || []);
      setRecentActivity(activity || []);
      setTopClients(topCl || []);

      // Compute agent statuses from activity logs
      const agentNames = [
        { id: "lead-engine", name: "Lead Engine" }, { id: "outreach", name: "Outreach" },
        { id: "content", name: "Content" }, { id: "ads", name: "Ads" },
        { id: "reviews", name: "Reviews" }, { id: "analytics", name: "Analytics" },
        { id: "trinity", name: "Trinity" }, { id: "invoice", name: "Invoice" },
        { id: "onboarding", name: "Onboarding" }, { id: "seo", name: "SEO" },
        { id: "social-media", name: "Social" }, { id: "retention", name: "Retention" },
      ];
      const { data: agentLogs } = await supabase
        .from("trinity_log")
        .select("action_type, status, created_at")
        .gte("created_at", weekAgo)
        .order("created_at", { ascending: false })
        .limit(200);
      const logs = agentLogs || [];
      const statuses = agentNames.map(a => {
        const aLogs = logs.filter(l => l.action_type === a.id || l.action_type === a.name.toLowerCase().replace(/ /g, "_"));
        const todayLogs = aLogs.filter(l => l.created_at >= today);
        const hasError = aLogs.slice(0, 3).some(l => l.status === "error" || l.status === "failed");
        const hasRecent = aLogs[0] && (Date.now() - new Date(aLogs[0].created_at).getTime()) < 3600000;
        return { id: a.id, name: a.name, status: (hasError ? "error" : hasRecent ? "working" : "idle") as "working" | "idle" | "error", actionsToday: todayLogs.length };
      });
      setAgentStatuses(statuses);
    } catch (err) {
      console.error("Dashboard data fetch failed:", err);
    }
  }

  if (profile?.role === "client") {
    return <ClientDashboard />;
  }

  // No loading spinner — dashboard renders instantly with zero/empty state.
  // Data fills in as Supabase queries resolve (typically <1s).

  async function handleCommand(e: React.FormEvent) {
    e.preventDefault();
    if (!commandInput.trim() || commandLoading) return;
    setCommandLoading(true);
    try {
      const res = await fetch("/api/trinity/chat", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: commandInput }),
      });
      const data = await res.json();
      toast.success(data.reply || "Done!", { duration: 5000 });
    } catch { toast.error("Command failed"); }
    setCommandInput("");
    setCommandLoading(false);
  }

  async function triggerQuickAction(action: string) {
    toast.loading("Running...");
    try {
      const res = await fetch("/api/quick-actions", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      toast.dismiss();
      const data = await res.json();
      if (data.success) toast.success(data.results?.join("\n") || "Done!");
      else toast.error(data.error || "Failed");
    } catch { toast.dismiss(); toast.error("Error"); }
  }

  const pipelineTotal = pipeline.new + pipeline.called + pipeline.replied + pipeline.booked + pipeline.converted;
  const pipelineMax = Math.max(pipeline.new, pipeline.called, pipeline.replied, pipeline.booked, pipeline.converted, 1);
  const workingAgents = agentStatuses.filter(a => a.status === "working").length;
  const errorAgents = agentStatuses.filter(a => a.status === "error").length;

  return (
    <div className="fade-in space-y-5 max-w-[1400px] mx-auto">
      {/* ─── Header + Command Bar ─────────────────────────────────── */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            {getGreeting()}, <span className="text-gold">{profile?.nickname?.split(" ")[0] || profile?.full_name?.split(" ")[0]}</span>
          </h1>
          <p className="text-sm text-muted mt-1">
            {new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
            {stats.systemIssues === 0 ? (
              <span className="ml-3 text-success text-xs font-medium">All systems operational</span>
            ) : (
              <span className="ml-3 text-danger text-xs font-medium">{stats.systemIssues} system issue{stats.systemIssues > 1 ? "s" : ""}</span>
            )}
          </p>
        </div>
        <form onSubmit={handleCommand} className="flex gap-2">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
            <input
              type="text"
              value={commandInput}
              onChange={(e) => setCommandInput(e.target.value)}
              placeholder="Ask Trinity anything..."
              disabled={commandLoading}
              className="input pl-9 pr-4 py-2 text-xs w-64"
            />
          </div>
          <button type="submit" disabled={!commandInput.trim() || commandLoading}
            className="px-3 py-2 bg-gold/10 text-gold text-xs font-medium rounded-xl border border-gold/15 hover:bg-gold/20 transition-all disabled:opacity-30">
            <Send size={12} />
          </button>
        </form>
      </div>

      {/* ─── Primary Metrics ──────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <MetricCard
          label="Monthly Revenue"
          value={formatCurrency(stats.totalMRR)}
          sub={`${stats.activeClients} active client${stats.activeClients !== 1 ? "s" : ""}`}
          icon={<DollarSign size={18} />}
          trend={stats.totalMRR > 0 ? "up" : undefined}
          accent="gold"
        />
        <MetricCard
          label="Leads Today"
          value={stats.leadsToday.toString()}
          sub={`${stats.totalLeads.toLocaleString()} total`}
          icon={<Target size={18} />}
          trend={stats.leadsToday > 0 ? "up" : undefined}
          accent="emerald"
        />
        <MetricCard
          label="Outreach Sent"
          value={stats.dmsSentToday.toString()}
          sub={`${stats.repliesThisWeek} replies this week`}
          icon={<Send size={18} />}
          accent="blue"
        />
        <MetricCard
          label="Deals Won"
          value={stats.dealsWon.toString()}
          sub={stats.totalRevenue > 0 ? formatCurrency(stats.totalRevenue) + " total" : "No deals closed yet"}
          icon={<Briefcase size={18} />}
          trend={stats.dealsWon > 0 ? "up" : undefined}
          accent="purple"
        />
      </div>

      {/* ─── Quick Actions ────────────────────────────────────────── */}
      <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-none">
        {[
          { label: "Full Autopilot", icon: <Zap size={13} />, action: () => triggerQuickAction("full_autopilot"), accent: "text-gold" },
          { label: "New Client", icon: <Plus size={13} />, action: () => router.push("/dashboard/onboard"), accent: "text-success" },
          { label: "Run Outreach", icon: <Send size={13} />, action: () => triggerQuickAction("full_outreach"), accent: "text-info" },
          { label: "Gen Content", icon: <Sparkles size={13} />, action: () => triggerQuickAction("content_week"), accent: "text-purple-400" },
          { label: "Proposals", icon: <FileText size={13} />, action: () => router.push("/dashboard/proposals"), accent: "text-warning" },
          { label: "View Leads", icon: <Users size={13} />, action: () => router.push("/dashboard/leads"), accent: "text-info" },
          { label: "Health", icon: <Activity size={13} />, action: () => router.push("/dashboard/monitor"), accent: "text-success" },
          { label: "Campaigns", icon: <BarChart3 size={13} />, action: () => router.push("/dashboard/ads"), accent: "text-warning" },
        ].map((qa, i) => (
          <button key={i} onClick={qa.action}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-border bg-surface hover:border-gold/20 hover:shadow-sm transition-all shrink-0 group">
            <span className={qa.accent}>{qa.icon}</span>
            <span className="text-xs text-muted group-hover:text-foreground transition-colors font-medium">{qa.label}</span>
          </button>
        ))}
      </div>

      {/* ─── Pipeline + Outreach ───────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        {/* Lead Pipeline */}
        <div className="lg:col-span-3 card-static">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold flex items-center gap-2">
              <Target size={14} className="text-gold" /> Lead Pipeline
            </h2>
            <Link href="/dashboard/leads" className="text-[10px] text-gold hover:underline flex items-center gap-0.5 font-medium">
              View all <ChevronRight size={10} />
            </Link>
          </div>

          {pipelineTotal === 0 ? (
            <div className="text-center py-8">
              <Target size={24} className="text-muted/30 mx-auto mb-2" />
              <p className="text-xs text-muted">No leads in pipeline yet</p>
              <Link href="/dashboard/scraper" className="text-[10px] text-gold hover:underline mt-1 inline-block">Find leads</Link>
            </div>
          ) : (
            <>
              {/* Horizontal funnel bars */}
              <div className="space-y-2.5 mb-4">
                {[
                  { label: "New", count: pipeline.new, color: "bg-info", textColor: "text-info" },
                  { label: "Contacted", count: pipeline.called, color: "bg-gold", textColor: "text-gold" },
                  { label: "Replied", count: pipeline.replied, color: "bg-success", textColor: "text-success" },
                  { label: "Booked", count: pipeline.booked, color: "bg-purple-500", textColor: "text-purple-500" },
                  { label: "Won", count: pipeline.converted, color: "bg-emerald-400", textColor: "text-emerald-400" },
                ].map((stage) => (
                  <div key={stage.label} className="flex items-center gap-3">
                    <span className="text-[10px] text-muted w-16 text-right font-medium">{stage.label}</span>
                    <div className="flex-1 h-5 bg-surface-light rounded-lg overflow-hidden relative">
                      <div
                        className={`h-full rounded-lg ${stage.color} transition-all duration-700`}
                        style={{ width: `${Math.max(2, (stage.count / pipelineMax) * 100)}%`, opacity: stage.count > 0 ? 0.85 : 0.15 }}
                      />
                      {stage.count > 0 && (
                        <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] font-bold font-mono text-foreground">
                          {stage.count}
                        </span>
                      )}
                    </div>
                    {stage.count === 0 && <span className="text-[10px] text-muted/40 font-mono w-6">0</span>}
                  </div>
                ))}
              </div>
              <div className="flex items-center gap-4 pt-3 border-t border-border">
                <span className="text-[10px] text-muted font-mono">{pipelineTotal} total</span>
                <span className="text-[10px] text-muted">
                  Conversion: <span className="text-foreground font-medium">{pipelineTotal > 0 ? ((pipeline.converted / pipelineTotal) * 100).toFixed(1) : "0"}%</span>
                </span>
                <span className="text-[10px] text-muted">
                  Reply rate: <span className="text-foreground font-medium">{pipeline.called > 0 ? ((pipeline.replied / pipeline.called) * 100).toFixed(1) : "0"}%</span>
                </span>
              </div>
            </>
          )}
        </div>

        {/* Outreach Today */}
        <div className="lg:col-span-2 card-static">
          <h2 className="text-sm font-semibold mb-4 flex items-center gap-2">
            <Send size={14} className="text-info" /> Outreach Today
          </h2>
          <div className="space-y-3.5">
            {[
              { label: "Emails", count: stats.emailsSent, target: 30, icon: <Mail size={13} />, color: "bg-info", lightColor: "text-info" },
              { label: "SMS", count: stats.smsSent, target: 20, icon: <MessageSquare size={13} />, color: "bg-success", lightColor: "text-success" },
              { label: "Calls", count: stats.callsMade, target: 10, icon: <PhoneCall size={13} />, color: "bg-warning", lightColor: "text-warning" },
              { label: "DMs", count: Math.max(stats.dmsSentToday - stats.emailsSent - stats.smsSent - stats.callsMade, 0), target: 20, icon: <Send size={13} />, color: "bg-purple-500", lightColor: "text-purple-500" },
            ].map((ch) => {
              const pct = Math.min((ch.count / ch.target) * 100, 100);
              return (
                <div key={ch.label}>
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <span className={ch.lightColor}>{ch.icon}</span>
                      <span className="text-[11px] font-medium">{ch.label}</span>
                    </div>
                    <span className="text-[10px] font-mono text-muted">
                      <span className="text-foreground font-semibold">{ch.count}</span>/{ch.target}
                    </span>
                  </div>
                  <div className="h-2 bg-surface-light rounded-full overflow-hidden">
                    <div className={`h-full rounded-full ${ch.color} transition-all duration-700`}
                      style={{ width: `${pct}%`, opacity: ch.count > 0 ? 0.85 : 0 }} />
                  </div>
                </div>
              );
            })}
          </div>
          <div className="mt-4 pt-3 border-t border-border flex items-center justify-between">
            <span className="text-[10px] text-muted">Total sent today</span>
            <span className="text-sm font-bold font-mono text-foreground">{stats.dmsSentToday}</span>
          </div>
        </div>
      </div>

      {/* ─── Agents, Clients, Leads ────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Live Agents */}
        <div className="card-static">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold flex items-center gap-2">
              <Bot size={14} className="text-gold" /> Live Agents
            </h2>
            <div className="flex items-center gap-2">
              {workingAgents > 0 && (
                <span className="flex items-center gap-1 text-[9px] text-success font-medium">
                  <span className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" />{workingAgents} active
                </span>
              )}
              {errorAgents > 0 && (
                <span className="flex items-center gap-1 text-[9px] text-danger font-medium">
                  <XCircle size={9} />{errorAgents}
                </span>
              )}
            </div>
          </div>

          {/* Agent grid - 3 cols for better readability */}
          <div className="grid grid-cols-3 gap-1.5 mb-3">
            {agentStatuses.map(a => (
              <div key={a.id} className={`flex items-center gap-1.5 p-2 rounded-lg border transition-colors ${
                a.status === "working" ? "bg-success/[0.04] border-success/15" :
                a.status === "error" ? "bg-danger/[0.04] border-danger/15" :
                "bg-surface-light/50 border-border/50"
              }`}>
                <div className={`w-2 h-2 rounded-full shrink-0 ${
                  a.status === "working" ? "bg-success animate-pulse" :
                  a.status === "error" ? "bg-danger" :
                  "bg-muted/30"
                }`} />
                <span className="text-[9px] truncate font-medium">{a.name}</span>
              </div>
            ))}
          </div>

          {/* Recent actions */}
          <div className="border-t border-border pt-2.5">
            <p className="text-[9px] text-muted mb-2 flex items-center gap-1 font-semibold uppercase tracking-wider">
              <Activity size={9} /> Recent
            </p>
            <div className="space-y-0.5 max-h-28 overflow-y-auto">
              {recentActivity.length === 0 ? (
                <p className="text-muted text-[10px] py-3 text-center">No activity yet</p>
              ) : (
                recentActivity.slice(0, 5).map((a, i) => (
                  <div key={i} className="flex items-start gap-2 py-1.5">
                    <div className={`w-1.5 h-1.5 rounded-full mt-1.5 shrink-0 ${
                      a.status === "completed" || a.status === "success" ? "bg-success" :
                      a.status === "error" || a.status === "failed" ? "bg-danger" : "bg-warning"
                    }`} />
                    <p className="text-[10px] leading-snug truncate flex-1">{a.description}</p>
                    <span className="text-[8px] text-muted shrink-0">{formatRelativeTime(a.created_at)}</span>
                  </div>
                ))
              )}
            </div>
          </div>

          <Link href="/dashboard/agent-supervisor"
            className="flex items-center justify-center gap-1 text-[10px] text-gold font-medium hover:text-gold-dark mt-2.5 pt-2.5 border-t border-border">
            Agent Supervisor <ArrowRight size={10} />
          </Link>
        </div>

        {/* Top Clients */}
        <div className="card-static">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold flex items-center gap-2">
              <Briefcase size={14} className="text-success" /> Top Clients
            </h2>
            <Link href="/dashboard/clients" className="text-[10px] text-gold hover:underline flex items-center gap-0.5 font-medium">
              All <ChevronRight size={10} />
            </Link>
          </div>
          <div className="space-y-1 max-h-64 overflow-y-auto">
            {topClients.length === 0 ? (
              <div className="text-center py-8">
                <Users size={24} className="text-muted/30 mx-auto mb-2" />
                <p className="text-xs text-muted">No clients yet</p>
                <Link href="/dashboard/onboard" className="text-[10px] text-gold hover:underline mt-1 inline-block">Onboard your first client</Link>
              </div>
            ) : (
              topClients.map((c) => (
                <Link key={c.id} href={`/dashboard/clients/${c.id}`}
                  className="flex items-center justify-between py-2.5 border-b border-border last:border-0 hover:bg-surface-light -mx-2 px-2 rounded-xl transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-gold/[0.08] flex items-center justify-center text-[12px] font-bold text-gold">
                      {c.business_name.charAt(0)}
                    </div>
                    <div>
                      <p className="text-[12px] font-semibold">{c.business_name}</p>
                      <p className="text-[9px] text-muted">{c.package_tier || "Client"}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-[12px] font-bold font-mono">{formatCurrency(c.mrr)}<span className="text-muted font-normal text-[10px]">/mo</span></p>
                    <div className="flex items-center gap-1.5 justify-end mt-0.5">
                      <div className="w-10 bg-surface-light rounded-full h-1.5">
                        <div className={`h-1.5 rounded-full transition-all ${c.health_score > 75 ? "bg-success" : c.health_score > 50 ? "bg-warning" : "bg-danger"}`}
                          style={{ width: `${c.health_score}%` }} />
                      </div>
                      <span className={`text-[9px] font-mono font-medium ${c.health_score > 75 ? "text-success" : c.health_score > 50 ? "text-warning" : "text-danger"}`}>
                        {c.health_score}%
                      </span>
                    </div>
                  </div>
                </Link>
              ))
            )}
          </div>
        </div>

        {/* Recent Leads */}
        <div className="card-static">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold flex items-center gap-2">
              <Zap size={14} className="text-warning" /> Recent Leads
            </h2>
            <Link href="/dashboard/leads" className="text-[10px] text-gold hover:underline flex items-center gap-0.5 font-medium">
              All <ChevronRight size={10} />
            </Link>
          </div>
          <div className="space-y-1 max-h-64 overflow-y-auto">
            {recentLeads.length === 0 ? (
              <div className="text-center py-8">
                <Search size={24} className="text-muted/30 mx-auto mb-2" />
                <p className="text-xs text-muted">No leads yet</p>
                <Link href="/dashboard/scraper" className="text-[10px] text-gold hover:underline mt-1 inline-block">Find leads</Link>
              </div>
            ) : (
              recentLeads.map((lead, i) => (
                <div key={i} className="flex items-center justify-between py-2.5 border-b border-border last:border-0">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-info/[0.08] flex items-center justify-center text-[12px] font-bold text-info">
                      {lead.business_name?.charAt(0) || "?"}
                    </div>
                    <div>
                      <p className="text-[12px] font-semibold">{lead.business_name}</p>
                      <p className="text-[9px] text-muted">
                        {lead.industry || "Unknown"}
                        <span className="mx-1 opacity-30">&middot;</span>
                        {lead.source}
                      </p>
                    </div>
                  </div>
                  <div className="text-right flex flex-col items-end gap-0.5">
                    {lead.lead_score != null && (
                      <span className={`text-[11px] font-mono font-bold px-1.5 py-0.5 rounded-md ${
                        lead.lead_score >= 70 ? "text-success bg-success/[0.08]" :
                        lead.lead_score >= 40 ? "text-warning bg-warning/[0.08]" :
                        "text-muted bg-surface-light"
                      }`}>{lead.lead_score}</span>
                    )}
                    <p className="text-[9px] text-muted">{formatRelativeTime(lead.scraped_at)}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* ─── Revenue + System Status ──────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Revenue Overview */}
        <div className="card-static border-gold/10">
          <h2 className="text-sm font-semibold flex items-center gap-2 mb-4">
            <DollarSign size={14} className="text-gold" /> Revenue Overview
          </h2>
          <div className="grid grid-cols-3 gap-3">
            <div className="text-center p-3 rounded-xl bg-gold/[0.04] border border-gold/10">
              <p className="text-lg font-bold font-mono text-gold">{formatCurrency(stats.totalMRR)}</p>
              <p className="text-[9px] text-muted uppercase tracking-wider mt-0.5">MRR</p>
            </div>
            <div className="text-center p-3 rounded-xl bg-surface-light border border-border">
              <p className={`text-lg font-bold font-mono ${stats.totalRevenue > 0 ? "text-success" : "text-muted"}`}>
                {formatCurrency(stats.totalRevenue)}
              </p>
              <p className="text-[9px] text-muted uppercase tracking-wider mt-0.5">Total Revenue</p>
            </div>
            <div className="text-center p-3 rounded-xl bg-surface-light border border-border">
              <p className={`text-lg font-bold font-mono ${stats.dealsWon > 0 ? "text-foreground" : "text-muted"}`}>{stats.dealsWon}</p>
              <p className="text-[9px] text-muted uppercase tracking-wider mt-0.5">Deals Closed</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 mt-3 text-[10px] text-muted">
            {stats.activeClients > 0 ? (
              <>
                <TrendingUp size={10} className="text-success" />
                <span>{stats.activeClients} active client{stats.activeClients !== 1 ? "s" : ""} generating recurring revenue</span>
              </>
            ) : (
              <>
                <Users size={10} />
                <span>Onboard clients to start tracking revenue</span>
              </>
            )}
          </div>
        </div>

        {/* System Status */}
        <div className="card-static">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold flex items-center gap-2">
              {stats.systemIssues > 0 ? <AlertTriangle size={14} className="text-danger" /> : <Shield size={14} className="text-success" />}
              System Status
            </h2>
            <Link href="/dashboard/monitor" className="text-[10px] text-gold hover:underline flex items-center gap-0.5 font-medium">
              Details <ChevronRight size={10} />
            </Link>
          </div>
          <div className="flex items-center gap-3 mb-4">
            {stats.systemIssues === 0 ? (
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-success/[0.08] flex items-center justify-center">
                  <Activity size={18} className="text-success" />
                </div>
                <div>
                  <p className="text-lg font-bold text-success">All Clear</p>
                  <p className="text-[10px] text-muted">All systems operational</p>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-danger/[0.08] flex items-center justify-center">
                  <AlertTriangle size={18} className="text-danger" />
                </div>
                <div>
                  <p className="text-lg font-bold text-danger">{stats.systemIssues} Issue{stats.systemIssues > 1 ? "s" : ""}</p>
                  <p className="text-[10px] text-muted">Check monitor for details</p>
                </div>
              </div>
            )}
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="flex items-center gap-2 text-[10px] text-muted p-2.5 rounded-xl bg-surface-light border border-border">
              <Clock size={11} className="shrink-0" /> Health checks every 30 min
            </div>
            <div className="flex items-center gap-2 text-[10px] text-muted p-2.5 rounded-xl bg-surface-light border border-border">
              <Globe size={11} className="shrink-0" /> 20 integrations monitored
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Metric Card ───────────────────────────────────────────────── */
function MetricCard({ label, value, sub, icon, trend, accent = "gold" }: {
  label: string; value: string; sub: string; icon: React.ReactNode;
  trend?: "up" | "down"; accent?: string;
}) {
  const themes: Record<string, { bg: string; text: string; border: string; iconBg: string }> = {
    gold:    { bg: "bg-gold/[0.04]",        text: "text-gold",        border: "border-gold/10",        iconBg: "bg-gold/[0.08]" },
    emerald: { bg: "bg-success/[0.04]",     text: "text-success",     border: "border-success/10",     iconBg: "bg-success/[0.08]" },
    blue:    { bg: "bg-info/[0.04]",        text: "text-info",        border: "border-info/10",        iconBg: "bg-info/[0.08]" },
    purple:  { bg: "bg-purple-500/[0.04]",  text: "text-purple-400",  border: "border-purple-500/10",  iconBg: "bg-purple-500/[0.08]" },
  };
  const t = themes[accent] || themes.gold;

  return (
    <div className={`rounded-2xl border ${t.border} ${t.bg} p-4 transition-all hover:shadow-lg hover:-translate-y-0.5`}>
      <div className="flex items-center justify-between mb-3">
        <span className="text-[11px] text-muted font-medium">{label}</span>
        <div className={`w-8 h-8 rounded-xl ${t.iconBg} flex items-center justify-center ${t.text}`}>
          {icon}
        </div>
      </div>
      <div className="flex items-end gap-2">
        <span className="text-2xl font-bold font-mono tracking-tight text-foreground">{value}</span>
        {trend && (
          <span className={`mb-0.5 ${trend === "up" ? "text-success" : "text-danger"}`}>
            {trend === "up" ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
          </span>
        )}
      </div>
      <p className="text-[10px] text-muted mt-1.5">{sub}</p>
    </div>
  );
}

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

function ClientDashboard() {
  const { profile } = useAuth();
  const router = useRouter();

  return (
    <div className="fade-in space-y-6 max-w-[1000px] mx-auto">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Welcome, {profile?.full_name}</h1>
        <p className="text-sm text-muted mt-0.5">Your client portal</p>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "My Services", icon: <Briefcase size={22} />, color: "text-gold", route: "/dashboard/portal" },
          { label: "Invoices", icon: <FileText size={22} />, color: "text-info", route: "/dashboard/portal/billing" },
          { label: "Content", icon: <Sparkles size={22} />, color: "text-purple-400", route: "/dashboard/portal/content" },
          { label: "Contact Us", icon: <Send size={22} />, color: "text-success", route: "/dashboard/portal/support" },
        ].map((item, i) => (
          <button key={i} onClick={() => router.push(item.route)}
            className="rounded-2xl border border-border bg-surface p-6 text-center hover:bg-surface-light hover:border-border-light transition-all group">
            <span className={`${item.color} inline-block mb-2 group-hover:scale-110 transition-transform`}>{item.icon}</span>
            <span className="text-sm font-medium block">{item.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
