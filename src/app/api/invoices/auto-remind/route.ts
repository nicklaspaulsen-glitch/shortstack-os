import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { sendTelegramMessage } from "@/lib/services/trinity";
import { sendEmail } from "@/lib/email";

// Auto Invoice Reminder — Checks for overdue invoices and sends reminders
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createServiceClient();
  const today = new Date().toISOString().split("T")[0];
  let reminders = 0;

  // Find overdue invoices
  const { data: overdueInvoices } = await supabase
    .from("invoices")
    .select("*, clients(business_name, contact_name, email)")
    .eq("status", "sent")
    .lt("due_date", today);

  if (!overdueInvoices || overdueInvoices.length === 0) {
    return NextResponse.json({ success: true, reminders: 0 });
  }

  // Update status to overdue + send reminder via Resend (GHL path removed Apr 21).
  for (const inv of overdueInvoices) {
    await supabase.from("invoices").update({ status: "overdue" }).eq("id", inv.id);

    const client = inv.clients as Record<string, string> | null;
    if (!client || !client.email) continue;

    try {
      const sent = await sendEmail({
        to: client.email,
        subject: `Payment reminder — Invoice for ${client.business_name}`,
        html: `<p>Hi ${client.contact_name},</p><p>This is a friendly reminder that your invoice of $${inv.amount} was due on ${inv.due_date}. Please process the payment at your earliest convenience.</p><p>If you've already paid, please disregard this message.</p><p>Thanks,<br>The ShortStack Team</p>`,
      });
      if (sent) reminders++;
    } catch {}
  }

  // Notify admin on Telegram
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (chatId && reminders > 0) {
    const details = overdueInvoices.map(inv => {
      const client = inv.clients as Record<string, string> | null;
      return `• ${client?.business_name || "Unknown"}: $${inv.amount} (due ${inv.due_date})`;
    }).join("\n");
    await sendTelegramMessage(chatId, `💰 *Invoice Reminders Sent*\n\n${reminders} overdue invoice reminder(s):\n${details}`);
  }

  return NextResponse.json({ success: true, reminders, overdue: overdueInvoices.length });
}
