import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase, createServiceClient } from "@/lib/supabase/server";
import { getEffectiveOrgId } from "@/lib/assets/helpers";

export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const orgId = await getEffectiveOrgId(supabase, user.id);
  const service = createServiceClient();

  const { data: collections, error } = await service
    .from("asset_collections")
    .select("*")
    .eq("org_id", orgId)
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const ids = (collections || []).map((c) => c.id as string);
  let counts: Record<string, number> = {};
  if (ids.length) {
    const { data: items } = await service
      .from("asset_collection_items")
      .select("collection_id")
      .in("collection_id", ids);
    counts = (items || []).reduce<Record<string, number>>((acc, row) => {
      const cid = row.collection_id as string;
      acc[cid] = (acc[cid] || 0) + 1;
      return acc;
    }, {});
  }

  return NextResponse.json({
    collections: (collections || []).map((c) => ({
      ...c,
      item_count: counts[c.id as string] || 0,
    })),
  });
}

export async function POST(req: NextRequest) {
  const supabase = createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const orgId = await getEffectiveOrgId(supabase, user.id);
  const body = await req.json().catch(() => ({} as Record<string, unknown>));
  const name = String(body.name || "").trim();
  if (!name) return NextResponse.json({ error: "Name required" }, { status: 400 });

  const service = createServiceClient();
  const { data, error } = await service
    .from("asset_collections")
    .insert({
      org_id: orgId,
      name,
      description: body.description ?? null,
      created_by: user.id,
    })
    .select("*")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ collection: data }, { status: 201 });
}
