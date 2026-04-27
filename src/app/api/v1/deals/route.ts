/**
 * Public API — Deals collection.
 *
 *   GET  /api/v1/deals  - list (read scope)
 *   POST /api/v1/deals  - create (write scope)
 */
import { NextRequest } from "next/server";
import { authenticateApiKey } from "@/lib/api/auth";
import { fail, ok, okPaginated } from "@/lib/api/response";
import { fireWebhookEvent } from "@/lib/api/webhook-events";
import { createServiceClient } from "@/lib/supabase/server";

const VALID_STAGES = new Set([
  "prospect",
  "qualified",
  "proposal_sent",
  "negotiation",
  "closed_won",
  "closed_lost",
]);

interface DealInsertBody {
  title?: unknown;
  client_name?: unknown;
  value?: unknown;
  stage?: unknown;
  probability?: unknown;
  expected_close_date?: unknown;
  contact_email?: unknown;
  contact_phone?: unknown;
  notes?: unknown;
  source?: unknown;
}

function asString(v: unknown): string | null {
  return typeof v === "string" && v.trim() ? v.trim() : null;
}
function asNumber(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

export async function GET(req: NextRequest) {
  const auth = await authenticateApiKey(req, { requiredScope: "read" });
  if (!auth.ok) return auth.response;

  const { searchParams } = new URL(req.url);
  const page = Math.max(1, parseInt(searchParams.get("page") || "1") || 1);
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "50") || 50));
  const stage = searchParams.get("stage");

  const supabase = createServiceClient();
  let query = supabase
    .from("deals")
    .select("*", { count: "exact" })
    .eq("user_id", auth.userId)
    .order("created_at", { ascending: false })
    .range((page - 1) * limit, page * limit - 1);

  if (stage) query = query.eq("stage", stage);

  const { data, count, error } = await query;
  if (error) return fail(500, error.message);
  return okPaginated(data ?? [], { total: count ?? 0, page, limit });
}

export async function POST(req: NextRequest) {
  const auth = await authenticateApiKey(req, { requiredScope: "write" });
  if (!auth.ok) return auth.response;

  let body: DealInsertBody;
  try {
    body = (await req.json()) as DealInsertBody;
  } catch {
    return fail(400, "Invalid JSON body");
  }

  const title = asString(body.title);
  const clientName = asString(body.client_name);
  if (!title || !clientName) {
    return fail(400, "title and client_name are required");
  }

  const stageRaw = asString(body.stage);
  const stage = stageRaw && VALID_STAGES.has(stageRaw) ? stageRaw : "prospect";

  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("deals")
    .insert({
      user_id: auth.userId,
      title,
      client_name: clientName,
      value: asNumber(body.value) ?? 0,
      stage,
      probability: asNumber(body.probability) ?? 10,
      expected_close_date: asString(body.expected_close_date),
      contact_email: asString(body.contact_email),
      contact_phone: asString(body.contact_phone),
      notes: asString(body.notes),
      source: asString(body.source) ?? "API",
    })
    .select()
    .single();

  if (error) return fail(500, error.message);

  void fireWebhookEvent({
    supabase,
    userId: auth.userId,
    event: "deal.created",
    payload: { deal: data },
  });

  return ok(data, { status: 201 });
}
