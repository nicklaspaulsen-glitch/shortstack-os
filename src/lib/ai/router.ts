/**
 * AI Router — sends routine tasks to self-hosted LLM on RunPod,
 * falls back to Claude only for complex agent tasks.
 * Saves significant Claude API token costs.
 *
 * Usage:
 *   import { aiGenerate } from "@/lib/ai/router";
 *   const result = await aiGenerate({ messages, maxTokens, task: "social_post" });
 */

interface AIMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

interface AIGenerateOptions {
  messages: AIMessage[];
  maxTokens?: number;
  temperature?: number;
  task?: "social_post" | "ad_copy" | "script" | "email" | "lead_score" | "content_plan" | "agent" | "general";
  jsonMode?: boolean;
}

interface AIGenerateResult {
  text: string;
  source: "runpod" | "claude";
  tokens_used?: number;
}

// Tasks that MUST use Claude (complex reasoning, multi-step agents)
const CLAUDE_ONLY_TASKS = new Set(["agent"]);

// Tasks that can use the self-hosted LLM (routine generation)
const ROUTINE_TASKS = new Set(["social_post", "ad_copy", "script", "email", "lead_score", "content_plan", "general"]);

export async function aiGenerate(options: AIGenerateOptions): Promise<AIGenerateResult> {
  const { messages, maxTokens = 2000, temperature = 0.7, task = "general", jsonMode = false } = options;

  const runpodUrl = process.env.RUNPOD_LLM_URL;
  const runpodKey = process.env.RUNPOD_API_KEY;

  // Try self-hosted LLM first for routine tasks
  if (runpodUrl && runpodKey && !CLAUDE_ONLY_TASKS.has(task) && ROUTINE_TASKS.has(task)) {
    try {
      const res = await fetch(`${runpodUrl}/runsync`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${runpodKey}`,
        },
        body: JSON.stringify({
          input: {
            messages,
            max_tokens: maxTokens,
            temperature,
            response_format: jsonMode ? { type: "json_object" } : undefined,
          },
        }),
      });

      const job = await res.json();
      if (job.status === "COMPLETED" && job.output?.choices?.[0]) {
        const text = job.output.choices[0].message.content;
        return {
          text,
          source: "runpod",
          tokens_used: job.output.usage?.completion_tokens,
        };
      }
    } catch {
      // Fall through to Claude
    }
  }

  // Fallback: Claude API
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("No AI provider configured");

  const claudeMessages = messages.filter(m => m.role !== "system");
  const systemMsg = messages.find(m => m.role === "system")?.content;

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: task === "agent" ? "claude-sonnet-4-6-20250514" : "claude-haiku-4-5-20251001",
      max_tokens: maxTokens,
      ...(systemMsg ? { system: systemMsg } : {}),
      messages: claudeMessages.map(m => ({ role: m.role, content: m.content })),
    }),
  });

  const data = await res.json();
  const text = data.content?.[0]?.text || "";

  return {
    text,
    source: "claude",
    tokens_used: data.usage?.output_tokens,
  };
}
