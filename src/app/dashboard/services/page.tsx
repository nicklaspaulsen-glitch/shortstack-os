"use client";

import { useState } from "react";
import {
  Sparkles, Camera, Film, Megaphone, Search, Phone, Zap,
  Send, Globe, PenTool, CheckCircle, Play,
  BarChart3, Code, Settings, Gauge, Layers,
  TrendingUp, DollarSign, TestTube, Calendar, GitBranch
} from "lucide-react";

/* ── Types ── */
interface ServiceAgent {
  id: string;
  name: string;
  tagline: string;
  description: string;
  icon: React.ReactNode;
  color: string;
  bgClass: string;
  capabilities: string[];
  status: "active" | "idle" | "error";
  usageToday: number;
  avgLatency: number;
  costPerUse: number;
  successRate: number;
  version: string;
  actions: Array<{ label: string; prompt: string }>;
}

interface TestResult {
  input: string;
  output: string;
  latency: number;
  quality: number;
  timestamp: string;
}

interface BatchJob {
  id: string;
  agent: string;
  items: number;
  completed: number;
  status: "running" | "queued" | "done" | "failed";
  startedAt: string;
}

/* ── Mock Data ── */
const AGENTS: ServiceAgent[] = [
  {
    id: "short-form", name: "Short-Form Content", tagline: "Reels, TikToks & Shorts", icon: <Camera size={20} />,
    color: "text-pink-400", bgClass: "border-pink-400/15 bg-pink-500/5", description: "AI agent for scroll-stopping short-form video scripts, hooks, captions, and posting schedules.",
    capabilities: ["Viral hooks", "Captions + hashtags", "30-day calendars", "Repurposing", "A/B hooks", "Platform-specific"],
    status: "active", usageToday: 34, avgLatency: 1200, costPerUse: 0.08, successRate: 98, version: "2.4.0",
    actions: [
      { label: "Generate 10 hooks", prompt: "Generate 10 viral short-form video hooks for a {industry} business." },
      { label: "Write a script", prompt: "Write a 30-second short-form video script for {topic}." },
      { label: "30-day calendar", prompt: "Create a 30-day short-form content calendar for {business}." },
    ],
  },
  {
    id: "long-form", name: "Long-Form Content", tagline: "Full video production", icon: <Film size={20} />,
    color: "text-red-400", bgClass: "border-red-400/15 bg-red-500/5", description: "Full-length video scripting, YouTube SEO, production planning, and repurposing.",
    capabilities: ["Full scripts", "YouTube SEO", "Thumbnails", "Repurpose clips", "Shot lists", "Podcast outlines"],
    status: "active", usageToday: 12, avgLatency: 3400, costPerUse: 0.15, successRate: 96, version: "2.3.0",
    actions: [
      { label: "YouTube script", prompt: "Write a 10-minute YouTube video script about {topic}." },
      { label: "SEO optimize", prompt: "Generate YouTube SEO title, description, and 30 tags for {topic}." },
      { label: "Repurpose plan", prompt: "Create a repurposing plan for the video '{topic}'." },
    ],
  },
  {
    id: "paid-ads", name: "Paid Ads", tagline: "Meta, Google & TikTok ads", icon: <Megaphone size={20} />,
    color: "text-blue-400", bgClass: "border-blue-400/15 bg-blue-500/5", description: "Designs ad campaigns, writes copy, creates targeting strategies, and optimizes for ROAS.",
    capabilities: ["Ad copy", "Audience targeting", "Funnel mapping", "A/B variations", "Budget allocation", "ROAS optimization"],
    status: "idle", usageToday: 8, avgLatency: 2100, costPerUse: 0.12, successRate: 92, version: "2.4.0",
    actions: [
      { label: "Meta ad copy", prompt: "Write 5 Meta ad copy variations for {business} promoting {offer}." },
      { label: "Campaign strategy", prompt: "Design a full-funnel ad campaign for a {industry} business." },
      { label: "Google Ads", prompt: "Write 10 Google Ads headlines for targeting '{keywords}'." },
    ],
  },
  {
    id: "seo", name: "SEO & Content", tagline: "Organic traffic & rankings", icon: <Search size={20} />,
    color: "text-emerald-400", bgClass: "border-emerald-400/15 bg-emerald-500/5", description: "Technical SEO audits, keyword research, blog content, and local SEO optimization.",
    capabilities: ["Keyword research", "Blog articles", "Technical audit", "Local SEO", "GBP optimization", "Gap analysis"],
    status: "active", usageToday: 18, avgLatency: 1800, costPerUse: 0.10, successRate: 94, version: "2.2.0",
    actions: [
      { label: "Keyword research", prompt: "Find 20 keywords for a {industry} business in {location}." },
      { label: "Blog article", prompt: "Write a 1500-word SEO blog about '{topic}'." },
      { label: "Content strategy", prompt: "Create a 3-month SEO content strategy for {business}." },
    ],
  },
  {
    id: "web-design", name: "Web Design", tagline: "Websites & funnels", icon: <Globe size={20} />,
    color: "text-cyan-400", bgClass: "border-cyan-400/15 bg-cyan-500/5", description: "Website layouts, conversion copy, funnel architectures, and landing page content.",
    capabilities: ["Website copy", "Landing pages", "Funnel design", "CRO", "CTA optimization", "Wireframes"],
    status: "idle", usageToday: 5, avgLatency: 2800, costPerUse: 0.14, successRate: 97, version: "2.3.0",
    actions: [
      { label: "Website copy", prompt: "Write all website copy for a {industry} homepage." },
      { label: "Landing page", prompt: "Write a high-converting landing page for {offer}." },
      { label: "Funnel strategy", prompt: "Design a sales funnel for {business} selling {service}." },
    ],
  },
  {
    id: "receptionist", name: "AI Receptionist", tagline: "24/7 call handling", icon: <Phone size={20} />,
    color: "text-amber-400", bgClass: "border-amber-400/15 bg-amber-500/5", description: "Phone/text agent: answers calls, qualifies leads, books appointments 24/7.",
    capabilities: ["24/7 answering", "Lead qualification", "Appointment booking", "FAQ handling", "SMS follow-ups", "Voicemail drops"],
    status: "active", usageToday: 42, avgLatency: 450, costPerUse: 0.03, successRate: 93, version: "2.4.1",
    actions: [
      { label: "Call script", prompt: "Write an AI receptionist call script for a {industry} business." },
      { label: "SMS sequences", prompt: "Create a 5-message SMS follow-up sequence for leads." },
      { label: "FAQ responses", prompt: "Write 15 FAQ responses for a {industry} business." },
    ],
  },
  {
    id: "automation", name: "Automation", tagline: "Workflows & integrations", icon: <Zap size={20} />,
    color: "text-gold", bgClass: "border-gold/15 bg-gold/5", description: "Custom automation workflows connecting CRM, email, social media, and tools.",
    capabilities: ["CRM automation", "Email drips", "Lead scoring", "Task automation", "Cross-platform", "Trigger actions"],
    status: "active", usageToday: 67, avgLatency: 200, costPerUse: 0.02, successRate: 99, version: "2.4.0",
    actions: [
      { label: "Onboarding flow", prompt: "Design a client onboarding automation for {business}." },
      { label: "Lead nurture", prompt: "Create a 14-day lead nurture email sequence." },
      { label: "Review request", prompt: "Design an automated Google Review request workflow." },
    ],
  },
  {
    id: "branding", name: "Branding", tagline: "Identity & style guides", icon: <PenTool size={20} />,
    color: "text-purple-400", bgClass: "border-purple-400/15 bg-purple-500/5", description: "Brand strategy, visual identity, messaging frameworks, and creative direction.",
    capabilities: ["Voice guides", "Messaging", "Brand story", "Positioning", "Color/style", "Taglines"],
    status: "idle", usageToday: 3, avgLatency: 2400, costPerUse: 0.11, successRate: 100, version: "2.1.0",
    actions: [
      { label: "Brand voice", prompt: "Create a brand voice guide for {business} in {industry}." },
      { label: "Taglines", prompt: "Generate 20 tagline options for {business}." },
      { label: "Brand story", prompt: "Write a compelling brand story for {business}." },
    ],
  },
  {
    id: "cold-outreach", name: "Cold Outreach", tagline: "DM lead generation", icon: <Send size={20} />,
    color: "text-green-400", bgClass: "border-green-400/15 bg-green-500/5", description: "Personalized cold DM sequences for Instagram, LinkedIn, and Facebook at scale.",
    capabilities: ["DM scripts", "Follow-up sequences", "Industry templates", "A/B messaging", "Reply handling", "DM qualification"],
    status: "active", usageToday: 89, avgLatency: 520, costPerUse: 0.04, successRate: 91, version: "2.4.0",
    actions: [
      { label: "DM sequence", prompt: "Write a 4-message cold DM sequence for {industry} owners on IG." },
      { label: "LinkedIn outreach", prompt: "Write 5 LinkedIn outreach messages targeting {industry}." },
      { label: "Reply scripts", prompt: "Write response scripts for common cold DM replies." },
    ],
  },
];

