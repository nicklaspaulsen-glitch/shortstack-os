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
  const aiKey = process.env.ANTHROPIC_API_KEY;

  const { data: emailLeads } = await supabase
    .from("leads")
    .select("*")
    .not("email", "is", null)
    .eq("status", "new")
    .limit(5); // Start with 5 to stay within timeout

  if (emailLeads) {
    for (const lead of emailLeads) {
      let subject = `Quick question about ${lead.business_name}`;
      let body = `Hi,\n\nI came across ${lead.business_name} and think we could help you get more clients.\n\nWould you be open to a quick chat?\n\nBest,\nThe ShortStack Team`;

      if (aiKey) {
        try {
          const aiRes = await fetch("https://api.anthropic.com/v1/messages", {
            method: "POST",
            headers: { "Content-Type": "application/json", "x-api-key": aiKey, "anthropic-version": "2023-06-01" },
            body: JSON.stringify({ model: "claude-haiku-4-5-20251001", max_tokens: 200, messages: [{ role: "user", content: `Write a 50-word cold email to ${lead.business_name} (${lead.industry || "business"}). Return JSON: {"subject":"...","body":"..."}` }] }),
          });
          const aiData = await aiRes.json();
          try { const p = JSON.parse((aiData.content?.[0]?.text || "").replace(/```json\n?/g, "").replace(/```/g, "").trim()); subject = p.subject || subject; body = p.body || body; } catch {}
        } catch {}
      }

      if (ghlKey) {
        try {
          const cRes = await fetch("https://services.leadconnectorhq.com/contacts/", { method: "POST", headers: { Authorization: `Bearer ${ghlKey}`, "Content-Type": "application/json", Version: "2021-07-28" }, body: JSON.stringify({ name: lead.business_name, email: lead.email, phone: lead.phone || undefined, tags: ["cold-outreach"], source: "ShortStack OS" }) });
          const contact = await cRes.json();
          if (contact.contact?.id) {
            await fetch("https://services.leadconnectorhq.com/conversations/messages", { method: "POST", headers: { Authorization: `Bearer ${ghlKey}`, "Content-Type": "application/json", Version: "2021-07-28" }, body: JSON.stringify({ type: "Email", contactId: contact.contact.id, subject, html: body.replace(/\n/g, "<br>") }) });
            emailsSent++;
          }
        } catch {}
      }

      await supabase.from("outreach_log").insert({ lead_id: lead.id, platform: "email", business_name: lead.business_name, recipient_handle: lead.email, message_text: `Subject: ${subject}\n\n${body}`, status: ghlKey ? "sent" : "pending", metadata: { source: "daily_cron" } });
      await supabase.from("leads").update({ status: "called" }).eq("id", lead.id);
    }
  }

  // Send Telegram notification immediately
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (chatId) {
    const { sendTelegramMessage } = await import("@/lib/services/trinity");
    await sendTelegramMessage(chatId, `📨 *Outreach Cron*\n\n✉️ Emails: ${emailsSent}/${emailLeads?.length || 0}\n\n${emailsSent > 0 ? "✅ Outreach running" : "⚠️ Check GHL key"}`);
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
