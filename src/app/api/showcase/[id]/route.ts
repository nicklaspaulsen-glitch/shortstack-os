import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { getEffectiveOwnerId } from "@/lib/security/require-owned-client";
import { nextAvailableSlug, slugify } from "@/lib/showcase/slug";

// GET /api/showcase/[id] — fetch one (incl. drafts) for caller's org.
export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } },
) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const ownerId = (await getEffectiveOwnerId(supabase, user.id)) || user.id;

  const { data: cs, error } = await supabase
    .from("case_studies")
    .select("*")
    .eq("id", params.id)
    .eq("org_id", ownerId)
    .single();

  if (error || !cs) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { data: assets } = await supabase
    .from("case_study_assets")
    .select("*")
    .eq("case_study_id", cs.id)
    .order("position", { ascending: true });

  return NextResponse.json({ case_study: cs, assets: assets ?? [] });
}

// PATCH /api/showcase/[id] — update editable fields.
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const ownerId = (await getEffectiveOwnerId(supabase, user.id)) || user.id;

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const editable = [
    "title", "subtitle", "hero_image_url", "hero_video_url", "summary",
    "body_markdown", "metrics", "testimonial", "testimonial_author",
    "testimonial_role", "testimonial_avatar_url", "client_name", "client_logo_url",
    "industry_tags", "service_tags", "seo_title", "seo_description", "og_image_url",
    "project_id",
  ] as const;

  const updates: Record<string, unknown> = {};
  for (const k of editable) {
    if (k in body) updates[k] = body[k];
  }

  // Slug rename — guard uniqueness and scope to caller's org.
  if (typeof body.slug === "string" && body.slug.trim()) {
    const cand = slugify(body.slug);
    const existing = await supabase
      .from("case_studies")
      .select("id, slug")
      .eq("id", params.id)
      .eq("org_id", ownerId)
      .single();
    if (!existing.data) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (existing.data.slug !== cand) {
      updates.slug = await nextAvailableSlug(supabase, cand, { excludeId: params.id });
    }
  }

  if (!Object.keys(updates).length) {
    return NextResponse.json({ error: "No updates" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("case_studies")
    .update(updates)
    .eq("id", params.id)
    .eq("org_id", ownerId)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ case_study: data });
}

// DELETE /api/showcase/[id] — admins (agency owner only) can delete.
export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } },
) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Enforce admin: require caller to BE the org_id (not a team_member).
  const { data: cs } = await supabase
    .from("case_studies")
    .select("id, org_id")
    .eq("id", params.id)
    .single();
  if (!cs) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (cs.org_id !== user.id) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { error } = await supabase.from("case_studies").delete().eq("id", params.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
