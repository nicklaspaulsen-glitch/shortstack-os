import { describe, it, expect, vi, beforeEach } from "vitest";
import { getWhiteboardSnapshot } from "@/lib/workspace/aggregator";

/**
 * The aggregator's contract is "never throw, gracefully degrade." We can
 * verify that by stubbing the supabase client surface area and forcing
 * specific table queries to throw / error — the snapshot should still
 * resolve, with the affected lane reporting "degraded" and an empty list.
 */

interface BuilderOptions {
  /** Tables that should reject with a thrown error (simulates table-missing). */
  failTables?: string[];
  /** Tables that should resolve with an explicit error envelope (simulates RLS deny). */
  errorTables?: string[];
  /** Tables that should resolve with rows. */
  rows?: Record<string, unknown[]>;
}

function buildSupabaseStub(opts: BuilderOptions) {
  const failSet = new Set(opts.failTables ?? []);
  const errSet = new Set(opts.errorTables ?? []);
  const rowsByTable = opts.rows ?? {};

  function makeBuilder(table: string): unknown {
    const rows = rowsByTable[table] ?? [];
    const thenable = {
      then(resolve: (v: unknown) => void) {
        if (failSet.has(table)) {
          throw new Error(`relation "${table}" does not exist`);
        }
        if (errSet.has(table)) {
          resolve({ data: null, error: { message: `RLS denied: ${table}` } });
          return;
        }
        resolve({ data: rows, error: null });
      },
    };
    const builder: Record<string, (...args: unknown[]) => unknown> = {};
    const chainable = ["select", "eq", "in", "not", "gte", "lte", "order", "limit"];
    for (let i = 0; i < chainable.length; i += 1) {
      builder[chainable[i]] = () => builder;
    }
    return Object.assign(builder, thenable);
  }

  return {
    from(table: string) {
      return makeBuilder(table);
    },
  };
}

describe("workspace whiteboard aggregator", () => {
  beforeEach(() => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("never throws when every backing table fails", async () => {
    const supabase = buildSupabaseStub({
      failTables: [
        "clients",
        "workspace_presence",
        "workspace_tasks",
        "video_projects",
        "content_calendar",
        "deals",
      ],
    });
    const snap = await getWhiteboardSnapshot(supabase as never, "agency-123");
    expect(snap.active_users).toEqual([]);
    expect(snap.tasks_by_status).toBeNull();
    expect(snap.active_renders).toEqual([]);
    expect(snap.scheduled_publishes).toEqual([]);
    expect(snap.open_deals).toEqual([]);
    expect(snap.recent_activity).toEqual([]);
    expect(snap.source_health.workspace_tasks).toBe("degraded");
    expect(snap.source_health.deals).toBe("degraded");
  });

  it("degrades only the missing lane when other tables work", async () => {
    const supabase = buildSupabaseStub({
      failTables: ["workspace_tasks"],
      rows: {
        clients: [{ id: "c1", business_name: "Acme Co" }],
        workspace_presence: [],
        video_projects: [],
        content_calendar: [],
        deals: [],
      },
    });
    const snap = await getWhiteboardSnapshot(supabase as never, "agency-123");
    expect(snap.tasks_by_status).toBeNull();
    expect(snap.source_health.workspace_tasks).toBe("degraded");
    expect(snap.source_health.clients).toBe("ok");
    expect(snap.source_health.deals).toBe("ok");
    // The "Acme Co" lane should still appear seeded from the clients query.
    expect(snap.by_client["c1"]?.client_name).toBe("Acme Co");
  });

  it("groups items into client lanes correctly", async () => {
    const supabase = buildSupabaseStub({
      rows: {
        clients: [
          { id: "c1", business_name: "Acme Co" },
          { id: "c2", business_name: "Globex" },
        ],
        workspace_presence: [],
        workspace_tasks: [
          {
            id: "t1",
            title: "Edit hero video",
            status: "in_progress",
            due_at: null,
            client_id: "c1",
            updated_at: new Date().toISOString(),
          },
        ],
        video_projects: [],
        content_calendar: [],
        deals: [],
      },
    });
    const snap = await getWhiteboardSnapshot(supabase as never, "agency-123");
    expect(snap.tasks_by_status?.in_progress).toHaveLength(1);
    expect(snap.by_client["c1"].items).toHaveLength(1);
    expect(snap.by_client["c2"].items).toHaveLength(0);
  });
});
