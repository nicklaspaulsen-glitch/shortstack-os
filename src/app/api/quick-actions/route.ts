import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

// Quick Actions API — one-click triggers for common tasks
export async function POST(request: NextRequest) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { action } = await request.json();
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://shortstack-os.vercel.app";
  const cronSecret = process.env.CRON_SECRET || "";
  const results: string[] = [];

  switch (action) {
    case "morning_routine":
      // Run daily brief + health check + scrape leads
      fetch(`${baseUrl}/api/cron/daily-brief`, { headers: { authorization: `Bearer ${cronSecret}` } }).catch(() => {});
      fetch(`${baseUrl}/api/cron/health-check`, { headers: { authorization: `Bearer ${cronSecret}` } }).catch(() => {});
      fetch(`${baseUrl}/api/cron/scrape-leads`, { headers: { authorization: `Bearer ${cronSecret}` } }).catch(() => {});
      results.push("Daily brief generating", "Health check running", "Lead scraping started");
      break;

    case "full_outreach":
      // Send emails + SMS + tag calls
      fetch(`${baseUrl}/api/cron/outreach`, { headers: { authorization: `Bearer ${cronSecret}` } }).catch(() => {});
      results.push("Cold emails sending", "SMS sending", "Call tags being created");
      break;

    case "content_week":
      // Generate weekly content for all clients
      fetch(`${baseUrl}/api/cron/content-autopilot`, { headers: { authorization: `Bearer ${cronSecret}` } }).catch(() => {});
      results.push("Weekly content generating for all clients");
      break;

    case "chase_payments":
      // Chase overdue invoices
      fetch(`${baseUrl}/api/cron/invoice-chase`, { headers: { authorization: `Bearer ${cronSecret}` } }).catch(() => {});
      results.push("Chasing overdue invoices");
      break;

    case "check_retention":
      // Run retention check
      fetch(`${baseUrl}/api/cron/retention-check`, { headers: { authorization: `Bearer ${cronSecret}` } }).catch(() => {});
      results.push("Retention check running — checking churn risk");
      break;

    case "full_autopilot":
      // Run everything
      fetch(`${baseUrl}/api/cron/daily-brief`, { headers: { authorization: `Bearer ${cronSecret}` } }).catch(() => {});
      fetch(`${baseUrl}/api/cron/scrape-leads`, { headers: { authorization: `Bearer ${cronSecret}` } }).catch(() => {});
      fetch(`${baseUrl}/api/cron/outreach`, { headers: { authorization: `Bearer ${cronSecret}` } }).catch(() => {});
      fetch(`${baseUrl}/api/cron/content-autopilot`, { headers: { authorization: `Bearer ${cronSecret}` } }).catch(() => {});
      fetch(`${baseUrl}/api/cron/health-check`, { headers: { authorization: `Bearer ${cronSecret}` } }).catch(() => {});
      fetch(`${baseUrl}/api/cron/retention-check`, { headers: { authorization: `Bearer ${cronSecret}` } }).catch(() => {});
      fetch(`${baseUrl}/api/cron/invoice-chase`, { headers: { authorization: `Bearer ${cronSecret}` } }).catch(() => {});
      results.push("FULL AUTOPILOT ACTIVATED", "All 7 agents triggered", "Leads, outreach, content, health, retention, invoices — all running");
      break;

    default:
      return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
  }

  // Log to trinity
  await supabase.from("trinity_log").insert({
    agent: "trinity",
    action_type: "custom",
    description: `Quick action: ${action} — ${results.join(", ")}`,
    status: "completed",
    result: { action, results },
  });

  return NextResponse.json({ success: true, action, results });
}
