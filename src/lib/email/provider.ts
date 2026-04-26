/**
 * Email provider abstraction — types and the contract every backend must
 * implement. The router (`./index.ts`) chooses one of these implementations
 * at runtime based on the `EMAIL_PROVIDER` env var, with a deterministic
 * fallback chain when the chosen provider isn't configured.
 *
 * Goal: keep Resend as the default, but let a self-hosted Postal instance
 * (or any generic SMTP relay) replace it via a single env-var flip — no
 * code changes needed once the backend is provisioned.
 *
 * See `docs/SELF_HOSTED_SMTP_POSTAL.md` for the operational runbook.
 */
export type EmailProvider = "resend" | "postal" | "smtp_generic";

/**
 * A single email message in normalized form. Each provider implementation
 * adapts this shape to its own wire format.
 *
 * Notes on optionality:
 * - `from` falls back to `SMTP_FROM` (or each provider's own default) when
 *   omitted — most callers don't override this.
 * - `tags` are best-effort. Resend supports them natively; SMTP-based
 *   providers serialize them into custom `X-` headers so downstream
 *   webhooks can still filter on them.
 */
export interface EmailMessage {
  to: string | string[];
  from?: string;
  subject: string;
  html?: string;
  text?: string;
  replyTo?: string;
  /**
   * Free-form key/value tags for tracking + webhook routing. Resend supports
   * these natively as `[{name, value}]`; SMTP providers serialize them as
   * `X-Tag-<name>: <value>` headers.
   */
  tags?: Record<string, string>;
  attachments?: Array<{
    filename: string;
    /** Either a Buffer (preferred) or base64-encoded string. */
    content: Buffer | string;
  }>;
}

/**
 * Result returned by every provider on a successful send. `messageId` is
 * whatever stable identifier the backend gave us — Resend returns its
 * email id, Postal returns the message id, nodemailer returns the SMTP
 * message id with envelope brackets stripped.
 */
export interface EmailSendResult {
  messageId: string;
  provider: EmailProvider;
}

/**
 * Provider implementation contract. Three rules every implementation must
 * obey:
 *   1. `available()` is cheap and synchronous — it only checks env-var
 *      presence. It must NOT make a network call.
 *   2. `send()` throws on failure (does NOT return a "false" sentinel).
 *      Callers wrap in try/catch when they need fallback behavior.
 *   3. `name` matches the value used in the `EMAIL_PROVIDER` env var.
 */
export interface EmailProviderImpl {
  name: EmailProvider;
  send(msg: EmailMessage): Promise<EmailSendResult>;
  available(): boolean;
}
