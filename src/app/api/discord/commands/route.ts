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

export async function GET(request: NextRequest) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const serverId = searchParams.get("server_id");
  if (!serverId) return NextResponse.json({ error: "server_id required" }, { status: 400 });
  if (!(await assertOwnsServer(serverId, user.id)))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { data, error } = await supabase
    .from("discord_custom_commands")
    .select("*")
    .eq("server_id", serverId)
    .order("created_at", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ commands: data });
}

export async function POST(request: NextRequest) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const { server_id, trigger, response, embed, roles_required, cooldown_seconds } = body;
  if (!server_id || !trigger || !response) {
    return NextResponse.json({ error: "server_id, trigger, response required" }, { status: 400 });
  }
  if (!(await assertOwnsServer(server_id, user.id)))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { data, error } = await supabase
    .from("discord_custom_commands")
    .insert({ server_id, trigger, response, embed, roles_required, cooldown_seconds: cooldown_seconds || 0 })
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ command: data });
}

export async function PATCH(request: NextRequest) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id, ...patch } = await request.json();
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  // verify ownership
  const { data: cmd } = await supabase
    .from("discord_custom_commands")
    .select("server_id")
    .eq("id", id)
    .maybeSingle();
  if (!cmd || !(await assertOwnsServer(cmd.server_id, user.id)))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { data, error } = await supabase
    .from("discord_custom_commands")
    .update(patch)
    .eq("id", id)
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ command: data });
}

export async function DELETE(request: NextRequest) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  const { data: cmd } = await supabase
    .from("discord_custom_commands")
    .select("server_id")
    .eq("id", id)
    .maybeSingle();
  if (!cmd || !(await assertOwnsServer(cmd.server_id, user.id)))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { error } = await supabase.from("discord_custom_commands").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
