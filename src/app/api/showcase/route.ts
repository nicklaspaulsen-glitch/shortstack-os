import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { getEffectiveOwnerId } from "@/lib/security/require-owned-client";
import { nextAvailableSlug, slugify } from "@/lib/showcase/slug";

// GET /api/showcase — list case studies for caller's org.
// Filters: ?status=draft|published, ?industry=tag, ?service=tag
export async function GET(request: NextRequest) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const ownerId = (await getEffectiveOwnerId(supabase, user.id)) || user.id;

  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status");
  const industry = searchParams.get("industry");
  const service = searchParams.get("service");

  let q = supabase
    .from("case_studies")
    .select("*")
    .eq("org_id", ownerId)
    .order("updated_at", { ascending: false });

  if (status === "published") q = q.eq("published", true);
  if (status === "draft") q = q.eq("published", false);
  if (industry) q = q.contains("industry_tags", [industry]);
  if (service) q = q.contains("service_tags", [service]);

  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Attach view counts per study (small list, one extra query).
  const ids = (data || []).map((c) => c.id);
  let countsByStudy: Record<string, number> = {};
  if (ids.length) {
    const { data: views } = await supabase
      .from("case_study_views")
      .select("case_study_id")
      .in("case_study_id", ids);
    if (views) {
      for (const v of views) {
        countsByStudy[v.case_study_id] = (countsByStudy[v.case_study_id] || 0) + 1;
      }
    }
  }

  const withViews = (data || []).map((c) => ({ ...c, view_count: countsByStudy[c.id] || 0 }));
  return NextResponse.json({ case_studies: withViews });
}

// POST /api/showcase — create a new (draft) case study.
// Body: any subset of editable fields; `title` required.
export async function POST(request: NextRequest) {
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

  const title = typeof body.title === "string" ? body.title.trim() : "";
  if (!title) return NextResponse.json({ error: "title is required" }, { status: 400 });

  const slugHint = typeof body.slug === "string" && body.slug.trim() ? body.slug.trim() : title;
  const slug = await nextAvailableSlug(supabase, slugify(slugHint));

  const insert: Record<string, unknown> = {
    org_id: ownerId,
    created_by: user.id,
    title,
    slug,
  };

  const passthrough = [
    "project_id", "subtitle", "hero_image_url", "hero_video_url", "summary",
    "body_markdown", "metrics", "testimonial", "testimonial_author",
    "testimonial_role", "testimonial_avatar_url", "client_name", "client_logo_url",
    "industry_tags", "service_tags", "seo_title", "seo_description", "og_image_url",
  ] as const;

  for (const k of passthrough) {
    if (k in body && body[k] !== undefined) insert[k] = body[k];
  }

  const { data, error } = await supabase
    .from("case_studies")
    .insert(insert)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ case_study: data }, { status: 201 });
}
