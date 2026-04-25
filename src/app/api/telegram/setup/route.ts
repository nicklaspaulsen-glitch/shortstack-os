import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

const TELEGRAM_API = "https://api.telegram.org/bot";

// POST — Set webhook URL with Telegram Bot API
export async function POST(request: NextRequest) {
  const authSupabase = createServerSupabase();
  const { data: { user } } = await authSupabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { bot_token } = await request.json();
    const token = bot_token || process.env.TELEGRAM_BOT_TOKEN;

    if (!token) {
      return NextResponse.json({ error: "No bot token provided" }, { status: 400 });
    }

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://app.shortstack.work";
    const webhookUrl = `${baseUrl}/api/telegram/webhook`;
    const secretToken = process.env.TELEGRAM_WEBHOOK_SECRET;

    const body: Record<string, unknown> = {
      url: webhookUrl,
      allowed_updates: ["message", "callback_query"],
    };
    if (secretToken) {
      body.secret_token = secretToken;
    }

    const res = await fetch(`${TELEGRAM_API}${token}/setWebhook`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    const data = await res.json();

    if (!data.ok) {
      return NextResponse.json(
        { error: data.description || "Failed to set webhook" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      webhook_url: webhookUrl,
      description: data.description,
    });
  } catch (error) {
    console.error("[telegram/setup] POST error:", error);
    return NextResponse.json({ error: "Failed to set webhook" }, { status: 500 });
  }
}

// GET — Get bot info via getMe
export async function GET() {
  try {
    const token = process.env.TELEGRAM_BOT_TOKEN;

    if (!token) {
      return NextResponse.json({ error: "TELEGRAM_BOT_TOKEN not configured" }, { status: 400 });
    }

    const [meRes, whRes] = await Promise.all([
      fetch(`${TELEGRAM_API}${token}/getMe`),
      fetch(`${TELEGRAM_API}${token}/getWebhookInfo`),
    ]);

    const meData = await meRes.json();
    const whData = await whRes.json();

    if (!meData.ok) {
      return NextResponse.json({ error: "Invalid bot token" }, { status: 400 });
    }

    return NextResponse.json({
      bot: meData.result,
      webhook: whData.result || null,
    });
  } catch (error) {
    console.error("[telegram/setup] GET error:", error);
    return NextResponse.json({ error: "Failed to get bot info" }, { status: 500 });
  }
}

// DELETE — Remove webhook
export async function DELETE() {
  try {
    const token = process.env.TELEGRAM_BOT_TOKEN;

    if (!token) {
      return NextResponse.json({ error: "TELEGRAM_BOT_TOKEN not configured" }, { status: 400 });
    }

    const res = await fetch(`${TELEGRAM_API}${token}/deleteWebhook`);
    const data = await res.json();

    if (!data.ok) {
      return NextResponse.json(
        { error: data.description || "Failed to remove webhook" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      description: data.description,
    });
  } catch (error) {
    console.error("[telegram/setup] DELETE error:", error);
    return NextResponse.json({ error: "Failed to remove webhook" }, { status: 500 });
  }
}
