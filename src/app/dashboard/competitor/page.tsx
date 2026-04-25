"use client";

import { useState } from "react";
import {
  Search, Crosshair, Globe, BarChart3, Megaphone, FileSearch,
  Loader2, Plus, Eye, TrendingUp, Star,
  Shield, Zap, Calendar, AlertTriangle,
  CheckCircle, Target, Activity
} from "lucide-react";
import PageHero from "@/components/ui/page-hero";
import EmptyState from "@/components/empty-state";

interface CompetitorProfile {
  id: string;
  name: string;
  url: string;
  industry: string;
  followers: { ig: number; fb: number; tt: number; li: number; yt: number };
  postingFreq: number;
  engagement: number;
  strengths: string[];
  weaknesses: string[];
  priceRange: string;
  lastAnalyzed: string;
}

const MOCK_COMPETITORS: CompetitorProfile[] = [];

const MOCK_ALERTS: { id: string; competitor: string; event: string; time: string; type: string }[] = [];

const quickAnalyses = [
  { label: "Social Media Audit", icon: Megaphone, prompt: "Perform a comprehensive social media audit..." },
  { label: "SEO Analysis", icon: BarChart3, prompt: "Conduct an SEO analysis..." },
  { label: "Ad Strategy", icon: Crosshair, prompt: "Analyze the advertising strategy..." },
  { label: "Content Review", icon: FileSearch, prompt: "Review the content strategy..." },
];

const TABS = ["Profiles", "Comparison", "SWOT", "Alerts", "Analysis", "Weekly Report"] as const;
type Tab = typeof TABS[number];

