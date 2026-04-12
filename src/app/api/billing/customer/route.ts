import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "");

// Create or sync a Stripe customer for a client
export async function POST(request: NextRequest) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { client_id } = await request.json();
  if (!client_id) return NextResponse.json({ error: "client_id required" }, { status: 400 });

  const { data: client } = await supabase
    .from("clients")
    .select("id, business_name, email, phone, stripe_customer_id")
    .eq("id", client_id)
    .single();

  if (!client) return NextResponse.json({ error: "Client not found" }, { status: 404 });

  // Already has a Stripe customer
  if (client.stripe_customer_id) {
    try {
      const customer = await stripe.customers.retrieve(client.stripe_customer_id);
      if (!(customer as Stripe.DeletedCustomer).deleted) {
        return NextResponse.json({ success: true, customer_id: client.stripe_customer_id, exists: true });
      }
    } catch {}
  }

  // Create new Stripe customer
  try {
    const customer = await stripe.customers.create({
      name: client.business_name,
      email: client.email || undefined,
      phone: client.phone || undefined,
      metadata: { shortstack_client_id: client.id },
    });

    await supabase
      .from("clients")
      .update({ stripe_customer_id: customer.id })
      .eq("id", client.id);

    return NextResponse.json({
      success: true,
      customer_id: customer.id,
      exists: false,
    });
  } catch (err) {
    return NextResponse.json({ error: `Stripe error: ${err}` }, { status: 500 });
  }
}
