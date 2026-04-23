import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { createServerSupabase, createServiceClient } from "@/lib/supabase/server";

/**
 * Set up a client's Telegram bot
 * POST: Register bot token and set webhook
 * DELETE: Remove bot token and unset webhook
 *
 * Multi-tenant isolation guarantees:
 *  1. Caller must own the client row (clients.profile_id = auth.uid()). The
 *     pre-2026-04-23 version only checked that the caller was authenticated,
 *     which meant any logged-in user could overwrite any other agency's bot
 *     token. See docs/telegram-multi-tenancy.md, finding C1.
 *  2. A fresh per-client webhook secret is generated, stored, and passed to
 *     Telegram's setWebhook so the /api/telegram/client-bot handler can verify
 *     every inbound update originated from THIS bot. Without the secret, any
 *     attacker who discovered a client_id could POST forged updates.
 */
export async function POST(request: NextRequest) {
  // Auth check — only authenticated users can setup bots
  const authSupabase = createServerSupabase();
  const { data: { user } } = await authSupabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { client_id, bot_token } = await request.json();

  if (!client_id || !bot_token) {
    return NextResponse.json({ error: "Missing client_id or bot_token" }, { status: 400 });
  }

  // Ownership check — the calling agency user must own this client row, else
  // any authenticated account could overwrite any other agency's bot token.
  const supabase = createServiceClient();
  const { data: ownerCheck } = await supabase
    .from("clients")
    .select("profile_id")
    .eq("id", client_id)
    .maybeSingle();
  if (!ownerCheck || ownerCheck.profile_id !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Validate bot token by calling getMe
  const meRes = await fetch(`https://api.telegram.org/bot${bot_token}/getMe`);
  const meData = await meRes.json();

  if (!meData.ok) {
    return NextResponse.json({ error: "Invalid bot token. Make sure you copied it correctly from @BotFather." }, { status: 400 });
  }

  const botUsername = meData.result.username;
  const botName = meData.result.first_name;

  // Generate a fresh per-client webhook secret. Telegram forwards this in the
  // X-Telegram-Bot-Api-Secret-Token header on every inbound update, which the
  // /api/telegram/client-bot handler constant-time compares against the stored
  // value. Rotating this column is a safe way to invalidate a leaked webhook.
  const webhookSecret = crypto.randomBytes(32).toString("hex");

  // Set webhook to point to our client-bot endpoint, passing secret_token so
  // Telegram will forward it to us on each POST.
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://shortstack-os.vercel.app";
  const webhookUrl = `${baseUrl}/api/telegram/client-bot?client_id=${client_id}`;

  const whRes = await fetch(`https://api.telegram.org/bot${bot_token}/setWebhook`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url: webhookUrl, secret_token: webhookSecret }),
  });
  const whData = await whRes.json();

  if (!whData.ok) {
    return NextResponse.json({ error: "Failed to set webhook: " + (whData.description || "Unknown error") }, { status: 500 });
  }

  // Save token + secret to client record
  await supabase
    .from("clients")
    .update({
      telegram_bot_token: bot_token,
      telegram_bot_username: botUsername,
      telegram_webhook_secret: webhookSecret,
    })
    .eq("id", client_id);

  return NextResponse.json({
    success: true,
    bot_name: botName,
    bot_username: botUsername,
    webhook_url: webhookUrl,
  });
}

export async function DELETE(request: NextRequest) {
  // Auth check
  const authSupabase = createServerSupabase();
  const { data: { user } } = await authSupabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { client_id } = await request.json();
  if (!client_id) {
    return NextResponse.json({ error: "Missing client_id" }, { status: 400 });
  }

  const supabase = createServiceClient();

  // Same ownership check as POST — otherwise any authed user could wipe any
  // agency's bot registration.
  const { data: client } = await supabase
    .from("clients")
    .select("profile_id, telegram_bot_token")
    .eq("id", client_id)
    .maybeSingle();
  if (!client || client.profile_id !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (client.telegram_bot_token) {
    // Remove webhook
    await fetch(`https://api.telegram.org/bot${client.telegram_bot_token}/deleteWebhook`).catch(() => {});
  }

  // Clear from DB
  await supabase
    .from("clients")
    .update({
      telegram_bot_token: null,
      telegram_bot_username: null,
      telegram_chat_id: null,
      telegram_webhook_secret: null,
    })
    .eq("id", client_id);

  return NextResponse.json({ success: true });
}
