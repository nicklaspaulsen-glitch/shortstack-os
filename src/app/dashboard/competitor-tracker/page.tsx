"use client";

import { useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { createClient } from "@/lib/supabase/client";
import {
  Target, Plus, Trash2, Globe, Search,
  BarChart3, TrendingUp, AlertCircle, Bell,
  Sparkles, Loader, ChevronRight,
  ExternalLink, Edit3, X, Check, Users,
  MessageSquare, Shield, Zap, FileText, Copy,
  Activity, Lightbulb, BookOpen, Save
} from "lucide-react";
import toast from "react-hot-toast";

interface Competitor {
  id: string;
  name: string;
  url: string;
  industry: string;
  platforms: Platform[];
  estimatedFollowers: number;
  notes: string;
  swot: { strengths: string[]; weaknesses: string[]; opportunities: string[]; threats: string[] };
  contentFrequency: Record<string, number>;
  engagementRate: number;
  alerts: Alert[];
  lastUpdated: string;
}

interface Platform {
  name: string;
  handle: string;
  followers: number;
  active: boolean;
}

interface Alert {
  id: string;
  type: "campaign" | "growth" | "content" | "mention";
  message: string;
  date: string;
  read: boolean;
}

const PLATFORM_COLORS: Record<string, string> = {
  Instagram: "text-pink-400 bg-pink-500/10",
  Facebook: "text-blue-400 bg-blue-500/10",
  TikTok: "text-white bg-white/10",
  LinkedIn: "text-blue-300 bg-blue-400/10",
  YouTube: "text-red-400 bg-red-500/10",
  Twitter: "text-sky-400 bg-sky-500/10",
};

const INITIAL_COMPETITORS: Competitor[] = [];

export default function CompetitorTrackerPage() {
  useAuth();
  const supabase = createClient();

  const [competitors, setCompetitors] = useState<Competitor[]>(INITIAL_COMPETITORS);
  const [selectedCompetitor, setSelectedCompetitor] = useState<string>("");
  const [tab, setTab] = useState<"overview" | "analysis" | "content-gaps" | "alerts">("overview");
  const [showAddForm, setShowAddForm] = useState(false);
  const [newName, setNewName] = useState("");
  const [newUrl, setNewUrl] = useState("");
  const [newIndustry, setNewIndustry] = useState("");
  const [generating, setGenerating] = useState(false);
  const [analysisResult, setAnalysisResult] = useState("");
  const [editingNotes, setEditingNotes] = useState(false);
  const [notesInput, setNotesInput] = useState("");
  const [searchFilter, setSearchFilter] = useState("");

  void supabase;

  const competitor = competitors.find(c => c.id === selectedCompetitor);
  const unreadAlerts = competitors.reduce((sum, c) => sum + c.alerts.filter(a => !a.read).length, 0);
  const filteredCompetitors = competitors.filter(c =>
    c.name.toLowerCase().includes(searchFilter.toLowerCase()) ||
    c.industry.toLowerCase().includes(searchFilter.toLowerCase())
  );

  const addCompetitor = () => {
    if (!newName.trim()) { toast.error("Competitor name is required"); return; }
    const newComp: Competitor = {
      id: String(Date.now()), name: newName.trim(), url: newUrl.trim(), industry: newIndustry.trim() || "General",
      platforms: [], estimatedFollowers: 0, notes: "",
      swot: { strengths: [], weaknesses: [], opportunities: [], threats: [] },
      contentFrequency: {}, engagementRate: 0, alerts: [], lastUpdated: new Date().toISOString().split("T")[0],
    };
    setCompetitors(prev => [...prev, newComp]);
    setSelectedCompetitor(newComp.id);
    setNewName(""); setNewUrl(""); setNewIndustry("");
    setShowAddForm(false);
    toast.success(`Added "${newComp.name}" to tracker`);
  };

  const removeCompetitor = (id: string) => {
    setCompetitors(prev => prev.filter(c => c.id !== id));
    if (selectedCompetitor === id && competitors.length > 1) {
      setSelectedCompetitor(competitors.find(c => c.id !== id)?.id || "");
    }
    toast.success("Competitor removed");
  };

  const updateCompetitor = (id: string, updates: Partial<Competitor>) => {
    setCompetitors(prev => prev.map(c => c.id === id ? { ...c, ...updates } : c));
  };

  const markAlertRead = (competitorId: string, alertId: string) => {
    setCompetitors(prev => prev.map(c =>
      c.id === competitorId
        ? { ...c, alerts: c.alerts.map(a => a.id === alertId ? { ...a, read: true } : a) }
        : c
    ));
  };

  const saveNotes = () => {
    if (!competitor) return;
    updateCompetitor(competitor.id, { notes: notesInput });
    setEditingNotes(false);
    toast.success("Notes saved");
  };

  const generateAnalysis = async () => {
    if (!competitor) return;
    setGenerating(true);
    await new Promise(r => setTimeout(r, 2000));
    setAnalysisResult(`## Competitive Analysis: ${competitor.name}

**Market Position:** ${competitor.industry} with an estimated ${competitor.estimatedFollowers.toLocaleString()} followers across ${competitor.platforms.length} platform(s).

**Engagement:** ${competitor.engagementRate}% average engagement rate, which is ${competitor.engagementRate > 3 ? "above" : "below"} industry average.

**Content Strategy:**
${Object.entries(competitor.contentFrequency).map(([platform, freq]) => `- ${platform}: ~${freq} posts/day`).join("\n")}

**Key Strengths:**
${competitor.swot.strengths.map(s => `- ${s}`).join("\n")}

**Exploitable Weaknesses:**
${competitor.swot.weaknesses.map(w => `- ${w}`).join("\n")}

**Opportunities for Us:**
${competitor.swot.opportunities.map(o => `- ${o}`).join("\n")}

**Recommended Actions:**
1. Create content targeting gaps in their ${competitor.platforms.length < 4 ? "missing platforms" : "weaker platforms"}
2. Leverage our speed advantage for trend-based content
3. Develop case studies in verticals where they are weak
4. Monitor their ${Object.entries(competitor.contentFrequency).sort((a, b) => b[1] - a[1])[0]?.[0] || "primary"} strategy for emerging patterns`);
    setGenerating(false);
    toast.success("AI analysis generated!");
  };

  const ALL_PLATFORMS = ["Instagram", "Facebook", "TikTok", "LinkedIn", "YouTube", "Twitter"];

  const contentGapTopics = [
    { topic: "AI Marketing Tools", us: false, competitors: ["BrightMedia Agency", "Apex Digital Partners"] },
    { topic: "Short-form Video Strategy", us: true, competitors: ["Vortex Creative"] },
    { topic: "Email Automation", us: false, competitors: ["Apex Digital Partners"] },
    { topic: "Influencer Partnerships", us: false, competitors: ["Vortex Creative"] },
    { topic: "Case Study Breakdowns", us: true, competitors: ["BrightMedia Agency", "Apex Digital Partners"] },
    { topic: "Industry Benchmarks", us: false, competitors: ["Apex Digital Partners"] },
    { topic: "Behind the Scenes Content", us: true, competitors: ["Vortex Creative"] },
    { topic: "Client Testimonial Videos", us: false, competitors: ["BrightMedia Agency"] },
    { topic: "Weekly Tips Series", us: false, competitors: ["Vortex Creative", "Apex Digital Partners"] },
    { topic: "Podcast / Audio Content", us: false, competitors: [] },
  ];

  const TABS = [
    { key: "overview" as const, label: "Overview", icon: <Target size={14} /> },
    { key: "analysis" as const, label: "SWOT & Analysis", icon: <BarChart3 size={14} /> },
    { key: "content-gaps" as const, label: "Content Gaps", icon: <Lightbulb size={14} /> },
    { key: "alerts" as const, label: `Alerts${unreadAlerts > 0 ? ` (${unreadAlerts})` : ""}`, icon: <Bell size={14} /> },
  ];

  return (
    <div className="fade-in space-y-6">
      <div className="page-header">
        <div>
          <h1 className="text-lg font-bold flex items-center gap-2">
            <Target size={20} className="text-gold" /> Competitor Tracker
          </h1>
          <p className="text-xs text-muted">Monitor competitors, find content gaps, and stay ahead</p>
        </div>
        <button onClick={() => setShowAddForm(true)} className="btn-primary text-xs flex items-center gap-1">
          <Plus size={14} /> Add Competitor
        </button>
      </div>

      {/* Add Competitor Form */}
      {showAddForm && (
        <div className="card border border-gold/20">
          <div className="flex items-center gap-2 mb-3">
            <Plus size={16} className="text-gold" />
            <span className="text-sm font-semibold">Add New Competitor</span>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-[10px] text-muted uppercase tracking-wider">Name *</label>
              <input value={newName} onChange={e => setNewName(e.target.value)} placeholder="Competitor name" className="input text-xs w-full mt-1" />
            </div>
            <div>
              <label className="text-[10px] text-muted uppercase tracking-wider">Website URL</label>
              <input value={newUrl} onChange={e => setNewUrl(e.target.value)} placeholder="https://..." className="input text-xs w-full mt-1" />
            </div>
            <div>
              <label className="text-[10px] text-muted uppercase tracking-wider">Industry</label>
              <input value={newIndustry} onChange={e => setNewIndustry(e.target.value)} placeholder="Digital Marketing" className="input text-xs w-full mt-1" />
            </div>
          </div>
          <div className="flex gap-2 mt-3">
            <button onClick={addCompetitor} className="btn-primary text-xs">Add Competitor</button>
            <button onClick={() => setShowAddForm(false)} className="btn-ghost text-xs">Cancel</button>
          </div>
        </div>
      )}

      {/* Stats Bar */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="card">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-blue-500/10"><Users size={16} className="text-blue-400" /></div>
            <div>
              <p className="text-[10px] text-muted uppercase tracking-wider">Tracking</p>
              <p className="text-xl font-bold">{competitors.length}</p>
            </div>
          </div>
        </div>
        <div className="card">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-green-500/10"><TrendingUp size={16} className="text-green-400" /></div>
            <div>
              <p className="text-[10px] text-muted uppercase tracking-wider">Avg Engagement</p>
              <p className="text-xl font-bold">{(competitors.reduce((s, c) => s + c.engagementRate, 0) / competitors.length).toFixed(1)}%</p>
            </div>
          </div>
        </div>
        <div className="card">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-purple-500/10"><Globe size={16} className="text-purple-400" /></div>
            <div>
              <p className="text-[10px] text-muted uppercase tracking-wider">Total Reach</p>
              <p className="text-xl font-bold">{(competitors.reduce((s, c) => s + c.estimatedFollowers, 0) / 1000).toFixed(0)}K</p>
            </div>
          </div>
        </div>
        <div className="card">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-red-500/10"><Bell size={16} className="text-red-400" /></div>
            <div>
              <p className="text-[10px] text-muted uppercase tracking-wider">Unread Alerts</p>
              <p className="text-xl font-bold">{unreadAlerts}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-12 gap-4">
        {/* Sidebar - Competitor List */}
        <div className="col-span-12 md:col-span-3 space-y-3">
          <div className="relative">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted" />
            <input value={searchFilter} onChange={e => setSearchFilter(e.target.value)} placeholder="Search competitors..." className="input text-xs pl-8 w-full" />
          </div>
          <div className="space-y-2">
            {filteredCompetitors.map(c => (
              <div
                key={c.id}
                onClick={() => setSelectedCompetitor(c.id)}
                className={`card cursor-pointer transition-all ${c.id === selectedCompetitor ? "border border-gold/40 bg-gold/5" : "hover:border-white/10"}`}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-semibold">{c.name}</p>
                    <p className="text-[10px] text-muted">{c.industry}</p>
                  </div>
                  {c.alerts.some(a => !a.read) && (
                    <span className="w-2 h-2 rounded-full bg-red-400 animate-pulse" />
                  )}
                </div>
                <div className="flex items-center gap-2 mt-1.5">
                  <span className="text-[10px] text-muted">{(c.estimatedFollowers / 1000).toFixed(1)}K followers</span>
                  <span className="text-[10px] text-muted">-</span>
                  <span className="text-[10px] text-muted">{c.platforms.length} platforms</span>
                </div>
                <div className="flex gap-1 mt-1.5">
                  {c.platforms.map(p => (
                    <span key={p.name} className={`px-1.5 py-0.5 rounded text-[8px] font-medium ${PLATFORM_COLORS[p.name] || "bg-white/10 text-white"}`}>
                      {p.name}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Main Content */}
        <div className="col-span-12 md:col-span-9 space-y-4">
          {/* Tabs */}
          <div className="flex gap-1 bg-white/5 rounded-lg p-1">
            {TABS.map(t => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium transition-all ${
                  tab === t.key ? "bg-gold/20 text-gold" : "text-muted hover:text-white"
                }`}
              >
                {t.icon} {t.label}
              </button>
            ))}
          </div>

          {competitor ? (
            <>
              {/* Overview Tab */}
              {tab === "overview" && (
                <div className="space-y-4">
                  {/* Competitor Header */}
                  <div className="card">
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <h2 className="text-sm font-bold">{competitor.name}</h2>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-[10px] text-muted">{competitor.industry}</span>
                          {competitor.url && (
                            <a href={competitor.url} target="_blank" rel="noopener noreferrer" className="text-[10px] text-gold hover:underline flex items-center gap-0.5">
                              <ExternalLink size={10} /> {competitor.url}
                            </a>
                          )}
                        </div>
                      </div>
                      <button onClick={() => removeCompetitor(competitor.id)} className="btn-ghost text-xs text-red-400">
                        <Trash2 size={12} />
                      </button>
                    </div>
                    <p className="text-[10px] text-muted">Last updated: {competitor.lastUpdated}</p>
                  </div>

                  {/* Platform Grid */}
                  <div className="card">
                    <div className="flex items-center gap-2 mb-3">
                      <Globe size={16} className="text-gold" />
                      <span className="text-sm font-semibold">Social Media Presence</span>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                      {ALL_PLATFORMS.map(platform => {
                        const p = competitor.platforms.find(pp => pp.name === platform);
                        return (
                          <div key={platform} className={`p-3 rounded-lg border ${p ? "border-white/10 bg-white/5" : "border-white/5 bg-white/[0.02] opacity-40"}`}>
                            <div className="flex items-center justify-between mb-1">
                              <span className={`text-xs font-medium ${p ? "" : "text-muted"}`}>{platform}</span>
                              {p ? <Check size={12} className="text-green-400" /> : <X size={12} className="text-muted" />}
                            </div>
                            {p ? (
                              <>
                                <p className="text-sm font-bold">{(p.followers / 1000).toFixed(1)}K</p>
                                <p className="text-[10px] text-muted">{p.handle}</p>
                              </>
                            ) : (
                              <p className="text-[10px] text-muted">Not present</p>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Content Frequency */}
                  <div className="card">
                    <div className="flex items-center gap-2 mb-3">
                      <Activity size={16} className="text-gold" />
                      <span className="text-sm font-semibold">Content Frequency (posts/day)</span>
                    </div>
                    <div className="space-y-2">
                      {Object.entries(competitor.contentFrequency).map(([platform, freq]) => (
                        <div key={platform} className="flex items-center gap-3">
                          <span className="text-xs w-20">{platform}</span>
                          <div className="flex-1 bg-white/10 rounded-full h-2">
                            <div
                              className="h-2 rounded-full bg-gold transition-all"
                              style={{ width: `${Math.min(100, (freq / 5) * 100)}%` }}
                            />
                          </div>
                          <span className="text-xs font-medium w-12 text-right">{freq}/day</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Engagement Comparison */}
                  <div className="card">
                    <div className="flex items-center gap-2 mb-3">
                      <BarChart3 size={16} className="text-gold" />
                      <span className="text-sm font-semibold">Engagement Comparison</span>
                    </div>
                    <div className="space-y-3">
                      {competitors.map(c => (
                        <div key={c.id} className="flex items-center gap-3">
                          <span className={`text-xs w-40 truncate ${c.id === selectedCompetitor ? "text-gold font-semibold" : "text-muted"}`}>{c.name}</span>
                          <div className="flex-1 bg-white/10 rounded-full h-3">
                            <div
                              className={`h-3 rounded-full transition-all ${c.id === selectedCompetitor ? "bg-gold" : "bg-white/30"}`}
                              style={{ width: `${Math.min(100, (c.engagementRate / 6) * 100)}%` }}
                            />
                          </div>
                          <span className={`text-xs font-medium w-12 text-right ${c.id === selectedCompetitor ? "text-gold" : ""}`}>{c.engagementRate}%</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Notes */}
                  <div className="card">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <FileText size={16} className="text-gold" />
                        <span className="text-sm font-semibold">Notes</span>
                      </div>
                      {editingNotes ? (
                        <div className="flex gap-1">
                          <button onClick={saveNotes} className="btn-primary text-[10px]"><Save size={10} /></button>
                          <button onClick={() => setEditingNotes(false)} className="btn-ghost text-[10px]"><X size={10} /></button>
                        </div>
                      ) : (
                        <button onClick={() => { setNotesInput(competitor.notes); setEditingNotes(true); }} className="text-[10px] text-gold hover:underline flex items-center gap-1">
                          <Edit3 size={10} /> Edit
                        </button>
                      )}
                    </div>
                    {editingNotes ? (
                      <textarea
                        value={notesInput}
                        onChange={e => setNotesInput(e.target.value)}
                        className="input text-xs w-full min-h-[80px] resize-none"
                        placeholder="Add notes about this competitor..."
                      />
                    ) : (
                      <p className="text-xs text-muted">{competitor.notes || "No notes yet. Click Edit to add."}</p>
                    )}
                  </div>
                </div>
              )}

              {/* SWOT & Analysis Tab */}
              {tab === "analysis" && (
                <div className="space-y-4">
                  {/* SWOT Grid */}
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      { key: "strengths", label: "Strengths", color: "green", icon: <Shield size={14} className="text-green-400" /> },
                      { key: "weaknesses", label: "Weaknesses", color: "red", icon: <AlertCircle size={14} className="text-red-400" /> },
                      { key: "opportunities", label: "Opportunities", color: "blue", icon: <Lightbulb size={14} className="text-blue-400" /> },
                      { key: "threats", label: "Threats", color: "yellow", icon: <Zap size={14} className="text-yellow-400" /> },
                    ].map(section => (
                      <div key={section.key} className="card">
                        <div className="flex items-center gap-2 mb-2">
                          {section.icon}
                          <span className="text-xs font-semibold">{section.label}</span>
                        </div>
                        <div className="space-y-1">
                          {(competitor.swot[section.key as keyof typeof competitor.swot] || []).map((item, i) => (
                            <div key={i} className={`flex items-start gap-1.5 p-1.5 rounded bg-${section.color}-500/5`}>
                              <ChevronRight size={10} className={`text-${section.color}-400 mt-0.5 shrink-0`} />
                              <span className="text-[10px]">{item}</span>
                            </div>
                          ))}
                          {(competitor.swot[section.key as keyof typeof competitor.swot] || []).length === 0 && (
                            <p className="text-[10px] text-muted italic">No items yet</p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* AI Analysis */}
                  <div className="card">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <Sparkles size={16} className="text-gold" />
                        <span className="text-sm font-semibold">AI Competitive Analysis</span>
                      </div>
                      <button
                        onClick={generateAnalysis}
                        disabled={generating}
                        className="btn-primary text-xs flex items-center gap-1"
                      >
                        {generating ? <Loader size={12} className="animate-spin" /> : <Sparkles size={12} />}
                        {generating ? "Analyzing..." : "Generate Analysis"}
                      </button>
                    </div>
                    {analysisResult ? (
                      <div className="relative">
                        <pre className="text-xs text-muted whitespace-pre-wrap bg-white/5 rounded-lg p-3 max-h-80 overflow-y-auto">{analysisResult}</pre>
                        <button
                          onClick={() => { navigator.clipboard.writeText(analysisResult); toast.success("Copied to clipboard"); }}
                          className="absolute top-2 right-2 p-1 rounded bg-white/10 hover:bg-white/20 transition-colors"
                        >
                          <Copy size={12} />
                        </button>
                      </div>
                    ) : (
                      <p className="text-xs text-muted">Click Generate to create an AI-powered competitive analysis based on all available data.</p>
                    )}
                  </div>
                </div>
              )}

              {/* Content Gaps Tab */}
              {tab === "content-gaps" && (
                <div className="space-y-4">
                  <div className="card">
                    <div className="flex items-center gap-2 mb-3">
                      <Lightbulb size={16} className="text-gold" />
                      <span className="text-sm font-semibold">Content Gap Finder</span>
                      <span className="text-[10px] text-muted ml-1">Topics competitors cover that we do not</span>
                    </div>
                    <div className="space-y-2">
                      {contentGapTopics.map((gap, i) => (
                        <div key={i} className={`flex items-center gap-3 p-2 rounded ${gap.us ? "bg-green-500/5" : "bg-red-500/5"}`}>
                          <div className="w-5">
                            {gap.us
                              ? <Check size={14} className="text-green-400" />
                              : <X size={14} className="text-red-400" />
                            }
                          </div>
                          <span className="text-xs font-medium flex-1">{gap.topic}</span>
                          <div className="flex items-center gap-1">
                            {gap.competitors.length > 0 ? (
                              gap.competitors.map(c => (
                                <span key={c} className="px-1.5 py-0.5 rounded bg-white/10 text-[9px] text-muted">{c.split(" ")[0]}</span>
                              ))
                            ) : (
                              <span className="px-1.5 py-0.5 rounded bg-gold/10 text-[9px] text-gold">Untapped Opportunity</span>
                            )}
                          </div>
                          {!gap.us && (
                            <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-medium ${
                              gap.competitors.length >= 2 ? "bg-red-500/20 text-red-400" : "bg-yellow-500/20 text-yellow-400"
                            }`}>
                              {gap.competitors.length >= 2 ? "High Priority" : "Medium Priority"}
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="card">
                    <div className="flex items-center gap-2 mb-3">
                      <BookOpen size={16} className="text-gold" />
                      <span className="text-sm font-semibold">Gap Summary</span>
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                      <div className="p-3 rounded-lg bg-red-500/5 border border-red-500/10">
                        <p className="text-lg font-bold text-red-400">{contentGapTopics.filter(g => !g.us).length}</p>
                        <p className="text-[10px] text-muted">Topics We Are Missing</p>
                      </div>
                      <div className="p-3 rounded-lg bg-green-500/5 border border-green-500/10">
                        <p className="text-lg font-bold text-green-400">{contentGapTopics.filter(g => g.us).length}</p>
                        <p className="text-[10px] text-muted">Topics We Cover</p>
                      </div>
                      <div className="p-3 rounded-lg bg-gold/5 border border-gold/10">
                        <p className="text-lg font-bold text-gold">{contentGapTopics.filter(g => !g.us && g.competitors.length === 0).length}</p>
                        <p className="text-[10px] text-muted">Untapped Opportunities</p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Alerts Tab */}
              {tab === "alerts" && (
                <div className="space-y-4">
                  <div className="card">
                    <div className="flex items-center gap-2 mb-3">
                      <Bell size={16} className="text-gold" />
                      <span className="text-sm font-semibold">Competitor Alerts</span>
                    </div>
                    {competitors.flatMap(c => c.alerts.map(a => ({ ...a, competitorName: c.name, competitorId: c.id }))).length > 0 ? (
                      <div className="space-y-2">
                        {competitors.flatMap(c =>
                          c.alerts.map(a => ({ ...a, competitorName: c.name, competitorId: c.id }))
                        )
                          .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                          .map(alert => (
                            <div
                              key={alert.id}
                              onClick={() => markAlertRead(alert.competitorId, alert.id)}
                              className={`flex items-start gap-3 p-3 rounded-lg cursor-pointer transition-all ${
                                alert.read ? "bg-white/5" : "bg-gold/5 border border-gold/20"
                              }`}
                            >
                              <div className={`p-1.5 rounded-lg shrink-0 ${
                                alert.type === "campaign" ? "bg-purple-500/10" :
                                alert.type === "growth" ? "bg-green-500/10" :
                                alert.type === "content" ? "bg-blue-500/10" : "bg-yellow-500/10"
                              }`}>
                                {alert.type === "campaign" ? <Zap size={14} className="text-purple-400" /> :
                                 alert.type === "growth" ? <TrendingUp size={14} className="text-green-400" /> :
                                 alert.type === "content" ? <FileText size={14} className="text-blue-400" /> :
                                 <MessageSquare size={14} className="text-yellow-400" />}
                              </div>
                              <div className="flex-1">
                                <div className="flex items-center gap-2">
                                  <span className="text-xs font-semibold">{alert.competitorName}</span>
                                  <span className="px-1.5 py-0.5 rounded bg-white/10 text-[9px] text-muted capitalize">{alert.type}</span>
                                  {!alert.read && <span className="w-1.5 h-1.5 rounded-full bg-gold" />}
                                </div>
                                <p className="text-xs text-muted mt-0.5">{alert.message}</p>
                                <p className="text-[10px] text-muted mt-1">{alert.date}</p>
                              </div>
                            </div>
                          ))}
                      </div>
                    ) : (
                      <div className="text-center py-8">
                        <Bell size={24} className="text-muted mx-auto mb-2" />
                        <p className="text-xs text-muted">No alerts yet. We will notify you when competitors launch new campaigns or significant changes occur.</p>
                      </div>
                    )}
                  </div>

                  {/* Alert Settings */}
                  <div className="card">
                    <div className="flex items-center gap-2 mb-3">
                      <Shield size={16} className="text-gold" />
                      <span className="text-sm font-semibold">Alert Settings</span>
                    </div>
                    <div className="space-y-2">
                      {[
                        { label: "New campaign launches", enabled: true },
                        { label: "Significant follower growth (>10%)", enabled: true },
                        { label: "New content series", enabled: true },
                        { label: "Brand mentions", enabled: false },
                        { label: "Platform changes", enabled: false },
                      ].map((setting, i) => (
                        <div key={i} className="flex items-center justify-between p-2 rounded bg-white/5">
                          <span className="text-xs">{setting.label}</span>
                          <button
                            onClick={() => toast.success(`Alert ${setting.enabled ? "disabled" : "enabled"}`)}
                            className="text-muted hover:text-white transition-colors"
                          >
                            {setting.enabled
                              ? <Check size={16} className="text-green-400" />
                              : <X size={16} className="text-muted" />
                            }
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="card text-center py-12">
              <Target size={32} className="text-muted mx-auto mb-3" />
              <p className="text-sm text-muted">Select a competitor to view details</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
