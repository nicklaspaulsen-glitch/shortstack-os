import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { isValidCategory, type ProServiceCategory } from "@/lib/pro-services";

/**
 * GET /api/pro-services/providers/[id]
 *
 * Returns a single provider with their reviews. RLS lets anyone read vetted
 * rows; non-vetted rows are only visible to the provider themselves + admins.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: provider, error } = await supabase
    .from("pro_services_providers")
    .select("*")
    .eq("id", params.id)
    .single();

  if (error || !provider) {
    return NextResponse.json({ error: "Provider not found" }, { status: 404 });
  }

  // Reviews for this provider — join through requests to filter
  const { data: requestRows } = await supabase
    .from("pro_services_requests")
    .select("id, status")
    .eq("provider_id", params.id);

  const requestIds = (requestRows ?? []).map((r) => r.id);
  const completedCount = (requestRows ?? []).filter((r) => r.status === "completed").length;

  let reviews: Array<{ id: string; rating: number; review_text: string | null; created_at: string }> = [];
  if (requestIds.length > 0) {
    const { data: reviewRows } = await supabase
      .from("pro_services_reviews")
      .select("id, rating, review_text, created_at")
      .in("request_id", requestIds)
      .order("created_at", { ascending: false });
    reviews = reviewRows ?? [];
  }

  const avgRating =
    reviews.length > 0
      ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length
      : null;

  return NextResponse.json({
    provider,
    reviews,
    stats: {
      completed_count: completedCount,
      review_count: reviews.length,
      avg_rating: avgRating,
    },
  });
}

/**
 * PATCH /api/pro-services/providers/[id]
 *
 * Update a provider profile. Only the provider themselves (email match) or
 * admin can call this. `vetted`, `stripe_subscription_id`, and
 * `subscription_status` are admin-only fields — silently dropped when set by
 * the provider, so they can't self-vet.
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, email")
    .eq("id", user.id)
    .single();
  const isAdmin = profile?.role === "admin";
  const userEmail = (profile?.email ?? "").toLowerCase();

  const { data: existing } = await supabase
    .from("pro_services_providers")
    .select("id, email")
    .eq("id", params.id)
    .single();

  if (!existing) {
    return NextResponse.json({ error: "Provider not found" }, { status: 404 });
  }
  if (!isAdmin && existing.email.toLowerCase() !== userEmail) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const patch: Record<string, unknown> = {};

  if (typeof body.name === "string") patch.name = body.name.trim();
  if (typeof body.bio === "string") patch.bio = body.bio;
  if (body.avatar_url === null || typeof body.avatar_url === "string") {
    patch.avatar_url = body.avatar_url;
  }
  if (typeof body.timezone === "string") patch.timezone = body.timezone;
  if (Array.isArray(body.categories)) {
    const cats = body.categories.filter(isValidCategory) as ProServiceCategory[];
    if (cats.length > 0) patch.categories = cats;
  }
  if (typeof body.starting_price_cents === "number") {
    patch.starting_price_cents = Math.max(0, Math.floor(body.starting_price_cents));
  }
  if (typeof body.turnaround_days === "number") {
    patch.turnaround_days = Math.max(1, Math.floor(body.turnaround_days));
  }
  if (Array.isArray(body.portfolio_urls)) {
    patch.portfolio_urls = body.portfolio_urls.filter(
      (u: unknown) => typeof u === "string",
    );
  }

  // Admin-only fields
  if (isAdmin) {
    if (typeof body.vetted === "boolean") {
      patch.vetted = body.vetted;
      patch.vetted_at = body.vetted ? new Date().toISOString() : null;
    }
    if (typeof body.subscription_status === "string") {
      patch.subscription_status = body.subscription_status;
    }
    if (typeof body.stripe_subscription_id === "string") {
      patch.stripe_subscription_id = body.stripe_subscription_id;
    }
  }

  const { data, error } = await supabase
    .from("pro_services_providers")
    .update(patch)
    .eq("id", params.id)
    .select("*")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ provider: data });
}
