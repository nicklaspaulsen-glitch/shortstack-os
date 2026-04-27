/**
 * GET /api/marketplace/orders/[id]
 *
 * Returns the order plus joined service info.  Buyer or seller can read it.
 *
 * For convenience we also expose the latest review (so the buyer's "leave
 * a review" UI can hide if a review already exists).
 */

import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

function isUuid(s: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);
}

export async function GET(
  _request: NextRequest,
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

  const { data: order, error } = await supabase
    .from("marketplace_orders")
    .select(
      "id, service_id, buyer_user_id, seller_user_id, amount_cents, shortstack_fee_cents, seller_payout_cents, currency, status, buyer_notes, seller_delivery_notes, delivered_at, stripe_checkout_session_id, stripe_payment_intent_id, stripe_transfer_id, created_at, updated_at",
    )
    .eq("id", params.id)
    .maybeSingle();

  if (error) {
    console.error("[marketplace/orders/:id] error", error);
    return NextResponse.json({ error: "Failed to load order" }, { status: 500 });
  }
  if (!order) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (order.buyer_user_id !== user.id && order.seller_user_id !== user.id) {
    // RLS should already block this, but defense-in-depth.
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Service title (read-only, both parties can see).  We DO NOT use a join
  // because RLS on marketplace_services only exposes active rows publicly —
  // closed services would otherwise vanish here.  Buyer/seller can both see
  // their order's title regardless.
  const { data: service } = await supabase
    .from("marketplace_services")
    .select("id, title, description, category, delivery_days")
    .eq("id", order.service_id)
    .maybeSingle();

  const { data: review } = await supabase
    .from("marketplace_reviews")
    .select("id, rating, text, created_at, reviewer_id")
    .eq("order_id", order.id)
    .maybeSingle();

  return NextResponse.json({
    order,
    service: service ?? null,
    review: review ?? null,
    role: order.buyer_user_id === user.id ? "buyer" : "seller",
  });
}
