"use client";

import { useAuth } from "@/lib/auth-context";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import StatCard from "@/components/ui/stat-card";
import StatusBadge from "@/components/ui/status-badge";
import { formatCurrency, formatRelativeTime } from "@/lib/utils";
import {
  Zap, Users, DollarSign, MessageSquare, TrendingUp,
  Phone, Bot, AlertTriangle, Plus, FileText, Sparkles,
  Send, BarChart3, Globe, Film, Briefcase, Mic, StopCircle,
  Volume2, VolumeX
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
    { label: "Generate Proposal", icon: <FileText size={16} />, color: "text-gold", action: () => router.push("/dashboard/clients") },
    { label: "New Client", icon: <Plus size={16} />, color: "text-success", action: () => router.push("/dashboard/onboard") },
    { label: "Generate Script", icon: <Sparkles size={16} />, color: "text-info", action: () => router.push("/dashboard/content") },
    { label: "Create Workflow", icon: <Zap size={16} />, color: "text-warning", action: () => router.push("/dashboard/workflows") },
    { label: "Ask Trinity", icon: <Bot size={16} />, color: "text-gold", action: () => router.push("/dashboard/trinity") },
    { label: "View Leads", icon: <Users size={16} />, color: "text-success", action: () => router.push("/dashboard/leads") },
    { label: "Build Website", icon: <Globe size={16} />, color: "text-info", action: () => toast("Use Trinity: 'Build website for [client]'") },
    { label: "New Campaign", icon: <BarChart3 size={16} />, color: "text-warning", action: () => router.push("/dashboard/ads") },
  ];

  const activityIcons: Record<string, React.ReactNode> = {
    lead_gen: <Zap size={14} className="text-gold" />,
    automation: <Zap size={14} className="text-info" />,
    website: <Globe size={14} className="text-success" />,
    custom: <Bot size={14} className="text-gold" />,
    ai_receptionist: <Phone size={14} className="text-warning" />,
  };

  return (
    <div className="fade-in space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Welcome back, {profile?.full_name?.split(" ")[0]}</h1>
          <p className="text-muted text-sm">ShortStack Command Center</p>
        </div>
        <div className="text-right">
          <p className="text-sm text-muted">{new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}</p>
          <p className="text-xs text-gold">{stats.trinityActions} AI actions today</p>
        </div>
      </div>

      {/* JARVIS AI Assistant */}
      <JarvisAssistant profile={profile} />

      {/* Quick Actions */}
      <div className="grid grid-cols-4 md:grid-cols-8 gap-2">
        {quickActions.map((qa, i) => (
          <button key={i} onClick={qa.action}
            className="card-hover p-3 flex flex-col items-center gap-1.5 text-center group">
            <span className={`${qa.color} group-hover:scale-110 transition-transform`}>{qa.icon}</span>
            <span className="text-[10px] text-muted group-hover:text-white transition-colors">{qa.label}</span>
          </button>
        ))}
      </div>

      {/* Key Stats */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <StatCard label="MRR" value={formatCurrency(stats.totalMRR)} icon={<DollarSign size={16} />} changeType="positive" />
        <StatCard label="Leads Today" value={stats.leadsToday} icon={<Zap size={16} />} change={`${stats.totalLeads} total`} />
        <StatCard label="DMs Today" value={`${stats.dmsSentToday}/${stats.dmsTarget}`} icon={<MessageSquare size={16} />} />
        <StatCard label="Replies" value={stats.repliesThisWeek} icon={<TrendingUp size={16} />} change="this week" changeType="positive" />
        <StatCard label="Calls Booked" value={stats.callsBooked} icon={<Phone size={16} />} />
        <StatCard label="Deals Won" value={stats.dealsWon} icon={<Briefcase size={16} />} change={formatCurrency(stats.totalRevenue)} changeType="positive" />
      </div>

      {/* DM Progress */}
      <div className="card p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium">Daily Outreach Progress</span>
          <span className="text-xs text-gold">{stats.dmsSentToday}/{stats.dmsTarget} DMs</span>
        </div>
        <div className="w-full bg-surface-light rounded-full h-3">
          <div className="bg-gradient-to-r from-gold-dark to-gold rounded-full h-3 transition-all duration-500"
            style={{ width: `${Math.min((stats.dmsSentToday / stats.dmsTarget) * 100, 100)}%` }} />
        </div>
        <div className="flex justify-between mt-2">
          {["Instagram", "LinkedIn", "Facebook", "TikTok"].map(p => (
            <div key={p} className="text-center">
              <p className="text-[10px] text-muted">{p}</p>
              <p className="text-xs font-medium">0/20</p>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Activity Feed */}
        <div className="card lg:col-span-1">
          <h2 className="section-header flex items-center gap-2">
            <Bot size={16} className="text-gold" /> Live Activity
          </h2>
          <div className="space-y-3 max-h-80 overflow-y-auto">
            {recentActivity.length === 0 ? (
              <p className="text-muted text-sm">No activity yet</p>
            ) : (
              recentActivity.map((a, i) => (
                <div key={i} className="flex items-start gap-2.5 py-2 border-b border-border/30 last:border-0">
                  <div className="mt-0.5">{activityIcons[a.action_type] || <Bot size={14} className="text-muted" />}</div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs leading-tight">{a.description}</p>
                    <p className="text-[10px] text-muted mt-0.5">{formatRelativeTime(a.created_at)}</p>
                  </div>
                  <StatusBadge status={a.status} />
                </div>
              ))
            )}
          </div>
        </div>

        {/* Top Clients */}
        <div className="card lg:col-span-1">
          <div className="flex items-center justify-between mb-4">
            <h2 className="section-header mb-0">Top Clients</h2>
            <Link href="/dashboard/clients" className="text-xs text-gold hover:text-gold-light">View all</Link>
          </div>
          <div className="space-y-3">
            {topClients.length === 0 ? (
              <p className="text-muted text-sm">No clients yet</p>
            ) : (
              topClients.map((c, i) => (
                <Link key={i} href={`/dashboard/clients/${c.id}`}
                  className="flex items-center justify-between py-2 border-b border-border/30 last:border-0 hover:bg-surface-light/50 -mx-2 px-2 rounded transition-colors">
                  <div>
                    <p className="text-sm font-medium">{c.business_name}</p>
                    <p className="text-xs text-gold">{c.package_tier || "Client"}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold">{formatCurrency(c.mrr)}</p>
                    <div className="flex items-center gap-1">
                      <div className="w-8 bg-surface-light rounded-full h-1.5">
                        <div className={`h-1.5 rounded-full ${c.health_score > 75 ? "bg-success" : c.health_score > 50 ? "bg-warning" : "bg-danger"}`}
                          style={{ width: `${c.health_score}%` }} />
                      </div>
                      <span className="text-[10px] text-muted">{c.health_score}%</span>
                    </div>
                  </div>
                </Link>
              ))
            )}
          </div>
        </div>

        {/* Recent Leads */}
        <div className="card lg:col-span-1">
          <div className="flex items-center justify-between mb-4">
            <h2 className="section-header mb-0">Recent Leads</h2>
            <Link href="/dashboard/leads" className="text-xs text-gold hover:text-gold-light">View all</Link>
          </div>
          <div className="space-y-3">
            {recentLeads.length === 0 ? (
              <p className="text-muted text-sm">No leads scraped yet today</p>
            ) : (
              recentLeads.map((lead, i) => (
                <div key={i} className="flex items-center justify-between py-2 border-b border-border/30 last:border-0">
                  <div>
                    <p className="text-sm font-medium">{lead.business_name}</p>
                    <p className="text-xs text-muted">{lead.industry || "Unknown"} · {lead.source}</p>
                  </div>
                  <span className="text-[10px] text-muted">{formatRelativeTime(lead.scraped_at)}</span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Revenue + System Health Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card">
          <h2 className="section-header flex items-center gap-2">
            <DollarSign size={16} className="text-gold" /> Revenue Overview
          </h2>
          <div className="grid grid-cols-3 gap-4 mb-4">
            <div className="text-center p-3 bg-surface-light rounded-lg">
              <p className="text-xl font-bold text-gold">{formatCurrency(stats.totalMRR)}</p>
              <p className="text-[10px] text-muted">Monthly Recurring</p>
            </div>
            <div className="text-center p-3 bg-surface-light rounded-lg">
              <p className="text-xl font-bold text-success">{formatCurrency(stats.totalRevenue)}</p>
              <p className="text-[10px] text-muted">Total Revenue</p>
            </div>
            <div className="text-center p-3 bg-surface-light rounded-lg">
              <p className="text-xl font-bold">{stats.dealsWon}</p>
              <p className="text-[10px] text-muted">Deals Closed</p>
            </div>
          </div>
          <div className="flex items-center gap-2 text-xs text-muted">
            <TrendingUp size={12} className="text-success" />
            <span>{stats.activeClients} active clients generating revenue</span>
          </div>
        </div>

        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="section-header mb-0 flex items-center gap-2">
              {stats.systemIssues > 0 ? <AlertTriangle size={16} className="text-danger" /> : <Zap size={16} className="text-success" />}
              System Status
            </h2>
            <Link href="/dashboard/monitor" className="text-xs text-gold hover:text-gold-light">Details</Link>
          </div>
          <div className="flex items-center gap-4 mb-3">
            <div className={`text-3xl font-bold ${stats.systemIssues === 0 ? "text-success" : "text-danger"}`}>
              {stats.systemIssues === 0 ? "All Good" : `${stats.systemIssues} Issues`}
            </div>
          </div>
          <p className="text-xs text-muted">14 integrations monitored · Last checked at daily brief</p>
        </div>
      </div>
    </div>
  );
}

function JarvisAssistant({ profile }: { profile: { full_name?: string; role?: string } | null }) {
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [message, setMessage] = useState("");
  const [response, setResponse] = useState("");
  const [inputMode, setInputMode] = useState<"voice" | "text">("voice");
  const [processing, setProcessing] = useState(false);
  const [pulseIntensity, setPulseIntensity] = useState(0);

  // Animate pulse when speaking
  useEffect(() => {
    if (isSpeaking) {
      const interval = setInterval(() => setPulseIntensity(Math.random()), 150);
      return () => clearInterval(interval);
    }
    setPulseIntensity(0);
  }, [isSpeaking]);

  function speak(text: string) {
    if (isMuted || !("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.rate = 1.0; u.pitch = 1.0; u.lang = "en-US";
    const voices = window.speechSynthesis.getVoices();
    const v = voices.find(v => v.name.includes("Google") && v.lang.startsWith("en")) || voices.find(v => v.lang.startsWith("en"));
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
    <div className="card border-gold/20 bg-gradient-to-b from-gold/5 to-transparent overflow-hidden">
      <div className="flex flex-col items-center py-6">
        {/* AI Avatar — Animated orb */}
        <div className="relative mb-6">
          {/* Outer glow rings */}
          <div className={`absolute inset-[-20px] rounded-full border border-gold/10 transition-all duration-300 ${isSpeaking || isListening ? "scale-110 opacity-100" : "scale-100 opacity-30"}`} />
          <div className={`absolute inset-[-12px] rounded-full border border-gold/20 transition-all duration-300 ${isSpeaking || isListening ? "scale-105 opacity-100" : "scale-100 opacity-20"}`} />

          {/* Main orb */}
          <div className={`relative w-24 h-24 rounded-full flex items-center justify-center transition-all duration-200 ${
            isListening ? "bg-danger/20 shadow-[0_0_40px_rgba(239,68,68,0.3)]" :
            isSpeaking ? "bg-gold/20 shadow-[0_0_40px_rgba(201,168,76,0.4)]" :
            processing ? "bg-info/20 shadow-[0_0_30px_rgba(59,130,246,0.3)]" :
            "bg-gold/10 shadow-[0_0_20px_rgba(201,168,76,0.15)]"
          }`}>
            {/* Inner animated bars */}
            <div className="flex items-end gap-[3px] h-10">
              {[0, 1, 2, 3, 4].map(i => (
                <div key={i} className={`w-[4px] rounded-full transition-all duration-150 ${
                  isListening ? "bg-danger" : isSpeaking ? "bg-gold" : processing ? "bg-info" : "bg-gold/40"
                }`} style={{
                  height: isSpeaking || isListening
                    ? `${12 + Math.sin(Date.now() / 200 + i * 1.5) * 14 + pulseIntensity * 10}px`
                    : processing ? `${8 + Math.sin(Date.now() / 300 + i) * 6}px` : "8px",
                }} />
              ))}
            </div>
          </div>

          {/* Status dot */}
          <div className={`absolute bottom-0 right-0 w-4 h-4 rounded-full border-2 border-surface ${
            isListening ? "bg-danger animate-pulse" : isSpeaking ? "bg-gold animate-pulse" : "bg-success"
          }`} />
        </div>

        {/* Status text */}
        <p className="text-sm font-medium text-gold mb-1">
          {isListening ? "Listening..." : isSpeaking ? "Speaking..." : processing ? "Thinking..." : `Hey ${profile?.full_name?.split(" ")[0] || "there"}`}
        </p>
        <p className="text-xs text-muted mb-4">
          {isListening ? "Speak now — I'm all ears" : isSpeaking ? "Tap to stop" : "Your AI assistant is ready"}
        </p>

        {/* Response bubble */}
        {response && (
          <div className="max-w-lg w-full bg-surface-light/50 rounded-xl px-4 py-3 mb-4 mx-4">
            <p className="text-sm text-center leading-relaxed">{response}</p>
          </div>
        )}
        {message && !response && !processing && (
          <div className="max-w-lg bg-gold/10 rounded-xl px-4 py-2 mb-4">
            <p className="text-sm text-gold text-center">{message}</p>
          </div>
        )}

        {/* Controls */}
        <div className="flex items-center gap-4">
          <button onClick={() => { setIsMuted(!isMuted); if (!isMuted) window.speechSynthesis?.cancel(); setIsSpeaking(false); }}
            className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${isMuted ? "bg-danger/20 text-danger" : "bg-surface-light text-muted hover:text-white"}`}>
            {isMuted ? <VolumeX size={16} /> : <Volume2 size={16} />}
          </button>

          {inputMode === "voice" ? (
            <button onClick={() => { if (isListening) { window.speechSynthesis?.cancel(); setIsListening(false); } else if (isSpeaking) { window.speechSynthesis.cancel(); setIsSpeaking(false); } else startListening(); }}
              disabled={processing}
              className={`w-16 h-16 rounded-full flex items-center justify-center transition-all disabled:opacity-50 ${
                isListening ? "bg-danger shadow-lg shadow-danger/30 animate-pulse" :
                isSpeaking ? "bg-gold shadow-lg shadow-gold/30" :
                "bg-gold hover:bg-gold-light shadow-lg shadow-gold/20 hover:scale-105 active:scale-95"
              }`}>
              {isListening ? <StopCircle size={24} className="text-white" /> :
               isSpeaking ? <StopCircle size={24} className="text-black" /> :
               <Mic size={24} className="text-black" />}
            </button>
          ) : (
            <form onSubmit={(e) => { e.preventDefault(); sendMessage(message); setMessage(""); }} className="flex gap-2">
              <input type="text" value={message} onChange={(e) => setMessage(e.target.value)}
                placeholder="Type a message..." disabled={processing}
                className="bg-surface-light border border-border rounded-full px-4 py-2 text-sm text-white placeholder-muted focus:outline-none focus:border-gold/50 w-64" />
              <button type="submit" disabled={!message.trim() || processing}
                className="w-10 h-10 bg-gold rounded-full flex items-center justify-center disabled:opacity-30">
                <Send size={14} className="text-black" />
              </button>
            </form>
          )}

          <button onClick={() => setInputMode(inputMode === "voice" ? "text" : "voice")}
            className="w-10 h-10 rounded-full bg-surface-light flex items-center justify-center text-muted hover:text-white transition-colors">
            {inputMode === "voice" ? <MessageSquare size={16} /> : <Mic size={16} />}
          </button>
        </div>
      </div>
    </div>
  );
}

function ClientDashboard() {
  const { profile } = useAuth();
  const router = useRouter();

  return (
    <div className="fade-in space-y-6">
      <h1 className="text-2xl font-bold">Welcome, {profile?.full_name}</h1>
      <p className="text-muted">Your client portal — view services, tasks, invoices, and deliverables.</p>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <button onClick={() => router.push("/dashboard/portal")} className="card-hover p-6 text-center">
          <Briefcase size={24} className="text-gold mx-auto mb-2" />
          <span className="text-sm">My Services</span>
        </button>
        <button onClick={() => router.push("/dashboard/portal")} className="card-hover p-6 text-center">
          <FileText size={24} className="text-info mx-auto mb-2" />
          <span className="text-sm">Invoices</span>
        </button>
        <button onClick={() => router.push("/dashboard/portal")} className="card-hover p-6 text-center">
          <Film size={24} className="text-warning mx-auto mb-2" />
          <span className="text-sm">Content</span>
        </button>
        <button onClick={() => router.push("/dashboard/portal")} className="card-hover p-6 text-center">
          <Send size={24} className="text-success mx-auto mb-2" />
          <span className="text-sm">Contact Us</span>
        </button>
      </div>
    </div>
  );
}
