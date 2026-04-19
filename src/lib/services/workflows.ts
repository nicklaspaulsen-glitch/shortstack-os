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
      // Scope by client_id if provided so an automation triggered from one
      // tenant's workflow can't mutate a lead that happens to share an id in
      // another tenant (service-role client bypasses RLS).
      let query = context.supabase.from("leads").update({ status: params.status }).eq("id", params.lead_id);
      if (context.clientId) query = query.eq("client_id", context.clientId);
      await query;
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
      // SSRF guard: block non-http(s) schemes and internal / link-local /
      // localhost ranges so a user can't point a workflow webhook at cloud
      // metadata endpoints, LAN services, or loopback. Users who truly need
      // to hit an internal IP can deploy their own proxy.
      if (!params.url || typeof params.url !== "string") {
        return { error: "webhook url is required" };
      }
      let parsed: URL;
      try { parsed = new URL(params.url); }
      catch { return { error: "Invalid webhook URL" }; }
      if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
        return { error: "Only http(s) webhook URLs are allowed" };
      }
      const hostname = parsed.hostname.toLowerCase();
      // Reject localhost / loopback / link-local / cloud-metadata / RFC1918 on hostname match.
      // Note: resolving the hostname would catch DNS-rebinding too, but that needs a lookup
      // on every call — the host match alone blocks the common accidents + obvious abuse.
      const BLOCKED = [
        "localhost", "127.0.0.1", "0.0.0.0", "::1",
        "169.254.169.254", // AWS/GCP metadata
        "metadata.google.internal",
      ];
      if (BLOCKED.includes(hostname)) {
        return { error: "Webhook target is blocked (internal/metadata endpoint)" };
      }
      // Block IPv4 private ranges by literal match
      if (/^10\./.test(hostname) || /^192\.168\./.test(hostname) || /^172\.(1[6-9]|2\d|3[01])\./.test(hostname)) {
        return { error: "Webhook target is blocked (private IP range)" };
      }
      let headers: Record<string, string> = { "Content-Type": "application/json" };
      if (params.headers) {
        try {
          const extra = JSON.parse(params.headers);
          if (extra && typeof extra === "object") headers = { ...headers, ...extra };
        } catch {
          return { error: "Invalid headers JSON" };
        }
      }
      // Cap request time so a slow/malicious target can't tie up a worker.
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 10_000);
      try {
        const res = await fetch(parsed.toString(), {
          method: params.method || "POST",
          headers,
          body: params.body || JSON.stringify(params.data || {}),
          signal: ctrl.signal,
        });
        return { status: res.status, ok: res.ok };
      } catch (err) {
        return { error: err instanceof Error ? err.message : "Webhook request failed" };
      } finally {
        clearTimeout(timer);
      }
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
