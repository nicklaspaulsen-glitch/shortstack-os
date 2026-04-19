import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { executeWorkflow, WORKFLOW_ACTIONS } from "@/lib/services/workflows";
import { createServiceClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { message, history, client_id, client_name } = await request.json();

  // Verify the caller owns the client_id they're attaching automations to.
  if (client_id) {
    const { data: owned } = await supabase
      .from("clients")
      .select("id")
      .eq("id", client_id)
      .eq("profile_id", user.id)
      .maybeSingle();
    if (!owned) {
      return NextResponse.json({ error: "Forbidden — not your client" }, { status: 403 });
    }
  }

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
        model: "claude-haiku-4-5-20251001",
        max_tokens: 2000,
        system: `You are the ShortStack Workflow Agent. You build automations for agency clients and deploy them to n8n.

Available internal actions:
${availableActions}

Context: ${client_name ? `Working with client: ${client_name}` : "No specific client selected"}
n8n is connected at: ${process.env.N8N_BASE_URL || "not configured"}

Your job:
1. Understand what the user wants to automate
2. Design the workflow and explain each step in plain English (no markdown)
3. Include a <workflow> tag with the JSON
4. If user says "run it", "deploy it", or "execute" — set <deploy>true</deploy>
5. When deploying, the system sends it to n8n automatically

When designing a workflow:
<workflow>
{"name":"...","description":"...","trigger":"...","steps":[{"id":"1","name":"...","type":"action","config":{"action":"...","params":{...}}}]}
</workflow>

RULES:
- No markdown formatting
- Keep responses short and conversational
- Suggest improvements proactively
- For client-specific workflows, mention the client name`,
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

    // Check if agent wants to deploy/execute
    const shouldDeploy = text.includes("<deploy>true</deploy>") ||
      message.toLowerCase().includes("deploy it") ||
      message.toLowerCase().includes("run it") ||
      message.toLowerCase().includes("execute");

    let executed = false;
    let deployed = false;
    let results = null;
    let n8nId = null;

    if (shouldDeploy && workflow) {
      // Deploy to n8n
      const n8nUrl = process.env.N8N_BASE_URL;
      const n8nKey = process.env.N8N_API_KEY;
      if (n8nUrl && n8nKey) {
        try {
          const n8nRes = await fetch(`${n8nUrl}/api/v1/workflows`, {
            method: "POST",
            headers: { "Content-Type": "application/json", "X-N8N-API-KEY": n8nKey },
            body: JSON.stringify({ name: workflow.name || "ShortStack Workflow", nodes: [], connections: {}, settings: {} }),
          });
          const n8nData = await n8nRes.json();
          if (n8nData.id) { deployed = true; n8nId = n8nData.id; }
        } catch {}
      }

      // Also execute internally
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
      .replace(/<deploy>[\s\S]*?<\/deploy>/g, "")
      .trim();

    let finalReply = cleanReply;
    if (deployed) finalReply += `\n\nDeployed to n8n! Workflow ID: ${n8nId}`;
    if (executed && !deployed) finalReply += "\n\nWorkflow executed internally.";

    return NextResponse.json({
      reply: finalReply || (deployed ? "Workflow deployed to n8n!" : executed ? "Workflow executed!" : "Here's the workflow."),
      workflow,
      executed,
      deployed,
      n8n_id: n8nId,
      results,
    });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
