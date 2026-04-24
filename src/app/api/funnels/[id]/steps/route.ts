import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type Params = { params: { id: string } };

// GET /api/funnels/[id]/steps
export async function GET(_req: NextRequest, { params }: Params) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Verify funnel ownership
  const { data: funnel } = await supabase
    .from("funnels")
    .select("id")
    .eq("id", params.id)
    .eq("profile_id", user.id)
    .single();

  if (!funnel) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { data, error } = await supabase
    .from("funnel_steps")
    .select("*")
    .eq("funnel_id", params.id)
    .order("sort_order", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ steps: data ?? [] });
}

// POST /api/funnels/[id]/steps
export async function POST(req: NextRequest, { params }: Params) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Verify funnel ownership
  const { data: funnel } = await supabase
    .from("funnels")
    .select("id")
    .eq("id", params.id)
    .eq("profile_id", user.id)
    .single();

  if (!funnel) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json();
  const { title, step_type = "opt-in", page_id, sort_order, settings = {} } = body;

  if (!title?.trim()) {
    return NextResponse.json({ error: "title is required" }, { status: 400 });
  }

  // Auto-assign sort_order if not provided
  let order = sort_order;
  if (order === undefined) {
    const { data: existing } = await supabase
      .from("funnel_steps")
      .select("sort_order")
      .eq("funnel_id", params.id)
      .order("sort_order", { ascending: false })
      .limit(1);
    order = existing?.[0] ? (existing[0].sort_order as number) + 1 : 0;
  }

  const { data, error } = await supabase
    .from("funnel_steps")
    .insert({
      funnel_id: params.id,
      title: title.trim(),
      step_type,
      page_id: page_id ?? null,
      sort_order: order,
      settings,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Bump funnel updated_at
  await supabase
    .from("funnels")
    .update({ updated_at: new Date().toISOString() })
    .eq("id", params.id);

  return NextResponse.json({ step: data }, { status: 201 });
}
