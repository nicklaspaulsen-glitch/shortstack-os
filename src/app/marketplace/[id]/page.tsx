"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Clock, ShieldCheck, Tag, Store } from "lucide-react";
import toast from "react-hot-toast";

interface ServiceRow {
  id: string;
  user_id: string;
  title: string;
  description: string;
  category: string;
  price_cents: number;
  currency: string;
  delivery_days: number;
  status: string;
  created_at: string;
}

function formatPrice(cents: number, currency: string): string {
  const amount = (cents / 100).toFixed(0);
  const symbol =
    currency === "usd"
      ? "$"
      : currency === "eur"
        ? "€"
        : currency === "gbp"
          ? "£"
          : `${currency.toUpperCase()} `;
  return `${symbol}${amount}`;
}

export default function ServiceDetailPage() {
  // useParams() returns Params | null in Next 14; guard explicitly so
  // strict null checks pass and the page renders a loader instead of throwing.
  const params = useParams<{ id: string }>();
  const id = params?.id ?? null;
  const router = useRouter();
  const [service, setService] = useState<ServiceRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [ordering, setOrdering] = useState(false);
  const [notes, setNotes] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/marketplace/services/${id}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = (await res.json()) as { service: ServiceRow };
        if (cancelled) return;
        setService(data.service);
      } catch (err) {
        console.error("[marketplace/detail] load failed", err);
        toast.error("Service not found");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  const handleOrder = async () => {
    if (!service) return;
    setOrdering(true);
    try {
      const res = await fetch(`/api/marketplace/services/${service.id}/order`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ buyer_notes: notes || undefined }),
      });
      const data = (await res.json()) as {
        checkout_url?: string;
        url?: string;
        error?: string;
      };
      if (!res.ok) {
        if (res.status === 401) {
          toast.error("Please sign in to place an order");
          router.push(`/login?next=/marketplace/${service.id}`);
          return;
        }
        throw new Error(data.error || `HTTP ${res.status}`);
      }
      const url = data.checkout_url ?? data.url;
      if (!url) throw new Error("Stripe did not return a URL");
      window.location.assign(url);
    } catch (err) {
      console.error("[marketplace/detail] order failed", err);
      const msg = err instanceof Error ? err.message : "Failed to start checkout";
      toast.error(msg);
    } finally {
      setOrdering(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0c10] py-20 text-center text-sm text-white/50">
        Loading...
      </div>
    );
  }
  if (!service) {
    return (
      <div className="min-h-screen bg-[#0a0c10] py-20 text-center">
        <p className="text-sm text-white/70">Service not found.</p>
        <Link
          href="/marketplace"
          className="mt-4 inline-block text-amber-300 hover:underline"
        >
          Back to marketplace
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0c10] text-white">
      <header className="border-b border-white/5">
        <div className="mx-auto max-w-4xl px-6 py-4">
          <Link
            href="/marketplace"
            className="inline-flex items-center gap-1.5 text-xs text-white/60 transition hover:text-amber-300"
          >
            <ArrowLeft size={14} />
            All services
          </Link>
        </div>
      </header>

      <main className="mx-auto grid max-w-4xl gap-6 px-6 py-10 lg:grid-cols-[1fr_320px]">
        <div>
          <div className="flex items-center gap-2 text-amber-300">
            <Store size={16} />
            <span className="text-xs font-semibold uppercase tracking-wider">
              Marketplace
            </span>
            <span className="rounded-md bg-amber-300/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-300">
              {service.category}
            </span>
          </div>
          <h1 className="mt-4 text-3xl font-bold leading-tight">{service.title}</h1>
          <article className="prose prose-invert mt-6 max-w-none whitespace-pre-line text-sm text-white/80">
            {service.description}
          </article>
        </div>

        <aside className="rounded-xl border border-white/10 bg-white/[0.03] p-5">
          <div className="text-3xl font-bold text-amber-300">
            {formatPrice(service.price_cents, service.currency)}
          </div>
          <div className="mt-1 text-xs text-white/50">
            {service.currency.toUpperCase()} — billed once
          </div>

          <div className="mt-5 space-y-3 text-sm">
            <div className="flex items-center gap-2 text-white/70">
              <Clock size={14} className="text-amber-300/80" />
              <span>{service.delivery_days} day delivery</span>
            </div>
            <div className="flex items-center gap-2 text-white/70">
              <Tag size={14} className="text-amber-300/80" />
              <span className="capitalize">{service.category}</span>
            </div>
            <div className="flex items-center gap-2 text-white/70">
              <ShieldCheck size={14} className="text-emerald-400/80" />
              <span>Funds released on delivery</span>
            </div>
          </div>

          <label
            htmlFor="buyer-notes"
            className="mt-5 block text-xs font-medium text-white/70"
          >
            Notes for the seller (optional)
          </label>
          <textarea
            id="buyer-notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value.slice(0, 2000))}
            rows={4}
            placeholder="Share any context, links, or files..."
            className="mt-1 w-full rounded-lg border border-white/10 bg-white/[0.02] p-2 text-xs text-white placeholder:text-white/30 focus:border-amber-300/40 focus:outline-none"
          />

          <button
            onClick={handleOrder}
            disabled={ordering || service.status !== "active"}
            className="mt-5 w-full rounded-lg bg-amber-300 py-2.5 text-sm font-bold text-black transition hover:bg-amber-200 disabled:cursor-not-allowed disabled:bg-white/10 disabled:text-white/40"
          >
            {ordering
              ? "Redirecting..."
              : service.status !== "active"
                ? "Unavailable"
                : `Order — ${formatPrice(service.price_cents, service.currency)}`}
          </button>
          <p className="mt-3 text-[10px] leading-relaxed text-white/40">
            You&apos;ll be redirected to Stripe to complete payment.
            ShortStack acts as the payment platform; service is delivered
            by the seller.
          </p>
        </aside>
      </main>
    </div>
  );
}
