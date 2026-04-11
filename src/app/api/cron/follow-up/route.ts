import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

export const maxDuration = 300;

// Follow-Up Agent — sends 2nd touch (day 3) and 3rd touch (day 6) to non-responders
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createServiceClient();
  const ghlKey = process.env.GHL_API_KEY;
  const locationId = process.env.GHL_LOCATION_ID || "";
  const now = new Date();
  let followUpsSent = 0;
  let finalTouchSent = 0;

  if (!ghlKey) return NextResponse.json({ error: "GHL not configured" }, { status: 500 });

  // Load message style from settings
  let messageStyle = "friendly";
  try {
    const { data: settingsRow } = await supabase
      .from("system_health")
      .select("metadata")
      .eq("integration_name", "agent_settings")
      .single();
    if (settingsRow?.metadata) {
      const settings = settingsRow.metadata as Record<string, Record<string, unknown>>;
      messageStyle = (settings.outreach?.message_style as string) || "friendly";
    }
  } catch {}

  // ═══════════════════════════════════════
  // 2ND TOUCH — 3 days after first outreach
  // ═══════════════════════════════════════
  const threeDaysAgo = new Date(now.getTime() - 3 * 86400000).toISOString();
  const fourDaysAgo = new Date(now.getTime() - 4 * 86400000).toISOString();

  // Find leads that were contacted ~3 days ago and haven't replied
  const { data: secondTouchLeads } = await supabase
    .from("outreach_log")
    .select("lead_id, business_name, recipient_handle, platform")
    .eq("status", "sent")
    .lt("created_at", threeDaysAgo)
    .gt("created_at", fourDaysAgo)
    .limit(30);

  if (secondTouchLeads) {
    // Filter out leads that already got a follow-up
    const leadIds = secondTouchLeads.map(l => l.lead_id).filter(Boolean);
    const { data: alreadyFollowedUp } = await supabase
      .from("outreach_log")
      .select("lead_id")
      .in("lead_id", leadIds.length > 0 ? leadIds : ["none"])
      .eq("status", "follow_up_2");

    const followedUpIds = new Set((alreadyFollowedUp || []).map(l => l.lead_id));
    const needsFollowUp = secondTouchLeads.filter(l => l.lead_id && !followedUpIds.has(l.lead_id));

    // Also filter out leads that replied
    const { data: repliedLeads } = await supabase
      .from("leads")
      .select("id")
      .in("id", needsFollowUp.map(l => l.lead_id).filter(Boolean))
      .in("status", ["replied", "booked", "converted", "not_interested"]);

    const repliedIds = new Set((repliedLeads || []).map(l => l.id));
    const toFollowUp = needsFollowUp.filter(l => !repliedIds.has(l.lead_id));

    for (const lead of toFollowUp) {
      if (!lead.recipient_handle) continue;

      const isEmail = lead.platform === "email";
      const subject = `Re: Quick question about ${lead.business_name}`;
      const emailBody = messageStyle === "professional"
        ? `Hi,<br><br>I wanted to follow up on my previous message about ${lead.business_name}. We've helped similar businesses increase their client base by 40-60% through digital marketing.<br><br>Would you have 10 minutes this week for a quick call? No pressure at all.<br><br>Best,<br>The ShortStack Team`
        : messageStyle === "bold"
        ? `Hey! Just bumping this — didn't want my last message to get buried 😅<br><br>We're helping ${lead.business_name}-type businesses crush it online right now. 10 min call, I'll show you exactly how.<br><br>Worth a shot?<br><br>— ShortStack Team`
        : `Hi! Just following up on my earlier message. I know things get busy!<br><br>We genuinely think we could help ${lead.business_name} get more clients. Happy to share some ideas over a quick call — no strings attached.<br><br>Let me know! 😊<br><br>— ShortStack Team`;

      const smsBody = `Hey! Following up about ${lead.business_name}. We help businesses like yours get more clients through digital marketing. Would a quick chat work this week? - ShortStack`;

      if (isEmail) {
        try {
          // Find or create GHL contact
          const contactRes = await fetch("https://services.leadconnectorhq.com/contacts/", {
            method: "POST",
            headers: { Authorization: `Bearer ${ghlKey}`, "Content-Type": "application/json", Version: "2021-07-28" },
            body: JSON.stringify({ locationId, email: lead.recipient_handle, name: lead.business_name, tags: ["follow-up-2"] }),
          });
          const contactData = await contactRes.json();
          const contactId = contactData.contact?.id;

          if (contactId) {
            await fetch("https://services.leadconnectorhq.com/conversations/messages", {
              method: "POST",
              headers: { Authorization: `Bearer ${ghlKey}`, "Content-Type": "application/json", Version: "2021-07-28" },
              body: JSON.stringify({ type: "Email", contactId, subject, html: emailBody }),
            });
            followUpsSent++;
          }
        } catch {}
      } else if (lead.platform === "sms" && lead.recipient_handle) {
        try {
          const contactRes = await fetch("https://services.leadconnectorhq.com/contacts/", {
            method: "POST",
            headers: { Authorization: `Bearer ${ghlKey}`, "Content-Type": "application/json", Version: "2021-07-28" },
            body: JSON.stringify({ locationId, phone: lead.recipient_handle, name: lead.business_name, tags: ["follow-up-2"] }),
          });
          const contactData = await contactRes.json();
          const contactId = contactData.contact?.id;

          if (contactId) {
            await fetch("https://services.leadconnectorhq.com/conversations/messages", {
              method: "POST",
              headers: { Authorization: `Bearer ${ghlKey}`, "Content-Type": "application/json", Version: "2021-07-28" },
              body: JSON.stringify({ type: "SMS", contactId, message: smsBody }),
            });
            followUpsSent++;
          }
        } catch {}
      }

      // Log the follow-up
      await supabase.from("outreach_log").insert({
        lead_id: lead.lead_id,
        platform: lead.platform,
        business_name: lead.business_name,
        recipient_handle: lead.recipient_handle,
        message_text: isEmail ? `[Follow-up 2] ${subject}` : `[Follow-up 2] ${smsBody}`,
        status: "follow_up_2",
      });
    }
  }

  // ═══════════════════════════════════════
  // 3RD TOUCH (FINAL) — 6 days after first outreach
  // ═══════════════════════════════════════
  const sixDaysAgo = new Date(now.getTime() - 6 * 86400000).toISOString();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 86400000).toISOString();

  const { data: thirdTouchLeads } = await supabase
    .from("outreach_log")
    .select("lead_id, business_name, recipient_handle, platform")
    .eq("status", "follow_up_2")
    .lt("created_at", sixDaysAgo)
    .gt("created_at", sevenDaysAgo)
    .limit(30);

  if (thirdTouchLeads) {
    const leadIds = thirdTouchLeads.map(l => l.lead_id).filter(Boolean);
    const { data: alreadyFinal } = await supabase
      .from("outreach_log")
      .select("lead_id")
      .in("lead_id", leadIds.length > 0 ? leadIds : ["none"])
      .eq("status", "follow_up_3");

    const finalIds = new Set((alreadyFinal || []).map(l => l.lead_id));

    const { data: repliedLeads } = await supabase
      .from("leads")
      .select("id")
      .in("id", leadIds.length > 0 ? leadIds : ["none"])
      .in("status", ["replied", "booked", "converted", "not_interested"]);

    const repliedIds = new Set((repliedLeads || []).map(l => l.id));
    const toFinalTouch = thirdTouchLeads.filter(l => l.lead_id && !finalIds.has(l.lead_id) && !repliedIds.has(l.lead_id));

    for (const lead of toFinalTouch) {
      if (!lead.recipient_handle) continue;

      const isEmail = lead.platform === "email";
      const subject = `Last note about ${lead.business_name}`;
      const emailBody = `Hi,<br><br>This is my last follow-up — I don't want to be a bother! Just wanted to make sure you saw my previous messages about helping ${lead.business_name} grow online.<br><br>If the timing isn't right, no worries at all. But if you'd ever like to chat about getting more clients through digital marketing, we're here.<br><br>Wishing you all the best!<br><br>— The ShortStack Team`;
      const smsBody = `Last follow-up about ${lead.business_name}! If you're ever interested in getting more clients through digital marketing, just reply here. No pressure! - ShortStack`;

      if (isEmail) {
        try {
          const contactRes = await fetch("https://services.leadconnectorhq.com/contacts/", {
            method: "POST",
            headers: { Authorization: `Bearer ${ghlKey}`, "Content-Type": "application/json", Version: "2021-07-28" },
            body: JSON.stringify({ locationId, email: lead.recipient_handle, name: lead.business_name, tags: ["follow-up-3-final"] }),
          });
          const contactData = await contactRes.json();
          const contactId = contactData.contact?.id;

          if (contactId) {
            await fetch("https://services.leadconnectorhq.com/conversations/messages", {
              method: "POST",
              headers: { Authorization: `Bearer ${ghlKey}`, "Content-Type": "application/json", Version: "2021-07-28" },
              body: JSON.stringify({ type: "Email", contactId, subject, html: emailBody }),
            });
            finalTouchSent++;
          }
        } catch {}
      } else if (lead.platform === "sms") {
        try {
          const contactRes = await fetch("https://services.leadconnectorhq.com/contacts/", {
            method: "POST",
            headers: { Authorization: `Bearer ${ghlKey}`, "Content-Type": "application/json", Version: "2021-07-28" },
            body: JSON.stringify({ locationId, phone: lead.recipient_handle, name: lead.business_name, tags: ["follow-up-3-final"] }),
          });
          const contactData = await contactRes.json();
          const contactId = contactData.contact?.id;

          if (contactId) {
            await fetch("https://services.leadconnectorhq.com/conversations/messages", {
              method: "POST",
              headers: { Authorization: `Bearer ${ghlKey}`, "Content-Type": "application/json", Version: "2021-07-28" },
              body: JSON.stringify({ type: "SMS", contactId, message: smsBody }),
            });
            finalTouchSent++;
          }
        } catch {}
      }

      await supabase.from("outreach_log").insert({
        lead_id: lead.lead_id,
        platform: lead.platform,
        business_name: lead.business_name,
        recipient_handle: lead.recipient_handle,
        message_text: isEmail ? `[Final touch] ${subject}` : `[Final touch] ${smsBody}`,
        status: "follow_up_3",
      });
    }
  }

  // Add follow_up statuses to outreach_log if needed
  // Telegram report
  if (followUpsSent > 0 || finalTouchSent > 0) {
    try {
      const chatId = process.env.TELEGRAM_CHAT_ID;
      if (chatId) {
        const { sendTelegramMessage } = await import("@/lib/services/trinity");
        await sendTelegramMessage(chatId,
          `🔄 *Follow-Up Agent Report*\n\n` +
          `📩 2nd touch sent: ${followUpsSent}\n` +
          `👋 Final (3rd) touch sent: ${finalTouchSent}\n\n` +
          `Leads that don't reply after 3 touches get marked as no-response.`
        );
      }
    } catch {}
  }

  return NextResponse.json({
    success: true,
    followUpsSent,
    finalTouchSent,
    timestamp: now.toISOString(),
  });
}
