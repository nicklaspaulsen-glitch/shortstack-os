"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, type Variants } from "framer-motion";
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

const containerVariants: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.08 } },
};

const fadeUp: Variants = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { duration: 0.35, ease: [0.32, 0.72, 0, 1] as [number, number, number, number] } },
};

const slideX: Variants = {
  hidden: { opacity: 0, x: -18 },
  show: { opacity: 1, x: 0, transition: { duration: 0.3, ease: [0.32, 0.72, 0, 1] as [number, number, number, number] } },
};

const STAT_BARS = [
  "bg-gradient-to-r from-indigo-500 to-violet-500",
  "bg-gradient-to-r from-yellow-500 to-amber-500",
  "bg-gradient-to-r from-green-500 to-emerald-500",
];

function BarChart({ buckets }: { buckets: MonthBucket[] }) {
  const max = Math.max(...buckets.map((b) => b.weighted), 1);
  return (
    <div className="glass rounded-xl p-5">
      <p className="text-sm font-semibold text-white mb-5">Weighted Pipeline — Next 6 Months</p>
      <div className="flex items-end gap-3 h-40">
        {buckets.map((b, i) => {
          const heightPct = (b.weighted / max) * 100;
          const isThisMonth = b.month === new Date().toISOString().slice(0, 7);
          return (
            <motion.div
              key={b.month}
              initial={{ opacity: 0, scaleY: 0 }}
              animate={{ opacity: 1, scaleY: 1 }}
              transition={{ duration: 0.5, delay: i * 0.07, ease: [0.32, 0.72, 0, 1] }}
              style={{ transformOrigin: "bottom" }}
              className="flex-1 flex flex-col items-center gap-1.5 min-w-0"
            >
              <span className="text-[10px] text-muted">{b.weighted > 0 ? fmt(b.weighted) : ""}</span>
              <div className="w-full relative" style={{ height: "100px" }}>
                <div
                  className={`absolute bottom-0 w-full rounded-t-md transition-all duration-500 ${
                    isThisMonth
                      ? "bg-gradient-to-t from-indigo-600/80 to-indigo-400/80"
                      : "bg-gradient-to-t from-indigo-800/50 to-indigo-600/30"
                  }`}
                  style={{ height: `${heightPct}%` }}
                />
              </div>
              <span className="text-[10px] text-muted text-center leading-tight">{b.label}</span>
            </motion.div>
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
        gradient="gold"
      />

      {loading ? <TableSkeleton rows={8} /> : error ? (
        <div className="glass rounded-xl p-8 flex flex-col items-center gap-3 text-center">
          <AlertCircle size={32} className="text-red-400" />
          <p className="text-white font-semibold">Failed to load deals</p>
          <p className="text-muted text-sm">{error}</p>
          <motion.button
            whileHover={{ scale: 1.04 }}
            whileTap={{ scale: 0.96 }}
            onClick={fetchDeals}
            className="btn-primary text-sm px-4 py-2 rounded-lg flex items-center gap-2 mt-2"
          >
            <Loader2 size={14} /> Retry
          </motion.button>
        </div>
      ) : (
        <>
          {/* Hero stats */}
          <motion.div
            className="grid grid-cols-1 sm:grid-cols-3 gap-4"
            variants={containerVariants}
            initial="hidden"
            animate="show"
          >
            {[
              {
                label: "Total Weighted Pipeline",
                value: fmt(totalPipeline),
                sub: `across ${deals.filter((d) => !CLOSED_STAGES.has(d.stage)).length} open deals`,
                valueClass: "text-white",
              },
              {
                label: "Likely This Month",
                value: fmt(likelyClose.reduce((s, d) => s + d.value * (d.probability / 100), 0)),
                sub: `${likelyClose.length} deal${likelyClose.length !== 1 ? "s" : ""} ≥70% probability`,
                valueClass: "text-yellow-400",
              },
              {
                label: "Closed Won (All Time)",
                value: fmt(wonTotal),
                sub: `${deals.filter((d) => d.stage === "closed_won").length} deals won`,
                valueClass: "text-green-400",
              },
            ].map((stat, i) => (
              <motion.div
                key={i}
                variants={fadeUp}
                whileHover={{ y: -2 }}
                className="glass rounded-xl p-5 overflow-hidden relative"
              >
                <div className={`absolute top-0 left-0 right-0 h-0.5 ${STAT_BARS[i]}`} />
                <p className="text-xs text-muted uppercase tracking-wider mb-1">{stat.label}</p>
                <p className={`text-3xl font-bold ${stat.valueClass}`}>{stat.value}</p>
                <p className="text-xs text-muted mt-1">{stat.sub}</p>
              </motion.div>
            ))}
          </motion.div>

          {deals.filter((d) => !CLOSED_STAGES.has(d.stage)).length === 0 ? (
            <div className="glass rounded-xl p-10 flex flex-col items-center gap-3 text-center">
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
                <div className="glass rounded-xl overflow-hidden">
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
                    <motion.tbody
                      className="divide-y divide-white/5"
                      variants={containerVariants}
                      initial="hidden"
                      animate="show"
                    >
                      {likelyClose.map((d) => (
                        <motion.tr
                          key={d.id}
                          variants={slideX}
                          className="hover:bg-indigo-500/5 transition-colors"
                        >
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
                        </motion.tr>
                      ))}
                    </motion.tbody>
                  </table>
                </div>
              )}

              {/* Full pipeline table */}
              <div className="glass rounded-xl overflow-hidden">
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
                  <motion.tbody
                    className="divide-y divide-white/5"
                    variants={containerVariants}
                    initial="hidden"
                    animate="show"
                  >
                    {deals
                      .filter((d) => !CLOSED_STAGES.has(d.stage))
                      .sort((a, b) => b.value * b.probability - a.value * a.probability)
                      .map((d) => (
                        <motion.tr
                          key={d.id}
                          variants={slideX}
                          className="hover:bg-indigo-500/5 transition-colors"
                        >
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
                        </motion.tr>
                      ))}
                  </motion.tbody>
                </table>
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
