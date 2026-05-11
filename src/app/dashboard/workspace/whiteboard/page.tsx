"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  LayoutGrid,
  Activity,
  Film,
  Send,
  TrendingUp,
  ListChecks,
  Clock,
  CheckCircle2,
  Hourglass,
  Eye,
  ExternalLink,
} from "lucide-react";
import EmptyState from "@/components/empty-state";
import type {
  WhiteboardSnapshot,
  WhiteboardItem,
  WhiteboardItemKind,
  PresenceRow,
  ActivityEvent,
  ClientLane,
} from "@/lib/workspace/aggregator";
import { MotionPage } from "@/components/motion/motion-page";

const SURFACE_NAME = "whiteboard";
const REFRESH_INTERVAL_MS = 15_000;
const HEARTBEAT_INTERVAL_MS = 30_000;

interface ApiOk {
  success: true;
  data: WhiteboardSnapshot;
}
interface ApiErr {
  success: false;
  error: string;
}
type ApiResponse = ApiOk | ApiErr;

/** Per-kind visual styling. Color-coded so a glance at any lane reveals
 *  whether the work is video, social, sales, or task work without reading. */
const KIND_STYLES: Record<WhiteboardItemKind, { bg: string; border: string; text: string; label: string; icon: typeof Film }> = {
  task: {
    bg: "rgba(255,255,255,0.04)",
    border: "rgba(255,255,255,0.12)",
    text: "rgb(229,229,229)",
    label: "Task",
    icon: ListChecks,
  },
  video_render: {
    bg: "rgba(201,168,76,0.10)",
    border: "rgba(201,168,76,0.35)",
    text: "rgb(228,200,118)",
    label: "Video",
    icon: Film,
  },
  scheduled_publish: {
    bg: "rgba(37,99,235,0.10)",
    border: "rgba(37,99,235,0.35)",
    text: "rgb(147,197,253)",
    label: "Publish",
    icon: Send,
  },
  deal: {
    bg: "rgba(37,99,235,0.10)",
    border: "rgba(110,231,183,0.35)",
    text: "rgb(110,231,183)",
    label: "Deal",
    icon: TrendingUp,
  },
};

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  if (Number.isNaN(diff)) return "";
  if (diff < 60_000) return "just now";
  const m = Math.floor(diff / 60_000);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

