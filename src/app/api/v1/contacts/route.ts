/**
 * Public API — Contacts (backed by `clients` table).
 *
 *   GET  /api/v1/contacts
 *   POST /api/v1/contacts
 *
 * The "contact" is the Public-API friendly name for a row in the agency's
 * client roster. Fields exposed are the contact-relevant subset only — we do
 * not surface MRR, contract status, etc. through this surface (those live on
 * the internal /api/clients endpoint).
 */
import { NextRequest } from "next/server";
import { authenticateApiKey } from "@/lib/api/auth";
import { fail, ok, okPaginated } from "@/lib/api/response";
import { fireWebhookEvent } from "@/lib/api/webhook-events";
import { createServiceClient } from "@/lib/supabase/server";

const PUBLIC_COLS =
  "id, business_name, contact_name, email, phone, website, industry, notes, " +
  "created_at, updated_at";

interface ContactInsertBody {
  business_name?: unknown;
  contact_name?: unknown;
  email?: unknown;
  phone?: unknown;
  website?: unknown;
  industry?: unknown;
  notes?: unknown;
}

function asString(v: unknown): string | null {
  return typeof v === "string" && v.trim() ? v.trim() : null;
}

export async function GET(req: NextRequest) {
  const auth = await authenticateApiKey(req, { requiredScope: "read" });
  if (!auth.ok) return auth.response;

  const { searchParams } = new URL(req.url);
  const page = Math.max(1, parseInt(searchParams.get("page") || "1") || 1);
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "50") || 50));

  const supabase = createServiceClient();
  const { data, count, error } = await supabase
    .from("clients")
    .select(PUBLIC_COLS, { count: "exact" })
    .eq("profile_id", auth.userId)
    .order("created_at", { ascending: false })
    .range((page - 1) * limit, page * limit - 1);

  if (error) return fail(500, error.message);
  return okPaginated(data ?? [], { total: count ?? 0, page, limit });
}

export async function POST(req: NextRequest) {
  const auth = await authenticateApiKey(req, { requiredScope: "write" });
  if (!auth.ok) return auth.response;

  let body: ContactInsertBody;
  try {
    body = (await req.json()) as ContactInsertBody;
  } catch {
    return fail(400, "Invalid JSON body");
  }

  const businessName = asString(body.business_name);
  if (!businessName) return fail(400, "business_name is required");

  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("clients")
    .insert({
      profile_id: auth.userId,
      business_name: businessName,
      contact_name: asString(body.contact_name),
      email: asString(body.email),
      phone: asString(body.phone),
      website: asString(body.website),
      industry: asString(body.industry),
      notes: asString(body.notes),
    })
    .select(PUBLIC_COLS)
    .single();

  if (error) return fail(500, error.message);

  void fireWebhookEvent({
    supabase,
    userId: auth.userId,
    event: "contact.created",
    payload: { contact: data },
  });

  return ok(data, { status: 201 });
}
