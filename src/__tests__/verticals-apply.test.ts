import { describe, it, expect, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { applyVerticalModules } from "@/lib/verticals/apply";
import { getVertical } from "@/lib/verticals";

/**
 * Minimal supabase mock — captures inserts so we can assert on them.
 *
 * We only implement the chain methods our apply engine calls:
 *   .from(table).insert(rows).select(...)
 *   .from("profiles").select("metadata").eq("id", x).single()
 *   .from("profiles").update(meta).eq("id", x)
 *
 * Each insert returns N stub rows (via _seed) so the engine can count.
 */
function buildSupabaseMock(opts: {
  failingTables?: Set<string>;
  existingMeta?: Record<string, unknown>;
} = {}) {
  const failing = opts.failingTables ?? new Set<string>();
  const inserts: Record<string, unknown[][]> = {};
  let metaUpdated: Record<string, unknown> | null = null;

  // The chain object is intentionally `any` — Supabase's fluent query
  // builder is wide and recursive; faithfully typing it here would dwarf
  // the test value. We control all callers via the apply engine.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const builder = (table: string): any => {
    const state = {
      table,
      filters: [] as Array<{ col: string; val: unknown }>,
      lastInsertedRows: [] as unknown[],
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const chain: any = {};

    chain.insert = (rows: unknown[] | unknown) => {
      const arr = Array.isArray(rows) ? rows : [rows];
      state.lastInsertedRows = arr;
      if (!inserts[table]) inserts[table] = [];
      inserts[table].push(arr);
      return chain;
    };

    chain.update = (patch: unknown) => {
      if (table === "profiles" && patch && typeof patch === "object") {
        metaUpdated = (patch as { metadata?: Record<string, unknown> }).metadata ?? null;
      }
      return chain;
    };

    chain.select = (_cols?: string) => chain;

    chain.eq = (col: string, val: unknown) => {
      state.filters.push({ col, val });
      return chain;
    };

    chain.single = () => {
      if (table === "profiles") {
        return Promise.resolve({
          data: { metadata: opts.existingMeta ?? {} },
          error: null,
        });
      }
      if (failing.has(table)) {
        return Promise.resolve({ data: null, error: { message: `${table} insert failed` } });
      }
      const row = state.lastInsertedRows[0] ?? {};
      return Promise.resolve({
        data: { id: `${table}-id-1`, ...(row as Record<string, unknown>) },
        error: null,
      });
    };

    // Inserts without .single() are awaited directly. The thenable
    // implementation lets `await chain` resolve the response object.
    chain.then = (
      resolve: (value: { data: unknown; error: unknown }) => unknown,
    ) => {
      if (failing.has(table)) {
        return resolve({ data: null, error: { message: `${table} insert failed` } });
      }
      const data = state.lastInsertedRows.map((r, i) => ({
        id: `${table}-id-${i + 1}`,
        ...(r as Record<string, unknown>),
      }));
      return resolve({ data, error: null });
    };

    return chain;
  };

  const supabase = {
    from: vi.fn(builder),
  } as unknown as SupabaseClient;

  return {
    supabase,
    inserts,
    getMetaUpdate: () => metaUpdated,
  };
}

describe("applyVerticalModules", () => {
  const userId = "user-uuid-123";

  it("creates rows for each requested module (real_estate, all modules)", async () => {
    const { supabase, inserts } = buildSupabaseMock();
    const template = getVertical("real_estate");

    const result = await applyVerticalModules(supabase, userId, template, [
      "automations",
      "sms",
      "email",
      "scripts",
      "scoring",
      "course",
      "funnel",
    ]);

    // No outright failures
    const failed = result.outcomes.filter((o) => o.status === "failed");
    expect(failed).toEqual([]);

    // automations
    expect(inserts.crm_automations).toBeDefined();
    // crm_automations gets called for automations + email + scripts
    const automationRowCount = (inserts.crm_automations ?? []).reduce(
      (acc, batch) => acc + batch.length,
      0,
    );
    expect(automationRowCount).toBe(
      template.automations.length + template.email_templates.length + template.call_scripts.length,
    );

    // sms_templates
    expect(inserts.sms_templates).toBeDefined();
    expect((inserts.sms_templates ?? [])[0].length).toBe(template.sms_templates.length);

    // courses table
    expect(inserts.courses).toBeDefined();
    expect((inserts.courses ?? [])[0].length).toBe(1);

    // course_modules and course_lessons inserted per module
    expect(inserts.course_modules).toBeDefined();
    expect((inserts.course_modules ?? []).length).toBe(template.course.modules.length);
    expect(inserts.course_lessons).toBeDefined();

    // funnels + funnel_steps
    expect(inserts.funnels).toBeDefined();
    expect((inserts.funnels ?? [])[0].length).toBe(1);
    expect(inserts.funnel_steps).toBeDefined();
    expect((inserts.funnel_steps ?? [])[0].length).toBe(template.funnel.steps.length);
  });

  it("scoring writes to profiles.metadata.lead_scoring_rules", async () => {
    const { supabase, getMetaUpdate } = buildSupabaseMock();
    const template = getVertical("coaches");

    const result = await applyVerticalModules(supabase, userId, template, ["scoring"]);

    expect(result.outcomes[0].status).toBe("success");
    const meta = getMetaUpdate();
    expect(meta).toBeTruthy();
    expect(Array.isArray((meta as { lead_scoring_rules?: unknown[] }).lead_scoring_rules)).toBe(true);
    expect((meta as { lead_scoring_rules: unknown[] }).lead_scoring_rules.length).toBe(
      template.scoring_rules.length,
    );
  });

  it("scoring de-dupes against existing rules in profiles.metadata", async () => {
    const template = getVertical("real_estate");
    // Pre-seed metadata with one rule already applied — should not be duplicated.
    const existing = {
      lead_scoring_rules: [{ name: template.scoring_rules[0].name, signal: "x", score_delta: 1, dimension: "fit" }],
    };
    const { supabase, getMetaUpdate } = buildSupabaseMock({ existingMeta: existing });

    const result = await applyVerticalModules(supabase, userId, template, ["scoring"]);

    expect(result.outcomes[0].status).toBe("success");
    // Newly added rules = total - 1 (the pre-existing one)
    expect(result.outcomes[0].count).toBe(template.scoring_rules.length - 1);

    const meta = getMetaUpdate() as { lead_scoring_rules: unknown[] };
    // Final list = template count (since one was already there, we add the rest)
    expect(meta.lead_scoring_rules.length).toBe(template.scoring_rules.length);
  });

  it("returns per-module failure when an insert fails — other modules still run", async () => {
    const { supabase } = buildSupabaseMock({ failingTables: new Set(["sms_templates"]) });
    const template = getVertical("ecommerce");

    const result = await applyVerticalModules(supabase, userId, template, ["sms", "automations"]);

    const sms = result.outcomes.find((o) => o.module === "sms");
    const automations = result.outcomes.find((o) => o.module === "automations");
    expect(sms?.status).toBe("failed");
    expect(automations?.status).toBe("success");
  });

  it("only applies the requested modules", async () => {
    const { supabase, inserts } = buildSupabaseMock();
    const template = getVertical("real_estate");

    await applyVerticalModules(supabase, userId, template, ["sms"]);

    expect(inserts.sms_templates).toBeDefined();
    expect(inserts.crm_automations).toBeUndefined();
    expect(inserts.courses).toBeUndefined();
    expect(inserts.funnels).toBeUndefined();
  });

  it("skips course module if course has no modules (defensive)", async () => {
    const { supabase, inserts } = buildSupabaseMock();
    const template = {
      ...getVertical("real_estate"),
      course: { title: "x", description: "y", modules: [] },
    };

    const result = await applyVerticalModules(supabase, userId, template, ["course"]);
    expect(result.outcomes[0].status).toBe("skipped");
    expect(inserts.courses).toBeUndefined();
  });

  it("skips funnel module if no steps (defensive)", async () => {
    const { supabase, inserts } = buildSupabaseMock();
    const template = {
      ...getVertical("ecommerce"),
      funnel: { name: "x", description: "y", steps: [] },
    };

    const result = await applyVerticalModules(supabase, userId, template, ["funnel"]);
    expect(result.outcomes[0].status).toBe("skipped");
    expect(inserts.funnels).toBeUndefined();
  });

  it("total_created sums across modules", async () => {
    const { supabase } = buildSupabaseMock();
    const template = getVertical("coaches");

    const result = await applyVerticalModules(supabase, userId, template, [
      "automations",
      "sms",
      "email",
    ]);

    // Sum of successful module counts
    const sum = result.outcomes
      .filter((o) => o.status === "success")
      .reduce((acc, o) => acc + o.count, 0);
    expect(result.total_created).toBe(sum);
  });
});
