/**
 * Compute and disburse pending affiliate payouts.
 *
 *   POST /api/affiliate/payouts/run
 *   body: { program_id?: string, affiliate_id?: string, dry_run?: boolean }
 *
 * Walks pending+approved commissions for the caller's programs (or scoped
 * to the body filter), groups by affiliate, and:
 *   1. Skips affiliates without a connected stripe_account_id.
 *   2. Skips groups whose unpaid total is below the program's threshold.
 *   3. Executes a single stripe.transfers.create() for the group.
 *   4. Marks each contributing commission as 'paid' with the transfer id.
 *
 * Returns the list of payouts attempted along with success/failure status
 * so the UI can surface a per-affiliate breakdown.
 *
 * Concurrency: this is admin-triggered, single-tenant per request, so we
 * don't add a distributed lock — just serialize transfer calls per affiliate.
 */
import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { getEffectiveOwnerId } from "@/lib/security/require-owned-client";
import { getStripe } from "@/lib/stripe/client";

export const dynamic = "force-dynamic";

interface RunInput {
  program_id?: string;
  affiliate_id?: string;
  dry_run?: boolean;
}

interface PayoutResult {
  affiliate_id: string;
  affiliate_email: string;
  amount_cents: number;
  currency: string;
  status: "paid" | "skipped_below_threshold" | "skipped_no_stripe" | "skipped_inactive" | "failed";
  transfer_id?: string;
  error?: string;
  commission_ids: string[];
}

