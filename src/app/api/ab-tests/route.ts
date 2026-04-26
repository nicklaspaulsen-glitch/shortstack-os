/**
 * A/B Tests — list and create.
 *
 * Owner-scoped. A test is anchored to a `parent_type` ('landing_page',
 * 'funnel_step', 'email') + `parent_id`. Variants live in `ab_variants`.
 */
import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { getEffectiveOwnerId } from "@/lib/security/require-owned-client";

export const dynamic = "force-dynamic";

const ALLOWED_PARENTS = new Set(["landing_page", "funnel_step", "email"]);

export async function GET(req: NextRequest) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const ownerId = (await getEffectiveOwnerId(supabase, user.id)) ?? user.id;

  const { searchParams } = new URL(req.url);
  const parentType = searchParams.get("parent_type");
  const parentId = searchParams.get("parent_id");

  let query = supabase
    .from("ab_tests")
    .select("*, ab_variants(id, variant_key, content, views, conversions)")
    .eq("user_id", ownerId)
    .order("started_at", { ascending: false });

  if (parentType) query = query.eq("parent_type", parentType);
  if (parentId) query = query.eq("parent_id", parentId);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ tests: data ?? [] });
}

export async function POST(req: NextRequest) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const ownerId = (await getEffectiveOwnerId(supabase, user.id)) ?? user.id;

  const body = (await req.json()) as {
    name?: string;
    parent_type?: string;
    parent_id?: string;
    traffic_split?: Record<string, number>;
    variants?: Array<{ variant_key?: string; content?: Record<string, unknown> }>;
  };

  if (!body.name?.trim()) {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }
  if (!body.parent_type || !ALLOWED_PARENTS.has(body.parent_type)) {
    return NextResponse.json({ error: "Invalid parent_type" }, { status: 400 });
  }
  if (!body.parent_id) {
    return NextResponse.json({ error: "parent_id is required" }, { status: 400 });
  }

  const { data: test, error } = await supabase
    .from("ab_tests")
    .insert({
      user_id: ownerId,
      parent_type: body.parent_type,
      parent_id: body.parent_id,
      name: body.name.trim(),
      traffic_split: body.traffic_split ?? { A: 50, B: 50 },
    })
    .select()
    .single();

  if (error || !test) {
    return NextResponse.json({ error: error?.message ?? "Insert failed" }, { status: 500 });
  }

  const seeds = body.variants?.length
    ? body.variants
    : [
        { variant_key: "A", content: {} },
        { variant_key: "B", content: {} },
      ];

  const variantRows = seeds.map((v) => ({
    test_id: test.id,
    variant_key: (v.variant_key ?? "").trim() || "A",
    content: v.content ?? {},
  }));

  const { data: variants, error: vErr } = await supabase
    .from("ab_variants")
    .insert(variantRows)
    .select();

  if (vErr) {
    await supabase.from("ab_tests").delete().eq("id", test.id);
    return NextResponse.json({ error: vErr.message }, { status: 500 });
  }

  return NextResponse.json({ test: { ...test, ab_variants: variants ?? [] } }, { status: 201 });
}
