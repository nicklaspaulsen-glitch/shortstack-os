import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import Stripe from "stripe";
import crypto from "crypto";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "");

const PRICE_MAP: Record<string, string> = {
  starter: "price_1TJ0DEBk5Rfdf2oOfoZOfain",
  growth: "price_1TJ0DFBk5Rfdf2oOfnMEtM6o",
  enterprise: "price_1TJ0DFBk5Rfdf2oOoVf51J0J",
};

function generateLicenseKey(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const segments = [];
  for (let s = 0; s < 4; s++) {
    let seg = "";
    for (let i = 0; i < 4; i++) {
      seg += chars[crypto.randomInt(chars.length)];
    }
    segments.push(seg);
  }
  return segments.join("-");
}

// POST: Create a Stripe Checkout session for a license purchase
export async function POST(request: NextRequest) {
  const { tier, email } = await request.json();

  if (!tier || !PRICE_MAP[tier]) {
    return NextResponse.json({ error: "Invalid tier. Must be: starter, growth, or enterprise" }, { status: 400 });
  }

  if (!email) {
    return NextResponse.json({ error: "Email required" }, { status: 400 });
  }

  // Generate a license key upfront
  const licenseKey = generateLicenseKey();

  try {
    // Create or find Stripe customer
    const customers = await stripe.customers.list({ email, limit: 1 });
    let customer: Stripe.Customer;
    if (customers.data.length > 0) {
      customer = customers.data[0];
    } else {
      customer = await stripe.customers.create({ email });
    }

    // Create checkout session
    const session = await stripe.checkout.sessions.create({
      customer: customer.id,
      mode: "subscription",
      payment_method_types: ["card"],
      line_items: [{ price: PRICE_MAP[tier], quantity: 1 }],
      subscription_data: {
        trial_period_days: 14,
        metadata: { license_key: licenseKey, tier },
      },
      metadata: { license_key: licenseKey, tier, email },
      success_url: `${process.env.NEXT_PUBLIC_APP_URL || "https://shortstack-os.vercel.app"}/dashboard/settings?license=${licenseKey}&activated=true`,
      cancel_url: `${process.env.NEXT_PUBLIC_APP_URL || "https://shortstack-os.vercel.app"}/dashboard/settings?cancelled=true`,
    });

    // Pre-create the license in DB (pending until webhook confirms payment)
    const supabase = createServiceClient();
    await supabase.from("licenses").insert({
      license_key: licenseKey,
      email,
      tier,
      status: "trial",
      stripe_customer_id: customer.id,
      expires_at: new Date(Date.now() + 14 * 86400000).toISOString(),
      metadata: { checkout_session_id: session.id },
    });

    return NextResponse.json({
      success: true,
      checkout_url: session.url,
      license_key: licenseKey,
    });
  } catch (err) {
    console.error("License checkout error:", err);
    return NextResponse.json({ error: "Failed to create checkout session. Please try again." }, { status: 500 });
  }
}
