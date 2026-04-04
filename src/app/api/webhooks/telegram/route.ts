import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { parseTrinityMessage, executeTrinityCommand, sendTelegramMessage } from "@/lib/services/trinity";

export async function POST(request: NextRequest) {
  const body = await request.json();
  const message = body.message;

  if (!message?.text || !message?.chat?.id) {
    return NextResponse.json({ ok: true });
  }

  const chatId = String(message.chat.id);
  const text = message.text;
  const supabase = createServiceClient();

  // Only respond to authorized chat IDs
  const allowedChatId = process.env.TELEGRAM_CHAT_ID;
  if (allowedChatId && chatId !== allowedChatId) {
    await sendTelegramMessage(chatId, "Unauthorized. Contact ShortStack admin.");
    return NextResponse.json({ ok: true });
  }

  try {
    // Parse the command with AI
    const command = await parseTrinityMessage(text);

    if (!command) {
      await sendTelegramMessage(chatId, "I couldn't understand that command. Try something like:\n- Build a website for [client]\n- Set up AI receptionist for [client]\n- Create a Discord server called [name]\n- Run email campaign for [client]");
      return NextResponse.json({ ok: true });
    }

    // Log the action
    const { data: logEntry } = await supabase.from("trinity_log").insert({
      action_type: command.action,
      description: command.description,
      command: text,
      status: "in_progress",
    }).select("id").single();

    await sendTelegramMessage(chatId, `🔄 *Processing:* ${command.description}\nAction: \`${command.action}\``);

    // Execute the command
    const result = await executeTrinityCommand(command);

    // Update log
    if (logEntry) {
      await supabase.from("trinity_log").update({
        status: result.success ? "completed" : "failed",
        result: result.result,
        error_message: result.error || null,
        completed_at: new Date().toISOString(),
      }).eq("id", logEntry.id);
    }

    if (result.success) {
      await sendTelegramMessage(chatId, `✅ *Done:* ${result.result.message || command.description}`);
    } else {
      await sendTelegramMessage(chatId, `❌ *Failed:* ${result.error || "Unknown error"}`);
    }
  } catch (err) {
    await sendTelegramMessage(chatId, `❌ Error: ${String(err)}`);
  }

  return NextResponse.json({ ok: true });
}
