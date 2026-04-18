import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { getEffectiveOwnerId } from "@/lib/security/require-owned-client";

export async function GET() {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const ownerId = (await getEffectiveOwnerId(supabase, user.id)) || user.id;

  const { data, error } = await supabase
    .from("software_subscriptions")
    .select("*")
    .eq("profile_id", ownerId)
    .order("cost_monthly", { ascending: false });

  if (error) return NextResponse.json({ subscriptions: [], error: error.message });
  return NextResponse.json({ subscriptions: data || [] });
}

export async function POST(req: NextRequest) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const ownerId = (await getEffectiveOwnerId(supabase, user.id)) || user.id;

  const body = await req.json();
  const row = {
    profile_id: ownerId,
    tool_name: body.tool_name,
    category: body.category || "Other",
    cost_monthly: body.cost_monthly || 0,
    cost_annual: body.cost_annual || (body.cost_monthly || 0) * 12,
    billing_cycle: body.billing_cycle || "monthly",
    next_charge_date: body.next_charge_date || null,
    used_by: body.used_by || "me",
    status: body.status || "active",
    logo_url: body.logo_url || null,
    website_url: body.website_url || null,
    notes: body.notes || null,
    tags: body.tags || [],
  };

  const { data, error } = await supabase
    .from("software_subscriptions")
    .insert(row)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true, subscription: data });
}
