import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

export const maxDuration = 30;

// Runs daily at 10 AM — checks for at-risk clients and triggers retention actions
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createServiceClient();
  const alerts: string[] = [];

  // 1. Check for clients with low health scores
  const { data: lowHealth } = await supabase
    .from("clients")
    .select("id, business_name, health_score, contact_name, email")
    .eq("is_active", true)
    .lt("health_score", 50);

  for (const client of (lowHealth || [])) {
    await supabase.from("trinity_log").insert({
      agent: "retention",
      action_type: "retention",
      description: `Churn risk: ${client.business_name} health score ${client.health_score}%`,
      client_id: client.id,
      status: "pending",
      result: { type: "churn_risk", health_score: client.health_score },
    });
    alerts.push(`${client.business_name} (${client.health_score}%)`);
  }

  // 2. Check for overdue invoices
  const { data: overdue } = await supabase
    .from("invoices")
    .select("id, client_id, amount, due_date, description")
    .eq("status", "sent")
    .lt("due_date", new Date().toISOString().split("T")[0]);

  for (const inv of (overdue || [])) {
    await supabase.from("trinity_log").insert({
      agent: "invoice",
      action_type: "invoice",
      description: `Overdue invoice: $${inv.amount} (due ${inv.due_date})`,
      client_id: inv.client_id,
      status: "pending",
      result: { type: "overdue", amount: inv.amount, due_date: inv.due_date },
    });
  }

  // 3. Check for clients with no activity in 7 days
  const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString();
  const { data: activeClients } = await supabase
    .from("clients")
    .select("id, business_name")
    .eq("is_active", true);

  let inactive = 0;
  for (const client of (activeClients || [])) {
    const { count } = await supabase
      .from("trinity_log")
      .select("*", { count: "exact", head: true })
      .eq("client_id", client.id)
      .gte("created_at", weekAgo);

    if (!count || count === 0) {
      inactive++;
      await supabase.from("trinity_log").insert({
        agent: "retention",
        action_type: "retention",
        description: `No activity for 7+ days: ${client.business_name}`,
        client_id: client.id,
        status: "pending",
        result: { type: "inactive", days: 7 },
      });
    }
  }

  // Notify
  const chatId = process.env.TELEGRAM_CHAT_ID;
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  if (chatId && botToken && (alerts.length > 0 || (overdue || []).length > 0 || inactive > 0)) {
    const { anyRoutineActive } = await import("@/lib/telegram/should-send-routine");
    const retentionOn = await anyRoutineActive(supabase, "retention_check");
    if (retentionOn) {
      const msg = [
        "🚨 Retention Check",
        "",
        alerts.length > 0 ? `Low health: ${alerts.join(", ")}` : null,
        (overdue || []).length > 0 ? `Overdue invoices: ${(overdue || []).length}` : null,
        inactive > 0 ? `Inactive clients (7d+): ${inactive}` : null,
      ].filter(Boolean).join("\n");

      await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: chatId, text: msg }),
      });
    }
  }

  return NextResponse.json({
    success: true,
    churnRisks: (lowHealth || []).length,
    overdueInvoices: (overdue || []).length,
    inactiveClients: inactive,
  });
}
