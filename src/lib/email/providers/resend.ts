/**
 * Resend provider — wraps the Resend HTTP API (`POST /emails`).
 *
 * Uses fetch directly (no SDK) to stay consistent with the existing direct
 * fetch usage in `api/emails/send/route.ts` and `api/reports/pdf/route.ts`.
 * Both `SMTP_PASS` and `RESEND_API_KEY` are accepted — historically the
 * project has reused `SMTP_PASS` as the Resend API key (see ENV_CHECKLIST).
 */
import type {
  EmailMessage,
  EmailProviderImpl,
  EmailSendResult,
} from "../provider";

const RESEND_ENDPOINT = "https://api.resend.com/emails";
const DEFAULT_FROM = "growth@mail.shortstack.work";

function resolveKey(): string | null {
  // SMTP_PASS comes first because that's the order the rest of the codebase
  // checks — keeping the contract identical avoids surprise behavior swaps
  // when a developer rotates one but not the other.
  return process.env.SMTP_PASS || process.env.RESEND_API_KEY || null;
}

function toRecipientArray(to: string | string[]): string[] {
  return Array.isArray(to) ? to : [to];
}

function tagsToResendArray(
  tags: Record<string, string> | undefined,
): Array<{ name: string; value: string }> | undefined {
  if (!tags) return undefined;
  const entries = Object.entries(tags);
  if (entries.length === 0) return undefined;
  // Resend caps tag value lengths around 256 chars; trim defensively.
  return entries.map(([name, value]) => ({
    name,
    value: String(value).slice(0, 256),
  }));
}

interface ResendAttachment {
  filename: string;
  content: string;
}

function normalizeAttachments(
  attachments: EmailMessage["attachments"],
): ResendAttachment[] | undefined {
  if (!attachments || attachments.length === 0) return undefined;
  return attachments.map(a => ({
    filename: a.filename,
    content:
      Buffer.isBuffer(a.content)
        ? a.content.toString("base64")
        : a.content,
  }));
}

export const resendProvider: EmailProviderImpl = {
  name: "resend",

  available(): boolean {
    return Boolean(resolveKey());
  },

  async send(msg: EmailMessage): Promise<EmailSendResult> {
    const key = resolveKey();
    if (!key) {
      throw new Error("[email/resend] no API key (set SMTP_PASS or RESEND_API_KEY)");
    }

    const from = msg.from || process.env.SMTP_FROM || DEFAULT_FROM;

    const body: Record<string, unknown> = {
      from,
      to: toRecipientArray(msg.to),
      subject: msg.subject,
    };
    if (msg.html) body.html = msg.html;
    if (msg.text) body.text = msg.text;
    if (msg.replyTo) body.reply_to = msg.replyTo;
    const tagArr = tagsToResendArray(msg.tags);
    if (tagArr) body.tags = tagArr;
    const atts = normalizeAttachments(msg.attachments);
    if (atts) body.attachments = atts;

    const res = await fetch(RESEND_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const errBody = await res.text().catch(() => "");
      throw new Error(
        `[email/resend] HTTP ${res.status}: ${errBody.slice(0, 200) || "send failed"}`,
      );
    }

    let messageId = "";
    try {
      const json = (await res.json()) as { id?: string };
      messageId = typeof json?.id === "string" ? json.id : "";
    } catch {
      // Resend always returns JSON on 2xx; if parsing fails we still
      // succeeded the network call, so just return an empty messageId.
      messageId = "";
    }

    return { messageId, provider: "resend" };
  },
};
