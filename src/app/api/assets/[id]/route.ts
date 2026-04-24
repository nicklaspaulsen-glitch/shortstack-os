import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase, createServiceClient } from "@/lib/supabase/server";
import { getEffectiveOrgId, isOrgAdmin } from "@/lib/assets/helpers";

export const dynamic = "force-dynamic";

async function load(id: string, orgId: string) {
  const service = createServiceClient();
  const { data } = await service
    .from("assets")
    .select("*")
    .eq("id", id)
    .eq("org_id", orgId)
    .maybeSingle();
  return data;
}

export async function GET(_req: NextRequest, ctx: { params: { id: string } }) {
  const supabase = createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const orgId = await getEffectiveOrgId(supabase, user.id);
  const asset = await load(ctx.params.id, orgId);
  if (!asset) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (asset.deleted_at) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const service = createServiceClient();
  const { data: derived } = await service
    .from("assets")
    .select("id, filename, asset_type, created_at")
    .eq("original_asset_id", asset.id)
    .is("deleted_at", null)
    .order("created_at", { ascending: false });

  let original = null;
  if (asset.original_asset_id) {
    const { data: orig } = await service
      .from("assets")
      .select("id, filename, asset_type, created_at")
      .eq("id", asset.original_asset_id)
      .maybeSingle();
    original = orig;
  }

  return NextResponse.json({ asset, original, derived: derived || [] });
}

export async function PATCH(req: NextRequest, ctx: { params: { id: string } }) {
  const supabase = createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const orgId = await getEffectiveOrgId(supabase, user.id);
  const existing = await load(ctx.params.id, orgId);
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (existing.created_by !== user.id && !isOrgAdmin(user.id, orgId)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({} as Record<string, unknown>));
  const patch: Record<string, unknown> = {};
  if (typeof body.description === "string" || body.description === null) patch.description = body.description;
  if (typeof body.filename === "string") patch.filename = body.filename;
  if (Array.isArray(body.tags)) patch.tags = body.tags;
  if ("project_id" in body) patch.project_id = body.project_id ?? null;
  if (body.ai_metadata && typeof body.ai_metadata === "object") patch.ai_metadata = body.ai_metadata;
  if (typeof body.thumbnail_url === "string" || body.thumbnail_url === null) patch.thumbnail_url = body.thumbnail_url;

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ asset: existing });
  }

  const service = createServiceClient();
  const { data, error } = await service
    .from("assets")
    .update(patch)
    .eq("id", ctx.params.id)
    .select("*")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ asset: data });
}

export async function DELETE(_req: NextRequest, ctx: { params: { id: string } }) {
  const supabase = createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const orgId = await getEffectiveOrgId(supabase, user.id);
  const existing = await load(ctx.params.id, orgId);
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (existing.created_by !== user.id && !isOrgAdmin(user.id, orgId)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const service = createServiceClient();
  const { error } = await service
    .from("assets")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", ctx.params.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
