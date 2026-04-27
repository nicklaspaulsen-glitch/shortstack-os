/**
 * High-level "send a branded email" entry point.
 *
 * Resolves the active template + variables for a given (agency, kind,
 * recipient) tuple, renders both bodies, and ships the email through the
 * existing `sendMessage()` provider router. Soft-fails on any error — the
 * caller can fire-and-forget without wrapping in try/catch.
 */

import { createServiceClient } from "@/lib/supabase/server";
import { sendMessage } from "@/lib/email";
import { loadTemplate } from "./loader";
import { resolveTemplateVars, renderTemplate } from "./variables";
import type { EmailTemplateKind } from "./types";

export interface SendBrandedEmailArgs {
  agency_owner_id: string;
  kind: EmailTemplateKind;
  /** Recipient email — required. */
  to: string;
  /** Optional client id (used to resolve client_first_name etc.). */
  client_id?: string;
  /** Optional team-member id (used to resolve team_member_first_name etc.). */
  team_member_id?: string;
  /** Optional one-shot URLs / extra vars (magic_link_url, reset_url, invite_url, ...). */
  extra?: Record<string, string>;
  /** Optional `from` override; defaults to the env-configured shared sender. */
  from?: string;
  /** Reply-to override (e.g. owner email so replies go straight to the agency). */
  replyTo?: string;
}

export interface SendBrandedEmailResult {
  ok: boolean;
  messageId?: string;
  provider?: string;
  error?: string;
}

const DEFAULT_FROM_EMAIL = process.env.SMTP_FROM || "growth@mail.shortstack.work";

/**
 * Send a single branded email. Always resolves — never throws — so callers
 * can fire-and-forget. Returns a structured result for logging.
 */
export async function sendBrandedEmail(
  args: SendBrandedEmailArgs,
): Promise<SendBrandedEmailResult> {
  if (!args.to || typeof args.to !== "string") {
    return { ok: false, error: "Missing 'to' address" };
  }

  try {
    const supabase = createServiceClient();

    const [template, vars] = await Promise.all([
      loadTemplate(supabase, args.agency_owner_id, args.kind),
      resolveTemplateVars(supabase, {
        agency_owner_id: args.agency_owner_id,
        client_id: args.client_id,
        team_member_id: args.team_member_id,
        extra: args.extra,
      }),
    ]);

    // Resolve preview_text from vars too (fed into the hidden inbox-preview span).
    const previewText = renderTemplate(template.preview_text || "", vars);
    const subject = renderTemplate(template.subject, vars);
    const ctaLabel = template.cta_label
      ? renderTemplate(template.cta_label, vars)
      : "";
    const ctaUrl = template.cta_url_template
      ? renderTemplate(template.cta_url_template, vars)
      : "";

    // Inject the resolved CTA fields into vars so the html/plain bodies can
    // reference them via {{cta_label}} / {{cta_url}} too.
    const fullVars = {
      ...vars,
      cta_label: ctaLabel,
      cta_url: ctaUrl,
      preview_text: previewText,
      __subject__: subject,
    };

    const html = renderTemplate(template.html_body, fullVars);
    const text = renderTemplate(template.plain_body, fullVars);

    // Pull the agency's branding so we can stamp the From: name with their
    // brand instead of "Trinity / ShortStack". Reply-to defaults to the
    // owner email so client replies go to the agency, not the platform.
    const agencyName = vars.agency_name || "Your Agency";
    const replyTo = args.replyTo || vars.owner_email || undefined;
    const fromHeader = args.from || `${agencyName} <${DEFAULT_FROM_EMAIL}>`;

    const result = await sendMessage({
      to: args.to,
      from: fromHeader,
      subject,
      html,
      text,
      replyTo,
    });

    return { ok: true, messageId: result.messageId, provider: result.provider };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[email-templates] send failed (kind=${args.kind}):`, msg);
    return { ok: false, error: msg };
  }
}

/**
 * Convenience wrapper for the most common path — fire the branded
 * client_welcome email when an agency owner creates a new client. Used by
 * /api/clients/onboard right after the client row is inserted.
 */
export async function sendBrandedWelcomeEmail(args: {
  agency_owner_id: string;
  client_id: string;
  client_email: string;
}): Promise<SendBrandedEmailResult> {
  return sendBrandedEmail({
    agency_owner_id: args.agency_owner_id,
    kind: "client_welcome",
    to: args.client_email,
    client_id: args.client_id,
  });
}
