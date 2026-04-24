"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import ReactMarkdown from "react-markdown";
import {
  ArrowLeft, Loader2, MessageSquare, Trash2, Pin, Hash,
  Send, Reply,
} from "lucide-react";
import toast from "react-hot-toast";
import { useAuth } from "@/lib/auth-context";
import { COMMUNITY_CHANNELS, REACTION_EMOJIS } from "../channels";

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
  pinned: boolean;
  likes: number;
  comments_count: number;
  reaction_count: number;
  created_at: string;
  updated_at: string;
}

interface Comment {
  id: string;
  post_id: string;
  parent_id: string | null;
  user_id: string;
  author_name: string;
  author_avatar: string | null;
  content: string;
  likes: number;
  reaction_count: number;
  created_at: string;
  updated_at: string;
}

interface ReactionSummaryEntry {
  emoji: string;
  count: number;
  mine: boolean;
}

interface MentionUser {
  id: string;
  handle: string;
  display_name: string;
  avatar_url: string | null;
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

function initials(name: string): string {
  if (!name) return "M";
  const parts = name.trim().split(/\s+/);
  return (parts[0][0] + (parts[1]?.[0] || "")).toUpperCase();
}

/* ------------------------------------------------------------------ */
/*  Page                                                               */
/* ------------------------------------------------------------------ */

export default function CommunityPostDetailPage() {
  const params = useParams<{ postId: string }>();
  const router = useRouter();
  const postId = params?.postId;
  const { user } = useAuth();
  const me = user?.id || null;

  const [post, setPost] = useState<Post | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [postReactions, setPostReactions] = useState<ReactionSummaryEntry[]>(
    [],
  );
  const [commentReactions, setCommentReactions] = useState<
    Record<string, ReactionSummaryEntry[]>
  >({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [commentInput, setCommentInput] = useState("");
  const [replyingTo, setReplyingTo] = useState<Comment | null>(null);
  const [submittingComment, setSubmittingComment] = useState(false);

  const fetchAll = useCallback(async () => {
    if (!postId) return;
    setLoading(true);
    setError(null);
    try {
      const [postRes, commentsRes] = await Promise.all([
        fetch(`/api/community/posts/${postId}`),
        fetch(`/api/community/comments?post_id=${postId}`),
      ]);

      if (!postRes.ok) {
        const payload = await postRes.json().catch(() => ({}));
        throw new Error(payload.error || `Post not found`);
      }

      const postData = await postRes.json();
      setPost(postData.post);
      setPostReactions(postData.reaction_summary || []);

      const commentsData = await commentsRes.json();
      const fetchedComments: Comment[] = commentsData.comments || [];
      setComments(fetchedComments);

      // Pull reactions for every comment in parallel — keeps the threaded
      // reaction bar accurate without a bespoke RPC.
      const reactionMap: Record<string, ReactionSummaryEntry[]> = {};
      await Promise.all(
        fetchedComments.map(async (c: Comment) => {
          try {
            const r = await fetch(
              `/api/community/reactions?target_type=comment&target_id=${c.id}`,
            );
            if (r.ok) {
              const rd = await r.json();
              reactionMap[c.id] = rd.summary || [];
            }
          } catch {
            /* ignore single failure */
          }
        }),
      );
      setCommentReactions(reactionMap);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [postId]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  async function toggleReaction(
    targetType: "post" | "comment",
    targetId: string,
    emoji: string,
  ) {
    try {
      const res = await fetch("/api/community/reactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          target_type: targetType,
          target_id: targetId,
          emoji,
        }),
      });
      if (!res.ok) throw new Error("Reaction failed");
      // Optimistically update the local cache
      if (targetType === "post") {
        setPostReactions((prev) => applyToggle(prev, emoji));
      } else {
        setCommentReactions((prev) => ({
          ...prev,
          [targetId]: applyToggle(prev[targetId] || [], emoji),
        }));
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to react");
    }
  }

  async function submitComment() {
    if (!postId || !commentInput.trim()) return;
    setSubmittingComment(true);
    try {
      const res = await fetch("/api/community/comments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          post_id: postId,
          content: commentInput.trim(),
          parent_id: replyingTo?.id || null,
        }),
      });
      if (!res.ok) {
        const payload = await res.json().catch(() => ({}));
        throw new Error(payload.error || "Comment failed");
      }
      setCommentInput("");
      setReplyingTo(null);
      await fetchAll();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to comment");
    } finally {
      setSubmittingComment(false);
    }
  }

  async function deletePost() {
    if (!post) return;
    if (!confirm("Delete this post? This cannot be undone.")) return;
    try {
      const res = await fetch(`/api/community/posts/${post.id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Delete failed");
      toast.success("Post deleted");
      router.push("/dashboard/community");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete");
    }
  }

  async function deleteComment(c: Comment) {
    if (!confirm("Delete this comment?")) return;
    try {
      const res = await fetch(`/api/community/comments/${c.id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Delete failed");
      await fetchAll();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete");
    }
  }

  const tree = useMemo(() => buildCommentTree(comments), [comments]);

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center">
        <Loader2 size={24} className="animate-spin text-muted" />
      </div>
    );
  }

  if (error || !post) {
    return (
      <div className="p-6 max-w-3xl mx-auto">
        <Link
          href="/dashboard/community"
          className="inline-flex items-center gap-1 text-sm text-muted hover:text-foreground mb-4"
        >
          <ArrowLeft size={14} /> Back to community
        </Link>
        <div className="card border-danger/40 text-danger text-sm">
          {error || "Post not found"}
        </div>
      </div>
    );
  }

  const channelMeta = COMMUNITY_CHANNELS.find((c) => c.id === post.channel);
  const ChannelIcon = channelMeta?.icon ?? Hash;
  const isAuthor = me && me === post.user_id;

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <Link
        href="/dashboard/community"
        className="inline-flex items-center gap-1 text-sm text-muted hover:text-foreground"
      >
        <ArrowLeft size={14} /> Back to community
      </Link>

      <article className="card">
        <div className="flex items-start gap-3">
          <Avatar
            name={post.author_name}
            src={post.author_avatar}
            size={44}
          />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 text-xs text-muted flex-wrap">
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
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-surface-light border border-border/40">
                <ChannelIcon
                  size={10}
                  className={channelMeta?.color || "text-muted"}
                />
                {channelMeta?.label || post.channel}
              </span>
              {isAuthor && (
                <button
                  onClick={deletePost}
                  className="ml-auto text-muted hover:text-danger inline-flex items-center gap-1"
                >
                  <Trash2 size={12} /> Delete
                </button>
              )}
            </div>

            <h1 className="mt-1 text-xl font-bold">{post.title}</h1>

            <div className="mt-4 prose prose-invert prose-sm max-w-none prose-pre:bg-surface-light prose-code:text-gold">
              <ReactMarkdown>{post.content}</ReactMarkdown>
            </div>

            <ReactionBar
              summary={postReactions}
              onToggle={(emoji) => toggleReaction("post", post.id, emoji)}
            />
          </div>
        </div>
      </article>

      {/* Comments */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-muted">
          <MessageSquare size={14} className="inline mr-1 -mt-0.5" />
          {post.comments_count} comment
          {post.comments_count === 1 ? "" : "s"}
        </h2>

        {tree.length === 0 ? (
          <div className="card text-sm text-muted text-center py-6">
            No comments yet &mdash; be the first to respond.
          </div>
        ) : (
          <ul className="space-y-2">
            {tree.map((c) => (
              <CommentNode
                key={c.id}
                node={c}
                depth={0}
                me={me}
                reactions={commentReactions}
                onReply={(node) => {
                  setReplyingTo(node);
                  setTimeout(() => {
                    document
                      .getElementById("community-comment-input")
                      ?.focus();
                  }, 60);
                }}
                onDelete={deleteComment}
                onReact={(id, emoji) =>
                  toggleReaction("comment", id, emoji)
                }
              />
            ))}
          </ul>
        )}

        <CommentComposer
          value={commentInput}
          onChange={setCommentInput}
          onSubmit={submitComment}
          submitting={submittingComment}
          replyingTo={replyingTo}
          onCancelReply={() => setReplyingTo(null)}
        />
      </section>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Reaction bar                                                       */
/* ------------------------------------------------------------------ */

function ReactionBar({
  summary,
  onToggle,
}: {
  summary: ReactionSummaryEntry[];
  onToggle: (emoji: string) => void;
}) {
  const byEmoji = new Map(summary.map((s) => [s.emoji, s]));
  return (
    <div className="mt-4 flex items-center gap-1 flex-wrap">
      {REACTION_EMOJIS.map((emoji) => {
        const entry = byEmoji.get(emoji);
        const count = entry?.count || 0;
        const mine = entry?.mine || false;
        return (
          <button
            key={emoji}
            onClick={() => onToggle(emoji)}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-sm border transition-colors ${
              mine
                ? "bg-gold/15 border-gold/40 text-gold"
                : "bg-surface-light border-border/40 text-muted hover:text-foreground hover:border-border"
            }`}
          >
            <span className="text-base leading-none">{emoji}</span>
            {count > 0 && (
              <span className="text-xs font-medium">{count}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Comment tree                                                       */
/* ------------------------------------------------------------------ */

interface CommentTreeNode extends Comment {
  children: CommentTreeNode[];
}

function buildCommentTree(comments: Comment[]): CommentTreeNode[] {
  const byId = new Map<string, CommentTreeNode>();
  for (const c of comments) {
    byId.set(c.id, { ...c, children: [] });
  }
  const roots: CommentTreeNode[] = [];
  const values = Array.from(byId.values());
  for (const c of values) {
    if (c.parent_id && byId.has(c.parent_id)) {
      byId.get(c.parent_id)!.children.push(c);
    } else {
      roots.push(c);
    }
  }
  return roots;
}

function CommentNode({
  node,
  depth,
  me,
  reactions,
  onReply,
  onDelete,
  onReact,
}: {
  node: CommentTreeNode;
  depth: number;
  me: string | null;
  reactions: Record<string, ReactionSummaryEntry[]>;
  onReply: (c: CommentTreeNode) => void;
  onDelete: (c: Comment) => void;
  onReact: (id: string, emoji: string) => void;
}) {
  const isAuthor = me && me === node.user_id;
  const summary = reactions[node.id] || [];
  return (
    <li
      className="flex gap-3"
      style={{ marginLeft: depth > 0 ? depth * 24 : 0 }}
    >
      <Avatar name={node.author_name} src={node.author_avatar} size={28} />
      <div className="flex-1 min-w-0">
        <div className="rounded-xl bg-surface-light border border-border/30 p-3">
          <div className="flex items-center gap-2 text-xs text-muted">
            <span className="font-medium text-foreground">
              {node.author_name}
            </span>
            <span>&middot;</span>
            <span>{timeAgo(node.created_at)}</span>
            {isAuthor && (
              <button
                onClick={() => onDelete(node)}
                className="ml-auto text-muted hover:text-danger"
              >
                <Trash2 size={11} />
              </button>
            )}
          </div>
          <div className="mt-1 text-sm whitespace-pre-wrap">
            {renderWithMentions(node.content)}
          </div>
        </div>

        <div className="mt-1.5 flex items-center gap-2 text-xs text-muted">
          <button
            onClick={() => onReply(node)}
            className="inline-flex items-center gap-1 hover:text-foreground"
          >
            <Reply size={11} /> Reply
          </button>
          {REACTION_EMOJIS.map((emoji) => {
            const entry = summary.find((s) => s.emoji === emoji);
            return (
              <button
                key={emoji}
                onClick={() => onReact(node.id, emoji)}
                className={`inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 ${
                  entry?.mine ? "text-gold" : "hover:text-foreground"
                }`}
              >
                <span className="text-sm leading-none">{emoji}</span>
                {entry?.count ? <span>{entry.count}</span> : null}
              </button>
            );
          })}
        </div>

        {node.children.length > 0 && (
          <ul className="mt-2 space-y-2">
            {node.children.map((child) => (
              <CommentNode
                key={child.id}
                node={child}
                depth={depth + 1}
                me={me}
                reactions={reactions}
                onReply={onReply}
                onDelete={onDelete}
                onReact={onReact}
              />
            ))}
          </ul>
        )}
      </div>
    </li>
  );
}

/* Render plain-text comment, linking @mentions. */
function renderWithMentions(text: string) {
  const parts = text.split(/(@[A-Za-z0-9._-]{2,40})/g);
  return parts.map((part, i) => {
    if (part.startsWith("@")) {
      return (
        <span key={i} className="text-gold font-medium">
          {part}
        </span>
      );
    }
    return <span key={i}>{part}</span>;
  });
}

/* ------------------------------------------------------------------ */
/*  Comment composer with @mention autocomplete                        */
/* ------------------------------------------------------------------ */

function CommentComposer({
  value,
  onChange,
  onSubmit,
  submitting,
  replyingTo,
  onCancelReply,
}: {
  value: string;
  onChange: (v: string) => void;
  onSubmit: () => void;
  submitting: boolean;
  replyingTo: Comment | null;
  onCancelReply: () => void;
}) {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const [suggestions, setSuggestions] = useState<MentionUser[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [suggestionIndex, setSuggestionIndex] = useState(0);

  // Inspect the text up to the caret. If the latest run starts with "@" and
  // has no whitespace, treat it as an active mention query.
  const mentionQuery = useMemo(() => {
    if (!textareaRef.current) return null;
    const pos = textareaRef.current.selectionStart ?? value.length;
    const before = value.slice(0, pos);
    const match = before.match(/(?:^|\s)@([A-Za-z0-9._-]*)$/);
    return match ? match[1] : null;
  }, [value]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (mentionQuery === null) {
        setShowSuggestions(false);
        return;
      }
      try {
        const res = await fetch(
          `/api/community/users?q=${encodeURIComponent(mentionQuery)}`,
        );
        if (!res.ok) return;
        const data = await res.json();
        if (cancelled) return;
        setSuggestions(data.users || []);
        setSuggestionIndex(0);
        setShowSuggestions((data.users || []).length > 0);
      } catch {
        /* ignore */
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [mentionQuery]);

  function applySuggestion(user: MentionUser) {
    if (!textareaRef.current) return;
    const pos = textareaRef.current.selectionStart ?? value.length;
    const before = value.slice(0, pos);
    const after = value.slice(pos);
    const replaced = before.replace(
      /(^|\s)@([A-Za-z0-9._-]*)$/,
      `$1@${user.handle} `,
    );
    const next = replaced + after;
    onChange(next);
    setShowSuggestions(false);
    setTimeout(() => {
      if (textareaRef.current) {
        textareaRef.current.focus();
        const caret = replaced.length;
        textareaRef.current.setSelectionRange(caret, caret);
      }
    }, 0);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (showSuggestions && suggestions.length > 0) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSuggestionIndex((i) => (i + 1) % suggestions.length);
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setSuggestionIndex((i) =>
          i - 1 < 0 ? suggestions.length - 1 : i - 1,
        );
        return;
      }
      if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault();
        applySuggestion(suggestions[suggestionIndex]);
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        setShowSuggestions(false);
        return;
      }
    }
    if (
      (e.key === "Enter" && (e.metaKey || e.ctrlKey)) ||
      (e.key === "Enter" && !e.shiftKey && !showSuggestions)
    ) {
      e.preventDefault();
      if (value.trim()) onSubmit();
    }
  }

  return (
    <div className="card relative">
      {replyingTo && (
        <div className="mb-2 text-xs text-muted flex items-center gap-2">
          <Reply size={11} /> Replying to{" "}
          <span className="font-medium text-foreground">
            {replyingTo.author_name}
          </span>
          <button
            onClick={onCancelReply}
            className="ml-auto hover:text-foreground underline"
          >
            cancel
          </button>
        </div>
      )}

      <textarea
        id="community-comment-input"
        ref={textareaRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={onKeyDown}
        rows={3}
        placeholder="Write a comment... type @ to mention someone"
        className="w-full px-3 py-2 rounded-lg bg-surface-light border border-border/50 text-sm focus:outline-none focus:border-gold/50 resize-none"
      />

      {showSuggestions && suggestions.length > 0 && (
        <div className="absolute left-5 right-5 bottom-full mb-2 z-20 rounded-lg bg-surface border border-border/60 shadow-xl overflow-hidden">
          <ul className="max-h-56 overflow-y-auto">
            {suggestions.map((user, i) => (
              <li key={user.id}>
                <button
                  onMouseDown={(e) => {
                    // Use mousedown so we fire before the textarea blurs and
                    // the list closes.
                    e.preventDefault();
                    applySuggestion(user);
                  }}
                  onMouseEnter={() => setSuggestionIndex(i)}
                  className={`w-full flex items-center gap-2 px-3 py-2 text-left text-sm ${
                    i === suggestionIndex
                      ? "bg-surface-light"
                      : "hover:bg-surface-light"
                  }`}
                >
                  <Avatar
                    name={user.display_name}
                    src={user.avatar_url}
                    size={24}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="font-medium truncate">
                      {user.display_name}
                    </div>
                    <div className="text-xs text-muted truncate">
                      @{user.handle}
                    </div>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-2 flex items-center justify-between text-xs text-muted">
        <span>
          Markdown supported. Press <kbd>Enter</kbd> to send,{" "}
          <kbd>Shift</kbd>+<kbd>Enter</kbd> for a new line.
        </span>
        <button
          onClick={onSubmit}
          disabled={submitting || !value.trim()}
          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-gold text-background font-semibold text-sm hover:bg-gold/90 disabled:opacity-50"
        >
          {submitting ? (
            <Loader2 size={12} className="animate-spin" />
          ) : (
            <Send size={12} />
          )}
          Send
        </button>
      </div>
    </div>
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

/* Apply a local toggle update to a reaction summary list so the UI feels
 * instant while the server commits the real row. */
function applyToggle(
  list: ReactionSummaryEntry[],
  emoji: string,
): ReactionSummaryEntry[] {
  const existing = list.find((r) => r.emoji === emoji);
  if (!existing) {
    return [...list, { emoji, count: 1, mine: true }];
  }
  if (existing.mine) {
    const nextCount = Math.max(0, existing.count - 1);
    if (nextCount === 0) return list.filter((r) => r.emoji !== emoji);
    return list.map((r) =>
      r.emoji === emoji ? { ...r, count: nextCount, mine: false } : r,
    );
  }
  return list.map((r) =>
    r.emoji === emoji ? { ...r, count: r.count + 1, mine: true } : r,
  );
}
