/**
 * Service Marketplace — list + create services.
 *
 *  GET  /api/marketplace/services
 *    Public-ish: returns every active service with seller display info.
 *    Auth NOT required so we can power a public browse page later.  The
 *    underlying RLS policy only exposes status='active' rows to anon.
 *
 *    Optional query params:
 *      ?category=design   — exact match (case insensitive)
 *      ?q=foo             — substring match on title or description
 *      ?seller=<uuid>     — only this seller's listings
 *      ?limit=N           — clamp to 1..100, default 50
 *
 *  POST /api/marketplace/services
 *    Auth required.  Creates a draft service for the authed user.
 *    Body: { title, description, category, price_cents, currency?,
 *            delivery_days?, status? }
 *    Returns: { service }
 */

import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { getEffectiveOwnerId } from "@/lib/security/require-owned-client";

const ALLOWED_CATEGORIES = new Set([
  "design",
  "video",
  "copywriting",
  "ads",
  "seo",
  "social",
  "dev",
  "consulting",
  "branding",
  "ops",
  "other",
]);

const ALLOWED_STATUSES = new Set(["draft", "active", "paused", "closed"]);

const ALLOWED_CURRENCIES = new Set(["usd", "eur", "gbp", "aud", "cad"]);

interface CreateServiceBody {
  title?: unknown;
  description?: unknown;
  category?: unknown;
  price_cents?: unknown;
  currency?: unknown;
  delivery_days?: unknown;
  status?: unknown;
}

function clampLimit(raw: string | null): number {
  const n = Number(raw ?? 50);
  if (!Number.isFinite(n) || n <= 0) return 50;
  return Math.min(100, Math.max(1, Math.floor(n)));
}

export async function GET(request: NextRequest) {
  const supabase = createServerSupabase();
  const url = new URL(request.url);

  const category = url.searchParams.get("category")?.toLowerCase().trim() ?? null;
  const q = url.searchParams.get("q")?.trim() ?? null;
  const seller = url.searchParams.get("seller")?.trim() ?? null;
  const limit = clampLimit(url.searchParams.get("limit"));

  let query = supabase
    .from("marketplace_services")
    .select(
      "id, user_id, title, description, category, price_cents, currency, delivery_days, status, created_at",
    )
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (category) {
    if (!ALLOWED_CATEGORIES.has(category)) {
      return NextResponse.json(
        { error: `Invalid category. Allowed: ${Array.from(ALLOWED_CATEGORIES).join(", ")}` },
        { status: 400 },
      );
    }
    query = query.eq("category", category);
  }
  if (q) {
    // ilike with two clauses across title/description.
    query = query.or(`title.ilike.%${q}%,description.ilike.%${q}%`);
  }
  if (seller) {
    query = query.eq("user_id", seller);
  }

  const { data, error } = await query;
  if (error) {
    console.error("[marketplace/services] list error", error);
    return NextResponse.json({ error: "Failed to load services" }, { status: 500 });
  }

  return NextResponse.json({ services: data ?? [], total: data?.length ?? 0 });
}

export async function POST(request: NextRequest) {
  const supabase = createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Defense-in-depth: resolve the effective owner.  We still write user_id
  // = user.id so the seller is the actual person who created the listing
  // (team_members CAN list services on their own account if the agency
  // owner allows it).
  const ownerId = await getEffectiveOwnerId(supabase, user.id);
  if (!ownerId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: CreateServiceBody;
  try {
    body = (await request.json()) as CreateServiceBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const title = typeof body.title === "string" ? body.title.trim() : "";
  const description =
    typeof body.description === "string" ? body.description.trim() : "";
  const category =
    typeof body.category === "string" ? body.category.toLowerCase().trim() : "";
  const priceCentsRaw = body.price_cents;
  const currencyRaw =
    typeof body.currency === "string" ? body.currency.toLowerCase().trim() : "usd";
  const deliveryDaysRaw = body.delivery_days;
  const statusRaw = typeof body.status === "string" ? body.status.toLowerCase().trim() : "draft";

  if (!title || title.length > 200) {
    return NextResponse.json(
      { error: "title is required (1..200 chars)" },
      { status: 400 },
    );
  }
  if (!description || description.length > 5000) {
    return NextResponse.json(
      { error: "description is required (1..5000 chars)" },
      { status: 400 },
    );
  }
  if (!ALLOWED_CATEGORIES.has(category)) {
    return NextResponse.json(
      { error: `Invalid category. Allowed: ${Array.from(ALLOWED_CATEGORIES).join(", ")}` },
      { status: 400 },
    );
  }
  if (!ALLOWED_CURRENCIES.has(currencyRaw)) {
    return NextResponse.json(
      { error: `Invalid currency. Allowed: ${Array.from(ALLOWED_CURRENCIES).join(", ")}` },
      { status: 400 },
    );
  }
  if (!ALLOWED_STATUSES.has(statusRaw)) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }

  const priceCents = Number(priceCentsRaw);
  if (!Number.isFinite(priceCents) || priceCents < 100 || priceCents > 5_000_000) {
    return NextResponse.json(
      { error: "price_cents must be an integer between 100 and 5,000,000" },
      { status: 400 },
    );
  }

  const deliveryDays =
    deliveryDaysRaw === undefined || deliveryDaysRaw === null
      ? 7
      : Number(deliveryDaysRaw);
  if (!Number.isFinite(deliveryDays) || deliveryDays < 1 || deliveryDays > 365) {
    return NextResponse.json(
      { error: "delivery_days must be an integer between 1 and 365" },
      { status: 400 },
    );
  }

  const { data, error } = await supabase
    .from("marketplace_services")
    .insert({
      user_id: user.id,
      title,
      description,
      category,
      price_cents: Math.floor(priceCents),
      currency: currencyRaw,
      delivery_days: Math.floor(deliveryDays),
      status: statusRaw,
    })
    .select(
      "id, user_id, title, description, category, price_cents, currency, delivery_days, status, created_at",
    )
    .single();

  if (error || !data) {
    console.error("[marketplace/services] create error", error);
    return NextResponse.json({ error: "Failed to create service" }, { status: 500 });
  }

  return NextResponse.json({ service: data });
}
