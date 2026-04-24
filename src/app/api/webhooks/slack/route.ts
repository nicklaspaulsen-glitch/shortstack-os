import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { upsertInboundMessage } from "@/lib/conversations";
import crypto from "crypto";

// Slack Events API webhook → Conversations.
//
// Register at: https://api.slack.com/apps → Event Subscriptions
// Request URL:  https://app.shortstack.work/api/webhooks/slack
// Subscribe to: message.im (Direct Message to the bot)
// Signing secret goes in env as SLACK_SIGNING_SECRET.
//
// On url_verification we echo the challenge; on event_callback we upsert
// the conversation. Each DM channel (`channel_type === "im"`) is one
// thread; the `channel` id doubles as external_thread_id AND as the
// destination when we reply via chat.postMessage (see /send route).

export const runtime = "nodejs";
export const maxDuration = 15;

function verifySlackSignature(request: NextRequest, rawBody: string): boolean {
  const secret = process.env.SLACK_SIGNING_SECRET;
  if (!secret) {
    console.error("[webhooks/slack] SLACK_SIGNING_SECRET is not set — rejecting request. Configure the secret in Vercel env.");
    return false; // fail-closed
  }
  const ts = request.headers.get("x-slack-request-timestamp");
  const sig = request.headers.get("x-slack-signature");
  if (!ts || !sig) return false;
  // Replay protection: reject if timestamp is older than 5min.
  if (Math.abs(Date.now() / 1000 - Number(ts)) > 60 * 5) return false;
  const basestring = `v0:${ts}:${rawBody}`;
  const mySig = "v0=" + crypto.createHmac("sha256", secret).update(basestring).digest("hex");
  try {
    return crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(mySig));
  } catch {
    return false;
  }
}

export async function POST(request: NextRequest) {
  const rawBody = await request.text();
  if (!verifySlackSignature(request, rawBody)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  // URL verification handshake
  if (payload.type === "url_verification") {
    return NextResponse.json({ challenge: payload.challenge });
  }

  if (payload.type !== "event_callback") {
    return NextResponse.json({ ok: true });
  }

  const event = payload.event as Record<string, unknown> | undefined;
  if (!event) return NextResponse.json({ ok: true });

  // We only care about DMs (channel_type=im), and we skip bot messages
  // (bot_id set) to avoid echoing our own outbound replies.
  if (event.type !== "message" || event.channel_type !== "im" || event.bot_id) {
    return NextResponse.json({ ok: true });
  }

  const supabase = createServiceClient();
  const teamId = payload.team_id as string | undefined;
  const channelId = event.channel as string; // IM channel id, also the reply target
  const userHandle = (event.user as string) || "unknown";
  const text = (event.text as string) || "";

  // Look up which agency owns this Slack install via team_id.
  const { data: integration } = await supabase
    .from("slack_integrations")
    .select("user_id")
    .eq("team_id", teamId)
    .maybeSingle();
  const ownerId = (integration as { user_id?: string } | null)?.user_id;

  if (!ownerId) {
    // No install record — skip silently. Users connect Slack from
    // /dashboard/integrations and the OAuth flow writes slack_integrations.
    return NextResponse.json({ ok: true, skipped: "no_owner" });
  }

  await upsertInboundMessage({
    supabase,
    userId: ownerId,
    channel: "slack",
    externalThreadId: channelId,
    fromIdentifier: userHandle,
    toIdentifier: "bot",
    body: text,
    externalMessageId: (event.ts as string) || undefined,
  });

  return NextResponse.json({ ok: true });
}
