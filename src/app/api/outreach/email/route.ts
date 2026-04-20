import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase, createServiceClient } from "@/lib/supabase/server";
import { sendEmail } from "@/lib/email";
import { allocateEmailSenders, recordEmailSend, getMinDelay, type EmailSender } from "@/lib/services/sender-rotation";
import { getEffectiveOwnerId } from "@/lib/security/require-owned-client";
import { checkLimit, recordUsage } from "@/lib/usage-limits";
import nodemailer from "nodemailer";

// Cold email outreach — AI-personalized emails sent to scraped leads
// Rate limiting enforced by sender-rotation (hourly caps, min delays, bounce tracking)
export async function POST(request: NextRequest) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const ownerId = await getEffectiveOwnerId(supabase, user.id);
  if (!ownerId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { lead_ids, subject_template, body_template, from_name, batch_size } = await request.json();
  // Cap batch size to prevent abuse
  const safeBatchSize = Math.min(batch_size || 20, 50);

  // Plan-tier usage cap (monthly emails). Block the whole batch if it would exceed.
  const gate = await checkLimit(ownerId, "emails", safeBatchSize);
  if (!gate.allowed) {
    return NextResponse.json(
      {
        error: gate.reason || "Monthly email limit reached for your plan.",
        current: gate.current,
        limit: gate.limit,
        plan_tier: gate.plan_tier,
        remaining: gate.remaining,
      },
      { status: 402 },
    );
  }

  const serviceSupabase = createServiceClient();
  const apiKey = process.env.ANTHROPIC_API_KEY;
  const ghlKey = process.env.GHL_API_KEY;

  // Get leads — all queries scoped to caller's owned leads to prevent cross-tenant email sends.
  let leads;
  if (lead_ids && lead_ids.length > 0) {
    const { data } = await serviceSupabase.from("leads").select("*")
      .eq("user_id", ownerId).in("id", lead_ids);
    leads = data;
  } else {
    // Get leads with emails that haven't been emailed
    const { data } = await serviceSupabase
      .from("leads")
      .select("*")
      .eq("user_id", ownerId)
      .not("email", "is", null)
      .eq("status", "new")
      .limit(safeBatchSize);
    leads = data;
  }

  if (!leads || leads.length === 0) {
    return NextResponse.json({ error: "No leads with email addresses found" }, { status: 400 });
  }

  let sent = 0;
  let failed = 0;
  const results: Array<{ business: string; email: string; status: string }> = [];

  // ── Sender rotation: allocate pool senders across all leads ──
  const senderAllocations = await allocateEmailSenders(serviceSupabase, leads.length);
  // Flatten allocations into a queue: [sender, sender, sender, ...]
  const senderQueue: EmailSender[] = [];
  for (const alloc of senderAllocations) {
    for (let i = 0; i < alloc.count; i++) {
      senderQueue.push(alloc.sender);
    }
  }
  let senderIdx = 0;

  for (const lead of leads) {
    if (!lead.email) continue;

    // Generate personalized email with AI
    let subject = subject_template || `Quick question about ${lead.business_name}`;
    let body = body_template || "";

    if (apiKey) {
      try {
        const res = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
          body: JSON.stringify({
            model: "claude-haiku-4-5-20251001",
            max_tokens: 400,
            system: `You are writing a cold outreach email for ShortStack digital marketing agency. Write personalized, short emails (under 150 words). No fluff. Get to the point. Be genuine and helpful. Include a clear CTA (book a call). Sign off as: ${from_name || "The ShortStack Team"}`,
            messages: [{
              role: "user",
              content: `Write a cold email to ${lead.owner_name || "the owner"} of "${lead.business_name}" (${lead.industry || "local business"} in ${lead.city || "their area"}). They have ${lead.review_count || 0} Google reviews${lead.google_rating ? ` and a ${lead.google_rating} rating` : ""}. ${lead.website ? `Website: ${lead.website}` : "No website found."}\n\nReturn JSON: {"subject":"...","body":"..."}`,
            }],
          }),
        });
        const data = await res.json();
        const text = data.content?.[0]?.text || "";
        try {
          const parsed = JSON.parse(text.replace(/```json\n?/g, "").replace(/```/g, "").trim());
          subject = parsed.subject || subject;
          body = parsed.body || body;
        } catch {
          body = text;
        }
      } catch (err) { console.error("[outreach/email] Claude personalization failed:", err); }
    }

    if (!body) {
      body = `Hi ${lead.owner_name || "there"},\n\nI came across ${lead.business_name} and noticed you're doing great work in the ${lead.industry || "local business"} space.\n\nAt ShortStack, we help businesses like yours get more clients through digital marketing — social media, ads, SEO, and content.\n\nWould you be open to a quick 15-minute call to see if we can help? No pressure at all.\n\nBest,\n${from_name || "The ShortStack Team"}`;
    }

    // Send via pool sender (rotation) → default Resend SMTP → GHL (fallback)
    let didSend = false;
    const htmlBody = body.replace(/\n/g, "<br>");
    const currentSender = senderIdx < senderQueue.length ? senderQueue[senderIdx] : null;
    senderIdx++;

    // Try pool sender first (custom SMTP identity)
    if (currentSender) {
      try {
        if (currentSender.smtp_provider === "custom" && currentSender.smtp_host && currentSender.smtp_user) {
          // Send via custom SMTP
          const transport = nodemailer.createTransport({
            host: currentSender.smtp_host,
            port: Number(currentSender.smtp_port) || 587,
            secure: Number(currentSender.smtp_port) === 465,
            auth: { user: currentSender.smtp_user, pass: process.env.SMTP_POOL_PASSWORD || "" },
          });
          await transport.sendMail({
            from: `${currentSender.display_name || "ShortStack"} <${currentSender.email}>`,
            to: lead.email,
            subject,
            html: htmlBody,
          });
          didSend = true;
        } else {
          // Shared default — route through central Resend SMTP via sendEmail()
          didSend = await sendEmail({ to: lead.email, subject, html: htmlBody });
        }
        if (didSend) {
          await recordEmailSend(serviceSupabase, currentSender.id);
        }
      } catch {
        didSend = false;
      }
    }

    // Fallback: default Resend SMTP if no pool sender or pool send failed
    if (!didSend && !currentSender) {
      try {
        didSend = await sendEmail({ to: lead.email, subject, html: htmlBody });
      } catch {
        didSend = false;
      }
    }

    // Fallback to GHL if everything else fails
    if (!didSend && ghlKey) {
      try {
        const contactRes = await fetch("https://services.leadconnectorhq.com/contacts/", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${ghlKey}`,
            "Content-Type": "application/json",
            Version: "2021-07-28",
          },
          body: JSON.stringify({
            name: lead.business_name,
            email: lead.email,
            phone: lead.phone || undefined,
            tags: ["cold-outreach", lead.industry || "lead"],
            source: "ShortStack OS",
          }),
        });
        const contact = await contactRes.json();
        const contactId = contact.contact?.id;

        if (contactId) {
          const emailRes = await fetch("https://services.leadconnectorhq.com/conversations/messages", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${ghlKey}`,
              "Content-Type": "application/json",
              Version: "2021-07-28",
            },
            body: JSON.stringify({ type: "Email", contactId, subject, html: htmlBody }),
          });
          didSend = emailRes.ok;
        }
      } catch {
        didSend = false;
      }
    }

    if (didSend) {
      sent++;
      results.push({ business: lead.business_name, email: lead.email, status: "sent" });
      // Plan-tier usage metering
      await recordUsage(ownerId, "emails", 1, { lead_id: lead.id, platform: "email" });
    } else {
      failed++;
      results.push({ business: lead.business_name, email: lead.email, status: "failed" });
    }

    // Log outreach with honest status
    await serviceSupabase.from("outreach_log").insert({
      lead_id: lead.id,
      platform: "email",
      business_name: lead.business_name,
      recipient_handle: lead.email,
      message_text: `Subject: ${subject}\n\n${body}`,
      status: didSend ? "sent" : "failed",
    });

    // Update lead status (only advance forward, never overwrite replied/booked)
    if (didSend) {
      await serviceSupabase.from("leads").update({ status: "contacted" })
        .eq("id", lead.id).eq("user_id", ownerId).in("status", ["new", "called"]);
    }

    // Respect minimum delay between sends (spam protection)
    const senderStage = currentSender?.warmup_stage ?? 3;
    const minDelay = getMinDelay(senderStage, "email");
    await new Promise(r => setTimeout(r, Math.max(minDelay * 1000, 300)));
  }

  // Notify
  const { sendTelegramMessage } = await import("@/lib/services/trinity");
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (chatId) {
    await sendTelegramMessage(chatId, `📧 *Email Outreach Complete*\nSent: ${sent}\nFailed: ${failed}\nTotal: ${leads.length}`);
  }

  return NextResponse.json({ success: true, sent, failed, total: leads.length, results: results.slice(0, 20) });
}
