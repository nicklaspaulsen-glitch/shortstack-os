import { describe, expect, it, vi, beforeEach } from "vitest";

// Mock the LLM router so the AI bonus path doesn't hit network in unit tests.
vi.mock("@/lib/ai/llm-router", () => ({
  callLLM: vi.fn(async () => ({
    text: '{ "score": 30, "reasoning": "Mock AI bonus." }',
    provider: "mock",
    model: "mock",
    inputTokens: 10,
    outputTokens: 10,
    costUsd: 0,
    durationMs: 0,
  })),
}));

import {
  computeBaseScore,
  computeScore,
  gradeFromScore,
  SCORING_CONFIG,
  SELF_TEST_FIXTURES,
} from "@/lib/leads/scoring";

describe("lead scoring — gradeFromScore", () => {
  it("returns customer when isCustomer flag is true", () => {
    expect(gradeFromScore(0, true)).toBe("customer");
    expect(gradeFromScore(100, true)).toBe("customer");
  });

  it("buckets cold/warm/hot/customer correctly", () => {
    expect(gradeFromScore(0, false)).toBe("cold");
    expect(gradeFromScore(SCORING_CONFIG.thresholds.cold_max, false)).toBe(
      "cold",
    );
    expect(
      gradeFromScore(SCORING_CONFIG.thresholds.cold_max + 1, false),
    ).toBe("warm");
    expect(gradeFromScore(SCORING_CONFIG.thresholds.warm_max, false)).toBe(
      "warm",
    );
    expect(
      gradeFromScore(SCORING_CONFIG.thresholds.warm_max + 1, false),
    ).toBe("hot");
    expect(gradeFromScore(SCORING_CONFIG.thresholds.hot_max, false)).toBe(
      "hot",
    );
    expect(
      gradeFromScore(SCORING_CONFIG.thresholds.hot_max + 1, false),
    ).toBe("customer");
  });
});

describe("lead scoring — computeBaseScore", () => {
  beforeEach(() => {
    vi.useRealTimers();
  });

  it("returns 0 base for an empty event log", () => {
    const cold = SELF_TEST_FIXTURES.find((f) => f.name.startsWith("cold"));
    expect(cold).toBeDefined();
    if (!cold) return;
    const { base, breakdown } = computeBaseScore(cold.signals);
    expect(base).toBe(0);
    expect(breakdown.email_opens).toBe(0);
    expect(breakdown.recency_multiplier).toBeGreaterThan(0);
  });

  it("caps email_open contribution per the config", () => {
    const now = new Date();
    const events = Array.from({ length: 20 }, () => ({
      type: "email_open" as const,
      occurred_at: new Date(now.getTime() - 1000).toISOString(),
    }));
    const { breakdown } = computeBaseScore({
      profile: {
        id: "x",
        user_id: "x",
        business_name: "x",
        email: null,
        phone: null,
        website: null,
        industry: null,
        city: null,
        state: null,
        google_rating: null,
        review_count: null,
        status: null,
        source: null,
      },
      events,
      recentInteractions: [],
      isCustomer: false,
    });
    expect(breakdown.email_opens).toBe(SCORING_CONFIG.caps.email_opens);
  });

  it("clamps base at 50 even with massive engagement", () => {
    const now = new Date();
    const events = [
      ...Array.from({ length: 10 }, () => ({
        type: "email_click" as const,
        occurred_at: new Date(now.getTime() - 1000).toISOString(),
      })),
      ...Array.from({ length: 5 }, () => ({
        type: "form_submit" as const,
        occurred_at: new Date(now.getTime() - 1000).toISOString(),
      })),
      {
        type: "demo_booked" as const,
        occurred_at: new Date(now.getTime() - 1000).toISOString(),
      },
    ];
    const { base } = computeBaseScore({
      profile: {
        id: "x",
        user_id: "x",
        business_name: "x",
        email: null,
        phone: null,
        website: null,
        industry: null,
        city: null,
        state: null,
        google_rating: null,
        review_count: null,
        status: null,
        source: null,
      },
      events,
      recentInteractions: [],
      isCustomer: false,
    });
    expect(base).toBeLessThanOrEqual(50);
    expect(base).toBeGreaterThan(0);
  });
});

describe("lead scoring — computeScore (integration with mocked AI)", () => {
  it("returns a hot grade for a high-engagement fixture", async () => {
    const hot = SELF_TEST_FIXTURES.find((f) => f.name.includes("hot"));
    expect(hot).toBeDefined();
    if (!hot) return;
    const result = await computeScore(hot.signals);
    expect(result.score).toBeGreaterThan(SCORING_CONFIG.thresholds.warm_max);
    expect(["hot", "customer"]).toContain(result.grade);
    expect(result.algo_version).toBe(SCORING_CONFIG.algo_version);
    expect(result.signal_breakdown).toBeDefined();
  });

  it("returns customer grade when isCustomer flag is set", async () => {
    const customer = SELF_TEST_FIXTURES.find((f) =>
      f.name.includes("customer"),
    );
    expect(customer).toBeDefined();
    if (!customer) return;
    const result = await computeScore(customer.signals);
    expect(result.grade).toBe("customer");
    expect(result.score).toBeGreaterThanOrEqual(86);
  });
});
