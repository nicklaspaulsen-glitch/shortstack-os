import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { getStripe } from "@/lib/stripe/client";

// GET — fetch the default payment method for the logged-in user
export async function GET() {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Get user's Stripe customer ID from profile
  const { data: profile } = await supabase
    .from("profiles")
    .select("stripe_customer_id")
    .eq("id", user.id)
    .single();

  const customerId = profile?.stripe_customer_id as string | null;

  if (!customerId) {
    return NextResponse.json({ has_payment_method: false, payment_method: null });
  }

  try {
    const stripe = getStripe();
    // List payment methods on the customer
    const methods = await stripe.paymentMethods.list({
      customer: customerId,
      type: "card",
      limit: 1,
    });

    if (methods.data.length === 0) {
      return NextResponse.json({ has_payment_method: false, payment_method: null });
    }

    const pm = methods.data[0];
    const card = pm.card;

    return NextResponse.json({
      has_payment_method: true,
      payment_method: {
        id: pm.id,
        brand: card?.brand || "card",
        last4: card?.last4 || "****",
        exp_month: card?.exp_month,
        exp_year: card?.exp_year,
      },
    });
  } catch (err) {
    console.error("Stripe payment method fetch error:", err);
    return NextResponse.json({ has_payment_method: false, payment_method: null });
  }
}
