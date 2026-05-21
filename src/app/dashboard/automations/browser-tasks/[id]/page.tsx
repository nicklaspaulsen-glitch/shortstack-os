"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import toast from "react-hot-toast";
import {
  Bot,
  ArrowLeft,
  Loader2,
  CheckCircle2,
  XCircle,
  Clock,
  RefreshCw,
  Trash2,
  Play,
  Globe,
  ExternalLink,
} from "lucide-react";
import { MotionPage } from "@/components/motion/motion-page";

interface RecordingEntry {
  step: number;
  screenshot_r2_key: string | null;
  tool_name: string;
  tool_input: Record<string, unknown>;
  reasoning?: string;
  cost_usd: number;
  ts: string;
}

interface BrowserTask {
  id: string;
  goal: string;
  start_url: string | null;
  status: "queued" | "running" | "completed" | "failed" | "cancelled";
  result_text: string | null;
  result_data: Record<string, unknown> | null;
  steps_taken: number;
  max_steps: number;
  total_cost_usd: number;
  run_mode: string;
  recordings: RecordingEntry[];
  error_message: string | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
}

const STATUS_STYLES: Record<BrowserTask["status"], { label: string; bg: string; fg: string; icon: React.ReactNode }> = {
  queued: { label: "Queued", bg: "bg-amber-500/15", fg: "text-amber-400", icon: <Clock size={14} /> },
  running: { label: "Running", bg: "bg-sky-500/15", fg: "text-sky-400", icon: <Loader2 size={14} className="animate-spin" /> },
  completed: { label: "Completed", bg: "bg-emerald-500/15", fg: "text-emerald-400", icon: <CheckCircle2 size={14} /> },
  failed: { label: "Failed", bg: "bg-rose-500/15", fg: "text-rose-400", icon: <XCircle size={14} /> },
  cancelled: { label: "Cancelled", bg: "bg-zinc-500/15", fg: "text-zinc-400", icon: <XCircle size={14} /> },
};

function fmtDate(d: string | null): string {
  if (!d) return "—";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
  }).format(new Date(d));
}

function r2Url(key: string | null): string | null {
  if (!key) return null;
  const base = process.env.NEXT_PUBLIC_R2_PUBLIC_URL ?? "";
  if (!base) return null;
  return `${base.replace(/\/$/, "")}/${key}`;
}

