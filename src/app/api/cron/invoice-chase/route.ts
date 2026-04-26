import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

export const maxDuration = 30;

// Runs daily at 11 AM — auto-sends invoice reminders for overdue payments
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createServiceClient();
  const today = new Date().toISOString().split("T")[0];
  let chased = 0;

  // Find overdue invoices
  const { data: overdue } = await supabase
    .from("invoices")
    .select("id, client_id, amount, due_date, description")
    .eq("status", "sent")
    .lt("due_date", today);

  if (!overdue || overdue.length === 0) {
    return NextResponse.json({ success: true, message: "No overdue invoices", chased: 0 });
  }

  // Get client details for each overdue invoice
  for (const inv of overdue) {
    const { data: client } = await supabase
      .from("clients")
      .select("business_name, contact_name, email")
      .eq("id", inv.client_id)
      .single();

    if (!client) continue;

    const daysPast = Math.floor((Date.now() - new Date(inv.due_date).getTime()) / 86400000);

    // Log the chase action
    await supabase.from("trinity_log").insert({
      agent: "invoice",
      action_type: "invoice",
      description: `Payment reminder sent to ${client.business_name}: $${inv.amount} (${daysPast} days overdue)`,
      client_id: inv.client_id,
      status: "completed",
      result: {
        type: "chase",
        amount: inv.amount,
        days_overdue: daysPast,
        client_email: client.email,
      },
    });

    // Send via native Resend (GHL path removed Apr 21). The actual reminder
    // email is authored by /api/invoices/auto-remind — this cron only logs the
    // chase event and updates counts.

    chased++;
  }

  // Notify
  const chatId = process.env.TELEGRAM_CHAT_ID;
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  if (chatId && botToken && chased > 0) {
    const { anyRoutineActive } = await import("@/lib/telegram/should-send-routine");
    const chaseOn = await anyRoutineActive(supabase, "invoice_chase");
    if (chaseOn) {
      await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          text: `💰 Invoice Chase\n\nSent ${chased} payment reminders for overdue invoices.`,
        }),
      });
    }
  }

  return NextResponse.json({ success: true, chased, total: overdue.length });
}
