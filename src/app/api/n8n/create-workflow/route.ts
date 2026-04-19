import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

// n8n Workflow Creator — AI designs and deploys workflows to n8n
// Set N8N_BASE_URL and N8N_API_KEY in env vars
export async function POST(request: NextRequest) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { description, client_id } = await request.json();

  const n8nUrl = process.env.N8N_BASE_URL;
  const n8nKey = process.env.N8N_API_KEY;
  const apiKey = process.env.ANTHROPIC_API_KEY;

  if (!apiKey) return NextResponse.json({ error: "AI not configured" }, { status: 500 });

  // Step 1: AI designs the n8n workflow JSON
  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 2000,
        system: `You are an n8n workflow automation expert. Design n8n workflows as valid JSON that can be imported directly. Use real n8n node types (n8n-nodes-base.httpRequest, n8n-nodes-base.if, n8n-nodes-base.set, etc).`,
        messages: [{
          role: "user",
          content: `Design an n8n workflow for: ${description}. Return valid n8n workflow JSON with nodes and connections. Include a manual trigger node.`,
        }],
      }),
    });

    const data = await res.json();
    const text = data.content?.[0]?.text || "";
    const jsonMatch = text.match(/\{[\s\S]*\}/);

    let workflow = null;
    if (jsonMatch) {
      try { workflow = JSON.parse(jsonMatch[0]); } catch {}
    }

    // Step 2: Deploy to n8n if configured
    let deployed = false;
    let n8nId = null;

    if (n8nUrl && n8nKey && workflow) {
      try {
        const deployRes = await fetch(`${n8nUrl}/api/v1/workflows`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "X-N8N-API-KEY": n8nKey },
          body: JSON.stringify(workflow),
        });
        const deployData = await deployRes.json();
        if (deployData.id) {
          deployed = true;
          n8nId = deployData.id;

          // Activate it
          await fetch(`${n8nUrl}/api/v1/workflows/${n8nId}/activate`, {
            method: "POST",
            headers: { "X-N8N-API-KEY": n8nKey },
          });
        }
      } catch (err) { console.error("[n8n/create-workflow] deploy/activate failed:", err); }
    }

    // Log
    await supabase.from("trinity_log").insert({
      action_type: "automation",
      description: `n8n workflow designed: ${description.substring(0, 80)}`,
      client_id: client_id || null,
      status: deployed ? "completed" : "completed",
      result: { deployed, n8n_id: n8nId, workflow_nodes: workflow?.nodes?.length || 0 },
    });

    return NextResponse.json({
      success: true,
      workflow,
      deployed,
      n8n_id: n8nId,
      message: deployed ? "Workflow deployed and active on n8n!" : "Workflow designed. Add N8N_BASE_URL and N8N_API_KEY to deploy automatically.",
    });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
