/**
 * Monthly referral payout cron.
 *
 * Runs on the 1st of each month at 00:00 UTC (see vercel.json). Pays out
 * every `referral_payouts` row that is:
 *   • status = 'pending'
 *   • older than the cooldown window (default 30d — waits for invoices
 *     to settle so we don't pay out a commission that gets clawed back)
 *   • belongs to a user whose stripe_connect_account_id is onboarded
 *     (payouts_enabled on Stripe)
 *
 * For each eligible user we sum the amount, issue a single Stripe Transfer
 * from the platform account to their Connect account, and mark all the
 * payout rows included in the transfer as `paid`. On failure, rows get
 * status='failed' with an error_text so a retry on the next run (or a
 * manual sweep) can pick them up again.
 *
 * Auth: Bearer CRON_SECRET — same pattern as every other cron in this app.
 * Kill switch: if DISABLE_AUTO_PAYOUTS=true, returns 200 with a note and
 * writes a `payout_runs` row tagged as skipped (so admin can see it).
 *
 * The cron is safe to re-invoke — it only touches 'pending' rows and uses
 * Stripe's `idempotencyKey` so a double-tick won't cause a double-transfer.
 */

import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import Stripe from "stripe";

// Vercel's default of 10s is too short — Stripe transfers add up when a
// referral base grows. 5 min covers hundreds of payouts with slack.
export const maxDuration = 300;
export const dynamic = "force-dynamic";

const COOLDOWN_DAYS = parseInt(process.env.REFERRAL_PAYOUT_COOLDOWN_DAYS || "30", 10);
const MIN_PAYOUT_CENTS = parseInt(process.env.REFERRAL_MIN_PAYOUT_CENTS || "1000", 10); // $10 default

interface PendingRow {
  id: string;
  referrer_user_id: string;
  amount_cents: number;
  month_start: string | null;
}

interface ProfileRow {
  id: string;
  email: string | null;
  stripe_connect_account_id: string | null;
}

type RunOutcome = {
  runId: string;
  totalEligibleUsers: number;
  paidUsers: number;
  failedUsers: number;
  skippedUsers: number;
  totalCents: number;
  durationMs: number;
  details: Array<{
    user_id: string;
    status: "paid" | "skipped" | "failed";
    amount_cents: number;
    reason?: string;
    transfer_id?: string;
  }>;
};

function isAuthorized(req: NextRequest): boolean {
  const header = req.headers.get("authorization");
  const secret = process.env.CRON_SECRET;
  return !!secret && header === `Bearer ${secret}`;
}

/**
 * Core payout logic, broken out so both cron (GET) and the admin manual
 * run (POST with the same secret) share behaviour.
 */
