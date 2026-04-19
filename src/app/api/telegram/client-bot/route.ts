import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { createServiceClient } from "@/lib/supabase/server";

/**
 * Per-client Telegram Bot Webhook
 * Each client registers their own bot via @BotFather.
 * Webhook URL: /api/telegram/client-bot?client_id=<id>
 *
 * Security: Telegram forwards the secret_token registered via setWebhook in
 * the `X-Telegram-Bot-Api-Secret-Token` header. We look up the client's
 * stored secret (scoped by the query param client_id) and constant-time
 * compare it against the header. Without this check, an attacker could POST
 * to this URL and make any client's bot leak data to any chat the attacker
 * controls.
 *
 * The bot gives clients a personal interface to:
 * - Check project status, tasks, invoices
 * - Ask questions (answered by AI with their project context)
 * - Get notifications about deliverables and updates
 */
export async function POST(request: NextRequest) {
  const clientId = request.nextUrl.searchParams.get("client_id");
  if (!clientId) return NextResponse.json({ ok: true });

  const supabase = createServiceClient();

  // Look up client and their bot token — scoped strictly by the query param
  // client_id so an attacker cannot cross-reference another client's secret.
  const { data: client } = await supabase
    .from("clients")
    .select("*, telegram_bot_token, telegram_bot_username, telegram_chat_id, telegram_webhook_secret")
    .eq("id", clientId)
    .single();

  if (!client?.telegram_bot_token) {
    // No bot configured for this client — silently ack so attackers can't
    // enumerate which client_ids exist.
    return NextResponse.json({ ok: true });
  }

  // Verify Telegram's webhook signature. The column `telegram_webhook_secret`
  // is optional for now (migration pending). If it's missing, refuse to
  // process the request rather than trusting the raw POST. Bots registered
  // before the secret column existed must be re-registered via
  // /api/telegram/setup-bot to populate it.
  const clientRecord = client as Record<string, unknown>;
  const storedSecret =
    typeof clientRecord.telegram_webhook_secret === "string"
      ? (clientRecord.telegram_webhook_secret as string)
      : null;

  if (!storedSecret) {
    return NextResponse.json(
      { ok: false, error: "bot not fully configured" },
      { status: 503 }
    );
  }

  const providedSecret = request.headers.get("x-telegram-bot-api-secret-token") || "";
  const storedBuf = Buffer.from(storedSecret, "utf8");
  const providedBuf = Buffer.from(providedSecret, "utf8");
  // timingSafeEqual requires equal-length buffers; length mismatch is itself
  // a rejection, but we still perform a constant-time compare over a
  // same-length zero buffer to avoid leaking length info via timing.
  const lengthsMatch = storedBuf.length === providedBuf.length;
  const comparisonBuf = lengthsMatch ? providedBuf : Buffer.alloc(storedBuf.length);
  const secretsMatch = crypto.timingSafeEqual(storedBuf, comparisonBuf) && lengthsMatch;
  if (!secretsMatch) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const message = body.message;
  if (!message?.text || !message?.chat?.id) {
    return NextResponse.json({ ok: true });
  }

  const chatId = String(message.chat.id);
  const text = message.text;

  const botToken = client.telegram_bot_token;

  // Save chat_id if not yet stored (first message links the bot to the user)
  if (!client.telegram_chat_id) {
    await supabase
      .from("clients")
      .update({ telegram_chat_id: chatId })
      .eq("id", clientId);
  }

  // Send typing indicator
  await fetch(`https://api.telegram.org/bot${botToken}/sendChatAction`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, action: "typing" }),
  });

  // Gather client context
  const [
    { data: tasks },
    { data: invoices },
    { data: content },
    { data: aiActions },
  ] = await Promise.all([
    supabase.from("client_tasks").select("title, status").eq("client_id", clientId).order("created_at", { ascending: false }).limit(10),
    supabase.from("invoices").select("amount, status, due_date").eq("client_id", clientId).order("created_at", { ascending: false }).limit(5),
    supabase.from("content_calendar").select("title, platform, status, scheduled_at").eq("client_id", clientId).order("scheduled_at", { ascending: false }).limit(5),
    supabase.from("trinity_log").select("description, status, created_at").eq("client_id", clientId).order("created_at", { ascending: false }).limit(5),
  ]);

  const tasksDone = (tasks || []).filter(t => t.status === "done").length;
  const tasksTotal = (tasks || []).length;
  const pendingInvoices = (invoices || []).filter(i => i.status === "sent" || i.status === "pending");
  const pendingAmount = pendingInvoices.reduce((s, i) => s + (i.amount || 0), 0);

  // Handle slash commands
  let reply = "";

  if (text.startsWith("/start")) {
    reply = `Welcome to your ${client.business_name} project bot!\n\nI'm your personal assistant for everything related to your marketing project with ShortStack.\n\nCommands:\n/status - Project overview\n/tasks - Your task checklist\n/invoices - Billing summary\n/content - Upcoming content\n/activity - Recent AI activity\n\nOr just ask me anything about your project!`;
  } else if (text.startsWith("/status")) {
    reply = `${client.business_name} — Project Status\n\nPlan: ${client.package_tier || "Standard"}\nTasks: ${tasksDone}/${tasksTotal} completed\nPending Invoices: ${pendingInvoices.length} ($${pendingAmount})\nContent Scheduled: ${(content || []).length} pieces\nAI Actions (recent): ${(aiActions || []).length}`;
  } else if (text.startsWith("/tasks")) {
    if (!tasks?.length) {
      reply = "No tasks found yet. Your team will add tasks as your project progresses.";
    } else {
      reply = "Your Tasks:\n\n" + tasks.map((t) =>
        `${t.status === "done" ? "\u2705" : "\u2B1C"} ${t.title}`
      ).join("\n") + `\n\nProgress: ${tasksDone}/${tasksTotal}`;
    }
  } else if (text.startsWith("/invoices")) {
    if (!invoices?.length) {
      reply = "No invoices found.";
    } else {
      reply = "Invoices:\n\n" + invoices.map(i =>
        `${i.status === "paid" ? "\u2705" : "\u23F3"} $${i.amount} — ${i.status} (due: ${i.due_date || "N/A"})`
      ).join("\n");
    }
  } else if (text.startsWith("/content")) {
    if (!content?.length) {
      reply = "No content scheduled yet.";
    } else {
      reply = "Upcoming Content:\n\n" + content.map(c =>
        `${c.status === "published" ? "\u2705" : "\u{1F4C5}"} ${c.title || "Untitled"} — ${c.platform} (${c.scheduled_at?.split("T")[0] || "TBD"})`
      ).join("\n");
    }
  } else if (text.startsWith("/activity")) {
    if (!aiActions?.length) {
      reply = "No recent AI activity for your account.";
    } else {
      reply = "Recent Activity:\n\n" + aiActions.map(a =>
        `${a.status === "success" ? "\u2705" : "\u26A1"} ${a.description}`
      ).join("\n");
    }
  } else if (text.startsWith("/help")) {
    reply = `Available Commands:\n\n/status - Project overview\n/tasks - Task checklist\n/invoices - Billing info\n/content - Scheduled content\n/activity - Recent AI actions\n/help - This message\n\nOr ask me anything about your project!`;
  } else {
    // Free-form question — use AI
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (apiKey) {
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
            system: `You are the personal project assistant for ${client.business_name} (${client.contact_name}). They are a client of a digital marketing agency using ShortStack OS. Keep responses SHORT (2-3 sentences). No markdown. Plain text only.

Their project context:
- Plan: ${client.package_tier || "Standard"}
- Tasks: ${tasksDone}/${tasksTotal} done
- Pending invoices: ${pendingInvoices.length} ($${pendingAmount})
- Recent tasks: ${(tasks || []).slice(0, 5).map(t => `${t.title} (${t.status})`).join(", ")}
- Recent content: ${(content || []).slice(0, 3).map(c => `${c.title} on ${c.platform}`).join(", ")}

Answer their questions about their project helpfully. If they ask something you don't have data for, suggest they check the client portal or contact their account manager.`,
            messages: [{ role: "user", content: text }],
          }),
        });
        const data = await res.json();
        reply = data.content?.[0]?.text || "I'm not sure about that. Check the client portal for more details or contact your account manager.";
      } catch {
        reply = "Sorry, I couldn't process that right now. Try again or check the client portal.";
      }
    } else {
      reply = "I can help with /status, /tasks, /invoices, /content, and /activity. Type /help for all commands.";
    }
  }

  // Send reply
  await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text: reply }),
  });

  return NextResponse.json({ ok: true });
}
