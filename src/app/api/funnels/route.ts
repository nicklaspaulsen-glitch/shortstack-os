import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

// GET /api/funnels — list all funnels for the authenticated user
export async function GET(req: NextRequest) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status");

  let query = supabase
    .from("funnels")
    .select(`
      *,
      funnel_steps(count),
      funnel_analytics(count)
    `)
    .eq("profile_id", user.id)
    .order("created_at", { ascending: false });

  if (status && status !== "all") {
    query = query.eq("status", status);
  }

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Compute view counts and conversion rates per funnel
  const funnelsWithStats = await Promise.all(
    (data ?? []).map(async (funnel) => {
      const { data: analytics } = await supabase
        .from("funnel_analytics")
        .select("event_type, step_id")
        .eq("funnel_id", funnel.id);

      const views = (analytics ?? []).filter((a) => a.event_type === "view").length;
      const submits = (analytics ?? []).filter((a) => a.event_type === "submit").length;
      const conversionRate = views > 0 ? Math.round((submits / views) * 100) : 0;

      return {
        ...funnel,
        step_count: (funnel.funnel_steps as unknown as { count: number }[])?.[0]?.count ?? 0,
        total_views: views,
        conversion_rate: conversionRate,
      };
    })
  );

  return NextResponse.json({ funnels: funnelsWithStats });
}

// POST /api/funnels — create a new funnel
export async function POST(req: NextRequest) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { name, description, status = "draft" } = body;

  if (!name?.trim()) {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }

  // Auto-generate a public slug. Adds a short random suffix to avoid
  // collisions across tenants when two agencies pick the same name.
  // Slug uniqueness is enforced by the funnels_slug_unique partial
  // index added in the 20260427 ghl_phase2 migration.
  const baseSlug = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);
  const slug = `${baseSlug || "funnel"}-${Math.random().toString(36).slice(2, 8)}`;

  const { data, error } = await supabase
    .from("funnels")
    .insert({ profile_id: user.id, name: name.trim(), description, status, slug })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ funnel: data }, { status: 201 });
}
