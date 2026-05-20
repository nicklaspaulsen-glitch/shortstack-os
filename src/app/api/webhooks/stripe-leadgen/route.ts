import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { getStripe } from "@/lib/stripe/client";
import { claimEvent, completeEvent } from "@/lib/webhooks/idempotency";
import { reportError } from "@/lib/observability/error-reporter";
import { notifyOps } from "@/lib/telegram";
import { type Stripe } from "stripe";

// Stripe webhook for leadgen one-time payments.
//
// Register at: https://dashboard.stripe.com/webhooks
// URL:          https://app.shortstack.work/api/webhooks/stripe-leadgen
// Events:       checkout.session.completed
//
// Secret env:   STRIPE_LEADGEN_WEBHOOK_SECRET
//
// When a qualified lead pays via the payment link created by /api/leadgen/payment,
// Stripe fires checkout.session.completed with:
//   metadata.type              = "leadgen_payment"
//   metadata.lead_pipeline_id  = the lead_pipeline.id
//   metadata.owner_id          = the agency owner's user_id
//
// On success: mark payment_received, set stage=payment_received, fire /api/leadgen/onboard
// to kick off credential collection.

export const runtime = "nodejs";
export const maxDuration = 30;

export async function POST(request: NextRequest) {
  const secret =
    process.env.STRIPE_LEADGEN_WEBHOOK_SECRET ||
    process.env.STRIPE_WEBHOOK_SECRET;

  if (!secret) {
    console.error(
      "[webhooks/stripe-leadgen] STRIPE_LEADGEN_WEBHOOK_SECRET is not set — rejecting. Configure in Vercel.",
    );
    return NextResponse.json({ error: "Webhook not configured" }, { status: 503 });
  }

  const body = await request.text();
  const sig = request.headers.get("stripe-signature");
  if (!sig) return NextResponse.json({ error: "No signature" }, { status: 400 });

  const stripe = getStripe();
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, secret);
  } catch (err) {
    reportError(err, {
      route: "/api/webhooks/stripe-leadgen",
      component: "stripe-signature-verify",
    });
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  const supabase = createServiceClient();

  // Idempotency: claim/complete model mirrors billing/webhook.ts
  const claim = await claimEvent(supabase, "stripe_leadgen", event.id);
  if (claim === "already_done") {
    return NextResponse.json({ ok: true, deduped: true });
  }
  if (claim === "in_flight") {
    return NextResponse.json({ ok: true, deduped: true, in_flight: true });
  }

  try {
    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;

      if (session.metadata?.type !== "leadgen_payment") {
        // Not our event — ack and move on
        await completeEvent(supabase, "stripe_leadgen", event.id);
        return NextResponse.json({ ok: true, skipped: "not_leadgen_payment" });
      }

      const leadId = session.metadata?.lead_pipeline_id;
      const ownerId = session.metadata?.owner_id;

      if (!leadId || !ownerId) {
        console.error("[webhooks/stripe-leadgen] Missing metadata on session", session.id);
        await completeEvent(supabase, "stripe_leadgen", event.id);
        return NextResponse.json({ ok: true, skipped: "missing_metadata" });
      }

      // Fetch lead to confirm it exists and current stage
      const { data: lead } = await supabase
        .from("lead_pipeline")
        .select("id, stage, display_name, handle, owner_id")
        .eq("id", leadId)
        .eq("owner_id", ownerId)
        .maybeSingle();

      if (!lead) {
        console.error("[webhooks/stripe-leadgen] Lead not found", leadId);
        await completeEvent(supabase, "stripe_leadgen", event.id);
        return NextResponse.json({ ok: true, skipped: "lead_not_found" });
      }

      // Mark as paid
      const amountPaid = session.amount_total ? session.amount_total / 100 : null;
      await supabase
        .from("lead_pipeline")
        .update({
          stage: "payment_received",
          payment_received_at: new Date().toISOString(),
          stripe_payment_intent:
            typeof session.payment_intent === "string" ? session.payment_intent : null,
        })
        .eq("id", leadId);

      // Log for audit trail
      await supabase.from("trinity_log").insert({
        action_type: "automation",
        description: `Lead payment received: ${lead.display_name || lead.handle} — $${amountPaid?.toFixed(2) ?? "?"}`,
        user_id: ownerId,
        status: "completed",
        result: {
          type: "leadgen_payment_received",
          lead_id: leadId,
          session_id: session.id,
          amount: amountPaid,
        },
      });

      await notifyOps(
        `💰 Lead Payment Received!\n\n${lead.display_name || lead.handle}: $${amountPaid?.toFixed(2) ?? "?"}\nLead ID: ${leadId}\nNow collecting credentials…`,
      );

      // Fire onboard to start credential collection via DM — fire-and-forget
      const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://app.shortstack.work";
      fetch(`${appUrl}/api/leadgen/onboard`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-webhook-key": process.env.WEBHOOK_SECRET || "",
        },
        body: JSON.stringify({ lead_id: leadId, owner_id: ownerId }),
      }).catch((err) =>
        console.warn("[webhooks/stripe-leadgen] onboard trigger failed:", err),
      );
    }

    await completeEvent(supabase, "stripe_leadgen", event.id);
    return NextResponse.json({ received: true });
  } catch (err) {
    reportError(err, {
      route: "/api/webhooks/stripe-leadgen",
      component: "handler",
      eventId: event.id,
      eventType: event.type,
    });
    throw err;
  }
}
