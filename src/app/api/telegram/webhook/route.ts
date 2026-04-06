import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

// Telegram Webhook — receive messages from Telegram and execute commands
// Set this up: https://api.telegram.org/bot{TOKEN}/setWebhook?url=https://shortstack-os.vercel.app/api/telegram/webhook
export async function POST(request: NextRequest) {
  const body = await request.json();
  const message = body.message;

  if (!message?.text || !message?.chat?.id) {
    return NextResponse.json({ ok: true });
  }

  const chatId = String(message.chat.id);
  const text = message.text;
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const apiKey = process.env.ANTHROPIC_API_KEY;

  if (!botToken) return NextResponse.json({ ok: true });

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

YOU CAN DO THESE ACTIONS (tell the user you're doing it, don't say you can't):
- "cold call" or "call leads" = you trigger the outreach system which tags leads for calling in GHL
- "send emails" or "outreach" = you trigger 20 cold emails + 20 SMS via GHL
- "scrape leads" or "find leads" = you start the lead scraper
- "health check" or "status" = you check all systems
- "enrich leads" = you scan websites for social profiles

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

  // Send reply
  await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text: reply }),
  });

  return NextResponse.json({ ok: true });
}
