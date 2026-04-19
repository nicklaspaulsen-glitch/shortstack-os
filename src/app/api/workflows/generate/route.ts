import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase, createServiceClient } from "@/lib/supabase/server";
import { anthropic, MODEL_SONNET, safeJsonParse, getResponseText } from "@/lib/ai/claude-helpers";
import { checkAiRateLimit } from "@/lib/api-rate-limit";

/* Types — AI-generated workflow schema (GHL-style triggers + actions) */

interface WorkflowNode {
  id: string;
  type: "trigger" | "action" | "condition" | "wait" | "split";
  subtype: string;  // e.g., "form_submitted", "send_email", "if_tag", "wait_days"
  label: string;
  config: Record<string, unknown>;
  position?: { x: number; y: number };
  next?: string | null;
  branches?: { condition: string; next: string }[];  // for conditions
}

interface GeneratedWorkflow {
  name: string;
  description: string;
  objective: string;
  estimated_duration_days: number;
  nodes: WorkflowNode[];
  tags: string[];
  confidence: number;  // 0-100
}

const SYSTEM_PROMPT = `You are an expert automation workflow designer for marketing agencies.
Given a natural-language description of an automation goal, generate a complete workflow as JSON.

The workflow uses these node types:
- trigger (subtypes: form_submitted, lead_created, tag_added, email_opened, link_clicked, payment_received, appointment_booked, contact_updated, new_message, date_based, webhook)
- action (subtypes: send_email, send_sms, send_dm, create_task, add_tag, remove_tag, update_contact, webhook, notify_team, create_deal, book_appointment, ai_generate_content)
- condition (subtypes: if_tag, if_value, if_source, if_score, if_time_of_day, if_day_of_week)
- wait (subtypes: wait_minutes, wait_hours, wait_days, wait_until_date, wait_until_event)
- split (subtypes: ab_test, random_pct, multi_branch)

Best practices:
1. Always START with exactly one trigger node.
2. Use wait nodes between actions to avoid spammy timing.
3. Branch conditions for personalized paths (replied vs not, engaged vs cold, paid vs free).
4. Include at least one condition node for any sequence >3 steps.
5. End paths should either loop back, convert, or exit gracefully.
6. Use realistic timings: follow-ups 1-3 days apart, nurture 3-7 days, winback 14-30 days.

Respond ONLY with valid JSON matching this exact shape:
{
  "name": "string — short, descriptive",
  "description": "string — 1-2 sentences",
  "objective": "string — the business outcome",
  "estimated_duration_days": number,
  "nodes": [
    {
      "id": "n1",
      "type": "trigger" | "action" | "condition" | "wait" | "split",
      "subtype": "string",
      "label": "string",
      "config": { "relevant_fields": "values" },
      "next": "n2" | null,
      "branches": [ { "condition": "replied", "next": "n3" } ]
    }
  ],
  "tags": ["string"],
  "confidence": 85
}

Generate 5-15 nodes. Make it production-ready.`;

export async function POST(req: NextRequest) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const limited = checkAiRateLimit(user.id);
  if (limited) return limited;

  const body = await req.json();
  const { goal, audience, channels, tone, duration_hint } = body;
  if (!goal?.trim()) {
    return NextResponse.json({ error: "goal is required" }, { status: 400 });
  }

  const userPrompt = `Design a workflow for this goal:

GOAL: ${goal}
${audience ? `AUDIENCE: ${audience}` : ""}
${Array.isArray(channels) && channels.length ? `CHANNELS: ${channels.join(", ")}` : ""}
${tone ? `TONE: ${tone}` : ""}
${duration_hint ? `DURATION: ${duration_hint}` : ""}

Return a complete automation workflow as JSON.`;

  try {
    const resp = await anthropic.messages.create({
      model: MODEL_SONNET,
      max_tokens: 3500,
      system: [{ type: "text", text: SYSTEM_PROMPT, cache_control: { type: "ephemeral" } }],
      messages: [{ role: "user", content: userPrompt }],
    });

    const text = getResponseText(resp);
    const workflow = safeJsonParse<GeneratedWorkflow>(text);

    if (!workflow || !Array.isArray(workflow.nodes) || workflow.nodes.length === 0) {
      return NextResponse.json({ error: "AI returned invalid workflow", detail: text.slice(0, 400) }, { status: 502 });
    }

    // Auto-layout nodes if position missing
    workflow.nodes.forEach((node, i) => {
      if (!node.position) {
        node.position = { x: 100 + (i % 3) * 260, y: 80 + Math.floor(i / 3) * 160 };
      }
    });

    // Log to trinity_log
    try {
      const service = createServiceClient();
      void service.from("trinity_log").insert({
        user_id: user.id,
        action_type: "ai_workflow_generated",
        description: `Generated workflow: ${workflow.name}`,
        status: "completed",
        metadata: { goal, nodes_count: workflow.nodes.length, confidence: workflow.confidence },
      });
    } catch (err) { console.error("[workflows/generate] trinity_log insert failed:", err); }

    return NextResponse.json({ success: true, workflow });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed to generate" }, { status: 500 });
  }
}
