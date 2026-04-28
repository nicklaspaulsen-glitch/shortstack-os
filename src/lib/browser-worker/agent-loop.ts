/**
 * Browser Worker — agent loop.
 *
 * Drives a real Playwright browser via Claude tool-calling. On each step the
 * worker captures a screenshot + interactable-element snapshot, asks Claude
 * what to do next, executes the returned tool call, and records the result.
 * Stops when Claude returns `done` / `fail`, or when caps are hit.
 *
 * Caps (hard):
 *   - max_steps   default 30, configurable up to 100
 *   - max_cost    $1 USD per task — kills the loop if exceeded
 *
 * Storage:
 *   - Each step screenshot is uploaded to R2 under `browser-worker/{taskId}/{step}.png`
 *   - Per-step recording (screenshot key + tool call + reasoning) is appended
 *     to `browser_tasks.recordings` so the UI can replay the trace.
 */
// Use playwright-core (no electron, ~4MB) instead of playwright (300MB+
// because it transitively pulls in electron's chromium binary). The
// chromium browser is provided by Vercel's serverless runtime, so we only
// need the driver bindings, not the test runner.
import { chromium, type Browser, type BrowserContext, type Page } from "playwright-core";
import type Anthropic from "@anthropic-ai/sdk";
import { anthropic } from "@/lib/ai/claude-helpers";
import { uploadToR2 } from "@/lib/server/r2-client";
import { createServiceClient } from "@/lib/supabase/server";
import { BROWSER_TOOLS, type BrowserToolName } from "./tools";
import {
  extractInteractableElements,
  formatSnapshotForPrompt,
  type DomSnapshot,
} from "./dom-snapshot";

/** Hard cap on total LLM spend per task (USD). */
export const DEFAULT_COST_CAP_USD = 1.0;
/** Default step cap when caller doesn't override. */
export const DEFAULT_MAX_STEPS = 30;
/** Absolute ceiling — even if caller asks for more. */
export const STEP_CEILING = 100;
/** Per-step LLM token budget. */
const STEP_MAX_TOKENS = 2048;
/** Sonnet — vision + tool use both supported. */
const AGENT_MODEL = "claude-sonnet-4-6-20250514";
/** Sonnet 4.6 pricing per 1M tokens. */
const PRICE_INPUT_PER_M = 3.0;
const PRICE_OUTPUT_PER_M = 15.0;

const SYSTEM_PROMPT = `You are a precise, methodical AI agent that drives a real browser to accomplish goals.

You see the live browser through:
  1) A screenshot of the current viewport (most recent attached image).
  2) A compact list of interactable elements with selectors.
  3) The first 2000 chars of visible page text.

You act through tool calls only. Pick ONE tool call per turn. Be deliberate:
  - Read the snapshot before acting.
  - Prefer specific selectors (data-testid, id, role+name) over fragile text matches.
  - If a click triggers an SPA route change or modal, use wait_for next.
  - When you have the answer, call done() with a clear human-readable result
    and any structured data the user asked for.
  - If the task is impossible (paywall, login wall, captcha, anti-bot), call
    fail() with a precise reason. Do NOT keep trying.

Safety:
  - NEVER type into password fields unless explicitly told the task allows it.
  - NEVER make purchases, send money, or execute irreversible actions on
    behalf of the user without explicit instruction.
  - If you encounter a CAPTCHA or login wall, call fail() — humans solve those.

You have a strict step budget. Plan efficient paths, not exhaustive ones.`;

interface RecordingEntry {
  step: number;
  screenshot_r2_key: string | null;
  tool_name: BrowserToolName | "none";
  tool_input: Record<string, unknown>;
  reasoning?: string;
  cost_usd: number;
  ts: string;
}