export async function POST(request: NextRequest) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const ownerId = await getEffectiveOwnerId(supabase, user.id);
  if (!ownerId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  let body: RunInput;
  try {
    body = (await request.json().catch(() => ({}))) as RunInput;
  } catch {
    body = {};
  }

  // Pull every pending/approved commission for the caller's programs in one
  // query. We re-query inside the loop only to update statuses.
  let commissionsQuery = supabase
    .from("affiliate_commissions")
    .select(`
      id,
      affiliate_id,
      amount_cents,
      currency,
      status,
      created_at,
      affiliates!inner (
        id, email, stripe_account_id, status, program_id,
        affiliate_programs!inner ( id, user_id, payout_threshold_cents, status )
      )
    `)
    .in("status", ["pending", "approved"])
    .eq("affiliates.affiliate_programs.user_id", ownerId);

  if (body.program_id) {
    commissionsQuery = commissionsQuery.eq("affiliates.program_id", body.program_id);
  }
  if (body.affiliate_id) {
    commissionsQuery = commissionsQuery.eq("affiliate_id", body.affiliate_id);
  }

  const { data: commissions, error } = await commissionsQuery;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Group commissions by affiliate. Each affiliate has one connected account
  // and one threshold (from its program), so a single transfer suffices.
  type Group = {
    affiliate_id: string;
    email: string;
    stripe_account_id: string | null;
    affiliate_status: string;
    program_status: string;
    threshold: number;
    currency: string;
    rows: { id: string; amount_cents: number }[];
  };
  const groups = new Map<string, Group>();
  for (const c of commissions ?? []) {
    const aff = Array.isArray(c.affiliates) ? c.affiliates[0] : c.affiliates;
    if (!aff) continue;
    const programRel = aff.affiliate_programs;
    const program = Array.isArray(programRel) ? programRel[0] : programRel;
    if (!program) continue;
    if (!groups.has(c.affiliate_id)) {
      groups.set(c.affiliate_id, {
        affiliate_id: c.affiliate_id,
        email: aff.email ?? "",
        stripe_account_id: aff.stripe_account_id ?? null,
        affiliate_status: aff.status ?? "pending",
        program_status: program.status ?? "active",
        threshold: program.payout_threshold_cents ?? 0,
        currency: c.currency ?? "usd",
        rows: [],
      });
    }
    groups.get(c.affiliate_id)!.rows.push({ id: c.id, amount_cents: c.amount_cents });
  }

  const results: PayoutResult[] = [];
  const stripe = body.dry_run ? null : getStripeOrNullSafe();

  // Avoid Map iteration (downlevelIteration off in tsconfig). Array.from is
  // safe on every runtime target.
  const groupList = Array.from(groups.values());
  for (const g of groupList) {
    const total = g.rows.reduce((acc: number, r: { amount_cents: number }) => acc + (r.amount_cents ?? 0), 0);
    const commissionIds = g.rows.map((r: { id: string }) => r.id);

    if (g.affiliate_status !== "approved" || g.program_status !== "active") {
      results.push({
        affiliate_id: g.affiliate_id,
        affiliate_email: g.email,
        amount_cents: total,
        currency: g.currency,
        status: "skipped_inactive",
        commission_ids: commissionIds,
      });
      continue;
    }

    if (total < g.threshold) {
      results.push({
        affiliate_id: g.affiliate_id,
        affiliate_email: g.email,
        amount_cents: total,
        currency: g.currency,
        status: "skipped_below_threshold",
        commission_ids: commissionIds,
      });
      continue;
    }

    if (!g.stripe_account_id) {
      results.push({
        affiliate_id: g.affiliate_id,
        affiliate_email: g.email,
        amount_cents: total,
        currency: g.currency,
        status: "skipped_no_stripe",
        commission_ids: commissionIds,
      });
      continue;
    }

    if (body.dry_run) {
      results.push({
        affiliate_id: g.affiliate_id,
        affiliate_email: g.email,
        amount_cents: total,
        currency: g.currency,
        status: "paid",
        commission_ids: commissionIds,
        transfer_id: "dry_run",
      });
      continue;
    }

    if (!stripe) {
      results.push({
        affiliate_id: g.affiliate_id,
        affiliate_email: g.email,
        amount_cents: total,
        currency: g.currency,
        status: "failed",
        error: "Stripe not configured",
        commission_ids: commissionIds,
      });
      continue;
    }

    try {
      const transfer = await stripe.transfers.create({
        amount: total,
        currency: g.currency,
        destination: g.stripe_account_id,
        metadata: {
          purpose: "affiliate_payout",
          affiliate_id: g.affiliate_id,
          owner_id: ownerId,
        },
      });

      // Mark contributing rows paid. We use `.in()` rather than a per-row
      // update because the count is small and we want a single round-trip.
      const { error: updErr } = await supabase
        .from("affiliate_commissions")
        .update({
          status: "paid",
          stripe_transfer_id: transfer.id,
          paid_at: new Date().toISOString(),
        })
        .in("id", commissionIds);
      if (updErr) {
        console.error(`[affiliate/payouts] mark-paid failed after transfer ${transfer.id}:`, updErr.message);
      }

      // Refresh affiliate totals.
      await refreshAffiliateTotals(supabase, g.affiliate_id);

      results.push({
        affiliate_id: g.affiliate_id,
        affiliate_email: g.email,
        amount_cents: total,
        currency: g.currency,
        status: "paid",
        transfer_id: transfer.id,
        commission_ids: commissionIds,
      });
    } catch (err) {
      results.push({
        affiliate_id: g.affiliate_id,
        affiliate_email: g.email,
        amount_cents: total,
        currency: g.currency,
        status: "failed",
        error: err instanceof Error ? err.message : "Transfer failed",
        commission_ids: commissionIds,
      });
    }
  }

  const summary = {
    total_paid_cents: results.filter((r) => r.status === "paid").reduce((s, r) => s + r.amount_cents, 0),
    paid_count: results.filter((r) => r.status === "paid").length,
    skipped_count: results.filter((r) => r.status.startsWith("skipped_")).length,
    failed_count: results.filter((r) => r.status === "failed").length,
  };

  return NextResponse.json({ results, summary, dry_run: !!body.dry_run });
}

/** Avoids throwing when STRIPE_SECRET_KEY is missing so the route can still
 *  return useful results (skips will surface as failed with a helpful error). */
function getStripeOrNullSafe(): ReturnType<typeof getStripe> | null {
  try {
    return getStripe();
  } catch {
    return null;
  }
}

/** Same logic as bumpAffiliateTotals in the webhook — kept private here to
 *  avoid an unnecessary public helper file. If we add more endpoints that
 *  need it, extract to src/lib/affiliate-totals.ts then. */
async function refreshAffiliateTotals(
  supabase: ReturnType<typeof createServerSupabase>,
  affiliateId: string,
) {
  const { data: rows } = await supabase
    .from("affiliate_commissions")
    .select("amount_cents, status")
    .eq("affiliate_id", affiliateId);

  let pending = 0;
  let paid = 0;
  let total = 0;
  for (const r of rows ?? []) {
    const cents = r.amount_cents ?? 0;
    if (r.status === "paid") {
      paid += cents;
      total += cents;
    } else if (r.status === "pending" || r.status === "approved") {
      pending += cents;
      total += cents;
    }
  }
  await supabase
    .from("affiliates")
    .update({
      total_earned_cents: total,
      pending_cents: pending,
      paid_cents: paid,
    })
    .eq("id", affiliateId);
}
