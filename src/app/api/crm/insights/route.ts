import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase, createServiceClient } from "@/lib/supabase/server";
import { anthropic, MODEL_HAIKU, safeJsonParse, getResponseText } from "@/lib/ai/claude-helpers";
import { checkAiRateLimit } from "@/lib/api-rate-limit";

/* Types */
interface Insight {
  priority: "high" | "medium" | "low";
  category: "follow_up" | "close" | "nurture" | "qualify" | "warning";
  title: string;
  action: string;
  reason: string;
  suggested_message?: string;
  estimated_win_probability?: number;
}

const SYSTEM_PROMPT = `You are a senior sales coach analyzing CRM data to recommend the next best action for leads, deals, or clients.

Given context about a lead/deal/client (status, interactions, timeline, value, stage), produce 3-5 actionable insights as JSON.

Categories:
- follow_up: Contact has gone silent, time to re-engage
- close: High-intent signals, ready to close
- nurture: Long-term relationship building
- qualify: Need more discovery
- warning: Deal is at risk (stalled, ghosted, competitor mentions)

Return valid JSON only:
{
  "insights": [
    {
      "priority": "high" | "medium" | "low",
      "category": "follow_up" | "close" | "nurture" | "qualify" | "warning",
      "title": "Short action headline",
      "action": "Specific next step (one sentence)",
      "reason": "Why this matters (one sentence, with specifics)",
      "suggested_message": "Optional: draft message to send (2-3 sentences max)",
      "estimated_win_probability": 0-100
    }
  ],
  "health_score": 0-100,
  "summary": "One-line overall assessment"
}`;

export async function POST(req: NextRequest) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const limited = checkAiRateLimit(user.id);
  if (limited) return limited;

  const body = await req.json();
  const { entity_type, entity_id } = body;

  if (!entity_type || !entity_id) {
    return NextResponse.json({ error: "entity_type and entity_id required" }, { status: 400 });
  }

  // Fetch entity context — always scope by the caller's user_id so users can't
  // generate insights for someone else's lead / deal / client by guessing an ID.
  const context: Record<string, unknown> = {};

  if (entity_type === "lead") {
    const { data: lead } = await supabase
      .from("leads")
      .select("*")
      .eq("id", entity_id)
      .eq("user_id", user.id)
      .maybeSingle();
    if (!lead) return NextResponse.json({ error: "Lead not found" }, { status: 404 });
    context.lead = lead;

    // Fetch recent outreach (scoped via lead_id which we've already verified above)
    const { data: outreach } = await supabase
      .from("outreach_entries")
      .select("platform, message_text, status, sent_at, reply_text, replied_at")
      .eq("lead_id", entity_id)
      .order("created_at", { ascending: false })
      .limit(10);
    context.outreach_history = outreach || [];
  } else if (entity_type === "deal") {
    const { data: deal } = await supabase
      .from("deals")
      .select("*")
      .eq("id", entity_id)
      .eq("user_id", user.id)
      .maybeSingle();
    if (!deal) return NextResponse.json({ error: "Deal not found" }, { status: 404 });
    context.deal = deal;
  } else if (entity_type === "client") {
    const { data: client } = await supabase
      .from("clients")
      .select("*")
      .eq("id", entity_id)
      .eq("profile_id", user.id)
      .maybeSingle();
    if (!client) return NextResponse.json({ error: "Client not found" }, { status: 404 });
    context.client = client;
  } else {
    return NextResponse.json({ error: "Invalid entity_type" }, { status: 400 });
  }

  try {
    const resp = await anthropic.messages.create({
      model: MODEL_HAIKU,
      max_tokens: 1500,
      system: [{ type: "text", text: SYSTEM_PROMPT, cache_control: { type: "ephemeral" } }],
      messages: [{ role: "user", content: `Analyze this ${entity_type} and recommend actions:\n\n${JSON.stringify(context, null, 2)}` }],
    });

    const text = getResponseText(resp);
    const parsed = safeJsonParse<{ insights: Insight[]; health_score: number; summary: string }>(text);

    if (!parsed || !Array.isArray(parsed.insights)) {
      return NextResponse.json({ error: "AI returned invalid format", detail: text.slice(0, 300) }, { status: 502 });
    }

    // Log
    try {
      const service = createServiceClient();
      void service.from("trinity_log").insert({
        user_id: user.id,
        action_type: "ai_crm_insights",
        description: `Generated ${parsed.insights.length} insights for ${entity_type}`,
        status: "completed",
        metadata: { entity_type, entity_id, health_score: parsed.health_score },
      });
    } catch {}

    return NextResponse.json({ success: true, ...parsed });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed" }, { status: 500 });
  }
}