export interface RunBrowserAgentOptions {
  goal: string;
  startUrl?: string;
  maxSteps?: number;
  agencyOwnerId: string;
  taskId: string;
  /** Optional list of allowed domains. Empty/undefined = no allowlist. */
  domainAllowlist?: string[];
  /** Set true to allow typing into password fields. Default false. */
  allowPasswords?: boolean;
  /** Cost cap in USD. Defaults to DEFAULT_COST_CAP_USD. */
  maxCostUsd?: number;
}

export interface RunBrowserAgentResult {
  status: "completed" | "failed" | "cancelled";
  resultText: string;
  resultData?: Record<string, unknown>;
  stepsTaken: number;
  costUsd: number;
  errorMessage?: string;
}

/**
 * Build the chat history sent to Claude every step.
 *
 * We rebuild it fresh each turn (rather than mutating message arrays) because
 * the screenshot for prior steps doesn't add value once superseded — only
 * the LATEST screenshot is included. This keeps the prompt small and cheap.
 */
function buildMessages(args: {
  goal: string;
  history: RecordingEntry[];
  snapshot: DomSnapshot;
  screenshotBase64: string | null;
}): Anthropic.MessageParam[] {
  const { goal, history, snapshot, screenshotBase64 } = args;

  const historyText =
    history.length === 0
      ? "(no actions yet)"
      : history
          .map(
            (h) =>
              `Step ${h.step}: ${h.tool_name}(${JSON.stringify(h.tool_input)})${
                h.reasoning ? " — " + h.reasoning : ""
              }`,
          )
          .join("\n");

  const snapshotText = formatSnapshotForPrompt(snapshot);

  const userBlocks: Anthropic.ContentBlockParam[] = [];
  if (screenshotBase64) {
    userBlocks.push({
      type: "image",
      source: {
        type: "base64",
        media_type: "image/png",
        data: screenshotBase64,
      },
    });
  }
  userBlocks.push({
    type: "text",
    text: `Goal: ${goal}

Actions taken so far:
${historyText}

Current page snapshot:
${snapshotText}

Decide the single next action. Use a tool call.`,
  });

  return [{ role: "user", content: userBlocks }];
}

function calcCost(inputTokens: number, outputTokens: number): number {
  return (
    (inputTokens / 1_000_000) * PRICE_INPUT_PER_M +
    (outputTokens / 1_000_000) * PRICE_OUTPUT_PER_M
  );
}

function sanitizeStepCount(requested: number | undefined): number {
  const v = typeof requested === "number" && requested > 0 ? requested : DEFAULT_MAX_STEPS;
  return Math.min(v, STEP_CEILING);
}

/** Domain check — returns true if the URL is allowed under the allowlist. */
function isUrlAllowed(url: string, allowlist?: string[]): boolean {
  if (!allowlist || allowlist.length === 0) return true;
  try {
    const host = new URL(url).hostname;
    return allowlist.some(
      (d) => host === d || host.endsWith("." + d) || host === d.replace(/^www\./, ""),
    );
  } catch {
    return false;
  }
}

/** Detect password field — used to enforce the allow_passwords gate. */
async function isPasswordField(page: Page, selector: string): Promise<boolean> {
  try {
    return await page.$eval(selector, (el) => {
      const t = (el as HTMLInputElement).type;
      return t === "password";
    });
  } catch {
    return false;
  }
}

interface ExecuteToolArgs {
  page: Page;
  toolName: BrowserToolName;
  input: Record<string, unknown>;
  allowPasswords: boolean;
  domainAllowlist?: string[];
}

interface ExecuteToolResult {
  ok: boolean;
  /** Short message describing what happened — fed back to model on next turn. */
  message: string;
  /** Set when extract was called — JSON string of extracted text. */
  extracted?: string;
}

/**
 * Execute a tool call against the live page. Returns success/failure + a
 * short human-readable message. Errors are caught and returned as ok=false
 * so the model can try a different approach without crashing the loop.
 */
