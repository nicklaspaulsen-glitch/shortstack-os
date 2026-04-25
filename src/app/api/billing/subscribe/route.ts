import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { getStripe } from "@/lib/stripe/client";

// Create a recurring subscription for a client (monthly retainer)
export async function POST(request: NextRequest) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { client_id, amount, description, interval } = await request.json();
  if (!client_id || !amount) {
    return NextResponse.json({ error: "client_id and amount required" }, { status: 400 });
  }

  // Validate amount is a positive number
  const parsedAmount = parseFloat(amount);
  if (isNaN(parsedAmount) || parsedAmount <= 0 || parsedAmount > 100000) {
    return NextResponse.json({ error: "Amount must be between $0.01 and $100,000" }, { status: 400 });
  }

  // Validate interval if provided
  const validIntervals = ["month", "year", "week", "day"];
  if (interval && !validIntervals.includes(interval)) {
    return NextResponse.json({ error: "Invalid interval. Must be: month, year, week, or day" }, { status: 400 });
  }

  const { data: client } = await supabase
    .from("clients")
    .select("id, business_name, email, stripe_customer_id, package_tier")
    .eq("id", client_id)
    .single();

  if (!client) return NextResponse.json({ error: "Client not found" }, { status: 404 });

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://app.shortstack.work";

  try {
    const stripe = getStripe();
    // Ensure Stripe customer exists (inside try-catch for Stripe API safety)
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
    console.error("Stripe subscribe error:", err);
    return NextResponse.json({ error: "Failed to create subscription. Please try again." }, { status: 500 });
  }
}
