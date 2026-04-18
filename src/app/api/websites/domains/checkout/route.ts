import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import Stripe from "stripe";
import { computeMonthlyPrice, computeYearlyPrice } from "@/lib/domain-pricing";

/**
 * Create a Stripe Checkout session for a domain purchase.
 *
 * Client pays a monthly or yearly subscription; when the session completes,
 * the Stripe webhook (/api/billing/webhook) calls the auto-configure endpoint
 * which (a) purchases the domain via GoDaddy and (b) attaches it to the
 * client's Vercel project. The client never touches DNS.
 *
 * Body: { domain, billing_cycle: "monthly"|"yearly", project_id?, base_price? }
 * Returns: { url } — redirect the browser here to start checkout
 */

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "");

export async function POST(request: NextRequest) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const {
    domain,
    billing_cycle = "monthly",
    project_id,
    base_price = 12.99,
  } = body as {
    domain: string;
    billing_cycle?: "monthly" | "yearly";
    project_id?: string;
    base_price?: number;
  };

  if (!domain) {
    return NextResponse.json({ error: "domain required" }, { status: 400 });
  }
  if (!process.env.STRIPE_SECRET_KEY) {
    return NextResponse.json({
      error: "Stripe not configured. Add STRIPE_SECRET_KEY to environment.",
      missing_env: ["STRIPE_SECRET_KEY"],
    }, { status: 500 });
  }

  const monthlyPrice = computeMonthlyPrice(base_price);
  const yearlyPrice = computeYearlyPrice(monthlyPrice);
  const unitAmount = billing_cycle === "yearly" ? yearlyPrice * 100 : monthlyPrice * 100;
  const interval = billing_cycle === "yearly" ? "year" : "month";

  // Derive a success/cancel URL from the request
  const origin = request.headers.get("origin")
    || process.env.NEXT_PUBLIC_APP_URL
    || "https://shortstack-os.vercel.app";

  try {
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      payment_method_types: ["card"],
      line_items: [{
        price_data: {
          currency: "usd",
          recurring: { interval },
          product_data: {
            name: `Custom domain: ${domain}`,
            description: `Includes domain registration, SSL, DNS management, and hosting on ShortStack OS.`,
          },
          unit_amount: unitAmount,
        },
        quantity: 1,
      }],
      customer_email: user.email || undefined,
      client_reference_id: user.id,
      metadata: {
        type: "domain_purchase",
        domain,
        billing_cycle,
        project_id: project_id || "",
        user_id: user.id,
      },
      subscription_data: {
        metadata: {
          type: "domain_subscription",
          domain,
          project_id: project_id || "",
          user_id: user.id,
        },
      },
      success_url: `${origin}/dashboard/domains?purchase=success&domain=${encodeURIComponent(domain)}&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/dashboard/domains?purchase=cancelled`,
    });

    // Pre-create a domain row with status "pending_payment" so the UI can track it
    await supabase
      .from("website_domains")
      .upsert({
        profile_id: user.id,
        website_id: project_id || null,
        domain,
        status: "pending_payment",
        stripe_checkout_session_id: session.id,
        purchase_price: billing_cycle === "yearly" ? yearlyPrice : monthlyPrice,
        purchase_currency: "USD",
        dns_records: [],
      }, { onConflict: "profile_id,domain" });

    return NextResponse.json({
      success: true,
      url: session.url,
      session_id: session.id,
      pricing: {
        monthly: monthlyPrice,
        yearly: yearlyPrice,
        cycle: billing_cycle,
        amount_charged_now: billing_cycle === "yearly" ? yearlyPrice : monthlyPrice,
      },
    });
  } catch (err) {
    return NextResponse.json({
      error: err instanceof Error ? err.message : "Stripe checkout failed",
    }, { status: 500 });
  }
}
