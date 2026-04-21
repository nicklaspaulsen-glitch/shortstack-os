"use client";

/**
 * Triggers — the "when X happens, do Y" entry points for workflows.
 *
 * Users pick a workflow + an event type (e.g. tag_added) + an optional
 * filter config, and every time that event fires for their account,
 * the workflow auto-runs. Full catalog of 12 trigger types in
 * src/lib/workflows/trigger-dispatch.ts.
 *
 * This page is the CRUD + history view. Foundation routes live at
 * /api/triggers (list/create/update/delete) and /api/triggers/fire.
 * See src/lib/workflows/trigger-dispatch.ts for dispatch logic.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Zap,
  Plus,
  Play,
  Pause,
  Trash2,
  Loader,
  Clock,
  Check,
  X,
  AlertCircle,
  Activity,
  ArrowLeft,
  Workflow,
  ChevronDown,
  ChevronUp,
  Webhook,
  Mail,
  MousePointerClick,
  Tag,
  CalendarCheck,
  TrendingUp,
  FileText,
  Hand,
  CalendarClock,
  Sparkles,
  type LucideIcon,
} from "lucide-react";
import toast from "react-hot-toast";
import { useAuth } from "@/lib/auth-context";
import PageHero from "@/components/ui/page-hero";

// ───────────────────────────────────────────────────────────────────
// Trigger catalog — mirrors TriggerType in src/lib/workflows/
// ───────────────────────────────────────────────────────────────────

interface TriggerMeta {
  id: string;
  label: string;
  description: string;
  icon: LucideIcon;
  tint: string;
  /** JSON filter keys surfaced in the UI for this trigger. Empty = no filter. */
  filterFields?: Array<{ key: string; label: string; placeholder: string }>;
}

const TRIGGER_CATALOG: TriggerMeta[] = [
  {
    id: "form_submitted",
    label: "Form submitted",
    description: "Fires when a visitor submits any form on your site or landing page.",
    icon: FileText,
    tint: "text-emerald-300 bg-emerald-500/15",
    filterFields: [{ key: "form_id", label: "Form ID (optional)", placeholder: "Leave blank = any form" }],
  },
  {
    id: "email_opened",
    label: "Email opened",
    description: "Recipient opened an email you sent.",
    icon: Mail,
    tint: "text-sky-300 bg-sky-500/15",
    filterFields: [{ key: "campaign_id", label: "Campaign ID (optional)", placeholder: "Any email campaign" }],
  },
  {
    id: "email_clicked",
    label: "Email link clicked",
    description: "Recipient clicked a link inside an email.",
    icon: MousePointerClick,
    tint: "text-indigo-300 bg-indigo-500/15",
    filterFields: [{ key: "campaign_id", label: "Campaign ID (optional)", placeholder: "Any campaign" }],
  },
  {
    id: "email_replied",
    label: "Email replied",
    description: "Recipient replied to your email.",
    icon: Mail,
    tint: "text-blue-300 bg-blue-500/15",
  },
  {
    id: "link_clicked",
    label: "Tracked link clicked",
    description: "A tracked shortlink was clicked.",
    icon: MousePointerClick,
    tint: "text-cyan-300 bg-cyan-500/15",
    filterFields: [{ key: "link_id", label: "Link ID (optional)", placeholder: "Any tracked link" }],
  },
  {
    id: "tag_added",
    label: "Tag added",
    description: "A specific tag was added to a lead or client in your CRM.",
    icon: Tag,
    tint: "text-amber-300 bg-amber-500/15",
    filterFields: [
      { key: "tag", label: "Tag name (optional)", placeholder: "e.g. hot-lead" },
      { key: "entity", label: "Applies to", placeholder: "lead | client | deal" },
    ],
  },
  {
    id: "tag_removed",
    label: "Tag removed",
    description: "A tag was removed from a lead or client.",
    icon: Tag,
    tint: "text-orange-300 bg-orange-500/15",
    filterFields: [
      { key: "tag", label: "Tag name (optional)", placeholder: "e.g. cold-lead" },
      { key: "entity", label: "Applies to", placeholder: "lead | client | deal" },
    ],
  },
  {
    id: "appointment_booked",
    label: "Appointment booked",
    description: "A lead or client booked on your calendar.",
    icon: CalendarCheck,
    tint: "text-green-300 bg-green-500/15",
  },
  {
    id: "pipeline_stage_changed",
    label: "Pipeline stage changed",
    description: "A deal moved from one stage to another.",
    icon: TrendingUp,
    tint: "text-purple-300 bg-purple-500/15",
    filterFields: [
      { key: "from_stage", label: "From stage (optional)", placeholder: "e.g. qualified" },
      { key: "to_stage", label: "To stage (optional)", placeholder: "e.g. won" },
    ],
  },
  {
    id: "webhook_received",
    label: "Webhook received",
    description: "An external service hit your custom webhook URL.",
    icon: Webhook,
    tint: "text-rose-300 bg-rose-500/15",
    filterFields: [{ key: "slug", label: "Webhook slug", placeholder: "e.g. zapier-inbound" }],
  },
  {
    id: "schedule",
    label: "Scheduled (cron)",
    description: "Fires on a recurring schedule, like every Monday at 9am.",
    icon: CalendarClock,
    tint: "text-violet-300 bg-violet-500/15",
    filterFields: [{ key: "cron", label: "Cron expression", placeholder: "0 9 * * mon" }],
  },
  {
    id: "manual",
    label: "Manual / API fire",
    description: "Only fires when you explicitly call /api/triggers/fire. Useful for testing.",
    icon: Hand,
    tint: "text-slate-300 bg-slate-500/15",
  },
];

