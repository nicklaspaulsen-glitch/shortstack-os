import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { getEffectiveOwnerId } from "@/lib/security/require-owned-client";

type Params = { params: { id: string } };

async function assertLessonOwner(
  supabase: ReturnType<typeof createServerSupabase>,
  lessonId: string,
  ownerId: string,
) {
  const { data: lesson } = await supabase
    .from("course_lessons")
    .select("module_id")
    .eq("id", lessonId)
    .single();
  if (!lesson) return false;

  const { data: mod } = await supabase
    .from("course_modules")
    .select("course_id")
    .eq("id", lesson.module_id)
    .single();
  if (!mod) return false;

  const { data: course } = await supabase
    .from("courses")
    .select("id")
    .eq("id", mod.course_id)
    .eq("profile_id", ownerId)
    .single();
  return !!course;
}

// PUT /api/courses/lessons/[id]
export async function PUT(request: NextRequest, { params }: Params) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const ownerId = (await getEffectiveOwnerId(supabase, user.id)) || user.id;
  if (!await assertLessonOwner(supabase, params.id, ownerId)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json() as Record<string, unknown>;
  const allowed = [
    "title","content_type","content_url","content_body",
    "duration_seconds","sort_order","is_free_preview","drip_delay_days",
  ];
  const updates: Record<string, unknown> = {};
  for (const key of allowed) {
    if (key in body) updates[key] = body[key];
  }

  const { data, error } = await supabase
    .from("course_lessons")
    .update(updates)
    .eq("id", params.id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ lesson: data });
}

// DELETE /api/courses/lessons/[id]
export async function DELETE(_req: NextRequest, { params }: Params) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const ownerId = (await getEffectiveOwnerId(supabase, user.id)) || user.id;
  if (!await assertLessonOwner(supabase, params.id, ownerId)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { error } = await supabase.from("course_lessons").delete().eq("id", params.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
