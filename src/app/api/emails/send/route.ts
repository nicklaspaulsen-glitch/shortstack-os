import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { requireOwnedClient } from "@/lib/security/require-owned-client";
import { checkLimit, recordUsage } from "@/lib/usage-limits";
import { sendEmail } from "@/lib/email";

// Send emails via GHL's email system or direct SMTP.
// Returns 4xx/5xx on actual failure so the UI can toast a real error
// (previously returned 200 { success: false } which the UI read as success).
export async function POST(request: NextRequest) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { to, subject, body, client_id, template_type } = await request.json();

  if (!to || typeof to !== "string") {
    return NextResponse.json({ error: "to (recipient email) required" }, { status: 400 });
  }

  // Verify the caller owns the client before sending email on their behalf.
  let ownerId = user.id;
  if (client_id) {
    const ctx = await requireOwnedClient(supabase, user.id, client_id);
    if (!ctx) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    ownerId = ctx.ownerId;
  }

  // Plan-tier email cap — this route used to bypass checkLimit entirely.
  const gate = await checkLimit(ownerId, "emails", 1);
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

  if (!emailSubject || !emailBody) {
    return NextResponse.json(
      { error: "subject and body (or template_type) required" },
      { status: 400 },
    );
  }

  // Try GHL first if the client has a ghl_contact_id, then fall back to
  // direct SMTP via sendEmail(). Both paths must actually SUCCEED for
  // `sent` to become true — no more fake-success.
  const ghlKey = process.env.GHL_API_KEY;
  let sent = false;
  let failureReason = "";

  if (ghlKey && client_id) {
    const { data: client } = await supabase
      .from("clients")
      .select("ghl_contact_id")
      .eq("id", client_id)
      .eq("profile_id", ownerId)
      .single();
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
      if (!sent) failureReason = `GHL returned ${res.status}`;
    }
  }

  // Fallback to direct SMTP via central Resend.
  if (!sent) {
    try {
      sent = await sendEmail({ to, subject: emailSubject, html: emailBody });
      if (!sent) failureReason = failureReason || "SMTP send returned false";
    } catch (err) {
      failureReason = err instanceof Error ? err.message : "SMTP send failed";
    }
  }

  // Log the email
  await supabase.from("trinity_log").insert({
    action_type: "email_campaign",
    description: `Email sent to ${to}: "${emailSubject}"`,
    client_id: client_id || null,
    status: sent ? "completed" : "failed",
    result: { to, subject: emailSubject, sent, template_type, failure_reason: failureReason || null },
    completed_at: new Date().toISOString(),
  });

  if (!sent) {
    return NextResponse.json(
      {
        success: false,
        error: failureReason || "Email delivery failed — no GHL contact and SMTP fallback errored.",
      },
      { status: 502 },
    );
  }

  await recordUsage(ownerId, "emails", 1, { client_id: client_id || null, platform: "email" });

  return NextResponse.json({ success: true, subject: emailSubject });
}
