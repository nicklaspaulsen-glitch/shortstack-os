import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { sendTelegramMessage } from "@/lib/services/trinity";

interface HealthCheck {
  name: string;
  check: () => Promise<{ healthy: boolean; responseTime: number; error?: string; degraded?: boolean }>;
  requiresCredential?: () => boolean;
}

async function checkEndpoint(url: string, headers?: Record<string, string>): Promise<{ healthy: boolean; responseTime: number; error?: string; degraded?: boolean }> {
  const start = Date.now();
  try {
    const res = await fetch(url, {
      headers,
      signal: AbortSignal.timeout(10000),
    });
    const responseTime = Date.now() - start;
    // Slow but working = degraded, not down
    if (res.ok && responseTime > 5000) {
      return { healthy: true, responseTime, degraded: true };
    }
    return { healthy: res.ok, responseTime, error: res.ok ? undefined : `HTTP ${res.status}` };
  } catch (err) {
    const responseTime = Date.now() - start;
    const errStr = String(err);
    // Timeout = degraded (service exists but slow), not down
    const isTimeout = errStr.includes("TimeoutError") || errStr.includes("abort") || responseTime >= 9500;
    return { healthy: false, responseTime, error: errStr, degraded: isTimeout };
  }
}

// Check if an API key/token is actually configured (not empty/placeholder)
function hasCredential(...keys: (string | undefined)[]): boolean {
  return keys.every(k => k && k.length > 5 && k !== "test" && k !== "undefined");
}

