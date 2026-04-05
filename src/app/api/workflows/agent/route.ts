import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { designWorkflow, executeWorkflow, WORKFLOW_ACTIONS } from "@/lib/services/workflows";
import { createServiceClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { message, history, client_id, client_name } = await request.json();

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "AI not configured" }, { status: 500 });

  const availableActions = Object.entries(WORKFLOW_ACTIONS).map(([key, val]) => `- ${key}: ${val.name} — ${val.description}`).join("\n");

  // Build conversation context
  const messages = [
    ...(history || []).map((h: { role: string; content: string }) => ({
      role: h.role === "agent" ? "assistant" : "user",
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
        max_tokens: 2000,
        system: `You are the ShortStack Workflow Agent. You help agency owners build and run automations.

Available workflow actions:
${availableActions}

You can also use: generate_video (Higgsfield AI video generation for ads/content)

Context: ${client_name ? `Working with client: ${client_name}` : "No specific client selected"}

Your job:
1. Understand what the user wants to automate
2. Design a workflow (return JSON in a <workflow> tag)
3. If the user says "run it" or "execute", indicate you're ready to run (set <execute>true</execute>)
4. Be conversational and helpful — explain what each step does

When designing a workflow, include it like:
<workflow>
{"name":"...","description":"...","trigger":"...","steps":[{"id":"1","name":"...","type":"action","config":{"action":"...","params":{...}}}]}
</workflow>

Keep responses concise. Be proactive — suggest improvements.`,
        messages,
      }),
    });

    const data = await res.json();
    const text = data.content?.[0]?.text || "I couldn't process that.";

    // Extract workflow JSON if present
    let workflow = null;
    const workflowMatch = text.match(/<workflow>([\s\S]*?)<\/workflow>/);
    if (workflowMatch) {
      try {
        workflow = JSON.parse(workflowMatch[1].trim());
      } catch {}
    }

    // Check if agent wants to execute
    const shouldExecute = text.includes("<execute>true</execute>") ||
      message.toLowerCase().includes("run it") ||
      message.toLowerCase().includes("execute");

    let executed = false;
    let results = null;
    if (shouldExecute && workflow) {
      const serviceSupabase = createServiceClient();
      const execResult = await executeWorkflow(workflow, {
        supabase: serviceSupabase,
        clientId: client_id,
      });
      executed = true;
      results = execResult.results;

      // Log it
      await supabase.from("trinity_log").insert({
        action_type: "automation",
        description: `Agent executed: ${workflow.name}`,
        command: message,
        client_id: client_id || null,
        status: "completed",
        result: workflow,
        completed_at: new Date().toISOString(),
      });
    }

    // Clean reply text (remove XML tags)
    const cleanReply = text
      .replace(/<workflow>[\s\S]*?<\/workflow>/g, "")
      .replace(/<execute>[\s\S]*?<\/execute>/g, "")
      .trim();

    return NextResponse.json({
      reply: cleanReply || (executed ? "Workflow executed successfully!" : "Here's the workflow."),
      workflow,
      executed,
      results,
    });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
