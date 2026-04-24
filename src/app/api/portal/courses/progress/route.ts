/**
 * Portal Course Progress
 *
 * POST /api/portal/courses/progress
 *   body: { clientId: string; courseId: string; lessonId: string; completed?: boolean }
 *   Marks a lesson complete (or uncompletes when completed === false).
 *   Also refreshes the enrolment's progress_percent cache.
 *
 * GET  /api/portal/courses/progress?clientId=...&courseId=...
 *   Returns { completion: { [lessonId]: ISOdate }, progress_percent }
 *
 * Access: verifyClientAccess — client OR agency owner only.
 */

import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase, createServiceClient } from "@/lib/supabase/server";
import { verifyClientAccess } from "@/lib/verify-client-access";

async function recalcProgress(
  service: ReturnType<typeof createServiceClient>,
  clientId: string,
  courseId: string,
) {
  // Total lessons in course
  const { data: modules } = await service
    .from("course_modules")
    .select("id")
    .eq("course_id", courseId);
  const moduleIds = (modules ?? []).map((m) => m.id);
  let totalLessons = 0;
  if (moduleIds.length) {
    const { count } = await service
      .from("course_lessons")
      .select("id", { count: "exact", head: true })
      .in("module_id", moduleIds);
    totalLessons = count ?? 0;
  }

  const { count: completedCount } = await service
    .from("course_progress")
    .select("id", { count: "exact", head: true })
    .eq("client_id", clientId)
    .eq("course_id", courseId);

  const percent =
    totalLessons === 0 ? 0 : Math.round(((completedCount ?? 0) / totalLessons) * 100);

  // Upsert the enrolment cache (if no enrolment row yet, create one —
  // accessing a course without enrolment is allowed for published
  // courses and creates an implicit enrolment so progress persists).
  await service
    .from("course_enrollments")
    .upsert(
      {
        client_id: clientId,
        course_id: courseId,
        progress_percent: percent,
        last_accessed_at: new Date().toISOString(),
      },
      { onConflict: "course_id,client_id" },
    );

  return { progress_percent: percent, total_lessons: totalLessons, completed_lessons: completedCount ?? 0 };
}

export async function GET(request: NextRequest) {
  const supabase = createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const clientId = searchParams.get("clientId");
  const courseId = searchParams.get("courseId");
  if (!clientId || !courseId) {
    return NextResponse.json(
      { error: "clientId and courseId are required" },
      { status: 400 },
    );
  }

  const access = await verifyClientAccess(supabase, user.id, clientId);
  if (access.denied) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const service = createServiceClient();

  const { data: progressRows, error } = await service
    .from("course_progress")
    .select("lesson_id, completed_at")
    .eq("client_id", clientId)
    .eq("course_id", courseId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const completion: Record<string, string> = {};
  for (const p of progressRows ?? []) {
    completion[p.lesson_id as string] = p.completed_at as string;
  }

  // Total lessons for percent
  const { data: modules } = await service
    .from("course_modules")
    .select("id")
    .eq("course_id", courseId);
  const moduleIds = (modules ?? []).map((m) => m.id);
  let totalLessons = 0;
  if (moduleIds.length) {
    const { count } = await service
      .from("course_lessons")
      .select("id", { count: "exact", head: true })
      .in("module_id", moduleIds);
    totalLessons = count ?? 0;
  }
  const completedLessons = Object.keys(completion).length;
  const progressPercent =
    totalLessons === 0 ? 0 : Math.round((completedLessons / totalLessons) * 100);

  return NextResponse.json({
    completion,
    progress_percent: progressPercent,
    total_lessons: totalLessons,
    completed_lessons: completedLessons,
  });
}

export async function POST(request: NextRequest) {
  const supabase = createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: {
    clientId?: string;
    courseId?: string;
    lessonId?: string;
    completed?: boolean;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const clientId = body.clientId;
  const courseId = body.courseId;
  const lessonId = body.lessonId;
  if (!clientId || !courseId || !lessonId) {
    return NextResponse.json(
      { error: "clientId, courseId, lessonId are required" },
      { status: 400 },
    );
  }

  const access = await verifyClientAccess(supabase, user.id, clientId);
  if (access.denied) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const service = createServiceClient();

  // Sanity-check the lesson belongs to the stated course
  const { data: lesson } = await service
    .from("course_lessons")
    .select("id, module_id, course_modules!inner(course_id)")
    .eq("id", lessonId)
    .maybeSingle();
  type LessonWithModule = {
    id: string;
    module_id: string;
    course_modules: { course_id: string } | { course_id: string }[] | null;
  };
  if (!lesson) {
    return NextResponse.json({ error: "Lesson not found" }, { status: 404 });
  }
  const lessonTyped = lesson as LessonWithModule;
  const mod = Array.isArray(lessonTyped.course_modules)
    ? lessonTyped.course_modules[0]
    : lessonTyped.course_modules;
  if (!mod || mod.course_id !== courseId) {
    return NextResponse.json({ error: "Lesson does not belong to course" }, { status: 400 });
  }

  const completed = body.completed !== false; // default true
  if (completed) {
    const { error } = await service
      .from("course_progress")
      .upsert(
        {
          client_id: clientId,
          course_id: courseId,
          lesson_id: lessonId,
          completed_at: new Date().toISOString(),
        },
        { onConflict: "client_id,lesson_id" },
      );
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  } else {
    const { error } = await service
      .from("course_progress")
      .delete()
      .eq("client_id", clientId)
      .eq("lesson_id", lessonId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const stats = await recalcProgress(service, clientId, courseId);
  return NextResponse.json({ ok: true, ...stats });
}
