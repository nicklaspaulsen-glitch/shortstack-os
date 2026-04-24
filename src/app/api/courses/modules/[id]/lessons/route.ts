import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { getEffectiveOwnerId } from "@/lib/security/require-owned-client";

type Params = { params: { id: string } };

async function assertModuleOwner(
  supabase: ReturnType<typeof createServerSupabase>,
  moduleId: string,
  ownerId: string,
) {
  const { data: mod } = await supabase
    .from("course_modules")
    .select("course_id")
    .eq("id", moduleId)
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

// GET /api/courses/modules/[id]/lessons
export async function GET(_req: NextRequest, { params }: Params) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const ownerId = (await getEffectiveOwnerId(supabase, user.id)) || user.id;
  if (!await assertModuleOwner(supabase, params.id, ownerId)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { data, error } = await supabase
    .from("course_lessons")
    .select("*")
    .eq("module_id", params.id)
    .order("sort_order", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ lessons: data ?? [] });
}

// POST /api/courses/modules/[id]/lessons
export async function POST(request: NextRequest, { params }: Params) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const ownerId = (await getEffectiveOwnerId(supabase, user.id)) || user.id;
  if (!await assertModuleOwner(supabase, params.id, ownerId)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json() as {
    title?: string;
    content_type?: string;
    content_url?: string;
    content_body?: string;
    duration_seconds?: number;
    sort_order?: number;
    is_free_preview?: boolean;
    drip_delay_days?: number;
  };
  if (!body.title) return NextResponse.json({ error: "title is required" }, { status: 400 });

  let sortOrder = body.sort_order ?? 0;
  if (body.sort_order === undefined) {
    const { count } = await supabase
      .from("course_lessons")
      .select("*", { count: "exact", head: true })
      .eq("module_id", params.id);
    sortOrder = count ?? 0;
  }

  const { data, error } = await supabase
    .from("course_lessons")
    .insert({
      module_id: params.id,
      title: body.title,
      content_type: body.content_type ?? "video",
      content_url: body.content_url ?? null,
      content_body: body.content_body ?? null,
      duration_seconds: body.duration_seconds ?? null,
      sort_order: sortOrder,
      is_free_preview: body.is_free_preview ?? false,
      drip_delay_days: body.drip_delay_days ?? 0,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ lesson: data }, { status: 201 });
}
