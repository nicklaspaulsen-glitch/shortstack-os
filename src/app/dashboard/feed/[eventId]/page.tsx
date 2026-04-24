"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Loader2, Send, Trash2 } from "lucide-react";
import ActivityCard, { type ActivityEvent } from "@/components/activity/activity-card";

interface Comment {
  id: string;
  user_id: string | null;
  content: string;
  created_at: string;
  edited_at: string | null;
  author?: { id: string; full_name: string | null; avatar_url: string | null } | null;
}

export default function FeedEventDetailPage() {
  const params = useParams<{ eventId: string }>();
  const router = useRouter();
  const eventId = params?.eventId;

  const [event, setEvent] = useState<ActivityEvent | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!eventId) return;
    setLoading(true);
    try {
      const [evRes, commentsRes] = await Promise.all([
        fetch(`/api/feed/events/${eventId}`, { cache: "no-store" }),
        fetch(`/api/feed/events/${eventId}/comments`, { cache: "no-store" }),
      ]);
      const evJson = await evRes.json();
      const cJson = await commentsRes.json();
      if (!evRes.ok) throw new Error(evJson?.error || "Not found");
      setEvent(evJson.event);
      setComments(cJson.comments ?? []);
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [eventId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function submitComment(e: React.FormEvent) {
    e.preventDefault();
    const content = draft.trim();
    if (!content || sending) return;
    setSending(true);
    try {
      const res = await fetch(`/api/feed/events/${eventId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      });
      if (!res.ok) throw new Error((await res.json()).error || "send failed");
      setDraft("");
      await load();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSending(false);
    }
  }

  async function deleteComment(commentId: string) {
    try {
      await fetch(`/api/feed/events/${eventId}/comments?comment_id=${commentId}`, {
        method: "DELETE",
      });
      await load();
    } catch {
      /* swallow */
    }
  }

  return (
    <div className="mx-auto max-w-3xl px-4 pb-24 pt-6">
      <button
        onClick={() => router.push("/dashboard/feed")}
        className="mb-4 flex items-center gap-1.5 text-sm text-slate-400 hover:text-slate-200"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to feed
      </button>

      {loading ? (
        <div className="flex justify-center py-24 text-slate-500">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      ) : error || !event ? (
        <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-6 text-sm text-red-400">
          {error || "Event not found"}
        </div>
      ) : (
        <>
          <ActivityCard event={event} />

          {/* Thread */}
          <section className="mt-6 space-y-3">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              {comments.length} {comments.length === 1 ? "comment" : "comments"}
            </h2>
            {comments.length === 0 && (
              <p className="text-sm text-slate-500">Be the first to chime in.</p>
            )}
            {comments.map((c) => (
              <article
                key={c.id}
                className="flex items-start gap-3 rounded-lg border border-white/5 bg-slate-900/40 p-3"
              >
                {c.author?.avatar_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={c.author.avatar_url}
                    alt={c.author.full_name ?? ""}
                    className="h-8 w-8 rounded-full object-cover"
                  />
                ) : (
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-700 text-xs font-semibold text-slate-200">
                    {(c.author?.full_name?.[0] ?? "?").toUpperCase()}
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline gap-2 text-sm">
                    <span className="font-medium text-slate-100">
                      {c.author?.full_name ?? "User"}
                    </span>
                    <time className="text-xs text-slate-500">
                      {new Date(c.created_at).toLocaleString()}
                    </time>
                    {c.edited_at && <span className="text-xs text-slate-600">(edited)</span>}
                  </div>
                  <p className="mt-1 whitespace-pre-wrap text-sm text-slate-300">{c.content}</p>
                </div>
                <button
                  onClick={() => deleteComment(c.id)}
                  className="rounded p-1 text-slate-600 hover:bg-white/5 hover:text-red-400"
                  title="Delete own comment"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </article>
            ))}
          </section>

          {/* New comment */}
          <form onSubmit={submitComment} className="mt-4 flex items-end gap-2">
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              rows={2}
              placeholder="Write a comment…"
              className="flex-1 rounded-lg border border-white/10 bg-slate-900/60 p-3 text-sm text-slate-100 placeholder:text-slate-500 focus:border-[#C9A84C]/60 focus:outline-none"
            />
            <button
              type="submit"
              disabled={sending || !draft.trim()}
              className="flex h-11 items-center gap-1.5 rounded-lg bg-[#C9A84C] px-4 text-sm font-medium text-slate-950 hover:bg-[#dfba57] disabled:opacity-50"
            >
              {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              Post
            </button>
          </form>
        </>
      )}
    </div>
  );
}
