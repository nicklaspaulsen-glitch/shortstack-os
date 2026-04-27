/**
 * Per-incident operations (PATCH to update, DELETE to remove). Auth is
 * createServerSupabase() with RLS enforcing ownership.
 *
 * PATCH supports partial updates of: title, body, severity,
 * affected_components, resolved_at. Setting `severity: "resolved"` without
 * an explicit resolved_at auto-stamps now() so the public page's "resolved
 * Xh ago" logic just works.
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createServerSupabase } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const SEVERITY_VALUES = [
  "investigating",
  "identified",
  "monitoring",
  "resolved",
] as const;

const updateIncidentSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  body: z.string().max(8000).optional(),
  severity: z.enum(SEVERITY_VALUES).optional(),
  affected_components: z.array(z.string().max(80)).max(20).optional(),
  resolved_at: z.string().datetime().nullable().optional(),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  const supabase = createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let parsed: z.infer<typeof updateIncidentSchema>;
  try {
    const json = await request.json();
    parsed = updateIncidentSchema.parse(json);
  } catch (err) {
    return NextResponse.json(
      {
        error: "Invalid payload",
        detail: err instanceof Error ? err.message : String(err),
      },
      { status: 400 },
    );
  }

  // Build the patch immutably so we don't mutate the parsed object.
  const update: Record<string, unknown> = { ...parsed };

  // Auto-stamp resolved_at when severity flips to "resolved" without an
  // explicit timestamp. Symmetric: if severity flips OFF resolved we don't
  // un-stamp — that would erase audit trail. The admin can clear the
  // timestamp explicitly via `resolved_at: null` if they need to.
  if (parsed.severity === "resolved" && parsed.resolved_at === undefined) {
    update.resolved_at = new Date().toISOString();
  }

  // RLS gate: the row's owner_id must match auth.uid(). We additionally
  // filter by owner_id here so a forged id from another tenant is a
  // no-match (404) rather than a bypass attempt.
  const { data, error } = await supabase
    .from("incidents")
    .update(update)
    .eq("id", params.id)
    .eq("owner_id", user.id)
    .select()
    .single();

  if (error) {
    console.error("[admin/incidents/:id] update failed:", error.message);
    return NextResponse.json(
      { error: "Update failed", detail: error.message },
      { status: 500 },
    );
  }

  if (!data) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ incident: data });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } },
) {
  const supabase = createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { error } = await supabase
    .from("incidents")
    .delete()
    .eq("id", params.id)
    .eq("owner_id", user.id);

  if (error) {
    console.error("[admin/incidents/:id] delete failed:", error.message);
    return NextResponse.json({ error: "Delete failed" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
