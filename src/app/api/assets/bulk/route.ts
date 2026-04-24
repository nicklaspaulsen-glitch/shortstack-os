import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase, createServiceClient } from "@/lib/supabase/server";
import { getEffectiveOrgId, isOrgAdmin } from "@/lib/assets/helpers";

export const dynamic = "force-dynamic";

// POST /api/assets/bulk — {ids: string[], action, ...}
export async function POST(req: NextRequest) {
  const supabase = createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const orgId = await getEffectiveOrgId(supabase, user.id);
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const ids = Array.isArray(body.ids) ? (body.ids as string[]).filter(Boolean) : [];
  if (!ids.length) return NextResponse.json({ error: "No ids provided" }, { status: 400 });

  const action = String(body.action || "");
  const service = createServiceClient();

  const { data: rows } = await service
    .from("assets")
    .select("id, created_by, org_id, tags, deleted_at")
    .in("id", ids)
    .eq("org_id", orgId);

  if (!rows || rows.length === 0) {
    return NextResponse.json({ error: "No matching assets" }, { status: 404 });
  }

  const admin = isOrgAdmin(user.id, orgId);
  const allowed = rows.filter((r) => admin || r.created_by === user.id);
  if (allowed.length === 0) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const allowedIds = allowed.map((r) => r.id as string);

  if (action === "delete") {
    await service
      .from("assets")
      .update({ deleted_at: new Date().toISOString() })
      .in("id", allowedIds);
    return NextResponse.json({ ok: true, updated: allowedIds.length });
  }

  if (action === "restore") {
    await service.from("assets").update({ deleted_at: null }).in("id", allowedIds);
    return NextResponse.json({ ok: true, updated: allowedIds.length });
  }

  if (action === "tag_add" || action === "tag_remove") {
    const inputTags = Array.isArray(body.tags) ? (body.tags as string[]).filter(Boolean) : [];
    if (!inputTags.length) return NextResponse.json({ error: "No tags provided" }, { status: 400 });
    for (const row of allowed) {
      const existing = Array.isArray(row.tags) ? (row.tags as string[]) : [];
      const next =
        action === "tag_add"
          ? Array.from(new Set([...existing, ...inputTags]))
          : existing.filter((t) => !inputTags.includes(t));
      await service.from("assets").update({ tags: next }).eq("id", row.id);
    }
    return NextResponse.json({ ok: true, updated: allowed.length });
  }

  if (action === "move_project") {
    const projectId = (body.project_id as string | null | undefined) ?? null;
    await service.from("assets").update({ project_id: projectId }).in("id", allowedIds);
    return NextResponse.json({ ok: true, updated: allowedIds.length });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
