import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { getEffectiveOwnerId } from "@/lib/security/require-owned-client";

type Params = { params: { id: string } };

/**
 * Verify the caller owns the lesson (via the lesson → module → course chain)
 * and return the lesson's module_id so writes can be scoped by it.
 *
 * Returns the module_id string if authorized, false otherwise.
 * Returning module_id (instead of just boolean) lets the caller add
 * .eq("module_id", moduleId) to every write, closing the TOCTOU window
 * between this ownership check and the subsequent mutation.
 */
async function getLessonModuleId(
  supabase: ReturnType<typeof createServerSupabase>,
  lessonId: string,
  ownerId: string,
): Promise<string | false> {
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
  return course ? lesson.module_id : false;
}

// PUT /api/courses/lessons/[id]
export async function PUT(request: NextRequest, { params }: Params) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Apr 28: removed `|| user.id` fallback — null = suspended team_member.


  const ownerId = await getEffectiveOwnerId(supabase, user.id);


  if (!ownerId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const moduleId = await getLessonModuleId(supabase, params.id, ownerId);
  if (!moduleId) {
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

  // Defense-in-depth: scope by module_id (returned from getLessonModuleId above)
  // to close the TOCTOU window between the ownership check and this write. RLS
  // also enforces this via the module → course chain, but the explicit WHERE
  // closes the window.
  const { data, error } = await supabase
    .from("course_lessons")
    .update(updates)
    .eq("id", params.id)
    .eq("module_id", moduleId)
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

  // Apr 28: removed `|| user.id` fallback — null = suspended team_member.


  const ownerId = await getEffectiveOwnerId(supabase, user.id);


  if (!ownerId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const moduleId = await getLessonModuleId(supabase, params.id, ownerId);
  if (!moduleId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Defense-in-depth: scope by module_id to close the TOCTOU window.
  const { error } = await supabase
    .from("course_lessons")
    .delete()
    .eq("id", params.id)
    .eq("module_id", moduleId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
