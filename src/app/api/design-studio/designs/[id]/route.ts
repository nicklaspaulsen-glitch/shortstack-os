/**
 * Design Studio — /api/design-studio/designs/[id]
 * GET    → fetch a single design (full doc)
 * PATCH  → update title / doc / thumbnail_url
 * DELETE → delete design + cascade jobs
 */

import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { requireOwnedClient } from "@/lib/security/require-owned-client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface RouteParams {
  params: { id: string };
}

async function resolveDesign(supabase: ReturnType<typeof createServerSupabase>, id: string, ownerId: string) {
  const { data, error } = await supabase
    .from("designs")
    .select("*")
    .eq("id", id)
    .single();

  if (error || !data) return null;
  // RLS enforces user_id = auth.uid() but we double-check against ownerId
  // (team_member → parent_agency_id resolution)
  if (data.user_id !== ownerId) return null;
  return data;
}

export async function GET(_req: NextRequest, { params }: RouteParams) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const ctx = await requireOwnedClient(supabase, user.id);
  if (!ctx) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const design = await resolveDesign(supabase, params.id, ctx.ownerId);
  if (!design) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({ data: design });
}

export async function PATCH(req: NextRequest, { params }: RouteParams) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const ctx = await requireOwnedClient(supabase, user.id);
  if (!ctx) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const existing = await resolveDesign(supabase, params.id, ctx.ownerId);
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  let body: {
    title?: string;
    doc?: unknown;
    thumbnail_url?: string;
    client_id?: string | null;
  };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  // Validate client ownership if being reassigned
  if (body.client_id !== undefined && body.client_id !== null) {
    const clientCtx = await requireOwnedClient(supabase, user.id, body.client_id);
    if (!clientCtx) return NextResponse.json({ error: "Forbidden: client not owned" }, { status: 403 });
  }

  const patch: Record<string, unknown> = {};
  if (body.title !== undefined) patch.title = body.title;
  if (body.doc !== undefined) patch.doc = body.doc;
  if (body.thumbnail_url !== undefined) patch.thumbnail_url = body.thumbnail_url;
  if (body.client_id !== undefined) patch.client_id = body.client_id;

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "No fields to update" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("designs")
    .update(patch)
    .eq("id", params.id)
    .select()
    .single();

  if (error) {
    console.error("[design-studio/designs/[id]] update error", error);
    return NextResponse.json({ error: "Failed to update design" }, { status: 500 });
  }

  return NextResponse.json({ data });
}

export async function DELETE(_req: NextRequest, { params }: RouteParams) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const ctx = await requireOwnedClient(supabase, user.id);
  if (!ctx) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const existing = await resolveDesign(supabase, params.id, ctx.ownerId);
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { error } = await supabase
    .from("designs")
    .delete()
    .eq("id", params.id);

  if (error) {
    console.error("[design-studio/designs/[id]] delete error", error);
    return NextResponse.json({ error: "Failed to delete design" }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
