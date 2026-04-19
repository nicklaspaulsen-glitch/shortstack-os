/**
 * Discord announcement utility
 *
 * Posts important Trinity events to:
 *   (1) the authenticated user's configured Discord channel via their
 *       discord_integrations row (per-agency channel, set up via OAuth install), and
 *   (2) as a back-compat fallback, ShortStack's own internal channel
 *       (via env DISCORD_INTERNAL_CHANNEL_ID or the legacy hardcoded ID)
 *       so agency-internal ops updates keep flowing.
 *
 * The `postDiscordAnnouncement*` helpers are safe to call with no user context
 * (falls back silently). When a user_id is passed, we look up their
 * discord_integrations row and post there too if notifications are enabled
 * for that event category.
 */

import { BRAND } from "@/lib/brand-config";
import { createServiceClient } from "@/lib/supabase/server";

const DISCORD_API = "https://discord.com/api/v10";

// Legacy ShortStack-internal channel (back-compat). Prefer DISCORD_INTERNAL_CHANNEL_ID env var.
const LEGACY_INTERNAL_CHANNEL = "1492846003580178442";

interface DiscordField {
  name: string;
  value: string;
  inline?: boolean;
}

/** Event category keys that match `discord_integrations.notify_on` JSONB. */
export type NotifyCategory =
  | "new_client"
  | "new_lead"
  | "milestone"
  | "workflow_complete"
  | "payment_received"
  | "system_alert"
  | "new_feature";

function getInternalChannel(): string | null {
  return process.env.DISCORD_INTERNAL_CHANNEL_ID || LEGACY_INTERNAL_CHANNEL || null;
}

async function sendEmbedToChannel(
  channelId: string,
  token: string,
  embed: Record<string, unknown>
): Promise<boolean> {
  try {
    const res = await fetch(`${DISCORD_API}/channels/${channelId}/messages`, {
      method: "POST",
      headers: {
        Authorization: `Bot ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ embeds: [embed] }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * Core posting function.
 *
 * @param title   Embed title
 * @param description  Embed description
 * @param fields  Optional fields
 * @param color   Embed color (hex int)
 * @param opts.userId      When provided, also posts to that user's connected Discord integration
 * @param opts.category    Event category; only posted to user's Discord if `notify_on[category]` is true
 * @param opts.skipInternal  Skip the legacy ShortStack-internal channel
 */
export async function postDiscordAnnouncement(
  title: string,
  description: string,
  fields?: DiscordField[],
  color?: number,
  opts?: { userId?: string; category?: NotifyCategory; skipInternal?: boolean }
) {
  const token = process.env.DISCORD_BOT_TOKEN;
  if (!token) return null;

  const embed = {
    title,
    description,
    color: color || 0xc9a84c,
    fields: fields || [],
    footer: { text: `${BRAND.product_name} Bot` },
    timestamp: new Date().toISOString(),
  };

  const results: Array<{ target: string; ok: boolean }> = [];

  // (1) Legacy ShortStack-internal channel (back-compat) — opt-in skip
  if (!opts?.skipInternal) {
    const internal = getInternalChannel();
    if (internal) {
      const ok = await sendEmbedToChannel(internal, token, embed);
      results.push({ target: `internal:${internal}`, ok });
    }
  }

  // (2) User's configured channel (silently no-op if not configured)
  if (opts?.userId) {
    try {
      const supabase = createServiceClient();
      const { data: integration } = await supabase
        .from("discord_integrations")
        .select("notify_channel_id, notifications_enabled, notify_on")
        .eq("user_id", opts.userId)
        .eq("notifications_enabled", true)
        .maybeSingle();

      if (integration?.notify_channel_id) {
        const categoryAllowed =
          !opts.category ||
          (integration.notify_on &&
            (integration.notify_on as Record<string, boolean>)[opts.category] !== false);
        if (categoryAllowed) {
          const ok = await sendEmbedToChannel(integration.notify_channel_id, token, embed);
          results.push({ target: `user:${opts.userId}`, ok });
        }
      }
    } catch {
      // Silent — user may not have the integration set up
    }
  }

  return results.length > 0 ? results.every((r) => r.ok) : false;
}

// ---- Pre-built announcement types ----

export async function announceNewClient(
  clientName: string,
  industry?: string,
  userId?: string
) {
  return postDiscordAnnouncement(
    "\uD83C\uDF89 New Client Onboarded!",
    `**${clientName}** just joined ${BRAND.product_name}!${industry ? `\nIndustry: ${industry}` : ""}`,
    undefined,
    0x2ecc71,
    { userId, category: "new_client" }
  );
}

export async function announceNewFeature(
  feature: string,
  description: string,
  userId?: string
) {
  return postDiscordAnnouncement(
    "\uD83D\uDE80 New Feature Launched",
    `**${feature}**\n${description}`,
    undefined,
    0x3498db,
    { userId, category: "new_feature" }
  );
}

export async function announceNewLead(
  count: number,
  source?: string,
  userId?: string
) {
  return postDiscordAnnouncement(
    "\uD83D\uDCCA New Leads Scraped",
    `**${count}** new leads just came in${source ? ` from ${source}` : ""}.`,
    undefined,
    0xf1c40f,
    { userId, category: "new_lead" }
  );
}

export async function announceMilestone(milestone: string, userId?: string) {
  return postDiscordAnnouncement(
    "\uD83C\uDFC6 Milestone Reached!",
    milestone,
    undefined,
    0xc9a84c,
    { userId, category: "milestone" }
  );
}

export async function announceWorkflowComplete(
  workflowName: string,
  summary: string,
  userId?: string
) {
  return postDiscordAnnouncement(
    "\u2705 Workflow Complete",
    `**${workflowName}**\n${summary}`,
    undefined,
    0x2ecc71,
    { userId, category: "workflow_complete" }
  );
}

export async function announcePaymentReceived(
  amount: string,
  clientName: string,
  userId?: string
) {
  return postDiscordAnnouncement(
    "\uD83D\uDCB0 Payment Received",
    `**${amount}** from **${clientName}**`,
    undefined,
    0x2ecc71,
    { userId, category: "payment_received" }
  );
}

export async function announceSystemAlert(
  title: string,
  details: string,
  userId?: string
) {
  return postDiscordAnnouncement(
    `\u26A0\uFE0F ${title}`,
    details,
    undefined,
    0xe74c3c,
    { userId, category: "system_alert" }
  );
}
