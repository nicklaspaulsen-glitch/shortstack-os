/**
 * Meetings — detail / update / delete.
 *
 * GET    /api/meetings/[id]  → full record (including transcript JSON)
 * PATCH  /api/meetings/[id]  → update title/status/action_items (and a few more fields)
 * DELETE /api/meetings/[id]  → hard delete (CASCADE from auth.users handles audit)
 */
import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

const UPDATABLE_FIELDS = new Set([
  "title",
  "status",
  "scheduled_at",
  "started_at",
  "ended_at",
  "duration_seconds",
  "audio_url",
  "client_id",
  "transcript_raw",
  "transcript_speaker_labeled",
  "summary",
  "action_items",
  "decisions",
  "key_moments",
]);

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } },
) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data, error } = await supabase
    .from("meetings")
    .select("*")
    .eq("id", params.id)
    .eq("created_by", user.id)
    .maybeSingle();

  if (error) {
    console.error("[meetings] detail error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!data) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({ meeting: data });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const patch: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(body)) {
    if (UPDATABLE_FIELDS.has(key)) patch[key] = value;
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "No updatable fields provided" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("meetings")
    .update(patch)
    .eq("id", params.id)
    .eq("created_by", user.id)
    .select()
    .single();

  if (error) {
    console.error("[meetings] patch error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ meeting: data });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } },
) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { error } = await supabase
    .from("meetings")
    .delete()
    .eq("id", params.id)
    .eq("created_by", user.id);

  if (error) {
    console.error("[meetings] delete error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
