import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { getStripe } from "@/lib/stripe/client";

const TOKEN_PACKS: Record<string, { tokens: number; price: number }> = {
  "100k": { tokens: 100_000, price: 19 },
  "500k": { tokens: 500_000, price: 79 },
  "1m": { tokens: 1_000_000, price: 149 },
  "5m": { tokens: 5_000_000, price: 599 },
};

export async function POST(request: NextRequest) {
  const supabase = createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const { pack_id } = body as { pack_id: string };
  const pack = TOKEN_PACKS[pack_id];
  if (!pack)
    return NextResponse.json({ error: "Invalid token pack" }, { status: 400 });

  // CRITICAL: never grant tokens without payment. Create a Stripe Checkout
  // session; tokens are credited when the checkout webhook fires.
  if (!process.env.STRIPE_SECRET_KEY) {
    return NextResponse.json(
      { error: "Billing not configured (STRIPE_SECRET_KEY missing)" },
      { status: 500 }
    );
  }

  const baseUrl =
    process.env.NEXT_PUBLIC_APP_URL || "https://shortstack-os.vercel.app";

  const stripe = getStripe();

  // Ensure the user has (or gets) a Stripe customer id.
  const { data: profile } = await supabase
    .from("profiles")
    .select("stripe_customer_id, email")
    .eq("id", user.id)
    .single();

  let customerId = profile?.stripe_customer_id as string | null;
  if (!customerId) {
    const customer = await stripe.customers.create({
      email: profile?.email || user.email || undefined,
      metadata: { user_id: user.id },
    });
    customerId = customer.id;
    await supabase
      .from("profiles")
      .update({ stripe_customer_id: customerId })
      .eq("id", user.id);
  }

  try {
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      customer: customerId,
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: {
              name: `${pack.tokens.toLocaleString()} AI Tokens`,
              description: `Top-up of ${pack.tokens.toLocaleString()} tokens for ShortStack OS`,
            },
            unit_amount: pack.price * 100,
          },
          quantity: 1,
        },
      ],
      metadata: {
        type: "token_purchase",
        user_id: user.id,
        pack_id,
        tokens: String(pack.tokens),
      },
      success_url: `${baseUrl}/dashboard/settings?tokens_added=${pack.tokens}`,
      cancel_url: `${baseUrl}/dashboard/settings?tokens_cancelled=true`,
    });

    if (!session.url) {
      return NextResponse.json({ error: "Stripe did not return a checkout URL" }, { status: 500 });
    }

    return NextResponse.json({ url: session.url, checkout_url: session.url });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to create checkout session" },
      { status: 500 }
    );
  }
}
