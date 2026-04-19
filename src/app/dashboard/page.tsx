"use client";

import { useAuth } from "@/lib/auth-context";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { formatCurrency, formatRelativeTime } from "@/lib/utils";
import {
  Zap, Users, DollarSign, MessageSquare, TrendingUp,
  AlertTriangle, Plus, FileText, Sparkles,
  Send, BarChart3, Globe, Briefcase,
  ArrowRight, Activity, ArrowUpRight, ArrowDownRight,
  Search, Clock, ChevronRight, Target, Mail, PhoneCall,
  Bot, XCircle, Shield, Loader,
  Mic, Maximize2, Scissors, Volume2, Film, Music, Brain
} from "lucide-react";
import toast from "react-hot-toast";
import Link from "next/link";
import PageHero from "@/components/ui/page-hero";
import { EmptyState } from "@/components/ui/empty-state-illustration";
import RecentGenerations from "@/components/dashboard/recent-generations";
import JumpBackIn from "@/components/dashboard/jump-back-in";
import TodaysPriority from "@/components/dashboard/todays-priority";
import QuickCreateFab from "@/components/dashboard/quick-create-fab";
import DowntimeBanner from "@/components/dashboard/downtime-banner";
import OutreachAccounts from "@/components/dashboard/outreach-accounts";
import PersonalizedMetrics from "@/components/dashboard/personalized-metrics";
import AiRecommender from "@/components/dashboard/ai-recommender";
import {
  useFocusMode,
  FocusModeToggle,
  CommandPaletteHint,
} from "@/components/dashboard/focus-mode-toggle";

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
  const { profile, refreshProfile } = useAuth();
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
  const [dashboardLoading, setDashboardLoading] = useState(true);
  const [autopilotClients, setAutopilotClients] = useState<Array<{ client_name: string; tasks_done: number; last_run: string }>>([]);
  const { focus, toggle: toggleFocus } = useFocusMode();

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    fetchDashboardData();
    // Safety: if data fetch hangs for 8s, clear loading anyway
    const t = setTimeout(() => setDashboardLoading(false), 8000);
    return () => clearTimeout(t);
  }, []);

  // Show success toast after Stripe checkout redirect.
  // The webhook activates the plan server-side before the user returns here,
  // but refreshProfile() pulls the fresh plan_tier so gated features unlock
  // immediately without a page reload.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const subscribed = params.get("subscribed");
    if (subscribed) {
      const planLabel = subscribed.charAt(0).toUpperCase() + subscribed.slice(1);
      toast.success(`Welcome to ${planLabel}! Your plan is active.`, { duration: 5000 });
      // Reload profile from server so new plan's features unlock.
      // Small delay lets the Stripe webhook land first.
      setTimeout(() => { refreshProfile().catch(() => {}); }, 1500);
      window.history.replaceState({}, "", "/dashboard");
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function fetchDashboardData() {
    try {
      // Fetch all dashboard data from server-side API route.
      // Server-side auth (cookie-based) is reliable — client-side
      // Supabase tokens can be stale/expired causing RLS to return 0 rows.
      const res = await fetch("/api/dashboard-data");
      if (!res.ok) throw new Error(`API ${res.status}`);
      const data = await res.json();

      setStats(data.stats);
      setPipeline(data.pipeline);
      setRecentLeads(data.recentLeads || []);
      setRecentActivity(data.recentActivity || []);
      setTopClients(data.topClients || []);
      setAgentStatuses(data.agentStatuses || []);
    } catch (err) {
      console.error("Dashboard data fetch failed:", err);
    } finally {
      setDashboardLoading(false);
    }

    // Fetch recent autopilot activity (non-blocking)
    try {
      const apRes = await fetch("/api/autopilot/recent");
      if (apRes.ok) {
        const apData = await apRes.json();
        setAutopilotClients(apData.clients || []);
      }
    } catch {}
  }

  if (profile?.role === "client") {
    return <ClientDashboard />;
  }

  if (dashboardLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader size={20} className="animate-spin text-gold" />
      </div>
    );
  }

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
      {/* ─── Hero + Command Bar ─────────────────────────────────── */}
      <PageHero
        icon={<Sparkles size={22} />}
        eyebrow={new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
        title={`${getGreeting()}, ${profile?.nickname?.split(" ")[0] || profile?.full_name?.split(" ")[0] || ""}`}
        subtitle={
          stats.systemIssues === 0
            ? "All systems operational — your AI is running smoothly."
            : `${stats.systemIssues} system issue${stats.systemIssues > 1 ? "s" : ""} needs attention.`
        }
        gradient="gold"
        actions={
          <div className="flex items-center gap-2 flex-wrap justify-end">
            <button
              onClick={toggleFocus}
              title={focus ? "Exit focus mode" : "Enter focus mode"}
              className={`hidden sm:flex items-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-medium transition-all ${
                focus
                  ? "bg-white/25 border-white/40 text-white shadow-[0_0_18px_-4px_rgba(255,255,255,0.55)]"
                  : "bg-white/10 border-white/20 text-white/90 hover:bg-white/20"
              }`}
            >
              <Sparkles size={12} />
              {focus ? "Focus On" : "Focus"}
            </button>
            <form onSubmit={handleCommand} className="flex gap-2">
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/50" />
                <input
                  type="text"
                  value={commandInput}
                  onChange={(e) => setCommandInput(e.target.value)}
                  placeholder="Ask Trinity anything..."
                  disabled={commandLoading}
                  className="pl-9 pr-4 py-2 text-xs w-64 rounded-xl bg-white/10 border border-white/15 text-white placeholder:text-white/50 focus:outline-none focus:border-white/30 focus:bg-white/15"
                />
              </div>
              <button type="submit" disabled={!commandInput.trim() || commandLoading}
                className="px-3 py-2 bg-white/20 text-white text-xs font-medium rounded-xl border border-white/20 hover:bg-white/30 transition-all disabled:opacity-30">
                <Send size={12} />
              </button>
            </form>
          </div>
        }
      />

      {/* ─── Service health banner — alerts when something is down ── */}
      <DowntimeBanner />

      {/* ─── AI Recommender — the big "ready to let AI do your job?" button ─ */}
      <AiRecommender />

      {/* ─── Command Palette Hint (above-the-fold helper) ──────── */}
      <div className="flex items-center justify-between gap-2 -mt-2">
        <CommandPaletteHint />
        <FocusModeToggle focus={focus} onToggle={toggleFocus} />
      </div>

      {/* ─── Personalized Metrics (hidden for agency users) ───────── */}
      {!focus && <PersonalizedMetrics />}

      {/* ─── Today's Priority (always visible — heart of focus mode) ─ */}
      <TodaysPriority />

      {/* ─── Primary Metrics ──────────────────────────────────────── */}
      {!focus && <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 stagger-fade">
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
      </div>}

      {/* ─── Quick Actions ────────────────────────────────────────── */}
      {!focus && <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-none">
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
      </div>}

      {/* ─── Recent AI Generations (always shown) ─────────────────── */}
      <RecentGenerations />

      {/* ─── Outreach Accounts — quickly toggle which senders are active ─ */}
      {!focus && <OutreachAccounts />}

      {/* ─── Jump Back In (always shown) ──────────────────────────── */}
      <JumpBackIn />

      {/* ─── AI Studio Quick Access ──────────────────────────────── */}
      {!focus && <div className="card-static">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold flex items-center gap-2">
            <Sparkles size={14} className="text-purple-400" /> AI Studio
            <span className="text-[9px] text-muted font-normal bg-purple-500/10 text-purple-400 px-2 py-0.5 rounded-full">GPU-Powered</span>
          </h2>
          <Link href="/dashboard/ai-studio" className="text-[10px] text-gold hover:underline flex items-center gap-0.5 font-medium">
            Open Studio <ChevronRight size={10} />
          </Link>
        </div>
        <div className="grid grid-cols-4 md:grid-cols-8 gap-2">
          {[
            { label: "Transcribe", Icon: Mic, gradient: "from-blue-400 to-indigo-500", href: "/dashboard/ai-studio?tab=transcribe", desc: "Speech → Text" },
            { label: "Upscale", Icon: Maximize2, gradient: "from-emerald-400 to-teal-500", href: "/dashboard/ai-studio?tab=upscale", desc: "Enhance images" },
            { label: "Remove BG", Icon: Scissors, gradient: "from-purple-400 to-pink-500", href: "/dashboard/ai-studio?tab=remove-bg", desc: "Background removal" },
            { label: "Voice Clone", Icon: Volume2, gradient: "from-cyan-400 to-blue-500", href: "/dashboard/ai-studio?tab=voice-clone", desc: "AI voice synthesis" },
            { label: "AI Video", Icon: Film, gradient: "from-rose-400 to-orange-500", href: "/dashboard/ai-video", desc: "Image → Video" },
            { label: "Music Gen", Icon: Music, gradient: "from-violet-400 to-purple-500", href: "/dashboard/ai-studio?tab=music-gen", desc: "AI music creation" },
            { label: "Image Gen", Icon: Sparkles, gradient: "from-amber-400 to-orange-500", href: "/dashboard/ai-studio?tab=batch-generate", desc: "FLUX / SDXL" },
            { label: "LoRA Train", Icon: Brain, gradient: "from-fuchsia-400 to-pink-500", href: "/dashboard/ai-studio?tab=train-lora", desc: "Custom AI models" },
          ].map((tool) => (
            <Link key={tool.label} href={tool.href}
              className="flex flex-col items-center gap-1.5 p-2.5 rounded-xl border border-border hover:border-purple-500/20 hover:bg-purple-500/5 transition-all group cursor-pointer text-center">
              <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${tool.gradient} flex items-center justify-center shadow-[0_2px_6px_rgba(0,0,0,0.25),0_1px_0_rgba(255,255,255,0.12)_inset] group-hover:scale-105 transition-transform`}>
                <tool.Icon size={16} className="text-white" />
              </div>
              <span className="text-[10px] font-medium text-muted group-hover:text-foreground transition-colors">{tool.label}</span>
              <span className="text-[8px] text-muted/60 hidden md:block">{tool.desc}</span>
            </Link>
          ))}
        </div>
      </div>}

      {/* ─── AI Auto-Pilot Active Clients ────────────────────────── */}
      {!focus && autopilotClients.length > 0 && (
        <div className="card border-gold/10 bg-gold/[0.02]">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-gold/10 flex items-center justify-center">
                <Bot size={16} className="text-gold" />
              </div>
              <div>
                <h3 className="text-sm font-bold">AI Auto-Pilot Active</h3>
                <p className="text-[10px] text-muted">{autopilotClients.length} client{autopilotClients.length !== 1 ? "s" : ""} with AI-generated content</p>
              </div>
            </div>
            <Link href="/dashboard/generations" className="text-[10px] text-gold hover:underline flex items-center gap-1">
              View All <ChevronRight size={10} />
            </Link>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {autopilotClients.slice(0, 3).map((ac, i) => (
              <div key={i} className="p-2.5 rounded-lg bg-surface-light border border-border flex items-center gap-2">
                <Sparkles size={12} className="text-gold shrink-0" />
                <div className="min-w-0">
                  <p className="text-xs font-medium truncate">{ac.client_name}</p>
                  <p className="text-[9px] text-muted">{ac.tasks_done} items generated</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {!focus && (<>
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
            <EmptyState
              type="no-leads"
              size={140}
              title="No leads in pipeline yet"
              description="Start prospecting to fill your funnel."
              action={<Link href="/dashboard/scraper" className="text-[10px] text-gold hover:underline">Find leads</Link>}
            />
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
              <EmptyState
                type="no-clients"
                size={140}
                title="No clients yet"
                description="Onboard your first client to start tracking MRR and health."
                action={<Link href="/dashboard/onboard" className="text-[10px] text-gold hover:underline">Onboard your first client</Link>}
              />
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
              <EmptyState
                type="no-leads"
                size={140}
                title="No leads yet"
                description="Start your first scrape to find prospects."
                action={<Link href="/dashboard/scraper" className="text-[10px] text-gold hover:underline">Find leads</Link>}
              />
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
      </>)}

      {/* ─── Quick Create FAB (always shown) ──────────────────────── */}
      <QuickCreateFab />
    </div>
  );
}

/* ─── Metric Card ───────────────────────────────────────────────── */
function MetricCard({ label, value, sub, icon, trend, accent = "gold" }: {
  label: string; value: string; sub: string; icon: React.ReactNode;
  trend?: "up" | "down"; accent?: string;
}) {
  const themes: Record<string, { bg: string; text: string; border: string; iconBg: string; glow: string; iconShadow: string }> = {
    gold: {
      bg: "bg-gradient-to-br from-gold/[0.10] via-gold/[0.05] to-transparent",
      text: "text-gold",
      border: "border-gold/25",
      iconBg: "bg-gold/15",
      glow: "accent-glow-gold",
      iconShadow: "shadow-[0_2px_8px_rgba(201,168,76,0.3),0_1px_0_rgba(255,255,255,0.08)_inset]",
    },
    emerald: {
      bg: "bg-gradient-to-br from-success/[0.10] via-success/[0.05] to-transparent",
      text: "text-success",
      border: "border-success/25",
      iconBg: "bg-success/15",
      glow: "accent-glow-green",
      iconShadow: "shadow-[0_2px_8px_rgba(16,185,129,0.3),0_1px_0_rgba(255,255,255,0.08)_inset]",
    },
    blue: {
      bg: "bg-gradient-to-br from-info/[0.10] via-info/[0.05] to-transparent",
      text: "text-info",
      border: "border-info/25",
      iconBg: "bg-info/15",
      glow: "accent-glow-blue",
      iconShadow: "shadow-[0_2px_8px_rgba(59,130,246,0.3),0_1px_0_rgba(255,255,255,0.08)_inset]",
    },
    purple: {
      bg: "bg-gradient-to-br from-purple-500/[0.10] via-purple-500/[0.05] to-transparent",
      text: "text-purple-400",
      border: "border-purple-500/25",
      iconBg: "bg-purple-500/15",
      glow: "accent-glow-purple",
      iconShadow: "shadow-[0_2px_8px_rgba(168,85,247,0.3),0_1px_0_rgba(255,255,255,0.08)_inset]",
    },
  };
  const t = themes[accent] || themes.gold;

  // Pseudo sparkline — deterministic per label so it doesn't flip on re-render
  // Clamped strictly inside the 100x30 viewBox with a 2px padding
  const seed = label.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
  const N = 12;
  const points = Array.from({ length: N }).map((_, i) => {
    const raw = (Math.sin(seed * 0.13 + i * 0.9) + Math.cos(seed * 0.07 + i * 0.5)) * 6 + 15 + (trend === "up" ? i * 0.8 : trend === "down" ? -i * 0.8 : 0);
    const x = (i * (100 / (N - 1))).toFixed(2);
    const y = Math.max(2, Math.min(28, raw)).toFixed(2);
    return `${x},${y}`;
  }).join(" ");

  return (
    <div className={`card-premium relative rounded-2xl border ${t.border} ${t.bg} ${t.glow} p-4 transition-all duration-250 hover:-translate-y-0.5 shadow-[0_1px_0_rgba(255,255,255,0.04)_inset,0_2px_4px_rgba(0,0,0,0.15),0_8px_20px_-6px_rgba(0,0,0,0.35)] hover:shadow-[0_1px_0_rgba(255,255,255,0.06)_inset,0_2px_4px_rgba(0,0,0,0.15),0_14px_32px_-8px_rgba(0,0,0,0.5)] overflow-hidden`}>
      {/* Decorative blob */}
      <div
        className={`pointer-events-none absolute -bottom-8 -right-8 w-24 h-24 rounded-full ${t.iconBg} blur-xl`}
        aria-hidden
      />
      <div className="relative flex items-center justify-between mb-3">
        <span className="text-[11px] text-muted font-medium uppercase tracking-wider">{label}</span>
        <div className={`w-9 h-9 rounded-xl ${t.iconBg} ${t.iconShadow} flex items-center justify-center ${t.text}`}>
          {icon}
        </div>
      </div>
      <div className="relative flex items-end gap-2">
        <span key={value} className="text-2xl font-bold font-mono tracking-tight text-foreground number-popin">{value}</span>
        {trend && (
          <span className={`mb-0.5 ${trend === "up" ? "text-success" : "text-danger"}`}>
            {trend === "up" ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
          </span>
        )}
      </div>
      <div className="relative flex items-end justify-between mt-1.5 gap-3">
        <p className="text-[10px] text-muted flex-1 truncate">{sub}</p>
        <svg width="100" height="30" viewBox="0 0 100 30" preserveAspectRatio="none" className="shrink-0 opacity-60 max-w-[100px]" aria-hidden>
          <polyline
            points={points}
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={t.text}
          />
        </svg>
      </div>
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
