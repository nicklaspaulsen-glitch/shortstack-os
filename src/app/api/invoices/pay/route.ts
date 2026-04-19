import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "");

// Create a Stripe Checkout session for paying an invoice
export async function POST(request: NextRequest) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { invoice_id } = await request.json();
  if (!invoice_id) return NextResponse.json({ error: "invoice_id required" }, { status: 400 });

  // Get invoice + verify the caller owns the underlying client. Without this
  // scope check, any authed user could spin up a Stripe Checkout session for
  // any other user's invoice by guessing its id.
  const { data: invoice } = await supabase
    .from("invoices")
    .select("*, clients!inner(business_name, email, profile_id)")
    .eq("id", invoice_id)
    .single();

  if (!invoice) return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
  const ownerId = (invoice.clients as { profile_id?: string } | null)?.profile_id;
  if (ownerId && ownerId !== user.id) {
    return NextResponse.json({ error: "Forbidden — not your invoice" }, { status: 403 });
  }
  if (invoice.status === "paid") return NextResponse.json({ error: "Already paid" }, { status: 400 });

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://shortstack-os.vercel.app";

  try {
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      line_items: [{
        price_data: {
          currency: "usd",
          product_data: {
            name: invoice.description || `Invoice for ${(invoice.clients as { business_name: string })?.business_name || "Client"}`,
          },
          unit_amount: Math.round(invoice.amount * 100),
        },
        quantity: 1,
      }],
      metadata: { invoice_id, client_id: invoice.client_id },
      success_url: `${baseUrl}/dashboard/portal/billing?paid=${invoice_id}`,
      cancel_url: `${baseUrl}/dashboard/portal/billing?cancelled=true`,
    });

    return NextResponse.json({ success: true, checkout_url: session.url });
  } catch (err) {
    console.error("Invoice payment error:", err);
    return NextResponse.json({ error: "Failed to create payment session. Please try again." }, { status: 500 });
  }
}
