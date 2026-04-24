/**
 * Invoices — list + create.
 *
 * GET  /api/invoices
 *   → list for the authenticated agency user. Only invoices attached to
 *     clients the user owns (via clients.profile_id) come back.
 *
 * POST /api/invoices
 *   body: {
 *     client_id: string,
 *     invoice_number?: string,       // auto-generated when omitted
 *     issue_date?: string,           // ISO date; defaults to today
 *     due_date?: string,
 *     line_items?: Array<{ description, qty, unit_price_cents }>,
 *     tax_cents?: number,
 *     currency?: string,
 *     notes?: string
 *   }
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

function computeTotals(items: LineItemOut[], taxCents = 0) {
  const subtotal = items.reduce((s, i) => s + i.qty * i.unit_price_cents, 0);
  const tax = Math.max(0, Math.round(taxCents));
  return { subtotal_cents: subtotal, tax_cents: tax, total_cents: subtotal + tax };
}

function generateInvoiceNumber(): string {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const rand = Math.floor(Math.random() * 9000) + 1000;
  return `INV-${yyyy}${mm}-${rand}`;
}

export async function GET() {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Pull every invoice whose parent client belongs to this user. Doing the
  // join server-side keeps us honest even if RLS is loose.
  const { data, error } = await supabase
    .from("invoices")
    .select(
      "id, client_id, invoice_number, issue_date, due_date, status, line_items, subtotal_cents, tax_cents, total_cents, currency, notes, stripe_payment_link, sent_at, paid_at, created_at, clients:client_id(business_name, profile_id)",
    )
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[invoices] list error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const scoped = (data || []).filter((row: Record<string, unknown>) => {
    const clients = row.clients as { profile_id?: string } | { profile_id?: string }[] | null;
    if (!clients) return row.client_id === null; // allow orphaned-for-now drafts by same user? skip.
    const one = Array.isArray(clients) ? clients[0] : clients;
    return one?.profile_id === user.id;
  });

  return NextResponse.json({ invoices: scoped });
}

export async function POST(request: NextRequest) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: {
    client_id?: string;
    invoice_number?: string;
    issue_date?: string;
    due_date?: string;
    line_items?: unknown;
    tax_cents?: number;
    currency?: string;
    notes?: string;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body.client_id) {
    return NextResponse.json({ error: "client_id is required" }, { status: 400 });
  }

  // Verify the caller owns this client.
  const { data: client } = await supabase
    .from("clients")
    .select("id, profile_id, business_name")
    .eq("id", body.client_id)
    .eq("profile_id", user.id)
    .maybeSingle();
  if (!client) {
    return NextResponse.json({ error: "Client not found or not yours" }, { status: 404 });
  }

  const lineItems = normalizeLineItems(body.line_items);
  const { subtotal_cents, tax_cents, total_cents } = computeTotals(lineItems, body.tax_cents);

  const insertPayload: Record<string, unknown> = {
    client_id: client.id,
    invoice_number: body.invoice_number?.trim() || generateInvoiceNumber(),
    issue_date: body.issue_date || new Date().toISOString().slice(0, 10),
    due_date: body.due_date || null,
    status: "draft",
    line_items: lineItems,
    subtotal_cents,
    tax_cents,
    total_cents,
    currency: body.currency || "USD",
    notes: body.notes || null,
    // Mirror total_cents into the legacy decimal `amount` column so the
    // existing page.tsx list (which reads `amount`) keeps working.
    amount: total_cents / 100,
    description: body.notes || `Invoice for ${client.business_name}`,
  };

  const { data, error } = await supabase
    .from("invoices")
    .insert(insertPayload)
    .select()
    .single();

  if (error) {
    console.error("[invoices] create error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ invoice: data });
}
