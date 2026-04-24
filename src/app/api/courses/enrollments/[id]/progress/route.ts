import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { getEffectiveOwnerId } from "@/lib/security/require-owned-client";

type Params = { params: { id: string } };

// PATCH /api/courses/enrollments/[id]/progress — mark a lesson complete/incomplete
export async function PATCH(request: NextRequest, { params }: Params) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const ownerId = (await getEffectiveOwnerId(supabase, user.id)) || user.id;

  // Fetch enrollment and verify ownership via course chain
  const { data: enrollment } = await supabase
    .from("course_enrollments")
    .select("id, course_id, progress")
    .eq("id", params.id)
    .single();
  if (!enrollment) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { data: course } = await supabase
    .from("courses")
    .select("id")
    .eq("id", enrollment.course_id)
    .eq("profile_id", ownerId)
    .single();
  if (!course) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await request.json() as { lesson_id?: string; completed?: boolean };
  if (!body.lesson_id) return NextResponse.json({ error: "lesson_id is required" }, { status: 400 });

  const existingProgress = (enrollment.progress ?? {}) as Record<string, { completed: boolean; completed_at: string | null }>;
  const updatedProgress = {
    ...existingProgress,
    [body.lesson_id]: {
      completed: body.completed ?? true,
      completed_at: body.completed !== false ? new Date().toISOString() : null,
    },
  };

  const { data, error } = await supabase
    .from("course_enrollments")
    .update({ progress: updatedProgress })
    .eq("id", params.id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ enrollment: data });
}
