"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { createClient } from "@/lib/supabase/client";
import { formatRelativeTime } from "@/lib/utils";
import {
  BarChart3, Copy, Loader, Send, X, Users
} from "lucide-react";
import toast from "react-hot-toast";

interface SurveyResponse {
  id: string;
  client_id: string | null;
  created_at: string;
  result: { score: number; feedback: string; submitted_at?: string };
  client_name?: string;
}

interface ClientOption {
  id: string;
  business_name: string;
  email: string;
}

export default function SurveysPage() {
  useAuth();
  const supabase = createClient();
  const [responses, setResponses] = useState<SurveyResponse[]>([]);
  const [clients, setClients] = useState<ClientOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [showSend, setShowSend] = useState(false);
  const [selectedClient, setSelectedClient] = useState("");
  const surveyUrl = "https://shortstack-os.vercel.app/survey";

  useEffect(() => {
    loadData();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadData() {
    // Load responses and clients in parallel
    const [responsesRes, clientsRes] = await Promise.all([
      supabase.from("trinity_log")
        .select("*")
        .eq("action_type", "custom")
        .order("created_at", { ascending: false })
        .limit(200),
      supabase.from("clients")
        .select("id, business_name, email")
        .eq("is_active", true)
        .order("business_name"),
    ]);

    const allLogs = responsesRes.data || [];
    const surveyLogs = allLogs.filter(d => (d.result as Record<string, unknown>)?.type === "nps_survey") as SurveyResponse[];

    // Enrich with client names
    const clientMap = new Map<string, string>();
    (clientsRes.data || []).forEach(c => clientMap.set(c.id, c.business_name));
    surveyLogs.forEach(r => {
      if (r.client_id && clientMap.has(r.client_id)) {
        r.client_name = clientMap.get(r.client_id);
      }
    });

    setResponses(surveyLogs);
    setClients(clientsRes.data || []);
    setLoading(false);
  }

  const scores = responses.map(r => r.result?.score || 0);
  const avgScore = scores.length > 0 ? (scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(1) : "--";
  const promoters = scores.filter(s => s >= 9).length;
  const passives = scores.filter(s => s >= 7 && s < 9).length;
  const detractors = scores.filter(s => s < 7).length;
  const nps = scores.length > 0 ? Math.round(((promoters - detractors) / scores.length) * 100) : 0;

  // Distribution for 1-10
  const distribution = Array.from({ length: 10 }, (_, i) => {
    const score = i + 1;
    return scores.filter(s => s === score).length;
  });
  const maxDist = Math.max(...distribution, 1);

  function copySurveyLink(clientId?: string) {
    const url = clientId ? `${surveyUrl}?client=${clientId}` : surveyUrl;
    navigator.clipboard.writeText(url);
    toast.success("Survey link copied!");
  }

  if (loading) return <div className="flex items-center justify-center py-20"><Loader size={20} className="animate-spin text-gold" /></div>;

  return (
    <div className="fade-in space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-header mb-0 flex items-center gap-2">
            <BarChart3 size={18} className="text-gold" /> Client Surveys
          </h1>
          <p className="text-xs text-muted mt-0.5">{responses.length} responses &middot; Track NPS and satisfaction</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setShowSend(true)}
            className="btn-secondary text-xs flex items-center gap-1.5">
            <Send size={12} /> Send to Client
          </button>
          <button onClick={() => copySurveyLink()}
            className="btn-primary text-xs flex items-center gap-1.5">
            <Copy size={12} /> Copy Survey Link
          </button>
        </div>
      </div>

      {/* NPS Stats */}
      <div className="grid grid-cols-4 gap-3">
        <div className="card text-center">
          <p className="text-[10px] text-muted">NPS Score</p>
          <p className={`text-3xl font-extrabold ${nps >= 50 ? "text-success" : nps >= 0 ? "text-warning" : "text-danger"}`}>{nps}</p>
          <p className="text-[8px] text-muted">{nps >= 50 ? "Excellent" : nps >= 0 ? "Good" : "Needs Work"}</p>
        </div>
        <div className="card text-center">
          <p className="text-[10px] text-muted">Avg Rating</p>
          <p className="text-3xl font-extrabold text-gold">{avgScore}</p>
          <p className="text-[8px] text-muted">out of 10</p>
        </div>
        <div className="card text-center">
          <p className="text-[10px] text-success">Promoters (9-10)</p>
          <p className="text-2xl font-bold text-success">{promoters}</p>
        </div>
        <div className="card text-center">
          <p className="text-[10px] text-danger">Detractors (1-6)</p>
          <p className="text-2xl font-bold text-danger">{detractors}</p>
        </div>
      </div>

      {/* Score Distribution */}
      {scores.length > 0 && (
        <div className="card">
          <h2 className="section-header">Score Distribution</h2>
          <div className="flex items-end gap-1.5 h-24">
            {distribution.map((count, i) => {
              const score = i + 1;
              const height = count > 0 ? Math.max((count / maxDist) * 100, 8) : 0;
              const color = score >= 9 ? "#10b981" : score >= 7 ? "#c8a855" : "#ef4444";
              return (
                <div key={score} className="flex-1 flex flex-col items-center gap-1">
                  {count > 0 && <span className="text-[8px] text-muted">{count}</span>}
                  <div className="w-full rounded-t-md transition-all" style={{ height: `${height}%`, background: color, opacity: count > 0 ? 1 : 0.15, minHeight: count > 0 ? 4 : 2 }} />
                  <span className="text-[9px] text-muted">{score}</span>
                </div>
              );
            })}
          </div>
          <div className="flex justify-between mt-2 text-[8px] text-muted">
            <span>Detractors ({detractors})</span>
            <span>Passives ({passives})</span>
            <span>Promoters ({promoters})</span>
          </div>
        </div>
      )}

      {/* Survey link helper */}
      <div className="card">
        <h2 className="section-header">Send to Clients</h2>
        <div className="flex gap-2">
          <code className="flex-1 text-[10px] font-mono p-2.5 rounded-lg truncate bg-surface-light border border-border">
            {surveyUrl}?client=CLIENT_ID
          </code>
          <button onClick={() => copySurveyLink()}
            className="btn-secondary text-xs px-3"><Copy size={12} /></button>
        </div>
        <p className="text-[9px] text-muted mt-1">Add ?client=ID to track which client responded</p>
      </div>

      {/* Responses */}
      <div className="space-y-2">
        {responses.length === 0 ? (
          <div className="card text-center py-12">
            <BarChart3 size={24} className="mx-auto mb-2 text-muted/30" />
            <p className="text-xs text-muted">No survey responses yet</p>
            <p className="text-[10px] text-muted/50 mt-1">Send the survey link to clients to start collecting feedback</p>
          </div>
        ) : (
          <>
            <h2 className="text-xs font-bold text-muted uppercase tracking-wider">Responses</h2>
            {responses.map(r => (
              <div key={r.id} className="flex items-start gap-3 p-3 rounded-xl bg-surface-light border border-border">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-sm font-bold shrink-0 ${
                  r.result.score >= 9 ? "bg-success/10 text-success" : r.result.score >= 7 ? "bg-warning/10 text-warning" : "bg-danger/10 text-danger"
                }`}>
                  {r.result.score}
                </div>
                <div className="flex-1 min-w-0">
                  {r.client_name && (
                    <p className="text-[10px] font-semibold text-foreground mb-0.5">{r.client_name}</p>
                  )}
                  {r.result.feedback ? (
                    <p className="text-[11px] text-muted leading-relaxed">&ldquo;{r.result.feedback}&rdquo;</p>
                  ) : (
                    <p className="text-[11px] text-muted/40 italic">No feedback provided</p>
                  )}
                  <p className="text-[9px] text-muted/40 mt-1">{formatRelativeTime(r.created_at)}</p>
                </div>
              </div>
            ))}
          </>
        )}
      </div>

      {/* Send Survey Modal */}
      {showSend && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => setShowSend(false)}>
          <div className="bg-surface rounded-2xl border border-border w-full max-w-md p-5 space-y-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold flex items-center gap-2"><Send size={14} className="text-gold" /> Send Survey to Client</h3>
              <button onClick={() => setShowSend(false)} className="text-muted hover:text-foreground"><X size={16} /></button>
            </div>

            {clients.length === 0 ? (
              <div className="text-center py-6">
                <Users size={24} className="mx-auto text-muted mb-2 opacity-40" />
                <p className="text-xs text-muted">No clients yet. Add clients first.</p>
              </div>
            ) : (
              <div className="space-y-3">
                <div>
                  <label className="block text-[10px] text-muted mb-1 uppercase tracking-wider">Select Client</label>
                  <select value={selectedClient} onChange={e => setSelectedClient(e.target.value)} className="input w-full text-xs">
                    <option value="">Choose a client...</option>
                    {clients.map(c => (
                      <option key={c.id} value={c.id}>{c.business_name} ({c.email})</option>
                    ))}
                  </select>
                </div>

                {selectedClient && (
                  <>
                    <div>
                      <label className="block text-[10px] text-muted mb-1 uppercase tracking-wider">Personalized Survey Link</label>
                      <code className="block text-[10px] font-mono p-2.5 rounded-lg bg-surface-light border border-border break-all">
                        {surveyUrl}?client={selectedClient}
                      </code>
                    </div>
                    <button
                      onClick={() => {
                        copySurveyLink(selectedClient);
                        setShowSend(false);
                        setSelectedClient("");
                      }}
                      className="btn-primary text-xs w-full flex items-center justify-center gap-1.5">
                      <Copy size={12} /> Copy Personalized Link
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
