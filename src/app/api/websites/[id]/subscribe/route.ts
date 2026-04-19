import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { sendEmail } from "@/lib/email";
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "");

/**
 * Create a Stripe Checkout subscription for a generated website.
 *
 * POST /api/websites/[id]/subscribe
 * body: {
 *   billing_cycle?: 'monthly' | 'yearly',
 *   addons?: string[],
 *   monthly_price: number,    // chosen from /price-quote
 *   yearly_price?: number,
 *   tier: 'starter' | 'pro' | 'business' | 'premium'
 * }
 *
 * Behaviour:
 *  - If STRIPE_SECRET_KEY is set: creates a Stripe Price + Checkout session
 *    and returns a checkout_url for the client to redirect to.
 *  - Otherwise (stub mode): immediately marks the site live, removes the
 *    watermark, and returns a stub checkout_url so the dashboard can confirm.
 *
 * Always inserts a website_subscriptions row and updates the project status.
 */

const VALID_TIERS = ["starter", "pro", "business", "premium"] as const;
const VALID_CYCLES = ["monthly", "yearly"] as const;

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const billing_cycle = (VALID_CYCLES as readonly string[]).includes(body?.billing_cycle)
    ? body.billing_cycle
    : "monthly";
  const addons: string[] = Array.isArray(body?.addons) ? body.addons : [];
  const tier = (VALID_TIERS as readonly string[]).includes(body?.tier) ? body.tier : "starter";

  const monthlyPrice = Number(body?.monthly_price);
  if (!Number.isFinite(monthlyPrice) || monthlyPrice <= 0 || monthlyPrice > 10000) {
    return NextResponse.json({ error: "Invalid monthly_price" }, { status: 400 });
  }
  const yearlyPriceRaw = Number(body?.yearly_price);
  const yearlyPrice = Number.isFinite(yearlyPriceRaw) && yearlyPriceRaw > 0
    ? yearlyPriceRaw
    : Number((monthlyPrice * 12 * 0.83).toFixed(2));

  const amount = billing_cycle === "yearly" ? yearlyPrice : monthlyPrice;
  const interval = billing_cycle === "yearly" ? "year" : "month";

  const { data: project } = await supabase
    .from("website_projects")
    .select("id, profile_id, name, custom_domain, preview_url")
    .eq("id", params.id)
    .single();

  if (!project || project.profile_id !== user.id) {
    return NextResponse.json({ error: "Not found or forbidden" }, { status: 403 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, email, full_name, stripe_customer_id")
    .eq("id", user.id)
    .single();

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://shortstack-os.vercel.app";
  const successUrl = `${baseUrl}/dashboard/websites?subscribed=${project.id}`;
  const cancelUrl = `${baseUrl}/dashboard/websites?cancelled=${project.id}`;

  // Persist subscription intent + chosen pricing on the project up front.
  await supabase.from("website_projects").update({
    pricing_tier: tier,
    monthly_price: monthlyPrice,
    yearly_price: yearlyPrice,
    addons,
    updated_at: new Date().toISOString(),
  }).eq("id", project.id);

  const includesWhiteLabel = addons.includes("white_label");

  // ── Stub mode (no Stripe key) ────────────────────────────────────────
  if (!process.env.STRIPE_SECRET_KEY) {
    const { data: sub } = await supabase
      .from("website_subscriptions")
      .insert({
        website_id: project.id,
        profile_id: user.id,
        tier,
        monthly_price: monthlyPrice,
        yearly_price: yearlyPrice,
        billing_cycle,
        addons,
        status: "active",
        current_period_end: new Date(Date.now() + (billing_cycle === "yearly" ? 365 : 30) * 86400_000).toISOString(),
      })
      .select("id")
      .single();

    await supabase.from("website_projects").update({
      status: "live",
      watermark_enabled: !includesWhiteLabel,
      demo_expires_at: null,
      updated_at: new Date().toISOString(),
    }).eq("id", project.id);

    if (profile?.email) {
      await sendEmail({
        to: profile.email,
        subject: `Your ShortStack site "${project.name}" is live!`,
        html: `<p>Hi ${profile.full_name || "there"},</p><p>Your website <strong>${project.name}</strong> is now live on the <strong>${tier}</strong> plan ($${amount}/${interval}).</p><p>Manage it: <a href="${baseUrl}/dashboard/websites">${baseUrl}/dashboard/websites</a></p>`,
      }).catch(() => {});
    }

    return NextResponse.json({
      success: true,
      simulated: true,
      checkout_url: `${baseUrl}/dashboard/websites?subscribed=${project.id}&sim=1`,
      subscription_id: sub?.id,
      message: "Stub subscription — set STRIPE_SECRET_KEY to charge for real.",
    });
  }

  // ── Real Stripe Checkout ─────────────────────────────────────────────
  try {
    let customerId = profile?.stripe_customer_id;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: profile?.email || user.email || undefined,
        name: profile?.full_name || undefined,
        metadata: { shortstack_profile_id: user.id },
      });
      customerId = customer.id;
      await supabase.from("profiles").update({ stripe_customer_id: customerId }).eq("id", user.id);
    }

    const productName = `${project.name || "Website"} — ${tier.charAt(0).toUpperCase()}${tier.slice(1)}${addons.length ? ` (+${addons.length} addons)` : ""}`;

    const price = await stripe.prices.create({
      unit_amount: Math.round(amount * 100),
      currency: "usd",
      recurring: { interval },
      product_data: {
        name: productName,
        metadata: {
          shortstack_website_id: project.id,
          shortstack_profile_id: user.id,
          tier,
          billing_cycle,
        },
      },
    });

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: "subscription",
      payment_method_types: ["card"],
      line_items: [{ price: price.id, quantity: 1 }],
      metadata: {
        type: "website_subscription",
        website_id: project.id,
        profile_id: user.id,
        tier,
        billing_cycle,
        addons: addons.join(","),
      },
      success_url: successUrl,
      cancel_url: cancelUrl,
    });

    // Insert pending subscription row — webhook upgrades to active on payment.
    // Previously this was inserted with status:"active" which contradicted the
    // comment and silently entitled the user before the card actually charged.
    await supabase.from("website_subscriptions").insert({
      website_id: project.id,
      profile_id: user.id,
      stripe_price_id: price.id,
      tier,
      monthly_price: monthlyPrice,
      yearly_price: yearlyPrice,
      billing_cycle,
      addons,
      status: "pending",
    });

    return NextResponse.json({
      success: true,
      checkout_url: session.url,
      price_id: price.id,
    });
  } catch (err) {
    console.error("[website subscribe] stripe error", err);
    return NextResponse.json({ error: "Failed to create subscription" }, { status: 500 });
  }
}

/**
 * GET /api/websites/[id]/subscribe — current subscription state for the site.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: subs } = await supabase
    .from("website_subscriptions")
    .select("*")
    .eq("website_id", params.id)
    .eq("profile_id", user.id)
    .order("created_at", { ascending: false })
    .limit(1);

  const sub = subs?.[0] || null;
  return NextResponse.json({ success: true, subscription: sub });
}
