"use client";

import { useState } from "react";
import {
  Sun, RefreshCw, Zap, MessageSquare, Users, DollarSign, Bot,
  AlertTriangle, Calendar, CheckCircle, Clock, TrendingUp,
  Mail, Sparkles, FileText, ArrowUpRight,
  Target, Lightbulb, Star, Settings
} from "lucide-react";

/* ------------------------------------------------------------------ */
/*  Mock Data                                                          */
/* ------------------------------------------------------------------ */

const BRIEFING_DATA = {
  summary: "Good morning! Today is looking productive. You have 3 client calls scheduled, 2 proposals awaiting approval, and your lead pipeline grew by 12% this week. Revenue is tracking 8% above forecast. Key priority: Follow up with Metro Legal Group - their health score dropped below 50.",
  leads: { scraped_since: 34, total: 1245, qualified: 12, conversion: "3.4%" },
  outreach: { sent_since: 87, replies: 14, booked_calls: 3, reply_rate: "16.1%" },
  team: { active_members: 5, messages: 42, tasks_completed: 18, tasks_pending: 7 },
  clients: { updates: 8, deliverables_pending: 4, approvals_needed: 2, at_risk: 1 },
  trinity: { actions_since: 156, top_action: "Content scheduling", errors: 0 },
  system: { issues: 1, uptime: "99.8%", details: ["WhatsApp API rate limit warning"] },
  revenue: { new_deals: 2, mrr_change: 1200, total_mrr: 19200, forecast: 21000 },
};

const TODAYS_TASKS = [
  { id: "t1", title: "Client call - Bright Smiles Dental", time: "10:00 AM", type: "call", done: false },
  { id: "t2", title: "Review content calendar for Peak Fitness", time: "11:30 AM", type: "review", done: false },
  { id: "t3", title: "Client call - Elite Auto Detailing", time: "1:00 PM", type: "call", done: false },
  { id: "t4", title: "Send monthly report to Sunrise Bakery", time: "2:30 PM", type: "task", done: true },
  { id: "t5", title: "Client call - Metro Legal Group (retention)", time: "3:30 PM", type: "call", done: false },
  { id: "t6", title: "Approve ad creatives for 3 clients", time: "4:00 PM", type: "approval", done: false },
  { id: "t7", title: "Team standup", time: "5:00 PM", type: "meeting", done: false },
];

const PENDING_APPROVALS = [
  { id: "a1", client: "Peak Fitness Studio", item: "April content calendar (15 posts)", submitted: "2 days ago", priority: "high" },
  { id: "a2", client: "Bright Smiles Dental", item: "Google Ads campaign changes", submitted: "1 day ago", priority: "medium" },
  { id: "a3", client: "Elite Auto Detailing", item: "New website landing page", submitted: "3 hours ago", priority: "low" },
];

const CLIENT_UPDATES = [
  { client: "Peak Fitness Studio", update: "New lead form submission from Google Ads", time: "1h ago", type: "lead" },
  { client: "Bright Smiles Dental", update: "Content approved for next week", time: "2h ago", type: "approval" },
  { client: "Metro Legal Group", update: "Health score dropped to 48 - needs attention", time: "3h ago", type: "alert" },
  { client: "Sunrise Bakery", update: "Monthly report viewed and downloaded", time: "5h ago", type: "report" },
  { client: "Elite Auto Detailing", update: "Booked a call for Thursday to discuss ads", time: "6h ago", type: "call" },
];

const UPCOMING_MEETINGS = [
  { title: "Bright Smiles Dental - Monthly Review", time: "10:00 AM", duration: "30 min", platform: "Zoom" },
  { title: "Elite Auto Detailing - Upsell Discussion", time: "1:00 PM", duration: "20 min", platform: "Google Meet" },
  { title: "Metro Legal Group - Retention Call", time: "3:30 PM", duration: "45 min", platform: "Zoom" },
  { title: "Team Standup", time: "5:00 PM", duration: "15 min", platform: "Discord" },
];

const CONTENT_SCHEDULE = [
  { client: "Peak Fitness Studio", posts: 4, platforms: "IG, FB, TikTok", status: "scheduled" },
  { client: "Bright Smiles Dental", posts: 3, platforms: "IG, FB", status: "pending approval" },
  { client: "Elite Auto Detailing", posts: 5, platforms: "IG, FB, TikTok, YT", status: "scheduled" },
  { client: "Sunrise Bakery", posts: 3, platforms: "IG, FB", status: "drafts ready" },
];

