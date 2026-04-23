import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase, createServiceClient } from "@/lib/supabase/server";
import { insertOutboundMessage } from "@/lib/conversations";
import { sendEmail } from "@/lib/email";

// POST /api/conversations/:id/send
// Dispatches an outbound reply on the conversation's native channel, then
// records it as a conversation_messages row (direction='outbound').
//
// Body: { body: string, subject?: string (email only), attachments?: [] }
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { body, subject, attachments } = await request.json();
  if (!body || typeof body !== "string") {
    return NextResponse.json({ error: "body is required" }, { status: 400 });
  }

  // Fetch conversation via RLS — will return nothing if not owned.
  const { data: conv } = await supabase
    .from("conversations")
    .select("id, channel, external_thread_id, contact_id")
    .eq("id", params.id)
    .maybeSingle();

  if (!conv) return NextResponse.json({ error: "Conversation not found" }, { status: 404 });

  // For dispatch we use the service client — we need to hit provider APIs
  // with server credentials, and RLS has already authorized the caller.
  const svc = createServiceClient();

  // Look up the "to" identifier from the most recent inbound message.
  const { data: latestInbound } = await svc
    .from("conversation_messages")
    .select("from_identifier")
    .eq("conversation_id", conv.id)
    .eq("direction", "inbound")
    .order("sent_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const to = latestInbound?.from_identifier || conv.external_thread_id;

  let providerResult: { ok: boolean; externalId?: string; from?: string; error?: string };

  switch (conv.channel) {
    case "sms":
    case "whatsapp": {
      providerResult = await sendTwilio(conv.channel, to, body);
      break;
    }
    case "email": {
      const sent = await sendEmail({
        to,
        subject: subject || "Re: Conversation",
        html: `<div style="white-space:pre-wrap">${escapeHtml(body)}</div>`,
      });
      providerResult = { ok: sent, from: process.env.SMTP_FROM || "growth@mail.shortstack.work", error: sent ? undefined : "SMTP send failed" };
      break;
    }
    case "telegram": {
      providerResult = await sendTelegram(to, body);
      break;
    }
    case "slack": {
      providerResult = await sendSlack(to, body);
      break;
    }
    case "discord": {
      providerResult = await sendDiscord(to, body);
      break;
    }
    case "instagram": {
      providerResult = await sendZernioInstagram(to, body);
      break;
    }
    case "web_chat": {
      // Web chat is a no-op send — the widget will poll / subscribe to
      // conversation_messages and render the row.
      providerResult = { ok: true, from: "web_chat" };
      break;
    }
    default: {
      providerResult = { ok: false, error: `Unsupported channel: ${conv.channel}` };
    }
  }

  if (!providerResult.ok) {
    return NextResponse.json(
      { error: providerResult.error || "Send failed" },
      { status: 502 },
    );
  }

  const messageId = await insertOutboundMessage({
    supabase: svc,
    conversationId: conv.id,
    fromIdentifier: providerResult.from || "agent",
    toIdentifier: to,
    body,
    externalMessageId: providerResult.externalId,
    attachments,
  });

  return NextResponse.json({ ok: true, messageId, channel: conv.channel });
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

// ── Channel dispatchers ──

async function sendTwilio(
  channel: "sms" | "whatsapp",
  to: string,
  body: string,
): Promise<{ ok: boolean; externalId?: string; from?: string; error?: string }> {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const smsFrom = process.env.TWILIO_DEFAULT_NUMBER;
  const waFrom = process.env.TWILIO_WHATSAPP_NUMBER;
  if (!sid || !token) return { ok: false, error: "Twilio not configured" };

  const from = channel === "whatsapp" ? (waFrom ? `whatsapp:${waFrom}` : "") : smsFrom || "";
  const toFmt = channel === "whatsapp" && !to.startsWith("whatsapp:") ? `whatsapp:${to}` : to;
  if (!from) return { ok: false, error: `Twilio ${channel} number not configured` };

  try {
    const auth = Buffer.from(`${sid}:${token}`).toString("base64");
    const res = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`,
      {
        method: "POST",
        headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ To: toFmt, From: from, Body: body }),
      },
    );
    const data = await res.json();
    if (!res.ok) return { ok: false, error: data.message || `Twilio ${res.status}` };
    return { ok: true, externalId: data.sid, from };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Twilio send failed" };
  }
}

async function sendTelegram(
  chatId: string,
  body: string,
): Promise<{ ok: boolean; externalId?: string; from?: string; error?: string }> {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  if (!botToken) return { ok: false, error: "Telegram not configured" };
  try {
    const res = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text: body }),
    });
    const data = await res.json();
    if (!data.ok) return { ok: false, error: data.description || "Telegram send failed" };
    return { ok: true, externalId: String(data.result?.message_id ?? ""), from: "trinity-bot" };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Telegram send failed" };
  }
}

async function sendSlack(
  channel: string,
  body: string,
): Promise<{ ok: boolean; externalId?: string; from?: string; error?: string }> {
  const token = process.env.SLACK_BOT_TOKEN;
  if (!token) return { ok: false, error: "Slack not configured" };
  try {
    const res = await fetch("https://slack.com/api/chat.postMessage", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json; charset=utf-8",
      },
      body: JSON.stringify({ channel, text: body }),
    });
    const data = await res.json();
    if (!data.ok) return { ok: false, error: data.error || "Slack send failed" };
    return { ok: true, externalId: data.ts, from: "slackbot" };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Slack send failed" };
  }
}

async function sendDiscord(
  channelId: string,
  body: string,
): Promise<{ ok: boolean; externalId?: string; from?: string; error?: string }> {
  const botToken = process.env.DISCORD_BOT_TOKEN;
  if (!botToken) return { ok: false, error: "Discord not configured" };
  try {
    const res = await fetch(`https://discord.com/api/v10/channels/${channelId}/messages`, {
      method: "POST",
      headers: {
        Authorization: `Bot ${botToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ content: body }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ message: res.statusText }));
      return { ok: false, error: err.message || `Discord ${res.status}` };
    }
    const data = await res.json();
    return { ok: true, externalId: data.id, from: "trinity-bot" };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Discord send failed" };
  }
}

async function sendZernioInstagram(
  threadId: string,
  body: string,
): Promise<{ ok: boolean; externalId?: string; from?: string; error?: string }> {
  const apiKey = process.env.ZERNIO_API_KEY;
  if (!apiKey) return { ok: false, error: "Zernio not configured" };
  try {
    const res = await fetch("https://api.zernio.com/v1/messages", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ platform: "instagram", thread_id: threadId, text: body }),
    });
    if (!res.ok) return { ok: false, error: `Zernio ${res.status}` };
    const data = await res.json().catch(() => ({}));
    return { ok: true, externalId: data.id, from: "instagram_agent" };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Zernio send failed" };
  }
}
