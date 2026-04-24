"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2, RefreshCcw, TrendingUp, UserPlus } from "lucide-react";
import PageHero from "@/components/ui/page-hero";
import EmptyState from "@/components/empty-state";
import ActivityCard, { type ActivityEvent } from "@/components/activity/activity-card";

type Tab = "all" | "following" | "projects" | "wins";

const TABS: { key: Tab; label: string }[] = [
  { key: "all",       label: "All" },
  { key: "following", label: "Following" },
  { key: "projects",  label: "My Projects" },
  { key: "wins",      label: "Wins" },
];

export default function FeedPage() {
  const [tab, setTab] = useState<Tab>("all");
  const [events, setEvents] = useState<ActivityEvent[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [done, setDone] = useState(false);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  const load = useCallback(
    async (nextTab: Tab, before?: string | null, mode: "replace" | "append" = "replace") => {
      if (mode === "replace") setLoading(true);
      else setLoadingMore(true);
      try {
        const params = new URLSearchParams({ tab: nextTab, limit: "25" });
        if (before) params.set("before", before);
        const res = await fetch(`/api/feed?${params}`, { cache: "no-store" });
        const data = await res.json();
        if (!res.ok) throw new Error(data?.error || "feed fetch failed");
        const incoming: ActivityEvent[] = data.events ?? [];
        setEvents((prev) => (mode === "replace" ? incoming : [...prev, ...incoming]));
        setCursor(data.cursor ?? null);
        setDone(!data.cursor);
        if (mode === "replace") {
          // Mark unread cleared whenever the feed is loaded fresh.
          void fetch("/api/feed/read", { method: "POST" }).catch(() => {});
        }
      } catch {
        /* swallow — UI shows empty state */
      } finally {
        setLoading(false);
        setLoadingMore(false);
        setRefreshing(false);
      }
    },
    [],
  );

  // Initial + tab switch load
  useEffect(() => {
    void load(tab, null, "replace");
  }, [tab, load]);

  // Infinite scroll
  useEffect(() => {
    if (done || !cursor || !sentinelRef.current) return;
    const el = sentinelRef.current;
    const io = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting) && !loadingMore) {
        void load(tab, cursor, "append");
      }
    });
    io.observe(el);
    return () => io.disconnect();
  }, [cursor, done, loadingMore, tab, load]);

  const refresh = async () => {
    setRefreshing(true);
    await load(tab, null, "replace");
  };

  return (
    <div className="mx-auto max-w-7xl px-4 pb-24">
      <PageHero
        icon="TrendingUp"
        title="Activity Feed"
        subtitle="Everything your team is shipping, in one scroll. React, comment, celebrate."
      />

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_280px]">
        {/* Left: vertical feed */}
        <section className="min-w-0">
          {/* Tabs + refresh */}
          <div className="sticky top-0 z-10 mb-4 flex items-center justify-between border-b border-white/10 bg-slate-950/70 pb-2 backdrop-blur">
            <nav className="flex gap-1" aria-label="Feed filter">
              {TABS.map((t) => (
                <button
                  key={t.key}
                  onClick={() => setTab(t.key)}
                  className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                    tab === t.key
                      ? "bg-[#C9A84C]/15 text-[#C9A84C]"
                      : "text-slate-400 hover:bg-white/5 hover:text-slate-200"
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </nav>
            <button
              onClick={refresh}
              disabled={refreshing || loading}
              className="flex items-center gap-1.5 rounded-md border border-white/10 bg-white/5 px-2.5 py-1.5 text-xs text-slate-300 hover:border-white/20 disabled:opacity-50"
            >
              {refreshing ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <RefreshCcw className="h-3.5 w-3.5" />
              )}
              Refresh
            </button>
          </div>

          {/* Feed list */}
          {loading ? (
            <div className="flex justify-center py-24 text-slate-500">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : events.length === 0 ? (
            <EmptyState
              title="No activity yet"
              description="As your team ships work, it'll show up here as cards. Reactions and comments optional."
              icon="TrendingUp"
            />
          ) : (
            <div className="space-y-3">
              {events.map((e) => (
                <ActivityCard key={e.id} event={e} onChange={refresh} />
              ))}
              {!done && (
                <div ref={sentinelRef} className="flex justify-center py-6">
                  {loadingMore && <Loader2 className="h-4 w-4 animate-spin text-slate-500" />}
                </div>
              )}
              {done && events.length > 0 && (
                <div className="py-6 text-center text-xs text-slate-600">End of feed</div>
              )}
            </div>
          )}
        </section>

        {/* Right: sidebar panels */}
        <aside className="space-y-4 lg:sticky lg:top-0 lg:self-start lg:pt-2">
          <TrendingPanel events={events} />
          <SuggestionsPanel events={events} />
        </aside>
      </div>
    </div>
  );
}

/* ----- Right sidebar: Trending this week ----- */
function TrendingPanel({ events }: { events: ActivityEvent[] }) {
  // Simple: top 5 actors by event count in the loaded page.
  const counts = new Map<string, { name: string; count: number }>();
  for (const e of events) {
    if (!e.actor_id) continue;
    const k = e.actor_id;
    const prev = counts.get(k) ?? { name: e.actor?.full_name ?? "Team member", count: 0 };
    prev.count += 1;
    counts.set(k, prev);
  }
  const top = Array.from(counts.values()).sort((a, b) => b.count - a.count).slice(0, 5);

  return (
    <div className="rounded-xl border border-white/10 bg-slate-900/60 p-4">
      <h3 className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
        <TrendingUp className="h-3.5 w-3.5" /> Trending this week
      </h3>
      {top.length === 0 ? (
        <p className="text-sm text-slate-500">Once activity flows, top contributors show here.</p>
      ) : (
        <ul className="space-y-2">
          {top.map((row, i) => (
            <li key={i} className="flex items-center justify-between text-sm">
              <span className="text-slate-200">{row.name}</span>
              <span className="text-xs text-slate-500">{row.count} events</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/* ----- Right sidebar: Follow suggestions ----- */
function SuggestionsPanel({ events }: { events: ActivityEvent[] }) {
  const suggestions = Array.from(
    new Map(
      events
        .filter((e) => e.actor_id)
        .map((e) => [e.actor_id!, { id: e.actor_id!, name: e.actor?.full_name ?? "Team member" }]),
    ).values(),
  ).slice(0, 5);

  const [followed, setFollowed] = useState<Set<string>>(new Set());

  async function follow(id: string) {
    try {
      await fetch("/api/feed/follow", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subject_type: "user", subject_id: id }),
      });
      setFollowed((prev) => new Set(prev).add(id));
    } catch {
      /* swallow */
    }
  }

  return (
    <div className="rounded-xl border border-white/10 bg-slate-900/60 p-4">
      <h3 className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
        <UserPlus className="h-3.5 w-3.5" /> Follow suggestions
      </h3>
      {suggestions.length === 0 ? (
        <p className="text-sm text-slate-500">No suggestions yet.</p>
      ) : (
        <ul className="space-y-2">
          {suggestions.map((s) => (
            <li key={s.id} className="flex items-center justify-between text-sm">
              <span className="text-slate-200">{s.name}</span>
              {followed.has(s.id) ? (
                <span className="text-xs text-slate-500">Following</span>
              ) : (
                <button
                  onClick={() => follow(s.id)}
                  className="rounded-md border border-[#C9A84C]/40 bg-[#C9A84C]/10 px-2 py-0.5 text-xs text-[#C9A84C] hover:bg-[#C9A84C]/20"
                >
                  Follow
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
