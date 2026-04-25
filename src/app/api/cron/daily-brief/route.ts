import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { sendTelegramMessage } from "@/lib/services/trinity";
import { monitorClientFolders } from "@/lib/services/google-drive-monitor";
import { anyRoutineActive } from "@/lib/telegram/should-send-routine";

// Runs daily at 9am CET via Vercel Cron
export const maxDuration = 60;

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createServiceClient();
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!chatId) return NextResponse.json({ error: "No Telegram chat ID" }, { status: 500 });

  const yesterday = new Date(Date.now() - 24 * 3600000).toISOString();

  // Gather outreach stats
  const platforms = ["instagram", "linkedin", "facebook", "tiktok"] as const;
  const platformStats: Record<string, { sent: number; replied: number }> = {};

  for (const p of platforms) {
    const { count: sent } = await supabase.from("outreach_log").select("*", { count: "exact", head: true }).eq("platform", p).gte("sent_at", yesterday);
    const { count: replied } = await supabase.from("outreach_log").select("*", { count: "exact", head: true }).eq("platform", p).eq("status", "replied").gte("sent_at", yesterday);
    platformStats[p] = { sent: sent || 0, replied: replied || 0 };
  }

  const totalSent = Object.values(platformStats).reduce((s, p) => s + p.sent, 0);
  const totalReplied = Object.values(platformStats).reduce((s, p) => s + p.replied, 0);

  // Lead stats
  const { count: leadsScraped } = await supabase.from("leads").select("*", { count: "exact", head: true }).gte("scraped_at", yesterday);
  const { count: callsBooked } = await supabase.from("leads").select("*", { count: "exact", head: true }).eq("status", "booked").gte("updated_at", yesterday);
  const { count: ghlSynced } = await supabase.from("leads").select("*", { count: "exact", head: true }).eq("ghl_sync_status", "synced").gte("ghl_synced_at", yesterday);

  // Recent replies with names
  const { data: recentReplies } = await supabase.from("outreach_log").select("business_name, platform").eq("status", "replied").gte("sent_at", yesterday).limit(10);

  // Cold call stats from GHL
  const { count: newDeals } = await supabase.from("deals").select("*", { count: "exact", head: true }).eq("status", "won").gte("closed_at", yesterday);

  // Client deliverables
  const { count: pendingTasks } = await supabase.from("client_tasks").select("*", { count: "exact", head: true }).eq("is_completed", false);
  const { count: contentPublished } = await supabase.from("content_calendar").select("*", { count: "exact", head: true }).eq("status", "published").gte("published_at", yesterday);

  // Build the brief
  let brief = `📊 *Daily Brief — ${new Date().toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" })}*

🎯 *Lead Engine*
• ${leadsScraped || 0} leads scraped
• ${ghlSynced || 0} imported to GHL
• ${callsBooked || 0} calls booked

📨 *Outreach (${totalSent}/80 target)*`;

  for (const [platform, stats] of Object.entries(platformStats)) {
    brief += `\n• ${platform.charAt(0).toUpperCase() + platform.slice(1)}: ${stats.sent}/20 sent, ${stats.replied} replies`;
  }

  if (recentReplies && recentReplies.length > 0) {
    brief += `\n\n💬 *Who Replied:*`;
    for (const r of recentReplies) {
      brief += `\n• ${r.business_name} (${r.platform})`;
    }
  }

  // GHL-backed AI cold calling removed Apr 21 — calls now initiated per-lead
  // via /api/call (ElevenAgents). Daily brief reports booked/closed counts only.
  brief += `

📞 *AI Cold Calling (ElevenAgents)*
• ${callsBooked || 0} appointments booked
• ${newDeals || 0} deals closed`;

  brief += `

📋 *Client Work*
• ${pendingTasks || 0} tasks pending
• ${contentPublished || 0} content pieces published

${totalReplied > 5 ? "🔥 Great day for replies!" : totalSent >= 60 ? "✅ Outreach on track" : "⚠️ Outreach below target"}`;

  const briefRoutineOn = await anyRoutineActive(supabase, "daily_brief");
  if (briefRoutineOn) {
    await sendTelegramMessage(chatId, brief);
  }

  // Monitor Google Drive for new client footage
  const driveResults = await monitorClientFolders(supabase);
  if (driveResults.filesFound > 0 && briefRoutineOn) {
    await sendTelegramMessage(chatId, `📂 *Drive Monitor:* ${driveResults.filesFound} new files detected across client folders. ${driveResults.alertsSent} editor alerts sent.`);
  }

  // Also trigger DM outreach and health check in the background
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://app.shortstack.work";
  const cronSecret = process.env.CRON_SECRET;
  fetch(`${baseUrl}/api/cron/outreach`, { headers: { authorization: `Bearer ${cronSecret}` } }).catch(() => {});
  fetch(`${baseUrl}/api/cron/health-check`, { headers: { authorization: `Bearer ${cronSecret}` } }).catch(() => {});
  // Enrich leads with social profiles (runs in background)
  fetch(`${baseUrl}/api/leads/enrich`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ batch_size: 20 }) }).catch(() => {});

  return NextResponse.json({ success: true, totalSent, totalReplied });
}
