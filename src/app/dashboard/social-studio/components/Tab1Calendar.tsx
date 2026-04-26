"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Calendar, Filter, Loader2, X, Save, Trash2 } from "lucide-react";
import toast from "react-hot-toast";
import StatCard from "@/components/ui/stat-card";
import Modal from "@/components/ui/modal";
import { ALL_PLATFORMS, PLATFORM_META, STATUS_META } from "@/lib/social-studio/constants";
import type {
  PostStats,
  SocialPlatform,
  SocialPost,
  SocialPostStatus,
} from "@/lib/social-studio/types";
import PlatformChip from "./PlatformChip";
import StatusBadge from "./StatusBadge";

const STATUS_OPTIONS: SocialPostStatus[] = [
  "draft",
  "scheduled",
  "publishing",
  "published",
  "failed",
  "cancelled",
];

function isoDay(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function startOfMonth(d: Date): Date {
  const x = new Date(d.getFullYear(), d.getMonth(), 1);
  x.setHours(0, 0, 0, 0);
  return x;
}

function buildMonthGrid(anchor: Date): Date[] {
  // Standard 6-row month grid starting on Sunday so the calendar
  // never reflows when months have varying first-day-of-week.
  const first = startOfMonth(anchor);
  const start = new Date(first);
  start.setDate(first.getDate() - first.getDay());
  const cells: Date[] = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    cells.push(d);
  }
  return cells;
}

