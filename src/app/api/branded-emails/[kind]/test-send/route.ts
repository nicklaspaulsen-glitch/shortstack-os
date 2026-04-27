/**
 * POST /api/branded-emails/[kind]/test-send
 *
 * Sends a test render of the given template to the caller's own email
 * address. Uses sample variables (NOT real client data) so no PII leaks.
 *
 * Optional body fields:
 *   - subject, html_body, plain_body — render an UNSAVED draft instead of
 *     the persisted template. Lets the editor "send a test" before the
 *     user clicks Save.
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createServerSupabase } from "@/lib/supabase/server";
import { getEffectiveOwnerId } from "@/lib/security/require-owned-client";
import { loadTemplate } from "@/lib/email-templates/loader";
import { sendMessage } from "@/lib/email";
import { resolveTemplateVars, renderTemplate } from "@/lib/email-templates/variables";
import { ALL_EMAIL_TEMPLATE_KINDS, EmailTemplateKind } from "@/lib/email-templates/types";

const VALID_KINDS = new Set<EmailTemplateKind>(ALL_EMAIL_TEMPLATE_KINDS);

const draftSchema = z.object({
  subject: z.string().min(1).max(200).optional(),
  html_body: z.string().min(1).max(50_000).optional(),
  plain_body: z.string().min(1).max(20_000).optional(),
  preview_text: z.string().max(200).nullable().optional(),
  cta_label: z.string().max(80).nullable().optional(),
  cta_url_template: z.string().max(500).nullable().optional(),
});

const DEFAULT_FROM_EMAIL = process.env.SMTP_FROM || "growth@mail.shortstack.work";

export async function POST(
  req: NextRequest,
  { params }: { params: { kind: string } },
) {
  const kind = (VALID_KINDS.has(params.kind as EmailTemplateKind)
    ? (params.kind as EmailTemplateKind)
    : null);
  if (!kind) {
    return NextResponse.json({ error: "Invalid template kind" }, { status: 400 });
  }

  const supabase = createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || !user.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const ownerId = await getEffectiveOwnerId(supabase, user.id);
  if (!ownerId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  let body: unknown = {};
  try {
    body = (await req.json().catch(() => ({}))) || {};
  } catch {
    body = {};
  }

  const parsed = draftSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  // Resolve the template — load saved version, then overlay any draft fields
  // the caller passed in (so the editor can "test send" without hitting Save).
  const saved = await loadTemplate(supabase, ownerId, kind);
  const subject = parsed.data.subject ?? saved.subject;
  const htmlBody = parsed.data.html_body ?? saved.html_body;
  const plainBody = parsed.data.plain_body ?? saved.plain_body;
  const previewText = parsed.data.preview_text ?? saved.preview_text ?? "";
  const ctaLabel = parsed.data.cta_label ?? saved.cta_label ?? "";
  const ctaUrl = parsed.data.cta_url_template ?? saved.cta_url_template ?? "";

  const vars = await resolveTemplateVars(supabase, { agency_owner_id: ownerId });

  // Inject CTA + preview into vars so the body templates can also use them.
  const fullVars = {
    ...vars,
    cta_label: renderTemplate(ctaLabel, vars),
    cta_url: renderTemplate(ctaUrl, vars),
    preview_text: renderTemplate(previewText, vars),
    __subject__: renderTemplate(subject, vars),
  };

  const renderedSubject = renderTemplate(subject, vars);
  const renderedHtml = renderTemplate(htmlBody, fullVars);
  const renderedText = renderTemplate(plainBody, fullVars);

  const agencyName = vars.agency_name || "Your Agency";

  try {
    const result = await sendMessage({
      to: user.email,
      from: `${agencyName} (test) <${DEFAULT_FROM_EMAIL}>`,
      subject: `[TEST] ${renderedSubject}`,
      html: renderedHtml,
      text: renderedText,
      replyTo: user.email,
    });
    return NextResponse.json({
      ok: true,
      to: user.email,
      messageId: result.messageId,
      provider: result.provider,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[branded-emails/test-send] failed:", msg);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
