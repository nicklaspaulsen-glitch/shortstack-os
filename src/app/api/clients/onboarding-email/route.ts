import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase, createServiceClient } from "@/lib/supabase/server";

// Send automated onboarding email sequence to new clients
// 5-email sequence over 7 days
export async function POST(request: NextRequest) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { client_id, email_number } = await request.json();
  const serviceSupabase = createServiceClient();

  const { data: client } = await serviceSupabase.from("clients").select("*").eq("id", client_id).single();
  if (!client) return NextResponse.json({ error: "Client not found" }, { status: 404 });

  const ghlKey = process.env.GHL_API_KEY;
  const apiKey = process.env.ANTHROPIC_API_KEY;

  const sequences = [
    { day: 0, subject: `Welcome to ShortStack, ${client.contact_name}!`, type: "welcome" },
    { day: 1, subject: "Your portal is ready — here's how to get started", type: "getting_started" },
    { day: 3, subject: "Quick tip: Connect your social accounts for AI management", type: "social_connect" },
    { day: 5, subject: `${client.business_name}'s first weekly content plan is ready`, type: "content_plan" },
    { day: 7, subject: "How's everything going? Let's optimize your strategy", type: "check_in" },
  ];

  const seq = sequences[email_number || 0];
  if (!seq) return NextResponse.json({ error: "Invalid email number" }, { status: 400 });

  // Generate personalized email with AI
  let emailBody = "";
  if (apiKey) {
    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
        body: JSON.stringify({
          model: "claude-haiku-4-5-20251001",
          max_tokens: 500,
          messages: [{
            role: "user",
            content: `Write onboarding email #${(email_number || 0) + 1} (${seq.type}) for ${client.contact_name} from ${client.business_name} (${client.industry}). Subject: "${seq.subject}". Keep it short, friendly, and actionable. Include a clear CTA. Sign as "The ShortStack Team". Use HTML with inline styles for formatting.`,
          }],
        }),
      });
      const data = await res.json();
      emailBody = data.content?.[0]?.text || "";
    } catch (err) { console.error("[onboarding-email] Claude personalization failed:", err); }
  }

  if (!emailBody) {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://shortstack.work";
    emailBody = `<p>Hi ${client.contact_name},</p><p>Welcome to Trinity! We're excited to help ${client.business_name} grow.</p><p>Log in to your portal to get started: <a href="${appUrl}/login">${appUrl.replace(/^https?:\/\//, "")}</a></p><p>Best,<br>The Trinity Team</p>`;
  }

  // Send via GHL if available. Track whether the send actually succeeded so
  // we don't return a fake success when GHL is misconfigured or errors.
  let didSend = false;
  let sendError: string | undefined;

  if (!ghlKey) {
    sendError = "GHL_API_KEY not configured";
  } else if (!client.email) {
    sendError = "Client has no email address";
  } else {
    try {
      // Find or create GHL contact
      const contactRes = await fetch(`https://services.leadconnectorhq.com/contacts/search/duplicate?email=${encodeURIComponent(client.email)}`, {
        headers: { Authorization: `Bearer ${ghlKey}`, Version: "2021-07-28" },
      });
      const contactData = await contactRes.json();
      let contactId = contactData.contact?.id;

      if (!contactId) {
        const createRes = await fetch("https://services.leadconnectorhq.com/contacts/", {
          method: "POST",
          headers: { Authorization: `Bearer ${ghlKey}`, "Content-Type": "application/json", Version: "2021-07-28" },
          body: JSON.stringify({ name: client.contact_name, email: client.email, tags: ["client", "onboarding"] }),
        });
        const created = await createRes.json();
        contactId = created.contact?.id;
      }

      if (contactId) {
        const sendRes = await fetch("https://services.leadconnectorhq.com/conversations/messages", {
          method: "POST",
          headers: { Authorization: `Bearer ${ghlKey}`, "Content-Type": "application/json", Version: "2021-07-28" },
          body: JSON.stringify({ type: "Email", contactId, subject: seq.subject, html: emailBody }),
        });
        if (sendRes.ok) {
          didSend = true;
        } else {
          sendError = `GHL send returned HTTP ${sendRes.status}`;
        }
      } else {
        sendError = "Could not resolve GHL contact id";
      }
    } catch (err) {
      sendError = err instanceof Error ? err.message : "GHL send failed";
      console.error("[onboarding-email] GHL send failed:", err);
    }
  }

  // Log with honest status
  await serviceSupabase.from("trinity_log").insert({
    action_type: "automation",
    description: didSend
      ? `Onboarding email #${(email_number || 0) + 1} sent to ${client.contact_name} (${seq.type})`
      : `Onboarding email #${(email_number || 0) + 1} FAILED for ${client.contact_name} (${seq.type}): ${sendError}`,
    client_id,
    status: didSend ? "completed" : "warning",
    result: { email_number, subject: seq.subject, type: seq.type, sent: didSend, error: sendError },
  });

  return NextResponse.json({
    success: didSend,
    email_number: email_number || 0,
    subject: seq.subject,
    ...(didSend ? {} : { error: sendError || "Email could not be sent" }),
  });
}