const MOCK_TEST_RESULTS: TestResult[] = [
  { input: "Generate 10 hooks for dental business", output: "Generated 10 scroll-stopping hooks with viral potential scores", latency: 1180, quality: 94, timestamp: "2m ago" },
  { input: "Write landing page for free consultation", output: "Complete landing page with hero, benefits, social proof, FAQ, CTA", latency: 3200, quality: 91, timestamp: "15m ago" },
  { input: "Create 5 Meta ad variations", output: "5 ad copy sets with headlines, primary text, and CTAs", latency: 2100, quality: 88, timestamp: "1h ago" },
];

const MOCK_BATCH_JOBS: BatchJob[] = [
  { id: "b1", agent: "Short-Form Content", items: 30, completed: 22, status: "running", startedAt: "10m ago" },
  { id: "b2", agent: "Cold Outreach", items: 50, completed: 50, status: "done", startedAt: "1h ago" },
  { id: "b3", agent: "SEO & Content", items: 12, completed: 0, status: "queued", startedAt: "Queued" },
  { id: "b4", agent: "Paid Ads", items: 20, completed: 8, status: "running", startedAt: "25m ago" },
];

const MOCK_SCHEDULES = [
  { agent: "Short-Form Content", schedule: "Daily 9:00 AM", nextRun: "Tomorrow 9:00 AM", active: true },
  { agent: "Cold Outreach", schedule: "Mon-Fri 10:00 AM", nextRun: "Tomorrow 10:00 AM", active: true },
  { agent: "SEO & Content", schedule: "Weekly Monday 8:00 AM", nextRun: "Next Monday", active: true },
  { agent: "Automation", schedule: "Every 6 hours", nextRun: "In 2h", active: true },
  { agent: "Branding", schedule: "Monthly 1st", nextRun: "May 1st", active: false },
];