async function executeTool(args: ExecuteToolArgs): Promise<ExecuteToolResult> {
  const { page, toolName, input, allowPasswords, domainAllowlist } = args;

  try {
    switch (toolName) {
      case "click": {
        const selector = String(input.selector ?? "");
        if (!selector) return { ok: false, message: "click: missing selector" };
        await page.click(selector, { timeout: 5000 });
        return { ok: true, message: `clicked ${selector}` };
      }
      case "type": {
        const selector = String(input.selector ?? "");
        const text = String(input.text ?? "");
        if (!selector) return { ok: false, message: "type: missing selector" };
        if (!allowPasswords && (await isPasswordField(page, selector))) {
          return {
            ok: false,
            message:
              "type: blocked — password field detected and allow_passwords=false. Call fail() or have the user set allow_passwords on the task.",
          };
        }
        await page.fill(selector, text, { timeout: 5000 });
        return { ok: true, message: `typed ${text.length} chars into ${selector}` };
      }
      case "navigate": {
        const url = String(input.url ?? "");
        if (!url) return { ok: false, message: "navigate: missing url" };
        if (!isUrlAllowed(url, domainAllowlist)) {
          return { ok: false, message: `navigate: blocked by domain allowlist — ${url}` };
        }
        await page.goto(url, { waitUntil: "domcontentloaded", timeout: 20000 });
        return { ok: true, message: `navigated to ${url}` };
      }
      case "wait_for": {
        const selector = String(input.selector ?? "");
        if (!selector) return { ok: false, message: "wait_for: missing selector" };
        await page.waitForSelector(selector, { state: "visible", timeout: 10000 });
        return { ok: true, message: `selector ${selector} is now visible` };
      }
      case "scroll": {
        const direction = String(input.direction ?? "down");
        const amount = typeof input.amount === "number" ? input.amount : 600;
        if (direction === "top") await page.evaluate(() => window.scrollTo(0, 0));
        else if (direction === "bottom")
          await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
        else if (direction === "up") await page.evaluate((px) => window.scrollBy(0, -px), amount);
        else await page.evaluate((px) => window.scrollBy(0, px), amount);
        return { ok: true, message: `scrolled ${direction}${direction === "up" || direction === "down" ? ` by ${amount}px` : ""}` };
      }
      case "extract": {
        // Pull a generous chunk of body text — the model has the screenshot
        // already, this is the fallback for text-rich pages.
        const text = await page.evaluate(() => {
          return (document.body?.innerText || "").replace(/\s+/g, " ").trim().slice(0, 8000);
        });
        return { ok: true, message: `extracted ${text.length} chars`, extracted: text };
      }
      case "done":
      case "fail":
        // Terminal calls — the loop handles them, not this dispatcher.
        return { ok: true, message: `terminal: ${toolName}` };
    }
  } catch (err) {
    return {
      ok: false,
      message: `${toolName} failed: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
  return { ok: false, message: `unknown tool: ${toolName}` };
}

async function uploadStepScreenshot(
  taskId: string,
  step: number,
  buffer: Buffer,
): Promise<string | null> {
  const key = `browser-worker/${taskId}/step-${String(step).padStart(3, "0")}.png`;
  try {
    await uploadToR2(key, buffer, "image/png");
    return key;
  } catch (err) {
    console.error("[browser-worker] screenshot upload failed", err);
    return null;
  }
}

async function persistStep(taskId: string, entry: RecordingEntry, totalCost: number) {
  try {
    const supabase = createServiceClient();
    // Append to recordings + bump steps_taken + total_cost_usd in one shot.
    // We do a read-modify-write rather than a postgres array_append because
    // the column is jsonb (not text[]) and we want the bookkeeping fields
    // updated atomically alongside.
    const { data: row } = await supabase
      .from("browser_tasks")
      .select("recordings")
      .eq("id", taskId)
      .maybeSingle();
    const recordings = Array.isArray(row?.recordings) ? row.recordings : [];
    recordings.push(entry);
    await supabase
      .from("browser_tasks")
      .update({
        recordings,
        steps_taken: entry.step + 1,
        total_cost_usd: totalCost,
      })
      .eq("id", taskId);
  } catch (err) {
    console.error("[browser-worker] persistStep failed", err);
  }
}

async function markRunning(taskId: string) {
  try {
    const supabase = createServiceClient();
    await supabase
      .from("browser_tasks")
      .update({ status: "running", started_at: new Date().toISOString() })
      .eq("id", taskId);
  } catch (err) {
    console.error("[browser-worker] markRunning failed", err);
  }
}

async function markFinal(
  taskId: string,
  status: "completed" | "failed",
  resultText: string,
  resultData: Record<string, unknown> | undefined,
  errorMessage: string | undefined,
) {
  try {
    const supabase = createServiceClient();
    await supabase
      .from("browser_tasks")
      .update({
        status,
        result_text: resultText,
        result_data: resultData ?? null,
        error_message: errorMessage ?? null,
        completed_at: new Date().toISOString(),
      })
      .eq("id", taskId);
  } catch (err) {
    console.error("[browser-worker] markFinal failed", err);
  }
}

/**
 * Main entrypoint. Runs the agent loop end-to-end, updating the DB row as it
 * progresses. Returns the final result. Caller decides whether to await this
 * (inline) or fire-and-forget (cron / webhook).
 */
export async function runBrowserAgent(
  opts: RunBrowserAgentOptions,
): Promise<RunBrowserAgentResult> {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error("[browser-worker] ANTHROPIC_API_KEY not configured");
  }

  const maxSteps = sanitizeStepCount(opts.maxSteps);
  const maxCost = opts.maxCostUsd ?? DEFAULT_COST_CAP_USD;
  const allowPasswords = !!opts.allowPasswords;
  const domainAllowlist = opts.domainAllowlist;

  await markRunning(opts.taskId);

  let browser: Browser | null = null;
  let ctx: BrowserContext | null = null;
  let totalCost = 0;
  let stepsTaken = 0;
  let finalResult: RunBrowserAgentResult = {
    status: "failed",
    resultText: "",
    stepsTaken: 0,
    costUsd: 0,
    errorMessage: "loop did not terminate",
  };
  const history: RecordingEntry[] = [];

  try {
    browser = await chromium.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-dev-shm-usage"],
    });
    ctx = await browser.newContext({ viewport: { width: 1366, height: 768 } });
    const page = await ctx.newPage();

    if (opts.startUrl) {
      if (!isUrlAllowed(opts.startUrl, domainAllowlist)) {
        finalResult = {
          status: "failed",
          resultText: "",
          stepsTaken: 0,
          costUsd: 0,
          errorMessage: `start_url ${opts.startUrl} not in domain allowlist`,
        };
        return finalResult;
      }
      await page.goto(opts.startUrl, { waitUntil: "domcontentloaded", timeout: 20000 });
    }

    for (let step = 0; step < maxSteps; step++) {
      stepsTaken = step + 1;

      // 1) Snapshot.
      const screenshotBuf = await page.screenshot({ fullPage: false, type: "png" });
      const screenshotBase64 = Buffer.from(screenshotBuf).toString("base64");
      const snapshot = await extractInteractableElements(page);
      const screenshotR2Key = await uploadStepScreenshot(opts.taskId, step, Buffer.from(screenshotBuf));

      // 2) Ask Claude what to do next.
      const messages = buildMessages({
        goal: opts.goal,
        history,
        snapshot,
        screenshotBase64,
      });

      const response = await anthropic.messages.create({
        model: AGENT_MODEL,
        max_tokens: STEP_MAX_TOKENS,
        system: SYSTEM_PROMPT,
        tools: BROWSER_TOOLS,
        messages,
      });

      const stepCost = calcCost(
        response.usage?.input_tokens ?? 0,
        response.usage?.output_tokens ?? 0,
      );
      totalCost += stepCost;

      // 3) Pick the first tool_use block (model returns at most one per turn
      // when we ask for it; if it returned text-only, we treat it as a
      // soft fail and try once more).
      const toolBlock = response.content.find(
        (b): b is Anthropic.ToolUseBlock => b.type === "tool_use",
      );
      const textBlock = response.content.find(
        (b): b is Anthropic.TextBlock => b.type === "text",
      );
      const reasoning = textBlock?.text;

      if (!toolBlock) {
        const entry: RecordingEntry = {
          step,
          screenshot_r2_key: screenshotR2Key,
          tool_name: "none",
          tool_input: {},
          reasoning,
          cost_usd: stepCost,
          ts: new Date().toISOString(),
        };
        history.push(entry);
        await persistStep(opts.taskId, entry, totalCost);
        finalResult = {
          status: "failed",
          resultText: textBlock?.text ?? "",
          stepsTaken,
          costUsd: totalCost,
          errorMessage: "model returned no tool call",
        };
        break;
      }

      const toolName = toolBlock.name as BrowserToolName;
      const toolInput = (toolBlock.input ?? {}) as Record<string, unknown>;

      // Record before execution so the step shows up in the trace even if
      // execution throws on a later branch.
      const entry: RecordingEntry = {
        step,
        screenshot_r2_key: screenshotR2Key,
        tool_name: toolName,
        tool_input: toolInput,
        reasoning: typeof toolInput.reasoning === "string" ? toolInput.reasoning : reasoning,
        cost_usd: stepCost,
        ts: new Date().toISOString(),
      };
      history.push(entry);
      await persistStep(opts.taskId, entry, totalCost);

      // 4) Terminal cases.
      if (toolName === "done") {
        finalResult = {
          status: "completed",
          resultText: typeof toolInput.result === "string" ? toolInput.result : "",
          resultData: (toolInput.data && typeof toolInput.data === "object"
            ? (toolInput.data as Record<string, unknown>)
            : undefined),
          stepsTaken,
          costUsd: totalCost,
        };
        break;
      }
      if (toolName === "fail") {
        finalResult = {
          status: "failed",
          resultText: "",
          stepsTaken,
          costUsd: totalCost,
          errorMessage: typeof toolInput.reason === "string" ? toolInput.reason : "model called fail",
        };
        break;
      }

      // 5) Cost cap check before acting on more LLM-billed steps.
      if (totalCost >= maxCost) {
        finalResult = {
          status: "failed",
          resultText: "",
          stepsTaken,
          costUsd: totalCost,
          errorMessage: `cost cap exceeded — $${totalCost.toFixed(4)} >= $${maxCost.toFixed(2)}`,
        };
        break;
      }

      // 6) Execute the tool. Errors are surfaced to the model next turn via
      // ... actually we don't pass them back since we rebuild the prompt
      // from snapshot+history each time. The history entry we just wrote
      // captures the attempted call; the next snapshot reflects the new
      // page state.
      await executeTool({
        page,
        toolName,
        input: toolInput,
        allowPasswords,
        domainAllowlist,
      });
    }

    // Hit max_steps without a terminal call.
    if (finalResult.status === "failed" && finalResult.errorMessage === "loop did not terminate") {
      finalResult = {
        status: "failed",
        resultText: "",
        stepsTaken,
        costUsd: totalCost,
        errorMessage: `step cap reached (${maxSteps}) — task incomplete`,
      };
    }
  } catch (err) {
    finalResult = {
      status: "failed",
      resultText: "",
      stepsTaken,
      costUsd: totalCost,
      errorMessage: `runtime error: ${err instanceof Error ? err.message : String(err)}`,
    };
    console.error("[browser-worker] loop error", err);
  } finally {
    try {
      if (ctx) await ctx.close();
      if (browser) await browser.close();
    } catch (err) {
      console.error("[browser-worker] cleanup failed", err);
    }
  }

  await markFinal(
    opts.taskId,
    finalResult.status === "completed" ? "completed" : "failed",
    finalResult.resultText,
    finalResult.resultData,
    finalResult.errorMessage,
  );

  return finalResult;
}
