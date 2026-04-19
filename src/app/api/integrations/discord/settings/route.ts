import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

/**
 * GET  /api/integrations/discord/settings — list the user's installed integrations
 * PATCH /api/integrations/discord/settings — update channel/toggles for one integration
 * DELETE /api/integrations/discord/settings — remove one integration
 */

export async function GET() {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data, error } = await supabase
    .from("discord_integrations")
    .select(
      "id, guild_id, guild_name, icon_hash, installed_at, notifications_enabled, notify_channel_id, notify_on, installed_bot_id"
    )
    .eq("user_id", user.id)
    .order("installed_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ integrations: data || [] });
}

export async function PATCH(request: NextRequest) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const { id, notify_channel_id, notifications_enabled, notify_on } = body as {
    id?: string;
    notify_channel_id?: string | null;
    notifications_enabled?: boolean;
    notify_on?: Record<string, boolean>;
  };

  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  const update: Record<string, unknown> = {};
  if (typeof notifications_enabled === "boolean") update.notifications_enabled = notifications_enabled;
  if (notify_channel_id !== undefined) update.notify_channel_id = notify_channel_id;
  if (notify_on) update.notify_on = notify_on;

  const { error } = await supabase
    .from("discord_integrations")
    .update(update)
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ success: true });
}

export async function DELETE(request: NextRequest) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const { id } = body as { id?: string };
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  const { error } = await supabase
    .from("discord_integrations")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ success: true });
}
