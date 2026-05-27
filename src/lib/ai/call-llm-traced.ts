/**
 * `callLLMTraced` — drop-in replacement for `callLLMHumanized` that adds:
 *   1. Langfuse observability (via `traceLLMCall`) — traces every call with
 *      duration, token counts, cost, and pass/fail status.
 *   2. Mem0 long-term memory — optionally recalls relevant facts and injects
 *      them into the system prompt before the voice context; optionally stores
 *      the response as a persistent fact for future recall.
 *
 * Opt-in pattern (from CLAUDE.md):
 *   To instrument a new AI surface, switch from `callLLM` or `callLLMHumanized`
 *   to `callLLMTraced` and pass `agencyOwnerId`, `surface`, and optionally
 *   `subject`, `withMemory: true`, `storeMemory: true`.
 *   All `CallLLMHumanizedRequest` fields are still accepted — `voiceProfile`,
 *   `humanize` (default true), and `channel` continue to work as before.
 *
 * Soft-fail guarantee:
 *   - Langfuse keys unset → tracing skipped, call proceeds normally.
 *   - MEM0_API_KEY unset → memory skipped, call proceeds normally.
 *   - Any recall/remember error → logged with console.warn, call unaffected.
 *   - Underlying `callLLMHumanized` errors propagate normally.
 */

import {
  callLLMHumanized,
  type CallLLMHumanizedRequest,
  type CallLLMHumanizedResponse,
} from "@/lib/ai/call-llm-humanized";
import { traceLLMCall } from "@/lib/ai/langfuse-client";
import {
  recallFacts,
  rememberFact,
  type SubjectKind,
} from "@/lib/ai/mem0-client";

export interface CallLLMTracedRequest extends CallLLMHumanizedRequest {
  /** Agency owner UUID — required for Langfuse scoping and Mem0 isolation. */
  agencyOwnerId: string;
  /**
   * Logical surface identifier passed to Langfuse traces and used as the
   * Mem0 `source` label. Examples: 'cold_email' | 'sales_coach' |
   * 'trinity_autonomous' | 'retention_message'.
   */
  surface: string;
  /**
   * Optional subject context — used for Langfuse trace tagging and to scope
   * Mem0 recall/store. Memory operations (withMemory / storeMemory) are
   * silently no-ops when this is absent.
   */
  subject?: { kind: SubjectKind; id: string };
  /**
   * When true, semantically-recalled Mem0 facts for this subject are injected
   * into the system prompt (before the voice-profile context block).
   * The `userPrompt` text is used as the semantic search query.
   * Requires `subject` — silently skipped when absent.
   */
  withMemory?: boolean;
  /**
   * When true, the LLM's response text is asynchronously stored as a Mem0
   * fact scoped to this subject. Fire-and-forget: never blocks the return.
   * Requires `subject` — silently skipped when absent.
   */
  storeMemory?: boolean;
}

/**
 * Full observability + memory wrapper around `callLLMHumanized`.
 * All auxiliary operations (tracing, memory) soft-fail and never block
 * or break the underlying LLM call.
 */
export async function callLLMTraced(
  req: CallLLMTracedRequest,
): Promise<CallLLMHumanizedResponse> {
  const {
    agencyOwnerId,
    surface,
    subject,
    withMemory,
    storeMemory,
    ...humanizedReq
  } = req;

  // ── Step 1: Recall memories and inject into system prompt ────────────────
  // Memory facts are prepended to the caller's system prompt before
  // `callLLMHumanized` appends its voice-profile context. Final order:
  //   [caller system prompt] → [memory facts] → [VOICE CONTEXT: ...]
  let systemPromptWithMemory = humanizedReq.systemPrompt;
  if (withMemory && subject) {
    try {
      const facts = await recallFacts({
        agencyOwnerId,
        subjectKind: subject.kind,
        subjectId: subject.id,
        query: humanizedReq.userPrompt,
        limit: 8,
      });
      if (facts.length > 0) {
        const factBlock = facts.map((f) => `- ${f.fact}`).join("\n");
        systemPromptWithMemory = [
          systemPromptWithMemory ?? "",
          `\n\nMEMORY CONTEXT (what we know about this ${subject.kind}):\n${factBlock}`,
        ]
          .join("")
          .trim();
      }
    } catch (err) {
      console.warn(
        "[call-llm-traced] recallFacts failed — proceeding without memory",
        err,
      );
    }
  }

  // ── Step 2: Run the humanized LLM call inside the Langfuse trace ─────────
  const result = await traceLLMCall({
    agencyOwnerId,
    surface,
    taskType: humanizedReq.taskType,
    subject,
    inputForTrace: {
      taskType: humanizedReq.taskType,
      userPrompt: humanizedReq.userPrompt?.slice(0, 1000),
      context: humanizedReq.context,
    },
    run: () =>
      callLLMHumanized({
        ...humanizedReq,
        systemPrompt: systemPromptWithMemory,
      }),
  });

  // ── Step 3: Fire-and-forget memory store ────────────────────────────────
  // Store the response as a Mem0 fact so future calls to this same subject
  // can recall it. Never awaited — latency of the HTTP call is hidden.
  if (storeMemory && subject && result.text) {
    void rememberFact({
      agencyOwnerId,
      subjectKind: subject.kind,
      subjectId: subject.id,
      fact: result.text,
      source: surface,
      metadata: {
        taskType: humanizedReq.taskType,
        context: humanizedReq.context ?? null,
      },
    }).catch((err) => {
      console.warn("[call-llm-traced] rememberFact failed", err);
    });
  }

  return result;
}
