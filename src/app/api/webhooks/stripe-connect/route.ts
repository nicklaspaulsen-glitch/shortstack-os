/**
 * Stripe Connect webhook — receives events that happen on the AGENCIES'
 * connected accounts (not Trinity's platform account). Separate from
 * /api/billing/webhook which handles Trinity-subscription events.
 *
 * Register at: https://dashboard.stripe.com/webhooks → select "Events on
 * Connected accounts" → add endpoint URL:
 *   https://app.shortstack.work/api/webhooks/stripe-connect
 *
 * Events of interest:
 *   invoice.paid         — mark client_invoices paid
 *   invoice.voided       — mark invoice voided
 *   invoice.finalized    — sync finalized state (optional)
 *   payment_link.*       — keep client_payment_links.active in sync
 *   account.updated      — refresh agency_stripe_accounts flags
 *   charge.refunded      — log refund against the matching invoice
 *
 * Verification uses STRIPE_CONNECT_WEBHOOK_SECRET (distinct from
 * STRIPE_BILLING_WEBHOOK_SECRET and STRIPE_WEBHOOK_SECRET).
 *
 * IMPORTANT: every Connect event carries an `account` field identifying which
 * connected account it came from. We look up the agency via
 * agency_stripe_accounts.stripe_account_id === event.account.
 */

import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { type Stripe } from "stripe";
import { getStripe } from "@/lib/stripe/client";
import { claimEvent, completeEvent } from "@/lib/webhooks/idempotency";

