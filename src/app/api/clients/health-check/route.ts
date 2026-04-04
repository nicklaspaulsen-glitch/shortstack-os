import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { sendTelegramMessage } from "@/lib/services/trinity";

// Client Health Alert System — Checks all clients and flags issues
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createServiceClient();
  const alerts: string[] = [];

  const { data: clients } = await supabase
    .from("clients")
    .select("id, business_name, mrr, health_score, contract_status, package_tier")
    .eq("is_active", true);

  if (!clients) return NextResponse.json({ alerts: [] });

  for (const client of clients) {
    const issues: string[] = [];

    // Check for overdue invoices
    const { count: overdueInvoices } = await supabase
      .from("invoices")
      .select("*", { count: "exact", head: true })
      .eq("client_id", client.id)
      .eq("status", "overdue");

    if ((overdueInvoices || 0) > 0) {
      issues.push(`${overdueInvoices} overdue invoice(s)`);
    }

    // Check for incomplete tasks past due
    const { count: overdueTasks } = await supabase
      .from("client_tasks")
      .select("*", { count: "exact", head: true })
      .eq("client_id", client.id)
      .eq("is_completed", false)
      .lt("due_date", new Date().toISOString().split("T")[0]);

    if ((overdueTasks || 0) > 0) {
      issues.push(`${overdueTasks} overdue task(s)`);
    }

    // Check content pipeline
    const { count: pendingContent } = await supabase
      .from("content_scripts")
      .select("*", { count: "exact", head: true })
      .eq("client_id", client.id)
      .in("status", ["idea", "scripted"])
      .lt("created_at", new Date(Date.now() - 7 * 86400000).toISOString());

    if ((pendingContent || 0) > 0) {
      issues.push(`${pendingContent} content piece(s) stalled for 7+ days`);
    }

    // Check contract status
    if (client.contract_status === "expired") {
      issues.push("Contract expired");
    }

    // Update health score based on issues
    let newScore = 100;
    if (issues.length === 1) newScore = 75;
    if (issues.length === 2) newScore = 50;
    if (issues.length >= 3) newScore = 25;

    if (newScore !== client.health_score) {
      await supabase.from("clients").update({ health_score: newScore }).eq("id", client.id);
    }

    // Alert if issues found
    if (issues.length > 0) {
      alerts.push(`⚠️ *${client.business_name}* (${client.package_tier || "Client"}):\n${issues.map(i => `  • ${i}`).join("\n")}`);
    }
  }

  // Send Telegram alert if issues found
  if (alerts.length > 0) {
    const chatId = process.env.TELEGRAM_CHAT_ID;
    if (chatId) {
      await sendTelegramMessage(chatId, `🔔 *Client Health Alert*\n\n${alerts.join("\n\n")}`);
    }
  }

  return NextResponse.json({ success: true, alerts: alerts.length, clients_checked: clients.length });
}
