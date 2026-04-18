import { describe, it, expect } from "vitest";
import { mergeNonEmpty } from "@/lib/merge-patch";

describe("mergeNonEmpty — regression guard for AI helper input-wipe bug", () => {
  it("preserves existing keys when patch is empty", () => {
    const target = { title: "My thumbnail", niche: "finance" };
    expect(mergeNonEmpty(target, {})).toEqual(target);
  });

  it("preserves existing keys when patch is undefined (API failure)", () => {
    const target = { title: "My thumbnail" };
    expect(mergeNonEmpty(target, undefined)).toEqual(target);
  });

  it("ignores undefined patch values (the exact bug)", () => {
    // This is what happened before the fix: AI returned variants[0].title
    // which was undefined, and the wizard wrote { title: undefined }.
    const target = { title: "My thumbnail" };
    const patch = { title: undefined as unknown as string };
    expect(mergeNonEmpty(target, patch)).toEqual({ title: "My thumbnail" });
  });

  it("ignores null patch values", () => {
    const target = { topic: "growth" };
    const patch = { topic: null as unknown as string };
    expect(mergeNonEmpty(target, patch)).toEqual({ topic: "growth" });
  });

  it("ignores empty string patch values", () => {
    const target = { subject: "Welcome!" };
    const patch = { subject: "" };
    expect(mergeNonEmpty(target, patch)).toEqual({ subject: "Welcome!" });
  });

  it("applies valid patch values", () => {
    const target = { title: "Original" };
    const patch = { title: "AI-Optimized" };
    expect(mergeNonEmpty(target, patch)).toEqual({ title: "AI-Optimized" });
  });

  it("mixes valid + invalid values in a single patch", () => {
    const target = { title: "T1", niche: "N1", tone: "T1" };
    const patch = { title: "T2", niche: undefined as unknown as string, tone: "" };
    expect(mergeNonEmpty(target, patch)).toEqual({
      title: "T2",   // updated
      niche: "N1",   // preserved (patch was undefined)
      tone: "T1",    // preserved (patch was empty string)
    });
  });

  it("preserves 0 and false (falsy but not empty)", () => {
    const target = { count: 10, active: true };
    const patch = { count: 0, active: false };
    expect(mergeNonEmpty(target, patch)).toEqual({ count: 0, active: false });
  });
});
