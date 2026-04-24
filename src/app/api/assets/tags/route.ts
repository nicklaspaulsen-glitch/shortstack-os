import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase, createServiceClient } from "@/lib/supabase/server";
import { getEffectiveOrgId } from "@/lib/assets/helpers";

export const dynamic = "force-dynamic";

// GET /api/assets/tags
export async function GET(req: NextRequest) {
  const supabase = createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const orgId = await getEffectiveOrgId(supabase, user.id);
  const q = req.nextUrl.searchParams.get("q")?.trim() || "";

  const service = createServiceClient();
  let query = service.from("asset_tags").select("*").eq("org_id", orgId).order("name");
  if (q) query = query.ilike("name", `%${q}%`);
  const { data, error } = await query.limit(50);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ tags: data || [] });
}

// POST /api/assets/tags
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
  const color = typeof body.color === "string" ? body.color : "#C9A84C";

  const service = createServiceClient();
  const { data, error } = await service
    .from("asset_tags")
    .upsert({ org_id: orgId, name, color }, { onConflict: "org_id,name" })
    .select("*")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ tag: data }, { status: 201 });
}
