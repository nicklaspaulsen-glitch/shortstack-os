/**
 * GET /api/verticals/applies/[user_id]
 *
 * Lists which verticals + modules a user has already applied. Used by
 * the dashboard to render checkmarks on previously-applied templates.
 *
 * Authorization: caller must be the user themselves OR an admin/team_member
 * resolving to the same agency owner.
 */
import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { getEffectiveOwnerId } from "@/lib/security/require-owned-client";

export const dynamic = "force-dynamic";

interface Params {
  params: { user_id: string };
}

export async function GET(_req: Request, { params }: Params) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const ownerId = await getEffectiveOwnerId(supabase, user.id);
  if (!ownerId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  // Only allow lookups for the caller's own effective owner id. We don't
  // expose other tenants' apply history.
  if (params.user_id !== ownerId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { data, error } = await supabase
    .from("vertical_applies")
    .select("id, vertical, applied_modules, applied_counts, applied_at")
    .eq("user_id", ownerId)
    .order("applied_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Pre-compute "modules ever applied per vertical" so the UI can render
  // checkmarks without the client doing the reduce.
  const appliedModulesByVertical: Record<string, string[]> = {};
  for (const row of data ?? []) {
    const v = row.vertical as string;
    const modules = Array.isArray(row.applied_modules) ? (row.applied_modules as string[]) : [];
    if (!appliedModulesByVertical[v]) appliedModulesByVertical[v] = [];
    for (const m of modules) {
      if (!appliedModulesByVertical[v].includes(m)) appliedModulesByVertical[v].push(m);
    }
  }

  return NextResponse.json({
    applies: data ?? [],
    applied_modules_by_vertical: appliedModulesByVertical,
  });
}
