import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase, createServiceClient } from "@/lib/supabase/server";
import { getNextPhoneNumber, recordPhoneSend } from "@/lib/services/sender-rotation";
import { getEffectiveOwnerId } from "@/lib/security/require-owned-client";
import { checkLimit, recordUsage } from "@/lib/usage-limits";

// Send SMS to leads using Twilio
// Supports AI personalization via Anthropic Claude
// Rate limited by plan-tier monthly caps (checkLimit) + per-lead cost tracking.
export async function POST(request: NextRequest) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const ownerId = await getEffectiveOwnerId(supabase, user.id);
  if (!ownerId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { lead_ids, message_template, from_number, client_id, batch_size, use_ai } = await request.json();

  // Cap batch size to prevent runaway SMS costs
  const safeBatchSize = Math.min(batch_size || 20, 50);

  // Plan-tier usage cap (monthly SMS). Block the whole batch if it would exceed.
  const gate = await checkLimit(ownerId, "sms", safeBatchSize);
  if (!gate.allowed) {
    return NextResponse.json(
      {
        error: gate.reason || "Monthly SMS limit reached for your plan.",
        current: gate.current,
        limit: gate.limit,
        plan_tier: gate.plan_tier,
        remaining: gate.remaining,
      },
      { status: 402 },
    );
  }

  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  if (!sid || !token) return NextResponse.json({ error: "Twilio not configured" }, { status: 500 });

  const serviceSupabase = createServiceClient();

  // Resolve sender number: explicit from_number → client's provisioned number → system default
  let resolvedFrom = from_number || "";
  if (!resolvedFrom && client_id) {
    const { data: clientRow } = await serviceSupabase
      .from("clients")
      .select("twilio_phone_number")
      .eq("id", client_id)
      .single();
    if (clientRow?.twilio_phone_number) resolvedFrom = clientRow.twilio_phone_number;
  }

  // Try rotation pool before falling back to system default
  let usedPoolSender: { id: string } | null = null;
  if (!resolvedFrom) {
    const poolSender = await getNextPhoneNumber(serviceSupabase);
    if (poolSender) {
      resolvedFrom = poolSender.phone_number;
      usedPoolSender = poolSender;
    }
  }

  if (!resolvedFrom) resolvedFrom = process.env.TWILIO_DEFAULT_NUMBER || "";

  // Get leads with phone numbers
  let leads;
  if (lead_ids?.length) {
    const { data } = await serviceSupabase.from("leads").select("*").in("id", lead_ids).not("phone", "is", null);
    leads = data;
  } else {
    const { data } = await serviceSupabase.from("leads").select("*").not("phone", "is", null).eq("status", "new").limit(safeBatchSize);
    leads = data;
  }

  if (!leads?.length) return NextResponse.json({ error: "No leads with phone numbers" }, { status: 400 });

  const auth = Buffer.from(`${sid}:${token}`).toString("base64");
  const apiKey = process.env.ANTHROPIC_API_KEY;
  let sent = 0;
  let failed = 0;

  for (const lead of leads) {
    let message = (message_template || "Hi {name}, this is a quick message about {business_name}.")
      .replace(/\{business_name\}/g, lead.business_name || "your business")
      .replace(/\{name\}/g, lead.owner_name || "there")
      .replace(/\{industry\}/g, lead.industry || "your industry");

    // AI personalization
    if (use_ai && apiKey) {
      try {
        const aiRes = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: { "x-api-key": apiKey, "content-type": "application/json", "anthropic-version": "2023-06-01" },
          body: JSON.stringify({
            model: "claude-haiku-4-5-20251001",
            max_tokens: 150,
            messages: [{ role: "user", content: `Rewrite this SMS to be more personal and natural for ${lead.business_name} (${lead.industry}). Keep under 160 characters. No hashtags.\n\nOriginal: ${message}` }],
          }),
        });
        const aiData = await aiRes.json();
        if (aiData.content?.[0]?.text) message = aiData.content[0].text;
      } catch { /* use original */ }
    }

    // Validate phone format before sending
    const cleanedPhone = (lead.phone || "").replace(/[^\d+]/g, "");
    if (cleanedPhone.length < 7 || cleanedPhone.length > 16) {
      failed++;
      continue;
    }

    // Ensure E.164 format
    const toPhone = cleanedPhone.startsWith("+") ? cleanedPhone : `+1${cleanedPhone}`;

    try {
      const smsRes = await fetch(
        `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`,
        {
          method: "POST",
          headers: {
            Authorization: `Basic ${auth}`,
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: new URLSearchParams({
            To: toPhone,
            From: resolvedFrom,
            Body: message,
          }),
        }
      );

      if (smsRes.ok) {
        sent++;
        // Record rotation pool usage for daily limit tracking
        if (usedPoolSender) {
          await recordPhoneSend(serviceSupabase, usedPoolSender.id);
        }
        // Plan-tier usage metering
        await recordUsage(ownerId, "sms", 1, { lead_id: lead.id, platform: "sms" });
        await serviceSupabase.from("outreach_log").insert({
          lead_id: lead.id,
          platform: "sms",
          business_name: lead.business_name,
          recipient_handle: lead.phone,
          message_text: message,
          status: "sent",
          sent_at: new Date().toISOString(),
          metadata: { direction: "outbound" },
        });
        // Only advance status if lead hasn't already replied/booked
        await serviceSupabase.from("leads").update({ status: "contacted" }).eq("id", lead.id).in("status", ["new", "called"]);
      } else {
        failed++;
      }
    } catch {
      failed++;
    }
  }

  return NextResponse.json({ success: true, sent, failed, total: leads.length });
}
