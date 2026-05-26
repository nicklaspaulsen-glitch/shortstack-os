/**
 * Workspace Files — folder listing + creation.
 *
 * GET  /api/workspace/folders?parent_id=<uuid|null>
 *   Lists folders under the given parent (NULL = root). Auto-seeds the four
 *   system folders on first call so the user always lands on a non-empty root.
 *
 * POST /api/workspace/folders
 *   Body: { parent_id?: uuid|null, name: string,
 *           permission?: 'owner_only'|'team_read'|'team_write'|'client_can_view',
 *           client_id?: uuid }
 *   Creates a new folder under the resolved agency owner.
 */
import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase, createServiceClient } from "@/lib/supabase/server";
import { getEffectiveOwnerId } from "@/lib/security/require-owned-client";
import { ensureSystemFolders } from "@/lib/workspace/system-folders";
import { isUuid } from "@/lib/workspace/access";

export const dynamic = "force-dynamic";

const ALLOWED_PERMISSIONS = [
  "owner_only",
  "team_read",
  "team_write",
  "client_can_view",
] as const;

type Permission = (typeof ALLOWED_PERMISSIONS)[number];

function isPermission(v: unknown): v is Permission {
  return typeof v === "string" && (ALLOWED_PERMISSIONS as readonly string[]).includes(v);
}

export async function GET(req: NextRequest) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Apr 28: removed `|| user.id` fallback — null = suspended team_member.


  const ownerId = await getEffectiveOwnerId(supabase, user.id);


  if (!ownerId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  // Idempotent system-folder seed. Service-role to avoid first-load races
  // where the user-scoped client briefly lacks INSERT visibility.
  await ensureSystemFolders(createServiceClient(), ownerId);

  const url = new URL(req.url);
  const parentParam = url.searchParams.get("parent_id");
  // "null" / "" / missing → root listing.
  const isRootQuery = !parentParam || parentParam === "null" || parentParam === "root";

  if (!isRootQuery && !isUuid(parentParam)) {
    return NextResponse.json({ error: "parent_id must be a uuid or omitted" }, { status: 400 });
  }

  let q = supabase
    .from("workspace_folders")
    .select("id, agency_owner_id, parent_id, client_id, name, permission, is_system, created_at")
    .eq("agency_owner_id", ownerId)
    .order("is_system", { ascending: false })
    .order("name", { ascending: true });

  q = isRootQuery ? q.is("parent_id", null) : q.eq("parent_id", parentParam as string);

  const { data, error } = await q;
  if (error) return NextResponse.json({ error: "Internal server error" }, { status: 500 });

  // Build a breadcrumb when inside a non-root folder. Walk parents up to the
  // root using a small loop bounded at 16 hops (deep enough for any sane tree
  // and cheap enough that we don't bother with a recursive CTE for now).
  interface CrumbRow { id: string; name: string; parent_id: string | null }
  let breadcrumb: Array<{ id: string; name: string }> = [];
  if (!isRootQuery) {
    const trail: Array<{ id: string; name: string }> = [];
    let cursor: string | null = parentParam as string;
    for (let i = 0; i < 16 && cursor; i += 1) {
      const lookup = await supabase
        .from("workspace_folders")
        .select("id, name, parent_id")
        .eq("id", cursor)
        .eq("agency_owner_id", ownerId)
        .maybeSingle();
      const row = lookup.data as CrumbRow | null;
      if (!row) break;
      trail.unshift({ id: row.id, name: row.name });
      cursor = row.parent_id ?? null;
    }
    breadcrumb = trail;
  }

  return NextResponse.json({ folders: data ?? [], breadcrumb });
}

export async function POST(req: NextRequest) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Apr 28: removed `|| user.id` fallback — null = suspended team_member.


  const ownerId = await getEffectiveOwnerId(supabase, user.id);


  if (!ownerId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const body = await req.json().catch(() => null);
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  if (!name || name.length > 200) {
    return NextResponse.json({ error: "name is required (1-200 chars)" }, { status: 400 });
  }

  const parentId = body?.parent_id ?? null;
  if (parentId !== null && !isUuid(parentId)) {
    return NextResponse.json({ error: "parent_id must be a uuid or null" }, { status: 400 });
  }

  // Verify the parent (if given) belongs to this owner.
  if (parentId) {
    const { data: parent } = await supabase
      .from("workspace_folders")
      .select("id")
      .eq("id", parentId)
      .eq("agency_owner_id", ownerId)
      .maybeSingle();
    if (!parent) {
      return NextResponse.json({ error: "Parent folder not found" }, { status: 404 });
    }
  }

  const permission: Permission = isPermission(body?.permission) ? body.permission : "team_write";
  const clientId = body?.client_id ?? null;
  if (clientId !== null && !isUuid(clientId)) {
    return NextResponse.json({ error: "client_id must be a uuid or null" }, { status: 400 });
  }

  // If client_id is supplied, confirm it belongs to this owner. Otherwise a
  // team_member could attach a folder to an unrelated client.
  if (clientId) {
    const { data: c } = await supabase
      .from("clients")
      .select("id, profile_id")
      .eq("id", clientId)
      .maybeSingle();
    if (!c || c.profile_id !== ownerId) {
      return NextResponse.json({ error: "client_id does not belong to this agency" }, { status: 403 });
    }
  }

  const { data, error } = await supabase
    .from("workspace_folders")
    .insert({
      agency_owner_id: ownerId,
      parent_id: parentId,
      client_id: clientId,
      name,
      permission,
      is_system: false,
    })
    .select("id, agency_owner_id, parent_id, client_id, name, permission, is_system, created_at")
    .single();

  if (error) {
    // 23505 = unique_violation (duplicate name under same parent).
    if (error.code === "23505") {
      return NextResponse.json({ error: "A folder with that name already exists here" }, { status: 409 });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }

  return NextResponse.json({ folder: data }, { status: 201 });
}
