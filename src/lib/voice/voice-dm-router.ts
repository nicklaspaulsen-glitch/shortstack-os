/**
 * Voice DM router — abstraction over per-platform direct-message voice
 * delivery. Implementations:
 *   instagram → Meta Graph API conversations endpoint (audio attachment)
 *   telegram  → Bot API sendVoice (best-effort fallback to sendAudio)
 *   whatsapp  → stubbed; requires WA Business approved templates
 *   linkedin  → not supported (no voice DM API)
 *   facebook  → Meta Graph (Messenger) — same shape as instagram
 *
 * Caller pre-renders the audio (via /api/voice/synthesize) and passes the
 * R2-hosted URL. We never round-trip large audio through Vercel.
 *
 * Live integrations are wired with whatever creds the user already has:
 *   META_PAGE_TOKEN     — Facebook + Instagram Graph
 *   IG_USER_ID          — Instagram business account id
 *   TELEGRAM_BOT_TOKEN  — Telegram Bot API
 *
 * If creds are missing we return queued=true so the route can persist a
 * record in outreach_log for later replay (mirrors /api/dm/send-manual).
 */

export type VoiceDmPlatform =
  | "instagram"
  | "facebook"
  | "telegram"
  | "whatsapp"
  | "linkedin"
  | "twitter"
  | "tiktok"
  | "x";

export interface SendVoiceDmOptions {
  platform: VoiceDmPlatform;
  /** Recipient handle / id (platform-dependent format). */
  recipient: string;
  /** Public CDN URL for the rendered audio (R2). */
  audioUrl: string;
  /** Caption shown alongside the voice note (Telegram supports it). */
  caption?: string;
}

export interface SendVoiceDmResult {
  ok: boolean;
  /** Provider-side message id, when available. */
  messageId?: string;
  /** True when the DM was queued (creds missing) instead of sent. */
  queued?: boolean;
  /** Why a send failed, when it did. */
  reason?: string;
  /** True for platforms that don't support voice DM. */
  unsupported?: boolean;
}

/**
 * Route to the right implementation. Always returns a structured result —
 * callers should never rely on exceptions for control flow.
 */
export async function sendVoiceDm(
  opts: SendVoiceDmOptions,
): Promise<SendVoiceDmResult> {
  switch (opts.platform) {
    case "instagram":
    case "facebook":
      return sendMetaVoice(opts);
    case "telegram":
      return sendTelegramVoice(opts);
    case "whatsapp":
      return {
        ok: false,
        unsupported: true,
        reason:
          "WhatsApp voice DM requires an approved Business Template — defer to v2.",
      };
    case "linkedin":
      return {
        ok: false,
        unsupported: true,
        reason: "LinkedIn does not support voice DMs in their messaging API.",
      };
    case "twitter":
    case "x":
    case "tiktok":
      return {
        ok: false,
        unsupported: true,
        reason: `${opts.platform} does not expose a voice DM API.`,
      };
    default:
      return { ok: false, reason: `Unknown platform '${opts.platform}'.` };
  }
}

async function sendMetaVoice(
  opts: SendVoiceDmOptions,
): Promise<SendVoiceDmResult> {
  const token = process.env.META_PAGE_TOKEN || process.env.META_ACCESS_TOKEN;
  const igUserId = process.env.IG_USER_ID;

  if (!token) {
    return {
      ok: false,
      queued: true,
      reason: "META_PAGE_TOKEN not configured — DM queued in outreach_log.",
    };
  }
  if (opts.platform === "instagram" && !igUserId) {
    return {
      ok: false,
      queued: true,
      reason: "IG_USER_ID not configured — DM queued in outreach_log.",
    };
  }

  // Send via Meta Conversations endpoint. The exact path differs slightly
  // for Facebook Messenger vs Instagram. We use the unified /me/messages
  // endpoint which supports both when the page token has the right scopes.
  const apiPath = igUserId
    ? `https://graph.facebook.com/v20.0/${igUserId}/messages`
    : `https://graph.facebook.com/v20.0/me/messages`;

  try {
    const res = await fetch(`${apiPath}?access_token=${encodeURIComponent(token)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        recipient: { id: opts.recipient },
        message: {
          attachment: {
            type: "audio",
            payload: { url: opts.audioUrl, is_reusable: false },
          },
        },
        messaging_type: "MESSAGE_TAG",
        tag: "ACCOUNT_UPDATE",
      }),
      signal: AbortSignal.timeout(15_000),
    });
    const json = (await res.json().catch(() => ({}))) as {
      message_id?: string;
      error?: { message?: string };
    };
    if (!res.ok) {
      return {
        ok: false,
        reason: json.error?.message || `Meta error ${res.status}`,
      };
    }
    return { ok: true, messageId: json.message_id };
  } catch (err) {
    return {
      ok: false,
      reason: err instanceof Error ? err.message : "fetch_error",
    };
  }
}

async function sendTelegramVoice(
  opts: SendVoiceDmOptions,
): Promise<SendVoiceDmResult> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    return {
      ok: false,
      queued: true,
      reason: "TELEGRAM_BOT_TOKEN not configured — DM queued in outreach_log.",
    };
  }
  // Telegram's sendVoice expects an OGG/Opus URL but accepts MP3 via
  // sendAudio. We try sendVoice first, then fall back to sendAudio if the
  // bot rejects MP3.
  const baseUrl = `https://api.telegram.org/bot${token}`;
  const payload: Record<string, unknown> = {
    chat_id: opts.recipient,
    voice: opts.audioUrl,
  };
  if (opts.caption) payload.caption = opts.caption.slice(0, 1024);

  try {
    const voiceRes = await fetch(`${baseUrl}/sendVoice`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(15_000),
    });
    const voiceJson = (await voiceRes.json().catch(() => ({}))) as {
      ok?: boolean;
      result?: { message_id?: number };
      description?: string;
    };
    if (voiceRes.ok && voiceJson.ok && voiceJson.result?.message_id) {
      return {
        ok: true,
        messageId: String(voiceJson.result.message_id),
      };
    }
    // Fall back to sendAudio for non-OGG sources.
    const audioPayload: Record<string, unknown> = {
      chat_id: opts.recipient,
      audio: opts.audioUrl,
    };
    if (opts.caption) audioPayload.caption = opts.caption.slice(0, 1024);
    const audioRes = await fetch(`${baseUrl}/sendAudio`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(audioPayload),
      signal: AbortSignal.timeout(15_000),
    });
    const audioJson = (await audioRes.json().catch(() => ({}))) as {
      ok?: boolean;
      result?: { message_id?: number };
      description?: string;
    };
    if (audioRes.ok && audioJson.ok && audioJson.result?.message_id) {
      return {
        ok: true,
        messageId: String(audioJson.result.message_id),
      };
    }
    return {
      ok: false,
      reason:
        audioJson.description || voiceJson.description || "telegram_unknown",
    };
  } catch (err) {
    return {
      ok: false,
      reason: err instanceof Error ? err.message : "fetch_error",
    };
  }
}
