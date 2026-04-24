"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import {
  MessageSquare, Plus, Pin, Users, TrendingUp,
  Hash, Loader2, X,
} from "lucide-react";
import PageHero from "@/components/ui/page-hero";
import toast from "react-hot-toast";
import { COMMUNITY_CHANNELS, type ChannelId } from "./channels";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface Post {
  id: string;
  user_id: string;
  author_name: string;
  author_avatar: string | null;
  title: string;
  content: string;
  channel: string;
  category: string;
  pinned: boolean;
  likes: number;
  comments_count: number;
  reaction_count: number;
  created_at: string;
  updated_at: string;
}

interface ActiveMember {
  user_id: string;
  author_name: string;
  author_avatar: string | null;
  last_post_at: string;
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function timeAgo(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const seconds = Math.max(0, Math.floor((now - then) / 1000));
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  return `${months}mo ago`;
}

function snippet(markdown: string, n = 220): string {
  if (!markdown) return "";
  const clean = markdown
    .replace(/```[\s\S]*?```/g, "")
    .replace(/[#*_`>~-]/g, "")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
  return clean.length <= n ? clean : clean.slice(0, n - 1) + "\u2026";
}

function initials(name: string): string {
  if (!name) return "M";
  const parts = name.trim().split(/\s+/);
  return (parts[0][0] + (parts[1]?.[0] || "")).toUpperCase();
}

/* ------------------------------------------------------------------ */
/*  Page                                                               */
/* ------------------------------------------------------------------ */

export default function CommunityPage() {
  const [activeChannel, setActiveChannel] = useState<ChannelId | "all">("all");
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showNewPost, setShowNewPost] = useState(false);
  const [creating, setCreating] = useState(false);

  // new post form state
  const [newTitle, setNewTitle] = useState("");
  const [newBody, setNewBody] = useState("");
  const [newChannel, setNewChannel] = useState<ChannelId>("announcements");

  const fetchPosts = useCallback(async (channel: ChannelId | "all") => {
    setLoading(true);
    setError(null);
    try {
      const qs = channel === "all" ? "" : `?channel=${channel}`;
      const res = await fetch(`/api/community/posts${qs}`);
      if (!res.ok) {
        const payload = await res.json().catch(() => ({}));
        throw new Error(payload.error || `Failed (${res.status})`);
      }
      const data = await res.json();
      setPosts(data.posts || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load posts");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPosts(activeChannel);
  }, [activeChannel, fetchPosts]);

  const counts = useMemo(() => {
    const map: Record<string, number> = {};
    for (const p of posts) {
      map[p.channel] = (map[p.channel] || 0) + 1;
    }
    return map;
  }, [posts]);

  const activeMembers = useMemo<ActiveMember[]>(() => {
    const seen = new Set<string>();
    const out: ActiveMember[] = [];
    for (const p of posts) {
      if (seen.has(p.user_id)) continue;
      seen.add(p.user_id);
      out.push({
        user_id: p.user_id,
        author_name: p.author_name,
        author_avatar: p.author_avatar,
        last_post_at: p.created_at,
      });
      if (out.length >= 5) break;
    }
    return out;
  }, [posts]);

  const trendingPosts = useMemo(() => {
    const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    return [...posts]
      .filter((p) => new Date(p.created_at).getTime() >= weekAgo)
      .sort((a, b) => (b.reaction_count || 0) - (a.reaction_count || 0))
      .slice(0, 5);
  }, [posts]);

  async function handleCreatePost() {
    if (!newTitle.trim() || !newBody.trim()) {
      toast.error("Title and body are required");
      return;
    }
    setCreating(true);
    try {
      const res = await fetch("/api/community/posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: newTitle,
          body: newBody,
          channel: newChannel,
        }),
      });
      if (!res.ok) {
        const payload = await res.json().catch(() => ({}));
        throw new Error(payload.error || `Failed (${res.status})`);
      }
      toast.success("Posted");
      setShowNewPost(false);
      setNewTitle("");
      setNewBody("");
      setNewChannel(activeChannel === "all" ? "announcements" : activeChannel);
      await fetchPosts(activeChannel);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to post");
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="p-6 space-y-6 max-w-[1400px] mx-auto">
      <PageHero
        title="Community"
        subtitle="Share wins, ask questions, and learn from other ShortStack agencies"
        icon={<Users size={28} />}
        gradient="gold"
        actions={
          <button
            onClick={() => setShowNewPost(true)}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-gold text-background font-semibold text-sm hover:bg-gold/90 transition-colors"
          >
            <Plus size={16} /> New Post
          </button>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-[240px_1fr_280px] gap-6">
        {/* LEFT SIDEBAR — channel list */}
        <aside className="space-y-1">
          <button
            onClick={() => setActiveChannel("all")}
            className={`w-full flex items-center justify-between gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${
              activeChannel === "all"
                ? "bg-gold/10 text-gold border border-gold/30"
                : "text-muted hover:text-foreground hover:bg-surface-light border border-transparent"
            }`}
          >
            <span className="flex items-center gap-2">
              <Hash size={14} /> All posts
            </span>
            <span className="text-xs">{posts.length}</span>
          </button>

          {COMMUNITY_CHANNELS.map((ch) => {
            const Icon = ch.icon;
            const active = activeChannel === ch.id;
            return (
              <button
                key={ch.id}
                onClick={() => setActiveChannel(ch.id as ChannelId)}
                className={`w-full flex items-center justify-between gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${
                  active
                    ? "bg-gold/10 text-gold border border-gold/30"
                    : "text-muted hover:text-foreground hover:bg-surface-light border border-transparent"
                }`}
              >
                <span className="flex items-center gap-2">
                  <Icon size={14} className={active ? "text-gold" : ch.color} />
                  {ch.label}
                </span>
                {counts[ch.id] ? (
                  <span className="text-xs">{counts[ch.id]}</span>
                ) : null}
              </button>
            );
          })}
        </aside>

        {/* MAIN FEED */}
        <main className="space-y-3">
          {error && (
            <div className="card border-danger/40 text-danger text-sm">
              {error}
            </div>
          )}

          {loading ? (
            <div className="card flex items-center justify-center py-16">
              <Loader2 size={20} className="animate-spin text-muted" />
            </div>
          ) : posts.length === 0 ? (
            <div className="card text-center py-12">
              <MessageSquare
                size={32}
                className="text-muted mx-auto mb-3 opacity-50"
              />
              <h3 className="font-semibold mb-1">Nothing here yet</h3>
              <p className="text-sm text-muted mb-4">
                Be the first to post in{" "}
                {activeChannel === "all" ? "this community" : `#${activeChannel}`}.
              </p>
              <button
                onClick={() => setShowNewPost(true)}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-gold text-background font-semibold text-sm hover:bg-gold/90"
              >
                <Plus size={14} /> Start the conversation
              </button>
            </div>
          ) : (
            posts.map((post) => <PostCard key={post.id} post={post} />)
          )}
        </main>

        {/* RIGHT SIDEBAR — active members + trending */}
        <aside className="space-y-4">
          <div className="card">
            <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
              <Users size={14} className="text-gold" /> Active members
            </h3>
            {activeMembers.length === 0 ? (
              <p className="text-xs text-muted">No recent activity</p>
            ) : (
              <ul className="space-y-2">
                {activeMembers.map((m) => (
                  <li
                    key={m.user_id}
                    className="flex items-center gap-2 text-xs"
                  >
                    <Avatar
                      name={m.author_name}
                      src={m.author_avatar}
                      size={24}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-medium">
                        {m.author_name}
                      </div>
                      <div className="text-muted">
                        {timeAgo(m.last_post_at)}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="card">
            <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
              <TrendingUp size={14} className="text-gold" /> Trending this week
            </h3>
            {trendingPosts.length === 0 ? (
              <p className="text-xs text-muted">No reactions yet</p>
            ) : (
              <ul className="space-y-2">
                {trendingPosts.map((p) => (
                  <li key={p.id} className="text-xs">
                    <Link
                      href={`/dashboard/community/${p.id}`}
                      className="block hover:text-gold transition-colors"
                    >
                      <div className="font-medium truncate">{p.title}</div>
                      <div className="text-muted">
                        {p.reaction_count || 0} reactions &middot;{" "}
                        {p.comments_count} comments
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </aside>
      </div>

      {/* NEW POST MODAL */}
      {showNewPost && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/70 backdrop-blur-md"
            onClick={() => setShowNewPost(false)}
          />
          <div className="relative w-full max-w-2xl mx-4 bg-surface border border-border/50 rounded-xl shadow-2xl max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-border/30">
              <h2 className="text-sm font-semibold">New post</h2>
              <button
                onClick={() => setShowNewPost(false)}
                className="p-1 rounded-md hover:bg-surface-light text-muted hover:text-foreground"
              >
                <X size={16} />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-medium text-muted mb-1.5">
                  Channel
                </label>
                <select
                  value={newChannel}
                  onChange={(e) =>
                    setNewChannel(e.target.value as ChannelId)
                  }
                  className="w-full px-3 py-2 rounded-lg bg-surface-light border border-border/50 text-sm focus:outline-none focus:border-gold/50"
                >
                  {COMMUNITY_CHANNELS.map((ch) => (
                    <option key={ch.id} value={ch.id}>
                      #{ch.id} — {ch.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-muted mb-1.5">
                  Title
                </label>
                <input
                  type="text"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  maxLength={160}
                  placeholder="What's this about?"
                  className="w-full px-3 py-2 rounded-lg bg-surface-light border border-border/50 text-sm focus:outline-none focus:border-gold/50"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-muted mb-1.5">
                  Body (markdown supported)
                </label>
                <textarea
                  value={newBody}
                  onChange={(e) => setNewBody(e.target.value)}
                  rows={8}
                  placeholder="Share what's on your mind. You can use **bold**, *italic*, [links](https://...) and `code`."
                  className="w-full px-3 py-2 rounded-lg bg-surface-light border border-border/50 text-sm focus:outline-none focus:border-gold/50 font-mono"
                />
                <p className="mt-1 text-[11px] text-muted">
                  Tip: mention someone with @name — they&apos;ll get a
                  notification.
                </p>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  onClick={() => setShowNewPost(false)}
                  className="px-4 py-2 rounded-lg text-sm text-muted hover:text-foreground hover:bg-surface-light"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreatePost}
                  disabled={
                    creating || !newTitle.trim() || !newBody.trim()
                  }
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-gold text-background font-semibold text-sm hover:bg-gold/90 disabled:opacity-50"
                >
                  {creating ? (
                    <>
                      <Loader2 size={14} className="animate-spin" /> Posting
                    </>
                  ) : (
                    <>
                      <Plus size={14} /> Post
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  PostCard                                                           */
/* ------------------------------------------------------------------ */

function PostCard({ post }: { post: Post }) {
  const channelMeta = COMMUNITY_CHANNELS.find((c) => c.id === post.channel);
  const Icon = channelMeta?.icon ?? Hash;
  return (
    <Link
      href={`/dashboard/community/${post.id}`}
      className="card hover:border-gold/40 transition-colors block"
    >
      <div className="flex items-start gap-3">
        <Avatar name={post.author_name} src={post.author_avatar} size={36} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 text-xs text-muted">
            <span className="font-medium text-foreground">
              {post.author_name}
            </span>
            <span>&middot;</span>
            <span>{timeAgo(post.created_at)}</span>
            {post.pinned && (
              <span className="inline-flex items-center gap-1 text-gold">
                <Pin size={10} /> Pinned
              </span>
            )}
            <span className="ml-auto inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-surface-light border border-border/40">
              <Icon size={10} className={channelMeta?.color || "text-muted"} />
              {channelMeta?.label || post.channel}
            </span>
          </div>

          <h3 className="mt-1 text-base font-semibold">{post.title}</h3>
          <p className="mt-1 text-sm text-muted line-clamp-3">
            {snippet(post.content)}
          </p>

          <div className="mt-3 flex items-center gap-4 text-xs text-muted">
            <span className="inline-flex items-center gap-1">
              <MessageSquare size={12} /> {post.comments_count}
            </span>
            <span className="inline-flex items-center gap-1">
              {"\u{1F44D}"} {post.reaction_count || 0}
            </span>
          </div>
        </div>
      </div>
    </Link>
  );
}

/* ------------------------------------------------------------------ */
/*  Avatar                                                             */
/* ------------------------------------------------------------------ */

function Avatar({
  name,
  src,
  size = 32,
}: {
  name: string;
  src: string | null;
  size?: number;
}) {
  if (src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt={name}
        width={size}
        height={size}
        className="rounded-full object-cover flex-shrink-0"
      />
    );
  }
  return (
    <div
      className="rounded-full bg-surface-light border border-border/50 flex items-center justify-center text-xs font-semibold flex-shrink-0"
      style={{ width: size, height: size }}
    >
      {initials(name)}
    </div>
  );
}
