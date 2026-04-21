import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

// GET — caller's installs (joined with plugin catalog)
export async function GET() {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data, error } = await supabase
    .from("marketplace_installs")
    .select("id, plugin_id, installed_at, status, plugin:marketplace_plugins(id, slug, name, description, category, icon_url, price_monthly)")
    .eq("profile_id", user.id)
    .order("installed_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ installs: data ?? [], total: (data ?? []).length });
}

// POST — install a plugin (by plugin_id or slug)
export async function POST(request: NextRequest) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: { plugin_id?: string; slug?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body.plugin_id && !body.slug) {
    return NextResponse.json({ error: "plugin_id or slug is required" }, { status: 400 });
  }

  let pluginId = body.plugin_id;
  if (!pluginId && body.slug) {
    const { data: plugin, error: pErr } = await supabase
      .from("marketplace_plugins")
      .select("id")
      .eq("slug", body.slug)
      .eq("is_active", true)
      .maybeSingle();
    if (pErr) return NextResponse.json({ error: pErr.message }, { status: 500 });
    if (!plugin) return NextResponse.json({ error: "Plugin not found" }, { status: 404 });
    pluginId = plugin.id;
  }

  const { data, error } = await supabase
    .from("marketplace_installs")
    .upsert(
      {
        profile_id: user.id,
        plugin_id: pluginId,
        status: "active",
        installed_at: new Date().toISOString(),
      },
      { onConflict: "profile_id,plugin_id" }
    )
    .select("id, plugin_id, installed_at, status, plugin:marketplace_plugins(id, slug, name)")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ install: data });
}

// DELETE — uninstall a plugin
export async function DELETE(request: NextRequest) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  let pluginId = searchParams.get("plugin_id");
  const slug = searchParams.get("slug");

  if (!pluginId && !slug) {
    return NextResponse.json({ error: "plugin_id or slug is required" }, { status: 400 });
  }

  if (!pluginId && slug) {
    const { data: plugin } = await supabase
      .from("marketplace_plugins")
      .select("id")
      .eq("slug", slug)
      .maybeSingle();
    if (!plugin) return NextResponse.json({ error: "Plugin not found" }, { status: 404 });
    pluginId = plugin.id;
  }

  const { error } = await supabase
    .from("marketplace_installs")
    .delete()
    .eq("profile_id", user.id)
    .eq("plugin_id", pluginId!);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ success: true });
}
