import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

export const maxDuration = 300;

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
  let igDmsSent = 0;
  let fbDmsSent = 0;

  if (!ghlKey) {
    return NextResponse.json({ error: "GHL not configured" }, { status: 500 });
  }

  // Load agent settings from DB (set via Agent Controls page)
  let emailLimit = 20;
  let smsLimit = 20;
  let callLimit = 200;
  let igDmLimit = 20;
  let fbDmLimit = 20;
  let messageStyle = "friendly";
  let goalMode = false;
  let weeklyReplyGoal = 10;
  let weeklyBookingGoal = 5;
  try {
    const { data: settingsRow } = await supabase
      .from("system_health")
      .select("metadata")
      .eq("integration_name", "agent_settings")
      .single();
    if (settingsRow?.metadata) {
      const settings = settingsRow.metadata as Record<string, Record<string, unknown>>;
      emailLimit = (settings.outreach?.emails_per_day as number) || 20;
      smsLimit = (settings.outreach?.sms_per_day as number) || 20;
      callLimit = (settings.outreach?.calls_per_day as number) || 200;
      igDmLimit = (settings.outreach?.ig_dms_per_day as number) || 20;
      fbDmLimit = (settings.outreach?.fb_dms_per_day as number) || 20;
      messageStyle = (settings.outreach?.message_style as string) || "friendly";
      goalMode = (settings.outreach?.goal_mode as boolean) || false;
      weeklyReplyGoal = (settings.outreach?.weekly_reply_goal as number) || 10;
      weeklyBookingGoal = (settings.outreach?.weekly_booking_goal as number) || 5;
    }
  } catch {}

  // Goal Mode: auto-scale outreach volume based on this week's progress
  let goalMultiplier = 1;
  if (goalMode) {
    const weekStart = new Date();
    weekStart.setDate(weekStart.getDate() - weekStart.getDay()); // Sunday
    weekStart.setHours(0, 0, 0, 0);

    // Count this week's replies (leads that moved to "replied" status)
    const { count: weeklyReplies } = await supabase
      .from("outreach_log")
      .select("id", { count: "exact", head: true })
      .eq("status", "replied")
      .gte("created_at", weekStart.toISOString());

    // Count this week's bookings (leads with status "booked")
    const { count: weeklyBookings } = await supabase
      .from("leads")
      .select("id", { count: "exact", head: true })
      .eq("status", "booked")
      .gte("updated_at", weekStart.toISOString());

    const replies = weeklyReplies || 0;
    const bookings = weeklyBookings || 0;
    const replyProgress = weeklyReplyGoal > 0 ? replies / weeklyReplyGoal : 1;
    const bookingProgress = weeklyBookingGoal > 0 ? bookings / weeklyBookingGoal : 1;
    const progress = Math.min(replyProgress, bookingProgress);

    // Days left in the week (Mon=1 through Fri=5)
    const dayOfWeek = new Date().getDay(); // 0=Sun, 6=Sat
    const daysLeft = Math.max(1, 5 - Math.max(0, dayOfWeek - 1));

    if (progress >= 1) {
      // Goal already met — scale down to maintenance level (50%)
      goalMultiplier = 0.5;
    } else if (progress < 0.3 && daysLeft <= 2) {
      // Way behind with little time left — aggressive push (2.5x)
      goalMultiplier = 2.5;
    } else if (progress < 0.5) {
      // Behind target — increase volume (1.8x)
      goalMultiplier = 1.8;
    } else if (progress < 0.8) {
      // Slightly behind — small boost (1.3x)
      goalMultiplier = 1.3;
    }
    // else: on track, keep default (1x)

    emailLimit = Math.round(emailLimit * goalMultiplier);
    smsLimit = Math.round(smsLimit * goalMultiplier);
    callLimit = Math.round(callLimit * goalMultiplier);
    igDmLimit = Math.round(igDmLimit * goalMultiplier);
    fbDmLimit = Math.round(fbDmLimit * goalMultiplier);
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
  // 1. COLD EMAILS
  // ═══════════════════════════════════════
  const { data: emailLeads } = await supabase
    .from("leads")
    .select("id, business_name, email, phone, industry")
    .not("email", "is", null)
    .eq("status", "new")
    .order("lead_score", { ascending: false, nullsFirst: false })
    .limit(emailLimit);

  if (emailLeads) {
    const emailPromises = emailLeads.map(async (lead) => {
      const subject = `Quick question about ${lead.business_name}`;
      const body = `Hi,<br><br>I came across <b>${lead.business_name}</b> and noticed you might benefit from better online visibility.<br><br>We help ${lead.industry || "local"} businesses get more clients through social media, ads, and SEO.<br><br>Would you be open to a quick 10-minute call this week?<br><br>Best,<br>The ShortStack Team`;

      const contactId = await getOrCreateContact(lead);
      let delivered = false;
      if (contactId) {
        try {
          const res = await fetch("https://services.leadconnectorhq.com/conversations/messages", {
            method: "POST",
            headers: { Authorization: `Bearer ${ghlKey}`, "Content-Type": "application/json", Version: "2021-07-28" },
            body: JSON.stringify({ type: "Email", contactId, subject, html: body }),
          });
          if (res.ok) { emailsSent++; delivered = true; }
        } catch {}
      }

      await supabase.from("outreach_log").insert({ lead_id: lead.id, platform: "email", business_name: lead.business_name, recipient_handle: lead.email, message_text: `Subject: ${subject}`, status: delivered ? "sent" : "failed" });
      if (delivered) await supabase.from("leads").update({ status: "contacted" }).eq("id", lead.id).in("status", ["new"]);
    });
    await Promise.all(emailPromises);
  }

  // ═══════════════════════════════════════
  // 2. COLD SMS
  // ═══════════════════════════════════════
  // Dedup: skip leads that received SMS in the last 48h
  const smsCutoff = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
  const { data: recentSms } = await supabase
    .from("outreach_log")
    .select("lead_id")
    .eq("platform", "sms")
    .gte("created_at", smsCutoff);
  const recentSmsIds = new Set((recentSms || []).map(s => s.lead_id).filter(Boolean));

  const { data: smsLeadsRaw } = await supabase
    .from("leads")
    .select("id, business_name, phone, industry")
    .not("phone", "is", null)
    .in("status", ["new", "called"])
    .limit(smsLimit * 2);
  const smsLeads = (smsLeadsRaw || []).filter(l => !recentSmsIds.has(l.id)).slice(0, smsLimit);

  if (smsLeads) {
    const smsPromises = smsLeads.map(async (lead) => {
      const smsText = `Hi! I came across ${lead.business_name} and wanted to reach out. We help ${lead.industry || "local"} businesses get more clients through digital marketing. Would you be open to a quick chat? - ShortStack Team`;

      const contactId = await getOrCreateContact(lead);
      let delivered = false;
      if (contactId) {
        try {
          const res = await fetch("https://services.leadconnectorhq.com/conversations/messages", {
            method: "POST",
            headers: { Authorization: `Bearer ${ghlKey}`, "Content-Type": "application/json", Version: "2021-07-28" },
            body: JSON.stringify({ type: "SMS", contactId, message: smsText }),
          });
          if (res.ok) { smsSent++; delivered = true; }
        } catch {}
      }

      await supabase.from("outreach_log").insert({ lead_id: lead.id, platform: "sms", business_name: lead.business_name, recipient_handle: lead.phone, message_text: smsText, status: delivered ? "sent" : "failed" });
    });
    await Promise.all(smsPromises);
  }

  // ═══════════════════════════════════════
  // 3. COLD CALLS via GHL
  // ═══════════════════════════════════════
  const { data: callLeads } = await supabase
    .from("leads")
    .select("id, business_name, phone, industry")
    .not("phone", "is", null)
    .eq("status", "new")
    .limit(callLimit);

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
  // 4a. ENRICH — find social profiles for leads missing them
  // ═══════════════════════════════════════
  if (igDmLimit > 0 || fbDmLimit > 0) {
    const { data: unenrichedLeads } = await supabase
      .from("leads")
      .select("id, website, instagram_url, facebook_url")
      .not("website", "is", null)
      .is("instagram_url", null)
      .in("status", ["new", "called"])
      .limit(15);

    if (unenrichedLeads) {
      const { scrapeWebsiteForSocials } = await import("@/lib/services/lead-scraper");
      await Promise.all(unenrichedLeads.map(async (lead) => {
        if (!lead.website) return;
        try {
          const socials = await scrapeWebsiteForSocials(lead.website);
          const updates: Record<string, string> = {};
          if (socials.instagram_url) updates.instagram_url = socials.instagram_url;
          if (socials.facebook_url && !lead.facebook_url) updates.facebook_url = socials.facebook_url;
          if (Object.keys(updates).length > 0) {
            await supabase.from("leads").update(updates).eq("id", lead.id);
          }
        } catch {}
      }));
    }
  }

  // ═══════════════════════════════════════
  // 4b. INSTAGRAM DMs (via Meta Messaging API)
  // ═══════════════════════════════════════
  if (igDmLimit > 0) {
    // Get connected Instagram account
    const { data: igAccount } = await supabase
      .from("social_accounts")
      .select("account_id, access_token, metadata")
      .eq("platform", "instagram")
      .eq("is_active", true)
      .single();

    if (igAccount?.access_token) {
      // Find leads with instagram_url that haven't been DM'd
      const { data: igLeads } = await supabase
        .from("leads")
        .select("id, business_name, instagram_url, industry")
        .not("instagram_url", "is", null)
        .in("status", ["new", "called"])
        .limit(igDmLimit);

      if (igLeads) {
        for (const lead of igLeads) {
          // Extract IG username from URL
          const igHandle = lead.instagram_url?.replace(/\/$/, "").split("/").pop() || "";
          if (!igHandle) continue;

          const dmText = messageStyle === "professional"
            ? `Hi! I noticed ${lead.business_name} and was impressed by what you're building. We specialize in helping ${lead.industry || "local"} businesses grow their online presence and get more clients. Would you be open to a quick conversation about how we could help?`
            : messageStyle === "bold"
            ? `Hey! Love what ${lead.business_name} is doing 🔥 We help ${lead.industry || "local"} businesses get 2-3x more clients with digital marketing. Want to hear how? Takes 10 min.`
            : `Hey! I came across ${lead.business_name} and really like what you're doing. We help ${lead.industry || "local"} businesses get more clients through social media and digital marketing. Would you be up for a quick chat? 😊`;

          try {
            // Look up Instagram user ID by username via Meta Graph API
            const userSearchRes = await fetch(
              `https://graph.facebook.com/v19.0/${igAccount.metadata && (igAccount.metadata as Record<string, string>).page_id || igAccount.account_id}?fields=business_discovery.fields(ig_id,username)&business_discovery.username=${igHandle}`,
              { headers: { Authorization: `Bearer ${igAccount.access_token}` } }
            );
            const userSearchData = await userSearchRes.json();
            const recipientIgId = userSearchData?.business_discovery?.ig_id;

            if (recipientIgId) {
              // Send DM via Instagram Messaging API
              const sendRes = await fetch(
                `https://graph.facebook.com/v19.0/${igAccount.account_id}/messages`,
                {
                  method: "POST",
                  headers: { Authorization: `Bearer ${igAccount.access_token}`, "Content-Type": "application/json" },
                  body: JSON.stringify({
                    recipient: { id: recipientIgId },
                    message: { text: dmText },
                  }),
                }
              );

              if (sendRes.ok) {
                igDmsSent++;
                await supabase.from("outreach_log").insert({
                  lead_id: lead.id,
                  platform: "instagram_dm",
                  business_name: lead.business_name,
                  recipient_handle: `@${igHandle}`,
                  message_text: dmText,
                  status: "sent",
                });
              }
            }
          } catch {}

          // Also create/tag contact in GHL for tracking
          const contactId = await getOrCreateContact({ business_name: lead.business_name });
          if (contactId) {
            try {
              await fetch(`https://services.leadconnectorhq.com/contacts/${contactId}/tags`, {
                method: "POST",
                headers: { Authorization: `Bearer ${ghlKey}`, "Content-Type": "application/json", Version: "2021-07-28" },
                body: JSON.stringify({ tags: ["ig-dm-sent"] }),
              });
            } catch {}
          }
        }
      }
    }
  }

  // ═══════════════════════════════════════
  // 5. FACEBOOK DMs (via Page Conversations API)
  // ═══════════════════════════════════════
  if (fbDmLimit > 0) {
    // Get connected Facebook page
    const { data: fbAccount } = await supabase
      .from("social_accounts")
      .select("account_id, access_token, metadata")
      .eq("platform", "facebook")
      .eq("is_active", true)
      .single();

    if (fbAccount?.access_token) {
      const pageId = (fbAccount.metadata as Record<string, string>)?.page_id || fbAccount.account_id;

      // Find leads with facebook_url that haven't been DM'd
      const { data: fbLeads } = await supabase
        .from("leads")
        .select("id, business_name, facebook_url, industry")
        .not("facebook_url", "is", null)
        .in("status", ["new", "called"])
        .limit(fbDmLimit);

      if (fbLeads) {
        for (const lead of fbLeads) {
          const dmText = messageStyle === "professional"
            ? `Hi! I came across ${lead.business_name} on Facebook and was impressed. We help ${lead.industry || "local"} businesses grow their client base through targeted digital marketing. Would you be interested in a brief conversation about how we could help your business grow?`
            : messageStyle === "bold"
            ? `Hey ${lead.business_name}! 👋 We help ${lead.industry || "local"} businesses get way more clients with ads and social media. Want to see how? Quick 10-min call.`
            : `Hey! I found ${lead.business_name} on Facebook and love what you do. We help ${lead.industry || "local"} businesses get more clients through digital marketing. Would you be open to a quick chat? 😊`;

          try {
            // Send message via Facebook Page Conversations API
            // Note: This works for pages that have messaging enabled
            const fbPageUrl = lead.facebook_url || "";
            const fbPageId = fbPageUrl.replace(/\/$/, "").split("/").pop() || "";

            if (fbPageId) {
              const sendRes = await fetch(
                `https://graph.facebook.com/v19.0/${pageId}/messages`,
                {
                  method: "POST",
                  headers: { Authorization: `Bearer ${fbAccount.access_token}`, "Content-Type": "application/json" },
                  body: JSON.stringify({
                    recipient: { id: fbPageId },
                    message: { text: dmText },
                    messaging_type: "MESSAGE_TAG",
                    tag: "CONFIRMED_EVENT_UPDATE",
                  }),
                }
              );

              if (sendRes.ok) {
                fbDmsSent++;
                await supabase.from("outreach_log").insert({
                  lead_id: lead.id,
                  platform: "facebook_dm",
                  business_name: lead.business_name,
                  recipient_handle: fbPageId,
                  message_text: dmText,
                  status: "sent",
                });
              }
            }
          } catch {}

          // Tag in GHL
          const contactId = await getOrCreateContact({ business_name: lead.business_name });
          if (contactId) {
            try {
              await fetch(`https://services.leadconnectorhq.com/contacts/${contactId}/tags`, {
                method: "POST",
                headers: { Authorization: `Bearer ${ghlKey}`, "Content-Type": "application/json", Version: "2021-07-28" },
                body: JSON.stringify({ tags: ["fb-dm-sent"] }),
              });
            } catch {}
          }
        }
      }
    }
  }

  // ═══════════════════════════════════════
  // 6. TELEGRAM BRIEFING
  // ═══════════════════════════════════════
  const { anyRoutineActive } = await import("@/lib/telegram/should-send-routine");
  const outreachRoutineOn = await anyRoutineActive(supabase, "outreach_report");
  if (chatId && outreachRoutineOn) {
    const { sendTelegramMessage } = await import("@/lib/services/trinity");
    const totalSent = emailsSent + smsSent + igDmsSent + fbDmsSent + callsQueued;
    const totalLimit = emailLimit + smsLimit + igDmLimit + fbDmLimit + callLimit;
    const goalInfo = goalMode ? `\n🎯 Goal Mode: ${goalMultiplier > 1 ? `boosted ${goalMultiplier}x (behind target)` : goalMultiplier < 1 ? "scaled down (goals met!)" : "on track"}` : "";
    await sendTelegramMessage(chatId,
      `📨 *Daily Outreach Report*\n\n` +
      `✉️ Emails: ${emailsSent}/${emailLimit} sent\n` +
      `💬 SMS: ${smsSent}/${smsLimit} sent\n` +
      `📞 Calls: ${callsQueued}/${callLimit} queued\n` +
      `📸 IG DMs: ${igDmsSent}/${igDmLimit} sent\n` +
      `👤 FB DMs: ${fbDmsSent}/${fbDmLimit} sent${goalInfo}\n\n` +
      `${totalSent >= totalLimit * 0.75 ? "🔥 Great outreach day!" : totalSent >= totalLimit * 0.25 ? "✅ Outreach running" : "⚠️ Low volume — check connections"}`
    );
  }

  return NextResponse.json({
    success: true,
    emailsSent,
    smsSent,
    callsQueued,
    igDmsSent,
    fbDmsSent,
    timestamp: new Date().toISOString(),
  });
}
