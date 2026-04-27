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
import PageHero from "@/components/ui/page-hero";

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
  queued: { label: "Queued", bg: "bg-amber-500/15", fg: "text-amber-300", icon: <Clock size={14} /> },
  running: { label: "Running", bg: "bg-sky-500/15", fg: "text-sky-300", icon: <Loader2 size={14} className="animate-spin" /> },
  completed: { label: "Completed", bg: "bg-emerald-500/15", fg: "text-emerald-300", icon: <CheckCircle2 size={14} /> },
  failed: { label: "Failed", bg: "bg-rose-500/15", fg: "text-rose-300", icon: <XCircle size={14} /> },
  cancelled: { label: "Cancelled", bg: "bg-zinc-500/15", fg: "text-zinc-300", icon: <XCircle size={14} /> },
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
      <div className="flex items-center justify-center py-20 text-sm text-white/60">
        <Loader2 size={18} className="mr-2 animate-spin" /> Loading task…
      </div>
    );
  }

  if (!task) {
    return (
      <div className="rounded-lg border border-white/10 bg-zinc-900/40 p-10 text-center text-white/60">
        Task not found.{" "}
        <Link href="/dashboard/automations/browser-tasks" className="text-purple-300 hover:underline">
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
          className="mb-3 inline-flex items-center gap-1 text-xs text-white/60 hover:text-white"
        >
          <ArrowLeft size={12} /> All tasks
        </Link>
        <PageHero
          title="Task Run"
          subtitle={task.goal}
          gradient="purple"
          icon={<Bot size={28} />}
          eyebrow={
            <span
              className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium ${status.bg} ${status.fg}`}
            >
              {status.icon} {status.label}
            </span>
          }
        />
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <div className="rounded-lg border border-white/10 bg-zinc-900/40 p-4">
          <div className="text-[10px] uppercase tracking-wide text-white/50">Steps</div>
          <div className="mt-1 text-lg font-semibold text-white">
            {task.steps_taken} / {task.max_steps}
          </div>
        </div>
        <div className="rounded-lg border border-white/10 bg-zinc-900/40 p-4">
          <div className="text-[10px] uppercase tracking-wide text-white/50">Cost</div>
          <div className="mt-1 text-lg font-semibold text-white">
            ${task.total_cost_usd.toFixed(4)}
          </div>
        </div>
        <div className="rounded-lg border border-white/10 bg-zinc-900/40 p-4">
          <div className="text-[10px] uppercase tracking-wide text-white/50">Mode</div>
          <div className="mt-1 text-sm font-medium text-white">{task.run_mode}</div>
        </div>
        <div className="rounded-lg border border-white/10 bg-zinc-900/40 p-4">
          <div className="text-[10px] uppercase tracking-wide text-white/50">Started</div>
          <div className="mt-1 text-sm font-medium text-white">{fmtDate(task.started_at)}</div>
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex flex-wrap items-center gap-2">
        {task.status !== "running" && (
          <button
            onClick={runNow}
            disabled={!!busy}
            className="inline-flex items-center gap-1.5 rounded-md bg-emerald-500/20 px-3 py-1.5 text-xs font-medium text-emerald-300 hover:bg-emerald-500/30 disabled:opacity-50"
          >
            {busy === "run" ? <Loader2 size={12} className="animate-spin" /> : <Play size={12} />}
            Run now
          </button>
        )}
        {task.status !== "running" && task.status !== "queued" && (
          <button
            onClick={rerun}
            disabled={!!busy}
            className="inline-flex items-center gap-1.5 rounded-md bg-white/10 px-3 py-1.5 text-xs font-medium text-white/80 hover:bg-white/15 disabled:opacity-50"
          >
            <RefreshCw size={12} /> Re-queue
          </button>
        )}
        {(task.status === "running" || task.status === "queued") && (
          <button
            onClick={cancel}
            disabled={!!busy}
            className="inline-flex items-center gap-1.5 rounded-md bg-rose-500/20 px-3 py-1.5 text-xs font-medium text-rose-300 hover:bg-rose-500/30 disabled:opacity-50"
          >
            <XCircle size={12} /> Cancel
          </button>
        )}
        <button
          onClick={remove}
          disabled={!!busy}
          className="ml-auto inline-flex items-center gap-1.5 rounded-md bg-white/5 px-3 py-1.5 text-xs font-medium text-white/60 hover:bg-rose-500/20 hover:text-rose-300 disabled:opacity-50"
        >
          <Trash2 size={12} /> Delete
        </button>
      </div>

      {/* Live tail when running */}
      {isLive && lastRec && (
        <div className="rounded-xl border border-sky-500/30 bg-sky-500/5 p-5">
          <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-sky-200">
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
              <div className="rounded-md border border-white/10 bg-black/30 p-4 text-xs text-white/40">
                Screenshot unavailable
              </div>
            )}
            <div className="text-xs text-white/80">
              <div className="mb-1 font-medium text-white">{lastRec.tool_name}</div>
              <pre className="max-h-72 overflow-auto rounded bg-black/40 p-2 text-[11px] text-white/70">
                {JSON.stringify(lastRec.tool_input, null, 2)}
              </pre>
              {lastRec.reasoning && (
                <div className="mt-2 italic text-white/60">{lastRec.reasoning}</div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Final result */}
      {task.status === "completed" && task.result_text && (
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-5">
          <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-emerald-200">
            <CheckCircle2 size={14} /> Result
          </div>
          <div className="text-sm text-white/90 whitespace-pre-wrap">{task.result_text}</div>
          {task.result_data && (
            <pre className="mt-3 max-h-96 overflow-auto rounded bg-black/40 p-3 text-[11px] text-white/70">
              {JSON.stringify(task.result_data, null, 2)}
            </pre>
          )}
        </div>
      )}

      {task.status === "failed" && task.error_message && (
        <div className="rounded-xl border border-rose-500/30 bg-rose-500/5 p-5">
          <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-rose-200">
            <XCircle size={14} /> Error
          </div>
          <div className="text-sm text-white/90">{task.error_message}</div>
        </div>
      )}

      {/* Step timeline */}
      <div className="rounded-xl border border-white/10 bg-zinc-900/40">
        <div className="flex items-center gap-2 border-b border-white/10 px-5 py-3 text-sm font-semibold text-white/90">
          <Globe size={15} /> Step timeline
          <span className="ml-2 rounded-full bg-white/10 px-2 py-0.5 text-[10px] text-white/60">
            {recordings.length}
          </span>
        </div>
        {recordings.length === 0 ? (
          <div className="px-5 py-8 text-center text-sm text-white/50">No steps yet.</div>
        ) : (
          <ul className="divide-y divide-white/5">
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
                        <div className="rounded-md border border-white/10 bg-black/30 p-3 text-xs text-white/40">
                          (no screenshot)
                        </div>
                      )}
                      {url && (
                        <a
                          href={url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="mt-1 inline-flex items-center gap-1 text-[11px] text-white/50 hover:text-white"
                        >
                          <ExternalLink size={10} /> open full
                        </a>
                      )}
                    </div>
                    <div className="md:col-span-2 text-sm text-white/85">
                      <div className="flex items-center gap-2 text-xs text-white/60">
                        <span className="font-mono text-[11px] text-white/50">
                          step {String(r.step + 1).padStart(2, "0")}
                        </span>
                        <span>·</span>
                        <span className="rounded bg-white/10 px-1.5 py-0.5 font-mono text-[10px]">
                          {r.tool_name}
                        </span>
                        <span>·</span>
                        <span>${r.cost_usd.toFixed(4)}</span>
                      </div>
                      {r.reasoning && (
                        <div className="mt-2 italic text-white/70">{r.reasoning}</div>
                      )}
                      <pre className="mt-2 max-h-56 overflow-auto rounded bg-black/40 p-2 text-[11px] text-white/70">
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
