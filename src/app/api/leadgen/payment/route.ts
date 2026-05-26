import { NextRequest, NextResponse } from "next/server";
import { createServiceClient, createServerSupabase } from "@/lib/supabase/server";
import { getStripe } from "@/lib/stripe/client";
import { sendDM as zernioDM } from "@/lib/services/zernio";
import { secureCompare } from "@/lib/security/ssrf-guard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/leadgen/payment
 *
 * Creates a Stripe Payment Link (or invoice) and sends it to the lead via DM.
 * Transitions the lead to stage=payment_sent.
 *
 * Auth: session bearer OR x-webhook-key + owner_id
 *
 * Body:
 *   lead_id          string   — lead_pipeline.id
 *   amount           number   — payment amount in USD (e.g. 1500)
 *   description?     string   — what they're paying for (default: "Content creation package")
 *   currency?        string   — ISO currency code (default: "usd")
 *   owner_id?        string   — for webhook auth
 */

export async function POST(request: NextRequest) {
  const webhookKey = request.headers.get("x-webhook-key");
  const expectedKey = process.env.WEBHOOK_SECRET;

  let ownerId: string | null = null;
  let body: Record<string, unknown>;

  if (webhookKey && expectedKey && secureCompare(webhookKey, expectedKey)) {
    body = await request.json();
    ownerId = (body.owner_id as string) ?? null;
    if (!ownerId) return NextResponse.json({ error: "owner_id required for webhook auth" }, { status: 400 });
  } else {
    const authSupabase = createServerSupabase();
    const { data: { user } } = await authSupabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    ownerId = user.id;
    body = await request.json();
  }

  const {
    lead_id,
    amount,
    description = "Content creation package",
    currency = "usd",
  } = body as {
    lead_id: string;
    amount: number;
    description?: string;
    currency?: string;
    owner_id?: string;
  };

  if (!lead_id) return NextResponse.json({ error: "lead_id required" }, { status: 400 });
  if (!amount || amount <= 0) return NextResponse.json({ error: "amount must be positive" }, { status: 400 });

  const supabase = createServiceClient();

  const { data: row } = await supabase
    .from("lead_pipeline")
    .select("id, handle, platform, display_name, stage, owner_id")
    .eq("id", lead_id)
    .eq("owner_id", ownerId)
    .maybeSingle();

  if (!row) return NextResponse.json({ error: "Lead not found" }, { status: 404 });

  // Create Stripe Payment Link
  let paymentUrl: string;
  let paymentIntentId: string | null = null;

  try {
    const stripe = getStripe();
    const amountCents = Math.round(amount * 100);

    // Create a price + payment link
    const price = await stripe.prices.create({
      unit_amount: amountCents,
      currency,
      product_data: {
        name: description,
        metadata: { lead_pipeline_id: lead_id, owner_id: ownerId },
      },
    });

    const link = await stripe.paymentLinks.create({
      line_items: [{ price: price.id, quantity: 1 }],
      metadata: { lead_pipeline_id: lead_id, owner_id: ownerId },
      after_completion: {
        type: "redirect",
        redirect: { url: `${process.env.NEXT_PUBLIC_APP_URL ?? "https://app.shortstack.work"}/payment-success` },
      },
    });

    paymentUrl = link.url;
    paymentIntentId = link.id;
  } catch (err) {
    console.error("[leadgen/payment] Stripe error:", err);
    return NextResponse.json({ error: "Payment link creation failed", details: String(err) }, { status: 500 });
  }

  // Update pipeline row
  const { error: updateErr } = await supabase.from("lead_pipeline").update({
    stage: "payment_sent",
    stripe_payment_link: paymentUrl,
    stripe_payment_intent: paymentIntentId,
    payment_amount: amount,
    payment_sent_at: new Date().toISOString(),
  }).eq("id", lead_id);

  if (updateErr) {
    console.error("[leadgen/payment] DB update failed:", updateErr);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }

  // Send payment link via DM
  const name = row.display_name ?? row.handle;
  const dmMessage = [
    `Hey ${name}! 🙌 Everything is ready to go.`,
    ``,
    `Here's your secure payment link for the ${description}:`,
    paymentUrl,
    ``,
    `Amount: $${amount} ${currency.toUpperCase()}`,
    ``,
    `Once payment is confirmed I'll send over all the deliverables! Any questions just let me know 😊`,
  ].join("\n");

  await sendDM(row.platform, row.handle, dmMessage);

  // Trinity log
  await supabase.from("trinity_log").insert({
    action_type: "automation",
    description: `Payment link sent to ${name}: $${amount} — ${description}`,
    status: "completed",
    result: { lead_id, payment_url: paymentUrl, amount, currency },
  });

  // Telegram notify
  await notifyTelegram(`💳 Payment link sent to ${name} ($${amount}) — waiting for payment!`);

  // Schedule payment follow-up reminder (2 days from now)
  try {
    const followupAt = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString();
    await supabase.from("agent_task_queue").insert({
      owner_id: ownerId,
      task_type: "payment_followup",
      agent_key: "content-pipeline",
      priority: 20,
      payload: { lead_id, attempt: 1 },
      pipeline_id: lead_id,
      status: "queued",
      scheduled_for: followupAt,
    });
  } catch (err) {
    // Payment follow-up scheduling is non-critical
    console.warn("[leadgen/payment] Failed to schedule payment followup:", err);
  }

  return NextResponse.json({
    ok: true,
    stage: "payment_sent",
    payment_url: paymentUrl,
    amount,
    currency,
    dm_sent: true,
  });
}

async function sendDM(platform: string, handle: string, message: string): Promise<void> {
  const result = await zernioDM({ platform, handle, message });
  if (!result.ok) console.error("[leadgen/payment] Zernio send failed:", result.error);
}

async function notifyTelegram(msg: string): Promise<void> {
  const chatId = process.env.TELEGRAM_CHAT_ID;
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  if (!chatId || !botToken) return;
  await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text: msg }),
  }).catch(() => {});
}
