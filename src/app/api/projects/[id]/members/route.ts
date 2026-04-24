import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

/**
 * GET /api/projects/[id]/members — list members of a project.
 * RLS: callers must be a member themselves (or owner/lead) to see the list.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } },
) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data, error } = await supabase
    .from("project_members")
    .select("*")
    .eq("project_id", params.id)
    .order("added_at", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ members: data ?? [] });
}

/**
 * POST /api/projects/[id]/members — add a member to a project.
 * Body: { user_id, role? }
 * RLS: owners/leads only.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: { user_id?: unknown; role?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const userId = typeof body.user_id === "string" ? body.user_id : "";
  if (!userId) return NextResponse.json({ error: "user_id is required" }, { status: 400 });

  const allowedRoles = ["lead", "contributor", "freelancer", "client", "viewer"];
  const role = typeof body.role === "string" && allowedRoles.includes(body.role)
    ? body.role
    : "contributor";

  const { data, error } = await supabase
    .from("project_members")
    .insert({
      project_id: params.id,
      user_id: userId,
      role,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ member: data }, { status: 201 });
}

/**
 * DELETE /api/projects/[id]/members?user_id=xxx — remove a member.
 * RLS: owners/leads only.
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const userId = searchParams.get("user_id");
  if (!userId) {
    return NextResponse.json({ error: "user_id query param is required" }, { status: 400 });
  }

  const { error } = await supabase
    .from("project_members")
    .delete()
    .eq("project_id", params.id)
    .eq("user_id", userId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
