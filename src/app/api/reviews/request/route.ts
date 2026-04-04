import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

// Review & Testimonial Collection System
export async function POST(request: NextRequest) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { client_id, method } = await request.json(); // method: email, sms, both

  const { data: client } = await supabase.from("clients").select("*").eq("id", client_id).single();
  if (!client) return NextResponse.json({ error: "Client not found" }, { status: 404 });

  // Generate personalized review request with Claude
  const apiKey = process.env.ANTHROPIC_API_KEY;
  let emailContent = { subject: "", body: "" };
  let smsContent = "";

  if (apiKey) {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 500,
        system: "Write a friendly, personal review request. Return JSON with: email_subject, email_body (HTML), sms_text (under 160 chars).",
        messages: [{ role: "user", content: `Write a review/testimonial request for ${client.contact_name} at ${client.business_name}. They've been a ${client.package_tier} client. Make it feel personal and easy to respond to. Include a link placeholder [REVIEW_LINK].` }],
      }),
    });
    const data = await res.json();
    const text = data.content?.[0]?.text || "";
    try {
      const parsed = JSON.parse(text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim());
      emailContent = { subject: parsed.email_subject, body: parsed.email_body };
      smsContent = parsed.sms_text;
    } catch {
      emailContent = {
        subject: `${client.contact_name}, we'd love your feedback!`,
        body: `<p>Hi ${client.contact_name},</p><p>We've loved working with ${client.business_name}! Would you mind leaving us a quick review? It takes less than a minute and helps us a lot.</p><p>Thanks!</p><p>The ShortStack Team</p>`,
      };
      smsContent = `Hi ${client.contact_name}! We'd love a quick review of your experience with ShortStack. Takes 30 seconds: [REVIEW_LINK]`;
    }
  }

  const results: Record<string, boolean> = {};

  // Send via email (GHL)
  if ((method === "email" || method === "both") && client.ghl_contact_id) {
    const ghlKey = process.env.GHL_API_KEY;
    if (ghlKey) {
      const res = await fetch("https://services.leadconnectorhq.com/conversations/messages", {
        method: "POST",
        headers: { Authorization: `Bearer ${ghlKey}`, "Content-Type": "application/json", Version: "2021-07-28" },
        body: JSON.stringify({
          type: "Email",
          contactId: client.ghl_contact_id,
          subject: emailContent.subject,
          html: emailContent.body,
          emailFrom: "growth@shortstack.work",
        }),
      });
      results.email = res.ok;
    }
  }

  // Send via SMS (GHL)
  if ((method === "sms" || method === "both") && client.ghl_contact_id) {
    const ghlKey = process.env.GHL_API_KEY;
    if (ghlKey) {
      const res = await fetch("https://services.leadconnectorhq.com/conversations/messages", {
        method: "POST",
        headers: { Authorization: `Bearer ${ghlKey}`, "Content-Type": "application/json", Version: "2021-07-28" },
        body: JSON.stringify({
          type: "SMS",
          contactId: client.ghl_contact_id,
          message: smsContent,
        }),
      });
      results.sms = res.ok;
    }
  }

  // Log
  await supabase.from("trinity_log").insert({
    action_type: "custom",
    description: `Review request sent to ${client.business_name} via ${method}`,
    client_id,
    status: "completed",
    result: results,
    completed_at: new Date().toISOString(),
  });

  return NextResponse.json({ success: true, results, emailContent, smsContent });
}
