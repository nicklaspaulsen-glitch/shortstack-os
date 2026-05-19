"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { motion, AnimatePresence } from "framer-motion";
import {
  Mic,
  MessageSquare,
  CheckCircle,
  FileText,
  TrendingUp,
  XCircle,
  ChevronRight,
  AtSign,
  Send,
  RefreshCw,
  Loader2,
  Clock,
  User,
  Briefcase,
  DollarSign,
  Target,
  Eye,
  X,
  ChevronDown,
  ChevronUp,
  Paperclip,
  Zap,
  AlertCircle,
  Users,
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
  | "converted"
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
}

interface MessageEntry {
  role: "assistant" | "user";
  content: string;
  timestamp: string;
}

interface FileRecord {
  url: string;
  filename?: string;
  type?: string;
  size?: number;
  uploaded_at?: string;
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
}

// ── Stage configuration ────────────────────────────────────────────────────

const PIPELINE_STAGES: { stage: Stage; label: string; color: string; bg: string; border: string; icon: React.ReactNode }[] = [
  {
    stage: "outreach_sent",
    label: "Outreach Sent",
    color: "#60A5FA",
    bg: "rgba(59,130,246,0.08)",
    border: "rgba(59,130,246,0.22)",
    icon: <Mic size={13} />,
  },
  {
    stage: "replied",
    label: "Replied",
    color: "#A78BFA",
    bg: "rgba(139,92,246,0.08)",
    border: "rgba(139,92,246,0.22)",
    icon: <MessageSquare size={13} />,
  },
  {
    stage: "qualifying",
    label: "Qualifying",
    color: "#FBBF24",
    bg: "rgba(251,191,36,0.08)",
    border: "rgba(251,191,36,0.22)",
    icon: <Target size={13} />,
  },
  {
    stage: "qualified",
    label: "Qualified",
    color: "#34D399",
    bg: "rgba(52,211,153,0.08)",
    border: "rgba(52,211,153,0.22)",
    icon: <CheckCircle size={13} />,
  },
  {
    stage: "content_ready",
    label: "Content Ready",
    color: "#F472B6",
    bg: "rgba(244,114,182,0.08)",
    border: "rgba(244,114,182,0.22)",
    icon: <FileText size={13} />,
  },
  {
    stage: "converted",
    label: "Converted",
    color: "#10B981",
    bg: "rgba(16,185,129,0.08)",
    border: "rgba(16,185,129,0.22)",
    icon: <TrendingUp size={13} />,
  },
];

const DEAD_STAGE = {
  stage: "dead" as Stage,
  label: "Dead",
  color: "#6B7280",
  bg: "rgba(107,114,128,0.06)",
  border: "rgba(107,114,128,0.16)",
  icon: <XCircle size={13} />,
};

function getStageConfig(stage: Stage) {
  return PIPELINE_STAGES.find((s) => s.stage === stage) ?? DEAD_STAGE;
}

function platformIcon(platform: string) {
  if (platform === "instagram") return <AtSign size={11} />;
  if (platform === "telegram") return <Send size={11} />;
  return <Zap size={11} />;
}

