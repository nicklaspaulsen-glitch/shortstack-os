import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

/**
 * POST /api/pro-services/reviews
 *
 * Create or upsert a review on a completed request. RLS enforces that only
 * the requester of the matching request can write.
 *
 * Body: { request_id, rating (1-5), review_text? }
 */
export async function POST(req: NextRequest) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const request_id = typeof body.request_id === "string" ? body.request_id : "";
  const rating = Number(body.rating);
  const review_text = typeof body.review_text === "string" ? body.review_text : null;

  if (!request_id) {
    return NextResponse.json({ error: "request_id required" }, { status: 400 });
  }
  if (!Number.isFinite(rating) || rating < 1 || rating > 5) {
    return NextResponse.json({ error: "rating must be 1-5" }, { status: 400 });
  }

  // Validate: the caller must own the request AND it must be completed
  const { data: existing } = await supabase
    .from("pro_services_requests")
    .select("id, user_id, status")
    .eq("id", request_id)
    .single();
  if (!existing) {
    return NextResponse.json({ error: "Request not found" }, { status: 404 });
  }
  if (existing.user_id !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (existing.status !== "completed") {
    return NextResponse.json(
      { error: "Can only review completed requests" },
      { status: 400 },
    );
  }

  // Upsert by request_id (unique constraint in schema)
  const { data, error } = await supabase
    .from("pro_services_reviews")
    .upsert(
      { request_id, rating: Math.floor(rating), review_text },
      { onConflict: "request_id" },
    )
    .select("*")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ review: data });
}
