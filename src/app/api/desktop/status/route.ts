import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

/**
 * GET /api/desktop/status
 * Returns the most recent desktop heartbeat row for the caller. The UI uses
 * `last_heartbeat_at` to decide whether the Electron shell is currently
 * connected (anything within the last 120s is "online").
 */
export async function GET() {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data, error } = await supabase
    .from("desktop_connections")
    .select("id, version, platform, last_heartbeat_at, capabilities, metadata, created_at")
    .eq("user_id", user.id)
    .order("last_heartbeat_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const now = Date.now();
  const lastMs = data?.last_heartbeat_at ? new Date(data.last_heartbeat_at).getTime() : 0;
  const online = data ? now - lastMs < 120_000 : false;

  return NextResponse.json({
    connected: !!data,
    online,
    connection: data,
  });
}
