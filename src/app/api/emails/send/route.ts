import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { requireOwnedClient } from "@/lib/security/require-owned-client";

// Send emails via GHL's email system or direct SMTP
export async function POST(request: NextRequest) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { to, subject, body, client_id, template_type } = await request.json();

  // Verify the caller owns the client before sending email on their behalf.
  if (client_id) {
    const ctx = await requireOwnedClient(supabase, user.id, client_id);
    if (!ctx) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // If template_type provided, generate content first
  let emailSubject = subject;
  let emailBody = body;

  if (template_type && !body) {
    const genRes = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || "https://shortstack-os.vercel.app"}/api/emails/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json", cookie: request.headers.get("cookie") || "" },
      body: JSON.stringify({ template_type, client_name: to }),
    });
    const genData = await genRes.json();
    if (genData.email) {
      emailSubject = genData.email.subject;
      emailBody = genData.email.body;
    }
  }

  // Send via GHL
  const ghlKey = process.env.GHL_API_KEY;
  let sent = false;

  if (ghlKey && client_id) {
    const { data: client } = await supabase.from("clients").select("ghl_contact_id").eq("id", client_id).single();
    if (client?.ghl_contact_id) {
      const res = await fetch("https://services.leadconnectorhq.com/conversations/messages", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${ghlKey}`,
          "Content-Type": "application/json",
          Version: "2021-07-28",
        },
        body: JSON.stringify({
          type: "Email",
          contactId: client.ghl_contact_id,
          subject: emailSubject,
          html: emailBody,
          emailFrom: "growth@shortstack.work",
        }),
      });
      sent = res.ok;
    }
  }

  // Log the email
  await supabase.from("trinity_log").insert({
    action_type: "email_campaign",
    description: `Email sent to ${to}: "${emailSubject}"`,
    client_id: client_id || null,
    status: sent ? "completed" : "failed",
    result: { to, subject: emailSubject, sent, template_type },
    completed_at: new Date().toISOString(),
  });

  return NextResponse.json({ success: sent, subject: emailSubject });
}
