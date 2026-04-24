import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { upsertInboundMessage } from "@/lib/conversations";
import crypto from "crypto";

// Zernio webhook → Conversations.
//
// Zernio forwards inbound Instagram (and other platform) DMs. Expected
// payload shape (verified against Zernio docs April 2026):
//   {
//     platform: "instagram",
//     profile_id: "abc123",       — the zernio_profile_id on clients
//     thread_id: "ig_thread_xyz",
//     message_id: "...",
//     from: { id: "sender_ig_id", username: "their_handle" },
//     to: { id: "recipient_ig_id", username: "our_handle" },
//     text: "Hey!",
//     attachments: [{ url, type }],
//     timestamp: "2026-04-23T..."
//   }
//
// Owner resolution: match `profile_id` against clients.zernio_profile_id,
// then use that client's profile_id as the agency owner.
//
// Register at: https://zernio.com/app/settings/webhooks
// URL:         https://app.shortstack.work/api/webhooks/zernio
// Set ZERNIO_WEBHOOK_SECRET for HMAC verification.

export const runtime = "nodejs";
export const maxDuration = 15;

function verifyZernioSignature(raw: string, signature: string | null): boolean {
  const secret = process.env.ZERNIO_WEBHOOK_SECRET;
  if (!secret) {
    console.error("[webhooks/zernio] ZERNIO_WEBHOOK_SECRET is not set — rejecting request. Configure the secret in Vercel env.");
    return false; // fail-closed
  }
  if (!signature) return false;
  const expected = crypto.createHmac("sha256", secret).update(raw).digest("hex");
  try {
    return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
  } catch {
    return false;
  }
}

type ZernioInbound = {
  platform?: string;
  profile_id?: string;
  thread_id?: string;
  message_id?: string;
  from?: { id?: string; username?: string };
  to?: { id?: string; username?: string };
  text?: string;
  attachments?: Array<{ url: string; type?: string; filename?: string }>;
  timestamp?: string;
};

export async function POST(request: NextRequest) {
  const rawBody = await request.text();
  const sig = request.headers.get("x-zernio-signature") || request.headers.get("x-webhook-signature");
  if (!verifyZernioSignature(rawBody, sig)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  let payload: ZernioInbound;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!payload.thread_id || !payload.profile_id) {
    return NextResponse.json({ ok: true, skipped: "missing_ids" });
  }

  // Platform mapping: Zernio spans multiple networks, but for the inbox we
  // currently only model Instagram. Other platforms are logged but skip
  // the conversation write (extend when we add tiktok/linkedin threads).
  const channel = payload.platform === "instagram" ? "instagram" : null;
  if (!channel) return NextResponse.json({ ok: true, skipped: "unsupported_platform" });

  const supabase = createServiceClient();

  // Resolve owner: the Zernio profile belongs to a client, which points to
  // an agency profile_id.
  const { data: client } = await supabase
    .from("clients")
    .select("id, profile_id")
    .eq("zernio_profile_id", payload.profile_id)
    .maybeSingle();
  const ownerId = (client as { profile_id?: string } | null)?.profile_id;
  const contactId = (client as { id?: string } | null)?.id ?? null;

  if (!ownerId) {
    return NextResponse.json({ ok: true, skipped: "no_owner" });
  }

  const sentAt = payload.timestamp ? new Date(payload.timestamp) : new Date();

  await upsertInboundMessage({
    supabase,
    userId: ownerId,
    channel,
    externalThreadId: payload.thread_id,
    fromIdentifier: payload.from?.username || payload.from?.id || "unknown",
    toIdentifier: payload.to?.username || payload.to?.id,
    body: payload.text,
    externalMessageId: payload.message_id,
    attachments: (payload.attachments || []).map((a) => ({
      url: a.url,
      filename: a.filename,
      mimetype: a.type,
    })),
    contactId,
    sentAt,
  });

  return NextResponse.json({ ok: true });
}
