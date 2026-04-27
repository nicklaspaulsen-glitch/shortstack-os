"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import toast from "react-hot-toast";
import {
  Bot,
  Plus,
  Globe,
  Clock,
  CheckCircle2,
  XCircle,
  Loader2,
  ChevronRight,
  Sparkles,
} from "lucide-react";
import PageHero from "@/components/ui/page-hero";

interface BrowserTask {
  id: string;
  goal: string;
  start_url: string | null;
  status: "queued" | "running" | "completed" | "failed" | "cancelled";
  steps_taken: number;
  max_steps: number;
  total_cost_usd: number;
  run_mode: string;
  schedule_kind: string;
  schedule_cron: string | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
  error_message: string | null;
}

interface BrowserTaskTemplate {
  id: string;
  name: string;
  description: string | null;
  goal_template: string;
  category: string | null;
  variables: Array<{ name: string; required?: boolean; kind: string }>;
}

const STATUS_STYLES: Record<BrowserTask["status"], { label: string; bg: string; fg: string; icon: React.ReactNode }> = {
  queued: { label: "Queued", bg: "bg-amber-500/15", fg: "text-amber-300", icon: <Clock size={12} /> },
  running: { label: "Running", bg: "bg-sky-500/15", fg: "text-sky-300", icon: <Loader2 size={12} className="animate-spin" /> },
  completed: { label: "Completed", bg: "bg-emerald-500/15", fg: "text-emerald-300", icon: <CheckCircle2 size={12} /> },
  failed: { label: "Failed", bg: "bg-rose-500/15", fg: "text-rose-300", icon: <XCircle size={12} /> },
  cancelled: { label: "Cancelled", bg: "bg-zinc-500/15", fg: "text-zinc-300", icon: <XCircle size={12} /> },
};

function fmtDate(d: string | null): string {
  if (!d) return "—";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(d));
}

function fmtCost(n: number): string {
  if (n === 0) return "$0.00";
  if (n < 0.01) return "<$0.01";
  return `$${n.toFixed(2)}`;
}

