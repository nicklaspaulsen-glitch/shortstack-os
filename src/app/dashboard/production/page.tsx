"use client";

import { useState } from "react";
import {
  Film, CheckCircle, MessageSquare,
  ArrowRight, Clock, AlertTriangle,
  Calendar, Eye, Plus, X,
  Flag
} from "lucide-react";

type ProductionTab = "pipeline" | "calendar" | "standup" | "approvals";
type KanbanStatus = "backlog" | "in_progress" | "review" | "approved" | "delivered";
type Priority = "low" | "medium" | "high" | "urgent";

interface ProductionItem {
  id: string;
  title: string;
  client: string;
  type: string;
  status: KanbanStatus;
  priority: Priority;
  assignee: string;
  dueDate: string;
  estimatedHours: number;
  actualHours: number;
  checklist: { task: string; done: boolean }[];
  reviewNotes: string;
}

const PRIORITY_CONFIG: Record<Priority, { label: string; color: string; bg: string }> = {
  low: { label: "Low", color: "text-blue-400", bg: "bg-blue-400/10" },
  medium: { label: "Medium", color: "text-yellow-400", bg: "bg-yellow-400/10" },
  high: { label: "High", color: "text-orange-400", bg: "bg-orange-400/10" },
  urgent: { label: "Urgent", color: "text-red-400", bg: "bg-red-400/10" },
};

const STATUS_CONFIG: Record<KanbanStatus, { label: string; color: string }> = {
  backlog: { label: "Backlog", color: "text-gray-400" },
  in_progress: { label: "In Progress", color: "text-blue-400" },
  review: { label: "In Review", color: "text-purple-400" },
  approved: { label: "Approved", color: "text-emerald-400" },
  delivered: { label: "Delivered", color: "text-gold" },
};

const MOCK_ITEMS: ProductionItem[] = [
  { id: "p1", title: "Instagram Reels x3", client: "Bright Dental", type: "Short Form", status: "in_progress", priority: "high", assignee: "James", dueDate: "2026-04-16", estimatedHours: 6, actualHours: 4, checklist: [{ task: "Edit footage", done: true }, { task: "Add captions", done: true }, { task: "Color grade", done: false }, { task: "Add music", done: false }], reviewNotes: "" },
  { id: "p2", title: "YouTube Video - Dental Tips", client: "Bright Dental", type: "Long Form", status: "review", priority: "medium", assignee: "James", dueDate: "2026-04-17", estimatedHours: 8, actualHours: 7, checklist: [{ task: "Rough cut", done: true }, { task: "Sound mix", done: true }, { task: "Thumbnail", done: true }, { task: "SEO tags", done: false }], reviewNotes: "Great work, just fix the intro transition" },
  { id: "p3", title: "TikTok Content x5", client: "FitPro Gym", type: "Short Form", status: "backlog", priority: "medium", assignee: "Sarah", dueDate: "2026-04-18", estimatedHours: 5, actualHours: 0, checklist: [{ task: "Script approval", done: true }, { task: "Record footage", done: false }, { task: "Edit", done: false }, { task: "Post", done: false }], reviewNotes: "" },
  { id: "p4", title: "Facebook Ad Creative", client: "Metro Realty", type: "Ad Creative", status: "approved", priority: "urgent", assignee: "Maria", dueDate: "2026-04-15", estimatedHours: 3, actualHours: 2.5, checklist: [{ task: "Design variants", done: true }, { task: "Write copy", done: true }, { task: "A/B versions", done: true }, { task: "Client approval", done: true }], reviewNotes: "Approved - launch ASAP" },
  { id: "p5", title: "Monthly Blog Posts x4", client: "Green Eats", type: "Blog", status: "in_progress", priority: "low", assignee: "Sarah", dueDate: "2026-04-20", estimatedHours: 8, actualHours: 3, checklist: [{ task: "Research topics", done: true }, { task: "Write drafts", done: true }, { task: "SEO optimization", done: false }, { task: "Add images", done: false }], reviewNotes: "" },
  { id: "p6", title: "Google Ads Landing Page", client: "Luxe Salon", type: "Web", status: "review", priority: "high", assignee: "Alex", dueDate: "2026-04-16", estimatedHours: 10, actualHours: 9, checklist: [{ task: "Design mockup", done: true }, { task: "Build page", done: true }, { task: "Mobile optimize", done: true }, { task: "Add tracking", done: false }], reviewNotes: "Needs CTA color change" },
  { id: "p7", title: "Podcast Episode Edit", client: "FitPro Gym", type: "Podcast", status: "delivered", priority: "low", assignee: "James", dueDate: "2026-04-12", estimatedHours: 4, actualHours: 3.5, checklist: [{ task: "Audio cleanup", done: true }, { task: "Intro/Outro", done: true }, { task: "Show notes", done: true }, { task: "Upload", done: true }], reviewNotes: "Published to Spotify" },
  { id: "p8", title: "Email Campaign Design", client: "Metro Realty", type: "Email", status: "backlog", priority: "medium", assignee: "Maria", dueDate: "2026-04-22", estimatedHours: 4, actualHours: 0, checklist: [{ task: "Template design", done: false }, { task: "Write copy", done: false }, { task: "Build in Mailchimp", done: false }], reviewNotes: "" },
];

