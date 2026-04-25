import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase, createServiceClient } from "@/lib/supabase/server";
import { getStripe } from "@/lib/stripe/client";

// POST — Cancel subscription + schedule account deletion (30 day grace)
export async function POST(req: NextRequest) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  if (body.confirmation !== "DELETE") {
    return NextResponse.json({ error: "Must type DELETE to confirm" }, { status: 400 });
  }

  const service = createServiceClient();

  // Find the client record for this user
  const { data: client } = await service
    .from("clients")
    .select("id, stripe_customer_id, business_name")
    .eq("profile_id", user.id)
    .single();

  // Try to cancel active Stripe subscription(s)
  if (client?.stripe_customer_id) {
    try {
      const stripe = getStripe();
      const subs = await stripe.subscriptions.list({
        customer: client.stripe_customer_id,
        status: "active",
      });
      for (const sub of subs.data) {
        await stripe.subscriptions.update(sub.id, { cancel_at_period_end: true });
      }
    } catch (err) {
      console.error("[cancel-subscription] Stripe error:", err);
      // Continue anyway — we still want to record the cancellation
    }
  }

  // Mark client as cancelled with 30-day grace period
  const scheduledFor = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  if (client?.id) {
    await service
      .from("clients")
      .update({
        cancelled_at: new Date().toISOString(),
        cancellation_reason: body.reason || null,
        scheduled_deletion_at: scheduledFor.toISOString(),
      })
      .eq("id", client.id);
  }

  // Create deletion request row
  await service.from("account_deletion_requests").insert({
    profile_id: user.id,
    client_id: client?.id || null,
    reason: body.reason || null,
    scheduled_for: scheduledFor.toISOString(),
  });

  // Log
  try {
    await service.from("trinity_log").insert({
      user_id: user.id,
      action_type: "subscription_cancelled",
      description: `Subscription cancelled. Account scheduled for deletion on ${scheduledFor.toISOString().split("T")[0]}.`,
      status: "completed",
      metadata: { client_id: client?.id, business_name: client?.business_name, reason: body.reason },
    });
  } catch {
    // silent
  }

  return NextResponse.json({
    success: true,
    scheduled_for: scheduledFor.toISOString(),
    grace_period_days: 30,
    message: "Your subscription is cancelled. Your account and all data will be permanently deleted in 30 days. You can contact support to reverse this before then.",
  });
}
