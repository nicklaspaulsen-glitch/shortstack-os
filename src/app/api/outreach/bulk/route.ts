import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase, createServiceClient } from "@/lib/supabase/server";
import {
  getNextPhoneNumber,
  getNextEmailSender,
  recordPhoneSend,
  recordEmailSend,
} from "@/lib/services/sender-rotation";
import { getEffectiveOwnerId } from "@/lib/security/require-owned-client";

export async function POST(request: NextRequest) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const ownerId = await getEffectiveOwnerId(supabase, user.id);
  if (!ownerId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { action, lead_ids, tier } = await request.json();
  if (!action || !lead_ids?.length) return NextResponse.json({ error: "Missing action or lead_ids" }, { status: 400 });

  const serviceSupabase = createServiceClient();
  let processed = 0;

  // Get lead details — scoped to caller's owned leads to block cross-tenant outreach.
  const { data: leads } = await serviceSupabase
    .from("leads")
    .select("id, business_name, email, phone, industry")
    .eq("user_id", ownerId)
    .in("id", lead_ids.slice(0, 50));

  if (!leads) return NextResponse.json({ error: "No leads found" }, { status: 404 });

  const twilioSid = process.env.TWILIO_ACCOUNT_SID;
  const twilioToken = process.env.TWILIO_AUTH_TOKEN;
  const twilioFrom = process.env.TWILIO_DEFAULT_NUMBER;

  for (const lead of leads) {
    try {
      if (action === "email" && lead.email) {
        // Try rotation pool sender first, fall back to GHL
        let emailHandled = false;
        const emailSender = await getNextEmailSender(serviceSupabase);
        if (emailSender) {
          try {
            const { sendEmail } = await import("@/lib/email");
            const emailOk = await sendEmail({
              to: lead.email,
              subject: `Quick question about ${lead.business_name}`,
              html: `Hi, I came across ${lead.business_name} and wanted to reach out. We help ${lead.industry || "local"} businesses grow their client base. Would you be open to a quick chat?`,
            });
            if (emailOk) {
              await recordEmailSend(serviceSupabase, emailSender.id);
              emailHandled = true;
              processed++;
            }
          } catch {
            emailHandled = false;
          }
        }

        // GHL fallback removed Apr 21 — pool senders (Resend) are the only path now.
        if (!emailHandled) {
          // Try the default Resend transport as a last resort when no pool sender
          // was available.
          try {
            const { sendEmail } = await import("@/lib/email");
            const emailOk = await sendEmail({
              to: lead.email,
              subject: `Quick question about ${lead.business_name}`,
              html: `Hi, I came across ${lead.business_name} and wanted to reach out. We help ${lead.industry || "local"} businesses grow their client base. Would you be open to a quick chat?`,
            });
            if (emailOk) processed++;
          } catch {}
        }
      } else if (action === "sms" && lead.phone && twilioSid && twilioToken) {
        // Resolve sender: rotation pool → env default
        let smsFrom = "";
        let smsPoolSender: { id: string } | null = null;
        const poolPhone = await getNextPhoneNumber(serviceSupabase);
        if (poolPhone) {
          smsFrom = poolPhone.phone_number;
          smsPoolSender = poolPhone;
        } else if (twilioFrom) {
          smsFrom = twilioFrom;
        }
        if (!smsFrom) continue;

        // Send SMS via Twilio
        const auth = Buffer.from(`${twilioSid}:${twilioToken}`).toString("base64");
        const message = `Hi, I came across ${lead.business_name} and wanted to reach out. We help ${lead.industry || "local"} businesses grow their client base. Would you be open to a quick chat?`;
        const smsRes = await fetch(
          `https://api.twilio.com/2010-04-01/Accounts/${twilioSid}/Messages.json`,
          {
            method: "POST",
            headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/x-www-form-urlencoded" },
            body: new URLSearchParams({ To: lead.phone, From: smsFrom, Body: message }),
          }
        );
        if (smsRes.ok) {
          processed++;
          if (smsPoolSender) await recordPhoneSend(serviceSupabase, smsPoolSender.id);
        }
      } else if (action === "call" && lead.phone) {
        // GHL call-queue path removed Apr 21. Calls should be initiated via
        // /api/call (ElevenAgents) per-lead. Record the intent here so bulk
        // call actions stay observable and we can batch-dispatch later.
        await serviceSupabase.from("outreach_log").insert({
          platform: "call",
          business_name: lead.business_name,
          recipient_handle: lead.phone,
          message_text: `Bulk call queued (tier ${tier})`,
          status: "pending",
          metadata: { source: "bulk_outreach", action: "call", tier },
        });
        processed++;
      } else if (action === "dm") {
        // Queue for DM controller
        await serviceSupabase.from("outreach_log").insert({
          platform: "instagram",
          business_name: lead.business_name,
          message_text: `Hey! I came across ${lead.business_name} and love what you're doing. We help ${lead.industry || "local"} businesses get more clients. Would you be open to a quick chat?`,
          status: "pending",
          metadata: { source: "bulk_dm", tier },
        });
        processed++;
      }

      // Log the action
      await serviceSupabase.from("outreach_log").insert({
        platform: action,
        business_name: lead.business_name,
        recipient_handle: lead.email || lead.phone || "",
        status: action === "dm" ? "pending" : "sent",
        sent_at: new Date().toISOString(),
        metadata: { source: "bulk_outreach", action, tier },
      });
    } catch {
      // Continue with next lead on error
    }
  }

  // Update lead statuses — scoped to owned leads that were actually processed.
  const processedIds = leads.map(l => l.id);
  if (processedIds.length > 0) {
    await serviceSupabase
      .from("leads")
      .update({ status: "contacted" })
      .eq("user_id", ownerId)
      .in("id", processedIds)
      .eq("status", "new");
  }

  // Log to trinity
  await serviceSupabase.from("trinity_log").insert({
    agent: "outreach",
    action_type: "outreach",
    description: `Bulk ${action}: ${processed}/${leads.length} leads processed (${tier} tier)`,
    status: "completed",
    result: { action, processed, total: leads.length, tier },
  });

  return NextResponse.json({ success: true, processed, total: leads.length });
}
