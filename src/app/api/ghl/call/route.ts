import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase, createServiceClient } from "@/lib/supabase/server";

// Initiate cold call via GoHighLevel
export async function POST(request: NextRequest) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { lead_id, phone_number, business_name, campaign_id } = await request.json();

  const ghlKey = process.env.GHL_API_KEY;
  if (!ghlKey) return NextResponse.json({ error: "GHL not configured" }, { status: 500 });

  const serviceSupabase = createServiceClient();

  // Get lead data
  let phone = phone_number;
  let name = business_name || "Lead";
  let leadIndustry = "";

  if (lead_id) {
    const { data: lead } = await serviceSupabase.from("leads").select("*").eq("id", lead_id).single();
    if (lead) {
      phone = lead.phone || phone_number;
      name = lead.business_name;
      leadIndustry = lead.industry || "";
    }
  }

  if (!phone) return NextResponse.json({ error: "No phone number" }, { status: 400 });

  try {
    // Step 1: Create or find contact in GHL
    const searchRes = await fetch(`https://services.leadconnectorhq.com/contacts/search/duplicate?phone=${encodeURIComponent(phone)}`, {
      headers: { Authorization: `Bearer ${ghlKey}`, Version: "2021-07-28" },
    });
    const searchData = await searchRes.json();
    let contactId = searchData.contact?.id;

    if (!contactId) {
      // Create new contact
      const createRes = await fetch("https://services.leadconnectorhq.com/contacts/", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${ghlKey}`,
          "Content-Type": "application/json",
          Version: "2021-07-28",
        },
        body: JSON.stringify({
          name,
          phone,
          tags: ["cold-call", "shortstack", leadIndustry].filter(Boolean),
          source: "ShortStack OS Cold Caller",
        }),
      });
      const createData = await createRes.json();
      contactId = createData.contact?.id;
    }

    if (!contactId) {
      return NextResponse.json({ error: "Failed to create GHL contact" }, { status: 500 });
    }

    // Step 2: Add to campaign/workflow if specified
    if (campaign_id) {
      await fetch(`https://services.leadconnectorhq.com/contacts/${contactId}/workflow/${campaign_id}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${ghlKey}`, Version: "2021-07-28" },
      });
    }

    // Step 3: Initiate call via GHL
    const callRes = await fetch("https://services.leadconnectorhq.com/conversations/messages", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${ghlKey}`,
        "Content-Type": "application/json",
        Version: "2021-07-28",
      },
      body: JSON.stringify({
        type: "Call",
        contactId,
      }),
    });
    const callData = await callRes.json();

    // Update lead status
    if (lead_id) {
      await serviceSupabase.from("leads").update({ status: "called" }).eq("id", lead_id);
    }

    // Log
    await serviceSupabase.from("trinity_log").insert({
      action_type: "lead_gen",
      description: `GHL cold call: ${name} (${phone})`,
      status: "completed",
      result: { contactId, phone, business: name, call: callData },
    });

    // Telegram notification
    try {
      const { sendTelegramMessage } = await import("@/lib/services/trinity");
      const chatId = process.env.TELEGRAM_CHAT_ID;
      if (chatId) {
        await sendTelegramMessage(chatId, `📞 *Cold Call Initiated via GHL*\n${name}\n${phone}\n${leadIndustry}`);
      }
    } catch (err) { console.error("[ghl/call] Telegram notify failed:", err); }

    return NextResponse.json({ success: true, contactId, phone, business: name });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
