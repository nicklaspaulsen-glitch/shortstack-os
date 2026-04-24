"use client";

import Link from "next/link";
import { useState, useTransition } from "react";

export interface ActivityEvent {
  id: string;
  org_id: string;
  actor_id: string | null;
  event_type: string;
  subject_type: string | null;
  subject_id: string | null;
  subject_preview: Record<string, unknown> | null;
  project_id: string | null;
  visibility: string;
  created_at: string;
  actor?: { id: string; full_name: string | null; avatar_url: string | null } | null;
  reactions?: Record<string, number>;
  my_reactions?: string[];
  comment_count?: number;
}

// verb + accent color per event type. Kept inline for determinism at build.
const EVENT_LABELS: Record<string, { verb: string; color: string }> = {
  asset_created: { verb: "created an asset", color: "#C9A84C" },
  asset_derived: { verb: "remixed an asset", color: "#A879D8" },
  project_launched: { verb: "launched a project", color: "#6FD4A0" },
  project_completed: { verb: "wrapped a project", color: "#6FD4A0" },
  milestone_hit: { verb: "hit a milestone", color: "#F7B955" },
  client_approved: { verb: "got client approval", color: "#6FD4A0" },
  client_requested_revisions: { verb: "received revision notes", color: "#E08A6A" },
  review_submitted: { verb: "submitted a review", color: "#7AA9E6" },
  review_session_created: { verb: "started a review session", color: "#7AA9E6" },
  task_completed: { verb: "completed a task", color: "#6FD4A0" },
  task_assigned: { verb: "was assigned a task", color: "#C9A84C" },
  member_joined: { verb: "joined the team", color: "#A879D8" },
  hire_booked: { verb: "booked a new hire", color: "#6FD4A0" },
  post_mortem_published: { verb: "published a post-mortem", color: "#7AA9E6" },
  scope_flag_raised: { verb: "raised a scope flag", color: "#E08A6A" },
  scope_flag_resolved: { verb: "resolved a scope flag", color: "#6FD4A0" },
  weekly_report_sent: { verb: "sent the weekly report", color: "#7AA9E6" },
  case_study_published: { verb: "published a case study", color: "#C9A84C" },
};

const DEFAULT_EMOJIS = ["👍", "🔥", "❤️", "🎉", "💡", "🚀"];

function relativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  const diff = Math.max(0, Date.now() - then) / 1000;
  if (diff < 60) return `${Math.floor(diff)}s`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  if (diff < 86400 * 30) return `${Math.floor(diff / 86400)}d`;
  return new Date(iso).toLocaleDateString();
}

function getTitle(e: ActivityEvent): string | null {
  const p = e.subject_preview;
  if (!p || typeof p !== "object") return null;
  const t = (p as Record<string, unknown>).title;
  return typeof t === "string" ? t : null;
}

function getThumbnail(e: ActivityEvent): string | null {
  const p = e.subject_preview;
  if (!p || typeof p !== "object") return null;
  const t = (p as Record<string, unknown>).thumbnail_url;
  return typeof t === "string" ? t : null;
}

interface ActivityCardProps {
  event: ActivityEvent;
  compact?: boolean;
}

