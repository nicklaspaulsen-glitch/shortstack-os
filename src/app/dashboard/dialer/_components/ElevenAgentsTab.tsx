"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Robot,
  PhoneCall,
  Lightning,
  ArrowsClockwise,
  CircleNotch,
  Warning,
  CheckCircle,
  Clock,
  Notepad,
} from "@phosphor-icons/react";

// ── Types ──────────────────────────────────────────────────────────────────────

interface Agent {
  agent_id: string;
  name: string;
  created_at?: string;
}

interface Conversation {
  conversation_id: string;
  agent_id?: string;
  status: string;
  start_time?: number;
  metadata?: Record<string, unknown>;
}

interface BatchLead {
  business: string;
  phone: string;
  status: string;
  conversationId?: string;
}

interface BatchResult {
  totalCalled: number;
  errors: number;
  leads: BatchLead[];
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  icon,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
}) {
  return (
    <div className="glass rounded-xl p-4">
      <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-text-muted">
        {icon}
        {label}
      </div>
      <div className="mt-2 text-2xl font-display font-bold text-text-primary">
        {value}
      </div>
    </div>
  );
}

function ConvStatusDot({ status }: { status: string }) {
  const cls =
    status === "done" || status === "ended"
      ? "bg-emerald-500"
      : status === "active" || status === "in_progress"
      ? "bg-amber-400"
      : status === "failed"
      ? "bg-rose-500"
      : "bg-white/20";
  return <span className={`h-2 w-2 rounded-full flex-shrink-0 ${cls}`} />;
}

// ── Main component ─────────────────────────────────────────────────────────────

