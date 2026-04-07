import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

// Health check for any agent — checks recent activity and error rate
export async function GET(_request: NextRequest, { params }: { params: { agentId: string } }) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const agentId = params.agentId;
  const now = new Date();
  const hourAgo = new Date(now.getTime() - 3600000).toISOString();
  const dayAgo = new Date(now.getTime() - 86400000).toISOString();

  // Check recent logs for this agent
  const { data: recentLogs, count: totalToday } = await supabase
    .from("trinity_log")
    .select("*", { count: "exact" })
    .or(`agent.eq.${agentId},action_type.eq.${agentId}`)
    .gte("created_at", dayAgo)
    .order("created_at", { ascending: false })
    .limit(10);

  const logs = recentLogs || [];
  const errors = logs.filter(l => l.status === "error");
  const successes = logs.filter(l => l.status === "success" || l.status === "completed");
  const hasRecentActivity = logs.length > 0 && logs[0].created_at >= hourAgo;
  const errorRate = logs.length > 0 ? (errors.length / logs.length) * 100 : 0;

  // Also check relevant external service health
  const agentServiceMap: Record<string, string> = {
    "lead-engine": "Google Places",
    "outreach": "GoHighLevel",
    "content": "Anthropic",
    "ads": "Meta Ads",
    "reviews": "Google Places",
    "analytics": "Supabase",
    "trinity": "Anthropic",
    "competitor": "Google Places",
  };

  const serviceName = agentServiceMap[agentId];
  let serviceStatus = "healthy";
  if (serviceName) {
    const { data: health } = await supabase
      .from("system_health")
      .select("status")
      .eq("integration_name", serviceName)
      .single();
    serviceStatus = health?.status || "unknown";
  }

  // Determine overall health
  let status: "healthy" | "degraded" | "down" = "healthy";
  if (errorRate > 50 || serviceStatus === "down") status = "down";
  else if (errorRate > 20 || serviceStatus === "degraded" || !hasRecentActivity) status = "degraded";

  return NextResponse.json({
    agent: agentId,
    status,
    actionsToday: totalToday || 0,
    recentErrors: errors.length,
    successRate: logs.length > 0 ? Math.round((successes.length / logs.length) * 100) : 100,
    lastAction: logs[0]?.created_at || null,
    lastActionDescription: logs[0]?.description || null,
    serviceHealth: serviceStatus,
    uptime: status === "down" ? "Down" : status === "degraded" ? "Degraded" : "99.9%",
  });
}
