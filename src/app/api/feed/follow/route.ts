import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const SUBJECT_TYPES = new Set(["user", "project"]);

// POST /api/feed/follow — follow a user or project.
// Body: { subject_type: "user"|"project", subject_id: uuid }
export async function POST(request: NextRequest) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: { subject_type?: unknown; subject_id?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const subjectType = typeof body.subject_type === "string" ? body.subject_type : "";
  const subjectId = typeof body.subject_id === "string" ? body.subject_id : "";
  if (!SUBJECT_TYPES.has(subjectType) || !subjectId) {
    return NextResponse.json({ error: "invalid subject" }, { status: 400 });
  }

  const { error } = await supabase
    .from("activity_follows")
    .upsert(
      { user_id: user.id, subject_type: subjectType, subject_id: subjectId },
      { onConflict: "user_id,subject_type,subject_id" },
    );
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ following: true });
}

// DELETE /api/feed/follow?subject_type=user&subject_id=xxx — unfollow.
export async function DELETE(request: NextRequest) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const subjectType = request.nextUrl.searchParams.get("subject_type") ?? "";
  const subjectId = request.nextUrl.searchParams.get("subject_id") ?? "";
  if (!SUBJECT_TYPES.has(subjectType) || !subjectId) {
    return NextResponse.json({ error: "invalid subject" }, { status: 400 });
  }

  const { error } = await supabase
    .from("activity_follows")
    .delete()
    .eq("user_id", user.id)
    .eq("subject_type", subjectType)
    .eq("subject_id", subjectId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ following: false });
}
