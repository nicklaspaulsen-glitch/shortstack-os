import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase, createServiceClient } from "@/lib/supabase/server";

// AI Insights Engine — auto-generates personalized recommendations for each client
// Based on their industry, pain points, connected accounts, content, and performance
export async function GET(request: NextRequest) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const clientId = request.nextUrl.searchParams.get("client_id");
  const serviceSupabase = createServiceClient();

  // Find client
  let cId = clientId;
  if (!cId) {
    const { data: client } = await serviceSupabase.from("clients").select("id").eq("profile_id", user.id).single();
    cId = client?.id;
  }
  if (!cId) return NextResponse.json({ insights: [] });

  // Check cache — don't regenerate if we have fresh insights (< 6 hours)
  const { data: cached } = await serviceSupabase
    .from("trinity_log")
    .select("result, created_at")
    .eq("client_id", cId)
    .eq("action_type", "insights")
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  if (cached?.result && cached.created_at) {
    const age = Date.now() - new Date(cached.created_at).getTime();
    if (age < 6 * 3600000) {
      return NextResponse.json({ insights: cached.result, cached: true });
    }
  }

  // Gather all client data
  const [
    { data: client },
    { data: socials },
    { data: content },
    { data: tasks },
    { count: leadsCount },
    { data: campaigns },
    {},
  ] = await Promise.all([
    serviceSupabase.from("clients").select("*").eq("id", cId).single(),
    serviceSupabase.from("social_accounts").select("platform, account_name, is_active").eq("client_id", cId),
    serviceSupabase.from("content_calendar").select("title, platform, status, scheduled_at").eq("client_id", cId).order("created_at", { ascending: false }).limit(10),
    serviceSupabase.from("client_tasks").select("title, is_completed").eq("client_id", cId),
    serviceSupabase.from("leads").select("*", { count: "exact", head: true }).eq("client_id", cId),
    serviceSupabase.from("campaigns").select("name, platform, status, spend, roas").eq("client_id", cId),
    serviceSupabase.from("trinity_log").select("description, action_type, created_at").eq("client_id", cId).order("created_at", { ascending: false }).limit(5),
  ]);

  if (!client) return NextResponse.json({ insights: [] });

  const meta = (client.metadata as Record<string, unknown>) || {};
  const connectedPlatforms = (socials || []).filter(s => s.is_active).map(s => s.platform);
  const publishedContent = (content || []).filter(c => c.status === "published").length;
  const completedTasks = (tasks || []).filter(t => t.is_completed).length;
  const totalTasks = (tasks || []).length;

  // Build context for AI
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return NextResponse.json({ insights: [] });

  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 2000,
        system: "You are an expert marketing strategist for ShortStack agency. Generate specific, actionable insights for this client. Be direct and data-driven. Return ONLY a JSON array.",
        messages: [{
          role: "user",
          content: `Generate 6 personalized AI insights/recommendations for this client. Each should be immediately actionable.

CLIENT DATA:
- Business: ${client.business_name}
- Industry: ${client.industry}
- Services: ${(client.services || []).join(", ")}
- MRR: $${client.mrr}
- Health Score: ${client.health_score}%
- Pain Points: ${meta.biggest_challenge || "not specified"}
- Goals: ${meta.goals || "grow their business"}
- Ideal Customer: ${meta.ideal_customer || "not specified"}
- Past Marketing: ${meta.past_marketing || "not specified"}
- Connected Platforms: ${connectedPlatforms.join(", ") || "none"}
- Content Published: ${publishedContent}
- Tasks: ${completedTasks}/${totalTasks} done
- Active Campaigns: ${(campaigns || []).filter(c => c.status === "active").length}
- Leads Generated: ${leadsCount || 0}

Return JSON array where each item has:
- "type": one of "content_idea", "strategy", "action_item", "competitor_insight", "growth_tip", "quick_win"
- "title": short headline (under 60 chars)
- "description": 1-2 sentence explanation
- "action": specific thing to do right now
- "priority": "high", "medium", or "low"
- "category": "content", "ads", "seo", "social", "operations", "growth"

Make them SPECIFIC to their industry and situation. Not generic advice.`,
        }],
      }),
    });

    const data = await res.json();
    const text = data.content?.[0]?.text || "";
    const jsonMatch = text.match(/\[[\s\S]*\]/);

    if (jsonMatch) {
      const insights = JSON.parse(jsonMatch[0]);

      // Cache insights
      await serviceSupabase.from("trinity_log").insert({
        action_type: "insights",
        description: `AI generated ${insights.length} insights for ${client.business_name}`,
        client_id: cId,
        status: "completed",
        result: insights,
      });

      return NextResponse.json({ insights, cached: false });
    }

    return NextResponse.json({ insights: [], error: "Failed to parse" });
  } catch (err) {
    return NextResponse.json({ insights: [], error: String(err) });
  }
}