function relativeTime(iso: string | null): string {
  if (!iso) return "—";
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
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
  const [tab, setTab] = useState<"conversation" | "content" | "files">(
    "conversation",
  );
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
      } catch {
        // soft fail
      } finally {
        setUpdatingStage(false);
      }
    },
    [lead.id, onStageChange],
  );

  const tabs = [
    { key: "conversation" as const, label: "Conversation" },
    { key: "content" as const, label: "Content", disabled: !lead.generated_content },
    { key: "files" as const, label: `Files (${(lead.files ?? []).length})` },
  ];

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
            <span className="text-text-muted" style={{ color: cfg.color }}>
              {platformIcon(lead.platform)}
            </span>
            <span className="text-xs text-text-muted">@{lead.handle}</span>
          </div>
        </div>

        {/* Stage picker */}
        <div className="relative flex-shrink-0">
          <button
            onClick={() => setShowStagePicker((v) => !v)}
            disabled={updatingStage}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-all"
            style={{
              background: cfg.bg,
              color: cfg.color,
              border: `1px solid ${cfg.border}`,
            }}
          >
            {updatingStage ? <Loader2 size={11} className="animate-spin" /> : cfg.icon}
            <span>{cfg.label}</span>
            <ChevronDown size={10} />
          </button>
          <AnimatePresence>
            {showStagePicker && (
              <motion.div
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.14 }}
                className="absolute right-0 top-full mt-1.5 w-44 z-50 rounded-xl overflow-hidden"
                style={{
                  background: "rgba(13,17,32,0.98)",
                  border: "1px solid rgba(99,146,255,0.16)",
                  boxShadow: "0 8px 32px rgba(0,0,0,0.6)",
                }}
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
      {(info.name || info.business_type || info.challenge || info.budget) && (
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
                <span className="text-xs text-text-secondary truncate">
                  {info.business_type ?? info.niche}
                </span>
              </div>
            )}
            {info.challenge && (
              <div className="flex items-center gap-1.5">
                <AlertCircle size={11} className="text-text-muted flex-shrink-0" />
                <span className="text-xs text-text-secondary truncate">{info.challenge}</span>
              </div>
            )}
            {info.budget && (
              <div className="flex items-center gap-1.5">
                <DollarSign size={11} className="text-text-muted flex-shrink-0" />
                <span className="text-xs text-text-secondary truncate">{info.budget}</span>
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
            onClick={() => !t.disabled && setTab(t.key)}
            disabled={t.disabled}
            className="py-3 px-1 mr-5 text-xs font-medium border-b-2 transition-colors"
            style={{
              borderColor: tab === t.key ? "#3B82F6" : "transparent",
              color: tab === t.key ? "#60A5FA" : t.disabled ? "rgba(160,160,176,0.35)" : "#A8A8B2",
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto min-h-0">
        {tab === "conversation" && (
          <ConversationTab lead={lead} />
        )}
        {tab === "content" && lead.generated_content && (
          <ContentTab content={lead.generated_content} />
        )}
        {tab === "files" && (
          <FilesTab files={lead.files ?? []} />
        )}
      </div>

      {/* Timestamps footer */}
      <div className="px-5 py-3 border-t border-border-subtle flex items-center justify-between flex-shrink-0">
        <span className="text-xs text-text-muted">
          Outreach: {relativeTime(lead.outreach_sent_at)}
        </span>
        <span className="text-xs text-text-muted">
          Last reply: {relativeTime(lead.last_reply_at)}
        </span>
      </div>
    </motion.div>
  );
}

function ConversationTab({ lead }: { lead: Lead }) {
  const raw = lead as unknown as { message_history?: MessageEntry[] };
  const history: MessageEntry[] = Array.isArray(raw.message_history)
    ? raw.message_history
    : [];

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
        <div
          key={i}
          className={`flex ${m.role === "assistant" ? "justify-start" : "justify-end"}`}
        >
          <div
            className="max-w-[82%] px-3 py-2 rounded-2xl text-xs leading-relaxed"
            style={
              m.role === "assistant"
                ? {
                    background: "rgba(59,130,246,0.10)",
                    color: "#E0E0EA",
                    border: "1px solid rgba(59,130,246,0.18)",
                  }
                : {
                    background: "rgba(255,255,255,0.07)",
                    color: "#C0C0CC",
                  }
            }
          >
            {m.content}
          </div>
        </div>
      ))}
    </div>
  );
}

