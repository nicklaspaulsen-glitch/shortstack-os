import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import {
  generatePersonalizedMessage,
  generateFollowUpMessage,
  sendInstagramDM,
  sendLinkedInMessage,
  sendFacebookMessage,
  sendTikTokMessage,
  DAILY_LIMITS,
} from "@/lib/services/outreach";
import { OutreachPlatform } from "@/lib/types";

export const maxDuration = 300;

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createServiceClient();
  const today = new Date().toISOString().split("T")[0];
  const results: Record<string, { sent: number; failed: number }> = {};

  // ══ EMAIL OUTREACH FIRST (most leads have emails, not social URLs) ══
  let emailsSent = 0;
  const ghlKey = process.env.GHL_API_KEY;

  // Get 3 leads (fast, under 10s Hobby limit)
  const { data: emailLeads } = await supabase
    .from("leads")
    .select("id, business_name, email, phone, industry")
    .not("email", "is", null)
    .eq("status", "new")
    .limit(3);

  if (emailLeads && ghlKey) {
    // Fire all 3 in parallel for speed
    const promises = emailLeads.map(async (lead) => {
      const subject = `Quick question about ${lead.business_name}`;
      const body = `Hi,<br><br>I came across <b>${lead.business_name}</b> and noticed you might benefit from better online visibility.<br><br>We help ${lead.industry || "local"} businesses get more clients through social media, ads, and SEO.<br><br>Would you be open to a quick 10-minute call this week?<br><br>Best,<br>The ShortStack Team`;

      try {
        const locationId = process.env.GHL_LOCATION_ID || "";
        const cRes = await fetch("https://services.leadconnectorhq.com/contacts/", { method: "POST", headers: { Authorization: `Bearer ${ghlKey}`, "Content-Type": "application/json", Version: "2021-07-28" }, body: JSON.stringify({ locationId, name: lead.business_name, email: lead.email, phone: lead.phone || undefined, tags: ["cold-outreach"], source: "ShortStack OS" }) });
        const contact = await cRes.json();
        if (contact.contact?.id) {
          await fetch("https://services.leadconnectorhq.com/conversations/messages", { method: "POST", headers: { Authorization: `Bearer ${ghlKey}`, "Content-Type": "application/json", Version: "2021-07-28" }, body: JSON.stringify({ type: "Email", contactId: contact.contact.id, subject, html: body }) });
          emailsSent++;
        }
      } catch {}

      await supabase.from("outreach_log").insert({ lead_id: lead.id, platform: "email", business_name: lead.business_name, recipient_handle: lead.email, message_text: `Subject: ${subject}\n\n${body}`, status: "sent", metadata: { source: "daily_cron" } });
      await supabase.from("leads").update({ status: "called" }).eq("id", lead.id);
    });

    await Promise.all(promises);
  }

  // Telegram notification
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (chatId) {
    const { sendTelegramMessage } = await import("@/lib/services/trinity");
    await sendTelegramMessage(chatId, `📨 *Outreach*\n✉️ ${emailsSent} emails sent\n📊 ${emailLeads?.length || 0} leads processed`);
  }

  // ══ DM OUTREACH (only if leads have social URLs) ══
  const platforms: OutreachPlatform[] = ["instagram", "linkedin", "facebook", "tiktok"];

  for (const platform of platforms) {
    results[platform] = { sent: 0, failed: 0 };

    const socialField = `${platform}_url`;
    const { data: leads } = await supabase
      .from("leads")
      .select("*")
      .not(socialField, "is", null)
      .eq("status", "new")
      .limit(DAILY_LIMITS[platform]);

    if (!leads) continue;

    for (const lead of leads) {
      const message = await generatePersonalizedMessage(
        platform,
        lead.business_name,
        lead.industry || "business",
        lead.owner_name
      );

      const handle = lead[`${platform === "instagram" ? "instagram" : platform === "facebook" ? "facebook" : platform === "linkedin" ? "linkedin" : "tiktok"}_url` as keyof typeof lead] as string;

      // Send via platform API
      let sendResult;
      switch (platform) {
        case "instagram":
          sendResult = await sendInstagramDM(handle, message);
          break;
        case "linkedin":
          sendResult = await sendLinkedInMessage(handle, message);
          break;
        case "facebook":
          sendResult = await sendFacebookMessage(handle, message);
          break;
        case "tiktok":
          sendResult = await sendTikTokMessage(handle, message);
          break;
      }

      // Log outreach
      const { data: outreachEntry } = await supabase
        .from("outreach_log")
        .insert({
          lead_id: lead.id,
          platform,
          business_name: lead.business_name,
          recipient_handle: handle,
          message_text: message,
          status: sendResult.success ? "sent" : "bounced",
        })
        .select("id")
        .single();

      if (sendResult.success && outreachEntry) {
        results[platform].sent++;

        // Schedule follow-ups: Day 3 and Day 7
        const day3 = new Date();
        day3.setDate(day3.getDate() + 3);
        const day7 = new Date();
        day7.setDate(day7.getDate() + 7);

        await supabase.from("follow_up_queue").insert([
          {
            outreach_id: outreachEntry.id,
            lead_id: lead.id,
            platform,
            followup_number: 1,
            scheduled_date: day3.toISOString().split("T")[0],
            status: "pending",
          },
          {
            outreach_id: outreachEntry.id,
            lead_id: lead.id,
            platform,
            followup_number: 2,
            scheduled_date: day7.toISOString().split("T")[0],
            status: "pending",
          },
        ]);
      } else {
        results[platform].failed++;
      }

      await new Promise((r) => setTimeout(r, 500)); // Rate limit
    }
  }

  // Process follow-ups due today
  const { data: dueFollowUps } = await supabase
    .from("follow_up_queue")
    .select("*, outreach_log(*)")
    .eq("status", "pending")
    .lte("scheduled_date", today)
    .limit(50);

  let followUpsSent = 0;

  if (dueFollowUps) {
    for (const fu of dueFollowUps) {
      // Check if lead already replied
      const { data: outreach } = await supabase
        .from("outreach_log")
        .select("status, message_text, business_name")
        .eq("id", fu.outreach_id)
        .single();

      if (outreach?.status === "replied") {
        await supabase.from("follow_up_queue").update({ status: "cancelled" }).eq("id", fu.id);
        continue;
      }

      const message = await generateFollowUpMessage(
        fu.platform,
        outreach?.business_name || "your business",
        fu.followup_number,
        outreach?.message_text || ""
      );

      await supabase.from("follow_up_queue").update({
        status: "sent",
        message_text: message,
        sent_at: new Date().toISOString(),
      }).eq("id", fu.id);

      followUpsSent++;
    }
  }

  return NextResponse.json({
    success: true,
    results,
    emailsSent,
    followUpsSent,
    timestamp: new Date().toISOString(),
  });
}
