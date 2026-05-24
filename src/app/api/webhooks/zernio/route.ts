import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { upsertInboundMessage, type ConversationChannel } from "@/lib/conversations";
import { exitRunsForContact } from "@/lib/sequences/engine";
import { captureVoiceSample } from "@/lib/ai/voice-profile";
import { internalPost } from "@/lib/internal-fetch";
import { sendDM as zernioDM } from "@/lib/services/zernio";
import crypto from "crypto";

// Zernio webhook → Conversations.
//
// Zernio forwards inbound DMs across Instagram, Facebook, Telegram,
// WhatsApp. Actual payload (verified against OpenAPI spec May 2026):
//   {
//     id: "evt_abc123",                    — dedup key
//     event: "message.received",           — event type
//     message: InboxWebhookMessage,        — the DM content
//     conversation: InboxWebhookConversation,
//     account: InboxWebhookAccount,        — the receiving social account
//     metadata?: { ... },                  — interactive message metadata
//     timestamp: "2026-05-23T..."          — ISO-8601
//   }
//
// Owner resolution: match `account.id` against social_accounts.account_id
// to find the client_id, then resolve the agency owner via clients.profile_id.
// Fallback: match account.id against clients.zernio_profile_id directly.
//
// Register at: https://zernio.com/dashboard/webhooks
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
  // Decode hex strings to bytes before timingSafeEqual. utf8 decoding
  // (the default) of a hex string produces a buffer twice the size of
  // the actual digest, so length checks always fail. See discord webhook
  // for the same fix; both were never verifying a valid signature
  // before this patch.
  try {
    const sigBytes = Buffer.from(signature, "hex");
    const expectedBytes = Buffer.from(expected, "hex");
    if (sigBytes.length !== expectedBytes.length) return false;
    return crypto.timingSafeEqual(sigBytes, expectedBytes);
  } catch {
    return false;
  }
}

// ── Zernio webhook payload types (from OpenAPI spec) ──────────────────────

type ZernioWebhookSender = {
  id: string;
  name?: string;
  username?: string;
  picture?: string;
  phoneNumber?: string;
  businessScopedUserId?: string;
  parentBusinessScopedUserId?: string;
  whatsappUsername?: string;
  instagramProfile?: string;
};

type ZernioWebhookAttachment = {
  type: string;
  url: string;
  payload?: unknown;
};

type ZernioWebhookMessage = {
  id: string;
  conversationId: string;
  platform: "instagram" | "facebook" | "telegram" | "whatsapp";
  platformMessageId: string;
  direction: "incoming" | "outgoing";
  text: string | null;
  attachments: ZernioWebhookAttachment[];
  sender: ZernioWebhookSender;
  sentAt: string; // ISO-8601
  isRead: boolean;
};

type ZernioWebhookConversation = {
  id: string;
  platformConversationId: string;
  participantId?: string;
  participantName?: string;
  participantUsername?: string;
  participantPicture?: string;
  status: "active" | "archived";
};

type ZernioWebhookAccount = {
  id: string;
  platform: string;
  username: string;
  displayName?: string;
};

type ZernioWebhookPayload = {
  id: string; // webhook event ID — use as dedup key
  event: string; // "message.received", "post.created", etc.
  message: ZernioWebhookMessage;
  conversation: ZernioWebhookConversation;
  account: ZernioWebhookAccount;
  metadata?: {
    quickReplyPayload?: string;
    postbackPayload?: string;
    postbackTitle?: string;
    callbackData?: string;
    interactiveType?: string;
  };
  timestamp: string; // ISO-8601
};

// Shape of account.connected / account.refreshed / account.disconnected payloads
// (different from message.received — uses profile_id instead of message/conversation)
type ZernioAccountEventPayload = {
  event: string;
  profile_id?: string;
  account?: {
    id?: string;
    platform?: string;
    name?: string;
    username?: string;
    access_token?: string;
    refresh_token?: string;
    expires_at?: string;
    status?: string;
  };
};

