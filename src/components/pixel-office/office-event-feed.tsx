"use client";

/**
 * Global event feed — pinned to the right rail. Shows the most recent
 * actions across every agent, newest first. Hooks into the canvas via
 * `onActionResolved` from the parent page.
 */

import type { AgentAction } from "@/lib/pixel-office/event-mapper";
import { AGENT_BY_KEY } from "@/lib/pixel-office/agents";

interface FeedProps {
  events: AgentAction[];
  onSelectAgent: (key: string) => void;
}

export default function OfficeEventFeed({ events, onSelectAgent }: FeedProps) {
  return (
    <div className="flex h-full flex-col overflow-hidden rounded-2xl border border-white/8 bg-[#0a0a0f]/85 backdrop-blur-md">
      <div className="flex items-center justify-between border-b border-white/5 px-4 py-3">
        <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-white/55">
          Live Feed
        </div>
        <div className="flex items-center gap-1.5 text-[10px] text-white/40">
          <span className="relative flex h-1.5 w-1.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-lime-400/70" />
            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-lime-400" />
          </span>
          <span>realtime</span>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto px-2 py-2">
        {events.length === 0 && (
          <div className="px-3 py-6 text-xs text-white/40">
            Office is quiet. Activity will appear here as agents work.
          </div>
        )}
        <ul className="space-y-1">
          {events.slice(0, 30).map((ev, idx) => {
            const agent = AGENT_BY_KEY[ev.agentKey];
            if (!agent) return null;
            const brand = `#${agent.brandColor.toString(16).padStart(6, "0")}`;
            return (
              <li key={`${ev.agentKey}-${ev.ts}-${idx}`}>
                <button
                  onClick={() => onSelectAgent(ev.agentKey)}
                  className="group flex w-full items-start gap-2.5 rounded-lg px-2.5 py-2 text-left transition hover:bg-white/[0.04]"
                >
                  <span
                    className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-[10px] font-bold"
                    style={{
                      background: `${brand}1f`,
                      color: brand,
                      border: `1px solid ${brand}55`,
                    }}
                  >
                    {agent.name[0] ?? "?"}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline gap-1.5">
                      <span
                        className="text-[10px] font-bold uppercase tracking-wide"
                        style={{ color: brand }}
                      >
                        {agent.name}
                      </span>
                      <span className="text-[9px] text-white/30">{relTime(ev.ts)}</span>
                    </div>
                    <div className="mt-0.5 line-clamp-2 text-xs leading-snug text-white/80">
                      {ev.summary}
                    </div>
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}

function relTime(iso: string): string {
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return "—";
  const diff = Math.max(0, (Date.now() - t) / 1000);
  if (diff < 5) return "just now";
  if (diff < 60) return `${Math.round(diff)}s`;
  if (diff < 3600) return `${Math.round(diff / 60)}m`;
  if (diff < 86400) return `${Math.round(diff / 3600)}h`;
  return `${Math.round(diff / 86400)}d`;
}

interface PresenceRow {
  online_at: string;
  presence_ref?: string;
}

interface OnlineNowProps {
  rows: PresenceRow[];
}

/** Tiny presence indicator — top of the right rail. */
export function OnlineNow({ rows }: OnlineNowProps) {
  return (
    <div className="flex items-center gap-2 rounded-2xl border border-white/8 bg-[#0a0a0f]/85 px-4 py-3 backdrop-blur-md">
      <span className="relative flex h-2 w-2">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-lime-400 opacity-70" />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-lime-400" />
      </span>
      <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-white/65">
        {rows.length} online
      </span>
      <div className="ml-auto flex -space-x-1.5">
        {rows.slice(0, 4).map((r, i) => (
          <span
            key={r.presence_ref ?? i}
            className="h-5 w-5 rounded-full border border-white/20 bg-gradient-to-br from-lime-400 to-emerald-600"
            title="Online"
          />
        ))}
      </div>
    </div>
  );
}
