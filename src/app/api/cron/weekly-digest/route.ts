import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

// Cron: Weekly performance digest — sent every Monday at 9 AM
// Vercel Cron: 0 9 * * 1
// Sends a summary via Telegram with key metrics

export async function GET(request: NextRequest) {
  // Verify cron secret to prevent unauthorized triggering
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const supabase = createServiceClient();

  const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString();
  const twoWeeksAgo = new Date(Date.now() - 14 * 86400000).toISOString();

  // Fetch this week's metrics
  const [
    { count: leadsThisWeek },
    { count: leadsLastWeek },
    { count: outreachThisWeek },
    { count: repliesThisWeek },
    { count: dealsWonThisWeek },
    { data: dealsData },
    { data: clients },
    { count: invoicesPaid },
    { data: paidInvoices },
    { count: agentActions },
  ] = await Promise.all([
    supabase.from("leads").select("*", { count: "exact", head: true }).gte("scraped_at", weekAgo),
    supabase.from("leads").select("*", { count: "exact", head: true }).gte("scraped_at", twoWeeksAgo).lt("scraped_at", weekAgo),
    supabase.from("outreach_log").select("*", { count: "exact", head: true }).gte("sent_at", weekAgo),
    supabase.from("outreach_log").select("*", { count: "exact", head: true }).eq("status", "replied").gte("sent_at", weekAgo),
    supabase.from("deals").select("*", { count: "exact", head: true }).eq("status", "won").gte("created_at", weekAgo),
    supabase.from("deals").select("amount").eq("status", "won").gte("created_at", weekAgo),
    supabase.from("clients").select("mrr").eq("is_active", true),
    supabase.from("invoices").select("*", { count: "exact", head: true }).eq("status", "paid").gte("paid_at", weekAgo),
    supabase.from("invoices").select("amount").eq("status", "paid").gte("paid_at", weekAgo),
    supabase.from("trinity_log").select("*", { count: "exact", head: true }).gte("created_at", weekAgo),
  ]);

  const totalMRR = clients?.reduce((s, c) => s + (c.mrr || 0), 0) || 0;
  const dealsRevenue = dealsData?.reduce((s, d) => s + (d.amount || 0), 0) || 0;
  const invoicesCollected = paidInvoices?.reduce((s, i) => s + (i.amount || 0), 0) || 0;
  const leadsTrend = (leadsLastWeek || 0) > 0
    ? (((leadsThisWeek || 0) - (leadsLastWeek || 0)) / (leadsLastWeek || 1) * 100).toFixed(0)
    : "N/A";

  const digest = [
    `📊 Weekly Digest — ${new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}`,
    ``,
    `💰 Revenue`,
    `  MRR: $${totalMRR.toLocaleString()}`,
    `  Deals closed: ${dealsWonThisWeek || 0} ($${dealsRevenue.toLocaleString()})`,
    `  Invoices paid: ${invoicesPaid || 0} ($${invoicesCollected.toLocaleString()})`,
    ``,
    `📈 Pipeline`,
    `  New leads: ${leadsThisWeek || 0} (${leadsTrend}% vs last week)`,
    `  Outreach sent: ${outreachThisWeek || 0}`,
    `  Replies: ${repliesThisWeek || 0}`,
    ``,
    `🤖 Automation`,
    `  Agent actions: ${agentActions || 0}`,
    `  Active clients: ${clients?.length || 0}`,
  ].join("\n");

  // Send via Telegram
  const chatId = process.env.TELEGRAM_CHAT_ID;
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  if (chatId && botToken) {
    await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text: digest }),
    }).catch(() => {});
  }

  // Log it
  await supabase.from("trinity_log").insert({
    action_type: "custom",
    description: "Weekly digest sent",
    status: "completed",
    result: {
      type: "weekly_digest",
      mrr: totalMRR,
      leads: leadsThisWeek || 0,
      outreach: outreachThisWeek || 0,
      deals_won: dealsWonThisWeek || 0,
    },
  });

  return NextResponse.json({ success: true, digest });
}