export async function POST(request: NextRequest) {
  // Fail-closed: if the secret env var is missing the route must return 503.
  // Stripe's constructEvent accepts any attacker-forged HMAC-SHA256 payload
  // when the secret argument is the empty string — verified empirically
  // (sec/batch-4). A missing secret always indicates a misconfigured deployment.
  const stripeConnectSecret = process.env.STRIPE_CONNECT_WEBHOOK_SECRET;
  if (!stripeConnectSecret) {
    console.error(
      "[stripe-connect webhook] STRIPE_CONNECT_WEBHOOK_SECRET is not set — rejecting request. Configure the secret in Vercel to enable signature verification.",
    );
    return NextResponse.json(
      { error: "Webhook not configured" },
      { status: 503 },
    );
  }

  const body = await request.text();
  const sig = request.headers.get("stripe-signature");

  if (!sig) return NextResponse.json({ error: "No signature" }, { status: 400 });

  const stripe = getStripe();
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, stripeConnectSecret);
  } catch (err) {
    console.error("[stripe-connect webhook] signature verification failed:", err);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  const supabase = createServiceClient();

  // CRITICAL idempotency — claim/complete model. See helper for details.
  const claim = await claimEvent(supabase, "stripe_connect", event.id);
  if (claim === "already_done") {
    return NextResponse.json({ ok: true, deduped: true, event_id: event.id });
  }
  if (claim === "in_flight") {
    return NextResponse.json({ ok: true, deduped: true, in_flight: true, event_id: event.id });
  }

  const connectedAccountId = event.account; // undefined for platform-level events

  // All events we care about here come from a connected account. Ignore
  // platform-only events (they belong to the Trinity subscription webhook).
  // Mark complete so the row doesn't churn through stale reclaims every
  // 5 minutes — there's no work to do, this is a final state.
  if (!connectedAccountId) {
    await completeEvent(supabase, "stripe_connect", event.id);
    return NextResponse.json({ received: true, ignored: "no_account_field" });
  }

  // Find the owning agency.
  const { data: agency } = await supabase
    .from("agency_stripe_accounts")
    .select("user_id, stripe_account_id")
    .eq("stripe_account_id", connectedAccountId)
    .maybeSingle();

  if (!agency) {
    // Webhook from an account we no longer track (e.g. post-disconnect).
    // Same as above — terminal state, mark complete.
    await completeEvent(supabase, "stripe_connect", event.id);
    return NextResponse.json({ received: true, ignored: "unknown_account" });
  }

  switch (event.type) {
    // ── Invoice paid ─────────────────────────────────────────────
    case "invoice.paid": {
      const invoice = event.data.object as Stripe.Invoice;
      if (invoice.id) {
        await supabase
          .from("client_invoices")
          .update({
            status: "paid",
            paid_at: new Date().toISOString(),
            amount_cents: invoice.amount_paid || invoice.amount_due || undefined,
          })
          .eq("agency_user_id", agency.user_id)
          .eq("agency_stripe_invoice_id", invoice.id);
      }

      // Telegram ping to the AGENCY owner (not the global ops chat — those go
      // via /api/billing/webhook). Here we only log to trinity_log so the
      // agency can see income in their own dashboard.
      await supabase.from("trinity_log").insert({
        action_type: "custom",
        description: `Client paid: ${((invoice.amount_paid || 0) / 100).toFixed(2)} ${invoice.currency?.toUpperCase() || ""}`,
        user_id: agency.user_id,
        status: "completed",
        result: {
          type: "agency_client_invoice_paid",
          stripe_invoice_id: invoice.id,
          connected_account: connectedAccountId,
          amount: (invoice.amount_paid || 0) / 100,
        },
      });
      break;
    }

    case "invoice.voided":
    case "invoice.marked_uncollectible": {
      const invoice = event.data.object as Stripe.Invoice;
      if (invoice.id) {
        await supabase
          .from("client_invoices")
          .update({ status: event.type === "invoice.voided" ? "void" : "uncollectible" })
          .eq("agency_user_id", agency.user_id)
          .eq("agency_stripe_invoice_id", invoice.id);
      }
      break;
    }

    case "invoice.finalized": {
      const invoice = event.data.object as Stripe.Invoice;
      if (invoice.id) {
        await supabase
          .from("client_invoices")
          .update({
            status: invoice.status || "open",
            hosted_invoice_url: invoice.hosted_invoice_url || null,
          })
          .eq("agency_user_id", agency.user_id)
          .eq("agency_stripe_invoice_id", invoice.id);
      }
      break;
    }

    // ── Payment link events ──────────────────────────────────────
    case "payment_link.created":
    case "payment_link.updated": {
      const link = event.data.object as Stripe.PaymentLink;
      await supabase
        .from("client_payment_links")
        .update({ active: link.active, url: link.url })
        .eq("agency_user_id", agency.user_id)
        .eq("stripe_payment_link_id", link.id);
      break;
    }

    // ── Account updated (onboarding progress, capability changes) ─
    case "account.updated": {
      const account = event.data.object as Stripe.Account;
      await supabase
        .from("agency_stripe_accounts")
        .update({
          charges_enabled: !!account.charges_enabled,
          payouts_enabled: !!account.payouts_enabled,
          details_submitted: !!account.details_submitted,
          country: account.country || null,
          default_currency: account.default_currency || null,
          business_name:
            account.business_profile?.name ||
            (account.settings?.dashboard?.display_name as string | undefined) ||
            undefined,
        })
        .eq("user_id", agency.user_id);
      break;
    }

    // ── Refund ───────────────────────────────────────────────────
    case "charge.refunded": {
      // Stripe v22 removed the `invoice` field from the typed Charge, but the
      // API still expands it. Read through a loose type to avoid coupling to
      // SDK internals.
      const charge = event.data.object as Stripe.Charge & { invoice?: string | null };
      const invoiceId = typeof charge.invoice === "string" ? charge.invoice : null;
      if (invoiceId) {
        await supabase
          .from("client_invoices")
          .update({ status: "refunded" })
          .eq("agency_user_id", agency.user_id)
          .eq("agency_stripe_invoice_id", invoiceId);
      }

      await supabase.from("trinity_log").insert({
        action_type: "custom",
        description: `Refund: ${((charge.amount_refunded || 0) / 100).toFixed(2)} ${charge.currency?.toUpperCase() || ""}`,
        user_id: agency.user_id,
        status: "completed",
        result: {
          type: "agency_charge_refunded",
          stripe_charge_id: charge.id,
          connected_account: connectedAccountId,
          amount: (charge.amount_refunded || 0) / 100,
        },
      });
      break;
    }
  }

  // Mark event done so retries see status='done' and short-circuit.
  await completeEvent(supabase, "stripe_connect", event.id);
  return NextResponse.json({ received: true });
}
