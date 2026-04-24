import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase, createServiceClient } from "@/lib/supabase/server";

/**
 * GET /api/ai-costs/stats?range=30d
 *
 * Returns aggregated AI cost + cache savings for the current user.
 * If the user is an admin, returns org-wide stats.
 *
 * Powers /dashboard/settings/ai-costs.
 */
export async function GET(request: NextRequest) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(request.url);
  const range = url.searchParams.get("range") || "30d";
  const days = range === "7d" ? 7 : range === "90d" ? 90 : 30;
  const since = new Date(Date.now() - days * 86400000).toISOString();

  const service = createServiceClient();

  const { data: profile } = await service
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  const isAdmin = profile?.role === "admin";

  let query = service
    .from("ai_cache_stats")
    .select("endpoint, model, input_tokens, output_tokens, cache_creation_tokens, cache_read_tokens, batched, had_cache_hit, estimated_cost_usd, baseline_cost_usd, savings_usd, created_at")
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(1000);
  if (!isAdmin) query = query.eq("user_id", user.id);
  const { data: rows, error } = await query;

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const list = rows || [];

  let totalCost = 0;
  let totalBaseline = 0;
  let totalSavings = 0;
  let totalInput = 0;
  let totalOutput = 0;
  let totalCacheWrite = 0;
  let totalCacheRead = 0;
  let batchedCalls = 0;
  let cachedHits = 0;
  const byEndpoint: Record<string, { calls: number; cost: number; savings: number }> = {};
  const byDay: Record<string, { cost: number; savings: number }> = {};

  for (const r of list) {
    totalCost += Number(r.estimated_cost_usd) || 0;
    totalBaseline += Number(r.baseline_cost_usd) || 0;
    totalSavings += Number(r.savings_usd) || 0;
    totalInput += r.input_tokens || 0;
    totalOutput += r.output_tokens || 0;
    totalCacheWrite += r.cache_creation_tokens || 0;
    totalCacheRead += r.cache_read_tokens || 0;
    if (r.batched) batchedCalls++;
    if (r.had_cache_hit) cachedHits++;

    const ep = r.endpoint || "unknown";
    byEndpoint[ep] = byEndpoint[ep] || { calls: 0, cost: 0, savings: 0 };
    byEndpoint[ep].calls++;
    byEndpoint[ep].cost += Number(r.estimated_cost_usd) || 0;
    byEndpoint[ep].savings += Number(r.savings_usd) || 0;

    const day = (r.created_at as string).slice(0, 10);
    byDay[day] = byDay[day] || { cost: 0, savings: 0 };
    byDay[day].cost += Number(r.estimated_cost_usd) || 0;
    byDay[day].savings += Number(r.savings_usd) || 0;
  }

  let jobsQuery = service
    .from("ai_batch_jobs")
    .select("batch_id, endpoint, model, item_count, status, successful, failed, submitted_at, completed_at")
    .gte("submitted_at", since)
    .order("submitted_at", { ascending: false })
    .limit(20);
  if (!isAdmin) jobsQuery = jobsQuery.eq("user_id", user.id);
  const { data: jobs } = await jobsQuery;

  const savingsPct = totalBaseline > 0 ? (totalSavings / totalBaseline) * 100 : 0;

  return NextResponse.json({
    range,
    since,
    is_admin: isAdmin,
    totals: {
      calls: list.length,
      batched_calls: batchedCalls,
      cache_hit_calls: cachedHits,
      input_tokens: totalInput,
      output_tokens: totalOutput,
      cache_write_tokens: totalCacheWrite,
      cache_read_tokens: totalCacheRead,
      estimated_cost_usd: Math.round(totalCost * 10000) / 10000,
      baseline_cost_usd: Math.round(totalBaseline * 10000) / 10000,
      savings_usd: Math.round(totalSavings * 10000) / 10000,
      savings_pct: Math.round(savingsPct * 10) / 10,
    },
    by_endpoint: Object.entries(byEndpoint)
      .map(([endpoint, v]) => ({
        endpoint,
        calls: v.calls,
        cost: Math.round(v.cost * 10000) / 10000,
        savings: Math.round(v.savings * 10000) / 10000,
      }))
      .sort((a, b) => b.cost - a.cost),
    by_day: Object.entries(byDay)
      .map(([date, v]) => ({
        date,
        cost: Math.round(v.cost * 10000) / 10000,
        savings: Math.round(v.savings * 10000) / 10000,
      }))
      .sort((a, b) => a.date.localeCompare(b.date)),
    recent_jobs: jobs || [],
    optimizations_disabled: process.env.DISABLE_AI_OPTIMIZATIONS === "true",
  });
}
