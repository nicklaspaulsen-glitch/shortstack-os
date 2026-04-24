/**
 * Portal Course Detail
 *
 * GET /api/portal/[clientId]/courses/[courseId]
 *   Returns the full course tree (modules -> lessons) plus a completion
 *   map for this client and the enrolment record.
 *
 * Access: verifyClientAccess + the course must belong to the agency that
 * owns this client, OR the client must be explicitly enrolled.
 */

import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase, createServiceClient } from "@/lib/supabase/server";
import { verifyClientAccess } from "@/lib/verify-client-access";

export async function GET(
  _request: NextRequest,
  { params }: { params: { clientId: string; courseId: string } },
) {
  const supabase = createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const access = await verifyClientAccess(supabase, user.id, params.clientId);
  if (access.denied) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const service = createServiceClient();

  // Confirm client/course agency alignment
  const { data: client } = await service
    .from("clients")
    .select("id, profile_id")
    .eq("id", params.clientId)
    .single();
  if (!client) return NextResponse.json({ error: "Client not found" }, { status: 404 });

  const { data: course } = await service
    .from("courses")
    .select(
      "id, title, description, thumbnail_url, status, price, is_free, access_type, profile_id",
    )
    .eq("id", params.courseId)
    .single();
  if (!course) return NextResponse.json({ error: "Course not found" }, { status: 404 });

  if (course.profile_id !== client.profile_id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Load enrolment (may be absent — in which case we serve a preview view)
  const { data: enrolment } = await service
    .from("course_enrollments")
    .select("progress_percent, enrolled_at, expires_at, last_accessed_at")
    .eq("client_id", params.clientId)
    .eq("course_id", params.courseId)
    .maybeSingle();

  // Only published courses are viewable by clients unless they have an
  // enrolment. Agency owners always see everything for QA.
  const isAgencyOwner = access.role === "admin" || access.role === "founder" || access.role === "agency";
  if (!enrolment && course.status !== "published" && !isAgencyOwner) {
    return NextResponse.json({ error: "Course not available" }, { status: 403 });
  }

  // Modules + lessons
  const { data: modules } = await service
    .from("course_modules")
    .select("id, title, description, sort_order, is_free_preview")
    .eq("course_id", params.courseId)
    .order("sort_order", { ascending: true });

  type LessonRow = {
    id: string;
    module_id: string;
    title: string;
    content_type: string | null;
    content_url: string | null;
    content_body: string | null;
    duration_seconds: number | null;
    sort_order: number | null;
    is_free_preview: boolean | null;
    drip_delay_days: number | null;
  };

  const moduleIds = (modules ?? []).map((m) => m.id);
  let lessons: LessonRow[] = [];
  if (moduleIds.length) {
    const { data: lessonsData } = await service
      .from("course_lessons")
      .select(
        "id, module_id, title, content_type, content_url, content_body, duration_seconds, sort_order, is_free_preview, drip_delay_days",
      )
      .in("module_id", moduleIds)
      .order("sort_order", { ascending: true });
    lessons = (lessonsData ?? []) as LessonRow[];
  }

  // Completion map
  const { data: progressRows } = await service
    .from("course_progress")
    .select("lesson_id, completed_at")
    .eq("client_id", params.clientId)
    .eq("course_id", params.courseId);

  const completion: Record<string, string> = {};
  for (const p of progressRows ?? []) {
    completion[p.lesson_id as string] = p.completed_at as string;
  }

  // Shape modules with nested lessons
  const lessonsByModule = new Map<string, LessonRow[]>();
  for (const l of lessons) {
    if (!lessonsByModule.has(l.module_id)) lessonsByModule.set(l.module_id, []);
    lessonsByModule.get(l.module_id)!.push(l);
  }

  const tree = (modules ?? []).map((m) => ({
    id: m.id,
    title: m.title,
    description: m.description,
    sort_order: m.sort_order,
    is_free_preview: m.is_free_preview,
    lessons: lessonsByModule.get(m.id) ?? [],
  }));

  const totalLessons = lessons.length;
  const completedLessons = Object.keys(completion).length;
  const progressPercent =
    totalLessons === 0 ? 0 : Math.round((completedLessons / totalLessons) * 100);

  return NextResponse.json({
    course: {
      id: course.id,
      title: course.title,
      description: course.description,
      thumbnail_url: course.thumbnail_url,
      status: course.status,
      price: course.price,
      is_free: course.is_free,
      access_type: course.access_type,
    },
    modules: tree,
    enrolment: enrolment
      ? {
          progress_percent: enrolment.progress_percent,
          enrolled_at: enrolment.enrolled_at,
          expires_at: enrolment.expires_at,
          last_accessed_at: enrolment.last_accessed_at,
        }
      : null,
    completion,
    progress: {
      total_lessons: totalLessons,
      completed_lessons: completedLessons,
      progress_percent: progressPercent,
    },
  });
}
