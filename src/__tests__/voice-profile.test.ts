import { describe, it, expect } from "vitest";
import {
  computeStats,
  countWords,
  VOICE_MIN_CORPUS_WORDS,
} from "@/lib/ai/voice-profile-stats";

describe("countWords", () => {
  it("counts whitespace-separated words", () => {
    expect(countWords("hello world how are you")).toBe(5);
  });

  it("collapses multiple spaces", () => {
    expect(countWords("hello    world")).toBe(2);
  });

  it("returns 0 for empty input", () => {
    expect(countWords("")).toBe(0);
    expect(countWords("   ")).toBe(0);
  });
});

describe("computeStats", () => {
  it("returns zeroed stats for empty corpus", () => {
    const s = computeStats([]);
    expect(s.totalWords).toBe(0);
    expect(s.formalityScore).toBe(0.5);
  });

  it("counts contractions vs formal nots", () => {
    const samples = [
      "I don't think we'll ship on time.",
      "We do not think we will ship on time.",
    ];
    const s = computeStats(samples);
    // Two contractions, two formal nots → contractionRate ~ 0.5
    expect(s.contractionRate).toBeGreaterThan(0.3);
    expect(s.contractionRate).toBeLessThan(0.7);
  });

  it("flags casual writing as low formality", () => {
    const s = computeStats([
      "hey yo lol nope yeah lemme tbh wanna gonna",
    ]);
    expect(s.formalityScore).toBeLessThan(0.3);
  });

  it("flags formal writing as high formality", () => {
    const s = computeStats([
      "Sincerely yours, kindly find the report. Furthermore, accordingly the timeline shifts.",
    ]);
    expect(s.formalityScore).toBeGreaterThan(0.7);
  });

  it("counts em-dashes correctly", () => {
    const s = computeStats([
      "Hi - quick one - can you ship today — please — and also today.",
    ]);
    // 2 em-dashes (—) over ~14 words → emDashRate > 0
    expect(s.emDashRate).toBeGreaterThan(0);
  });

  it("computes avg sentence length", () => {
    const s = computeStats([
      "Short. Another short. Now a slightly longer sentence with more words inside.",
    ]);
    expect(s.avgSentenceLength).toBeGreaterThan(2);
  });
});

describe("VOICE_MIN_CORPUS_WORDS", () => {
  it("is a sensible threshold (>=100, <=400)", () => {
    expect(VOICE_MIN_CORPUS_WORDS).toBeGreaterThanOrEqual(100);
    expect(VOICE_MIN_CORPUS_WORDS).toBeLessThanOrEqual(400);
  });
});
