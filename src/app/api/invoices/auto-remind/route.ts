import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { sendTelegramMessage } from "@/lib/services/trinity";

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
    .select("*, clients(business_name, contact_name, email, ghl_contact_id)")
    .eq("status", "sent")
    .lt("due_date", today);

  if (!overdueInvoices || overdueInvoices.length === 0) {
    return NextResponse.json({ success: true, reminders: 0 });
  }

  // Update status to overdue
  for (const inv of overdueInvoices) {
    await supabase.from("invoices").update({ status: "overdue" }).eq("id", inv.id);

    const client = inv.clients as Record<string, string> | null;
    if (!client) continue;

    // Send reminder via GHL
    const ghlKey = process.env.GHL_API_KEY;
    if (ghlKey && client.ghl_contact_id) {
      await fetch("https://services.leadconnectorhq.com/conversations/messages", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${ghlKey}`,
          "Content-Type": "application/json",
          Version: "2021-07-28",
        },
        body: JSON.stringify({
          type: "Email",
          contactId: client.ghl_contact_id,
          subject: `Payment reminder — Invoice for ${client.business_name}`,
          html: `<p>Hi ${client.contact_name},</p><p>This is a friendly reminder that your invoice of $${inv.amount} was due on ${inv.due_date}. Please process the payment at your earliest convenience.</p><p>If you've already paid, please disregard this message.</p><p>Thanks,<br>The ShortStack Team</p>`,
          emailFrom: "growth@shortstack.work",
        }),
      });
      reminders++;
    }
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
