import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

/**
 * POST /api/desktop/ping
 * Electron shell sends this every ~30s with its version + capabilities so the
 * web dashboard can show a live "desktop connected" indicator. Upserts on
 * (user_id, version) so we don't spray rows each heartbeat — we update the
 * existing row's `last_heartbeat_at`.
 */
export async function POST(req: NextRequest) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const version = typeof body.version === "string" ? body.version : "unknown";
  const platform = typeof body.platform === "string" ? body.platform : "unknown";
  const capabilities = Array.isArray(body.capabilities)
    ? body.capabilities.filter((c: unknown) => typeof c === "string")
    : [];

  const { data: existing } = await supabase
    .from("desktop_connections")
    .select("id")
    .eq("user_id", user.id)
    .eq("version", version)
    .limit(1)
    .maybeSingle();

  const now = new Date().toISOString();
  if (existing) {
    const { error } = await supabase
      .from("desktop_connections")
      .update({
        last_heartbeat_at: now,
        platform,
        capabilities,
        updated_at: now,
      })
      .eq("id", existing.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true, id: existing.id });
  }

  const { data: inserted, error } = await supabase
    .from("desktop_connections")
    .insert({
      user_id: user.id,
      version,
      platform,
      capabilities,
      last_heartbeat_at: now,
    })
    .select("id")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true, id: inserted.id });
}
