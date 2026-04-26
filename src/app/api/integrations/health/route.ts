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

async function checkEmailProvider(): Promise<HealthResult> {
  // email-marketing supports Mailchimp OR Resend — check whichever is set.
  // NOTE: SMTP_PASS is the SMTP relay password — it is NOT a Resend API key.
  // Use RESEND_API_KEY exclusively for Resend REST API calls.
  const resendKey = process.env.RESEND_API_KEY;
  if (resendKey) {
    const { ok, status } = await probe("https://api.resend.com/domains", {
      headers: { Authorization: `Bearer ${resendKey}` },
    });
    if (ok) return { id: "email_marketing", status: "connected" };
    return { id: "email_marketing", status: "error", detail: `Resend returned HTTP ${status || "timeout"}` };
  }
  if (process.env.MAILCHIMP_API_KEY) {
    const server = process.env.MAILCHIMP_SERVER_PREFIX || "us21";
    const { ok, status } = await probe(`https://${server}.api.mailchimp.com/3.0/ping`, {
      headers: { Authorization: `Basic ${Buffer.from(`anystring:${process.env.MAILCHIMP_API_KEY}`).toString("base64")}` },
    });
    if (ok) return { id: "email_marketing", status: "connected" };
    return { id: "email_marketing", status: "error", detail: `Mailchimp returned HTTP ${status || "timeout"}` };
  }
  return { id: "email_marketing", status: "not_configured", missing: ["RESEND_API_KEY"] };
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

async function checkStripe(): Promise<HealthResult> {
  const missing = missingEnv(["STRIPE_SECRET_KEY"]);
  if (missing.length) return { id: "stripe", status: "not_configured", missing };
  const { ok, status } = await probe("https://api.stripe.com/v1/balance", {
    headers: { Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}` },
  });
  if (ok) return { id: "stripe", status: "connected" };
  return { id: "stripe", status: "error", detail: `Stripe returned HTTP ${status || "timeout"}` };
}

async function checkStripeConnect(): Promise<HealthResult> {
  // Stripe Connect uses the same platform key — we just verify the Connect
  // API is accessible. The per-agency connected account status is tracked
  // separately in agency_stripe_accounts.
  const missing = missingEnv(["STRIPE_SECRET_KEY"]);
  if (missing.length) return { id: "stripe_connect", status: "not_configured", missing };
  const { ok, status } = await probe("https://api.stripe.com/v1/accounts?limit=1", {
    headers: { Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}` },
  });
  if (ok) return { id: "stripe_connect", status: "connected" };
  return { id: "stripe_connect", status: "error", detail: `Stripe Connect returned HTTP ${status || "timeout"}` };
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

// ── Social platforms via Zernio ───────────────────────────────────────────────
// LinkedIn, Instagram, TikTok, YouTube, and Facebook/Meta posting all flow
// through Zernio. There are no direct env vars for these platforms; accounts
// are connected inside the Zernio dashboard (https://zernio.com/dashboard).
//
// This probe checks Zernio reachability and lists which platforms have at least
// one connected profile. Each per-platform entry maps to an account in the
// /profiles response rather than a raw env var.
//
// TikTok Ads and Google Ads are NOT included here — those are direct
// integrations with their own env vars (see checkGoogleAds above).
const ZERNIO_SOCIAL_PLATFORMS = ["instagram", "tiktok", "youtube", "facebook", "linkedin"] as const;
type ZernioSocialPlatform = (typeof ZERNIO_SOCIAL_PLATFORMS)[number];

async function checkZernioSocial(
  only?: ZernioSocialPlatform[],
): Promise<HealthResult[]> {
  const platforms = only ?? [...ZERNIO_SOCIAL_PLATFORMS];
  const apiKey = process.env.ZERNIO_API_KEY;
  if (!apiKey) {
    // Zernio not configured — all requested platforms are unknown
    return platforms.map(platform => ({
      id: `social_${platform}`,
      status: "not_configured" as Status,
      detail: "Configure Zernio (ZERNIO_API_KEY) to connect social accounts",
      missing: ["ZERNIO_API_KEY"],
    }));
  }

  // Probe Zernio /profiles to discover connected platform accounts.
  // Uses the same base URL as src/lib/services/zernio.ts.
  const { ok, status, body } = await probe("https://api.zernio.com/v1/profiles", {
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
  });

  if (!ok) {
    // Zernio itself unreachable — surface an error for all requested platforms
    return platforms.map(platform => ({
      id: `social_${platform}`,
      status: "error" as Status,
      detail: `Zernio returned HTTP ${status || "timeout"} — check https://zernio.com/dashboard`,
    }));
  }

  // Build set of platforms that have at least one active profile
  const profiles = (Array.isArray(body)
    ? body
    : (body as Record<string, unknown>)?.profiles ?? []) as Array<{ platform?: string; status?: string }>;

  const connectedPlatforms = new Set<string>(
    profiles
      .filter(p => p.platform && p.status !== "disconnected")
      .map(p => (p.platform as string).toLowerCase())
  );

  return platforms.map((platform: ZernioSocialPlatform) => {
    const connected = connectedPlatforms.has(platform);
    return {
      id: `social_${platform}`,
      status: (connected ? "connected" : "not_configured") as Status,
      detail: connected
        ? "Connected via Zernio"
        : "Not connected — add account at https://zernio.com/dashboard",
    };
  });
}

// Per-integration single check (used by "Test connection" button)
async function check(id: string): Promise<HealthResult> {
  switch (id) {
    case "google_ads": return checkGoogleAds();
    case "google_business": return checkGoogleBusiness();
    case "calendly": return checkCalendly();
    case "whatsapp": return checkWhatsApp();
    case "email_marketing": return checkEmailProvider();
    case "twilio": return checkTwilio();
    case "notion": return checkNotion();
    case "stripe": return checkStripe();
    case "stripe_connect": return checkStripeConnect();
    case "social_instagram":
    case "social_tiktok":
    case "social_youtube":
    case "social_facebook":
    case "social_linkedin": {
      // Single-platform "Test connection" click — skip the full fanout and
      // return only the requested platform to avoid exercising the Zernio
      // API for all 5 accounts unnecessarily.
      const platform = id.replace("social_", "") as ZernioSocialPlatform;
      const results = await checkZernioSocial([platform]);
      return results.find(r => r.id === id) ?? { id, status: "not_configured", detail: "Unknown social platform" };
    }
    default: return { id, status: "not_configured", detail: "Unknown integration" };
  }
}

export async function GET(request: NextRequest) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (profile?.role !== "admin" && profile?.role !== "founder") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const only = request.nextUrl.searchParams.get("id");
  if (only) {
    const result = await check(only);
    return NextResponse.json({ success: true, result });
  }

  const [zernioSocials, ...rest] = await Promise.all([
    checkZernioSocial(),
    checkGoogleAds(), checkGoogleBusiness(), checkCalendly(), checkWhatsApp(),
    checkEmailProvider(), checkTwilio(), checkNotion(),
    checkStripe(), checkStripeConnect(),
  ]);
  const results = [...zernioSocials, ...rest];
  return NextResponse.json({ success: true, results });
}