const healthChecks: HealthCheck[] = [
  {
    name: "Supabase",
    check: () => checkEndpoint(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/`, {
      apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "",
    }),
    requiresCredential: () => hasCredential(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
  },
  {
    name: "GoHighLevel",
    check: () => checkEndpoint("https://services.leadconnectorhq.com/locations/", {
      Authorization: `Bearer ${process.env.GHL_API_KEY || ""}`,
      Version: "2021-07-28",
    }),
    requiresCredential: () => hasCredential(process.env.GHL_API_KEY),
  },
  {
    name: "Stripe",
    check: () => checkEndpoint("https://api.stripe.com/v1/balance", {
      Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY || ""}`,
    }),
    requiresCredential: () => hasCredential(process.env.STRIPE_SECRET_KEY),
  },
  {
    name: "OpenAI",
    check: () => checkEndpoint("https://api.openai.com/v1/models", {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY || ""}`,
    }),
    requiresCredential: () => hasCredential(process.env.OPENAI_API_KEY),
  },
  {
    name: "Slack",
    check: () => checkEndpoint("https://slack.com/api/auth.test", {
      Authorization: `Bearer ${process.env.SLACK_BOT_TOKEN || ""}`,
    }),
    requiresCredential: () => hasCredential(process.env.SLACK_BOT_TOKEN),
  },
  {
    name: "Telegram",
    check: () => checkEndpoint(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN || "test"}/getMe`),
    requiresCredential: () => hasCredential(process.env.TELEGRAM_BOT_TOKEN),
  },
  {
    name: "Google Places",
    check: () => checkEndpoint(`https://maps.googleapis.com/maps/api/place/textsearch/json?query=test&key=${process.env.GOOGLE_PLACES_API_KEY || "test"}`),
    requiresCredential: () => hasCredential(process.env.GOOGLE_PLACES_API_KEY),
  },
  {
    name: "Meta/Facebook",
    check: () => checkEndpoint(`https://graph.facebook.com/v18.0/me?access_token=${process.env.META_ACCESS_TOKEN || "test"}`),
    requiresCredential: () => hasCredential(process.env.META_ACCESS_TOKEN),
  },
  {
    name: "TikTok",
    check: () => checkEndpoint("https://open.tiktokapis.com/v2/user/info/", {
      Authorization: `Bearer ${process.env.TIKTOK_ACCESS_TOKEN || ""}`,
    }),
    requiresCredential: () => hasCredential(process.env.TIKTOK_ACCESS_TOKEN),
  },
  {
    name: "YouTube",
    check: () => checkEndpoint(`https://www.googleapis.com/youtube/v3/channels?part=id&mine=true&key=${process.env.YOUTUBE_API_KEY || "test"}`),
    requiresCredential: () => hasCredential(process.env.YOUTUBE_API_KEY),
  },
  {
    name: "Google Ads",
    check: () => checkEndpoint("https://googleads.googleapis.com/v14/customers:listAccessibleCustomers", {
      Authorization: `Bearer ${process.env.GOOGLE_ADS_REFRESH_TOKEN || ""}`,
      "developer-token": process.env.GOOGLE_ADS_DEVELOPER_TOKEN || "",
    }),
    requiresCredential: () => hasCredential(process.env.GOOGLE_ADS_REFRESH_TOKEN, process.env.GOOGLE_ADS_DEVELOPER_TOKEN),
  },
  {
    name: "Instagram",
    check: () => checkEndpoint(`https://graph.facebook.com/v18.0/me/accounts?access_token=${process.env.META_ACCESS_TOKEN || "test"}`),
    requiresCredential: () => hasCredential(process.env.META_ACCESS_TOKEN),
  },
  {
    name: "LinkedIn",
    check: () => checkEndpoint("https://api.linkedin.com/v2/me", {
      Authorization: `Bearer ${process.env.LINKEDIN_ACCESS_TOKEN || ""}`,
    }),
    requiresCredential: () => hasCredential(process.env.LINKEDIN_ACCESS_TOKEN),
  },
  {
    name: "PandaDoc",
    check: () => checkEndpoint("https://api.pandadoc.com/public/v1/documents", { Authorization: `Bearer ${process.env.PANDADOC_API_KEY || ""}` }),
    requiresCredential: () => hasCredential(process.env.PANDADOC_API_KEY),
  },
  {
    name: "Canva",
    check: () => checkEndpoint("https://api.canva.com/rest/v1/users/me", { Authorization: `Bearer ${process.env.CANVA_API_KEY || ""}` }),
    requiresCredential: () => hasCredential(process.env.CANVA_API_KEY),
  },
  {
    name: "Retell AI",
    check: () => checkEndpoint("https://api.retellai.com/list-agents", { Authorization: `Bearer ${process.env.RETELL_API_KEY || ""}` }),
    requiresCredential: () => hasCredential(process.env.RETELL_API_KEY),
  },
  {
    name: "GoDaddy",
    check: () => checkEndpoint("https://api.godaddy.com/v1/domains/available?domain=example.com", { Authorization: `sso-key ${process.env.GODADDY_API_KEY || ""}:${process.env.GODADDY_API_SECRET || ""}` }),
    requiresCredential: () => hasCredential(process.env.GODADDY_API_KEY, process.env.GODADDY_API_SECRET),
  },
  {
    name: "Google Drive",
    check: () => checkEndpoint("https://www.googleapis.com/drive/v3/about?fields=user", { Authorization: `Bearer ${process.env.GOOGLE_REFRESH_TOKEN || ""}` }),
    requiresCredential: () => hasCredential(process.env.GOOGLE_REFRESH_TOKEN),
  },
  {
    name: "TikTok Ads",
    check: () => checkEndpoint("https://business-api.tiktok.com/open_api/v1.3/oauth2/advertiser/get/", { "Access-Token": process.env.TIKTOK_ADS_ACCESS_TOKEN || "" }),
    requiresCredential: () => hasCredential(process.env.TIKTOK_ADS_ACCESS_TOKEN),
  },
  {
    name: "Meta Ads",
    check: () => checkEndpoint(`https://graph.facebook.com/v18.0/act_0/campaigns?access_token=${process.env.META_ADS_ACCESS_TOKEN || "test"}`),
    requiresCredential: () => hasCredential(process.env.META_ADS_ACCESS_TOKEN),
  },
  {
    name: "Zernio",
    check: () => checkEndpoint("https://api.zernio.com/v1/profiles", {
      Authorization: `Bearer ${process.env.ZERNIO_API_KEY || ""}`,
    }),
    requiresCredential: () => hasCredential(process.env.ZERNIO_API_KEY),
  },
  {
    name: "Ayrshare",
    check: () => checkEndpoint("https://app.ayrshare.com/api/user", {
      Authorization: `Bearer ${process.env.AYRSHARE_API_KEY || ""}`,
    }),
    requiresCredential: () => hasCredential(process.env.AYRSHARE_API_KEY),
  },
  {
    name: "Twilio",
    check: async () => {
      const sid = process.env.TWILIO_ACCOUNT_SID || "";
      const token = process.env.TWILIO_AUTH_TOKEN || "";
      return checkEndpoint(`https://api.twilio.com/2010-04-01/Accounts/${sid}.json`, {
        Authorization: `Basic ${Buffer.from(`${sid}:${token}`).toString("base64")}`,
      });
    },
    requiresCredential: () => hasCredential(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN),
  },
  {
    name: "ElevenLabs",
    check: () => checkEndpoint("https://api.elevenlabs.io/v1/user/subscription", {
      "xi-api-key": process.env.ELEVENLABS_API_KEY || "",
    }),
    requiresCredential: () => hasCredential(process.env.ELEVENLABS_API_KEY),
  },
  {
    name: "SendGrid",
    check: () => checkEndpoint("https://api.sendgrid.com/v3/user/profile", {
      Authorization: `Bearer ${process.env.SENDGRID_API_KEY || ""}`,
    }),
    requiresCredential: () => hasCredential(process.env.SENDGRID_API_KEY),
  },
];

