import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

// Email Marketing Integration — supports both Mailchimp and SendGrid
// Mailchimp: MAILCHIMP_API_KEY, MAILCHIMP_SERVER_PREFIX (e.g., us21)
// SendGrid: SENDGRID_API_KEY

function getProvider(): "mailchimp" | "sendgrid" | null {
  if (process.env.MAILCHIMP_API_KEY) return "mailchimp";
  if (process.env.SENDGRID_API_KEY) return "sendgrid";
  return null;
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

// ── SendGrid Helpers ──

async function sendgridFetch(path: string, options: RequestInit = {}) {
  return fetch(`https://api.sendgrid.com/v3${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${process.env.SENDGRID_API_KEY}`,
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });
}

async function sendgridGetLists() {
  const res = await sendgridFetch("/marketing/lists?page_size=50");
  const data = await res.json();
  return (data.result || []).map((l: Record<string, unknown>) => ({
    id: l.id, name: l.name, contact_count: l.contact_count,
  }));
}

async function sendgridSendEmail(to: string, subject: string, html: string, from?: string) {
  const res = await sendgridFetch("/mail/send", {
    method: "POST",
    body: JSON.stringify({
      personalizations: [{ to: [{ email: to }] }],
      from: { email: from || process.env.SENDGRID_FROM_EMAIL || "hello@shortstack.agency" },
      subject,
      content: [{ type: "text/html", value: html }],
    }),
  });
  return { success: res.status === 202 };
}

async function sendgridAddContact(email: string, firstName: string, lastName: string, listIds: string[]) {
  const res = await sendgridFetch("/marketing/contacts", {
    method: "PUT",
    body: JSON.stringify({
      list_ids: listIds,
      contacts: [{ email, first_name: firstName, last_name: lastName }],
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

    if (provider === "sendgrid") {
      if (action === "lists") return NextResponse.json({ success: true, provider, lists: await sendgridGetLists() });
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

  try {
    if (action === "add_contact") {
      const { list_id, email, first_name, last_name, tags } = params;
      if (!email) return NextResponse.json({ error: "email required" }, { status: 400 });

      let result;
      if (provider === "mailchimp") {
        result = await mailchimpAddContact(list_id, email, first_name || "", last_name || "", tags || []);
      } else {
        result = await sendgridAddContact(email, first_name || "", last_name || "", list_id ? [list_id] : []);
      }

      if (client_id) {
        await supabase.from("trinity_log").insert({
          action_type: "custom",
          description: `Added ${email} to ${provider} list`,
          client_id,
          status: "completed",
          result: { type: "email_marketing_contact", provider, email },
        });
      }

      return NextResponse.json({ success: true, provider, result });
    }

    if (action === "send_email" && provider === "sendgrid") {
      const { to, subject, html } = params;
      if (!to || !subject) return NextResponse.json({ error: "to and subject required" }, { status: 400 });
      const result = await sendgridSendEmail(to, subject, html || "<p>Hello</p>");

      if (client_id) {
        await supabase.from("trinity_log").insert({
          action_type: "custom",
          description: `Email sent to ${to} via SendGrid`,
          client_id,
          status: "completed",
          result: { type: "sendgrid_email", to, subject },
        });
      }

      return NextResponse.json({ ...result, sent: true });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (err) {
    return NextResponse.json({ error: `${provider} error: ${err}` }, { status: 500 });
  }
}
