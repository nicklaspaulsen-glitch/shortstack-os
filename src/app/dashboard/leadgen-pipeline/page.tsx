"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { motion, AnimatePresence } from "framer-motion";
import {
  Mic, MessageSquare, CheckCircle, FileText, TrendingUp, XCircle,
  ChevronRight, AtSign, Send, RefreshCw, Loader2, Clock, User, Briefcase,
  DollarSign, Target, Eye, X, ChevronDown, ChevronUp, Paperclip, Zap,
  AlertCircle, Users, Play, CreditCard, Package, HandshakeIcon, BookOpen,
  Scissors, Star,
} from "lucide-react";
import { MotionPage } from "@/components/motion/motion-page";

// ── Types ──────────────────────────────────────────────────────────────────

type Stage =
  | "outreach_pending"
  | "outreach_sent"
  | "replied"
  | "qualifying"
  | "qualified"
  | "content_ready"
  | "closed"
  | "onboarding"
  | "scripting"
  | "editing"
  | "payment_sent"
  | "delivered"
  | "dead";

interface LeadInfo {
  name?: string;
  business_type?: string;
  niche?: string;
  challenge?: string;
  budget?: string;
  goals?: string;
  contact_email?: string;
  has_files?: boolean;
  pain_points?: string;
}

interface MessageEntry {
  role: "assistant" | "user";
  content: string;
  ts: string;
}

interface FileRecord {
  url: string;
  filename?: string;
  type?: string;
  size?: number;
  uploaded_at?: string;
}

interface ScriptItem {
  id: string;
  type: "long_form" | "short_form" | "ad";
  title: string;
  hook: string;
  script: string;
  duration_estimate: string;
  platform: string;
  status: "draft" | "approved" | "revision_requested";
}

interface GeneratedContent {
  brief: string;
  captions: string[];
  ad_copy: string;
  hook_ideas: string[];
  email_subject: string;
  generated_at: string;
}

interface Lead {
  id: string;
  platform: string;
  handle: string;
  display_name: string | null;
  stage: Stage;
  lead_info: LeadInfo | null;
  voice_message_url: string | null;
  outreach_sent_at: string | null;
  last_reply_at: string | null;
  files: FileRecord[] | null;
  generated_content: GeneratedContent | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  // New autonomous fields
  message_history?: MessageEntry[];
  closed_at?: string | null;
  deal_value_estimate?: number | null;
  meeting_requested?: boolean;
  onboarding_complete?: boolean;
  scripts?: ScriptItem[] | null;
  scripts_approved?: boolean;
  stripe_payment_link?: string | null;
  payment_amount?: number | null;
  payment_sent_at?: string | null;
  payment_received_at?: string | null;
  delivered_at?: string | null;
}

// ── Stage configuration ────────────────────────────────────────────────────

interface StageConfig {
  stage: Stage;
  label: string;
  color: string;
  bg: string;
  border: string;
  icon: React.ReactNode;
  phase: "outreach" | "deal" | "production" | "done";
}

