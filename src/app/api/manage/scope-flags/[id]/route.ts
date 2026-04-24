/**
 * PATCH /api/manage/scope-flags/:id
 * Body: { resolved?: boolean }
 *
 * Marks a scope-creep flag resolved or unresolved. Owners + leads only.
 */
import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { canManage, getProjectRole } from "@/lib/manage/access";

export const dynamic = "force-dynamic";

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: { resolved?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { data: flag } = await supabase
    .from("scope_creep_flags")
    .select("id, project_id")
    .eq("id", params.id)
    .single();
  if (!flag) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const role = await getProjectRole(supabase, flag.project_id as string, user.id);
  if (!canManage(role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const resolved = body.resolved === true;
  const { error } = await supabase
    .from("scope_creep_flags")
    .update({
      resolved,
      resolved_at: resolved ? new Date().toISOString() : null,
      resolved_by: resolved ? user.id : null,
    })
    .eq("id", params.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ success: true });
}
