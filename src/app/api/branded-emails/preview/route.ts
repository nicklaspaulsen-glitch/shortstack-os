/**
 * POST /api/branded-emails/preview
 *
 * Renders an arbitrary HTML body with the caller's actual branding vars
 * substituted in. Used by the editor's iframe live preview — sent on every
 * keystroke (debounced client-side).
 *
 * Body: { html_body, plain_body?, subject?, preview_text?, cta_label?,
 *         cta_url_template?, sample_kind? }
 *
 * Returns: { html, text, subject, preview_text, vars }
 *
 * No DB writes. Stateless render.
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createServerSupabase } from "@/lib/supabase/server";
import { getEffectiveOwnerId } from "@/lib/security/require-owned-client";
import { resolveTemplateVars, renderTemplate } from "@/lib/email-templates/variables";

const previewSchema = z.object({
  html_body: z.string().max(50_000),
  plain_body: z.string().max(20_000).optional(),
  subject: z.string().max(200).optional(),
  preview_text: z.string().max(200).nullable().optional(),
  cta_label: z.string().max(80).nullable().optional(),
  cta_url_template: z.string().max(500).nullable().optional(),
});

export async function POST(req: NextRequest) {
  const supabase = createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const ownerId = await getEffectiveOwnerId(supabase, user.id);
  if (!ownerId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = previewSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  // Use the caller's REAL agency vars — the preview reflects exactly what
  // a recipient would get. Recipient fields (client_first_name etc.) are
  // populated with friendly placeholders by resolveTemplateVars when no
  // client_id/team_member_id is passed.
  const vars = await resolveTemplateVars(supabase, { agency_owner_id: ownerId });

  const fullVars = {
    ...vars,
    // Friendly recipient placeholders for the preview.
    client_first_name: vars.client_first_name || "Sam",
    client_email: vars.client_email || "sam@clientco.com",
    client_business_name: vars.client_business_name || "Client Co",
    team_member_first_name: vars.team_member_first_name || "Jordan",
    team_member_email: vars.team_member_email || "jordan@youragency.com",
  };

  const ctaLabel = parsed.data.cta_label
    ? renderTemplate(parsed.data.cta_label, fullVars)
    : "";
  const ctaUrl = parsed.data.cta_url_template
    ? renderTemplate(parsed.data.cta_url_template, fullVars)
    : "";
  const previewText = parsed.data.preview_text
    ? renderTemplate(parsed.data.preview_text, fullVars)
    : "";
  const subject = parsed.data.subject
    ? renderTemplate(parsed.data.subject, fullVars)
    : "";

  const renderingVars = {
    ...fullVars,
    cta_label: ctaLabel,
    cta_url: ctaUrl,
    preview_text: previewText,
    __subject__: subject,
  };

  const html = renderTemplate(parsed.data.html_body, renderingVars);
  const text = parsed.data.plain_body
    ? renderTemplate(parsed.data.plain_body, renderingVars)
    : "";

  return NextResponse.json({
    html,
    text,
    subject,
    preview_text: previewText,
    cta_label: ctaLabel,
    cta_url: ctaUrl,
    vars: renderingVars,
  });
}
