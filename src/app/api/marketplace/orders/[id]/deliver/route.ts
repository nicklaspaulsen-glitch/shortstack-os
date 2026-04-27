/**
 * POST /api/marketplace/orders/[id]/deliver
 *
 * Seller marks the order as delivered.  Optional body { notes }.
 *
 * Allowed transitions: paid | in_progress -> delivered.
 * Anything else 409s.
 */

import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

function isUuid(s: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);
}

interface DeliverBody {
  notes?: unknown;
}

const DELIVERABLE_FROM = new Set(["paid", "in_progress"]);

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  if (!isUuid(params.id)) {
    return NextResponse.json({ error: "Invalid order id" }, { status: 400 });
  }
  const supabase = createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: DeliverBody = {};
  try {
    body = (await request.json()) as DeliverBody;
  } catch {
    /* empty is fine */
  }
  const notes =
    typeof body.notes === "string" ? body.notes.trim().slice(0, 5000) : null;

  // Read current state — RLS limits this to seller view, defense-in-depth
  // we still re-check seller_user_id below.
  const { data: existing } = await supabase
    .from("marketplace_orders")
    .select("id, seller_user_id, status")
    .eq("id", params.id)
    .maybeSingle();

  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (existing.seller_user_id !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (!DELIVERABLE_FROM.has(existing.status)) {
    return NextResponse.json(
      { error: `Cannot deliver from status ${existing.status}` },
      { status: 409 },
    );
  }

  const { data, error } = await supabase
    .from("marketplace_orders")
    .update({
      status: "delivered",
      delivered_at: new Date().toISOString(),
      seller_delivery_notes: notes,
      updated_at: new Date().toISOString(),
    })
    .eq("id", params.id)
    .eq("seller_user_id", user.id)
    .select("id, status, delivered_at")
    .maybeSingle();

  if (error || !data) {
    console.error("[marketplace/orders/:id/deliver] error", error);
    return NextResponse.json({ error: "Failed to mark delivered" }, { status: 500 });
  }
  return NextResponse.json({ ok: true, order: data });
}
