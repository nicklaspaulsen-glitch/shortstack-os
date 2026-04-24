import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

/**
 * GET /api/agent-runs
 * Returns a filtered list of agent runs for the supervisor UI.
 * Query params: ?agent=bug-hunt&status=failed&since=2026-04-01&limit=200
 */
export async function GET(req: NextRequest) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if (profile?.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const agent = searchParams.get("agent");
  const status = searchParams.get("status");
  const since = searchParams.get("since");
  const limit = Math.min(parseInt(searchParams.get("limit") || "200", 10) || 200, 1000);

  let q = supabase
    .from("agent_runs")
    .select("*")
    .eq("user_id", user.id)
    .order("started_at", { ascending: false })
    .limit(limit);

  if (agent) q = q.eq("agent_name", agent);
  if (status) q = q.eq("status", status);
  if (since) q = q.gte("started_at", since);

  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ runs: data || [] });
}
