import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { requireOwnedClient } from "@/lib/security/require-owned-client";
import { checkLimit, recordUsage } from "@/lib/usage-limits";
import { sendMessage } from "@/lib/email";

// Send emails via the configured provider abstraction (Resend by default;
// Postal or generic SMTP via EMAIL_PROVIDER env). Returns 4xx/5xx on
// actual failure so the UI can toast a real error (previously returned
// 200 { success: false } which the UI read as success).
// GHL path removed Apr 21 — native provider abstraction is now primary.
export async function POST(request: NextRequest) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const {
    to,
    subject,
    body,
    client_id,
    template_type,
    from_name,
    from_email,
    reply_to,
    provider,
  } = await request.json();

  if (!to || typeof to !== "string") {
    return NextResponse.json({ error: "to (recipient email) required" }, { status: 400 });
  }
  // Minimal format guard — the composer validates client-side, but an
  // empty "to" or malformed value here would 400 SMTP anyway; return
  // a helpful error instead of a generic 502.
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to.trim())) {
    return NextResponse.json({ error: "to (recipient email) is not a valid email address" }, { status: 400 });
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
    const genRes = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || "https://app.shortstack.work"}/api/emails/generate`, {
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

  let sent = false;
  let failureReason = "";

  // Send via the provider abstraction. The chosen backend (Resend by default,
  // optionally Postal or generic SMTP via EMAIL_PROVIDER env) handles tags +
  // captures a stable messageId so the webhook can resolve owner.
  //
  // NOTE on tags: Resend natively supports `tags`; the abstraction layer
  // turns them into Resend's `[{name, value}]` array. SMTP-based providers
  // serialize them as `X-Tag-<name>` headers. The webhook normalizes both
  // shapes (see /api/webhooks/resend) so downstream consumers don't care.
  let resendEmailId: string | null = null;

  // Use the caller-provided from_email if it looks like a valid email;
  // otherwise fall back to the env default. Guards against injection via
  // malformed headers — only a simple single-email form is accepted.
  const emailRe = /^[^\s@<>,]+@[^\s@<>,]+\.[^\s@<>,]+$/;
  const callerFromEmail =
    typeof from_email === "string" && emailRe.test(from_email.trim())
      ? from_email.trim()
      : null;
  const fromEmail = callerFromEmail || process.env.SMTP_FROM || "growth@mail.shortstack.work";
  const fromDisplay = typeof from_name === "string" && from_name.trim()
    ? `${from_name.trim()} <${fromEmail}>`
    : fromEmail;

  try {
    const result = await sendMessage({
      to,
      from: fromDisplay,
      subject: emailSubject,
      html: emailBody,
      replyTo:
        typeof reply_to === "string" && reply_to.trim() ? reply_to.trim() : undefined,
      tags: {
        shortstack_user_id: ownerId,
        source: "email_composer",
        ...(provider ? { provider: String(provider).slice(0, 32) } : {}),
      },
    });
    sent = true;
    resendEmailId = result.messageId || null;
  } catch (err) {
    failureReason = err instanceof Error ? err.message : "email send failed";
  }

  // Log the email. `resend_email_id` + `shortstack_user_id` let the resend
  // webhook route look this row up by email_id and resolve the owner when
  // tags aren't present on the webhook payload (fallback path).
  await supabase.from("trinity_log").insert({
    action_type: "email_campaign",
    description: `Email sent to ${to}: "${emailSubject}"`,
    client_id: client_id || null,
    status: sent ? "completed" : "failed",
    result: {
      to,
      subject: emailSubject,
      sent,
      template_type,
      failure_reason: failureReason || null,
      resend_email_id: resendEmailId,
      shortstack_user_id: ownerId,
    },
    completed_at: new Date().toISOString(),
  });

  if (!sent) {
    return NextResponse.json(
      {
        success: false,
        error: failureReason || "Email delivery failed — Resend HTTP send and SMTP fallback both errored.",
      },
      { status: 502 },
    );
  }

  await recordUsage(ownerId, "emails", 1, { client_id: client_id || null, platform: "email" });

  return NextResponse.json({ success: true, subject: emailSubject });
}
