import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

const ALLOWED_ASSET_TYPES = [
  "ai_generation",
  "invoice",
  "booking",
  "file",
  "hire",
  "message",
  "thumbnail",
  "video",
];

/**
 * GET /api/projects/[id]/assets — list assets attached to a project.
 * Optional ?asset_type=video filter.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const assetType = searchParams.get("asset_type");

  let query = supabase
    .from("project_assets")
    .select("*")
    .eq("project_id", params.id)
    .order("added_at", { ascending: false });

  if (assetType) query = query.eq("asset_type", assetType);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ assets: data ?? [] });
}

/**
 * POST /api/projects/[id]/assets — link an asset to a project.
 * Body: { asset_type, asset_id?, asset_table? }
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: { asset_type?: unknown; asset_id?: unknown; asset_table?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const assetType = typeof body.asset_type === "string" ? body.asset_type : "";
  if (!assetType || !ALLOWED_ASSET_TYPES.includes(assetType)) {
    return NextResponse.json({
      error: `asset_type required, one of: ${ALLOWED_ASSET_TYPES.join(", ")}`,
    }, { status: 400 });
  }

  const assetId = typeof body.asset_id === "string" ? body.asset_id : null;
  const assetTable = typeof body.asset_table === "string" ? body.asset_table : null;

  const { data, error } = await supabase
    .from("project_assets")
    .insert({
      project_id: params.id,
      asset_type: assetType,
      asset_id: assetId,
      asset_table: assetTable,
      added_by: user.id,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ asset: data }, { status: 201 });
}
