"use client";

import { useState } from "react";
import {
  BarChart3, Send, X, Plus, Star, MessageSquare,
  CheckCircle, Clock, Download, ThumbsUp, ThumbsDown,
  ArrowRight, Mail, TrendingUp, AlertTriangle, Users,
  Sparkles, Filter, Copy, Globe, Zap, Eye,
  ChevronDown, ChevronUp, FileText, ListChecks,
} from "lucide-react";

/* ================================================================== */
/*  Types                                                              */
/* ================================================================== */

type SurveyTab = "dashboard" | "builder" | "responses" | "trends";
type QuestionType = "nps" | "rating" | "text" | "multiple_choice";

interface SurveyQuestion {
  id: string;
  type: QuestionType;
  text: string;
  options?: string[];
  required: boolean;
}

interface Survey {
  id: string;
  name: string;
  questions: SurveyQuestion[];
  active: boolean;
  responses: number;
  responseRate: number;
  createdAt: string;
}

interface FeedbackResponse {
  id: string;
  surveyId: string;
  client: string;
  avatar: string;
  npsScore: number;
  comment: string;
  submittedAt: string;
  segment: "Promoter" | "Passive" | "Detractor";
  followUp: string | null;
}

interface FollowUpAction {
  id: string;
  client: string;
  score: number;
  action: string;
  status: "pending" | "in_progress" | "done";
  priority: "high" | "medium" | "low";
}

/* ================================================================== */
/*  Mock Data                                                          */
/* ================================================================== */

const QUESTION_TYPES: { type: QuestionType; label: string; icon: React.ReactNode; desc: string }[] = [
  { type: "nps", label: "NPS (0-10)", icon: <BarChart3 size={12} />, desc: "Net Promoter Score" },
  { type: "rating", label: "Rating (1-5)", icon: <Star size={12} />, desc: "Star rating scale" },
  { type: "text", label: "Open Text", icon: <MessageSquare size={12} />, desc: "Free-form response" },
  { type: "multiple_choice", label: "Multiple Choice", icon: <CheckCircle size={12} />, desc: "Select from options" },
];

const TEMPLATES: { name: string; desc: string; questions: SurveyQuestion[] }[] = [
  { name: "NPS Survey", desc: "Standard Net Promoter Score", questions: [
    { id: "t1", type: "nps", text: "How likely are you to recommend us to a colleague?", required: true },
    { id: "t2", type: "text", text: "What's the main reason for your score?", required: false },
  ]},
  { name: "CSAT Survey", desc: "Customer Satisfaction", questions: [
    { id: "t3", type: "rating", text: "How satisfied are you with our service?", required: true },
    { id: "t4", type: "text", text: "What could we improve?", required: false },
  ]},
  { name: "Post-Project", desc: "After project delivery", questions: [
    { id: "t5", type: "rating", text: "Rate the quality of the final deliverable", required: true },
    { id: "t6", type: "rating", text: "How was communication throughout?", required: true },
    { id: "t7", type: "nps", text: "How likely are you to work with us again?", required: true },
    { id: "t8", type: "text", text: "Additional feedback", required: false },
  ]},
  { name: "Quarterly Check-in", desc: "Regular pulse check", questions: [
    { id: "t9", type: "nps", text: "Current NPS Score", required: true },
    { id: "t10", type: "rating", text: "Overall satisfaction this quarter", required: true },
    { id: "t11", type: "multiple_choice", text: "What's your top priority?", options: ["More content", "Better ads", "Faster delivery", "New services", "Reporting"], required: true },
  ]},
  { name: "Exit Survey", desc: "When client leaves", questions: [
    { id: "t12", type: "multiple_choice", text: "Primary reason for leaving?", options: ["Budget", "Results", "Communication", "Found alternative", "Business change", "Other"], required: true },
    { id: "t13", type: "text", text: "What could we have done differently?", required: false },
  ]},
];

const MOCK_SURVEYS: Survey[] = [];

const MOCK_RESPONSES: FeedbackResponse[] = [];

const FOLLOW_UP_ACTIONS: FollowUpAction[] = [];

const NPS_TREND: { month: string; score: number }[] = [];

/* ================================================================== */
/*  Component                                                          */
/* ================================================================== */