function initialsFor(name?: string | null, email?: string | null): string {
  const source = name || email || "??";
  const parts = source.split(/[\s@]+/).filter(Boolean);
  if (parts.length === 0) return "??";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

export default function WhiteboardPage() {
  const [snapshot, setSnapshot] = useState<WhiteboardSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const refreshTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const heartbeatTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchSnapshot = useCallback(async () => {
    try {
      const res = await fetch("/api/workspace/whiteboard", {
        cache: "no-store",
        credentials: "include",
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || `${res.status}`);
      }
      const json = (await res.json()) as ApiResponse;
      if (!json.success) {
        throw new Error(json.error);
      }
      setSnapshot(json.data);
      setError(null);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "load failed";
      // eslint-disable-next-line no-console
      console.warn("[workspace-whiteboard] fetch failed", msg);
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  const sendHeartbeat = useCallback(async () => {
    try {
      await fetch("/api/workspace/whiteboard/presence", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ surface: SURFACE_NAME, context: {} }),
      });
    } catch (err) {
      // Heartbeat failures are non-fatal — we just won't show up online for
      // a tick. Log so we notice if this is happening at scale.
      // eslint-disable-next-line no-console
      console.warn("[workspace-whiteboard] heartbeat failed", err);
    }
  }, []);

  // Mount: kick off heartbeat + first fetch + polling timer.
  useEffect(() => {
    void sendHeartbeat();
    void fetchSnapshot();
    refreshTimer.current = setInterval(() => {
      void fetchSnapshot();
    }, REFRESH_INTERVAL_MS);
    heartbeatTimer.current = setInterval(() => {
      void sendHeartbeat();
    }, HEARTBEAT_INTERVAL_MS);

    return () => {
      if (refreshTimer.current) clearInterval(refreshTimer.current);
      if (heartbeatTimer.current) clearInterval(heartbeatTimer.current);
    };
  }, [fetchSnapshot, sendHeartbeat]);

  // Send "I'm leaving" beacon on tab close / page hide. sendBeacon survives
  // the nav lifecycle better than a regular fetch.
  useEffect(() => {
    const beaconLeave = () => {
      try {
        const blob = new Blob([], { type: "text/plain" });
        if (typeof navigator !== "undefined" && "sendBeacon" in navigator) {
          navigator.sendBeacon(
            `/api/workspace/whiteboard/presence?surface=${encodeURIComponent(SURFACE_NAME)}`,
            blob,
          );
        }
      } catch {
        // best-effort; the prune cron will sweep us anyway
      }
    };
    const onVisibility = () => {
      if (document.visibilityState === "hidden") {
        beaconLeave();
      } else {
        void sendHeartbeat();
      }
    };
    window.addEventListener("pagehide", beaconLeave);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("pagehide", beaconLeave);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [sendHeartbeat]);

  const lanes: ClientLane[] = useMemo(() => {
    if (!snapshot) return [];
    // Sort lanes: ones with items first (busiest first), then alphabetical.
    return Object.values(snapshot.by_client).sort((a, b) => {
      if (a.items.length !== b.items.length) return b.items.length - a.items.length;
      return a.client_name.localeCompare(b.client_name);
    });
  }, [snapshot]);

  const totalItems = useMemo(
    () => lanes.reduce((acc, lane) => acc + lane.items.length, 0),
    [lanes],
  );

  return (
    <MotionPage className="space-y-6 pb-12">{/* -- Workspace Whiteboard command strip -- */}
    <div className="flex items-center justify-between gap-4 px-1 py-3 sm:py-4">
      <div className="min-w-0">
        <p className="font-editorial text-[11px] italic text-text-muted mb-0.5">Workspace</p>
        <h1 className="font-display text-xl sm:text-2xl font-bold tracking-tight text-text-primary leading-none">Workspace Whiteboard</h1>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <div className="flex items-center gap-2 text-xs text-[#374151]">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
                  </span>
                  <span>Updated {snapshot ? timeAgo(snapshot.generated_at) : "…"}</span>
                </div>
      </div>
    </div>{/* Online now strip */}<PresenceStrip users={snapshot?.active_users ?? []} loading={loading} />{error && !snapshot && (
              <div className="rounded-xl border border-red-500/30 bg-red-500/5 px-4 py-3 text-sm text-red-700">
                Couldn&apos;t load the whiteboard: {error}
              </div>
            )}<div className="grid grid-cols-1 xl:grid-cols-[1fr_320px] gap-6">
              {/* Lanes */}
              <div className="min-w-0">
                {loading && !snapshot ? (
                  <LanesSkeleton />
                ) : totalItems === 0 ? (
                  <EmptyState
                    icon={<Activity size={28} className="text-[#2563EB]" />}
                    title="Nothing in flight"
                    description="No active renders, scheduled posts, open deals, or in-progress tasks yet. Once your team starts shipping work, it'll show up here in real time."
                  />
                ) : (
                  <div className="flex gap-4 overflow-x-auto pb-2 snap-x">
                    {lanes.map((lane) => (
                      <ClientLaneCard key={lane.client_id} lane={lane} />
                    ))}
                  </div>
                )}
              </div>

              {/* Recent activity sidebar */}
              <ActivitySidebar events={snapshot?.recent_activity ?? []} loading={loading && !snapshot} />
            </div></MotionPage>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Subcomponents
// ─────────────────────────────────────────────────────────────────────────

interface PresenceStripProps {
  users: PresenceRow[];
  loading: boolean;
}

function PresenceStrip({ users, loading }: PresenceStripProps) {
  return (
    <div className=" border border-black/[0.06] bg-white px-4 py-3">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-[#6B7280]">
            Online now
          </span>
          <span className="rounded-full border border-emerald-400/30 bg-emerald-400/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
            {users.length}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {loading && users.length === 0 ? (
            <span className="text-xs text-[#9CA3AF]">Loading viewers…</span>
          ) : users.length === 0 ? (
            <span className="text-xs text-[#9CA3AF]">No teammates online right now.</span>
          ) : (
            users.slice(0, 16).map((u) => <PresenceBubble key={u.id} user={u} />)
          )}
          {users.length > 16 && (
            <span className="text-xs text-[#9CA3AF]">+{users.length - 16} more</span>
          )}
        </div>
      </div>
    </div>
  );
}

function PresenceBubble({ user }: { user: PresenceRow }) {
  const name = user.profile?.full_name || user.profile?.email || "Teammate";
  const avatar = user.profile?.avatar_url || null;
  const tooltip = `${name} — on ${user.surface}`;
  return (
    <div className="group relative" title={tooltip}>
      {avatar ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={avatar}
          alt={name}
          className="h-8 w-8 rounded-full border-2 border-emerald-400/60 object-cover"
        />
      ) : (
        <div
          className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-emerald-400/60 bg-black/[0.04] text-[11px] font-semibold text-[#111827]"
          aria-label={name}
        >
          {initialsFor(user.profile?.full_name, user.profile?.email)}
        </div>
      )}
      <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-white bg-emerald-400" />
    </div>
  );
}

function ClientLaneCard({ lane }: { lane: ClientLane }) {
  return (
    <div className="snap-start shrink-0 w-[320px]  border border-black/[0.06] bg-white p-3 flex flex-col">
      <div className="flex items-center justify-between gap-2 mb-3 px-1">
        <h3 className="text-sm font-semibold text-[#111827] truncate">{lane.client_name}</h3>
        <span className="rounded-full border border-black/[0.06] bg-black/[0.04] px-2 py-0.5 text-[10px] font-semibold text-[#374151]">
          {lane.items.length}
        </span>
      </div>
      <div className="space-y-2 max-h-[60vh] overflow-y-auto pr-1">
        {lane.items.length === 0 ? (
          <div className="rounded-lg border border-dashed border-black/[0.06] px-3 py-6 text-center text-xs text-[#9CA3AF]">
            Nothing in flight.
          </div>
        ) : (
          lane.items.map((item) => <WhiteboardCard key={`${item.kind}:${item.id}`} item={item} />)
        )}
      </div>
    </div>
  );
}

function WhiteboardCard({ item }: { item: WhiteboardItem }) {
  const style = KIND_STYLES[item.kind];
  const Icon = style.icon;
  return (
    <div
      className="rounded-lg border px-3 py-2.5"
      style={{ background: style.bg, borderColor: style.border }}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider" style={{ color: style.text }}>
          <Icon size={12} />
          <span>{style.label}</span>
        </div>
        {item.status && (
          <span className="rounded-full border border-black/[0.06] bg-black/[0.04] px-1.5 py-0.5 text-[10px] text-[#374151]">
            {item.status.replace(/_/g, " ")}
          </span>
        )}
      </div>
      <div className="mt-1.5 text-sm font-medium text-[#111827] leading-snug line-clamp-2">
        {item.title}
      </div>
      <div className="mt-2 flex items-center justify-between gap-2 text-[11px] text-[#6B7280]">
        <div className="flex items-center gap-1">
          {item.due_at ? (
            <>
              <Clock size={11} />
              <span>{timeAgo(item.due_at)}</span>
            </>
          ) : (
            <span>&nbsp;</span>
          )}
        </div>
        {item.url && (
          <a
            href={item.url}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-[#6B7280] hover:text-[#111827]"
          >
            <ExternalLink size={11} />
            <span>Live</span>
          </a>
        )}
      </div>
    </div>
  );
}

function ActivitySidebar({ events, loading }: { events: ActivityEvent[]; loading: boolean }) {
  return (
    <aside className=" border border-black/[0.06] bg-white p-4 h-fit xl:sticky xl:top-4">
      <div className="flex items-center gap-2 mb-3">
        <Eye size={14} className="text-[#6B7280]" />
        <h3 className="text-sm font-semibold uppercase tracking-wider text-[#6B7280]">
          Recent activity
        </h3>
      </div>
      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-12 rounded-lg bg-black/[0.04] animate-pulse" />
          ))}
        </div>
      ) : events.length === 0 ? (
        <p className="text-xs text-[#9CA3AF] py-4 text-center">No activity yet.</p>
      ) : (
        <ul className="space-y-1 max-h-[80vh] overflow-y-auto pr-1">
          {events.map((event) => (
            <ActivityRow key={event.id} event={event} />
          ))}
        </ul>
      )}
    </aside>
  );
}

function ActivityRow({ event }: { event: ActivityEvent }) {
  const style = KIND_STYLES[event.kind];
  const Icon = (() => {
    if (event.verb === "completed" || event.verb === "published") return CheckCircle2;
    if (event.verb === "rendering" || event.verb === "queued") return Hourglass;
    return style.icon;
  })();
  return (
    <li className="flex items-start gap-2.5 rounded-lg px-2 py-1.5 hover:bg-black/[0.04] transition-colors">
      <div
        className="shrink-0 mt-0.5 flex h-6 w-6 items-center justify-center rounded-md border"
        style={{ background: style.bg, borderColor: style.border, color: style.text }}
      >
        <Icon size={12} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-xs text-[#374151] leading-snug">
          <span className="font-medium capitalize text-[#111827]">{event.verb}</span>{" "}
          <span className="text-[#374151]">{event.object_title}</span>
          {event.client_name && (
            <span className="text-[#9CA3AF]"> · {event.client_name}</span>
          )}
        </p>
        <p className="text-[10px] text-[#9CA3AF]">{timeAgo(event.occurred_at)}</p>
      </div>
    </li>
  );
}

function LanesSkeleton() {
  return (
    <div className="flex gap-4 overflow-x-auto pb-2">
      {Array.from({ length: 4 }).map((_, i) => (
        <div
          key={i}
          className="shrink-0 w-[320px]  border border-black/[0.06] bg-white p-3 space-y-2"
        >
          <div className="h-5 w-32 bg-black/[0.04] rounded animate-pulse" />
          {Array.from({ length: 3 }).map((__, j) => (
            <div key={j} className="h-16 rounded-lg bg-black/[0.04] animate-pulse" />
          ))}
        </div>
      ))}
    </div>
  );
}
