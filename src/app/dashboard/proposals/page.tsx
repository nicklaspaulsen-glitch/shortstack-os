"use client";

import { ArrowLeft, CheckCircle, CircleNotch, Clock, CurrencyDollar, FileText, PaperPlaneTilt, Plus, Trash, TrendUp } from "@phosphor-icons/react";

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
import toast from "react-hot-toast";
import { useAuth } from "@/lib/auth-context";
import { EmptyState } from "@/components/ui/empty-state-illustration";
import { MotionPage } from "@/components/motion/motion-page";
import PageTrainingPanel from "@/components/ui/page-training-panel";

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
  draft: { label: "Draft", tint: "bg-muted/20 text-text-muted" },
  sent: { label: "Sent", tint: "bg-[rgba(212,255,0,0.08)] text-brand-accent" },
  signed: { label: "Signed", tint: "bg-emerald-500/15 text-emerald-400" },
  declined: { label: "Declined", tint: "bg-rose-500/15 text-rose-400" },
};

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
    <MotionPage className="min-h-screen bg-background text-text-primary">{/* -- Proposals command strip -- */}
    <div className="flex items-center justify-between gap-4 px-1 py-3 sm:py-4">
      <div className="min-w-0">
        <p className="text-xs uppercase tracking-[0.2em] text-text-muted font-editorial italic mb-1">Client Proposals</p>
        <h1 className="text-2xl font-display font-bold text-text-primary">Proposals</h1>
      </div>
    </div><div className="mx-auto max-w-5xl space-y-5 px-6 pb-10 pt-5">
              {/* Beta banner */}
              <div className="rounded-xl border border-[rgba(212,255,0,0.25)] bg-[rgba(212,255,0,0.08)] px-4 py-3 text-[12px] text-brand-accent">
                <span className="font-semibold">Beta:</span> proposals are stored locally on this
                device. E-sign and PandaDoc wiring land next sprint — existing drafts will migrate.
              </div>

              {/* Stats bento */}
              <div className="grid grid-cols-2 lg:grid-cols-[4fr_2fr_2fr] gap-3 mb-4">
                <motion.div
                  className="col-span-2 lg:col-span-1 glass rounded-2xl p-5 flex items-center gap-4 shadow-[0_2px_16px_rgba(0,0,0,0.35)]"
                  initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.38, delay: 0.04, ease: [0.22, 1, 0.36, 1] }}
                >
                  <div>
                    <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-text-muted mb-1.5">Total Value</p>
                    <p className="font-display text-3xl font-bold tracking-[-0.03em] text-text-primary tabular-nums">{`$${stats.total.toLocaleString()}`}</p>
                    <p className="text-[11px] text-text-muted mt-1.5">{proposals.length} proposals</p>
                  </div>
                </motion.div>
                <motion.div
                  className="glass rounded-2xl p-5 flex flex-col justify-center shadow-[0_2px_16px_rgba(0,0,0,0.35)]"
                  initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.38, delay: 0.10, ease: [0.22, 1, 0.36, 1] }}
                >
                  <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-text-muted mb-1.5">Signed</p>
                  <p className="font-display text-2xl font-bold tracking-[-0.02em] text-emerald-400 tabular-nums">{stats.signed}</p>
                  <p className="text-[11px] text-text-muted mt-1.5">{`$${stats.signedValue.toLocaleString()} closed`}</p>
                </motion.div>
                <motion.div
                  className="glass rounded-2xl p-5 flex flex-col justify-center shadow-[0_2px_16px_rgba(0,0,0,0.35)]"
                  initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.38, delay: 0.14, ease: [0.22, 1, 0.36, 1] }}
                >
                  <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-text-muted mb-1.5">Win Rate</p>
                  <p className="font-display text-2xl font-bold tracking-[-0.02em] text-text-primary tabular-nums">
                    {proposals.length === 0 ? "—" : `${Math.round((stats.signed / proposals.length) * 100)}%`}
                  </p>
                  <p className="text-[11px] text-text-muted mt-1.5">signed / total</p>
                </motion.div>
              </div>

              {/* Toolbar */}
              <div className="flex items-center justify-between">
                <p className="text-sm text-text-muted">
                  {loading
                    ? "Loading…"
                    : `${proposals.length} proposal${proposals.length === 1 ? "" : "s"}`}
                </p>
                <motion.button
                  whileHover={{ scale: 1.04 }}
                  whileTap={{ scale: 0.96 }}
                  onClick={() => setShowNew(true)}
                  className="btn-pill inline-flex items-center gap-1.5"
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
                <div className="flex items-center gap-2 text-sm text-text-muted">
                  <CircleNotch size={14} className="animate-spin" /> Loading…
                </div>
              ) : proposals.length === 0 ? (
                <div className="glass rounded-xl p-6">
                  <EmptyState
                    type="no-invoices"
                    title="No proposals yet"
                    description="Draft your first proposal — track who signed, who ghosted, and close more deals."
                    action={
                      <motion.button
                        whileHover={{ scale: 1.04 }}
                        whileTap={{ scale: 0.96 }}
                        onClick={() => setShowNew(true)}
                        className="btn-pill inline-flex items-center gap-1.5"
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
              <div className="mt-8 glass rounded-xl p-5 text-[12px] text-text-muted">
                <p className="mb-2 font-semibold text-text-primary">Coming soon</p>
                <ul className="ml-4 list-disc space-y-1">
                  <li>Claude-drafted proposals from a short brief</li>
                  <li>PandaDoc e-sign with auto-save on sign</li>
                  <li>Workflow triggers on <code>proposal_signed</code> (onboarding, invoice, welcome)</li>
                  <li>
                    Related:{" "}
                    <Link href="/dashboard/deals" className="text-brand-accent underline">
                      Deals
                    </Link>
                    {" · "}
                    <Link href="/dashboard/clients" className="text-brand-accent underline">
                      Clients
                    </Link>
                  </li>
                </ul>
              </div>
            </div>
            {/* AI training config for Proposals */}
            <div className="mx-auto max-w-5xl px-6 pb-10">
              <PageTrainingPanel pageKey="proposals" pageLabel="Proposals" />
            </div>
          </MotionPage>
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
      className="glass rounded-xl hover:border-[rgba(212,255,0,0.14)] transition-colors spotlight-card"
      onMouseMove={(e) => {
        const rect = e.currentTarget.getBoundingClientRect();
        e.currentTarget.style.setProperty("--mouse-x", `${e.clientX - rect.left}px`);
        e.currentTarget.style.setProperty("--mouse-y", `${e.clientY - rect.top}px`);
      }}
    >
      <div className="flex items-center gap-3 p-4">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[rgba(212,255,0,0.08)] text-brand-accent">
          <FileText size={16} />
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
          <p className="mt-0.5 truncate text-[11px] text-text-muted">
            {proposal.client_name} · {proposal.client_email} ·{" "}
            <CurrencyDollar size={10} className="inline" />
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
              className="inline-flex items-center gap-1 rounded bg-[rgba(212,255,0,0.08)] px-2.5 py-1.5 text-[11px] text-brand-accent hover:bg-[rgba(212,255,0,0.14)]"
              title="Mark as sent"
            >
              <PaperPlaneTilt size={11} /> PaperPlaneTilt
            </motion.button>
          )}
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={onDelete}
            className="rounded bg-rose-500/10 px-2 py-1.5 text-rose-400 hover:bg-rose-500/20"
            title="Delete"
            aria-label="Delete proposal"
          >
            <Trash size={11} />
          </motion.button>
        </div>
      </div>
      {proposal.summary && (
        <div className="border-t border-border-subtle bg-white/[0.04] p-3 rounded-b-xl">
          <p className="text-[12px] leading-relaxed text-text-muted">{proposal.summary}</p>
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

  type ProposalSignal = { id: string; label: string; tip: string; pass: boolean };

  const proposalSignals = useMemo((): ProposalSignal[] => {
    const s = summary.trim();
    if (!s) return [];

    // Scope: summary names a deliverable or service category
    const scopeRe = /\b(content|posts?|video|ads?|campaigns?|management|strategy|design|development|seo|social media|email|copywriting|branding|website|landing page|funnel|marketing|consulting|audit)\b/i;
    const hasScope = scopeRe.test(s);

    // Timeline: mentions a timeframe or duration
    const timeRe = /\b(\d+\s*(day|week|month|quarter|year)s?|monthly|weekly|quarterly|annually|ongoing|per month|deadline|by [A-Z][a-z]+|within|timeline|deliverable|schedule)\b/i;
    const hasTimeline = timeRe.test(s);

    // Value prop: outcome-oriented language (why they should say yes)
    const valueRe = /\b(grow|increase|generate|drive|boost|improve|results?|roi|revenue|leads?|traffic|conversions?|engagement|reach|exposure|performance|scale|reduce|save)\b/i;
    const hasValueProp = valueRe.test(s);

    // Concise: substantive but readable
    const charLen = s.length;
    const isConcise = charLen >= 50 && charLen <= 400;

    // Strong title: ≥ 3 words and > 10 chars (describes the engagement)
    const t = title.trim();
    const titleWords = t.split(/\s+/).filter(Boolean).length;
    const hasStrongTitle = titleWords >= 3 && t.length > 10;

    return [
      { id: "scope",    label: "Scope",    tip: "Name the services: social media, ads, SEO, design…",                    pass: hasScope },
      { id: "timeline", label: "Timeline", tip: "Include a duration or timeframe (3 months, monthly, by June…)",          pass: hasTimeline },
      { id: "value",    label: "Outcome",  tip: "State what the client gains — leads, traffic, revenue growth",           pass: hasValueProp },
      { id: "concise",  label: "Concise",  tip: "50–400 chars — enough to sell, short enough for a busy executive",       pass: isConcise },
      { id: "title",    label: "Title",    tip: "Proposal title should be ≥ 3 words describing the engagement type",      pass: hasStrongTitle },
    ];
  }, [summary, title]);

  const proposalScore = useMemo(() => {
    if (proposalSignals.length === 0) return 0;
    const passing = proposalSignals.filter((s) => s.pass).length;
    return Math.round((passing / proposalSignals.length) * 100);
  }, [proposalSignals]);

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
          <button onClick={onClose} className="rounded p-1 text-text-muted hover:text-text-primary" aria-label="Back to proposals list">
            <ArrowLeft size={14} />
          </button>
          <h3 className="text-base font-semibold">New proposal</h3>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className="mb-0.5 block text-[10px] uppercase tracking-wider text-text-muted">
            Title
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Q2 Social Media Retainer"
            className="w-full rounded-lg border border-border-subtle bg-white/[0.04] px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="mb-0.5 block text-[10px] uppercase tracking-wider text-text-muted">
            Client name
          </label>
          <input
            type="text"
            value={clientName}
            onChange={(e) => setClientName(e.target.value)}
            placeholder="Acme Inc."
            className="w-full rounded-lg border border-border-subtle bg-white/[0.04] px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="mb-0.5 block text-[10px] uppercase tracking-wider text-text-muted">
            Client email
          </label>
          <input
            type="email"
            value={clientEmail}
            onChange={(e) => setClientEmail(e.target.value)}
            placeholder="hello@acme.com"
            className="w-full rounded-lg border border-border-subtle bg-white/[0.04] px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="mb-0.5 block text-[10px] uppercase tracking-wider text-text-muted">
            Amount
          </label>
          <input
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="5000"
            className="w-full rounded-lg border border-border-subtle bg-white/[0.04] px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="mb-0.5 block text-[10px] uppercase tracking-wider text-text-muted">
            Currency
          </label>
          <select
            value={currency}
            onChange={(e) => setCurrency(e.target.value)}
            className="w-full rounded-lg border border-border-subtle bg-white/[0.04] px-3 py-2 text-sm"
          >
            <option value="USD">USD</option>
            <option value="EUR">EUR</option>
            <option value="GBP">GBP</option>
            <option value="DKK">DKK</option>
          </select>
        </div>
        <div className="sm:col-span-2">
          <label className="mb-0.5 block text-[10px] uppercase tracking-wider text-text-muted">
            Summary
          </label>
          <textarea
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
            placeholder="One-paragraph pitch — scope, deliverables, timeline."
            rows={4}
            className="w-full rounded-lg border border-border-subtle bg-white/[0.04] px-3 py-2 text-sm"
          />
        </div>
      </div>

      {/* Proposal Strength Panel */}
      {proposalSignals.length > 0 && (
        <div className="mt-3 rounded-lg p-3"
          style={{ background: "rgba(19,24,39,0.60)", border: "1px solid rgba(212,255,0,0.12)" }}>
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-1.5">
              <TrendUp size={10} style={{ color: proposalScore >= 80 ? "#4ade80" : proposalScore >= 50 ? "#fbbf24" : "#f87171" }} />
              <span className="text-[9px] font-semibold tracking-wide text-text-secondary">Proposal Strength</span>
            </div>
            <span className="text-[10px] font-bold tabular-nums"
              style={{ color: proposalScore >= 80 ? "#4ade80" : proposalScore >= 50 ? "#fbbf24" : "#f87171" }}>
              {proposalScore}%
            </span>
          </div>
          <div className="h-[1.5px] rounded-full mb-2 overflow-hidden" style={{ background: "rgba(255,255,255,0.06)" }}>
            <div className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${proposalScore}%`,
                background: proposalScore >= 80
                  ? "linear-gradient(90deg,#16a34a,#4ade80)"
                  : proposalScore >= 50
                    ? "linear-gradient(90deg,#d97706,#fbbf24)"
                    : "linear-gradient(90deg,#dc2626,#f87171)",
              }} />
          </div>
          <div className="flex flex-wrap gap-1 mb-2">
            {proposalSignals.map((s) => (
              <span key={s.id} title={s.tip}
                className="flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[9px] font-medium cursor-default select-none"
                style={{
                  background: s.pass ? "rgba(74,222,128,0.10)" : "rgba(255,255,255,0.05)",
                  color: s.pass ? "#4ade80" : "#6b7280",
                  border: `1px solid ${s.pass ? "rgba(74,222,128,0.25)" : "rgba(255,255,255,0.08)"}`,
                }}>
                <span style={{ fontSize: "7px" }}>{s.pass ? "✓" : "–"}</span>
                {s.label}
              </span>
            ))}
          </div>
          <p className="text-[8.5px] leading-relaxed" style={{ color: "#6b7280" }}>
            {(() => {
              const first = proposalSignals.find((s) => !s.pass);
              return first ? first.tip : "Compelling summary — scope, timeline, and value are all clear.";
            })()}
          </p>
        </div>
      )}

      <div className="mt-4 flex items-center justify-end gap-2">
        <button
          onClick={onClose}
          className="rounded-lg px-4 py-2 text-sm text-text-muted hover:text-text-primary"
        >
          Cancel
        </button>
        <motion.button
          whileHover={{ scale: 1.03 }}
          whileTap={{ scale: 0.97 }}
          onClick={submit}
          disabled={!canSubmit || submitting}
          className="btn-pill inline-flex items-center gap-1.5 disabled:opacity-40"
        >
          {submitting ? (
            <CircleNotch size={14} className="animate-spin" />
          ) : (
            <>
              <CheckCircle size={14} /> Save draft
            </>
          )}
        </motion.button>
      </div>
    </motion.div>
  );
}