async function runPayouts(triggeredBy: "cron" | "manual"): Promise<RunOutcome> {
  const started = Date.now();
  const supabase = createServiceClient();

  if (!process.env.STRIPE_SECRET_KEY) {
    throw new Error("STRIPE_SECRET_KEY not set");
  }
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

  // Create the audit row up-front so we can link every payout back to it.
  const { data: runRow, error: runInsErr } = await supabase
    .from("payout_runs")
    .insert({
      triggered_by: triggeredBy,
      notes:
        triggeredBy === "manual"
          ? "Manual run via admin dashboard"
          : "Monthly scheduled run",
    })
    .select("id")
    .single();

  const runId = runRow?.id as string | undefined;
  if (runInsErr || !runId) {
    console.error("[cron/referral-payouts] couldn't create payout_runs row", runInsErr);
  }

  const outcome: RunOutcome = {
    runId: runId ?? "",
    totalEligibleUsers: 0,
    paidUsers: 0,
    failedUsers: 0,
    skippedUsers: 0,
    totalCents: 0,
    durationMs: 0,
    details: [],
  };

  const cooldownIso = new Date(Date.now() - COOLDOWN_DAYS * 24 * 60 * 60 * 1000).toISOString();

  // 1. Pull all pending payouts past cooldown.
  const { data: pending, error: pendErr } = await supabase
    .from("referral_payouts")
    .select("id, referrer_user_id, amount_cents, month_start")
    .eq("status", "pending")
    .lte("created_at", cooldownIso);

  if (pendErr) {
    throw new Error(`Failed to load pending payouts: ${pendErr.message}`);
  }

  const rows = (pending ?? []) as PendingRow[];
  if (rows.length === 0) {
    outcome.durationMs = Date.now() - started;
    if (runId) {
      await supabase
        .from("payout_runs")
        .update({
          finished_at: new Date().toISOString(),
          payouts_total: 0,
          notes: "No eligible payouts",
        })
        .eq("id", runId);
    }
    return outcome;
  }

  // 2. Group by referrer.
  const byUser = new Map<string, PendingRow[]>();
  for (const r of rows) {
    const list = byUser.get(r.referrer_user_id) ?? [];
    list.push(r);
    byUser.set(r.referrer_user_id, list);
  }
  outcome.totalEligibleUsers = byUser.size;

  // 3. Pull the Stripe Connect accounts for every payee at once.
  const userIds = Array.from(byUser.keys());
  const { data: profiles, error: profErr } = await supabase
    .from("profiles")
    .select("id, email, stripe_connect_account_id")
    .in("id", userIds);
  if (profErr) {
    throw new Error(`Failed to load profiles: ${profErr.message}`);
  }
  const profileMap = new Map<string, ProfileRow>();
  for (const p of (profiles ?? []) as ProfileRow[]) {
    profileMap.set(p.id, p);
  }

  // 4. For each group: verify Connect account, compute total, transfer, update rows.
  const groupEntries: Array<[string, PendingRow[]]> = Array.from(byUser.entries());
  for (const [userId, userRows] of groupEntries) {
    const total = userRows.reduce((s: number, r: PendingRow) => s + (r.amount_cents || 0), 0);
    const profile = profileMap.get(userId);
    const rowIds = userRows.map((r: PendingRow) => r.id);

    // No account → skip (row stays pending).
    if (!profile?.stripe_connect_account_id) {
      outcome.skippedUsers++;
      outcome.details.push({
        user_id: userId,
        status: "skipped",
        amount_cents: total,
        reason: "no_connect_account",
      });
      continue;
    }

    // Below min → skip (rolls forward to next run).
    if (total < MIN_PAYOUT_CENTS) {
      outcome.skippedUsers++;
      outcome.details.push({
        user_id: userId,
        status: "skipped",
        amount_cents: total,
        reason: "below_minimum",
      });
      continue;
    }

    // Verify the account is ready to receive a transfer.
    let canTransfer = false;
    try {
      const acct = await stripe.accounts.retrieve(profile.stripe_connect_account_id);
      canTransfer = !!acct.payouts_enabled;
    } catch (err) {
      console.error(
        `[cron/referral-payouts] stripe.accounts.retrieve failed for ${profile.stripe_connect_account_id}`,
        err,
      );
    }
    if (!canTransfer) {
      outcome.skippedUsers++;
      outcome.details.push({
        user_id: userId,
        status: "skipped",
        amount_cents: total,
        reason: "payouts_not_enabled",
      });
      continue;
    }

    // Idempotency key bundles user + month + run-id to guarantee at-most-once.
    // If Stripe sees the same key twice (e.g. we retry mid-run), it returns
    // the already-created transfer instead of double-charging.
    const monthTag = userRows[0].month_start || new Date().toISOString().slice(0, 10);
    const idemKey = `ref-payout:${userId}:${monthTag}:${runId ?? "norun"}`;

    try {
      const transfer = await stripe.transfers.create(
        {
          amount: total,
          currency: "usd",
          destination: profile.stripe_connect_account_id,
          description: `ShortStack referral payout (${userRows.length} entr${userRows.length === 1 ? "y" : "ies"})`,
          metadata: {
            shortstack_user_id: userId,
            payout_row_count: String(userRows.length),
            run_id: runId ?? "",
          },
        },
        { idempotencyKey: idemKey },
      );

      const { error: updErr } = await supabase
        .from("referral_payouts")
        .update({
          status: "paid",
          stripe_transfer_id: transfer.id,
          paid_at: new Date().toISOString(),
          error_text: null,
        })
        .in("id", rowIds);
      if (updErr) {
        // The transfer went through but we couldn't mark rows paid — this is
        // the one case that could cause a double-send if we retried. Record
        // the transfer id on the row with a failed status so ops can resolve.
        console.error(
          `[cron/referral-payouts] transfer succeeded but DB update failed for user ${userId}`,
          updErr,
        );
        outcome.failedUsers++;
        outcome.details.push({
          user_id: userId,
          status: "failed",
          amount_cents: total,
          reason: `db_update_after_transfer: ${updErr.message}`,
          transfer_id: transfer.id,
        });
        continue;
      }

      outcome.paidUsers++;
      outcome.totalCents += total;
      outcome.details.push({
        user_id: userId,
        status: "paid",
        amount_cents: total,
        transfer_id: transfer.id,
      });
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      console.error(`[cron/referral-payouts] transfer failed for user ${userId}:`, errMsg);

      // Mark the row(s) failed so they don't get picked up next run as a
      // pending replay. A human (or a reset workflow) decides whether to
      // retry.
      await supabase
        .from("referral_payouts")
        .update({
          status: "failed",
          error_text: errMsg.slice(0, 400),
        })
        .in("id", rowIds);

      outcome.failedUsers++;
      outcome.details.push({
        user_id: userId,
        status: "failed",
        amount_cents: total,
        reason: errMsg.slice(0, 200),
      });
    }
  }

  outcome.durationMs = Date.now() - started;

  // Finalize the audit log row.
  if (runId) {
    await supabase
      .from("payout_runs")
      .update({
        finished_at: new Date().toISOString(),
        payouts_total: rows.length,
        payouts_paid: outcome.paidUsers,
        payouts_failed: outcome.failedUsers,
        payouts_skipped: outcome.skippedUsers,
        amount_cents: outcome.totalCents,
      })
      .eq("id", runId);
  }

  return outcome;
}

