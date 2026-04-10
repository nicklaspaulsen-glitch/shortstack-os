import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  const { score, feedback, client_id } = await request.json();

  const supabase = createServiceClient();

  await supabase.from("trinity_log").insert({
    agent: "analytics",
    action_type: "custom",
    description: `NPS Survey: ${score}/10${feedback ? ` — "${feedback.substring(0, 100)}"` : ""}`,
    client_id: client_id || null,
    status: "completed",
    result: { type: "nps_survey", score, feedback, submitted_at: new Date().toISOString() },
  });

  // Notify on Telegram
  const chatId = process.env.TELEGRAM_CHAT_ID;
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  if (chatId && botToken) {
    const emoji = score >= 9 ? "🟢" : score >= 7 ? "🟡" : "🔴";
    await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text: `${emoji} NPS Survey Response\n\nScore: ${score}/10\n${feedback ? `Feedback: "${feedback}"` : "No feedback provided"}`,
      }),
    });
  }

  return NextResponse.json({ success: true });
}
