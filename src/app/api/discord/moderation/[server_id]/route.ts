import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

const MODERATION_FIELDS = new Set([
  "bad_words",
  "anti_spam_enabled",
  "anti_spam_rate",
  "anti_caps_enabled",
  "anti_caps_threshold",
  "anti_link_enabled",
  "link_whitelist",
  "action_type",
  "exempt_roles",
]);

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
  // Allowlist prevents mass assignment — only known moderation config columns
  // are forwarded. server_id always comes from the authenticated path param.
  const safeBody = Object.fromEntries(
    Object.entries(body as Record<string, unknown>).filter(([k]) => MODERATION_FIELDS.has(k))
  );
  const { data, error } = await supabase
    .from("discord_moderation")
    .upsert({ server_id, ...safeBody, updated_at: new Date().toISOString() }, { onConflict: "server_id" })
    .select()
    .single();

  if (error) return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  return NextResponse.json({ config: data });
}
