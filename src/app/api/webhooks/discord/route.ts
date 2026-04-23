import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { upsertInboundMessage } from "@/lib/conversations";
import crypto from "crypto";

// Discord DM webhook → Conversations.
//
// Discord doesn't push DM events via Interactions — you'd normally use the
// Gateway. For a lightweight HTTP-only path, register a Discord Webhook or
// use a relay (the existing /api/discord/webhook route handles slash
// commands). This endpoint accepts a DM-forwarding payload from either:
//
//   a) A gateway relay worker POSTing { guild_id?, channel_id, author:{id,username},
//      content, id (message id) }  — signed with DISCORD_DM_RELAY_SECRET via
//      the `x-shortstack-relay-sig` HMAC header.
//
//   b) A Discord Outgoing Webhook set up as a forwarder (same shape).
//
// Each DM channel_id becomes the external_thread_id AND the reply target
// when we send outbound via POST /api/conversations/:id/send.

export const runtime = "nodejs";
export const maxDuration = 15;

function verifyRelaySignature(raw: string, signature: string | null): boolean {
  const secret = process.env.DISCORD_DM_RELAY_SECRET;
  if (!secret) return true; // unconfigured → accept (dev)
  if (!signature) return false;
  const expected = crypto.createHmac("sha256", secret).update(raw).digest("hex");
  try {
    return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
  } catch {
    return false;
  }
}

export async function POST(request: NextRequest) {
  const rawBody = await request.text();
  const sig = request.headers.get("x-shortstack-relay-sig");
  if (!verifyRelaySignature(rawBody, sig)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  let payload: {
    guild_id?: string;
    channel_id?: string;
    author?: { id?: string; username?: string; bot?: boolean };
    content?: string;
    id?: string; // message id
  };
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  // Skip our own outbound echoes.
  if (payload.author?.bot) return NextResponse.json({ ok: true });
  if (!payload.channel_id || !payload.author?.id) {
    return NextResponse.json({ error: "channel_id + author required" }, { status: 400 });
  }

  const supabase = createServiceClient();

  // Owner: prefer guild-scoped install (matches existing discord_integrations
  // schema), else look for a "global" install where guild_id IS NULL.
  let ownerId: string | null = null;
  if (payload.guild_id) {
    const { data } = await supabase
      .from("discord_integrations")
      .select("user_id")
      .eq("guild_id", payload.guild_id)
      .maybeSingle();
    ownerId = (data as { user_id?: string } | null)?.user_id ?? null;
  }

  if (!ownerId) {
    return NextResponse.json({ ok: true, skipped: "no_owner" });
  }

  await upsertInboundMessage({
    supabase,
    userId: ownerId,
    channel: "discord",
    externalThreadId: payload.channel_id,
    fromIdentifier: payload.author.username || payload.author.id,
    toIdentifier: "bot",
    body: payload.content || "",
    externalMessageId: payload.id,
  });

  return NextResponse.json({ ok: true });
}
