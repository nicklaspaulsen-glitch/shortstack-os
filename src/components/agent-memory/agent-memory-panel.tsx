"use client";
import { ArrowsClockwise, Brain, Trash } from "@phosphor-icons/react";

/**
 * Agent Memory panel — shows the long-term memory the AI agents have
 * accumulated about a single subject (lead / client). Used inside the
 * Memories tab on detail pages.
 *
 * Calls /api/agent-memory/:kind/:id (GET) on mount and on demand. Provides a
 * "Forget everything" GDPR delete button that hits DELETE on the same route.
 *
 * Soft-fail: when Mem0 isn't configured, the route returns an empty list and
 * we render the empty state.
 */

import { useCallback, useEffect, useState } from "react";


interface AgentMemoryRow {
  id: string;
  fact: string;
  agent_key: string | null;
  source: string;
  source_ref_id: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface AgentMemoryPanelProps {
  subjectKind: "lead" | "client" | "user" | "team_member" | "agent";
  subjectId: string;
  /** Optional title override — defaults to "Agent Memories" */
  title?: string;
  /** When true, hides the GDPR delete button (e.g. on read-only views). */
  readOnly?: boolean;
}

function formatRelativeTime(iso: string): string {
  const ts = new Date(iso).getTime();
  if (Number.isNaN(ts)) return iso;
  const diff = Date.now() - ts;
  if (diff < 60_000) return "just now";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return `${Math.floor(diff / 86_400_000)}d ago`;
}

export default function AgentMemoryPanel({
  subjectKind,
  subjectId,
  title = "Agent Memories",
  readOnly = false,
}: AgentMemoryPanelProps) {
  const [rows, setRows] = useState<AgentMemoryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/agent-memory/${subjectKind}/${subjectId}`,
      );
      if (!res.ok) {
        setError(`Failed to load (${res.status})`);
        setRows([]);
        return;
      }
      const json = (await res.json()) as { data?: AgentMemoryRow[] };
      setRows(Array.isArray(json.data) ? json.data : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [subjectKind, subjectId]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleForget = useCallback(async () => {
    if (readOnly) return;
    const confirmed = window.confirm(
      "Forget everything the AI has remembered about this subject? This is permanent.",
    );
    if (!confirmed) return;
    setDeleting(true);
    try {
      const res = await fetch(
        `/api/agent-memory/${subjectKind}/${subjectId}`,
        { method: "DELETE" },
      );
      if (!res.ok) {
        window.alert("Forget failed.");
        return;
      }
      setRows([]);
    } finally {
      setDeleting(false);
    }
  }, [readOnly, subjectKind, subjectId]);

  return (
    <section className=" border border-border-subtle bg-surface overflow-hidden">
      <header className="flex items-center justify-between px-5 py-4 border-b border-border-subtle">
        <div className="flex items-center gap-2">
          <Brain size={16} className="text-text-muted" />
          <div>
            <h2 className="text-sm font-semibold">{title}</h2>
            <p className="text-[11px] text-text-muted">
              What ShortStack&apos;s AI agents remember from past interactions.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={load}
            disabled={loading}
            className="inline-flex items-center gap-1 text-[11px] px-2.5 py-1.5 rounded-lg border border-border-subtle bg-background/60 hover:bg-surface-light disabled:opacity-50"
          >
            <ArrowsClockwise size={11} className={loading ? "animate-spin" : ""} />
            Refresh
          </button>
          {!readOnly && rows.length > 0 && (
            <button
              onClick={handleForget}
              disabled={deleting}
              className="inline-flex items-center gap-1 text-[11px] px-2.5 py-1.5 rounded-lg border border-danger/30 bg-danger/10 text-danger hover:bg-danger/15 disabled:opacity-50"
            >
              <Trash size={11} />
              {deleting ? "Forgetting…" : "Forget all"}
            </button>
          )}
        </div>
      </header>

      {error ? (
        <div className="px-5 py-8 text-center text-xs text-danger">{error}</div>
      ) : loading ? (
        <div className="px-5 py-8 text-center text-xs text-text-muted">Loading…</div>
      ) : rows.length === 0 ? (
        <div className="px-5 py-10 text-center text-xs text-text-muted space-y-1.5">
          <Brain size={20} className="mx-auto opacity-40" />
          <p>No memories yet for this {subjectKind}.</p>
          <p className="text-[10px]">
            Memories accumulate as your AI agents (Lyra, Sage, Aria&hellip;) interact
            with this subject.
          </p>
        </div>
      ) : (
        <ul className="divide-y divide-border/50">
          {rows.slice(0, 20).map((row) => (
            <li key={row.id} className="px-5 py-3.5 hover:bg-surface-light">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-xs">{row.fact}</p>
                  <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[10px] text-text-muted">
                    {row.agent_key ? (
                      <span className="px-1.5 py-0.5 rounded-full bg-accent/10 text-accent uppercase tracking-wide">
                        {row.agent_key}
                      </span>
                    ) : null}
                    <span>{row.source}</span>
                    <span>·</span>
                    <span>{formatRelativeTime(row.created_at)}</span>
                  </div>
                </div>
              </div>
            </li>
          ))}
          {rows.length > 20 ? (
            <li className="px-5 py-2 text-[10px] text-text-muted text-center">
              {rows.length - 20} older memories not shown.
            </li>
          ) : null}
        </ul>
      )}
    </section>
  );
}
