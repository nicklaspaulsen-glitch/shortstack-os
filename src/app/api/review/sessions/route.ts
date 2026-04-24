import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import type { ReviewAssetType } from "@/lib/review/types";

const ASSET_TYPES: ReviewAssetType[] = ["video", "image", "pdf", "audio"];

// GET /api/review/sessions — list sessions created by caller, optional filter
// by project_id and status.
export async function GET(request: NextRequest) {
  const supabase = createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const projectId = searchParams.get("project_id");
  const status = searchParams.get("status");

  let query = supabase
    .from("review_sessions")
    .select("*")
    .eq("created_by", user.id)
    .order("created_at", { ascending: false });

  if (projectId) query = query.eq("project_id", projectId);
  if (status) query = query.eq("status", status);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ sessions: data ?? [] });
}

// POST /api/review/sessions — create a new review session.
// Body: { title, asset_url, asset_type, project_id? }
export async function POST(request: NextRequest) {
  const supabase = createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: {
    title?: unknown;
    asset_url?: unknown;
    asset_type?: unknown;
    project_id?: unknown;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const title = typeof body.title === "string" ? body.title.trim() : "";
  const assetUrl = typeof body.asset_url === "string" ? body.asset_url.trim() : "";
  const assetType = typeof body.asset_type === "string" ? body.asset_type : "";
  const projectId = typeof body.project_id === "string" ? body.project_id : null;

  if (!title) return NextResponse.json({ error: "title is required" }, { status: 400 });
  if (!assetUrl) return NextResponse.json({ error: "asset_url is required" }, { status: 400 });
  if (!ASSET_TYPES.includes(assetType as ReviewAssetType)) {
    return NextResponse.json({ error: "asset_type must be one of video/image/pdf/audio" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("review_sessions")
    .insert({
      title,
      asset_url: assetUrl,
      asset_type: assetType,
      project_id: projectId,
      created_by: user.id,
      version: 1,
      status: "pending",
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Also insert version 1 into review_versions
  if (data) {
    await supabase.from("review_versions").insert({
      session_id: data.id,
      version: 1,
      asset_url: assetUrl,
      uploaded_by: user.id,
      release_notes: null,
    });
  }

  return NextResponse.json({ session: data }, { status: 201 });
}
