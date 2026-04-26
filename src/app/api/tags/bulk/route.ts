import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase, createServiceClient } from "@/lib/supabase/server";
import { getEffectiveOwnerId } from "@/lib/security/require-owned-client";

// Bulk operations on tags.
//
// Supported actions (POST body { action, ... }):
//   - { action: "rename", from_name, to_name }
//       Renames the tag in tags + lead_tags + asset_tags.
//   - { action: "merge", source_names: string[], target_name }
//       Merges source tag names into target. Deletes source rows in tags.
//   - { action: "delete_unused" }
//       Deletes any rows in tags with no matching lead_tags/asset_tags by name.

interface BulkBody {
  action?: "rename" | "merge" | "delete_unused";
  from_name?: string;
  to_name?: string;
  source_names?: string[];
  target_name?: string;
}

export async function POST(request: NextRequest) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const ownerId = await getEffectiveOwnerId(supabase, user.id);
  if (!ownerId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  let body: BulkBody;
  try {
    body = (await request.json()) as BulkBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const service = createServiceClient();

  if (body.action === "rename") {
    const from = body.from_name?.trim();
    const to = body.to_name?.trim();
    if (!from || !to) {
      return NextResponse.json({ error: "from_name and to_name required" }, { status: 400 });
    }
    if (from === to) {
      return NextResponse.json({ ok: true, renamed: 0 });
    }
    // Update canonical row(s) by name (scoped by user)
    const { error: tagsErr } = await service
      .from("tags")
      .update({ name: to })
      .eq("user_id", ownerId)
      .eq("name", from);
    if (tagsErr) return NextResponse.json({ error: tagsErr.message }, { status: 500 });

    // Update join rows
    await service
      .from("lead_tags")
      .update({ tag: to })
      .eq("profile_id", ownerId)
      .eq("tag", from);

    return NextResponse.json({ ok: true });
  }

  if (body.action === "merge") {
    const target = body.target_name?.trim();
    const sources = (body.source_names || []).map((s) => s.trim()).filter(Boolean);
    if (!target || sources.length === 0) {
      return NextResponse.json(
        { error: "target_name and source_names required" },
        { status: 400 },
      );
    }

    // Ensure target exists
    const { data: targetRow } = await service
      .from("tags")
      .select("id")
      .eq("user_id", ownerId)
      .eq("name", target)
      .maybeSingle();
    if (!targetRow) {
      const { error } = await service
        .from("tags")
        .insert({ user_id: ownerId, name: target });
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Repoint all join rows
    await service
      .from("lead_tags")
      .update({ tag: target })
      .eq("profile_id", ownerId)
      .in("tag", sources);

    // Delete source canonical rows
    await service
      .from("tags")
      .delete()
      .eq("user_id", ownerId)
      .in("name", sources)
      .neq("name", target);

    return NextResponse.json({ ok: true, merged: sources.length });
  }

  if (body.action === "delete_unused") {
    // Pull all canonical names + all in-use names, diff
    const [{ data: canon }, { data: leadJoins }] = await Promise.all([
      service.from("tags").select("id, name").eq("user_id", ownerId),
      service.from("lead_tags").select("tag").eq("profile_id", ownerId),
    ]);
    const inUse = new Set<string>();
    for (const j of (leadJoins || []) as Array<{ tag: string }>) {
      if (j.tag) inUse.add(j.tag);
    }
    const unusedIds: string[] = [];
    for (const t of (canon || []) as Array<{ id: string; name: string }>) {
      if (!inUse.has(t.name)) unusedIds.push(t.id);
    }
    if (unusedIds.length === 0) {
      return NextResponse.json({ ok: true, deleted: 0 });
    }
    const { error } = await service
      .from("tags")
      .delete()
      .eq("user_id", ownerId)
      .in("id", unusedIds);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, deleted: unusedIds.length });
  }

  return NextResponse.json(
    { error: "Unsupported action. Use rename | merge | delete_unused." },
    { status: 400 },
  );
}
