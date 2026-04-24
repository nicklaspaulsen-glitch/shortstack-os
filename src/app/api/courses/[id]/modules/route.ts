import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { getEffectiveOwnerId } from "@/lib/security/require-owned-client";

type Params = { params: { id: string } };

async function assertCourseOwner(supabase: ReturnType<typeof createServerSupabase>, courseId: string, ownerId: string) {
  const { data } = await supabase
    .from("courses")
    .select("id")
    .eq("id", courseId)
    .eq("profile_id", ownerId)
    .single();
  return !!data;
}

// GET /api/courses/[id]/modules
export async function GET(_req: NextRequest, { params }: Params) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const ownerId = (await getEffectiveOwnerId(supabase, user.id)) || user.id;
  if (!await assertCourseOwner(supabase, params.id, ownerId)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { data, error } = await supabase
    .from("course_modules")
    .select("*, course_lessons(*)")
    .eq("course_id", params.id)
    .order("sort_order", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ modules: data ?? [] });
}

// POST /api/courses/[id]/modules
export async function POST(request: NextRequest, { params }: Params) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const ownerId = (await getEffectiveOwnerId(supabase, user.id)) || user.id;
  if (!await assertCourseOwner(supabase, params.id, ownerId)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json() as { title?: string; description?: string; sort_order?: number; is_free_preview?: boolean };
  if (!body.title) return NextResponse.json({ error: "title is required" }, { status: 400 });

  // Auto-increment sort_order if not provided
  let sortOrder = body.sort_order ?? 0;
  if (body.sort_order === undefined) {
    const { count } = await supabase
      .from("course_modules")
      .select("*", { count: "exact", head: true })
      .eq("course_id", params.id);
    sortOrder = count ?? 0;
  }

  const { data, error } = await supabase
    .from("course_modules")
    .insert({
      course_id: params.id,
      title: body.title,
      description: body.description ?? null,
      sort_order: sortOrder,
      is_free_preview: body.is_free_preview ?? false,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ module: data }, { status: 201 });
}
