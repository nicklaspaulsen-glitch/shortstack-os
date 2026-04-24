import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

// GET — list all dashboards owned by the authenticated user
export async function GET() {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data, error } = await supabase
    .from("custom_dashboards")
    .select("*")
    .eq("user_id", user.id)
    .order("is_default", { ascending: false })
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ dashboards: data ?? [] });
}

// POST — create a new dashboard
export async function POST(req: Request) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await req.json();
    const { data, error } = await supabase
      .from("custom_dashboards")
      .insert({
        user_id: user.id,
        name: body.name ?? "My Dashboard",
        widgets: body.widgets ?? [],
        is_default: !!body.is_default,
      })
      .select("*")
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ dashboard: data });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Invalid request";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}

// PATCH — update a dashboard
export async function PATCH(req: Request) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await req.json();
    if (!body.id) return NextResponse.json({ error: "id required" }, { status: 400 });

    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if ("name" in body) updates.name = body.name;
    if ("widgets" in body) updates.widgets = body.widgets;
    if ("is_default" in body) updates.is_default = !!body.is_default;

    // If setting is_default=true, clear it on other dashboards first
    if (body.is_default === true) {
      await supabase
        .from("custom_dashboards")
        .update({ is_default: false })
        .eq("user_id", user.id)
        .neq("id", body.id);
    }

    const { data, error } = await supabase
      .from("custom_dashboards")
      .update(updates)
      .eq("id", body.id)
      .eq("user_id", user.id)
      .select("*")
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ dashboard: data });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Invalid request";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}

// DELETE — delete a dashboard by id
export async function DELETE(req: Request) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(req.url);
  const id = url.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  const { error } = await supabase
    .from("custom_dashboards")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
