import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase, createServiceClient } from "@/lib/supabase/server";
import { checkAiRateLimit } from "@/lib/api-rate-limit";
import { getEffectiveOwnerId } from "@/lib/security/require-owned-client";

// AI Chief Agent (Nexus) — oversees all agents, can spawn sub-agents dynamically
export async function POST(request: NextRequest) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const ownerId = await getEffectiveOwnerId(supabase, user.id);
  if (!ownerId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { data: profile } = await supabase.from("profiles").select("plan_tier").eq("id", user.id).single();
  const limited = checkAiRateLimit(user.id, profile?.plan_tier);
  if (limited) return limited;

  const { message, history } = await request.json();
  const serviceSupabase = createServiceClient();

  // Gather full system context — all tenant-scoped queries filtered by ownerId.
  // system_health is intentionally cross-tenant (global integration-status table, no user_id).
  // custom_agents is scoped by spawned_by (not user_id) per RLS migration 20260413.
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
    { data: customAgents },
  ] = await Promise.all([
    serviceSupabase.from("trinity_log").select("action_type, description, status, created_at").eq("user_id", ownerId).order("created_at", { ascending: false }).limit(30),
    serviceSupabase.from("leads").select("*", { count: "exact", head: true }).eq("user_id", ownerId),
    serviceSupabase.from("clients").select("*", { count: "exact", head: true }).eq("profile_id", ownerId).eq("is_active", true),
    serviceSupabase.from("clients").select("business_name, mrr, health_score").eq("profile_id", ownerId).eq("is_active", true),
    serviceSupabase.from("outreach_log").select("*", { count: "exact", head: true }).eq("user_id", ownerId).eq("status", "sent"),
    serviceSupabase.from("outreach_log").select("*", { count: "exact", head: true }).eq("user_id", ownerId).eq("status", "replied"),
    // system_health is intentionally cross-tenant (global integration status table, no user_id)
    serviceSupabase.from("system_health").select("integration_name, status, error_message"),
    serviceSupabase.from("content_calendar").select("*", { count: "exact", head: true }).eq("user_id", ownerId).eq("status", "published"),
    serviceSupabase.from("trinity_log").select("description, action_type, created_at").eq("user_id", ownerId).eq("status", "failed").order("created_at", { ascending: false }).limit(10),
    // custom_agents uses spawned_by (not user_id) per RLS migration 20260413_agent_tables_rls.sql.
    // Batch 1 regression: .eq("user_id", ownerId) either 500'd or returned empty rows because
    // that column doesn't exist on custom_agents. is_active also has no confirmed column —
    // removed to avoid silent empty results.
    serviceSupabase.from("custom_agents").select("name, slug, role, execution_count, last_executed_at").eq("spawned_by", ownerId).order("execution_count", { ascending: false }).limit(20),
  ]);

  const totalMRR = (clients || []).reduce((s, c) => s + ((c as { mrr: number }).mrr || 0), 0);
  const reallyDown = (healthData || []).filter(h => h.status === "down");
  const degraded = (healthData || []).filter(h => h.status === "degraded");
  const replyRate = (dmsSent || 0) > 0 ? Math.round(((replies || 0) / (dmsSent || 1)) * 100) : 0;

  const activitySummary = (recentActions || []).slice(0, 15).map(a =>
    `[${a.action_type}] ${a.description} — ${a.status} (${new Date(a.created_at).toLocaleTimeString()})`
  ).join("\n");

  const errorSummary = (recentErrors || []).map(e =>
    `FAILED: [${e.action_type}] ${e.description} (${new Date(e.created_at).toLocaleTimeString()})`
  ).join("\n");

  const customAgentsList = (customAgents || []).map(a =>
    `- ${a.name} (${a.slug}): ${a.role} — used ${a.execution_count}x`
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

  const systemPrompt = `You are the Chief AI Agent (codename: "Nexus") of ShortStack OS — the boss overseeing all other AI agents. You manage the entire agency operation.

YOUR BUILT-IN AGENTS:
- Scout (Lead Finder) — scrapes leads from Google Maps
- Echo (Outreach) — sends cold DMs and emails
- Pixel (Content AI) — writes scripts and content
- Wave (Social Manager) — manages social media posting
- Blaze (Ads Manager) — runs ad campaigns
- Trinity (AI Assistant) — helps users with voice/text
- Ring (Cold Caller) — makes calls via ElevenLabs
- Plus 12 more specialized agents (Reviews, Analytics, Invoice, Onboarding, SEO, Reputation, Retention, Proposal, Scheduler, Video, Design, Website)

YOUR SPAWNED SUB-AGENTS:
${customAgentsList || "None spawned yet."}

IMPORTANT ABILITY — SPAWN SUB-AGENTS:
You can create new specialized AI agents on the fly when a task doesn't fit any existing agent.
When you determine a task needs a new specialist, use the spawn_agent tool.
Examples of when to spawn:
- "Analyze competitor pricing across 5 platforms" → spawn a "Pricing Analyst" agent
- "Create a brand voice guide for a new client" → spawn a "Brand Strategist" agent
- "Research trending hashtags in the fitness niche" → spawn a "Trend Scout" agent
- "Audit our email deliverability" → spawn a "Deliverability Auditor" agent

CURRENT SYSTEM STATUS:
- Total Leads: ${totalLeads || 0}
- Active Clients: ${activeClients || 0}
- Total MRR: $${totalMRR}
- DMs Sent: ${dmsSent || 0} (${replyRate}% reply rate)
- Content Published: ${contentPublished || 0}
- Integrations Down: ${reallyDown.length}
- Integrations Degraded: ${degraded.length}
${reallyDown.length > 0 ? `- DOWN: ${reallyDown.map(h => h.integration_name).join(", ")}` : "- No critical outages"}

RECENT AGENT ACTIVITY:
${activitySummary || "No recent activity"}

${errorSummary ? `RECENT FAILURES:\n${errorSummary}` : "No recent failures"}

IMPORTANT CONTEXT:
- "Degraded" integrations are NOT critical — they just need API key refresh. Don't alarm the user about these.
- Only flag "down" status as a real problem.
- $0 MRR is normal if no paying clients yet — don't panic about it.

YOUR PERSONALITY:
- You're the boss. Direct, decisive, confident.
- Keep responses SHORT (3-5 sentences max)
- NEVER use markdown formatting (no **, no ##, no tables, no |)
- Speak in plain conversational English
- Give the key numbers, then one actionable suggestion
- When a task needs a specialist you don't have, SPAWN one — be proactive`;

  const spawnTool = {
    name: "spawn_agent",
    description: "Spawn a new specialized AI sub-agent to handle a task that no existing agent covers. The agent will be created, saved for reuse, and will execute the task immediately.",
    input_schema: {
      type: "object",
      properties: {
        task: { type: "string", description: "The specific task for the new agent to execute" },
        context: { type: "string", description: "Additional context about why this agent is needed and what domain it covers" },
      },
      required: ["task"],
    },
  };

  const wantsStream = request.headers.get("accept")?.includes("text/event-stream");

  try {
    // First call — with tool definitions for spawning
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 1500,
        stream: !!wantsStream,
        system: systemPrompt,
        messages,
        tools: [spawnTool],
      }),
    });

    // Streaming path — stream text deltas; if tool_use detected, break out and handle
    if (wantsStream && res.body) {
      // We need to detect tool_use events. If found, we can't stream — collect and handle.
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let fullText = "";
      let hasToolUse = false;
      let toolName = "";
      let inputAccumulator = "";

      // First pass: peek for tool_use
      const chunks: string[] = [];
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(decoder.decode(value, { stream: true }));
      }
      const allData = chunks.join("");

      // Parse all events
      const textParts: string[] = [];
      for (const line of allData.split("\n")) {
        if (!line.startsWith("data: ")) continue;
        const jsonStr = line.slice(6);
        if (jsonStr === "[DONE]") continue;
        try {
          const event = JSON.parse(jsonStr);
          if (event.type === "content_block_start" && event.content_block?.type === "tool_use") {
            hasToolUse = true;
            toolName = event.content_block.name || "";
          }
          if (event.type === "content_block_delta") {
            if (event.delta?.text) textParts.push(event.delta.text);
            if (event.delta?.partial_json) inputAccumulator += event.delta.partial_json;
          }
        } catch {}
      }

      fullText = textParts.join("");

      if (hasToolUse && toolName === "spawn_agent") {
        // Handle tool-use the old way (non-streaming)
        let toolInputParsed: { task?: string; context?: string } = {};
        try { toolInputParsed = JSON.parse(inputAccumulator); } catch {}

        const spawnRes = await fetch(new URL("/api/agents/spawn", request.url).toString(), {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Cookie": request.headers.get("cookie") || "",
          },
          body: JSON.stringify({
            task: toolInputParsed.task || "",
            context: toolInputParsed.context || "",
            spawned_by: "nexus",
          }),
        });
        const spawnData = await spawnRes.json();

        let reply: string;
        if (spawnData.success) {
          const agentInfo = spawnData.agent;
          const spawnSummary = `I just spawned a new sub-agent: "${agentInfo.name}" (${agentInfo.role}). ${agentInfo.is_new ? "This is a brand new specialist." : "Reused an existing specialist."}\n\nHere's what it found:\n\n${spawnData.result.substring(0, 800)}`;
          reply = fullText ? `${fullText}\n\n${spawnSummary}` : spawnSummary;
        } else {
          reply = fullText ? `${fullText}\n\nTried to spawn a sub-agent but hit an issue.` : "Tried to spawn a specialist but hit an issue.";
        }

        return NextResponse.json({ reply });
      }

      // No tool use — return the streamed text as SSE
      const stream = new ReadableStream({
        start(controller) {
          for (const part of textParts) {
            controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify({ text: part })}\n\n`));
          }
          controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify({ done: true, fullText })}\n\n`));
          controller.close();
        },
      });
      return new Response(stream, { headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", "Connection": "keep-alive" } });
    }

    // Non-streaming fallback
    const data = await res.json();

    // Check if Nexus wants to spawn a sub-agent
    const toolUse = data.content?.find((b: { type: string }) => b.type === "tool_use");

    if (toolUse && toolUse.name === "spawn_agent") {
      // Execute the spawn
      const spawnRes = await fetch(new URL("/api/agents/spawn", request.url).toString(), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Cookie": request.headers.get("cookie") || "",
        },
        body: JSON.stringify({
          task: toolUse.input.task,
          context: toolUse.input.context || "",
          spawned_by: "nexus",
        }),
      });

      const spawnData = await spawnRes.json();

      // Get text blocks from initial response
      const textBlocks = data.content?.filter((b: { type: string }) => b.type === "text") || [];
      const initialText = textBlocks.map((b: { text: string }) => b.text).join(" ");

      if (spawnData.success) {
        const agentInfo = spawnData.agent;
        const spawnSummary = `I just spawned a new sub-agent: "${agentInfo.name}" (${agentInfo.role}). ${agentInfo.is_new ? "This is a brand new specialist." : "Reused an existing specialist."}\n\nHere's what it found:\n\n${spawnData.result.substring(0, 800)}`;

        const reply = initialText
          ? `${initialText}\n\n${spawnSummary}`
          : spawnSummary;

        return NextResponse.json({
          reply,
          spawned_agent: agentInfo,
        });
      } else {
        const reply = initialText
          ? `${initialText}\n\nI tried to spawn a sub-agent but hit an issue: ${spawnData.error || "unknown error"}. I'll handle this differently.`
          : `Tried to spawn a specialist but hit an issue. Let me handle this directly instead.`;

        return NextResponse.json({ reply });
      }
    }

    // Normal text response (no tool use)
    const reply = data.content?.filter((b: { type: string }) => b.type === "text")
      .map((b: { text: string }) => b.text).join(" ") || "Systems nominal. All agents reporting.";

    return NextResponse.json({ reply });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
