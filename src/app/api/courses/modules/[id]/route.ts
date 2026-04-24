import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { getEffectiveOwnerId } from "@/lib/security/require-owned-client";

type Params = { params: { id: string } };

// PUT /api/courses/modules/[id]
export async function PUT(request: NextRequest, { params }: Params) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const ownerId = (await getEffectiveOwnerId(supabase, user.id)) || user.id;

  // Verify ownership via course chain
  const { data: mod } = await supabase
    .from("course_modules")
    .select("id, course_id")
    .eq("id", params.id)
    .single();
  if (!mod) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { data: course } = await supabase
    .from("courses")
    .select("id")
    .eq("id", mod.course_id)
    .eq("profile_id", ownerId)
    .single();
  if (!course) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await request.json() as Record<string, unknown>;
  const allowed = ["title", "description", "sort_order", "is_free_preview"];
  const updates: Record<string, unknown> = {};
  for (const key of allowed) {
    if (key in body) updates[key] = body[key];
  }

  const { data, error } = await supabase
    .from("course_modules")
    .update(updates)
    .eq("id", params.id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ module: data });
}

// DELETE /api/courses/modules/[id]
export async function DELETE(_req: NextRequest, { params }: Params) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const ownerId = (await getEffectiveOwnerId(supabase, user.id)) || user.id;

  const { data: mod } = await supabase
    .from("course_modules")
    .select("id, course_id")
    .eq("id", params.id)
    .single();
  if (!mod) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { data: course } = await supabase
    .from("courses")
    .select("id")
    .eq("id", mod.course_id)
    .eq("profile_id", ownerId)
    .single();
  if (!course) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { error } = await supabase.from("course_modules").delete().eq("id", params.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
