import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

// Telegram Webhook — receive messages from Telegram and execute commands
// Set this up: https://api.telegram.org/bot{TOKEN}/setWebhook?url=https://shortstack-os.vercel.app/api/telegram/webhook&secret_token=YOUR_SECRET
export async function POST(request: NextRequest) {
  // Validate Telegram webhook secret token if configured
  const webhookSecret = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (webhookSecret) {
    const token = request.headers.get("x-telegram-bot-api-secret-token");
    if (token !== webhookSecret) {
      return NextResponse.json({ ok: true }); // Silent rejection — don't reveal error details
    }
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: true });
  }

  const message = body.message as Record<string, unknown> | undefined;

  if (!message?.text || !(message?.chat as Record<string, unknown>)?.id) {
    return NextResponse.json({ ok: true });
  }

  const chatId = String((message.chat as Record<string, unknown>).id);
  const text = message.text as string;
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const apiKey = process.env.ANTHROPIC_API_KEY;

  if (!botToken) return NextResponse.json({ ok: true });

  // Only respond to authorized chat IDs to prevent unauthorized command execution
  const allowedChatId = process.env.TELEGRAM_CHAT_ID;
  if (allowedChatId && chatId !== allowedChatId) {
    return NextResponse.json({ ok: true }); // Silent ignore
  }

  // Send typing indicator
  await fetch(`https://api.telegram.org/bot${botToken}/sendChatAction`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, action: "typing" }),
  });

  // Get system context for AI
  const supabase = createServiceClient();
  const [
    { count: totalLeads },
    { count: activeClients },
    { data: clients },
    { count: dmsSent },
    { count: replies },
    { data: recentActions },
  ] = await Promise.all([
    supabase.from("leads").select("*", { count: "exact", head: true }),
    supabase.from("clients").select("*", { count: "exact", head: true }).eq("is_active", true),
    supabase.from("clients").select("mrr").eq("is_active", true),
    supabase.from("outreach_log").select("*", { count: "exact", head: true }).eq("status", "sent"),
    supabase.from("outreach_log").select("*", { count: "exact", head: true }).eq("status", "replied"),
    supabase.from("trinity_log").select("description, status").order("created_at", { ascending: false }).limit(5),
  ]);

  const totalMRR = (clients || []).reduce((s, c) => s + ((c as { mrr: number }).mrr || 0), 0);

  // Process with AI
  let reply = "Got it. Working on it.";

  if (apiKey) {
    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
        body: JSON.stringify({
          model: "claude-haiku-4-5-20251001",
          max_tokens: 300,
          system: `You are Trinity, the ShortStack AI assistant on Telegram. You have FULL CONTROL of the agency OS. Keep responses SHORT (2-3 sentences). No markdown. Plain text only.

System: ${totalLeads} leads, ${activeClients} clients, $${totalMRR} MRR, ${dmsSent} outreach sent, ${replies} replies.
Recent: ${(recentActions || []).slice(0, 3).map(a => a.description).join("; ")}

YOU CONTROL 9 AI AGENTS. You can activate any of them:

SCOUT (Lead Finder) - "scrape leads" or "find leads" = scrapes Google Maps for new leads
ECHO (Outreach) - "send emails" or "outreach" or "cold call" = sends 20 emails + 20 SMS + tags 200 for calling
PIXEL (Content) - "write scripts" or "generate content" = generates marketing content
WAVE (Social Manager) - "post content" or "schedule posts" = manages social media
BLAZE (Ads) - "run ads" or "create campaign" = manages ad campaigns
TRINITY (You) - "status" or "briefing" = gives system overview
RING (Caller) - "cold call" = tags leads for GHL calling workflow
NEXUS (Supervisor) - "check agents" or "health check" = monitors all systems
ENRICHER - "enrich leads" or "find socials" = scans websites for Instagram/Facebook profiles

When user asks you to do something, say "On it!" and confirm what you're doing. Never say "I can't access" — you CAN trigger everything through the OS.

If the user's message contains action words (call, email, scrape, send, outreach, leads, check), respond with TRIGGER:[action] at the end of your message. Example: "On it! Triggering cold outreach now. TRIGGER:outreach"`,
          messages: [{ role: "user", content: text }],
        }),
      });
      const data = await res.json();
      reply = data.content?.[0]?.text || reply;
    } catch {}
  }

  // Detect TRIGGER commands from AI response or user text
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://shortstack-os.vercel.app";
  const cronSecret = process.env.CRON_SECRET;
  const combined = (text + " " + reply).toLowerCase();

  if (combined.includes("trigger:outreach") || combined.includes("cold call") || combined.includes("send email") || combined.includes("send outreach")) {
    fetch(`${baseUrl}/api/cron/outreach`, { headers: { authorization: `Bearer ${cronSecret}` } }).catch(() => {});
    if (!reply.includes("On it")) reply += "\n\nTriggered: 20 emails + 20 SMS + 200 call tags queued in GHL.";
  }

  if (combined.includes("trigger:scrape") || combined.includes("scrape lead") || combined.includes("find lead") || combined.includes("find more lead")) {
    fetch(`${baseUrl}/api/cron/scrape-leads`, { headers: { authorization: `Bearer ${cronSecret}` } }).catch(() => {});
    if (!reply.includes("On it")) reply += "\n\nTriggered: Lead scraping started.";
  }

  if (combined.includes("trigger:health") || combined.includes("health check") || combined.includes("check system")) {
    fetch(`${baseUrl}/api/cron/health-check`, { headers: { authorization: `Bearer ${cronSecret}` } }).catch(() => {});
    if (!reply.includes("On it")) reply += "\n\nTriggered: Running health check.";
  }

  if (combined.includes("trigger:enrich") || combined.includes("enrich lead") || combined.includes("find social")) {
    fetch(`${baseUrl}/api/leads/enrich`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ batch_size: 20 }) }).catch(() => {});
    if (!reply.includes("On it")) reply += "\n\nTriggered: Enriching 20 leads with social profiles.";
  }

  if (combined.includes("trigger:content") || combined.includes("write script") || combined.includes("generate content") || combined.includes("create script")) {
    reply += "\n\nPixel (Content Agent) activated. Open the Script Lab in the OS to generate scripts, or tell me what content you need and I'll write it.";
  }

  if (combined.includes("trigger:social") || combined.includes("post content") || combined.includes("schedule post")) {
    reply += "\n\nWave (Social Manager) activated. Open Social Manager in the OS to generate and schedule a week of content.";
  }

  if (combined.includes("trigger:ads") || combined.includes("run ads") || combined.includes("create campaign") || combined.includes("launch ads")) {
    reply += "\n\nBlaze (Ads Agent) activated. Open Ads Manager in the OS to create and optimize campaigns.";
  }

  if (combined.includes("create a workflow") || combined.includes("create workflow") || combined.includes("setup a workflow") || combined.includes("make a workflow") || combined.includes("build a workflow")) {
    // Extract the workflow description from the user's message
    fetch(`${baseUrl}/api/n8n/create-workflow`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ description: text }),
    }).then(async (res) => {
      const data = await res.json();
      if (data.deployed) {
        const token = process.env.TELEGRAM_BOT_TOKEN;
        if (token) {
          fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ chat_id: chatId, text: `Workflow deployed to n8n! ID: ${data.n8n_id}. Open n8n to see it: https://n8n-production-97d7.up.railway.app` }),
          });
        }
      }
    }).catch(() => {});
    reply += "\n\nCreating and deploying workflow to n8n now. I'll send you a confirmation when it's live.";
  }

  if (combined.includes("briefing") || combined.includes("brief me") || combined.includes("what happened")) {
    fetch(`${baseUrl}/api/cron/daily-brief`, { headers: { authorization: `Bearer ${cronSecret}` } }).catch(() => {});
    reply += "\n\nTriggered: Generating your daily briefing. Check Telegram in a moment.";
  }

  // Clean TRIGGER tags from reply before sending
  reply = reply.replace(/TRIGGER:\w+/g, "").trim();

  // Handle specific commands
  if (text.toLowerCase().startsWith("/status")) {
    reply = `ShortStack Status:\n\nLeads: ${totalLeads}\nClients: ${activeClients}\nMRR: $${totalMRR}\nOutreach: ${dmsSent} sent, ${replies} replies\n\nRecent: ${(recentActions || []).slice(0, 3).map(a => a.description).join("\n")}`;
  }

  if (text.toLowerCase().startsWith("/outreach")) {
    fetch(`${baseUrl}/api/cron/outreach`, { headers: { authorization: `Bearer ${cronSecret}` } }).catch(() => {});
    reply = "Outreach triggered! 20 emails + 20 SMS + 200 call tags. Results coming soon.";
  }

  if (text.toLowerCase().startsWith("/scrape")) {
    fetch(`${baseUrl}/api/cron/scrape-leads`, { headers: { authorization: `Bearer ${cronSecret}` } }).catch(() => {});
    reply = "Lead scraping started! Will notify when done.";
  }

  if (text.toLowerCase().startsWith("/health")) {
    fetch(`${baseUrl}/api/cron/health-check`, { headers: { authorization: `Bearer ${cronSecret}` } }).catch(() => {});
    reply = "Running health check. Results coming soon.";
  }

  if (text.toLowerCase().startsWith("/clients")) {
    const { data: clientList } = await supabase
      .from("clients")
      .select("business_name, mrr, health_score, package_tier")
      .eq("is_active", true)
      .order("mrr", { ascending: false })
      .limit(10);
    reply = "Active Clients:\n\n" + (clientList || []).map((c, i) =>
      `${i+1}. ${c.business_name} — $${c.mrr}/mo (${c.package_tier || "Standard"}) ${c.health_score < 50 ? "⚠️" : "✅"}`
    ).join("\n") + `\n\nTotal MRR: $${totalMRR}`;
  }

  if (text.toLowerCase().startsWith("/revenue")) {
    const { data: deals } = await supabase.from("deals").select("amount").eq("status", "won");
    const totalRevenue = (deals || []).reduce((sum, d) => sum + (d.amount || 0), 0);
    const { count: overdueInvoices } = await supabase.from("invoices").select("*", { count: "exact", head: true }).eq("status", "sent").lt("due_date", new Date().toISOString().split("T")[0]);
    reply = `Revenue Report:\n\nMRR: $${totalMRR}\nTotal Revenue: $${totalRevenue}\nActive Clients: ${activeClients}\nOverdue Invoices: ${overdueInvoices || 0}`;
  }

  if (text.toLowerCase().startsWith("/pipeline")) {
    const { count: newLeads } = await supabase.from("leads").select("*", { count: "exact", head: true }).eq("status", "new");
    const { count: contacted } = await supabase.from("leads").select("*", { count: "exact", head: true }).eq("status", "contacted");
    const { count: booked } = await supabase.from("leads").select("*", { count: "exact", head: true }).eq("status", "booked");
    const { count: converted } = await supabase.from("leads").select("*", { count: "exact", head: true }).eq("status", "converted");
    reply = `Pipeline:\n\nNew: ${newLeads}\nContacted: ${contacted}\nReplied: ${replies}\nBooked: ${booked}\nConverted: ${converted}\nTotal: ${totalLeads}`;
  }

  if (text.toLowerCase().startsWith("/content")) {
    fetch(`${baseUrl}/api/cron/content-autopilot`, { headers: { authorization: `Bearer ${cronSecret}` } }).catch(() => {});
    reply = "Content generation started for all clients! Will notify when done.";
  }

  if (text.toLowerCase().startsWith("/agents")) {
    const { data: agentLogs } = await supabase.from("trinity_log").select("agent, status").gte("created_at", new Date().toISOString().split("T")[0]);
    const agentCounts: Record<string, number> = {};
    (agentLogs || []).forEach(l => { agentCounts[l.agent || "unknown"] = (agentCounts[l.agent || "unknown"] || 0) + 1; });
    reply = "Agent Activity Today:\n\n" + Object.entries(agentCounts).map(([agent, count]) => `${agent}: ${count} actions`).join("\n") || "No agent activity today";
  }

  if (text.toLowerCase().startsWith("/autopilot")) {
    // Trigger ALL systems
    fetch(`${baseUrl}/api/cron/daily-brief`, { headers: { authorization: `Bearer ${cronSecret}` } }).catch(() => {});
    fetch(`${baseUrl}/api/cron/scrape-leads`, { headers: { authorization: `Bearer ${cronSecret}` } }).catch(() => {});
    fetch(`${baseUrl}/api/cron/outreach`, { headers: { authorization: `Bearer ${cronSecret}` } }).catch(() => {});
    fetch(`${baseUrl}/api/cron/content-autopilot`, { headers: { authorization: `Bearer ${cronSecret}` } }).catch(() => {});
    fetch(`${baseUrl}/api/cron/health-check`, { headers: { authorization: `Bearer ${cronSecret}` } }).catch(() => {});
    fetch(`${baseUrl}/api/cron/retention-check`, { headers: { authorization: `Bearer ${cronSecret}` } }).catch(() => {});
    fetch(`${baseUrl}/api/cron/invoice-chase`, { headers: { authorization: `Bearer ${cronSecret}` } }).catch(() => {});
    reply = "FULL AUTOPILOT ACTIVATED\n\nAll 7 agents triggered:\n- Lead scraping\n- Cold outreach (emails + SMS + calls)\n- Content generation\n- Health monitoring\n- Retention check\n- Invoice chasing\n- Daily briefing\n\nResults coming in over the next few minutes.";
  }

  if (text.toLowerCase().startsWith("/help")) {
    reply = `ShortStack Bot Commands:\n
/status — System overview
/clients — Active clients + MRR
/revenue — Revenue report
/pipeline — Lead pipeline stats
/outreach — Trigger cold outreach
/scrape — Start lead scraping
/content — Generate weekly content
/health — Run health check
/agents — Agent activity today
/autopilot — FULL AUTOPILOT (all 7 agents)
/help — This message

Or just type naturally — "send emails", "how are my leads", "what should I focus on today"`;
  }

  // Send reply
  await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text: reply }),
  });

  return NextResponse.json({ ok: true });
}
