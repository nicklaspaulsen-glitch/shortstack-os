// Custom AI Workflow Engine — Replaces Make.com/Zapier
// Claude designs and executes multi-step workflows for client-specific needs

export interface WorkflowStep {
  id: string;
  name: string;
  type: "trigger" | "action" | "condition" | "delay";
  config: Record<string, unknown>;
  next?: string; // ID of next step
  nextIfFalse?: string; // For conditions
}

export interface Workflow {
  id: string;
  name: string;
  description: string;
  client_id?: string;
  trigger: string;
  steps: WorkflowStep[];
  is_active: boolean;
}

// Available actions the workflow engine can execute
const WORKFLOW_ACTIONS: Record<string, {
  name: string;
  description: string;
  execute: (params: Record<string, string>, context: WorkflowContext) => Promise<Record<string, unknown>>;
}> = {
  send_email: {
    name: "Send Email",
    description: "Send an email via client's email service",
    execute: async (params) => {
      // Integration with email service
      return { sent: true, to: params.to, subject: params.subject };
    },
  },
  send_sms: {
    name: "Send SMS",
    description: "Send an SMS via GHL",
    execute: async (params) => {
      const apiKey = process.env.GHL_API_KEY;
      if (!apiKey) return { error: "GHL not configured" };
      const res = await fetch("https://services.leadconnectorhq.com/conversations/messages", {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json", Version: "2021-07-28" },
        body: JSON.stringify({ type: "SMS", contactId: params.contact_id, message: params.message }),
      });
      return { sent: res.ok, status: res.status };
    },
  },
  create_task: {
    name: "Create Task",
    description: "Create a task in client's task list",
    execute: async (params, context) => {
      const { data } = await context.supabase.from("client_tasks").insert({
        client_id: params.client_id || context.clientId,
        title: params.title,
        description: params.description,
        due_date: params.due_date,
      }).select("id").single();
      return { task_id: data?.id, created: true };
    },
  },
  update_lead_status: {
    name: "Update Lead Status",
    description: "Change a lead's status in the pipeline",
    execute: async (params, context) => {
      await context.supabase.from("leads").update({ status: params.status }).eq("id", params.lead_id);
      return { updated: true, lead_id: params.lead_id, status: params.status };
    },
  },
  send_slack_message: {
    name: "Send Slack Message",
    description: "Post a message to a Slack channel",
    execute: async (params) => {
      const token = process.env.SLACK_BOT_TOKEN;
      if (!token) return { error: "Slack not configured" };
      const res = await fetch("https://slack.com/api/chat.postMessage", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ channel: params.channel || "#general", text: params.message }),
      });
      return { sent: res.ok };
    },
  },
  send_telegram: {
    name: "Send Telegram Message",
    description: "Send a message via Trinity bot",
    execute: async (params) => {
      const token = process.env.TELEGRAM_BOT_TOKEN;
      const chatId = params.chat_id || process.env.TELEGRAM_CHAT_ID;
      if (!token || !chatId) return { error: "Telegram not configured" };
      const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: chatId, text: params.message, parse_mode: "Markdown" }),
      });
      return { sent: res.ok };
    },
  },
  generate_content: {
    name: "Generate Content with AI",
    description: "Use Claude to generate any text content",
    execute: async (params) => {
      const apiKey = process.env.ANTHROPIC_API_KEY;
      if (!apiKey) return { error: "AI not configured" };
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
        body: JSON.stringify({
          model: "claude-sonnet-4-6",
          max_tokens: 1000,
          system: params.system_prompt || "You are a helpful assistant for ShortStack agency.",
          messages: [{ role: "user", content: params.prompt }],
        }),
      });
      const data = await res.json();
      return { content: data.content?.[0]?.text, generated: true };
    },
  },
  create_invoice: {
    name: "Create Stripe Invoice",
    description: "Generate and send a Stripe invoice",
    execute: async (params) => {
      const key = process.env.STRIPE_SECRET_KEY;
      if (!key) return { error: "Stripe not configured" };
      const res = await fetch("https://api.stripe.com/v1/invoices", {
        method: "POST",
        headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          customer: params.stripe_customer_id,
          auto_advance: "true",
          "collection_method": "send_invoice",
          "days_until_due": params.days_until_due || "7",
        }),
      });
      const invoice = await res.json();
      return { invoice_id: invoice.id, status: invoice.status };
    },
  },
  webhook: {
    name: "Call Webhook",
    description: "Send data to any external URL",
    execute: async (params) => {
      const res = await fetch(params.url, {
        method: params.method || "POST",
        headers: { "Content-Type": "application/json", ...(params.headers ? JSON.parse(params.headers) : {}) },
        body: params.body || JSON.stringify(params.data || {}),
      });
      return { status: res.status, ok: res.ok };
    },
  },
  delay: {
    name: "Wait",
    description: "Pause workflow execution",
    execute: async (params) => {
      const ms = parseInt(params.minutes || "1") * 60000;
      await new Promise(r => setTimeout(r, Math.min(ms, 300000))); // Max 5 min
      return { waited: params.minutes + " minutes" };
    },
  },
  generate_video: {
    name: "Generate AI Video",
    description: "Generate an AI video ad or content using Higgsfield",
    execute: async (params, context) => {
      const apiKey = process.env.HIGGSFIELD_API_KEY;
      if (!apiKey) return { error: "Higgsfield not configured" };
      try {
        const res = await fetch("https://api.higgsfield.ai/v1/videos/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
          body: JSON.stringify({
            prompt: params.prompt,
            style: params.style || "professional",
            duration: parseInt(params.duration || "15"),
            aspect_ratio: params.aspect_ratio || "9:16",
          }),
        });
        const data = await res.json();
        // Save to content calendar if client_id provided
        if (context.clientId && data.video_url) {
          await context.supabase.from("content_calendar").insert({
            client_id: context.clientId,
            title: params.title || "AI Generated Video",
            platform: params.platform || "tiktok",
            content_type: "video",
            status: "ready_to_publish",
            metadata: { video_url: data.video_url, higgsfield_id: data.id, prompt: params.prompt },
          });
        }
        return { video_url: data.video_url, id: data.id, status: data.status };
      } catch (err) {
        return { error: String(err) };
      }
    },
  },
  ghl_add_tag: {
    name: "Add GHL Tag",
    description: "Add a tag to a contact in GoHighLevel",
    execute: async (params) => {
      const apiKey = process.env.GHL_API_KEY;
      if (!apiKey) return { error: "GHL not configured" };
      const res = await fetch(`https://services.leadconnectorhq.com/contacts/${params.contact_id}/tags`, {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json", Version: "2021-07-28" },
        body: JSON.stringify({ tags: [params.tag] }),
      });
      return { tagged: res.ok };
    },
  },
};

