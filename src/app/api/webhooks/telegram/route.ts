import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { parseTrinityMessage, executeTrinityCommand, sendTelegramMessage, cleanupOldTelegramMessages } from "@/lib/services/trinity";

export async function POST(request: NextRequest) {
  const body = await request.json();
  const message = body.message;

  if (!message?.text || !message?.chat?.id) {
    return NextResponse.json({ ok: true });
  }

  const chatId = String(message.chat.id);
  const text = message.text.trim();
  const supabase = createServiceClient();

  // Only respond to authorized chat IDs
  const allowedChatId = process.env.TELEGRAM_CHAT_ID;
  if (allowedChatId && chatId !== allowedChatId) {
    await sendTelegramMessage(chatId, "Unauthorized. Contact ShortStack admin.");
    return NextResponse.json({ ok: true });
  }

  // === BUILT-IN COMMANDS ===

  // /briefing — Full briefing of what happened since last login
  if (text === "/briefing" || text === "/brief" || text.toLowerCase().startsWith("what happened")) {
    // Clean up old irrelevant messages before sending new briefing
    await cleanupOldTelegramMessages(chatId, supabase);
    const briefing = await generateTelegramBriefing(supabase);
    await sendTelegramMessage(chatId, briefing);
    return NextResponse.json({ ok: true });
  }

  // /outreach — Outreach stats
  if (text === "/outreach" || text === "/stats" || text.toLowerCase().includes("outreach status")) {
    const stats = await getOutreachStats(supabase);
    await sendTelegramMessage(chatId, stats);
    return NextResponse.json({ ok: true });
  }

  // /leads — Lead stats
  if (text === "/leads") {
    const stats = await getLeadStats(supabase);
    await sendTelegramMessage(chatId, stats);
    return NextResponse.json({ ok: true });
  }

  // /health — System health
  if (text === "/health" || text === "/status") {
    const health = await getSystemHealth(supabase);
    await sendTelegramMessage(chatId, health);
    return NextResponse.json({ ok: true });
  }

  // /revenue — Revenue overview
  if (text === "/revenue" || text === "/money") {
    const revenue = await getRevenueStats(supabase);
    await sendTelegramMessage(chatId, revenue);
    return NextResponse.json({ ok: true });
  }

  // /help — List commands
  if (text === "/help" || text === "/start") {
    await sendTelegramMessage(chatId, `*ShortStack Trinity AI* 🤖

*Quick Commands:*
/briefing — Full briefing since last login
/outreach — DM outreach stats & who replied
/leads — Lead scraping stats
/revenue — Revenue & deals overview
/health — System integration status
/help — This menu

*Ask me anything:*
• "Build a website for [client]"
• "Set up AI receptionist for [client]"
• "Create Discord server called [name]"
• "Run email campaign for [client]"
• "Generate leads for dentists in Miami"
• "How many calls were booked today?"

I can execute any ShortStack OS action remotely.`);
    return NextResponse.json({ ok: true });
  }

  // === AI COMMAND PARSING ===
  try {
    const command = await parseTrinityMessage(text);

    if (!command) {
      // Try to answer as a question about the business
      const answer = await answerQuestion(supabase, text);
      await sendTelegramMessage(chatId, answer);
      return NextResponse.json({ ok: true });
    }

    // Log the action
    const { data: logEntry } = await supabase.from("trinity_log").insert({
      action_type: command.action,
      description: command.description,
      command: text,
      status: "in_progress",
    }).select("id").single();

    await sendTelegramMessage(chatId, `⚡ *Processing:* ${command.description}`);

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

// === HELPER FUNCTIONS ===

async function generateTelegramBriefing(supabase: ReturnType<typeof createServiceClient>): Promise<string> {
  const now = new Date();
  const yesterday = new Date(now.getTime() - 24 * 3600000).toISOString();

  const [
    { count: newLeads },
    { count: totalLeads },
    { count: dmsSent },
    { count: dmsReplied },
    { count: callsBooked },
    { count: trinityActions },
    { count: systemDown },
    { count: newDeals },
    { data: clients },
    { data: recentReplies },
  ] = await Promise.all([
    supabase.from("leads").select("*", { count: "exact", head: true }).gte("scraped_at", yesterday),
    supabase.from("leads").select("*", { count: "exact", head: true }),
    supabase.from("outreach_log").select("*", { count: "exact", head: true }).gte("sent_at", yesterday),
    supabase.from("outreach_log").select("*", { count: "exact", head: true }).eq("status", "replied").gte("sent_at", yesterday),
    supabase.from("leads").select("*", { count: "exact", head: true }).eq("status", "booked").gte("updated_at", yesterday),
    supabase.from("trinity_log").select("*", { count: "exact", head: true }).gte("created_at", yesterday),
    supabase.from("system_health").select("*", { count: "exact", head: true }).eq("status", "down"),
    supabase.from("deals").select("*", { count: "exact", head: true }).eq("status", "won").gte("closed_at", yesterday),
    supabase.from("clients").select("mrr").eq("is_active", true),
    supabase.from("outreach_log").select("business_name, platform").eq("status", "replied").gte("sent_at", yesterday).limit(5),
  ]);

  const totalMRR = clients?.reduce((sum, c) => sum + (c.mrr || 0), 0) || 0;

  let briefing = `📋 *ShortStack Briefing*
_${now.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}_

📊 *Lead Engine*
• ${newLeads || 0} new leads scraped (${totalLeads || 0} total)
• ${dmsSent || 0} DMs sent across all platforms
• ${dmsReplied || 0} replies received
• ${callsBooked || 0} calls booked`;

  if (recentReplies && recentReplies.length > 0) {
    briefing += `\n\n💬 *Who Replied:*`;
    for (const r of recentReplies) {
      briefing += `\n• ${r.business_name} (${r.platform})`;
    }
  }

  briefing += `

💰 *Revenue*
• ${newDeals || 0} new deals closed
• $${totalMRR.toLocaleString()} MRR

🤖 *Trinity*
• ${trinityActions || 0} actions executed

${(systemDown || 0) > 0 ? `⚠️ *${systemDown} integrations down*` : "✅ All systems operational"}`;

  return briefing;
}

async function getOutreachStats(supabase: ReturnType<typeof createServiceClient>): Promise<string> {
  const today = new Date().toISOString().split("T")[0];
  const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString();

  const platforms = ["instagram", "linkedin", "facebook", "tiktok"] as const;
  let stats = `📨 *Outreach Report*\n`;

  for (const platform of platforms) {
    const { count: sent } = await supabase.from("outreach_log").select("*", { count: "exact", head: true }).eq("platform", platform).gte("sent_at", today);
    const { count: replied } = await supabase.from("outreach_log").select("*", { count: "exact", head: true }).eq("platform", platform).eq("status", "replied").gte("sent_at", weekAgo);
    stats += `\n*${platform.charAt(0).toUpperCase() + platform.slice(1)}:* ${sent || 0}/20 today | ${replied || 0} replies this week`;
  }

  const { count: totalToday } = await supabase.from("outreach_log").select("*", { count: "exact", head: true }).gte("sent_at", today);
  const { count: pendingFollowups } = await supabase.from("follow_up_queue").select("*", { count: "exact", head: true }).eq("status", "pending");
  const { count: callsBooked } = await supabase.from("leads").select("*", { count: "exact", head: true }).eq("status", "booked");

  const { data: recentReplies } = await supabase.from("outreach_log").select("business_name, platform, replied_at").eq("status", "replied").order("replied_at", { ascending: false }).limit(10);

  stats += `\n\n📊 *Totals:*
• ${totalToday || 0}/80 DMs sent today
• ${pendingFollowups || 0} pending follow-ups
• ${callsBooked || 0} calls booked`;

  if (recentReplies && recentReplies.length > 0) {
    stats += `\n\n💬 *Recent Replies:*`;
    for (const r of recentReplies) {
      stats += `\n• ${r.business_name} via ${r.platform}`;
    }
  }

  return stats;
}

async function getLeadStats(supabase: ReturnType<typeof createServiceClient>): Promise<string> {
  const today = new Date().toISOString().split("T")[0];

  const [
    { count: todayLeads },
    { count: totalLeads },
    { count: synced },
    { count: booked },
  ] = await Promise.all([
    supabase.from("leads").select("*", { count: "exact", head: true }).gte("scraped_at", today),
    supabase.from("leads").select("*", { count: "exact", head: true }),
    supabase.from("leads").select("*", { count: "exact", head: true }).eq("ghl_sync_status", "synced"),
    supabase.from("leads").select("*", { count: "exact", head: true }).eq("status", "booked"),
  ]);

  return `🎯 *Lead Engine Stats*

• ${todayLeads || 0} leads scraped today
• ${totalLeads || 0} total leads in database
• ${synced || 0} synced to GoHighLevel
• ${booked || 0} calls booked`;
}

async function getSystemHealth(supabase: ReturnType<typeof createServiceClient>): Promise<string> {
  const { data: health } = await supabase.from("system_health").select("integration_name, status").order("integration_name");

  if (!health || health.length === 0) return "No integrations configured yet.";

  let msg = `🔧 *System Health*\n`;
  for (const h of health) {
    const icon = h.status === "healthy" ? "✅" : h.status === "degraded" ? "⚠️" : h.status === "down" ? "❌" : "❓";
    msg += `\n${icon} ${h.integration_name}`;
  }
  return msg;
}

async function getRevenueStats(supabase: ReturnType<typeof createServiceClient>): Promise<string> {
  const [
    { data: clients },
    { count: dealsWon },
    { data: deals },
  ] = await Promise.all([
    supabase.from("clients").select("mrr").eq("is_active", true),
    supabase.from("deals").select("*", { count: "exact", head: true }).eq("status", "won"),
    supabase.from("deals").select("amount, client_name").eq("status", "won").order("closed_at", { ascending: false }).limit(5),
  ]);

  const totalMRR = clients?.reduce((sum, c) => sum + (c.mrr || 0), 0) || 0;
  const totalRevenue = deals?.reduce((sum, d) => sum + (d.amount || 0), 0) || 0;

  let msg = `💰 *Revenue Overview*

• *MRR:* $${totalMRR.toLocaleString()}
• *Total Deals Won:* ${dealsWon || 0}
• *Total Revenue:* $${totalRevenue.toLocaleString()}`;

  if (deals && deals.length > 0) {
    msg += `\n\n📋 *Recent Deals:*`;
    for (const d of deals) {
      msg += `\n• ${d.client_name} — $${d.amount.toLocaleString()}`;
    }
  }

  return msg;
}

async function answerQuestion(supabase: ReturnType<typeof createServiceClient>, question: string): Promise<string> {
  // Gather context data for Claude to answer
  const today = new Date().toISOString().split("T")[0];
  const [
    { count: leadsToday },
    { count: dmsSent },
    { count: replies },
    { count: booked },
    { data: clients },
  ] = await Promise.all([
    supabase.from("leads").select("*", { count: "exact", head: true }).gte("scraped_at", today),
    supabase.from("outreach_log").select("*", { count: "exact", head: true }).gte("sent_at", today),
    supabase.from("outreach_log").select("*", { count: "exact", head: true }).eq("status", "replied"),
    supabase.from("leads").select("*", { count: "exact", head: true }).eq("status", "booked"),
    supabase.from("clients").select("mrr").eq("is_active", true),
  ]);

  const mrr = clients?.reduce((s, c) => s + (c.mrr || 0), 0) || 0;

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return "AI not configured. Use /help to see available commands.";

  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 300,
        system: `You are Trinity, the AI assistant for ShortStack digital marketing agency. Answer questions concisely using Telegram markdown. Current stats: ${leadsToday} leads today, ${dmsSent} DMs sent today, ${replies} total replies, ${booked} calls booked, $${mrr} MRR. If you can't answer from data, suggest a /command.`,
        messages: [{ role: "user", content: question }],
      }),
    });
    const data = await res.json();
    return data.content?.[0]?.text || "I couldn't process that. Try /help for commands.";
  } catch {
    return "AI unavailable. Try /help for manual commands.";
  }
}
