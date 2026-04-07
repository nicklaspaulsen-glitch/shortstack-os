import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase, createServiceClient } from "@/lib/supabase/server";

// Agent Orchestration Engine — chains agents together automatically
// When one agent completes a task, it checks if any chain rules trigger the next agent
// Example: Lead scraped → Outreach sends DM → Reply detected → Proposal generated

interface ChainRule {
  id: string;
  name: string;
  trigger: { agent: string; event: string };
  action: { agent: string; task: string; params?: Record<string, string> };
  enabled: boolean;
}

const AGENT_CHAINS: ChainRule[] = [
  // Lead Pipeline
  {
    id: "lead-to-outreach",
    name: "New Lead → Send Outreach",
    trigger: { agent: "lead-engine", event: "lead_scraped" },
    action: { agent: "outreach", task: "send_cold_dm", params: { channel: "email" } },
    enabled: true,
  },
  {
    id: "reply-to-proposal",
    name: "Lead Replied → Generate Proposal",
    trigger: { agent: "outreach", event: "reply_received" },
    action: { agent: "proposal", task: "generate_proposal" },
    enabled: true,
  },
  {
    id: "booked-to-scheduler",
    name: "Call Booked → Schedule & Remind",
    trigger: { agent: "outreach", event: "call_booked" },
    action: { agent: "scheduler", task: "create_meeting" },
    enabled: true,
  },
  // Client Lifecycle
  {
    id: "deal-to-onboard",
    name: "Deal Won → Start Onboarding",
    trigger: { agent: "proposal", event: "deal_won" },
    action: { agent: "onboarding", task: "start_onboarding" },
    enabled: true,
  },
  {
    id: "onboard-to-invoice",
    name: "Onboarding Complete → Send First Invoice",
    trigger: { agent: "onboarding", event: "onboarding_complete" },
    action: { agent: "invoice", task: "send_first_invoice" },
    enabled: true,
  },
  {
    id: "onboard-to-content",
    name: "Onboarding Complete → Generate First Content",
    trigger: { agent: "onboarding", event: "onboarding_complete" },
    action: { agent: "content", task: "generate_week_content" },
    enabled: true,
  },
  // Retention
  {
    id: "health-drop-to-retention",
    name: "Health Score Drops → Trigger Retention",
    trigger: { agent: "analytics", event: "health_score_dropped" },
    action: { agent: "retention", task: "engage_at_risk_client" },
    enabled: true,
  },
  {
    id: "invoice-overdue-to-retention",
    name: "Invoice Overdue → Chase Payment",
    trigger: { agent: "invoice", event: "invoice_overdue" },
    action: { agent: "retention", task: "chase_payment" },
    enabled: true,
  },
  // Content Loop
  {
    id: "content-to-social",
    name: "Content Created → Schedule Posts",
    trigger: { agent: "content", event: "content_generated" },
    action: { agent: "content", task: "schedule_posts" },
    enabled: true,
  },
  {
    id: "review-to-reputation",
    name: "New Review → Respond & Monitor",
    trigger: { agent: "reviews", event: "new_review" },
    action: { agent: "reputation", task: "respond_to_review" },
    enabled: true,
  },
  // Competitive Intelligence
  {
    id: "competitor-to-content",
    name: "Competitor Post Viral → Create Counter-Content",
    trigger: { agent: "competitor", event: "viral_content_detected" },
    action: { agent: "content", task: "create_counter_content" },
    enabled: true,
  },
  {
    id: "competitor-to-ads",
    name: "Competitor Drops Price → Adjust Ads",
    trigger: { agent: "competitor", event: "pricing_change" },
    action: { agent: "ads", task: "adjust_positioning" },
    enabled: true,
  },
];

// POST — Trigger an agent chain event (called by individual agents when they complete a task)
export async function POST(request: NextRequest) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { agent, event, data: eventData, client_id } = await request.json();

  // Find matching chain rules
  const matchingChains = AGENT_CHAINS.filter(
    c => c.enabled && c.trigger.agent === agent && c.trigger.event === event
  );

  if (matchingChains.length === 0) {
    return NextResponse.json({ success: true, triggered: 0, message: "No chains matched" });
  }

  const results: Array<{ chain: string; agent: string; task: string; status: string }> = [];
  const serviceSupabase = createServiceClient();

  for (const chain of matchingChains) {
    // Log the chain trigger
    await serviceSupabase.from("trinity_log").insert({
      agent: chain.action.agent,
      action_type: chain.action.agent,
      description: `Chain triggered: ${chain.name} → ${chain.action.task}`,
      client_id: client_id || null,
      status: "pending",
      result: {
        chain_id: chain.id,
        trigger_agent: agent,
        trigger_event: event,
        action_agent: chain.action.agent,
        action_task: chain.action.task,
        event_data: eventData,
      },
    });

    // Execute the chained action via AI
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (apiKey) {
      try {
        const res = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
          body: JSON.stringify({
            model: "claude-haiku-4-5-20251001",
            max_tokens: 500,
            messages: [{
              role: "user",
              content: `You are the ${chain.action.agent} AI agent. The ${agent} agent just completed: "${event}". Your task: ${chain.action.task}. Client ID: ${client_id || "none"}. Event data: ${JSON.stringify(eventData || {})}. Execute this task and describe what you did in 2-3 sentences. No markdown.`,
            }],
          }),
        });
        const aiData = await res.json();
        const reply = aiData.content?.[0]?.text || "";

        await serviceSupabase.from("trinity_log").insert({
          agent: chain.action.agent,
          action_type: chain.action.agent,
          description: reply.substring(0, 200),
          client_id: client_id || null,
          status: "success",
          result: { chain_id: chain.id, ai_response: reply },
        });

        results.push({ chain: chain.name, agent: chain.action.agent, task: chain.action.task, status: "executed" });
      } catch {
        results.push({ chain: chain.name, agent: chain.action.agent, task: chain.action.task, status: "failed" });
      }
    } else {
      results.push({ chain: chain.name, agent: chain.action.agent, task: chain.action.task, status: "queued" });
    }
  }

  // Notify on Telegram
  const chatId = process.env.TELEGRAM_CHAT_ID;
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  if (chatId && botToken && results.length > 0) {
    const msg = `⚡ Agent Chain Triggered\n\n${results.map(r => `${r.chain}: ${r.status}`).join("\n")}`;
    await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text: msg }),
    });
  }

  return NextResponse.json({
    success: true,
    triggered: results.length,
    chains: results,
  });
}

// GET — list all chain rules and their status
export async function GET(_request: NextRequest) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  return NextResponse.json({
    chains: AGENT_CHAINS,
    total: AGENT_CHAINS.length,
    enabled: AGENT_CHAINS.filter(c => c.enabled).length,
  });
}
