import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase, createServiceClient } from "@/lib/supabase/server";
import { getEffectiveOrgId } from "@/lib/assets/helpers";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest, ctx: { params: { id: string } }) {
  const supabase = createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const orgId = await getEffectiveOrgId(supabase, user.id);
  const body = await req.json().catch(() => ({} as Record<string, unknown>));

  const service = createServiceClient();
  const { data: coll } = await service
    .from("asset_collections")
    .select("id, org_id")
    .eq("id", ctx.params.id)
    .eq("org_id", orgId)
    .maybeSingle();
  if (!coll) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const assetIds = Array.isArray(body.asset_ids)
    ? (body.asset_ids as string[])
    : body.asset_id
      ? [String(body.asset_id)]
      : [];
  if (!assetIds.length) return NextResponse.json({ error: "No asset_ids" }, { status: 400 });

  const { data: valid } = await service
    .from("assets")
    .select("id")
    .in("id", assetIds)
    .eq("org_id", orgId);
  const validIds = (valid || []).map((r) => r.id as string);
  if (!validIds.length) return NextResponse.json({ error: "No matching assets" }, { status: 404 });

  const { data: last } = await service
    .from("asset_collection_items")
    .select("position")
    .eq("collection_id", ctx.params.id)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();
  let position = last ? (last.position as number) + 1 : 0;

  const rows = validIds.map((id) => ({
    collection_id: ctx.params.id,
    asset_id: id,
    position: position++,
  }));

  const { error } = await service
    .from("asset_collection_items")
    .upsert(rows, { onConflict: "collection_id,asset_id" });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, added: validIds.length });
}

export async function PATCH(req: NextRequest, ctx: { params: { id: string } }) {
  const supabase = createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const orgId = await getEffectiveOrgId(supabase, user.id);
  const body = await req.json().catch(() => ({} as Record<string, unknown>));
  const order = Array.isArray(body.order)
    ? (body.order as { asset_id: string; position: number }[])
    : [];
  if (!order.length) return NextResponse.json({ error: "No order provided" }, { status: 400 });

  const service = createServiceClient();
  const { data: coll } = await service
    .from("asset_collections")
    .select("id")
    .eq("id", ctx.params.id)
    .eq("org_id", orgId)
    .maybeSingle();
  if (!coll) return NextResponse.json({ error: "Not found" }, { status: 404 });

  for (const row of order) {
    if (!row.asset_id) continue;
    await service
      .from("asset_collection_items")
      .update({ position: row.position })
      .eq("collection_id", ctx.params.id)
      .eq("asset_id", row.asset_id);
  }

  return NextResponse.json({ ok: true, reordered: order.length });
}

export async function DELETE(req: NextRequest, ctx: { params: { id: string } }) {
  const supabase = createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const orgId = await getEffectiveOrgId(supabase, user.id);

  const qsId = req.nextUrl.searchParams.get("asset_id");
  let ids: string[] = qsId ? [qsId] : [];
  if (!ids.length) {
    const body = await req.json().catch(() => ({} as Record<string, unknown>));
    if (Array.isArray(body.asset_ids)) ids = body.asset_ids as string[];
  }
  if (!ids.length) return NextResponse.json({ error: "No asset_id(s)" }, { status: 400 });

  const service = createServiceClient();
  const { data: coll } = await service
    .from("asset_collections")
    .select("id")
    .eq("id", ctx.params.id)
    .eq("org_id", orgId)
    .maybeSingle();
  if (!coll) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { error } = await service
    .from("asset_collection_items")
    .delete()
    .eq("collection_id", ctx.params.id)
    .in("asset_id", ids);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, removed: ids.length });
}
