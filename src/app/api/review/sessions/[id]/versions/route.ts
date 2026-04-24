import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

// GET /api/review/sessions/[id]/versions
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Verify session ownership
  const { data: session } = await supabase
    .from("review_sessions")
    .select("id, created_by")
    .eq("id", params.id)
    .single();
  if (!session) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (session.created_by !== user.id)
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { data, error } = await supabase
    .from("review_versions")
    .select("*")
    .eq("session_id", params.id)
    .order("version", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ versions: data ?? [] });
}

// POST /api/review/sessions/[id]/versions — upload a new version
// Body: { asset_url, release_notes? }
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  const supabase = createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: session } = await supabase
    .from("review_sessions")
    .select("id, created_by, version")
    .eq("id", params.id)
    .single();
  if (!session) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (session.created_by !== user.id)
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  let body: { asset_url?: unknown; release_notes?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const assetUrl = typeof body.asset_url === "string" ? body.asset_url.trim() : "";
  if (!assetUrl) return NextResponse.json({ error: "asset_url is required" }, { status: 400 });
  const releaseNotes =
    typeof body.release_notes === "string" ? body.release_notes : null;

  const nextVersion = (session.version ?? 1) + 1;

  const { data: ver, error: verErr } = await supabase
    .from("review_versions")
    .insert({
      session_id: params.id,
      version: nextVersion,
      asset_url: assetUrl,
      uploaded_by: user.id,
      release_notes: releaseNotes,
    })
    .select()
    .single();
  if (verErr) return NextResponse.json({ error: verErr.message }, { status: 500 });

  // Update the session's current version and asset_url pointer, re-enter review
  const { error: updErr } = await supabase
    .from("review_sessions")
    .update({
      version: nextVersion,
      asset_url: assetUrl,
      status: "in_review",
    })
    .eq("id", params.id);
  if (updErr) return NextResponse.json({ error: updErr.message }, { status: 500 });

  return NextResponse.json({ version: ver }, { status: 201 });
}
