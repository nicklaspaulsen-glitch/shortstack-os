import { NextResponse } from "next/server";
import { createServerSupabase, createServiceClient } from "@/lib/supabase/server";
import { getEffectiveOwnerId } from "@/lib/security/require-owned-client";

export async function GET() {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const ownerId = await getEffectiveOwnerId(supabase, user.id);
  if (!ownerId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const service = createServiceClient();
  const { data, error } = await service
    .from("subaccounts")
    .select("*")
    .eq("parent_user_id", ownerId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[subaccounts] GET error:", error);
    return NextResponse.json({ error: "Failed to load subaccounts" }, { status: 500 });
  }

  const total = data?.length ?? 0;
  const active = data?.filter((s) => s.status === "active").length ?? 0;
  const mrrCents = data
    ?.filter((s) => s.status === "active")
    .reduce((sum: number, s) => sum + (s.monthly_amount_cents ?? 0), 0) ?? 0;

  return NextResponse.json({
    subaccounts: data ?? [],
    stats: { total, active, mrr_cents: mrrCents },
  });
}

export async function POST(req: Request) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const ownerId = await getEffectiveOwnerId(supabase, user.id);
  if (!ownerId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  let body: {
    email?: string;
    name?: string;
    plan_tier?: string;
    monthly_amount_cents?: number;
    client_id?: string | null;
  };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 }); }

  const email = (body.email || "").trim().toLowerCase();
  const name = (body.name || "").trim();
  const plan_tier = (body.plan_tier || "").trim();
  const monthly_amount_cents = Number.isFinite(body.monthly_amount_cents)
    ? Math.max(0, Math.floor(body.monthly_amount_cents as number))
    : 0;
  const client_id = body.client_id || null;

  if (!email || !/^\S+@\S+\.\S+$/.test(email)) return NextResponse.json({ error: "Valid email required" }, { status: 400 });
  if (!name) return NextResponse.json({ error: "Name required" }, { status: 400 });
  if (!plan_tier) return NextResponse.json({ error: "Plan tier required" }, { status: 400 });

  const service = createServiceClient();

  if (client_id) {
    const { data: c } = await service
      .from("clients")
      .select("id, profile_id")
      .eq("id", client_id)
      .maybeSingle();
    if (!c || c.profile_id !== ownerId) {
      return NextResponse.json({ error: "client_id does not belong to this account" }, { status: 403 });
    }
  }

  const { data, error } = await service
    .from("subaccounts")
    .insert({
      parent_user_id: ownerId,
      client_id,
      email,
      name,
      plan_tier,
      monthly_amount_cents,
      status: "pending",
    })
    .select("*")
    .single();

  if (error) {
    console.error("[subaccounts] POST error:", error);
    return NextResponse.json({ error: error.message || "Failed to create subaccount" }, { status: 500 });
  }

  return NextResponse.json({ subaccount: data }, { status: 201 });
}
