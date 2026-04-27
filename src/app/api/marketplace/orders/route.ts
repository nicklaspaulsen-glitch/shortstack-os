/**
 * GET /api/marketplace/orders
 *
 * List orders relevant to the authed user.  Returns both buyer-side and
 * seller-side rows (RLS lets the user see either when their id is in
 * buyer_user_id or seller_user_id).
 *
 * Query params:
 *   ?role=buyer|seller — restrict to one side (default: both)
 *   ?status=...        — filter by lifecycle status
 *   ?limit=N           — clamp to 1..100, default 50
 */

import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

const ALLOWED_STATUSES = new Set([
  "pending_payment",
  "paid",
  "in_progress",
  "delivered",
  "disputed",
  "refunded",
  "cancelled",
]);

function clampLimit(raw: string | null): number {
  const n = Number(raw ?? 50);
  if (!Number.isFinite(n) || n <= 0) return 50;
  return Math.min(100, Math.max(1, Math.floor(n)));
}

export async function GET(request: NextRequest) {
  const supabase = createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(request.url);
  const roleRaw = url.searchParams.get("role")?.toLowerCase().trim() ?? null;
  const statusRaw = url.searchParams.get("status")?.toLowerCase().trim() ?? null;
  const limit = clampLimit(url.searchParams.get("limit"));

  if (statusRaw && !ALLOWED_STATUSES.has(statusRaw)) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }

  let query = supabase
    .from("marketplace_orders")
    .select(
      "id, service_id, buyer_user_id, seller_user_id, amount_cents, shortstack_fee_cents, seller_payout_cents, currency, status, created_at, delivered_at",
    )
    .order("created_at", { ascending: false })
    .limit(limit);

  if (roleRaw === "buyer") {
    query = query.eq("buyer_user_id", user.id);
  } else if (roleRaw === "seller") {
    query = query.eq("seller_user_id", user.id);
  } else {
    // Both — RLS allows either, so filter explicitly to avoid
    // surprises if a future migration changes the policies.
    query = query.or(
      `buyer_user_id.eq.${user.id},seller_user_id.eq.${user.id}`,
    );
  }

  if (statusRaw) {
    query = query.eq("status", statusRaw);
  }

  const { data, error } = await query;
  if (error) {
    console.error("[marketplace/orders] list error", error);
    return NextResponse.json({ error: "Failed to load orders" }, { status: 500 });
  }
  return NextResponse.json({ orders: data ?? [], total: data?.length ?? 0 });
}
