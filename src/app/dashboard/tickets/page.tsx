"use client";

import { useState } from "react";
import {
  Ticket, Plus,
  MessageSquare, User, Timer, Star, Search,
  ChevronDown, ChevronRight, Send,
  BarChart3
} from "lucide-react";
import EmptyState from "@/components/empty-state";
import PageHero from "@/components/ui/page-hero";
import { LifeBuoy } from "lucide-react";

type Priority = "urgent" | "high" | "medium" | "low";
type Status = "open" | "in_progress" | "resolved" | "closed";

interface TicketItem {
  id: string;
  subject: string;
  description: string;
  client: string;
  priority: Priority;
  status: Status;
  assignee: string;
  category: string;
  created: string;
  updated: string;
  slaDeadline: string;
  notes: string[];
  satisfaction: number | null;
}

const MOCK_TICKETS: TicketItem[] = [];

const CANNED_RESPONSES: { label: string; text: string }[] = [];

const CATEGORIES = ["All", "Technical", "Content", "Billing", "Setup", "Lead Gen", "Design", "AI Agent"];
const STATUSES: Status[] = ["open", "in_progress", "resolved", "closed"];
const PRIORITIES: Priority[] = ["urgent", "high", "medium", "low"];
const TEAM = ["Alex", "Maria", "Jordan", "Unassigned"];
const TABS = ["Board", "List", "Create", "Analytics", "Canned Responses"] as const;
type Tab = typeof TABS[number];

const priorityColor: Record<Priority, string> = {
  urgent: "bg-red-500/10 text-red-400 border-red-500/20",
  high: "bg-orange-500/10 text-orange-400 border-orange-500/20",
  medium: "bg-gold/10 text-gold border-gold/20",
  low: "bg-blue-500/10 text-blue-400 border-blue-500/20",
};

const statusColor: Record<Status, string> = {
  open: "bg-amber-500/10 text-amber-400",
  in_progress: "bg-blue-500/10 text-blue-400",
  resolved: "bg-emerald-500/10 text-emerald-400",
  closed: "bg-muted/10 text-muted",
};

