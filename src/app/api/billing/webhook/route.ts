import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "");

// Unified Stripe Webhook — handles client billing events
// Register this at: https://dashboard.stripe.com/webhooks
// URL: https://shortstack-os.vercel.app/api/billing/webhook
// Events: invoice.paid, invoice.payment_failed, customer.subscription.created,
//         customer.subscription.updated, customer.subscription.deleted,
//         checkout.session.completed

export async function POST(request: NextRequest) {
  const body = await request.text();
  const sig = request.headers.get("stripe-signature");

  if (!sig) return NextResponse.json({ error: "No signature" }, { status: 400 });

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(
      body,
      sig,
      process.env.STRIPE_BILLING_WEBHOOK_SECRET || process.env.STRIPE_WEBHOOK_SECRET || ""
    );
  } catch {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  const supabase = createServiceClient();

  switch (event.type) {
    // ── Invoice Paid ──
    case "invoice.paid": {
      const invoice = event.data.object as Stripe.Invoice;
      const customerId = invoice.customer as string;

      // Find the client by stripe_customer_id
      const { data: client } = await supabase
        .from("clients")
        .select("id, business_name")
        .eq("stripe_customer_id", customerId)
        .single();

      if (client) {
        // Mark matching invoice as paid in our DB
        if (invoice.id) {
          await supabase
            .from("invoices")
            .update({
              status: "paid",
              paid_at: new Date().toISOString(),
              stripe_payment_intent: (invoice as unknown as { payment_intent?: string }).payment_intent || null,
            })
            .eq("stripe_invoice_id", invoice.id);
        }

        // Log the payment
        await supabase.from("trinity_log").insert({
          action_type: "custom",
          description: `Payment received: $${((invoice.amount_paid || 0) / 100).toFixed(2)} from ${client.business_name}`,
          client_id: client.id,
          status: "completed",
          result: {
            type: "stripe_payment",
            amount: (invoice.amount_paid || 0) / 100,
            stripe_invoice_id: invoice.id,
          },
        });

        // Notify on Telegram
        const chatId = process.env.TELEGRAM_CHAT_ID;
        const botToken = process.env.TELEGRAM_BOT_TOKEN;
        if (chatId && botToken) {
          await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              chat_id: chatId,
              text: `💰 Payment Received!\n\n${client.business_name}: $${((invoice.amount_paid || 0) / 100).toFixed(2)}\nInvoice: ${invoice.number || invoice.id}`,
            }),
          }).catch(() => {});
        }
      }
      break;
    }

    // ── Invoice Payment Failed ──
    case "invoice.payment_failed": {
      const invoice = event.data.object as Stripe.Invoice;
      const customerId = invoice.customer as string;

      const { data: client } = await supabase
        .from("clients")
        .select("id, business_name")
        .eq("stripe_customer_id", customerId)
        .single();

      if (client) {
        // Update invoice status
        if (invoice.id) {
          await supabase
            .from("invoices")
            .update({ status: "overdue" })
            .eq("stripe_invoice_id", invoice.id);
        }

        // Log and notify
        await supabase.from("trinity_log").insert({
          action_type: "custom",
          description: `Payment failed for ${client.business_name}: $${((invoice.amount_due || 0) / 100).toFixed(2)}`,
          client_id: client.id,
          status: "failed",
          result: { type: "payment_failed", stripe_invoice_id: invoice.id },
        });

        const chatId = process.env.TELEGRAM_CHAT_ID;
        const botToken = process.env.TELEGRAM_BOT_TOKEN;
        if (chatId && botToken) {
          await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              chat_id: chatId,
              text: `⚠️ Payment Failed!\n\n${client.business_name}: $${((invoice.amount_due || 0) / 100).toFixed(2)}\nFollow up ASAP.`,
            }),
          }).catch(() => {});
        }
      }
      break;
    }

    // ── Subscription Created/Updated ──
    case "customer.subscription.created":
    case "customer.subscription.updated": {
      const sub = event.data.object as Stripe.Subscription;
      const customerId = sub.customer as string;

      const { data: client } = await supabase
        .from("clients")
        .select("id")
        .eq("stripe_customer_id", customerId)
        .single();

      if (client) {
        // Update client MRR based on subscription
        const monthlyAmount = sub.items.data.reduce((sum, item) => {
          const price = item.price;
          if (price.recurring?.interval === "month") return sum + (price.unit_amount || 0);
          if (price.recurring?.interval === "year") return sum + Math.round((price.unit_amount || 0) / 12);
          return sum;
        }, 0) / 100;

        await supabase
          .from("clients")
          .update({
            mrr: monthlyAmount,
            stripe_subscription_id: sub.id,
          })
          .eq("id", client.id);
      }
      break;
    }

    // ── Subscription Deleted ──
    case "customer.subscription.deleted": {
      const sub = event.data.object as Stripe.Subscription;
      const customerId = sub.customer as string;

      const { data: client } = await supabase
        .from("clients")
        .select("id, business_name")
        .eq("stripe_customer_id", customerId)
        .single();

      if (client) {
        await supabase
          .from("clients")
          .update({ mrr: 0, stripe_subscription_id: null })
          .eq("id", client.id);

        await supabase.from("trinity_log").insert({
          action_type: "custom",
          description: `Subscription cancelled: ${client.business_name}`,
          client_id: client.id,
          status: "completed",
          result: { type: "subscription_cancelled", stripe_sub_id: sub.id },
        });

        const chatId = process.env.TELEGRAM_CHAT_ID;
        const botToken = process.env.TELEGRAM_BOT_TOKEN;
        if (chatId && botToken) {
          await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              chat_id: chatId,
              text: `🚨 Subscription Cancelled!\n\n${client.business_name} just cancelled. Trigger retention!`,
            }),
          }).catch(() => {});
        }
      }
      break;
    }

    // ── Checkout Completed ──
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      const clientId = session.metadata?.client_id;
      const type = session.metadata?.type;

      if (type === "client_subscription" && clientId) {
        await supabase.from("trinity_log").insert({
          action_type: "custom",
          description: `New subscription started via Stripe Checkout`,
          client_id: clientId,
          status: "completed",
          result: {
            type: "checkout_completed",
            session_id: session.id,
            amount: session.amount_total ? (session.amount_total / 100) : null,
          },
        });
      }
      break;
    }
  }

  return NextResponse.json({ received: true });
}
