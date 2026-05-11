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
import { motion, type Variants } from "framer-motion";
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
import { MotionPage } from "@/components/motion/motion-page";

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
  sent: { label: "Sent", tint: "bg-[rgba(37,99,235,0.08)] text-[#2563EB]" },
  signed: { label: "Signed", tint: "bg-emerald-500/15 text-emerald-300" },
  declined: { label: "Declined", tint: "bg-rose-500/15 text-rose-300" },
};

const STAT_BARS = [
  "bg-gradient-to-r from-indigo-500 to-violet-500",
  "bg-gradient-to-r from-emerald-500 to-green-500",
  "bg-gradient-to-r from-sky-500 to-blue-500",
];

const containerVariants: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.08 } },
};

const fadeUp: Variants = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { duration: 0.35, ease: [0.32, 0.72, 0, 1] as [number, number, number, number] } },
};

const slideX: Variants = {
  hidden: { opacity: 0, x: -18 },
  show: { opacity: 1, x: 0, transition: { duration: 0.3, ease: [0.32, 0.72, 0, 1] as [number, number, number, number] } },
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
    <MotionPage className="min-h-screen bg-background text-foreground"><PageHero
              title="Proposals"
              eyebrow="PROPOSAL STUDIO"
              subtitle="Send branded proposals to prospects — track draft, sent, and signed status in one place."
              icon={<FileCheck size={20} />}
              gradient="purple"
            /><div className="mx-auto max-w-5xl space-y-5 px-6 pb-10 pt-5">
              {/* Beta banner */}
              <div className="rounded-xl border border-[rgba(37,99,235,0.25)] bg-[rgba(37,99,235,0.08)] px-4 py-3 text-[12px] text-[#2563EB]">
                <span className="font-semibold">Beta:</span> proposals are stored locally on this
                device. E-sign and PandaDoc wiring land next sprint — existing drafts will migrate.
              </div>

              {/* Stats row */}
              <motion.div
                className="grid grid-cols-1 gap-3 sm:grid-cols-3"
                variants={containerVariants}
                initial="hidden"
                animate="show"
              >
                {[
                  {
                    label: "Total value",
                    value: `$${stats.total.toLocaleString()}`,
                    sub: `${proposals.length} proposals`,
                    valueClass: "",
                  },
                  {
                    label: "Signed",
                    value: String(stats.signed),
                    sub: `$${stats.signedValue.toLocaleString()} closed`,
                    valueClass: "text-emerald-300",
                  },
                  {
                    label: "Win rate",
                    value: proposals.length === 0 ? "—" : `${Math.round((stats.signed / proposals.length) * 100)}%`,
                    sub: "signed / total",
                    valueClass: "",
                  },
                ].map((stat, i) => (
                  <motion.div
                    key={i}
                    variants={fadeUp}
                    whileHover={{ y: -2 }}
                    className="glass rounded-xl overflow-hidden relative p-4"
                  >
                    <div className={`absolute top-0 left-0 right-0 h-0.5 ${STAT_BARS[i]}`} />
                    <p className="text-[10px] uppercase tracking-wider text-muted">{stat.label}</p>
                    <p className={`mt-1 text-2xl font-bold ${stat.valueClass}`}>{stat.value}</p>
                    <p className="mt-0.5 text-[11px] text-muted">{stat.sub}</p>
                  </motion.div>
                ))}
              </motion.div>

              {/* Toolbar */}
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted">
                  {loading
                    ? "Loading…"
                    : `${proposals.length} proposal${proposals.length === 1 ? "" : "s"}`}
                </p>
                <motion.button
                  whileHover={{ scale: 1.04 }}
                  whileTap={{ scale: 0.96 }}
                  onClick={() => setShowNew(true)}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-[#2563EB] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#3B82F6]"
                >
                  <Plus size={14} /> New proposal
                </motion.button>
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
                <div className="glass rounded-xl p-6">
                  <EmptyState
                    icon={<FileCheck size={36} />}
                    title="No proposals yet"
                    description="Draft your first proposal — track who signed, who ghosted, and close more deals."
                    action={
                      <motion.button
                        whileHover={{ scale: 1.04 }}
                        whileTap={{ scale: 0.96 }}
                        onClick={() => setShowNew(true)}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-[#2563EB] px-4 py-2 text-sm font-semibold text-white"
                      >
                        <Plus size={14} /> Create proposal
                      </motion.button>
                    }
                  />
                </div>
              ) : (
                <motion.div
                  className="space-y-2"
                  variants={containerVariants}
                  initial="hidden"
                  animate="show"
                >
                  {proposals.map((p) => (
                    <ProposalCard
                      key={p.id}
                      proposal={p}
                      onDelete={() => remove(p.id)}
                      onMarkSent={() => markSent(p.id)}
                    />
                  ))}
                </motion.div>
              )}

              {/* Help */}
              <div className="mt-8 glass rounded-xl p-5 text-[12px] text-muted">
                <p className="mb-2 font-semibold text-foreground">Coming soon</p>
                <ul className="ml-4 list-disc space-y-1">
                  <li>Claude-drafted proposals from a short brief</li>
                  <li>PandaDoc e-sign with auto-save on sign</li>
                  <li>Workflow triggers on <code>proposal_signed</code> (onboarding, invoice, welcome)</li>
                  <li>
                    Related:{" "}
                    <Link href="/dashboard/deals" className="text-[#2563EB] underline">
                      Deals
                    </Link>
                    {" · "}
                    <Link href="/dashboard/clients" className="text-[#2563EB] underline">
                      Clients
                    </Link>
                  </li>
                </ul>
              </div>
            </div></MotionPage>
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
    <motion.div
      variants={{
        hidden: { opacity: 0, x: -18 },
        show: { opacity: 1, x: 0, transition: { duration: 0.3, ease: [0.32, 0.72, 0, 1] } },
      }}
      whileHover={{ y: -3 }}
      className="glass rounded-xl hover:border-[rgba(37,99,235,0.14)] transition-colors"
    >
      <div className="flex items-center gap-3 p-4">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[rgba(37,99,235,0.08)] text-[#2563EB]">
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
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={onMarkSent}
              className="inline-flex items-center gap-1 rounded bg-[rgba(37,99,235,0.08)] px-2.5 py-1.5 text-[11px] text-[#2563EB] hover:bg-[rgba(37,99,235,0.14)]"
              title="Mark as sent"
            >
              <Send size={11} /> Send
            </motion.button>
          )}
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={onDelete}
            className="rounded bg-rose-500/10 px-2 py-1.5 text-rose-300 hover:bg-rose-500/20"
            title="Delete"
            aria-label="Delete proposal"
          >
            <Trash2 size={11} />
          </motion.button>
        </div>
      </div>
      {proposal.summary && (
        <div className="border-t border-[rgba(0,0,0,0.06)] bg-[rgba(0,0,0,0.04)] p-3 rounded-b-xl">
          <p className="text-[12px] leading-relaxed text-muted">{proposal.summary}</p>
        </div>
      )}
    </motion.div>
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
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass-indigo rounded-xl p-5"
    >
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
            className="w-full rounded-lg border border-[rgba(0,0,0,0.08)] bg-[rgba(0,0,0,0.04)] px-3 py-2 text-sm"
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
            className="w-full rounded-lg border border-[rgba(0,0,0,0.08)] bg-[rgba(0,0,0,0.04)] px-3 py-2 text-sm"
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
            className="w-full rounded-lg border border-[rgba(0,0,0,0.08)] bg-[rgba(0,0,0,0.04)] px-3 py-2 text-sm"
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
            className="w-full rounded-lg border border-[rgba(0,0,0,0.08)] bg-[rgba(0,0,0,0.04)] px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="mb-0.5 block text-[10px] uppercase tracking-wider text-muted">
            Currency
          </label>
          <select
            value={currency}
            onChange={(e) => setCurrency(e.target.value)}
            className="w-full rounded-lg border border-[rgba(0,0,0,0.08)] bg-[rgba(0,0,0,0.04)] px-3 py-2 text-sm"
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
            className="w-full rounded-lg border border-[rgba(0,0,0,0.08)] bg-[rgba(0,0,0,0.04)] px-3 py-2 text-sm"
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
        <motion.button
          whileHover={{ scale: 1.03 }}
          whileTap={{ scale: 0.97 }}
          onClick={submit}
          disabled={!canSubmit || submitting}
          className="inline-flex items-center gap-1.5 rounded-lg bg-[#2563EB] px-5 py-2 text-sm font-semibold text-white transition hover:bg-[#3B82F6] disabled:opacity-40"
        >
          {submitting ? (
            <Loader size={14} className="animate-spin" />
          ) : (
            <>
              <CheckCircle2 size={14} /> Save draft
            </>
          )}
        </motion.button>
      </div>
    </motion.div>
  );
}