export async function GET(_request: NextRequest) {
  const supabase = createServiceClient();
  const alerts: string[] = [];
  let checked = 0;
  let skipped = 0;

  for (const hc of healthChecks) {
    // Skip integrations that aren't configured (no API key)
    if (hc.requiresCredential && !hc.requiresCredential()) {
      // Mark as unknown (not configured) instead of false-alarm "down"
      const { data: existing } = await supabase
        .from("system_health")
        .select("id")
        .eq("integration_name", hc.name)
        .single();

      const record = {
        integration_name: hc.name,
        status: "unknown",
        last_check_at: new Date().toISOString(),
        error_message: "Not configured — API key missing",
        response_time_ms: 0,
      };

      if (existing) {
        await supabase.from("system_health").update(record).eq("id", existing.id);
      } else {
        await supabase.from("system_health").insert(record);
      }
      skipped++;
      continue;
    }

    const result = await hc.check();

    // Better status classification:
    // healthy = 2xx response in reasonable time
    // degraded = timeout, slow response, or transient error (likely recoverable)
    // down = confirmed failure (bad credentials, service error, etc.)
    let status: string;
    if (result.healthy && !result.degraded) {
      status = "healthy";
    } else if (result.degraded) {
      status = "degraded";
    } else {
      // Categorize error type
      const errorStr = result.error || "";
      const isAuthError = errorStr.includes("401") || errorStr.includes("403");
      const isNotFound = errorStr.includes("404");
      const isServerError = errorStr.includes("500") || errorStr.includes("502") || errorStr.includes("503");
      // Auth/404 = degraded (service is up, just needs credentials or endpoint update)
      // Server errors = actually down
      status = (isAuthError || isNotFound) ? "degraded" : isServerError ? "down" : "down";
    }

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

      // Alert on status transitions (only when status genuinely changes)
      if (existing.status === "healthy" && status === "down") {
        alerts.push(`🔴 ${hc.name} is DOWN: ${result.error}`);
      } else if (existing.status !== "healthy" && status === "healthy") {
        alerts.push(`🟢 ${hc.name} is BACK UP! (${result.responseTime}ms)`);
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

    checked++;
  }

  // Send Telegram alerts for confirmed outages only
  if (alerts.length > 0) {
    const chatId = process.env.TELEGRAM_CHAT_ID;
    if (chatId) {
      await sendTelegramMessage(chatId, `🚨 *System Alert*\n\n${alerts.map(a => `⚠️ ${a}`).join("\n")}`);
    }
  }

  // === Check for due reminders ===
  let remindersSent = 0;
  const { data: dueReminders } = await supabase
    .from("trinity_log")
    .select("id, description, result")
    .eq("action_type", "reminder")
    .eq("status", "pending");

  if (dueReminders) {
    const now = new Date();
    for (const reminder of dueReminders) {
      const result = reminder.result as Record<string, string> | null;
      const scheduledAt = result?.scheduled_at ? new Date(result.scheduled_at) : null;
      if (scheduledAt && scheduledAt <= now) {
        const targetChatId = result?.chat_id || process.env.TELEGRAM_CHAT_ID;
        if (targetChatId) {
          await sendTelegramMessage(targetChatId, `⏰ *Reminder*\n\n${reminder.description}`);
          await supabase.from("trinity_log").update({ status: "completed", completed_at: now.toISOString() }).eq("id", reminder.id);
          remindersSent++;
        }
      }
    }
  }

  return NextResponse.json({
    success: true,
    checked,
    skipped,
    alerts: alerts.length,
    remindersSent,
    timestamp: new Date().toISOString(),
  });
}
