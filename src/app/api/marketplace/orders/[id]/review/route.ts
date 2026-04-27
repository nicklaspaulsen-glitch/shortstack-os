/**
 * POST /api/marketplace/orders/[id]/review
 *
 * Buyer leaves a review on a delivered order.  One review per order
 * (UNIQUE constraint on order_id).
 *
 * Body: { rating: 1..5, text?: string }
 */

import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

function isUuid(s: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);
}

interface ReviewBody {
  rating?: unknown;
  text?: unknown;
}

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

  let body: ReviewBody = {};
  try {
    body = (await request.json()) as ReviewBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const rating = Number(body.rating);
  if (!Number.isFinite(rating) || rating < 1 || rating > 5) {
    return NextResponse.json(
      { error: "rating must be an integer between 1 and 5" },
      { status: 400 },
    );
  }
  const text =
    typeof body.text === "string" ? body.text.trim().slice(0, 4000) : null;

  // Verify the order belongs to the buyer and is delivered.
  const { data: order } = await supabase
    .from("marketplace_orders")
    .select("id, buyer_user_id, status")
    .eq("id", params.id)
    .maybeSingle();
  if (!order) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (order.buyer_user_id !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (order.status !== "delivered") {
    return NextResponse.json(
      { error: `Cannot review until delivered (current: ${order.status})` },
      { status: 409 },
    );
  }

  const { data, error } = await supabase
    .from("marketplace_reviews")
    .upsert(
      {
        order_id: params.id,
        reviewer_id: user.id,
        rating: Math.floor(rating),
        text,
      },
      { onConflict: "order_id" },
    )
    .select("id, order_id, rating, text, created_at")
    .single();

  if (error || !data) {
    console.error("[marketplace/orders/:id/review] error", error);
    return NextResponse.json({ error: "Failed to save review" }, { status: 500 });
  }
  return NextResponse.json({ review: data });
}
