"use client";

/**
 * Agency user's request tracker. Lists all quote requests they've opened,
 * with status, quote amount (once quoted), and accept/cancel/complete
 * actions on each.
 */

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import toast from "react-hot-toast";
import {
  ArrowLeft,
  Inbox,
  Loader2,
  CheckCircle2,
  XCircle,
  Star,
  Sparkles,
} from "lucide-react";
import PageHero from "@/components/ui/page-hero";
import Modal from "@/components/ui/modal";
import {
  type ProRequest,
  type ProRequestStatus,
  statusColor,
  fmtPrice,
} from "@/lib/pro-services";

interface ProviderRef {
  id: string;
  name: string;
  avatar_url: string | null;
  categories: string[];
}

interface RequestRow extends ProRequest {
  pro_services_providers: ProviderRef;
}

export default function MyRequestsPage() {
  const [requests, setRequests] = useState<RequestRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | ProRequestStatus>("all");
  const [reviewTarget, setReviewTarget] = useState<RequestRow | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/pro-services/requests?as=requester");
      if (!res.ok) throw new Error(`requests ${res.status}`);
      const data = await res.json();
      setRequests(data.requests ?? []);
    } catch (err) {
      console.error("[hire/requests] load failed:", err);
      setRequests([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const transition = useCallback(
    async (id: string, next: ProRequestStatus) => {
      try {
        const res = await fetch(`/api/pro-services/requests/${id}`, {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ status: next }),
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok) {
          toast.error(json.error || `Failed (${res.status})`);
          return;
        }
        toast.success(`Marked as ${next}`);
        await load();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Network error");
      }
    },
    [load],
  );

  const visible =
    filter === "all" ? requests : requests.filter((r) => r.status === filter);

  return (
    <div className="fade-in max-w-5xl mx-auto space-y-6">
      <Link
        href="/dashboard/hire"
        className="inline-flex items-center gap-1 text-xs text-muted hover:text-foreground"
      >
        <ArrowLeft size={12} /> Back to directory
      </Link>

      <PageHero
        icon={<Inbox size={22} />}
        eyebrow="Pro Services"
        title="My requests"
        subtitle="Track quotes from the freelancers you've contacted. Once quoted, accept to start the project."
        gradient="ocean"
      />

      {/* Filter chips */}
      <div className="flex flex-wrap gap-2">
        {(["all", "open", "quoted", "accepted", "completed", "cancelled", "declined"] as const).map((s) => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors capitalize ${
              filter === s
                ? "bg-foreground text-background border-foreground"
                : "bg-surface text-muted border-border hover:text-foreground"
            }`}
          >
            {s}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-24 rounded-2xl bg-surface animate-pulse" />
          ))}
        </div>
      ) : visible.length === 0 ? (
        <div className="rounded-2xl border border-border bg-surface p-10 text-center">
          <div className="w-12 h-12 mx-auto rounded-2xl bg-surface-light flex items-center justify-center mb-3">
            <Sparkles size={18} className="text-muted" />
          </div>
          <p className="text-sm font-medium text-foreground mb-1">No requests yet</p>
          <p className="text-xs text-muted max-w-md mx-auto mb-4">
            Browse our directory of vetted freelancers and send your first request.
          </p>
          <Link
            href="/dashboard/hire"
            className="inline-flex px-4 py-2 rounded-xl bg-foreground text-background text-xs font-bold"
          >
            Find a freelancer
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {visible.map((r) => (
            <RequestRow
              key={r.id}
              row={r}
              onAccept={() => transition(r.id, "accepted")}
              onCancel={() => transition(r.id, "cancelled")}
              onComplete={() => transition(r.id, "completed")}
              onReview={() => setReviewTarget(r)}
            />
          ))}
        </div>
      )}

      <ReviewModal
        target={reviewTarget}
        onClose={() => setReviewTarget(null)}
        onSaved={async () => {
          setReviewTarget(null);
          await load();
        }}
      />
    </div>
  );
}

function RequestRow({
  row,
  onAccept,
  onCancel,
  onComplete,
  onReview,
}: {
  row: RequestRow;
  onAccept: () => void;
  onCancel: () => void;
  onComplete: () => void;
  onReview: () => void;
}) {
  const color = statusColor(row.status);
  return (
    <div className="rounded-2xl border border-border bg-surface p-4 flex flex-col sm:flex-row items-start gap-4">
      <div className="shrink-0 w-11 h-11 rounded-full bg-surface-light border border-border flex items-center justify-center overflow-hidden">
        {row.pro_services_providers.avatar_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={row.pro_services_providers.avatar_url}
            alt=""
            className="w-full h-full object-cover"
          />
        ) : (
          <span className="text-sm font-bold text-muted">
            {row.pro_services_providers.name.slice(0, 1).toUpperCase()}
          </span>
        )}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex flex-wrap items-center gap-2 mb-1">
          <span
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider"
            style={{ background: color.bg, color: color.fg }}
          >
            {color.label}
          </span>
          <span className="text-[11px] text-muted">
            {new Date(row.created_at).toLocaleDateString()}
          </span>
        </div>
        <h3 className="text-sm font-semibold text-foreground truncate">{row.title}</h3>
        <p className="text-xs text-muted">
          with <strong className="text-foreground">{row.pro_services_providers.name}</strong>
          {row.budget_cents != null && ` · Budget ${fmtPrice(row.budget_cents)}`}
        </p>
        {row.status === "quoted" && row.quote_cents != null && (
          <div className="mt-2 rounded-xl bg-purple-500/10 border border-purple-500/20 p-2.5">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-purple-300">Quote</p>
            <p className="text-sm font-bold text-foreground">
              ${(row.quote_cents / 100).toLocaleString()}
            </p>
            {row.quote_message && (
              <p className="text-xs text-muted mt-1 whitespace-pre-wrap">{row.quote_message}</p>
            )}
          </div>
        )}
      </div>

      <div className="flex flex-wrap gap-2 shrink-0">
        {row.status === "quoted" && (
          <>
            <button
              onClick={onAccept}
              className="px-3 py-1.5 rounded-xl bg-emerald-500 text-background text-xs font-bold inline-flex items-center gap-1"
            >
              <CheckCircle2 size={12} /> Accept
            </button>
            <button
              onClick={onCancel}
              className="px-3 py-1.5 rounded-xl border border-border bg-surface-light text-foreground text-xs font-semibold inline-flex items-center gap-1"
            >
              <XCircle size={12} /> Pass
            </button>
          </>
        )}
        {row.status === "accepted" && (
          <button
            onClick={onComplete}
            className="px-3 py-1.5 rounded-xl bg-foreground text-background text-xs font-bold"
          >
            Mark complete
          </button>
        )}
        {(row.status === "open" || row.status === "quoted") && (
          <button
            onClick={onCancel}
            className="px-3 py-1.5 rounded-xl border border-border bg-surface-light text-foreground text-xs font-semibold"
          >
            Cancel
          </button>
        )}
        {row.status === "completed" && (
          <button
            onClick={onReview}
            className="px-3 py-1.5 rounded-xl border border-amber-500/30 bg-amber-500/10 text-amber-300 text-xs font-bold inline-flex items-center gap-1"
          >
            <Star size={12} /> Leave review
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Review modal ──────────────────────────────────────────────────

function ReviewModal({
  target,
  onClose,
  onSaved,
}: {
  target: RequestRow | null;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const [rating, setRating] = useState(5);
  const [text, setText] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (target) {
      setRating(5);
      setText("");
    }
  }, [target]);

  const submit = useCallback(async () => {
    if (!target) return;
    setSaving(true);
    try {
      const res = await fetch("/api/pro-services/reviews", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          request_id: target.id,
          rating,
          review_text: text.trim() || null,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(json.error || "Failed to save review");
        return;
      }
      toast.success("Thanks for reviewing!");
      await onSaved();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Network error");
    } finally {
      setSaving(false);
    }
  }, [target, rating, text, onSaved]);

  return (
    <Modal
      isOpen={!!target}
      onClose={onClose}
      title={target ? `Review ${target.pro_services_providers.name}` : "Review"}
      size="md"
    >
      {target && (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                onClick={() => setRating(n)}
                className="transition-transform hover:scale-110"
              >
                <Star
                  size={28}
                  className={n <= rating ? "text-amber-400" : "text-border"}
                  fill={n <= rating ? "currentColor" : "none"}
                />
              </button>
            ))}
          </div>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="What went well? Anything to improve?"
            rows={4}
            className="w-full bg-surface-light border border-border rounded-xl px-3 py-2 text-xs text-foreground outline-none placeholder-muted resize-none"
            maxLength={1000}
          />
          <div className="flex justify-end gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-border bg-surface-light text-xs font-semibold text-foreground"
            >
              Cancel
            </button>
            <button
              onClick={submit}
              disabled={saving}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-foreground text-background text-xs font-bold disabled:opacity-60"
            >
              {saving ? <Loader2 size={12} className="animate-spin" /> : <Star size={12} />}
              {saving ? "Saving…" : "Submit review"}
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}
