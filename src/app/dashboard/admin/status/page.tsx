"use client";

/**
 * Admin Status Page — incident management for the public /status/[ownerSlug]
 * timeline.
 *
 * Lets the owner:
 *  - Open a new incident with severity (investigating/identified/monitoring/resolved)
 *  - Edit an existing incident (escalate/de-escalate severity, update body)
 *  - Resolve an incident (auto-stamps resolved_at)
 *  - Delete an incident (typo cleanup — not for hiding real outages)
 *
 * The page-level "open incidents" stat at the top is the headline number;
 * everything else is the timeline.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  ExternalLink,
  Lock,
  Pencil,
  Plus,
  RefreshCw,
  ShieldCheck,
  Trash2,
} from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import PageHero from "@/components/ui/page-hero";
import StatCard from "@/components/ui/stat-card";

type Severity = "investigating" | "identified" | "monitoring" | "resolved";

interface Incident {
  id: string;
  title: string;
  body: string;
  severity: Severity;
  affected_components: string[];
  started_at: string;
  resolved_at: string | null;
  created_at: string;
}

interface IncidentDraft {
  id?: string;
  title: string;
  body: string;
  severity: Severity;
  affected_components: string;
}

const EMPTY_DRAFT: IncidentDraft = {
  title: "",
  body: "",
  severity: "investigating",
  affected_components: "",
};

const SEVERITY_STYLES: Record<Severity, { label: string; pill: string; dot: string }> = {
  investigating: {
    label: "Investigating",
    pill: "bg-warning/15 border-warning/40 text-warning",
    dot: "bg-warning",
  },
  identified: {
    label: "Identified",
    pill: "bg-orange-500/15 border-orange-500/40 text-orange-300",
    dot: "bg-orange-400",
  },
  monitoring: {
    label: "Monitoring",
    pill: "bg-blue-500/15 border-blue-500/40 text-blue-300",
    dot: "bg-blue-400",
  },
  resolved: {
    label: "Resolved",
    pill: "bg-success/15 border-success/40 text-success",
    dot: "bg-success",
  },
};

function formatRelative(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  if (ms < 60_000) return "just now";
  if (ms < 3_600_000) return `${Math.floor(ms / 60_000)}m ago`;
  if (ms < 86_400_000) return `${Math.floor(ms / 3_600_000)}h ago`;
  return `${Math.floor(ms / 86_400_000)}d ago`;
}

export default function AdminStatusPage() {
  const { profile, loading: authLoading } = useAuth();
  const router = useRouter();

  const [incidents, setIncidents] = useState<Incident[] | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [forbidden, setForbidden] = useState(false);
  const [draft, setDraft] = useState<IncidentDraft | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setRefreshing(true);
    try {
      const res = await fetch("/api/admin/incidents");
      if (res.status === 403) {
        setForbidden(true);
        return;
      }
      if (!res.ok) {
        toast.error("Could not load incidents");
        return;
      }
      const json = (await res.json()) as { incidents: Incident[] };
      setIncidents(json.incidents);
    } catch {
      toast.error("Could not load incidents");
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    if (authLoading) return;
    if (!profile) {
      router.push("/login");
      return;
    }
    if (
      profile.role !== "admin" &&
      profile.role !== "founder" &&
      profile.role !== "agency"
    ) {
      setForbidden(true);
      return;
    }
    load();
  }, [authLoading, profile, router, load]);

  const openCount = useMemo(
    () => incidents?.filter((i) => !i.resolved_at).length ?? 0,
    [incidents],
  );
  const resolvedCount = useMemo(
    () => incidents?.filter((i) => i.resolved_at).length ?? 0,
    [incidents],
  );
  const last24hCount = useMemo(() => {
    if (!incidents) return 0;
    const cutoff = Date.now() - 86_400_000;
    return incidents.filter((i) => new Date(i.started_at).getTime() > cutoff).length;
  }, [incidents]);

  const startNew = () => setDraft(EMPTY_DRAFT);
  const startEdit = (inc: Incident) =>
    setDraft({
      id: inc.id,
      title: inc.title,
      body: inc.body,
      severity: inc.severity,
      affected_components: inc.affected_components.join(", "),
    });
  const cancelDraft = () => setDraft(null);

  const saveDraft = async () => {
    if (!draft) return;
    if (!draft.title.trim()) {
      toast.error("Title required");
      return;
    }
    setSaving(true);
    const components = draft.affected_components
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    const payload = {
      title: draft.title.trim(),
      body: draft.body,
      severity: draft.severity,
      affected_components: components,
    };
    try {
      const res = draft.id
        ? await fetch(`/api/admin/incidents/${draft.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          })
        : await fetch("/api/admin/incidents", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });
      if (!res.ok) {
        const json = (await res.json().catch(() => ({}))) as { error?: string };
        toast.error(json.error ?? "Save failed");
        return;
      }
      toast.success(draft.id ? "Incident updated" : "Incident posted");
      setDraft(null);
      await load();
    } finally {
      setSaving(false);
    }
  };

  const resolveIncident = async (inc: Incident) => {
    const res = await fetch(`/api/admin/incidents/${inc.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ severity: "resolved" }),
    });
    if (!res.ok) {
      toast.error("Resolve failed");
      return;
    }
    toast.success("Marked resolved");
    await load();
  };

  const deleteIncident = async (inc: Incident) => {
    if (!confirm(`Delete "${inc.title}"? This cannot be undone.`)) return;
    const res = await fetch(`/api/admin/incidents/${inc.id}`, {
      method: "DELETE",
    });
    if (!res.ok) {
      toast.error("Delete failed");
      return;
    }
    toast.success("Incident deleted");
    await load();
  };

  if (authLoading || (incidents === null && !forbidden)) {
    return (
      <div className="flex items-center justify-center min-h-[60vh] text-muted text-sm">
        Loading status page…
      </div>
    );
  }

  if (forbidden) {
    return (
      <div className="max-w-xl mx-auto py-12 text-center space-y-3">
        <Lock size={32} className="text-muted mx-auto" />
        <h1 className="text-lg font-bold">Admin only</h1>
        <p className="text-xs text-muted">
          Status page management is restricted to admin/agency owners.
        </p>
      </div>
    );
  }

  const publicUrl = profile ? `/status/${profile.id}` : "";

  return (
    <div className="space-y-6 pb-12">
      <PageHero
        title="System Status"
        subtitle="Manage incidents shown on your public status page."
        eyebrow="Admin"
        gradient="gold"
        icon={<ShieldCheck size={28} />}
        actions={
          <div className="flex items-center gap-2">
            <a
              href={publicUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-xs px-4 py-2 rounded-xl border border-white/15 bg-white/5 hover:bg-white/10"
            >
              <ExternalLink size={12} /> View public page
            </a>
            <button
              onClick={load}
              disabled={refreshing}
              className="inline-flex items-center gap-1.5 text-xs px-4 py-2 rounded-xl border border-white/15 bg-white/5 hover:bg-white/10 disabled:opacity-50"
            >
              <RefreshCw size={12} className={refreshing ? "animate-spin" : ""} />
              Refresh
            </button>
            <button
              onClick={startNew}
              className="inline-flex items-center gap-1.5 text-xs px-4 py-2 rounded-xl bg-gold text-black hover:bg-gold/90 font-semibold"
            >
              <Plus size={12} /> New incident
            </button>
          </div>
        }
      />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          label="Open incidents"
          value={openCount}
          icon={<AlertTriangle size={16} />}
          premium={openCount > 0}
        />
        <StatCard
          label="Last 24h"
          value={last24hCount}
          icon={<Clock size={16} />}
        />
        <StatCard
          label="Resolved (recent)"
          value={resolvedCount}
          icon={<CheckCircle2 size={16} />}
        />
      </div>

      {/* Composer panel */}
      {draft && (
        <section className="rounded-2xl border border-gold/30 bg-surface p-5 space-y-4">
          <header className="flex items-center justify-between">
            <h2 className="text-sm font-semibold">
              {draft.id ? "Edit incident" : "New incident"}
            </h2>
            <button
              onClick={cancelDraft}
              className="text-xs text-muted hover:text-fg"
            >
              Cancel
            </button>
          </header>

          <div className="space-y-3">
            <label className="block">
              <span className="text-[11px] font-semibold text-muted uppercase tracking-wide">
                Title
              </span>
              <input
                type="text"
                value={draft.title}
                onChange={(e) => setDraft({ ...draft, title: e.target.value })}
                className="mt-1 w-full px-3 py-2 rounded-lg border border-border bg-bg text-sm"
                placeholder="e.g. Email delivery degraded"
              />
            </label>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label className="block">
                <span className="text-[11px] font-semibold text-muted uppercase tracking-wide">
                  Severity
                </span>
                <select
                  value={draft.severity}
                  onChange={(e) =>
                    setDraft({ ...draft, severity: e.target.value as Severity })
                  }
                  className="mt-1 w-full px-3 py-2 rounded-lg border border-border bg-bg text-sm"
                >
                  {(Object.keys(SEVERITY_STYLES) as Severity[]).map((s) => (
                    <option key={s} value={s}>
                      {SEVERITY_STYLES[s].label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block">
                <span className="text-[11px] font-semibold text-muted uppercase tracking-wide">
                  Affected components (comma-separated)
                </span>
                <input
                  type="text"
                  value={draft.affected_components}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      affected_components: e.target.value,
                    })
                  }
                  className="mt-1 w-full px-3 py-2 rounded-lg border border-border bg-bg text-sm"
                  placeholder="e.g. Email, Outreach, Webhooks"
                />
              </label>
            </div>

            <label className="block">
              <span className="text-[11px] font-semibold text-muted uppercase tracking-wide">
                Body (Markdown / plain text)
              </span>
              <textarea
                value={draft.body}
                onChange={(e) => setDraft({ ...draft, body: e.target.value })}
                rows={5}
                className="mt-1 w-full px-3 py-2 rounded-lg border border-border bg-bg text-sm font-mono"
                placeholder="What's happening, what's affected, what we're doing about it. Update as the incident progresses."
              />
            </label>
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
            <button
              onClick={cancelDraft}
              className="text-xs px-4 py-2 rounded-xl border border-border bg-surface hover:bg-surface-light"
              disabled={saving}
            >
              Cancel
            </button>
            <button
              onClick={saveDraft}
              disabled={saving}
              className="text-xs px-4 py-2 rounded-xl bg-gold text-black hover:bg-gold/90 font-semibold disabled:opacity-50"
            >
              {saving ? "Saving…" : draft.id ? "Save changes" : "Post incident"}
            </button>
          </div>
        </section>
      )}

      {/* Open incidents */}
      <section className="space-y-3">
        <header className="flex items-center justify-between">
          <h2 className="text-sm font-semibold">Active incidents</h2>
          <span className="text-[11px] text-muted">
            Visible on your public status page
          </span>
        </header>
        {openCount === 0 ? (
          <div className="rounded-2xl border border-success/30 bg-success/5 p-5 text-center">
            <CheckCircle2 size={20} className="text-success mx-auto mb-2" />
            <p className="text-sm font-semibold">All systems operational</p>
            <p className="text-[11px] text-muted">
              No active incidents. Public status page shows green.
            </p>
          </div>
        ) : (
          <ul className="space-y-2">
            {(incidents ?? [])
              .filter((i) => !i.resolved_at)
              .map((inc) => (
                <IncidentCard
                  key={inc.id}
                  incident={inc}
                  onEdit={() => startEdit(inc)}
                  onResolve={() => resolveIncident(inc)}
                  onDelete={() => deleteIncident(inc)}
                />
              ))}
          </ul>
        )}
      </section>

      {/* Recently resolved */}
      <section className="space-y-3">
        <header className="flex items-center justify-between">
          <h2 className="text-sm font-semibold">Recently resolved</h2>
          <span className="text-[11px] text-muted">Last 7 days on public page</span>
        </header>
        {resolvedCount === 0 ? (
          <p className="text-xs text-muted py-4">No resolved incidents yet.</p>
        ) : (
          <ul className="space-y-2">
            {(incidents ?? [])
              .filter((i) => i.resolved_at)
              .slice(0, 20)
              .map((inc) => (
                <IncidentCard
                  key={inc.id}
                  incident={inc}
                  onEdit={() => startEdit(inc)}
                  onDelete={() => deleteIncident(inc)}
                />
              ))}
          </ul>
        )}
      </section>
    </div>
  );
}

