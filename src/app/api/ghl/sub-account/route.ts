import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase, createServiceClient } from "@/lib/supabase/server";

const GHL_API_KEY = process.env.GHL_API_KEY || "";
const GHL_COMPANY_ID = process.env.GHL_COMPANY_ID || "";

// POST — Create a GHL sub-account (location) for a new client
// Called automatically when a client is created/onboarded
export async function POST(request: NextRequest) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { client_id, business_name, email, phone, address } = await request.json();
  if (!business_name) return NextResponse.json({ error: "Business name required" }, { status: 400 });

  if (!GHL_API_KEY) {
    return NextResponse.json({ error: "GHL API key not configured" }, { status: 500 });
  }

  try {
    // Create sub-account (location) in GHL
    const res = await fetch("https://services.leadconnectorhq.com/locations/", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${GHL_API_KEY}`,
        "Version": "2021-07-28",
      },
      body: JSON.stringify({
        companyId: GHL_COMPANY_ID,
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

    if (data.location || data.id) {
      const locationId = data.location?.id || data.id;

      // Save GHL location ID to client record
      if (client_id) {
        const serviceSupabase = createServiceClient();
        await serviceSupabase.from("clients").update({
          ghl_location_id: locationId,
          metadata: {
            ghl_sub_account: true,
            ghl_created_at: new Date().toISOString(),
          },
        }).eq("id", client_id);
      }

      // Log the action
      await supabase.from("trinity_log").insert({
        action_type: "automation",
        description: `GHL sub-account created: ${business_name}`,
        client_id: client_id || null,
        status: "completed",
        result: { location_id: locationId, business_name },
      });

      return NextResponse.json({
        success: true,
        location_id: locationId,
        message: `Sub-account created for ${business_name}`,
      });
    } else {
      return NextResponse.json({
        success: false,
        error: data.message || data.msg || "Failed to create sub-account",
        details: data,
      });
    }
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
