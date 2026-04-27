import { describe, it, expect } from "vitest";
import { computeCallMetrics } from "@/lib/coach/metrics";

describe("coach metrics — WhisperX speaker labels", () => {
  it("treats SPEAKER_00 as the rep", () => {
    const segments = [
      { start: 0, end: 5, speaker: "SPEAKER_00", text: "Hi there, thanks for jumping on the call today." },
      { start: 5, end: 8, speaker: "SPEAKER_01", text: "No problem at all." },
      { start: 8, end: 14, speaker: "SPEAKER_00", text: "Tell me a bit about your business." },
      { start: 14, end: 22, speaker: "SPEAKER_01", text: "We sell handmade ceramics direct to consumer." },
    ];
    const m = computeCallMetrics("ignored", 22, segments);
    // Rep (SPEAKER_00) said: "Hi there thanks for jumping on the call today" (9)
    //                       + "Tell me a bit about your business" (7) = 16
    expect(m.rep_word_count).toBe(16);
    // Prospect (SPEAKER_01) said: "No problem at all" (4) +
    //                              "We sell handmade ceramics direct to consumer" (7) = 11
    expect(m.prospect_word_count).toBe(11);
    expect(m.rep_turn_count).toBe(2);
    expect(m.prospect_turn_count).toBe(2);
  });

  it("handles uppercase / case-insensitive labels", () => {
    const segments = [
      { start: 0, end: 5, speaker: "speaker_00", text: "Lower-case label test." },
      { start: 5, end: 8, speaker: "SPEAKER_01", text: "Mixed casing." },
    ];
    const m = computeCallMetrics("ignored", 8, segments);
    expect(m.rep_word_count).toBe(4); // "Lower case label test"
    expect(m.prospect_word_count).toBe(2); // "Mixed casing"
  });

  it("treats lowest-numbered speaker as rep even when not zero-based", () => {
    // pyannote sometimes reports SPEAKER_01 / SPEAKER_02 when channel detection
    // skips a speaker. Lowest-indexed should still win.
    const segments = [
      { start: 0, end: 4, speaker: "SPEAKER_01", text: "Five words from the rep." },
      { start: 4, end: 7, speaker: "SPEAKER_02", text: "Three from prospect." },
    ];
    const m = computeCallMetrics("ignored", 7, segments);
    expect(m.rep_word_count).toBe(5);
    expect(m.prospect_word_count).toBe(3);
  });

  it("falls back to legacy 'Speaker 1' / 'Speaker 2' classification", () => {
    const segments = [
      { start: 0, end: 4, speaker: "Speaker 1", text: "Four word rep turn." },
      { start: 4, end: 7, speaker: "Speaker 2", text: "Three from prospect." },
    ];
    const m = computeCallMetrics("ignored", 7, segments);
    expect(m.rep_word_count).toBe(4);
    expect(m.prospect_word_count).toBe(3);
  });
});
