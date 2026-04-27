/**
 * Public API — single contact operations.
 */
import { NextRequest } from "next/server";
import { authenticateApiKey } from "@/lib/api/auth";
import { fail, ok } from "@/lib/api/response";
import { fireWebhookEvent } from "@/lib/api/webhook-events";
import { createServiceClient } from "@/lib/supabase/server";

const PUBLIC_COLS =
  "id, business_name, contact_name, email, phone, website, industry, notes, " +
  "created_at, updated_at";

const UPDATABLE_FIELDS = [
  "business_name",
  "contact_name",
  "email",
  "phone",
  "website",
  "industry",
  "notes",
] as const;

export async function GET(
  req: NextRequest,
  ctx: { params: { id: string } },
) {
  const auth = await authenticateApiKey(req, { requiredScope: "read" });
  if (!auth.ok) return auth.response;

  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("clients")
    .select(PUBLIC_COLS)
    .eq("id", ctx.params.id)
    .eq("profile_id", auth.userId)
    .maybeSingle();

  if (error) return fail(500, error.message);
  if (!data) return fail(404, "Contact not found");
  return ok(data);
}

export async function PATCH(
  req: NextRequest,
  ctx: { params: { id: string } },
) {
  const auth = await authenticateApiKey(req, { requiredScope: "write" });
  if (!auth.ok) return auth.response;

  let raw: Record<string, unknown>;
  try {
    raw = (await req.json()) as Record<string, unknown>;
  } catch {
    return fail(400, "Invalid JSON body");
  }

  const updates: Record<string, unknown> = {};
  for (const k of UPDATABLE_FIELDS) {
    if (k in raw) updates[k] = raw[k];
  }
  if (Object.keys(updates).length === 0) {
    return fail(400, "No updatable fields provided");
  }

  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("clients")
    .update(updates)
    .eq("id", ctx.params.id)
    .eq("profile_id", auth.userId)
    .select(PUBLIC_COLS)
    .single();

  if (error) return fail(500, error.message);
  if (!data) return fail(404, "Contact not found");

  void fireWebhookEvent({
    supabase,
    userId: auth.userId,
    event: "contact.updated",
    payload: { contact: data },
  });
  return ok(data);
}

export async function DELETE(
  req: NextRequest,
  ctx: { params: { id: string } },
) {
  const auth = await authenticateApiKey(req, { requiredScope: "write" });
  if (!auth.ok) return auth.response;

  const supabase = createServiceClient();
  const { error } = await supabase
    .from("clients")
    .delete()
    .eq("id", ctx.params.id)
    .eq("profile_id", auth.userId);

  if (error) return fail(500, error.message);
  return ok({ id: ctx.params.id, deleted: true });
}
