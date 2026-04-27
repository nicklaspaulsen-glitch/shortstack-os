/**
 * Browser Worker — Claude tool schema.
 *
 * Each entry is a tool the agent loop exposes to Claude. The model returns a
 * `tool_use` block; the worker executes the action against the live Playwright
 * page and replays a `tool_result` back into the next round.
 *
 * Keep schemas tight and described — the model only sees these strings, so
 * vague descriptions yield vague behavior. Add `reasoning` to interactive
 * tools so the trace stored in the DB explains *why* each click happened.
 */
import type Anthropic from "@anthropic-ai/sdk";

export const BROWSER_TOOL_NAMES = [
  "click",
  "type",
  "navigate",
  "wait_for",
  "extract",
  "scroll",
  "done",
  "fail",
] as const;

export type BrowserToolName = (typeof BROWSER_TOOL_NAMES)[number];

export const BROWSER_TOOLS: Anthropic.Tool[] = [
  {
    name: "click",
    description:
      "Click an element on the page identified by a CSS selector. Prefer the most specific selector available (id, data-testid, role+name). For elements you saw in the labeled DOM list, you may use selectors like `[data-bw-idx=\"3\"]` if available, otherwise fall back to text-based selectors like `text=Sign in`.",
    input_schema: {
      type: "object" as const,
      properties: {
        selector: {
          type: "string",
          description: "CSS selector for the element to click.",
        },
        reasoning: {
          type: "string",
          description: "One sentence explaining why this click moves toward the goal.",
        },
      },
      required: ["selector", "reasoning"],
    },
  },
  {
    name: "type",
    description:
      "Type text into an input or textarea. Use for filling forms, search boxes, login fields. Selects the field first then types — replaces any existing value.",
    input_schema: {
      type: "object" as const,
      properties: {
        selector: {
          type: "string",
          description: "CSS selector for the input or textarea.",
        },
        text: {
          type: "string",
          description: "Text to enter. Will be typed verbatim — escape any special chars yourself.",
        },
        reasoning: {
          type: "string",
          description: "Why typing this value advances the goal.",
        },
      },
      required: ["selector", "text", "reasoning"],
    },
  },
  {
    name: "navigate",
    description:
      "Navigate the browser to a different URL. Use sparingly — most tasks should stay within a single site. Domain allowlist (when set) is enforced; navigation to a blocked domain returns an error.",
    input_schema: {
      type: "object" as const,
      properties: {
        url: {
          type: "string",
          description: "Absolute URL (must include scheme).",
        },
        reasoning: {
          type: "string",
          description: "Why navigating away from the current page is required.",
        },
      },
      required: ["url", "reasoning"],
    },
  },
  {
    name: "wait_for",
    description:
      "Wait up to 10 seconds for an element matching the selector to become visible. Use after clicks that trigger SPA route changes or modal opens.",
    input_schema: {
      type: "object" as const,
      properties: {
        selector: {
          type: "string",
          description: "CSS selector to wait for.",
        },
      },
      required: ["selector"],
    },
  },
  {
    name: "extract",
    description:
      "Extract text or structured data from the currently visible page. The worker captures the page text+DOM and returns it. Use for scraping the final answer once you've reached the right page.",
    input_schema: {
      type: "object" as const,
      properties: {
        instructions: {
          type: "string",
          description:
            "Plain-English description of what to extract, e.g. 'all pricing tiers with monthly cost and included features as JSON'.",
        },
      },
      required: ["instructions"],
    },
  },
  {
    name: "scroll",
    description: "Scroll the page in a direction. Use to reveal off-screen content before interacting.",
    input_schema: {
      type: "object" as const,
      properties: {
        direction: {
          type: "string",
          enum: ["up", "down", "top", "bottom"],
          description: "up/down scroll by amount; top/bottom scroll to the page extreme.",
        },
        amount: {
          type: "integer",
          description: "Pixels to scroll (default 600). Ignored for top/bottom.",
        },
      },
      required: ["direction"],
    },
  },
  {
    name: "done",
    description:
      "Task complete. Return the final result to the user. Set this whenever you've gathered enough information or completed every required action.",
    input_schema: {
      type: "object" as const,
      properties: {
        result: {
          type: "string",
          description: "Human-readable summary of what was accomplished.",
        },
        data: {
          type: "object",
          description: "Optional structured payload (e.g. extracted records, scraped values).",
        },
      },
      required: ["result"],
    },
  },
  {
    name: "fail",
    description:
      "Task cannot be completed (paywall, login required, anti-bot block, ambiguous goal, etc). Return a clear reason so the user can adjust.",
    input_schema: {
      type: "object" as const,
      properties: {
        reason: {
          type: "string",
          description: "Why the task is impossible to finish in the current session.",
        },
      },
      required: ["reason"],
    },
  },
];
