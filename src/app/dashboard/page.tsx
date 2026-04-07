"use client";

import { useAuth } from "@/lib/auth-context";
import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import StatCard from "@/components/ui/stat-card";
import StatusBadge from "@/components/ui/status-badge";
import { formatCurrency, formatRelativeTime } from "@/lib/utils";
import {
  Zap, Users, DollarSign, MessageSquare, TrendingUp,
  Phone, Bot, AlertTriangle, Plus, FileText, Sparkles,
  Send, BarChart3, Globe, Film, Briefcase, Mic, StopCircle,
  Volume2, VolumeX, ArrowRight, Activity
} from "lucide-react";
import toast from "react-hot-toast";
import Link from "next/link";
import AgentActivityFeed from "@/components/agent-activity-feed";
import AgentStatusCards from "@/components/agent-status-cards";
import ScrollReveal from "@/components/ui/scroll-reveal";

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
}

export default function DashboardPage() {
  const { profile } = useAuth();
  const router = useRouter();
  const [stats, setStats] = useState<DashboardStats>({
    leadsToday: 0, totalLeads: 0, dmsSentToday: 0, dmsTarget: 80,
    repliesThisWeek: 0, activeClients: 0, totalMRR: 0, callsBooked: 0,
    systemIssues: 0, trinityActions: 0, dealsWon: 0, totalRevenue: 0,
  });
  const [recentActivity, setRecentActivity] = useState<Array<{ description: string; status: string; created_at: string; action_type: string }>>([]);
  const [recentLeads, setRecentLeads] = useState<Array<{ business_name: string; industry: string; source: string; scraped_at: string }>>([]);
  const [topClients, setTopClients] = useState<Array<{ id: string; business_name: string; mrr: number; health_score: number; package_tier: string }>>([]);
  const supabase = createClient();

  useEffect(() => { fetchDashboardData(); }, []);

  async function fetchDashboardData() {
    const today = new Date().toISOString().split("T")[0];
    const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString();

    const [
      { count: leadsToday }, { count: totalLeads }, { count: dmsSentToday },
      { count: repliesThisWeek }, { count: activeClients }, { data: clients },
      { count: callsBooked }, { count: systemIssues }, { count: trinityActions },
      { data: leads }, { data: activity }, { count: dealsWon }, { data: deals },
      { data: topCl },
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
      supabase.from("trinity_log").select("description, status, created_at, action_type").order("created_at", { ascending: false }).limit(10),
      supabase.from("deals").select("*", { count: "exact", head: true }).eq("status", "won"),
      supabase.from("deals").select("amount").eq("status", "won"),
      supabase.from("clients").select("id, business_name, mrr, health_score, package_tier").eq("is_active", true).order("mrr", { ascending: false }).limit(5),
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
    });
    setRecentLeads(leads || []);
    setRecentActivity(activity || []);
    setTopClients(topCl || []);
  }

  if (profile?.role === "client") {
    return <ClientDashboard />;
  }

  const quickActions = [
    { label: "Proposal", icon: <FileText size={15} />, color: "text-gold", action: () => router.push("/dashboard/clients") },
    { label: "New Client", icon: <Plus size={15} />, color: "text-success", action: () => router.push("/dashboard/onboard") },
    { label: "AI Script", icon: <Sparkles size={15} />, color: "text-accent", action: () => router.push("/dashboard/content") },
    { label: "Workflow", icon: <Zap size={15} />, color: "text-warning", action: () => router.push("/dashboard/workflows") },
    { label: "Trinity", icon: <Bot size={15} />, color: "text-gold", action: () => router.push("/dashboard/trinity") },
    { label: "Leads", icon: <Users size={15} />, color: "text-success", action: () => router.push("/dashboard/leads") },
    { label: "Website", icon: <Globe size={15} />, color: "text-accent", action: () => toast("Use Trinity: 'Build website for [client]'") },
    { label: "Campaign", icon: <BarChart3 size={15} />, color: "text-warning", action: () => router.push("/dashboard/ads") },
  ];

  const activityIcons: Record<string, React.ReactNode> = {
    lead_gen: <Zap size={12} className="text-gold" />,
    automation: <Zap size={12} className="text-accent" />,
    website: <Globe size={12} className="text-success" />,
    custom: <Bot size={12} className="text-gold" />,
    ai_receptionist: <Phone size={12} className="text-warning" />,
  };

  return (
    <div className="fade-in space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Welcome back, <span className="text-gradient-animated">{profile?.full_name?.split(" ")[0]}</span></h1>
          <p className="text-muted text-xs mt-0.5">Command Center</p>
        </div>
        <div className="text-right flex items-center gap-3">
          <div className="flex items-center gap-1.5 text-[10px] text-gold bg-gold/[0.08] px-2.5 py-1 rounded-md border border-gold/10">
            <Activity size={10} />
            <span className="font-medium">{stats.trinityActions} AI actions</span>
          </div>
          <span className="text-xs text-muted">{new Date().toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}</span>
        </div>
      </div>

      {/* Trinity AI */}
      <TrinityAssistant profile={profile} />

      {/* Smart Suggestions */}
      <SmartSuggestions stats={stats} />

      {/* Live Agent Status */}
      <ScrollReveal delay={100}>
        <AgentStatusCards />
      </ScrollReveal>

      {/* Quick Actions */}
      <ScrollReveal delay={150}>
        <div className="grid grid-cols-4 md:grid-cols-8 gap-1.5">
          {quickActions.map((qa, i) => (
            <button key={i} onClick={qa.action}
              className="card-hover ripple p-2.5 flex flex-col items-center gap-1 text-center group">
              <span className={`${qa.color} group-hover:scale-110 group-hover:drop-shadow-[0_0_6px_currentColor] transition-all duration-300`}>{qa.icon}</span>
              <span className="text-[9px] text-muted group-hover:text-white transition-colors font-medium">{qa.label}</span>
            </button>
          ))}
        </div>
      </ScrollReveal>

      {/* Key Stats — premium animated */}
      <ScrollReveal delay={200}>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2.5">
          <StatCard label="MRR" value={formatCurrency(stats.totalMRR)} icon={<DollarSign size={14} />} changeType="positive" premium />
          <StatCard label="Leads Today" value={stats.leadsToday} icon={<Zap size={14} />} change={`${stats.totalLeads} total`} premium />
          <StatCard label="DMs Today" value={`${stats.dmsSentToday}/${stats.dmsTarget}`} icon={<MessageSquare size={14} />} premium />
          <StatCard label="Replies" value={stats.repliesThisWeek} icon={<TrendingUp size={14} />} change="this week" changeType="positive" premium />
          <StatCard label="Calls Booked" value={stats.callsBooked} icon={<Phone size={14} />} premium />
          <StatCard label="Deals Won" value={stats.dealsWon} icon={<Briefcase size={14} />} change={formatCurrency(stats.totalRevenue)} changeType="positive" premium />
        </div>
      </ScrollReveal>

      {/* DM Progress */}
      <ScrollReveal delay={250}>
      <div className="card p-3.5 shimmer">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-medium">Daily Outreach</span>
          <span className="text-[10px] font-mono text-gold">{stats.dmsSentToday}/{stats.dmsTarget}</span>
        </div>
        <div className="w-full bg-surface-light rounded-full h-2">
          <div className="bg-gradient-gold rounded-full h-2 transition-all duration-500"
            style={{ width: `${Math.min((stats.dmsSentToday / stats.dmsTarget) * 100, 100)}%` }} />
        </div>
        <div className="flex justify-between mt-2">
          {["Instagram", "LinkedIn", "Facebook", "TikTok"].map(p => (
            <div key={p} className="text-center">
              <p className="text-[9px] text-muted">{p}</p>
              <p className="text-[10px] font-mono font-medium">0/20</p>
            </div>
          ))}
        </div>
      </div>
      </ScrollReveal>

      <ScrollReveal delay={300}>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Agent Activity Feed */}
        <AgentActivityFeed />

        {/* Activity Feed */}
        <div className="card">
          <h2 className="section-header flex items-center gap-2">
            <Bot size={14} className="text-gold" /> Live Activity
          </h2>
          <div className="space-y-2 max-h-72 overflow-y-auto">
            {recentActivity.length === 0 ? (
              <p className="text-muted text-xs">No activity yet</p>
            ) : (
              recentActivity.map((a, i) => (
                <div key={i} className="flex items-start gap-2 py-1.5 border-b border-border/20 last:border-0">
                  <div className="mt-0.5">{activityIcons[a.action_type] || <Bot size={12} className="text-muted" />}</div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] leading-tight">{a.description}</p>
                    <p className="text-[9px] text-muted mt-0.5">{formatRelativeTime(a.created_at)}</p>
                  </div>
                  <StatusBadge status={a.status} />
                </div>
              ))
            )}
          </div>
        </div>

        {/* Top Clients */}
        <div className="card">
          <div className="flex items-center justify-between mb-3">
            <h2 className="section-header mb-0">Top Clients</h2>
            <Link href="/dashboard/clients" className="text-[10px] text-gold hover:text-gold-light flex items-center gap-0.5">
              View all <ArrowRight size={10} />
            </Link>
          </div>
          <div className="space-y-2">
            {topClients.length === 0 ? (
              <p className="text-muted text-xs">No clients yet</p>
            ) : (
              topClients.map((c, i) => (
                <Link key={i} href={`/dashboard/clients/${c.id}`}
                  className="flex items-center justify-between py-1.5 border-b border-border/20 last:border-0 hover:bg-surface-light/30 -mx-2 px-2 rounded transition-colors">
                  <div>
                    <p className="text-xs font-medium">{c.business_name}</p>
                    <p className="text-[10px] text-gold">{c.package_tier || "Client"}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-bold font-mono">{formatCurrency(c.mrr)}</p>
                    <div className="flex items-center gap-1">
                      <div className="w-8 bg-surface-light rounded-full h-1">
                        <div className={`h-1 rounded-full ${c.health_score > 75 ? "bg-success" : c.health_score > 50 ? "bg-warning" : "bg-danger"}`}
                          style={{ width: `${c.health_score}%` }} />
                      </div>
                      <span className="text-[9px] text-muted font-mono">{c.health_score}%</span>
                    </div>
                  </div>
                </Link>
              ))
            )}
          </div>
        </div>

        {/* Recent Leads */}
        <div className="card">
          <div className="flex items-center justify-between mb-3">
            <h2 className="section-header mb-0">Recent Leads</h2>
            <Link href="/dashboard/leads" className="text-[10px] text-gold hover:text-gold-light flex items-center gap-0.5">
              View all <ArrowRight size={10} />
            </Link>
          </div>
          <div className="space-y-2">
            {recentLeads.length === 0 ? (
              <p className="text-muted text-xs">No leads scraped yet</p>
            ) : (
              recentLeads.map((lead, i) => (
                <div key={i} className="flex items-center justify-between py-1.5 border-b border-border/20 last:border-0">
                  <div>
                    <p className="text-xs font-medium">{lead.business_name}</p>
                    <p className="text-[10px] text-muted">{lead.industry || "Unknown"} · {lead.source}</p>
                  </div>
                  <span className="text-[9px] text-muted font-mono">{formatRelativeTime(lead.scraped_at)}</span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
      </ScrollReveal>

      {/* Revenue + System Health */}
      <ScrollReveal delay={350}>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="card-premium">
          <h2 className="section-header flex items-center gap-2">
            <DollarSign size={14} className="text-gold" /> Revenue
          </h2>
          <div className="grid grid-cols-3 gap-3 mb-3">
            <div className="text-center p-2.5 bg-surface-light/50 rounded-lg border border-border/30">
              <p className="text-lg font-bold font-mono text-gold">{formatCurrency(stats.totalMRR)}</p>
              <p className="text-[9px] text-muted uppercase tracking-wider">Monthly</p>
            </div>
            <div className="text-center p-2.5 bg-surface-light/50 rounded-lg border border-border/30">
              <p className="text-lg font-bold font-mono text-success">{formatCurrency(stats.totalRevenue)}</p>
              <p className="text-[9px] text-muted uppercase tracking-wider">Total</p>
            </div>
            <div className="text-center p-2.5 bg-surface-light/50 rounded-lg border border-border/30">
              <p className="text-lg font-bold font-mono">{stats.dealsWon}</p>
              <p className="text-[9px] text-muted uppercase tracking-wider">Closed</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 text-[10px] text-muted">
            <TrendingUp size={10} className="text-success" />
            <span>{stats.activeClients} active clients</span>
          </div>
        </div>

        <div className="card">
          <div className="flex items-center justify-between mb-3">
            <h2 className="section-header mb-0 flex items-center gap-2">
              {stats.systemIssues > 0 ? <AlertTriangle size={14} className="text-danger" /> : <Activity size={14} className="text-success" />}
              System Status
            </h2>
            <Link href="/dashboard/monitor" className="text-[10px] text-gold hover:text-gold-light flex items-center gap-0.5">
              Details <ArrowRight size={10} />
            </Link>
          </div>
          <div className="flex items-center gap-3 mb-2">
            <div className={`text-2xl font-bold tracking-tight ${stats.systemIssues === 0 ? "text-success" : "text-danger"}`}>
              {stats.systemIssues === 0 ? "All Good" : `${stats.systemIssues} Issues`}
            </div>
            {stats.systemIssues === 0 && (
              <div className="glow-dot bg-success text-success" />
            )}
          </div>
          <p className="text-[10px] text-muted">14 integrations monitored</p>
        </div>
      </div>
      </ScrollReveal>
    </div>
  );
}

function TrinityAssistant({ profile }: { profile: { full_name?: string; role?: string } | null }) {
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [alwaysOn, setAlwaysOn] = useState(false);
  const [message, setMessage] = useState("");
  const [response, setResponse] = useState("");
  const [inputMode, setInputMode] = useState<"voice" | "text">("voice");
  const [processing, setProcessing] = useState(false);
  const [pulseIntensity, setPulseIntensity] = useState(0);

  useEffect(() => {
    if (isSpeaking) {
      const interval = setInterval(() => setPulseIntensity(Math.random()), 150);
      return () => clearInterval(interval);
    }
    setPulseIntensity(0);
  }, [isSpeaking]);

  // Hidden audio element ref for ElevenLabs playback
  const audioRef = useRef<HTMLAudioElement | null>(null);

  async function speak(text: string) {
    if (isMuted) return;
    setIsSpeaking(true);

    try {
      const res = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: text.substring(0, 500) }),
      });

      if (res.ok) {
        const blob = await res.blob();
        if (blob.size > 500 && blob.type.includes("audio")) {
          const url = URL.createObjectURL(blob);

          // Use a DOM audio element (most reliable across all environments)
          if (!audioRef.current) {
            audioRef.current = document.createElement("audio");
            document.body.appendChild(audioRef.current);
          }
          const audio = audioRef.current;
          audio.src = url;
          audio.volume = 1.0;
          audio.onended = () => { setIsSpeaking(false); URL.revokeObjectURL(url); };
          audio.onerror = () => { setIsSpeaking(false); URL.revokeObjectURL(url); fallbackSpeak(text); };
          await audio.play();
          return;
        }
      }
    } catch {}

    // Fallback to browser voice
    fallbackSpeak(text);
  }

  function fallbackSpeak(text: string) {
    if (!("speechSynthesis" in window)) { setIsSpeaking(false); return; }
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.rate = 0.95; u.pitch = 1.0; u.lang = "en-US";
    const voices = window.speechSynthesis.getVoices();
    const preferred = ["Microsoft Aria", "Microsoft Jenny", "Google US English", "Samantha"];
    let v = null;
    for (const name of preferred) { v = voices.find(x => x.name.includes(name)); if (v) break; }
    if (!v) v = voices.find(x => x.lang.startsWith("en"));
    if (v) u.voice = v;
    u.onstart = () => setIsSpeaking(true);
    u.onend = () => setIsSpeaking(false);
    window.speechSynthesis.speak(u);
  }

  function startListening() {
    const SR = (window as unknown as Record<string, unknown>).SpeechRecognition || (window as unknown as Record<string, unknown>).webkitSpeechRecognition;
    if (!SR) { setInputMode("text"); return; }
    const r = new (SR as new () => SpeechRecognition)();
    r.continuous = false; r.interimResults = false; r.lang = "en-US";
    r.onresult = (e: SpeechRecognitionEvent) => { setIsListening(false); sendMessage(e.results[0][0].transcript); };
    r.onerror = () => setIsListening(false);
    r.onend = () => setIsListening(false);
    r.start(); setIsListening(true);
  }

  async function sendMessage(text: string) {
    if (!text.trim()) return;
    setMessage(text); setProcessing(true); setResponse("");
    try {
      const isClient = profile?.role === "client";
      const res = await fetch(isClient ? "/api/trinity/client-chat" : "/api/trinity/chat", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text }),
      });
      const data = await res.json();
      const reply = data.reply || "I didn't catch that.";
      setResponse(reply);
      if (!isMuted) speak(reply);
    } catch { setResponse("Connection error. Try again."); }
    setProcessing(false);
  }

  return (
    <div className="card border-gold/10 overflow-hidden relative">
      {/* Background mesh */}
      <div className="absolute inset-0 bg-mesh opacity-50" />

      <div className="relative flex flex-col items-center py-5">
        {/* AI Talking Head */}
        <div className="relative mb-4">
          {/* Outer pulse rings */}
          <div className={`absolute inset-[-20px] rounded-full transition-all duration-500 ${isSpeaking ? "opacity-100" : "opacity-0"}`}
            style={{ background: `radial-gradient(circle, rgba(201,168,76,0.08) 0%, transparent 70%)` }} />
          <div className={`absolute inset-[-12px] rounded-full border transition-all duration-300 ${
            isSpeaking ? "border-gold/20 scale-110" : isListening ? "border-danger/20 scale-110" : "border-border/10 scale-100"
          }`} />

          <div className={`relative w-24 h-24 rounded-full flex items-center justify-center transition-all duration-200`}
            style={{
              background: isListening ? "radial-gradient(circle at 50% 40%, rgba(244,63,94,0.15), rgba(244,63,94,0.03))"
                : isSpeaking ? "radial-gradient(circle at 50% 40%, rgba(201,168,76,0.2), rgba(201,168,76,0.04))"
                : processing ? "radial-gradient(circle at 50% 40%, rgba(56,189,248,0.15), rgba(56,189,248,0.03))"
                : "radial-gradient(circle at 50% 40%, rgba(201,168,76,0.08), rgba(201,168,76,0.02))",
              boxShadow: isSpeaking ? "0 0 40px rgba(201,168,76,0.2)" : isListening ? "0 0 40px rgba(244,63,94,0.15)" : "none",
            }}>
            {/* Face */}
            <div className="relative w-full h-full flex flex-col items-center justify-center">
              {/* Eyes */}
              <div className="flex gap-4 mb-2">
                <div className={`w-2.5 h-2.5 rounded-full transition-all duration-200 ${
                  isListening ? "bg-danger" : isSpeaking ? "bg-gold" : processing ? "bg-accent" : "bg-gold/50"
                }`} style={{
                  transform: isSpeaking ? `translateY(${Math.sin(Date.now() / 400) * 1}px)` : "none",
                  boxShadow: isSpeaking ? "0 0 8px rgba(201,168,76,0.5)" : isListening ? "0 0 8px rgba(244,63,94,0.5)" : "none",
                }} />
                <div className={`w-2.5 h-2.5 rounded-full transition-all duration-200 ${
                  isListening ? "bg-danger" : isSpeaking ? "bg-gold" : processing ? "bg-accent" : "bg-gold/50"
                }`} style={{
                  transform: isSpeaking ? `translateY(${Math.sin(Date.now() / 400) * 1}px)` : "none",
                  boxShadow: isSpeaking ? "0 0 8px rgba(201,168,76,0.5)" : isListening ? "0 0 8px rgba(244,63,94,0.5)" : "none",
                }} />
              </div>
              {/* Mouth — animated when speaking */}
              <div className={`rounded-full transition-all duration-100 ${
                isListening ? "bg-danger/60" : isSpeaking ? "bg-gold/60" : processing ? "bg-accent/40" : "bg-gold/20"
              }`} style={{
                width: isSpeaking ? `${16 + pulseIntensity * 12}px` : isListening ? "20px" : "12px",
                height: isSpeaking ? `${6 + pulseIntensity * 10}px` : isListening ? "10px" : "4px",
                borderRadius: isSpeaking ? "50%" : "999px",
              }} />
              {/* Sound waves when speaking */}
              {isSpeaking && (
                <div className="absolute inset-0 flex items-end justify-center pb-2 gap-[2px] opacity-30">
                  {[0, 1, 2, 3, 4, 5, 6].map(i => (
                    <div key={i} className="w-[2px] bg-gold rounded-full" style={{
                      height: `${4 + Math.sin(Date.now() / 150 + i * 1.2) * 8 + pulseIntensity * 6}px`,
                    }} />
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-surface ${
            isListening ? "bg-danger animate-pulse" : isSpeaking ? "bg-gold animate-pulse" : "bg-success"
          }`} />
        </div>

        {/* Status */}
        <p className="text-xs font-medium text-gold mb-0.5">
          {isListening ? "Listening..." : isSpeaking ? "Speaking..." : processing ? "Thinking..." : `Hey ${profile?.full_name?.split(" ")[0] || "there"}`}
        </p>
        <p className="text-[10px] text-muted mb-3">
          {isListening ? "Speak now" : isSpeaking ? "Tap to stop" : "AI assistant ready"}
        </p>

        {/* Response */}
        {response && (
          <div className="max-w-lg w-full bg-surface-light/30 rounded-lg px-3.5 py-2.5 mb-3 mx-4 border border-border/20">
            <p className="text-xs text-center leading-relaxed">{response}</p>
          </div>
        )}
        {message && !response && !processing && (
          <div className="max-w-lg bg-gold/[0.08] rounded-lg px-3.5 py-2 mb-3 border border-gold/10">
            <p className="text-xs text-gold text-center">{message}</p>
          </div>
        )}

        {/* Controls */}
        <div className="flex items-center gap-3">
          <button onClick={() => { setIsMuted(!isMuted); if (!isMuted) window.speechSynthesis?.cancel(); setIsSpeaking(false); }}
            className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${isMuted ? "bg-danger/15 text-danger" : "bg-surface-light text-muted hover:text-white"}`}>
            {isMuted ? <VolumeX size={14} /> : <Volume2 size={14} />}
          </button>

          {inputMode === "voice" ? (
            <button onClick={() => { if (isListening) { window.speechSynthesis?.cancel(); setIsListening(false); } else if (isSpeaking) { window.speechSynthesis.cancel(); setIsSpeaking(false); } else startListening(); }}
              disabled={processing}
              className={`w-14 h-14 rounded-full flex items-center justify-center transition-all disabled:opacity-50 ${
                isListening ? "bg-danger shadow-lg shadow-danger/20 animate-pulse" :
                isSpeaking ? "bg-gold shadow-lg shadow-gold/20" :
                "bg-gradient-gold hover:shadow-glow-sm hover:scale-105 active:scale-95"
              }`}>
              {isListening ? <StopCircle size={20} className="text-white" /> :
               isSpeaking ? <StopCircle size={20} className="text-black" /> :
               <Mic size={20} className="text-black" />}
            </button>
          ) : (
            <form onSubmit={(e) => { e.preventDefault(); sendMessage(message); setMessage(""); }} className="flex gap-2">
              <input type="text" value={message} onChange={(e) => setMessage(e.target.value)}
                placeholder="Type a message..." disabled={processing}
                className="input rounded-full px-4 py-2 text-xs w-56" />
              <button type="submit" disabled={!message.trim() || processing}
                className="w-8 h-8 bg-gradient-gold rounded-full flex items-center justify-center disabled:opacity-30">
                <Send size={12} className="text-black" />
              </button>
            </form>
          )}

          <button onClick={() => setInputMode(inputMode === "voice" ? "text" : "voice")}
            className="w-8 h-8 rounded-full bg-surface-light flex items-center justify-center text-muted hover:text-white transition-colors">
            {inputMode === "voice" ? <MessageSquare size={14} /> : <Mic size={14} />}
          </button>
        </div>

        {/* Always-on */}
        {inputMode === "voice" && (
          <div className="flex items-center gap-2 mt-2.5">
            <button onClick={() => setAlwaysOn(!alwaysOn)}
              className={`text-[10px] px-2.5 py-1 rounded-full flex items-center gap-1 transition-all ${alwaysOn ? "bg-gold/10 text-gold border border-gold/20" : "bg-surface-light text-muted border border-border/50"}`}>
              <div className={`w-1.5 h-1.5 rounded-full ${alwaysOn ? "bg-gold animate-pulse" : "bg-muted"}`} />
              {alwaysOn ? "Always listening" : "Push to talk"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function SmartSuggestions({ stats }: { stats: DashboardStats }) {
  const router = useRouter();
  const suggestions: Array<{ text: string; action: () => void; icon: React.ReactNode; color: string; priority: "high" | "medium" | "low" }> = [];

  // Smart logic based on actual data
  if (stats.leadsToday === 0) {
    suggestions.push({
      text: "No leads scraped today — run the lead finder",
      action: () => router.push("/dashboard/scraper"),
      icon: <Users size={12} />,
      color: "text-warning",
      priority: "high",
    });
  }
  if (stats.dmsSentToday < 10) {
    suggestions.push({
      text: `Only ${stats.dmsSentToday} DMs sent — launch a DM run`,
      action: () => router.push("/dashboard/dm-controller"),
      icon: <Send size={12} />,
      color: "text-accent",
      priority: "high",
    });
  }
  if (stats.repliesThisWeek > 0) {
    suggestions.push({
      text: `${stats.repliesThisWeek} replies this week — follow up before they go cold`,
      action: () => router.push("/dashboard/outreach-hub"),
      icon: <MessageSquare size={12} />,
      color: "text-success",
      priority: "high",
    });
  }
  if (stats.systemIssues > 0) {
    suggestions.push({
      text: `${stats.systemIssues} system issue${stats.systemIssues > 1 ? "s" : ""} — check health monitor`,
      action: () => router.push("/dashboard/monitor"),
      icon: <AlertTriangle size={12} />,
      color: "text-danger",
      priority: "high",
    });
  }
  if (stats.activeClients > 0 && stats.totalMRR > 0) {
    suggestions.push({
      text: "Generate this week's social content for all clients",
      action: () => router.push("/dashboard/social-manager"),
      icon: <Sparkles size={12} />,
      color: "text-gold",
      priority: "medium",
    });
  }
  if (stats.callsBooked > 0) {
    suggestions.push({
      text: `${stats.callsBooked} calls booked — prepare proposals`,
      action: () => router.push("/dashboard/proposals"),
      icon: <FileText size={12} />,
      color: "text-gold",
      priority: "medium",
    });
  }

  // Always show at least one suggestion
  if (suggestions.length === 0) {
    suggestions.push({
      text: "All systems running smooth — keep building",
      action: () => {},
      icon: <Zap size={12} />,
      color: "text-success",
      priority: "low",
    });
  }

  // Show max 3 high priority first
  const sorted = suggestions.sort((a, b) => {
    const order = { high: 0, medium: 1, low: 2 };
    return order[a.priority] - order[b.priority];
  }).slice(0, 3);

  return (
    <div className="flex gap-2 overflow-x-auto pb-1">
      {sorted.map((s, i) => (
        <button key={i} onClick={s.action}
          className="flex items-center gap-2 px-3 py-2 rounded-xl border border-border/20 hover:border-gold/15 bg-surface-light/20 transition-all shrink-0 group">
          <span className={s.color}>{s.icon}</span>
          <span className="text-[10px] text-muted group-hover:text-white transition-colors">{s.text}</span>
          <ArrowRight size={10} className="text-muted/30 group-hover:text-gold transition-colors" />
        </button>
      ))}
    </div>
  );
}

function ClientDashboard() {
  const { profile } = useAuth();
  const router = useRouter();

  return (
    <div className="fade-in space-y-5">
      <h1 className="text-xl font-bold tracking-tight">Welcome, {profile?.full_name}</h1>
      <p className="text-muted text-xs">Your client portal</p>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <button onClick={() => router.push("/dashboard/portal")} className="card-hover p-5 text-center">
          <Briefcase size={20} className="text-gold mx-auto mb-2" />
          <span className="text-xs font-medium">My Services</span>
        </button>
        <button onClick={() => router.push("/dashboard/portal")} className="card-hover p-5 text-center">
          <FileText size={20} className="text-accent mx-auto mb-2" />
          <span className="text-xs font-medium">Invoices</span>
        </button>
        <button onClick={() => router.push("/dashboard/portal")} className="card-hover p-5 text-center">
          <Film size={20} className="text-warning mx-auto mb-2" />
          <span className="text-xs font-medium">Content</span>
        </button>
        <button onClick={() => router.push("/dashboard/portal")} className="card-hover p-5 text-center">
          <Send size={20} className="text-success mx-auto mb-2" />
          <span className="text-xs font-medium">Contact Us</span>
        </button>
      </div>
    </div>
  );
}
