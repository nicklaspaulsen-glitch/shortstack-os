/**
 * Services API — CRUD over `services` table (agency service catalog).
 */
import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { getEffectiveOwnerId } from "@/lib/security/require-owned-client";

const VALID_INTERVALS = [
  "one_time",
  "monthly",
  "quarterly",
  "yearly",
  "hourly",
  "per_project",
];

export async function GET() {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const ownerId = (await getEffectiveOwnerId(supabase, user.id)) || user.id;

  const { data, error } = await supabase
    .from("services")
    .select("*")
    .eq("user_id", ownerId)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ services: data ?? [] });
}

export async function POST(request: NextRequest) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const ownerId = (await getEffectiveOwnerId(supabase, user.id)) || user.id;

  const body = await request.json();
  const {
    name,
    description,
    price_cents,
    billing_interval,
    is_active,
    include_in_proposals,
    sort_order,
  } = body ?? {};

  if (!name || typeof name !== "string") {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }
  const interval = billing_interval && VALID_INTERVALS.includes(billing_interval)
    ? billing_interval
    : "one_time";

  const { data, error } = await supabase
    .from("services")
    .insert({
      user_id: ownerId,
      name: name.trim(),
      description: description || null,
      price_cents: Number.isFinite(Number(price_cents)) ? Number(price_cents) : 0,
      billing_interval: interval,
      is_active: is_active ?? true,
      include_in_proposals: include_in_proposals ?? true,
      sort_order: Number.isFinite(Number(sort_order)) ? Number(sort_order) : 0,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ service: data }, { status: 201 });
}

export async function PATCH(request: NextRequest) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const ownerId = (await getEffectiveOwnerId(supabase, user.id)) || user.id;

  const body = await request.json();
  const { id, ...updates } = body ?? {};
  if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });

  const allowed = [
    "name",
    "description",
    "price_cents",
    "billing_interval",
    "is_active",
    "include_in_proposals",
    "sort_order",
  ];
  const safe: Record<string, unknown> = {};
  for (const k of allowed) if (k in updates) safe[k] = updates[k];
  if ("billing_interval" in safe && !VALID_INTERVALS.includes(safe.billing_interval as string)) {
    return NextResponse.json({ error: "invalid billing_interval" }, { status: 400 });
  }
  if (Object.keys(safe).length === 0) {
    return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
  }
  safe.updated_at = new Date().toISOString();

  const { data, error } = await supabase
    .from("services")
    .update(safe)
    .eq("id", id)
    .eq("user_id", ownerId)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ service: data });
}

export async function DELETE(request: NextRequest) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const ownerId = (await getEffectiveOwnerId(supabase, user.id)) || user.id;

  const { id } = await request.json();
  if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });

  const { error } = await supabase
    .from("services")
    .delete()
    .eq("id", id)
    .eq("user_id", ownerId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
