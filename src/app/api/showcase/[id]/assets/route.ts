import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { getEffectiveOwnerId } from "@/lib/security/require-owned-client";

// GET /api/showcase/[id]/assets — list gallery assets (in position order).
export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } },
) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const ownerId = (await getEffectiveOwnerId(supabase, user.id)) || user.id;

  const { data: cs } = await supabase
    .from("case_studies")
    .select("id")
    .eq("id", params.id)
    .eq("org_id", ownerId)
    .single();
  if (!cs) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { data, error } = await supabase
    .from("case_study_assets")
    .select("*")
    .eq("case_study_id", params.id)
    .order("position", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ assets: data ?? [] });
}

// POST /api/showcase/[id]/assets — append one asset.
// Body: { asset_url, asset_type, caption? }
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const ownerId = (await getEffectiveOwnerId(supabase, user.id)) || user.id;

  const { data: cs } = await supabase
    .from("case_studies")
    .select("id")
    .eq("id", params.id)
    .eq("org_id", ownerId)
    .single();
  if (!cs) return NextResponse.json({ error: "Not found" }, { status: 404 });

  let body: { asset_url?: string; asset_type?: string; caption?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const assetUrl = typeof body.asset_url === "string" ? body.asset_url.trim() : "";
  const rawType = typeof body.asset_type === "string" ? body.asset_type : "";
  if (!assetUrl) return NextResponse.json({ error: "asset_url is required" }, { status: 400 });
  if (!["image", "video", "embed"].includes(rawType)) {
    return NextResponse.json({ error: "asset_type must be image|video|embed" }, { status: 400 });
  }

  // Determine next position.
  const { data: existing } = await supabase
    .from("case_study_assets")
    .select("position")
    .eq("case_study_id", params.id)
    .order("position", { ascending: false })
    .limit(1);
  const nextPos = existing && existing.length ? (existing[0].position as number) + 1 : 0;

  const { data, error } = await supabase
    .from("case_study_assets")
    .insert({
      case_study_id: params.id,
      asset_url: assetUrl,
      asset_type: rawType,
      caption: typeof body.caption === "string" ? body.caption : null,
      position: nextPos,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ asset: data }, { status: 201 });
}

// PATCH /api/showcase/[id]/assets — reorder assets.
// Body: { order: [asset_id_in_new_order, ...] }  OR  { updates: [{id, caption?}] }
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const ownerId = (await getEffectiveOwnerId(supabase, user.id)) || user.id;

  const { data: cs } = await supabase
    .from("case_studies")
    .select("id")
    .eq("id", params.id)
    .eq("org_id", ownerId)
    .single();
  if (!cs) return NextResponse.json({ error: "Not found" }, { status: 404 });

  let body: { order?: string[]; updates?: Array<{ id: string; caption?: string }> };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  // Reorder: two-phase (offset to avoid UNIQUE(case_study_id, position) collisions).
  if (Array.isArray(body.order) && body.order.length) {
    const ids = body.order.filter((x) => typeof x === "string");
    // Phase A: park into high negative-style positions (offset by 10000).
    for (let i = 0; i < ids.length; i++) {
      const { error } = await supabase
        .from("case_study_assets")
        .update({ position: 10000 + i })
        .eq("id", ids[i])
        .eq("case_study_id", params.id);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    }
    // Phase B: write final positions 0..n-1.
    for (let i = 0; i < ids.length; i++) {
      const { error } = await supabase
        .from("case_study_assets")
        .update({ position: i })
        .eq("id", ids[i])
        .eq("case_study_id", params.id);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    }
  }

  // Caption updates.
  if (Array.isArray(body.updates)) {
    for (const u of body.updates) {
      if (!u || typeof u.id !== "string") continue;
      const updates: Record<string, unknown> = {};
      if (typeof u.caption === "string") updates.caption = u.caption;
      if (!Object.keys(updates).length) continue;
      const { error } = await supabase
        .from("case_study_assets")
        .update(updates)
        .eq("id", u.id)
        .eq("case_study_id", params.id);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    }
  }

  const { data: fresh } = await supabase
    .from("case_study_assets")
    .select("*")
    .eq("case_study_id", params.id)
    .order("position", { ascending: true });

  return NextResponse.json({ assets: fresh ?? [] });
}

// DELETE /api/showcase/[id]/assets?asset_id=xxx
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const ownerId = (await getEffectiveOwnerId(supabase, user.id)) || user.id;

  const { data: cs } = await supabase
    .from("case_studies")
    .select("id")
    .eq("id", params.id)
    .eq("org_id", ownerId)
    .single();
  if (!cs) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { searchParams } = new URL(request.url);
  const assetId = searchParams.get("asset_id");
  if (!assetId) return NextResponse.json({ error: "asset_id required" }, { status: 400 });

  const { error } = await supabase
    .from("case_study_assets")
    .delete()
    .eq("id", assetId)
    .eq("case_study_id", params.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
