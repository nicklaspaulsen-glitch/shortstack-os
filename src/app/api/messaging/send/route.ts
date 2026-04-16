import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

// Direct Messaging — Send SMS or social DMs to leads/clients from the dashboard
export async function POST(request: NextRequest) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { to_phone, to_email, message, channel, lead_id, client_id } = await request.json();

  const results: Record<string, boolean> = {};

  // SMS via GHL
  if (channel === "sms" && to_phone) {
    const ghlKey = process.env.GHL_API_KEY;
    if (ghlKey) {
      // Find or create GHL contact
      let contactId = null;
      if (lead_id) {
        const { data: lead } = await supabase.from("leads").select("ghl_contact_id").eq("id", lead_id).single();
        contactId = lead?.ghl_contact_id;
      }
      if (client_id) {
        const { data: client } = await supabase.from("clients").select("ghl_contact_id").eq("id", client_id).single();
        contactId = client?.ghl_contact_id;
      }

      if (contactId) {
        const res = await fetch("https://services.leadconnectorhq.com/conversations/messages", {
          method: "POST",
          headers: { Authorization: `Bearer ${ghlKey}`, "Content-Type": "application/json", Version: "2021-07-28" },
          body: JSON.stringify({ type: "SMS", contactId, message }),
        });
        results.sms = res.ok;
      }
    }
  }

  // Email via GHL
  if (channel === "email" && to_email) {
    const ghlKey = process.env.GHL_API_KEY;
    if (ghlKey) {
      let contactId = null;
      if (lead_id) {
        const { data: lead } = await supabase.from("leads").select("ghl_contact_id").eq("id", lead_id).single();
        contactId = lead?.ghl_contact_id;
      }
      if (client_id) {
        const { data: client } = await supabase.from("clients").select("ghl_contact_id").eq("id", client_id).single();
        contactId = client?.ghl_contact_id;
      }

      if (contactId) {
        const res = await fetch("https://services.leadconnectorhq.com/conversations/messages", {
          method: "POST",
          headers: { Authorization: `Bearer ${ghlKey}`, "Content-Type": "application/json", Version: "2021-07-28" },
          body: JSON.stringify({ type: "Email", contactId, html: `<p>${message}</p>`, subject: "Message from ShortStack", emailFrom: "growth@shortstack.work" }),
        });
        results.email = res.ok;
      }
    }
  }

  const anySent = Object.values(results).some(v => v);

  // Log the message
  await supabase.from("trinity_log").insert({
    action_type: "sms_campaign",
    description: `Message ${anySent ? "sent" : "failed"} via ${channel || "unknown"}: ${(message || "").substring(0, 50)}...`,
    client_id: client_id || null,
    status: anySent ? "completed" : "failed",
    result: { channel, results },
    completed_at: new Date().toISOString(),
  });

  return NextResponse.json({ success: anySent, results, error: anySent ? undefined : "No message was sent — missing channel, contact ID, or service config" });
}
