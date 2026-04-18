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
    .from("discord_moderation")
    .select("*")
    .eq("server_id", server_id)
    .maybeSingle();

  return NextResponse.json({
    config: data || {
      bad_words: [],
      anti_spam_enabled: false,
      anti_spam_rate: 5,
      anti_caps_enabled: false,
      anti_caps_threshold: 70,
      anti_link_enabled: false,
      link_whitelist: [],
      action_type: "warn",
      exempt_roles: [],
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
    .from("discord_moderation")
    .upsert({ server_id, ...body, updated_at: new Date().toISOString() }, { onConflict: "server_id" })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ config: data });
}
