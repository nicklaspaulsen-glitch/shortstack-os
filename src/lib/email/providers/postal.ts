/**
 * Postal provider — connects to a self-hosted Postal instance via its HTTP
 * API. Postal is an open-source mail server (https://postalserver.io) that
 * we recommend running on Hetzner CX21 (~€6/mo) once outbound email volume
 * reaches the level where Resend's per-email pricing becomes meaningful.
 *
 * API endpoint (Postal v2):
 *   POST {POSTAL_API_URL}/api/v1/send/message
 *   Header: X-Server-API-Key: <POSTAL_API_KEY>
 *
 * Reference:
 *   https://github.com/postalserver/postal/blob/main/doc/api.md
 *
 * Postal's success response shape:
 *   { status: "success", time: 0.5, data: { message_id: "...", messages: { ... } } }
 *
 * Error shape:
 *   { status: "error", time: ..., data: { code: "...", message: "..." } }
 */
import type {
  EmailMessage,
  EmailProviderImpl,
  EmailSendResult,
} from "../provider";

const SEND_PATH = "/api/v1/send/message";
const DEFAULT_FROM = "growth@mail.shortstack.work";

function resolveConfig(): { url: string; key: string } | null {
  const url = process.env.POSTAL_API_URL;
  const key = process.env.POSTAL_API_KEY;
  if (!url || !key) return null;
  // Strip trailing slash so the joined URL is always well-formed.
  return { url: url.replace(/\/+$/, ""), key };
}

function toRecipientArray(to: string | string[]): string[] {
  return Array.isArray(to) ? to : [to];
}

interface PostalAttachment {
  name: string;
  // Postal expects base64-encoded content + content_type.
  content_type: string;
  data: string;
}

function guessContentType(filename: string): string {
  const ext = filename.toLowerCase().split(".").pop();
  switch (ext) {
    case "pdf": return "application/pdf";
    case "png": return "image/png";
    case "jpg":
    case "jpeg": return "image/jpeg";
    case "html": return "text/html";
    case "txt": return "text/plain";
    case "csv": return "text/csv";
    case "json": return "application/json";
    default: return "application/octet-stream";
  }
}

function normalizeAttachments(
  attachments: EmailMessage["attachments"],
): PostalAttachment[] | undefined {
  if (!attachments || attachments.length === 0) return undefined;
  return attachments.map(a => ({
    name: a.filename,
    content_type: guessContentType(a.filename),
    data:
      Buffer.isBuffer(a.content)
        ? a.content.toString("base64")
        : a.content,
  }));
}

/**
 * Postal doesn't have a first-class "tags" concept on send — but it passes
 * through custom headers. Serialize tags as `X-Tag-<name>` so downstream
 * webhook consumers (or Postal's own click-tracking) can filter on them.
 */
function tagsToHeaders(
  tags: Record<string, string> | undefined,
): Record<string, string> | undefined {
  if (!tags) return undefined;
  const entries = Object.entries(tags);
  if (entries.length === 0) return undefined;
  const headers: Record<string, string> = {};
  for (const [name, value] of entries) {
    // Whitelist the header name to ASCII letters/digits/dash to avoid header
    // injection from caller-supplied tag keys.
    const safeName = name.replace(/[^A-Za-z0-9-]/g, "-");
    headers[`X-Tag-${safeName}`] = String(value).slice(0, 256);
  }
  return headers;
}

interface PostalSuccessBody {
  status: "success";
  time?: number;
  data?: {
    message_id?: string;
    messages?: Record<string, { id?: number; token?: string }>;
  };
}

interface PostalErrorBody {
  status: "error" | "parameter-error";
  time?: number;
  data?: { code?: string; message?: string };
}

type PostalBody = PostalSuccessBody | PostalErrorBody;

export const postalProvider: EmailProviderImpl = {
  name: "postal",

  available(): boolean {
    return resolveConfig() !== null;
  },

  async send(msg: EmailMessage): Promise<EmailSendResult> {
    const cfg = resolveConfig();
    if (!cfg) {
      throw new Error(
        "[email/postal] not configured (set POSTAL_API_URL + POSTAL_API_KEY)",
      );
    }

    const from = msg.from || process.env.SMTP_FROM || DEFAULT_FROM;

    const body: Record<string, unknown> = {
      from,
      to: toRecipientArray(msg.to),
      subject: msg.subject,
    };
    if (msg.html) body.html_body = msg.html;
    if (msg.text) body.plain_body = msg.text;
    if (msg.replyTo) body.reply_to = msg.replyTo;
    const headers = tagsToHeaders(msg.tags);
    if (headers) body.headers = headers;
    const atts = normalizeAttachments(msg.attachments);
    if (atts) body.attachments = atts;

    const res = await fetch(`${cfg.url}${SEND_PATH}`, {
      method: "POST",
      headers: {
        "X-Server-API-Key": cfg.key,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(body),
    });

    // Postal returns 200 even for application-level errors — the actual
    // outcome lives in the JSON body's `status` field. So we always parse
    // the body before deciding whether to throw.
    let parsed: PostalBody | null = null;
    try {
      parsed = (await res.json()) as PostalBody;
    } catch {
      throw new Error(
        `[email/postal] non-JSON response (HTTP ${res.status})`,
      );
    }

    if (!res.ok || !parsed || parsed.status !== "success") {
      const err = parsed && parsed.status !== "success" ? parsed.data : null;
      const code = err?.code || "unknown";
      const message = err?.message || `HTTP ${res.status}`;
      throw new Error(`[email/postal] ${code}: ${message}`);
    }

    const messageId = parsed.data?.message_id || "";
    return { messageId, provider: "postal" };
  },
};
