"use client";

/**
 * Public Service Marketplace browse page.
 *
 * Anyone can view active services.  Buyers click into a service to order
 * (login is required at the order step, not the browse step).
 */

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { Search, Store, Filter, Tag, Clock, ArrowRight } from "lucide-react";

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
  "all",
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

type Category = (typeof CATEGORIES)[number];

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

export default function MarketplacePublicPage() {
  const [services, setServices] = useState<ServiceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<Category>("all");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/marketplace/services");
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = (await res.json()) as { services: ServiceRow[] };
        if (cancelled) return;
        setServices(data.services ?? []);
      } catch (err) {
        console.error("[marketplace] load failed", err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const filtered = useMemo(() => {
    let list = services;
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (s) =>
          s.title.toLowerCase().includes(q) ||
          s.description.toLowerCase().includes(q),
      );
    }
    if (category !== "all") {
      list = list.filter((s) => s.category === category);
    }
    return list;
  }, [services, search, category]);

  return (
    <div className="min-h-screen bg-[#0a0c10] text-white">
      {/* Hero */}
      <header className="border-b border-white/5 bg-gradient-to-b from-[#1a1611] via-[#15120e] to-transparent">
        <div className="mx-auto max-w-6xl px-6 py-12">
          <div className="flex items-center gap-3 text-amber-300">
            <Store size={24} />
            <span className="text-sm font-semibold uppercase tracking-widest">
              Service Marketplace
            </span>
          </div>
          <h1 className="mt-4 text-4xl font-bold leading-tight md:text-5xl">
            Hire vetted contractors for the work you don&apos;t want to do.
          </h1>
          <p className="mt-3 max-w-2xl text-base text-white/70">
            Browse services from independent operators on ShortStack OS. Pay
            securely — funds release on delivery.
          </p>
        </div>
      </header>

      {/* Filters */}
      <div className="sticky top-0 z-10 border-b border-white/5 bg-[#0a0c10]/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-col gap-3 px-6 py-4 md:flex-row md:items-center">
          <div className="relative flex-1">
            <Search
              size={16}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40"
            />
            <input
              type="search"
              placeholder="Search services..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-lg border border-white/10 bg-white/[0.03] py-2 pl-9 pr-4 text-sm placeholder:text-white/30 focus:border-amber-300/40 focus:outline-none"
            />
          </div>
          <div className="flex items-center gap-2 overflow-x-auto">
            <Filter size={14} className="text-white/40" />
            {CATEGORIES.map((c) => (
              <button
                key={c}
                onClick={() => setCategory(c)}
                className={`rounded-full px-3 py-1 text-xs font-medium capitalize transition ${
                  category === c
                    ? "bg-amber-300/15 text-amber-300 ring-1 ring-amber-300/30"
                    : "bg-white/[0.03] text-white/60 hover:bg-white/[0.06] hover:text-white"
                }`}
              >
                {c}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Grid */}
      <main className="mx-auto max-w-6xl px-6 py-10">
        {loading ? (
          <div className="py-20 text-center text-sm text-white/50">
            Loading services...
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-20 text-center">
            <Store size={36} className="mx-auto mb-3 text-white/20" />
            <p className="text-sm font-medium text-white/80">
              No services match your filters
            </p>
            <p className="mt-1 text-xs text-white/40">
              Try a different category or clear the search.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {filtered.map((s) => (
              <Link
                key={s.id}
                href={`/marketplace/${s.id}`}
                className="group block rounded-xl border border-white/8 bg-white/[0.02] p-5 transition hover:border-amber-300/30 hover:bg-white/[0.04]"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <span className="inline-flex items-center gap-1 rounded-md bg-amber-300/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-300">
                      <Tag size={10} />
                      {s.category}
                    </span>
                    <h3 className="mt-2 truncate text-base font-semibold transition group-hover:text-amber-200">
                      {s.title}
                    </h3>
                  </div>
                  <div className="flex-shrink-0 text-right">
                    <div className="text-lg font-bold text-amber-300">
                      {formatPrice(s.price_cents, s.currency)}
                    </div>
                    <div className="text-[10px] text-white/40">
                      {s.currency.toUpperCase()}
                    </div>
                  </div>
                </div>
                <p className="mt-3 line-clamp-3 text-sm text-white/60">
                  {s.description}
                </p>
                <div className="mt-4 flex items-center justify-between border-t border-white/5 pt-3 text-xs text-white/50">
                  <span className="flex items-center gap-1">
                    <Clock size={12} />
                    {s.delivery_days} day{s.delivery_days === 1 ? "" : "s"} delivery
                  </span>
                  <span className="flex items-center gap-1 text-amber-300/80 transition group-hover:translate-x-0.5">
                    View <ArrowRight size={12} />
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
