/**
 * Per-org AI budget enforcement + circuit breaker.
 *
 * - checkBudget(orgId) → gatekeeper; throws if paused or >= 100% spent
 * - recordSpend(orgId, costUsd) → increments spend, writes threshold alerts,
 *   auto-pauses at 100%
 * - monthlyReset() → cron helper; rolls current_month_spend_usd back to 0,
 *   unpauses only rows whose pause reason was "auto_pause"
 *
 * Kill-switch: DISABLE_BUDGET_GATE=true bypasses enforcement entirely.
 */

import { createServiceClient } from "@/lib/supabase/server";

export interface BudgetCheckResult {
  allowed: boolean;
  reason?: string;
  current: number;
  limit: number;
  pct: number;
}

const DEFAULT_MONTHLY_LIMIT = 100.0;

function killSwitchOn(): boolean {
  return process.env.DISABLE_BUDGET_GATE === "true";
}

/**
 * Ensures a budget row exists for the org. Returns the current row.
 * Called internally so first-use orgs don't blow up.
 */
async function ensureBudgetRow(orgId: string) {
  const supabase = createServiceClient();
  const { data: existing, error: selErr } = await supabase
    .from("org_ai_budgets")
    .select("*")
    .eq("org_id", orgId)
    .maybeSingle();

  if (selErr) throw new Error(`budget-gate: select failed: ${selErr.message}`);
  if (existing) return existing;

  const { data: inserted, error: insErr } = await supabase
    .from("org_ai_budgets")
    .insert({ org_id: orgId, monthly_limit_usd: DEFAULT_MONTHLY_LIMIT })
    .select("*")
    .single();

  if (insErr) throw new Error(`budget-gate: insert failed: ${insErr.message}`);
  return inserted;
}

/**
 * Gatekeeper — call BEFORE any paid AI API call.
 * Throws if the org is paused or has exceeded 100% of their monthly limit.
 */
export async function checkBudget(orgId: string): Promise<BudgetCheckResult> {
  if (killSwitchOn()) {
    return { allowed: true, current: 0, limit: 0, pct: 0, reason: "kill-switch" };
  }
  if (!orgId) {
    // No org context — allow but don't track. Avoids breaking legacy callers.
    return { allowed: true, current: 0, limit: 0, pct: 0, reason: "no-org" };
  }

  const row = await ensureBudgetRow(orgId);
  const current = Number(row.current_month_spend_usd ?? 0);
  const limit = Number(row.monthly_limit_usd ?? DEFAULT_MONTHLY_LIMIT);
  const pct = limit > 0 ? Math.round((current / limit) * 10000) / 100 : 0;

  if (row.paused) {
    throw new Error(
      `AI spend is paused for this org (reason: ${row.paused_reason ?? "unknown"})`
    );
  }

  if (limit > 0 && current >= limit) {
    throw new Error(
      `AI spend cap reached: $${current.toFixed(2)} / $${limit.toFixed(2)} (${pct}%)`
    );
  }

  return { allowed: true, current, limit, pct };
}

/**
 * Increment the org's spend counter. Writes threshold alerts when crossing
 * the configured alert_threshold_pct (default 80%) or the hard 100% line,
 * and auto-pauses on 100%.
 */
export async function recordSpend(
  orgId: string,
  costUsd: number
): Promise<void> {
  if (killSwitchOn()) return;
  if (!orgId || !Number.isFinite(costUsd) || costUsd <= 0) return;

  const supabase = createServiceClient();
  const row = await ensureBudgetRow(orgId);

  const prevSpend = Number(row.current_month_spend_usd ?? 0);
  const newSpend = prevSpend + costUsd;
  const limit = Number(row.monthly_limit_usd ?? DEFAULT_MONTHLY_LIMIT);
  const thresholdPct = Number(row.alert_threshold_pct ?? 80);

  const prevPct = limit > 0 ? (prevSpend / limit) * 100 : 0;
  const newPct = limit > 0 ? (newSpend / limit) * 100 : 0;

  const crossedThreshold = prevPct < thresholdPct && newPct >= thresholdPct;
  const crossedLimit = prevPct < 100 && newPct >= 100;

  // Atomic-ish update. Supabase doesn't do RETURNING-with-increment in one call,
  // so we update by explicit value (safe because recordSpend is called after a
  // successful API response — contention is rare at MVP scale).
  const updatePayload: Record<string, unknown> = {
    current_month_spend_usd: newSpend,
  };
  if (crossedLimit) {
    updatePayload.paused = true;
    updatePayload.paused_reason = "auto_pause";
  }

  const { error: updErr } = await supabase
    .from("org_ai_budgets")
    .update(updatePayload)
    .eq("org_id", orgId);
  if (updErr) {
    // Don't throw — we already made the API call. Just log.
    console.error("[budget-gate] recordSpend update failed", updErr);
    return;
  }

  // Fire-and-forget alert rows
  const alerts: Array<{ alert_type: string; spend_at_alert: number }> = [];
  if (crossedThreshold && !crossedLimit) {
    alerts.push({ alert_type: "threshold_80", spend_at_alert: newSpend });
  }
  if (crossedLimit) {
    alerts.push({ alert_type: "threshold_100", spend_at_alert: newSpend });
    alerts.push({ alert_type: "auto_pause", spend_at_alert: newSpend });
  }

  if (alerts.length > 0) {
    const { error: alertErr } = await supabase
      .from("ai_budget_alerts")
      .insert(alerts.map((a) => ({ ...a, org_id: orgId })));
    if (alertErr) {
      console.error("[budget-gate] alert insert failed", alertErr);
    }
  }
}

/**
 * Called from the daily maintenance cron. Resets any budget whose reset_date
 * has passed, and lifts only auto_pause rows (leaves manual_pause intact).
 * Returns a count of rows reset.
 */
export async function monthlyReset(): Promise<{ reset: number }> {
  const supabase = createServiceClient();
  const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD

  const { data: due, error: selErr } = await supabase
    .from("org_ai_budgets")
    .select("org_id, paused, paused_reason")
    .lte("reset_date", today);

  if (selErr) throw new Error(`budget-gate: monthlyReset select failed: ${selErr.message}`);
  if (!due || due.length === 0) return { reset: 0 };

  const nextReset = nextResetDate();
  let resetCount = 0;

  for (const row of due) {
    const unpause = row.paused && row.paused_reason === "auto_pause";
    const payload: Record<string, unknown> = {
      current_month_spend_usd: 0,
      reset_date: nextReset,
    };
    if (unpause) {
      payload.paused = false;
      payload.paused_reason = null;
    }

    const { error: updErr } = await supabase
      .from("org_ai_budgets")
      .update(payload)
      .eq("org_id", row.org_id);
    if (updErr) {
      console.error("[budget-gate] monthlyReset update failed", updErr);
      continue;
    }

    resetCount++;
    await supabase.from("ai_budget_alerts").insert({
      org_id: row.org_id,
      alert_type: "monthly_reset",
      spend_at_alert: 0,
    });
  }

  return { reset: resetCount };
}

/** First day of next month, YYYY-MM-DD. */
function nextResetDate(): string {
  const d = new Date();
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1))
    .toISOString()
    .slice(0, 10);
}
