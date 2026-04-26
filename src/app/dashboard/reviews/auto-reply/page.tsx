"use client";

/**
 * Reviews — AI Auto-Reply (Phase 2 polish).
 *
 * Generate Claude-drafted replies to incoming reviews, edit them, and approve
 * for publishing. v1 keeps the publish step manual — final platform write is
 * deferred to v2 (sentiment escalation, multi-language, etc.).
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Star,
  Sparkles,
  Loader2,
  Check,
  X,
  Send,
  ArrowLeft,
  RefreshCw,
  AlertCircle,
} from "lucide-react";
import toast from "react-hot-toast";
import PageHero from "@/components/ui/page-hero";
import EmptyState from "@/components/ui/empty-state";

interface ReviewDraft {
  id: string;
  review_id: string;
  platform: string;
  review_text: string | null;
  review_rating: number | null;
  review_author: string | null;
  ai_draft: string;
  approved_text: string | null;
  status: "pending" | "approved" | "published" | "rejected";
  auto_publish: boolean;
  published_at: string | null;
  created_at: string;
}

const PLATFORMS = ["Google", "Yelp", "Facebook", "Trustpilot", "G2"];

const STATUS_STYLES: Record<ReviewDraft["status"], { label: string; tint: string }> = {
  pending: { label: "Pending", tint: "bg-amber-500/15 text-amber-300" },
  approved: { label: "Approved", tint: "bg-sky-500/15 text-sky-300" },
  published: { label: "Published", tint: "bg-emerald-500/15 text-emerald-300" },
  rejected: { label: "Rejected", tint: "bg-rose-500/15 text-rose-300" },
};

function Stars({ rating }: { rating: number | null }) {
  if (!rating) return null;
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((n) => (
        <Star
          key={n}
          size={11}
          className={n <= rating ? "fill-amber-400 text-amber-400" : "text-muted/40"}
        />
      ))}
    </div>
  );
}

export default function ReviewsAutoReplyPage() {
  const [drafts, setDrafts] = useState<ReviewDraft[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCompose, setShowCompose] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState("");

  // compose form
  const [reviewId, setReviewId] = useState("");
  const [platform, setPlatform] = useState(PLATFORMS[0]);
  const [reviewText, setReviewText] = useState("");
  const [reviewAuthor, setReviewAuthor] = useState("");
  const [reviewRating, setReviewRating] = useState<number | "">(5);
  const [brandVoice, setBrandVoice] = useState("");
  const [autoPublish, setAutoPublish] = useState(false);
  const [generating, setGenerating] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/reviews/auto-reply");
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to load drafts");
      setDrafts((json.drafts || []) as ReviewDraft[]);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Load failed");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const stats = useMemo(() => {
    return {
      total: drafts.length,
      pending: drafts.filter((d) => d.status === "pending").length,
      published: drafts.filter((d) => d.status === "published").length,
    };
  }, [drafts]);

  function resetForm() {
    setReviewId("");
    setPlatform(PLATFORMS[0]);
    setReviewText("");
    setReviewAuthor("");
    setReviewRating(5);
    setBrandVoice("");
    setAutoPublish(false);
  }

  async function handleGenerate() {
    if (!reviewId.trim()) {
      toast.error("Review ID required");
      return;
    }
    if (!reviewText.trim()) {
      toast.error("Review text required");
      return;
    }
    setGenerating(true);
    try {
      const res = await fetch("/api/reviews/auto-reply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          review_id: reviewId.trim(),
          platform,
          review_text: reviewText.trim(),
          review_author: reviewAuthor.trim() || null,
          review_rating: typeof reviewRating === "number" ? reviewRating : null,
          brand_voice: brandVoice.trim() || undefined,
          auto_publish: autoPublish,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to generate");
      toast.success("AI draft generated");
      resetForm();
      setShowCompose(false);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Generate failed");
    } finally {
      setGenerating(false);
    }
  }

  async function patchDraft(id: string, patch: Record<string, unknown>) {
    const res = await fetch("/api/reviews/auto-reply", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, ...patch }),
    });
    const json = await res.json();
    if (!res.ok) {
      toast.error(json.error || "Update failed");
      return false;
    }
    return true;
  }

  async function approve(d: ReviewDraft) {
    if (!(await patchDraft(d.id, { status: "approved", approved_text: d.approved_text ?? d.ai_draft }))) return;
    toast.success("Draft approved");
    void load();
  }

  async function publish(d: ReviewDraft) {
    if (!(await patchDraft(d.id, { status: "published", approved_text: d.approved_text ?? d.ai_draft }))) return;
    toast.success("Reply published");
    void load();
  }

  async function reject(d: ReviewDraft) {
    if (!(await patchDraft(d.id, { status: "rejected" }))) return;
    toast.success("Draft rejected");
    void load();
  }

  async function saveEdit(d: ReviewDraft) {
    if (!(await patchDraft(d.id, { approved_text: editingText }))) return;
    toast.success("Edit saved");
    setEditingId(null);
    setEditingText("");
    void load();
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <PageHero
        title="Review Auto-Reply"
        subtitle="AI-drafted replies for incoming reviews. Approve before publishing."
        icon={<Sparkles size={20} />}
        gradient="purple"
        actions={
          <div className="flex items-center gap-2">
            <Link
              href="/dashboard/reviews"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm text-white/70 hover:text-white bg-white/5 hover:bg-white/10 transition-all"
            >
              <ArrowLeft size={14} /> Back
            </Link>
            <button
              onClick={() => setShowCompose((v) => !v)}
              className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-sm font-semibold bg-purple-500/80 hover:bg-purple-500 text-white transition-all"
            >
              <Sparkles size={14} /> New Draft
            </button>
          </div>
        }
      />

      <div className="mx-auto max-w-5xl px-6 py-6 space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: "Total Drafts", value: stats.total },
            { label: "Pending Review", value: stats.pending },
            { label: "Published", value: stats.published },
          ].map((s) => (
            <div key={s.label} className="rounded-xl border border-white/8 bg-white/3 p-4 text-center">
              <p className="text-2xl font-bold text-white">{s.value}</p>
              <p className="text-xs text-white/40 mt-1">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Compose */}
        {showCompose && (
          <div className="card p-5 space-y-3 border border-white/10 rounded-xl bg-white/3">
            <p className="font-semibold text-white text-sm flex items-center gap-2">
              <Sparkles size={14} className="text-purple-400" /> Generate AI Reply
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <input
                className="input text-sm"
                placeholder="Review ID (your platform's review ID)"
                value={reviewId}
                onChange={(e) => setReviewId(e.target.value)}
              />
              <select
                className="input text-sm"
                value={platform}
                onChange={(e) => setPlatform(e.target.value)}
              >
                {PLATFORMS.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
              <input
                className="input text-sm"
                placeholder="Reviewer name (optional)"
                value={reviewAuthor}
                onChange={(e) => setReviewAuthor(e.target.value)}
              />
              <select
                className="input text-sm"
                value={reviewRating === "" ? "" : String(reviewRating)}
                onChange={(e) => setReviewRating(e.target.value ? Number(e.target.value) : "")}
              >
                <option value="">No rating</option>
                {[1, 2, 3, 4, 5].map((r) => (
                  <option key={r} value={r}>
                    {r} star{r === 1 ? "" : "s"}
                  </option>
                ))}
              </select>
            </div>
            <textarea
              className="input text-sm w-full resize-none"
              rows={4}
              placeholder="Paste the review text here..."
              value={reviewText}
              onChange={(e) => setReviewText(e.target.value.slice(0, 4000))}
            />
            <input
              className="input text-sm w-full"
              placeholder="Brand voice (optional, e.g. 'warm, casual, witty')"
              value={brandVoice}
              onChange={(e) => setBrandVoice(e.target.value)}
            />
            <label className="flex items-center gap-2 text-xs text-white/70">
              <input
                type="checkbox"
                checked={autoPublish}
                onChange={(e) => setAutoPublish(e.target.checked)}
                className="accent-purple-400"
              />
              Auto-approve (skip review). Publish step is still manual.
            </label>
            <div className="flex gap-2">
              <button
                onClick={handleGenerate}
                disabled={generating}
                className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-sm font-semibold bg-purple-500/80 hover:bg-purple-500 text-white disabled:opacity-50 transition-all"
              >
                {generating ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <Sparkles size={14} />
                )}{" "}
                Generate Reply
              </button>
              <button
                onClick={() => {
                  resetForm();
                  setShowCompose(false);
                }}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm text-white/70 bg-white/5 hover:bg-white/10 transition-all"
              >
                <X size={14} /> Cancel
              </button>
            </div>
          </div>
        )}

        {/* List */}
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 size={28} className="animate-spin text-white/30" />
          </div>
        ) : drafts.length === 0 ? (
          <EmptyState
            title="No drafts yet"
            description="Paste a review and Claude will generate a reply you can approve."
            icon={<Sparkles size={28} />}
          />
        ) : (
          <div className="space-y-3">
            {drafts.map((d) => {
              const cfg = STATUS_STYLES[d.status];
              const isEditing = editingId === d.id;
              return (
                <div
                  key={d.id}
                  className="rounded-xl border border-white/8 bg-white/3 hover:bg-white/5 p-4 transition-all"
                >
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex items-center gap-3 flex-wrap">
                      <span className={`px-2 py-0.5 rounded-full text-[11px] font-medium ${cfg.tint}`}>
                        {cfg.label}
                      </span>
                      <span className="text-xs text-white/50 capitalize">{d.platform}</span>
                      <Stars rating={d.review_rating} />
                      {d.review_author && (
                        <span className="text-xs text-white/40">— {d.review_author}</span>
                      )}
                    </div>
                    <span className="text-[11px] text-white/30">
                      {new Date(d.created_at).toLocaleDateString()}
                    </span>
                  </div>

                  {d.review_text && (
                    <div className="mb-3 px-3 py-2 rounded-lg bg-black/30 border border-white/5">
                      <p className="text-[11px] uppercase tracking-wider text-white/40 mb-1">
                        Original Review
                      </p>
                      <p className="text-sm text-white/80 whitespace-pre-wrap">{d.review_text}</p>
                    </div>
                  )}

                  <div className="px-3 py-2 rounded-lg bg-purple-500/10 border border-purple-500/20">
                    <p className="text-[11px] uppercase tracking-wider text-purple-300 mb-1 flex items-center gap-1.5">
                      <Sparkles size={10} /> AI Draft
                    </p>
                    {isEditing ? (
                      <textarea
                        className="input text-sm w-full resize-none bg-black/40"
                        rows={4}
                        value={editingText}
                        onChange={(e) => setEditingText(e.target.value)}
                      />
                    ) : (
                      <p className="text-sm text-white whitespace-pre-wrap">
                        {d.approved_text ?? d.ai_draft}
                      </p>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 mt-3 flex-wrap">
                    {isEditing ? (
                      <>
                        <button
                          onClick={() => void saveEdit(d)}
                          className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300"
                        >
                          <Check size={12} /> Save
                        </button>
                        <button
                          onClick={() => {
                            setEditingId(null);
                            setEditingText("");
                          }}
                          className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs text-white/60 bg-white/5 hover:bg-white/10"
                        >
                          <X size={12} /> Cancel
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          onClick={() => {
                            setEditingId(d.id);
                            setEditingText(d.approved_text ?? d.ai_draft);
                          }}
                          className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs text-white/70 bg-white/5 hover:bg-white/10"
                          disabled={d.status === "published"}
                        >
                          <RefreshCw size={12} /> Edit
                        </button>
                        {d.status === "pending" && (
                          <button
                            onClick={() => void approve(d)}
                            className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium bg-sky-500/20 hover:bg-sky-500/30 text-sky-300"
                          >
                            <Check size={12} /> Approve
                          </button>
                        )}
                        {(d.status === "approved" || d.status === "pending") && (
                          <button
                            onClick={() => void publish(d)}
                            className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300"
                          >
                            <Send size={12} /> Publish
                          </button>
                        )}
                        {d.status !== "published" && d.status !== "rejected" && (
                          <button
                            onClick={() => void reject(d)}
                            className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs text-rose-300 bg-rose-500/10 hover:bg-rose-500/20"
                          >
                            <X size={12} /> Reject
                          </button>
                        )}
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Footnote */}
        <div className="rounded-lg border border-white/5 bg-white/3 p-3 flex items-start gap-2 text-xs text-white/50">
          <AlertCircle size={14} className="text-amber-400 shrink-0 mt-0.5" />
          <p>
            v1 stores approved replies locally. Auto-posting back to Google
            Business / Yelp / Facebook is wired through the same OAuth as the
            existing review-fetch integrations and lands in v2.
          </p>
        </div>
      </div>
    </div>
  );
}