export default function ActivityCard({ event, compact = false }: ActivityCardProps) {
  const [reactions, setReactions] = useState<Record<string, number>>(event.reactions ?? {});
  const [mine, setMine] = useState<Set<string>>(new Set(event.my_reactions ?? []));
  const [isPending, startTransition] = useTransition();

  const label = EVENT_LABELS[event.event_type] ?? { verb: event.event_type, color: "#888" };
  const title = getTitle(event);
  const thumb = getThumbnail(event);
  const actorName = event.actor?.full_name ?? "Someone";

  const toggle = (emoji: string) => {
    const wasActive = mine.has(emoji);
    // Optimistic update.
    setMine((prev) => {
      const next = new Set(prev);
      if (wasActive) next.delete(emoji);
      else next.add(emoji);
      return next;
    });
    setReactions((prev) => {
      const next = { ...prev };
      next[emoji] = (next[emoji] ?? 0) + (wasActive ? -1 : 1);
      if (next[emoji] <= 0) delete next[emoji];
      return next;
    });
    startTransition(async () => {
      try {
        await fetch(`/api/feed/events/${event.id}/reactions`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ emoji }),
        });
      } catch {
        // Revert on error.
        setMine((prev) => {
          const next = new Set(prev);
          if (wasActive) next.add(emoji);
          else next.delete(emoji);
          return next;
        });
        setReactions((prev) => {
          const next = { ...prev };
          next[emoji] = (next[emoji] ?? 0) + (wasActive ? 1 : -1);
          if (next[emoji] <= 0) delete next[emoji];
          return next;
        });
      }
    });
  };

  return (
    <article
      style={{
        background: "rgba(255,255,255,0.02)",
        border: "1px solid rgba(255,255,255,0.08)",
        borderRadius: 12,
        padding: 16,
        display: "flex",
        flexDirection: "column",
        gap: 12,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        {event.actor?.avatar_url ? (
          <img
            src={event.actor.avatar_url}
            alt=""
            width={32}
            height={32}
            style={{ borderRadius: "50%", objectFit: "cover" }}
          />
        ) : (
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: "50%",
              background: "rgba(255,255,255,0.08)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 13,
              color: "rgba(255,255,255,0.7)",
            }}
          >
            {actorName.charAt(0).toUpperCase()}
          </div>
        )}
        <div style={{ flex: 1, fontSize: 14, color: "rgba(255,255,255,0.85)" }}>
          <strong style={{ color: "#fff" }}>{actorName}</strong>{" "}
          <span style={{ color: label.color }}>{label.verb}</span>
        </div>
        <time
          dateTime={event.created_at}
          style={{ fontSize: 12, color: "rgba(255,255,255,0.5)" }}
        >
          {relativeTime(event.created_at)}
        </time>
      </div>

      {title || thumb ? (
        <Link
          href={`/dashboard/feed/${event.id}`}
          style={{
            display: "flex",
            gap: 12,
            alignItems: "center",
            padding: 12,
            borderRadius: 8,
            background: "rgba(255,255,255,0.03)",
            border: "1px solid rgba(255,255,255,0.06)",
            textDecoration: "none",
          }}
        >
          {thumb ? (
            <img
              src={thumb}
              alt=""
              style={{
                width: compact ? 48 : 80,
                height: compact ? 48 : 80,
                borderRadius: 6,
                objectFit: "cover",
                flexShrink: 0,
              }}
            />
          ) : null}
          <div style={{ flex: 1, minWidth: 0 }}>
            {title ? (
              <div
                style={{
                  fontSize: 14,
                  fontWeight: 600,
                  color: "#fff",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {title}
              </div>
            ) : null}
            <div style={{ fontSize: 12, color: "rgba(255,255,255,0.5)", marginTop: 2 }}>
              {event.subject_type ?? ""}
            </div>
          </div>
        </Link>
      ) : null}

      <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
        {DEFAULT_EMOJIS.map((emoji) => {
          const active = mine.has(emoji);
          const count = reactions[emoji] ?? 0;
          return (
            <button
              key={emoji}
              type="button"
              onClick={() => toggle(emoji)}
              disabled={isPending}
              style={{
                padding: "4px 10px",
                borderRadius: 16,
                fontSize: 13,
                background: active ? "rgba(201,168,76,0.18)" : "rgba(255,255,255,0.04)",
                border: `1px solid ${active ? "rgba(201,168,76,0.5)" : "rgba(255,255,255,0.08)"}`,
                color: active ? "#E4C876" : "rgba(255,255,255,0.7)",
                cursor: isPending ? "wait" : "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: 4,
              }}
            >
              <span>{emoji}</span>
              {count > 0 ? <span style={{ fontVariantNumeric: "tabular-nums" }}>{count}</span> : null}
            </button>
          );
        })}
        <Link
          href={`/dashboard/feed/${event.id}`}
          style={{
            marginLeft: "auto",
            fontSize: 12,
            color: "rgba(255,255,255,0.6)",
            textDecoration: "none",
          }}
        >
          💬 {event.comment_count ?? 0} {event.comment_count === 1 ? "comment" : "comments"}
        </Link>
      </div>
    </article>
  );
}
