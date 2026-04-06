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
          system: `You are Trinity, the ShortStack AI assistant responding via Telegram. Keep responses SHORT (2-3 sentences). No markdown. Plain text only.

System data: ${totalLeads} leads, ${activeClients} clients, $${totalMRR} MRR, ${dmsSent} DMs sent, ${replies} replies.
Recent: ${(recentActions || []).slice(0, 3).map(a => a.description).join("; ")}

If user asks to do something (send emails, scrape leads, check status), acknowledge and explain what you can do.`,
          messages: [{ role: "user", content: text }],
        }),
      });
      const data = await res.json();
      reply = data.content?.[0]?.text || reply;
    } catch {}
  }

  // Handle specific commands
  if (text.toLowerCase().startsWith("/status")) {
    reply = `ShortStack Status:\n\nLeads: ${totalLeads}\nClients: ${activeClients}\nMRR: $${totalMRR}\nOutreach: ${dmsSent} sent, ${replies} replies\n\nRecent: ${(recentActions || []).slice(0, 3).map(a => a.description).join("\n")}`;
  }

  if (text.toLowerCase().startsWith("/outreach")) {
    // Trigger outreach
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://shortstack-os.vercel.app";
    const cronSecret = process.env.CRON_SECRET;
    fetch(`${baseUrl}/api/cron/outreach`, { headers: { authorization: `Bearer ${cronSecret}` } }).catch(() => {});
    reply = "Outreach triggered! Sending 20 emails + 20 SMS. I'll report back when done.";
  }

  if (text.toLowerCase().startsWith("/scrape")) {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://shortstack-os.vercel.app";
    const cronSecret = process.env.CRON_SECRET;
    fetch(`${baseUrl}/api/cron/scrape-leads`, { headers: { authorization: `Bearer ${cronSecret}` } }).catch(() => {});
    reply = "Lead scraping started! Will notify you when done.";
  }

  if (text.toLowerCase().startsWith("/health")) {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://shortstack-os.vercel.app";
    const cronSecret = process.env.CRON_SECRET;
    fetch(`${baseUrl}/api/cron/health-check`, { headers: { authorization: `Bearer ${cronSecret}` } }).catch(() => {});
    reply = "Running health check on all integrations. Results coming soon.";
  }

  // Send reply
  await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text: reply }),
  });

  return NextResponse.json({ ok: true });
}
