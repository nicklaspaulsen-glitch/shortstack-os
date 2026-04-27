/**
 * Smoke tests for the Mem0 + Langfuse soft-fail invariants.
 *
 * The most important property here is "system runs unchanged when env keys
 * are unset". These tests cover that without booting the full Next runtime.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";

describe("mem0-client soft-fail", () => {
  beforeEach(() => {
    delete process.env.MEM0_API_KEY;
    vi.resetModules();
  });

  it("isMem0Configured returns false when key unset", async () => {
    const mod = await import("@/lib/ai/mem0-client");
    expect(mod.isMem0Configured()).toBe(false);
  });

  it("recallFacts returns [] when key unset", async () => {
    const mod = await import("@/lib/ai/mem0-client");
    const result = await mod.recallFacts({
      agencyOwnerId: "00000000-0000-0000-0000-000000000000",
      subjectKind: "lead",
      subjectId: "00000000-0000-0000-0000-000000000000",
    });
    expect(result).toEqual([]);
  });

  it("rememberFact returns null memoryId when key unset", async () => {
    const mod = await import("@/lib/ai/mem0-client");
    const result = await mod.rememberFact({
      agencyOwnerId: "00000000-0000-0000-0000-000000000000",
      subjectKind: "lead",
      subjectId: "00000000-0000-0000-0000-000000000000",
      fact: "test fact",
      source: "test",
    });
    expect(result.memoryId).toBeNull();
  });
});

describe("langfuse-client soft-fail", () => {
  beforeEach(() => {
    delete process.env.LANGFUSE_PUBLIC_KEY;
    delete process.env.LANGFUSE_SECRET_KEY;
    delete process.env.LANGFUSE_BASE_URL;
    vi.resetModules();
  });

  it("isLangfuseConfigured returns false when keys unset", async () => {
    const mod = await import("@/lib/ai/langfuse-client");
    expect(mod.isLangfuseConfigured()).toBe(false);
  });

  it("traceLLMCall just runs the function when keys unset", async () => {
    const mod = await import("@/lib/ai/langfuse-client");
    let called = false;
    const result = await mod.traceLLMCall({
      agencyOwnerId: "00000000-0000-0000-0000-000000000000",
      surface: "test",
      taskType: "extraction",
      run: async () => {
        called = true;
        return {
          text: "ok",
          provider: "anthropic",
          model: "haiku",
          inputTokens: 1,
          outputTokens: 1,
          costUsd: 0.0001,
          durationMs: 1,
        };
      },
    });
    expect(called).toBe(true);
    expect(result.text).toBe("ok");
  });

  it("langfuseTraceUrl builds against default cloud base", async () => {
    const mod = await import("@/lib/ai/langfuse-client");
    expect(mod.langfuseTraceUrl("abc123")).toBe(
      "https://cloud.langfuse.com/trace/abc123",
    );
  });
});
