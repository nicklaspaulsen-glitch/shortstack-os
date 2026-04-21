"use client";

/**
 * Reviews — client review management across Google, Yelp, Trustpilot, etc.
 *
 * MVP ship: no backend yet. Reviews are stored in localStorage so the
 * page feels alive (log a review manually, reply, mark resolved, delete).
 * Next pass will wire to Google Business Profile + Trustpilot APIs; the
 * beta banner sets that expectation.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Star,
  Plus,
  Trash2,
  ArrowLeft,
  MessageSquare,
  Loader,
  ExternalLink,
  CheckCircle2,
} from "lucide-react";
import toast from "react-hot-toast";
import { useAuth } from "@/lib/auth-context";
import PageHero from "@/components/ui/page-hero";
import EmptyState from "@/components/ui/empty-state";

interface Review {
  id: string;
  author: string;
  source: string;
  rating: number; // 1-5
  body: string;
  reply: string;
  status: "new" | "replied" | "resolved";
  created_at: string;
}

const STORAGE_KEY = "ss_reviews_v1";

const SOURCES = ["Google", "Yelp", "Trustpilot", "Facebook", "G2", "Other"];

const STATUS_STYLES: Record<Review["status"], { label: string; tint: string }> = {
  new: { label: "New", tint: "bg-amber-500/15 text-amber-300" },
  replied: { label: "Replied", tint: "bg-sky-500/15 text-sky-300" },
  resolved: { label: "Resolved", tint: "bg-emerald-500/15 text-emerald-300" },
};

function Stars({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((n) => (
        <Star
          key={n}
          size={12}
          className={n <= rating ? "fill-amber-400 text-amber-400" : "text-muted/40"}
        />
      ))}
    </div>
  );
}

export default function ReviewsPage() {
  useAuth();
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);
  const [filter, setFilter] = useState<"all" | Review["status"]>("all");

  const load = useCallback(() => {
    try {
      const raw = typeof window !== "undefined" ? localStorage.getItem(STORAGE_KEY) : null;
      setReviews(raw ? (JSON.parse(raw) as Review[]) : []);
    } catch {
      setReviews([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const persist = (next: Review[]) => {
    setReviews(next);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      /* quota — ignore */
    }
  };

  function remove(id: string) {
    if (!window.confirm("Delete this review entry?")) return;
    persist(reviews.filter((r) => r.id !== id));
    toast.success("Review deleted");
  }

  function reply(id: string, text: string) {
    persist(
      reviews.map((r) =>
        r.id === id
          ? { ...r, reply: text, status: "replied" as const }
          : r,
      ),
    );
    toast.success("Reply saved");
  }

  function resolve(id: string) {
    persist(
      reviews.map((r) =>
        r.id === id ? { ...r, status: "resolved" as const } : r,
      ),
    );
    toast.success("Marked resolved");
  }

  const filtered = useMemo(
    () => (filter === "all" ? reviews : reviews.filter((r) => r.status === filter)),
    [reviews, filter],
  );

  const stats = useMemo(() => {
    const count = reviews.length;
    const avg =
      count === 0
        ? 0
        : Math.round(
            (reviews.reduce((acc, r) => acc + r.rating, 0) / count) * 10,
          ) / 10;
    const unreplied = reviews.filter((r) => r.status === "new").length;
    const critical = reviews.filter((r) => r.rating <= 2).length;
    return { count, avg, unreplied, critical };
  }, [reviews]);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <PageHero
        title="Review Manager"
        subtitle="Log and respond to every review across Google, Yelp, Trustpilot and more — one inbox."
        icon={<Star size={20} />}
        gradient="sunset"
      />

      <div className="mx-auto max-w-5xl space-y-5 px-6 pb-10 pt-5">
        {/* Beta banner */}
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 px-4 py-3 text-[12px] text-amber-200">
          <span className="font-semibold">Beta:</span> reviews are logged locally on this
          device. Google Business Profile + Trustpilot auto-import lands next sprint.
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="card">
            <p className="text-[10px] uppercase tracking-wider text-muted">Total</p>
            <p className="mt-1 text-2xl font-bold">{stats.count}</p>
          </div>
          <div className="card">
            <p className="text-[10px] uppercase tracking-wider text-muted">Avg rating</p>
            <div className="mt-1 flex items-center gap-1.5">
              <span className="text-2xl font-bold">{stats.avg || "—"}</span>
              {stats.avg > 0 && <Stars rating={Math.round(stats.avg)} />}
            </div>
          </div>
          <div className="card">
            <p className="text-[10px] uppercase tracking-wider text-muted">Unreplied</p>
            <p className="mt-1 text-2xl font-bold text-amber-300">{stats.unreplied}</p>
          </div>
          <div className="card">
            <p className="text-[10px] uppercase tracking-wider text-muted">1–2 star</p>
            <p className="mt-1 text-2xl font-bold text-rose-300">{stats.critical}</p>
          </div>
        </div>

        {/* Toolbar */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex gap-1">
            {(["all", "new", "replied", "resolved"] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`rounded-lg px-3 py-1.5 text-xs font-medium capitalize transition ${
                  filter === f
                    ? "bg-gold/20 text-gold"
                    : "bg-surface-light/40 text-muted hover:text-foreground"
                }`}
              >
                {f}
              </button>
            ))}
          </div>
          <button
            onClick={() => setShowNew(true)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-gold px-4 py-2 text-sm font-semibold text-black transition hover:bg-gold/90"
          >
            <Plus size={14} /> Log review
          </button>
        </div>

        {/* Create form */}
        {showNew && (
          <NewReviewForm
            onClose={() => setShowNew(false)}
            onCreated={(r) => {
              persist([r, ...reviews]);
              setShowNew(false);
              toast.success("Review logged");
            }}
          />
        )}

        {/* List */}
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-muted">
            <Loader size={14} className="animate-spin" /> Loading…
          </div>
        ) : filtered.length === 0 ? (
          <div className="card">
            <EmptyState
              icon={<Star size={36} />}
              title={reviews.length === 0 ? "No reviews yet" : "No reviews match this filter"}
              description={
                reviews.length === 0
                  ? "Log a review manually to track responses. Auto-import from Google Business Profile lands next sprint."
                  : "Try a different filter, or log a new review."
              }
              action={
                reviews.length === 0 ? (
                  <button
                    onClick={() => setShowNew(true)}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-gold px-4 py-2 text-sm font-semibold text-black"
                  >
                    <Plus size={14} /> Log review
                  </button>
                ) : null
              }
            />
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map((r) => (
              <ReviewCard
                key={r.id}
                review={r}
                onDelete={() => remove(r.id)}
                onReply={(text) => reply(r.id, text)}
                onResolve={() => resolve(r.id)}
              />
            ))}
          </div>
        )}

        {/* Help */}
        <div className="mt-8 rounded-xl border border-border/40 bg-background/40 p-5 text-[12px] text-muted">
          <p className="mb-2 font-semibold text-foreground">Coming soon</p>
          <ul className="ml-4 list-disc space-y-1">
            <li>Auto-import from Google Business Profile, Yelp, Trustpilot, G2</li>
            <li>AI-drafted replies tuned to your brand voice</li>
            <li>Auto-route 1–2 star reviews to a human immediately</li>
            <li>
              Related:{" "}
              <Link href="/dashboard/google-business" className="text-gold underline">
                Google Business
              </Link>
              {" · "}
              <Link href="/dashboard/tickets" className="text-gold underline">
                Tickets
              </Link>
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────── */
/* Review row                                                      */
/* ─────────────────────────────────────────────────────────────── */

