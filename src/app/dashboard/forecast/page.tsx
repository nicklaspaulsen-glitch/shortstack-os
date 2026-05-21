"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, type Variants } from "framer-motion";
import { TrendingUp, Loader2, AlertCircle } from "lucide-react";
import { TableSkeleton } from "@/components/ui/skeleton";
import { PrismPanel } from "@/components/prism";
import { createClient } from "@/lib/supabase/client";
import { MotionPage } from "@/components/motion/motion-page";

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


function BarChart({ buckets }: { buckets: MonthBucket[] }) {
  const max = Math.max(...buckets.map((b) => b.weighted), 1);
  return (
    <PrismPanel rainbow padding="p-5">
      <p className="text-sm font-semibold text-text-primary mb-5">Weighted Pipeline � Next 6 Months</p>
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
              <span className="text-[10px] text-text-muted">{b.weighted > 0 ? fmt(b.weighted) : ""}</span>
              <div className="w-full relative" style={{ height: "100px" }}>
                <div
                  className={`absolute bottom-0 w-full rounded-t-md transition-all duration-500 ${
                    isThisMonth
                      ? "bg-gradient-to-t from-[rgba(212,255,0,0.80)] to-[rgba(212,255,0,0.45)]"
                      : "bg-gradient-to-t from-[rgba(212,255,0,0.30)] to-[rgba(212,255,0,0.12)]"
                  }`}
                  style={{ height: `${heightPct}%` }}
                />
              </div>
              <span className="text-[10px] text-text-muted text-center leading-tight">{b.label}</span>
            </motion.div>
          );
        })}
      </div>
    </PrismPanel>
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
    <MotionPage className="space-y-6">{/* -- Revenue Forecast command strip -- */}
    <div className="flex items-center justify-between gap-4 px-1 py-3 sm:py-4">
      <div className="min-w-0">
        <p className="font-editorial text-[11px] italic text-text-muted mb-0.5">Pipeline Projection</p>
        <h1 className="font-display text-xl sm:text-2xl font-bold tracking-tight text-text-primary leading-none">Revenue Forecast</h1>
      </div>
    </div>{loading ? <TableSkeleton rows={8} /> : error ? (
              <PrismPanel padding="p-8" className="flex flex-col items-center gap-3 text-center">
                <AlertCircle size={32} className="text-red-400" />
                <p className="text-text-primary font-semibold">Failed to load deals</p>
                <p className="text-text-muted text-sm">{error}</p>
                <motion.button
                  whileHover={{ scale: 1.04 }}
                  whileTap={{ scale: 0.96 }}
                  onClick={fetchDeals}
                  className="btn-primary text-sm px-4 py-2 rounded-lg flex items-center gap-2 mt-2"
                >
                  <Loader2 size={14} /> Retry
                </motion.button>
              </PrismPanel>
            ) : (
              <>
                {/* Hero stats */}
                <div className="grid grid-cols-2 lg:grid-cols-[4fr_2fr_2fr] gap-3 mb-4">
                  {/* Focal tile */}
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.04, duration: 0.32, ease: [0.32, 0.72, 0, 1] }}
                    className="flex items-start gap-3 glass rounded-2xl p-5"
                  >
                    <div>
                      <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-text-muted mb-1.5">Total Weighted Pipeline</p>
                      <p className="font-display text-3xl font-bold tracking-[-0.03em] text-text-primary tabular-nums">{fmt(totalPipeline)}</p>
                      <p className="text-[10px] text-text-muted mt-1">across {deals.filter((d) => !CLOSED_STAGES.has(d.stage)).length} open deals</p>
                    </div>
                  </motion.div>
                  {/* Likely This Month */}
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.10, duration: 0.32, ease: [0.32, 0.72, 0, 1] }}
                    className="glass rounded-2xl p-5"
                  >
                    <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-text-muted mb-1.5">Likely This Month</p>
                    <p className="font-display text-2xl font-bold tracking-[-0.02em] text-text-primary tabular-nums">
                      {fmt(likelyClose.reduce((s, d) => s + d.value * (d.probability / 100), 0))}
                    </p>
                    <p className="text-[10px] text-text-muted mt-1">{likelyClose.length} deal{likelyClose.length !== 1 ? "s" : ""} ≥70% probability</p>
                  </motion.div>
                  {/* Closed Won */}
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.14, duration: 0.32, ease: [0.32, 0.72, 0, 1] }}
                    className="glass rounded-2xl p-5"
                  >
                    <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-text-muted mb-1.5">Closed Won (All Time)</p>
                    <p className="font-display text-2xl font-bold tracking-[-0.02em] text-text-primary tabular-nums">{fmt(wonTotal)}</p>
                    <p className="text-[10px] text-text-muted mt-1">{deals.filter((d) => d.stage === "closed_won").length} deals won</p>
                  </motion.div>
                </div>

                {deals.filter((d) => !CLOSED_STAGES.has(d.stage)).length === 0 ? (
                  <PrismPanel padding="p-10" className="flex flex-col items-center gap-3 text-center">
                    <TrendingUp size={36} className="text-text-muted opacity-30" />
                    <p className="text-text-primary font-semibold">No open deals to forecast</p>
                    <p className="text-text-muted text-sm max-w-xs">Add deals with expected close dates and probabilities to see your revenue forecast.</p>
                    <a href="/dashboard/deals" className="btn-primary text-sm px-4 py-2 rounded-lg mt-2">Go to Deals ?</a>
                  </PrismPanel>
                ) : (
                  <>
                    <BarChart buckets={buckets} />

                    {/* Likely to close this month */}
                    {likelyClose.length > 0 && (
                      <PrismPanel padding="p-0" className="overflow-hidden">
                        <div className="px-4 py-3 border-b border-white/8">
                          <p className="text-sm font-semibold text-text-primary">Likely to Close This Month</p>
                          <p className="text-xs text-text-muted mt-0.5">Deals with =70% probability closing in {new Date().toLocaleString("default", { month: "long" })}</p>
                        </div>
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b border-white/8 text-text-muted text-xs">
                              <th className="text-left px-4 py-2.5 font-medium">Deal</th>
                              <th className="text-left px-4 py-2.5 font-medium hidden sm:table-cell">Client</th>
                              <th className="text-right px-4 py-2.5 font-medium">Value</th>
                              <th className="text-right px-4 py-2.5 font-medium hidden md:table-cell">Probability</th>
                              <th className="text-right px-4 py-2.5 font-medium hidden md:table-cell">Weighted</th>
                            </tr>
                          </thead>
                          <motion.tbody
                            className="divide-y divide-white/8"
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
                                <td className="px-4 py-3 text-text-primary font-medium">{d.title}</td>
                                <td className="px-4 py-3 text-text-muted hidden sm:table-cell">{d.client_name}</td>
                                <td className="px-4 py-3 text-right text-text-primary">{fmt(d.value)}</td>
                                <td className="px-4 py-3 text-right hidden md:table-cell">
                                  <span className="text-xs bg-green-500/15 text-green-400 border border-green-500/30 px-2 py-0.5 rounded-full">
                                    {d.probability}%
                                  </span>
                                </td>
                                <td className="px-4 py-3 text-right text-indigo-400 font-medium hidden md:table-cell">
                                  {fmt(d.value * d.probability / 100)}
                                </td>
                              </motion.tr>
                            ))}
                          </motion.tbody>
                        </table>
                      </PrismPanel>
                    )}

                    {/* Full pipeline table */}
                    <PrismPanel padding="p-0" className="overflow-hidden">
                      <div className="px-4 py-3 border-b border-white/8">
                        <p className="text-sm font-semibold text-text-primary">Full Open Pipeline</p>
                      </div>
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-white/8 text-text-muted text-xs">
                            <th className="text-left px-4 py-2.5 font-medium">Deal</th>
                            <th className="text-left px-4 py-2.5 font-medium hidden sm:table-cell">Stage</th>
                            <th className="text-right px-4 py-2.5 font-medium">Value</th>
                            <th className="text-right px-4 py-2.5 font-medium hidden md:table-cell">Close Date</th>
                            <th className="text-right px-4 py-2.5 font-medium hidden md:table-cell">Weighted</th>
                          </tr>
                        </thead>
                        <motion.tbody
                          className="divide-y divide-white/8"
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
                                  <p className="text-text-primary">{d.title}</p>
                                  <p className="text-text-muted text-xs">{d.client_name}</p>
                                </td>
                                <td className="px-4 py-3 text-text-muted text-xs hidden sm:table-cell">
                                  {d.stage.replace(/_/g, " ")}
                                </td>
                                <td className="px-4 py-3 text-right text-text-primary">{fmt(d.value)}</td>
                                <td className="px-4 py-3 text-right text-text-muted hidden md:table-cell">
                                  {d.expected_close_date
                                    ? new Date(d.expected_close_date).toLocaleDateString()
                                    : "�"}
                                </td>
                                <td className="px-4 py-3 text-right text-indigo-400 hidden md:table-cell">
                                  {fmt(d.value * d.probability / 100)}
                                </td>
                              </motion.tr>
                            ))}
                        </motion.tbody>
                      </table>
                    </PrismPanel>
                  </>
                )}
              </>
            )}</MotionPage>
  );
}


