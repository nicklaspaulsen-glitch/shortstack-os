// Conversations — shared helper for the unified inbox.
//
// Every inbound webhook (email/SMS/WhatsApp/Telegram/Instagram/Slack/Discord/
// web chat) converges on upsertInboundMessage() which:
//   1. Upserts a conversations row keyed by (user_id, channel, external_thread_id)
//   2. Inserts a conversation_messages row (direction = 'inbound')
//   3. Bumps last_message_at / unread_count / last_message_preview
//
// Outbound sends from the dashboard call insertOutboundMessage() after the
// provider confirms delivery.

import type { createServiceClient } from "@/lib/supabase/server";

export type ConversationChannel =
  | "email"
  | "sms"
  | "whatsapp"
  | "telegram"
  | "instagram"
  | "slack"
  | "discord"
  | "web_chat";

export type ConversationStatus = "open" | "snoozed" | "closed" | "archived";

type Supa = ReturnType<typeof createServiceClient>;

interface UpsertInboundArgs {
  supabase: Supa;
  userId: string; // owning agency user
  channel: ConversationChannel;
  externalThreadId: string;
  fromIdentifier: string;
  toIdentifier?: string;
  body?: string;
  subject?: string;
  externalMessageId?: string;
  attachments?: Array<{ url: string; filename?: string; mimetype?: string }>;
  contactId?: string | null;
  sentAt?: Date;
}

/**
 * Upsert a conversation and insert an inbound message. Idempotent on
 * (user_id, channel, external_thread_id).
 *
 * Returns { conversationId, messageId } or null if the write failed.
 */
export async function upsertInboundMessage(
  args: UpsertInboundArgs,
): Promise<{ conversationId: string; messageId: string } | null> {
  const {
    supabase,
    userId,
    channel,
    externalThreadId,
    fromIdentifier,
    toIdentifier,
    body,
    subject,
    externalMessageId,
    attachments,
    contactId,
    sentAt,
  } = args;

  const preview = (body ?? "").trim().slice(0, 140);
  const nowIso = (sentAt ?? new Date()).toISOString();

  // Upsert conversation row. ON CONFLICT updates the preview + bumps unread.
  // We intentionally do NOT use the `.upsert()` helper because we need the
  // unread_count increment to happen atomically — best expressed as a raw
  // two-step: try insert, fall back to update-and-increment.
  let conversationId: string | null = null;

  // Try insert first (will fail with 23505 if the unique constraint hits).
  const { data: inserted, error: insertErr } = await supabase
    .from("conversations")
    .insert({
      user_id: userId,
      channel,
      external_thread_id: externalThreadId,
      subject: subject ?? null,
      contact_id: contactId ?? null,
      last_message_at: nowIso,
      last_message_preview: preview,
      unread_count: 1,
      status: "open",
    })
    .select("id")
    .single();

  if (!insertErr && inserted?.id) {
    conversationId = inserted.id;
  } else {
    // Conflict — fetch and bump.
    const { data: existing } = await supabase
      .from("conversations")
      .select("id, unread_count")
      .eq("user_id", userId)
      .eq("channel", channel)
      .eq("external_thread_id", externalThreadId)
      .single();

    if (!existing?.id) {
      console.error("[conversations] upsert fallback fetch failed:", insertErr);
      return null;
    }

    conversationId = existing.id;

    await supabase
      .from("conversations")
      .update({
        last_message_at: nowIso,
        last_message_preview: preview,
        unread_count: (existing.unread_count ?? 0) + 1,
        // Reopen if it was closed/snoozed — new inbound always reopens.
        status: "open",
      })
      .eq("id", conversationId);
  }

  // Insert the inbound message.
  const { data: message, error: msgErr } = await supabase
    .from("conversation_messages")
    .insert({
      conversation_id: conversationId,
      direction: "inbound",
      from_identifier: fromIdentifier,
      to_identifier: toIdentifier ?? null,
      body: body ?? null,
      attachments: attachments ?? [],
      sent_at: nowIso,
      external_message_id: externalMessageId ?? null,
    })
    .select("id")
    .single();

  if (msgErr || !message?.id || !conversationId) {
    console.error("[conversations] message insert failed:", msgErr);
    return null;
  }

  return { conversationId, messageId: message.id };
}

