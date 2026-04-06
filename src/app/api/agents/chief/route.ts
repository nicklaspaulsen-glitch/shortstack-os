import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase, createServiceClient } from "@/lib/supabase/server";

// AI Chief Agent — the boss that oversees all other agents
// Has full context on what every agent has done, system health, and performance
export async function POST(request: NextRequest) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { message, history } = await request.json();
  const serviceSupabase = createServiceClient();

  // Gather full system context for the Chief
  const [
    { data: recentActions },
    { count: totalLeads },
    { count: activeClients },
    { data: clients },
    { count: dmsSent },
    { count: replies },
    { data: healthData },
    { count: contentPublished },
    { data: recentErrors },
  ] = await Promise.all([
    serviceSupabase.from("trinity_log").select("action_type, description, status, created_at").order("created_at", { ascending: false }).limit(30),
    serviceSupabase.from("leads").select("*", { count: "exact", head: true }),
    serviceSupabase.from("clients").select("*", { count: "exact", head: true }).eq("is_active", true),
    serviceSupabase.from("clients").select("business_name, mrr, health_score").eq("is_active", true),
    serviceSupabase.from("outreach_log").select("*", { count: "exact", head: true }).eq("status", "sent"),
    serviceSupabase.from("outreach_log").select("*", { count: "exact", head: true }).eq("status", "replied"),
    serviceSupabase.from("system_health").select("integration_name, status, error_message"),
    serviceSupabase.from("content_calendar").select("*", { count: "exact", head: true }).eq("status", "published"),
    serviceSupabase.from("trinity_log").select("description, action_type, created_at").eq("status", "failed").order("created_at", { ascending: false }).limit(10),
  ]);

  const totalMRR = (clients || []).reduce((s, c) => s + ((c as { mrr: number }).mrr || 0), 0);
  const unhealthy = (healthData || []).filter(h => h.status === "down" || h.status === "degraded");
  const replyRate = (dmsSent || 0) > 0 ? Math.round(((replies || 0) / (dmsSent || 1)) * 100) : 0;

  // Recent agent activity summary
  const activitySummary = (recentActions || []).slice(0, 15).map(a =>
    `[${a.action_type}] ${a.description} — ${a.status} (${new Date(a.created_at).toLocaleTimeString()})`
  ).join("\n");

  const errorSummary = (recentErrors || []).map(e =>
    `FAILED: [${e.action_type}] ${e.description} (${new Date(e.created_at).toLocaleTimeString()})`
  ).join("\n");

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "AI not configured" }, { status: 500 });

  const messages = [
    ...(history || []).map((h: { role: string; content: string }) => ({
      role: h.role === "chief" ? "assistant" : "user",
      content: h.content,
    })),
    { role: "user", content: message },
  ];

  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 1500,
        system: `You are the Chief AI Agent (codename: "Nexus") of ShortStack OS — the boss overseeing all other AI agents. You manage the entire agency operation.

YOUR AGENTS:
- Scout (Lead Finder) — scrapes leads from Google Maps
- Echo (Outreach) — sends cold DMs and emails
- Pixel (Content AI) — writes scripts and content
- Wave (Social Manager) — manages social media posting
- Blaze (Ads Manager) — runs ad campaigns
- Trinity (AI Assistant) — helps users with voice/text
- Ring (Cold Caller) — makes calls via GHL
- Nexus (Supervisor) — monitors all agents (that's you)

CURRENT SYSTEM STATUS:
- Total Leads: ${totalLeads || 0}
- Active Clients: ${activeClients || 0}
- Total MRR: $${totalMRR}
- DMs Sent: ${dmsSent || 0} (${replyRate}% reply rate)
- Content Published: ${contentPublished || 0}
- System Issues: ${unhealthy.length} integrations need attention
${unhealthy.length > 0 ? `- Unhealthy: ${unhealthy.map(h => `${h.integration_name} (${h.status})`).join(", ")}` : "- All systems healthy"}

RECENT AGENT ACTIVITY:
${activitySummary || "No recent activity"}

${errorSummary ? `RECENT FAILURES:\n${errorSummary}` : "No recent failures"}

YOUR PERSONALITY:
- You're the boss. Direct, decisive, strategic.
- Give clear status updates when asked "what's happening"
- Identify problems proactively and suggest fixes
- Delegate tasks to specific agents by name
- Be concise but thorough
- If something is broken, say so clearly and suggest how to fix it
- When asked to improve the OS, give specific actionable suggestions`,
        messages,
      }),
    });

    const data = await res.json();
    const reply = data.content?.[0]?.text || "Systems nominal. All agents reporting.";

    return NextResponse.json({ reply });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
