"use client";

import { useState } from "react";
import {
  BarChart3, Copy, Send, X, Plus, Star,
  MessageSquare, CheckCircle, Clock, Download,
  Zap, Globe,
  ThumbsUp, ThumbsDown, ArrowRight, Mail
} from "lucide-react";

type SurveyTab = "dashboard" | "builder" | "responses" | "templates";

type QuestionType = "nps" | "csat" | "multiple_choice" | "open_text" | "rating";

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
  thankYouMessage: string;
  followUpEnabled: boolean;
}

interface SurveyResponse {
  id: string;
  surveyId: string;
  respondent: string;
  answers: Record<string, string | number>;
  submittedAt: string;
  segment: string;
}

const QUESTION_TYPES: { type: QuestionType; label: string; icon: React.ReactNode }[] = [
  { type: "nps", label: "NPS (0-10)", icon: <BarChart3 size={12} /> },
  { type: "csat", label: "CSAT (1-5)", icon: <Star size={12} /> },
  { type: "multiple_choice", label: "Multiple Choice", icon: <CheckCircle size={12} /> },
  { type: "open_text", label: "Open Text", icon: <MessageSquare size={12} /> },
  { type: "rating", label: "Star Rating", icon: <Star size={12} /> },
];

const MOCK_SURVEYS: Survey[] = [
  {
    id: "s1", name: "Client Satisfaction Q2", active: true, responses: 23, responseRate: 76,
    thankYouMessage: "Thanks for your feedback!",
    followUpEnabled: true,
    questions: [
      { id: "q1", type: "nps", text: "How likely are you to recommend us to a friend?", required: true },
      { id: "q2", type: "csat", text: "How satisfied are you with our service?", required: true },
      { id: "q3", type: "open_text", text: "What could we improve?", required: false },
    ],
  },
  {
    id: "s2", name: "Onboarding Experience", active: true, responses: 8, responseRate: 62,
    thankYouMessage: "Thank you for helping us improve!",
    followUpEnabled: false,
    questions: [
      { id: "q4", type: "rating", text: "Rate your onboarding experience", required: true },
      { id: "q5", type: "multiple_choice", text: "What was most helpful?", options: ["Kickoff call", "Tutorial videos", "Documentation", "Support team"], required: true },
      { id: "q6", type: "open_text", text: "Any suggestions?", required: false },
    ],
  },
];

const MOCK_RESPONSES: SurveyResponse[] = [
  { id: "r1", surveyId: "s1", respondent: "Bright Dental", answers: { "q1": 9, "q2": 5, "q3": "Love the content quality!" }, submittedAt: "2026-04-14T09:00:00Z", segment: "Enterprise" },
  { id: "r2", surveyId: "s1", respondent: "Luxe Salon", answers: { "q1": 8, "q2": 4, "q3": "Would like faster turnaround" }, submittedAt: "2026-04-13T14:00:00Z", segment: "Growth" },
  { id: "r3", surveyId: "s1", respondent: "FitPro Gym", answers: { "q1": 10, "q2": 5, "q3": "" }, submittedAt: "2026-04-12T11:00:00Z", segment: "Growth" },
  { id: "r4", surveyId: "s1", respondent: "Metro Realty", answers: { "q1": 6, "q2": 3, "q3": "Need more communication" }, submittedAt: "2026-04-11T16:00:00Z", segment: "Starter" },
  { id: "r5", surveyId: "s1", respondent: "Green Eats", answers: { "q1": 9, "q2": 5, "q3": "Everything is great" }, submittedAt: "2026-04-10T10:00:00Z", segment: "Enterprise" },
  { id: "r6", surveyId: "s1", respondent: "Peak Fitness", answers: { "q1": 4, "q2": 2, "q3": "Not seeing ROI yet" }, submittedAt: "2026-04-09T09:00:00Z", segment: "Starter" },
  { id: "r7", surveyId: "s2", respondent: "Valley Dental", answers: { "q4": 4, "q5": "Kickoff call" }, submittedAt: "2026-04-08T13:00:00Z", segment: "Starter" },
  { id: "r8", surveyId: "s2", respondent: "Bloom Florist", answers: { "q4": 3, "q5": "Documentation", "q6": "More video tutorials please" }, submittedAt: "2026-04-07T15:00:00Z", segment: "Growth" },
];

