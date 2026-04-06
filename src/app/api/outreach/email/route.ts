import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase, createServiceClient } from "@/lib/supabase/server";

// Cold email outreach — AI-personalized emails sent to scraped leads
export async function POST(request: NextRequest) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { lead_ids, subject_template, body_template, from_name, batch_size } = await request.json();

  const serviceSupabase = createServiceClient();
  const apiKey = process.env.ANTHROPIC_API_KEY;
  const ghlKey = process.env.GHL_API_KEY;

  // Get leads
  let leads;
  if (lead_ids && lead_ids.length > 0) {
    const { data } = await serviceSupabase.from("leads").select("*").in("id", lead_ids);
    leads = data;
  } else {
    // Get leads with emails that haven't been emailed
    const { data } = await serviceSupabase
      .from("leads")
      .select("*")
      .not("email", "is", null)
      .eq("status", "new")
      .limit(batch_size || 20);
    leads = data;
  }

  if (!leads || leads.length === 0) {
    return NextResponse.json({ error: "No leads with email addresses found" }, { status: 400 });
  }

  let sent = 0;
  let failed = 0;
  const results: Array<{ business: string; email: string; status: string }> = [];

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
      } catch {}
    }

    if (!body) {
      body = `Hi ${lead.owner_name || "there"},\n\nI came across ${lead.business_name} and noticed you're doing great work in the ${lead.industry || "local business"} space.\n\nAt ShortStack, we help businesses like yours get more clients through digital marketing — social media, ads, SEO, and content.\n\nWould you be open to a quick 15-minute call to see if we can help? No pressure at all.\n\nBest,\n${from_name || "The ShortStack Team"}`;
    }

    // Send via GHL if available
    if (ghlKey) {
      try {
        // Create contact in GHL first
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
          // Send email via GHL
          await fetch("https://services.leadconnectorhq.com/conversations/messages", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${ghlKey}`,
              "Content-Type": "application/json",
              Version: "2021-07-28",
            },
            body: JSON.stringify({
              type: "Email",
              contactId,
              subject,
              html: body.replace(/\n/g, "<br>"),
            }),
          });
        }

        sent++;
        results.push({ business: lead.business_name, email: lead.email, status: "sent" });
      } catch (err) {
        failed++;
        results.push({ business: lead.business_name, email: lead.email, status: `failed: ${err}` });
      }
    } else {
      // Log as pending (no email service configured)
      results.push({ business: lead.business_name, email: lead.email, status: "pending (no email service)" });
    }

    // Log outreach
    await serviceSupabase.from("outreach_log").insert({
      lead_id: lead.id,
      platform: "email",
      business_name: lead.business_name,
      recipient_handle: lead.email,
      message_text: `Subject: ${subject}\n\n${body}`,
      status: ghlKey ? "sent" : "pending",
    });

    // Update lead status
    await serviceSupabase.from("leads").update({ status: "called" }).eq("id", lead.id);

    await new Promise(r => setTimeout(r, 300));
  }

  // Notify
  const { sendTelegramMessage } = await import("@/lib/services/trinity");
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (chatId) {
    await sendTelegramMessage(chatId, `📧 *Email Outreach Complete*\nSent: ${sent}\nFailed: ${failed}\nTotal: ${leads.length}`);
  }

  return NextResponse.json({ success: true, sent, failed, total: leads.length, results: results.slice(0, 20) });
}
