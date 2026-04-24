import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase, createServiceClient } from "@/lib/supabase/server";
import { getEffectiveOrgId } from "@/lib/assets/helpers";

export const dynamic = "force-dynamic";

const TARGET_ROUTES: Record<string, string> = {
  "thumbnail-generator": "/dashboard/thumbnail-generator",
  "ai-video": "/dashboard/ai-video",
  "copywriter": "/dashboard/copywriter",
  "ai-studio": "/dashboard/ai-studio",
  "carousel-generator": "/dashboard/carousel-generator",
};

// POST /api/assets/[id]/derive
export async function POST(req: NextRequest, ctx: { params: { id: string } }) {
  const supabase = createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const orgId = await getEffectiveOrgId(supabase, user.id);
  const body = await req.json().catch(() => ({} as Record<string, unknown>));
  const target = String(body.target || "").trim();

  if (!TARGET_ROUTES[target]) {
    return NextResponse.json(
      { error: "Invalid target", valid: Object.keys(TARGET_ROUTES) },
      { status: 400 },
    );
  }

  const service = createServiceClient();
  const { data: source } = await service
    .from("assets")
    .select("*")
    .eq("id", ctx.params.id)
    .eq("org_id", orgId)
    .is("deleted_at", null)
    .maybeSingle();

  if (!source) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const redirect = `${TARGET_ROUTES[target]}?source=${encodeURIComponent(source.id)}`;

  return NextResponse.json({
    ok: true,
    target,
    redirect,
    source_asset_id: source.id,
  });
}
