"use client";

/**
 * Buyer + seller order tracking dashboard.  Tabs let the user toggle
 * between orders they bought and orders they're fulfilling.
 */

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { Receipt, ArrowRight, ShoppingBag, Briefcase } from "lucide-react";
import PageHero from "@/components/ui/page-hero";

interface OrderRow {
  id: string;
  service_id: string;
  buyer_user_id: string;
  seller_user_id: string;
  amount_cents: number;
  shortstack_fee_cents: number;
  seller_payout_cents: number;
  currency: string;
  status: string;
  created_at: string;
  delivered_at: string | null;
}

type Role = "buyer" | "seller";

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

export default function OrdersPage() {
  const [role, setRole] = useState<Role>("buyer");
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/marketplace/orders?role=${role}&limit=100`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as { orders: OrderRow[] };
      setOrders(data.orders ?? []);
    } catch (err) {
      console.error("[orders] load failed", err);
    } finally {
      setLoading(false);
    }
  }, [role]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return (
    <div className="fade-in space-y-5">
      <PageHero
        icon={<Receipt size={28} />}
        title="Marketplace Orders"
        subtitle="Track services you've bought and orders you're delivering."
        gradient="gold"
        actions={
          <div className="flex items-center gap-1 rounded-lg border border-white/20 bg-white/10 p-1">
            <button
              onClick={() => setRole("buyer")}
              className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition ${
                role === "buyer"
                  ? "bg-white/20 text-white"
                  : "text-white/70 hover:text-white"
              }`}
            >
              <ShoppingBag size={12} />
              Bought
            </button>
            <button
              onClick={() => setRole("seller")}
              className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition ${
                role === "seller"
                  ? "bg-white/20 text-white"
                  : "text-white/70 hover:text-white"
              }`}
            >
              <Briefcase size={12} />
              Selling
            </button>
          </div>
        }
      />

      {loading ? (
        <div className="py-12 text-center text-sm text-muted">Loading...</div>
      ) : orders.length === 0 ? (
        <div className="card flex flex-col items-center justify-center py-12 text-center">
          <Receipt size={36} className="mb-3 text-muted/30" />
          <p className="text-sm font-medium text-white">
            No {role === "buyer" ? "purchases" : "incoming orders"} yet
          </p>
          <p className="mt-1 text-xs text-muted">
            {role === "buyer"
              ? "Browse the marketplace to find services."
              : "List a service to start receiving orders."}
          </p>
          <Link
            href={role === "buyer" ? "/marketplace" : "/dashboard/marketplace/listings"}
            className="mt-4 rounded-lg bg-gold/10 px-4 py-2 text-sm font-medium text-gold hover:bg-gold/20"
          >
            {role === "buyer" ? "Browse marketplace" : "Manage listings"}
          </Link>
        </div>
      ) : (
        <div className="space-y-2">
          {orders.map((o) => (
            <Link
              key={o.id}
              href={`/dashboard/marketplace/orders/${o.id}`}
              className="card group flex items-center justify-between gap-4 transition hover:border-gold/30"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs text-muted">
                    #{o.id.slice(0, 8)}
                  </span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
                      STATUS_COLOR[o.status] ?? "bg-white/10 text-white/60"
                    }`}
                  >
                    {o.status.replace("_", " ")}
                  </span>
                </div>
                <div className="mt-1 text-xs text-muted">
                  {new Date(o.created_at).toLocaleString()}
                </div>
              </div>
              <div className="text-right">
                <div className="text-sm font-bold text-white">
                  {formatPrice(o.amount_cents, o.currency)}
                </div>
                {role === "seller" && (
                  <div className="text-[10px] text-muted">
                    payout {formatPrice(o.seller_payout_cents, o.currency)}
                  </div>
                )}
              </div>
              <ArrowRight
                size={14}
                className="text-muted transition group-hover:translate-x-0.5 group-hover:text-gold"
              />
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
