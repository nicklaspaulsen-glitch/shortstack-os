import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

async function assertOwnsServer(serverId: string, userId: string) {
  const supabase = createServerSupabase();
  const { data } = await supabase
    .from("discord_servers")
    .select("id")
    .eq("id", serverId)
    .eq("profile_id", userId)
    .maybeSingle();
  return !!data;
}

export async function GET(
  _request: NextRequest,
  { params }: { params: { server_id: string } }
) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { server_id } = params;
  if (!(await assertOwnsServer(server_id, user.id)))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { data } = await supabase
    .from("discord_welcome_config")
    .select("*")
    .eq("server_id", server_id)
    .maybeSingle();

  return NextResponse.json({
    config: data || {
      enabled: false,
      message_template: "Welcome {{user}} to {{server}}! You are member #{{member_count}}.",
      embed_enabled: true,
      embed_color: "#5865F2",
      send_dm: false,
    },
  });
}

export async function POST(
  request: NextRequest,
  { params }: { params: { server_id: string } }
) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { server_id } = params;
  if (!(await assertOwnsServer(server_id, user.id)))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await request.json();
  const { data, error } = await supabase
    .from("discord_welcome_config")
    .upsert({ server_id, ...body, updated_at: new Date().toISOString() }, { onConflict: "server_id" })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ config: data });
}
