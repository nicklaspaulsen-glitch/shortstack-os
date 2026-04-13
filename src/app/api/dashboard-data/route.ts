import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

export async function GET() {
  const supabase = createServerSupabase();

  // Verify auth
  const {
    data: { user },
    error: authErr,
  } = await supabase.auth.getUser();

  if (!user || authErr) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const today = new Date().toISOString().split("T")[0];
  const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString();

  try {
    const [
      { count: leadsToday },
      { count: totalLeads },
      { count: dmsSentToday },
      { count: repliesThisWeek },
      { count: activeClients },
      { data: clients },
      { count: callsBooked },
      { count: systemIssues },
      { count: trinityActions },
      { data: leads },
      { data: activity },
      { count: dealsWon },
      { data: deals },
      { data: topClients },
      { count: emailsSent },
      { count: smsSent },
      { count: callsMade },
      { count: pNew },
      { count: pCalled },
      { count: pReplied },
      { count: pBooked },
      { count: pConverted },
    ] = await Promise.all([
      supabase.from("leads").select("*", { count: "exact", head: true }).gte("scraped_at", today),
      supabase.from("leads").select("*", { count: "exact", head: true }),
      supabase.from("outreach_log").select("*", { count: "exact", head: true }).gte("sent_at", today),
      supabase.from("outreach_log").select("*", { count: "exact", head: true }).eq("status", "replied").gte("sent_at", weekAgo),
      supabase.from("clients").select("*", { count: "exact", head: true }).eq("is_active", true),
      supabase.from("clients").select("mrr").eq("is_active", true),
      supabase.from("leads").select("*", { count: "exact", head: true }).eq("status", "booked"),
      supabase.from("system_health").select("*", { count: "exact", head: true }).eq("status", "down"),
      supabase.from("trinity_log").select("*", { count: "exact", head: true }).gte("created_at", today),
      supabase.from("leads").select("business_name, industry, source, scraped_at, lead_score").order("scraped_at", { ascending: false }).limit(6),
      supabase.from("trinity_log").select("description, status, created_at, action_type").order("created_at", { ascending: false }).limit(8),
      supabase.from("deals").select("*", { count: "exact", head: true }).eq("status", "won"),
      supabase.from("deals").select("amount").eq("status", "won"),
      supabase.from("clients").select("id, business_name, mrr, health_score, package_tier").eq("is_active", true).order("mrr", { ascending: false }).limit(5),
      supabase.from("outreach_log").select("*", { count: "exact", head: true }).eq("platform", "email").gte("sent_at", today),
      supabase.from("outreach_log").select("*", { count: "exact", head: true }).eq("platform", "sms").gte("sent_at", today),
      supabase.from("outreach_log").select("*", { count: "exact", head: true }).eq("platform", "call").gte("sent_at", today),
      supabase.from("leads").select("*", { count: "exact", head: true }).eq("status", "new"),
      supabase.from("leads").select("*", { count: "exact", head: true }).eq("status", "called"),
      supabase.from("leads").select("*", { count: "exact", head: true }).eq("status", "replied"),
      supabase.from("leads").select("*", { count: "exact", head: true }).eq("status", "booked"),
      supabase.from("leads").select("*", { count: "exact", head: true }).in("status", ["converted", "closed_won"]),
    ]);

    const totalMRR = clients?.reduce((sum: number, c: { mrr: number | null }) => sum + (c.mrr || 0), 0) || 0;
    const totalRevenue = deals?.reduce((sum: number, d: { amount: number | null }) => sum + (d.amount || 0), 0) || 0;

    // Agent statuses from activity logs
    const agentNames = [
      { id: "lead-engine", name: "Lead Engine" }, { id: "outreach", name: "Outreach" },
      { id: "content", name: "Content" }, { id: "ads", name: "Ads" },
      { id: "reviews", name: "Reviews" }, { id: "analytics", name: "Analytics" },
      { id: "trinity", name: "Trinity" }, { id: "invoice", name: "Invoice" },
      { id: "onboarding", name: "Onboarding" }, { id: "seo", name: "SEO" },
      { id: "social-media", name: "Social" }, { id: "retention", name: "Retention" },
    ];
    const { data: agentLogs } = await supabase
      .from("trinity_log")
      .select("action_type, status, created_at")
      .gte("created_at", weekAgo)
      .order("created_at", { ascending: false })
      .limit(200);
    const logs = agentLogs || [];
    const agentStatuses = agentNames.map((a) => {
      const aLogs = logs.filter(
        (l: { action_type: string }) =>
          l.action_type === a.id || l.action_type === a.name.toLowerCase().replace(/ /g, "_")
      );
      const todayLogs = aLogs.filter((l: { created_at: string }) => l.created_at >= today);
      const hasError = aLogs
        .slice(0, 3)
        .some((l: { status: string }) => l.status === "error" || l.status === "failed");
      const hasRecent =
        aLogs[0] && Date.now() - new Date(aLogs[0].created_at).getTime() < 3600000;
      return {
        id: a.id,
        name: a.name,
        status: hasError ? "error" : hasRecent ? "working" : "idle",
        actionsToday: todayLogs.length,
      };
    });

    return NextResponse.json({
      stats: {
        leadsToday: leadsToday || 0,
        totalLeads: totalLeads || 0,
        dmsSentToday: dmsSentToday || 0,
        dmsTarget: 80,
        repliesThisWeek: repliesThisWeek || 0,
        activeClients: activeClients || 0,
        totalMRR,
        callsBooked: callsBooked || 0,
        systemIssues: systemIssues || 0,
        trinityActions: trinityActions || 0,
        dealsWon: dealsWon || 0,
        totalRevenue,
        emailsSent: emailsSent || 0,
        smsSent: smsSent || 0,
        callsMade: callsMade || 0,
      },
      pipeline: {
        new: pNew || 0,
        called: pCalled || 0,
        replied: pReplied || 0,
        booked: pBooked || 0,
        converted: pConverted || 0,
      },
      recentLeads: leads || [],
      recentActivity: activity || [],
      topClients: topClients || [],
      agentStatuses,
    });
  } catch (err) {
    console.error("[dashboard-data] Error:", err);
    return NextResponse.json({ error: "Failed to fetch dashboard data" }, { status: 500 });
  }
}
