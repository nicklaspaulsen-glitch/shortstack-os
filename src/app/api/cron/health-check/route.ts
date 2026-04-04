import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { sendTelegramMessage } from "@/lib/services/trinity";

interface HealthCheck {
  name: string;
  check: () => Promise<{ healthy: boolean; responseTime: number; error?: string }>;
}

async function checkEndpoint(url: string, headers?: Record<string, string>): Promise<{ healthy: boolean; responseTime: number; error?: string }> {
  const start = Date.now();
  try {
    const res = await fetch(url, {
      headers,
      signal: AbortSignal.timeout(10000),
    });
    return { healthy: res.ok, responseTime: Date.now() - start, error: res.ok ? undefined : `HTTP ${res.status}` };
  } catch (err) {
    return { healthy: false, responseTime: Date.now() - start, error: String(err) };
  }
}

const healthChecks: HealthCheck[] = [
  {
    name: "Supabase",
    check: () => checkEndpoint(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/`, {
      apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "",
    }),
  },
  {
    name: "GoHighLevel",
    check: () => checkEndpoint("https://services.leadconnectorhq.com/locations/", {
      Authorization: `Bearer ${process.env.GHL_API_KEY || ""}`,
      Version: "2021-07-28",
    }),
  },
  {
    name: "Stripe",
    check: () => checkEndpoint("https://api.stripe.com/v1/balance", {
      Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY || ""}`,
    }),
  },
  {
    name: "OpenAI",
    check: () => checkEndpoint("https://api.openai.com/v1/models", {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY || ""}`,
    }),
  },
  {
    name: "Slack",
    check: () => checkEndpoint("https://slack.com/api/auth.test", {
      Authorization: `Bearer ${process.env.SLACK_BOT_TOKEN || ""}`,
    }),
  },
  {
    name: "Telegram",
    check: () => checkEndpoint(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN || "test"}/getMe`),
  },
  {
    name: "Google Places",
    check: () => checkEndpoint(`https://maps.googleapis.com/maps/api/place/textsearch/json?query=test&key=${process.env.GOOGLE_PLACES_API_KEY || "test"}`),
  },
  {
    name: "Meta/Facebook",
    check: () => checkEndpoint(`https://graph.facebook.com/v18.0/me?access_token=${process.env.META_ACCESS_TOKEN || "test"}`),
  },
  {
    name: "TikTok",
    check: () => checkEndpoint("https://open.tiktokapis.com/v2/user/info/", {
      Authorization: `Bearer ${process.env.TIKTOK_ACCESS_TOKEN || ""}`,
    }),
  },
  {
    name: "YouTube",
    check: () => checkEndpoint(`https://www.googleapis.com/youtube/v3/channels?part=id&mine=true&key=${process.env.YOUTUBE_API_KEY || "test"}`),
  },
  {
    name: "Google Ads",
    check: () => checkEndpoint("https://googleads.googleapis.com/v14/customers:listAccessibleCustomers", {
      Authorization: `Bearer ${process.env.GOOGLE_ADS_REFRESH_TOKEN || ""}`,
      "developer-token": process.env.GOOGLE_ADS_DEVELOPER_TOKEN || "",
    }),
  },
  {
    name: "Instagram",
    check: () => checkEndpoint(`https://graph.facebook.com/v18.0/me/accounts?access_token=${process.env.META_ACCESS_TOKEN || "test"}`),
  },
  {
    name: "LinkedIn",
    check: () => checkEndpoint("https://api.linkedin.com/v2/me", {
      Authorization: `Bearer ${process.env.LINKEDIN_ACCESS_TOKEN || ""}`,
    }),
  },
  { name: "PandaDoc", check: () => checkEndpoint("https://api.pandadoc.com/public/v1/documents", { Authorization: `Bearer ${process.env.PANDADOC_API_KEY || ""}` }) },
  { name: "Canva", check: () => checkEndpoint("https://api.canva.com/rest/v1/users/me", { Authorization: `Bearer ${process.env.CANVA_API_KEY || ""}` }) },
  { name: "Retell AI", check: () => checkEndpoint("https://api.retellai.com/list-agents", { Authorization: `Bearer ${process.env.RETELL_API_KEY || ""}` }) },
  { name: "GoDaddy", check: () => checkEndpoint("https://api.godaddy.com/v1/domains/available?domain=example.com", { Authorization: `sso-key ${process.env.GODADDY_API_KEY || ""}:${process.env.GODADDY_API_SECRET || ""}` }) },
  { name: "Google Drive", check: () => checkEndpoint("https://www.googleapis.com/drive/v3/about?fields=user", { Authorization: `Bearer ${process.env.GOOGLE_REFRESH_TOKEN || ""}` }) },
  { name: "TikTok Ads", check: () => checkEndpoint("https://business-api.tiktok.com/open_api/v1.3/oauth2/advertiser/get/", { "Access-Token": process.env.TIKTOK_ADS_ACCESS_TOKEN || "" }) },
  { name: "Meta Ads", check: () => checkEndpoint(`https://graph.facebook.com/v18.0/act_0/campaigns?access_token=${process.env.META_ADS_ACCESS_TOKEN || "test"}`) },
];

export async function GET(_request: NextRequest) {
  const supabase = createServiceClient();
  const alerts: string[] = [];

  for (const hc of healthChecks) {
    const result = await hc.check();
    const status = result.healthy ? "healthy" : result.responseTime > 5000 ? "degraded" : "down";

    // Upsert health record
    const { data: existing } = await supabase
      .from("system_health")
      .select("id, status")
      .eq("integration_name", hc.name)
      .single();

    const record = {
      integration_name: hc.name,
      status,
      last_check_at: new Date().toISOString(),
      last_healthy_at: result.healthy ? new Date().toISOString() : undefined,
      error_message: result.error || null,
      response_time_ms: result.responseTime,
    };

    if (existing) {
      await supabase.from("system_health").update(record).eq("id", existing.id);

      // Alert if status changed to down
      if (existing.status !== "down" && status === "down") {
        alerts.push(`⚠️ ${hc.name} is DOWN: ${result.error}`);
      }
    } else {
      await supabase.from("system_health").insert(record);
    }

    // Log history
    await supabase.from("system_health_history").insert({
      integration_name: hc.name,
      status,
      response_time_ms: result.responseTime,
      error_message: result.error || null,
    });
  }

  // Send Telegram alerts for any new issues
  if (alerts.length > 0) {
    const chatId = process.env.TELEGRAM_CHAT_ID;
    if (chatId) {
      await sendTelegramMessage(chatId, `🚨 *System Alert*\n\n${alerts.join("\n")}`);
    }
  }

  return NextResponse.json({
    success: true,
    checked: healthChecks.length,
    alerts: alerts.length,
    timestamp: new Date().toISOString(),
  });
}