const TEMPLATES: { name: string; desc: string; questions: SurveyQuestion[] }[] = [
  { name: "NPS Survey", desc: "Net Promoter Score", questions: [{ id: "t1", type: "nps", text: "How likely are you to recommend us?", required: true }, { id: "t2", type: "open_text", text: "Tell us why", required: false }] },
  { name: "CSAT Survey", desc: "Customer Satisfaction", questions: [{ id: "t3", type: "csat", text: "How satisfied are you?", required: true }, { id: "t4", type: "open_text", text: "What could we improve?", required: false }] },
  { name: "Post-Project", desc: "After project delivery", questions: [{ id: "t5", type: "rating", text: "Rate the final deliverable", required: true }, { id: "t6", type: "csat", text: "How was communication?", required: true }, { id: "t7", type: "open_text", text: "Additional feedback", required: false }] },
  { name: "Onboarding", desc: "New client experience", questions: [{ id: "t8", type: "rating", text: "Rate your onboarding", required: true }, { id: "t9", type: "multiple_choice", text: "Most helpful part?", options: ["Kickoff call", "Docs", "Videos", "Support"], required: true }] },
  { name: "Quarterly Check-in", desc: "Regular pulse check", questions: [{ id: "t10", type: "nps", text: "NPS Score", required: true }, { id: "t11", type: "csat", text: "Satisfaction", required: true }, { id: "t12", type: "multiple_choice", text: "Top priority?", options: ["More content", "Better ads", "Faster delivery", "New services"], required: true }] },
  { name: "Exit Survey", desc: "When client leaves", questions: [{ id: "t13", type: "multiple_choice", text: "Why are you leaving?", options: ["Budget", "Results", "Communication", "Found alternative", "Other"], required: true }, { id: "t14", type: "open_text", text: "What could we have done differently?", required: false }] },
];

