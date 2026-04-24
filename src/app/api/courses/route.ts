import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { getEffectiveOwnerId } from "@/lib/security/require-owned-client";

// GET /api/courses — list courses for the authenticated user
export async function GET(request: NextRequest) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const ownerId = (await getEffectiveOwnerId(supabase, user.id)) || user.id;
  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status");

  let query = supabase
    .from("courses")
    .select("*, course_enrollments(count)")
    .eq("profile_id", ownerId)
    .order("created_at", { ascending: false });

  if (status) query = query.eq("status", status);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Flatten enrollment count
  const courses = (data ?? []).map((c) => ({
    ...c,
    student_count: Array.isArray(c.course_enrollments)
      ? (c.course_enrollments[0] as { count: number } | undefined)?.count ?? 0
      : 0,
    course_enrollments: undefined,
  }));

  return NextResponse.json({ courses });
}

// POST /api/courses — create a new course
export async function POST(request: NextRequest) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const ownerId = (await getEffectiveOwnerId(supabase, user.id)) || user.id;
  const body = await request.json() as {
    title?: string;
    description?: string;
    thumbnail_url?: string;
    price?: number;
    is_free?: boolean;
    status?: string;
    access_type?: string;
  };

  if (!body.title) {
    return NextResponse.json({ error: "title is required" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("courses")
    .insert({
      profile_id: ownerId,
      title: body.title,
      description: body.description ?? null,
      thumbnail_url: body.thumbnail_url ?? null,
      price: body.price ?? 0,
      is_free: body.is_free ?? false,
      status: body.status ?? "draft",
      access_type: body.access_type ?? "lifetime",
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ course: data }, { status: 201 });
}
