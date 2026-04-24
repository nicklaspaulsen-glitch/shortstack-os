/**
 * Stripe Connect Express onboarding — referral payouts flow.
 *
 * This is the route agencies hit to set up the connected account that
 * RECEIVES referral commission payouts from the ShortStack platform.
 * Distinct from /api/integrations/stripe-connect/onboard, which is
 * the agency-charges-their-clients flow and uses a different table
 * (agency_stripe_accounts). Here we store a single string column on
 * profiles because payouts have exactly one dimension (who gets paid).
 *
 *   POST — ensures an Express account exists for the user, generates a
 *          fresh onboarding account link, returns { url, account_id }.
 *   GET  — returns the current status:
 *            { connected, account_id, chargesEnabled, payoutsEnabled,
 *              detailsSubmitted, onboardingUrl? }
 *          (onboardingUrl is set when the account exists but hasn't
 *          finished onboarding — UI can show "Continue setup".)
 *
 * Auth: signed-in users only. No admin gating — anyone with a referral
 * code can earn and therefore needs an account.
 *
 * Env:
 *   STRIPE_SECRET_KEY        — same key the rest of /api/billing uses
 *   NEXT_PUBLIC_APP_URL      — base URL for return_url / refresh_url
 */

import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "");

function resolveBaseUrl(request: NextRequest): string {
  const candidates = [
    process.env.NEXT_PUBLIC_APP_URL,
    process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null,
    (() => {
      try { return new URL(request.url).origin; } catch { return null; }
    })(),
    "https://app.shortstack.work",
    "https://shortstack-os.vercel.app",
  ];
  for (const c of candidates) {
    if (!c) continue;
    try {
      const u = new URL(c.startsWith("http") ? c : `https://${c}`);
      if (u.protocol === "http:" || u.protocol === "https:") return u.origin;
    } catch { /* next */ }
  }
  return "https://app.shortstack.work";
}

async function generateAccountLink(accountId: string, baseUrl: string) {
  return stripe.accountLinks.create({
    account: accountId,
    refresh_url: `${baseUrl}/dashboard/referrals?payouts_refresh=1`,
    return_url: `${baseUrl}/dashboard/referrals?payouts_connected=1`,
    type: "account_onboarding",
  });
}

export async function POST(request: NextRequest) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!process.env.STRIPE_SECRET_KEY) {
    return NextResponse.json(
      { error: "Server misconfigured: STRIPE_SECRET_KEY not set" },
      { status: 500 },
    );
  }

  const baseUrl = resolveBaseUrl(request);

  try {
    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name, email, stripe_connect_account_id")
      .eq("id", user.id)
      .single();

    let accountId = profile?.stripe_connect_account_id as string | null;

    if (!accountId) {
      const account = await stripe.accounts.create({
        type: "express",
        email: user.email || profile?.email || undefined,
        metadata: {
          shortstack_user_id: user.id,
          purpose: "referral_payouts",
        },
        business_profile: profile?.full_name
          ? { name: profile.full_name }
          : undefined,
        capabilities: {
          // `transfers` is the capability we actually need for platform →
          // connect-account payouts. `card_payments` isn't required for
          // receive-only accounts, but leaving it as a request is harmless
          // and keeps parity with the agency flow.
          transfers: { requested: true },
        },
      });
      accountId = account.id;

      const { error: updErr } = await supabase
        .from("profiles")
        .update({ stripe_connect_account_id: accountId })
        .eq("id", user.id);
      if (updErr) {
        console.error(
          "[billing/connect-onboarding] failed to persist stripe_connect_account_id",
          { user_id: user.id, account_id: accountId, error: updErr.message },
        );
        // Not fatal — the caller can still onboard this session, and the
        // next POST will re-create since we'll read null from profiles.
      }
    }

    const link = await generateAccountLink(accountId, baseUrl);
    return NextResponse.json({ url: link.url, account_id: accountId });
  } catch (err) {
    console.error("[billing/connect-onboarding] POST error", err);
    const message = err instanceof Error ? err.message : "Failed to create onboarding link";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!process.env.STRIPE_SECRET_KEY) {
    return NextResponse.json(
      { error: "Server misconfigured: STRIPE_SECRET_KEY not set" },
      { status: 500 },
    );
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("stripe_connect_account_id")
    .eq("id", user.id)
    .single();

  const accountId = profile?.stripe_connect_account_id as string | null;

  if (!accountId) {
    return NextResponse.json({
      connected: false,
      account_id: null,
      chargesEnabled: false,
      payoutsEnabled: false,
      detailsSubmitted: false,
    });
  }

  const baseUrl = resolveBaseUrl(request);

  try {
    const account = await stripe.accounts.retrieve(accountId);

    const payoutsEnabled = !!account.payouts_enabled;
    const chargesEnabled = !!account.charges_enabled;
    const detailsSubmitted = !!account.details_submitted;

    // If onboarding isn't finished, attach a fresh link so the UI can
    // render a "Continue setup" CTA without doing a second round-trip.
    let onboardingUrl: string | undefined;
    if (!payoutsEnabled || !detailsSubmitted) {
      try {
        const link = await generateAccountLink(accountId, baseUrl);
        onboardingUrl = link.url;
      } catch (linkErr) {
        console.error("[billing/connect-onboarding] refresh link failed", linkErr);
      }
    }

    return NextResponse.json({
      connected: true,
      account_id: accountId,
      account_id_last4: accountId.slice(-4),
      chargesEnabled,
      payoutsEnabled,
      detailsSubmitted,
      country: account.country || null,
      default_currency: account.default_currency || null,
      onboardingUrl,
    });
  } catch (err) {
    // Stripe returns a permission_error if the account was deleted. Treat
    // that as "not connected" so the user can re-onboard without us erroring
    // the whole page. Log for ops.
    console.error("[billing/connect-onboarding] GET stripe.accounts.retrieve failed", err);
    const message = err instanceof Error ? err.message : "Stripe account lookup failed";
    return NextResponse.json(
      {
        connected: false,
        account_id: null,
        chargesEnabled: false,
        payoutsEnabled: false,
        detailsSubmitted: false,
        error: message,
      },
      { status: 200 }, // 200 so the UI renders the Setup panel instead of an error screen
    );
  }
}
