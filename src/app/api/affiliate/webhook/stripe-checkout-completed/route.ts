/**
 * Affiliate Stripe webhook — promotes 'signed_up' affiliate_referrals to
 * 'subscribed' and writes a 'pending' commission row when the platform's
 * Stripe sends a `checkout.session.completed` event for a subscription
 * whose customer corresponds to one of our referred users.
 *
 * Register at: https://dashboard.stripe.com/webhooks
 *   URL:    https://app.shortstack.work/api/affiliate/webhook/stripe-checkout-completed
 *   Events: checkout.session.completed, invoice.paid
 *
 * The webhook secret is reused from STRIPE_AFFILIATE_WEBHOOK_SECRET (preferred)
 * and falls back to the existing STRIPE_BILLING_WEBHOOK_SECRET / STRIPE_WEBHOOK_SECRET
 * so a single registered webhook can dispatch into multiple handlers.
 */
import { NextRequest, NextResponse } from "next/server";
import { type Stripe } from "stripe";
import { createServiceClient } from "@/lib/supabase/server";
import { getStripe } from "@/lib/stripe/client";
import { claimEvent, completeEvent } from "@/lib/webhooks/idempotency";
import { calculateCommissionCents, type CommissionType } from "@/lib/affiliate";

export const dynamic = "force-dynamic";

const PROVIDER = "stripe-affiliate";

export async function POST(request: NextRequest) {
  const secret =
    process.env.STRIPE_AFFILIATE_WEBHOOK_SECRET ||
    process.env.STRIPE_BILLING_WEBHOOK_SECRET ||
    process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) {
    console.error(
      "[affiliate/webhook] STRIPE_AFFILIATE_WEBHOOK_SECRET (or fallbacks) is not set — rejecting request.",
    );
    return NextResponse.json({ error: "Webhook not configured" }, { status: 503 });
  }

  const body = await request.text();
  const sig = request.headers.get("stripe-signature");
  if (!sig) return NextResponse.json({ error: "No signature" }, { status: 400 });

  let event: Stripe.Event;
  try {
    const stripe = getStripe();
    event = stripe.webhooks.constructEvent(body, sig, secret);
  } catch {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  const supabase = createServiceClient();

  const claim = await claimEvent(supabase, PROVIDER, event.id);
  if (claim === "already_done") return NextResponse.json({ ok: true, deduped: true });
  if (claim === "in_flight") return NextResponse.json({ ok: true, in_flight: true });

  try {
    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;
      await handleCheckoutCompleted(supabase, session);
    } else if (event.type === "invoice.paid") {
      const invoice = event.data.object as Stripe.Invoice;
      await handleInvoicePaid(supabase, invoice);
    }
    await completeEvent(supabase, PROVIDER, event.id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[affiliate/webhook] processing error:", err);
    // Leave the row in 'processing' so Stripe retries hit the stale-claim branch.
    return NextResponse.json({ error: "Processing failed" }, { status: 500 });
  }
}

/**
 * On checkout.session.completed for a subscription, attribute the buyer to
 * the most recent 'signed_up' or 'clicked' affiliate referral and create a
 * pending commission. Falls back to email-match if customer metadata
 * doesn't have a shortstack_user_id.
 */
