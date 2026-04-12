import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "");

// Create a Stripe Billing Portal session for a client to manage their subscription
// Clients can: update payment method, view invoices, cancel subscription
export async function POST(request: NextRequest) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { client_id } = await request.json();

  let stripeCustomerId: string | null = null;

  if (client_id) {
    // Admin accessing for a specific client
    const { data: client } = await supabase
      .from("clients")
      .select("stripe_customer_id")
      .eq("id", client_id)
      .single();
    stripeCustomerId = client?.stripe_customer_id || null;
  } else {
    // Client portal — find their own client record
    const { data: profile } = await supabase
      .from("profiles")
      .select("id")
      .eq("id", user.id)
      .single();

    if (profile) {
      const { data: client } = await supabase
        .from("clients")
        .select("stripe_customer_id")
        .eq("profile_id", profile.id)
        .single();
      stripeCustomerId = client?.stripe_customer_id || null;
    }
  }

  if (!stripeCustomerId) {
    return NextResponse.json({ error: "No Stripe customer found for this client" }, { status: 404 });
  }

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://shortstack-os.vercel.app";

  try {
    const session = await stripe.billingPortal.sessions.create({
      customer: stripeCustomerId,
      return_url: client_id
        ? `${baseUrl}/dashboard/clients`
        : `${baseUrl}/dashboard/portal/billing`,
    });

    return NextResponse.json({ success: true, portal_url: session.url });
  } catch (err) {
    return NextResponse.json({ error: `Stripe error: ${err}` }, { status: 500 });
  }
}