export default function BrowserTaskDetailPage() {
  const params = useParams();
  const id = params?.id ?? null;
  const [task, setTask] = useState<BrowserTask | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!id) return;
    try {
      const res = await fetch(`/api/browser-tasks/${id}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to load");
      setTask(json.task as BrowserTask);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err));
    }
    setLoading(false);
  }, [id]);

  useEffect(() => {
    load();
    const interval = setInterval(() => {
      setTask((prev) => {
        if (prev?.status === "running" || prev?.status === "queued") {
          load();
        }
        return prev;
      });
    }, 3000);
    return () => clearInterval(interval);
  }, [load]);

  async function rerun() {
    if (!id) return;
    setBusy("rerun");
    try {
      const res = await fetch(`/api/browser-tasks/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "queued" }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed");
      toast.success("Re-queued");
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err));
    }
    setBusy(null);
  }

  async function cancel() {
    if (!id) return;
    setBusy("cancel");
    try {
      const res = await fetch(`/api/browser-tasks/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "cancelled" }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed");
      toast.success("Cancelled");
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err));
    }
    setBusy(null);
  }

  async function runNow() {
    if (!id) return;
    setBusy("run");
    try {
      const res = await fetch(`/api/browser-tasks/${id}/run`, { method: "POST" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed");
      toast.success("Run complete");
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err));
    }
    setBusy(null);
  }

  async function remove() {
    if (!id) return;
    if (!confirm("Delete this task and all step recordings?")) return;
    setBusy("delete");
    try {
      const res = await fetch(`/api/browser-tasks/${id}`, { method: "DELETE" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed");
      toast.success("Deleted");
      window.location.href = "/dashboard/automations/browser-tasks";
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err));
    }
    setBusy(null);
  }

  if (loading) {
    return (
      <MotionPage className="flex items-center justify-center py-20 text-sm text-text-muted"><Loader2 size={18} className="mr-2 animate-spin" />Loading task…
              </MotionPage>
    );
  }

  if (!task) {
    return (
      <div className="glass rounded-lg p-10 text-center text-text-muted">
        Task not found.{" "}
        <Link href="/dashboard/automations/browser-tasks" className="text-indigo-400 hover:underline">
          Back to list
        </Link>
      </div>
    );
  }

  const status = STATUS_STYLES[task.status];
  const recordings = task.recordings ?? [];
  const lastRec = recordings.length > 0 ? recordings[recordings.length - 1] : null;
  const isLive = task.status === "running" || task.status === "queued";

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/dashboard/automations/browser-tasks"
          className="mb-3 inline-flex items-center gap-1 text-xs text-text-muted hover:text-text-primary"
        >
          <ArrowLeft size={12} /> All tasks
        </Link>
        {/* -- Task Run command strip -- */}
        <div className="flex items-center justify-between gap-4 px-1 py-3 sm:py-4">
          <div className="min-w-0">
            <p className="font-editorial text-[11px] italic text-text-muted mb-0.5">Execution Log</p>
            <h1 className="font-display text-xl sm:text-2xl font-bold tracking-tight text-text-primary leading-none">Task Run</h1>
          </div>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <div className="glass rounded-lg p-4">
          <div className="text-[10px] uppercase tracking-wide text-text-muted">Steps</div>
          <div className="mt-1 text-lg font-semibold text-text-primary">
            {task.steps_taken} / {task.max_steps}
          </div>
        </div>
        <div className="glass rounded-lg p-4">
          <div className="text-[10px] uppercase tracking-wide text-text-muted">Cost</div>
          <div className="mt-1 text-lg font-semibold text-text-primary">
            ${task.total_cost_usd.toFixed(4)}
          </div>
        </div>
        <div className="glass rounded-lg p-4">
          <div className="text-[10px] uppercase tracking-wide text-text-muted">Mode</div>
          <div className="mt-1 text-sm font-medium text-text-secondary">{task.run_mode}</div>
        </div>
        <div className="glass rounded-lg p-4">
          <div className="text-[10px] uppercase tracking-wide text-text-muted">Started</div>
          <div className="mt-1 text-sm font-medium text-text-secondary">{fmtDate(task.started_at)}</div>
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex flex-wrap items-center gap-2">
        {task.status !== "running" && (
          <button
            onClick={runNow}
            disabled={!!busy}
            className="inline-flex items-center gap-1.5 rounded-md bg-emerald-500/20 px-3 py-1.5 text-xs font-medium text-emerald-400 hover:bg-emerald-500/30 disabled:opacity-50"
          >
            {busy === "run" ? <Loader2 size={12} className="animate-spin" /> : <Play size={12} />}
            Run now
          </button>
        )}
        {task.status !== "running" && task.status !== "queued" && (
          <button
            onClick={rerun}
            disabled={!!busy}
            className="inline-flex items-center gap-1.5 rounded-md bg-white/5 px-3 py-1.5 text-xs font-medium text-text-secondary hover:bg-white/10 disabled:opacity-50"
          >
            <RefreshCw size={12} /> Re-queue
          </button>
        )}
        {(task.status === "running" || task.status === "queued") && (
          <button
            onClick={cancel}
            disabled={!!busy}
            className="inline-flex items-center gap-1.5 rounded-md bg-rose-500/20 px-3 py-1.5 text-xs font-medium text-rose-400 hover:bg-rose-500/30 disabled:opacity-50"
          >
            <XCircle size={12} /> Cancel
          </button>
        )}
        <button
          onClick={remove}
          disabled={!!busy}
          className="ml-auto inline-flex items-center gap-1.5 rounded-md bg-white/5 px-3 py-1.5 text-xs font-medium text-text-muted hover:bg-rose-500/10 hover:text-rose-400 disabled:opacity-50"
        >
          <Trash2 size={12} /> Delete
        </button>
      </div>

      {/* Live tail when running */}
      {isLive && lastRec && (
        <div className="rounded-xl border border-sky-500/30 bg-sky-500/5 p-5">
          <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-sky-400">
            <Loader2 size={14} className="animate-spin" /> Live — step {lastRec.step + 1}
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {r2Url(lastRec.screenshot_r2_key) ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={r2Url(lastRec.screenshot_r2_key) ?? ""}
                alt={`Step ${lastRec.step + 1} screenshot`}
                className="rounded-md border border-white/10"
              />
            ) : (
              <div className="rounded-md border border-border-subtle bg-surface-2 p-4 text-xs text-text-muted">
                Screenshot unavailable
              </div>
            )}
            <div className="text-xs text-text-secondary">
              <div className="mb-1 font-medium text-text-primary">{lastRec.tool_name}</div>
              <pre className="max-h-72 overflow-auto rounded bg-surface-2 p-2 text-[11px] text-text-muted border border-border-subtle">
                {JSON.stringify(lastRec.tool_input, null, 2)}
              </pre>
              {lastRec.reasoning && (
                <div className="mt-2 italic text-text-muted">{lastRec.reasoning}</div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Final result */}
      {task.status === "completed" && task.result_text && (
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-5">
          <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-emerald-400">
            <CheckCircle2 size={14} /> Result
          </div>
          <div className="text-sm text-text-primary whitespace-pre-wrap">{task.result_text}</div>
          {task.result_data && (
            <pre className="mt-3 max-h-96 overflow-auto rounded bg-surface-2 p-3 text-[11px] text-text-muted border border-border-subtle">
              {JSON.stringify(task.result_data, null, 2)}
            </pre>
          )}
        </div>
      )}

      {task.status === "failed" && task.error_message && (
        <div className="rounded-xl border border-rose-500/30 bg-rose-500/5 p-5">
          <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-rose-400">
            <XCircle size={14} /> Error
          </div>
          <div className="text-sm text-text-primary">{task.error_message}</div>
        </div>
      )}

      {/* Step timeline */}
      <div className="glass rounded-xl">
        <div className="flex items-center gap-2 border-b border-border-subtle px-5 py-3 text-sm font-semibold text-text-primary">
          <Globe size={15} /> Step timeline
          <span className="ml-2 rounded-full bg-white/5 px-2 py-0.5 text-[10px] text-text-muted">
            {recordings.length}
          </span>
        </div>
        {recordings.length === 0 ? (
          <div className="px-5 py-8 text-center text-sm text-text-muted">No steps yet.</div>
        ) : (
          <ul className="divide-y divide-white/8">
            {recordings.map((r) => {
              const url = r2Url(r.screenshot_r2_key);
              return (
                <li key={r.step} className="px-5 py-4">
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                    <div className="md:col-span-1">
                      {url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={url}
                          alt={`Step ${r.step + 1}`}
                          className="rounded-md border border-white/10"
                        />
                      ) : (
                        <div className="rounded-md border border-border-subtle bg-surface-2 p-3 text-xs text-text-muted">
                          (no screenshot)
                        </div>
                      )}
                      {url && (
                        <a
                          href={url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="mt-1 inline-flex items-center gap-1 text-[11px] text-text-muted hover:text-text-primary"
                        >
                          <ExternalLink size={10} /> open full
                        </a>
                      )}
                    </div>
                    <div className="md:col-span-2 text-sm text-text-secondary">
                      <div className="flex items-center gap-2 text-xs text-text-muted">
                        <span className="font-mono text-[11px] text-text-muted">
                          step {String(r.step + 1).padStart(2, "0")}
                        </span>
                        <span>·</span>
                        <span className="rounded bg-white/8 px-1.5 py-0.5 font-mono text-[10px]">
                          {r.tool_name}
                        </span>
                        <span>·</span>
                        <span>${r.cost_usd.toFixed(4)}</span>
                      </div>
                      {r.reasoning && (
                        <div className="mt-2 italic text-text-muted">{r.reasoning}</div>
                      )}
                      <pre className="mt-2 max-h-56 overflow-auto rounded bg-surface-2 p-2 text-[11px] text-text-muted border border-border-subtle">
                        {JSON.stringify(r.tool_input, null, 2)}
                      </pre>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
