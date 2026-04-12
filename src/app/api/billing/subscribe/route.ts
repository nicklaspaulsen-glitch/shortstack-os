import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "");

// Create a recurring subscription for a client (monthly retainer)
export async function POST(request: NextRequest) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { client_id, amount, description, interval } = await request.json();
  if (!client_id || !amount) {
    return NextResponse.json({ error: "client_id and amount required" }, { status: 400 });
  }

  const { data: client } = await supabase
    .from("clients")
    .select("id, business_name, email, stripe_customer_id, package_tier")
    .eq("id", client_id)
    .single();

  if (!client) return NextResponse.json({ error: "Client not found" }, { status: 404 });

  // Ensure Stripe customer exists
  let customerId = client.stripe_customer_id;
  if (!customerId) {
    const customer = await stripe.customers.create({
      name: client.business_name,
      email: client.email || undefined,
      metadata: { shortstack_client_id: client.id },
    });
    customerId = customer.id;
    await supabase.from("clients").update({ stripe_customer_id: customerId }).eq("id", client.id);
  }

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://shortstack-os.vercel.app";

  try {
    // Create a price for this subscription
    const price = await stripe.prices.create({
      unit_amount: Math.round(amount * 100),
      currency: "usd",
      recurring: { interval: interval || "month" },
      product_data: {
        name: description || `${client.business_name} — ${client.package_tier || "Growth"} Package`,
        metadata: { shortstack_client_id: client.id },
      },
    });

    // Create checkout session for the subscription
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: "subscription",
      payment_method_types: ["card"],
      line_items: [{ price: price.id, quantity: 1 }],
      metadata: { client_id: client.id, type: "client_subscription" },
      success_url: `${baseUrl}/dashboard/clients?subscribed=${client.id}`,
      cancel_url: `${baseUrl}/dashboard/clients?cancelled=true`,
    });

    return NextResponse.json({
      success: true,
      checkout_url: session.url,
      price_id: price.id,
    });
  } catch (err) {
    return NextResponse.json({ error: `Stripe error: ${err}` }, { status: 500 });
  }
}