export default function Tab1Calendar() {
  const [posts, setPosts] = useState<SocialPost[]>([]);
  const [stats, setStats] = useState<PostStats>({
    total_scheduled: 0,
    posts_this_week: 0,
    published_this_month: 0,
    avg_engagement_rate: 0,
  });
  const [loading, setLoading] = useState(true);
  const [statusFilters, setStatusFilters] = useState<SocialPostStatus[]>(["scheduled", "published", "draft"]);
  const [platformFilters, setPlatformFilters] = useState<SocialPlatform[]>([]);
  const [anchor, setAnchor] = useState(() => new Date());
  const [selected, setSelected] = useState<SocialPost | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);

  // Local edit copy so the modal can revert on cancel without round-trip.
  const [editCaption, setEditCaption] = useState("");
  const [editScheduled, setEditScheduled] = useState("");

  const fetchLineup = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilters.length > 0 && statusFilters.length < STATUS_OPTIONS.length) {
        params.set("status", statusFilters.join(","));
      }
      if (platformFilters.length > 0) {
        params.set("platforms", platformFilters.join(","));
      }
      params.set("limit", "300");
      const res = await fetch(`/api/social/lineup?${params.toString()}`);
      if (!res.ok) {
        toast.error("Couldn't load posts");
        setPosts([]);
        return;
      }
      const json = await res.json();
      setPosts((json.posts ?? []) as SocialPost[]);
      if (json.stats) setStats(json.stats as PostStats);
    } finally {
      setLoading(false);
    }
  }, [statusFilters, platformFilters]);

  useEffect(() => { void fetchLineup(); }, [fetchLineup]);

  const grid = useMemo(() => buildMonthGrid(anchor), [anchor]);

  const postsByDay = useMemo(() => {
    const map = new Map<string, SocialPost[]>();
    for (const post of posts) {
      const at = post.scheduled_at ?? post.published_at ?? post.created_at;
      if (!at) continue;
      const key = isoDay(new Date(at));
      const list = map.get(key);
      if (list) list.push(post);
      else map.set(key, [post]);
    }
    return map;
  }, [posts]);

  const monthLabel = anchor.toLocaleString(undefined, { month: "long", year: "numeric" });

  const onSelectPost = (p: SocialPost) => {
    setSelected(p);
    setEditCaption(p.caption ?? p.content ?? "");
    setEditScheduled(p.scheduled_at ? p.scheduled_at.slice(0, 16) : "");
  };

  const handleSaveEdit = async () => {
    if (!selected) return;
    setSavingId(selected.id);
    try {
      const res = await fetch("/api/social/lineup", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: selected.id,
          caption: editCaption,
          scheduled_at: editScheduled ? new Date(editScheduled).toISOString() : null,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        toast.error(err.error ?? "Couldn't save");
        return;
      }
      toast.success("Post updated");
      setSelected(null);
      void fetchLineup();
    } finally {
      setSavingId(null);
    }
  };

  const handleCancelPost = async () => {
    if (!selected) return;
    if (!confirm("Cancel this post? You'll keep the row but it won't publish.")) return;
    setSavingId(selected.id);
    try {
      const res = await fetch(`/api/social/lineup?id=${encodeURIComponent(selected.id)}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        toast.error("Couldn't cancel");
        return;
      }
      toast.success("Post cancelled");
      setSelected(null);
      void fetchLineup();
    } finally {
      setSavingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard label="Total scheduled" value={stats.total_scheduled} icon={<Calendar size={16} />} />
        <StatCard label="Posts this week" value={stats.posts_this_week} />
        <StatCard label="Published this month" value={stats.published_this_month} />
        <StatCard label="Avg engagement rate" value={`${stats.avg_engagement_rate}%`} />
      </div>

      <div className="rounded-xl border border-border/40 bg-surface p-4">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-4">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                const d = new Date(anchor);
                d.setMonth(d.getMonth() - 1);
                setAnchor(d);
              }}
              className="px-2 py-1 rounded-md border border-border/40 hover:bg-elevated text-xs"
            >
              Previous
            </button>
            <h2 className="text-sm font-semibold tracking-tight px-2">{monthLabel}</h2>
            <button
              type="button"
              onClick={() => {
                const d = new Date(anchor);
                d.setMonth(d.getMonth() + 1);
                setAnchor(d);
              }}
              className="px-2 py-1 rounded-md border border-border/40 hover:bg-elevated text-xs"
            >
              Next
            </button>
            <button
              type="button"
              onClick={() => setAnchor(new Date())}
              className="px-2 py-1 rounded-md border border-border/40 hover:bg-elevated text-xs"
            >
              Today
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Filter size={12} className="text-muted" />
            <span className="text-[10px] uppercase tracking-wider text-muted">Status</span>
            {STATUS_OPTIONS.map((s) => {
              const meta = STATUS_META[s];
              const active = statusFilters.includes(s);
              return (
                <button
                  key={s}
                  type="button"
                  onClick={() => setStatusFilters((prev) =>
                    prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s],
                  )}
                  className={`px-2 py-0.5 text-[10px] rounded-full border transition-all ${
                    active ? "" : "opacity-40"
                  }`}
                  style={{
                    background: meta.bg,
                    color: meta.color,
                    borderColor: `${meta.color}33`,
                  }}
                >
                  {meta.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 mb-3">
          <span className="text-[10px] uppercase tracking-wider text-muted">Platform</span>
          {ALL_PLATFORMS.map((p) => {
            const active = platformFilters.includes(p);
            const meta = PLATFORM_META[p];
            return (
              <button
                key={p}
                type="button"
                onClick={() => setPlatformFilters((prev) =>
                  prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p],
                )}
                className={`px-2 py-0.5 text-[10px] rounded-full border transition-all ${active ? "" : "opacity-40"}`}
                style={{
                  background: meta.bg,
                  color: meta.color,
                  borderColor: meta.border,
                }}
              >
                {meta.label}
              </button>
            );
          })}
          {platformFilters.length > 0 && (
            <button
              type="button"
              onClick={() => setPlatformFilters([])}
              className="text-[10px] text-muted underline"
            >
              clear
            </button>
          )}
        </div>

        <div className="grid grid-cols-7 gap-px bg-border/40 rounded-md overflow-hidden text-[10px] uppercase tracking-wider">
          {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
            <div key={d} className="bg-surface px-2 py-1 text-muted text-center">{d}</div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-px bg-border/40 rounded-md mt-px overflow-hidden">
          {grid.map((day) => {
            const key = isoDay(day);
            const inMonth = day.getMonth() === anchor.getMonth();
            const todayKey = isoDay(new Date());
            const isToday = key === todayKey;
            const dayPosts = postsByDay.get(key) ?? [];
            return (
              <div
                key={key}
                className={`bg-surface min-h-[100px] p-1.5 flex flex-col gap-1 ${inMonth ? "" : "opacity-40"}`}
              >
                <div className={`text-[10px] font-semibold ${isToday ? "text-gold" : "text-muted"}`}>
                  {day.getDate()}
                </div>
                {loading && dayPosts.length === 0 ? null : (
                  <div className="flex flex-col gap-1">
                    {dayPosts.slice(0, 3).map((p) => {
                      const platform = p.platforms[0];
                      const meta = platform ? PLATFORM_META[platform] : null;
                      return (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => onSelectPost(p)}
                          className="text-left text-[10px] px-1.5 py-0.5 rounded truncate hover:opacity-80 transition-opacity"
                          style={{
                            background: meta?.bg ?? "rgba(161,161,170,0.12)",
                            color: meta?.color ?? "#A1A1AA",
                            border: `1px solid ${meta?.border ?? "rgba(161,161,170,0.25)"}`,
                          }}
                          title={p.caption ?? ""}
                        >
                          {p.caption?.slice(0, 32) ?? "(no caption)"}
                        </button>
                      );
                    })}
                    {dayPosts.length > 3 && (
                      <span className="text-[9px] text-muted pl-1">+{dayPosts.length - 3} more</span>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {loading && (
          <div className="flex items-center justify-center gap-2 mt-4 text-xs text-muted">
            <Loader2 size={12} className="animate-spin" />
            Loading lineup...
          </div>
        )}
        {!loading && posts.length === 0 && (
          <div className="text-center py-8 text-xs text-muted">
            No posts yet — try the AI Auto-Upload tab to schedule your first one.
          </div>
        )}
      </div>

      <Modal
        isOpen={!!selected}
        onClose={() => setSelected(null)}
        title="Post details"
        size="lg"
      >
        {selected && (
          <div className="px-5 py-4 space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge status={selected.status} />
              {selected.platforms.map((p) => <PlatformChip key={p} platform={p} />)}
              {selected.scheduled_at && (
                <span className="text-[10px] text-muted">
                  Scheduled {new Date(selected.scheduled_at).toLocaleString()}
                </span>
              )}
              {selected.published_at && (
                <span className="text-[10px] text-muted">
                  Published {new Date(selected.published_at).toLocaleString()}
                </span>
              )}
            </div>

            <div>
              <label className="text-[10px] uppercase tracking-wider text-muted">Caption</label>
              <textarea
                value={editCaption}
                onChange={(e) => setEditCaption(e.target.value)}
                rows={6}
                className="w-full mt-1 px-3 py-2 rounded-md bg-elevated border border-border/40 text-sm"
              />
            </div>

            <div>
              <label className="text-[10px] uppercase tracking-wider text-muted">Scheduled at</label>
              <input
                type="datetime-local"
                value={editScheduled}
                onChange={(e) => setEditScheduled(e.target.value)}
                className="w-full mt-1 px-3 py-2 rounded-md bg-elevated border border-border/40 text-sm"
              />
              {selected.status === "published" && (
                <p className="text-[10px] text-muted mt-1">
                  This post is already published — editing the time here only updates the local record.
                </p>
              )}
            </div>

            {selected.hashtags && selected.hashtags.length > 0 && (
              <div>
                <label className="text-[10px] uppercase tracking-wider text-muted">Hashtags</label>
                <div className="flex flex-wrap gap-1 mt-1">
                  {selected.hashtags.map((h) => (
                    <span key={h} className="text-[10px] px-1.5 py-0.5 rounded bg-elevated">
                      {h}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {selected.media_urls && selected.media_urls.length > 0 && (
              <div>
                <label className="text-[10px] uppercase tracking-wider text-muted">Media</label>
                <div className="flex flex-wrap gap-2 mt-1">
                  {selected.media_urls.map((u) => (
                    <a
                      key={u}
                      href={u}
                      target="_blank"
                      rel="noreferrer"
                      className="text-[10px] underline truncate max-w-[200px]"
                    >
                      {u}
                    </a>
                  ))}
                </div>
              </div>
            )}

            <div className="flex items-center justify-between pt-2 border-t border-border/30">
              <button
                type="button"
                onClick={handleCancelPost}
                disabled={savingId === selected.id || selected.status === "cancelled"}
                className="inline-flex items-center gap-1.5 text-xs text-danger hover:underline disabled:opacity-50"
              >
                <Trash2 size={12} />
                Cancel post
              </button>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setSelected(null)}
                  className="px-3 py-1.5 text-xs rounded-md border border-border/40 hover:bg-elevated"
                >
                  <X size={12} className="inline mr-1" />
                  Close
                </button>
                <button
                  type="button"
                  onClick={handleSaveEdit}
                  disabled={savingId === selected.id}
                  className="px-3 py-1.5 text-xs rounded-md bg-gold/20 text-gold border border-gold/30 hover:bg-gold/30 disabled:opacity-50"
                >
                  {savingId === selected.id ? (
                    <Loader2 size={12} className="inline mr-1 animate-spin" />
                  ) : (
                    <Save size={12} className="inline mr-1" />
                  )}
                  Save
                </button>
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
