/**
 * Loader for email_templates rows. Always returns a complete template —
 * if the agency hasn't customized this kind, the default from `defaults.ts`
 * is returned with `is_default: true` so the UI can show a "you're using
 * the default" badge.
 */

import { SupabaseClient } from "@supabase/supabase-js";
import { getDefaultTemplate, DEFAULT_TEMPLATES } from "./defaults";
import type { EmailTemplate, EmailTemplateKind } from "./types";
import { ALL_EMAIL_TEMPLATE_KINDS } from "./types";

interface EmailTemplateRow {
  id: string;
  agency_owner_id: string;
  kind: EmailTemplateKind;
  subject: string;
  preview_text: string | null;
  html_body: string;
  plain_body: string;
  cta_label: string | null;
  cta_url_template: string | null;
  is_default: boolean;
  updated_at: string;
  created_at: string;
}

export async function loadTemplate(
  supabase: SupabaseClient,
  agencyOwnerId: string,
  kind: EmailTemplateKind,
): Promise<EmailTemplate> {
  const { data, error } = await supabase
    .from("email_templates")
    .select("*")
    .eq("agency_owner_id", agencyOwnerId)
    .eq("kind", kind)
    .maybeSingle();

  if (error) {
    console.warn("[email-templates] loader error, falling back to default:", error.message);
    return getDefaultTemplate(kind);
  }

  if (!data) {
    return getDefaultTemplate(kind);
  }

  return rowToTemplate(data as EmailTemplateRow);
}

export async function loadAllTemplates(
  supabase: SupabaseClient,
  agencyOwnerId: string,
): Promise<EmailTemplate[]> {
  const { data, error } = await supabase
    .from("email_templates")
    .select("*")
    .eq("agency_owner_id", agencyOwnerId);

  if (error) {
    console.warn("[email-templates] loadAll error, falling back to defaults:", error.message);
    return ALL_EMAIL_TEMPLATE_KINDS.map(getDefaultTemplate);
  }

  const rows = ((data || []) as EmailTemplateRow[]).reduce<Record<string, EmailTemplate>>(
    (acc, row) => {
      acc[row.kind] = rowToTemplate(row);
      return acc;
    },
    {},
  );

  return ALL_EMAIL_TEMPLATE_KINDS.map((kind) => rows[kind] || getDefaultTemplate(kind));
}

function rowToTemplate(row: EmailTemplateRow): EmailTemplate {
  // Defensive: if a row exists but has empty html/plain, fall back to the
  // default's body for that field so a recipient never gets a blank email.
  const fallback = DEFAULT_TEMPLATES[row.kind];
  return {
    id: row.id,
    agency_owner_id: row.agency_owner_id,
    kind: row.kind,
    subject: row.subject || fallback.subject,
    preview_text: row.preview_text,
    html_body: row.html_body || fallback.html_body,
    plain_body: row.plain_body || fallback.plain_body,
    cta_label: row.cta_label,
    cta_url_template: row.cta_url_template,
    is_default: false, // a row exists, so it's customized
    updated_at: row.updated_at,
    created_at: row.created_at,
  };
}
