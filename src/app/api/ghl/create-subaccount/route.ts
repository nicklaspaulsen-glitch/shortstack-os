import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

// Auto-create GHL sub-account when a new client signs up
// Uses the Agency API to create a location under your GHL agency
export async function POST(request: NextRequest) {
  const { client_id, business_name, email, phone, address } = await request.json();

  const agencyKey = process.env.GHL_AGENCY_KEY;
  const companyId = process.env.GHL_COMPANY_ID;

  if (!agencyKey) return NextResponse.json({ error: "GHL Agency key not configured" }, { status: 500 });

  const supabase = createServiceClient();

  try {
    // Create sub-account (location) in GHL
    const res = await fetch("https://services.leadconnectorhq.com/locations/", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${agencyKey}`,
        "Content-Type": "application/json",
        Version: "2021-07-28",
      },
      body: JSON.stringify({
        companyId: companyId || undefined,
        name: business_name,
        email: email || undefined,
        phone: phone || undefined,
        address: address || undefined,
        settings: {
          allowDuplicateContact: false,
          allowDuplicateOpportunity: false,
        },
      }),
    });

    const data = await res.json();

    if (data.location?.id || data.id) {
      const locationId = data.location?.id || data.id;

      // Save the location ID to the client record
      if (client_id) {
        await supabase.from("clients").update({
          metadata: {
            ghl_location_id: locationId,
            ghl_created_at: new Date().toISOString(),
          },
        }).eq("id", client_id);
      }

      // Log
      await supabase.from("trinity_log").insert({
        action_type: "automation",
        description: `GHL sub-account created for ${business_name} (${locationId})`,
        client_id: client_id || null,
        status: "completed",
        result: { location_id: locationId, business_name },
      });

      // Notify
      try {
        const { sendTelegramMessage } = await import("@/lib/services/trinity");
        const chatId = process.env.TELEGRAM_CHAT_ID;
        if (chatId) {
          await sendTelegramMessage(chatId, `🏢 *GHL Sub-Account Created*\n\nClient: ${business_name}\nLocation ID: ${locationId}`);
        }
      } catch {}

      return NextResponse.json({ success: true, location_id: locationId });
    }

    return NextResponse.json({ error: data.message || "Failed to create sub-account", details: data }, { status: 500 });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
