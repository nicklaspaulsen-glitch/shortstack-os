import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "");

// Stripe webhook to handle subscription events
export async function POST(request: NextRequest) {
  const body = await request.text();
  const sig = request.headers.get("stripe-signature");

  if (!sig) {
    return NextResponse.json({ error: "No signature" }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET || "");
  } catch {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  const supabase = createServiceClient();

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      const licenseKey = session.metadata?.license_key;
      const subscriptionId = session.subscription as string;

      if (licenseKey && subscriptionId) {
        await supabase.from("licenses").update({
          stripe_subscription_id: subscriptionId,
          status: "active",
          activated_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }).eq("license_key", licenseKey);
      }
      break;
    }

    case "customer.subscription.updated": {
      const sub = event.data.object as Stripe.Subscription;
      const { data: license } = await supabase
        .from("licenses")
        .select("id")
        .eq("stripe_subscription_id", sub.id)
        .single();

      if (license) {
        const status = (sub.status === "active" || sub.status === "trialing") ? "active" : "expired";
        await supabase.from("licenses").update({
          status,
          expires_at: new Date((sub as unknown as { current_period_end: number }).current_period_end * 1000).toISOString(),
          updated_at: new Date().toISOString(),
        }).eq("id", license.id);
      }
      break;
    }

    case "customer.subscription.deleted": {
      const sub = event.data.object as Stripe.Subscription;
      await supabase.from("licenses").update({
        status: "expired",
        updated_at: new Date().toISOString(),
      }).eq("stripe_subscription_id", sub.id);
      break;
    }

    case "invoice.payment_failed": {
      const invoice = event.data.object as unknown as Record<string, unknown>;
      const subId = invoice.subscription as string | null;
      if (subId) {
        await supabase.from("licenses").update({
          status: "expired",
          updated_at: new Date().toISOString(),
          metadata: { payment_failed: true, failed_at: new Date().toISOString() },
        }).eq("stripe_subscription_id", subId);
      }
      break;
    }
  }

  return NextResponse.json({ received: true });
}
