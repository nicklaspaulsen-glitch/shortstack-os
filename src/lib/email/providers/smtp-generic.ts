/**
 * Generic SMTP provider — nodemailer-backed escape hatch that talks to any
 * SMTP relay. Used in two scenarios:
 *
 *   1. As a fallback when the primary HTTP-based provider (Resend / Postal)
 *      is unavailable but SMTP credentials are present.
 *   2. As a deliberate choice (`EMAIL_PROVIDER=smtp_generic`) when running
 *      Postal in SMTP-relay-only mode, or when pointing at a third-party
 *      transactional relay (Mailgun SMTP, SES SMTP, Postmark, etc.).
 *
 * Reads the existing `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`,
 * `SMTP_FROM` env vars that are already wired in Vercel.
 */
import nodemailer from "nodemailer";
import type {
  EmailMessage,
  EmailProviderImpl,
  EmailSendResult,
} from "../provider";

const DEFAULT_FROM = "growth@mail.shortstack.work";

interface SmtpConfig {
  host: string;
  port: number;
  user: string;
  pass: string;
}

function resolveConfig(): SmtpConfig | null {
  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  if (!host || !user || !pass) return null;
  const port = Number(process.env.SMTP_PORT) || 587;
  return { host, port, user, pass };
}

function toRecipientList(to: string | string[]): string {
  // nodemailer accepts a comma-separated list — join when given an array.
  return Array.isArray(to) ? to.join(", ") : to;
}

function tagsToHeaders(
  tags: Record<string, string> | undefined,
): Record<string, string> | undefined {
  if (!tags) return undefined;
  const entries = Object.entries(tags);
  if (entries.length === 0) return undefined;
  const headers: Record<string, string> = {};
  for (const [name, value] of entries) {
    // Whitelist header name characters to defeat injection via a
    // caller-supplied tag key (newlines etc).
    const safeName = name.replace(/[^A-Za-z0-9-]/g, "-");
    headers[`X-Tag-${safeName}`] = String(value).slice(0, 256);
  }
  return headers;
}

interface NodemailerAttachment {
  filename: string;
  content: Buffer | string;
  encoding?: string;
}

function normalizeAttachments(
  attachments: EmailMessage["attachments"],
): NodemailerAttachment[] | undefined {
  if (!attachments || attachments.length === 0) return undefined;
  return attachments.map(a => {
    if (Buffer.isBuffer(a.content)) {
      return { filename: a.filename, content: a.content };
    }
    // Treat a string as base64 (matches how the rest of the codebase
    // stuffs PDFs into email attachments — see api/reports/pdf).
    return {
      filename: a.filename,
      content: a.content,
      encoding: "base64",
    };
  });
}

/**
 * nodemailer transports are reused across calls — creating one per call is
 * wasteful and connection-throttles under bursty workloads. We cache the
 * transport based on the resolved config so a credential rotation creates a
 * fresh transport on the next send.
 */
let cachedTransport: {
  key: string;
  transport: nodemailer.Transporter;
} | null = null;

function getTransport(cfg: SmtpConfig): nodemailer.Transporter {
  const key = `${cfg.host}:${cfg.port}:${cfg.user}:${cfg.pass.slice(0, 8)}`;
  if (cachedTransport && cachedTransport.key === key) {
    return cachedTransport.transport;
  }
  const transport = nodemailer.createTransport({
    host: cfg.host,
    port: cfg.port,
    secure: cfg.port === 465,
    auth: { user: cfg.user, pass: cfg.pass },
  });
  cachedTransport = { key, transport };
  return transport;
}

export const smtpGenericProvider: EmailProviderImpl = {
  name: "smtp_generic",

  available(): boolean {
    return resolveConfig() !== null;
  },

  async send(msg: EmailMessage): Promise<EmailSendResult> {
    const cfg = resolveConfig();
    if (!cfg) {
      throw new Error(
        "[email/smtp_generic] not configured (need SMTP_HOST, SMTP_USER, SMTP_PASS)",
      );
    }

    const transport = getTransport(cfg);
    const from = msg.from || process.env.SMTP_FROM || DEFAULT_FROM;

    const info = await transport.sendMail({
      from,
      to: toRecipientList(msg.to),
      subject: msg.subject,
      html: msg.html,
      text: msg.text,
      replyTo: msg.replyTo,
      headers: tagsToHeaders(msg.tags),
      attachments: normalizeAttachments(msg.attachments),
    });

    // nodemailer returns the raw `<id@host>` form — strip the brackets so
    // it lines up with the bare ids the other providers return.
    const rawId = typeof info?.messageId === "string" ? info.messageId : "";
    const messageId = rawId.replace(/^<|>$/g, "");

    return { messageId, provider: "smtp_generic" };
  },
};
