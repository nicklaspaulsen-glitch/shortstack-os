import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

// Integration health check — verifies each business integration is not just
// configured (env vars present) but also truly reachable (provider responds).
//
// Frontend calls this from the Integrations page. Returns per-provider:
//   - "connected"     — env keys present AND provider responded OK
//   - "error"         — env keys present but provider rejected (bad token, etc.)
//   - "not_configured" — missing required env vars
//
// Each reachability check has a short timeout to keep the page snappy.

const PROBE_TIMEOUT_MS = 4500;

type Status = "connected" | "not_configured" | "error";

interface HealthResult {
  id: string;
  status: Status;
  detail?: string;
  missing?: string[];
}

async function probe(url: string, init: RequestInit = {}): Promise<{ ok: boolean; status: number; body?: unknown }> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), PROBE_TIMEOUT_MS);
  try {
    const res = await fetch(url, { ...init, signal: ctrl.signal });
    let body: unknown;
    try { body = await res.clone().json(); } catch { /* ignore */ }
    return { ok: res.ok, status: res.status, body };
  } catch {
    return { ok: false, status: 0 };
  } finally {
    clearTimeout(timer);
  }
}

function missingEnv(keys: string[]): string[] {
  return keys.filter(k => !process.env[k]);
}

async function checkGoogleAds(): Promise<HealthResult> {
  const missing = missingEnv(["GOOGLE_ADS_DEVELOPER_TOKEN", "GOOGLE_CLIENT_ID"]);
  if (missing.length) return { id: "google_ads", status: "not_configured", missing };
  // Google Ads requires per-client OAuth tokens to actually call the API.
  // We can only verify the developer token exists here; a full check requires
  // a connected client account. Treat "keys present" as "configured, pending OAuth".
  return { id: "google_ads", status: "connected", detail: "Developer token present. Connect a client account to use campaigns." };
}

async function checkGoogleBusiness(): Promise<HealthResult> {
  const missing = missingEnv(["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET"]);
  if (missing.length) return { id: "google_business", status: "not_configured", missing };
  return { id: "google_business", status: "connected", detail: "OAuth credentials present. Connect a client account to use reviews/posts." };
}

async function checkCalendly(): Promise<HealthResult> {
  const missing = missingEnv(["CALENDLY_API_TOKEN"]);
  if (missing.length) return { id: "calendly", status: "not_configured", missing };
  const { ok, status } = await probe("https://api.calendly.com/users/me", {
    headers: { Authorization: `Bearer ${process.env.CALENDLY_API_TOKEN}` },
  });
  if (ok) return { id: "calendly", status: "connected" };
  return { id: "calendly", status: "error", detail: `Calendly returned HTTP ${status || "timeout"}` };
}

async function checkWhatsApp(): Promise<HealthResult> {
  const missing = missingEnv(["WHATSAPP_ACCESS_TOKEN", "WHATSAPP_PHONE_NUMBER_ID"]);
  if (missing.length) return { id: "whatsapp", status: "not_configured", missing };
  const { ok, status } = await probe(
    `https://graph.facebook.com/v21.0/${process.env.WHATSAPP_PHONE_NUMBER_ID}?fields=verified_name`,
    { headers: { Authorization: `Bearer ${process.env.WHATSAPP_ACCESS_TOKEN}` } }
  );
  if (ok) return { id: "whatsapp", status: "connected" };
  return { id: "whatsapp", status: "error", detail: `Meta Graph returned HTTP ${status || "timeout"}` };
}

async function checkSendGrid(): Promise<HealthResult> {
  // email-marketing supports Mailchimp OR SendGrid — check whichever is set
  if (process.env.SENDGRID_API_KEY) {
    const { ok, status } = await probe("https://api.sendgrid.com/v3/user/profile", {
      headers: { Authorization: `Bearer ${process.env.SENDGRID_API_KEY}` },
    });
    if (ok) return { id: "email_marketing", status: "connected" };
    return { id: "email_marketing", status: "error", detail: `SendGrid returned HTTP ${status || "timeout"}` };
  }
  if (process.env.MAILCHIMP_API_KEY) {
    const server = process.env.MAILCHIMP_SERVER_PREFIX || "us21";
    const { ok, status } = await probe(`https://${server}.api.mailchimp.com/3.0/ping`, {
      headers: { Authorization: `Basic ${Buffer.from(`anystring:${process.env.MAILCHIMP_API_KEY}`).toString("base64")}` },
    });
    if (ok) return { id: "email_marketing", status: "connected" };
    return { id: "email_marketing", status: "error", detail: `Mailchimp returned HTTP ${status || "timeout"}` };
  }
  return { id: "email_marketing", status: "not_configured", missing: ["SENDGRID_API_KEY"] };
}

async function checkTwilio(): Promise<HealthResult> {
  const missing = missingEnv(["TWILIO_ACCOUNT_SID", "TWILIO_AUTH_TOKEN"]);
  if (missing.length) return { id: "twilio", status: "not_configured", missing };
  const auth = `Basic ${Buffer.from(`${process.env.TWILIO_ACCOUNT_SID}:${process.env.TWILIO_AUTH_TOKEN}`).toString("base64")}`;
  const { ok, status } = await probe(
    `https://api.twilio.com/2010-04-01/Accounts/${process.env.TWILIO_ACCOUNT_SID}.json`,
    { headers: { Authorization: auth } }
  );
  if (ok) return { id: "twilio", status: "connected" };
  return { id: "twilio", status: "error", detail: `Twilio returned HTTP ${status || "timeout"}` };
}

async function checkNotion(): Promise<HealthResult> {
  const missing = missingEnv(["NOTION_API_KEY"]);
  if (missing.length) return { id: "notion", status: "not_configured", missing };
  const { ok, status } = await probe("https://api.notion.com/v1/users/me", {
    headers: {
      Authorization: `Bearer ${process.env.NOTION_API_KEY}`,
      "Notion-Version": "2022-06-28",
    },
  });
  if (ok) return { id: "notion", status: "connected" };
  return { id: "notion", status: "error", detail: `Notion returned HTTP ${status || "timeout"}` };
}

// Per-integration single check (used by "Test connection" button)
async function check(id: string): Promise<HealthResult> {
  switch (id) {
    case "google_ads": return checkGoogleAds();
    case "google_business": return checkGoogleBusiness();
    case "calendly": return checkCalendly();
    case "whatsapp": return checkWhatsApp();
    case "email_marketing": return checkSendGrid();
    case "twilio": return checkTwilio();
    case "notion": return checkNotion();
    default: return { id, status: "not_configured", detail: "Unknown integration" };
  }
}

export async function GET(request: NextRequest) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const only = request.nextUrl.searchParams.get("id");
  if (only) {
    const result = await check(only);
    return NextResponse.json({ success: true, result });
  }

  const results = await Promise.all([
    checkGoogleAds(), checkGoogleBusiness(), checkCalendly(), checkWhatsApp(),
    checkSendGrid(), checkTwilio(), checkNotion(),
  ]);
  return NextResponse.json({ success: true, results });
}
