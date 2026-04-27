import { describe, it, expect } from "vitest";
import {
  VERTICALS,
  getVertical,
  listVerticals,
  countVertical,
  isVerticalKey,
  isModuleKey,
  ALLOWED_MODULES,
} from "@/lib/verticals";

describe("verticals registry", () => {
  it("exposes exactly the three configured verticals", () => {
    const keys = Object.keys(VERTICALS).sort();
    expect(keys).toEqual(["coaches", "ecommerce", "real_estate"]);
  });

  it("listVerticals returns all three templates", () => {
    expect(listVerticals()).toHaveLength(3);
  });

  it("getVertical returns the right template by key", () => {
    expect(getVertical("real_estate").vertical).toBe("real_estate");
    expect(getVertical("coaches").vertical).toBe("coaches");
    expect(getVertical("ecommerce").vertical).toBe("ecommerce");
  });

  it("each template has the spec'd module sizes (real_estate)", () => {
    const t = getVertical("real_estate");
    expect(t.automations.length).toBe(5);
    expect(t.sms_templates.length).toBe(10);
    expect(t.email_templates.length).toBe(5);
    expect(t.call_scripts.length).toBe(3);
    expect(t.scoring_rules.length).toBeGreaterThanOrEqual(5);
    expect(t.course.modules.length).toBe(10);
    expect(t.funnel.steps.length).toBe(5);
  });

  it("each template has the spec'd module sizes (coaches)", () => {
    const t = getVertical("coaches");
    expect(t.automations.length).toBe(5);
    expect(t.sms_templates.length).toBe(10);
    expect(t.email_templates.length).toBe(5);
    expect(t.call_scripts.length).toBe(3);
    expect(t.scoring_rules.length).toBeGreaterThanOrEqual(5);
    expect(t.course.modules.length).toBe(8);
    expect(t.funnel.steps.length).toBe(5);
  });

  it("each template has the spec'd module sizes (ecommerce)", () => {
    const t = getVertical("ecommerce");
    expect(t.automations.length).toBe(5);
    expect(t.sms_templates.length).toBe(10);
    expect(t.email_templates.length).toBe(5);
    expect(t.call_scripts.length).toBe(3);
    expect(t.scoring_rules.length).toBeGreaterThanOrEqual(5);
    expect(t.course.modules.length).toBe(10);
    expect(t.funnel.steps.length).toBe(5);
  });

  it("countVertical sums module sizes correctly", () => {
    const t = getVertical("real_estate");
    const counts = countVertical(t);
    expect(counts.automations).toBe(t.automations.length);
    expect(counts.sms).toBe(t.sms_templates.length);
    expect(counts.email).toBe(t.email_templates.length);
    expect(counts.scripts).toBe(t.call_scripts.length);
    expect(counts.scoring).toBe(t.scoring_rules.length);
    expect(counts.course_modules).toBe(t.course.modules.length);
    expect(counts.funnel_steps).toBe(t.funnel.steps.length);
    // course_lessons = sum of lessons across modules
    const expectedLessons = t.course.modules.reduce((s, m) => s + m.lessons.length, 0);
    expect(counts.course_lessons).toBe(expectedLessons);
  });

  it("course modules each have at least 1 lesson", () => {
    for (const v of listVerticals()) {
      for (const m of v.course.modules) {
        expect(m.lessons.length).toBeGreaterThanOrEqual(1);
      }
    }
  });

  it("scoring rules use only the four valid dimensions", () => {
    const allowed = new Set(["fit", "intent", "urgency", "data_quality"]);
    for (const v of listVerticals()) {
      for (const r of v.scoring_rules) {
        expect(allowed.has(r.dimension)).toBe(true);
      }
    }
  });

  it("automations all have a non-empty actions array", () => {
    for (const v of listVerticals()) {
      for (const a of v.automations) {
        expect(a.actions.length).toBeGreaterThanOrEqual(1);
      }
    }
  });

  it("email templates have non-empty subject + body", () => {
    for (const v of listVerticals()) {
      for (const e of v.email_templates) {
        expect(e.subject.length).toBeGreaterThan(0);
        expect(e.body.length).toBeGreaterThan(0);
      }
    }
  });

  it("sms templates stay under common 1600-char carrier limit", () => {
    // SMS bodies sometimes get long with personalization. Keep them under 1600
    // (the realistic concatenated-segment hard limit).
    for (const v of listVerticals()) {
      for (const s of v.sms_templates) {
        expect(s.body.length).toBeLessThanOrEqual(1600);
      }
    }
  });
});

describe("verticals type guards", () => {
  it("isVerticalKey accepts valid keys", () => {
    expect(isVerticalKey("real_estate")).toBe(true);
    expect(isVerticalKey("coaches")).toBe(true);
    expect(isVerticalKey("ecommerce")).toBe(true);
  });

  it("isVerticalKey rejects everything else", () => {
    expect(isVerticalKey("REAL_ESTATE")).toBe(false);
    expect(isVerticalKey("startups")).toBe(false);
    expect(isVerticalKey("")).toBe(false);
    expect(isVerticalKey(null)).toBe(false);
    expect(isVerticalKey(undefined)).toBe(false);
    expect(isVerticalKey(123)).toBe(false);
    expect(isVerticalKey({})).toBe(false);
  });

  it("isModuleKey accepts all spec'd modules", () => {
    for (const m of ALLOWED_MODULES) {
      expect(isModuleKey(m)).toBe(true);
    }
  });

  it("isModuleKey rejects unknown modules", () => {
    expect(isModuleKey("Automations")).toBe(false);
    expect(isModuleKey("dialers")).toBe(false);
    expect(isModuleKey("")).toBe(false);
    expect(isModuleKey(null)).toBe(false);
    expect(isModuleKey(123)).toBe(false);
  });

  it("ALLOWED_MODULES is the canonical 7 modules", () => {
    expect(ALLOWED_MODULES.slice().sort()).toEqual(
      ["automations", "course", "email", "funnel", "scoring", "scripts", "sms"].sort(),
    );
  });
});
