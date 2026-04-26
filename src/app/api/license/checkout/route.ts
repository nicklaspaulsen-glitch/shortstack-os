/**
 * Security fixes (service-client-audit.md — HIGH):
 *
 * 1. Validate `tier` against the known enum (PRICE_MAP keys) before any Stripe
 *    call — previously an unknown tier fell through after the guard because the
 *    guard checked `!PRICE_MAP[tier]` which is falsy for undefined price IDs
 *    supplied via env but not set, not for truly unknown tiers. Made explicit.
 *
 * 2. Validate email format with a basic RFC-5321 pattern before issuing a
 *    Stripe customer lookup (avoids pollution of Stripe customer list).
 *
 * 3. Added Supabase-backed IP rate limiting (5 checkout initiations/min) to
 *    prevent automated bulk license pre-creation.
 */

import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { type Stripe } from "stripe";
import { getStripe } from "@/lib/stripe/client";
import crypto from "crypto";
import { checkRateLimit, extractIp } from "@/lib/server/rate-limit";

// Stripe price IDs for license tiers. Hardcoded prod values are kept as
// fallbacks so existing deploys keep working with no env change, but they
// can be overridden per-environment via STRIPE_PRICE_* envs (e.g. point
// staging at test-mode price IDs without a code deploy).
//
// Codex round-3 catch: tier enum must match the public /pricing page
// (`Starter | Growth | Pro | Business | Unlimited`) AND the licenses
// schema's tier comment. Previous version had `enterprise` (unmatched
// anywhere) and was missing pro/business/unlimited (rejected as invalid
// when callers passed them).
const PRICE_MAP: Record<string, string> = {
  starter: process.env.STRIPE_PRICE_STARTER || "price_1TJ0DEBk5Rfdf2oOfoZOfain",
  growth: process.env.STRIPE_PRICE_GROWTH || "price_1TJ0DFBk5Rfdf2oOfnMEtM6o",
  pro: process.env.STRIPE_PRICE_PRO || "",
  business: process.env.STRIPE_PRICE_BUSINESS || "",
  unlimited: process.env.STRIPE_PRICE_UNLIMITED || "",
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

const KNOWN_TIERS = Object.keys(PRICE_MAP) as ReadonlyArray<string>;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// POST: Create a Stripe Checkout session for a license purchase
export async function POST(request: NextRequest) {
  // IP rate-limit before parsing body.
  const ip = extractIp(request);
  const rlClient = createServiceClient();
  const rl = await checkRateLimit(rlClient, `ip:${ip}`, "license_checkout", 5);
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Too many requests. Try again shortly." },
      {
        status: 429,
        headers: rl.retryAfterSec > 0 ? { "Retry-After": String(rl.retryAfterSec) } : {},
      },
    );
  }

  const body = await request.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  const { tier, email } = body as { tier?: string; email?: string };

  const tierLower = tier?.toLowerCase();
  if (!tierLower || !KNOWN_TIERS.includes(tierLower)) {
    return NextResponse.json(
      { error: `Invalid tier. Must be one of: ${KNOWN_TIERS.join(", ")}` },
      { status: 400 },
    );
  }
  // Reject tiers that exist in the enum but have no Stripe price configured
  // (so STRIPE_PRICE_PRO/BUSINESS/UNLIMITED env vars must be set in
  // production before those tiers can be sold).
  const priceId = PRICE_MAP[tierLower];
  if (!priceId) {
    return NextResponse.json(
      { error: `Tier "${tierLower}" is not yet configured for purchase. Contact support.` },
      { status: 400 },
    );
  }

  if (!email) {
    return NextResponse.json({ error: "Email required" }, { status: 400 });
  }

  if (!EMAIL_RE.test(String(email).trim())) {
    return NextResponse.json({ error: "Invalid email address" }, { status: 400 });
  }

  // Generate a license key upfront
  const licenseKey = generateLicenseKey();

  try {
    const stripe = getStripe();
    // Create or find Stripe customer
    const customers = await stripe.customers.list({ email, limit: 1 });
    let customer: Stripe.Customer;
    if (customers.data.length > 0) {
      customer = customers.data[0];
    } else {
      customer = await stripe.customers.create({ email });
    }

    // Create checkout session — uses normalised lowercase tier + price
    // resolved earlier (rejects tiers without a configured Stripe price).
    const session = await stripe.checkout.sessions.create({
      customer: customer.id,
      mode: "subscription",
      payment_method_types: ["card"],
      line_items: [{ price: priceId, quantity: 1 }],
      subscription_data: {
        trial_period_days: 14,
        metadata: { license_key: licenseKey, tier: tierLower },
      },
      metadata: { license_key: licenseKey, tier: tierLower, email },
      success_url: `${process.env.NEXT_PUBLIC_APP_URL || "https://app.shortstack.work"}/dashboard/settings?license=${licenseKey}&activated=true`,
      cancel_url: `${process.env.NEXT_PUBLIC_APP_URL || "https://app.shortstack.work"}/dashboard/settings?cancelled=true`,
    });

    // Pre-create the license in DB (pending until webhook confirms payment)
    const supabase = createServiceClient();
    await supabase.from("licenses").insert({
      license_key: licenseKey,
      email,
      tier: tierLower,
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
