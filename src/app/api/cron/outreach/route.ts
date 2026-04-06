import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

export const maxDuration = 60;

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createServiceClient();
  const ghlKey = process.env.GHL_API_KEY;
  const locationId = process.env.GHL_LOCATION_ID || "";
  const chatId = process.env.TELEGRAM_CHAT_ID;
  let emailsSent = 0;
  let smsSent = 0;
  let callsQueued = 0;

  if (!ghlKey) {
    return NextResponse.json({ error: "GHL not configured" }, { status: 500 });
  }

  // Helper: create or find GHL contact
  async function getOrCreateContact(lead: { business_name: string; email?: string | null; phone?: string | null }) {
    try {
      const res = await fetch("https://services.leadconnectorhq.com/contacts/", {
        method: "POST",
        headers: { Authorization: `Bearer ${ghlKey}`, "Content-Type": "application/json", Version: "2021-07-28" },
        body: JSON.stringify({ locationId, name: lead.business_name, email: lead.email || undefined, phone: lead.phone || undefined, tags: ["cold-outreach", "shortstack-os"], source: "ShortStack OS" }),
      });
      const data = await res.json();
      return data.contact?.id || null;
    } catch { return null; }
  }

  // ═══════════════════════════════════════
  // 1. COLD EMAILS — 20 per day
  // ═══════════════════════════════════════
  const { data: emailLeads } = await supabase
    .from("leads")
    .select("id, business_name, email, phone, industry")
    .not("email", "is", null)
    .eq("status", "new")
    .limit(20);

  if (emailLeads) {
    const emailPromises = emailLeads.map(async (lead) => {
      const subject = `Quick question about ${lead.business_name}`;
      const body = `Hi,<br><br>I came across <b>${lead.business_name}</b> and noticed you might benefit from better online visibility.<br><br>We help ${lead.industry || "local"} businesses get more clients through social media, ads, and SEO.<br><br>Would you be open to a quick 10-minute call this week?<br><br>Best,<br>The ShortStack Team`;

      const contactId = await getOrCreateContact(lead);
      if (contactId) {
        try {
          await fetch("https://services.leadconnectorhq.com/conversations/messages", {
            method: "POST",
            headers: { Authorization: `Bearer ${ghlKey}`, "Content-Type": "application/json", Version: "2021-07-28" },
            body: JSON.stringify({ type: "Email", contactId, subject, html: body }),
          });
          emailsSent++;
        } catch {}
      }

      await supabase.from("outreach_log").insert({ lead_id: lead.id, platform: "email", business_name: lead.business_name, recipient_handle: lead.email, message_text: `Subject: ${subject}`, status: "sent" });
      await supabase.from("leads").update({ status: "called" }).eq("id", lead.id);
    });
    await Promise.all(emailPromises);
  }

  // ═══════════════════════════════════════
  // 2. COLD SMS — 20 per day
  // ═══════════════════════════════════════
  const { data: smsLeads } = await supabase
    .from("leads")
    .select("id, business_name, phone, industry")
    .not("phone", "is", null)
    .in("status", ["new", "called"])
    .limit(20);

  if (smsLeads) {
    const smsPromises = smsLeads.map(async (lead) => {
      const smsText = `Hi! I came across ${lead.business_name} and wanted to reach out. We help ${lead.industry || "local"} businesses get more clients through digital marketing. Would you be open to a quick chat? - ShortStack Team`;

      const contactId = await getOrCreateContact(lead);
      if (contactId) {
        try {
          await fetch("https://services.leadconnectorhq.com/conversations/messages", {
            method: "POST",
            headers: { Authorization: `Bearer ${ghlKey}`, "Content-Type": "application/json", Version: "2021-07-28" },
            body: JSON.stringify({ type: "SMS", contactId, message: smsText }),
          });
          smsSent++;
        } catch {}
      }

      await supabase.from("outreach_log").insert({ lead_id: lead.id, platform: "sms" as never, business_name: lead.business_name, recipient_handle: lead.phone, message_text: smsText, status: "sent" });
    });
    await Promise.all(smsPromises);
  }

  // ═══════════════════════════════════════
  // 3. COLD CALLS via GHL — queue up to 200
  // ═══════════════════════════════════════
  const { data: callLeads } = await supabase
    .from("leads")
    .select("id, business_name, phone, industry")
    .not("phone", "is", null)
    .eq("status", "new")
    .limit(200);

  if (callLeads) {
    // Create contacts in GHL (they'll be called via GHL workflow)
    for (const lead of callLeads) {
      const contactId = await getOrCreateContact(lead);
      if (contactId) {
        // Tag for calling workflow
        try {
          await fetch(`https://services.leadconnectorhq.com/contacts/${contactId}/tags`, {
            method: "POST",
            headers: { Authorization: `Bearer ${ghlKey}`, "Content-Type": "application/json", Version: "2021-07-28" },
            body: JSON.stringify({ tags: ["cold-call-queue"] }),
          });
          callsQueued++;
        } catch {}
      }
    }
  }

  // ═══════════════════════════════════════
  // 4. TELEGRAM BRIEFING
  // ═══════════════════════════════════════
  if (chatId) {
    const { sendTelegramMessage } = await import("@/lib/services/trinity");
    await sendTelegramMessage(chatId,
      `📨 *Daily Outreach Report*\n\n` +
      `✉️ Emails: ${emailsSent}/20 sent\n` +
      `💬 SMS: ${smsSent}/20 sent\n` +
      `📞 Calls: ${callsQueued} queued in GHL\n\n` +
      `${emailsSent >= 15 ? "🔥 Great outreach day!" : emailsSent >= 5 ? "✅ Outreach running" : "⚠️ Low volume — check GHL"}`
    );
  }

  return NextResponse.json({
    success: true,
    emailsSent,
    smsSent,
    callsQueued,
    timestamp: new Date().toISOString(),
  });
}
