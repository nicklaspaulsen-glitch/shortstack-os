"use client";

import { Bot } from "lucide-react";
import { useEffect, useState } from "react";
import type { RealtimePostgresInsertPayload } from "@supabase/supabase-js";
import { tokens, themeTokens } from "@/lib/brand/tokens";
import { createClient } from "@/lib/supabase/client";
import { formatRelativeTime } from "@/lib/utils";
import { AGENTS } from "@/lib/pixel-office/agents";
import { BentoTile, BentoEmpty } from "./bento-tile";
import type { AgentEventRow } from "./types";

/**
 * AgentActivityFeedTile — live, auto-refreshing feed of the last 30
 * `agent_activity_events` for the calling agency.
 *
 * Subscribes to Supabase Realtime on the `agent_activity_events` table and
 * partitions by `agency_owner_id` (resolved server-side and passed in via
 * props). Falls back gracefully to the static initial set if the realtime
 * channel can't connect.
 */
interface Props {
  ownerId: string;
  initialEvents: AgentEventRow[];
  index?: number;
}

const AGENT_BY_KEY = AGENTS.reduce(
  (acc, a) => {
    acc[a.key] = a;
    return acc;
  },
  {} as Record<string, (typeof AGENTS)[number]>,
);

function agentColor(key: string): string {
  const agent = AGENT_BY_KEY[key];
  if (!agent) return themeTokens.text.muted;
  // Convert 0xrrggbb to #rrggbb
  return `#${agent.brandColor.toString(16).padStart(6, "0")}`;
}

function agentInitial(key: string): string {
  return (AGENT_BY_KEY[key]?.name || key).charAt(0).toUpperCase();
}

export default function AgentActivityFeedTile({ ownerId, initialEvents, index = 0 }: Props) {
  const [events, setEvents] = useState<AgentEventRow[]>(initialEvents);

  useEffect(() => {
    if (!ownerId) return;
    const supabase = createClient();
    const channel = supabase
      .channel(`dashboard-bento-${ownerId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "agent_activity_events",
          filter: `agency_owner_id=eq.${ownerId}`,
        },
        (payload: RealtimePostgresInsertPayload<AgentEventRow>) => {
          const row = payload.new;
          setEvents((prev) => [row, ...prev].slice(0, 30));
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [ownerId]);

  return (
    <BentoTile
      title="Agent activity"
      icon={<Bot size={14} />}
      span="lg:col-span-4 lg:row-span-2"
      link={{ href: "/dashboard/agent-office", label: "Office" }}
      index={index}
    >
      {events.length === 0 ? (
        <BentoEmpty
          copy="Your agents are quiet. Let one run a task — Echo, Lyra and Sage are ready."
          cta={{ label: "Visit Agent Office", href: "/dashboard/agent-office" }}
        />
      ) : (
        <ul className="space-y-1 max-h-[420px] overflow-y-auto pr-1 dashboard-bento-scroll">
          {events.map((ev) => (
            <li
              key={ev.id}
              className="flex items-start gap-2.5 py-1.5 border-b last:border-0"
              style={{ borderColor: tokens.border.subtle }}
            >
              <div
                className="shrink-0 w-7 h-7 rounded-lg flex items-center justify-center text-[10px] font-bold mt-0.5"
                style={{
                  background: `${agentColor(ev.agent_key)}22`,
                  color: agentColor(ev.agent_key),
                  border: `1px solid ${agentColor(ev.agent_key)}55`,
                }}
              >
                {agentInitial(ev.agent_key)}
              </div>
              <div className="min-w-0 flex-1">
                <p
                  className="text-[11px] leading-snug"
                  style={{ color: themeTokens.text.primary }}
                >
                  <span className="font-semibold" style={{ color: agentColor(ev.agent_key) }}>
                    {AGENT_BY_KEY[ev.agent_key]?.name || ev.agent_key}
                  </span>{" "}
                  {ev.summary}
                </p>
                <p
                  className="text-[9px] mt-0.5"
                  style={{ color: themeTokens.text.muted }}
                >
                  {formatRelativeTime(ev.created_at)}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </BentoTile>
  );
}
