"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import PageHero from "@/components/ui/page-hero";
import { Coffee, Users, MessageSquare, Calendar, FileText, BookOpen, Loader2, Sparkles } from "lucide-react";

interface BriefingStats {
  newLeads: number;
  messagesReceived: number;
  appointmentsToday: number;
  invoicesDue: number;
  contentScheduled: number;
}

interface StatTile {
  label: string;
  value: number;
  icon: typeof Users;
  color: string;
  bgColor: string;
}

export default function BriefingPage() {
  const [stats, setStats] = useState<BriefingStats>({
    newLeads: 0,
    messagesReceived: 0,
    appointmentsToday: 0,
    invoicesDue: 0,
    contentScheduled: 0,
  });
  const [loading, setLoading] = useState(true);
  const [aiText, setAiText] = useState("");
  const [generating, setGenerating] = useState(false);
  const [today] = useState(new Date());
  const abortRef = useRef<AbortController | null>(null);
  const supabase = createClient();

  const load = useCallback(async () => {
    setLoading(true);
    const since24h = new Date(Date.now() - 86400000).toISOString();
    const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate()).toISOString();
    const todayEnd = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1).toISOString();

    const [leadsRes, messagesRes, appointmentsRes, invoicesRes, contentRes] = await Promise.all([
      supabase.from("leads").select("id", { count: "exact", head: true }).gte("created_at", since24h),
      supabase.from("conversation_messages").select("id", { count: "exact", head: true }).gte("created_at", since24h),
      supabase.from("appointments").select("id", { count: "exact", head: true })
        .gte("scheduled_at", todayStart).lt("scheduled_at", todayEnd),
      supabase.from("invoices").select("id", { count: "exact", head: true })
        .in("status", ["sent", "overdue"]).lte("due_date", today.toISOString().split("T")[0]),
      supabase.from("content_calendar").select("id", { count: "exact", head: true })
        .gte("scheduled_at", todayStart).lt("scheduled_at", todayEnd).eq("status", "scheduled"),
    ]);

    setStats({
      newLeads: leadsRes.count ?? 0,
      messagesReceived: messagesRes.count ?? 0,
      appointmentsToday: appointmentsRes.count ?? 0,
      invoicesDue: invoicesRes.count ?? 0,
      contentScheduled: contentRes.count ?? 0,
    });
    setLoading(false);
  }, [supabase, today]);

  useEffect(() => { load(); }, [load]);

  const handleGenerateBriefing = useCallback(async () => {
    setGenerating(true);
    setAiText("");
    if (abortRef.current) abortRef.current.abort();
    abortRef.current = new AbortController();

    const systemPrompt = `You are an AI chief of staff for a marketing agency using ShortStack OS.
Write a concise 3-paragraph morning briefing based on the following 24-hour activity snapshot:
- New leads captured: ${stats.newLeads}
- Messages received: ${stats.messagesReceived}
- Appointments today: ${stats.appointmentsToday}
- Invoices due: ${stats.invoicesDue}
- Content scheduled to publish today: ${stats.contentScheduled}

Paragraph 1: Performance summary — what happened in the last 24 hours.
Paragraph 2: Today's priorities and what needs attention.
Paragraph 3: One strategic insight or recommendation based on these numbers.
Be direct, specific, and action-oriented. No fluff.`;

    try {
      const res = await fetch("/api/trinity/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [{ role: "user", content: "Generate my morning briefing." }],
          system: systemPrompt,
          stream: true,
        }),
        signal: abortRef.current.signal,
      });

      if (!res.ok || !res.body) {
        const errText = await res.text().catch(() => "Unknown error");
        setAiText(`Error generating briefing: ${errText}`);
        setGenerating(false);
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        // SSE: parse data: lines
        const lines = buf.split("\n");
        buf = lines.pop() ?? "";
        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const chunk = line.slice(6);
            if (chunk === "[DONE]") continue;
            try {
              const parsed = JSON.parse(chunk);
              const delta = parsed?.choices?.[0]?.delta?.content ?? parsed?.delta?.text ?? "";
              if (delta) setAiText(t => t + delta);
            } catch {
              // plain text chunk
              if (chunk && chunk !== "[DONE]") setAiText(t => t + chunk);
            }
          }
        }
      }
    } catch (err: unknown) {
      if ((err as Error).name !== "AbortError") {
        setAiText("Failed to connect to Trinity. Check API configuration.");
      }
    }
    setGenerating(false);
  }, [stats]);

  const tiles: StatTile[] = [
    { label: "New Leads (24h)", value: stats.newLeads, icon: Users, color: "text-blue-400", bgColor: "bg-blue-500/10 border-blue-500/20" },
    { label: "Messages Received", value: stats.messagesReceived, icon: MessageSquare, color: "text-purple-400", bgColor: "bg-purple-500/10 border-purple-500/20" },
    { label: "Appointments Today", value: stats.appointmentsToday, icon: Calendar, color: "text-emerald-400", bgColor: "bg-emerald-500/10 border-emerald-500/20" },
    { label: "Invoices Due", value: stats.invoicesDue, icon: FileText, color: "text-amber-400", bgColor: "bg-amber-500/10 border-amber-500/20" },
    { label: "Content Scheduled", value: stats.contentScheduled, icon: BookOpen, color: "text-rose-400", bgColor: "bg-rose-500/10 border-rose-500/20" },
  ];

  const dateStr = today.toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" });

  return (
    <div className="space-y-6">
      <PageHero
        title="Daily Briefing"
        subtitle={dateStr}
        icon={<Coffee className="w-6 h-6" />}
        gradient="sunset"
        actions={
          <button
            onClick={handleGenerateBriefing}
            disabled={generating || loading}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white/15 hover:bg-white/20 disabled:opacity-40 text-white text-sm font-medium transition-colors border border-white/20"
          >
            {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            {generating ? "Generating…" : "Generate AI briefing"}
          </button>
        }
      />

      {/* Stats cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {tiles.map(({ label, value, icon: Icon, color, bgColor }) => (
          <div key={label} className={`card-premium p-4 border ${bgColor}`}>
            <div className="flex items-center gap-2 mb-2">
              <Icon className={`w-4 h-4 ${color}`} />
              <span className="text-xs text-muted">{label}</span>
            </div>
            {loading ? (
              <div className="h-8 w-12 bg-white/10 rounded animate-pulse" />
            ) : (
              <div className={`text-3xl font-bold ${color}`}>{value}</div>
            )}
          </div>
        ))}
      </div>

      {/* Activity summary card */}
      {!loading && (
        <div className="card-premium p-6">
          <h2 className="text-base font-semibold text-white mb-4 flex items-center gap-2">
            <Coffee className="w-4 h-4 text-orange-400" />
            Morning snapshot
          </h2>
          <div className="grid sm:grid-cols-2 gap-4 text-sm">
            <div className="space-y-2">
              <p className="text-muted">
                <span className="text-white font-medium">{stats.newLeads}</span> new lead{stats.newLeads !== 1 ? "s" : ""} captured in the last 24 hours.
              </p>
              <p className="text-muted">
                <span className="text-white font-medium">{stats.messagesReceived}</span> inbound message{stats.messagesReceived !== 1 ? "s" : ""} across all channels.
              </p>
              <p className="text-muted">
                <span className="text-white font-medium">{stats.appointmentsToday}</span> appointment{stats.appointmentsToday !== 1 ? "s" : ""} scheduled for today.
              </p>
            </div>
            <div className="space-y-2">
              <p className="text-muted">
                <span className={`font-medium ${stats.invoicesDue > 0 ? "text-amber-400" : "text-white"}`}>{stats.invoicesDue}</span> invoice{stats.invoicesDue !== 1 ? "s" : ""} due or overdue.
              </p>
              <p className="text-muted">
                <span className="text-white font-medium">{stats.contentScheduled}</span> content piece{stats.contentScheduled !== 1 ? "s" : ""} queued to publish today.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* AI briefing output */}
      {(aiText || generating) && (
        <div className="card-premium p-6">
          <h2 className="text-base font-semibold text-white mb-4 flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-orange-400" />
            AI Briefing
            {generating && <Loader2 className="w-3.5 h-3.5 animate-spin text-muted ml-1" />}
          </h2>
          <div className="text-sm text-white/80 leading-relaxed whitespace-pre-wrap font-serif">
            {aiText}
            {generating && <span className="inline-block w-1 h-4 bg-orange-400 animate-pulse ml-0.5 align-middle" />}
          </div>
        </div>
      )}
    </div>
  );
}
