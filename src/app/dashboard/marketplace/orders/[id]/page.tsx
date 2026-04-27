"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  CheckCircle,
  Star,
  Receipt,
  Loader2,
  Send,
} from "lucide-react";
import toast from "react-hot-toast";

interface OrderDetail {
  order: {
    id: string;
    service_id: string;
    buyer_user_id: string;
    seller_user_id: string;
    amount_cents: number;
    shortstack_fee_cents: number;
    seller_payout_cents: number;
    currency: string;
    status: string;
    buyer_notes: string | null;
    seller_delivery_notes: string | null;
    delivered_at: string | null;
    stripe_payment_intent_id: string | null;
    created_at: string;
    updated_at: string;
  };
  service: {
    id: string;
    title: string;
    description: string;
    category: string;
    delivery_days: number;
  } | null;
  review: {
    id: string;
    rating: number;
    text: string | null;
    created_at: string;
  } | null;
  role: "buyer" | "seller";
}

const STATUS_COLOR: Record<string, string> = {
  pending_payment: "bg-amber-500/10 text-amber-400",
  paid: "bg-blue-500/10 text-blue-400",
  in_progress: "bg-blue-500/10 text-blue-400",
  delivered: "bg-emerald-500/10 text-emerald-400",
  disputed: "bg-red-500/10 text-red-400",
  refunded: "bg-white/10 text-white/60",
  cancelled: "bg-white/10 text-white/60",
};

function formatPrice(cents: number, currency: string): string {
  return `${currency === "usd" ? "$" : currency.toUpperCase() + " "}${(cents / 100).toFixed(2)}`;
}

