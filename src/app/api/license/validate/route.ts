import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "");

// POST: Validate + activate a license key from the desktop app
export async function POST(request: NextRequest) {
  const { license_key, email, machine_id } = await request.json();

  if (!license_key) {
    return NextResponse.json({ valid: false, error: "License key required" }, { status: 400 });
  }

  const supabase = createServiceClient();

  // Look up the license
  const { data: license, error } = await supabase
    .from("licenses")
    .select("*")
    .eq("license_key", license_key.toUpperCase())
    .single();

  if (error || !license) {
    return NextResponse.json({ valid: false, error: "Invalid license key" }, { status: 404 });
  }

  // Check status
  if (license.status === "revoked") {
    return NextResponse.json({ valid: false, error: "License has been revoked" }, { status: 403 });
  }

  if (license.status === "expired") {
    return NextResponse.json({ valid: false, error: "License has expired" }, { status: 403 });
  }

  // Check expiry
  if (license.expires_at && new Date(license.expires_at) < new Date()) {
    await supabase.from("licenses").update({ status: "expired" }).eq("id", license.id);
    return NextResponse.json({ valid: false, error: "License has expired" }, { status: 403 });
  }

  // Check email matches (only if email was provided)
  if (email && license.email.toLowerCase() !== email.toLowerCase()) {
    return NextResponse.json({ valid: false, error: "Email does not match license" }, { status: 403 });
  }

  // If subscription-based, verify with Stripe
  if (license.stripe_subscription_id) {
    try {
      const sub = await stripe.subscriptions.retrieve(license.stripe_subscription_id);
      if (sub.status !== "active" && sub.status !== "trialing") {
        await supabase.from("licenses").update({ status: "expired" }).eq("id", license.id);
        return NextResponse.json({ valid: false, error: "Subscription is no longer active" }, { status: 403 });
      }
    } catch {
      // If Stripe call fails, still allow if license is marked active
    }
  }

  // Activate: record machine_id and activation time
  await supabase.from("licenses").update({
    machine_id: machine_id || null,
    activated_at: license.activated_at || new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }).eq("id", license.id);

  return NextResponse.json({
    valid: true,
    tier: license.tier,
    status: license.status,
    expires_at: license.expires_at,
    email: license.email,
  });
}