function ContentTab({ content }: { content: GeneratedContent }) {
  const [open, setOpen] = useState<string | null>("brief");

  const sections = [
    { key: "brief", label: "Brief", body: content.brief },
    { key: "ad_copy", label: "Ad Copy", body: content.ad_copy },
    { key: "email_subject", label: "Email Subject", body: content.email_subject },
  ];

  return (
    <div className="p-4 flex flex-col gap-2">
      {sections.map((s) => (
        <div
          key={s.key}
          className="rounded-xl overflow-hidden"
          style={{ border: "1px solid rgba(99,146,255,0.12)" }}
        >
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
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.18 }}
                className="overflow-hidden"
              >
                <p className="px-4 pb-3 text-xs text-text-secondary leading-relaxed border-t border-border-subtle pt-2.5">
                  {s.body}
                </p>
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
            Instagram Captions ({content.captions.length})
            {open === "captions" ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
          </button>
          <AnimatePresence>
            {open === "captions" && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.18 }}
                className="overflow-hidden border-t border-border-subtle"
              >
                <div className="p-4 flex flex-col gap-3">
                  {content.captions.map((c, i) => (
                    <p key={i} className="text-xs text-text-secondary leading-relaxed py-2 border-b border-border-subtle last:border-0">
                      <span className="text-text-muted mr-1.5">{i + 1}.</span>
                      {c}
                    </p>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {content.hook_ideas.length > 0 && (
        <div className="rounded-xl overflow-hidden" style={{ border: "1px solid rgba(99,146,255,0.12)" }}>
          <button
            onClick={() => setOpen(open === "hooks" ? null : "hooks")}
            className="w-full flex items-center justify-between px-4 py-2.5 text-xs font-medium text-text-secondary hover:text-text-primary transition-colors"
          >
            Hook Ideas ({content.hook_ideas.length})
            {open === "hooks" ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
          </button>
          <AnimatePresence>
            {open === "hooks" && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.18 }}
                className="overflow-hidden border-t border-border-subtle"
              >
                <ul className="p-4 flex flex-col gap-2">
                  {content.hook_ideas.map((h, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <span className="w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-semibold flex-shrink-0 mt-0.5"
                        style={{ background: "rgba(59,130,246,0.12)", color: "#60A5FA" }}>
                        {i + 1}
                      </span>
                      <span className="text-xs text-text-secondary leading-relaxed">{h}</span>
                    </li>
                  ))}
                </ul>
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
          key={i}
          href={f.url}
          target="_blank"
          rel="noreferrer"
          className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-white/5 transition-colors group"
          style={{ border: "1px solid rgba(99,146,255,0.10)" }}
        >
          <Paperclip size={12} className="text-text-muted flex-shrink-0" />
          <span className="text-xs text-text-secondary truncate flex-1">
            {f.filename ?? f.url.split("/").pop() ?? "File"}
          </span>
          <ChevronRight size={11} className="text-text-muted opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
        </a>
      ))}
    </div>
  );
}

// ── Lead card ──────────────────────────────────────────────────────────────

function LeadCard({
  lead,
  onClick,
}: {
  lead: Lead;
  onClick: () => void;
}) {
  const cfg = getStageConfig(lead.stage);
  const name = lead.display_name ?? lead.handle;
  const initials = name.slice(0, 2).toUpperCase();
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
      style={{
        background: "rgba(13,17,32,0.7)",
        border: `1px solid rgba(99,146,255,0.10)`,
      }}
    >
      <div className="flex items-start gap-2.5">
        <div
          className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0"
          style={{ background: cfg.bg, color: cfg.color }}
        >
          {initials}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 mb-0.5">
            <span className="text-xs font-semibold text-text-primary truncate">{name}</span>
            <span className="text-text-muted opacity-70 flex-shrink-0" style={{ color: cfg.color }}>
              {platformIcon(lead.platform)}
            </span>
          </div>
          {(info.business_type ?? info.niche) && (
            <p className="text-[10px] text-text-muted truncate">
              {info.business_type ?? info.niche}
            </p>
          )}
        </div>
        <Eye
          size={11}
          className="text-text-muted opacity-0 group-hover:opacity-60 transition-opacity flex-shrink-0 mt-0.5"
        />
      </div>

      {/* Footer meta */}
      <div className="flex items-center justify-between mt-2 pt-2 border-t border-border-subtle">
        <div className="flex items-center gap-1 text-[10px] text-text-muted">
          <Clock size={9} />
          {relativeTime(lead.last_reply_at ?? lead.outreach_sent_at)}
        </div>
        <div className="flex items-center gap-1.5">
          {(lead.files ?? []).length > 0 && (
            <span className="flex items-center gap-0.5 text-[10px] text-text-muted">
              <Paperclip size={9} />
              {(lead.files ?? []).length}
            </span>
          )}
          {lead.generated_content && (
            <span className="text-[9px] px-1.5 py-0.5 rounded-full font-medium"
              style={{ background: "rgba(244,114,182,0.12)", color: "#F472B6" }}>
              content
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
  cfg: typeof PIPELINE_STAGES[number];
  leads: Lead[];
  onLeadClick: (lead: Lead) => void;
}) {
  return (
    <div
      className="flex flex-col rounded-2xl overflow-hidden flex-shrink-0"
      style={{
        width: 220,
        background: "rgba(13,17,32,0.5)",
        border: "1px solid rgba(99,146,255,0.08)",
      }}
    >
      {/* Column header */}
      <div
        className="flex items-center gap-2 px-3 py-2.5 border-b"
        style={{ borderColor: "rgba(99,146,255,0.08)", background: cfg.bg }}
      >
        <span style={{ color: cfg.color }}>{cfg.icon}</span>
        <span className="text-xs font-semibold tracking-tight" style={{ color: cfg.color }}>
          {cfg.label}
        </span>
        <span
          className="ml-auto text-[10px] font-bold w-5 h-5 rounded-full flex items-center justify-center"
          style={{ background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}` }}
        >
          {leads.length}
        </span>
      </div>

      {/* Cards */}
      <div className="flex-1 p-2 overflow-y-auto" style={{ maxHeight: "calc(100vh - 240px)" }}>
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

// ── Stats bar ──────────────────────────────────────────────────────────────

function StatsBar({ leads }: { leads: Lead[] }) {
  const stats = useMemo(() => {
    const total = leads.length;
    const qualified = leads.filter((l) =>
      ["qualified", "content_ready", "converted"].includes(l.stage),
    ).length;
    const contentReady = leads.filter((l) => l.stage === "content_ready").length;
    const converted = leads.filter((l) => l.stage === "converted").length;
    const convRate = total > 0 ? Math.round((converted / total) * 100) : 0;
    return { total, qualified, contentReady, converted, convRate };
  }, [leads]);

  const items = [
    { label: "Total", value: stats.total, color: "#A8A8B2" },
    { label: "Qualified", value: stats.qualified, color: "#34D399" },
    { label: "Content Ready", value: stats.contentReady, color: "#F472B6" },
    { label: "Converted", value: stats.converted, color: "#10B981" },
    { label: "Conv. Rate", value: `${stats.convRate}%`, color: "#3B82F6" },
  ];

  return (
    <div className="flex items-center gap-0 mb-5 rounded-xl overflow-hidden" style={{ border: "1px solid rgba(99,146,255,0.10)" }}>
      {items.map((item, i) => (
        <div
          key={item.label}
          className="flex-1 px-4 py-3 flex flex-col items-center"
          style={{
            borderRight: i < items.length - 1 ? "1px solid rgba(99,146,255,0.08)" : "none",
          }}
        >
          <span className="text-lg font-display font-bold" style={{ color: item.color }}>
            {item.value}
          </span>
          <span className="text-[10px] text-text-muted mt-0.5">{item.label}</span>
        </div>
      ))}
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────

export default function LeadgenPipelinePage() {
  const supabase = createClient();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [stageFilter, setStageFilter] = useState<Stage | "all">("all");
  const [refreshing, setRefreshing] = useState(false);
  const [showDead, setShowDead] = useState(false);

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
      const msg = err instanceof Error ? err.message : "Unknown error";
      setError(msg);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void fetchLeads();

    // Realtime subscription on lead_pipeline changes
    const channel = supabase
      .channel("leadgen_pipeline_changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "lead_pipeline" },
        () => { void fetchLeads(true); },
      )
      .subscribe();

    return () => { void supabase.removeChannel(channel); };
  }, [fetchLeads, supabase]);

  const handleStageChange = useCallback((id: string, stage: Stage) => {
    setLeads((prev) => prev.map((l) => (l.id === id ? { ...l, stage } : l)));
    setSelectedLead((prev) => (prev?.id === id ? { ...prev, stage } : prev));
  }, []);

  // Build kanban columns from leads
  const columns = useMemo(() => {
    const active = leads.filter((l) => l.stage !== "dead");
    const filtered =
      stageFilter === "all" ? active : active.filter((l) => l.stage === stageFilter);

    return PIPELINE_STAGES.map((cfg) => ({
      cfg,
      leads: filtered.filter((l) => l.stage === cfg.stage),
    }));
  }, [leads, stageFilter]);

  const deadLeads = useMemo(
    () => leads.filter((l) => l.stage === "dead"),
    [leads],
  );

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
        {/* Page header */}
        <div className="flex items-start justify-between mb-5">
          <div>
            <h1 className="font-display text-2xl font-bold text-text-primary tracking-tight">
              Lead Pipeline
            </h1>
            <p className="text-sm text-text-muted mt-1">
              Voice outreach → AI qualification → content generation
            </p>
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
            <AlertCircle size={14} className="flex-shrink-0" />
            {error}
          </div>
        )}

        {/* Stats bar */}
        <StatsBar leads={leads} />

        {/* Stage filter pills */}
        <div className="flex items-center gap-1.5 flex-wrap mb-5">
          <button
            onClick={() => setStageFilter("all")}
            className="px-3 py-1 rounded-full text-xs font-medium transition-all"
            style={
              stageFilter === "all"
                ? { background: "rgba(59,130,246,0.15)", color: "#60A5FA", border: "1px solid rgba(59,130,246,0.3)" }
                : { background: "rgba(255,255,255,0.04)", color: "#A8A8B2", border: "1px solid rgba(99,146,255,0.10)" }
            }
          >
            All
          </button>
          {PIPELINE_STAGES.map((s) => (
            <button
              key={s.stage}
              onClick={() => setStageFilter(s.stage)}
              className="px-3 py-1 rounded-full text-xs font-medium transition-all"
              style={
                stageFilter === s.stage
                  ? { background: s.bg, color: s.color, border: `1px solid ${s.border}` }
                  : { background: "rgba(255,255,255,0.04)", color: "#A8A8B2", border: "1px solid rgba(99,146,255,0.10)" }
              }
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {/* Kanban board */}
      <div className="px-6 overflow-x-auto pb-6">
        <div className="flex gap-3 min-w-max">
          {columns.map(({ cfg, leads: colLeads }) => (
            <KanbanColumn
              key={cfg.stage}
              cfg={cfg}
              leads={colLeads}
              onLeadClick={setSelectedLead}
            />
          ))}
        </div>

        {/* Dead leads accordion */}
        {deadLeads.length > 0 && (
          <div className="mt-4 max-w-full">
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
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="overflow-hidden"
                >
                  <div className="flex flex-wrap gap-2">
                    {deadLeads.map((lead) => (
                      <LeadCard
                        key={lead.id}
                        lead={lead}
                        onClick={() => setSelectedLead(lead)}
                      />
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
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
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