export default function SurveysPage() {
  const [tab, setTab] = useState<SurveyTab>("dashboard");
  const [surveys, setSurveys] = useState(MOCK_SURVEYS);
  const [showSend, setShowSend] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [segmentFilter, setSegmentFilter] = useState("All");
  const [responseSearch, setResponseSearch] = useState("");
  const [expandedResponse, setExpandedResponse] = useState<string | null>(null);
  const [followUps, setFollowUps] = useState(FOLLOW_UP_ACTIONS);

  // Builder state
  const [builderName, setBuilderName] = useState("New Survey");
  const [builderQuestions, setBuilderQuestions] = useState<SurveyQuestion[]>([
    { id: "bq1", type: "nps", text: "How likely are you to recommend us?", required: true },
    { id: "bq2", type: "text", text: "Tell us more about your experience", required: false },
  ]);
  const [selectedTemplate, setSelectedTemplate] = useState<number | null>(null);
  const [addingQuestion, setAddingQuestion] = useState(false);
  const [newQType, setNewQType] = useState<QuestionType>("rating");
  const [newQText, setNewQText] = useState("");

  // Computations
  const allResponses = MOCK_RESPONSES;
  const promoters = allResponses.filter(r => r.npsScore >= 9).length;
  const passives = allResponses.filter(r => r.npsScore >= 7 && r.npsScore <= 8).length;
  const detractors = allResponses.filter(r => r.npsScore <= 6).length;
  const nps = allResponses.length > 0 ? Math.round(((promoters - detractors) / allResponses.length) * 100) : 0;
  const avgScore = allResponses.length > 0 ? (allResponses.reduce((a, b) => a + b.npsScore, 0) / allResponses.length).toFixed(1) : "--";

  const distribution = Array.from({ length: 11 }, (_, i) => allResponses.filter(r => r.npsScore === i).length);
  const maxDist = Math.max(...distribution, 1);

  const filteredResponses = allResponses
    .filter(r => segmentFilter === "All" || r.segment === segmentFilter)
    .filter(r => responseSearch === "" || r.client.toLowerCase().includes(responseSearch.toLowerCase()));

  const maxTrend = NPS_TREND.length > 0 ? Math.max(...NPS_TREND.map(t => t.score)) : 0;
  const minTrend = NPS_TREND.length > 0 ? Math.min(...NPS_TREND.map(t => t.score)) : 0;

  const toggleSurvey = (id: string) =>
    setSurveys(prev => prev.map(s => s.id === id ? { ...s, active: !s.active } : s));

  const toggleFollowUp = (id: string) =>
    setFollowUps(prev => prev.map(f => {
      if (f.id !== id) return f;
      const next = f.status === "pending" ? "in_progress" : f.status === "in_progress" ? "done" : "pending";
      return { ...f, status: next as FollowUpAction["status"] };
    }));

  const addQuestion = () => {
    if (!newQText.trim()) return;
    setBuilderQuestions(prev => [...prev, { id: `bq${Date.now()}`, type: newQType, text: newQText, required: false }]);
    setNewQText("");
    setAddingQuestion(false);
  };

  const removeQuestion = (id: string) =>
    setBuilderQuestions(prev => prev.filter(q => q.id !== id));

  const applyTemplate = (idx: number) => {
    setSelectedTemplate(idx);
    setBuilderName(TEMPLATES[idx].name);
    setBuilderQuestions(TEMPLATES[idx].questions);
  };

  const createSurvey = () => {
    setSurveys(prev => [...prev, {
      id: `s${Date.now()}`,
      name: builderName,
      questions: builderQuestions,
      active: true,
      responses: 0,
      responseRate: 0,
      createdAt: new Date().toISOString().slice(0, 10),
    }]);
    setShowCreate(true);
    setTimeout(() => setShowCreate(false), 2000);
  };

  const TABS: { id: SurveyTab; label: string; icon: React.ReactNode }[] = [
    { id: "dashboard", label: "Dashboard", icon: <BarChart3 size={13} /> },
    { id: "builder", label: "Builder", icon: <Plus size={13} /> },
    { id: "responses", label: "Responses", icon: <MessageSquare size={13} /> },
    { id: "trends", label: "Trends", icon: <TrendingUp size={13} /> },
  ];

  return (
    <div className="fade-in space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gold/10 rounded-xl flex items-center justify-center">
            <BarChart3 size={20} className="text-gold" />
          </div>
          <div>
            <h1 className="text-lg font-bold">NPS & Client Feedback</h1>
            <p className="text-xs text-muted">{allResponses.length} responses across {surveys.length} surveys</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setShowSend(true)} className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg border border-[var(--color-border)] text-muted hover:text-foreground hover:border-gold/30 transition-all">
            <Send size={12} /> Send Survey
          </button>
          <button onClick={() => navigator.clipboard.writeText("https://app.shortstack.os/survey/s1")}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg bg-gold text-black font-semibold hover:bg-gold/90 transition-all">
            <Copy size={12} /> Copy Link
          </button>
        </div>
      </div>

      {/* NPS Score Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 text-center">
          <p className="text-[10px] text-muted mb-1">NPS Score</p>
          <p className={`text-4xl font-extrabold ${nps >= 50 ? "text-emerald-400" : nps >= 0 ? "text-gold" : "text-red-400"}`}>{nps}</p>
          <p className="text-[8px] text-muted mt-1">{nps >= 50 ? "Excellent" : nps >= 0 ? "Good" : "Needs Work"}</p>
        </div>
        <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 text-center">
          <p className="text-[10px] text-muted mb-1">Avg Rating</p>
          <p className="text-4xl font-extrabold text-gold">{avgScore}</p>
          <p className="text-[8px] text-muted mt-1">out of 10</p>
        </div>
        <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-4 text-center">
          <p className="text-[10px] text-emerald-400 mb-1">Promoters (9-10)</p>
          <p className="text-3xl font-bold text-emerald-400">{promoters}</p>
          <p className="text-[8px] text-muted mt-1">{allResponses.length > 0 ? Math.round((promoters / allResponses.length) * 100) : 0}% of responses</p>
        </div>
        <div className="rounded-2xl border border-yellow-500/20 bg-yellow-500/5 p-4 text-center">
          <p className="text-[10px] text-yellow-400 mb-1">Passives (7-8)</p>
          <p className="text-3xl font-bold text-yellow-400">{passives}</p>
          <p className="text-[8px] text-muted mt-1">{allResponses.length > 0 ? Math.round((passives / allResponses.length) * 100) : 0}% of responses</p>
        </div>
        <div className="rounded-2xl border border-red-500/20 bg-red-500/5 p-4 text-center">
          <p className="text-[10px] text-red-400 mb-1">Detractors (0-6)</p>
          <p className="text-3xl font-bold text-red-400">{detractors}</p>
          <p className="text-[8px] text-muted mt-1">{allResponses.length > 0 ? Math.round((detractors / allResponses.length) * 100) : 0}% of responses</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl p-1 w-fit">
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 text-xs rounded-lg transition-all ${
              tab === t.id ? "bg-gold/10 text-gold font-medium" : "text-muted hover:text-foreground"
            }`}>
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {/* ── Dashboard Tab ──────────────────────────────────── */}
      {tab === "dashboard" && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Score Distribution */}
            <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
              <h2 className="text-sm font-bold mb-4">NPS Score Distribution</h2>
              <div className="flex items-end gap-1.5 h-28">
                {distribution.map((count, i) => {
                  const height = count > 0 ? Math.max((count / maxDist) * 100, 8) : 0;
                  const color = i >= 9 ? "#10b981" : i >= 7 ? "#c8a855" : "#ef4444";
                  return (
                    <div key={i} className="flex-1 flex flex-col items-center gap-1">
                      {count > 0 && <span className="text-[8px] text-muted font-medium">{count}</span>}
                      <div className="w-full rounded-t-md transition-all duration-300"
                        style={{ height: `${height}%`, background: color, opacity: count > 0 ? 1 : 0.12, minHeight: count > 0 ? 6 : 2 }} />
                      <span className="text-[9px] text-muted">{i}</span>
                    </div>
                  );
                })}
              </div>
              <div className="flex items-center gap-4 mt-3 text-[9px] text-muted">
                <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-red-400" /> Detractors</span>
                <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-gold" /> Passives</span>
                <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-emerald-400" /> Promoters</span>
              </div>
            </div>

            {/* Segment Breakdown */}
            <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
              <h2 className="text-sm font-bold mb-4">Segment Breakdown</h2>
              <div className="space-y-4">
                {[
                  { label: "Promoters", count: promoters, total: allResponses.length, color: "#10b981", icon: ThumbsUp },
                  { label: "Passives", count: passives, total: allResponses.length, color: "#c8a855", icon: ArrowRight },
                  { label: "Detractors", count: detractors, total: allResponses.length, color: "#ef4444", icon: ThumbsDown },
                ].map(seg => {
                  const pct = seg.total > 0 ? Math.round((seg.count / seg.total) * 100) : 0;
                  return (
                    <div key={seg.label}>
                      <div className="flex items-center justify-between mb-1.5">
                        <div className="flex items-center gap-2">
                          <seg.icon size={12} style={{ color: seg.color }} />
                          <span className="text-xs font-medium">{seg.label}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold" style={{ color: seg.color }}>{seg.count}</span>
                          <span className="text-[9px] text-muted">({pct}%)</span>
                        </div>
                      </div>
                      <div className="w-full h-2 bg-white/[0.04] rounded-full overflow-hidden">
                        <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, backgroundColor: seg.color }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Active Surveys */}
          <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-bold flex items-center gap-2"><Zap size={13} className="text-gold" /> Active Surveys</h2>
              <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" /><span className="text-[9px] text-emerald-400">Live</span></div>
            </div>
            <div className="space-y-2">
              {surveys.map(s => (
                <div key={s.id} className="flex items-center gap-3 p-3 rounded-xl bg-white/[0.02] border border-[var(--color-border)]">
                  <div className={`w-1.5 h-10 rounded-full shrink-0 ${s.active ? "bg-emerald-400" : "bg-white/10"}`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold truncate">{s.name}</p>
                    <p className="text-[10px] text-muted">{s.questions.length > 0 ? `${s.questions.length} questions` : "Template"} &middot; Created {s.createdAt}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-bold">{s.responses}</p>
                    <p className="text-[9px] text-muted">{s.responseRate}% rate</p>
                  </div>
                  <button onClick={() => toggleSurvey(s.id)}
                    className={`relative w-10 h-5 rounded-full shrink-0 transition-colors ${s.active ? "bg-emerald-500" : "bg-white/[0.06]"}`}>
                    <div className="absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all"
                      style={{ left: s.active ? "22px" : "2px" }} />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Auto Follow-Up Actions */}
          <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-bold flex items-center gap-2"><AlertTriangle size={13} className="text-orange-400" /> Auto-Generated Follow-Ups</h2>
              <span className="text-[9px] text-muted">{followUps.filter(f => f.status !== "done").length} pending</span>
            </div>
            <div className="space-y-2">
              {followUps.map(f => (
                <div key={f.id} className={`flex items-center gap-3 p-3 rounded-xl border transition-all ${
                  f.status === "done" ? "border-emerald-500/10 bg-emerald-500/5 opacity-60" : "border-[var(--color-border)]"
                }`}>
                  <button onClick={() => toggleFollowUp(f.id)}
                    className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${
                      f.status === "done" ? "border-emerald-400 bg-emerald-400" :
                      f.status === "in_progress" ? "border-gold bg-gold/20" :
                      "border-[var(--color-border)]"
                    }`}>
                    {f.status === "done" && <CheckCircle size={10} className="text-black" />}
                    {f.status === "in_progress" && <div className="w-2 h-2 rounded-full bg-gold" />}
                  </button>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className={`text-xs font-medium ${f.status === "done" ? "line-through text-muted" : ""}`}>{f.client}</p>
                      <span className={`text-[8px] px-1.5 py-0.5 rounded-full font-medium ${
                        f.score <= 6 ? "bg-red-400/10 text-red-400" : "bg-yellow-400/10 text-yellow-400"
                      }`}>Score: {f.score}</span>
                      <span className={`text-[8px] px-1.5 py-0.5 rounded-full ${
                        f.priority === "high" ? "bg-red-400/10 text-red-400" :
                        f.priority === "medium" ? "bg-yellow-400/10 text-yellow-400" :
                        "bg-white/5 text-muted"
                      }`}>{f.priority}</span>
                    </div>
                    <p className="text-[10px] text-muted">{f.action}</p>
                  </div>
                </div>
              ))}
            </div>
            {/* Follow-up rules */}
            <div className="mt-3 p-3 rounded-xl bg-gold/5 border border-gold/10">
              <p className="text-[10px] text-gold font-semibold mb-1">Auto Follow-Up Rules:</p>
              <div className="space-y-0.5 text-[10px] text-muted">
                <p className="flex items-center gap-1.5"><ThumbsDown size={9} className="text-red-400" /> Score 0-6: Apology + improvement plan + manager escalation</p>
                <p className="flex items-center gap-1.5"><ArrowRight size={9} className="text-yellow-400" /> Score 7-8: Thank you + ask for improvement suggestions</p>
                <p className="flex items-center gap-1.5"><ThumbsUp size={9} className="text-emerald-400" /> Score 9-10: Request testimonial + referral ask</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Builder Tab ────────────────────────────────────── */}
      {tab === "builder" && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Builder form */}
            <div className="lg:col-span-2 space-y-4">
              <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-bold flex items-center gap-2"><Plus size={13} className="text-gold" /> Survey Builder</h2>
                  {showCreate && <span className="text-[10px] text-emerald-400 flex items-center gap-1"><CheckCircle size={10} /> Created!</span>}
                </div>

                <div>
                  <label className="block text-[10px] text-muted mb-1">Survey Title</label>
                  <input value={builderName} onChange={e => setBuilderName(e.target.value)}
                    className="w-full px-3 py-2 bg-white/[0.03] border border-[var(--color-border)] rounded-lg text-sm text-foreground focus:outline-none focus:border-gold transition-colors" />
                </div>

                {/* Questions */}
                <div className="space-y-2">
                  {builderQuestions.map((q, idx) => (
                    <div key={q.id} className="p-3.5 rounded-xl bg-white/[0.02] border border-[var(--color-border)]">
                      <div className="flex items-center gap-2 mb-2.5">
                        <span className="text-[9px] font-bold text-gold w-6">Q{idx + 1}</span>
                        <select value={q.type} onChange={e => {
                          const newType = e.target.value as QuestionType;
                          setBuilderQuestions(prev => prev.map(bq => bq.id === q.id ? { ...bq, type: newType } : bq));
                        }}
                          className="px-2 py-1 bg-white/[0.03] border border-[var(--color-border)] rounded-lg text-[10px] text-foreground focus:outline-none focus:border-gold">
                          {QUESTION_TYPES.map(qt => <option key={qt.type} value={qt.type}>{qt.label}</option>)}
                        </select>
                        <input value={q.text} onChange={e => {
                          setBuilderQuestions(prev => prev.map(bq => bq.id === q.id ? { ...bq, text: e.target.value } : bq));
                        }}
                          className="flex-1 px-2 py-1 bg-white/[0.03] border border-[var(--color-border)] rounded-lg text-xs text-foreground focus:outline-none focus:border-gold" />
                        <button onClick={() => {
                          setBuilderQuestions(prev => prev.map(bq => bq.id === q.id ? { ...bq, required: !bq.required } : bq));
                        }}
                          className={`text-[8px] px-2 py-0.5 rounded-full transition-colors ${q.required ? "bg-gold/10 text-gold" : "bg-white/5 text-muted"}`}>
                          {q.required ? "Required" : "Optional"}
                        </button>
                        <button onClick={() => removeQuestion(q.id)} className="text-muted hover:text-red-400 transition-colors">
                          <X size={12} />
                        </button>
                      </div>
                      {/* Preview */}
                      {q.type === "nps" && (
                        <div className="flex gap-1">
                          {Array.from({ length: 11 }, (_, i) => (
                            <div key={i} className={`flex-1 text-center py-1.5 rounded text-[9px] border transition-colors ${
                              i >= 9 ? "border-emerald-500/20 text-emerald-400" :
                              i >= 7 ? "border-yellow-500/20 text-yellow-400" :
                              "border-[var(--color-border)] text-muted"
                            }`}>{i}</div>
                          ))}
                        </div>
                      )}
                      {q.type === "rating" && (
                        <div className="flex gap-1 justify-center py-1">
                          {[1, 2, 3, 4, 5].map(n => <Star key={n} size={20} className="text-gold/30 hover:text-gold cursor-pointer transition-colors" />)}
                        </div>
                      )}
                      {q.type === "text" && (
                        <div className="mt-1 px-3 py-2 bg-white/[0.02] border border-[var(--color-border)] rounded-lg text-[10px] text-muted/40">Type your answer...</div>
                      )}
                      {q.type === "multiple_choice" && q.options && (
                        <div className="flex flex-wrap gap-1.5 mt-1">
                          {q.options.map((opt, oi) => (
                            <span key={oi} className="text-[9px] px-2 py-1 border border-[var(--color-border)] rounded-lg text-muted">{opt}</span>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                {/* Add question */}
                {addingQuestion ? (
                  <div className="p-3 rounded-xl border border-gold/20 bg-gold/5 space-y-2">
                    <div className="flex items-center gap-2">
                      <select value={newQType} onChange={e => setNewQType(e.target.value as QuestionType)}
                        className="px-2 py-1.5 bg-white/[0.03] border border-[var(--color-border)] rounded-lg text-[10px] text-foreground focus:outline-none focus:border-gold">
                        {QUESTION_TYPES.map(qt => <option key={qt.type} value={qt.type}>{qt.label}</option>)}
                      </select>
                      <input value={newQText} onChange={e => setNewQText(e.target.value)} placeholder="Enter question text..."
                        className="flex-1 px-2 py-1.5 bg-white/[0.03] border border-[var(--color-border)] rounded-lg text-xs text-foreground focus:outline-none focus:border-gold" />
                    </div>
                    <div className="flex gap-2">
                      <button onClick={addQuestion} className="px-3 py-1 bg-gold text-black rounded-lg text-[10px] font-semibold hover:bg-gold/90">Add Question</button>
                      <button onClick={() => setAddingQuestion(false)} className="px-3 py-1 text-[10px] text-muted hover:text-foreground">Cancel</button>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-1.5">
                    <button onClick={() => setAddingQuestion(true)}
                      className="flex items-center gap-1 text-[10px] px-3 py-1.5 rounded-lg text-gold bg-gold/5 border border-gold/10 hover:bg-gold/10 transition-colors">
                      <Plus size={10} /> Add Question
                    </button>
                    {QUESTION_TYPES.map(qt => (
                      <button key={qt.type}
                        onClick={() => { setNewQType(qt.type); setAddingQuestion(true); }}
                        className="flex items-center gap-1 text-[9px] px-2 py-1.5 rounded-lg text-muted hover:text-foreground bg-white/[0.02] border border-[var(--color-border)] transition-colors">
                        {qt.icon} {qt.label}
                      </button>
                    ))}
                  </div>
                )}

                {/* Actions */}
                <div className="flex justify-between items-center pt-2 border-t border-[var(--color-border)]">
                  <span className="text-[10px] text-muted">{builderQuestions.length} question{builderQuestions.length !== 1 ? "s" : ""}</span>
                  <div className="flex gap-2">
                    <button className="flex items-center gap-1 px-3 py-1.5 text-xs rounded-lg border border-[var(--color-border)] text-muted hover:text-foreground transition-colors">
                      <Eye size={12} /> Preview
                    </button>
                    <button onClick={createSurvey}
                      className="flex items-center gap-1 px-4 py-1.5 text-xs rounded-lg bg-gold text-black font-semibold hover:bg-gold/90 transition-colors">
                      <Sparkles size={12} /> Create Survey
                    </button>
                  </div>
                </div>
              </div>

              {/* Embed / Share */}
              <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 space-y-3">
                <h2 className="text-sm font-bold flex items-center gap-2"><Globe size={13} className="text-blue-400" /> Embed & Share</h2>
                <pre className="text-[9px] text-muted bg-black/20 rounded-lg p-3 overflow-x-auto">{`<iframe src="https://app.shortstack.os/survey/embed/${surveys[0]?.id || 's1'}" width="100%" height="500" frameborder="0"></iframe>`}</pre>
                <div className="flex gap-2">
                  <button className="flex-1 flex items-center justify-center gap-1 px-3 py-2 text-xs rounded-lg border border-[var(--color-border)] text-muted hover:text-foreground transition-colors">
                    <Copy size={12} /> Copy Embed
                  </button>
                  <button className="flex-1 flex items-center justify-center gap-1 px-3 py-2 text-xs rounded-lg border border-[var(--color-border)] text-muted hover:text-foreground transition-colors">
                    <Mail size={12} /> Email Link
                  </button>
                </div>
              </div>
            </div>

            {/* Templates sidebar */}
            <div className="space-y-3">
              <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
                <h3 className="text-xs font-bold mb-3 flex items-center gap-1.5"><FileText size={12} className="text-gold" /> Templates</h3>
                <div className="space-y-2">
                  {TEMPLATES.map((tpl, i) => (
                    <button key={i} onClick={() => applyTemplate(i)}
                      className={`w-full text-left p-3 rounded-xl border transition-all ${
                        selectedTemplate === i ? "border-gold bg-gold/5" : "border-[var(--color-border)] hover:border-gold/30"
                      }`}>
                      <p className="text-xs font-semibold">{tpl.name}</p>
                      <p className="text-[9px] text-muted">{tpl.desc}</p>
                      <p className="text-[8px] text-muted mt-1">{tpl.questions.length} questions</p>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Responses Tab ──────────────────────────────────── */}
      {tab === "responses" && (
        <div className="space-y-4">
          {/* Filters */}
          <div className="flex items-center gap-3 flex-wrap">
            <div className="relative flex-1 max-w-xs">
              <Filter size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted/40" />
              <input value={responseSearch} onChange={e => setResponseSearch(e.target.value)}
                placeholder="Search by client name..."
                className="w-full pl-8 pr-3 py-2 bg-white/[0.03] border border-[var(--color-border)] rounded-lg text-xs text-foreground focus:outline-none focus:border-gold transition-colors" />
            </div>
            <div className="flex gap-1">
              {["All", "Promoter", "Passive", "Detractor"].map(seg => (
                <button key={seg} onClick={() => setSegmentFilter(seg)}
                  className={`px-3 py-1.5 text-[10px] rounded-lg font-medium transition-all ${
                    segmentFilter === seg ? "bg-gold/10 text-gold" : "text-muted hover:text-foreground"
                  }`}>
                  {seg}
                </button>
              ))}
            </div>
            <button className="flex items-center gap-1 px-3 py-1.5 text-xs rounded-lg border border-[var(--color-border)] text-muted hover:text-foreground transition-all">
              <Download size={12} /> Export CSV
            </button>
          </div>

          {/* Response cards */}
          <div className="space-y-2">
            {filteredResponses.length === 0 ? (
              <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] text-center py-12">
                <MessageSquare size={24} className="mx-auto mb-2 text-muted/20" />
                <p className="text-xs text-muted">No responses match your filters</p>
              </div>
            ) : (
              filteredResponses.map(r => (
                <div key={r.id} className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] overflow-hidden">
                  <button
                    onClick={() => setExpandedResponse(expandedResponse === r.id ? null : r.id)}
                    className="w-full flex items-center gap-3 p-4 text-left hover:bg-white/[0.01] transition-colors">
                    {/* Avatar */}
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                      r.segment === "Promoter" ? "bg-emerald-500/10 text-emerald-400" :
                      r.segment === "Passive" ? "bg-yellow-500/10 text-yellow-400" :
                      "bg-red-500/10 text-red-400"
                    }`}>{r.avatar}</div>
                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-xs font-semibold">{r.client}</p>
                        <span className={`text-[8px] px-1.5 py-0.5 rounded-full ${
                          r.segment === "Promoter" ? "bg-emerald-400/10 text-emerald-400" :
                          r.segment === "Passive" ? "bg-yellow-400/10 text-yellow-400" :
                          "bg-red-400/10 text-red-400"
                        }`}>{r.segment}</span>
                        {r.followUp && <span className="text-[8px] px-1.5 py-0.5 rounded-full bg-orange-400/10 text-orange-400">Needs follow-up</span>}
                      </div>
                      <p className="text-[10px] text-muted truncate mt-0.5">{r.comment}</p>
                    </div>
                    {/* Score */}
                    <div className="text-right shrink-0">
                      <p className={`text-2xl font-bold ${
                        r.npsScore >= 9 ? "text-emerald-400" : r.npsScore >= 7 ? "text-gold" : "text-red-400"
                      }`}>{r.npsScore}</p>
                      <p className="text-[8px] text-muted">{r.submittedAt}</p>
                    </div>
                    {expandedResponse === r.id ? <ChevronUp size={14} className="text-muted shrink-0" /> : <ChevronDown size={14} className="text-muted shrink-0" />}
                  </button>
                  {expandedResponse === r.id && (
                    <div className="px-4 pb-4 border-t border-[var(--color-border)] pt-3 space-y-2">
                      <p className="text-xs text-muted leading-relaxed">&ldquo;{r.comment}&rdquo;</p>
                      {r.followUp && (
                        <div className="p-2.5 rounded-lg bg-orange-400/5 border border-orange-400/10">
                          <p className="text-[10px] text-orange-400 font-semibold">Suggested follow-up:</p>
                          <p className="text-[10px] text-muted">{r.followUp}</p>
                        </div>
                      )}
                      <div className="flex gap-2">
                        <button className="flex items-center gap-1 px-3 py-1 text-[10px] rounded-lg bg-gold/10 text-gold hover:bg-gold/20 transition-colors">
                          <Mail size={10} /> Reply
                        </button>
                        <button className="flex items-center gap-1 px-3 py-1 text-[10px] rounded-lg border border-[var(--color-border)] text-muted hover:text-foreground transition-colors">
                          <ListChecks size={10} /> Create Task
                        </button>
                        <button className="flex items-center gap-1 px-3 py-1 text-[10px] rounded-lg border border-[var(--color-border)] text-muted hover:text-foreground transition-colors">
                          <Users size={10} /> Assign
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* ── Trends Tab ─────────────────────────────────────── */}
      {tab === "trends" && (
        <div className="space-y-4">
          {/* NPS Over Time Chart */}
          <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
            <h2 className="text-sm font-bold mb-1 flex items-center gap-2"><TrendingUp size={13} className="text-gold" /> NPS Over Time</h2>
            <p className="text-[10px] text-muted mb-4">6-month trend</p>

            <div className="relative h-40">
              {/* Y-axis labels */}
              <div className="absolute left-0 top-0 bottom-6 flex flex-col justify-between text-[8px] text-muted w-8">
                <span>{maxTrend + 10}</span>
                <span>{Math.round((maxTrend + minTrend) / 2)}</span>
                <span>{Math.max(minTrend - 10, 0)}</span>
              </div>
              {/* Chart area */}
              <div className="ml-10 h-full flex items-end gap-3">
                {NPS_TREND.map((point, i) => {
                  const range = (maxTrend + 10) - Math.max(minTrend - 10, 0);
                  const heightPct = ((point.score - Math.max(minTrend - 10, 0)) / range) * 100;
                  const isLast = i === NPS_TREND.length - 1;
                  return (
                    <div key={point.month} className="flex-1 flex flex-col items-center gap-1">
                      <span className={`text-[9px] font-bold ${isLast ? "text-gold" : "text-muted"}`}>{point.score}</span>
                      <div className="w-full relative" style={{ height: "calc(100% - 24px)" }}>
                        <div className={`absolute bottom-0 w-full rounded-t-lg transition-all duration-500 ${
                          isLast ? "bg-gold" : point.score >= 50 ? "bg-emerald-400/70" : "bg-gold/40"
                        }`}
                          style={{ height: `${heightPct}%`, minHeight: 8 }} />
                      </div>
                      <span className="text-[9px] text-muted">{point.month}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Trend summary */}
            {NPS_TREND.length > 0 && (
            <div className="flex items-center gap-4 mt-4 pt-3 border-t border-[var(--color-border)]">
              <div className="flex items-center gap-1.5">
                <TrendingUp size={12} className="text-emerald-400" />
                <span className="text-xs text-emerald-400 font-semibold">+{NPS_TREND[NPS_TREND.length - 1].score - NPS_TREND[0].score} pts</span>
                <span className="text-[10px] text-muted">over 6 months</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] text-muted">Current:</span>
                <span className="text-xs font-bold text-gold">{NPS_TREND[NPS_TREND.length - 1].score}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] text-muted">Target:</span>
                <span className="text-xs font-bold text-emerald-400">60</span>
              </div>
            </div>
            )}
          </div>

          {/* Response Rate Trend */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
              <h2 className="text-sm font-bold mb-3">Response Rate by Survey</h2>
              <div className="space-y-3">
                {surveys.map(s => (
                  <div key={s.id}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs truncate">{s.name}</span>
                      <span className="text-xs font-bold text-gold">{s.responseRate}%</span>
                    </div>
                    <div className="w-full h-2 bg-white/[0.04] rounded-full overflow-hidden">
                      <div className="h-full bg-gold rounded-full transition-all" style={{ width: `${s.responseRate}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
              <h2 className="text-sm font-bold mb-3">Key Insights</h2>
              <div className="space-y-2">
                {[
                  { icon: TrendingUp, color: "text-emerald-400", text: "NPS trending upward for 4 consecutive months", bg: "bg-emerald-400/5" },
                  { icon: ThumbsUp, color: "text-gold", text: "40% of clients are Promoters - above industry avg", bg: "bg-gold/5" },
                  { icon: AlertTriangle, color: "text-orange-400", text: "3 detractors need immediate follow-up", bg: "bg-orange-400/5" },
                  { icon: Clock, color: "text-blue-400", text: "Average response time: 2.3 days after send", bg: "bg-blue-400/5" },
                  { icon: Sparkles, color: "text-purple-400", text: "AI detected common theme: turnaround speed", bg: "bg-purple-400/5" },
                ].map((insight, i) => (
                  <div key={i} className={`flex items-start gap-2.5 p-2.5 rounded-lg ${insight.bg}`}>
                    <insight.icon size={12} className={`${insight.color} shrink-0 mt-0.5`} />
                    <span className="text-[10px] text-muted">{insight.text}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Segment Movement */}
          <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
            <h2 className="text-sm font-bold mb-3">Segment Movement (Last 3 Months)</h2>
            <div className="grid grid-cols-3 gap-4">
              {[
                { label: "Promoters", prev: 3, current: promoters, color: "text-emerald-400", bg: "bg-emerald-400" },
                { label: "Passives", prev: 4, current: passives, color: "text-yellow-400", bg: "bg-yellow-400" },
                { label: "Detractors", prev: 5, current: detractors, color: "text-red-400", bg: "bg-red-400" },
              ].map(seg => {
                const change = seg.current - seg.prev;
                const isGood = (seg.label === "Detractors" && change < 0) || (seg.label !== "Detractors" && change > 0);
                return (
                  <div key={seg.label} className="p-4 rounded-xl border border-[var(--color-border)] text-center">
                    <p className={`text-[10px] ${seg.color}`}>{seg.label}</p>
                    <p className={`text-3xl font-bold mt-1 ${seg.color}`}>{seg.current}</p>
                    <div className="flex items-center justify-center gap-1 mt-1">
                      <span className={`text-[10px] font-medium ${isGood ? "text-emerald-400" : "text-red-400"}`}>
                        {change > 0 ? "+" : ""}{change}
                      </span>
                      <span className="text-[9px] text-muted">vs last quarter</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ── Send Survey Modal ──────────────────────────────── */}
      {showSend && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => setShowSend(false)}>
          <div className="bg-[var(--color-surface)] rounded-2xl border border-[var(--color-border)] w-full max-w-md p-5 space-y-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold flex items-center gap-2"><Send size={14} className="text-gold" /> Send Survey</h3>
              <button onClick={() => setShowSend(false)} className="text-muted hover:text-foreground"><X size={16} /></button>
            </div>
            <div>
              <label className="block text-[10px] text-muted mb-1">Select Survey</label>
              <select className="w-full px-3 py-2 bg-white/[0.03] border border-[var(--color-border)] rounded-lg text-xs text-foreground focus:outline-none focus:border-gold">
                {surveys.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[10px] text-muted mb-1">Send To</label>
              <select className="w-full px-3 py-2 bg-white/[0.03] border border-[var(--color-border)] rounded-lg text-xs text-foreground focus:outline-none focus:border-gold">
                <option>All Active Clients</option>
                <option>Promoters Only</option>
                <option>Passives Only</option>
                <option>Detractors Only</option>
                <option>Specific Client...</option>
              </select>
            </div>
            <div>
              <label className="block text-[10px] text-muted mb-1">Delivery Method</label>
              <div className="flex gap-2">
                {[
                  { label: "Email", icon: Mail, active: true },
                  { label: "SMS", icon: MessageSquare, active: false },
                  { label: "Link", icon: Globe, active: false },
                ].map(m => (
                  <button key={m.label} className={`flex-1 p-2.5 rounded-xl border text-xs text-center transition-all ${
                    m.active ? "border-gold bg-gold/5 text-gold" : "border-[var(--color-border)] text-muted"
                  }`}>
                    <m.icon size={14} className="mx-auto mb-1" /> {m.label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-[10px] text-muted mb-1">Schedule</label>
              <div className="flex gap-2">
                <select className="flex-1 px-3 py-2 bg-white/[0.03] border border-[var(--color-border)] rounded-lg text-xs text-foreground focus:outline-none focus:border-gold">
                  <option>Send Now</option>
                  <option>Schedule for later</option>
                </select>
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2 border-t border-[var(--color-border)]">
              <button onClick={() => setShowSend(false)} className="px-3 py-1.5 text-xs rounded-lg border border-[var(--color-border)] text-muted hover:text-foreground transition-colors">Cancel</button>
              <button onClick={() => setShowSend(false)} className="flex items-center gap-1 px-4 py-1.5 text-xs rounded-lg bg-gold text-black font-semibold hover:bg-gold/90 transition-colors">
                <Send size={12} /> Send Now
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