export default function SurveysPage() {
  const [tab, setTab] = useState<SurveyTab>("dashboard");
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [surveys, setSurveys] = useState(MOCK_SURVEYS);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [activeSurvey, setActiveSurvey] = useState<Survey | null>(null);
  const [showSend, setShowSend] = useState(false);
  const [segmentFilter, setSegmentFilter] = useState("All");
  const [showSchedule, setShowSchedule] = useState(false);

  const allResponses = MOCK_RESPONSES;
  const npsScores = allResponses.filter(r => r.answers["q1"] !== undefined).map(r => Number(r.answers["q1"]));
  const promoters = npsScores.filter(s => s >= 9).length;
  const detractors = npsScores.filter(s => s < 7).length;
  const nps = npsScores.length > 0 ? Math.round(((promoters - detractors) / npsScores.length) * 100) : 0;
  const avgScore = npsScores.length > 0 ? (npsScores.reduce((a, b) => a + b, 0) / npsScores.length).toFixed(1) : "--";
  const totalResponses = allResponses.length;

  const distribution = Array.from({ length: 10 }, (_, i) => npsScores.filter(s => s === i + 1).length);
  const maxDist = Math.max(...distribution, 1);

  const filteredResponses = segmentFilter === "All" ? allResponses : allResponses.filter(r => r.segment === segmentFilter);

  const TABS: { id: SurveyTab; label: string; icon: React.ReactNode }[] = [
    { id: "dashboard", label: "Dashboard", icon: <BarChart3 size={13} /> },
    { id: "builder", label: "Builder", icon: <Plus size={13} /> },
    { id: "responses", label: "Responses", icon: <MessageSquare size={13} /> },
    { id: "templates", label: "Templates", icon: <Star size={13} /> },
  ];

  return (
    <div className="fade-in space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="page-header mb-0 flex items-center gap-2"><BarChart3 size={18} className="text-gold" /> Client Surveys</h1>
          <p className="text-xs text-muted mt-0.5">{totalResponses} responses - Track NPS and satisfaction</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setShowSend(true)} className="btn-secondary text-xs flex items-center gap-1.5"><Send size={12} /> Send Survey</button>
          <button onClick={() => setShowSchedule(true)} className="btn-secondary text-xs flex items-center gap-1.5"><Clock size={12} /> Schedule</button>
          <button onClick={() => navigator.clipboard.writeText("https://shortstack-os.vercel.app/survey")} className="btn-primary text-xs flex items-center gap-1.5"><Copy size={12} /> Copy Link</button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <div className="card text-center">
          <p className="text-[10px] text-muted">NPS Score</p>
          <p className={`text-3xl font-extrabold ${nps >= 50 ? "text-emerald-400" : nps >= 0 ? "text-yellow-400" : "text-red-400"}`}>{nps}</p>
          <p className="text-[8px] text-muted">{nps >= 50 ? "Excellent" : nps >= 0 ? "Good" : "Needs Work"}</p>
        </div>
        <div className="card text-center">
          <p className="text-[10px] text-muted">Avg Rating</p>
          <p className="text-3xl font-extrabold text-gold">{avgScore}</p>
          <p className="text-[8px] text-muted">out of 10</p>
        </div>
        <div className="card text-center">
          <p className="text-[10px] text-emerald-400">Promoters</p>
          <p className="text-2xl font-bold text-emerald-400">{promoters}</p>
          <p className="text-[8px] text-muted">9-10 score</p>
        </div>
        <div className="card text-center">
          <p className="text-[10px] text-red-400">Detractors</p>
          <p className="text-2xl font-bold text-red-400">{detractors}</p>
          <p className="text-[8px] text-muted">0-6 score</p>
        </div>
        <div className="card text-center">
          <p className="text-[10px] text-blue-400">Response Rate</p>
          <p className="text-2xl font-bold text-blue-400">72%</p>
          <p className="text-[8px] text-muted">avg across surveys</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-surface rounded-lg p-1 w-fit">
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-md transition-all ${
              tab === t.id ? "bg-gold/10 text-gold font-medium" : "text-muted hover:text-foreground"
            }`}>
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {/* Dashboard Tab */}
      {tab === "dashboard" && (
        <div className="space-y-4">
          {/* Score Distribution */}
          <div className="card">
            <h2 className="section-header">NPS Score Distribution</h2>
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
          </div>

          {/* Real-time Results */}
          <div className="card">
            <div className="flex items-center justify-between">
              <h2 className="section-header flex items-center gap-2 mb-0"><Zap size={13} className="text-gold" /> Live Results</h2>
              <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" /><span className="text-[9px] text-emerald-400">Real-time</span></div>
            </div>
            <div className="mt-3 space-y-2">
              {surveys.map(s => (
                <div key={s.id} className="flex items-center gap-3 p-3 rounded-lg bg-surface-light border border-border">
                  <div className={`w-3 h-8 rounded-full ${s.active ? "bg-emerald-400" : "bg-gray-500"}`} />
                  <div className="flex-1">
                    <p className="text-xs font-semibold">{s.name}</p>
                    <p className="text-[10px] text-muted">{s.questions.length} questions - {s.active ? "Active" : "Paused"}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold">{s.responses} responses</p>
                    <p className="text-[9px] text-muted">{s.responseRate}% rate</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Response Rate Tracker */}
          <div className="card">
            <h2 className="section-header flex items-center gap-2"><Globe size={13} className="text-blue-400" /> Response Rate by Segment</h2>
            <div className="grid grid-cols-3 gap-3">
              {["Enterprise", "Growth", "Starter"].map(seg => {
                const segResponses = allResponses.filter(r => r.segment === seg);
                const rate = seg === "Enterprise" ? 85 : seg === "Growth" ? 72 : 55;
                return (
                  <div key={seg} className="p-3 rounded-lg bg-surface-light text-center border border-border">
                    <p className="text-[10px] text-muted">{seg}</p>
                    <p className="text-xl font-bold text-gold">{rate}%</p>
                    <p className="text-[9px] text-muted">{segResponses.length} responses</p>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Builder Tab */}
      {tab === "builder" && (
        <div className="space-y-4">
          <div className="card">
            <h2 className="section-header flex items-center gap-2"><Plus size={13} className="text-gold" /> Survey Builder</h2>
            <div className="space-y-3">
              <input className="input w-full text-xs" placeholder="Survey title..." defaultValue="New Survey" />
              <div className="space-y-2">
                {[
                  { id: "new1", type: "nps" as const, text: "How likely are you to recommend us?", required: true },
                  { id: "new2", type: "csat" as const, text: "Overall satisfaction?", required: true },
                ].map((q, idx) => (
                  <div key={q.id} className="p-3 rounded-lg bg-surface-light border border-border">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-[9px] font-bold text-muted">Q{idx + 1}</span>
                      <select className="input text-[10px] w-32" defaultValue={q.type}>
                        {QUESTION_TYPES.map(qt => <option key={qt.type} value={qt.type}>{qt.label}</option>)}
                      </select>
                      <input className="input flex-1 text-xs" defaultValue={q.text} />
                      <button className={`text-[8px] px-1.5 py-0.5 rounded ${q.required ? "bg-gold/10 text-gold" : "text-muted"}`}>
                        {q.required ? "Required" : "Optional"}
                      </button>
                    </div>
                    {q.type === "nps" && (
                      <div className="flex gap-1">
                        {Array.from({ length: 11 }, (_, i) => (
                          <div key={i} className="flex-1 text-center py-1 rounded text-[9px] bg-surface border border-border">{i}</div>
                        ))}
                      </div>
                    )}
                    {q.type === "csat" && (
                      <div className="flex gap-1 justify-center">
                        {[1,2,3,4,5].map(n => (
                          <Star key={n} size={20} className="text-gold/30" />
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
              <div className="flex flex-wrap gap-1.5">
                {QUESTION_TYPES.map(qt => (
                  <button key={qt.type} className="flex items-center gap-1 text-[9px] px-2 py-1 rounded-md text-muted hover:text-foreground bg-surface-light border border-border">
                    <Plus size={8} /> {qt.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
          {/* Thank You & Follow-up */}
          <div className="card">
            <h2 className="section-header flex items-center gap-2"><CheckCircle size={13} className="text-emerald-400" /> Thank You Flow</h2>
            <div className="space-y-3">
              <div>
                <label className="block text-[10px] text-muted mb-1">Thank You Message</label>
                <textarea className="input w-full text-xs h-16" defaultValue="Thank you for your feedback! We appreciate your time." />
              </div>
              <div className="flex items-center justify-between p-2.5 rounded-lg bg-surface-light">
                <div>
                  <p className="text-xs font-medium">Follow-up Automation</p>
                  <p className="text-[10px] text-muted">Auto-send follow-up based on score</p>
                </div>
                <div className="w-10 h-5 rounded-full bg-gold relative"><div className="w-4 h-4 rounded-full bg-white absolute top-0.5" style={{ left: 22 }} /></div>
              </div>
              <div className="p-3 rounded-lg bg-gold/5 border border-gold/10">
                <p className="text-[10px] text-gold font-semibold mb-1">Follow-up Rules:</p>
                <div className="space-y-1 text-[10px] text-muted">
                  <p className="flex items-center gap-1"><ThumbsDown size={9} className="text-red-400" /> Score 0-6: Send apology + improvement plan</p>
                  <p className="flex items-center gap-1"><ArrowRight size={9} className="text-yellow-400" /> Score 7-8: Send thank you + upsell offer</p>
                  <p className="flex items-center gap-1"><ThumbsUp size={9} className="text-emerald-400" /> Score 9-10: Request testimonial + referral ask</p>
                </div>
              </div>
            </div>
          </div>
          {/* Embedding */}
          <div className="card">
            <h2 className="section-header flex items-center gap-2"><Globe size={13} className="text-blue-400" /> Embed Survey</h2>
            <pre className="text-[9px] text-muted bg-black/20 rounded-lg p-3 overflow-x-auto">{`<iframe src="https://shortstack-os.vercel.app/survey/embed/s1" width="100%" height="500" frameborder="0"></iframe>`}</pre>
            <button className="btn-primary w-full text-xs mt-2 flex items-center justify-center gap-1.5"><Copy size={12} /> Copy Embed Code</button>
          </div>
        </div>
      )}

      {/* Responses Tab */}
      {tab === "responses" && (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <select value={segmentFilter} onChange={e => setSegmentFilter(e.target.value)} className="input text-xs">
              <option value="All">All Segments</option>
              <option value="Enterprise">Enterprise</option>
              <option value="Growth">Growth</option>
              <option value="Starter">Starter</option>
            </select>
            <button className="btn-secondary text-xs flex items-center gap-1.5"><Download size={12} /> Export CSV</button>
          </div>
          <div className="space-y-2">
            {filteredResponses.map(r => (
              <div key={r.id} className="card p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <p className="text-xs font-bold">{r.respondent}</p>
                    <span className="text-[8px] px-1.5 py-0.5 rounded-full bg-blue-400/10 text-blue-400">{r.segment}</span>
                  </div>
                  <span className="text-[9px] text-muted">{new Date(r.submittedAt).toLocaleDateString()}</span>
                </div>
                <div className="space-y-1.5">
                  {Object.entries(r.answers).map(([qId, answer]) => (
                    <div key={qId} className="flex items-center gap-2 text-xs">
                      <span className="text-muted w-6">{qId.toUpperCase()}</span>
                      {typeof answer === "number" ? (
                        <span className={`font-bold ${Number(answer) >= 9 ? "text-emerald-400" : Number(answer) >= 7 ? "text-gold" : "text-red-400"}`}>{answer}/10</span>
                      ) : answer ? (
                        <span className="text-muted italic">&ldquo;{answer}&rdquo;</span>
                      ) : (
                        <span className="text-muted/30">No response</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Templates Tab */}
      {tab === "templates" && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {TEMPLATES.map((tpl, i) => (
            <div key={i} className="card p-4 hover:border-gold/10 transition-all cursor-pointer">
              <p className="text-sm font-bold mb-1">{tpl.name}</p>
              <p className="text-[10px] text-muted mb-2">{tpl.desc}</p>
              <div className="space-y-1 mb-3">
                {tpl.questions.map(q => (
                  <div key={q.id} className="flex items-center gap-1.5 text-[10px]">
                    {QUESTION_TYPES.find(qt => qt.type === q.type)?.icon}
                    <span className="text-muted truncate">{q.text}</span>
                  </div>
                ))}
              </div>
              <button className="btn-secondary text-[10px] w-full">Use Template</button>
            </div>
          ))}
        </div>
      )}

      {/* Send Modal */}
      {showSend && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => setShowSend(false)}>
          <div className="bg-surface rounded-2xl border border-border w-full max-w-md p-5 space-y-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold flex items-center gap-2"><Send size={14} className="text-gold" /> Send Survey</h3>
              <button onClick={() => setShowSend(false)} className="text-muted hover:text-foreground"><X size={16} /></button>
            </div>
            <div>
              <label className="block text-[10px] text-muted mb-1">Select Survey</label>
              <select className="input w-full text-xs">
                {surveys.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[10px] text-muted mb-1">Send To</label>
              <select className="input w-full text-xs">
                <option>All Active Clients</option>
                <option>Enterprise Clients</option>
                <option>Growth Clients</option>
                <option>Starter Clients</option>
                <option>Specific Client...</option>
              </select>
            </div>
            <div>
              <label className="block text-[10px] text-muted mb-1">Delivery Method</label>
              <div className="flex gap-2">
                <button className="flex-1 p-2 rounded-lg border border-gold bg-gold/5 text-xs text-center"><Mail size={12} className="mx-auto mb-1" /> Email</button>
                <button className="flex-1 p-2 rounded-lg border border-border text-xs text-center text-muted"><MessageSquare size={12} className="mx-auto mb-1" /> SMS</button>
                <button className="flex-1 p-2 rounded-lg border border-border text-xs text-center text-muted"><Globe size={12} className="mx-auto mb-1" /> Link</button>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <button onClick={() => setShowSend(false)} className="btn-secondary text-xs">Cancel</button>
              <button onClick={() => setShowSend(false)} className="btn-primary text-xs flex items-center gap-1.5"><Send size={12} /> Send Now</button>
            </div>
          </div>
        </div>
      )}

      {/* Schedule Modal */}
      {showSchedule && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => setShowSchedule(false)}>
          <div className="bg-surface rounded-2xl border border-border w-full max-w-md p-5 space-y-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold flex items-center gap-2"><Clock size={14} className="text-gold" /> Schedule Survey</h3>
              <button onClick={() => setShowSchedule(false)} className="text-muted hover:text-foreground"><X size={16} /></button>
            </div>
            <div>
              <label className="block text-[10px] text-muted mb-1">Frequency</label>
              <select className="input w-full text-xs">
                <option>One-time</option>
                <option>Monthly</option>
                <option>Quarterly</option>
                <option>After onboarding</option>
                <option>After project delivery</option>
              </select>
            </div>
            <div>
              <label className="block text-[10px] text-muted mb-1">Send Date</label>
              <input type="date" className="input w-full text-xs" defaultValue="2026-04-30" />
            </div>
            <div className="flex justify-end gap-2">
              <button onClick={() => setShowSchedule(false)} className="btn-secondary text-xs">Cancel</button>
              <button onClick={() => setShowSchedule(false)} className="btn-primary text-xs flex items-center gap-1.5"><Clock size={12} /> Schedule</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
