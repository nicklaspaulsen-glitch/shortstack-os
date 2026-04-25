import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { getStripe } from "@/lib/stripe/client";

// Create a Stripe Billing Portal session for a client to manage their subscription
// Clients can: update payment method, view invoices, cancel subscription
export async function POST(request: NextRequest) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { client_id, self } = await request.json();

  let stripeCustomerId: string | null = null;
  let returnPath = "/dashboard/portal/billing";

  if (self) {
    // Agency owner managing their own subscription
    const { data: profile } = await supabase
      .from("profiles")
      .select("stripe_customer_id")
      .eq("id", user.id)
      .single();
    stripeCustomerId = profile?.stripe_customer_id as string | null;
    returnPath = "/dashboard/settings";
  } else if (client_id) {
    // Agency owner accessing the billing portal for a specific client they own.
    // Scope by profile_id so one agency can't open another's client portal.
    const { data: client } = await supabase
      .from("clients")
      .select("stripe_customer_id, profile_id")
      .eq("id", client_id)
      .eq("profile_id", user.id)
      .maybeSingle();
    if (!client) {
      return NextResponse.json({ error: "Client not found or forbidden" }, { status: 403 });
    }
    stripeCustomerId = client.stripe_customer_id || null;
    returnPath = "/dashboard/clients";
  } else {
    // Client portal — find their own client record
    const { data: client } = await supabase
      .from("clients")
      .select("stripe_customer_id")
      .eq("profile_id", user.id)
      .single();
    stripeCustomerId = client?.stripe_customer_id || null;
  }

  if (!stripeCustomerId) {
    return NextResponse.json({ error: "No Stripe customer found" }, { status: 404 });
  }

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://app.shortstack.work";

  try {
    const stripe = getStripe();
    const session = await stripe.billingPortal.sessions.create({
      customer: stripeCustomerId,
      return_url: `${baseUrl}${returnPath}`,
    });

    return NextResponse.json({ success: true, portal_url: session.url });
  } catch (err) {
    console.error("Stripe portal error:", err);
    return NextResponse.json({ error: "Failed to create billing portal session. Please try again." }, { status: 500 });
  }
}
