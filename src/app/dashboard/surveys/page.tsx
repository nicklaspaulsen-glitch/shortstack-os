"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { createClient } from "@/lib/supabase/client";
import { formatRelativeTime } from "@/lib/utils";
import {
  BarChart3, Copy, Loader
} from "lucide-react";
import toast from "react-hot-toast";

interface SurveyResponse {
  id: string;
  client_id: string | null;
  created_at: string;
  result: { score: number; feedback: string };
}

export default function SurveysPage() {
  useAuth();
  const supabase = createClient();
  const [responses, setResponses] = useState<SurveyResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const surveyUrl = "https://shortstack-os.vercel.app/survey";

  useEffect(() => {
    supabase.from("trinity_log")
      .select("*")
      .eq("action_type", "custom")
      .order("created_at", { ascending: false })
      .limit(100)
      .then(({ data }) => {
        setResponses((data || []).filter(d => (d.result as Record<string, unknown>)?.type === "nps_survey") as SurveyResponse[]);
        setLoading(false);
      });
  }, []);

  const scores = responses.map(r => r.result?.score || 0);
  const avgScore = scores.length > 0 ? (scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(1) : "—";
  const promoters = scores.filter(s => s >= 9).length;
  const _passives = scores.filter(s => s >= 7 && s < 9).length;
  const detractors = scores.filter(s => s < 7).length;
  const nps = scores.length > 0 ? Math.round(((promoters - detractors) / scores.length) * 100) : 0;

  if (loading) return <div className="flex items-center justify-center py-20"><Loader size={20} className="animate-spin text-gold" /></div>;

  return (
    <div className="fade-in space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-header mb-0 flex items-center gap-2">
            <BarChart3 size={18} className="text-gold" /> Client Surveys
          </h1>
          <p className="text-xs text-muted mt-0.5">{responses.length} responses · Track NPS and satisfaction</p>
        </div>
        <button onClick={() => { navigator.clipboard.writeText(surveyUrl); toast.success("Survey link copied!"); }}
          className="btn-primary text-xs flex items-center gap-1.5">
          <Copy size={12} /> Copy Survey Link
        </button>
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

      {/* Survey link */}
      <div className="card">
        <h2 className="section-header">Send to Clients</h2>
        <div className="flex gap-2">
          <code className="flex-1 text-[10px] font-mono p-2.5 rounded-lg truncate" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.05)" }}>
            {surveyUrl}?client=CLIENT_ID
          </code>
          <button onClick={() => { navigator.clipboard.writeText(surveyUrl); toast.success("Copied!"); }}
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
          responses.map(r => (
            <div key={r.id} className="flex items-start gap-3 p-3 rounded-xl"
              style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.04)" }}>
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-sm font-bold shrink-0 ${
                r.result.score >= 9 ? "bg-success/10 text-success" : r.result.score >= 7 ? "bg-warning/10 text-warning" : "bg-danger/10 text-danger"
              }`}>
                {r.result.score}
              </div>
              <div className="flex-1 min-w-0">
                {r.result.feedback ? (
                  <p className="text-[11px] text-muted leading-relaxed">&ldquo;{r.result.feedback}&rdquo;</p>
                ) : (
                  <p className="text-[11px] text-muted/40 italic">No feedback provided</p>
                )}
                <p className="text-[9px] text-muted/40 mt-1">{formatRelativeTime(r.created_at)}</p>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
