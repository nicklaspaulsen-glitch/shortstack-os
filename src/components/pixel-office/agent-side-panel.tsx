"use client";

/**
 * Side panel for a selected agent — appears when a user clicks a
 * character in the canvas or a chip in the legend strip.
 *
 * Renders:
 *   • The agent's portrait + brand color stripe
 *   • Name, role, blurb
 *   • Current activity (live)
 *   • Recent events (last 50, fetched via /api/agent-office/events)
 *
 * Click an event row → routes to the underlying record (call detail,
 * lead detail, etc.) via deep links derived from `ref_table`.
 */

import { useEffect, useState } from "react";
import { X, ArrowUpRight, Clock } from "lucide-react";
import Link from "next/link";
import type { AgentAction } from "@/lib/pixel-office/event-mapper";
import { AGENT_BY_KEY } from "@/lib/pixel-office/agents";

interface SidePanelProps {
  agentKey: string;
  /** Latest in-memory history from the canvas. */
  liveHistory: AgentAction[];
  /** Latest in-memory current activity (may be null). */
  liveCurrent: AgentAction | null;
  onClose: () => void;
}

interface RemoteEvent {
  id: string;
  agent_key: string;
  event_type: string;
  summary: string;
  ref_table: string | null;
  ref_id: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

export default function AgentSidePanel({
  agentKey,
  liveHistory,
  liveCurrent,
  onClose,
}: SidePanelProps) {
  const agent = AGENT_BY_KEY[agentKey];
  const [remoteEvents, setRemoteEvents] = useState<RemoteEvent[] | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setLoading(true);
      try {
        const res = await fetch(
          `/api/agent-office/events?agent_key=${encodeURIComponent(agentKey)}&limit=50`,
        );
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = (await res.json()) as { events: RemoteEvent[] };
        if (!cancelled) setRemoteEvents(data.events ?? []);
      } catch (err) {
        console.error("[pixel-office] panel events fetch failed", err);
        if (!cancelled) setRemoteEvents([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [agentKey]);

  if (!agent) return null;

  const brand = `#${agent.brandColor.toString(16).padStart(6, "0")}`;
  const events = remoteEvents ?? liveHistory.map(toRemoteEvent);

  return (
    <aside
      className="flex h-full w-full flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#0a0a0f]/95 backdrop-blur-xl"
      style={{ boxShadow: "0 18px 60px -10px rgba(0,0,0,0.7)" }}
    >
      {/* Header strip — colour banner + portrait + close */}
      <div
        className="relative flex items-start gap-3 px-5 pb-4 pt-5"
        style={{
          background: `linear-gradient(180deg, ${brand}26 0%, transparent 80%)`,
          borderBottom: "1px solid rgba(255,255,255,0.08)",
        }}
      >
        <div
          className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl border text-2xl font-bold"
          style={{
            background: `${brand}1a`,
            borderColor: `${brand}66`,
            color: brand,
          }}
        >
          {agent.name[0] ?? "?"}
        </div>
        <div className="min-w-0 flex-1">
          <div
            className="text-[10px] font-bold uppercase tracking-[0.16em]"
            style={{ color: brand }}
          >
            {agent.role}
          </div>
          <h3 className="text-lg font-bold leading-tight text-white">
            {agent.name}
          </h3>
          <p className="mt-1 text-xs leading-snug text-white/55">
            {agent.blurb}
          </p>
        </div>
        <button
          onClick={onClose}
          aria-label="Close panel"
          className="rounded-md p-1.5 text-white/50 transition hover:bg-white/5 hover:text-white"
        >
          <X size={16} />
        </button>
      </div>

      {/* Current activity */}
      <div className="border-b border-white/5 px-5 py-3">
        <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-white/45">
          Now
        </div>
        <div className="mt-1.5 flex items-start gap-2">
          <span
            className="mt-1.5 inline-block h-2 w-2 shrink-0 animate-pulse rounded-full"
            style={{ background: brand }}
          />
          <div className="min-w-0 flex-1 text-sm text-white/85">
            {liveCurrent?.summary ?? "Idle. Waiting for the next signal."}
          </div>
        </div>
        {liveCurrent?.refTable && (
          <div className="mt-1 text-[10px] uppercase tracking-wide text-white/35">
            from {liveCurrent.refTable}
          </div>
        )}
      </div>

      {/* History */}
      <div className="flex min-h-0 flex-1 flex-col">
        <div className="flex items-center justify-between px-5 pb-2 pt-3">
          <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-white/45">
            Recent activity
          </div>
          <div className="text-[10px] text-white/35">
            {events.length} event{events.length === 1 ? "" : "s"}
          </div>
        </div>
        <div className="flex-1 overflow-y-auto px-3 pb-4">
          {loading && events.length === 0 && (
            <div className="px-3 py-6 text-xs text-white/40">Loading…</div>
          )}
          {events.length === 0 && !loading && (
            <div className="px-3 py-6 text-xs text-white/40">
              No events yet. Activity will appear here when this agent runs.
            </div>
          )}
          <ul className="space-y-1">
            {events.slice(0, 50).map((ev) => (
              <EventRow key={ev.id} event={ev} brand={brand} />
            ))}
          </ul>
        </div>
      </div>
    </aside>
  );
}

function EventRow({ event, brand }: { event: RemoteEvent; brand: string }) {
  const link = deepLinkFor(event.ref_table, event.ref_id);
  const time = formatRelative(event.created_at);

  const inner = (
    <div
      className="group flex items-start gap-3 rounded-lg px-3 py-2 transition hover:bg-white/[0.04]"
      style={{ borderLeft: `2px solid ${brand}55` }}
    >
      <div className="min-w-0 flex-1">
        <div className="text-xs leading-snug text-white/85">{event.summary}</div>
        <div className="mt-0.5 flex items-center gap-2 text-[10px] text-white/35">
          <Clock size={9} />
          <span>{time}</span>
          {event.ref_table && (
            <span className="rounded-full bg-white/[0.04] px-1.5 py-0.5 uppercase tracking-wide">
              {event.ref_table}
            </span>
          )}
        </div>
      </div>
      {link && (
        <ArrowUpRight
          size={12}
          className="mt-1 shrink-0 text-white/30 transition group-hover:text-white"
        />
      )}
    </div>
  );

  return (
    <li>
      {link ? (
        <Link href={link} className="block">
          {inner}
        </Link>
      ) : (
        inner
      )}
    </li>
  );
}

function toRemoteEvent(action: AgentAction): RemoteEvent {
  return {
    id: `${action.refTable}-${action.refId ?? "noref"}-${action.ts}`,
    agent_key: action.agentKey,
    event_type: action.kind,
    summary: action.summary,
    ref_table: action.refTable ?? null,
    ref_id: action.refId ?? null,
    metadata: {},
    created_at: action.ts,
  };
}

/**
 * Deep-link an event back to the relevant detail page so users can
 * jump from "Echo answered call X" to the call transcript.
 */
function deepLinkFor(table: string | null, id: string | null): string | null {
  if (!table || !id) return null;
  switch (table) {
    case "voice_calls":
      return `/dashboard/voice/calls/${id}`;
    case "coach_analyses":
      return `/dashboard/coach/${id}`;
    case "lead_scores":
    case "lead_score_history":
      return `/dashboard/leads?lead=${id}`;
    case "contact_validations":
      return `/dashboard/outreach-quality?validation=${id}`;
    case "cold_email_jobs":
      return `/dashboard/cold-email/${id}`;
    case "scheduled_posts":
    case "content_calendar":
      return `/dashboard/content?post=${id}`;
    case "thumbnail_jobs":
      return `/dashboard/thumbnails/${id}`;
    case "ad_optimization_runs":
      return `/dashboard/ads-manager?run=${id}`;
    case "trinity_actions":
    case "trinity_proposals":
      return `/dashboard/trinity/proposals/${id}`;
    case "news_triggers":
      return `/dashboard/triggers?id=${id}`;
    default:
      return null;
  }
}

function formatRelative(iso: string): string {
  const then = new Date(iso).getTime();
  if (!Number.isFinite(then)) return "—";
  const diffSec = Math.max(0, (Date.now() - then) / 1000);
  if (diffSec < 60) return `${Math.round(diffSec)}s ago`;
  if (diffSec < 3600) return `${Math.round(diffSec / 60)}m ago`;
  if (diffSec < 86400) return `${Math.round(diffSec / 3600)}h ago`;
  return `${Math.round(diffSec / 86400)}d ago`;
}