export default function ElevenAgentsTab() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loadingAgents, setLoadingAgents] = useState(true);
  const [loadingConvs, setLoadingConvs] = useState(true);
  const [maxCalls, setMaxCalls] = useState(10);
  const [launching, setLaunching] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [lastBatch, setLastBatch] = useState<BatchResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchAgents = useCallback(async () => {
    setLoadingAgents(true);
    try {
      const res = await fetch("/api/eleven-agents");
      const data = (await res.json()) as { agents?: Agent[]; error?: string };
      setAgents(data.agents ?? []);
      if (data.error) setError(data.error);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to fetch agents");
    } finally {
      setLoadingAgents(false);
    }
  }, []);

  const fetchConversations = useCallback(async () => {
    setLoadingConvs(true);
    try {
      const res = await fetch("/api/eleven-agents/calls");
      const data = (await res.json()) as { conversations?: Conversation[] };
      setConversations(data.conversations ?? []);
    } catch {
      // non-critical
    } finally {
      setLoadingConvs(false);
    }
  }, []);

  useEffect(() => {
    fetchAgents();
    fetchConversations();
  }, [fetchAgents, fetchConversations]);

  const launchBatch = useCallback(async () => {
    setLaunching(true);
    setError(null);
    try {
      const res = await fetch("/api/eleven-agents/calls", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ maxCalls }),
      });
      const data = (await res.json()) as BatchResult & { error?: string };
      if (!res.ok) throw new Error(data.error ?? "Launch failed");
      setLastBatch(data);
      // Refresh conversation list after a short delay for ElevenLabs to record
      setTimeout(() => fetchConversations(), 4000);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to launch calls");
    } finally {
      setLaunching(false);
    }
  }, [maxCalls, fetchConversations]);

  const syncOutcomes = useCallback(async () => {
    setSyncing(true);
    setError(null);
    try {
      const res = await fetch("/api/eleven-agents/sync", { method: "POST" });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok) throw new Error(data.error ?? "Sync failed");
      fetchConversations();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to sync outcomes");
    } finally {
      setSyncing(false);
    }
  }, [fetchConversations]);

  const primaryAgent = agents[0];

  const todayCount = conversations.filter((c) => {
    const ts = c.start_time ? c.start_time * 1000 : null;
    return ts && new Date(ts).toDateString() === new Date().toDateString();
  }).length;

  const completedCount = conversations.filter(
    (c) => c.status === "done" || c.status === "ended",
  ).length;

  const activeCount = conversations.filter(
    (c) => c.status === "active" || c.status === "in_progress",
  ).length;

  return (
    <div className="space-y-6">
      {/* Error banner */}
      {error && (
        <div className="flex items-start gap-3 rounded-lg border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-400">
          <Warning size={18} className="mt-0.5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <StatCard label="Today" value={todayCount} icon={<PhoneCall size={14} />} />
        <StatCard label="Completed" value={completedCount} icon={<CheckCircle size={14} />} />
        <StatCard label="Active" value={activeCount} icon={<Clock size={14} />} />
      </div>

      {/* Agent + Batch launcher */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Agent card */}
        <div className="glass rounded-xl p-5">
          <div className="mb-3 flex items-center gap-2">
            <Robot size={18} className="text-brand-accent" />
            <h3 className="text-sm font-semibold text-text-primary">AI Agent</h3>
          </div>

          {loadingAgents ? (
            <div className="flex items-center gap-2 text-sm text-text-muted">
              <CircleNotch size={14} className="animate-spin" />
              Loading…
            </div>
          ) : primaryAgent ? (
            <div className="space-y-2">
              <div className="rounded-lg border border-brand-accent/20 bg-brand-accent/5 p-3">
                <div className="text-xs uppercase tracking-wider text-text-muted">
                  Active agent
                </div>
                <div className="mt-1 text-sm font-medium text-text-primary">
                  {primaryAgent.name}
                </div>
                <div className="mt-0.5 font-mono text-xs text-text-muted truncate">
                  {primaryAgent.agent_id}
                </div>
              </div>
              {agents.length > 1 && (
                <p className="text-xs text-text-muted">
                  {agents.length - 1} more agent{agents.length > 2 ? "s" : ""} available
                </p>
              )}
            </div>
          ) : (
            <div className="rounded-lg border border-amber-500/20 bg-amber-500/10 p-3 text-sm text-amber-400">
              No agent configured. Create an agent in the ElevenLabs dashboard
              and link a Twilio phone number to begin AI cold calling.
            </div>
          )}
        </div>

        {/* Batch launcher */}
        <div className="glass rounded-xl p-5">
          <div className="mb-3 flex items-center gap-2">
            <Lightning size={18} className="text-brand-accent" />
            <h3 className="text-sm font-semibold text-text-primary">Launch AI Calls</h3>
          </div>

          <div className="space-y-4">
            <div>
              <label className="text-xs uppercase tracking-wider text-text-muted">
                Max calls per batch
              </label>
              <input
                type="number"
                min={1}
                max={50}
                value={maxCalls}
                onChange={(e) =>
                  setMaxCalls(Math.min(50, Math.max(1, parseInt(e.target.value) || 1)))
                }
                className="mt-1 w-full rounded-lg border border-border-subtle bg-white/5 px-3 py-2 text-sm text-text-primary focus:border-brand-accent/50 focus:outline-none"
              />
              <p className="mt-1 text-xs text-text-muted">
                Dials top-scored leads not contacted in 48 h
              </p>
            </div>

            <button
              type="button"
              onClick={launchBatch}
              disabled={launching || !primaryAgent}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-brand-accent px-4 py-2.5 text-sm font-semibold text-black hover:bg-brand-accent/90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {launching ? (
                <>
                  <CircleNotch size={14} className="animate-spin" />
                  Launching…
                </>
              ) : (
                <>
                  <PhoneCall size={14} />
                  Launch {maxCalls} AI Call{maxCalls !== 1 ? "s" : ""}
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Last batch result */}
      {lastBatch && (
        <div className="glass rounded-xl p-4">
          <div className="mb-3 text-xs font-semibold uppercase tracking-wider text-text-muted">
            Last batch result
          </div>
          <div className="mb-3 flex items-center gap-4 text-sm">
            <span className="font-medium text-text-primary">
              {lastBatch.totalCalled} launched
            </span>
            {lastBatch.errors > 0 && (
              <span className="text-rose-400">{lastBatch.errors} errors</span>
            )}
          </div>
          <ul className="max-h-40 space-y-1 overflow-y-auto">
            {lastBatch.leads.map((l, i) => (
              <li key={i} className="flex items-center gap-3 text-xs">
                <span className="flex-1 truncate text-text-secondary">{l.business}</span>
                <span className="font-mono text-text-muted">{l.phone}</span>
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                    l.status === "calling"
                      ? "bg-emerald-500/15 text-emerald-400"
                      : "bg-rose-500/15 text-rose-400"
                  }`}
                >
                  {l.status}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Recent conversations */}
      <div className="glass rounded-xl p-5">
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Notepad size={16} className="text-text-muted" />
            <h3 className="text-sm font-semibold text-text-primary">
              Recent AI Calls{conversations.length > 0 ? ` (${conversations.length})` : ""}
            </h3>
          </div>
          <button
            type="button"
            onClick={syncOutcomes}
            disabled={syncing}
            className="flex items-center gap-1.5 rounded-lg border border-border-subtle bg-white/5 px-3 py-1.5 text-xs text-text-secondary hover:bg-white/10 disabled:opacity-50"
          >
            <ArrowsClockwise size={12} className={syncing ? "animate-spin" : ""} />
            Sync outcomes
          </button>
        </div>

        {loadingConvs ? (
          <div className="flex items-center gap-2 py-4 text-sm text-text-muted">
            <CircleNotch size={14} className="animate-spin" />
            Loading conversations…
          </div>
        ) : conversations.length === 0 ? (
          <div className="py-10 text-center text-sm text-text-muted">
            No AI calls yet. Launch a batch above to get started.
          </div>
        ) : (
          <ul className="max-h-72 space-y-1.5 overflow-y-auto pr-1">
            {conversations.slice(0, 50).map((conv) => {
              const startTs = conv.start_time
                ? new Date(conv.start_time * 1000).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })
                : null;
              const phone =
                (conv.metadata?.phone_number as string | undefined) ?? null;
              return (
                <li
                  key={conv.conversation_id}
                  className="flex items-center gap-3 rounded-lg bg-white/3 px-3 py-2 text-xs"
                >
                  <ConvStatusDot status={conv.status} />
                  <span className="w-20 flex-shrink-0 font-mono text-text-muted">
                    {conv.conversation_id.slice(0, 10)}…
                  </span>
                  <span className="flex-1 truncate text-text-secondary">
                    {phone ?? "—"}
                  </span>
                  {startTs && (
                    <span className="flex-shrink-0 text-text-muted">{startTs}</span>
                  )}
                  <span className="flex-shrink-0 capitalize text-text-muted">
                    {conv.status}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
