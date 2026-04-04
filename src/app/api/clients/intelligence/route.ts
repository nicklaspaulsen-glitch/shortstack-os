import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

// Client Intelligence Report — AI generates comprehensive market intelligence
export async function POST(request: NextRequest) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { client_id } = await request.json();

  const { data: client } = await supabase.from("clients").select("*").eq("id", client_id).single();
  if (!client) return NextResponse.json({ error: "Client not found" }, { status: 404 });

  // Gather all client data
  const [
    { count: tasksCompleted },
    { count: totalTasks },
    { count: contentCount },
    { data: campaigns },
    { count: invoicesPaid },
  ] = await Promise.all([
    supabase.from("client_tasks").select("*", { count: "exact", head: true }).eq("client_id", client_id).eq("is_completed", true),
    supabase.from("client_tasks").select("*", { count: "exact", head: true }).eq("client_id", client_id),
    supabase.from("content_scripts").select("*", { count: "exact", head: true }).eq("client_id", client_id),
    supabase.from("campaigns").select("*").eq("client_id", client_id),
    supabase.from("invoices").select("*", { count: "exact", head: true }).eq("client_id", client_id).eq("status", "paid"),
  ]);

  const totalSpend = campaigns?.reduce((s, c) => s + (c.spend || 0), 0) || 0;
  const totalConversions = campaigns?.reduce((s, c) => s + (c.conversions || 0), 0) || 0;

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "AI not configured" }, { status: 500 });

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: 3000,
      system: "You are a business intelligence analyst. Generate actionable market intelligence for a business. Return valid JSON only.",
      messages: [{ role: "user", content: `Generate market intelligence report for:
Business: ${client.business_name}
Industry: ${client.industry || "business"}
Location: Based on services provided
Current package: ${client.package_tier}
MRR: $${client.mrr}
Tasks: ${tasksCompleted}/${totalTasks} completed
Content pieces: ${contentCount}
Ad spend: $${totalSpend}
Conversions: ${totalConversions}
Services: ${(client.services || []).join(", ")}

Return JSON with:
- market_position: { current_score (1-100), potential_score, industry_avg }
- growth_trajectory: { current_growth_rate, projected_growth_rate, time_to_market_leader }
- industry_trends: array of { trend, impact (high/medium/low), recommendation }
- content_opportunities: array of { topic, search_volume_estimate, difficulty (easy/medium/hard), potential_traffic }
- local_seo_opportunities: array of { keyword, monthly_searches, current_ranking_estimate, opportunity }
- social_media_benchmarks: { followers_benchmark, engagement_benchmark, posting_frequency_benchmark }
- revenue_projections: { month_3, month_6, month_12 }
- risk_factors: array of { risk, severity (high/medium/low), mitigation }
- quick_wins: array of 5 immediate actions that would improve their position
- competitive_advantages: array of unique strengths to leverage
- recommended_next_steps: array of prioritized strategic actions` }],
    }),
  });

  const data = await res.json();
  const text = data.content?.[0]?.text || "{}";
  const cleaned = text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();

  try {
    return NextResponse.json({ success: true, intelligence: JSON.parse(cleaned) });
  } catch {
    return NextResponse.json({ success: true, intelligence: { raw: text } });
  }
}
