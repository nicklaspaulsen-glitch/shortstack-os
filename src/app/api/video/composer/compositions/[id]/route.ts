import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

// GET /api/video/composer/compositions/[id]
export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data, error } = await supabase
    .from("hyperframes_compositions")
    .select("*")
    .eq("id", params.id)
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 404 });
  }

  // Also fetch recent renders for this composition
  const { data: renders } = await supabase
    .from("hyperframes_renders")
    .select(
      "id, version, output_url, status, error, rendered_at, duration_seconds, file_size_bytes, asset_id, created_at"
    )
    .eq("composition_id", params.id)
    .order("version", { ascending: false })
    .limit(20);

  return NextResponse.json({ composition: data, renders: renders ?? [] });
}

// PATCH /api/video/composer/compositions/[id]
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json()) as Record<string, unknown>;

  // Whitelist mutable fields
  const allowed: Record<string, unknown> = {};
  for (const key of [
    "title",
    "html_source",
    "duration_seconds",
    "fps",
    "width",
    "height",
    "metadata",
    "project_id",
  ]) {
    if (key in body) allowed[key] = body[key];
  }

  if (Object.keys(allowed).length === 0) {
    return NextResponse.json({ error: "No updatable fields" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("hyperframes_compositions")
    .update(allowed)
    .eq("id", params.id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ composition: data });
}

// DELETE /api/video/composer/compositions/[id]
export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { error } = await supabase
    .from("hyperframes_compositions")
    .delete()
    .eq("id", params.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
