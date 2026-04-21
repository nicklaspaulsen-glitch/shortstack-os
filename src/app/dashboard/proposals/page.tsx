"use client";

/**
 * Proposals — send branded proposals to prospects.
 *
 * MVP ship: no backend yet. Proposals are stored in localStorage so the
 * page feels alive (create / view / delete). Next pass will wire to a
 * real `proposals` table + PandaDoc (env var already configured) for
 * e-sign; the beta banner makes that expectation clear.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  FileCheck,
  Plus,
  Trash2,
  ArrowLeft,
  Clock,
  CheckCircle2,
  Send,
  DollarSign,
  Loader,
} from "lucide-react";
import toast from "react-hot-toast";
import { useAuth } from "@/lib/auth-context";
import PageHero from "@/components/ui/page-hero";
import EmptyState from "@/components/ui/empty-state";

interface Proposal {
  id: string;
  title: string;
  client_name: string;
  client_email: string;
  amount: number;
  currency: string;
  summary: string;
  status: "draft" | "sent" | "signed" | "declined";
  created_at: string;
}

const STORAGE_KEY = "ss_proposals_v1";

const STATUS_STYLES: Record<Proposal["status"], { label: string; tint: string }> = {
  draft: { label: "Draft", tint: "bg-muted/20 text-muted" },
  sent: { label: "Sent", tint: "bg-sky-500/15 text-sky-300" },
  signed: { label: "Signed", tint: "bg-emerald-500/15 text-emerald-300" },
  declined: { label: "Declined", tint: "bg-rose-500/15 text-rose-300" },
};

export default function ProposalsPage() {
  useAuth();
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);

  const load = useCallback(() => {
    try {
      const raw = typeof window !== "undefined" ? localStorage.getItem(STORAGE_KEY) : null;
      setProposals(raw ? (JSON.parse(raw) as Proposal[]) : []);
    } catch {
      setProposals([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const persist = (next: Proposal[]) => {
    setProposals(next);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      /* quota — ignore */
    }
  };

  function remove(id: string) {
    if (!window.confirm("Delete this proposal? This cannot be undone.")) return;
    persist(proposals.filter((p) => p.id !== id));
    toast.success("Proposal deleted");
  }

  function markSent(id: string) {
    persist(
      proposals.map((p) => (p.id === id ? { ...p, status: "sent" as const } : p)),
    );
    toast.success("Marked as sent");
  }

  const stats = useMemo(() => {
    const total = proposals.reduce((acc, p) => acc + (p.amount || 0), 0);
    const signed = proposals.filter((p) => p.status === "signed").length;
    const signedValue = proposals
      .filter((p) => p.status === "signed")
      .reduce((acc, p) => acc + (p.amount || 0), 0);
    return { total, signed, signedValue };
  }, [proposals]);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <PageHero
        title="Proposals"
        subtitle="Send branded proposals to prospects — track draft, sent, and signed status in one place."
        icon={<FileCheck size={20} />}
        gradient="purple"
      />

      <div className="mx-auto max-w-5xl space-y-5 px-6 pb-10 pt-5">
        {/* Beta banner */}
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 px-4 py-3 text-[12px] text-amber-200">
          <span className="font-semibold">Beta:</span> proposals are stored locally on this
          device. E-sign and PandaDoc wiring land next sprint — existing drafts will migrate.
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="card">
            <p className="text-[10px] uppercase tracking-wider text-muted">Total value</p>
            <p className="mt-1 text-2xl font-bold">
              ${stats.total.toLocaleString()}
            </p>
            <p className="mt-0.5 text-[11px] text-muted">{proposals.length} proposals</p>
          </div>
          <div className="card">
            <p className="text-[10px] uppercase tracking-wider text-muted">Signed</p>
            <p className="mt-1 text-2xl font-bold text-emerald-300">{stats.signed}</p>
            <p className="mt-0.5 text-[11px] text-muted">
              ${stats.signedValue.toLocaleString()} closed
            </p>
          </div>
          <div className="card">
            <p className="text-[10px] uppercase tracking-wider text-muted">Win rate</p>
            <p className="mt-1 text-2xl font-bold">
              {proposals.length === 0
                ? "—"
                : `${Math.round((stats.signed / proposals.length) * 100)}%`}
            </p>
            <p className="mt-0.5 text-[11px] text-muted">signed / total</p>
          </div>
        </div>

        {/* Toolbar */}
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted">
            {loading
              ? "Loading…"
              : `${proposals.length} proposal${proposals.length === 1 ? "" : "s"}`}
          </p>
          <button
            onClick={() => setShowNew(true)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-gold px-4 py-2 text-sm font-semibold text-black transition hover:bg-gold/90"
          >
            <Plus size={14} /> New proposal
          </button>
        </div>

        {/* Create form */}
        {showNew && (
          <NewProposalForm
            onClose={() => setShowNew(false)}
            onCreated={(p) => {
              persist([p, ...proposals]);
              setShowNew(false);
              toast.success("Proposal created");
            }}
          />
        )}

        {/* List */}
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-muted">
            <Loader size={14} className="animate-spin" /> Loading…
          </div>
        ) : proposals.length === 0 ? (
          <div className="card">
            <EmptyState
              icon={<FileCheck size={36} />}
              title="No proposals yet"
              description="Draft your first proposal — track who signed, who ghosted, and close more deals."
              action={
                <button
                  onClick={() => setShowNew(true)}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-gold px-4 py-2 text-sm font-semibold text-black"
                >
                  <Plus size={14} /> Create proposal
                </button>
              }
            />
          </div>
        ) : (
          <div className="space-y-2">
            {proposals.map((p) => (
              <ProposalCard
                key={p.id}
                proposal={p}
                onDelete={() => remove(p.id)}
                onMarkSent={() => markSent(p.id)}
              />
            ))}
          </div>
        )}

        {/* Help */}
        <div className="mt-8 rounded-xl border border-border/40 bg-background/40 p-5 text-[12px] text-muted">
          <p className="mb-2 font-semibold text-foreground">Coming soon</p>
          <ul className="ml-4 list-disc space-y-1">
            <li>Claude-drafted proposals from a short brief</li>
            <li>PandaDoc e-sign with auto-save on sign</li>
            <li>Workflow triggers on <code>proposal_signed</code> (onboarding, invoice, welcome)</li>
            <li>
              Related:{" "}
              <Link href="/dashboard/deals" className="text-gold underline">
                Deals
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
/* Proposal row                                                    */
/* ─────────────────────────────────────────────────────────────── */

