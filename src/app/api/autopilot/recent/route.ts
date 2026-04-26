import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase, createServiceClient } from "@/lib/supabase/server";
import { getEffectiveOwnerId } from "@/lib/security/require-owned-client";

export async function GET(_request: NextRequest) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const ownerId = await getEffectiveOwnerId(supabase, user.id);
  if (!ownerId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const serviceSupabase = createServiceClient();

  // Find clients that have autopilot entries in trinity_log — filtered by owner
  const { data: autopilotLogs } = await serviceSupabase
    .from("trinity_log")
    .select("client_id, action_type, created_at")
    .eq("user_id", ownerId)
    .like("action_type", "autopilot_%")
    .order("created_at", { ascending: false })
    .limit(100);

  if (!autopilotLogs || autopilotLogs.length === 0) {
    return NextResponse.json({ clients: [] });
  }

  // Group by client_id
  const clientMap = new Map<string, { tasks_done: number; last_run: string }>();
  for (const log of autopilotLogs) {
    if (!log.client_id) continue;
    const existing = clientMap.get(log.client_id);
    if (existing) {
      existing.tasks_done++;
      if (log.created_at > existing.last_run) existing.last_run = log.created_at;
    } else {
      clientMap.set(log.client_id, { tasks_done: 1, last_run: log.created_at });
    }
  }

  // Get client names — constrained to owner's clients for defence-in-depth
  const clientIds = Array.from(clientMap.keys());
  const { data: clients } = await serviceSupabase
    .from("clients")
    .select("id, business_name")
    .eq("profile_id", ownerId)
    .in("id", clientIds);

  const result = clientIds.map(id => {
    const client = clients?.find(c => c.id === id);
    const stats = clientMap.get(id)!;
    return {
      client_name: client?.business_name || "Unknown",
      tasks_done: stats.tasks_done,
      last_run: stats.last_run,
    };
  }).sort((a, b) => b.tasks_done - a.tasks_done);

  return NextResponse.json({ clients: result });
}
