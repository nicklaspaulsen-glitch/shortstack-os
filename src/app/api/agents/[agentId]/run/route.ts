import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

/**
 * POST /api/agents/:agentId/run
 * Kicks off an agent run manually. Inserts an `agent_runs` row in the
 * "running" state, then (for now) flips it to success with a synthetic
 * summary. Wire real agent handlers here by switching on the agent id
 * (kept as `name` locally because `agent_runs.agent_name` is the column).
 *
 * Param is named `agentId` so this segment can coexist as a sibling of
 * /api/agents/[agentId]/health and /api/agents/[agentId]/repair under
 * Next.js's one-slug-name-per-tree-level rule.
 */
export async function POST(
  _req: NextRequest,
  { params }: { params: { agentId: string } },
) {
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

  const name = params.agentId;
  if (!name) return NextResponse.json({ error: "agent name required" }, { status: 400 });

  const startedAt = new Date().toISOString();
  const { data: run, error } = await supabase
    .from("agent_runs")
    .insert({
      user_id: user.id,
      agent_name: name,
      status: "running",
      started_at: startedAt,
    })
    .select("*")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const summary = `Manually triggered ${name} at ${new Date(startedAt).toLocaleTimeString()}`;
  await supabase
    .from("agent_runs")
    .update({
      status: "success",
      finished_at: new Date().toISOString(),
      output_summary: summary,
    })
    .eq("id", run.id);

  await supabase
    .from("agent_configs")
    .update({ last_ran_at: new Date().toISOString() })
    .eq("user_id", user.id)
    .eq("agent_name", name);

  return NextResponse.json({ success: true, run_id: run.id });
}
