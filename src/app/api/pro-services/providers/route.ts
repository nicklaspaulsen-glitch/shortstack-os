import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import {
  isValidCategory,
  type ProServiceCategory,
} from "@/lib/pro-services";

/**
 * GET /api/pro-services/providers
 *
 * Lists vetted providers (with optional filters). Non-admin callers only
 * see vetted=true; admins get everyone (query `?all=1`).
 *
 * Filters:
 *   ?category=video_editor     — exact category match (GIN index)
 *   ?max_price_cents=50000     — starting_price_cents <= N
 *   ?max_turnaround=7          — turnaround_days <= N
 *   ?min_rating=4              — filter by average review rating (client-side
 *                                 aggregation — kept simple for v1)
 */
export async function GET(req: NextRequest) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const category = searchParams.get("category");
  const maxPriceRaw = searchParams.get("max_price_cents");
  const maxTurnRaw = searchParams.get("max_turnaround");
  const minRatingRaw = searchParams.get("min_rating");
  const adminAll = searchParams.get("all") === "1";

  // Check admin for `all` flag
  let isAdmin = false;
  if (adminAll) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();
    isAdmin = profile?.role === "admin";
  }

  let query = supabase
    .from("pro_services_providers")
    .select("*")
    .order("created_at", { ascending: false });

  // Non-admin (or admin not requesting all) only sees vetted=true. RLS would
  // enforce this anyway for non-admin, but we want an explicit filter so the
  // admin view toggle works cleanly.
  if (!(adminAll && isAdmin)) {
    query = query.eq("vetted", true);
  }

  if (category && isValidCategory(category)) {
    query = query.contains("categories", [category]);
  }

  if (maxPriceRaw) {
    const maxPrice = Number(maxPriceRaw);
    if (Number.isFinite(maxPrice) && maxPrice >= 0) {
      query = query.lte("starting_price_cents", maxPrice);
    }
  }

  if (maxTurnRaw) {
    const maxTurn = Number(maxTurnRaw);
    if (Number.isFinite(maxTurn) && maxTurn > 0) {
      query = query.lte("turnaround_days", maxTurn);
    }
  }

  const { data, error } = await query;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const providers = data ?? [];

  // Attach avg rating + completed count via a single aggregated query. Cheap
  // enough for v1 (directory is small). Optimize with materialized view if
  // catalog grows past a few hundred.
  const providerIds = providers.map((p) => p.id);
  let ratingMap = new Map<string, { avg: number; count: number }>();
  let completedMap = new Map<string, number>();

  if (providerIds.length > 0) {
    const { data: reviewRows } = await supabase
      .from("pro_services_reviews")
      .select("request_id, rating, pro_services_requests!inner(provider_id)")
      .in("pro_services_requests.provider_id", providerIds);

    // Supabase join shape: each row has a nested { pro_services_requests }
    // — an array when !inner is used, a single object when !inner is used,
    // but TS infers array. Handle both shapes defensively.
    type NestedReq = { provider_id: string };
    type Row = { rating: number; pro_services_requests: NestedReq | NestedReq[] | null };
    for (const raw of reviewRows ?? []) {
      const row = raw as unknown as Row;
      const nested = Array.isArray(row.pro_services_requests)
        ? row.pro_services_requests[0]
        : row.pro_services_requests;
      const pid = nested?.provider_id;
      if (!pid) continue;
      const cur = ratingMap.get(pid) || { avg: 0, count: 0 };
      const next = {
        avg: (cur.avg * cur.count + row.rating) / (cur.count + 1),
        count: cur.count + 1,
      };
      ratingMap.set(pid, next);
    }

    const { data: completedRows } = await supabase
      .from("pro_services_requests")
      .select("provider_id")
      .eq("status", "completed")
      .in("provider_id", providerIds);

    for (const row of completedRows ?? []) {
      completedMap.set(row.provider_id, (completedMap.get(row.provider_id) ?? 0) + 1);
    }
  }

  const enriched = providers.map((p) => ({
    ...p,
    avg_rating: ratingMap.get(p.id)?.avg ?? null,
    review_count: ratingMap.get(p.id)?.count ?? 0,
    completed_count: completedMap.get(p.id) ?? 0,
  }));

  // Client-side min_rating filter (simple; runs over already-fetched rows)
  let filtered = enriched;
  if (minRatingRaw) {
    const min = Number(minRatingRaw);
    if (Number.isFinite(min) && min > 0) {
      filtered = enriched.filter((p) => (p.avg_rating ?? 0) >= min);
    }
  }

  return NextResponse.json({ providers: filtered });
}

/**
 * POST /api/pro-services/providers
 *
 * Self-service provider signup. Always forced to vetted=false — an admin
 * must explicitly flip the flag via /api/admin/pro-services/vet before the
 * row appears in the public directory.
 */
export async function POST(req: NextRequest) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));

  const name = typeof body.name === "string" ? body.name.trim() : "";
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const bio = typeof body.bio === "string" ? body.bio : null;
  const avatar_url = typeof body.avatar_url === "string" ? body.avatar_url : null;
  const timezone = typeof body.timezone === "string" ? body.timezone : null;
  const categories: ProServiceCategory[] = Array.isArray(body.categories)
    ? body.categories.filter(isValidCategory)
    : [];
  const starting_price_cents = Math.max(0, Math.floor(Number(body.starting_price_cents) || 0));
  const turnaround_days = Math.max(1, Math.floor(Number(body.turnaround_days) || 7));
  const portfolio_urls: string[] = Array.isArray(body.portfolio_urls)
    ? body.portfolio_urls.filter((u: unknown) => typeof u === "string")
    : [];

  if (!name) return NextResponse.json({ error: "Name is required" }, { status: 400 });
  if (!email) return NextResponse.json({ error: "Email is required" }, { status: 400 });
  if (categories.length === 0) {
    return NextResponse.json({ error: "Pick at least one category" }, { status: 400 });
  }

  // Enforce: the email on the provider row must match the signed-in user's
  // email. Otherwise any user could pre-register an email they don't own.
  const { data: profile } = await supabase
    .from("profiles")
    .select("email")
    .eq("id", user.id)
    .single();
  if ((profile?.email ?? "").toLowerCase() !== email) {
    return NextResponse.json(
      { error: "Email must match your account email" },
      { status: 403 },
    );
  }

  const { data, error } = await supabase
    .from("pro_services_providers")
    .insert({
      name,
      email,
      bio,
      avatar_url,
      timezone,
      categories,
      starting_price_cents,
      turnaround_days,
      portfolio_urls,
      vetted: false, // always false on self-signup
      subscription_status: "inactive",
    })
    .select("*")
    .single();

  if (error) {
    // Unique violation on email → friendly message
    if (/duplicate|unique/i.test(error.message)) {
      return NextResponse.json(
        { error: "A provider with that email already exists" },
        { status: 409 },
      );
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ provider: data });
}
