import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase, createServiceClient } from "@/lib/supabase/server";

// Dynamic Agent Spawner — Nexus can create sub-agents on the fly
// When a task doesn't match any existing agent, Nexus spawns a specialist
export async function POST(request: NextRequest) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { task, context, spawned_by } = await request.json();
  if (!task) return NextResponse.json({ error: "Task description required" }, { status: 400 });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "AI not configured" }, { status: 500 });

  const serviceSupabase = createServiceClient();

  // Step 1: Define the agent using AI
  const defineRes = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 800,
      messages: [{
        role: "user",
        content: `You are spawning a new AI sub-agent for ShortStack OS (a digital marketing agency platform). Define this specialist agent.

Task: ${task}
Context: ${context || "General agency task"}

Return JSON only:
{
  "name": "Agent Name (2-3 words, title case)",
  "slug": "agent-name (kebab-case)",
  "role": "One sentence describing what this agent does",
  "system_prompt": "Full system prompt for this agent (2-3 paragraphs, specific to the task domain)",
  "capabilities": ["capability1", "capability2", "capability3"]
}`,
      }],
    }),
  });

  const defineData = await defineRes.json();
  const defineText = defineData.content?.[0]?.text || "{}";
  const cleaned = defineText.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();

  let agentDef: {
    name: string;
    slug: string;
    role: string;
    system_prompt: string;
    capabilities: string[];
  };

  try {
    agentDef = JSON.parse(cleaned);
  } catch {
    return NextResponse.json({ error: "Failed to define agent" }, { status: 500 });
  }

  // Check if agent with this slug already exists
  const { data: existing } = await serviceSupabase
    .from("custom_agents")
    .select("id, slug, execution_count")
    .eq("slug", agentDef.slug)
    .single();

  let agentId: string;

  if (existing) {
    // Reuse existing agent
    agentId = existing.id;
    await serviceSupabase
      .from("custom_agents")
      .update({
        execution_count: (existing.execution_count || 0) + 1,
        last_executed_at: new Date().toISOString(),
      })
      .eq("id", existing.id);
  } else {
    // Save new agent definition
    const { data: newAgent, error: insertErr } = await serviceSupabase
      .from("custom_agents")
      .insert({
        name: agentDef.name,
        slug: agentDef.slug,
        role: agentDef.role,
        system_prompt: agentDef.system_prompt,
        capabilities: agentDef.capabilities,
        spawned_by: spawned_by || "nexus",
        parent_task: task,
        execution_count: 1,
        last_executed_at: new Date().toISOString(),
      })
      .select("id")
      .single();

    if (insertErr) {
      return NextResponse.json({ error: "Failed to save agent", details: insertErr.message }, { status: 500 });
    }
    agentId = newAgent.id;
  }

  // Step 2: Execute the agent's task
  const executeRes = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: 2000,
      system: agentDef.system_prompt,
      messages: [{
        role: "user",
        content: `Execute this task: ${task}\n\nContext: ${context || "No additional context"}\n\nProvide a detailed, actionable response. No markdown formatting.`,
      }],
    }),
  });

  const executeData = await executeRes.json();
  const result = executeData.content?.[0]?.text || "No output generated.";

  // Log the execution
  await serviceSupabase.from("trinity_log").insert({
    agent: agentDef.slug,
    action_type: "custom",
    description: `Spawned agent "${agentDef.name}" executed: ${task.substring(0, 150)}`,
    status: "completed",
    result: {
      agent_id: agentId,
      agent_name: agentDef.name,
      task,
      output: result.substring(0, 500),
      is_new_agent: !existing,
    },
  });

  return NextResponse.json({
    success: true,
    agent: {
      id: agentId,
      name: agentDef.name,
      slug: agentDef.slug,
      role: agentDef.role,
      capabilities: agentDef.capabilities,
      is_new: !existing,
    },
    result,
  });
}

// GET — list all custom/spawned agents
export async function GET() {
  // Auth check — only authenticated users can list agents
  const authSupabase = createServerSupabase();
  const { data: { user } } = await authSupabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = createServiceClient();

  const { data, error } = await supabase
    .from("custom_agents")
    .select("*")
    .eq("is_active", true)
    .order("execution_count", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ agents: data || [], total: data?.length || 0 });
}
