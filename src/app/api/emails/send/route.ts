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

  // Fallback to direct send via Resend. Prefer the Resend HTTP API so we
  // can attach the `shortstack_user_id` tag — the webhook uses that tag to
  // resolve owner for open/click events (see /api/webhooks/resend).
  // If the HTTP path fails or the key isn't available, fall back to SMTP.
  //
  // NOTE on Resend tags: the Resend API accepts `tags: [{name, value}]` on
  // send, but the webhook payload DELIVERS tags as an object map
  // `{shortstack_user_id: "abc", ...}`. The webhook route normalizes both
  // shapes; here we keep the array form that the send API expects.
  let resendEmailId: string | null = null;
  if (!sent) {
    const resendKey = process.env.SMTP_PASS || process.env.RESEND_API_KEY;
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

    if (resendKey) {
      try {
        const resendRes = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${resendKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: fromDisplay,
            to: [to],
            subject: emailSubject,
            html: emailBody,
            reply_to: typeof reply_to === "string" && reply_to.trim() ? reply_to.trim() : undefined,
            tags: [
              { name: "shortstack_user_id", value: ownerId },
              { name: "source", value: "email_composer" },
              ...(provider ? [{ name: "provider", value: String(provider).slice(0, 32) }] : []),
            ],
          }),
        });
        if (resendRes.ok) {
          sent = true;
          // Capture the Resend email_id so the webhook can resolve owner
          // from it if tags get stripped on certain event types. Failures
          // to parse are non-fatal — the tag path still works normally.
          try {
            const resendJson = (await resendRes.json()) as { id?: string };
            resendEmailId = typeof resendJson?.id === "string" ? resendJson.id : null;
          } catch {
            resendEmailId = null;
          }
        } else {
          const errBody = await resendRes.text().catch(() => "");
          failureReason = `Resend API ${resendRes.status}: ${errBody.slice(0, 200) || "send failed"}`;
        }
      } catch (err) {
        failureReason = err instanceof Error ? err.message : "Resend HTTP request failed";
      }
    }

    // SMTP fallback if Resend HTTP path was unavailable or failed
    if (!sent) {
      try {
        sent = await sendEmail({ to, subject: emailSubject, html: emailBody });
        if (!sent) failureReason = failureReason || "SMTP send returned false";
      } catch (err) {
        failureReason = err instanceof Error ? err.message : "SMTP send failed";
      }
    }
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
        error: failureReason || "Email delivery failed — no GHL contact and SMTP fallback errored.",
      },
      { status: 502 },
    );
  }

  await recordUsage(ownerId, "emails", 1, { client_id: client_id || null, platform: "email" });

  return NextResponse.json({ success: true, subject: emailSubject });
}
