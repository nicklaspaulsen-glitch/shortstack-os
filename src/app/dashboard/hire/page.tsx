"use client";

/**
 * Pro Services Directory — the "hire real humans" marketplace.
 *
 * Agency-facing view. Category tabs + filters + grid of vetted provider
 * cards. Each card links to /dashboard/hire/[providerId] for full detail
 * and the quote-request modal.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Users2,
  Search,
  Star,
  Clock,
  Filter,
  ArrowRight,
  Inbox,
  Sparkles,
} from "lucide-react";
import PageHero from "@/components/ui/page-hero";
import {
  PRO_SERVICE_CATEGORIES,
  type ProServiceCategory,
  type ProProvider,
  categoryLabel,
  fmtPrice,
} from "@/lib/pro-services";

interface ProviderCard extends ProProvider {
  avg_rating: number | null;
  review_count: number;
  completed_count: number;
}

export default function HireDirectoryPage() {
  const [providers, setProviders] = useState<ProviderCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState<"all" | ProServiceCategory>("all");
  const [search, setSearch] = useState("");
  const [maxPrice, setMaxPrice] = useState<string>(""); // dollars
  const [maxTurn, setMaxTurn] = useState<string>("");
  const [minRating, setMinRating] = useState<string>("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (category !== "all") params.set("category", category);
      if (maxPrice) params.set("max_price_cents", String(Math.floor(Number(maxPrice) * 100)));
      if (maxTurn) params.set("max_turnaround", maxTurn);
      if (minRating) params.set("min_rating", minRating);

      const res = await fetch(`/api/pro-services/providers?${params.toString()}`);
      if (!res.ok) throw new Error(`providers ${res.status}`);
      const data = await res.json();
      setProviders(data.providers ?? []);
    } catch (err) {
      console.error("[hire] load providers failed:", err);
      setProviders([]);
    } finally {
      setLoading(false);
    }
  }, [category, maxPrice, maxTurn, minRating]);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    if (!search) return providers;
    const q = search.toLowerCase();
    return providers.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        (p.bio ?? "").toLowerCase().includes(q) ||
        p.categories.some((c) => categoryLabel(c).toLowerCase().includes(q)),
    );
  }, [providers, search]);

  return (
    <div className="fade-in max-w-6xl mx-auto space-y-6">
      <PageHero
        icon={<Users2 size={22} />}
        eyebrow="Pro Services"
        title="Hire a vetted human"
        subtitle="When AI isn't quite right, tap our curated directory of pre-vetted freelancers — editors, thumbnail artists, voice-over, copywriters, and more."
        gradient="ocean"
        actions={
          <Link
            href="/dashboard/hire/requests"
            className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-2 rounded-xl bg-white/10 text-white border border-white/20 hover:bg-white/15"
          >
            <Inbox size={13} /> My requests
          </Link>
        }
      />

      {/* Category tabs */}
      <section className="flex flex-wrap gap-2">
        <button
          onClick={() => setCategory("all")}
          className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
            category === "all"
              ? "bg-foreground text-background border-foreground"
              : "bg-surface text-muted border-border hover:text-foreground"
          }`}
        >
          All
        </button>
        {PRO_SERVICE_CATEGORIES.map((c) => (
          <button
            key={c.id}
            onClick={() => setCategory(c.id)}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
              category === c.id
                ? "bg-foreground text-background border-foreground"
                : "bg-surface text-muted border-border hover:text-foreground"
            }`}
          >
            {c.label}
          </button>
        ))}
      </section>

      {/* Search + filters */}
      <section className="rounded-2xl border border-border bg-surface p-4 flex flex-wrap gap-2 items-center">
        <div className="flex-1 min-w-[200px] flex items-center gap-2 px-3 py-2 rounded-xl bg-surface-light border border-border">
          <Search size={14} className="text-muted" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search providers, skills, keywords…"
            className="bg-transparent outline-none text-xs flex-1 text-foreground placeholder-muted"
          />
        </div>
        <FilterInput
          icon={<Filter size={12} />}
          label="Max $"
          value={maxPrice}
          onChange={setMaxPrice}
          placeholder="500"
        />
        <FilterInput
          icon={<Clock size={12} />}
          label="Days"
          value={maxTurn}
          onChange={setMaxTurn}
          placeholder="7"
        />
        <FilterInput
          icon={<Star size={12} />}
          label="Min ★"
          value={minRating}
          onChange={setMinRating}
          placeholder="4"
        />
      </section>

      {/* Grid */}
      <section>
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-48 rounded-2xl bg-surface animate-pulse" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="rounded-2xl border border-border bg-surface p-10 text-center">
            <div className="w-12 h-12 mx-auto rounded-2xl bg-surface-light flex items-center justify-center mb-3">
              <Sparkles size={18} className="text-muted" />
            </div>
            <p className="text-sm font-medium text-foreground mb-1">No providers match</p>
            <p className="text-xs text-muted max-w-md mx-auto">
              Try broadening your filters, or check back soon — we&apos;re actively vetting new
              freelancers every week.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((p) => (
              <ProviderGridCard key={p.id} provider={p} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function FilterInput({
  icon,
  label,
  value,
  onChange,
  placeholder,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
}) {
  return (
    <div className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-surface-light border border-border">
      <span className="text-muted">{icon}</span>
      <span className="text-[10px] font-semibold text-muted uppercase tracking-wider">{label}</span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="bg-transparent outline-none text-xs text-foreground w-14 placeholder-muted"
        inputMode="numeric"
      />
    </div>
  );
}

function ProviderGridCard({ provider }: { provider: ProviderCard }) {
  return (
    <Link
      href={`/dashboard/hire/${provider.id}`}
      className="group rounded-2xl border border-border bg-surface hover:border-foreground/20 transition-colors p-5 flex flex-col gap-3"
    >
      <div className="flex items-start gap-3">
        <div
          className="shrink-0 w-12 h-12 rounded-full bg-surface-light border border-border flex items-center justify-center overflow-hidden"
          aria-hidden
        >
          {provider.avatar_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={provider.avatar_url} alt="" className="w-full h-full object-cover" />
          ) : (
            <span className="text-sm font-bold text-muted">
              {provider.name.slice(0, 1).toUpperCase()}
            </span>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold text-foreground truncate">{provider.name}</h3>
          <div className="flex flex-wrap gap-1 mt-1">
            {provider.categories.slice(0, 2).map((c) => (
              <span
                key={c}
                className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-surface-light text-muted"
              >
                {categoryLabel(c)}
              </span>
            ))}
          </div>
        </div>
        {provider.avg_rating != null && (
          <div className="shrink-0 flex items-center gap-0.5 text-xs font-bold text-amber-400">
            <Star size={12} fill="currentColor" />
            {provider.avg_rating.toFixed(1)}
          </div>
        )}
      </div>

      {provider.bio && (
        <p className="text-xs text-muted line-clamp-3">{provider.bio}</p>
      )}

      <div className="mt-auto flex items-center justify-between pt-2 border-t border-border text-xs">
        <div>
          <span className="text-[10px] text-muted uppercase tracking-wider">From</span>
          <div className="font-bold text-foreground">{fmtPrice(provider.starting_price_cents)}</div>
        </div>
        <div>
          <span className="text-[10px] text-muted uppercase tracking-wider">Turnaround</span>
          <div className="font-bold text-foreground">
            {provider.turnaround_days}d
          </div>
        </div>
        <div className="opacity-0 group-hover:opacity-100 transition-opacity">
          <ArrowRight size={14} className="text-foreground" />
        </div>
      </div>
    </Link>
  );
}
