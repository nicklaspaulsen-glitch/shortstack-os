import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase, createServiceClient } from "@/lib/supabase/server";

/**
 * Set up a client's Telegram bot
 * POST: Register bot token and set webhook
 * DELETE: Remove bot token and unset webhook
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

  // Validate bot token by calling getMe
  const meRes = await fetch(`https://api.telegram.org/bot${bot_token}/getMe`);
  const meData = await meRes.json();

  if (!meData.ok) {
    return NextResponse.json({ error: "Invalid bot token. Make sure you copied it correctly from @BotFather." }, { status: 400 });
  }

  const botUsername = meData.result.username;
  const botName = meData.result.first_name;

  // Set webhook to point to our client-bot endpoint
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://shortstack-os.vercel.app";
  const webhookUrl = `${baseUrl}/api/telegram/client-bot?client_id=${client_id}`;

  const whRes = await fetch(`https://api.telegram.org/bot${bot_token}/setWebhook`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url: webhookUrl }),
  });
  const whData = await whRes.json();

  if (!whData.ok) {
    return NextResponse.json({ error: "Failed to set webhook: " + (whData.description || "Unknown error") }, { status: 500 });
  }

  // Save token to client record
  const supabase = createServiceClient();
  await supabase
    .from("clients")
    .update({
      telegram_bot_token: bot_token,
      telegram_bot_username: botUsername,
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
  const { data: client } = await supabase
    .from("clients")
    .select("telegram_bot_token")
    .eq("id", client_id)
    .single();

  if (client?.telegram_bot_token) {
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
    })
    .eq("id", client_id);

  return NextResponse.json({ success: true });
}
