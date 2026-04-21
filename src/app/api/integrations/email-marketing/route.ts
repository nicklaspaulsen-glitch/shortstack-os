import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { getEffectiveOwnerId, requireOwnedClient } from "@/lib/security/require-owned-client";
import { checkLimit, recordUsage } from "@/lib/usage-limits";

// Email Marketing Integration — supports both Mailchimp and Resend
// Mailchimp: MAILCHIMP_API_KEY, MAILCHIMP_SERVER_PREFIX (e.g., us21)
// Resend:    SMTP_PASS (the Resend API key), SMTP_FROM

function getProvider(): "mailchimp" | "resend" | null {
  if (process.env.MAILCHIMP_API_KEY) return "mailchimp";
  if (process.env.SMTP_PASS || process.env.RESEND_API_KEY) return "resend";
  return null;
}

function resendKey() {
  return process.env.SMTP_PASS || process.env.RESEND_API_KEY || "";
}

// ── Mailchimp Helpers ──

async function mailchimpFetch(path: string, options: RequestInit = {}) {
  const server = process.env.MAILCHIMP_SERVER_PREFIX || "us21";
  const apiKey = process.env.MAILCHIMP_API_KEY || "";
  return fetch(`https://${server}.api.mailchimp.com/3.0${path}`, {
    ...options,
    headers: {
      Authorization: `Basic ${Buffer.from(`anystring:${apiKey}`).toString("base64")}`,
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });
}

async function mailchimpGetLists() {
  const res = await mailchimpFetch("/lists?count=50");
  const data = await res.json();
  return (data.lists || []).map((l: Record<string, unknown>) => ({
    id: l.id, name: l.name, member_count: (l.stats as Record<string, number>)?.member_count || 0,
    open_rate: (l.stats as Record<string, number>)?.open_rate || 0,
  }));
}

async function mailchimpGetCampaigns() {
  const res = await mailchimpFetch("/campaigns?count=20&sort_field=send_time&sort_dir=DESC");
  const data = await res.json();
  return (data.campaigns || []).map((c: Record<string, unknown>) => ({
    id: c.id, type: c.type, status: c.status,
    title: (c.settings as Record<string, string>)?.title || "",
    subject: (c.settings as Record<string, string>)?.subject_line || "",
    send_time: c.send_time,
    emails_sent: c.emails_sent,
    opens: (c.report_summary as Record<string, number>)?.opens || 0,
    clicks: (c.report_summary as Record<string, number>)?.clicks || 0,
    open_rate: (c.report_summary as Record<string, number>)?.open_rate || 0,
    click_rate: (c.report_summary as Record<string, number>)?.click_rate || 0,
  }));
}

async function mailchimpAddContact(listId: string, email: string, firstName: string, lastName: string, tags: string[]) {
  const res = await mailchimpFetch(`/lists/${listId}/members`, {
    method: "POST",
    body: JSON.stringify({
      email_address: email,
      status: "subscribed",
      merge_fields: { FNAME: firstName, LNAME: lastName },
      tags,
    }),
  });
  return res.json();
}

// ── Resend Helpers ──

async function resendFetch(path: string, options: RequestInit = {}) {
  return fetch(`https://api.resend.com${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${resendKey()}`,
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });
}

async function resendGetLists() {
  // Resend calls them "audiences"
  const res = await resendFetch("/audiences");
  const data = await res.json();
  return (data.data || []).map((a: Record<string, unknown>) => ({
    id: a.id, name: a.name,
  }));
}

async function resendSendEmail(to: string, subject: string, html: string, from?: string) {
  const fromAddr = from || process.env.SMTP_FROM || "growth@mail.shortstack.work";
  const res = await resendFetch("/emails", {
    method: "POST",
    body: JSON.stringify({
      from: fromAddr,
      to: [to],
      subject,
      html,
    }),
  });
  return { success: res.ok };
}

async function resendAddContact(email: string, firstName: string, lastName: string, audienceId: string) {
  if (!audienceId) return { error: "audienceId required" };
  const res = await resendFetch(`/audiences/${audienceId}/contacts`, {
    method: "POST",
    body: JSON.stringify({
      email,
      first_name: firstName,
      last_name: lastName,
      unsubscribed: false,
    }),
  });
  return res.json();
}

// ── Route Handlers ──

export async function GET(request: NextRequest) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const provider = getProvider();
  if (!provider) return NextResponse.json({ error: "No email marketing provider configured", connected: false }, { status: 500 });

  const action = request.nextUrl.searchParams.get("action") || "lists";

  try {
    if (provider === "mailchimp") {
      if (action === "lists") return NextResponse.json({ success: true, provider, lists: await mailchimpGetLists() });
      if (action === "campaigns") return NextResponse.json({ success: true, provider, campaigns: await mailchimpGetCampaigns() });
    }

    if (provider === "resend") {
      if (action === "lists") return NextResponse.json({ success: true, provider, lists: await resendGetLists() });
    }

    return NextResponse.json({ success: true, provider, action: "unsupported" });
  } catch (err) {
    return NextResponse.json({ error: `${provider} error: ${err}` }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const provider = getProvider();
  if (!provider) return NextResponse.json({ error: "No email marketing provider configured" }, { status: 500 });

  const { action, client_id, ...params } = await request.json();

  // Resolve the effective owner up front so we can plan-gate send_email
  // (bug-hunt-apr20-v2 HIGH #13 — this route previously bypassed the
  // monthly emails cap entirely). Verify client ownership when one is
  // supplied so the audit log entry below can't be written on another
  // tenant's client_id.
  let ownerId = user.id;
  if (client_id) {
    const ctx = await requireOwnedClient(supabase, user.id, client_id);
    if (!ctx) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    ownerId = ctx.ownerId;
  } else {
    ownerId = (await getEffectiveOwnerId(supabase, user.id)) || user.id;
  }

  try {
    if (action === "add_contact") {
      const { list_id, email, first_name, last_name, tags } = params;
      if (!email) return NextResponse.json({ error: "email required" }, { status: 400 });

      let result;
      if (provider === "mailchimp") {
        result = await mailchimpAddContact(list_id, email, first_name || "", last_name || "", tags || []);
      } else {
        result = await resendAddContact(email, first_name || "", last_name || "", list_id || "");
      }

      if (client_id) {
        await supabase.from("trinity_log").insert({
          action_type: "custom",
          description: `Added ${email} to ${provider} audience`,
          client_id,
          status: "completed",
          result: { type: "email_marketing_contact", provider, email },
        });
      }

      return NextResponse.json({ success: true, provider, result });
    }

    if (action === "send_email" && provider === "resend") {
      const { to, subject, html } = params;
      if (!to || !subject) return NextResponse.json({ error: "to and subject required" }, { status: 400 });

      // Basic recipient validation so the route can't be used to spam via
      // the shared SMTP_FROM domain with arbitrary body-supplied strings.
      if (typeof to !== "string" || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) {
        return NextResponse.json({ error: "Invalid recipient email" }, { status: 400 });
      }

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

      const result = await resendSendEmail(to, subject, html || "<p>Hello</p>");

      await recordUsage(ownerId, "emails", 1, { client_id: client_id || null, platform: "resend" });

      if (client_id) {
        await supabase.from("trinity_log").insert({
          action_type: "custom",
          description: `Email sent to ${to} via Resend`,
          client_id,
          status: "completed",
          result: { type: "resend_email", to, subject },
        });
      }

      return NextResponse.json({ ...result, sent: true });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (err) {
    return NextResponse.json({ error: `${provider} error: ${err}` }, { status: 500 });
  }
}
