import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase, createServiceClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { action, lead_ids, tier } = await request.json();
  if (!action || !lead_ids?.length) return NextResponse.json({ error: "Missing action or lead_ids" }, { status: 400 });

  const serviceSupabase = createServiceClient();
  const ghlKey = process.env.GHL_API_KEY;
  const locationId = process.env.GHL_LOCATION_ID || "";
  let processed = 0;

  // Get lead details
  const { data: leads } = await serviceSupabase
    .from("leads")
    .select("id, business_name, email, phone, industry")
    .in("id", lead_ids.slice(0, 50));

  if (!leads) return NextResponse.json({ error: "No leads found" }, { status: 404 });

  const twilioSid = process.env.TWILIO_ACCOUNT_SID;
  const twilioToken = process.env.TWILIO_AUTH_TOKEN;
  const twilioFrom = process.env.TWILIO_DEFAULT_NUMBER;

  for (const lead of leads) {
    try {
      if (action === "email" && lead.email && ghlKey) {
        // Create/update contact in GHL with email tag
        await fetch("https://services.leadconnectorhq.com/contacts/", {
          method: "POST",
          headers: { Authorization: `Bearer ${ghlKey}`, "Content-Type": "application/json", Version: "2021-07-28" },
          body: JSON.stringify({
            locationId, name: lead.business_name,
            email: lead.email, tags: ["bulk-email", `tier-${tier}`],
            source: "ShortStack OS",
          }),
        });
        processed++;
      } else if (action === "sms" && lead.phone && twilioSid && twilioToken && twilioFrom) {
        // Send SMS via Twilio
        const auth = Buffer.from(`${twilioSid}:${twilioToken}`).toString("base64");
        const message = `Hi, I came across ${lead.business_name} and wanted to reach out. We help ${lead.industry || "local"} businesses grow their client base. Would you be open to a quick chat?`;
        const smsRes = await fetch(
          `https://api.twilio.com/2010-04-01/Accounts/${twilioSid}/Messages.json`,
          {
            method: "POST",
            headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/x-www-form-urlencoded" },
            body: new URLSearchParams({ To: lead.phone, From: twilioFrom, Body: message }),
          }
        );
        if (smsRes.ok) processed++;
      } else if (action === "call" && lead.phone && ghlKey) {
        await fetch("https://services.leadconnectorhq.com/contacts/", {
          method: "POST",
          headers: { Authorization: `Bearer ${ghlKey}`, "Content-Type": "application/json", Version: "2021-07-28" },
          body: JSON.stringify({
            locationId, name: lead.business_name,
            phone: lead.phone, tags: ["cold-call-queue", `tier-${tier}`],
            source: "ShortStack OS",
          }),
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

  // Update lead statuses
  await serviceSupabase
    .from("leads")
    .update({ status: "contacted" })
    .in("id", lead_ids.slice(0, 50))
    .eq("status", "new");

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