const TABS = ["Overview", "Agents", "Capabilities", "Analytics", "Sandbox", "Batch", "Scheduling", "Costs", "Benchmarks", "Prompts", "Dependencies", "Deploy"] as const;
type Tab = typeof TABS[number];

export default function ServicesPage() {
  const [activeTab, setActiveTab] = useState<Tab>("Overview");
  const [selectedAgent, setSelectedAgent] = useState<ServiceAgent | null>(null);
  const [sandboxAgent, setSandboxAgent] = useState<string>(AGENTS[0].id);
  const [sandboxInput, setSandboxInput] = useState("");
  const [sandboxOutput, setSandboxOutput] = useState("");
  const [sandboxLoading, setSandboxLoading] = useState(false);
  const [promptEditorAgent, setPromptEditorAgent] = useState<string>(AGENTS[0].id);
  const [promptText, setPromptText] = useState("You are a {agent_name} AI agent. Your role is to {role}. Always maintain a {tone} tone and focus on actionable, high-quality output.");
  const [schedules, setSchedules] = useState(MOCK_SCHEDULES);
  const [batchJobs, setBatchJobs] = useState(MOCK_BATCH_JOBS);

  const totalUsage = AGENTS.reduce((sum, a) => sum + a.usageToday, 0);
  const avgSuccess = Math.round(AGENTS.reduce((sum, a) => sum + a.successRate, 0) / AGENTS.length);
  const totalCost = AGENTS.reduce((sum, a) => sum + (a.usageToday * a.costPerUse), 0);
  const activeCount = AGENTS.filter(a => a.status === "active").length;

  function runSandbox() {
    if (!sandboxInput.trim()) return;
    setSandboxLoading(true);
    setSandboxOutput("");
    setTimeout(() => {
      const agent = AGENTS.find(a => a.id === sandboxAgent);
      setSandboxOutput(`[${agent?.name || "Agent"} Output]\n\nBased on your input: "${sandboxInput}"\n\nGenerated 5 high-quality results:\n\n1. Premium hook variation with engagement optimization\n2. Conversion-focused copy with social proof elements\n3. Storytelling approach with emotional triggers\n4. Data-driven angle with statistics and credibility\n5. Urgency-based variant with time-sensitive framing\n\nQuality Score: 92/100\nLatency: ${Math.floor(Math.random() * 2000 + 500)}ms\nTokens Used: ${Math.floor(Math.random() * 500 + 200)}`);
      setSandboxLoading(false);
    }, 1000);
  }

  function toggleSchedule(idx: number) {
    setSchedules(prev => prev.map((s, i) => i === idx ? { ...s, active: !s.active } : s));
  }

  function cancelBatch(id: string) {
    setBatchJobs(prev => prev.map(j => j.id === id ? { ...j, status: "failed" as const } : j));
  }

  return (
    <div className="fade-in space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-gold/10 rounded-xl flex items-center justify-center">
          <Sparkles size={20} className="text-gold" />
        </div>
        <div>
          <h1 className="text-lg font-bold">AI Service Agents</h1>
          <p className="text-xs text-muted">Each service has a dedicated AI agent &mdash; click to generate content, strategies & campaigns</p>
        </div>
      </div>

      {/* Stats Strip */}
      <div className="grid grid-cols-5 gap-3">
        {[
          { label: "Active Agents", value: activeCount, color: "text-green-400" },
          { label: "Usage Today", value: totalUsage, color: "text-gold" },
          { label: "Avg Success", value: `${avgSuccess}%`, color: "text-green-400" },
          { label: "Cost Today", value: `$${totalCost.toFixed(2)}`, color: "text-cyan-400" },
          { label: "Total Agents", value: AGENTS.length, color: "text-foreground" },
        ].map((s, i) => (
          <div key={i} className="card p-3 text-center">
            <p className="text-[9px] text-muted uppercase tracking-wider">{s.label}</p>
            <p className={`text-lg font-bold mt-0.5 ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Tab Navigation */}
      <div className="flex gap-1 border-b border-border overflow-x-auto pb-px">
        {TABS.map(t => (
          <button key={t} onClick={() => setActiveTab(t)}
            className={`px-3 py-2 text-[11px] font-medium whitespace-nowrap transition-all ${
              activeTab === t ? "text-gold border-b-2 border-gold" : "text-muted hover:text-foreground"
            }`}>{t}</button>
        ))}
      </div>

      {/* ═══ OVERVIEW TAB ═══ */}
      {activeTab === "Overview" && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {AGENTS.map(agent => (
            <button key={agent.id} onClick={() => { setSelectedAgent(agent); setActiveTab("Agents"); }}
              className={`text-left rounded-xl p-4 border transition-all hover:-translate-y-[1px] hover:shadow-lg ${agent.bgClass}`}>
              <div className="flex items-center gap-2.5 mb-2">
                <span className={agent.color}>{agent.icon}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold">{agent.name}</p>
                  <p className="text-[9px] text-muted">{agent.tagline}</p>
                </div>
                <span className={`w-2 h-2 rounded-full ${
                  agent.status === "active" ? "bg-green-400 animate-pulse" :
                  agent.status === "error" ? "bg-red-400" : "bg-gray-400"
                }`} />
              </div>
              <p className="text-[10px] text-muted leading-relaxed mb-2">{agent.description}</p>
              <div className="flex items-center gap-3 text-[9px] text-muted">
                <span>{agent.usageToday} uses today</span>
                <span>{agent.successRate}% success</span>
                <span className="text-cyan-400">${agent.costPerUse}/use</span>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* ═══ AGENTS TAB ═══ */}
      {activeTab === "Agents" && (
        <div className="flex gap-4">
          <div className={`${selectedAgent ? "w-1/3" : "w-full"} space-y-2 transition-all`}>
            {AGENTS.map(agent => (
              <button key={agent.id} onClick={() => setSelectedAgent(agent)}
                className={`w-full text-left p-3 rounded-lg border transition-all ${
                  selectedAgent?.id === agent.id ? `${agent.bgClass} shadow-md` : "border-border hover:border-gold/15"
                }`}>
                <div className="flex items-center gap-2">
                  <span className={selectedAgent?.id === agent.id ? agent.color : "text-muted"}>{agent.icon}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] font-semibold">{agent.name}</p>
                    <p className="text-[9px] text-muted">{agent.tagline}</p>
                  </div>
                  <span className={`w-2 h-2 rounded-full ${agent.status === "active" ? "bg-green-400" : agent.status === "error" ? "bg-red-400" : "bg-gray-400"}`} />
                </div>
              </button>
            ))}
          </div>

          {selectedAgent && (
            <div className="w-2/3 space-y-4 fade-in">
              <div className={`card p-4 ${selectedAgent.bgClass}`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 bg-surface/50 rounded-xl flex items-center justify-center border border-border">
                      <span className={selectedAgent.color}>{selectedAgent.icon}</span>
                    </div>
                    <div>
                      <h2 className="text-sm font-bold">{selectedAgent.name} Agent</h2>
                      <p className="text-[10px] text-muted">{selectedAgent.description}</p>
                    </div>
                  </div>
                  <button onClick={() => setSelectedAgent(null)} className="text-muted hover:text-foreground text-xs">Close</button>
                </div>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-4 gap-3">
                {[
                  { label: "Usage Today", value: selectedAgent.usageToday, color: "text-gold" },
                  { label: "Success Rate", value: `${selectedAgent.successRate}%`, color: "text-green-400" },
                  { label: "Avg Latency", value: `${selectedAgent.avgLatency}ms`, color: "text-foreground" },
                  { label: "Cost/Use", value: `$${selectedAgent.costPerUse}`, color: "text-cyan-400" },
                ].map((s, i) => (
                  <div key={i} className="card p-2.5 text-center">
                    <p className="text-[8px] text-muted uppercase">{s.label}</p>
                    <p className={`text-sm font-bold ${s.color}`}>{s.value}</p>
                  </div>
                ))}
              </div>

              {/* Capabilities */}
              <div className="card p-3">
                <h3 className="text-[10px] text-muted uppercase tracking-wider mb-2">Capabilities</h3>
                <div className="grid grid-cols-2 gap-1.5">
                  {selectedAgent.capabilities.map((cap, i) => (
                    <div key={i} className="flex items-center gap-1.5 text-[10px]">
                      <CheckCircle size={10} className="text-green-400 shrink-0" /> {cap}
                    </div>
                  ))}
                </div>
              </div>

              {/* Quick Actions */}
              <div className="card p-3">
                <h3 className="text-[10px] text-muted uppercase tracking-wider mb-2">Quick Actions</h3>
                <div className="grid grid-cols-3 gap-2">
                  {selectedAgent.actions.map((action, i) => (
                    <button key={i} className="text-left p-2 rounded-lg border border-border hover:border-gold/20 transition-all text-[10px]">
                      <div className="flex items-center gap-1"><Sparkles size={10} className="text-gold" /> <span className="font-medium">{action.label}</span></div>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ═══ CAPABILITIES TAB ═══ */}
      {activeTab === "Capabilities" && (
        <div className="card p-4">
          <h2 className="text-sm font-semibold mb-3 flex items-center gap-2"><Layers size={14} className="text-gold" /> Agent Capability Matrix</h2>
          <div className="overflow-x-auto">
            <div className="min-w-[800px]">
              <div className="grid grid-cols-10 gap-1 text-[8px] text-muted mb-2">
                <div className="col-span-2"></div>
                {["Copy", "Video", "Ads", "SEO", "Design", "Voice", "Auto", "Brand"].map(h => (
                  <div key={h} className="text-center font-bold uppercase">{h}</div>
                ))}
              </div>
              {AGENTS.map(agent => {
                const matrix = {
                  "short-form": [1, 1, 0, 0, 0, 0, 0, 0],
                  "long-form": [1, 1, 0, 1, 0, 0, 0, 0],
                  "paid-ads": [1, 0, 1, 0, 0, 0, 0, 0],
                  "seo": [1, 0, 0, 1, 0, 0, 0, 0],
                  "web-design": [1, 0, 0, 0, 1, 0, 0, 0],
                  "receptionist": [0, 0, 0, 0, 0, 1, 1, 0],
                  "automation": [0, 0, 0, 0, 0, 0, 1, 0],
                  "branding": [1, 0, 0, 0, 1, 0, 0, 1],
                  "cold-outreach": [1, 0, 0, 0, 0, 0, 1, 0],
                };
                const caps = matrix[agent.id as keyof typeof matrix] || [0, 0, 0, 0, 0, 0, 0, 0];
                return (
                  <div key={agent.id} className="grid grid-cols-10 gap-1 py-1.5 border-b border-border last:border-0">
                    <div className="col-span-2 flex items-center gap-1.5 text-[10px]">
                      <span className={agent.color}>{agent.icon}</span>
                      <span className="font-medium">{agent.name}</span>
                    </div>
                    {caps.map((has, i) => (
                      <div key={i} className="flex items-center justify-center">
                        {has ? <CheckCircle size={12} className="text-green-400" /> : <span className="w-3 h-3 rounded-full bg-surface-light" />}
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ═══ ANALYTICS TAB ═══ */}
      {activeTab === "Analytics" && (
        <div className="space-y-4">
          <div className="card p-4">
            <h2 className="text-sm font-semibold mb-3 flex items-center gap-2"><BarChart3 size={14} className="text-gold" /> Usage Analytics Per Agent</h2>
            <div className="space-y-2">
              {AGENTS.sort((a, b) => b.usageToday - a.usageToday).map(a => (
                <div key={a.id} className="flex items-center gap-3 text-[11px]">
                  <span className={`${a.color} w-5`}>{a.icon}</span>
                  <span className="w-32 font-medium">{a.name}</span>
                  <div className="flex-1 bg-surface-light rounded-full h-3">
                    <div className="bg-gold rounded-full h-3 transition-all flex items-center justify-end pr-1" style={{ width: `${(a.usageToday / Math.max(...AGENTS.map(x => x.usageToday))) * 100}%` }}>
                      <span className="text-[7px] font-bold text-black">{a.usageToday}</span>
                    </div>
                  </div>
                  <span className="w-12 text-right text-muted">{a.successRate}%</span>
                  <span className="w-16 text-right text-cyan-400 font-mono">${(a.usageToday * a.costPerUse).toFixed(2)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ═══ SANDBOX TAB ═══ */}
      {activeTab === "Sandbox" && (
        <div className="space-y-4">
          <div className="card p-4">
            <div className="flex items-center gap-2 mb-3">
              <TestTube size={14} className="text-gold" />
              <h2 className="text-sm font-semibold">Agent Testing Sandbox</h2>
            </div>
            <div className="space-y-3">
              <div className="flex gap-3">
                <div className="w-1/3">
                  <label className="text-[9px] text-muted uppercase tracking-wider block mb-1">Select Agent</label>
                  <select value={sandboxAgent} onChange={e => setSandboxAgent(e.target.value)} className="input w-full text-xs">
                    {AGENTS.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                  </select>
                </div>
                <div className="flex-1">
                  <label className="text-[9px] text-muted uppercase tracking-wider block mb-1">Input Prompt</label>
                  <div className="flex gap-2">
                    <input value={sandboxInput} onChange={e => setSandboxInput(e.target.value)} onKeyDown={e => e.key === "Enter" && runSandbox()}
                      className="input flex-1 text-xs" placeholder="Test input for the agent..." />
                    <button onClick={runSandbox} disabled={sandboxLoading || !sandboxInput.trim()}
                      className="px-4 py-2 bg-gold/10 text-gold text-xs rounded-lg border border-gold/20 hover:bg-gold/20 transition-all disabled:opacity-50 flex items-center gap-1.5">
                      {sandboxLoading ? <div className="w-3 h-3 border-2 border-gold/20 border-t-gold rounded-full animate-spin" /> : <Play size={12} />}
                      Test
                    </button>
                  </div>
                </div>
              </div>
              {sandboxOutput && (
                <div>
                  <p className="text-[9px] text-muted uppercase tracking-wider mb-1">Output</p>
                  <pre className="bg-black/30 rounded-lg p-3 text-[10px] font-mono text-green-400 whitespace-pre-wrap max-h-64 overflow-y-auto">{sandboxOutput}</pre>
                </div>
              )}
            </div>

            {/* Recent Tests */}
            <div className="mt-4 pt-4 border-t border-border">
              <h3 className="text-[10px] text-muted uppercase tracking-wider mb-2">Recent Test Results</h3>
              <div className="space-y-2">
                {MOCK_TEST_RESULTS.map((r, i) => (
                  <div key={i} className="p-2.5 rounded-lg border border-border text-[10px]">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-medium truncate flex-1">{r.input}</span>
                      <span className="text-muted ml-2">{r.timestamp}</span>
                    </div>
                    <div className="flex items-center gap-3 text-[9px] text-muted">
                      <span>Quality: <span className={r.quality >= 90 ? "text-green-400" : "text-yellow-400"}>{r.quality}/100</span></span>
                      <span>Latency: {r.latency}ms</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ═══ BATCH TAB ═══ */}
      {activeTab === "Batch" && (
        <div className="card p-4">
          <h2 className="text-sm font-semibold mb-3 flex items-center gap-2"><Layers size={14} className="text-gold" /> Batch Processing</h2>
          <div className="space-y-2">
            {batchJobs.map(job => (
              <div key={job.id} className="p-3 rounded-lg border border-border">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium">{job.agent}</span>
                    <span className={`text-[8px] px-1.5 py-0.5 rounded-full ${
                      job.status === "running" ? "bg-green-500/10 text-green-400" :
                      job.status === "done" ? "bg-blue-500/10 text-blue-400" :
                      job.status === "failed" ? "bg-red-500/10 text-red-400" :
                      "bg-surface-light text-muted"
                    }`}>{job.status}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[9px] text-muted">{job.startedAt}</span>
                    {job.status === "running" && (
                      <button onClick={() => cancelBatch(job.id)} className="text-[9px] px-2 py-0.5 rounded border border-red-500/20 text-red-400 hover:bg-red-500/10 transition-all">Cancel</button>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex-1 bg-surface-light rounded-full h-2">
                    <div className={`h-2 rounded-full transition-all ${
                      job.status === "done" ? "bg-blue-400" : job.status === "failed" ? "bg-red-400" : "bg-gold"
                    }`} style={{ width: `${(job.completed / job.items) * 100}%` }} />
                  </div>
                  <span className="text-[10px] font-mono text-muted">{job.completed}/{job.items}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ═══ SCHEDULING TAB ═══ */}
      {activeTab === "Scheduling" && (
        <div className="card p-4">
          <h2 className="text-sm font-semibold mb-3 flex items-center gap-2"><Calendar size={14} className="text-gold" /> Agent Scheduling</h2>
          <div className="space-y-2">
            {schedules.map((s, i) => (
              <div key={i} className="flex items-center gap-3 p-3 rounded-lg border border-border">
                <button onClick={() => toggleSchedule(i)}
                  className={`w-9 h-5 rounded-full transition-colors shrink-0 ${s.active ? "bg-green-400" : "bg-surface-light"}`}>
                  <div className={`w-4 h-4 rounded-full bg-white shadow transition-all mt-0.5 ${s.active ? "ml-4" : "ml-0.5"}`} />
                </button>
                <div className="flex-1">
                  <p className="text-[11px] font-medium">{s.agent}</p>
                  <p className="text-[9px] text-muted">{s.schedule}</p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] text-muted">Next: {s.nextRun}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ═══ COSTS TAB ═══ */}
      {activeTab === "Costs" && (
        <div className="card p-4">
          <div className="flex items-center gap-2 mb-3">
            <DollarSign size={14} className="text-gold" />
            <h2 className="text-sm font-semibold">Cost Estimator</h2>
          </div>
          <div className="grid grid-cols-4 gap-3 mb-4">
            <div className="p-3 rounded-lg border border-border text-center">
              <p className="text-[9px] text-muted uppercase">Today</p>
              <p className="text-lg font-bold text-gold">${totalCost.toFixed(2)}</p>
            </div>
            <div className="p-3 rounded-lg border border-border text-center">
              <p className="text-[9px] text-muted uppercase">Est. Week</p>
              <p className="text-lg font-bold">${(totalCost * 5).toFixed(2)}</p>
            </div>
            <div className="p-3 rounded-lg border border-border text-center">
              <p className="text-[9px] text-muted uppercase">Est. Month</p>
              <p className="text-lg font-bold">${(totalCost * 22).toFixed(2)}</p>
            </div>
            <div className="p-3 rounded-lg border border-border text-center">
              <p className="text-[9px] text-muted uppercase">Avg Per Use</p>
              <p className="text-lg font-bold text-cyan-400">${(totalCost / Math.max(totalUsage, 1)).toFixed(4)}</p>
            </div>
          </div>
          <div className="space-y-2">
            {AGENTS.sort((a, b) => (b.usageToday * b.costPerUse) - (a.usageToday * a.costPerUse)).map(a => (
              <div key={a.id} className="flex items-center gap-3 text-[11px]">
                <span className="w-32 font-medium">{a.name}</span>
                <div className="flex-1 bg-surface-light rounded-full h-2">
                  <div className="bg-cyan-400 rounded-full h-2 transition-all" style={{ width: `${((a.usageToday * a.costPerUse) / Math.max(totalCost, 0.01)) * 100}%` }} />
                </div>
                <span className="w-16 text-right font-mono text-cyan-400">${(a.usageToday * a.costPerUse).toFixed(2)}</span>
                <span className="w-20 text-right text-muted">${a.costPerUse}/use</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ═══ BENCHMARKS TAB ═══ */}
      {activeTab === "Benchmarks" && (
        <div className="card p-4">
          <div className="flex items-center gap-2 mb-3">
            <Gauge size={14} className="text-gold" />
            <h2 className="text-sm font-semibold">Performance Benchmarks</h2>
          </div>
          <div className="rounded-lg border border-border overflow-hidden">
            <div className="grid grid-cols-6 gap-2 px-4 py-2 border-b border-border text-[9px] text-muted uppercase tracking-wider bg-surface-light">
              <div className="col-span-2">Agent</div>
              <div>Latency</div>
              <div>Quality</div>
              <div>Throughput</div>
              <div>Uptime</div>
            </div>
            {AGENTS.map(a => (
              <div key={a.id} className="grid grid-cols-6 gap-2 px-4 py-2.5 border-b border-border last:border-0 text-[10px] items-center">
                <div className="col-span-2 font-medium flex items-center gap-1.5"><span className={a.color}>{a.icon}</span>{a.name}</div>
                <div className={`font-mono ${a.avgLatency < 1000 ? "text-green-400" : a.avgLatency < 2000 ? "text-yellow-400" : "text-red-400"}`}>{a.avgLatency}ms</div>
                <div className={`font-mono ${a.successRate >= 95 ? "text-green-400" : "text-yellow-400"}`}>{a.successRate}%</div>
                <div className="font-mono">{Math.round(a.usageToday / 8)}/hr</div>
                <div className="font-mono text-green-400">99.{Math.floor(Math.random() * 9 + 1)}%</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ═══ PROMPTS TAB ═══ */}
      {activeTab === "Prompts" && (
        <div className="card p-4">
          <div className="flex items-center gap-2 mb-3">
            <Code size={14} className="text-gold" />
            <h2 className="text-sm font-semibold">Custom Prompt Editor</h2>
          </div>
          <div className="space-y-3">
            <div>
              <label className="text-[9px] text-muted uppercase tracking-wider block mb-1">Agent</label>
              <select value={promptEditorAgent} onChange={e => setPromptEditorAgent(e.target.value)} className="input w-full text-xs">
                {AGENTS.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </div>
            <div>
              <label className="text-[9px] text-muted uppercase tracking-wider block mb-1">System Prompt</label>
              <textarea value={promptText} onChange={e => setPromptText(e.target.value)}
                className="input w-full text-[10px] font-mono h-40 resize-y" />
            </div>
            <div className="flex gap-2">
              <button className="px-4 py-2 bg-gold/10 text-gold text-xs rounded-lg border border-gold/20 hover:bg-gold/20 transition-all flex items-center gap-1.5">
                <Settings size={12} /> Save Prompt
              </button>
              <button className="px-4 py-2 border border-border text-xs rounded-lg text-muted hover:text-foreground transition-all flex items-center gap-1.5">
                <Play size={12} /> Test with Sandbox
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══ DEPENDENCIES TAB ═══ */}
      {activeTab === "Dependencies" && (
        <div className="card p-4">
          <h2 className="text-sm font-semibold mb-3 flex items-center gap-2"><GitBranch size={14} className="text-gold" /> Agent Dependency Graph</h2>
          <div className="space-y-2">
            {[
              { agent: "Content", depends: ["SEO & Content", "Branding"], provides: ["Cold Outreach", "Paid Ads"] },
              { agent: "Cold Outreach", depends: ["Content", "Lead Engine"], provides: ["Scheduler", "Proposal"] },
              { agent: "Automation", depends: ["All Agents"], provides: ["All Agents"] },
              { agent: "Paid Ads", depends: ["Content", "Analytics"], provides: ["Lead Engine"] },
              { agent: "Web Design", depends: ["Branding", "SEO & Content"], provides: ["Content"] },
            ].map((dep, i) => (
              <div key={i} className="p-3 rounded-lg border border-border">
                <p className="text-xs font-semibold mb-2">{dep.agent}</p>
                <div className="grid grid-cols-2 gap-3 text-[10px]">
                  <div>
                    <p className="text-[8px] text-muted uppercase mb-1">Depends On</p>
                    <div className="flex flex-wrap gap-1">{dep.depends.map((d, j) => (
                      <span key={j} className="px-1.5 py-0.5 bg-blue-500/10 text-blue-400 rounded text-[9px]">{d}</span>
                    ))}</div>
                  </div>
                  <div>
                    <p className="text-[8px] text-muted uppercase mb-1">Provides To</p>
                    <div className="flex flex-wrap gap-1">{dep.provides.map((p, j) => (
                      <span key={j} className="px-1.5 py-0.5 bg-green-500/10 text-green-400 rounded text-[9px]">{p}</span>
                    ))}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ═══ DEPLOY TAB ═══ */}
      {activeTab === "Deploy" && (
        <div className="card p-4">
          <h2 className="text-sm font-semibold mb-3 flex items-center gap-2"><TrendingUp size={14} className="text-gold" /> One-Click Deploy</h2>
          <p className="text-[10px] text-muted mb-4">Deploy agent updates to production with a single click. All agents run the latest stable version.</p>
          <div className="space-y-2">
            {AGENTS.map(a => (
              <div key={a.id} className="flex items-center gap-3 p-3 rounded-lg border border-border">
                <span className={a.color}>{a.icon}</span>
                <div className="flex-1">
                  <p className="text-[11px] font-medium">{a.name}</p>
                  <p className="text-[9px] text-muted">Current: v{a.version}</p>
                </div>
                <span className={`text-[9px] px-2 py-0.5 rounded-full ${
                  a.status === "active" ? "bg-green-500/10 text-green-400" :
                  a.status === "error" ? "bg-red-500/10 text-red-400" :
                  "bg-surface-light text-muted"
                }`}>{a.status}</span>
                <button className="text-[9px] px-3 py-1 rounded bg-gold/10 text-gold border border-gold/20 hover:bg-gold/20 transition-all flex items-center gap-1">
                  <Play size={9} /> Deploy
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
