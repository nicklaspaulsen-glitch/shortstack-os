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

  for (const lead of leads) {
    if (action === "email" && lead.email && ghlKey) {
      try {
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
      } catch {}
    } else if (action === "call" && lead.phone && ghlKey) {
      try {
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
      } catch {}
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
      platform: action === "email" ? "email" : action === "call" ? "phone" : "instagram",
      business_name: lead.business_name,
      recipient_handle: lead.email || lead.phone || "",
      status: "sent",
      metadata: { source: "bulk_outreach", action, tier },
    });
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
