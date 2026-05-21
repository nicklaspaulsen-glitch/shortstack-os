"use client";

import { useEffect, useState } from "react";
import {
  Bot, Sparkles, CheckCircle, Clock, Loader2, ChevronDown,
  FileText, Search, Mail, Megaphone, BarChart3, Calendar,
} from "lucide-react";
import { formatRelativeTime } from "@/lib/utils";

interface AutopilotTask {
  type: string;
  status: string;
  title: string;
  icon?: string;
  created_at?: string;
  content_preview?: string | null;
  count?: number;
}

interface AutopilotStatus {
  active: boolean;
  tasks: AutopilotTask[];
  total_generated: number;
  last_run: string | null;
  daily_autopilot: boolean;
  social_posts_count?: number;
}

const TASK_META: Record<string, { label: string; icon: React.ReactNode; countLabel?: (n: number) => string }> = {
  strategy: {
    label: "30-Day Marketing Strategy",
    icon: <BarChart3 size={11} className="text-[#D4FF00]" />,
  },
  social_posts: {
    label: "Social Media Posts",
    icon: <Calendar size={11} className="text-[#D4FF00]" />,
    countLabel: (n) => `${n} post${n !== 1 ? "s" : ""}`,
  },
  blog_outlines: {
    label: "Blog Article Outlines",
    icon: <FileText size={11} className="text-[#D4FF00]" />,
    countLabel: (n) => `${n} outline${n !== 1 ? "s" : ""}`,
  },
  email_templates: {
    label: "Email Templates",
    icon: <Mail size={11} className="text-[#D4FF00]" />,
    countLabel: (n) => `${n} template${n !== 1 ? "s" : ""}`,
  },
  ad_copy: {
    label: "Ad Copy Variations",
    icon: <Megaphone size={11} className="text-[#D4FF00]" />,
    countLabel: (n) => `${n} variation${n !== 1 ? "s" : ""}`,
  },
  competitor_analysis: {
    label: "Competitor Analysis",
    icon: <Search size={11} className="text-[#D4FF00]" />,
  },
};

const TASK_ORDER = ["strategy", "social_posts", "blog_outlines", "email_templates", "ad_copy", "competitor_analysis"];

function SkeletonRow() {
  return (
    <div className="flex items-center gap-2 py-1.5 animate-pulse">
      <div className="w-4 h-4 rounded-full bg-black/5 shrink-0" />
      <div className="h-2.5 bg-black/5 rounded w-36" />
      <div className="ml-auto h-2 bg-black/5 rounded w-12" />
    </div>
  );
}