function ReviewCard({
  review,
  onDelete,
  onReply,
  onResolve,
}: {
  review: Review;
  onDelete: () => void;
  onReply: (text: string) => void;
  onResolve: () => void;
}) {
  const [replying, setReplying] = useState(false);
  const [draft, setDraft] = useState(review.reply);
  const style = STATUS_STYLES[review.status];
  const critical = review.rating <= 2;

  return (
    <div
      className={`rounded-lg border bg-surface-light/20 transition hover:border-gold/40 ${
        critical ? "border-rose-500/30" : "border-border/50"
      }`}
    >
      <div className="flex items-start gap-3 p-4">
        <div
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${
            critical ? "bg-rose-500/15 text-rose-300" : "bg-amber-500/15 text-amber-300"
          }`}
        >
          <Star size={16} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="truncate text-sm font-semibold">{review.author}</p>
            <span className="rounded bg-background/60 px-1.5 py-0.5 text-[10px] text-muted">
              {review.source}
            </span>
            <Stars rating={review.rating} />
            <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${style.tint}`}>
              {style.label}
            </span>
          </div>
          <p className="mt-1 text-[12px] leading-relaxed text-foreground">{review.body}</p>
          <p className="mt-1 text-[10px] text-muted">
            {new Date(review.created_at).toLocaleDateString()}
          </p>

          {review.reply && !replying && (
            <div className="mt-2 rounded-lg border-l-2 border-sky-400/50 bg-background/40 px-3 py-2">
              <p className="mb-0.5 text-[10px] uppercase tracking-wider text-sky-300">
                Your reply
              </p>
              <p className="text-[12px] leading-relaxed text-foreground">{review.reply}</p>
            </div>
          )}

          {replying && (
            <div className="mt-2">
              <textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                rows={3}
                placeholder="Thanks for sharing your feedback — we appreciate it."
                className="w-full rounded-lg border border-border/50 bg-surface-light/40 px-3 py-2 text-sm"
              />
              <div className="mt-2 flex items-center justify-end gap-2">
                <button
                  onClick={() => {
                    setReplying(false);
                    setDraft(review.reply);
                  }}
                  className="rounded-lg px-3 py-1.5 text-xs text-muted hover:text-foreground"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    if (!draft.trim()) return;
                    onReply(draft.trim());
                    setReplying(false);
                  }}
                  disabled={!draft.trim()}
                  className="inline-flex items-center gap-1 rounded-lg bg-gold px-3 py-1.5 text-xs font-semibold text-black disabled:opacity-40"
                >
                  <MessageSquare size={11} /> Save reply
                </button>
              </div>
            </div>
          )}
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          {!replying && review.status !== "resolved" && (
            <button
              onClick={() => setReplying(true)}
              className="inline-flex items-center gap-1 rounded bg-sky-500/15 px-2.5 py-1.5 text-[11px] text-sky-300 hover:bg-sky-500/25"
            >
              <MessageSquare size={11} /> Reply
            </button>
          )}
          {review.status !== "resolved" && review.reply && !replying && (
            <button
              onClick={onResolve}
              className="inline-flex items-center gap-1 rounded bg-emerald-500/15 px-2.5 py-1.5 text-[11px] text-emerald-300 hover:bg-emerald-500/25"
              title="Mark as resolved"
            >
              <CheckCircle2 size={11} /> Resolve
            </button>
          )}
          <button
            onClick={onDelete}
            className="rounded bg-rose-500/10 px-2 py-1.5 text-rose-300 hover:bg-rose-500/20"
            title="Delete"
            aria-label="Delete review"
          >
            <Trash2 size={11} />
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────── */
/* Create form                                                     */
/* ─────────────────────────────────────────────────────────────── */

