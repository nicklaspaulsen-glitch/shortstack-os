/**
 * GET    /api/marketplace/services/[id]   — public detail (active only)
 * PATCH  /api/marketplace/services/[id]   — seller updates own listing
 * DELETE /api/marketplace/services/[id]   — seller closes own listing
 */

import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

const ALLOWED_STATUSES = new Set(["draft", "active", "paused", "closed"]);
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

interface PatchBody {
  title?: unknown;
  description?: unknown;
  category?: unknown;
  price_cents?: unknown;
  delivery_days?: unknown;
  status?: unknown;
}

function isUuid(s: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);
}

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } },
) {
  if (!isUuid(params.id)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }
  const supabase = createServerSupabase();
  const { data, error } = await supabase
    .from("marketplace_services")
    .select(
      "id, user_id, title, description, category, price_cents, currency, delivery_days, status, created_at",
    )
    .eq("id", params.id)
    .maybeSingle();

  if (error) {
    console.error("[marketplace/services/:id] get error", error);
    return NextResponse.json({ error: "Failed to load service" }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json({ service: data });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  if (!isUuid(params.id)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }
  const supabase = createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: PatchBody;
  try {
    body = (await request.json()) as PatchBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  // RLS already gates ownership but we still scope explicitly with .eq() for
  // defense-in-depth.
  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };

  if (body.title !== undefined) {
    if (typeof body.title !== "string" || !body.title.trim() || body.title.length > 200) {
      return NextResponse.json({ error: "Invalid title" }, { status: 400 });
    }
    updates.title = body.title.trim();
  }
  if (body.description !== undefined) {
    if (
      typeof body.description !== "string" ||
      !body.description.trim() ||
      body.description.length > 5000
    ) {
      return NextResponse.json({ error: "Invalid description" }, { status: 400 });
    }
    updates.description = body.description.trim();
  }
  if (body.category !== undefined) {
    const cat = typeof body.category === "string" ? body.category.toLowerCase().trim() : "";
    if (!ALLOWED_CATEGORIES.has(cat)) {
      return NextResponse.json({ error: "Invalid category" }, { status: 400 });
    }
    updates.category = cat;
  }
  if (body.price_cents !== undefined) {
    const n = Number(body.price_cents);
    if (!Number.isFinite(n) || n < 100 || n > 5_000_000) {
      return NextResponse.json({ error: "Invalid price_cents" }, { status: 400 });
    }
    updates.price_cents = Math.floor(n);
  }
  if (body.delivery_days !== undefined) {
    const n = Number(body.delivery_days);
    if (!Number.isFinite(n) || n < 1 || n > 365) {
      return NextResponse.json({ error: "Invalid delivery_days" }, { status: 400 });
    }
    updates.delivery_days = Math.floor(n);
  }
  if (body.status !== undefined) {
    const s = typeof body.status === "string" ? body.status.toLowerCase().trim() : "";
    if (!ALLOWED_STATUSES.has(s)) {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 });
    }
    updates.status = s;
  }

  const { data, error } = await supabase
    .from("marketplace_services")
    .update(updates)
    .eq("id", params.id)
    .eq("user_id", user.id)
    .select(
      "id, user_id, title, description, category, price_cents, currency, delivery_days, status, created_at",
    )
    .maybeSingle();

  if (error) {
    console.error("[marketplace/services/:id] update error", error);
    return NextResponse.json({ error: "Failed to update service" }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ error: "Not found or forbidden" }, { status: 404 });
  }
  return NextResponse.json({ service: data });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } },
) {
  if (!isUuid(params.id)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }
  const supabase = createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Soft-close instead of hard delete so existing orders keep referential
  // integrity.  The migration uses ON DELETE RESTRICT on orders.service_id.
  const { data, error } = await supabase
    .from("marketplace_services")
    .update({ status: "closed", updated_at: new Date().toISOString() })
    .eq("id", params.id)
    .eq("user_id", user.id)
    .select("id, status")
    .maybeSingle();

  if (error) {
    console.error("[marketplace/services/:id] delete error", error);
    return NextResponse.json({ error: "Failed to close service" }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ error: "Not found or forbidden" }, { status: 404 });
  }
  return NextResponse.json({ ok: true, service: data });
}
