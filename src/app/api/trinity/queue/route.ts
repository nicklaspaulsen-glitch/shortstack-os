import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

// GET — Active/pending Trinity actions grouped by agent.
// Reads `trinity_log` rows where status IN ('queued','running') for the caller.
export async function GET() {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data, error } = await supabase
    .from("trinity_log")
    .select("id, action_type, description, status, agent, started_at, created_at, metadata")
    .eq("profile_id", user.id)
    .in("status", ["queued", "running"])
    .order("created_at", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const rows = data ?? [];
  const byAgent: Record<string, Array<{
    id: string;
    action_type: string;
    description: string;
    status: string;
    started_at: string | null;
    created_at: string | null;
  }>> = {};

  for (const r of rows) {
    const agent = r.agent || "trinity";
    if (!byAgent[agent]) byAgent[agent] = [];
    byAgent[agent].push({
      id: r.id,
      action_type: r.action_type,
      description: r.description,
      status: r.status || "queued",
      started_at: r.started_at,
      created_at: r.created_at,
    });
  }

  const agents = Object.keys(byAgent).map(name => ({
    name,
    count: byAgent[name].length,
    active: byAgent[name].filter(q => q.status === "running").length,
    queued: byAgent[name].filter(q => q.status === "queued").length,
  }));

  return NextResponse.json({
    agents,
    queue: rows.map(r => ({
      id: r.id,
      agent: r.agent || "trinity",
      action_type: r.action_type,
      description: r.description,
      status: r.status || "queued",
      priority: (r.metadata as { priority?: string } | null)?.priority ?? "medium",
      started_at: r.started_at,
      created_at: r.created_at,
    })),
    total: rows.length,
  });
}
