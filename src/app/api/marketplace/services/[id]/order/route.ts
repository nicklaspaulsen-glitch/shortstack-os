/**
 * POST /api/marketplace/services/[id]/order
 *
 * Buyer initiates an order for a service.  We:
 *
 *   1) Look up the service + verify it's active.
 *   2) Look up the seller's connected Stripe account.  If they don't have
 *      one we 409 — they need to onboard before they can sell.
 *   3) Compute the platform fee using the seller's white_label_config.
 *      ShortStack default is 10%.
 *   4) Insert a `marketplace_orders` row in `pending_payment`.
 *   5) Create a Stripe Checkout Session (Connect destination charges) so
 *      the buyer pays Trinity, Stripe automatically routes the seller
 *      payout, and Stripe captures the application_fee for ShortStack.
 *   6) Return the Checkout URL.
 *
 * On success-redirect the existing /api/webhooks/stripe-connect handler
 * (or a future /api/webhooks/marketplace handler) flips status -> 'paid'.
 * For now the page-success param triggers a client-side reconcile call.
 *
 * Body (optional): { buyer_notes?: string }
 */

import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { getStripe } from "@/lib/stripe/client";

interface OrderBody {
  buyer_notes?: unknown;
}

function isUuid(s: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);
}

function resolveBaseUrl(request: NextRequest): string | null {
  const candidates = [
    process.env.NEXT_PUBLIC_APP_URL,
    process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null,
    (() => {
      try {
        return new URL(request.url).origin;
      } catch {
        return null;
      }
    })(),
    "https://app.shortstack.work",
  ];
  for (const c of candidates) {
    if (!c) continue;
    try {
      const u = new URL(c.startsWith("http") ? c : `https://${c}`);
      if (u.protocol === "http:" || u.protocol === "https:") return u.origin;
    } catch {
      /* try next */
    }
  }
  return null;
}

function clampFeePct(raw: unknown): number {
  const n = Number(raw ?? 10);
  if (!Number.isFinite(n)) return 10;
  return Math.max(0, Math.min(30, n));
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  if (!isUuid(params.id)) {
    return NextResponse.json({ error: "Invalid service id" }, { status: 400 });
  }

  const supabase = createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: OrderBody = {};
  try {
    body = (await request.json()) as OrderBody;
  } catch {
    // empty body is fine
  }

  const buyerNotes =
    typeof body.buyer_notes === "string" ? body.buyer_notes.trim().slice(0, 2000) : null;

  // 1) Service lookup — explicitly require active so closed/paused listings
  // can't be ordered.  RLS would already enforce this for anon callers.
  const { data: service, error: serviceErr } = await supabase
    .from("marketplace_services")
    .select(
      "id, user_id, title, price_cents, currency, delivery_days, status",
    )
    .eq("id", params.id)
    .maybeSingle();

  if (serviceErr) {
    console.error("[marketplace/order] service lookup error", serviceErr);
    return NextResponse.json({ error: "Failed to load service" }, { status: 500 });
  }
  if (!service) {
    return NextResponse.json({ error: "Service not found" }, { status: 404 });
  }
  if (service.status !== "active") {
    return NextResponse.json(
      { error: `Service is ${service.status}, not orderable` },
      { status: 409 },
    );
  }
  if (service.user_id === user.id) {
    return NextResponse.json(
      { error: "You can't buy your own service" },
      { status: 400 },
    );
  }

  // 2) Seller's Stripe Connect account.
  const { data: sellerAccount } = await supabase
    .from("agency_stripe_accounts")
    .select("stripe_account_id, charges_enabled, details_submitted")
    .eq("user_id", service.user_id)
    .maybeSingle();

  if (
    !sellerAccount?.stripe_account_id ||
    !sellerAccount.charges_enabled ||
    !sellerAccount.details_submitted
  ) {
    return NextResponse.json(
      {
        error:
          "Seller has not finished Stripe Connect onboarding yet — they can't accept payments.",
      },
      { status: 409 },
    );
  }

  // 3) Compute platform fee.  Look up seller's marketplace_fee_pct (the row
  // is per-user, defaulting to 10).  This lets us white-label per-agency.
  const { data: feeRow } = await supabase
    .from("white_label_config")
    .select("marketplace_fee_pct")
    .eq("user_id", service.user_id)
    .maybeSingle();
  const feePct = clampFeePct(feeRow?.marketplace_fee_pct);
  const amountCents = service.price_cents;
  const shortstackFeeCents = Math.round(amountCents * (feePct / 100));
  const sellerPayoutCents = amountCents - shortstackFeeCents;

  // 4) Insert pending order.
  const { data: order, error: orderErr } = await supabase
    .from("marketplace_orders")
    .insert({
      service_id: service.id,
      buyer_user_id: user.id,
      seller_user_id: service.user_id,
      amount_cents: amountCents,
      shortstack_fee_cents: shortstackFeeCents,
      seller_payout_cents: sellerPayoutCents,
      currency: service.currency,
      status: "pending_payment",
      buyer_notes: buyerNotes,
    })
    .select(
      "id, service_id, buyer_user_id, seller_user_id, amount_cents, shortstack_fee_cents, seller_payout_cents, currency, status",
    )
    .single();

  if (orderErr || !order) {
    console.error("[marketplace/order] insert error", orderErr);
    return NextResponse.json({ error: "Failed to create order" }, { status: 500 });
  }

  // 5) Stripe Checkout — Connect destination charges with application fee.
  const baseUrl = resolveBaseUrl(request);
  if (!baseUrl) {
    return NextResponse.json(
      { error: "Server couldn't resolve base URL" },
      { status: 500 },
    );
  }

  try {
    const stripe = getStripe();
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: service.currency,
            unit_amount: amountCents,
            product_data: {
              name: service.title,
              description: `Marketplace order ${order.id.slice(0, 8)}`,
            },
          },
        },
      ],
      payment_intent_data: {
        application_fee_amount: shortstackFeeCents,
        transfer_data: {
          destination: sellerAccount.stripe_account_id,
        },
        metadata: {
          marketplace_order_id: order.id,
          service_id: service.id,
          buyer_user_id: user.id,
          seller_user_id: service.user_id,
        },
      },
      metadata: {
        marketplace_order_id: order.id,
        service_id: service.id,
        buyer_user_id: user.id,
        seller_user_id: service.user_id,
      },
      success_url: `${baseUrl}/dashboard/marketplace/orders/${order.id}?paid=1`,
      cancel_url: `${baseUrl}/marketplace/${service.id}?cancelled=1`,
    });

    if (!session.url) {
      return NextResponse.json(
        { error: "Stripe did not return a checkout URL" },
        { status: 500 },
      );
    }

    // Persist the checkout session id so the webhook (or manual reconcile)
    // can match it back to this order.
    await supabase
      .from("marketplace_orders")
      .update({
        stripe_checkout_session_id: session.id,
        updated_at: new Date().toISOString(),
      })
      .eq("id", order.id);

    return NextResponse.json({
      order_id: order.id,
      checkout_url: session.url,
      url: session.url,
    });
  } catch (err) {
    console.error("[marketplace/order] stripe error", err);
    const message =
      err instanceof Error ? err.message : "Failed to create checkout session";
    // Best-effort: mark order cancelled so we don't leak ghosts.
    await supabase
      .from("marketplace_orders")
      .update({ status: "cancelled", updated_at: new Date().toISOString() })
      .eq("id", order.id);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