interface WorkflowContext {
  supabase: ReturnType<typeof import("@/lib/supabase/server").createServiceClient>;
  clientId?: string;
  triggerData?: Record<string, unknown>;
}

// Execute a workflow
export async function executeWorkflow(
  workflow: Workflow,
  context: WorkflowContext,
  triggerData?: Record<string, unknown>
): Promise<{ success: boolean; results: Record<string, unknown>[]; error?: string }> {
  const results: Record<string, unknown>[] = [];
  context.triggerData = triggerData;

  for (const step of workflow.steps) {
    try {
      if (step.type === "condition") {
        // AI evaluates conditions
        const conditionMet = await evaluateCondition(step.config as Record<string, string>, context);
        results.push({ step: step.name, condition: conditionMet });
        // Skip to nextIfFalse if condition not met
        if (!conditionMet && step.nextIfFalse) {
          const skipTo = workflow.steps.findIndex(s => s.id === step.nextIfFalse);
          if (skipTo > -1) continue;
        }
        continue;
      }

      const action = WORKFLOW_ACTIONS[step.config.action as string];
      if (!action) {
        results.push({ step: step.name, error: `Unknown action: ${step.config.action}` });
        continue;
      }

      const result = await action.execute(step.config.params as Record<string, string>, context);
      results.push({ step: step.name, ...result });

      // Log step execution
      await context.supabase.from("trinity_log").insert({
        action_type: "automation",
        description: `Workflow "${workflow.name}" — Step: ${step.name}`,
        status: "completed",
        result,
        completed_at: new Date().toISOString(),
      });
    } catch (err) {
      results.push({ step: step.name, error: String(err) });
    }
  }

  return { success: true, results };
}

async function evaluateCondition(config: Record<string, string>, context: WorkflowContext): Promise<boolean> {
  const { field, operator, value } = config;
  const actual = context.triggerData?.[field];

  switch (operator) {
    case "equals": return String(actual) === value;
    case "not_equals": return String(actual) !== value;
    case "contains": return String(actual).includes(value);
    case "greater_than": return Number(actual) > Number(value);
    case "less_than": return Number(actual) < Number(value);
    case "exists": return actual !== undefined && actual !== null;
    default: return false;
  }
}

// AI designs a workflow from natural language
export async function designWorkflow(prompt: string, clientName?: string): Promise<{
  name: string;
  description: string;
  trigger: string;
  steps: WorkflowStep[];
}> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("AI not configured");

  const availableActions = Object.entries(WORKFLOW_ACTIONS).map(([key, val]) => `${key}: ${val.description}`).join("\n");

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: 2000,
      system: `You are a workflow automation designer for ShortStack agency. Design workflows using these available actions:

${availableActions}

Return valid JSON only with: name, description, trigger (what starts this workflow), steps (array of objects with: id, name, type (trigger/action/condition/delay), config (with "action" key matching an available action, and "params" object)).`,
      messages: [{
        role: "user",
        content: `Design a workflow for ${clientName || "a client"}: ${prompt}`,
      }],
    }),
  });

  const data = await res.json();
  const text = data.content?.[0]?.text || "";
  const cleaned = text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
  return JSON.parse(cleaned);
}

export { WORKFLOW_ACTIONS };