const PIPELINE_STAGES: StageConfig[] = [
  { stage: "outreach_sent",  label: "Outreach Sent", color: "#60A5FA", bg: "rgba(212,255,0,0.08)",   border: "rgba(212,255,0,0.22)",   icon: <Mic size={13} />,          phase: "outreach" },
  { stage: "replied",        label: "Replied",        color: "#A78BFA", bg: "rgba(139,92,246,0.08)",   border: "rgba(139,92,246,0.22)",   icon: <MessageSquare size={13} />, phase: "outreach" },
  { stage: "qualifying",     label: "Qualifying",     color: "#FBBF24", bg: "rgba(251,191,36,0.08)",   border: "rgba(251,191,36,0.22)",   icon: <Target size={13} />,        phase: "outreach" },
  { stage: "qualified",      label: "Qualified",      color: "#34D399", bg: "rgba(52,211,153,0.08)",   border: "rgba(52,211,153,0.22)",   icon: <CheckCircle size={13} />,   phase: "deal" },
  { stage: "content_ready",  label: "Pitch Ready",    color: "#F472B6", bg: "rgba(244,114,182,0.08)",  border: "rgba(244,114,182,0.22)",  icon: <FileText size={13} />,      phase: "deal" },
  { stage: "closed",         label: "Closed",         color: "#10B981", bg: "rgba(16,185,129,0.08)",   border: "rgba(16,185,129,0.22)",   icon: <HandshakeIcon size={13} />, phase: "deal" },
  { stage: "onboarding",     label: "Onboarding",     color: "#FB923C", bg: "rgba(251,146,60,0.08)",   border: "rgba(251,146,60,0.22)",   icon: <User size={13} />,          phase: "production" },
  { stage: "scripting",      label: "Scripting",      color: "#E879F9", bg: "rgba(232,121,249,0.08)",  border: "rgba(232,121,249,0.22)",  icon: <BookOpen size={13} />,      phase: "production" },
  { stage: "editing",        label: "Editing",        color: "#38BDF8", bg: "rgba(56,189,248,0.08)",   border: "rgba(56,189,248,0.22)",   icon: <Scissors size={13} />,      phase: "production" },
  { stage: "payment_sent",   label: "Payment Sent",   color: "#FDE68A", bg: "rgba(253,230,138,0.08)",  border: "rgba(253,230,138,0.22)",  icon: <CreditCard size={13} />,    phase: "production" },
  { stage: "delivered",      label: "Delivered",      color: "#86EFAC", bg: "rgba(134,239,172,0.08)",  border: "rgba(134,239,172,0.22)",  icon: <Package size={13} />,       phase: "done" },
];

const DEAD_STAGE: StageConfig = {
  stage: "dead", label: "Dead", color: "#6B7280", bg: "rgba(107,114,128,0.06)", border: "rgba(107,114,128,0.16)", icon: <XCircle size={13} />, phase: "outreach",
};

const PHASE_LABELS: Record<string, { label: string; color: string }> = {
  outreach:   { label: "Outreach",   color: "#60A5FA" },
  deal:       { label: "Deal",       color: "#10B981" },
  production: { label: "Production", color: "#E879F9" },
  done:       { label: "Done",       color: "#86EFAC" },
};

function getStageConfig(stage: Stage): StageConfig {
  return PIPELINE_STAGES.find((s) => s.stage === stage) ?? DEAD_STAGE;
}

function platformIcon(platform: string) {
  if (platform === "instagram") return <AtSign size={11} />;
  if (platform === "telegram")  return <Send size={11} />;
  return <Zap size={11} />;
}

function relativeTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1)  return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24)  return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function fmtUsd(n: number | null | undefined): string {
  if (n == null) return "";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);
}

// ── Lead detail panel ──────────────────────────────────────────────────────