export async function POST(request: NextRequest) {
  const rawBody = await request.text();
  const sig = request.headers.get("x-zernio-signature") || request.headers.get("x-webhook-signature");
  if (!verifyZernioSignature(rawBody, sig)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  let webhook: ZernioWebhookPayload;
  try {
    webhook = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  // Handle account connection / disconnection events.
  // Zernio fires these when a user completes (or revokes) OAuth on a social
  // platform. Upsert the social_accounts row with the fresh token so that
  // /api/social/post can use it for direct platform API calls without a
  // separate polling cycle.
  if (
    webhook.event === "account.connected" ||
    webhook.event === "account.refreshed" ||
    webhook.event === "account.disconnected"
  ) {
    const acctEvt = webhook as unknown as ZernioAccountEventPayload;
    const profileId = acctEvt.profile_id;
    const acctInfo = acctEvt.account;

    if (!profileId || !acctInfo?.id || !acctInfo?.platform) {
      console.warn("[webhooks/zernio] account event missing required fields", { event: webhook.event });
      return NextResponse.json({ ok: true, skipped: "missing_account_fields" });
    }

    const svc = createServiceClient();

    const { data: clientRow } = await svc
      .from("clients")
      .select("id")
      .eq("zernio_profile_id", profileId)
      .maybeSingle();

    if (!clientRow) {
      console.warn("[webhooks/zernio] unknown profile_id:", profileId);
      // Return 200 so Zernio doesn't retry indefinitely for unrecognised profiles.
      return NextResponse.json({ ok: true, skipped: "unknown_profile" });
    }

    const clientId = clientRow.id;

    if (webhook.event === "account.disconnected") {
      await svc
        .from("social_accounts")
        .update({ is_active: false, access_token: null })
        .eq("client_id", clientId)
        .eq("platform", acctInfo.platform)
        .eq("account_id", acctInfo.id);
      console.log(`[webhooks/zernio] account.disconnected: client=${clientId} platform=${acctInfo.platform}`);
      return NextResponse.json({ ok: true });
    }

    // account.connected / account.refreshed — upsert with the fresh token
    const accountName = acctInfo.name || acctInfo.username || acctInfo.platform;
    const upsertData: Record<string, unknown> = {
      client_id: clientId,
      platform: acctInfo.platform,
      account_id: acctInfo.id,
      account_name: accountName,
      is_active: true,
      metadata: {
        oauth: true,
        zernio: true,
        zernio_event: webhook.event,
        synced_at: new Date().toISOString(),
      },
    };
    if (acctInfo.access_token) upsertData.access_token = acctInfo.access_token;
    if (acctInfo.refresh_token) upsertData.refresh_token = acctInfo.refresh_token;
    if (acctInfo.expires_at) upsertData.token_expires_at = acctInfo.expires_at;

    const { error: upsertErr } = await svc
      .from("social_accounts")
      .upsert(upsertData, { onConflict: "client_id,platform,account_id", ignoreDuplicates: false });

    if (upsertErr) {
      console.error("[webhooks/zernio] account upsert failed:", upsertErr.message);
      return NextResponse.json({ error: "DB write failed" }, { status: 500 });
    }

    console.log(
      `[webhooks/zernio] ${webhook.event}: client=${clientId} platform=${acctInfo.platform} account=${acctInfo.id} hasToken=${!!acctInfo.access_token}`,
    );
    return NextResponse.json({ ok: true });
  }

  // Only process incoming message events — skip post.*, message.sent, etc.
  if (webhook.event !== "message.received") {
    return NextResponse.json({ ok: true, skipped: "event_not_message_received", event: webhook.event });
  }

  // Skip outgoing messages (our own replies echoed back)
  if (webhook.message?.direction === "outgoing") {
    return NextResponse.json({ ok: true, skipped: "outgoing_message" });
  }

  const msg = webhook.message;
  const conv = webhook.conversation;
  const acct = webhook.account;

  if (!msg || !conv || !acct) {
    return NextResponse.json({ ok: true, skipped: "missing_payload_fields" });
  }

  // Platform mapping — Zernio supports instagram, facebook, telegram, whatsapp.
  // Our ConversationChannel also includes twitter, tiktok, linkedin.
  const SUPPORTED_PLATFORMS: ConversationChannel[] = [
    "instagram", "facebook", "twitter", "tiktok", "linkedin", "telegram",
  ];
  const channel: ConversationChannel | null =
    msg.platform && SUPPORTED_PLATFORMS.includes(msg.platform as ConversationChannel)
      ? (msg.platform as ConversationChannel)
      : null;
  if (!channel) {
    return NextResponse.json({ ok: true, skipped: "unsupported_platform", platform: msg.platform });
  }

  const supabase = createServiceClient();

  // ── Owner resolution ──────────────────────────────────────────────────────
  // Path 1: account.id → social_accounts.account_id → client_id → profile_id
  // Path 2 (fallback): account.id → clients.zernio_profile_id → profile_id
  let ownerId: string | null = null;
  let contactId: string | null = null;

  // Path 1: match via social_accounts (populated by Zernio account sync)
  const { data: socialAcct } = await supabase
    .from("social_accounts")
    .select("client_id")
    .eq("account_id", acct.id)
    .eq("is_active", true)
    .limit(1)
    .maybeSingle();

  if (socialAcct?.client_id) {
    const { data: client } = await supabase
      .from("clients")
      .select("id, profile_id")
      .eq("id", socialAcct.client_id)
      .maybeSingle();
    ownerId = (client as { profile_id?: string } | null)?.profile_id ?? null;
    contactId = (client as { id?: string } | null)?.id ?? null;
  }

  // Path 2 (fallback): match account.id against clients.zernio_profile_id
  if (!ownerId) {
    const { data: client } = await supabase
      .from("clients")
      .select("id, profile_id")
      .eq("zernio_profile_id", acct.id)
      .maybeSingle();
    ownerId = (client as { profile_id?: string } | null)?.profile_id ?? null;
    contactId = (client as { id?: string } | null)?.id ?? null;
  }

  if (!ownerId) {
    console.warn("[webhooks/zernio] No owner found for account:", acct.id, acct.username);
    return NextResponse.json({ ok: true, skipped: "no_owner" });
  }

  // ── Extract normalized fields ─────────────────────────────────────────────
  const threadId = conv.platformConversationId || conv.id;
  const messageId = msg.platformMessageId || msg.id;
  const senderHandle = msg.sender?.username || conv.participantUsername;
  const senderIdentifier = senderHandle || msg.sender?.id || "unknown";
  const recipientIdentifier = acct.username;
  const messageText = msg.text || undefined;
  const sentAt = msg.sentAt ? new Date(msg.sentAt) : new Date();
  const attachments = (msg.attachments || []).map((a) => ({
    url: a.url,
    mimetype: a.type,
  }));

  await upsertInboundMessage({
    supabase,
    userId: ownerId,
    channel,
    externalThreadId: threadId,
    fromIdentifier: senderIdentifier,
    toIdentifier: recipientIdentifier,
    body: messageText,
    externalMessageId: messageId,
    attachments,
    contactId,
    sentAt,
  });

  // Multi-channel sequences: try to map the sender's handle to a lead
  // (leads.instagram_url) and exit any active sequence runs. Soft-fail.
  if (senderHandle) {
    const { data: matchedLead } = await supabase
      .from("leads")
      .select("id")
      .eq("user_id", ownerId)
      .ilike("instagram_url", `%${senderHandle}%`)
      .limit(1)
      .maybeSingle();
    if (matchedLead?.id) {
      await exitRunsForContact(supabase, matchedLead.id, "replied_dm").catch((err) => {
        console.warn("[zernio-webhook] exitRunsForContact failed:", err);
      });
    }
  }

  // Capture client DM voice — fire-and-forget.
  if (contactId && messageText) {
    captureVoiceSample({
      agencyOwnerId: ownerId,
      subjectKind: "client",
      subjectId: contactId,
      source: "reply_dm",
      body: messageText,
      channel: "dm",
    }).catch((err) => console.warn("[voice-capture/zernio]", err));
  }

  // ── Lead Pipeline routing ─────────────────────────────────────────────────
  if (senderHandle && ownerId) {
    const { data: pipelineLead } = await supabase
      .from("lead_pipeline")
      .select("id, stage, owner_id")
      .eq("owner_id", ownerId)
      .eq("platform", channel)
      .ilike("handle", senderHandle)
      .not("stage", "in", '("dead","converted","closed","delivered")')
      .limit(1)
      .maybeSingle();

    if (pipelineLead?.id) {
      const stage = pipelineLead.stage as string;
      const msgAttachments = msg.attachments || [];

      // ── Early stages: outreach_sent / replied / qualifying / qualified ──
      if (
        ["outreach_sent", "replied", "qualifying", "qualified",
         "payment_sent", "payment_received"].includes(stage) &&
        messageText
      ) {
        if (stage === "outreach_sent") {
          await supabase
            .from("lead_pipeline")
            .update({ stage: "replied", last_reply_at: new Date().toISOString() })
            .eq("id", pipelineLead.id);
        }

        const qualifyResult = await internalPost("/api/leadgen/qualify", {
          lead_id: pipelineLead.id,
          message: messageText,
          attachments: msgAttachments.map((a) => ({
            url: a.url,
            type: a.type,
          })),
        });
        if (!qualifyResult.ok) {
          console.error("[zernio-webhook] leadgen qualify failed:", qualifyResult.data);
        }
      }

      // ── Onboarding stage: collecting credentials ───────────────────────
      else if (stage === "onboarding" && messageText) {
        const onboardResult = await internalPost("/api/leadgen/onboard", {
          lead_id: pipelineLead.id,
          owner_id: pipelineLead.owner_id,
          inbound_message: messageText,
        });
        if (!onboardResult.ok) {
          console.error("[zernio-webhook] leadgen onboard failed:", onboardResult.data);
        }
      }

      // ── Scripting stage: waiting for footage ───────────────────────────
      else if (stage === "scripting") {
        const hasVideoAttachment = msgAttachments.some((a) =>
          a.type?.startsWith("video/") ||
          ["mp4", "mov", "avi", "webm", "mkv", "m4v"].includes(
            a.url.split(".").pop()?.split("?")[0]?.toLowerCase() ?? "",
          ),
        );

        const isAiRequest =
          messageText && /ai generat|generate|create.*video|make.*video/i.test(messageText);

        if (hasVideoAttachment || isAiRequest) {
          const videoAttachment = msgAttachments.find((a) =>
            a.type?.startsWith("video/") ||
            ["mp4", "mov", "avi", "webm", "mkv", "m4v"].includes(
              a.url.split(".").pop()?.split("?")[0]?.toLowerCase() ?? "",
            ),
          );
          const needsThumbnail = messageText ? /thumbnail/i.test(messageText) : false;

          const processResult = await internalPost("/api/leadgen/process-footage", {
            lead_id: pipelineLead.id,
            owner_id: pipelineLead.owner_id,
            footage_url: videoAttachment?.url || "",
            needs_thumbnail: needsThumbnail,
            brief: messageText || "",
            attachments: msgAttachments,
          });
          if (!processResult.ok) {
            console.error("[zernio-webhook] process-footage failed:", processResult.data);
          }
        } else if (messageText) {
          await zernioDM({
            platform: channel,
            handle: senderHandle,
            message: "Got your message! Whenever you're ready, just drop the footage here and I'll start editing right away.",
          });
        }
      }

      // ── Editing stage: lead messages during active editing ─────────────
      else if (stage === "editing" && messageText) {
        const hasVideo = msgAttachments.some((a) =>
          a.type?.startsWith("video/") ||
          ["mp4", "mov", "avi", "webm", "mkv", "m4v"].includes(
            a.url.split(".").pop()?.split("?")[0]?.toLowerCase() ?? "",
          ),
        );

        if (hasVideo) {
          const videoAttachment = msgAttachments.find((a) =>
            a.type?.startsWith("video/") ||
            ["mp4", "mov", "avi", "webm", "mkv", "m4v"].includes(
              a.url.split(".").pop()?.split("?")[0]?.toLowerCase() ?? "",
            ),
          );
          await internalPost("/api/leadgen/process-footage", {
            lead_id: pipelineLead.id,
            owner_id: pipelineLead.owner_id,
            footage_url: videoAttachment?.url || "",
            brief: messageText || "Additional footage for current edit",
            attachments: msgAttachments,
          });
        } else {
          await zernioDM({
            platform: channel,
            handle: senderHandle,
            message: "Your edit is in progress! I'll send it over as soon as it's ready. If you have any specific requests, just let me know here.",
          });
        }
      }

      // ── Content Ready stage: waiting for client approval ──────────────
      else if (stage === "content_ready" && messageText) {
        const lower = messageText.toLowerCase();
        const isApproval = /\b(looks? great|approved?|perfect|love it|ship it|go ahead|yes|send it|publish)\b/i.test(lower);
        const isRevision = /\b(change|fix|redo|revise|update|adjust|modify|different|wrong|not right)\b/i.test(lower);

        if (isApproval) {
          await internalPost("/api/leadgen/deliver", {
            lead_id: pipelineLead.id,
            owner_id: pipelineLead.owner_id,
          });
        } else if (isRevision) {
          await supabase
            .from("lead_pipeline")
            .update({ stage: "editing" })
            .eq("id", pipelineLead.id);
          await zernioDM({
            platform: channel,
            handle: senderHandle,
            message: "No problem! I'll make those changes. Can you be specific about what you'd like adjusted?",
          });
        } else {
          await zernioDM({
            platform: channel,
            handle: senderHandle,
            message: "Thanks for the feedback! Want me to go ahead and send the final version, or would you like any changes?",
          });
        }
      }

      // ── Delivered stage: revision requests or new project ──────────────
      else if (stage === "delivered" && messageText) {
        const hasVideo = msgAttachments.some((a) =>
          a.type?.startsWith("video/") ||
          ["mp4", "mov", "avi", "webm", "mkv", "m4v"].includes(
            a.url.split(".").pop()?.split("?")[0]?.toLowerCase() ?? "",
          ),
        );

        if (hasVideo) {
          const videoAttachment = msgAttachments.find((a) =>
            a.type?.startsWith("video/") ||
            ["mp4", "mov", "avi", "webm", "mkv", "m4v"].includes(
              a.url.split(".").pop()?.split("?")[0]?.toLowerCase() ?? "",
            ),
          );
          await supabase
            .from("lead_pipeline")
            .update({ stage: "scripting" })
            .eq("id", pipelineLead.id);
          await internalPost("/api/leadgen/process-footage", {
            lead_id: pipelineLead.id,
            owner_id: pipelineLead.owner_id,
            footage_url: videoAttachment?.url || "",
            brief: messageText || "New footage for next edit",
            attachments: msgAttachments,
          });
        } else {
          const qualifyResult = await internalPost("/api/leadgen/qualify", {
            lead_id: pipelineLead.id,
            message: messageText,
          });
          if (!qualifyResult.ok) {
            console.error("[zernio-webhook] post-delivery qualify failed:", qualifyResult.data);
          }
        }
      }
    }
  }

  return NextResponse.json({ ok: true, event_id: webhook.id });
}
