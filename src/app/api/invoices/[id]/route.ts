/**
 * Invoice detail + update.
 *
 * GET    /api/invoices/[id]  → full row
 * PATCH  /api/invoices/[id]  → update title, status, line_items, dates, notes
 *
 * RLS restricts reads/writes to invoices whose parent client is owned by
 * the caller. We additionally re-compute totals server-side when line_items
 * or tax_cents are updated so the DB values stay authoritative.
 */
import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

interface LineItemIn {
  description?: string;
  qty?: number;
  unit_price_cents?: number;
}

interface LineItemOut {
  description: string;
  qty: number;
  unit_price_cents: number;
}

const UPDATABLE = new Set([
  "invoice_number",
  "issue_date",
  "due_date",
  "status",
  "line_items",
  "tax_cents",
  "currency",
  "notes",
  "sent_at",
  "paid_at",
  "stripe_payment_link",
]);

function normalizeLineItems(raw: unknown): LineItemOut[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((r) => {
      const item = (r as LineItemIn) || {};
      return {
        description: String(item.description || "").trim(),
        qty: Math.max(0, Math.round(Number(item.qty || 0))),
        unit_price_cents: Math.max(0, Math.round(Number(item.unit_price_cents || 0))),
      };
    })
    .filter((i) => i.description && i.qty > 0 && i.unit_price_cents >= 0);
}

async function fetchOwned(
  supabase: ReturnType<typeof createServerSupabase>,
  userId: string,
  id: string,
) {
  const { data } = await supabase
    .from("invoices")
    .select("*, clients:client_id(id, profile_id, business_name, email)")
    .eq("id", id)
    .maybeSingle();
  if (!data) return null;
  const clients = data.clients as { profile_id?: string } | { profile_id?: string }[] | null;
  const client = Array.isArray(clients) ? clients[0] : clients;
  if (!client || client.profile_id !== userId) return null;
  return data;
}

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } },
) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const row = await fetchOwned(supabase, user.id, params.id);
  if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({ invoice: row });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const existing = await fetchOwned(supabase, user.id, params.id);
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const patch: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(body)) {
    if (UPDATABLE.has(key)) patch[key] = value;
  }

  // Recompute totals when line_items or tax change.
  const touchesTotals = "line_items" in patch || "tax_cents" in patch;
  if (touchesTotals) {
    const items = normalizeLineItems(
      "line_items" in patch ? patch.line_items : existing.line_items,
    );
    const tax = Math.max(
      0,
      Math.round(
        Number("tax_cents" in patch ? patch.tax_cents : existing.tax_cents || 0),
      ),
    );
    const subtotal = items.reduce((s, i) => s + i.qty * i.unit_price_cents, 0);
    patch.line_items = items;
    patch.tax_cents = tax;
    patch.subtotal_cents = subtotal;
    patch.total_cents = subtotal + tax;
    patch.amount = (subtotal + tax) / 100; // keep legacy decimal in sync
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "No updatable fields provided" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("invoices")
    .update(patch)
    .eq("id", params.id)
    .select()
    .single();

  if (error) {
    console.error("[invoices] patch error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ invoice: data });
}
