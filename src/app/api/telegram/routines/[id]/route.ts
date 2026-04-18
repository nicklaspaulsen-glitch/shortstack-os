import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase, createServiceClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const UPDATABLE_FIELDS = [
  "name",
  "description",
  "routine_type",
  "schedule",
  "enabled",
  "paused",
  "message_template",
  "conditions",
] as const;

// PATCH /api/telegram/routines/[id] — update routine (pause/resume/rename/edit)
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = createServerSupabase();
  const {
    data: { user },
  } = await auth.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: Record<string, unknown> = {};
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  for (const field of UPDATABLE_FIELDS) {
    if (field in body) {
      patch[field] = body[field];
    }
  }

  const service = createServiceClient();

  // Require ownership
  const { data: existing } = await service
    .from("telegram_routines")
    .select("user_id")
    .eq("id", params.id)
    .maybeSingle();
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (existing.user_id !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { data, error } = await service
    .from("telegram_routines")
    .update(patch)
    .eq("id", params.id)
    .select("*")
    .single();

  if (error) {
    console.error("[telegram/routines/:id] PATCH error:", error);
    return NextResponse.json({ error: "Failed to update routine" }, { status: 500 });
  }

  return NextResponse.json({ routine: data });
}

// DELETE /api/telegram/routines/[id]
export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = createServerSupabase();
  const {
    data: { user },
  } = await auth.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const service = createServiceClient();
  const { data: existing } = await service
    .from("telegram_routines")
    .select("user_id")
    .eq("id", params.id)
    .maybeSingle();
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (existing.user_id !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { error } = await service
    .from("telegram_routines")
    .delete()
    .eq("id", params.id);

  if (error) {
    console.error("[telegram/routines/:id] DELETE error:", error);
    return NextResponse.json({ error: "Failed to delete routine" }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