const AI_INSIGHTS = [
  { insight: "Peak Fitness Studio engagement is 25% above average - consider featuring them as a case study", type: "opportunity" },
  { insight: "Metro Legal Group has missed 2 scheduled calls this month - escalate retention outreach", type: "risk" },
  { insight: "Your response time to leads has improved by 40% since last month", type: "positive" },
  { insight: "Instagram Reels are generating 3x more engagement than static posts across all clients", type: "trend" },
  { insight: "Consider increasing Google Ads budget for Elite Auto - ROAS is 5.8x", type: "opportunity" },
];

const CUSTOM_SECTIONS = [
  { id: "cs1", name: "Lead Pipeline", enabled: true },
  { id: "cs2", name: "Revenue Metrics", enabled: true },
  { id: "cs3", name: "Team Activity", enabled: true },
  { id: "cs4", name: "Client Updates", enabled: true },
  { id: "cs5", name: "Content Schedule", enabled: false },
  { id: "cs6", name: "System Health", enabled: false },
];

/* ------------------------------------------------------------------ */
/*  Page Component                                                     */
/* ------------------------------------------------------------------ */

export default function BriefingPage() {
  const [activeTab, setActiveTab] = useState<"briefing" | "tasks" | "approvals" | "insights" | "settings">("briefing");
  const [taskDone, setTaskDone] = useState<string[]>(["t4"]);
  const [generating, setGenerating] = useState(false);
  const [emailSchedule, setEmailSchedule] = useState("daily");
  const [emailTime, setEmailTime] = useState("08:00");
  const [sections, setSections] = useState(CUSTOM_SECTIONS);

  function toggleTask(id: string) {
    setTaskDone(prev => prev.includes(id) ? prev.filter(t => t !== id) : [...prev, id]);
  }

  function toggleSection(id: string) {
    setSections(prev => prev.map(s => s.id === id ? { ...s, enabled: !s.enabled } : s));
  }

  function refreshBriefing() {
    setGenerating(true);
    setTimeout(() => setGenerating(false), 2000);
  }

  const data = BRIEFING_DATA;

  const tabs = [
    { id: "briefing" as const, label: "Briefing", icon: Sun },
    { id: "tasks" as const, label: "Tasks & Meetings", icon: Calendar },
    { id: "approvals" as const, label: "Approvals", icon: CheckCircle },
    { id: "insights" as const, label: "AI Insights", icon: Sparkles },
    { id: "settings" as const, label: "Settings", icon: Settings },
  ];

  return (
    <div className="fade-in space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-gold/10 rounded-xl flex items-center justify-center">
            <Sun size={28} className="text-gold" />
          </div>
          <div>
            <h1 className="text-lg font-bold">Morning Briefing</h1>
            <p className="text-sm text-muted">Monday, April 14, 2026 &middot; Updated just now</p>
          </div>
        </div>
        <button onClick={refreshBriefing} disabled={generating} className="px-4 py-2 rounded-lg bg-gold text-black text-xs font-semibold disabled:opacity-50 flex items-center gap-2">
          <RefreshCw size={14} className={generating ? "animate-spin" : ""} />
          {generating ? "Generating..." : "Refresh"}
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 overflow-x-auto pb-1">
        {tabs.map(t => (
          <button key={t.id} onClick={() => setActiveTab(t.id)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs whitespace-nowrap transition-all border ${
              activeTab === t.id ? "bg-gold/10 border-gold/20 text-gold font-medium" : "border-border text-muted hover:text-foreground"
            }`}>
            <t.icon size={12} /> {t.label}
          </button>
        ))}
      </div>

      {/* ---- TAB: Briefing ---- */}
      {activeTab === "briefing" && (
        <>
          {/* AI Summary */}
          <div className="card p-4 border-gold/20 bg-gold/[0.03]">
            <div className="flex items-start gap-2">
              <Sparkles size={14} className="text-gold shrink-0 mt-0.5" />
              <p className="text-sm leading-relaxed">{data.summary}</p>
            </div>
          </div>

          {/* Key Metrics Summary */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="card p-3">
              <div className="flex items-center gap-2 mb-1">
                <DollarSign size={14} className="text-gold" />
                <span className="text-[9px] text-muted uppercase">Total MRR</span>
              </div>
              <p className="text-xl font-bold font-mono text-gold">${data.revenue.total_mrr.toLocaleString()}</p>
              <span className="text-[9px] text-green-400 flex items-center gap-0.5"><ArrowUpRight size={8} /> +${data.revenue.mrr_change.toLocaleString()}</span>
            </div>
            <div className="card p-3">
              <div className="flex items-center gap-2 mb-1">
                <Zap size={14} className="text-gold" />
                <span className="text-[9px] text-muted uppercase">New Leads</span>
              </div>
              <p className="text-xl font-bold font-mono">{data.leads.scraped_since}</p>
              <span className="text-[9px] text-muted">{data.leads.qualified} qualified</span>
            </div>
            <div className="card p-3">
              <div className="flex items-center gap-2 mb-1">
                <MessageSquare size={14} className="text-gold" />
                <span className="text-[9px] text-muted uppercase">Outreach</span>
              </div>
              <p className="text-xl font-bold font-mono">{data.outreach.sent_since}</p>
              <span className="text-[9px] text-green-400">{data.outreach.reply_rate} reply rate</span>
            </div>
            <div className="card p-3">
              <div className="flex items-center gap-2 mb-1">
                <Bot size={14} className="text-gold" />
                <span className="text-[9px] text-muted uppercase">AI Actions</span>
              </div>
              <p className="text-xl font-bold font-mono">{data.trinity.actions_since}</p>
              <span className="text-[9px] text-muted">{data.trinity.top_action}</span>
            </div>
          </div>

          {/* Grid panels */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Revenue Snapshot */}
            <div className="card p-4">
              <div className="flex items-center gap-2 mb-3">
                <DollarSign size={14} className="text-gold" />
                <h3 className="text-xs font-semibold">Revenue Snapshot</h3>
              </div>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted text-xs">New deals closed</span>
                  <span className="font-medium text-green-400 text-xs">{data.revenue.new_deals}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted text-xs">MRR change</span>
                  <span className="font-medium text-green-400 text-xs">+${data.revenue.mrr_change.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted text-xs">Forecast this month</span>
                  <span className="font-bold text-gold text-xs">${data.revenue.forecast.toLocaleString()}</span>
                </div>
                <div className="mt-2 pt-2 border-t border-border">
                  <div className="flex items-center justify-between text-[10px]">
                    <span className="text-muted">Progress to forecast</span>
                    <span className="text-gold">{Math.round((data.revenue.total_mrr / data.revenue.forecast) * 100)}%</span>
                  </div>
                  <div className="w-full bg-white/5 rounded-full h-1.5 mt-1 overflow-hidden">
                    <div className="h-full rounded-full bg-gold/50" style={{ width: `${(data.revenue.total_mrr / data.revenue.forecast) * 100}%` }} />
                  </div>
                </div>
              </div>
            </div>

            {/* Team Activity */}
            <div className="card p-4">
              <div className="flex items-center gap-2 mb-3">
                <Users size={14} className="text-gold" />
                <h3 className="text-xs font-semibold">Team Activity</h3>
              </div>
              <div className="space-y-2 text-xs">
                <div className="flex justify-between"><span className="text-muted">Active members</span><span>{data.team.active_members}</span></div>
                <div className="flex justify-between"><span className="text-muted">Messages today</span><span>{data.team.messages}</span></div>
                <div className="flex justify-between"><span className="text-muted">Tasks completed</span><span className="text-green-400">{data.team.tasks_completed}</span></div>
                <div className="flex justify-between"><span className="text-muted">Tasks pending</span><span className="text-yellow-400">{data.team.tasks_pending}</span></div>
              </div>
            </div>

            {/* Client Updates */}
            <div className="card p-4">
              <div className="flex items-center gap-2 mb-3">
                <Users size={14} className="text-gold" />
                <h3 className="text-xs font-semibold">Client Updates</h3>
              </div>
              <div className="space-y-2">
                {CLIENT_UPDATES.slice(0, 4).map(u => (
                  <div key={u.client} className="flex items-start gap-2">
                    <div className={`w-1.5 h-1.5 rounded-full mt-1.5 shrink-0 ${
                      u.type === "alert" ? "bg-red-400" : u.type === "lead" ? "bg-green-400" : "bg-gold"
                    }`} />
                    <div>
                      <p className="text-[10px] font-medium">{u.client}</p>
                      <p className="text-[9px] text-muted">{u.update}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Content Schedule */}
            <div className="card p-4">
              <div className="flex items-center gap-2 mb-3">
                <FileText size={14} className="text-gold" />
                <h3 className="text-xs font-semibold">Content Schedule</h3>
              </div>
              <div className="space-y-2">
                {CONTENT_SCHEDULE.map(c => (
                  <div key={c.client} className="flex items-center justify-between text-[10px]">
                    <span className="font-medium">{c.client}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-muted">{c.posts} posts</span>
                      <span className={`px-1.5 py-0.5 rounded text-[8px] ${
                        c.status === "scheduled" ? "bg-green-400/10 text-green-400" :
                        c.status === "pending approval" ? "bg-yellow-400/10 text-yellow-400" :
                        "bg-blue-400/10 text-blue-400"
                      }`}>{c.status}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Outreach stats */}
            <div className="card p-4">
              <div className="flex items-center gap-2 mb-3">
                <MessageSquare size={14} className="text-gold" />
                <h3 className="text-xs font-semibold">Outreach</h3>
              </div>
              <div className="space-y-2 text-xs">
                <div className="flex justify-between"><span className="text-muted">DMs sent</span><span>{data.outreach.sent_since}</span></div>
                <div className="flex justify-between"><span className="text-muted">Replies received</span><span className="text-green-400">{data.outreach.replies}</span></div>
                <div className="flex justify-between"><span className="text-muted">Calls booked</span><span className="text-gold">{data.outreach.booked_calls}</span></div>
              </div>
            </div>

            {/* System Health */}
            {data.system.issues > 0 && (
              <div className="card p-4 border-red-400/20">
                <div className="flex items-center gap-2 mb-3">
                  <AlertTriangle size={14} className="text-red-400" />
                  <h3 className="text-xs font-semibold text-red-400">System Issues</h3>
                </div>
                <div className="space-y-1">
                  {data.system.details.map((d, i) => (
                    <p key={i} className="text-xs text-red-300">&bull; {d}</p>
                  ))}
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {/* ---- TAB: Tasks & Meetings ---- */}
      {activeTab === "tasks" && (
        <div className="space-y-4">
          <div className="card p-4">
            <h3 className="text-xs font-semibold mb-3 flex items-center gap-2"><CheckCircle size={12} className="text-gold" /> Today&apos;s Tasks</h3>
            <div className="space-y-2">
              {TODAYS_TASKS.map(task => (
                <div key={task.id} className={`flex items-center gap-3 p-2 rounded-lg border transition-all ${
                  taskDone.includes(task.id) ? "border-green-400/15 bg-green-400/[0.02] opacity-60" : "border-border"
                }`}>
                  <button onClick={() => toggleTask(task.id)}
                    className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-all ${
                      taskDone.includes(task.id) ? "border-green-400 bg-green-400" : "border-border"
                    }`}>
                    {taskDone.includes(task.id) && <CheckCircle size={10} className="text-black" />}
                  </button>
                  <div className="flex-1">
                    <p className={`text-xs ${taskDone.includes(task.id) ? "line-through text-muted" : "font-medium"}`}>{task.title}</p>
                  </div>
                  <span className="text-[10px] text-muted">{task.time}</span>
                  <span className={`text-[8px] px-1.5 py-0.5 rounded ${
                    task.type === "call" ? "bg-blue-400/10 text-blue-400" :
                    task.type === "meeting" ? "bg-purple-400/10 text-purple-400" :
                    task.type === "approval" ? "bg-yellow-400/10 text-yellow-400" :
                    "bg-white/5 text-muted"
                  }`}>{task.type}</span>
                </div>
              ))}
            </div>
            <p className="text-[10px] text-muted mt-2">{taskDone.length}/{TODAYS_TASKS.length} completed</p>
          </div>

          <div className="card p-4">
            <h3 className="text-xs font-semibold mb-3 flex items-center gap-2"><Calendar size={12} className="text-gold" /> Upcoming Meetings</h3>
            <div className="space-y-2">
              {UPCOMING_MEETINGS.map((m, i) => (
                <div key={i} className="flex items-center justify-between p-3 rounded-lg border border-border">
                  <div>
                    <p className="text-xs font-medium">{m.title}</p>
                    <p className="text-[10px] text-muted flex items-center gap-1"><Clock size={8} /> {m.time} &middot; {m.duration}</p>
                  </div>
                  <span className="text-[10px] px-2 py-0.5 rounded bg-blue-400/10 text-blue-400">{m.platform}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ---- TAB: Approvals ---- */}
      {activeTab === "approvals" && (
        <div className="card p-4">
          <h3 className="text-xs font-semibold mb-3 flex items-center gap-2"><CheckCircle size={12} className="text-gold" /> Pending Approvals</h3>
          <div className="space-y-2">
            {PENDING_APPROVALS.map(a => (
              <div key={a.id} className="flex items-center justify-between p-3 rounded-lg border border-border">
                <div>
                  <p className="text-xs font-medium">{a.client}</p>
                  <p className="text-[10px] text-muted">{a.item}</p>
                  <p className="text-[9px] text-muted">Submitted {a.submitted}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-[8px] px-1.5 py-0.5 rounded ${
                    a.priority === "high" ? "bg-red-400/10 text-red-400" :
                    a.priority === "medium" ? "bg-yellow-400/10 text-yellow-400" :
                    "bg-white/5 text-muted"
                  }`}>{a.priority}</span>
                  <button className="px-2 py-1 rounded-lg border border-border text-[10px] text-muted hover:text-foreground">Review</button>
                  <button className="px-2 py-1 rounded-lg bg-gold text-black text-[10px] font-semibold">Approve</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ---- TAB: AI Insights ---- */}
      {activeTab === "insights" && (
        <div className="space-y-4">
          <div className="card p-4">
            <h3 className="text-xs font-semibold mb-3 flex items-center gap-2"><Lightbulb size={12} className="text-gold" /> AI Recommendations</h3>
            <div className="space-y-2">
              {AI_INSIGHTS.map((ins, i) => (
                <div key={i} className={`flex items-start gap-3 p-3 rounded-lg border ${
                  ins.type === "risk" ? "bg-red-400/5 border-red-400/15" :
                  ins.type === "opportunity" ? "bg-green-400/5 border-green-400/15" :
                  ins.type === "positive" ? "bg-blue-400/5 border-blue-400/15" :
                  "bg-gold/5 border-gold/15"
                }`}>
                  {ins.type === "risk" ? <AlertTriangle size={14} className="text-red-400 shrink-0" /> :
                   ins.type === "opportunity" ? <Target size={14} className="text-green-400 shrink-0" /> :
                   ins.type === "positive" ? <TrendingUp size={14} className="text-blue-400 shrink-0" /> :
                   <Star size={14} className="text-gold shrink-0" />}
                  <p className="text-xs text-muted">{ins.insight}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ---- TAB: Settings ---- */}
      {activeTab === "settings" && (
        <div className="space-y-4">
          <div className="card p-4">
            <h3 className="text-xs font-semibold mb-3 flex items-center gap-2"><Mail size={12} className="text-gold" /> Email Briefing Scheduler</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label className="block text-[10px] text-muted uppercase tracking-wider mb-1">Frequency</label>
                <select value={emailSchedule} onChange={e => setEmailSchedule(e.target.value)}
                  className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-xs text-foreground">
                  <option value="daily">Daily</option>
                  <option value="weekdays">Weekdays only</option>
                  <option value="weekly">Weekly (Monday)</option>
                </select>
              </div>
              <div>
                <label className="block text-[10px] text-muted uppercase tracking-wider mb-1">Time</label>
                <input type="time" value={emailTime} onChange={e => setEmailTime(e.target.value)}
                  className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-xs text-foreground" />
              </div>
              <div className="flex items-end">
                <button className="px-4 py-2 rounded-lg bg-gold text-black text-xs font-semibold w-full">Save Schedule</button>
              </div>
            </div>
          </div>

          <div className="card p-4">
            <h3 className="text-xs font-semibold mb-3 flex items-center gap-2"><Settings size={12} className="text-gold" /> Custom Briefing Sections</h3>
            <div className="space-y-2">
              {sections.map(s => (
                <div key={s.id} className="flex items-center justify-between p-2 rounded-lg border border-border">
                  <span className="text-xs">{s.name}</span>
                  <button onClick={() => toggleSection(s.id)}
                    className={`w-8 h-4 rounded-full transition-all relative ${s.enabled ? "bg-gold" : "bg-white/10"}`}>
                    <div className="w-3 h-3 rounded-full bg-white absolute top-0.5 transition-all" style={{ left: s.enabled ? "18px" : "2px" }} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
