import { NextResponse } from "next/server";
import { createServerSupabase, createServiceClient } from "@/lib/supabase/server";
import { counterfactualCloudUSD, priceRowUSD } from "@/lib/llm/router";

/**
 * Admin endpoint — aggregates for the LLM-router dashboard.
 *
 * GET /api/admin/llm-router/stats
 *   → {
 *       totals: { calls, localCount, cloudCount, fallbackCount,
 *                 localPct, cloudPct,
 *                 costUSD, savingsUSD, netMonthlyUSD,
 *                 avgLatencyLocalMs, avgLatencyCloudMs },
 *       recent: [ ... last 50 rows ... ]
 *     }
 *
 * Gated to role === "admin".
 */
export const dynamic = "force-dynamic";

export async function GET() {
  const authClient = createServerSupabase();
  const { data: { user } } = await authClient.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const service = createServiceClient();
  const { data: profile } = await service
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if (profile?.role !== "admin") {
    return NextResponse.json({ error: "Admin only" }, { status: 403 });
  }

  // Last 30 days of rows for aggregate stats.
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const { data: rows } = await service
    .from("llm_router_log")
    .select("*")
    .gte("created_at", since)
    .order("created_at", { ascending: false });

  const all = rows || [];

  let localCount = 0;
  let cloudCount = 0;
  let fallbackCount = 0;
  let costUSD = 0;
  let savingsUSD = 0;
  let localLatencySum = 0;
  let cloudLatencySum = 0;

  for (const r of all) {
    if (r.tier === "local") {
      localCount++;
      localLatencySum += r.latency_ms || 0;
      savingsUSD += counterfactualCloudUSD({
        tokens_in: r.tokens_in || 0,
        tokens_out: r.tokens_out || 0,
      });
    } else {
      cloudCount++;
      cloudLatencySum += r.latency_ms || 0;
      if (r.fallback_used) fallbackCount++;
      costUSD += priceRowUSD({
        tier: "cloud",
        model: r.model,
        tokens_in: r.tokens_in || 0,
        tokens_out: r.tokens_out || 0,
      });
    }
  }

  const total = all.length;
  const localPct = total > 0 ? Math.round((localCount / total) * 100) : 0;
  const cloudPct = total > 0 ? 100 - localPct : 0;
  const avgLatencyLocalMs = localCount > 0 ? Math.round(localLatencySum / localCount) : 0;
  const avgLatencyCloudMs = cloudCount > 0 ? Math.round(cloudLatencySum / cloudCount) : 0;

  // Rough monthly projection (linear): savingsUSD is already a 30-day window.
  const netMonthlyUSD = Number(savingsUSD.toFixed(4));

  const recent = all.slice(0, 50).map((r) => ({
    id: r.id,
    created_at: r.created_at,
    tier: r.tier,
    task_type: r.task_type,
    model: r.model,
    tokens_in: r.tokens_in,
    tokens_out: r.tokens_out,
    latency_ms: r.latency_ms,
    fallback_used: r.fallback_used,
    error_text: r.error_text,
  }));

  return NextResponse.json({
    totals: {
      calls: total,
      localCount,
      cloudCount,
      fallbackCount,
      localPct,
      cloudPct,
      costUSD: Number(costUSD.toFixed(4)),
      savingsUSD: Number(savingsUSD.toFixed(4)),
      netMonthlyUSD,
      avgLatencyLocalMs,
      avgLatencyCloudMs,
    },
    recent,
    routerMode: (process.env.LLM_ROUTER_MODE || "dual").toLowerCase(),
    since,
  });
}
