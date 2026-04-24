import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { getEffectiveOwnerId } from "@/lib/security/require-owned-client";

type Params = { params: { id: string } };

// GET /api/courses/[id]/enroll — list enrollments for a course
export async function GET(_req: NextRequest, { params }: Params) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const ownerId = (await getEffectiveOwnerId(supabase, user.id)) || user.id;

  // Verify course ownership
  const { data: course } = await supabase
    .from("courses")
    .select("id")
    .eq("id", params.id)
    .eq("profile_id", ownerId)
    .single();
  if (!course) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { data, error } = await supabase
    .from("course_enrollments")
    .select("*, clients(id, name, email)")
    .eq("course_id", params.id)
    .order("enrolled_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ enrollments: data ?? [] });
}

// POST /api/courses/[id]/enroll — enroll a client in a course
export async function POST(request: NextRequest, { params }: Params) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const ownerId = (await getEffectiveOwnerId(supabase, user.id)) || user.id;

  const { data: course } = await supabase
    .from("courses")
    .select("id")
    .eq("id", params.id)
    .eq("profile_id", ownerId)
    .single();
  if (!course) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await request.json() as { client_id?: string; expires_at?: string };
  if (!body.client_id) return NextResponse.json({ error: "client_id is required" }, { status: 400 });

  const { data, error } = await supabase
    .from("course_enrollments")
    .upsert({
      course_id: params.id,
      client_id: body.client_id,
      expires_at: body.expires_at ?? null,
      progress: {},
    }, { onConflict: "course_id,client_id" })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ enrollment: data }, { status: 201 });
}