export default function OrderDetailPage() {
  // useParams() returns Params | null in Next 14; guard explicitly so
  // strict null checks pass and the page renders a loader instead of throwing.
  const params = useParams<{ id: string }>();
  const id = params?.id ?? null;
  const [data, setData] = useState<OrderDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [delivering, setDelivering] = useState(false);
  const [deliveryNotes, setDeliveryNotes] = useState("");
  const [reviewing, setReviewing] = useState(false);
  const [rating, setRating] = useState(5);
  const [reviewText, setReviewText] = useState("");

  const reload = useCallback(async () => {
    try {
      const res = await fetch(`/api/marketplace/orders/${id}`);
      if (!res.ok) {
        if (res.status === 404) {
          toast.error("Order not found");
          return;
        }
        throw new Error(`HTTP ${res.status}`);
      }
      const detail = (await res.json()) as OrderDetail;
      setData(detail);
    } catch (err) {
      console.error("[order/detail] load failed", err);
      toast.error("Failed to load order");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const handleDeliver = async () => {
    if (!data) return;
    setDelivering(true);
    try {
      const res = await fetch(`/api/marketplace/orders/${id}/deliver`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notes: deliveryNotes || undefined }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `HTTP ${res.status}`);
      }
      toast.success("Marked delivered");
      void reload();
    } catch (err) {
      console.error("[order/detail] deliver failed", err);
      const msg = err instanceof Error ? err.message : "Failed to deliver";
      toast.error(msg);
    } finally {
      setDelivering(false);
    }
  };

  const handleReview = async () => {
    if (!data) return;
    setReviewing(true);
    try {
      const res = await fetch(`/api/marketplace/orders/${id}/review`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rating, text: reviewText || undefined }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `HTTP ${res.status}`);
      }
      toast.success("Review saved");
      void reload();
    } catch (err) {
      console.error("[order/detail] review failed", err);
      const msg = err instanceof Error ? err.message : "Failed to review";
      toast.error(msg);
    } finally {
      setReviewing(false);
    }
  };

  if (loading) {
    return (
      <div className="py-20 text-center text-sm text-muted">Loading order...</div>
    );
  }
  if (!data) {
    return (
      <div className="py-20 text-center">
        <p className="text-sm text-muted">Order not found.</p>
        <Link
          href="/dashboard/marketplace/orders"
          className="mt-4 inline-block text-gold hover:underline"
        >
          Back to orders
        </Link>
      </div>
    );
  }

  const { order, service, review, role } = data;
  const canDeliver =
    role === "seller" && (order.status === "paid" || order.status === "in_progress");
  const canReview = role === "buyer" && order.status === "delivered" && !review;

  return (
    <div className="fade-in space-y-4">
      <Link
        href="/dashboard/marketplace/orders"
        className="inline-flex items-center gap-1.5 text-xs text-muted hover:text-white"
      >
        <ArrowLeft size={12} />
        All orders
      </Link>

      <div className="card">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <Receipt size={16} className="text-gold" />
              <span className="font-mono text-xs text-muted">
                Order #{order.id.slice(0, 8)}
              </span>
              <span
                className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
                  STATUS_COLOR[order.status] ?? "bg-white/10 text-white/60"
                }`}
              >
                {order.status.replace("_", " ")}
              </span>
            </div>
            <h1 className="mt-2 text-xl font-bold text-white">
              {service?.title ?? "Service"}
            </h1>
            {service?.category && (
              <p className="mt-1 text-xs capitalize text-muted">
                {service.category} · {service.delivery_days}d delivery
              </p>
            )}
          </div>
          <div className="text-right">
            <div className="text-2xl font-bold text-gold">
              {formatPrice(order.amount_cents, order.currency)}
            </div>
            <div className="mt-1 text-[10px] text-muted">
              ShortStack fee {formatPrice(order.shortstack_fee_cents, order.currency)}
            </div>
            <div className="text-[10px] text-muted">
              Seller payout {formatPrice(order.seller_payout_cents, order.currency)}
            </div>
          </div>
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <div>
            <h3 className="text-xs font-semibold text-white">Buyer notes</h3>
            <p className="mt-1 whitespace-pre-line text-xs text-muted">
              {order.buyer_notes || "No notes provided."}
            </p>
          </div>
          {order.seller_delivery_notes && (
            <div>
              <h3 className="text-xs font-semibold text-white">
                Delivery notes
              </h3>
              <p className="mt-1 whitespace-pre-line text-xs text-muted">
                {order.seller_delivery_notes}
              </p>
            </div>
          )}
        </div>
      </div>

      {canDeliver && (
        <div className="card">
          <h3 className="text-sm font-semibold text-white">Deliver order</h3>
          <p className="mt-1 text-xs text-muted">
            Once you mark this delivered, the buyer will be invited to leave a
            review and your Stripe payout will release per Connect schedule.
          </p>
          <textarea
            value={deliveryNotes}
            onChange={(e) => setDeliveryNotes(e.target.value.slice(0, 5000))}
            rows={4}
            placeholder="Links, attachments, or instructions..."
            className="mt-3 w-full rounded-lg border border-border bg-black/30 px-3 py-2 text-xs text-white"
          />
          <button
            onClick={handleDeliver}
            disabled={delivering}
            className="mt-3 flex items-center gap-2 rounded-lg bg-gold px-4 py-2 text-xs font-bold text-black hover:bg-gold/90 disabled:opacity-50"
          >
            {delivering ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />}
            Mark delivered
          </button>
        </div>
      )}

      {canReview && (
        <div className="card">
          <h3 className="text-sm font-semibold text-white">Leave a review</h3>
          <div className="mt-3 flex items-center gap-2">
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                onClick={() => setRating(n)}
                aria-label={`${n} stars`}
                className={n <= rating ? "text-gold" : "text-white/20"}
              >
                <Star size={20} className={n <= rating ? "fill-gold" : ""} />
              </button>
            ))}
          </div>
          <textarea
            value={reviewText}
            onChange={(e) => setReviewText(e.target.value.slice(0, 4000))}
            rows={4}
            placeholder="What was the experience like?"
            className="mt-3 w-full rounded-lg border border-border bg-black/30 px-3 py-2 text-xs text-white"
          />
          <button
            onClick={handleReview}
            disabled={reviewing}
            className="mt-3 flex items-center gap-2 rounded-lg bg-gold px-4 py-2 text-xs font-bold text-black hover:bg-gold/90 disabled:opacity-50"
          >
            {reviewing ? (
              <Loader2 size={12} className="animate-spin" />
            ) : (
              <CheckCircle size={12} />
            )}
            Submit review
          </button>
        </div>
      )}

      {review && (
        <div className="card">
          <h3 className="text-sm font-semibold text-white">Your review</h3>
          <div className="mt-2 flex items-center gap-1 text-gold">
            {Array.from({ length: review.rating }).map((_, i) => (
              <Star key={i} size={14} className="fill-gold" />
            ))}
            {Array.from({ length: 5 - review.rating }).map((_, i) => (
              <Star key={i} size={14} className="text-white/20" />
            ))}
          </div>
          {review.text && (
            <p className="mt-2 text-xs text-muted">{review.text}</p>
          )}
        </div>
      )}
    </div>
  );
}
