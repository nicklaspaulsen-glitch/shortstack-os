/**
 * Forecast API — projects 6-month forward revenue by blending three signals:
 *
 *   1. Historical MRR — summed paid invoices per month (last 6 months).
 *   2. Recurring MRR   — sum of clients.mrr for active clients (carried
 *      forward flat to future months, discounted by a simple churn factor).
 *   3. Pipeline MRR    — open deals weighted by their own probability.
 *      Allocated to the month matching expected_close_date, or distributed
 *      evenly across 1..3 months forward when close date is unknown.
 *
 * Returned shape: { history: [...], forecast: [...], summary: {...} }
 * Each datapoint has { month: "YYYY-MM", historical, projected_mrr,
 *                      pipeline_value, churn_adjusted }.
 *
 * No new table — everything reads from existing tables (invoices, clients,
 * deals). RLS handles auth; we additionally filter by effective ownerId.
 */
import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { getEffectiveOwnerId } from "@/lib/security/require-owned-client";

// Tune these defaults — assumed monthly churn rate on recurring MRR.
const MONTHLY_CHURN_RATE = 0.03;
// When deals have no close date, fan them across this many future months.
const PIPELINE_FAN_MONTHS = 3;

type HistoryPoint = {
  month: string;
  historical: number;
  label: string;
};

type ForecastPoint = {
  month: string;
  projected_mrr: number;
  pipeline_value: number;
  churn_adjusted: number;
  label: string;
};

function monthKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function monthLabel(d: Date): string {
  return d.toLocaleDateString("en-US", { month: "short", year: "2-digit" });
}

export async function GET() {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const ownerId = (await getEffectiveOwnerId(supabase, user.id)) || user.id;

  const now = new Date();
  const history: HistoryPoint[] = [];
  const forecast: ForecastPoint[] = [];

  // ── Historical MRR (last 6 months, including current month-to-date) ──
  const historicalBuckets: Record<string, number> = {};
  const historyStart = new Date(now.getFullYear(), now.getMonth() - 5, 1);
  for (let i = 0; i < 6; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
    historicalBuckets[monthKey(d)] = 0;
  }

  // invoices table is client-scoped (no user_id), so we first resolve the
  // owner's clients then filter invoices by that client set.
  const { data: ownerClients } = await supabase
    .from("clients")
    .select("id, mrr, is_active")
    .eq("profile_id", ownerId);
  const clientIds = (ownerClients ?? []).map((c) => c.id);

  if (clientIds.length > 0) {
    const { data: paidInvoices } = await supabase
      .from("invoices")
      .select("amount, paid_at, client_id")
      .in("client_id", clientIds)
      .not("paid_at", "is", null)
      .gte("paid_at", historyStart.toISOString());
    for (const inv of (paidInvoices ?? []) as Array<{ amount: number; paid_at: string }>) {
      const m = monthKey(new Date(inv.paid_at));
      if (m in historicalBuckets) {
        historicalBuckets[m] += Number(inv.amount) || 0;
      }
    }
  }

  for (let i = 0; i < 6; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
    const key = monthKey(d);
    history.push({
      month: key,
      historical: Math.round(historicalBuckets[key] || 0),
      label: monthLabel(d),
    });
  }

  // ── Current recurring MRR baseline (active clients) ──
  const currentMRR = (ownerClients ?? [])
    .filter((c) => c.is_active !== false)
    .reduce((sum, c) => sum + (Number(c.mrr) || 0), 0);

  // ── Pipeline: open deals and their expected close month ──
  const { data: deals } = await supabase
    .from("deals")
    .select("id, value, probability, expected_close_date, stage")
    .eq("user_id", ownerId)
    .not("stage", "in", "(closed_won,closed_lost)");

  const pipelineByMonth: Record<string, number> = {};
  const pipelineTotal = (deals ?? []).reduce(
    (s, d) => s + Number(d.value) * (Number(d.probability) / 100),
    0,
  );

  for (let i = 1; i <= 6; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
    pipelineByMonth[monthKey(d)] = 0;
  }

  for (const deal of (deals ?? []) as Array<{
    value: number;
    probability: number;
    expected_close_date: string | null;
  }>) {
    const weighted = Number(deal.value) * (Number(deal.probability) / 100);
    if (deal.expected_close_date) {
      const m = monthKey(new Date(deal.expected_close_date));
      if (m in pipelineByMonth) {
        pipelineByMonth[m] += weighted;
      }
    } else {
      // Fan across first N forecast months evenly.
      const share = weighted / PIPELINE_FAN_MONTHS;
      for (let i = 1; i <= PIPELINE_FAN_MONTHS; i++) {
        const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
        const m = monthKey(d);
        if (m in pipelineByMonth) {
          pipelineByMonth[m] += share;
        }
      }
    }
  }

  // ── Build forecast points ──
  for (let i = 1; i <= 6; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
    const key = monthKey(d);
    const churnFactor = Math.pow(1 - MONTHLY_CHURN_RATE, i);
    const projected = currentMRR;
    const churnAdjusted = currentMRR * churnFactor;
    const pipeline = pipelineByMonth[key] || 0;
    forecast.push({
      month: key,
      projected_mrr: Math.round(projected),
      pipeline_value: Math.round(pipeline),
      churn_adjusted: Math.round(churnAdjusted + pipeline),
      label: monthLabel(d),
    });
  }

  const summary = {
    current_mrr: Math.round(currentMRR),
    pipeline_total: Math.round(pipelineTotal),
    active_clients: (ownerClients ?? []).filter((c) => c.is_active !== false).length,
    open_deals: (deals ?? []).length,
    monthly_churn_rate: MONTHLY_CHURN_RATE,
    six_month_total: Math.round(
      forecast.reduce((s, f) => s + f.churn_adjusted, 0),
    ),
  };

  return NextResponse.json({ history, forecast, summary });
}
