import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase, createServiceClient } from "@/lib/supabase/server";
import {
  ASSET_SOURCES,
  ASSET_TYPES,
  getEffectiveOrgId,
  type AssetSource,
  type AssetType,
} from "@/lib/assets/helpers";

export const dynamic = "force-dynamic";

// GET /api/assets — search + paginate
export async function GET(req: NextRequest) {
  const supabase = createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const orgId = await getEffectiveOrgId(supabase, user.id);
  const sp = req.nextUrl.searchParams;

  const q = sp.get("q")?.trim() || "";
  const types = (sp.get("types") || "")
    .split(",")
    .map((s) => s.trim())
    .filter((s): s is AssetType => (ASSET_TYPES as readonly string[]).includes(s));
  const tags = (sp.get("tags") || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const sources = (sp.get("sources") || "")
    .split(",")
    .map((s) => s.trim())
    .filter((s): s is AssetSource => (ASSET_SOURCES as readonly string[]).includes(s));
  const projectId = sp.get("project_id") || null;
  const dateFrom = sp.get("date_from");
  const dateTo = sp.get("date_to");
  const limit = Math.min(100, Math.max(1, Number(sp.get("limit") || 40)));
  const offset = Math.max(0, Number(sp.get("offset") || 0));
  const sort = sp.get("sort") || "created_at";

  const service = createServiceClient();
  let query = service
    .from("assets")
    .select("*", { count: "exact" })
    .eq("org_id", orgId)
    .is("deleted_at", null);

  if (types.length) query = query.in("asset_type", types);
  if (sources.length) query = query.in("source", sources);
  if (tags.length) query = query.contains("tags", tags);
  if (projectId) query = query.eq("project_id", projectId);
  if (dateFrom) query = query.gte("created_at", dateFrom);
  if (dateTo) query = query.lte("created_at", dateTo);

  if (q) {
    const safe = q.replace(/[^a-zA-Z0-9 ]/g, " ").trim();
    if (safe) {
      query = query.textSearch("tsv", safe, { type: "websearch", config: "english" });
    }
  }

  if (sort === "size") query = query.order("size_bytes", { ascending: false });
  else if (sort === "filename") query = query.order("filename", { ascending: true });
  else query = query.order("created_at", { ascending: false });

  query = query.range(offset, offset + limit - 1);

  const { data, error, count } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({
    assets: data || [],
    total: count ?? 0,
    limit,
    offset,
    has_more: (count ?? 0) > offset + (data?.length || 0),
  });
}

// POST /api/assets — create
export async function POST(req: NextRequest) {
  const supabase = createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const orgId = await getEffectiveOrgId(supabase, user.id);
  const body = await req.json().catch(() => ({} as Record<string, unknown>));

  const asset_type = body.asset_type as AssetType;
  const source = body.source as AssetSource;
  if (!(ASSET_TYPES as readonly string[]).includes(asset_type)) {
    return NextResponse.json({ error: "Invalid asset_type" }, { status: 400 });
  }
  if (!(ASSET_SOURCES as readonly string[]).includes(source)) {
    return NextResponse.json({ error: "Invalid source" }, { status: 400 });
  }

  const service = createServiceClient();
  const { data, error } = await service
    .from("assets")
    .insert({
      org_id: orgId,
      project_id: body.project_id ?? null,
      asset_type,
      source,
      storage_url: body.storage_url ?? null,
      thumbnail_url: body.thumbnail_url ?? null,
      filename: body.filename ?? null,
      mime_type: body.mime_type ?? null,
      size_bytes: body.size_bytes ?? 0,
      tags: Array.isArray(body.tags) ? body.tags : [],
      description: body.description ?? null,
      ai_metadata: body.ai_metadata ?? {},
      original_asset_id: body.original_asset_id ?? null,
      created_by: user.id,
    })
    .select("*")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ asset: data }, { status: 201 });
}
