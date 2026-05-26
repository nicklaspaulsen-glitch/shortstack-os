/**
 * GET  /api/branded-emails/[kind]
 *   Single template (default-filled).
 *
 * PUT  /api/branded-emails/[kind]
 *   Upsert a template override for the caller's agency. Body:
 *     { subject, html_body, plain_body, preview_text?, cta_label?,
 *       cta_url_template? }
 *
 * DELETE /api/branded-emails/[kind]
 *   Remove the customization, reverting to the default.
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createServerSupabase } from "@/lib/supabase/server";
import { getEffectiveOwnerId } from "@/lib/security/require-owned-client";
import { loadTemplate } from "@/lib/email-templates/loader";
import { ALL_EMAIL_TEMPLATE_KINDS, EmailTemplateKind } from "@/lib/email-templates/types";

const VALID_KINDS = new Set<EmailTemplateKind>(ALL_EMAIL_TEMPLATE_KINDS);

const updateSchema = z.object({
  subject: z.string().min(1).max(200),
  html_body: z.string().min(1).max(50_000),
  plain_body: z.string().min(1).max(20_000),
  preview_text: z.string().max(200).nullable().optional(),
  cta_label: z.string().max(80).nullable().optional(),
  cta_url_template: z.string().max(500).nullable().optional(),
});

function parseKind(raw: string): EmailTemplateKind | null {
  return VALID_KINDS.has(raw as EmailTemplateKind) ? (raw as EmailTemplateKind) : null;
}

export async function GET(
  _req: NextRequest,
  { params }: { params: { kind: string } },
) {
  const kind = parseKind(params.kind);
  if (!kind) {
    return NextResponse.json({ error: "Invalid template kind" }, { status: 400 });
  }

  const supabase = createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const ownerId = await getEffectiveOwnerId(supabase, user.id);
  if (!ownerId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const template = await loadTemplate(supabase, ownerId, kind);
  return NextResponse.json({ template });
}

export async function PUT(
  req: NextRequest,
  { params }: { params: { kind: string } },
) {
  const kind = parseKind(params.kind);
  if (!kind) {
    return NextResponse.json({ error: "Invalid template kind" }, { status: 400 });
  }

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

  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const upsertRow = {
    agency_owner_id: ownerId,
    kind,
    subject: parsed.data.subject,
    html_body: parsed.data.html_body,
    plain_body: parsed.data.plain_body,
    preview_text: parsed.data.preview_text ?? null,
    cta_label: parsed.data.cta_label ?? null,
    cta_url_template: parsed.data.cta_url_template ?? null,
    is_default: false,
  };

  const { data, error } = await supabase
    .from("email_templates")
    .upsert(upsertRow, { onConflict: "agency_owner_id,kind" })
    .select()
    .single();

  if (error) {
    console.error("[branded-emails] upsert failed:", error.message);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }

  return NextResponse.json({ template: data });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { kind: string } },
) {
  const kind = parseKind(params.kind);
  if (!kind) {
    return NextResponse.json({ error: "Invalid template kind" }, { status: 400 });
  }

  const supabase = createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const ownerId = await getEffectiveOwnerId(supabase, user.id);
  if (!ownerId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { error } = await supabase
    .from("email_templates")
    .delete()
    .eq("agency_owner_id", ownerId)
    .eq("kind", kind);

  if (error) {
    console.error("[branded-emails] delete failed:", error.message);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }

  return NextResponse.json({ ok: true, reverted_to_default: true });
}
