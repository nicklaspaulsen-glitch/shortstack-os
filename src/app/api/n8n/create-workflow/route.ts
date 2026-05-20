import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { callLLMTraced } from "@/lib/ai/llm-router";

// n8n Workflow Creator — AI designs and deploys workflows to n8n
// Set N8N_URL and N8N_API_KEY in env vars (N8N_URL is shared with
// /api/n8n/workflows — do NOT use N8N_BASE_URL, which was a naming
// inconsistency fixed on May 20).
//
// SECURITY (Apr 26): role-gated to match /api/n8n/workflows/* siblings.
// AI-generated workflows still hit a shared n8n instance — clients
// shouldn't be able to deploy nodes/connections there.
export async function POST(request: NextRequest) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Fail-closed on missing profile.
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  if (!profile || profile.role === "client") {
    return NextResponse.json({ error: "Operators only" }, { status: 403 });
  }

  const { description, client_id } = await request.json();

  // Standardized to N8N_URL — same var used by /api/n8n/workflows/route.ts
  const n8nUrl = process.env.N8N_URL;
  const n8nKey = process.env.N8N_API_KEY;

  // Step 1: AI designs the n8n workflow JSON via shared LLM router
  // Uses callLLMTraced so the call is visible in Langfuse + benefits
  // from Mem0 memory if the owner has prior workflow context.
  // humanize: false because the output must be parseable JSON.
  try {
    const llmResult = await callLLMTraced({
      surface: "n8n_workflow_design",
      taskType: "agentic_reasoning",
      userId: user.id,
      context: "/api/n8n/create-workflow",
      humanize: false,
      systemPrompt: `You are an n8n workflow automation expert. Design n8n workflows as valid JSON that can be imported directly. Use real n8n node types (n8n-nodes-base.httpRequest, n8n-nodes-base.if, n8n-nodes-base.set, etc). Return ONLY valid JSON — no explanation, no markdown, no code fences.`,
      userPrompt: `Design an n8n workflow for: ${description}. Return valid n8n workflow JSON with nodes and connections. Include a manual trigger node.`,
      maxTokens: 4000,
    });

    const text = llmResult.text || "";
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

    // Log — status "pending" when designed but not yet deployed;
    // "completed" when live on n8n.
    await supabase.from("trinity_log").insert({
      action_type: "automation",
      description: `n8n workflow designed: ${description.substring(0, 80)}`,
      client_id: client_id || null,
      status: deployed ? "completed" : "pending",
      result: { deployed, n8n_id: n8nId, workflow_nodes: workflow?.nodes?.length || 0 },
    });

    return NextResponse.json({
      success: true,
      workflow,
      deployed,
      n8n_id: n8nId,
      message: deployed
        ? "Workflow deployed and active on n8n!"
        : "Workflow designed. Add N8N_URL and N8N_API_KEY to deploy automatically.",
    });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