interface IncidentCardProps {
  incident: Incident;
  onEdit: () => void;
  onResolve?: () => void;
  onDelete: () => void;
}

function IncidentCard({ incident, onEdit, onResolve, onDelete }: IncidentCardProps) {
  const style = SEVERITY_STYLES[incident.severity];
  return (
    <li className="rounded-2xl border border-border bg-surface p-4 hover:border-border-bright transition-colors">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] font-semibold uppercase tracking-wide ${style.pill}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${style.dot}`} />
              {style.label}
            </span>
            <span className="text-[11px] text-muted">
              Started {formatRelative(incident.started_at)}
              {incident.resolved_at &&
                ` · Resolved ${formatRelative(incident.resolved_at)}`}
            </span>
          </div>
          <h3 className="text-sm font-semibold leading-snug">{incident.title}</h3>
          {incident.body && (
            <p className="text-xs text-muted mt-1 whitespace-pre-wrap">
              {incident.body}
            </p>
          )}
          {incident.affected_components.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {incident.affected_components.map((c) => (
                <span
                  key={c}
                  className="text-[10px] px-2 py-0.5 rounded-full bg-bg border border-border text-muted"
                >
                  {c}
                </span>
              ))}
            </div>
          )}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={onEdit}
            className="p-1.5 rounded-lg hover:bg-surface-light text-muted hover:text-fg"
            title="Edit"
          >
            <Pencil size={13} />
          </button>
          {onResolve && (
            <button
              onClick={onResolve}
              className="p-1.5 rounded-lg hover:bg-surface-light text-muted hover:text-success"
              title="Resolve"
            >
              <CheckCircle2 size={13} />
            </button>
          )}
          <button
            onClick={onDelete}
            className="p-1.5 rounded-lg hover:bg-surface-light text-muted hover:text-danger"
            title="Delete"
          >
            <Trash2 size={13} />
          </button>
        </div>
      </div>
    </li>
  );
}