function ProposalCard({
  proposal,
  onDelete,
  onMarkSent,
}: {
  proposal: Proposal;
  onDelete: () => void;
  onMarkSent: () => void;
}) {
  const style = STATUS_STYLES[proposal.status];
  return (
    <div className="rounded-lg border border-border/50 bg-surface-light/20 transition hover:border-gold/40">
      <div className="flex items-center gap-3 p-4">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-purple-500/15 text-purple-300">
          <FileCheck size={16} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="truncate text-sm font-semibold">{proposal.title}</p>
            <span
              className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${style.tint}`}
            >
              {style.label}
            </span>
          </div>
          <p className="mt-0.5 truncate text-[11px] text-muted">
            {proposal.client_name} · {proposal.client_email} ·{" "}
            <DollarSign size={10} className="inline" />
            {proposal.amount.toLocaleString()} {proposal.currency} ·{" "}
            <Clock size={10} className="inline" />{" "}
            {new Date(proposal.created_at).toLocaleDateString()}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {proposal.status === "draft" && (
            <button
              onClick={onMarkSent}
              className="inline-flex items-center gap-1 rounded bg-sky-500/15 px-2.5 py-1.5 text-[11px] text-sky-300 hover:bg-sky-500/25"
              title="Mark as sent"
            >
              <Send size={11} /> Send
            </button>
          )}
          <button
            onClick={onDelete}
            className="rounded bg-rose-500/10 px-2 py-1.5 text-rose-300 hover:bg-rose-500/20"
            title="Delete"
            aria-label="Delete proposal"
          >
            <Trash2 size={11} />
          </button>
        </div>
      </div>
      {proposal.summary && (
        <div className="border-t border-border/30 bg-background/40 p-3">
          <p className="text-[12px] leading-relaxed text-muted">{proposal.summary}</p>
        </div>
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────── */
/* Create form                                                     */
/* ─────────────────────────────────────────────────────────────── */

function NewProposalForm({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (p: Proposal) => void;
}) {
  const [title, setTitle] = useState("");
  const [clientName, setClientName] = useState("");
  const [clientEmail, setClientEmail] = useState("");
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState("USD");
  const [summary, setSummary] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const canSubmit = title.trim() && clientName.trim() && amount.trim();

  function submit() {
    if (!canSubmit) return;
    setSubmitting(true);
    const proposal: Proposal = {
      id: `p_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      title: title.trim(),
      client_name: clientName.trim(),
      client_email: clientEmail.trim(),
      amount: Number(amount) || 0,
      currency,
      summary: summary.trim(),
      status: "draft",
      created_at: new Date().toISOString(),
    };
    onCreated(proposal);
    setSubmitting(false);
  }

  return (
    <div className="rounded-xl border border-gold/30 bg-gold/5 p-5">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button onClick={onClose} className="rounded p-1 text-muted hover:text-foreground" aria-label="Back to proposals list">
            <ArrowLeft size={14} />
          </button>
          <h3 className="text-base font-semibold">New proposal</h3>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className="mb-0.5 block text-[10px] uppercase tracking-wider text-muted">
            Title
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Q2 Social Media Retainer"
            className="w-full rounded-lg border border-border/50 bg-surface-light/40 px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="mb-0.5 block text-[10px] uppercase tracking-wider text-muted">
            Client name
          </label>
          <input
            type="text"
            value={clientName}
            onChange={(e) => setClientName(e.target.value)}
            placeholder="Acme Inc."
            className="w-full rounded-lg border border-border/50 bg-surface-light/40 px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="mb-0.5 block text-[10px] uppercase tracking-wider text-muted">
            Client email
          </label>
          <input
            type="email"
            value={clientEmail}
            onChange={(e) => setClientEmail(e.target.value)}
            placeholder="hello@acme.com"
            className="w-full rounded-lg border border-border/50 bg-surface-light/40 px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="mb-0.5 block text-[10px] uppercase tracking-wider text-muted">
            Amount
          </label>
          <input
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="5000"
            className="w-full rounded-lg border border-border/50 bg-surface-light/40 px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="mb-0.5 block text-[10px] uppercase tracking-wider text-muted">
            Currency
          </label>
          <select
            value={currency}
            onChange={(e) => setCurrency(e.target.value)}
            className="w-full rounded-lg border border-border/50 bg-surface-light/40 px-3 py-2 text-sm"
          >
            <option value="USD">USD</option>
            <option value="EUR">EUR</option>
            <option value="GBP">GBP</option>
            <option value="DKK">DKK</option>
          </select>
        </div>
        <div className="sm:col-span-2">
          <label className="mb-0.5 block text-[10px] uppercase tracking-wider text-muted">
            Summary
          </label>
          <textarea
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
            placeholder="One-paragraph pitch — scope, deliverables, timeline."
            rows={4}
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
          disabled={!canSubmit || submitting}
          className="inline-flex items-center gap-1.5 rounded-lg bg-gold px-5 py-2 text-sm font-semibold text-black transition hover:bg-gold/90 disabled:opacity-40"
        >
          {submitting ? (
            <Loader size={14} className="animate-spin" />
          ) : (
            <>
              <CheckCircle2 size={14} /> Save draft
            </>
          )}
        </button>
      </div>
    </div>
  );
}
