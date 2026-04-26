import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase, createServiceClient } from "@/lib/supabase/server";

// Agent Training — when agents are idle, they self-improve
// Analyzes past performance, learns from failures, optimizes strategies
export async function POST(request: NextRequest) {
  // Auth check — only authenticated users can trigger agent training
  const authSupabase = createServerSupabase();
  const { data: { user } } = await authSupabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { agent_id } = await request.json();
  const supabase = createServiceClient();
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "AI not configured" }, { status: 500 });

  // Get agent's recent history
  const actionTypeMap: Record<string, string> = {
    scout: "lead_gen",
    echo: "outreach",
    pixel: "content",
    wave: "social",
    blaze: "ads",
    trinity: "custom",
    ring: "ai_receptionist",
    nexus: "automation",
  };

  const actionType = actionTypeMap[agent_id] || "custom";

  const [
    { data: recentActions },
    { data: failures },
    { count: totalActions },
    { count: successCount },
  ] = await Promise.all([
    supabase.from("trinity_log").select("description, status, result, created_at").eq("user_id", user.id).eq("action_type", actionType).order("created_at", { ascending: false }).limit(20),
    supabase.from("trinity_log").select("description, error_message, created_at").eq("user_id", user.id).eq("action_type", actionType).eq("status", "failed").order("created_at", { ascending: false }).limit(10),
    supabase.from("trinity_log").select("*", { count: "exact", head: true }).eq("user_id", user.id).eq("action_type", actionType),
    supabase.from("trinity_log").select("*", { count: "exact", head: true }).eq("user_id", user.id).eq("action_type", actionType).eq("status", "completed"),
  ]);

  const successRate = (totalActions || 0) > 0 ? Math.round(((successCount || 0) / (totalActions || 1)) * 100) : 0;

  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 500,
        messages: [{
          role: "user",
          content: `You are the ${agent_id} agent in ShortStack OS. Analyze your recent performance and generate a training report.

Your stats:
- Total actions: ${totalActions || 0}
- Success rate: ${successRate}%
- Recent failures: ${(failures || []).length}

Recent actions:
${(recentActions || []).slice(0, 10).map(a => `- ${a.description} (${a.status})`).join("\n")}

Recent failures:
${(failures || []).slice(0, 5).map(f => `- ${f.description}: ${f.error_message || "unknown error"}`).join("\n") || "None"}

Generate a JSON response:
{
  "self_assessment": "1-2 sentence self-assessment",
  "lessons_learned": ["3 things learned from recent activity"],
  "improvements": ["3 specific improvements to implement"],
  "efficiency_score": 0-100,
  "recommendation": "1 sentence recommendation for the Chief"
}`,
        }],
      }),
    });

    const data = await res.json();
    const text = data.content?.[0]?.text || "";
    const cleaned = text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    const training = JSON.parse(cleaned);

    // Save training results — tag with user_id so future owner-filtered reads include it
    await supabase.from("trinity_log").insert({
      user_id: user.id,
      action_type: actionType,
      description: `Agent ${agent_id} completed self-training: ${training.self_assessment}`,
      status: "completed",
      result: { training, agent_id, success_rate: successRate },
    });

    return NextResponse.json({ success: true, agent_id, training, success_rate: successRate });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
