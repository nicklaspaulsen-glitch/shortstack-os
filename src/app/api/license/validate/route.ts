/**
 * Security fixes (service-client-audit.md — HIGH):
 *
 * 1. Added Supabase-backed IP rate limiting (10 requests/min per IP) to
 *    prevent brute-force enumeration of license keys. Previously fully public
 *    with no rate limit.
 *
 * 2. Added machine activation cap: a license may only be activated on at most
 *    2 distinct machine_ids before requiring manual admin review. Subsequent
 *    activations from a new machine_id are rejected with HTTP 403 until the
 *    admin resets the activation count. Existing machine_ids (re-activations)
 *    are always permitted.
 */

import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { getStripe } from "@/lib/stripe/client";
import { checkRateLimit, extractIp } from "@/lib/server/rate-limit";

const MAX_MACHINE_ACTIVATIONS = 2;

// POST: Validate + activate a license key from the desktop app
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  if (!body) return NextResponse.json({ valid: false, error: "Invalid request body" }, { status: 400 });
  const { license_key, email, machine_id } = body as {
    license_key?: string;
    email?: string;
    machine_id?: string;
  };

  if (!license_key) {
    return NextResponse.json({ valid: false, error: "License key required" }, { status: 400 });
  }

  const supabase = createServiceClient();

  // IP rate-limit: 10 validate attempts per minute to prevent key enumeration.
  const ip = extractIp(request);
  const rl = await checkRateLimit(supabase, `ip:${ip}`, "license_validate", 10);
  if (!rl.ok) {
    return NextResponse.json(
      { valid: false, error: "Too many requests. Try again shortly." },
      {
        status: 429,
        headers: rl.retryAfterSec > 0 ? { "Retry-After": String(rl.retryAfterSec) } : {},
      },
    );
  }

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
      const stripe = getStripe();
      const sub = await stripe.subscriptions.retrieve(license.stripe_subscription_id);
      if (sub.status !== "active" && sub.status !== "trialing") {
        await supabase.from("licenses").update({ status: "expired" }).eq("id", license.id);
        return NextResponse.json({ valid: false, error: "Subscription is no longer active" }, { status: 403 });
      }
    } catch {
      // If Stripe call fails, still allow if license is marked active
    }
  }

  // Machine activation cap. Codex round-3 catch: the SELECT-then-UPSERT
  // pattern was racy — two concurrent activations on different new
  // machines could both see < cap and both succeed. Now goes through the
  // SECURITY DEFINER `try_activate_license_machine` RPC which takes a
  // row-level lock on the licenses row, counts activations, and inserts
  // atomically. Idempotent re-activation on the same machine never
  // consumes a slot.
  if (machine_id) {
    const { data: activationResult, error: activationErr } = await supabase.rpc(
      "try_activate_license_machine",
      {
        p_license_id: license.id,
        p_machine_id: machine_id,
        p_max_machines: MAX_MACHINE_ACTIVATIONS,
        p_ip: ip,
        p_user_agent: request.headers.get("user-agent") ?? null,
      },
    );

    if (activationErr) {
      console.error("[license/validate] activation RPC failed:", activationErr.message);
      return NextResponse.json(
        { valid: false, error: "Activation system temporarily unavailable. Try again shortly." },
        { status: 503 },
      );
    }

    const result = activationResult as { allowed: boolean; reason: string; count: number | null };
    if (!result.allowed) {
      console.warn(
        `[license/validate] Activation cap hit for license ${license.id}. ` +
        `Reason: ${result.reason}, count: ${result.count}, attempted: ${machine_id}`,
      );
      return NextResponse.json(
        {
          valid: false,
          error: "This license has reached its maximum device activations. Contact support to transfer your license.",
        },
        { status: 403 },
      );
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