function NewReviewForm({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (r: Review) => void;
}) {
  const [author, setAuthor] = useState("");
  const [source, setSource] = useState("Google");
  const [rating, setRating] = useState(5);
  const [body, setBody] = useState("");

  const canSubmit = author.trim() && body.trim();

  function submit() {
    if (!canSubmit) return;
    const review: Review = {
      id: `r_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      author: author.trim(),
      source,
      rating,
      body: body.trim(),
      reply: "",
      status: "new",
      created_at: new Date().toISOString(),
    };
    onCreated(review);
  }

  return (
    <div className="rounded-xl border border-gold/30 bg-gold/5 p-5">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button onClick={onClose} className="rounded p-1 text-muted hover:text-foreground" aria-label="Back to reviews list">
            <ArrowLeft size={14} />
          </button>
          <h3 className="text-base font-semibold">Log review</h3>
        </div>
        <Link
          href="/dashboard/google-business"
          className="inline-flex items-center gap-1 text-[11px] text-muted hover:text-gold"
        >
          <ExternalLink size={11} /> Google Business
        </Link>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label className="mb-0.5 block text-[10px] uppercase tracking-wider text-muted">
            Reviewer name
          </label>
          <input
            type="text"
            value={author}
            onChange={(e) => setAuthor(e.target.value)}
            placeholder="Sarah K."
            className="w-full rounded-lg border border-border/50 bg-surface-light/40 px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="mb-0.5 block text-[10px] uppercase tracking-wider text-muted">
            Source
          </label>
          <select
            value={source}
            onChange={(e) => setSource(e.target.value)}
            className="w-full rounded-lg border border-border/50 bg-surface-light/40 px-3 py-2 text-sm"
          >
            {SOURCES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
        <div className="sm:col-span-2">
          <label className="mb-1 block text-[10px] uppercase tracking-wider text-muted">
            Rating
          </label>
          <div className="flex items-center gap-1">
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setRating(n)}
                aria-label={`${n} stars`}
                className="p-1"
              >
                <Star
                  size={22}
                  className={
                    n <= rating
                      ? "fill-amber-400 text-amber-400"
                      : "text-muted/40 hover:text-amber-300/60"
                  }
                />
              </button>
            ))}
          </div>
        </div>
        <div className="sm:col-span-2">
          <label className="mb-0.5 block text-[10px] uppercase tracking-wider text-muted">
            Review text
          </label>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={4}
            placeholder="Great service, quick turnaround…"
            className="w-full rounded-lg border border-border/50 bg-surface-light/40 px-3 py-2 text-sm"
          />
        </div>
      </div>

      <div className="mt-4 flex items-center justify-end gap-2">
        <button
          onClick={onClose}
          className="rounded-lg px-4 py-2 text-sm text-muted hover:text-foreground"
        >
          Cancel
        </button>
        <button
          onClick={submit}
          disabled={!canSubmit}
          className="inline-flex items-center gap-1.5 rounded-lg bg-gold px-5 py-2 text-sm font-semibold text-black transition hover:bg-gold/90 disabled:opacity-40"
        >
          <Plus size={14} /> Log review
        </button>
      </div>
    </div>
  );
}