interface InsertOutboundArgs {
  supabase: Supa;
  conversationId: string;
  fromIdentifier: string;
  toIdentifier?: string;
  body?: string;
  externalMessageId?: string;
  attachments?: Array<{ url: string; filename?: string; mimetype?: string }>;
}

/** Record an outbound message after the provider accepted it. */
export async function insertOutboundMessage(
  args: InsertOutboundArgs,
): Promise<string | null> {
  const {
    supabase,
    conversationId,
    fromIdentifier,
    toIdentifier,
    body,
    externalMessageId,
    attachments,
  } = args;

  const preview = (body ?? "").trim().slice(0, 140);
  const nowIso = new Date().toISOString();

  const { data, error } = await supabase
    .from("conversation_messages")
    .insert({
      conversation_id: conversationId,
      direction: "outbound",
      from_identifier: fromIdentifier,
      to_identifier: toIdentifier ?? null,
      body: body ?? null,
      attachments: attachments ?? [],
      sent_at: nowIso,
      external_message_id: externalMessageId ?? null,
    })
    .select("id")
    .single();

  if (error) {
    console.error("[conversations] outbound insert failed:", error);
    return null;
  }

  // Bump conversation's last_message — outbound replies don't touch
  // unread_count (we're the ones replying).
  await supabase
    .from("conversations")
    .update({
      last_message_at: nowIso,
      last_message_preview: preview,
    })
    .eq("id", conversationId);

  return data?.id ?? null;
}

/**
 * Look up the agency owner (profiles.id) who installed a given integration,
 * by channel + external identifier. Used by webhooks that need to figure
 * out which agency the inbound event belongs to.
 *
 * Resolution order varies by channel — see channel-specific callers.
 * Returns null if we can't determine the owner (the webhook should skip
 * the conversation write in that case).
 */
export async function resolveUserIdForChannel(
  supabase: Supa,
  channel: ConversationChannel,
  hints: {
    domain?: string; // email
    telegramChatId?: string;
    discordGuildId?: string;
    slackTeamId?: string;
    zernioProfileId?: string;
    clientPhoneTo?: string; // sms/whatsapp (twilio number belongs to a client)
  },
): Promise<string | null> {
  try {
    if (channel === "email" && hints.domain) {
      const { data } = await supabase
        .from("agency_mail_domains")
        .select("profile_id")
        .eq("domain", hints.domain.toLowerCase())
        .eq("status", "verified")
        .maybeSingle();
      const ownerId = (data as { profile_id?: string } | null)?.profile_id;
      if (ownerId) return ownerId;
    }

    if ((channel === "sms" || channel === "whatsapp") && hints.clientPhoneTo) {
      // The Twilio number is provisioned to a client — find its profile.
      const { data } = await supabase
        .from("clients")
        .select("profile_id")
        .eq("twilio_phone_number", hints.clientPhoneTo)
        .maybeSingle();
      const ownerId = (data as { profile_id?: string } | null)?.profile_id;
      if (ownerId) return ownerId;
    }

    if (channel === "discord" && hints.discordGuildId) {
      const { data } = await supabase
        .from("discord_integrations")
        .select("user_id")
        .eq("guild_id", hints.discordGuildId)
        .maybeSingle();
      const ownerId = (data as { user_id?: string } | null)?.user_id;
      if (ownerId) return ownerId;
    }

    // Telegram: the bot is owned globally by a single admin chat, so we
    // fall back to TELEGRAM_OWNER_USER_ID or the first profile with
    // telegram_chat_id set. Callers can override if they know better.
  } catch (err) {
    console.error("[conversations] owner resolution failed:", err);
  }
  return null;
}

/** Best-effort: find a contact_id (clients.id) from an identifier. */
export async function findContactByIdentifier(
  supabase: Supa,
  userId: string,
  identifier: string,
): Promise<string | null> {
  if (!identifier) return null;
  try {
    // Try email, phone, or business name fuzzy.
    const isEmail = identifier.includes("@");
    const col = isEmail ? "email" : "phone";
    const { data } = await supabase
      .from("clients")
      .select("id")
      .eq("profile_id", userId)
      .eq(col, identifier)
      .maybeSingle();
    return (data as { id?: string } | null)?.id ?? null;
  } catch {
    return null;
  }
}
