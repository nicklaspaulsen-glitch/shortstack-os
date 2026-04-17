"use client";

import React, { Fragment, useState, useCallback } from "react";
import { useAuth } from "@/lib/auth-context";
import { createClient } from "@/lib/supabase/client";
import {
  Phone, PhoneIncoming, PhoneOff, PhoneMissed, PhoneForwarded,
  Play, Pause, Copy, Check, X, Plus, Trash2, GripVertical,
  Clock, Users, CalendarCheck, BarChart3, Settings2, Mic,
  Volume2,
  FileText, Filter, Search, TrendingUp, Target, MapPin,
  ArrowRight, AlertCircle, Star, Zap, MessageSquare,
  Headphones, Shield, RefreshCw, ExternalLink
} from "lucide-react";
import toast from "react-hot-toast";
import PageHero from "@/components/ui/page-hero";
import PageAI from "@/components/page-ai";

/* ── Types ── */
type TabKey = "calls" | "config" | "analytics" | "booking";
type CallOutcome = "qualified" | "not_qualified" | "voicemail" | "transferred" | "spam" | "missed";

interface CallRecord {
  id: string;
  callerName: string;
  callerPhone: string;
  time: string;
  duration: number;
  outcome: CallOutcome;
  qualificationScore: number;
  transcript: TranscriptLine[];
  location: string;
  recordingUrl: string;
  bookedAppointment: boolean;
}

interface TranscriptLine {
  speaker: "ai" | "caller";
  text: string;
  timestamp: string;
}

interface QualificationQuestion {
  id: string;
  text: string;
  required: boolean;
}

interface RoutingRule {
  id: string;
  condition: string;
  action: string;
  detail: string;
  enabled: boolean;
}

interface WorkingHour {
  day: string;
  enabled: boolean;
  start: string;
  end: string;
}

/* ── Mock Data ── */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const MOCK_TRANSCRIPTS: Record<string, TranscriptLine[]> = {};

const MOCK_CALLS: CallRecord[] = [];

const OUTCOME_CONFIG: Record<CallOutcome, { label: string; color: string; bg: string; icon: React.ElementType }> = {
  qualified: { label: "Qualified", color: "text-emerald-400", bg: "bg-emerald-500/10 border-emerald-500/20", icon: Check },
  not_qualified: { label: "Not Qualified", color: "text-amber-400", bg: "bg-amber-500/10 border-amber-500/20", icon: X },
  voicemail: { label: "Voicemail", color: "text-blue-400", bg: "bg-blue-500/10 border-blue-500/20", icon: MessageSquare },
  transferred: { label: "Transferred", color: "text-purple-400", bg: "bg-purple-500/10 border-purple-500/20", icon: PhoneForwarded },
  spam: { label: "Spam", color: "text-red-400", bg: "bg-red-500/10 border-red-500/20", icon: Shield },
  missed: { label: "Missed", color: "text-muted", bg: "bg-surface-light border-border", icon: PhoneMissed },
};

const VOICE_OPTIONS = [
  { id: "v1", name: "Ava (Professional Female)", gender: "female", style: "professional" },
  { id: "v2", name: "Marcus (Professional Male)", gender: "male", style: "professional" },
  { id: "v3", name: "Sophie (Friendly Female)", gender: "female", style: "friendly" },
  { id: "v4", name: "James (Friendly Male)", gender: "male", style: "friendly" },
  { id: "v5", name: "Elena (Warm Female)", gender: "female", style: "warm" },
  { id: "v6", name: "Noah (Authoritative Male)", gender: "male", style: "authoritative" },
];

const LANGUAGE_OPTIONS = [
  "English (US)", "English (UK)", "Spanish", "French", "Portuguese", "German", "Italian",
];

const DEFAULT_QUESTIONS: QualificationQuestion[] = [
  { id: "q1", text: "What service are you interested in?", required: true },
  { id: "q2", text: "What's your timeline for getting started?", required: true },
  { id: "q3", text: "What's your budget range?", required: true },
  { id: "q4", text: "How did you hear about us?", required: false },
  { id: "q5", text: "What's the best email to reach you?", required: false },
];

const DEFAULT_ROUTING: RoutingRule[] = [
  { id: "r1", condition: "Caller is qualified (score > 70)", action: "Book Calendly appointment", detail: "Offer available time slots and confirm booking", enabled: true },
  { id: "r2", condition: "Caller is an existing client", action: "Transfer to account manager", detail: "Warm transfer with context summary", enabled: true },
  { id: "r3", condition: "Caller identified as spam", action: "Politely end call", detail: "Thank them and disconnect after 10 seconds", enabled: true },
  { id: "r4", condition: "After hours call received", action: "Take voicemail", detail: "Collect name, number, and reason for calling", enabled: true },
  { id: "r5", condition: "Caller requests human agent", action: "Transfer to team", detail: "Transfer to next available team member", enabled: true },
  { id: "r6", condition: "Caller asks about pricing", action: "Share package overview", detail: "Provide tier summary, then qualify further", enabled: false },
];

const DEFAULT_HOURS: WorkingHour[] = [
  { day: "Monday", enabled: true, start: "09:00", end: "18:00" },
  { day: "Tuesday", enabled: true, start: "09:00", end: "18:00" },
  { day: "Wednesday", enabled: true, start: "09:00", end: "18:00" },
  { day: "Thursday", enabled: true, start: "09:00", end: "18:00" },
  { day: "Friday", enabled: true, start: "09:00", end: "17:00" },
  { day: "Saturday", enabled: false, start: "10:00", end: "14:00" },
  { day: "Sunday", enabled: false, start: "10:00", end: "14:00" },
];

const WEEKLY_CALLS = [
  { day: "Mon", calls: 0, qualified: 0 },
  { day: "Tue", calls: 0, qualified: 0 },
  { day: "Wed", calls: 0, qualified: 0 },
  { day: "Thu", calls: 0, qualified: 0 },
  { day: "Fri", calls: 0, qualified: 0 },
  { day: "Sat", calls: 0, qualified: 0 },
  { day: "Sun", calls: 0, qualified: 0 },
];