function LeadDetailPanel({
  lead,
  onClose,
  onStageChange,
}: {
  lead: Lead;
  onClose: () => void;
  onStageChange: (id: string, stage: Stage) => void;
}) {
  const [tab, setTab] = useState<"conversation" | "scripts" | "content" | "files">("conversation");
  const [updatingStage, setUpdatingStage] = useState(false);
  const [showStagePicker, setShowStagePicker] = useState(false);
  const cfg = getStageConfig(lead.stage);
  const info = lead.lead_info ?? {};

  const handleStageChange = useCallback(
    async (newStage: Stage) => {
      setUpdatingStage(true);
      setShowStagePicker(false);
      try {
        await fetch("/api/leadgen/pipeline", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ lead_id: lead.id, stage: newStage }),
        });
        onStageChange(lead.id, newStage);
      } catch { /* soft fail */ } finally {
        setUpdatingStage(false);
      }
    },
    [lead.id, onStageChange],
  );

  const tabs = [
    { key: "conversation" as const, label: "Chat" },
    { key: "scripts" as const,      label: `Scripts (${(lead.scripts ?? []).length})`, hidden: !lead.scripts?.length },
    { key: "content" as const,      label: "Content", hidden: !lead.generated_content },
    { key: "files" as const,        label: `Files (${(lead.files ?? []).length})` },
  ].filter((t) => !t.hidden);

  return (
    <motion.div
      initial={{ opacity: 0, x: 32 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 32 }}
      transition={{ duration: 0.22, ease: [0.32, 0.72, 0, 1] }}
      className="fixed inset-y-0 right-0 w-[480px] z-40 flex flex-col"
      style={{
        background: "rgba(13,17,32,0.97)",
        backdropFilter: "blur(24px) saturate(160%)",
        borderLeft: "1px solid rgba(99,146,255,0.14)",
        boxShadow: "-8px 0 40px rgba(0,0,0,0.5)",
      }}
    >
      {/* Header */}
      <div className="flex items-start gap-3 px-5 pt-5 pb-4 border-b border-border-subtle flex-shrink-0">
        <div
          className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-semibold"
          style={{ background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}` }}
        >
          {(lead.display_name ?? lead.handle).slice(0, 2).toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-display text-sm font-semibold text-text-primary truncate">
            {lead.display_name ?? lead.handle}
          </div>
          <div className="flex items-center gap-1.5 mt-0.5">
            <span style={{ color: cfg.color }}>{platformIcon(lead.platform)}</span>
            <span className="text-xs text-text-muted">@{lead.handle}</span>
            {lead.deal_value_estimate && (
              <span className="ml-1 text-xs font-semibold" style={{ color: "#10B981" }}>
                {fmtUsd(lead.deal_value_estimate)}
              </span>
            )}
          </div>
        </div>

        {/* Stage picker */}
        <div className="relative flex-shrink-0">
          <button
            onClick={() => setShowStagePicker((v) => !v)}
            disabled={updatingStage}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-all"
            style={{ background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}` }}
          >
            {updatingStage ? <Loader2 size={11} className="animate-spin" /> : cfg.icon}
            <span>{cfg.label}</span>
            <ChevronDown size={10} />
          </button>
          <AnimatePresence>
            {showStagePicker && (
              <motion.div
                initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.14 }}
                className="absolute right-0 top-full mt-1.5 w-48 z-50 rounded-xl overflow-hidden"
                style={{ background: "rgba(13,17,32,0.98)", border: "1px solid rgba(99,146,255,0.16)", boxShadow: "0 8px 32px rgba(0,0,0,0.6)" }}
              >
                {[...PIPELINE_STAGES, DEAD_STAGE].map((s) => (
                  <button
                    key={s.stage}
                    onClick={() => handleStageChange(s.stage)}
                    className="w-full flex items-center gap-2 px-3 py-2 text-xs hover:bg-white/5 transition-colors"
                    style={{ color: s.color }}
                  >
                    {s.icon}
                    <span>{s.label}</span>
                    {s.stage === lead.stage && <CheckCircle size={10} className="ml-auto" />}
                  </button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <button onClick={onClose} className="p-1 text-text-muted hover:text-text-primary transition-colors">
          <X size={16} />
        </button>
      </div>

      {/* Lead info summary */}
      {(info.name ?? info.business_type ?? info.challenge ?? info.budget ?? lead.payment_amount) && (
        <div className="px-5 py-3 border-b border-border-subtle flex-shrink-0">
          <div className="grid grid-cols-2 gap-2">
            {info.name && (
              <div className="flex items-center gap-1.5">
                <User size={11} className="text-text-muted flex-shrink-0" />
                <span className="text-xs text-text-secondary truncate">{info.name}</span>
              </div>
            )}
            {(info.business_type ?? info.niche) && (
              <div className="flex items-center gap-1.5">
                <Briefcase size={11} className="text-text-muted flex-shrink-0" />
                <span className="text-xs text-text-secondary truncate">{info.business_type ?? info.niche}</span>
              </div>
            )}
            {info.challenge && (
              <div className="flex items-center gap-1.5">
                <AlertCircle size={11} className="text-text-muted flex-shrink-0" />
                <span className="text-xs text-text-secondary truncate">{info.challenge}</span>
              </div>
            )}
            {lead.payment_amount && (
              <div className="flex items-center gap-1.5">
                <DollarSign size={11} className="text-text-muted flex-shrink-0" />
                <span className="text-xs font-semibold truncate" style={{ color: lead.payment_received_at ? "#10B981" : "#FDE68A" }}>
                  {fmtUsd(lead.payment_amount)} {lead.payment_received_at ? "✓ paid" : "pending"}
                </span>
              </div>
            )}
            {lead.scripts_approved && (
              <div className="flex items-center gap-1.5">
                <Star size={11} className="flex-shrink-0" style={{ color: "#E879F9" }} />
                <span className="text-xs text-text-secondary truncate">Scripts approved</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-0 px-5 border-b border-border-subtle flex-shrink-0">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className="py-3 px-1 mr-5 text-xs font-medium border-b-2 transition-colors whitespace-nowrap"
            style={{
              borderColor: tab === t.key ? "#D4FF00" : "transparent",
              color: tab === t.key ? "#D4FF00" : "#A8A8B2",
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto min-h-0">
        {tab === "conversation" && <ConversationTab lead={lead} />}
        {tab === "scripts" && <ScriptsTab scripts={lead.scripts ?? []} />}
        {tab === "content" && lead.generated_content && <ContentTab content={lead.generated_content} />}
        {tab === "files" && <FilesTab files={lead.files ?? []} />}
      </div>

      {/* Footer */}
      <div className="px-5 py-3 border-t border-border-subtle flex items-center justify-between flex-shrink-0">
        <span className="text-xs text-text-muted">Outreach: {relativeTime(lead.outreach_sent_at)}</span>
        <span className="text-xs text-text-muted">Reply: {relativeTime(lead.last_reply_at)}</span>
      </div>
    </motion.div>
  );
}

function ConversationTab({ lead }: { lead: Lead }) {
  const history: MessageEntry[] = Array.isArray(lead.message_history) ? lead.message_history : [];

  if (!history.length) {
    return (
      <div className="flex flex-col items-center justify-center h-32 text-text-muted">
        <MessageSquare size={20} className="mb-2 opacity-40" />
        <span className="text-xs">No messages yet</span>
      </div>
    );
  }

  return (
    <div className="p-4 flex flex-col gap-2">
      {history.map((m, i) => (
        <div key={i} className={`flex ${m.role === "assistant" ? "justify-start" : "justify-end"}`}>
          <div
            className="max-w-[82%] px-3 py-2 rounded-2xl text-xs leading-relaxed"
            style={
              m.role === "assistant"
                ? { background: "rgba(212,255,0,0.10)", color: "#E0E0EA", border: "1px solid rgba(212,255,0,0.18)" }
                : { background: "rgba(255,255,255,0.07)", color: "#C0C0CC" }
            }
          >
            {m.content}
          </div>
        </div>
      ))}
    </div>
  );
}

function ScriptsTab({ scripts }: { scripts: ScriptItem[] }) {
  const [open, setOpen] = useState<string | null>(scripts[0]?.id ?? null);

  if (!scripts.length) {
    return (
      <div className="flex flex-col items-center justify-center h-32 text-text-muted">
        <BookOpen size={20} className="mb-2 opacity-40" />
        <span className="text-xs">No scripts yet</span>
      </div>
    );
  }

  return (
    <div className="p-4 flex flex-col gap-2">
      {scripts.map((s) => {
        const statusColor = s.status === "approved" ? "#10B981" : s.status === "revision_requested" ? "#F87171" : "#A8A8B2";
        return (
          <div key={s.id} className="rounded-xl overflow-hidden" style={{ border: "1px solid rgba(99,146,255,0.12)" }}>
            <button
              onClick={() => setOpen(open === s.id ? null : s.id)}
              className="w-full flex items-center gap-2 px-4 py-2.5 text-xs hover:bg-white/5 transition-colors"
            >
              <span className="font-medium text-text-secondary flex-1 text-left truncate">{s.title}</span>
              <span className="text-[9px] px-1.5 py-0.5 rounded-full" style={{ background: "rgba(99,146,255,0.08)", color: statusColor }}>
                {s.status}
              </span>
              <span className="text-[9px] text-text-muted ml-1">{s.duration_estimate}</span>
              {open === s.id ? <ChevronUp size={11} className="text-text-muted flex-shrink-0" /> : <ChevronDown size={11} className="text-text-muted flex-shrink-0" />}
            </button>
            <AnimatePresence>
              {open === s.id && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.18 }}
                  className="overflow-hidden"
                >
                  <div className="px-4 pb-4 pt-2 border-t border-border-subtle">
                    <p className="text-[10px] text-text-muted mb-2 font-medium uppercase tracking-wide">Hook</p>
                    <p className="text-xs text-text-secondary mb-3 leading-relaxed">{s.hook}</p>
                    <p className="text-[10px] text-text-muted mb-2 font-medium uppercase tracking-wide">Script</p>
                    <p className="text-xs text-text-secondary leading-relaxed whitespace-pre-wrap max-h-40 overflow-y-auto">{s.script}</p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        );
      })}
    </div>
  );
}

function ContentTab({ content }: { content: GeneratedContent }) {
  const [open, setOpen] = useState<string | null>("brief");
  const sections = [
    { key: "brief",         label: "Brief",          body: content.brief },
    { key: "ad_copy",       label: "Ad Copy",        body: content.ad_copy },
    { key: "email_subject", label: "Email Subject",  body: content.email_subject },
  ];

  return (
    <div className="p-4 flex flex-col gap-2">
      {sections.map((s) => (
        <div key={s.key} className="rounded-xl overflow-hidden" style={{ border: "1px solid rgba(99,146,255,0.12)" }}>
          <button
            onClick={() => setOpen(open === s.key ? null : s.key)}
            className="w-full flex items-center justify-between px-4 py-2.5 text-xs font-medium text-text-secondary hover:text-text-primary transition-colors"
          >
            {s.label}
            {open === s.key ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
          </button>
          <AnimatePresence>
            {open === s.key && (
              <motion.div
                initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.18 }}
                className="overflow-hidden"
              >
                <p className="px-4 pb-3 text-xs text-text-secondary leading-relaxed border-t border-border-subtle pt-2.5">{s.body}</p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      ))}
      {content.captions.length > 0 && (
        <div className="rounded-xl overflow-hidden" style={{ border: "1px solid rgba(99,146,255,0.12)" }}>
          <button
            onClick={() => setOpen(open === "captions" ? null : "captions")}
            className="w-full flex items-center justify-between px-4 py-2.5 text-xs font-medium text-text-secondary hover:text-text-primary transition-colors"
          >
            Captions ({content.captions.length})
            {open === "captions" ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
          </button>
          <AnimatePresence>
            {open === "captions" && (
              <motion.div
                initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.18 }} className="overflow-hidden border-t border-border-subtle"
              >
                <div className="p-4 flex flex-col gap-3">
                  {content.captions.map((c, i) => (
                    <p key={i} className="text-xs text-text-secondary leading-relaxed py-2 border-b border-border-subtle last:border-0">
                      <span className="text-text-muted mr-1.5">{i + 1}.</span>{c}
                    </p>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}

function FilesTab({ files }: { files: FileRecord[] }) {
  if (!files.length) {
    return (
      <div className="flex flex-col items-center justify-center h-32 text-text-muted">
        <Paperclip size={20} className="mb-2 opacity-40" />
        <span className="text-xs">No files uploaded yet</span>
      </div>
    );
  }
  return (
    <div className="p-4 flex flex-col gap-2">
      {files.map((f, i) => (
        <a
          key={i} href={f.url} target="_blank" rel="noreferrer"
          className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-white/5 transition-colors group"
          style={{ border: "1px solid rgba(99,146,255,0.10)" }}
        >
          <Paperclip size={12} className="text-text-muted flex-shrink-0" />
          <span className="text-xs text-text-secondary truncate flex-1">{f.filename ?? f.url.split("/").pop() ?? "File"}</span>
          <ChevronRight size={11} className="text-text-muted opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
        </a>
      ))}
    </div>
  );
}

// ── Lead card ──────────────────────────────────────────────────────────────

function LeadCard({ lead, onClick }: { lead: Lead; onClick: () => void }) {
  const cfg = getStageConfig(lead.stage);
  const name = lead.display_name ?? lead.handle;
  const info = lead.lead_info ?? {};

  return (
    <motion.button
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      whileHover={{ scale: 1.01 }}
      transition={{ duration: 0.18 }}
      onClick={onClick}
      className="w-full text-left p-3 rounded-xl mb-2 transition-all group relative"
      style={{ background: "rgba(13,17,32,0.7)", border: "1px solid rgba(99,146,255,0.10)" }}
    >
      <div className="flex items-start gap-2.5">
        <div
          className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0"
          style={{ background: cfg.bg, color: cfg.color }}
        >
          {name.slice(0, 2).toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 mb-0.5">
            <span className="text-xs font-semibold text-text-primary truncate">{name}</span>
            <span className="text-text-muted opacity-70 flex-shrink-0" style={{ color: cfg.color }}>
              {platformIcon(lead.platform)}
            </span>
          </div>
          {(info.business_type ?? info.niche) && (
            <p className="text-[10px] text-text-muted truncate">{info.business_type ?? info.niche}</p>
          )}
        </div>
        <Eye size={11} className="text-text-muted opacity-0 group-hover:opacity-60 transition-opacity flex-shrink-0 mt-0.5" />
      </div>

      <div className="flex items-center justify-between mt-2 pt-2 border-t border-border-subtle">
        <div className="flex items-center gap-1 text-[10px] text-text-muted">
          <Clock size={9} />
          {relativeTime(lead.last_reply_at ?? lead.outreach_sent_at)}
        </div>
        <div className="flex items-center gap-1.5">
          {lead.payment_amount && (
            <span className="text-[10px] font-semibold" style={{ color: lead.payment_received_at ? "#10B981" : "#FDE68A" }}>
              {fmtUsd(lead.payment_amount)}
            </span>
          )}
          {(lead.files ?? []).length > 0 && (
            <span className="flex items-center gap-0.5 text-[10px] text-text-muted">
              <Paperclip size={9} />{(lead.files ?? []).length}
            </span>
          )}
          {lead.scripts_approved && (
            <span className="text-[9px] px-1.5 py-0.5 rounded-full font-medium" style={{ background: "rgba(232,121,249,0.12)", color: "#E879F9" }}>
              scripts ✓
            </span>
          )}
        </div>
      </div>
    </motion.button>
  );
}

// ── Kanban column ──────────────────────────────────────────────────────────

function KanbanColumn({
  cfg,
  leads,
  onLeadClick,
}: {
  cfg: StageConfig;
  leads: Lead[];
  onLeadClick: (lead: Lead) => void;
}) {
  return (
    <div
      className="flex flex-col rounded-2xl overflow-hidden flex-shrink-0"
      style={{ width: 200, background: "rgba(13,17,32,0.5)", border: "1px solid rgba(99,146,255,0.08)" }}
    >
      <div
        className="flex items-center gap-2 px-3 py-2.5 border-b"
        style={{ borderColor: "rgba(99,146,255,0.08)", background: cfg.bg }}
      >
        <span style={{ color: cfg.color }}>{cfg.icon}</span>
        <span className="text-xs font-semibold tracking-tight flex-1" style={{ color: cfg.color }}>{cfg.label}</span>
        <span
          className="text-[10px] font-bold w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0"
          style={{ background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}` }}
        >
          {leads.length}
        </span>
      </div>
      <div className="flex-1 p-2 overflow-y-auto" style={{ maxHeight: "calc(100vh - 260px)" }}>
        <AnimatePresence>
          {leads.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-text-muted opacity-40">
              <Users size={16} className="mb-1" />
              <span className="text-[10px]">Empty</span>
            </div>
          ) : (
            leads.map((lead) => (
              <LeadCard key={lead.id} lead={lead} onClick={() => onLeadClick(lead)} />
            ))
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

// ── Phase section ──────────────────────────────────────────────────────────

function PhaseSection({
  phase,
  stageCfgs,
  leadsByStage,
  onLeadClick,
  collapsed,
  onToggle,
}: {
  phase: string;
  stageCfgs: StageConfig[];
  leadsByStage: Map<Stage, Lead[]>;
  onLeadClick: (lead: Lead) => void;
  collapsed: boolean;
  onToggle: () => void;
}) {
  const { label, color } = PHASE_LABELS[phase] ?? { label: phase, color: "#A8A8B2" };
  const total = stageCfgs.reduce((sum, s) => sum + (leadsByStage.get(s.stage)?.length ?? 0), 0);

  return (
    <div className="mb-4">
      <button
        onClick={onToggle}
        className="flex items-center gap-2 mb-2 px-1 group"
      >
        <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color }}>{label}</span>
        <span className="text-[10px] text-text-muted">({total})</span>
        {collapsed ? <ChevronRight size={11} className="text-text-muted" /> : <ChevronDown size={11} className="text-text-muted" />}
      </button>
      <AnimatePresence>
        {!collapsed && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="flex gap-3"
          >
            {stageCfgs.map((cfg) => (
              <KanbanColumn
                key={cfg.stage}
                cfg={cfg}
                leads={leadsByStage.get(cfg.stage) ?? []}
                onLeadClick={onLeadClick}
              />
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Stats bar ──────────────────────────────────────────────────────────────

function StatsBar({ leads }: { leads: Lead[] }) {
  const stats = useMemo(() => {
    const active = leads.filter((l) => l.stage !== "dead");
    const closed  = leads.filter((l) => ["closed","onboarding","scripting","editing","payment_sent","delivered"].includes(l.stage));
    const revenue = leads.filter((l) => l.payment_received_at).reduce((s, l) => s + (l.payment_amount ?? 0), 0);
    const pending = leads.filter((l) => l.stage === "payment_sent").reduce((s, l) => s + (l.payment_amount ?? 0), 0);
    const convRate = active.length > 0 ? Math.round((closed.length / active.length) * 100) : 0;
    return { total: active.length, closed: closed.length, delivered: leads.filter((l) => l.stage === "delivered").length, revenue, pending, convRate };
  }, [leads]);

  const items = [
    { label: "Active",    value: stats.total,                  color: "#A8A8B2" },
    { label: "Closed",    value: stats.closed,                 color: "#10B981" },
    { label: "Delivered", value: stats.delivered,              color: "#86EFAC" },
    { label: "Revenue",   value: fmtUsd(stats.revenue) || "—", color: "#3B82F6" },
    { label: "Pending",   value: fmtUsd(stats.pending) || "—", color: "#FDE68A" },
    { label: "Conv %",    value: `${stats.convRate}%`,          color: "#E879F9" },
  ];

  return (
    <div className="flex items-center mb-5 rounded-xl overflow-hidden" style={{ border: "1px solid rgba(99,146,255,0.10)" }}>
      {items.map((item, i) => (
        <div
          key={item.label}
          className="flex-1 px-4 py-3 flex flex-col items-center"
          style={{ borderRight: i < items.length - 1 ? "1px solid rgba(99,146,255,0.08)" : "none" }}
        >
          <span className="text-base font-display font-bold" style={{ color: item.color }}>{item.value}</span>
          <span className="text-[10px] text-text-muted mt-0.5">{item.label}</span>
        </div>
      ))}
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────

const PHASES: Array<{ phase: string; stages: Stage[] }> = [
  { phase: "outreach",   stages: ["outreach_sent", "replied", "qualifying"] },
  { phase: "deal",       stages: ["qualified", "content_ready", "closed"] },
  { phase: "production", stages: ["onboarding", "scripting", "editing", "payment_sent"] },
  { phase: "done",       stages: ["delivered"] },
];

export default function LeadgenPipelinePage() {
  const supabase = createClient();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [showDead, setShowDead] = useState(false);
  const [collapsedPhases, setCollapsedPhases] = useState<Set<string>>(new Set(["done"]));

  const fetchLeads = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    else setRefreshing(true);
    setError(null);
    try {
      const res = await fetch("/api/leadgen/pipeline?limit=250");
      if (!res.ok) {
        const body = (await res.json()) as { error?: string };
        throw new Error(body.error ?? "Failed to load pipeline");
      }
      const data = (await res.json()) as { leads: Lead[] };
      setLeads(data.leads ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void fetchLeads();

    const channel = supabase
      .channel("leadgen_pipeline_changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "lead_pipeline" }, () => { void fetchLeads(true); })
      .subscribe();

    return () => { void supabase.removeChannel(channel); };
  }, [fetchLeads, supabase]);

  const handleStageChange = useCallback((id: string, stage: Stage) => {
    setLeads((prev) => prev.map((l) => (l.id === id ? { ...l, stage } : l)));
    setSelectedLead((prev) => (prev?.id === id ? { ...prev, stage } : prev));
  }, []);

  const togglePhase = useCallback((phase: string) => {
    setCollapsedPhases((prev) => {
      const next = new Set(prev);
      if (next.has(phase)) next.delete(phase);
      else next.add(phase);
      return next;
    });
  }, []);

  const activeLeads = useMemo(() => leads.filter((l) => l.stage !== "dead"), [leads]);
  const deadLeads   = useMemo(() => leads.filter((l) => l.stage === "dead"),  [leads]);

  const leadsByStage = useMemo(() => {
    const map = new Map<Stage, Lead[]>();
    for (const cfg of PIPELINE_STAGES) map.set(cfg.stage, []);
    for (const lead of activeLeads) {
      const arr = map.get(lead.stage);
      if (arr) arr.push(lead);
    }
    return map;
  }, [activeLeads]);

  if (loading) {
    return (
      <MotionPage>
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="flex flex-col items-center gap-3">
            <Loader2 size={24} className="animate-spin text-brand-accent" />
            <span className="text-sm text-text-muted">Loading pipeline…</span>
          </div>
        </div>
      </MotionPage>
    );
  }

  return (
    <MotionPage>
      <div className="p-6 pb-2 min-w-0">
        {/* Header */}
        <div className="flex items-start justify-between mb-5">
          <div>
            <h1 className="font-display text-2xl font-bold text-text-primary tracking-tight">Lead Pipeline</h1>
            <p className="text-sm text-text-muted mt-1">Autonomous outreach → qualify → close → deliver</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => void fetchLeads(true)}
              disabled={refreshing}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-text-secondary hover:text-text-primary transition-colors"
              style={{ border: "1px solid rgba(99,146,255,0.12)" }}
            >
              <RefreshCw size={12} className={refreshing ? "animate-spin" : ""} />
              Refresh
            </button>
          </div>
        </div>

        {error && (
          <div className="flex items-center gap-2 px-4 py-3 rounded-xl mb-4 text-sm text-red-400"
            style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.18)" }}>
            <AlertCircle size={14} className="flex-shrink-0" />{error}
          </div>
        )}

        <StatsBar leads={leads} />
      </div>

      {/* Kanban — scrollable, phase-grouped */}
      <div className="px-6 overflow-x-auto pb-6">
        {PHASES.map(({ phase, stages }) => {
          const cfgs = PIPELINE_STAGES.filter((s) => stages.includes(s.stage));
          return (
            <PhaseSection
              key={phase}
              phase={phase}
              stageCfgs={cfgs}
              leadsByStage={leadsByStage}
              onLeadClick={setSelectedLead}
              collapsed={collapsedPhases.has(phase)}
              onToggle={() => togglePhase(phase)}
            />
          );
        })}

        {/* Dead leads accordion */}
        {deadLeads.length > 0 && (
          <div className="mt-2">
            <button
              onClick={() => setShowDead((v) => !v)}
              className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-text-muted hover:text-text-secondary transition-colors mb-2"
              style={{ border: "1px solid rgba(99,146,255,0.08)" }}
            >
              {showDead ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
              <XCircle size={11} />
              {deadLeads.length} dead lead{deadLeads.length !== 1 ? "s" : ""}
            </button>
            <AnimatePresence>
              {showDead && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2 }} className="overflow-hidden"
                >
                  <div className="flex flex-wrap gap-2">
                    {deadLeads.map((lead) => (
                      <LeadCard key={lead.id} lead={lead} onClick={() => setSelectedLead(lead)} />
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}
      </div>

      {/* Lead detail panel */}
      <AnimatePresence>
        {selectedLead && (
          <>
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              transition={{ duration: 0.18 }}
              className="fixed inset-0 z-30 bg-black/30 backdrop-blur-[2px]"
              onClick={() => setSelectedLead(null)}
            />
            <LeadDetailPanel
              lead={selectedLead}
              onClose={() => setSelectedLead(null)}
              onStageChange={handleStageChange}
            />
          </>
        )}
      </AnimatePresence>
    </MotionPage>
  );
}
