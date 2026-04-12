import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { sendTelegramMessage } from "@/lib/services/trinity";

// Runs every 10-30 min via Vercel Cron to check for due reminders
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createServiceClient();
  // Find pending reminders that are due
  const { data: dueReminders } = await supabase
    .from("trinity_log")
    .select("id, description, result")
    .eq("action_type", "reminder")
    .eq("status", "pending")
    .order("created_at", { ascending: true });

  if (!dueReminders || dueReminders.length === 0) {
    return NextResponse.json({ sent: 0 });
  }

  let sent = 0;

  for (const reminder of dueReminders) {
    const scheduledAt = reminder.result?.scheduled_at;
    if (!scheduledAt) continue;

    const scheduledDate = new Date(scheduledAt);
    if (scheduledDate > new Date()) continue; // Not due yet

    const chatId = reminder.result?.chat_id || process.env.TELEGRAM_CHAT_ID;
    if (!chatId) continue;

    // Send the reminder
    await sendTelegramMessage(
      chatId,
      `🔔 *Reminder*\n\n${reminder.description}`
    );

    // Mark as completed
    await supabase
      .from("trinity_log")
      .update({
        status: "completed",
        completed_at: new Date().toISOString(),
      })
      .eq("id", reminder.id);

    sent++;
  }

  return NextResponse.json({ sent, checked: dueReminders.length });
}