async function handleCheckoutCompleted(
  supabase: ReturnType<typeof createServiceClient>,
  session: Stripe.Checkout.Session,
) {
  if (session.mode !== "subscription") return;

  const customerEmail = session.customer_details?.email?.toLowerCase() ?? null;
  const customerUserId =
    typeof session.metadata?.shortstack_user_id === "string"
      ? session.metadata.shortstack_user_id
      : null;
  const amountCents = session.amount_total ?? 0;
  const currency = (session.currency || "usd").toLowerCase();

  // Look for an attributed referral. Prefer matching the user_id stored in
  // session metadata (set by the checkout creation route).
  let referral: { id: string; affiliate_id: string; status: string } | null = null;
  if (customerUserId) {
    const { data } = await supabase
      .from("affiliate_referrals")
      .select("id, affiliate_id, status")
      .eq("referred_user_id", customerUserId)
      .in("status", ["signed_up", "clicked"])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    referral = data;
  }
  if (!referral && customerEmail) {
    const { data } = await supabase
      .from("affiliate_referrals")
      .select("id, affiliate_id, status")
      .eq("referred_email", customerEmail)
      .in("status", ["signed_up", "clicked"])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    referral = data;
  }
  if (!referral) return; // no attribution, nothing to do

  // Resolve the program terms via the affiliate's program.
  const { data: aff } = await supabase
    .from("affiliates")
    .select("id, program_id, status, affiliate_programs ( commission_type, commission_value, status )")
    .eq("id", referral.affiliate_id)
    .maybeSingle();
  if (!aff || aff.status === "suspended" || aff.status === "rejected") return;
  const programRel = aff.affiliate_programs;
  const program = Array.isArray(programRel) ? programRel[0] : programRel;
  if (!program || program.status !== "active") return;

  // Mark referral subscribed.
  await supabase
    .from("affiliate_referrals")
    .update({
      status: "subscribed",
      conversion_at: new Date().toISOString(),
      ...(customerUserId ? { referred_user_id: customerUserId } : {}),
      ...(customerEmail ? { referred_email: customerEmail } : {}),
    })
    .eq("id", referral.id);

  const commissionCents = calculateCommissionCents(
    amountCents,
    program.commission_type as CommissionType,
    Number(program.commission_value),
  );
  if (commissionCents <= 0) return;

  await supabase.from("affiliate_commissions").insert({
    affiliate_id: aff.id,
    referral_id: referral.id,
    amount_cents: commissionCents,
    currency,
    status: "pending",
  });

  // Update affiliate cached pending total.
  await bumpAffiliateTotals(supabase, aff.id);
}

/**
 * On invoice.paid (recurring renewal), credit a recurring commission row if
 * the customer was originally referred and the program is configured for
 * percentage-style payout. Flat-fee programs are intentionally one-time.
 */
async function handleInvoicePaid(
  supabase: ReturnType<typeof createServiceClient>,
  invoice: Stripe.Invoice,
) {
  // Skip non-subscription invoices. Stripe SDK v17+ moved subscription off
  // the top-level Invoice type; we look it up via a runtime cast since the
  // field is still present on the wire payload.
  const subscriptionId = (invoice as unknown as { subscription?: string | null }).subscription;
  if (!subscriptionId) return;
  const customer = invoice.customer;
  if (typeof customer !== "string") return;
  const amountCents = invoice.amount_paid ?? 0;
  if (amountCents <= 0) return;

  // Find the user behind this customer.
  const { data: profile } = await supabase
    .from("profiles")
    .select("id, email")
    .eq("stripe_customer_id", customer)
    .maybeSingle();
  if (!profile) return;

  const { data: referral } = await supabase
    .from("affiliate_referrals")
    .select("id, affiliate_id, status")
    .eq("referred_user_id", profile.id)
    .eq("status", "subscribed")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!referral) return;

  const { data: aff } = await supabase
    .from("affiliates")
    .select("id, status, affiliate_programs ( commission_type, commission_value, status )")
    .eq("id", referral.affiliate_id)
    .maybeSingle();
  if (!aff || aff.status === "suspended") return;
  const programRel = aff.affiliate_programs;
  const program = Array.isArray(programRel) ? programRel[0] : programRel;
  if (!program || program.status !== "active") return;

  // Recurring commissions only fire for percentage-style programs.
  if (program.commission_type !== "percentage") return;

  const commissionCents = calculateCommissionCents(
    amountCents,
    "percentage",
    Number(program.commission_value),
  );
  if (commissionCents <= 0) return;

  await supabase.from("affiliate_commissions").insert({
    affiliate_id: aff.id,
    referral_id: referral.id,
    amount_cents: commissionCents,
    currency: (invoice.currency || "usd").toLowerCase(),
    status: "pending",
  });

  await bumpAffiliateTotals(supabase, aff.id);
}

/**
 * Recompute the affiliate's cached total_earned / pending / paid totals
 * from the underlying commissions rows. Cheap to run after every commission
 * write — the row count per affiliate stays small.
 */
async function bumpAffiliateTotals(
  supabase: ReturnType<typeof createServiceClient>,
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