interface WorkflowRow {
  id: string;
  name: string;
  active: boolean;
}

interface TriggerRow {
  id: string;
  workflow_id: string;
  trigger_type: string;
  config: Record<string, unknown>;
  is_active: boolean;
  last_fired_at: string | null;
  fire_count: number;
  created_at: string;
}

interface TriggerRun {
  id: string;
  trigger_id: string;
  workflow_id: string;
  status: string;
  payload: Record<string, unknown>;
  error: string | null;
  started_at: string;
  finished_at: string | null;
}

export default function TriggersPage() {
  useAuth();
  const [triggers, setTriggers] = useState<TriggerRow[]>([]);
  const [workflows, setWorkflows] = useState<WorkflowRow[]>([]);
  const [runs, setRuns] = useState<TriggerRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);
  const [showRuns, setShowRuns] = useState(false);

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [triggersRes, wfRes] = await Promise.all([
        fetch("/api/triggers"),
        // Workflows endpoint — fallback to empty list if it doesn't exist yet
        fetch("/api/workflows").catch(() => null),
      ]);
      const triggersData = await triggersRes.json();
      if (triggersData.ok) {
        setTriggers(triggersData.triggers || []);
      } else {
        toast.error(triggersData.error || "Failed to load triggers");
      }

      if (wfRes && wfRes.ok) {
        const wfData = await wfRes.json();
        setWorkflows(wfData.workflows || wfData.data || []);
      }
    } catch (err) {
      console.error("[triggers] load failed:", err);
      toast.error("Failed to load triggers");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  async function toggleActive(trigger: TriggerRow) {
    const next = !trigger.is_active;
    setTriggers((ts) => ts.map((t) => (t.id === trigger.id ? { ...t, is_active: next } : t)));
    try {
      const res = await fetch("/api/triggers", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: trigger.id, is_active: next }),
      });
      const data = await res.json();
      if (!data.ok) {
        toast.error(data.error || "Toggle failed");
        // Revert optimistic update
        setTriggers((ts) => ts.map((t) => (t.id === trigger.id ? { ...t, is_active: !next } : t)));
      } else {
        toast.success(next ? "Trigger enabled" : "Trigger paused");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Toggle failed");
    }
  }

  async function deleteTrigger(trigger: TriggerRow) {
    if (!window.confirm("Delete this trigger? Any workflows it fires won't auto-run any more (the workflows themselves stay).")) {
      return;
    }
    try {
      const res = await fetch(`/api/triggers?id=${trigger.id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        toast.error(data.error || "Delete failed");
        return;
      }
      setTriggers((ts) => ts.filter((t) => t.id !== trigger.id));
      toast.success("Trigger deleted");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Delete failed");
    }
  }

  async function loadRuns() {
    setShowRuns(true);
    try {
      // /api/triggers/runs may not exist yet — empty state handles gracefully.
      const res = await fetch("/api/triggers/runs").catch(() => null);
      if (res && res.ok) {
        const data = await res.json();
        setRuns(data.runs || []);
      }
    } catch (err) {
      console.error("[triggers] loadRuns failed:", err);
    }
  }

  async function fireManual(trigger: TriggerRow) {
    try {
      toast.loading("Firing trigger…", { id: "fire-trigger" });
      const res = await fetch("/api/triggers/fire", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          trigger_type: trigger.trigger_type,
          payload: trigger.config || {},
        }),
      });
      const data = await res.json();
      toast.dismiss("fire-trigger");
      if (data.ok) {
        toast.success(`Fired — matched ${data.matched} trigger${data.matched === 1 ? "" : "s"}`);
        loadAll();
      } else {
        toast.error(data.error || "Fire failed");
      }
    } catch (err) {
      toast.dismiss("fire-trigger");
      toast.error(err instanceof Error ? err.message : "Fire failed");
    }
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <PageHero
        title="Triggers"
        subtitle="Fire workflows automatically when real-world events happen. 12 event types, filter each with JSON config, see every run in history."
        icon={<Zap size={20} />}
      />

      <div className="mx-auto max-w-5xl space-y-5 px-6 pb-10">
        {/* Top toolbar */}
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted">
            {loading
              ? "Loading…"
              : `${triggers.length} trigger${triggers.length === 1 ? "" : "s"} · ${triggers.filter((t) => t.is_active).length} active`}
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => (showRuns ? setShowRuns(false) : loadRuns())}
              className="inline-flex items-center gap-1.5 rounded-lg bg-surface-light/80 px-3 py-2 text-xs font-medium hover:bg-surface-light"
            >
              <Activity size={13} />
              {showRuns ? "Hide history" : "View history"}
            </button>
            <button
              onClick={() => setShowNew(true)}
              className="inline-flex items-center gap-1.5 rounded-lg bg-gold px-4 py-2 text-sm font-semibold text-black transition hover:bg-gold/90"
            >
              <Plus size={14} /> New trigger
            </button>
          </div>
        </div>

        {/* New trigger modal/form */}
        {showNew && (
          <NewTriggerForm
            workflows={workflows}
            onClose={() => setShowNew(false)}
            onCreated={() => {
              setShowNew(false);
              loadAll();
            }}
          />
        )}

        {/* List */}
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-muted">
            <Loader size={14} className="animate-spin" /> Loading triggers…
          </div>
        ) : triggers.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border/50 bg-surface-light/20 p-10 text-center">
            <Zap size={28} className="mx-auto mb-3 text-muted" />
            <h3 className="mb-1 text-base font-semibold">No triggers yet</h3>
            <p className="mx-auto mb-4 max-w-md text-sm text-muted">
              Triggers fire workflows automatically when events happen — like a form being submitted,
              a tag added to a lead, or an email opened.
            </p>
            <button
              onClick={() => setShowNew(true)}
              className="inline-flex items-center gap-1.5 rounded-lg bg-gold px-4 py-2 text-sm font-semibold text-black"
            >
              <Plus size={14} /> Create your first trigger
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            {triggers.map((t) => (
              <TriggerRowCard
                key={t.id}
                trigger={t}
                workflowName={workflows.find((w) => w.id === t.workflow_id)?.name}
                onToggle={() => toggleActive(t)}
                onDelete={() => deleteTrigger(t)}
                onFire={() => fireManual(t)}
              />
            ))}
          </div>
        )}

        {/* History panel */}
        {showRuns && (
          <div className="mt-6 rounded-xl border border-border/50 bg-surface-light/20 p-5">
            <h3 className="mb-3 text-sm font-semibold">Recent trigger runs</h3>
            {runs.length === 0 ? (
              <p className="text-xs text-muted">
                No runs yet. Once a trigger fires, the history shows up here with payload + status.
                (Endpoint <code className="text-[10px]">/api/triggers/runs</code> not yet implemented — tomorrow.)
              </p>
            ) : (
              <div className="space-y-2">
                {runs.map((r) => (
                  <div key={r.id} className="rounded-lg border border-border/30 bg-background/40 p-3 text-[12px]">
                    <div className="flex items-center justify-between">
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                          r.status === "completed"
                            ? "bg-emerald-500/15 text-emerald-300"
                            : r.status === "failed"
                              ? "bg-rose-500/15 text-rose-300"
                              : "bg-amber-500/15 text-amber-300"
                        }`}
                      >
                        {r.status}
                      </span>
                      <span className="text-muted">{new Date(r.started_at).toLocaleString()}</span>
                    </div>
                    {r.error && <p className="mt-1 text-rose-300">{r.error}</p>}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Help */}
        <div className="mt-8 rounded-xl border border-border/40 bg-background/40 p-5 text-[12px] text-muted">
          <p className="mb-2 font-semibold text-foreground">How triggers work</p>
          <ul className="ml-4 list-disc space-y-1">
            <li>Each trigger links ONE event type to ONE workflow.</li>
            <li>Config filters let you narrow further (e.g. only when tag = &quot;hot-lead&quot;).</li>
            <li>Fires are logged to history so you can debug if a workflow didn&apos;t run.</li>
            <li>
              Build the workflow first in <Link href="/dashboard/workflow-builder" className="text-gold underline">Workflow Builder</Link>,
              then come back here to set its trigger.
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────── */
/* Trigger row                                                     */
/* ─────────────────────────────────────────────────────────────── */

function TriggerRowCard({
  trigger,
  workflowName,
  onToggle,
  onDelete,
  onFire,
}: {
  trigger: TriggerRow;
  workflowName: string | undefined;
  onToggle: () => void;
  onDelete: () => void;
  onFire: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const meta = TRIGGER_CATALOG.find((t) => t.id === trigger.trigger_type);
  const Icon = meta?.icon || Zap;

  return (
    <div className="rounded-lg border border-border/50 bg-surface-light/20 transition hover:border-gold/40">
      <div className="flex items-center gap-3 p-3">
        <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${meta?.tint || "bg-muted/20"}`}>
          <Icon size={16} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="truncate text-sm font-semibold">{meta?.label || trigger.trigger_type}</p>
            <span
              className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                trigger.is_active
                  ? "bg-emerald-500/15 text-emerald-300"
                  : "bg-muted/20 text-muted"
              }`}
            >
              {trigger.is_active ? "Active" : "Paused"}
            </span>
          </div>
          <p className="truncate text-[11px] text-muted">
            → <Workflow size={10} className="inline" /> {workflowName || "(workflow deleted)"}
            {trigger.fire_count > 0 && (
              <span className="ml-2">
                · fired {trigger.fire_count}×{trigger.last_fired_at ? ` · last ${new Date(trigger.last_fired_at).toLocaleString()}` : ""}
              </span>
            )}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <button
            onClick={onFire}
            className="rounded bg-surface-light/80 px-2 py-1.5 text-[11px] text-muted hover:bg-surface-light hover:text-foreground"
            title="Fire this trigger manually (for testing)"
            aria-label="Fire this trigger manually for testing"
          >
            <Sparkles size={11} />
          </button>
          <button
            onClick={onToggle}
            className={`rounded px-2 py-1.5 text-[11px] ${
              trigger.is_active
                ? "bg-amber-500/15 text-amber-300 hover:bg-amber-500/25"
                : "bg-emerald-500/15 text-emerald-300 hover:bg-emerald-500/25"
            }`}
            title={trigger.is_active ? "Pause" : "Resume"}
            aria-label={trigger.is_active ? "Pause trigger" : "Resume trigger"}
          >
            {trigger.is_active ? <Pause size={11} /> : <Play size={11} />}
          </button>
          <button
            onClick={() => setExpanded(!expanded)}
            className="rounded bg-surface-light/80 px-2 py-1.5 text-muted hover:text-foreground"
            title="Show config"
            aria-label={expanded ? "Hide config" : "Show config"}
            aria-expanded={expanded}
          >
            {expanded ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
          </button>
          <button
            onClick={onDelete}
            className="rounded bg-rose-500/10 px-2 py-1.5 text-rose-300 hover:bg-rose-500/20"
            title="Delete"
            aria-label="Delete trigger"
          >
            <Trash2 size={11} />
          </button>
        </div>
      </div>
      {expanded && (
        <div className="border-t border-border/30 bg-background/40 p-3">
          <p className="mb-1 text-[10px] uppercase tracking-wider text-muted">Filter config</p>
          {Object.keys(trigger.config || {}).length === 0 ? (
            <p className="text-[11px] text-muted">No filter — fires on every matching event.</p>
          ) : (
            <pre className="overflow-x-auto rounded bg-black/40 p-2 text-[11px] text-foreground">
              {JSON.stringify(trigger.config, null, 2)}
            </pre>
          )}
        </div>
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────── */
/* Create form                                                     */
/* ─────────────────────────────────────────────────────────────── */

function NewTriggerForm({
  workflows,
  onClose,
  onCreated,
}: {
  workflows: WorkflowRow[];
  onClose: () => void;
  onCreated: () => void;
}) {
  const [selectedType, setSelectedType] = useState<string>("");
  const [workflowId, setWorkflowId] = useState<string>("");
  const [config, setConfig] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  const meta = useMemo(
    () => TRIGGER_CATALOG.find((t) => t.id === selectedType),
    [selectedType],
  );

  async function submit() {
    if (!selectedType) {
      toast.error("Pick an event type first");
      return;
    }
    if (!workflowId) {
      toast.error("Pick a workflow this trigger should run");
      return;
    }
    setSubmitting(true);
    try {
      // Strip empty config fields so filter stays clean
      const cleaned: Record<string, string> = {};
      for (const [k, v] of Object.entries(config)) {
        if (v && v.trim()) cleaned[k] = v.trim();
      }
      const res = await fetch("/api/triggers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workflow_id: workflowId,
          trigger_type: selectedType,
          config: cleaned,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        toast.error(data.error || "Create failed");
        return;
      }
      toast.success("Trigger created");
      onCreated();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Create failed");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="rounded-xl border border-gold/30 bg-gold/5 p-5">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button onClick={onClose} className="rounded p-1 text-muted hover:text-foreground" aria-label="Back to triggers list">
            <ArrowLeft size={14} />
          </button>
          <h3 className="text-base font-semibold">New trigger</h3>
        </div>
      </div>

      {/* Step 1: pick type */}
      <div className="mb-5">
        <p className="mb-2 text-[10px] uppercase tracking-wider text-muted">1. What event fires this?</p>
        <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2 md:grid-cols-3">
          {TRIGGER_CATALOG.map((t) => {
            const Icon = t.icon;
            const active = selectedType === t.id;
            return (
              <button
                key={t.id}
                onClick={() => {
                  setSelectedType(t.id);
                  setConfig({});
                }}
                className={`flex items-start gap-2 rounded-lg border p-2.5 text-left transition ${
                  active ? "border-gold bg-gold/10" : "border-border/50 hover:border-gold/40"
                }`}
                title={t.description}
              >
                <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md ${t.tint}`}>
                  <Icon size={13} />
                </div>
                <div className="min-w-0">
                  <p className="truncate text-[12px] font-semibold">{t.label}</p>
                  <p className="line-clamp-2 text-[10px] text-muted">{t.description}</p>
                </div>
                {active && <Check size={12} className="shrink-0 text-gold" />}
              </button>
            );
          })}
        </div>
      </div>

      {/* Step 2: pick workflow */}
      <div className="mb-5">
        <p className="mb-2 text-[10px] uppercase tracking-wider text-muted">2. Which workflow does it run?</p>
        {workflows.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border/50 p-4 text-center text-sm">
            <AlertCircle size={16} className="mx-auto mb-1 text-amber-400" />
            <p className="mb-2 text-muted">You have no workflows yet.</p>
            <Link
              href="/dashboard/workflow-builder"
              className="inline-flex items-center gap-1 rounded-lg bg-gold px-3 py-1.5 text-xs font-semibold text-black"
            >
              Build your first workflow →
            </Link>
          </div>
        ) : (
          <select
            value={workflowId}
            onChange={(e) => setWorkflowId(e.target.value)}
            className="w-full rounded-lg border border-border/50 bg-surface-light/40 px-3 py-2 text-sm"
          >
            <option value="">Choose a workflow…</option>
            {workflows.map((w) => (
              <option key={w.id} value={w.id}>
                {w.name} {!w.active && "(paused)"}
              </option>
            ))}
          </select>
        )}
      </div>

      {/* Step 3: optional filters */}
      {meta && meta.filterFields && meta.filterFields.length > 0 && (
        <div className="mb-5">
          <p className="mb-2 text-[10px] uppercase tracking-wider text-muted">3. Filters (optional)</p>
          <p className="mb-2 text-[11px] text-muted">
            Leave blank to fire on every event. Add values to narrow — e.g. only fire when the tag is specifically &quot;hot-lead&quot;.
          </p>
          <div className="space-y-2">
            {meta.filterFields.map((f) => (
              <div key={f.key}>
                <label className="mb-0.5 block text-[10px] uppercase tracking-wider text-muted">
                  {f.label}
                </label>
                <input
                  type="text"
                  value={config[f.key] || ""}
                  onChange={(e) => setConfig({ ...config, [f.key]: e.target.value })}
                  placeholder={f.placeholder}
                  className="w-full rounded-lg border border-border/50 bg-surface-light/40 px-3 py-2 text-[13px] font-mono placeholder:text-muted"
                />
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex items-center justify-end gap-2">
        <button
          onClick={onClose}
          className="rounded-lg px-4 py-2 text-sm text-muted hover:text-foreground"
        >
          Cancel
        </button>
        <button
          onClick={submit}
          disabled={!selectedType || !workflowId || submitting}
          className="inline-flex items-center gap-1.5 rounded-lg bg-gold px-5 py-2 text-sm font-semibold text-black transition hover:bg-gold/90 disabled:opacity-40"
        >
          {submitting ? (
            <>
              <Loader size={14} className="animate-spin" /> Creating…
            </>
          ) : (
            <>
              <Zap size={14} /> Create trigger
            </>
          )}
        </button>
      </div>
    </div>
  );
}

// Unused import — silence eslint
void Clock; void X;
