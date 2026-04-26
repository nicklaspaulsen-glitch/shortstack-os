/**
 * Marketing-specific Resend helper.
 *
 * Wraps the Resend HTTP API for campaign sends and tags every message with
 * `shortstack_user_id` + `campaign_id` so the existing `/api/webhooks/resend`
 * route can resolve the owning agency and attribute open/click events back
 * to the right campaign + recipient.
 *
 * This intentionally lives separate from `src/lib/email.ts` (which is the
 * SMTP/transactional path) — campaign sends MUST go through Resend HTTP so
 * we can attach campaign-level tags.
 */

interface SendCampaignEmailParams {
  to: string;
  subject: string;
  html: string;
  fromName?: string | null;
  fromEmail?: string | null;
  replyTo?: string | null;
  ownerId: string;
  campaignId: string;
  recipientId: string;
}

export interface SendCampaignEmailResult {
  ok: boolean;
  messageId: string | null;
  error?: string;
}

const DEFAULT_FROM_EMAIL = "growth@mail.shortstack.work";

/**
 * Send a single campaign email via Resend HTTP API. Returns a normalized
 * result object (does NOT throw) so the cron sender can keep iterating
 * over the recipients list even when one address fails.
 */
export async function sendCampaignEmail(
  params: SendCampaignEmailParams,
): Promise<SendCampaignEmailResult> {
  const apiKey = process.env.SMTP_PASS || process.env.RESEND_API_KEY;
  if (!apiKey) {
    return { ok: false, messageId: null, error: "Resend API key not configured" };
  }

  const fromEmail = sanitizeEmail(params.fromEmail) || DEFAULT_FROM_EMAIL;
  const fromDisplay = params.fromName && params.fromName.trim()
    ? `${params.fromName.trim()} <${fromEmail}>`
    : fromEmail;

  const replyTo = sanitizeEmail(params.replyTo);

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: fromDisplay,
        to: [params.to],
        subject: params.subject,
        html: params.html,
        reply_to: replyTo || undefined,
        tags: [
          { name: "shortstack_user_id", value: params.ownerId },
          { name: "campaign_id", value: params.campaignId },
          { name: "recipient_id", value: params.recipientId },
          { name: "source", value: "marketing_campaign" },
        ],
      }),
    });

    if (!res.ok) {
      const errBody = await res.text().catch(() => "");
      return {
        ok: false,
        messageId: null,
        error: `Resend ${res.status}: ${errBody.slice(0, 200) || "send failed"}`,
      };
    }

    const json = (await res.json().catch(() => ({}))) as { id?: string };
    return { ok: true, messageId: typeof json.id === "string" ? json.id : null };
  } catch (err) {
    return {
      ok: false,
      messageId: null,
      error: err instanceof Error ? err.message : "Resend HTTP request failed",
    };
  }
}

function sanitizeEmail(input: string | null | undefined): string | null {
  if (!input || typeof input !== "string") return null;
  const trimmed = input.trim();
  if (!trimmed) return null;
  return /^[^\s@<>,]+@[^\s@<>,]+\.[^\s@<>,]+$/.test(trimmed) ? trimmed : null;
}