export default function BrowserTasksPage() {
  const [tasks, setTasks] = useState<BrowserTask[]>([]);
  const [templates, setTemplates] = useState<BrowserTaskTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [goal, setGoal] = useState("");
  const [startUrl, setStartUrl] = useState("");
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [templateValues, setTemplateValues] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [tasksRes, tplRes] = await Promise.all([
        fetch("/api/browser-tasks").then((r) => r.json()),
        fetch("/api/browser-task-templates").then((r) => r.json()),
      ]);
      if (Array.isArray(tasksRes.tasks)) setTasks(tasksRes.tasks);
      if (Array.isArray(tplRes.templates)) setTemplates(tplRes.templates);
    } catch (err) {
      console.error("[browser-tasks] load failed", err);
      toast.error("Failed to load browser tasks");
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
    // Auto-refresh every 5s while any task is running.
    const id = setInterval(() => {
      setTasks((prev) => {
        if (prev.some((t) => t.status === "running" || t.status === "queued")) {
          load();
        }
        return prev;
      });
    }, 5000);
    return () => clearInterval(id);
  }, [load]);

  const selectedTemplate = templates.find((t) => t.id === selectedTemplateId);

  async function submit() {
    if (submitting) return;
    if (!selectedTemplateId && !goal.trim()) {
      toast.error("Enter a goal or pick a template");
      return;
    }
    setSubmitting(true);
    try {
      const body: Record<string, unknown> = {};
      if (selectedTemplateId) {
        body.template_id = selectedTemplateId;
        body.template_values = templateValues;
      } else {
        body.goal = goal.trim();
        if (startUrl.trim()) body.start_url = startUrl.trim();
      }
      const res = await fetch("/api/browser-tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to create task");
      toast.success("Task queued");
      setGoal("");
      setStartUrl("");
      setSelectedTemplateId(null);
      setTemplateValues({});
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err));
    }
    setSubmitting(false);
  }

  return (
    <div className="space-y-6">
      <PageHero
        title="AI Browser Tasks"
        subtitle="Tell the agent what you want done. It drives a real browser to get it."
        gradient="purple"
        icon={<Bot size={28} />}
        eyebrow={
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-2.5 py-1 text-[11px] font-medium text-white/80 backdrop-blur">
            <Sparkles size={11} /> Beta — Playwright + Claude
          </span>
        }
      />

      {/* New task card */}
      <div className="rounded-xl border border-white/10 bg-zinc-900/60 p-5 backdrop-blur">
        <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-white/90">
          <Plus size={15} /> New task
        </div>

        {selectedTemplate ? (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-medium text-white/90">{selectedTemplate.name}</div>
                {selectedTemplate.description && (
                  <div className="text-xs text-white/60">{selectedTemplate.description}</div>
                )}
              </div>
              <button
                onClick={() => {
                  setSelectedTemplateId(null);
                  setTemplateValues({});
                }}
                className="text-xs text-white/60 hover:text-white"
              >
                Clear
              </button>
            </div>
            {selectedTemplate.variables.map((v) => (
              <label key={v.name} className="block">
                <span className="block text-xs font-medium text-white/70">
                  {v.name}
                  {v.required && <span className="text-rose-400"> *</span>}
                  <span className="ml-1 text-[10px] uppercase tracking-wide text-white/40">{v.kind}</span>
                </span>
                <input
                  type={v.kind === "number" ? "number" : v.kind === "url" ? "url" : "text"}
                  value={templateValues[v.name] ?? ""}
                  onChange={(e) =>
                    setTemplateValues((prev) => ({ ...prev, [v.name]: e.target.value }))
                  }
                  className="mt-1 w-full rounded-md border border-white/10 bg-black/30 px-3 py-2 text-sm text-white placeholder-white/30 focus:border-purple-400/50 focus:outline-none"
                  placeholder={`{{${v.name}}}`}
                />
              </label>
            ))}
          </div>
        ) : (
          <div className="space-y-3">
            <label className="block">
              <span className="block text-xs font-medium text-white/70">Goal</span>
              <textarea
                value={goal}
                onChange={(e) => setGoal(e.target.value)}
                rows={3}
                placeholder="Visit example.com/pricing and extract every tier as JSON…"
                className="mt-1 w-full rounded-md border border-white/10 bg-black/30 px-3 py-2 text-sm text-white placeholder-white/30 focus:border-purple-400/50 focus:outline-none"
              />
            </label>
            <label className="block">
              <span className="block text-xs font-medium text-white/70">Start URL (optional)</span>
              <input
                type="url"
                value={startUrl}
                onChange={(e) => setStartUrl(e.target.value)}
                placeholder="https://example.com"
                className="mt-1 w-full rounded-md border border-white/10 bg-black/30 px-3 py-2 text-sm text-white placeholder-white/30 focus:border-purple-400/50 focus:outline-none"
              />
            </label>
          </div>
        )}

        <div className="mt-4 flex items-center justify-end gap-2">
          <button
            onClick={submit}
            disabled={submitting}
            className="inline-flex items-center gap-1.5 rounded-md bg-gradient-to-br from-purple-500 to-fuchsia-500 px-4 py-2 text-sm font-semibold text-white shadow-md shadow-purple-500/30 transition hover:from-purple-400 hover:to-fuchsia-400 disabled:opacity-50"
          >
            {submitting ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
            Queue task
          </button>
        </div>
      </div>

      {/* Templates */}
      {templates.length > 0 && (
        <div className="rounded-xl border border-white/10 bg-zinc-900/40 p-5 backdrop-blur">
          <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-white/90">
            <Sparkles size={15} /> Try a template
          </div>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
            {templates.map((t) => (
              <button
                key={t.id}
                onClick={() => {
                  setSelectedTemplateId(t.id);
                  setTemplateValues({});
                }}
                className={`group rounded-lg border p-3 text-left transition ${
                  selectedTemplateId === t.id
                    ? "border-purple-400/60 bg-purple-500/10"
                    : "border-white/10 bg-black/30 hover:border-white/20 hover:bg-black/40"
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="text-sm font-medium text-white/90">{t.name}</div>
                  {t.category && (
                    <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] uppercase tracking-wide text-white/60">
                      {t.category.replace("_", " ")}
                    </span>
                  )}
                </div>
                {t.description && (
                  <div className="mt-1 text-xs text-white/60 line-clamp-2">{t.description}</div>
                )}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Task list */}
      <div className="rounded-xl border border-white/10 bg-zinc-900/40 backdrop-blur">
        <div className="flex items-center gap-2 border-b border-white/10 px-5 py-3 text-sm font-semibold text-white/90">
          <Globe size={15} /> Tasks
          <span className="ml-2 rounded-full bg-white/10 px-2 py-0.5 text-[10px] text-white/60">
            {tasks.length}
          </span>
        </div>
        {loading ? (
          <div className="flex items-center justify-center px-5 py-10 text-sm text-white/50">
            <Loader2 size={16} className="mr-2 animate-spin" /> Loading…
          </div>
        ) : tasks.length === 0 ? (
          <div className="px-5 py-10 text-center text-sm text-white/50">
            No tasks yet. Queue your first one above.
          </div>
        ) : (
          <ul className="divide-y divide-white/5">
            {tasks.map((t) => {
              const status = STATUS_STYLES[t.status];
              return (
                <li key={t.id}>
                  <Link
                    href={`/dashboard/automations/browser-tasks/${t.id}`}
                    className="flex items-center gap-3 px-5 py-3 hover:bg-white/5"
                  >
                    <span
                      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ${status.bg} ${status.fg}`}
                    >
                      {status.icon} {status.label}
                    </span>
                    <span className="flex-1 truncate text-sm text-white/90">{t.goal}</span>
                    <span className="hidden text-xs text-white/50 md:inline">
                      {t.steps_taken}/{t.max_steps} steps
                    </span>
                    <span className="hidden text-xs text-white/50 md:inline">{fmtCost(t.total_cost_usd)}</span>
                    <span className="hidden text-xs text-white/50 lg:inline">{fmtDate(t.created_at)}</span>
                    <ChevronRight size={14} className="text-white/40" />
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