const HOURLY_DATA = [
  [0,0,0,0,0,0,0], [0,0,0,0,0,0,0], [0,0,0,0,0,0,0], [0,0,0,0,0,0,0],
  [0,0,0,0,0,0,0], [0,0,0,0,0,0,0], [0,0,0,0,0,0,0], [0,0,0,0,0,0,0],
  [0,0,0,0,0,0,0], [0,0,0,0,0,0,0], [0,0,0,0,0,0,0], [0,0,0,0,0,0,0],
  [0,0,0,0,0,0,0], [0,0,0,0,0,0,0], [0,0,0,0,0,0,0], [0,0,0,0,0,0,0],
  [0,0,0,0,0,0,0], [0,0,0,0,0,0,0], [0,0,0,0,0,0,0], [0,0,0,0,0,0,0],
  [0,0,0,0,0,0,0], [0,0,0,0,0,0,0], [0,0,0,0,0,0,0], [0,0,0,0,0,0,0],
];

const TOP_LOCATIONS: { city: string; state: string; calls: number; pct: number }[] = [];

/* ── Helpers ── */
function fmtDuration(sec: number): string {
  if (sec === 0) return "--";
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return m > 0 ? `${m}m ${s.toString().padStart(2, "0")}s` : `${s}s`;
}

function fmtTime(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  const hours = d.getHours();
  const mins = d.getMinutes().toString().padStart(2, "0");
  const ampm = hours >= 12 ? "PM" : "AM";
  const h12 = hours % 12 || 12;
  const timeStr = `${h12}:${mins} ${ampm}`;
  if (diff < 86400000) return `Today ${timeStr}`;
  if (diff < 172800000) return `Yesterday ${timeStr}`;
  return `${d.toLocaleDateString("en-US", { month: "short", day: "numeric" })} ${timeStr}`;
}

function heatColor(val: number): string {
  if (val === 0) return "bg-surface-light";
  if (val <= 1) return "bg-emerald-900/40";
  if (val <= 2) return "bg-emerald-700/50";
  if (val <= 3) return "bg-emerald-600/60";
  if (val <= 4) return "bg-emerald-500/70";
  return "bg-emerald-400/80";
}

