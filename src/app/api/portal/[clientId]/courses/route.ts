/**
 * Portal Courses — list
 *
 * GET /api/portal/[clientId]/courses
 *   Returns every course the client is enrolled in, plus published
 *   courses owned by the same agency that haven't been enrolled yet
 *   (so students can browse the library even before enrolment).
 *
 *   Each course includes aggregate counts:
 *     - module_count
 *     - lesson_count
 *     - completed_count
 *     - progress_percent (0-100)
 *
 * Access: gated via verifyClientAccess — client OR agency owner only.
 */

import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase, createServiceClient } from "@/lib/supabase/server";
import { verifyClientAccess } from "@/lib/verify-client-access";

type CourseRow = {
  id: string;
  title: string;
  description: string | null;
  thumbnail_url: string | null;
  status: string | null;
  price: number | null;
  is_free: boolean | null;
  access_type: string | null;
  profile_id: string;
  created_at: string | null;
};

type ModuleRow = { id: string; course_id: string };
type LessonRow = { id: string; module_id: string };

export async function GET(
  _request: NextRequest,
  { params }: { params: { clientId: string } },
) {
  const supabase = createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const access = await verifyClientAccess(supabase, user.id, params.clientId);
  if (access.denied) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const service = createServiceClient();

  // Resolve agency owner for this client so we can scope the library.
  const { data: client } = await service
    .from("clients")
    .select("id, profile_id")
    .eq("id", params.clientId)
    .single();
  if (!client) return NextResponse.json({ error: "Client not found" }, { status: 404 });

  const agencyOwnerId = client.profile_id;

  // Enrolments for this client
  const { data: enrolments } = await service
    .from("course_enrollments")
    .select("course_id, progress_percent, enrolled_at, last_accessed_at, expires_at")
    .eq("client_id", params.clientId);

  const enrolMap = new Map(
    (enrolments ?? []).map((e) => [e.course_id as string, e]),
  );
  const enrolledIds = Array.from(enrolMap.keys());

  // Grab all published courses for this agency + any already-enrolled
  // courses (even if unpublished/draft — if the client was enrolled the
  // agency wants them to keep access).
  let courseQuery = service
    .from("courses")
    .select(
      "id, title, description, thumbnail_url, status, price, is_free, access_type, profile_id, created_at",
    )
    .eq("profile_id", agencyOwnerId);

  if (enrolledIds.length) {
    courseQuery = courseQuery.or(
      `status.eq.published,id.in.(${enrolledIds.join(",")})`,
    );
  } else {
    courseQuery = courseQuery.eq("status", "published");
  }

  const { data: courses, error: coursesErr } = await courseQuery.order("created_at", {
    ascending: false,
  });
  if (coursesErr) {
    return NextResponse.json({ error: coursesErr.message }, { status: 500 });
  }

  const courseList = (courses ?? []) as CourseRow[];
  const courseIds = courseList.map((c) => c.id);

  // Module + lesson counts
  const moduleCountByCourse = new Map<string, number>();
  const lessonCountByCourse = new Map<string, number>();
  const lessonIdsByCourse = new Map<string, Set<string>>();

  if (courseIds.length) {
    const { data: modules } = await service
      .from("course_modules")
      .select("id, course_id")
      .in("course_id", courseIds);

    const modList = (modules ?? []) as ModuleRow[];
    for (const m of modList) {
      moduleCountByCourse.set(m.course_id, (moduleCountByCourse.get(m.course_id) ?? 0) + 1);
    }

    const moduleIds = modList.map((m) => m.id);
    if (moduleIds.length) {
      const { data: lessons } = await service
        .from("course_lessons")
        .select("id, module_id")
        .in("module_id", moduleIds);

      const lessonList = (lessons ?? []) as LessonRow[];
      const moduleToCourse = new Map(modList.map((m) => [m.id, m.course_id]));

      for (const l of lessonList) {
        const courseId = moduleToCourse.get(l.module_id);
        if (!courseId) continue;
        lessonCountByCourse.set(courseId, (lessonCountByCourse.get(courseId) ?? 0) + 1);
        if (!lessonIdsByCourse.has(courseId)) lessonIdsByCourse.set(courseId, new Set());
        lessonIdsByCourse.get(courseId)!.add(l.id);
      }
    }
  }

  // Completion counts
  const completedByCourse = new Map<string, number>();
  if (courseIds.length) {
    const { data: progress } = await service
      .from("course_progress")
      .select("course_id, lesson_id")
      .eq("client_id", params.clientId)
      .in("course_id", courseIds);

    for (const p of progress ?? []) {
      const courseId = p.course_id as string;
      const lessonId = p.lesson_id as string;
      const lessonIds = lessonIdsByCourse.get(courseId);
      if (lessonIds && lessonIds.has(lessonId)) {
        completedByCourse.set(courseId, (completedByCourse.get(courseId) ?? 0) + 1);
      }
    }
  }

  const out = courseList.map((c) => {
    const moduleCount = moduleCountByCourse.get(c.id) ?? 0;
    const lessonCount = lessonCountByCourse.get(c.id) ?? 0;
    const completedCount = completedByCourse.get(c.id) ?? 0;
    const progressPercent =
      lessonCount === 0 ? 0 : Math.round((completedCount / lessonCount) * 100);
    const enrolment = enrolMap.get(c.id);
    return {
      id: c.id,
      title: c.title,
      description: c.description,
      thumbnail_url: c.thumbnail_url,
      status: c.status,
      price: c.price,
      is_free: c.is_free,
      access_type: c.access_type,
      module_count: moduleCount,
      lesson_count: lessonCount,
      completed_count: completedCount,
      progress_percent: progressPercent,
      is_enrolled: !!enrolment,
      enrolled_at: enrolment?.enrolled_at ?? null,
      last_accessed_at: enrolment?.last_accessed_at ?? null,
      expires_at: enrolment?.expires_at ?? null,
    };
  });

  return NextResponse.json({ courses: out });
}
