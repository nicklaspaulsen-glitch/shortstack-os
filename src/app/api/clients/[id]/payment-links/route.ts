/**
 * Client payment links — list & create Stripe Payment Links scoped to one
 * client on the AGENCY's connected Stripe account (NOT Trinity's platform
 * Stripe).
 *
 * GET  /api/clients/[id]/payment-links
 *      → returns all payment links for this client.
 *
 * POST /api/clients/[id]/payment-links
 *      body: { amount_cents, currency?, product_name, description? }
 *      → creates a Stripe Product + Price + Payment Link on the agency's
 *        connected account, persists it, returns the link URL.
 *
 * All Stripe API calls pass { stripeAccount: agency.stripe_account_id } so
 * the charge lives on the agency's books, not Trinity's.
 */

import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { verifyClientAccess } from "@/lib/verify-client-access";
import { getStripe } from "@/lib/stripe/client";

async function requireConnectedAccount(
  supabase: ReturnType<typeof createServerSupabase>,
  userId: string,
) {
  const { data: account } = await supabase
    .from("agency_stripe_accounts")
    .select("stripe_account_id, charges_enabled")
    .eq("user_id", userId)
    .maybeSingle();
  return account;
}

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } },
) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const access = await verifyClientAccess(supabase, user.id, params.id);
  if (access.denied) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { data: links, error } = await supabase
    .from("client_payment_links")
    .select(
      "id, stripe_payment_link_id, url, amount_cents, currency, product_name, active, created_at, expires_at",
    )
    .eq("client_id", params.id)
    .eq("agency_user_id", user.id)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[client payment-links] list error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ links: links || [] });
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const access = await verifyClientAccess(supabase, user.id, params.id);
  if (access.denied) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const account = await requireConnectedAccount(supabase, user.id);
  if (!account?.stripe_account_id) {
    return NextResponse.json(
      { error: "Connect your Stripe account first at /dashboard/settings" },
      { status: 400 },
    );
  }
  if (!account.charges_enabled) {
    return NextResponse.json(
      { error: "Your connected Stripe account isn't yet able to accept charges. Finish onboarding first." },
      { status: 400 },
    );
  }

  let body: {
    amount_cents?: number;
    currency?: string;
    product_name?: string;
    description?: string;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const amount = Math.round(Number(body.amount_cents || 0));
  if (!amount || amount < 50) {
    return NextResponse.json(
      { error: "amount_cents must be at least 50 (Stripe minimum)" },
      { status: 400 },
    );
  }
  const productName = (body.product_name || "").trim() || "Agency Services";
  const currency = (body.currency || "usd").toLowerCase();

  // Load the client so we can tag Stripe metadata with the business name.
  const { data: client } = await supabase
    .from("clients")
    .select("business_name, email")
    .eq("id", params.id)
    .single();

  const connectOpts = { stripeAccount: account.stripe_account_id };

  try {
    const stripe = getStripe();
    // Create a fresh Product + Price on the connected account for each link.
    // Reusing a Price across links is fine but gets messy with different
    // amounts — per-link Products keeps things simple and auditable.
    const product = await stripe.products.create(
      {
        name: productName,
        description: body.description || undefined,
        metadata: {
          shortstack_client_id: params.id,
          shortstack_agency_user_id: user.id,
          shortstack_client_name: client?.business_name || "",
        },
      },
      connectOpts,
    );

    const price = await stripe.prices.create(
      {
        product: product.id,
        unit_amount: amount,
        currency,
      },
      connectOpts,
    );

    const link = await stripe.paymentLinks.create(
      {
        line_items: [{ price: price.id, quantity: 1 }],
        metadata: {
          shortstack_client_id: params.id,
          shortstack_agency_user_id: user.id,
        },
      },
      connectOpts,
    );

    const { data: inserted, error: insertErr } = await supabase
      .from("client_payment_links")
      .insert({
        agency_user_id: user.id,
        client_id: params.id,
        stripe_payment_link_id: link.id,
        url: link.url,
        amount_cents: amount,
        currency,
        product_name: productName,
        active: link.active,
      })
      .select()
      .single();

    if (insertErr) {
      console.error("[client payment-links] insert error:", insertErr);
      return NextResponse.json({ error: insertErr.message }, { status: 500 });
    }

    return NextResponse.json({ link: inserted, url: link.url });
  } catch (err) {
    console.error("[client payment-links] stripe error:", err);
    const message = err instanceof Error ? err.message : "Failed to create payment link";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
