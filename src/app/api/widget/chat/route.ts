import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { upsertInboundMessage } from "@/lib/conversations";
import { rateLimit } from "@/lib/rate-limit";

/**
 * Public chat-widget endpoint.
 *
 * POST /api/widget/chat
 *   { token, sessionId, message, visitorEmail?, pageUrl? }
 *   Resolves token → profile_id via chat_widgets, then writes into the
 *   unified conversations pipeline (channel = 'web_chat').
 *
 * GET /api/widget/chat?token=…&sessionId=…&since=ISO
 *   Returns every message on the matching conversation since `since`.
 *
 * Both verbs allow cross-origin requests — the widget lives on customer
 * domains and talks back to the ShortStack origin. No cookies, no auth;
 * widget tokens are public-safe identifiers (knowing one only lets you
 * write into that hub's inbox, not read other tenants' data).
 */

export const runtime = "nodejs";
export const maxDuration = 10;

const CORS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Max-Age": "86400",
};

function json(payload: unknown, init: number | ResponseInit = 200) {
  const initObj = typeof init === "number" ? { status: init } : init;
  const headers = new Headers(initObj.headers);
  for (const [k, v] of Object.entries(CORS)) headers.set(k, v);
  headers.set("Content-Type", "application/json");
  return new NextResponse(JSON.stringify(payload), { ...initObj, headers });
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}

interface ChatWidgetRow {
  id: string;
  profile_id: string;
  domain: string;
  token: string;
}

async function resolveWidget(token: string): Promise<ChatWidgetRow | null> {
  if (!token || !token.startsWith("cw_")) return null;
  const svc = createServiceClient();
  const { data } = await svc
    .from("chat_widgets")
    .select("id, profile_id, domain, token")
    .eq("token", token)
    .maybeSingle();
  return (data as ChatWidgetRow | null) ?? null;
}

// ── POST: send a visitor message ───────────────────────────────────
export async function POST(request: NextRequest) {
  let body: {
    token?: string;
    sessionId?: string;
    message?: string;
    visitorEmail?: string;
    pageUrl?: string;
  };
  try {
    body = await request.json();
  } catch {
    return json({ error: "Invalid JSON" }, 400);
  }

  const token = body.token?.trim();
  const sessionId = body.sessionId?.trim();
  const message = body.message?.trim();

  if (!token || !sessionId || !message) {
    return json({ error: "token, sessionId, message required" }, 400);
  }
  if (message.length > 4000) {
    return json({ error: "Message too long (4000 char max)" }, 413);
  }

  // Rate-limit: 20 messages per 5 minutes per session.
  // Good-faith visitors never hit this; malicious traffic gets a soft cap.
  const rl = rateLimit(`widget_chat:${sessionId}`, 20, 5 * 60 * 1000);
  if (!rl.allowed) {
    return json(
      { error: "Too many messages. Please slow down." },
      { status: 429, headers: { "Retry-After": String(Math.ceil((rl.resetAt - Date.now()) / 1000)) } },
    );
  }

  const widget = await resolveWidget(token);
  if (!widget) return json({ error: "Unknown widget token" }, 404);

  const svc = createServiceClient();

  const visitorEmail = body.visitorEmail?.trim();
  const fromHandle = visitorEmail || `visitor-${sessionId.slice(-8)}`;

  // Surface context the inbox can display alongside the message.
  const subject = widget.domain ? `Chat on ${widget.domain}` : "Web chat";

  const result = await upsertInboundMessage({
    supabase: svc,
    userId: widget.profile_id,
    channel: "web_chat",
    externalThreadId: sessionId,
    fromIdentifier: fromHandle,
    toIdentifier: widget.domain,
    subject,
    body: message,
  });

  if (!result) {
    return json({ error: "Failed to record message" }, 500);
  }

  // If a visitor email arrived, try to link/create a contact so the agent
  // sees a unified profile rather than an anonymous session. Best-effort —
  // failures here must NOT block the message delivery.
  if (visitorEmail && /.+@.+\..+/.test(visitorEmail)) {
    try {
      const { data: existing } = await svc
        .from("clients")
        .select("id")
        .eq("profile_id", widget.profile_id)
        .eq("email", visitorEmail)
        .maybeSingle();

      let contactId = (existing as { id?: string } | null)?.id ?? null;
      if (!contactId) {
        const { data: created } = await svc
          .from("clients")
          .insert({
            profile_id: widget.profile_id,
            business_name: visitorEmail.split("@")[0],
            email: visitorEmail,
            notes: `Captured from chat widget on ${widget.domain} at ${new Date().toISOString()}`,
          })
          .select("id")
          .maybeSingle();
        contactId = (created as { id?: string } | null)?.id ?? null;
      }

      if (contactId) {
        await svc
          .from("conversations")
          .update({ contact_id: contactId })
          .eq("id", result.conversationId)
          .is("contact_id", null);
      }
    } catch (err) {
      // Non-fatal.
      console.error("[widget/chat] contact link failed:", err);
    }
  }

  return json({
    ok: true,
    conversationId: result.conversationId,
    messageId: result.messageId,
  });
}

// ── GET: poll for new messages on this session ────────────────────
export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const token = url.searchParams.get("token")?.trim();
  const sessionId = url.searchParams.get("sessionId")?.trim();
  const since = url.searchParams.get("since");

  if (!token || !sessionId) {
    return json({ error: "token, sessionId required" }, 400);
  }

  // Light rate-limit on polls too — 60 polls per minute per session is
  // way above the 6/min the widget needs and blocks aggressive loops.
  const rl = rateLimit(`widget_poll:${sessionId}`, 60, 60_000);
  if (!rl.allowed) {
    return json({ messages: [] }, 429);
  }

  const widget = await resolveWidget(token);
  if (!widget) return json({ error: "Unknown widget token" }, 404);

  const svc = createServiceClient();

  const { data: conv } = await svc
    .from("conversations")
    .select("id")
    .eq("user_id", widget.profile_id)
    .eq("channel", "web_chat")
    .eq("external_thread_id", sessionId)
    .maybeSingle();

  if (!conv) return json({ messages: [] });

  let q = svc
    .from("conversation_messages")
    .select("id, direction, body, sent_at")
    .eq("conversation_id", (conv as { id: string }).id)
    .order("sent_at", { ascending: true });

  if (since) q = q.gt("sent_at", since);

  const { data } = await q;
  return json({ messages: data ?? [] });
}
