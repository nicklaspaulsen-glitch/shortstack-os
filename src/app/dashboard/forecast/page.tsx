"use client";

import { useState, useEffect, useCallback } from "react";
import { TrendingUp, Loader2, AlertCircle } from "lucide-react";
import PageHero from "@/components/ui/page-hero";
import { TableSkeleton } from "@/components/ui/skeleton";
import { createClient } from "@/lib/supabase/client";

interface Deal {
  id: string;
  title: string;
  client_name: string;
  value: number;
  stage: string;
  probability: number;
  expected_close_date: string | null;
}

interface MonthBucket {
  label: string;      // "May 2026"
  month: string;      // "2026-05"
  weighted: number;
  raw: number;
  deals: Deal[];
}

const CLOSED_STAGES = new Set(["closed_won", "closed_lost"]);

function fmt(n: number) {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n.toFixed(0)}`;
}

function buildBuckets(deals: Deal[]): MonthBucket[] {
  const now = new Date();
  const buckets: MonthBucket[] = [];

  for (let m = 0; m < 6; m++) {
    const d = new Date(now.getFullYear(), now.getMonth() + m, 1);
    const label = d.toLocaleString("default", { month: "short", year: "numeric" });
    const month = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    buckets.push({ label, month, weighted: 0, raw: 0, deals: [] });
  }

  deals.forEach((deal) => {
    if (!deal.expected_close_date || CLOSED_STAGES.has(deal.stage)) return;
    const closeMonth = deal.expected_close_date.slice(0, 7);
    const bucket = buckets.find((b) => b.month === closeMonth);
    if (!bucket) return;
    const prob = (deal.probability ?? 0) / 100;
    bucket.weighted += deal.value * prob;
    bucket.raw += deal.value;
    bucket.deals.push(deal);
  });

  return buckets;
}

function BarChart({ buckets }: { buckets: MonthBucket[] }) {
  const max = Math.max(...buckets.map((b) => b.weighted), 1);
  return (
    <div className="card p-5">
      <p className="text-sm font-semibold text-white mb-5">Weighted Pipeline — Next 6 Months</p>
      <div className="flex items-end gap-3 h-40">
        {buckets.map((b) => {
          const heightPct = (b.weighted / max) * 100;
          const isThisMonth = b.month === new Date().toISOString().slice(0, 7);
          return (
            <div key={b.month} className="flex-1 flex flex-col items-center gap-1.5 min-w-0">
              <span className="text-[10px] text-muted">{b.weighted > 0 ? fmt(b.weighted) : ""}</span>
              <div className="w-full relative" style={{ height: "100px" }}>
                <div
                  className={`absolute bottom-0 w-full rounded-t-md transition-all duration-500 ${isThisMonth ? "bg-yellow-400/80" : "bg-blue-500/60"}`}
                  style={{ height: `${heightPct}%` }}
                />
              </div>
              <span className="text-[10px] text-muted text-center leading-tight">{b.label}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function ForecastPage() {
  const supabase = createClient();
  const [deals, setDeals] = useState<Deal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDeals = useCallback(async () => {
    setLoading(true);
    const { data, error: err } = await supabase
      .from("deals")
      .select("id, title, client_name, value, stage, probability, expected_close_date");
    setLoading(false);
    if (err) { setError(err.message); return; }
    setDeals(data ?? []);
  }, [supabase]);

  useEffect(() => { fetchDeals(); }, [fetchDeals]);

  const buckets = buildBuckets(deals);
  const totalPipeline = deals
    .filter((d) => !CLOSED_STAGES.has(d.stage))
    .reduce((s, d) => s + d.value * (d.probability / 100), 0);

  const thisMonthKey = new Date().toISOString().slice(0, 7);
  const thisMonthDeals = buckets.find((b) => b.month === thisMonthKey)?.deals ?? [];
  const likelyClose = thisMonthDeals.filter((d) => d.probability >= 70).sort((a, b) => b.value - a.value);

  const wonTotal = deals.filter((d) => d.stage === "closed_won").reduce((s, d) => s + d.value, 0);

  return (
    <div className="space-y-6">
      <PageHero
        title="Revenue Forecast"
        subtitle="Weighted pipeline by close date — next 6 months."
        icon={<TrendingUp size={22} />}
        gradient="green"
      />

      {loading ? <TableSkeleton rows={8} /> : error ? (
        <div className="card p-8 flex flex-col items-center gap-3 text-center">
          <AlertCircle size={32} className="text-red-400" />
          <p className="text-white font-semibold">Failed to load deals</p>
          <p className="text-muted text-sm">{error}</p>
          <button onClick={fetchDeals} className="btn-primary text-sm px-4 py-2 rounded-lg flex items-center gap-2 mt-2">
            <Loader2 size={14} /> Retry
          </button>
        </div>
      ) : (
        <>
          {/* Hero stats */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="card p-5">
              <p className="text-xs text-muted uppercase tracking-wider mb-1">Total Weighted Pipeline</p>
              <p className="text-3xl font-bold text-white">{fmt(totalPipeline)}</p>
              <p className="text-xs text-muted mt-1">across {deals.filter((d) => !CLOSED_STAGES.has(d.stage)).length} open deals</p>
            </div>
            <div className="card p-5">
              <p className="text-xs text-muted uppercase tracking-wider mb-1">Likely This Month</p>
              <p className="text-3xl font-bold text-yellow-400">
                {fmt(likelyClose.reduce((s, d) => s + d.value * (d.probability / 100), 0))}
              </p>
              <p className="text-xs text-muted mt-1">{likelyClose.length} deal{likelyClose.length !== 1 ? "s" : ""} ≥70% probability</p>
            </div>
            <div className="card p-5">
              <p className="text-xs text-muted uppercase tracking-wider mb-1">Closed Won (All Time)</p>
              <p className="text-3xl font-bold text-green-400">{fmt(wonTotal)}</p>
              <p className="text-xs text-muted mt-1">{deals.filter((d) => d.stage === "closed_won").length} deals won</p>
            </div>
          </div>

          {deals.filter((d) => !CLOSED_STAGES.has(d.stage)).length === 0 ? (
            <div className="card p-10 flex flex-col items-center gap-3 text-center">
              <TrendingUp size={36} className="text-muted opacity-30" />
              <p className="text-white font-semibold">No open deals to forecast</p>
              <p className="text-muted text-sm max-w-xs">Add deals with expected close dates and probabilities to see your revenue forecast.</p>
              <a href="/dashboard/deals" className="btn-primary text-sm px-4 py-2 rounded-lg mt-2">Go to Deals →</a>
            </div>
          ) : (
            <>
              <BarChart buckets={buckets} />

              {/* Likely to close this month */}
              {likelyClose.length > 0 && (
                <div className="card overflow-hidden">
                  <div className="px-4 py-3 border-b border-white/5">
                    <p className="text-sm font-semibold text-white">Likely to Close This Month</p>
                    <p className="text-xs text-muted mt-0.5">Deals with ≥70% probability closing in {new Date().toLocaleString("default", { month: "long" })}</p>
                  </div>
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-white/5 text-muted text-xs">
                        <th className="text-left px-4 py-2.5 font-medium">Deal</th>
                        <th className="text-left px-4 py-2.5 font-medium hidden sm:table-cell">Client</th>
                        <th className="text-right px-4 py-2.5 font-medium">Value</th>
                        <th className="text-right px-4 py-2.5 font-medium hidden md:table-cell">Probability</th>
                        <th className="text-right px-4 py-2.5 font-medium hidden md:table-cell">Weighted</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {likelyClose.map((d) => (
                        <tr key={d.id} className="hover:bg-white/[0.02]">
                          <td className="px-4 py-3 text-white font-medium">{d.title}</td>
                          <td className="px-4 py-3 text-muted hidden sm:table-cell">{d.client_name}</td>
                          <td className="px-4 py-3 text-right text-white">{fmt(d.value)}</td>
                          <td className="px-4 py-3 text-right hidden md:table-cell">
                            <span className="text-xs bg-green-500/10 text-green-400 border border-green-500/20 px-2 py-0.5 rounded-full">
                              {d.probability}%
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right text-yellow-400 font-medium hidden md:table-cell">
                            {fmt(d.value * d.probability / 100)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Full pipeline table */}
              <div className="card overflow-hidden">
                <div className="px-4 py-3 border-b border-white/5">
                  <p className="text-sm font-semibold text-white">Full Open Pipeline</p>
                </div>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-white/5 text-muted text-xs">
                      <th className="text-left px-4 py-2.5 font-medium">Deal</th>
                      <th className="text-left px-4 py-2.5 font-medium hidden sm:table-cell">Stage</th>
                      <th className="text-right px-4 py-2.5 font-medium">Value</th>
                      <th className="text-right px-4 py-2.5 font-medium hidden md:table-cell">Close Date</th>
                      <th className="text-right px-4 py-2.5 font-medium hidden md:table-cell">Weighted</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {deals
                      .filter((d) => !CLOSED_STAGES.has(d.stage))
                      .sort((a, b) => b.value * b.probability - a.value * a.probability)
                      .map((d) => (
                        <tr key={d.id} className="hover:bg-white/[0.02]">
                          <td className="px-4 py-3">
                            <p className="text-white">{d.title}</p>
                            <p className="text-muted text-xs">{d.client_name}</p>
                          </td>
                          <td className="px-4 py-3 text-muted text-xs hidden sm:table-cell">
                            {d.stage.replace(/_/g, " ")}
                          </td>
                          <td className="px-4 py-3 text-right text-white">{fmt(d.value)}</td>
                          <td className="px-4 py-3 text-right text-muted hidden md:table-cell">
                            {d.expected_close_date
                              ? new Date(d.expected_close_date).toLocaleDateString()
                              : "—"}
                          </td>
                          <td className="px-4 py-3 text-right text-yellow-400 hidden md:table-cell">
                            {fmt(d.value * d.probability / 100)}
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