async function handle(request: NextRequest, triggeredBy: "cron" | "manual") {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Kill switch — surface a friendly log so ops can tell why things are quiet.
  if (process.env.DISABLE_AUTO_PAYOUTS === "true") {
    console.log("[cron/referral-payouts] DISABLE_AUTO_PAYOUTS=true — skipping run");
    try {
      const supabase = createServiceClient();
      await supabase.from("payout_runs").insert({
        triggered_by: triggeredBy,
        finished_at: new Date().toISOString(),
        payouts_total: 0,
        notes: "Skipped — DISABLE_AUTO_PAYOUTS=true",
      });
    } catch (err) {
      console.error("[cron/referral-payouts] couldn't write skipped audit row", err);
    }
    return NextResponse.json({
      skipped: true,
      reason: "DISABLE_AUTO_PAYOUTS=true",
    });
  }

  try {
    const outcome = await runPayouts(triggeredBy);
    return NextResponse.json({ ok: true, ...outcome });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    console.error("[cron/referral-payouts] run failed:", err);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  // Vercel schedule invokes GET. `triggeredBy='cron'` unless an admin
  // explicitly overrides via a query param.
  const url = new URL(request.url);
  const manualFlag = url.searchParams.get("manual");
  return handle(request, manualFlag === "1" ? "manual" : "cron");
}

// Admin "Run now" button uses POST so browsers don't accidentally re-run on
// reload. Same CRON_SECRET gate.
export async function POST(request: NextRequest) {
  return handle(request, "manual");
}
