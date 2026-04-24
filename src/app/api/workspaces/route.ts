/**
 * Workspaces API — CRUD over `workspaces` table.
 *
 * Note: the `workspaces` table predates this route and uses `profile_id`
 * (not user_id) as its owner column. RLS matches `profile_id = auth.uid()`.
 * We keep that schema and expose it unchanged here.
 */
import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { getEffectiveOwnerId } from "@/lib/security/require-owned-client";

function slugify(s: string) {
  return s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
}

export async function GET() {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const ownerId = (await getEffectiveOwnerId(supabase, user.id)) || user.id;

  const { data, error } = await supabase
    .from("workspaces")
    .select("id, profile_id, name, slug, description, logo_url, color_scheme, is_default, is_active, branding, created_at, updated_at")
    .eq("profile_id", ownerId)
    .order("is_default", { ascending: false })
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ workspaces: data ?? [] });
}

export async function POST(request: NextRequest) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const ownerId = (await getEffectiveOwnerId(supabase, user.id)) || user.id;

  const body = await request.json();
  const { name, slug, description, logo_url, color_scheme, is_default } = body ?? {};
  if (!name || typeof name !== "string") {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }

  const resolvedSlug = (slug && typeof slug === "string" ? slug : slugify(name)) || slugify(name);

  if (is_default) {
    await supabase
      .from("workspaces")
      .update({ is_default: false })
      .eq("profile_id", ownerId)
      .eq("is_default", true);
  }

  const { data, error } = await supabase
    .from("workspaces")
    .insert({
      profile_id: ownerId,
      name: name.trim(),
      slug: resolvedSlug,
      description: description || null,
      logo_url: logo_url || null,
      color_scheme: color_scheme || "#C9A84C",
      is_default: !!is_default,
      is_active: true,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ workspace: data }, { status: 201 });
}

export async function PATCH(request: NextRequest) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const ownerId = (await getEffectiveOwnerId(supabase, user.id)) || user.id;

  const body = await request.json();
  const { id, ...updates } = body ?? {};
  if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });

  const allowed = ["name", "slug", "description", "logo_url", "color_scheme", "is_default", "is_active"];
  const safe: Record<string, unknown> = {};
  for (const k of allowed) if (k in updates) safe[k] = updates[k];
  if (Object.keys(safe).length === 0) {
    return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
  }
  safe.updated_at = new Date().toISOString();

  if (safe.is_default === true) {
    await supabase
      .from("workspaces")
      .update({ is_default: false })
      .eq("profile_id", ownerId)
      .eq("is_default", true)
      .neq("id", id);
  }

  const { data, error } = await supabase
    .from("workspaces")
    .update(safe)
    .eq("id", id)
    .eq("profile_id", ownerId)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ workspace: data });
}

export async function DELETE(request: NextRequest) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const ownerId = (await getEffectiveOwnerId(supabase, user.id)) || user.id;

  const { id } = await request.json();
  if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });

  const { error } = await supabase
    .from("workspaces")
    .delete()
    .eq("id", id)
    .eq("profile_id", ownerId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