export default function TicketsPage() {
  const [tab, setTab] = useState<Tab>("Board");
  const [tickets, setTickets] = useState<TicketItem[]>(MOCK_TICKETS);
  const [filterStatus, setFilterStatus] = useState<Status | "all">("all");
  const [filterCategory, setFilterCategory] = useState("All");
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedTicket, setExpandedTicket] = useState<string | null>(null);
  const [newNote, setNewNote] = useState("");
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [createForm, setCreateForm] = useState({ subject: "", description: "", client: "", priority: "medium" as Priority, category: "Technical", assignee: "Unassigned" });
  const [selectedTickets, setSelectedTickets] = useState<string[]>([]);

  const filtered = tickets.filter(t => {
    if (filterStatus !== "all" && t.status !== filterStatus) return false;
    if (filterCategory !== "All" && t.category !== filterCategory) return false;
    if (searchQuery && !t.subject.toLowerCase().includes(searchQuery.toLowerCase()) && !t.client.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  });

  function updateStatus(id: string, status: Status) {
    setTickets(prev => prev.map(t => t.id === id ? { ...t, status, updated: "Just now" } : t));
  }

  function addNote(id: string) {
    if (!newNote.trim()) return;
    setTickets(prev => prev.map(t => t.id === id ? { ...t, notes: [...t.notes, newNote], updated: "Just now" } : t));
    setNewNote("");
  }

  function createTicket() {
    const ticket: TicketItem = {
      id: `TK-${String(tickets.length + 1).padStart(3, "0")}`,
      subject: createForm.subject,
      description: createForm.description,
      client: createForm.client,
      priority: createForm.priority,
      status: "open",
      assignee: createForm.assignee,
      category: createForm.category,
      created: "Just now",
      updated: "Just now",
      slaDeadline: createForm.priority === "urgent" ? "4h" : createForm.priority === "high" ? "8h" : "24h",
      notes: [],
      satisfaction: null,
    };
    setTickets(prev => [ticket, ...prev]);
    setCreateForm({ subject: "", description: "", client: "", priority: "medium", category: "Technical", assignee: "Unassigned" });
    setTab("List");
  }

  function bulkUpdateStatus(status: Status) {
    setTickets(prev => prev.map(t => selectedTickets.includes(t.id) ? { ...t, status, updated: "Just now" } : t));
    setSelectedTickets([]);
  }

  function toggleSelect(id: string) {
    setSelectedTickets(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  }

  const stats = {
    open: tickets.filter(t => t.status === "open").length,
    inProgress: tickets.filter(t => t.status === "in_progress").length,
    resolved: tickets.filter(t => t.status === "resolved").length,
    closed: tickets.filter(t => t.status === "closed").length,
    urgent: tickets.filter(t => t.priority === "urgent" && t.status !== "closed").length,
    avgSatisfaction: tickets.filter(t => t.satisfaction).length > 0
      ? (tickets.filter(t => t.satisfaction).reduce((s, t) => s + (t.satisfaction || 0), 0) / tickets.filter(t => t.satisfaction).length).toFixed(1) : "N/A",
  };

  return (
    <div className="fade-in space-y-5">
      <PageHero
        icon={<LifeBuoy size={28} />}
        title="Support Tickets"
        subtitle={`${tickets.length} total · ${stats.open} open · ${stats.urgent} urgent`}
        gradient="blue"
        actions={
          <button onClick={() => setTab("Create")} className="px-3 py-1.5 rounded-lg bg-white/15 border border-white/25 text-white text-xs font-semibold hover:bg-white/25 transition-all flex items-center gap-1.5">
            <Plus size={12} /> New Ticket
          </button>
        }
      />

      {/* Stats Strip */}
      <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
        <div className="card p-2.5 text-center">
          <p className="text-[9px] text-muted uppercase">Open</p>
          <p className="text-lg font-bold text-amber-400">{stats.open}</p>
        </div>
        <div className="card p-2.5 text-center">
          <p className="text-[9px] text-muted uppercase">In Progress</p>
          <p className="text-lg font-bold text-blue-400">{stats.inProgress}</p>
        </div>
        <div className="card p-2.5 text-center">
          <p className="text-[9px] text-muted uppercase">Resolved</p>
          <p className="text-lg font-bold text-emerald-400">{stats.resolved}</p>
        </div>
        <div className="card p-2.5 text-center">
          <p className="text-[9px] text-muted uppercase">Closed</p>
          <p className="text-lg font-bold text-muted">{stats.closed}</p>
        </div>
        <div className="card p-2.5 text-center">
          <p className="text-[9px] text-muted uppercase">Urgent</p>
          <p className={`text-lg font-bold ${stats.urgent > 0 ? "text-red-400" : "text-emerald-400"}`}>{stats.urgent}</p>
        </div>
        <div className="card p-2.5 text-center">
          <p className="text-[9px] text-muted uppercase">CSAT</p>
          <p className="text-lg font-bold text-gold">{stats.avgSatisfaction}<span className="text-[10px] text-muted">/5</span></p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1">
        {TABS.map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-3 py-1.5 rounded-lg text-[10px] font-medium transition-all ${
              tab === t ? "bg-gold/15 text-gold border border-gold/20" : "text-muted border border-transparent hover:text-foreground"
            }`}>{t}</button>
        ))}
      </div>

      {/* ═══ BOARD VIEW ═══ */}
      {tab === "Board" && (
        <div className="grid grid-cols-4 gap-3">
          {STATUSES.map(status => (
            <div key={status} className="space-y-2">
              <div className={`px-3 py-1.5 rounded-lg text-[10px] font-semibold capitalize ${statusColor[status]}`}>
                {status.replace("_", " ")} ({tickets.filter(t => t.status === status).length})
              </div>
              {tickets.filter(t => t.status === status).length === 0 ? (
                <p className="text-[10px] text-muted text-center py-4">No tickets</p>
              ) : tickets.filter(t => t.status === status).map(ticket => (
                <div key={ticket.id} onClick={() => { setExpandedTicket(expandedTicket === ticket.id ? null : ticket.id); setTab("List"); }}
                  className="card p-3 cursor-pointer hover:border-gold/15 transition-all">
                  <div className="flex items-center gap-1.5 mb-1">
                    <span className={`text-[8px] px-1.5 py-0.5 rounded-full border font-bold uppercase ${priorityColor[ticket.priority]}`}>{ticket.priority}</span>
                    <span className="text-[8px] text-muted">{ticket.id}</span>
                  </div>
                  <p className="text-[11px] font-semibold mb-1">{ticket.subject}</p>
                  <div className="flex items-center justify-between text-[9px] text-muted">
                    <span>{ticket.client}</span>
                    <span>{ticket.assignee}</span>
                  </div>
                  {ticket.priority === "urgent" && (
                    <div className="flex items-center gap-1 mt-1.5 text-[9px] text-red-400">
                      <Timer size={9} /> SLA: {ticket.slaDeadline}
                    </div>
                  )}
                </div>
              ))}
            </div>
          ))}
        </div>
      )}

      {/* ═══ LIST VIEW ═══ */}
      {tab === "List" && (
        <div className="space-y-3">
          {/* Filters */}
          <div className="flex items-center gap-2 flex-wrap">
            <div className="relative flex-1 max-w-xs">
              <Search size={11} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted" />
              <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search tickets..." className="input w-full pl-8 text-xs" />
            </div>
            <div className="flex gap-1">
              {(["all", ...STATUSES] as const).map(s => (
                <button key={s} onClick={() => setFilterStatus(s as Status | "all")}
                  className={`text-[9px] px-2 py-1 rounded capitalize ${filterStatus === s ? "bg-gold/15 text-gold" : "text-muted"}`}>{s === "all" ? "All" : s.replace("_", " ")}</button>
              ))}
            </div>
            <div className="flex gap-1">
              {CATEGORIES.slice(0, 5).map(c => (
                <button key={c} onClick={() => setFilterCategory(c)}
                  className={`text-[9px] px-2 py-1 rounded ${filterCategory === c ? "bg-gold/15 text-gold" : "text-muted"}`}>{c}</button>
              ))}
            </div>
          </div>

          {/* Bulk Actions */}
          {selectedTickets.length > 0 && (
            <div className="flex items-center gap-2 p-2 rounded-lg bg-gold/5 border border-gold/15 text-[10px]">
              <span className="text-gold font-medium">{selectedTickets.length} selected</span>
              <button onClick={() => bulkUpdateStatus("resolved")} className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400">Mark Resolved</button>
              <button onClick={() => bulkUpdateStatus("closed")} className="px-2 py-0.5 rounded bg-muted/10 text-muted">Close</button>
              <button onClick={() => setSelectedTickets([])} className="ml-auto text-muted">Clear</button>
            </div>
          )}

          {/* Ticket List */}
          {filtered.length === 0 && (
            <EmptyState
              icon={<Ticket size={24} />}
              title="No Tickets Yet"
              description="Create your first support ticket to track client issues, assign team members, and measure resolution times."
              actionLabel="Create Ticket"
              onAction={() => setTab("Create")}
            />
          )}
          {filtered.map(ticket => (
            <div key={ticket.id} className={`rounded-xl border transition-all ${ticket.priority === "urgent" ? "border-red-500/15" : "border-border"} bg-surface-light`}>
              <div className="flex items-start gap-3 p-4 cursor-pointer" onClick={() => setExpandedTicket(expandedTicket === ticket.id ? null : ticket.id)}>
                <input type="checkbox" checked={selectedTickets.includes(ticket.id)}
                  onChange={() => toggleSelect(ticket.id)} onClick={e => e.stopPropagation()}
                  className="mt-1 accent-gold" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`text-[8px] px-1.5 py-0.5 rounded-full border font-bold uppercase ${priorityColor[ticket.priority]}`}>{ticket.priority}</span>
                    <span className="text-[9px] text-muted font-mono">{ticket.id}</span>
                    <span className={`text-[9px] px-1.5 py-0.5 rounded-full capitalize ${statusColor[ticket.status]}`}>{ticket.status.replace("_", " ")}</span>
                    <span className="text-[9px] bg-surface px-1.5 py-0.5 rounded text-muted">{ticket.category}</span>
                  </div>
                  <p className="text-xs font-semibold">{ticket.subject}</p>
                  <div className="flex items-center gap-3 mt-1 text-[9px] text-muted">
                    <span className="flex items-center gap-1"><User size={9} /> {ticket.client}</span>
                    <span>Assigned: {ticket.assignee}</span>
                    <span>{ticket.created}</span>
                    {ticket.slaDeadline && ticket.status === "open" && (
                      <span className={`flex items-center gap-0.5 ${ticket.priority === "urgent" ? "text-red-400" : ""}`}>
                        <Timer size={9} /> SLA: {ticket.slaDeadline}
                      </span>
                    )}
                  </div>
                </div>
                {expandedTicket === ticket.id ? <ChevronDown size={14} className="text-muted" /> : <ChevronRight size={14} className="text-muted" />}
              </div>

              {expandedTicket === ticket.id && (
                <div className="px-4 pb-4 pt-0 border-t border-border space-y-3">
                  <p className="text-[11px] text-muted">{ticket.description}</p>

                  {/* Status Workflow */}
                  <div className="flex items-center gap-1">
                    <span className="text-[9px] text-muted mr-1">Move to:</span>
                    {STATUSES.filter(s => s !== ticket.status).map(s => (
                      <button key={s} onClick={() => updateStatus(ticket.id, s)}
                        className={`text-[9px] px-2 py-0.5 rounded capitalize border ${statusColor[s]} border-border`}>{s.replace("_", " ")}</button>
                    ))}
                  </div>

                  {/* Internal Notes */}
                  <div>
                    <p className="text-[9px] text-muted uppercase tracking-wider font-semibold mb-1.5">Internal Notes ({ticket.notes.length})</p>
                    {ticket.notes.length > 0 && (
                      <div className="space-y-1 mb-2">
                        {ticket.notes.map((n, i) => (
                          <div key={i} className="text-[10px] p-2 rounded-lg bg-surface border border-border flex items-start gap-2">
                            <MessageSquare size={9} className="text-muted mt-0.5 shrink-0" />
                            <span>{n}</span>
                          </div>
                        ))}
                      </div>
                    )}
                    <div className="flex gap-2">
                      <input value={newNote} onChange={e => setNewNote(e.target.value)}
                        placeholder="Add internal note..." className="input flex-1 text-[10px]"
                        onKeyDown={e => e.key === "Enter" && addNote(ticket.id)} />
                      <button onClick={() => addNote(ticket.id)} className="btn-secondary text-[10px] px-2"><Send size={10} /></button>
                    </div>
                  </div>

                  {/* Satisfaction */}
                  {ticket.satisfaction !== null && (
                    <div className="flex items-center gap-2">
                      <span className="text-[9px] text-muted">Customer Rating:</span>
                      <div className="flex gap-0.5">
                        {[1, 2, 3, 4, 5].map(s => (
                          <Star key={s} size={12} className={s <= (ticket.satisfaction || 0) ? "text-gold fill-gold" : "text-muted"} />
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* ═══ CREATE TAB ═══ */}
      {tab === "Create" && (
        <div className="card">
          <h2 className="text-sm font-bold flex items-center gap-2 mb-3">
            <Plus size={14} className="text-gold" /> Create Ticket
          </h2>
          <div className="space-y-3">
            <div>
              <label className="text-[9px] text-muted uppercase mb-1 block">Subject</label>
              <input value={createForm.subject} onChange={e => setCreateForm({ ...createForm, subject: e.target.value })}
                className="input w-full text-xs" placeholder="Brief description of the issue" />
            </div>
            <div>
              <label className="text-[9px] text-muted uppercase mb-1 block">Description</label>
              <textarea value={createForm.description} onChange={e => setCreateForm({ ...createForm, description: e.target.value })}
                className="input w-full text-xs h-24 resize-none" placeholder="Detailed description..." />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[9px] text-muted uppercase mb-1 block">Client</label>
                <input value={createForm.client} onChange={e => setCreateForm({ ...createForm, client: e.target.value })}
                  className="input w-full text-xs" placeholder="Client name" />
              </div>
              <div>
                <label className="text-[9px] text-muted uppercase mb-1 block">Priority</label>
                <select value={createForm.priority} onChange={e => setCreateForm({ ...createForm, priority: e.target.value as Priority })}
                  className="input w-full text-xs">
                  {PRIORITIES.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
              <div>
                <label className="text-[9px] text-muted uppercase mb-1 block">Category</label>
                <select value={createForm.category} onChange={e => setCreateForm({ ...createForm, category: e.target.value })}
                  className="input w-full text-xs">
                  {CATEGORIES.filter(c => c !== "All").map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="text-[9px] text-muted uppercase mb-1 block">Assign To</label>
                <select value={createForm.assignee} onChange={e => setCreateForm({ ...createForm, assignee: e.target.value })}
                  className="input w-full text-xs">
                  {TEAM.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
            </div>
            <button onClick={createTicket} disabled={!createForm.subject || !createForm.client}
              className="btn-primary text-xs flex items-center gap-1.5 disabled:opacity-40">
              <Plus size={12} /> Create Ticket
            </button>
          </div>
        </div>
      )}

      {/* ═══ ANALYTICS TAB ═══ */}
      {tab === "Analytics" && (
        <div className="space-y-4">
          <div className="card">
            <h2 className="text-sm font-bold flex items-center gap-2 mb-3">
              <BarChart3 size={14} className="text-gold" /> Ticket Analytics
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="bg-surface-light rounded-xl p-3 text-center">
                <p className="text-xl font-bold text-gold">{tickets.length}</p>
                <p className="text-[9px] text-muted">Total Tickets</p>
              </div>
              <div className="bg-surface-light rounded-xl p-3 text-center">
                <p className="text-xl font-bold text-emerald-400">
                  {tickets.filter(t => t.status === "resolved" || t.status === "closed").length}
                </p>
                <p className="text-[9px] text-muted">Resolved</p>
              </div>
              <div className="bg-surface-light rounded-xl p-3 text-center">
                <p className="text-xl font-bold text-blue-400">--</p>
                <p className="text-[9px] text-muted">Avg Resolution Time</p>
              </div>
              <div className="bg-surface-light rounded-xl p-3 text-center">
                <p className="text-xl font-bold text-gold">{stats.avgSatisfaction}/5</p>
                <p className="text-[9px] text-muted">Satisfaction</p>
              </div>
            </div>
          </div>
          <div className="card">
            <h3 className="text-xs font-bold mb-3">Tickets by Category</h3>
            <div className="space-y-2">
              {CATEGORIES.filter(c => c !== "All").map(cat => {
                const count = tickets.filter(t => t.category === cat).length;
                const pct = tickets.length > 0 ? (count / tickets.length) * 100 : 0;
                return (
                  <div key={cat} className="flex items-center gap-3">
                    <span className="text-[10px] w-20 shrink-0">{cat}</span>
                    <div className="flex-1 h-2 rounded-full bg-surface-light">
                      <div className="h-2 rounded-full bg-gold transition-all" style={{ width: `${pct}%` }} />
                    </div>
                    <span className="text-[10px] font-mono text-muted w-6 text-right">{count}</span>
                  </div>
                );
              })}
            </div>
          </div>
          <div className="card">
            <h3 className="text-xs font-bold mb-3">Team Workload</h3>
            <div className="grid grid-cols-3 gap-3">
              {TEAM.filter(t => t !== "Unassigned").map(member => {
                const assigned = tickets.filter(t => t.assignee === member);
                return (
                  <div key={member} className="bg-surface-light rounded-xl p-3 text-center">
                    <p className="text-xs font-semibold">{member}</p>
                    <p className="text-lg font-bold text-gold">{assigned.length}</p>
                    <p className="text-[9px] text-muted">{assigned.filter(t => t.status === "open").length} open</p>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ═══ CANNED RESPONSES TAB ═══ */}
      {tab === "Canned Responses" && (
        <div className="space-y-3">
          <h2 className="text-sm font-bold flex items-center gap-2">
            <MessageSquare size={14} className="text-gold" /> Canned Responses
          </h2>
          <p className="text-[10px] text-muted">Quick-reply templates for common ticket scenarios.</p>
          {CANNED_RESPONSES.length === 0 && (
            <div className="card text-center py-8">
              <MessageSquare size={20} className="mx-auto mb-2 text-muted/30" />
              <p className="text-xs text-muted">No canned responses yet</p>
            </div>
          )}
          {CANNED_RESPONSES.map((r, i) => (
            <div key={i} className="card p-3 hover:border-gold/15 transition-all">
              <div className="flex items-center justify-between mb-1.5">
                <p className="text-xs font-semibold">{r.label}</p>
                <button onClick={() => navigator.clipboard.writeText(r.text)} className="text-[9px] text-gold flex items-center gap-1 hover:underline">
                  Copy
                </button>
              </div>
              <p className="text-[10px] text-muted">{r.text}</p>
            </div>
          ))}
          <button className="text-xs text-gold flex items-center gap-1 hover:underline"><Plus size={12} /> Add Response</button>
        </div>
      )}
    </div>
  );
}
