import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase, createServiceClient } from "@/lib/supabase/server";

// Send cold emails via Instantly.io — better deliverability than GHL
export async function POST(request: NextRequest) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { lead_ids, campaign_id, batch_size } = await request.json();
  const serviceSupabase = createServiceClient();
  const instantlyKey = process.env.INSTANTLY_API_KEY;

  if (!instantlyKey) return NextResponse.json({ error: "Instantly not configured" }, { status: 500 });

  // Get leads
  let leads;
  if (lead_ids?.length > 0) {
    const { data } = await serviceSupabase.from("leads").select("*").in("id", lead_ids);
    leads = data;
  } else {
    const { data } = await serviceSupabase.from("leads").select("*").not("email", "is", null).eq("status", "new").limit(batch_size || 10);
    leads = data;
  }

  if (!leads || leads.length === 0) return NextResponse.json({ error: "No leads with emails" }, { status: 400 });

  let added = 0;

  // Add leads to Instantly campaign
  try {
    const leadsPayload = leads.map(lead => ({
      email: lead.email,
      first_name: lead.business_name?.split(" ")[0] || "",
      last_name: lead.business_name?.split(" ").slice(1).join(" ") || "",
      company_name: lead.business_name,
      phone: lead.phone || "",
      custom_variables: {
        industry: lead.industry || "",
        city: lead.city || "",
        rating: String(lead.google_rating || ""),
        website: lead.website || "",
      },
    }));

    const res = await fetch("https://api.instantly.ai/api/v2/leads", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${instantlyKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        campaign_id: campaign_id || undefined,
        leads: leadsPayload,
      }),
    });

    const data = await res.json();
    added = data.leads_added || leadsPayload.length;

    // Update lead statuses
    for (const lead of leads) {
      await serviceSupabase.from("leads").update({ status: "called" }).eq("id", lead.id);
      await serviceSupabase.from("outreach_log").insert({
        lead_id: lead.id,
        platform: "email",
        business_name: lead.business_name,
        recipient_handle: lead.email,
        message_text: "Added to Instantly campaign",
        status: "sent",
        metadata: { source: "instantly", campaign_id },
      });
    }
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }

  return NextResponse.json({ success: true, added, total: leads.length });
}
