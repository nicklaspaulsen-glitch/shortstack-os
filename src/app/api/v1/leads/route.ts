/**
 * Public API — Leads collection.
 *
 *   GET  /api/v1/leads        - list (read scope)
 *   POST /api/v1/leads        - create (write scope)
 *
 * Auth: Bearer ss_live_<token>. See docs/PUBLIC_API.md.
 */
import { NextRequest } from "next/server";
import { authenticateApiKey } from "@/lib/api/auth";
import { fail, ok, okPaginated } from "@/lib/api/response";
import { fireWebhookEvent } from "@/lib/api/webhook-events";
import { createServiceClient } from "@/lib/supabase/server";

interface LeadInsertBody {
  business_name?: unknown;
  email?: unknown;
  phone?: unknown;
  industry?: unknown;
  city?: unknown;
  state?: unknown;
  source?: unknown;
  status?: unknown;
  website?: unknown;
  notes?: unknown;
}

function asString(value: unknown): string | null {
  if (typeof value === "string" && value.trim()) return value.trim();
  return null;
}

export async function GET(req: NextRequest) {
  const auth = await authenticateApiKey(req, { requiredScope: "read" });
  if (!auth.ok) return auth.response;

  const { searchParams } = new URL(req.url);
  const page = Math.max(1, parseInt(searchParams.get("page") || "1") || 1);
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "50") || 50));
  const status = searchParams.get("status");

  const supabase = createServiceClient();
  let query = supabase
    .from("leads")
    .select("*", { count: "exact" })
    .eq("user_id", auth.userId)
    .order("created_at", { ascending: false })
    .range((page - 1) * limit, page * limit - 1);

  if (status) query = query.eq("status", status);

  const { data, count, error } = await query;
  if (error) return fail(500, error.message);

  return okPaginated(data ?? [], { total: count ?? 0, page, limit });
}

export async function POST(req: NextRequest) {
  const auth = await authenticateApiKey(req, { requiredScope: "write" });
  if (!auth.ok) return auth.response;

  let body: LeadInsertBody;
  try {
    body = (await req.json()) as LeadInsertBody;
  } catch {
    return fail(400, "Invalid JSON body");
  }

  const businessName = asString(body.business_name);
  if (!businessName) return fail(400, "business_name is required");

  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("leads")
    .insert({
      user_id: auth.userId,
      business_name: businessName,
      email: asString(body.email),
      phone: asString(body.phone),
      industry: asString(body.industry),
      city: asString(body.city),
      state: asString(body.state),
      source: asString(body.source) ?? "API",
      status: asString(body.status) ?? "new",
      website: asString(body.website),
      notes: asString(body.notes),
    })
    .select()
    .single();

  if (error) return fail(500, error.message);

  // Fire webhook event for any external listeners.
  void fireWebhookEvent({
    supabase,
    userId: auth.userId,
    event: "lead.created",
    payload: { lead: data },
  });

  return ok(data, { status: 201 });
}
