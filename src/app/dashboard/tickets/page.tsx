"use client";

/**
 * Tickets — shared inbox / support desk.
 *
 * MVP ship: no backend yet. Tickets are stored in localStorage so the
 * page feels alive (open / comment / close). Next pass will wire to a
 * real `tickets` + `ticket_messages` schema with email intake; the beta
 * banner makes that clear.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  LifeBuoy,
  Plus,
  Trash2,
  ArrowLeft,
  Clock,
  CheckCircle2,
  Loader,
  AlertTriangle,
  Inbox,
  User,
} from "lucide-react";
import toast from "react-hot-toast";
import { useAuth } from "@/lib/auth-context";
import PageHero from "@/components/ui/page-hero";
import EmptyState from "@/components/ui/empty-state";

interface Ticket {
  id: string;
  subject: string;
  requester: string;
  requester_email: string;
  body: string;
  priority: "low" | "normal" | "high" | "urgent";
  status: "open" | "in_progress" | "resolved";
  created_at: string;
  updated_at: string;
}

const STORAGE_KEY = "ss_tickets_v1";

const STATUS_STYLES: Record<Ticket["status"], { label: string; tint: string }> = {
  open: { label: "Open", tint: "bg-amber-500/15 text-amber-300" },
  in_progress: { label: "In progress", tint: "bg-sky-500/15 text-sky-300" },
  resolved: { label: "Resolved", tint: "bg-emerald-500/15 text-emerald-300" },
};

const PRIORITY_STYLES: Record<Ticket["priority"], { label: string; tint: string }> = {
  low: { label: "Low", tint: "bg-muted/20 text-muted" },
  normal: { label: "Normal", tint: "bg-slate-500/15 text-slate-300" },
  high: { label: "High", tint: "bg-orange-500/15 text-orange-300" },
  urgent: { label: "Urgent", tint: "bg-rose-500/15 text-rose-300" },
};

export default function TicketsPage() {
  useAuth();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);
  const [filter, setFilter] = useState<"all" | Ticket["status"]>("all");

  const load = useCallback(() => {
    try {
      const raw = typeof window !== "undefined" ? localStorage.getItem(STORAGE_KEY) : null;
      setTickets(raw ? (JSON.parse(raw) as Ticket[]) : []);
    } catch {
      setTickets([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const persist = (next: Ticket[]) => {
    setTickets(next);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      /* quota — ignore */
    }
  };

  function remove(id: string) {
    if (!window.confirm("Delete this ticket? History will be lost.")) return;
    persist(tickets.filter((t) => t.id !== id));
    toast.success("Ticket deleted");
  }

  function advance(id: string) {
    const now = new Date().toISOString();
    persist(
      tickets.map((t) => {
        if (t.id !== id) return t;
        const next: Ticket["status"] =
          t.status === "open"
            ? "in_progress"
            : t.status === "in_progress"
              ? "resolved"
              : "resolved";
        return { ...t, status: next, updated_at: now };
      }),
    );
    toast.success("Ticket advanced");
  }

  const filtered = useMemo(() => {
    const base = filter === "all" ? tickets : tickets.filter((t) => t.status === filter);
    // Urgent and high bubble up; then by recency.
    const priorityOrder: Record<Ticket["priority"], number> = {
      urgent: 0,
      high: 1,
      normal: 2,
      low: 3,
    };
    return [...base].sort((a, b) => {
      if (priorityOrder[a.priority] !== priorityOrder[b.priority]) {
        return priorityOrder[a.priority] - priorityOrder[b.priority];
      }
      return b.updated_at.localeCompare(a.updated_at);
    });
  }, [tickets, filter]);

  const stats = useMemo(() => {
    const open = tickets.filter((t) => t.status === "open").length;
    const inProg = tickets.filter((t) => t.status === "in_progress").length;
    const resolved = tickets.filter((t) => t.status === "resolved").length;
    const urgent = tickets.filter(
      (t) => t.priority === "urgent" && t.status !== "resolved",
    ).length;
    return { open, inProg, resolved, urgent };
  }, [tickets]);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <PageHero
        title="Support Tickets"
        subtitle="Shared inbox for client support — open, triage, resolve. SLA timers and email intake coming next."
        icon={<LifeBuoy size={20} />}
        gradient="blue"
      />

      <div className="mx-auto max-w-5xl space-y-5 px-6 pb-10 pt-5">
        {/* Beta banner */}
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 px-4 py-3 text-[12px] text-amber-200">
          <span className="font-semibold">Beta:</span> tickets are stored locally on this
          device. Email intake, SLA timers, and team assignment land next sprint.
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="card">
            <p className="text-[10px] uppercase tracking-wider text-muted">Open</p>
            <p className="mt-1 text-2xl font-bold text-amber-300">{stats.open}</p>
          </div>
          <div className="card">
            <p className="text-[10px] uppercase tracking-wider text-muted">In progress</p>
            <p className="mt-1 text-2xl font-bold text-sky-300">{stats.inProg}</p>
          </div>
          <div className="card">
            <p className="text-[10px] uppercase tracking-wider text-muted">Resolved</p>
            <p className="mt-1 text-2xl font-bold text-emerald-300">{stats.resolved}</p>
          </div>
          <div className="card">
            <p className="text-[10px] uppercase tracking-wider text-muted">Urgent</p>
            <p className="mt-1 text-2xl font-bold text-rose-300">{stats.urgent}</p>
          </div>
        </div>

        {/* Toolbar */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex gap-1">
            {(["all", "open", "in_progress", "resolved"] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                  filter === f
                    ? "bg-gold/20 text-gold"
                    : "bg-surface-light/40 text-muted hover:text-foreground"
                }`}
              >
                {f === "all" ? "All" : f === "in_progress" ? "In progress" : f.charAt(0).toUpperCase() + f.slice(1)}
              </button>
            ))}
          </div>
          <button
            onClick={() => setShowNew(true)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-gold px-4 py-2 text-sm font-semibold text-black transition hover:bg-gold/90"
          >
            <Plus size={14} /> New ticket
          </button>
        </div>

        {/* Create form */}
        {showNew && (
          <NewTicketForm
            onClose={() => setShowNew(false)}
            onCreated={(t) => {
              persist([t, ...tickets]);
              setShowNew(false);
              toast.success("Ticket opened");
            }}
          />
        )}

        {/* List */}
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-muted">
            <Loader size={14} className="animate-spin" /> Loading…
          </div>
        ) : filtered.length === 0 ? (
          <div className="card">
            <EmptyState
              icon={<Inbox size={36} />}
              title={tickets.length === 0 ? "Inbox zero" : "No tickets match this filter"}
              description={
                tickets.length === 0
                  ? "No support tickets yet. When a client needs help, open one here to track it to resolution."
                  : "Try a different filter, or open a new ticket."
              }
              action={
                tickets.length === 0 ? (
                  <button
                    onClick={() => setShowNew(true)}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-gold px-4 py-2 text-sm font-semibold text-black"
                  >
                    <Plus size={14} /> Open first ticket
                  </button>
                ) : null
              }
            />
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map((t) => (
              <TicketCard
                key={t.id}
                ticket={t}
                onDelete={() => remove(t.id)}
                onAdvance={() => advance(t.id)}
              />
            ))}
          </div>
        )}

        {/* Help */}
        <div className="mt-8 rounded-xl border border-border/40 bg-background/40 p-5 text-[12px] text-muted">
          <p className="mb-2 font-semibold text-foreground">Coming soon</p>
          <ul className="ml-4 list-disc space-y-1">
            <li>Email intake — a dedicated inbox address auto-creates tickets</li>
            <li>SLA timers per plan with auto-escalation</li>
            <li>Team assignment and internal notes</li>
            <li>
              Related:{" "}
              <Link href="/dashboard/inbox" className="text-gold underline">
                Inbox
              </Link>
              {" · "}
              <Link href="/dashboard/clients" className="text-gold underline">
                Clients
              </Link>
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────── */
/* Ticket row                                                      */
/* ─────────────────────────────────────────────────────────────── */

function TicketCard({
  ticket,
  onDelete,
  onAdvance,
}: {
  ticket: Ticket;
  onDelete: () => void;
  onAdvance: () => void;
}) {
  const statusStyle = STATUS_STYLES[ticket.status];
  const priorityStyle = PRIORITY_STYLES[ticket.priority];
  const nextAction =
    ticket.status === "open"
      ? "Start"
      : ticket.status === "in_progress"
        ? "Resolve"
        : null;

  return (
    <div className="rounded-lg border border-border/50 bg-surface-light/20 transition hover:border-gold/40">
      <div className="flex items-start gap-3 p-4">
        <div
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${
            ticket.priority === "urgent"
              ? "bg-rose-500/15 text-rose-300"
              : "bg-sky-500/15 text-sky-300"
          }`}
        >
          {ticket.priority === "urgent" ? (
            <AlertTriangle size={16} />
          ) : (
            <LifeBuoy size={16} />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="truncate text-sm font-semibold">{ticket.subject}</p>
            <span
              className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${statusStyle.tint}`}
            >
              {statusStyle.label}
            </span>
            <span
              className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${priorityStyle.tint}`}
            >
              {priorityStyle.label}
            </span>
          </div>
          <p className="mt-0.5 truncate text-[11px] text-muted">
            <User size={10} className="inline" /> {ticket.requester}
            {ticket.requester_email ? ` · ${ticket.requester_email}` : ""} ·{" "}
            <Clock size={10} className="inline" />{" "}
            {new Date(ticket.created_at).toLocaleDateString()}
          </p>
          <p className="mt-1.5 line-clamp-2 text-[12px] leading-relaxed text-foreground/80">
            {ticket.body}
          </p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          {nextAction && (
            <button
              onClick={onAdvance}
              className={`inline-flex items-center gap-1 rounded px-2.5 py-1.5 text-[11px] ${
                ticket.status === "open"
                  ? "bg-sky-500/15 text-sky-300 hover:bg-sky-500/25"
                  : "bg-emerald-500/15 text-emerald-300 hover:bg-emerald-500/25"
              }`}
            >
              <CheckCircle2 size={11} /> {nextAction}
            </button>
          )}
          <button
            onClick={onDelete}
            className="rounded bg-rose-500/10 px-2 py-1.5 text-rose-300 hover:bg-rose-500/20"
            title="Delete"
            aria-label="Delete ticket"
          >
            <Trash2 size={11} />
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────── */
/* Create form                                                     */
/* ─────────────────────────────────────────────────────────────── */

function NewTicketForm({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (t: Ticket) => void;
}) {
  const [subject, setSubject] = useState("");
  const [requester, setRequester] = useState("");
  const [requesterEmail, setRequesterEmail] = useState("");
  const [body, setBody] = useState("");
  const [priority, setPriority] = useState<Ticket["priority"]>("normal");

  const canSubmit = subject.trim() && requester.trim() && body.trim();

  function submit() {
    if (!canSubmit) return;
    const now = new Date().toISOString();
    const ticket: Ticket = {
      id: `t_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      subject: subject.trim(),
      requester: requester.trim(),
      requester_email: requesterEmail.trim(),
      body: body.trim(),
      priority,
      status: "open",
      created_at: now,
      updated_at: now,
    };
    onCreated(ticket);
  }

  return (
    <div className="rounded-xl border border-gold/30 bg-gold/5 p-5">
      <div className="mb-4 flex items-center gap-2">
        <button onClick={onClose} className="rounded p-1 text-muted hover:text-foreground" aria-label="Back to tickets list">
          <ArrowLeft size={14} />
        </button>
        <h3 className="text-base font-semibold">New ticket</h3>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className="mb-0.5 block text-[10px] uppercase tracking-wider text-muted">
            Subject
          </label>
          <input
            type="text"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="Login not working on mobile"
            className="w-full rounded-lg border border-border/50 bg-surface-light/40 px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="mb-0.5 block text-[10px] uppercase tracking-wider text-muted">
            Requester
          </label>
          <input
            type="text"
            value={requester}
            onChange={(e) => setRequester(e.target.value)}
            placeholder="Jane Doe"
            className="w-full rounded-lg border border-border/50 bg-surface-light/40 px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="mb-0.5 block text-[10px] uppercase tracking-wider text-muted">
            Requester email
          </label>
          <input
            type="email"
            value={requesterEmail}
            onChange={(e) => setRequesterEmail(e.target.value)}
            placeholder="jane@client.com"
            className="w-full rounded-lg border border-border/50 bg-surface-light/40 px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="mb-0.5 block text-[10px] uppercase tracking-wider text-muted">
            Priority
          </label>
          <select
            value={priority}
            onChange={(e) => setPriority(e.target.value as Ticket["priority"])}
            className="w-full rounded-lg border border-border/50 bg-surface-light/40 px-3 py-2 text-sm"
          >
            <option value="low">Low</option>
            <option value="normal">Normal</option>
            <option value="high">High</option>
            <option value="urgent">Urgent</option>
          </select>
        </div>
        <div className="sm:col-span-2">
          <label className="mb-0.5 block text-[10px] uppercase tracking-wider text-muted">
            Description
          </label>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={4}
            placeholder="What's happening? Steps to reproduce, error messages, screenshots…"
            className="w-full rounded-lg border border-border/50 bg-surface-light/40 px-3 py-2 text-sm"
          />
        </div>
      </div>

      <div className="mt-4 flex items-center justify-end gap-2">
        <button
          onClick={onClose}
          className="rounded-lg px-4 py-2 text-sm text-muted hover:text-foreground"
        >
          Cancel
        </button>
        <button
          onClick={submit}
          disabled={!canSubmit}
          className="inline-flex items-center gap-1.5 rounded-lg bg-gold px-5 py-2 text-sm font-semibold text-black transition hover:bg-gold/90 disabled:opacity-40"
        >
          <Plus size={14} /> Open ticket
        </button>
      </div>
    </div>
  );
}
