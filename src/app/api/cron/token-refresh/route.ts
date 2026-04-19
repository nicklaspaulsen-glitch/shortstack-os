import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

// Cron: Refresh expiring OAuth tokens (runs daily)
// Vercel Cron: 0 3 * * * (3 AM daily)
// Refreshes Google tokens that expire within 24 hours

export async function GET(request: NextRequest) {
  // Verify cron secret to prevent unauthorized triggering
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createServiceClient();

  // Find tokens expiring in next 24 hours
  const expiresThreshold = new Date(Date.now() + 24 * 3600000).toISOString();
  const { data: accounts } = await supabase
    .from("social_accounts")
    .select("id, platform, client_id, access_token, refresh_token, token_expires_at, account_name")
    .eq("is_active", true)
    .not("refresh_token", "is", null)
    .lt("token_expires_at", expiresThreshold);

  if (!accounts || accounts.length === 0) {
    return NextResponse.json({ success: true, message: "No tokens need refresh", refreshed: 0 });
  }

  let refreshed = 0;
  let failed = 0;

  for (const account of accounts) {
    try {
      // Google tokens
      if (["youtube", "google_business", "google_ads"].includes(account.platform)) {
        const res = await fetch("https://oauth2.googleapis.com/token", {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            client_id: process.env.GOOGLE_CLIENT_ID || "",
            client_secret: process.env.GOOGLE_CLIENT_SECRET || "",
            refresh_token: account.refresh_token,
            grant_type: "refresh_token",
          }),
        });
        const data = await res.json();

        if (data.access_token) {
          await supabase.from("social_accounts").update({
            access_token: data.access_token,
            token_expires_at: new Date(Date.now() + (data.expires_in || 3600) * 1000).toISOString(),
          }).eq("id", account.id);
          refreshed++;
        } else {
          failed++;
        }
      }

      // Meta tokens (long-lived token exchange)
      if (["facebook", "instagram", "meta_ads"].includes(account.platform)) {
        const res = await fetch(
          `https://graph.facebook.com/v21.0/oauth/access_token?grant_type=fb_exchange_token&client_id=${process.env.META_APP_ID}&client_secret=${process.env.META_APP_SECRET}&fb_exchange_token=${account.access_token}`
        );
        const data = await res.json();
        if (data.access_token) {
          await supabase.from("social_accounts").update({
            access_token: data.access_token,
            token_expires_at: new Date(Date.now() + (data.expires_in || 5184000) * 1000).toISOString(),
          }).eq("id", account.id);
          refreshed++;
        } else {
          failed++;
        }
      }
    } catch {
      failed++;
    }
  }

  // Log results
  await supabase.from("trinity_log").insert({
    action_type: "custom",
    description: `Token refresh: ${refreshed} refreshed, ${failed} failed out of ${accounts.length}`,
    status: failed === 0 ? "completed" : "warning",
    result: { type: "token_refresh", refreshed, failed, total: accounts.length },
  });

  // Notify on failures via Telegram
  if (failed > 0) {
    const chatId = process.env.TELEGRAM_CHAT_ID;
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    if (chatId && botToken) {
      await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          text: `⚠️ Token Refresh: ${failed} token(s) failed to refresh. Check integrations.`,
        }),
      }).catch(() => {});
    }
  }

  return NextResponse.json({ success: true, refreshed, failed, total: accounts.length });
}
