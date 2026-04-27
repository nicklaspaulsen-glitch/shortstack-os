"use client";

/**
 * Sellers manage their service listings here.  Lists their own services
 * (any status), lets them create / edit / pause / close.
 */

import { useEffect, useState, useCallback } from "react";
import { Store, Plus, Pause, Play, X, Loader2 } from "lucide-react";
import toast from "react-hot-toast";
import PageHero from "@/components/ui/page-hero";
import { useAuth } from "@/lib/auth-context";

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

const CATEGORIES = [
  "design",
  "video",
  "copywriting",
  "ads",
  "seo",
  "social",
  "dev",
  "consulting",
  "branding",
  "ops",
  "other",
] as const;

interface DraftService {
  title: string;
  description: string;
  category: string;
  priceDollars: string;
  deliveryDays: string;
  status: "active" | "draft";
}

const EMPTY_DRAFT: DraftService = {
  title: "",
  description: "",
  category: "design",
  priceDollars: "100",
  deliveryDays: "7",
  status: "active",
};

function formatPrice(cents: number, currency: string): string {
  return `${currency === "usd" ? "$" : currency.toUpperCase() + " "}${(cents / 100).toFixed(0)}`;
}

export default function ListingsPage() {
  const { user } = useAuth();
  const [services, setServices] = useState<ServiceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [draft, setDraft] = useState<DraftService>(EMPTY_DRAFT);

  const reload = useCallback(async () => {
    if (!user) return;
    try {
      // Use the seller filter to get only my listings (any status — RLS
      // already lets the seller see their own non-active rows).
      const res = await fetch(`/api/marketplace/services?seller=${user.id}&limit=100`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as { services: ServiceRow[] };
      setServices(data.services ?? []);
    } catch (err) {
      console.error("[listings] load failed", err);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      const priceCents = Math.round(Number(draft.priceDollars) * 100);
      const deliveryDays = Number(draft.deliveryDays);
      const res = await fetch("/api/marketplace/services", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: draft.title,
          description: draft.description,
          category: draft.category,
          price_cents: priceCents,
          delivery_days: deliveryDays,
          status: draft.status,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      toast.success("Service created");
      setShowForm(false);
      setDraft(EMPTY_DRAFT);
      void reload();
    } catch (err) {
      console.error("[listings] create failed", err);
      const msg = err instanceof Error ? err.message : "Failed to create service";
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const togglePause = async (svc: ServiceRow) => {
    const next = svc.status === "active" ? "paused" : "active";
    try {
      const res = await fetch(`/api/marketplace/services/${svc.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: next }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `HTTP ${res.status}`);
      }
      toast.success(next === "active" ? "Service activated" : "Service paused");
      void reload();
    } catch (err) {
      console.error("[listings] toggle failed", err);
      toast.error("Failed to update");
    }
  };

  const closeService = async (svc: ServiceRow) => {
    if (!confirm(`Close "${svc.title}"? Existing orders are unaffected.`)) return;
    try {
      const res = await fetch(`/api/marketplace/services/${svc.id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `HTTP ${res.status}`);
      }
      toast.success("Service closed");
      void reload();
    } catch (err) {
      console.error("[listings] close failed", err);
      toast.error("Failed to close");
    }
  };

  return (
    <div className="fade-in space-y-5">
      <PageHero
        icon={<Store size={28} />}
        title="My Listings"
        subtitle="Sell your services on the ShortStack marketplace."
        gradient="gold"
        actions={
          <button
            onClick={() => setShowForm((v) => !v)}
            className="flex items-center gap-2 rounded-lg border border-white/20 bg-white/10 px-4 py-2 text-sm font-medium text-white transition hover:bg-white/20"
          >
            <Plus size={14} />
            New listing
          </button>
        }
      />

      {showForm && (
        <div className="rounded-xl border border-border bg-surface p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-white">New service listing</h2>
            <button
              onClick={() => {
                setShowForm(false);
                setDraft(EMPTY_DRAFT);
              }}
              className="text-muted hover:text-white"
              aria-label="Cancel"
            >
              <X size={16} />
            </button>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="md:col-span-2">
              <label htmlFor="svc-title" className="block text-xs text-muted mb-1">
                Title
              </label>
              <input
                id="svc-title"
                value={draft.title}
                onChange={(e) => setDraft({ ...draft, title: e.target.value })}
                maxLength={200}
                className="w-full rounded-lg border border-border bg-black/30 px-3 py-2 text-sm text-white"
                placeholder="Short, specific. e.g. Edit a 60-second YouTube Short"
              />
            </div>
            <div className="md:col-span-2">
              <label
                htmlFor="svc-desc"
                className="block text-xs text-muted mb-1"
              >
                Description
              </label>
              <textarea
                id="svc-desc"
                value={draft.description}
                onChange={(e) => setDraft({ ...draft, description: e.target.value })}
                maxLength={5000}
                rows={5}
                className="w-full rounded-lg border border-border bg-black/30 px-3 py-2 text-sm text-white"
                placeholder="What's included, what you need from the buyer, what they'll receive."
              />
            </div>
            <div>
              <label htmlFor="svc-cat" className="block text-xs text-muted mb-1">
                Category
              </label>
              <select
                id="svc-cat"
                value={draft.category}
                onChange={(e) => setDraft({ ...draft, category: e.target.value })}
                className="w-full rounded-lg border border-border bg-black/30 px-3 py-2 text-sm text-white"
              >
                {CATEGORIES.map((c) => (
                  <option key={c} value={c} className="capitalize">
                    {c}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label
                htmlFor="svc-price"
                className="block text-xs text-muted mb-1"
              >
                Price (USD)
              </label>
              <input
                id="svc-price"
                type="number"
                min={1}
                step="1"
                value={draft.priceDollars}
                onChange={(e) =>
                  setDraft({ ...draft, priceDollars: e.target.value })
                }
                className="w-full rounded-lg border border-border bg-black/30 px-3 py-2 text-sm text-white"
              />
            </div>
            <div>
              <label
                htmlFor="svc-days"
                className="block text-xs text-muted mb-1"
              >
                Delivery (days)
              </label>
              <input
                id="svc-days"
                type="number"
                min={1}
                step="1"
                value={draft.deliveryDays}
                onChange={(e) =>
                  setDraft({ ...draft, deliveryDays: e.target.value })
                }
                className="w-full rounded-lg border border-border bg-black/30 px-3 py-2 text-sm text-white"
              />
            </div>
            <div>
              <label
                htmlFor="svc-status"
                className="block text-xs text-muted mb-1"
              >
                Status
              </label>
              <select
                id="svc-status"
                value={draft.status}
                onChange={(e) =>
                  setDraft({ ...draft, status: e.target.value as "active" | "draft" })
                }
                className="w-full rounded-lg border border-border bg-black/30 px-3 py-2 text-sm text-white"
              >
                <option value="active">Active (visible to buyers)</option>
                <option value="draft">Draft (hidden)</option>
              </select>
            </div>
          </div>
          <div className="mt-5 flex justify-end gap-2">
            <button
              onClick={() => {
                setShowForm(false);
                setDraft(EMPTY_DRAFT);
              }}
              className="rounded-lg border border-border px-4 py-2 text-xs text-muted hover:text-white"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={submitting || !draft.title || !draft.description}
              className="flex items-center gap-2 rounded-lg bg-gold px-4 py-2 text-xs font-bold text-black hover:bg-gold/90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {submitting && <Loader2 size={12} className="animate-spin" />}
              Create listing
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="py-12 text-center text-sm text-muted">Loading...</div>
      ) : services.length === 0 ? (
        <div className="card flex flex-col items-center justify-center py-12 text-center">
          <Store size={36} className="mb-3 text-muted/30" />
          <p className="text-sm font-medium text-white">No listings yet</p>
          <p className="mt-1 text-xs text-muted">
            Create your first service to start selling.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {services.map((svc) => (
            <div key={svc.id} className="card flex items-center justify-between gap-4">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <h3 className="truncate text-sm font-semibold text-white">
                    {svc.title}
                  </h3>
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
                      svc.status === "active"
                        ? "bg-emerald-500/10 text-emerald-400"
                        : svc.status === "paused"
                          ? "bg-amber-500/10 text-amber-400"
                          : "bg-white/10 text-white/60"
                    }`}
                  >
                    {svc.status}
                  </span>
                </div>
                <p className="mt-1 line-clamp-1 text-xs text-muted">{svc.description}</p>
                <div className="mt-2 flex items-center gap-3 text-xs text-muted">
                  <span className="capitalize">{svc.category}</span>
                  <span>·</span>
                  <span>{formatPrice(svc.price_cents, svc.currency)}</span>
                  <span>·</span>
                  <span>{svc.delivery_days}d delivery</span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {(svc.status === "active" || svc.status === "paused") && (
                  <button
                    onClick={() => togglePause(svc)}
                    className="rounded-lg border border-border p-2 text-muted hover:text-white"
                    title={svc.status === "active" ? "Pause" : "Activate"}
                  >
                    {svc.status === "active" ? (
                      <Pause size={14} />
                    ) : (
                      <Play size={14} />
                    )}
                  </button>
                )}
                {svc.status !== "closed" && (
                  <button
                    onClick={() => closeService(svc)}
                    className="rounded-lg border border-red-500/20 p-2 text-red-400/60 hover:border-red-500/40 hover:text-red-400"
                    title="Close"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
