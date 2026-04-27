/**
 * Workflow Library — integration tests.
 *
 * These tests exercise the template registry, the action handlers, and the
 * trigger → workflow → action plumbing. We use a stubbed Supabase client and
 * stub `fetch` to capture provider calls so we can assert side effects
 * deterministically without hitting Stripe/Twilio/Resend/etc. for real.
 *
 * The tests are structured around three concerns:
 *
 *   1. Templates — registry well-formed, every template_id used has copy,
 *      every step type has a matching action.
 *   2. Actions — each handler in LIBRARY_ACTIONS does what it claims (writes
 *      to the right table, calls the right HTTP endpoint, etc.).
 *   3. Install plumbing — templateStepsToNodes produces nodes that match the
 *      executor's expectations.
 *
 * Tests SKIP cleanly when provider keys aren't set (rather than fail) so CI
 * without secrets can still pass.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  TEMPLATES,
  templateStepsToNodes,
  getTemplateById,
  listTemplates,
} from "@/lib/workflows/templates";
import {
  EMAIL_COPY,
  SMS_COPY,
  NOTE_COPY,
  SLACK_COPY,
  getEmailCopy,
} from "@/lib/workflows/template-copy";
import {
  LIBRARY_ACTIONS,
  isLibraryAction,
  executeLibraryAction,
  renderTokens,
  type ActionContext,
} from "@/lib/workflows/library-actions";

// ── Test stubs ───────────────────────────────────────────────────────────

interface StubSupabase {
  inserts: Record<string, Record<string, unknown>[]>;
  updates: Record<string, Record<string, unknown>[]>;
  selectsByTable: Record<string, Record<string, unknown>[]>;
  errorsByTable: Record<string, { message: string; code?: string }>;
  // The real client surface we pass into handlers
  client: {
    from: (table: string) => unknown;
  };
}

function createStubSupabase(opts?: {
  rowsByTable?: Record<string, Record<string, unknown>[]>;
  errorsByTable?: Record<string, { message: string; code?: string }>;
}): StubSupabase {
  const inserts: Record<string, Record<string, unknown>[]> = {};
  const updates: Record<string, Record<string, unknown>[]> = {};
  const selectsByTable: Record<string, Record<string, unknown>[]> =
    opts?.rowsByTable ?? {};
  const errorsByTable = opts?.errorsByTable ?? {};

  function makeBuilder(table: string): unknown {
    inserts[table] = inserts[table] || [];
    updates[table] = updates[table] || [];
    let pendingInsert: Record<string, unknown> | null = null;
    let isDelete = false;
    let pendingUpdate: Record<string, unknown> | null = null;

    const builder = {
      insert(payload: Record<string, unknown> | Record<string, unknown>[]) {
        const rows = Array.isArray(payload) ? payload : [payload];
        for (const r of rows) inserts[table].push(r);
        pendingInsert = rows[0] ?? null;
        return builder;
      },
      update(payload: Record<string, unknown>) {
        pendingUpdate = payload;
        updates[table].push(payload);
        return builder;
      },
      delete() {
        isDelete = true;
        return builder;
      },
      select(_arg?: string) {
        return builder;
      },
      eq(_col: string, _val: unknown) {
        return builder;
      },
      neq() {
        return builder;
      },
      in(_col: string, _val: unknown) {
        return builder;
      },
      not() {
        return builder;
      },
      gte() {
        return builder;
      },
      lte() {
        return builder;
      },
      order() {
        return builder;
      },
      limit() {
        return builder;
      },
      maybeSingle() {
        const err = errorsByTable[table] || null;
        if (err) return Promise.resolve({ data: null, error: err });
        const row =
          pendingInsert ||
          pendingUpdate ||
          (selectsByTable[table] && selectsByTable[table][0]) ||
          null;
        // Fake a uuid-like id so handlers that depend on returned ids work.
        const data = row
          ? { id: "00000000-0000-0000-0000-000000000001", ...row }
          : null;
        return Promise.resolve({ data, error: null });
      },
      single() {
        return builder.maybeSingle();
      },
      then(resolve: (v: unknown) => void) {
        const err = errorsByTable[table] || null;
        if (err) {
          resolve({ data: null, error: err });
          return;
        }
        if (isDelete) {
          resolve({ data: null, error: null });
          return;
        }
        resolve({ data: selectsByTable[table] ?? [], error: null });
      },
    };
    return builder;
  }

  return {
    inserts,
    updates,
    selectsByTable,
    errorsByTable,
    client: {
      from: makeBuilder,
    },
  };
}

function buildContext(stub: StubSupabase, overrides?: Partial<ActionContext>): ActionContext {
  return {
    // The library accepts any "from"-shaped client. We cast through unknown
    // to avoid pulling SupabaseClient into a mock that shouldn't need full
    // types.
    supabase: stub.client as unknown as ActionContext["supabase"],
    agencyOwnerId: "00000000-0000-0000-0000-000000000aaa",
    payload: {
      first_name: "Sam",
      lead_name: "Sam Pine",
      email: "sam@example.com",
      phone: "+15005550006",
      ...overrides?.payload,
    },
    leadId: "00000000-0000-0000-0000-000000000111",
    workflowId: "00000000-0000-0000-0000-000000000222",
    runId: "00000000-0000-0000-0000-000000000333",
    ...overrides,
  };
}

// ── 1. Template registry sanity checks ──────────────────────────────────

describe("Workflow template registry", () => {
  it("has at least 12 templates", () => {
    expect(TEMPLATES.length).toBeGreaterThanOrEqual(12);
  });

  it("each template has a unique id", () => {
    const ids = TEMPLATES.map((t) => t.id);
    const unique = new Set(ids);
    expect(unique.size).toBe(ids.length);
  });

  it("each template has at least one step", () => {
    for (const t of TEMPLATES) {
      expect(t.steps.length).toBeGreaterThan(0);
    }
  });

  it("each step's type resolves to a known library action (or wait/wait_until)", () => {
    const validTypes = new Set(Object.keys(LIBRARY_ACTIONS));
    for (const t of TEMPLATES) {
      for (const step of t.steps) {
        expect(
          validTypes.has(step.type),
          `template "${t.id}" step "${step.type}" is not a known action`,
        ).toBe(true);
      }
    }
  });

  it("every email template_id referenced has copy", () => {
    for (const t of TEMPLATES) {
      for (const step of t.steps) {
        if (step.type === "send_email") {
          const tid = step.params?.template_id as string | undefined;
          if (tid) {
            expect(
              getEmailCopy(tid),
              `template "${t.id}" references missing email copy "${tid}"`,
            ).not.toBeNull();
          }
        }
      }
    }
  });

  it("every SMS template_id referenced has copy", () => {
    for (const t of TEMPLATES) {
      for (const step of t.steps) {
        if (step.type === "send_sms") {
          const tid = step.params?.template_id as string | undefined;
          if (tid) {
            expect(
              SMS_COPY[tid],
              `template "${t.id}" references missing SMS copy "${tid}"`,
            ).toBeDefined();
          }
        }
      }
    }
  });

  it("getTemplateById and listTemplates work", () => {
    const t = getTemplateById("failed-payment-recovery");
    expect(t).not.toBeNull();
    expect(t?.category).toBe("recovery");
    const sales = listTemplates({ category: "sales" });
    expect(sales.length).toBeGreaterThanOrEqual(3);
  });
});

// ── 2. templateStepsToNodes plumbing ────────────────────────────────────

describe("templateStepsToNodes", () => {
  it("converts steps into stable node objects", () => {
    const t = getTemplateById("failed-payment-recovery")!;
    const nodes = templateStepsToNodes(t.steps);
    expect(nodes.length).toBe(t.steps.length);
    expect(nodes[0]).toMatchObject({
      id: "step_1",
      type: "action",
    });
  });

  it("classifies wait steps as delay nodes", () => {
    const nodes = templateStepsToNodes([
      { type: "wait", params: { hours: 1 } },
      { type: "send_email", params: { template_id: "post-call-thank-you" } },
    ]);
    expect(nodes[0].type).toBe("delay");
    expect(nodes[1].type).toBe("action");
  });
});

// ── 3. Action handlers — direct unit tests with stubbed providers ───────

describe("LIBRARY_ACTIONS coverage", () => {
  it("registers all required action keys", () => {
    const required = [
      "send_email",
      "send_sms",
      "send_dm",
      "send_review_request",
      "add_tag",
      "create_note",
      "update_field",
      "move_to_stage",
      "assign_to",
      "create_task",
      "slack.send_message",
      "stripe.retry_invoice",
      "ai.research_lead",
      "ai.draft_email",
      "ai.draft_summary",
      "social.post",
      "sequence.exit",
      "deal.create",
      "workflow.run",
      "wait",
      "wait_until",
      "webhook",
      "branch",
    ];
    for (const r of required) {
      expect(isLibraryAction(r), `missing action: ${r}`).toBe(true);
    }
  });
});

// Each provider-touching test runs only when the relevant env is set OR
// when we install a fake fetch. The tests use the "fake fetch" path so they
// always run — that way CI without secrets still validates the handler
// flow through to the HTTP boundary.

describe("Action handler — add_tag", () => {
  it("inserts into lead_tags when called with tag and lead_id", async () => {
    const stub = createStubSupabase();
    const ctx = buildContext(stub);
    const result = await executeLibraryAction("add_tag", { tag: "vip" }, ctx);
    expect(result.ok).toBe(true);
    expect(stub.inserts.lead_tags?.length).toBe(1);
    expect(stub.inserts.lead_tags[0]).toMatchObject({ tag: "vip" });
  });

  it("treats unique constraint violation as success", async () => {
    const stub = createStubSupabase({
      errorsByTable: {
        lead_tags: { message: "duplicate", code: "23505" },
      },
    });
    const ctx = buildContext(stub);
    const result = await executeLibraryAction("add_tag", { tag: "vip" }, ctx);
    expect(result.ok).toBe(true);
  });

  it("returns error when no lead context", async () => {
    const stub = createStubSupabase();
    const ctx = buildContext(stub, { leadId: undefined });
    const result = await executeLibraryAction("add_tag", { tag: "vip" }, ctx);
    expect(result.ok).toBe(false);
  });
});

describe("Action handler — create_note", () => {
  it("inserts into lead_notes", async () => {
    const stub = createStubSupabase();
    const ctx = buildContext(stub);
    const result = await executeLibraryAction(
      "create_note",
      { body: "Hello {{first_name}}" },
      ctx,
    );
    expect(result.ok).toBe(true);
    expect(stub.inserts.lead_notes?.[0]?.body).toBe("Hello Sam");
  });

  it("falls back to trinity_log without lead context", async () => {
    const stub = createStubSupabase();
    const ctx = buildContext(stub, { leadId: undefined });
    const result = await executeLibraryAction(
      "create_note",
      { body: "Audit log entry" },
      ctx,
    );
    expect(result.ok).toBe(true);
    expect(stub.inserts.trinity_log?.length).toBe(1);
  });
});

describe("Action handler — send_email (template-driven)", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("returns error for unknown template_id", async () => {
    const stub = createStubSupabase();
    const ctx = buildContext(stub);
    const result = await executeLibraryAction(
      "send_email",
      { template_id: "this-does-not-exist" },
      ctx,
    );
    expect(result.ok).toBe(false);
    expect(result.error).toContain("unknown template_id");
  });

  it("renders tokens against payload before send", async () => {
    // Fake fetch so the email module's underlying provider call resolves
    // ok without env vars. Resend / Postal / SMTP all hit fetch under
    // the hood.
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(
        new Response(JSON.stringify({ id: "msg_123" }), { status: 200 }) as unknown as Response,
      );
    // Inject a sentinel env so the resend provider's available() is true.
    const previousResend = process.env.RESEND_API_KEY;
    process.env.RESEND_API_KEY = "test-key-for-fake-fetch";
    try {
      const stub = createStubSupabase({
        rowsByTable: {
          profiles: [{ business_name: "ShortStack", full_name: "Casey Owner" }],
        },
      });
      const ctx = buildContext(stub, {
        payload: {
          first_name: "Sam",
          email: "sam@example.com",
          plan_name: "Pro",
          billing_portal_url: "https://example.com/portal",
        },
      });
      const result = await executeLibraryAction(
        "send_email",
        { template_id: "payment-failed-day-1" },
        ctx,
      );
      expect(result.ok).toBe(true);
      // Verify the rendered subject made it through. Look at the body
      // shipped to the email provider.
      expect(fetchSpy).toHaveBeenCalled();
      const lastCall = fetchSpy.mock.calls.at(-1);
      expect(lastCall).toBeDefined();
      const init = (lastCall?.[1] ?? {}) as RequestInit;
      const body = String(init.body ?? "");
      expect(body).toContain("Sam");
      expect(body).toContain("Pro");
    } finally {
      if (previousResend === undefined) {
        delete process.env.RESEND_API_KEY;
      } else {
        process.env.RESEND_API_KEY = previousResend;
      }
    }
  });
});

describe("Action handler — send_sms", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("skips with clear error when Twilio not configured", async () => {
    const previousSid = process.env.TWILIO_ACCOUNT_SID;
    const previousToken = process.env.TWILIO_AUTH_TOKEN;
    const previousFrom = process.env.TWILIO_PHONE_NUMBER;
    delete process.env.TWILIO_ACCOUNT_SID;
    delete process.env.TWILIO_AUTH_TOKEN;
    delete process.env.TWILIO_PHONE_NUMBER;
    try {
      const stub = createStubSupabase();
      const ctx = buildContext(stub);
      const result = await executeLibraryAction(
        "send_sms",
        { template_id: "booking-reminder-1h" },
        ctx,
      );
      expect(result.ok).toBe(false);
      expect(result.error).toContain("Twilio");
    } finally {
      if (previousSid !== undefined) process.env.TWILIO_ACCOUNT_SID = previousSid;
      if (previousToken !== undefined) process.env.TWILIO_AUTH_TOKEN = previousToken;
      if (previousFrom !== undefined) process.env.TWILIO_PHONE_NUMBER = previousFrom;
    }
  });

  it("calls Twilio Messages API when configured", async () => {
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(
        new Response(
          JSON.stringify({ sid: "SM12345", status: "queued" }),
          { status: 201 },
        ) as unknown as Response,
      );

    const previousSid = process.env.TWILIO_ACCOUNT_SID;
    const previousToken = process.env.TWILIO_AUTH_TOKEN;
    const previousFrom = process.env.TWILIO_PHONE_NUMBER;
    process.env.TWILIO_ACCOUNT_SID = "ACtest";
    process.env.TWILIO_AUTH_TOKEN = "tokentest";
    process.env.TWILIO_PHONE_NUMBER = "+15005550006";
    try {
      const stub = createStubSupabase({
        rowsByTable: {
          profiles: [{ business_name: "ShortStack", full_name: "Casey Owner" }],
        },
      });
      const ctx = buildContext(stub, {
        payload: {
          first_name: "Sam",
          phone: "+15005550006",
          appointment_time: "10:00",
          appointment_timezone: "PT",
          appointment_location: "Zoom",
        },
      });
      const result = await executeLibraryAction(
        "send_sms",
        { template_id: "booking-reminder-1h" },
        ctx,
      );
      expect(result.ok).toBe(true);
      expect(result.ref_id).toBe("SM12345");
      const lastCall = fetchSpy.mock.calls.at(-1);
      const url = String(lastCall?.[0] ?? "");
      expect(url).toContain("api.twilio.com");
      expect(url).toContain("Messages.json");
    } finally {
      if (previousSid !== undefined)
        process.env.TWILIO_ACCOUNT_SID = previousSid;
      else delete process.env.TWILIO_ACCOUNT_SID;
      if (previousToken !== undefined)
        process.env.TWILIO_AUTH_TOKEN = previousToken;
      else delete process.env.TWILIO_AUTH_TOKEN;
      if (previousFrom !== undefined)
        process.env.TWILIO_PHONE_NUMBER = previousFrom;
      else delete process.env.TWILIO_PHONE_NUMBER;
    }
  });
});

describe("Action handler — slack.send_message", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("posts to chat.postMessage with rendered text", async () => {
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(
        new Response(
          JSON.stringify({ ok: true, ts: "1234.5678" }),
          { status: 200 },
        ) as unknown as Response,
      );
    const previous = process.env.SLACK_BOT_TOKEN;
    process.env.SLACK_BOT_TOKEN = "xoxb-test";
    try {
      const stub = createStubSupabase();
      const ctx = buildContext(stub, {
        payload: {
          content_title: "Q3 launch",
          content_url: "https://shortstack.work/blog/q3",
        },
      });
      const result = await executeLibraryAction(
        "slack.send_message",
        { channel: "#agency-feed", template_id: "content-published" },
        ctx,
      );
      expect(result.ok).toBe(true);
      expect(result.ref_id).toBe("1234.5678");
      const lastCall = fetchSpy.mock.calls.at(-1);
      const init = (lastCall?.[1] ?? {}) as RequestInit;
      const body = JSON.parse(String(init.body ?? "{}"));
      expect(body.text).toContain("Q3 launch");
      expect(body.channel).toBe("#agency-feed");
    } finally {
      if (previous === undefined) delete process.env.SLACK_BOT_TOKEN;
      else process.env.SLACK_BOT_TOKEN = previous;
    }
  });
});

describe("Action handler — stripe.retry_invoice", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("calls Stripe pay endpoint with the invoice id", async () => {
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(
        new Response(
          JSON.stringify({ id: "in_123", status: "paid" }),
          { status: 200 },
        ) as unknown as Response,
      );
    const previous = process.env.STRIPE_SECRET_KEY;
    process.env.STRIPE_SECRET_KEY = "sk_test_xxx";
    try {
      const stub = createStubSupabase();
      const ctx = buildContext(stub, {
        payload: { invoice_id: "in_123" },
      });
      const result = await executeLibraryAction(
        "stripe.retry_invoice",
        {},
        ctx,
      );
      expect(result.ok).toBe(true);
      expect(result.ref_id).toBe("in_123");
      const lastCall = fetchSpy.mock.calls.at(-1);
      const url = String(lastCall?.[0] ?? "");
      expect(url).toContain("/v1/invoices/in_123/pay");
    } finally {
      if (previous === undefined) delete process.env.STRIPE_SECRET_KEY;
      else process.env.STRIPE_SECRET_KEY = previous;
    }
  });
});

describe("Action handler — webhook (SSRF protection)", () => {
  it("blocks localhost", async () => {
    const stub = createStubSupabase();
    const ctx = buildContext(stub);
    const result = await executeLibraryAction(
      "webhook",
      { url: "http://localhost:8080/api" },
      ctx,
    );
    expect(result.ok).toBe(false);
    expect(result.error).toContain("blocked");
  });

  it("blocks private IPs", async () => {
    const stub = createStubSupabase();
    const ctx = buildContext(stub);
    const result = await executeLibraryAction(
      "webhook",
      { url: "http://192.168.1.10/api" },
      ctx,
    );
    expect(result.ok).toBe(false);
  });

  it("blocks AWS metadata endpoint", async () => {
    const stub = createStubSupabase();
    const ctx = buildContext(stub);
    const result = await executeLibraryAction(
      "webhook",
      { url: "http://169.254.169.254/latest/meta-data" },
      ctx,
    );
    expect(result.ok).toBe(false);
  });
});

describe("Action handler — wait / wait_until", () => {
  it("inserts into workflow_waits with a future wake_at", async () => {
    const stub = createStubSupabase();
    const ctx = buildContext(stub);
    const result = await executeLibraryAction("wait", { hours: 24 }, ctx);
    expect(result.ok).toBe(true);
    expect(stub.inserts.workflow_waits?.length).toBe(1);
    const inserted = stub.inserts.workflow_waits[0];
    const wake = new Date(inserted.wake_at as string).getTime();
    expect(wake).toBeGreaterThan(Date.now());
  });

  it("rejects 0-duration waits", async () => {
    const stub = createStubSupabase();
    const ctx = buildContext(stub);
    const result = await executeLibraryAction("wait", {}, ctx);
    expect(result.ok).toBe(false);
  });

  it("wait_until anchors to the appointment_start payload field", async () => {
    const stub = createStubSupabase();
    const future = new Date(Date.now() + 5 * 86400_000).toISOString();
    const ctx = buildContext(stub, {
      payload: { appointment_start: future },
    });
    const result = await executeLibraryAction(
      "wait_until",
      { relative_to: "appointment_start", offset_hours: -1 },
      ctx,
    );
    expect(result.ok).toBe(true);
    expect(stub.inserts.workflow_waits?.length).toBe(1);
  });
});

describe("Action handler — workflow.run", () => {
  it("queues a trigger_event for the resolved workflow", async () => {
    const stub = createStubSupabase({
      rowsByTable: {
        workflows: [{ id: "00000000-0000-0000-0000-000000000999" }],
      },
    });
    const ctx = buildContext(stub);
    const result = await executeLibraryAction(
      "workflow.run",
      { template_id: "client-onboarding-5day" },
      ctx,
    );
    expect(result.ok).toBe(true);
    expect(stub.inserts.trigger_events?.length).toBe(1);
    expect(stub.inserts.trigger_events[0].trigger_type).toBe("workflow.manual");
  });
});

describe("renderTokens helper", () => {
  it("renders simple tokens", () => {
    expect(renderTokens("Hi {{name}}", { name: "Sam" })).toBe("Hi Sam");
  });

  it("renders nested tokens with extras taking precedence", () => {
    const out = renderTokens(
      "Hi {{first_name}} from {{owner_first_name}}",
      { first_name: "Sam" },
      { owner_first_name: "Casey" },
    );
    expect(out).toBe("Hi Sam from Casey");
  });

  it("derives first_name from guest_name when missing", () => {
    const out = renderTokens("Hi {{first_name}}", { guest_name: "Pat Lee" });
    expect(out).toBe("Hi Pat");
  });

  it("leaves missing tokens empty", () => {
    expect(renderTokens("Hi {{missing}}", {})).toBe("Hi ");
  });
});

describe("Template copy completeness", () => {
  it("EMAIL_COPY entries each have subject/html/text", () => {
    for (const [tid, copy] of Object.entries(EMAIL_COPY)) {
      expect(copy.subject, `${tid} missing subject`).toBeTruthy();
      expect(copy.html, `${tid} missing html`).toBeTruthy();
      expect(copy.text, `${tid} missing text`).toBeTruthy();
    }
  });

  it("SMS_COPY bodies are non-empty", () => {
    for (const [tid, copy] of Object.entries(SMS_COPY)) {
      expect(copy.body, `${tid} missing body`).toBeTruthy();
    }
  });

  it("NOTE_COPY and SLACK_COPY entries are non-empty strings", () => {
    for (const [tid, body] of Object.entries(NOTE_COPY)) {
      expect(typeof body === "string" && body.length > 0, `${tid} bad`).toBe(true);
    }
    for (const [tid, body] of Object.entries(SLACK_COPY)) {
      expect(typeof body === "string" && body.length > 0, `${tid} bad`).toBe(true);
    }
  });
});