/* ── Component ── */
export default function VoiceReceptionistPage() {
  useAuth();
  const supabase = createClient();
  void supabase; // available for future DB calls

  /* ── State ── */
  const [activeTab, setActiveTab] = useState<TabKey>("calls");
  const [isActive, setIsActive] = useState(true);
  const [copied, setCopied] = useState(false);
  const phoneNumber = "";

  // Call log state
  const [calls] = useState<CallRecord[]>(MOCK_CALLS);
  const [expandedCall, setExpandedCall] = useState<string | null>(null);
  const [outcomeFilter, setOutcomeFilter] = useState<CallOutcome | "all">("all");
  const [callSearch, setCallSearch] = useState("");
  const [playingRecording, setPlayingRecording] = useState<string | null>(null);

  // Config state
  const [greeting, setGreeting] = useState(
    "Thank you for calling ShortStack Digital. My name is Ava, your virtual receptionist. How can I help you today?"
  );
  const [businessName, setBusinessName] = useState("ShortStack Digital");
  const [services, setServices] = useState("Social Media Management, Website Design, SEO, Paid Advertising, Brand Identity");
  const [pricing, setPricing] = useState("Starter: $497/mo, Growth: $997/mo, Scale: $1,997/mo");
  const [hoursText, setHoursText] = useState("Mon-Fri 9AM-6PM, Sat-Sun Closed");
  const [questions, setQuestions] = useState<QualificationQuestion[]>(DEFAULT_QUESTIONS);
  const [newQuestion, setNewQuestion] = useState("");
  const [routingRules, setRoutingRules] = useState<RoutingRule[]>(DEFAULT_ROUTING);
  const [selectedVoice, setSelectedVoice] = useState("v1");
  const [voiceSpeed, setVoiceSpeed] = useState(1.0);
  const [language, setLanguage] = useState("English (US)");
  const [workingHours, setWorkingHours] = useState<WorkingHour[]>(DEFAULT_HOURS);

  // Booking state
  const [calendlyUrl, setCalendlyUrl] = useState("https://calendly.com/shortstack-digital/strategy-call");
  const [confirmSms, setConfirmSms] = useState(true);
  const [autoLogBooking, setAutoLogBooking] = useState(true);

  // Drag state for questions
  const [dragIdx, setDragIdx] = useState<number | null>(null);

  /* ── Derived Stats ── */
  const todayCalls = calls.filter(c => c.time.startsWith("2026-04-15"));
  const callsToday = todayCalls.length;
  const avgDuration = Math.round(calls.filter(c => c.duration > 0).reduce((a, c) => a + c.duration, 0) / Math.max(calls.filter(c => c.duration > 0).length, 1));
  const leadsToday = todayCalls.filter(c => c.outcome === "qualified").length;
  const bookingsToday = todayCalls.filter(c => c.bookedAppointment).length;

  const filteredCalls = calls.filter(c => {
    if (outcomeFilter !== "all" && c.outcome !== outcomeFilter) return false;
    if (callSearch && !c.callerName.toLowerCase().includes(callSearch.toLowerCase()) && !c.callerPhone.includes(callSearch)) return false;
    return true;
  });

  // Analytics derived
  const totalCalls = calls.length;
  const qualifiedCalls = calls.filter(c => c.outcome === "qualified").length;
  const qualificationRate = totalCalls > 0 ? Math.round((qualifiedCalls / totalCalls) * 100) : 0;
  const bookingRate = Math.round((calls.filter(c => c.bookedAppointment).length / Math.max(qualifiedCalls, 1)) * 100);
  const avgScore = Math.round(calls.filter(c => c.qualificationScore > 0).reduce((a, c) => a + c.qualificationScore, 0) / Math.max(calls.filter(c => c.qualificationScore > 0).length, 1));
  const outcomeCounts: Record<CallOutcome, number> = {
    qualified: calls.filter(c => c.outcome === "qualified").length,
    not_qualified: calls.filter(c => c.outcome === "not_qualified").length,
    voicemail: calls.filter(c => c.outcome === "voicemail").length,
    transferred: calls.filter(c => c.outcome === "transferred").length,
    spam: calls.filter(c => c.outcome === "spam").length,
    missed: calls.filter(c => c.outcome === "missed").length,
  };

  /* ── Handlers ── */
  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText("+13055557890");
    setCopied(true);
    toast.success("Phone number copied");
    setTimeout(() => setCopied(false), 2000);
  }, []);

  const toggleActive = useCallback(() => {
    setIsActive(prev => {
      toast.success(prev ? "Receptionist deactivated" : "Receptionist activated");
      return !prev;
    });
  }, []);

  const addQuestion = useCallback(() => {
    if (!newQuestion.trim()) return;
    setQuestions(prev => [...prev, { id: `q${Date.now()}`, text: newQuestion.trim(), required: false }]);
    setNewQuestion("");
    toast.success("Question added");
  }, [newQuestion]);

  const removeQuestion = useCallback((id: string) => {
    setQuestions(prev => prev.filter(q => q.id !== id));
    toast.success("Question removed");
  }, []);

  const toggleQuestionRequired = useCallback((id: string) => {
    setQuestions(prev => prev.map(q => q.id === id ? { ...q, required: !q.required } : q));
  }, []);

  const toggleRoutingRule = useCallback((id: string) => {
    setRoutingRules(prev => prev.map(r => r.id === id ? { ...r, enabled: !r.enabled } : r));
  }, []);

  const toggleDay = useCallback((day: string) => {
    setWorkingHours(prev => prev.map(h => h.day === day ? { ...h, enabled: !h.enabled } : h));
  }, []);

  const updateHour = useCallback((day: string, field: "start" | "end", value: string) => {
    setWorkingHours(prev => prev.map(h => h.day === day ? { ...h, [field]: value } : h));
  }, []);

  const handleDragStart = useCallback((idx: number) => { setDragIdx(idx); }, []);
  const handleDragOver = useCallback((e: React.DragEvent, idx: number) => {
    e.preventDefault();
    if (dragIdx === null || dragIdx === idx) return;
    setQuestions(prev => {
      const items = [...prev];
      const [moved] = items.splice(dragIdx, 1);
      items.splice(idx, 0, moved);
      return items;
    });
    setDragIdx(idx);
  }, [dragIdx]);
  const handleDragEnd = useCallback(() => { setDragIdx(null); }, []);

  const saveConfig = useCallback(() => {
    toast.success("Configuration saved");
  }, []);

  /* ── Tab Definitions ── */
  const TABS: { key: TabKey; label: string; icon: React.ElementType }[] = [
    { key: "calls", label: "Call Log", icon: PhoneIncoming },
    { key: "config", label: "Configuration", icon: Settings2 },
    { key: "analytics", label: "Analytics", icon: BarChart3 },
    { key: "booking", label: "Booking", icon: CalendarCheck },
  ];

  /* ── Donut Chart ── */
  const donutSegments = (() => {
    const entries = Object.entries(outcomeCounts).filter(([, v]) => v > 0);
    const colors: Record<string, string> = {
      qualified: "#10b981", not_qualified: "#f59e0b", voicemail: "#3b82f6",
      transferred: "#8b5cf6", spam: "#ef4444", missed: "#6b7280",
    };
    let offset = 0;
    return entries.map(([key, val]) => {
      const pct = (val / totalCalls) * 100;
      const seg = { key, pct, offset, color: colors[key] || "#6b7280" };
      offset += pct;
      return seg;
    });
  })();

  /* ── Render ── */
  return (
    <div className="p-4 md:p-6 space-y-5 max-w-[1400px] mx-auto">
      <PageHero
        icon={<Headphones size={28} />}
        title="AI Voice Receptionist"
        subtitle="Inbound call handling with lead qualification."
        gradient="blue"
        actions={
          <>
            <div className="flex items-center gap-2 bg-white/10 border border-white/20 rounded-lg px-3 py-1.5">
              <Phone size={12} className="text-white" />
              <span className="text-xs font-mono text-white">{phoneNumber}</span>
              <button onClick={handleCopy} className="text-white/70 hover:text-white transition-colors">
                {copied ? <Check size={12} className="text-emerald-300" /> : <Copy size={12} />}
              </button>
            </div>
            <button
              onClick={toggleActive}
              className={`flex items-center gap-2 px-4 py-1.5 rounded-lg text-xs font-medium transition-all ${
                isActive
                  ? "bg-emerald-500/25 text-white border border-emerald-300/40 hover:bg-emerald-500/35"
                  : "bg-red-500/20 text-white border border-red-300/30 hover:bg-red-500/30"
              }`}
            >
              {isActive && (
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-300 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-300" />
                </span>
              )}
              {!isActive && <span className="h-2 w-2 rounded-full bg-red-300" />}
              {isActive ? "Active" : "Inactive"}
            </button>
          </>
        }
      />

      {/* Stats Bar */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Calls Today", value: callsToday, icon: PhoneIncoming, color: "text-blue-400", sub: `${calls.length} total` },
          { label: "Avg Duration", value: fmtDuration(avgDuration), icon: Clock, color: "text-amber-400", sub: "per call" },
          { label: "Leads Captured", value: leadsToday, icon: Target, color: "text-emerald-400", sub: `${qualificationRate}% rate` },
          { label: "Appts Booked", value: bookingsToday, icon: CalendarCheck, color: "text-gold", sub: `${bookingRate}% conversion` },
        ].map(s => (
          <div key={s.label} className="card p-3">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] text-muted uppercase tracking-wider">{s.label}</span>
              <s.icon size={13} className={s.color} />
            </div>
            <p className="text-xl font-bold">{s.value}</p>
            <p className="text-[10px] text-muted">{s.sub}</p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 bg-surface rounded-lg p-0.5 border border-border">
        {TABS.map(t => (
          <button
            key={t.key}
            onClick={() => setActiveTab(t.key)}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-[11px] rounded-md transition-all ${
              activeTab === t.key ? "bg-gold text-black font-medium" : "text-muted hover:text-foreground"
            }`}
          >
            <t.icon size={12} />
            {t.label}
          </button>
        ))}
      </div>

      {/* ═══════════ CALL LOG TAB ═══════════ */}
      {activeTab === "calls" && (
        <div className="space-y-4">
          {/* Filters */}
          <div className="flex flex-col md:flex-row gap-2">
            <div className="relative flex-1">
              <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted" />
              <input
                value={callSearch}
                onChange={e => setCallSearch(e.target.value)}
                placeholder="Search by name or phone..."
                className="w-full bg-surface border border-border rounded-lg pl-8 pr-3 py-1.5 text-xs focus:outline-none focus:border-gold/40"
              />
            </div>
            <div className="flex items-center gap-1 flex-wrap">
              <Filter size={12} className="text-muted mr-1" />
              {(["all", "qualified", "not_qualified", "voicemail", "transferred", "spam", "missed"] as const).map(f => (
                <button
                  key={f}
                  onClick={() => setOutcomeFilter(f)}
                  className={`px-2 py-1 text-[10px] rounded-md transition-all ${
                    outcomeFilter === f ? "bg-gold text-black font-medium" : "text-muted hover:text-foreground bg-surface-light"
                  }`}
                >
                  {f === "all" ? "All" : f === "not_qualified" ? "Not Qual." : f.charAt(0).toUpperCase() + f.slice(1)}
                </button>
              ))}
            </div>
          </div>

          {/* Call Table */}
          <div className="card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border text-muted">
                    <th className="text-left py-2 px-3 font-medium">Time</th>
                    <th className="text-left py-2 px-3 font-medium">Caller</th>
                    <th className="text-left py-2 px-3 font-medium hidden md:table-cell">Location</th>
                    <th className="text-left py-2 px-3 font-medium">Duration</th>
                    <th className="text-left py-2 px-3 font-medium">Outcome</th>
                    <th className="text-left py-2 px-3 font-medium hidden md:table-cell">Score</th>
                    <th className="text-right py-2 px-3 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredCalls.map(call => {
                    const cfg = OUTCOME_CONFIG[call.outcome];
                    const OutcomeIcon = cfg.icon;
                    const isExpanded = expandedCall === call.id;
                    return (
                      <Fragment key={call.id}>
                        <tr
                          className={`border-b border-border/50 hover:bg-surface-light/50 cursor-pointer transition-colors ${isExpanded ? "bg-surface-light/30" : ""}`}
                          onClick={() => setExpandedCall(isExpanded ? null : call.id)}
                        >
                          <td className="py-2 px-3 text-muted whitespace-nowrap">{fmtTime(call.time)}</td>
                          <td className="py-2 px-3">
                            <p className="font-medium">{call.callerName}</p>
                            <p className="text-muted text-[10px]">{call.callerPhone}</p>
                          </td>
                          <td className="py-2 px-3 text-muted hidden md:table-cell">
                            <span className="flex items-center gap-1"><MapPin size={10} />{call.location}</span>
                          </td>
                          <td className="py-2 px-3 font-mono">{fmtDuration(call.duration)}</td>
                          <td className="py-2 px-3">
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] border ${cfg.bg} ${cfg.color}`}>
                              <OutcomeIcon size={9} />
                              {cfg.label}
                            </span>
                          </td>
                          <td className="py-2 px-3 hidden md:table-cell">
                            {call.qualificationScore > 0 ? (
                              <div className="flex items-center gap-1.5">
                                <div className="w-12 h-1.5 bg-surface-light rounded-full overflow-hidden">
                                  <div
                                    className={`h-full rounded-full ${call.qualificationScore >= 70 ? "bg-emerald-400" : call.qualificationScore >= 40 ? "bg-amber-400" : "bg-red-400"}`}
                                    style={{ width: `${call.qualificationScore}%` }}
                                  />
                                </div>
                                <span className="text-[10px] text-muted">{call.qualificationScore}</span>
                              </div>
                            ) : <span className="text-muted">--</span>}
                          </td>
                          <td className="py-2 px-3 text-right">
                            <div className="flex items-center justify-end gap-1">
                              {call.duration > 0 && (
                                <button
                                  onClick={e => { e.stopPropagation(); setPlayingRecording(playingRecording === call.id ? null : call.id); }}
                                  className="p-1 rounded hover:bg-surface-light text-muted hover:text-foreground transition-colors"
                                  title="Play recording"
                                >
                                  {playingRecording === call.id ? <Pause size={12} /> : <Play size={12} />}
                                </button>
                              )}
                              {call.transcript.length > 0 && (
                                <button
                                  onClick={e => { e.stopPropagation(); setExpandedCall(isExpanded ? null : call.id); }}
                                  className="p-1 rounded hover:bg-surface-light text-muted hover:text-foreground transition-colors"
                                  title="View transcript"
                                >
                                  <FileText size={12} />
                                </button>
                              )}
                              {call.bookedAppointment && (
                                <span className="p-1 text-gold" title="Appointment booked">
                                  <CalendarCheck size={12} />
                                </span>
                              )}
                            </div>
                          </td>
                        </tr>
                        {/* Expanded Transcript */}
                        {isExpanded && call.transcript.length > 0 && (
                          <tr>
                            <td colSpan={7} className="px-3 py-3 bg-surface-light/20">
                              <div className="max-h-64 overflow-y-auto space-y-2 pl-2 border-l-2 border-gold/20">
                                <p className="text-[10px] text-gold font-medium uppercase tracking-wider mb-2">Full Transcript</p>
                                {call.transcript.map((line, i) => (
                                  <div key={i} className={`flex gap-2 text-[11px] ${line.speaker === "ai" ? "" : ""}`}>
                                    <span className={`font-medium shrink-0 w-10 ${line.speaker === "ai" ? "text-gold" : "text-blue-400"}`}>
                                      {line.speaker === "ai" ? "AI" : "Caller"}
                                    </span>
                                    <span className="text-muted text-[10px] shrink-0 w-8 font-mono">{line.timestamp}</span>
                                    <span>{line.text}</span>
                                  </div>
                                ))}
                              </div>
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {filteredCalls.length === 0 && (
              <div className="text-center py-12">
                <PhoneOff size={24} className="mx-auto mb-2 text-muted/30" />
                <p className="text-xs text-muted">No calls match your filters</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ═══════════ CONFIGURATION TAB ═══════════ */}
      {activeTab === "config" && (
        <div className="space-y-4">
          {/* Greeting */}
          <div className="card p-4">
            <h2 className="section-header flex items-center gap-2">
              <Mic size={13} className="text-gold" /> Greeting Message
            </h2>
            <textarea
              value={greeting}
              onChange={e => setGreeting(e.target.value)}
              rows={3}
              className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-gold/40 resize-none mt-2"
              placeholder="What the AI says when answering a call..."
            />
            <p className="text-[10px] text-muted mt-1">This is the first thing callers hear. Keep it warm, professional, and under 30 seconds.</p>
          </div>

          {/* Business Info */}
          <div className="card p-4">
            <h2 className="section-header flex items-center gap-2">
              <Zap size={13} className="text-gold" /> Business Information
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-2">
              <div>
                <label className="text-[10px] text-muted uppercase tracking-wider">Business Name</label>
                <input
                  value={businessName}
                  onChange={e => setBusinessName(e.target.value)}
                  className="w-full bg-surface border border-border rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:border-gold/40 mt-1"
                />
              </div>
              <div>
                <label className="text-[10px] text-muted uppercase tracking-wider">Hours of Operation</label>
                <input
                  value={hoursText}
                  onChange={e => setHoursText(e.target.value)}
                  className="w-full bg-surface border border-border rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:border-gold/40 mt-1"
                />
              </div>
              <div className="md:col-span-2">
                <label className="text-[10px] text-muted uppercase tracking-wider">Services Offered</label>
                <input
                  value={services}
                  onChange={e => setServices(e.target.value)}
                  className="w-full bg-surface border border-border rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:border-gold/40 mt-1"
                />
              </div>
              <div className="md:col-span-2">
                <label className="text-[10px] text-muted uppercase tracking-wider">Pricing Tiers</label>
                <input
                  value={pricing}
                  onChange={e => setPricing(e.target.value)}
                  className="w-full bg-surface border border-border rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:border-gold/40 mt-1"
                />
              </div>
            </div>
          </div>

          {/* Qualification Questions */}
          <div className="card p-4">
            <h2 className="section-header flex items-center gap-2">
              <Users size={13} className="text-gold" /> Qualification Questions
            </h2>
            <p className="text-[10px] text-muted mb-3">Drag to reorder. The AI asks these in sequence to qualify inbound leads.</p>
            <div className="space-y-1.5">
              {questions.map((q, idx) => (
                <div
                  key={q.id}
                  draggable
                  onDragStart={() => handleDragStart(idx)}
                  onDragOver={e => handleDragOver(e, idx)}
                  onDragEnd={handleDragEnd}
                  className={`flex items-center gap-2 bg-surface-light rounded-lg px-3 py-2 border border-border/50 group transition-all ${
                    dragIdx === idx ? "opacity-50 border-gold/40" : ""
                  }`}
                >
                  <GripVertical size={12} className="text-muted cursor-grab shrink-0" />
                  <span className="text-[10px] text-muted font-mono shrink-0 w-4">{idx + 1}.</span>
                  <span className="text-xs flex-1">{q.text}</span>
                  <button
                    onClick={() => toggleQuestionRequired(q.id)}
                    className={`text-[9px] px-1.5 py-0.5 rounded transition-colors ${
                      q.required ? "bg-gold/10 text-gold border border-gold/20" : "text-muted hover:text-foreground"
                    }`}
                  >
                    {q.required ? "Required" : "Optional"}
                  </button>
                  <button
                    onClick={() => removeQuestion(q.id)}
                    className="text-muted hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all"
                  >
                    <Trash2 size={11} />
                  </button>
                </div>
              ))}
            </div>
            <div className="flex gap-2 mt-3">
              <input
                value={newQuestion}
                onChange={e => setNewQuestion(e.target.value)}
                onKeyDown={e => e.key === "Enter" && addQuestion()}
                placeholder="Add a new qualification question..."
                className="flex-1 bg-surface border border-border rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:border-gold/40"
              />
              <button
                onClick={addQuestion}
                className="flex items-center gap-1 px-3 py-1.5 bg-gold/10 text-gold rounded-lg text-xs hover:bg-gold/20 transition-colors border border-gold/20"
              >
                <Plus size={12} /> Add
              </button>
            </div>
          </div>

          {/* Routing Rules */}
          <div className="card p-4">
            <h2 className="section-header flex items-center gap-2">
              <ArrowRight size={13} className="text-gold" /> Call Routing Rules
            </h2>
            <div className="space-y-2 mt-2">
              {routingRules.map(rule => (
                <div key={rule.id} className={`flex items-start gap-3 rounded-lg p-3 border transition-all ${
                  rule.enabled ? "bg-surface-light border-border" : "bg-surface border-border/30 opacity-60"
                }`}>
                  <button
                    onClick={() => toggleRoutingRule(rule.id)}
                    className={`mt-0.5 shrink-0 w-7 h-4 rounded-full transition-colors relative ${
                      rule.enabled ? "bg-gold" : "bg-surface-light border border-border"
                    }`}
                  >
                    <span className={`absolute top-0.5 w-3 h-3 rounded-full bg-white transition-transform ${
                      rule.enabled ? "left-3.5" : "left-0.5"
                    }`} />
                  </button>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium">{rule.condition}</p>
                    <p className="text-[10px] text-gold mt-0.5">{rule.action}</p>
                    <p className="text-[10px] text-muted">{rule.detail}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Voice Settings */}
          <div className="card p-4">
            <h2 className="section-header flex items-center gap-2">
              <Volume2 size={13} className="text-gold" /> Voice Settings
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-2">
              <div>
                <label className="text-[10px] text-muted uppercase tracking-wider">Voice</label>
                <select
                  value={selectedVoice}
                  onChange={e => setSelectedVoice(e.target.value)}
                  className="w-full bg-surface border border-border rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:border-gold/40 mt-1"
                >
                  {VOICE_OPTIONS.map(v => (
                    <option key={v.id} value={v.id}>{v.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-[10px] text-muted uppercase tracking-wider">Speed: {voiceSpeed.toFixed(1)}x</label>
                <input
                  type="range"
                  min={0.5}
                  max={2.0}
                  step={0.1}
                  value={voiceSpeed}
                  onChange={e => setVoiceSpeed(parseFloat(e.target.value))}
                  className="w-full mt-2 accent-[#C9A84C]"
                />
                <div className="flex justify-between text-[9px] text-muted">
                  <span>Slow</span><span>Normal</span><span>Fast</span>
                </div>
              </div>
              <div>
                <label className="text-[10px] text-muted uppercase tracking-wider">Language</label>
                <select
                  value={language}
                  onChange={e => setLanguage(e.target.value)}
                  className="w-full bg-surface border border-border rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:border-gold/40 mt-1"
                >
                  {LANGUAGE_OPTIONS.map(l => (
                    <option key={l} value={l}>{l}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Working Hours */}
          <div className="card p-4">
            <h2 className="section-header flex items-center gap-2">
              <Clock size={13} className="text-gold" /> Working Hours
            </h2>
            <p className="text-[10px] text-muted mb-3">Calls outside these hours go to voicemail with an after-hours message.</p>
            <div className="space-y-1.5">
              {workingHours.map(h => (
                <div key={h.day} className="flex items-center gap-3">
                  <button
                    onClick={() => toggleDay(h.day)}
                    className={`shrink-0 w-7 h-4 rounded-full transition-colors relative ${
                      h.enabled ? "bg-gold" : "bg-surface-light border border-border"
                    }`}
                  >
                    <span className={`absolute top-0.5 w-3 h-3 rounded-full bg-white transition-transform ${
                      h.enabled ? "left-3.5" : "left-0.5"
                    }`} />
                  </button>
                  <span className={`text-xs w-24 ${h.enabled ? "" : "text-muted"}`}>{h.day}</span>
                  {h.enabled ? (
                    <div className="flex items-center gap-2">
                      <input
                        type="time"
                        value={h.start}
                        onChange={e => updateHour(h.day, "start", e.target.value)}
                        className="bg-surface border border-border rounded px-2 py-1 text-xs focus:outline-none focus:border-gold/40"
                      />
                      <span className="text-muted text-[10px]">to</span>
                      <input
                        type="time"
                        value={h.end}
                        onChange={e => updateHour(h.day, "end", e.target.value)}
                        className="bg-surface border border-border rounded px-2 py-1 text-xs focus:outline-none focus:border-gold/40"
                      />
                    </div>
                  ) : (
                    <span className="text-[10px] text-muted">Closed</span>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Save Button */}
          <div className="flex justify-end">
            <button
              onClick={saveConfig}
              className="flex items-center gap-2 px-6 py-2 bg-gold text-black rounded-lg text-xs font-medium hover:bg-gold/90 transition-colors"
            >
              <Check size={13} /> Save Configuration
            </button>
          </div>
        </div>
      )}

      {/* ═══════════ ANALYTICS TAB ═══════════ */}
      {activeTab === "analytics" && (
        <div className="space-y-4">
          {/* Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label: "Total Calls (7d)", value: totalCalls.toString(), icon: Phone, color: "text-blue-400", delta: "+12%" },
              { label: "Qualification Rate", value: `${qualificationRate}%`, icon: Target, color: "text-emerald-400", delta: "+5%" },
              { label: "Avg Score", value: avgScore.toString(), icon: Star, color: "text-gold", delta: "+3 pts" },
              { label: "Booking Rate", value: `${bookingRate}%`, icon: CalendarCheck, color: "text-purple-400", delta: "+8%" },
            ].map(s => (
              <div key={s.label} className="card p-3">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] text-muted uppercase tracking-wider">{s.label}</span>
                  <s.icon size={13} className={s.color} />
                </div>
                <p className="text-xl font-bold">{s.value}</p>
                <p className="text-[10px] text-emerald-400 flex items-center gap-1">
                  <TrendingUp size={9} /> {s.delta} vs last week
                </p>
              </div>
            ))}
          </div>

          {/* Call Volume Chart */}
          <div className="card p-4">
            <h2 className="section-header flex items-center gap-2">
              <BarChart3 size={13} className="text-gold" /> Call Volume (7 Days)
            </h2>
            <div className="flex items-end gap-2 mt-4 h-40">
              {WEEKLY_CALLS.map(d => {
                const maxCalls = Math.max(...WEEKLY_CALLS.map(w => w.calls), 1);
                const totalH = (d.calls / maxCalls) * 100;
                const qualH = (d.qualified / maxCalls) * 100;
                return (
                  <div key={d.day} className="flex-1 flex flex-col items-center gap-1">
                    <span className="text-[9px] text-muted">{d.calls}</span>
                    <div className="w-full relative" style={{ height: "120px" }}>
                      {/* Total bar */}
                      <div
                        className="absolute bottom-0 w-full bg-surface-light rounded-t"
                        style={{ height: `${totalH}%` }}
                      />
                      {/* Qualified bar */}
                      <div
                        className="absolute bottom-0 w-full bg-gold/60 rounded-t"
                        style={{ height: `${qualH}%` }}
                      />
                    </div>
                    <span className="text-[10px] text-muted">{d.day}</span>
                  </div>
                );
              })}
            </div>
            <div className="flex items-center gap-4 mt-3 justify-center">
              <span className="flex items-center gap-1.5 text-[10px] text-muted">
                <span className="w-2.5 h-2.5 rounded bg-surface-light inline-block" /> Total Calls
              </span>
              <span className="flex items-center gap-1.5 text-[10px] text-muted">
                <span className="w-2.5 h-2.5 rounded bg-gold/60 inline-block" /> Qualified
              </span>
            </div>
          </div>

          {/* Outcome Donut + Top Locations */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Donut Chart */}
            <div className="card p-4">
              <h2 className="section-header flex items-center gap-2">
                <Target size={13} className="text-gold" /> Outcome Breakdown
              </h2>
              <div className="flex items-center gap-6 mt-4">
                <div className="relative w-32 h-32 shrink-0">
                  <svg viewBox="0 0 36 36" className="w-full h-full -rotate-90">
                    {donutSegments.map(seg => (
                      <circle
                        key={seg.key}
                        cx="18" cy="18" r="14"
                        fill="none"
                        stroke={seg.color}
                        strokeWidth="4"
                        strokeDasharray={`${seg.pct * 0.88} ${88 - seg.pct * 0.88}`}
                        strokeDashoffset={`${-seg.offset * 0.88}`}
                        className="transition-all duration-500"
                      />
                    ))}
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-lg font-bold">{totalCalls}</span>
                    <span className="text-[9px] text-muted">Total</span>
                  </div>
                </div>
                <div className="space-y-1.5 flex-1">
                  {Object.entries(outcomeCounts).filter(([, v]) => v > 0).map(([key, val]) => {
                    const cfg = OUTCOME_CONFIG[key as CallOutcome];
                    return (
                      <div key={key} className="flex items-center justify-between text-[11px]">
                        <span className={`flex items-center gap-1.5 ${cfg.color}`}>
                          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: key === "qualified" ? "#10b981" : key === "not_qualified" ? "#f59e0b" : key === "voicemail" ? "#3b82f6" : key === "transferred" ? "#8b5cf6" : key === "spam" ? "#ef4444" : "#6b7280" }} />
                          {cfg.label}
                        </span>
                        <span className="text-muted">{val} ({Math.round((val / totalCalls) * 100)}%)</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Top Locations */}
            <div className="card p-4">
              <h2 className="section-header flex items-center gap-2">
                <MapPin size={13} className="text-gold" /> Top Caller Locations
              </h2>
              <div className="space-y-2 mt-3">
                {TOP_LOCATIONS.map(loc => (
                  <div key={loc.city} className="flex items-center gap-2">
                    <span className="text-xs flex-1">{loc.city}{loc.state ? `, ${loc.state}` : ""}</span>
                    <div className="w-24 h-1.5 bg-surface-light rounded-full overflow-hidden">
                      <div className="h-full bg-gold/60 rounded-full" style={{ width: `${loc.pct}%` }} />
                    </div>
                    <span className="text-[10px] text-muted w-10 text-right">{loc.calls}</span>
                    <span className="text-[10px] text-muted w-8 text-right">{loc.pct}%</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Peak Hours Heatmap */}
          <div className="card p-4">
            <h2 className="section-header flex items-center gap-2">
              <Clock size={13} className="text-gold" /> Peak Hours Heatmap
            </h2>
            <div className="overflow-x-auto mt-3">
              <div className="min-w-[500px]">
                {/* Day headers */}
                <div className="flex mb-1">
                  <div className="w-12 shrink-0" />
                  {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map(d => (
                    <div key={d} className="flex-1 text-center text-[9px] text-muted">{d}</div>
                  ))}
                </div>
                {/* Hour rows */}
                {HOURLY_DATA.map((row, hour) => {
                  if (hour < 7 || hour > 19) return null;
                  const h12 = hour % 12 || 12;
                  const ampm = hour >= 12 ? "PM" : "AM";
                  return (
                    <div key={hour} className="flex mb-0.5">
                      <div className="w-12 shrink-0 text-[9px] text-muted text-right pr-2">{h12}{ampm}</div>
                      {row.map((val, dayIdx) => (
                        <div key={dayIdx} className="flex-1 px-0.5">
                          <div className={`h-4 rounded-sm ${heatColor(val)} transition-colors`} title={`${val} calls`} />
                        </div>
                      ))}
                    </div>
                  );
                })}
              </div>
              <div className="flex items-center gap-2 mt-2 justify-center">
                <span className="text-[9px] text-muted">Less</span>
                {[0, 1, 2, 3, 5].map(v => (
                  <div key={v} className={`w-3 h-3 rounded-sm ${heatColor(v)}`} />
                ))}
                <span className="text-[9px] text-muted">More</span>
              </div>
            </div>
          </div>

          {/* Average Qualification Score */}
          <div className="card p-4">
            <h2 className="section-header flex items-center gap-2">
              <Star size={13} className="text-gold" /> Qualification Score Distribution
            </h2>
            <div className="flex items-end gap-1 mt-4 h-24">
              {[
                { range: "0-20", count: 0 },
                { range: "21-40", count: 0 },
                { range: "41-60", count: 0 },
                { range: "61-80", count: 0 },
                { range: "81-100", count: 0 },
              ].map(bucket => {
                const maxCount = Math.max(...[0, 0, 0, 0, 0], 1);
                const h = (bucket.count / maxCount) * 100;
                return (
                  <div key={bucket.range} className="flex-1 flex flex-col items-center gap-1">
                    <span className="text-[9px] text-muted">{bucket.count}</span>
                    <div className="w-full bg-surface-light rounded-t relative" style={{ height: `${h}%` }}>
                      <div className={`absolute inset-0 rounded-t ${bucket.range === "81-100" ? "bg-emerald-500/50" : bucket.range === "61-80" ? "bg-emerald-500/30" : bucket.range === "41-60" ? "bg-amber-500/30" : "bg-red-500/30"}`} />
                    </div>
                    <span className="text-[9px] text-muted">{bucket.range}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ═══════════ BOOKING TAB ═══════════ */}
      {activeTab === "booking" && (
        <div className="space-y-4">
          {/* Booking Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label: "Total Bookings", value: "0", icon: CalendarCheck, color: "text-gold" },
              { label: "Booking Rate", value: `${bookingRate}%`, icon: TrendingUp, color: "text-emerald-400" },
              { label: "SMS Confirmations", value: "0", icon: MessageSquare, color: "text-blue-400" },
              { label: "No-Shows", value: "0", icon: AlertCircle, color: "text-red-400" },
            ].map(s => (
              <div key={s.label} className="card p-3">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] text-muted uppercase tracking-wider">{s.label}</span>
                  <s.icon size={13} className={s.color} />
                </div>
                <p className="text-xl font-bold">{s.value}</p>
              </div>
            ))}
          </div>

          {/* Calendly Integration */}
          <div className="card p-4">
            <h2 className="section-header flex items-center gap-2">
              <CalendarCheck size={13} className="text-gold" /> Calendly Integration
            </h2>
            <div className="space-y-3 mt-2">
              <div>
                <label className="text-[10px] text-muted uppercase tracking-wider">Calendly Scheduling URL</label>
                <div className="flex gap-2 mt-1">
                  <input
                    value={calendlyUrl}
                    onChange={e => setCalendlyUrl(e.target.value)}
                    placeholder="https://calendly.com/your-link"
                    className="flex-1 bg-surface border border-border rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:border-gold/40"
                  />
                  <a
                    href={calendlyUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 px-3 py-1.5 bg-surface-light border border-border rounded-lg text-xs text-muted hover:text-foreground transition-colors"
                  >
                    <ExternalLink size={11} /> Test
                  </a>
                </div>
                <p className="text-[10px] text-muted mt-1">The AI will use this link to book qualified leads into your calendar.</p>
              </div>
            </div>
          </div>

          {/* Booking Behavior */}
          <div className="card p-4">
            <h2 className="section-header flex items-center gap-2">
              <Settings2 size={13} className="text-gold" /> Booking Behavior
            </h2>
            <div className="space-y-3 mt-2">
              {/* Auto-log toggle */}
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium">Auto-log to Supabase</p>
                  <p className="text-[10px] text-muted">When the AI books an appointment, automatically create a calendar_events record</p>
                </div>
                <button
                  onClick={() => setAutoLogBooking(!autoLogBooking)}
                  className={`shrink-0 w-9 h-5 rounded-full transition-colors relative ${
                    autoLogBooking ? "bg-gold" : "bg-surface-light border border-border"
                  }`}
                >
                  <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${
                    autoLogBooking ? "left-[18px]" : "left-0.5"
                  }`} />
                </button>
              </div>

              {/* SMS confirmation toggle */}
              <div className="flex items-center justify-between border-t border-border/50 pt-3">
                <div>
                  <p className="text-xs font-medium">SMS Confirmation</p>
                  <p className="text-[10px] text-muted">Send caller a text message confirming their booked appointment</p>
                </div>
                <button
                  onClick={() => setConfirmSms(!confirmSms)}
                  className={`shrink-0 w-9 h-5 rounded-full transition-colors relative ${
                    confirmSms ? "bg-gold" : "bg-surface-light border border-border"
                  }`}
                >
                  <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${
                    confirmSms ? "left-[18px]" : "left-0.5"
                  }`} />
                </button>
              </div>
            </div>
          </div>

          {/* Recent Bookings */}
          <div className="card p-4">
            <h2 className="section-header flex items-center gap-2">
              <CalendarCheck size={13} className="text-gold" /> Recent Bookings
            </h2>
            <div className="space-y-2 mt-2">
              {calls.filter(c => c.bookedAppointment).map(call => (
                <div key={call.id} className="flex items-center justify-between bg-surface-light rounded-lg px-3 py-2 border border-border/50">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-gold/10 flex items-center justify-center">
                      <CalendarCheck size={14} className="text-gold" />
                    </div>
                    <div>
                      <p className="text-xs font-medium">{call.callerName}</p>
                      <p className="text-[10px] text-muted">{call.callerPhone}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-xs">{fmtTime(call.time)}</p>
                    <p className="text-[10px] text-emerald-400 flex items-center gap-1 justify-end">
                      <Check size={9} /> Confirmed
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Webhook Logs */}
          <div className="card p-4">
            <h2 className="section-header flex items-center gap-2">
              <RefreshCw size={13} className="text-gold" /> Webhook Activity
            </h2>
            <div className="space-y-1.5 mt-2">
              {([] as { time: string; event: string; status: string; detail: string }[]).map((log, i) => (
                <div key={i} className="flex items-center gap-3 text-[11px] py-1.5 border-b border-border/30 last:border-0">
                  <span className="text-muted text-[10px] w-32 shrink-0">{log.time}</span>
                  <code className="text-[10px] bg-surface px-1.5 py-0.5 rounded text-gold font-mono">{log.event}</code>
                  <span className="flex-1 text-muted truncate">{log.detail}</span>
                  <span className="text-emerald-400 text-[10px] flex items-center gap-1"><Check size={9} /> {log.status}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      <PageAI
        pageName="Voice Receptionist"
        context={`AI voice receptionist for inbound call handling. ${callsToday} calls today, ${qualificationRate}% qualification rate, ${bookingsToday} appointments booked. Currently ${isActive ? "active" : "inactive"}. Voice: ${VOICE_OPTIONS.find(v => v.id === selectedVoice)?.name || "Unknown"}.`}
        suggestions={[
          "How should I optimize my greeting for higher qualification?",
          "What qualification questions work best for dental practices?",
          "Analyze my call patterns and suggest improvements",
          "Help me set up routing rules for after-hours calls",
          "What voice and speed settings convert best?",
        ]}
      />
    </div>
  );
}
