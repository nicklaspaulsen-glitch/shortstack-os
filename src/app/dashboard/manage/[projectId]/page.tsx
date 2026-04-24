"use client";

import { use, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import toast from "react-hot-toast";
import {
  ArrowLeft,
  Briefcase,
  CheckCircle2,
  Loader2,
  Rocket,
  Users,
  ScanLine,
  Activity,
  UserPlus,
  Mail,
  ClipboardList,
  AlertTriangle,
  Clock,
  FileText,
  Check,
  X,
  Send,
} from "lucide-react";

type HealthStatus = "red" | "yellow" | "green";

interface Reason { code: string; detail: string; narrative?: string }
interface Task {
  id: string;
  title: string;
  description: string | null;
  status: "todo" | "in_progress" | "review" | "done";
  priority: "low" | "medium" | "high" | "urgent";
  due_date: string | null;
  assignee_id: string | null;
  completed_at: string | null;
  created_at: string;
}
interface ScopeFlag {
  id: string;
  flag_type: string;
  description: string;
  severity: "low" | "medium" | "high";
  resolved: boolean;
  created_at: string;
  resolved_at: string | null;
}
interface WeeklyReport {
  id: string;
  week_start: string;
  status: "draft" | "sent" | "skipped";
  content: string;
  generated_at: string;
  sent_at: string | null;
}
interface ProjectPayload {
  project: {
    id: string;
    name: string;
    brief: string | null;
    deadline: string | null;
    status: string;
    owner_id: string | null;
    created_at: string;
  };
  latest_health: { date: string; status: HealthStatus; reasons: Reason[]; generated_at: string } | null;
  tasks: Task[];
  scope_flags: ScopeFlag[];
  weekly_reports: WeeklyReport[];
  latest_post_mortem: { id: string; content: string; generated_at: string; generated_by: "ai" | "manual" } | null;
}

const HEALTH_META: Record<HealthStatus, { label: string; color: string; bg: string }> = {
  red:    { label: "At risk",  color: "#ef4444", bg: "rgba(239,68,68,0.15)" },
  yellow: { label: "Watch",    color: "#f59e0b", bg: "rgba(245,158,11,0.15)" },
  green:  { label: "On track", color: "#10b981", bg: "rgba(16,185,129,0.15)" },
};

const SEVERITY_META: Record<"low" | "medium" | "high", { color: string; bg: string }> = {
  low:    { color: "#9ca3af", bg: "rgba(156,163,175,0.15)" },
  medium: { color: "#f59e0b", bg: "rgba(245,158,11,0.15)" },
  high:   { color: "#ef4444", bg: "rgba(239,68,68,0.15)" },
};

export default function ManageProjectPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = use(params);

  const [data, setData] = useState<ProjectPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [runningAction, setRunningAction] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const r = await fetch(`/api/manage/project/${projectId}`);
      if (!r.ok) throw new Error("Failed");
      const j = await r.json();
      setData(j);
    } catch (e) {
      console.error(e);
      toast.error("Couldn't load project manage view");
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => { load(); }, [load]);

  async function runAction(name: string, opts?: { path?: string; body?: unknown; onOk?: (j: unknown) => void }) {
    const path = opts?.path ?? `/api/manage/${name}`;
    setRunningAction(name);
    try {
      const r = await fetch(path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ project_id: projectId, ...((opts?.body as object) ?? {}) }),
      });
      const j = await r.json();
      if (!r.ok) {
        toast.error(j.error || "Action failed");
        return;
      }
      opts?.onOk?.(j);
      toast.success(`${name.replace("-", " ")} done`);
      load();
    } catch (e) {
      console.error(e);
      toast.error("Network error");
    } finally {
      setRunningAction(null);
    }
  }

  async function resolveFlag(flagId: string, resolved: boolean) {
    try {
      const r = await fetch(`/api/manage/scope-flags/${flagId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resolved }),
      });
      if (!r.ok) throw new Error();
      toast.success(resolved ? "Flag resolved" : "Flag reopened");
      load();
    } catch { toast.error("Couldn't update flag"); }
  }

  async function updateReport(reportId: string, status: "sent" | "skipped") {
    try {
      const r = await fetch(`/api/manage/weekly-reports/${reportId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!r.ok) throw new Error();
      toast.success(`Report marked ${status}`);
      load();
    } catch { toast.error("Couldn't update report"); }
  }

  if (loading || !data) {
    return (
      <div className="mx-auto max-w-6xl p-6">
        <div className="flex items-center gap-2 text-sm text-neutral-400">
          <Loader2 className="animate-spin" size={16} /> Loading…
        </div>
      </div>
    );
  }

  const { project, latest_health, tasks, scope_flags, weekly_reports, latest_post_mortem } = data;
  const healthMeta = latest_health ? HEALTH_META[latest_health.status] : null;
  const openFlags = scope_flags.filter((f) => !f.resolved);
  const overdueTasks = tasks.filter((t) =>
    t.status !== "done" && t.due_date && new Date(t.due_date) < new Date()
  );

  return (
    <div className="mx-auto max-w-6xl p-6">
      <Link href="/dashboard/manage/overview" className="inline-flex items-center gap-1 text-xs text-neutral-400 hover:text-white">
        <ArrowLeft size={12} /> Back to Manage
      </Link>

      <div className="mt-4 flex items-start justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-white">
            <Briefcase size={22} />
            {project.name}
          </h1>
          {project.deadline && (
            <p className="mt-1 text-sm text-neutral-400">
              Deadline {new Date(project.deadline).toLocaleDateString()}
            </p>
          )}
        </div>
        {healthMeta && (
          <div className="text-right">
            <span
              className="inline-block rounded-full px-3 py-1 text-sm font-semibold"
              style={{ color: healthMeta.color, background: healthMeta.bg }}
            >
              {healthMeta.label}
            </span>
            {latest_health && (
              <p className="mt-1 text-xs text-neutral-400">
                Snapshot {new Date(latest_health.generated_at).toLocaleDateString()}
              </p>
            )}
          </div>
        )}
      </div>

      {latest_health && latest_health.reasons.length > 0 && (
        <div className="mt-4 rounded-lg border border-white/10 bg-white/5 p-4">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-neutral-400">Reasons</h3>
          <ul className="mt-2 space-y-1 text-sm text-neutral-200">
            {latest_health.reasons.map((r, i) => (
              <li key={i}>
                <span className="font-mono text-xs text-neutral-400">{r.code}:</span> {r.detail}
                {r.narrative && <div className="text-xs text-neutral-400 italic">{r.narrative}</div>}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Action buttons */}
      <div className="mt-6 grid grid-cols-2 gap-2 md:grid-cols-4 lg:grid-cols-7">
        <ActionButton
          label="Kickoff"
          icon={<Rocket size={14} />}
          running={runningAction === "kickoff"}
          onClick={() => runAction("kickoff")}
        />
        <ActionButton
          label="Auto-resource"
          icon={<UserPlus size={14} />}
          running={runningAction === "auto-resource"}
          onClick={() => {
            const req = prompt("What skills/requirements do you need? (comma-separated)");
            if (!req) return;
            runAction("auto-resource", { body: { requirements: req } });
          }}
        />
        <ActionButton
          label="Scope check"
          icon={<ScanLine size={14} />}
          running={runningAction === "scope-creep"}
          onClick={() => runAction("scope-creep", { path: "/api/cron/scope-creep" })}
        />
        <ActionButton
          label="Health refresh"
          icon={<Activity size={14} />}
          running={runningAction === "project-health"}
          onClick={() => runAction("project-health", { path: "/api/cron/project-health" })}
        />
        <ActionButton
          label="Delegate"
          icon={<Users size={14} />}
          running={runningAction === "delegate"}
          onClick={() => {
            const unassigned = tasks.find((t) => !t.assignee_id && t.status !== "done");
            if (!unassigned) { toast("No unassigned open tasks"); return; }
            runAction("delegate", { body: { task_id: unassigned.id } });
          }}
        />
        <ActionButton
          label="Weekly report"
          icon={<Mail size={14} />}
          running={runningAction === "weekly-reports"}
          onClick={() => runAction("weekly-reports", { path: "/api/cron/weekly-reports" })}
        />
        <ActionButton
          label="Post-mortem"
          icon={<FileText size={14} />}
          running={runningAction === "post-mortem"}
          disabled={project.status !== "complete"}
          onClick={() => runAction("post-mortem")}
        />
      </div>

      {/* Summary strip */}
      <div className="mt-6 grid grid-cols-3 gap-2 text-xs">
        <SummaryCell icon={<AlertTriangle size={12} />} label="Open scope flags" value={openFlags.length} />
        <SummaryCell icon={<Clock size={12} />} label="Overdue tasks" value={overdueTasks.length} />
        <SummaryCell icon={<ClipboardList size={12} />} label="Total tasks" value={tasks.length} />
      </div>

      {/* Scope flags */}
      <section className="mt-8">
        <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-neutral-300">
          <AlertTriangle size={14} /> Scope flags
          <span className="text-neutral-500">({openFlags.length} open)</span>
        </h2>
        {openFlags.length === 0 ? (
          <p className="mt-2 text-sm text-neutral-500">No open scope flags. Run a scope check above to scan.</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {openFlags.map((flag) => {
              const sev = SEVERITY_META[flag.severity];
              return (
                <li key={flag.id} className="rounded-lg border border-white/10 bg-neutral-900/50 p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span
                          className="rounded px-1.5 py-0.5 text-[10px] font-bold uppercase"
                          style={{ color: sev.color, background: sev.bg }}
                        >
                          {flag.severity}
                        </span>
                        <span className="text-xs font-mono text-neutral-400">{flag.flag_type}</span>
                      </div>
                      <p className="mt-1 text-sm text-neutral-200">{flag.description}</p>
                      <p className="mt-1 text-xs text-neutral-500">
                        {new Date(flag.created_at).toLocaleString()}
                      </p>
                    </div>
                    <button
                      onClick={() => resolveFlag(flag.id, true)}
                      className="shrink-0 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-2 py-1 text-xs font-semibold text-emerald-300 hover:bg-emerald-500/20"
                    >
                      <CheckCircle2 size={12} className="inline mr-1" /> Resolve
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* Weekly reports */}
      <section className="mt-8">
        <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-neutral-300">
          <Mail size={14} /> Weekly reports
        </h2>
        {weekly_reports.length === 0 ? (
          <p className="mt-2 text-sm text-neutral-500">No reports yet — generated automatically on Mondays.</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {weekly_reports.map((rep) => (
              <li key={rep.id} className="rounded-lg border border-white/10 bg-neutral-900/50 p-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold text-white">
                      Week of {new Date(rep.week_start).toLocaleDateString()}
                    </p>
                    <p className="text-xs text-neutral-400 capitalize">{rep.status}</p>
                  </div>
                  {rep.status === "draft" && (
                    <div className="flex gap-2">
                      <button
                        onClick={() => updateReport(rep.id, "sent")}
                        className="rounded-md border border-blue-500/30 bg-blue-500/10 px-2 py-1 text-xs font-semibold text-blue-300 hover:bg-blue-500/20"
                      >
                        <Send size={11} className="inline mr-1" /> Mark sent
                      </button>
                      <button
                        onClick={() => updateReport(rep.id, "skipped")}
                        className="rounded-md border border-white/10 bg-white/5 px-2 py-1 text-xs text-neutral-300 hover:bg-white/10"
                      >
                        <X size={11} className="inline mr-1" /> Skip
                      </button>
                    </div>
                  )}
                </div>
                <pre className="mt-2 max-h-64 overflow-auto whitespace-pre-wrap rounded bg-black/30 p-3 text-xs text-neutral-200">
                  {rep.content}
                </pre>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Latest post-mortem */}
      {latest_post_mortem && (
        <section className="mt-8">
          <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-neutral-300">
            <FileText size={14} /> Post-mortem
            <span className="text-xs text-neutral-500">
              ({latest_post_mortem.generated_by}, {new Date(latest_post_mortem.generated_at).toLocaleDateString()})
            </span>
          </h2>
          <pre className="mt-3 max-h-96 overflow-auto whitespace-pre-wrap rounded-lg border border-white/10 bg-neutral-900/50 p-4 text-sm text-neutral-200">
            {latest_post_mortem.content}
          </pre>
        </section>
      )}
    </div>
  );
}

function ActionButton({
  label,
  icon,
  onClick,
  running,
  disabled,
}: {
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
  running?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={running || disabled}
      className="flex items-center justify-center gap-1.5 rounded-md border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-neutral-200 transition hover:border-white/20 hover:bg-white/10 disabled:opacity-40"
    >
      {running ? <Loader2 size={12} className="animate-spin" /> : icon}
      {label}
    </button>
  );
}

function SummaryCell({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <div className="rounded-lg border border-white/10 bg-neutral-900/50 p-3">
      <div className="flex items-center gap-1 text-neutral-400">
        {icon}
        <span>{label}</span>
      </div>
      <div className="mt-1 text-xl font-bold text-white">{value}</div>
    </div>
  );
}
