import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase, createServiceClient } from "@/lib/supabase/server";
import { getEffectiveOrgId, isOrgAdmin } from "@/lib/assets/helpers";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, ctx: { params: { id: string } }) {
  const supabase = createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const orgId = await getEffectiveOrgId(supabase, user.id);
  const service = createServiceClient();

  const { data: collection } = await service
    .from("asset_collections")
    .select("*")
    .eq("id", ctx.params.id)
    .eq("org_id", orgId)
    .maybeSingle();
  if (!collection) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { data: items } = await service
    .from("asset_collection_items")
    .select("collection_id, asset_id, position, added_at, assets:asset_id(*)")
    .eq("collection_id", ctx.params.id)
    .order("position", { ascending: true });

  return NextResponse.json({ collection, items: items || [] });
}

export async function PATCH(req: NextRequest, ctx: { params: { id: string } }) {
  const supabase = createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const orgId = await getEffectiveOrgId(supabase, user.id);
  const body = await req.json().catch(() => ({} as Record<string, unknown>));

  const service = createServiceClient();
  const { data: existing } = await service
    .from("asset_collections")
    .select("*")
    .eq("id", ctx.params.id)
    .eq("org_id", orgId)
    .maybeSingle();
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (existing.created_by !== user.id && !isOrgAdmin(user.id, orgId)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const patch: Record<string, unknown> = {};
  if (typeof body.name === "string") patch.name = body.name;
  if ("description" in body) patch.description = body.description;

  const { data, error } = await service
    .from("asset_collections")
    .update(patch)
    .eq("id", ctx.params.id)
    .select("*")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ collection: data });
}

export async function DELETE(_req: NextRequest, ctx: { params: { id: string } }) {
  const supabase = createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const orgId = await getEffectiveOrgId(supabase, user.id);
  const service = createServiceClient();
  const { data: existing } = await service
    .from("asset_collections")
    .select("*")
    .eq("id", ctx.params.id)
    .eq("org_id", orgId)
    .maybeSingle();
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (existing.created_by !== user.id && !isOrgAdmin(user.id, orgId)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { error } = await service.from("asset_collections").delete().eq("id", ctx.params.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