export default function CompetitorPage() {
  const [tab, setTab] = useState<Tab>("Profiles");
  const [competitors, setCompetitors] = useState(MOCK_COMPETITORS);
  const [competitorInput, setCompetitorInput] = useState("");
  const [analysisResult, setAnalysisResult] = useState("");
  const [loading, setLoading] = useState(false);
  const [selectedCompetitor, setSelectedCompetitor] = useState<CompetitorProfile | null>(null);
  const [addName, setAddName] = useState("");
  const [addUrl, setAddUrl] = useState("");

  function addCompetitor() {
    if (!addName || !addUrl) return;
    const newComp: CompetitorProfile = {
      id: `c${Date.now()}`, name: addName, url: addUrl, industry: "Unknown",
      followers: { ig: 0, fb: 0, tt: 0, li: 0, yt: 0 },
      postingFreq: 0, engagement: 0, strengths: [], weaknesses: [],
      priceRange: "Unknown", lastAnalyzed: "Never",
    };
    setCompetitors(prev => [...prev, newComp]);
    setAddName("");
    setAddUrl("");
  }

  const runAnalysis = async (prompt: string, _label: string) => {
    if (!competitorInput.trim()) return;
    setLoading(true);
    setAnalysisResult("");
    try {
      const res = await fetch("/api/trinity/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: `${prompt}\n\nCompetitor: ${competitorInput}` }),
      });
      if (!res.ok) throw new Error("fail");
      const data = await res.json();
      setAnalysisResult(data.response || data.message || "Analysis complete.");
    } catch {
      setAnalysisResult("Failed to analyze. Try again.");
    }
    setLoading(false);
  };

  return (
    <div className="fade-in space-y-5">
      <PageHero
        icon={<Crosshair size={22} />}
        title="Competitor Intelligence"
        subtitle={`${competitors.length} competitors tracked — AI-powered analysis.`}
        gradient="purple"
      />

      {/* Tabs */}
      <div className="flex gap-1 overflow-x-auto">
        {TABS.map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-3 py-1.5 rounded-lg text-[10px] font-medium whitespace-nowrap transition-all ${
              tab === t ? "bg-gold/15 text-gold border border-gold/20" : "text-muted border border-transparent hover:text-foreground"
            }`}>{t}</button>
        ))}
      </div>

      {/* ═══ PROFILES TAB ═══ */}
      {tab === "Profiles" && (
        <div className="space-y-4">
          {/* Add Competitor */}
          <div className="card">
            <h2 className="text-sm font-bold flex items-center gap-2 mb-3"><Plus size={14} className="text-gold" /> Add Competitor</h2>
            <div className="flex gap-2">
              <input value={addName} onChange={e => setAddName(e.target.value)} placeholder="Competitor name" className="input flex-1 text-xs" />
              <input value={addUrl} onChange={e => setAddUrl(e.target.value)} placeholder="website.com" className="input flex-1 text-xs" />
              <button onClick={addCompetitor} disabled={!addName || !addUrl} className="btn-primary text-xs disabled:opacity-40">Add</button>
            </div>
          </div>

          {/* Competitor Cards */}
          {competitors.length === 0 && (
            <EmptyState
              icon={<Crosshair size={24} />}
              title="No competitors tracked"
              description="Add a competitor to start monitoring"
            />
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {competitors.map(c => (
              <div key={c.id} onClick={() => setSelectedCompetitor(selectedCompetitor?.id === c.id ? null : c)}
                className={`card p-4 cursor-pointer hover:border-gold/15 transition-all ${selectedCompetitor?.id === c.id ? "border-gold/20" : ""}`}>
                <div className="flex items-center gap-2.5 mb-3">
                  <div className="w-10 h-10 rounded-xl bg-red-500/10 flex items-center justify-center">
                    <Target size={18} className="text-red-400" />
                  </div>
                  <div>
                    <p className="text-sm font-bold">{c.name}</p>
                    <p className="text-[9px] text-muted">{c.url} &middot; {c.industry}</p>
                  </div>
                </div>

                {/* Social Presence Grid */}
                <div className="grid grid-cols-5 gap-1 mb-3">
                  {Object.entries(c.followers).map(([platform, count]) => (
                    <div key={platform} className="bg-surface-light rounded-lg p-1.5 text-center">
                      <p className="text-[10px] font-bold">{count > 999 ? `${(count / 1000).toFixed(1)}K` : count}</p>
                      <p className="text-[7px] text-muted uppercase">{platform}</p>
                    </div>
                  ))}
                </div>

                <div className="flex items-center justify-between text-[9px] text-muted">
                  <span>{c.postingFreq} posts/week</span>
                  <span>{c.engagement}% engagement</span>
                  <span>{c.priceRange}</span>
                </div>
                <p className="text-[8px] text-muted/50 mt-2">Last analyzed: {c.lastAnalyzed}</p>
              </div>
            ))}
          </div>

          {/* Selected Competitor Detail */}
          {selectedCompetitor && (
            <div className="card border-gold/10">
              <h3 className="text-sm font-bold mb-3">{selectedCompetitor.name} — Detailed Profile</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-[9px] text-muted uppercase font-semibold mb-1.5">Strengths</p>
                  {selectedCompetitor.strengths.map((s, i) => (
                    <div key={i} className="flex items-center gap-1.5 text-[10px] text-emerald-400 mb-1">
                      <CheckCircle size={10} /> {s}
                    </div>
                  ))}
                </div>
                <div>
                  <p className="text-[9px] text-muted uppercase font-semibold mb-1.5">Weaknesses</p>
                  {selectedCompetitor.weaknesses.map((w, i) => (
                    <div key={i} className="flex items-center gap-1.5 text-[10px] text-red-400 mb-1">
                      <AlertTriangle size={10} /> {w}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ═══ COMPARISON TAB ═══ */}
      {tab === "Comparison" && (
        <div className="space-y-4">
          <div className="card">
            <h2 className="text-sm font-bold flex items-center gap-2 mb-3"><BarChart3 size={14} className="text-gold" /> Engagement Comparison</h2>
            <div className="space-y-3">
              {competitors.map(c => (
                <div key={c.id} className="flex items-center gap-3">
                  <span className="text-[10px] w-24 shrink-0 font-medium">{c.name}</span>
                  <div className="flex-1 h-3 rounded-full bg-surface-light">
                    <div className="h-3 rounded-full bg-gold transition-all" style={{ width: `${Math.min(c.engagement * 15, 100)}%` }} />
                  </div>
                  <span className="text-[10px] font-mono w-10 text-right">{c.engagement}%</span>
                </div>
              ))}
              <div className="flex items-center gap-3 border-t border-border pt-2">
                <span className="text-[10px] w-24 shrink-0 font-bold text-gold">You</span>
                <div className="flex-1 h-3 rounded-full bg-surface-light">
                  <div className="h-3 rounded-full bg-emerald-400" style={{ width: "60%" }} />
                </div>
                <span className="text-[10px] font-mono w-10 text-right text-emerald-400">4.0%</span>
              </div>
            </div>
          </div>

          <div className="card">
            <h3 className="text-xs font-bold mb-3">Posting Frequency (posts/week)</h3>
            <div className="flex items-end gap-3 h-32">
              {[...competitors, { id: "you", name: "You", postingFreq: 7 } as CompetitorProfile].map((c) => (
                <div key={c.id} className="flex-1 flex flex-col items-center gap-1">
                  <div className={`w-full rounded-t transition-all ${c.id === "you" ? "bg-emerald-400/60" : "bg-gold/40"}`}
                    style={{ height: `${(c.postingFreq / 14) * 100}%` }} />
                  <span className="text-[8px] text-muted text-center">{c.name}</span>
                  <span className="text-[9px] font-mono font-bold">{c.postingFreq}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="card">
            <h3 className="text-xs font-bold mb-3">Price Comparison</h3>
            <div className="space-y-2">
              {competitors.map(c => (
                <div key={c.id} className="flex items-center justify-between p-2.5 rounded-lg bg-surface-light border border-border">
                  <span className="text-xs font-medium">{c.name}</span>
                  <span className="text-xs font-mono text-gold">{c.priceRange}</span>
                </div>
              ))}
              <div className="flex items-center justify-between p-2.5 rounded-lg bg-emerald-500/5 border border-emerald-500/10">
                <span className="text-xs font-bold text-emerald-400">You (ShortStack)</span>
                <span className="text-xs font-mono text-emerald-400">$297-$997/mo</span>
              </div>
            </div>
          </div>

          <div className="card">
            <h3 className="text-xs font-bold mb-3">Feature Gap Analysis</h3>
            <div className="space-y-1.5">
              {[
                { feature: "AI Content Generation", you: true, c1: false, c2: true, c3: false },
                { feature: "Cold Outreach Automation", you: true, c1: true, c2: false, c3: false },
                { feature: "AI Voice Calling", you: true, c1: false, c2: false, c3: false },
                { feature: "White-Label Portal", you: true, c1: true, c2: true, c3: false },
                { feature: "Video Production", you: true, c1: false, c2: false, c3: true },
                { feature: "Competitor Intelligence", you: true, c1: false, c2: true, c3: false },
              ].map((f, i) => (
                <div key={i} className="grid grid-cols-5 gap-2 text-[10px] py-1.5 border-b border-border last:border-0">
                  <span className="col-span-1 font-medium">{f.feature}</span>
                  <span className={`text-center ${f.you ? "text-emerald-400" : "text-red-400"}`}>{f.you ? "Yes" : "No"}</span>
                  <span className={`text-center ${f.c1 ? "text-emerald-400" : "text-red-400"}`}>{f.c1 ? "Yes" : "No"}</span>
                  <span className={`text-center ${f.c2 ? "text-emerald-400" : "text-red-400"}`}>{f.c2 ? "Yes" : "No"}</span>
                  <span className={`text-center ${f.c3 ? "text-emerald-400" : "text-red-400"}`}>{f.c3 ? "Yes" : "No"}</span>
                </div>
              ))}
              <div className="grid grid-cols-5 gap-2 text-[8px] text-muted uppercase py-1">
                <span>Feature</span>
                <span className="text-center">You</span>
                {competitors.slice(0, 3).map(c => <span key={c.id} className="text-center">{c.name}</span>)}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ═══ SWOT TAB ═══ */}
      {tab === "SWOT" && (
        <div className="grid grid-cols-2 gap-3">
          <div className="card border-emerald-500/10">
            <h3 className="text-xs font-bold text-emerald-400 mb-2 flex items-center gap-1.5"><Shield size={12} /> Strengths</h3>
            <ul className="space-y-1">
              {["AI-powered automation stack", "All-in-one platform", "Lower pricing than competitors", "Custom agent spawning", "Voice AI integration"].map((s, i) => (
                <li key={i} className="text-[10px] flex items-start gap-1.5"><CheckCircle size={10} className="text-emerald-400 mt-0.5 shrink-0" /> {s}</li>
              ))}
            </ul>
          </div>
          <div className="card border-red-500/10">
            <h3 className="text-xs font-bold text-red-400 mb-2 flex items-center gap-1.5"><AlertTriangle size={12} /> Weaknesses</h3>
            <ul className="space-y-1">
              {["Newer brand, less recognition", "Smaller team", "Heavy AI dependency", "Limited enterprise features", "Complex onboarding"].map((w, i) => (
                <li key={i} className="text-[10px] flex items-start gap-1.5"><AlertTriangle size={10} className="text-red-400 mt-0.5 shrink-0" /> {w}</li>
              ))}
            </ul>
          </div>
          <div className="card border-blue-500/10">
            <h3 className="text-xs font-bold text-blue-400 mb-2 flex items-center gap-1.5"><TrendingUp size={12} /> Opportunities</h3>
            <ul className="space-y-1">
              {["AI market growing 40% YoY", "Competitors lack voice AI", "White-label demand rising", "Vertical expansion (legal, medical)", "API marketplace revenue"].map((o, i) => (
                <li key={i} className="text-[10px] flex items-start gap-1.5"><Zap size={10} className="text-blue-400 mt-0.5 shrink-0" /> {o}</li>
              ))}
            </ul>
          </div>
          <div className="card border-amber-500/10">
            <h3 className="text-xs font-bold text-amber-400 mb-2 flex items-center gap-1.5"><Eye size={12} /> Threats</h3>
            <ul className="space-y-1">
              {["Big tech entering AI agency space", "API cost increases", "Client churn in recession", "Regulatory changes for AI", "Competitor feature parity"].map((t, i) => (
                <li key={i} className="text-[10px] flex items-start gap-1.5"><AlertTriangle size={10} className="text-amber-400 mt-0.5 shrink-0" /> {t}</li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {/* ═══ ALERTS TAB ═══ */}
      {tab === "Alerts" && (
        <div className="space-y-3">
          <h2 className="text-sm font-bold flex items-center gap-2">
            <Activity size={14} className="text-gold" /> Competitor Change Alerts
          </h2>
          {MOCK_ALERTS.length === 0 && (
            <EmptyState
              icon={<Activity size={24} />}
              title="No competitor alerts"
              description="Alerts will appear here when competitors make changes"
            />
          )}
          {MOCK_ALERTS.map(a => (
            <div key={a.id} className="card p-3 flex items-start gap-3">
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                a.type === "pricing" ? "bg-amber-500/10" : a.type === "feature" ? "bg-blue-500/10" : a.type === "ads" ? "bg-red-500/10" : "bg-purple-500/10"
              }`}>
                {a.type === "pricing" ? <TrendingUp size={14} className="text-amber-400" /> :
                 a.type === "feature" ? <Zap size={14} className="text-blue-400" /> :
                 a.type === "ads" ? <Megaphone size={14} className="text-red-400" /> :
                 <Star size={14} className="text-purple-400" />}
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="text-xs font-semibold">{a.competitor}</span>
                  <span className="text-[8px] px-1.5 py-0.5 rounded bg-gold/10 text-gold capitalize">{a.type}</span>
                  <span className="text-[9px] text-muted ml-auto">{a.time}</span>
                </div>
                <p className="text-[10px] text-muted">{a.event}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ═══ ANALYSIS TAB ═══ */}
      {tab === "Analysis" && (
        <div className="space-y-4">
          <div className="card">
            <label className="text-[10px] text-muted uppercase tracking-wider mb-2 block">Competitor URL or Name</label>
            <div className="flex gap-2">
              <div className="flex-1 relative">
                <Globe size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
                <input type="text" value={competitorInput} onChange={e => setCompetitorInput(e.target.value)}
                  placeholder="e.g. competitor.com" className="w-full pl-9 pr-3 py-2.5 rounded-lg bg-surface-light border border-border text-xs outline-none focus:border-gold/30" />
              </div>
              <button onClick={() => runAnalysis("Full comprehensive analysis", "Full")} disabled={loading || !competitorInput}
                className="btn-primary flex items-center gap-1.5 text-xs disabled:opacity-40">
                {loading ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />} Analyze
              </button>
            </div>
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {quickAnalyses.map(qa => (
              <button key={qa.label} onClick={() => runAnalysis(qa.prompt, qa.label)} disabled={loading || !competitorInput}
                className="card p-3 text-left hover:border-gold/15 disabled:opacity-40">
                <div className="p-2 rounded-lg bg-gold/10 inline-flex mb-2">
                  <qa.icon size={16} className="text-gold" />
                </div>
                <p className="text-xs font-semibold">{qa.label}</p>
              </button>
            ))}
          </div>
          {(analysisResult || loading) && (
            <div className="card">
              {loading ? (
                <div className="flex items-center justify-center py-12 gap-3">
                  <Loader2 size={20} className="animate-spin text-gold" />
                  <p className="text-xs text-muted">Analyzing {competitorInput}...</p>
                </div>
              ) : (
                <pre className="whitespace-pre-wrap text-xs text-foreground leading-relaxed font-sans">{analysisResult}</pre>
              )}
            </div>
          )}
        </div>
      )}

      {/* ═══ WEEKLY REPORT TAB ═══ */}
      {tab === "Weekly Report" && (
        <div className="card">
          <h2 className="text-sm font-bold flex items-center gap-2 mb-3">
            <Calendar size={14} className="text-gold" /> Weekly Competitive Report
          </h2>
          <p className="text-[10px] text-muted mb-3">Auto-generated summary for the week of Apr 7-14, 2026</p>
          <div className="space-y-3">
            <div className="p-3 rounded-lg bg-surface-light border border-border">
              <p className="text-xs font-semibold mb-1">Key Changes This Week</p>
              <ul className="space-y-1 text-[10px] text-muted">
                <li>- AgencyX launched new AI-powered feature, positioning closer to our offering</li>
                <li>- GrowthLab raised prices by $200/mo across all tiers</li>
                <li>- ViralNest had a viral TikTok hit (124K views) driving significant brand awareness</li>
                <li>- No new competitors entered the market this week</li>
              </ul>
            </div>
            <div className="p-3 rounded-lg bg-surface-light border border-border">
              <p className="text-xs font-semibold mb-1">Recommended Actions</p>
              <ul className="space-y-1 text-[10px] text-muted">
                <li>1. Create comparison content highlighting our AI advantage over AgencyX</li>
                <li>2. Position pricing against GrowthLab increase to attract their clients</li>
                <li>3. Study ViralNest TikTok strategy and replicate successful hooks</li>
                <li>4. Run targeted ads to competitors&apos; audiences on Meta</li>
              </ul>
            </div>
            <div className="p-3 rounded-lg bg-emerald-500/5 border border-emerald-500/10">
              <p className="text-xs font-semibold text-emerald-400 mb-1">Your Competitive Advantage</p>
              <p className="text-[10px] text-muted">You lead in 4/6 key features, have the lowest pricing, and are the only platform with AI voice calling. Focus on promoting these differentiators.</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