export default function AutopilotDashboard({ clientId }: { clientId: string }) {
  const [status, setStatus] = useState<AutopilotStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    if (!clientId) return;
    setLoading(true);
    fetch(`/api/autopilot/status?client_id=${clientId}`)
      .then(r => r.json())
      .then((data: AutopilotStatus) => setStatus(data))
      .catch(() => setStatus(null))
      .finally(() => setLoading(false));
  }, [clientId]);

  const toggleExpand = (type: string) => {
    setExpanded(prev => (prev === type ? null : type));
  };

  // Build a full task list — show all 6 slots, filling in from status data
  const buildTaskList = (): Array<AutopilotTask & { filled: boolean }> => {
    return TASK_ORDER.map(type => {
      const found = status?.tasks.find(t => t.type === type);
      return found
        ? { ...found, filled: true }
        : { type, status: "pending", title: TASK_META[type]?.label || type, filled: false };
    });
  };

  const allTasks = status ? buildTaskList() : [];

  return (
    <div
      className={`glass rounded-xl p-4 ${status?.active ? "border border-[rgba(212,255,0,0.25)]" : "border border-border-subtle"}`}
      style={{ borderRadius: "0.75rem" }}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className={`p-1.5 rounded-md ${status?.active ? "bg-[rgba(212,255,0,0.08)]" : "bg-black/5"}`}>
            <Bot size={14} className={status?.active ? "text-[#D4FF00]" : "text-text-muted"} />
          </div>
          <div>
            <p className="text-xs font-semibold text-text-primary leading-none">AI Auto-Pilot</p>
            <p className="text-[10px] text-text-muted mt-0.5">Content generation engine</p>
          </div>
        </div>

        {/* Status badge */}
        {loading ? (
          <div className="h-5 w-14 bg-black/5 rounded-full animate-pulse" />
        ) : (
          <span
            className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${
              status?.active
                ? "bg-[rgba(212,255,0,0.08)] text-[#D4FF00] border border-[rgba(212,255,0,0.2)]"
                : "bg-black/5 text-text-muted border border-border-subtle"
            }`}
          >
            {status?.active ? "Active" : "Inactive"}
          </span>
        )}
      </div>

      {/* Body */}
      {loading ? (
        <div className="space-y-1 mt-2">
          {Array.from({ length: 6 }).map((_, i) => <SkeletonRow key={i} />)}
        </div>
      ) : !status?.active && (!status?.tasks || status.tasks.length === 0) ? (
        // Empty state
        <div className="text-center py-6 px-2">
          <div className="flex justify-center mb-2">
            <Sparkles size={20} className="text-text-primary/20" />
          </div>
          <p className="text-xs text-text-muted leading-snug">
            Auto-pilot hasn&apos;t been launched yet.
          </p>
          <p className="text-[10px] text-text-muted mt-1">
            Complete your onboarding to get started.
          </p>
        </div>
      ) : (
        <>
          {/* Summary bar */}
          <div className="flex items-center gap-3 mb-3 px-1">
            <div className="text-center">
              <p className="text-sm font-bold text-text-primary leading-none">{status?.total_generated || 0}</p>
              <p className="text-[9px] text-text-muted mt-0.5">Generated</p>
            </div>
            <div className="w-px h-6 bg-black/5" />
            <div className="text-center">
              <p className="text-sm font-bold text-text-primary leading-none">{status?.social_posts_count || 0}</p>
              <p className="text-[9px] text-text-muted mt-0.5">Posts</p>
            </div>
            {status?.last_run && (
              <>
                <div className="w-px h-6 bg-black/5" />
                <div className="flex items-center gap-1 text-[10px] text-text-muted">
                  <Clock size={9} />
                  <span>{formatRelativeTime(status.last_run)}</span>
                </div>
              </>
            )}
            {status?.daily_autopilot && (
              <span className="ml-auto text-[9px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-1.5 py-0.5 rounded-full">
                Daily
              </span>
            )}
          </div>

          {/* Task list */}
          <div className="space-y-px">
            {allTasks.map((task, idx) => {
              const meta = TASK_META[task.type];
              const isComplete = task.status === "complete";
              const isFailed = task.status === "failed";
              const isExpanded = expanded === task.type;
              const hasPreview = Boolean(task.content_preview);

              return (
                <div key={task.type}>
                  <button
                    onClick={() => hasPreview && toggleExpand(task.type)}
                    className={`w-full flex items-center gap-2 py-1.5 px-1 rounded text-left transition-colors ${
                      hasPreview ? "hover:bg-black/5 cursor-pointer" : "cursor-default"
                    }`}
                  >
                    {/* Status icon */}
                    <div className="shrink-0 w-4 h-4 flex items-center justify-center">
                      {isComplete ? (
                        <CheckCircle
                          size={12}
                          className="text-[#D4FF00]"
                          style={{
                            animation: `fadeIn 0.3s ease ${idx * 80}ms both`,
                          }}
                        />
                      ) : isFailed ? (
                        <div className="w-3 h-3 rounded-full border border-red-500/40 bg-red-500/10" />
                      ) : (
                        <div className="w-3 h-3 rounded-full border border-border-subtle bg-black/5" />
                      )}
                    </div>

                    {/* Task icon */}
                    <span className="shrink-0">{meta?.icon}</span>

                    {/* Label */}
                    <span
                      className={`text-[11px] flex-1 ${
                        isComplete ? "text-text-primary" : "text-text-muted"
                      }`}
                    >
                      {meta?.label || task.title}
                    </span>

                    {/* Count badge */}
                    {isComplete && task.count !== undefined && meta?.countLabel && (
                      <span className="text-[9px] text-text-muted">
                        {meta.countLabel(task.count)}
                      </span>
                    )}

                    {/* Expand chevron */}
                    {hasPreview && (
                      <ChevronDown
                        size={10}
                        className={`text-text-muted transition-transform ${isExpanded ? "rotate-180" : ""}`}
                      />
                    )}
                  </button>

                  {/* Expanded preview */}
                  {isExpanded && task.content_preview && (
                    <div className="mx-6 mb-1 p-2 rounded bg-black/5 border border-border-subtle">
                      <p className="text-[10px] text-text-muted leading-relaxed">
                        {task.content_preview}
                        {task.content_preview.length >= 200 && (
                          <span className="text-text-primary/20">…</span>
                        )}
                      </p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* Footer — loading indicator if tasks are still generating */}
      {status?.active && status.total_generated < 6 && (
        <div className="flex items-center gap-1.5 mt-3 pt-2 border-t border-border-subtle">
          <Loader2 size={9} className="text-[#D4FF00] animate-spin" />
          <span className="text-[9px] text-text-muted">Generating remaining tasks…</span>
        </div>
      )}

      <style jsx>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: scale(0.7); }
          to   { opacity: 1; transform: scale(1); }
        }
      `}</style>
    </div>
  );
}
