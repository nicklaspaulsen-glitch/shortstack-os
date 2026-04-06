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
  const platforms: OutreachPlatform[] = ["instagram", "linkedin", "facebook", "tiktok"];

  for (const platform of platforms) {
    results[platform] = { sent: 0, failed: 0 };

    // Check how many DMs sent today
    const { count } = await supabase
      .from("outreach_log")
      .select("*", { count: "exact", head: true })
      .eq("platform", platform)
      .gte("sent_at", today);

    const remaining = DAILY_LIMITS[platform] - (count || 0);
    if (remaining <= 0) continue;

    // Get leads with social profiles for this platform
    const socialField = `${platform === "instagram" ? "instagram" : platform === "facebook" ? "facebook" : platform === "linkedin" ? "linkedin" : "tiktok"}_url`;

    const { data: leads } = await supabase
      .from("leads")
      .select("*")
      .not(socialField, "is", null)
      .eq("status", "new")
      .limit(remaining);

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

  // ── EMAIL OUTREACH — works even without social URLs ──
  let emailsSent = 0;
  const { data: emailLeads } = await supabase
    .from("leads")
    .select("*")
    .not("email", "is", null)
    .eq("status", "new")
    .limit(20);

  if (emailLeads && emailLeads.length > 0) {
    const ghlKey = process.env.GHL_API_KEY;
    const apiKey = process.env.ANTHROPIC_API_KEY;

    for (const lead of emailLeads) {
      // Generate personalized email
      let subject = `Quick question about ${lead.business_name}`;
      let body = `Hi,\n\nI came across ${lead.business_name} and I think we could help you get more clients through digital marketing.\n\nWould you be open to a quick chat?\n\nBest,\nThe ShortStack Team`;

      if (apiKey) {
        try {
          const aiRes = await fetch("https://api.anthropic.com/v1/messages", {
            method: "POST",
            headers: { "Content-Type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
            body: JSON.stringify({
              model: "claude-haiku-4-5-20251001",
              max_tokens: 300,
              messages: [{ role: "user", content: `Write a short cold email to ${lead.business_name} (${lead.industry || "business"}) pitching digital marketing services. Under 100 words. Return JSON: {"subject":"...","body":"..."}` }],
            }),
          });
          const aiData = await aiRes.json();
          const text = aiData.content?.[0]?.text || "";
          try {
            const parsed = JSON.parse(text.replace(/```json\n?/g, "").replace(/```/g, "").trim());
            subject = parsed.subject || subject;
            body = parsed.body || body;
          } catch {}
        } catch {}
      }

      // Send via GHL
      if (ghlKey) {
        try {
          // Create contact
          const contactRes = await fetch("https://services.leadconnectorhq.com/contacts/", {
            method: "POST",
            headers: { Authorization: `Bearer ${ghlKey}`, "Content-Type": "application/json", Version: "2021-07-28" },
            body: JSON.stringify({ name: lead.business_name, email: lead.email, phone: lead.phone || undefined, tags: ["cold-outreach", "cron"], source: "ShortStack OS" }),
          });
          const contact = await contactRes.json();
          const contactId = contact.contact?.id;

          if (contactId) {
            await fetch("https://services.leadconnectorhq.com/conversations/messages", {
              method: "POST",
              headers: { Authorization: `Bearer ${ghlKey}`, "Content-Type": "application/json", Version: "2021-07-28" },
              body: JSON.stringify({ type: "Email", contactId, subject, html: body.replace(/\n/g, "<br>") }),
            });
            emailsSent++;
          }
        } catch {}
      }

      // Log it
      await supabase.from("outreach_log").insert({
        lead_id: lead.id,
        platform: "email",
        business_name: lead.business_name,
        recipient_handle: lead.email,
        message_text: `Subject: ${subject}\n\n${body}`,
        status: ghlKey ? "sent" : "pending",
        metadata: { source: "daily_cron", ai_generated: !!apiKey },
      });

      // Update lead status
      await supabase.from("leads").update({ status: "called" }).eq("id", lead.id);

      await new Promise(r => setTimeout(r, 300));
    }
  }

  // Send summary to Telegram
  const totalDMs = Object.values(results).reduce((s, r) => s + r.sent, 0);
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (chatId) {
    const { sendTelegramMessage } = await import("@/lib/services/trinity");
    await sendTelegramMessage(chatId, `📨 *Daily Outreach Complete*\n\nDMs: ${totalDMs}\nEmails: ${emailsSent}\nFollow-ups: ${followUpsSent}\n\n${emailsSent > 0 ? `✅ ${emailsSent} cold emails sent` : "⚠️ No emails sent (check GHL key)"}`);
  }

  return NextResponse.json({
    success: true,
    results,
    emailsSent,
    followUpsSent,
    timestamp: new Date().toISOString(),
  });
}
