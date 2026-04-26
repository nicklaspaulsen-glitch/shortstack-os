import Anthropic from "@anthropic-ai/sdk";

export const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export const MODEL_HAIKU = "claude-haiku-4-5-20251001";
export const MODEL_SONNET = "claude-sonnet-4-6-20250514";

/**
 * Add an Anthropic prompt-cache breakpoint (`cache_control: { type: "ephemeral" }`)
 * to the LAST element of a system-block array or tools array.
 *
 * Anthropic charges 0.10x for cache hits and 1.25x to write the cache.
 * Apply on stable system prompts (>=1024 tokens for the model in use) and
 * stable tools arrays that get reused across calls — both must be the
 * exact-same prefix for the cache to hit.
 *
 * Returns an empty array when given empty input. Returns a new array
 * (immutable) — does not mutate the input.
 *
 * Safe to call on inputs that already carry `cache_control` — it just
 * ensures the last block has it.
 *
 * Usage:
 *   await anthropic.messages.create({
 *     model,
 *     system: withCacheBreakpoint([{ type: "text", text: SYSTEM_PROMPT }]),
 *     tools: withCacheBreakpoint(TOOLS),
 *     messages,
 *   });
 */
export function withCacheBreakpoint<T>(blocks: readonly T[]): T[] {
  if (!blocks || blocks.length === 0) return [];
  const last = blocks[blocks.length - 1];
  return [
    ...blocks.slice(0, -1).map((b) => ({ ...b }) as T),
    {
      ...last,
      cache_control: { type: "ephemeral" as const },
    } as T,
  ];
}

/**
 * Safely parse JSON from a Claude text response. Strips ```json/``` fences and
 * whitespace. Attempts to find the first balanced JSON object/array in the text
 * as a last resort. Returns `null` when no parseable JSON is found.
 */
export function safeJsonParse<T = unknown>(raw: string): T | null {
  if (!raw) return null;

  // Strip markdown code fences
  const text = raw.replace(/^```(?:json|JSON)?\s*\n?/i, "").replace(/\n?```\s*$/i, "").trim();

  try {
    return JSON.parse(text) as T;
  } catch {
    // fall through
  }

  // Last-resort: find first { ... } or [ ... ] block
  const firstObj = text.indexOf("{");
  const firstArr = text.indexOf("[");
  const start =
    firstObj === -1
      ? firstArr
      : firstArr === -1
        ? firstObj
        : Math.min(firstObj, firstArr);
  if (start === -1) return null;
  const open = text[start];
  const close = open === "{" ? "}" : "]";
  let depth = 0;
  for (let i = start; i < text.length; i++) {
    if (text[i] === open) depth++;
    else if (text[i] === close) {
      depth--;
      if (depth === 0) {
        try {
          return JSON.parse(text.slice(start, i + 1)) as T;
        } catch {
          return null;
        }
      }
    }
  }
  return null;
}

/**
 * Extract the first text block from a Claude response.
 */
export function getResponseText(response: Anthropic.Message): string {
  for (const block of response.content) {
    if (block.type === "text") return block.text;
  }
  return "";
}