export default function ProductionPage() {
  const [tab, setTab] = useState<ProductionTab>("pipeline");
  const [items, setItems] = useState<ProductionItem[]>(MOCK_ITEMS);
  const [filterClient, setFilterClient] = useState("All");
  const [filterPriority, setFilterPriority] = useState<string>("All");
  const [showSubmit, setShowSubmit] = useState(false);
  const [draggedItem, setDraggedItem] = useState<string | null>(null);

  const clients = ["All", ...Array.from(new Set(items.map(i => i.client)))];
  const filtered = items.filter(i => {
    if (filterClient !== "All" && i.client !== filterClient) return false;
    if (filterPriority !== "All" && i.priority !== filterPriority) return false;
    return true;
  });

  const handleDrop = (status: KanbanStatus) => {
    if (!draggedItem) return;
    setItems(prev => prev.map(i => i.id === draggedItem ? { ...i, status } : i));
    setDraggedItem(null);
  };

  const toggleChecklist = (itemId: string, taskIdx: number) => {
    setItems(prev => prev.map(i => {
      if (i.id !== itemId) return i;
      const cl = [...i.checklist];
      cl[taskIdx] = { ...cl[taskIdx], done: !cl[taskIdx].done };
      return { ...i, checklist: cl };
    }));
  };

  const totalEstimated = items.reduce((s, i) => s + i.estimatedHours, 0);
  const totalActual = items.reduce((s, i) => s + i.actualHours, 0);
  const overdue = items.filter(i => i.dueDate < "2026-04-14" && i.status !== "delivered").length;
  const inReview = items.filter(i => i.status === "review").length;

  // Bottleneck analysis
  const bottlenecks = (() => {
    const statusCounts: Record<string, number> = {};
    items.forEach(i => { statusCounts[i.status] = (statusCounts[i.status] || 0) + 1; });
    return Object.entries(statusCounts)
      .sort((a, b) => b[1] - a[1])
      .filter(([status]) => status !== "delivered")
      .slice(0, 3);
  })();

  const TABS: { id: ProductionTab; label: string; icon: React.ReactNode }[] = [
    { id: "pipeline", label: "Pipeline", icon: <Film size={13} /> },
    { id: "calendar", label: "Calendar", icon: <Calendar size={13} /> },
    { id: "standup", label: "Standup", icon: <MessageSquare size={13} /> },
    { id: "approvals", label: "Approvals", icon: <CheckCircle size={13} /> },
  ];

  return (
    <div className="fade-in space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="page-header mb-0 flex items-center gap-2"><Film size={18} className="text-gold" /> Content Production</h1>
          <p className="text-xs text-muted mt-0.5">Pipeline, assignments, reviews, and approvals</p>
        </div>
        <button onClick={() => setShowSubmit(true)} className="btn-primary text-xs flex items-center gap-1.5">
          <Plus size={12} /> New Request
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-2.5">
        <div className="card p-3 text-center">
          <p className="text-lg font-bold">{items.length}</p>
          <p className="text-[10px] text-muted">Total Items</p>
        </div>
        <div className="card p-3 text-center">
          <p className="text-lg font-bold text-blue-400">{items.filter(i => i.status === "in_progress").length}</p>
          <p className="text-[10px] text-muted">In Progress</p>
        </div>
        <div className="card p-3 text-center">
          <p className="text-lg font-bold text-purple-400">{inReview}</p>
          <p className="text-[10px] text-muted">In Review</p>
        </div>
        <div className="card p-3 text-center">
          <p className="text-lg font-bold text-red-400">{overdue}</p>
          <p className="text-[10px] text-muted">Overdue</p>
        </div>
        <div className="card p-3 text-center">
          <p className="text-lg font-bold text-emerald-400">{totalActual.toFixed(1)}h</p>
          <p className="text-[10px] text-muted">of {totalEstimated}h est.</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-2 flex-wrap">
        <select value={filterClient} onChange={e => setFilterClient(e.target.value)} className="input text-xs">
          {clients.map(c => <option key={c} value={c}>{c === "All" ? "All Clients" : c}</option>)}
        </select>
        <select value={filterPriority} onChange={e => setFilterPriority(e.target.value)} className="input text-xs">
          <option value="All">All Priorities</option>
          {(["urgent", "high", "medium", "low"] as const).map(p => (
            <option key={p} value={p}>{PRIORITY_CONFIG[p].label}</option>
          ))}
        </select>
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

      {/* Pipeline (Kanban) */}
      {tab === "pipeline" && (
        <div className="grid grid-cols-5 gap-3 overflow-x-auto">
          {(["backlog", "in_progress", "review", "approved", "delivered"] as KanbanStatus[]).map(status => (
            <div key={status}
              onDragOver={e => e.preventDefault()}
              onDrop={() => handleDrop(status)}
              className="min-w-[200px]">
              <div className="flex items-center gap-2 mb-2">
                <span className={`text-xs font-bold ${STATUS_CONFIG[status].color}`}>{STATUS_CONFIG[status].label}</span>
                <span className="text-[10px] text-muted">({filtered.filter(i => i.status === status).length})</span>
              </div>
              <div className="space-y-2">
                {filtered.filter(i => i.status === status).map(item => (
                  <div key={item.id} draggable onDragStart={() => setDraggedItem(item.id)}
                    className="card p-3 cursor-move hover:border-gold/10 transition-all">
                    <div className="flex items-center justify-between mb-1">
                      <span className={`text-[8px] px-1.5 py-0.5 rounded-full ${PRIORITY_CONFIG[item.priority].bg} ${PRIORITY_CONFIG[item.priority].color}`}>
                        {PRIORITY_CONFIG[item.priority].label}
                      </span>
                      <span className="text-[9px] text-muted">{item.type}</span>
                    </div>
                    <p className="text-xs font-semibold mb-0.5">{item.title}</p>
                    <p className="text-[10px] text-muted mb-2">{item.client}</p>
                    {/* Checklist progress */}
                    <div className="mb-2">
                      <div className="flex items-center justify-between text-[9px] text-muted mb-0.5">
                        <span>{item.checklist.filter(c => c.done).length}/{item.checklist.length} tasks</span>
                        <span>{item.actualHours}h / {item.estimatedHours}h</span>
                      </div>
                      <div className="h-1 rounded-full bg-surface-light overflow-hidden">
                        <div className="h-full rounded-full bg-gold" style={{ width: `${(item.checklist.filter(c => c.done).length / item.checklist.length) * 100}%` }} />
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1">
                        <div className="w-5 h-5 rounded-full bg-gold/10 flex items-center justify-center text-[8px] font-bold text-gold">{item.assignee[0]}</div>
                        <span className="text-[9px] text-muted">{item.assignee}</span>
                      </div>
                      <span className={`text-[9px] ${item.dueDate < "2026-04-14" && item.status !== "delivered" ? "text-red-400" : "text-muted"}`}>
                        {item.dueDate.slice(5)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Calendar Tab */}
      {tab === "calendar" && (
        <div className="space-y-4">
          <div className="card">
            <h2 className="section-header flex items-center gap-2"><Calendar size={13} className="text-gold" /> Production Calendar</h2>
            <div className="space-y-2">
              {Array.from(new Set(items.map(i => i.dueDate))).sort().map(date => {
                const dayItems = filtered.filter(i => i.dueDate === date);
                const isOverdue = date < "2026-04-14";
                return (
                  <div key={date} className="p-3 rounded-lg bg-surface-light border border-border">
                    <div className="flex items-center gap-2 mb-2">
                      <Calendar size={12} className={isOverdue ? "text-red-400" : "text-gold"} />
                      <span className={`text-xs font-bold ${isOverdue ? "text-red-400" : ""}`}>
                        {new Date(date).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}
                        {isOverdue && " (OVERDUE)"}
                      </span>
                    </div>
                    <div className="space-y-1 ml-5">
                      {dayItems.map(item => (
                        <div key={item.id} className="flex items-center gap-2 text-[11px]">
                          <span className={`${PRIORITY_CONFIG[item.priority].color}`}><Flag size={10} /></span>
                          <span className="font-medium">{item.title}</span>
                          <span className="text-muted">- {item.client}</span>
                          <span className={`text-[9px] ml-auto ${STATUS_CONFIG[item.status].color}`}>{STATUS_CONFIG[item.status].label}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
          {/* Time Estimates vs Actuals */}
          <div className="card">
            <h2 className="section-header flex items-center gap-2"><Clock size={13} className="text-blue-400" /> Time: Estimated vs Actual</h2>
            <div className="space-y-2">
              {items.filter(i => i.actualHours > 0).map(item => {
                const pctEst = (item.estimatedHours / Math.max(totalEstimated, 1)) * 100;
                const pctAct = (item.actualHours / Math.max(totalEstimated, 1)) * 100;
                const overBudget = item.actualHours > item.estimatedHours;
                return (
                  <div key={item.id} className="p-2 rounded-lg bg-surface-light">
                    <div className="flex items-center justify-between text-[10px] mb-1">
                      <span className="font-medium">{item.title}</span>
                      <span className={overBudget ? "text-red-400" : "text-emerald-400"}>
                        {item.actualHours}h / {item.estimatedHours}h
                      </span>
                    </div>
                    <div className="flex gap-1">
                      <div className="flex-1 h-1.5 rounded-full bg-surface overflow-hidden">
                        <div className="h-full rounded-full bg-blue-400/50" style={{ width: `${pctEst * 3}%` }} />
                      </div>
                      <div className="flex-1 h-1.5 rounded-full bg-surface overflow-hidden">
                        <div className="h-full rounded-full" style={{ width: `${pctAct * 3}%`, background: overBudget ? "#ef4444" : "#10b981" }} />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
          {/* Bottleneck Identifier */}
          <div className="card">
            <h2 className="section-header flex items-center gap-2"><AlertTriangle size={13} className="text-yellow-400" /> Bottleneck Analysis</h2>
            <div className="space-y-2">
              {bottlenecks.map(([status, count]) => (
                <div key={status} className="flex items-center gap-3 p-2.5 rounded-lg bg-surface-light border border-border">
                  <AlertTriangle size={14} className="text-yellow-400" />
                  <div className="flex-1">
                    <p className="text-xs font-semibold">{STATUS_CONFIG[status as KanbanStatus]?.label || status}</p>
                    <p className="text-[10px] text-muted">{count} items stuck in this stage</p>
                  </div>
                  <span className={`text-sm font-bold ${count > 2 ? "text-red-400" : "text-yellow-400"}`}>{count}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Standup Tab */}
      {tab === "standup" && (
        <div className="space-y-4">
          <div className="card">
            <h2 className="section-header flex items-center gap-2"><MessageSquare size={13} className="text-gold" /> Daily Standup Summary</h2>
            <p className="text-[10px] text-muted mb-3">Tuesday, April 14, 2026</p>
            <div className="space-y-3">
              {["James", "Sarah", "Maria", "Alex"].map(name => {
                const memberItems = items.filter(i => i.assignee === name);
                const inProg = memberItems.filter(i => i.status === "in_progress");
                const review = memberItems.filter(i => i.status === "review");
                return (
                  <div key={name} className="p-3 rounded-lg bg-surface-light border border-border">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-7 h-7 rounded-full bg-gold/10 flex items-center justify-center text-[10px] font-bold text-gold">{name[0]}</div>
                      <span className="text-xs font-bold">{name}</span>
                      <span className="text-[9px] text-muted ml-auto">{memberItems.length} items</span>
                    </div>
                    {inProg.length > 0 && (
                      <div className="mb-1">
                        <p className="text-[9px] text-blue-400 font-semibold mb-0.5">Working On:</p>
                        {inProg.map(i => (
                          <p key={i.id} className="text-[10px] text-muted ml-3">- {i.title} ({i.client})</p>
                        ))}
                      </div>
                    )}
                    {review.length > 0 && (
                      <div>
                        <p className="text-[9px] text-purple-400 font-semibold mb-0.5">Awaiting Review:</p>
                        {review.map(i => (
                          <p key={i.id} className="text-[10px] text-muted ml-3">- {i.title} ({i.client})</p>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Approvals Tab */}
      {tab === "approvals" && (
        <div className="space-y-4">
          <div className="card">
            <h2 className="section-header flex items-center gap-2"><CheckCircle size={13} className="text-gold" /> Review & Approval Queue</h2>
            <div className="space-y-2">
              {items.filter(i => i.status === "review").map(item => (
                <div key={item.id} className="p-4 rounded-lg bg-surface-light border border-border">
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <p className="text-xs font-bold">{item.title}</p>
                      <p className="text-[10px] text-muted">{item.client} - by {item.assignee}</p>
                    </div>
                    <span className={`text-[9px] px-2 py-0.5 rounded-full ${PRIORITY_CONFIG[item.priority].bg} ${PRIORITY_CONFIG[item.priority].color}`}>
                      {PRIORITY_CONFIG[item.priority].label}
                    </span>
                  </div>
                  {/* Asset Checklist */}
                  <div className="mb-3">
                    <p className="text-[9px] text-muted uppercase tracking-wider font-semibold mb-1">Asset Checklist</p>
                    <div className="grid grid-cols-2 gap-1">
                      {item.checklist.map((task, idx) => (
                        <button key={idx} onClick={() => toggleChecklist(item.id, idx)}
                          className="flex items-center gap-1.5 text-[10px] p-1 rounded hover:bg-white/[0.02]">
                          <CheckCircle size={10} className={task.done ? "text-emerald-400" : "text-muted/30"} />
                          <span className={task.done ? "line-through text-muted" : ""}>{task.task}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                  {item.reviewNotes && (
                    <div className="p-2 rounded-lg bg-yellow-400/5 border border-yellow-400/10 mb-3">
                      <p className="text-[9px] text-yellow-400 font-semibold mb-0.5">Review Notes:</p>
                      <p className="text-[10px] text-muted">{item.reviewNotes}</p>
                    </div>
                  )}
                  <div className="flex gap-2">
                    <button onClick={() => setItems(prev => prev.map(i => i.id === item.id ? { ...i, status: "approved" } : i))}
                      className="btn-primary text-[10px] flex items-center gap-1">
                      <CheckCircle size={10} /> Approve
                    </button>
                    <button onClick={() => setItems(prev => prev.map(i => i.id === item.id ? { ...i, status: "in_progress" } : i))}
                      className="btn-secondary text-[10px] flex items-center gap-1">
                      <ArrowRight size={10} /> Request Changes
                    </button>
                  </div>
                </div>
              ))}
              {items.filter(i => i.status === "review").length === 0 && (
                <div className="text-center py-8">
                  <CheckCircle size={24} className="mx-auto text-emerald-400/30 mb-2" />
                  <p className="text-xs text-muted">No items pending review</p>
                </div>
              )}
            </div>
          </div>
          {/* Client Approval Portal */}
          <div className="card">
            <h2 className="section-header flex items-center gap-2"><Eye size={13} className="text-blue-400" /> Client Approval Portal</h2>
            <p className="text-[10px] text-muted mb-3">Share approval links with clients for direct feedback</p>
            <div className="space-y-2">
              {items.filter(i => i.status === "approved" || i.status === "review").map(item => (
                <div key={item.id} className="flex items-center gap-3 p-2.5 rounded-lg bg-surface-light border border-border">
                  <Film size={14} className="text-gold shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium truncate">{item.title}</p>
                    <p className="text-[9px] text-muted">{item.client}</p>
                  </div>
                  <button className="btn-secondary text-[9px] flex items-center gap-1">
                    <Copy size={9} /> Copy Approval Link
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* New Request Modal */}
      {showSubmit && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => setShowSubmit(false)}>
          <div className="bg-surface rounded-2xl border border-border w-full max-w-md p-5 space-y-3" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold flex items-center gap-2"><Plus size={14} className="text-gold" /> New Production Request</h3>
              <button onClick={() => setShowSubmit(false)} className="text-muted hover:text-foreground"><X size={16} /></button>
            </div>
            <div>
              <label className="block text-[9px] text-muted uppercase tracking-wider mb-1">Title</label>
              <input className="input w-full text-xs" placeholder="e.g., Instagram Reels x3" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[9px] text-muted uppercase tracking-wider mb-1">Client</label>
                <select className="input w-full text-xs">
                  {clients.filter(c => c !== "All").map(c => <option key={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-[9px] text-muted uppercase tracking-wider mb-1">Type</label>
                <select className="input w-full text-xs">
                  <option>Short Form</option><option>Long Form</option><option>Ad Creative</option>
                  <option>Blog</option><option>Email</option><option>Web</option><option>Podcast</option>
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[9px] text-muted uppercase tracking-wider mb-1">Priority</label>
                <select className="input w-full text-xs">
                  <option value="low">Low</option><option value="medium">Medium</option>
                  <option value="high">High</option><option value="urgent">Urgent</option>
                </select>
              </div>
              <div>
                <label className="block text-[9px] text-muted uppercase tracking-wider mb-1">Due Date</label>
                <input type="date" className="input w-full text-xs" />
              </div>
            </div>
            <div>
              <label className="block text-[9px] text-muted uppercase tracking-wider mb-1">Assign To</label>
              <select className="input w-full text-xs">
                <option>James</option><option>Sarah</option><option>Maria</option><option>Alex</option>
              </select>
            </div>
            <div>
              <label className="block text-[9px] text-muted uppercase tracking-wider mb-1">Estimated Hours</label>
              <input type="number" className="input w-full text-xs" placeholder="e.g., 6" />
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <button onClick={() => setShowSubmit(false)} className="btn-secondary text-xs">Cancel</button>
              <button onClick={() => setShowSubmit(false)} className="btn-primary text-xs flex items-center gap-1.5">
                <Plus size={12} /> Create
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Copy({ size, className }: { size: number; className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>
    </svg>
  );
}
