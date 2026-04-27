import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Workspace Whiteboard aggregator
 *
 * Reads from a handful of existing agency-scoped tables and builds a
 * single snapshot for the live "production board." Designed to NEVER
 * 500 — every per-table query is wrapped in try/catch so a missing
 * column or table on a lagging branch silently degrades the affected
 * lane instead of bringing the whole page down.
 *
 * Returned shape is deliberately broad: lanes that fail come back as
 * empty arrays / null rather than throwing.
 */

const PRESENCE_FRESH_WINDOW_MS = 5 * 60 * 1000; // 5 minutes
const RECENT_ACTIVITY_LIMIT = 50;

export interface PresenceRow {
  id: string;
  profile_id: string;
  surface: string;
  context: Record<string, unknown>;
  last_seen_at: string;
  profile?: {
    id: string;
    full_name: string | null;
    avatar_url: string | null;
    email?: string | null;
  } | null;
}

export type WhiteboardItemKind =
  | "task"
  | "video_render"
  | "scheduled_publish"
  | "deal";

export interface WhiteboardItem {
  id: string;
  kind: WhiteboardItemKind;
  client_id: string | null;
  client_name: string | null;
  title: string;
  status: string | null;
  due_at: string | null;
  url?: string | null;
  meta?: Record<string, unknown>;
}

export interface TasksByStatus {
  backlog: WhiteboardItem[];
  in_progress: WhiteboardItem[];
  review: WhiteboardItem[];
  done: WhiteboardItem[];
}

export interface RenderRow {
  id: string;
  client_id: string | null;
  client_name: string | null;
  title: string | null;
  render_status: string | null;
  updated_at: string;
}

export interface ScheduledRow {
  id: string;
  client_id: string | null;
  client_name: string | null;
  title: string;
  platform: string | null;
  scheduled_at: string | null;
  status: string | null;
  live_url: string | null;
}

export interface DealRow {
  id: string;
  title: string;
  client_name: string;
  value: number;
  stage: string;
  probability: number;
  expected_close_date: string | null;
  updated_at: string;
}

export interface ActivityEvent {
  id: string;          // synthetic
  kind: WhiteboardItemKind;
  verb: string;        // e.g. "updated", "published", "rendering"
  object_title: string;
  client_id: string | null;
  client_name: string | null;
  actor_id: string | null;
  occurred_at: string; // ISO string
}

export interface ClientLane {
  client_id: string;
  client_name: string;
  items: WhiteboardItem[];
}

export interface WhiteboardSnapshot {
  active_users: PresenceRow[];
  tasks_by_status: TasksByStatus | null;
  active_renders: RenderRow[];
  scheduled_publishes: ScheduledRow[];
  open_deals: DealRow[];
  by_client: Record<string, ClientLane>;
  recent_activity: ActivityEvent[];
  generated_at: string;
  /**
   * Metadata about which sub-queries succeeded vs degraded. Useful for the
   * UI to show "Tasks lane unavailable" vs an actual empty state, and for
   * ops to spot stale tables in production.
   */
  source_health: Record<string, "ok" | "degraded">;
}

interface ClientLite {
  id: string;
  business_name: string | null;
}

function logSourceWarn(source: string, err: unknown): void {
  const msg = err instanceof Error ? err.message : String(err);
  // eslint-disable-next-line no-console
  console.warn(`[workspace/aggregator] ${source} not available: ${msg}`);
}

async function fetchClientLookup(
  supabase: SupabaseClient,
  agencyOwnerId: string,
): Promise<Map<string, string>> {
  const lookup = new Map<string, string>();
  try {
    const { data, error } = await supabase
      .from("clients")
      .select("id, business_name")
      .eq("profile_id", agencyOwnerId);
    if (error) throw error;
    for (const row of (data || []) as ClientLite[]) {
      lookup.set(row.id, row.business_name || "Unknown client");
    }
  } catch (err) {
    logSourceWarn("clients", err);
  }
  return lookup;
}

async function fetchActiveUsers(
  supabase: SupabaseClient,
  agencyOwnerId: string,
): Promise<{ rows: PresenceRow[]; ok: boolean }> {
  try {
    const since = new Date(Date.now() - PRESENCE_FRESH_WINDOW_MS).toISOString();
    const { data, error } = await supabase
      .from("workspace_presence")
      .select(
        "id, profile_id, surface, context, last_seen_at, profile:profiles(id, full_name, avatar_url, email)",
      )
      .eq("agency_owner_id", agencyOwnerId)
      .gte("last_seen_at", since)
      .order("last_seen_at", { ascending: false });
    if (error) throw error;
    return { rows: (data || []) as unknown as PresenceRow[], ok: true };
  } catch (err) {
    logSourceWarn("workspace_presence", err);
    return { rows: [], ok: false };
  }
}

async function fetchTasksByStatus(
  supabase: SupabaseClient,
  agencyOwnerId: string,
  clientLookup: Map<string, string>,
): Promise<{ tasks: TasksByStatus | null; flat: WhiteboardItem[]; ok: boolean }> {
  try {
    const { data, error } = await supabase
      .from("workspace_tasks")
      .select("id, title, status, due_at, client_id, agency_owner_id, updated_at")
      .eq("agency_owner_id", agencyOwnerId)
      .order("updated_at", { ascending: false })
      .limit(200);
    if (error) throw error;

    const buckets: TasksByStatus = {
      backlog: [],
      in_progress: [],
      review: [],
      done: [],
    };
    const flat: WhiteboardItem[] = [];

    for (const row of (data || []) as Array<{
      id: string;
      title: string;
      status: string | null;
      due_at: string | null;
      client_id: string | null;
      updated_at: string;
    }>) {
      const item: WhiteboardItem = {
        id: row.id,
        kind: "task",
        client_id: row.client_id,
        client_name: row.client_id ? clientLookup.get(row.client_id) ?? null : null,
        title: row.title,
        status: row.status,
        due_at: row.due_at,
      };
      flat.push(item);
      const status = (row.status || "backlog").toLowerCase();
      if (status === "in_progress" || status === "in-progress" || status === "doing") {
        buckets.in_progress.push(item);
      } else if (status === "review" || status === "in_review") {
        buckets.review.push(item);
      } else if (status === "done" || status === "completed" || status === "delivered") {
        buckets.done.push(item);
      } else {
        buckets.backlog.push(item);
      }
    }
    return { tasks: buckets, flat, ok: true };
  } catch (err) {
    logSourceWarn("workspace_tasks", err);
    return { tasks: null, flat: [], ok: false };
  }
}

async function fetchActiveRenders(
  supabase: SupabaseClient,
  agencyOwnerId: string,
  clientLookup: Map<string, string>,
): Promise<{ rows: RenderRow[]; flat: WhiteboardItem[]; ok: boolean }> {
  try {
    const { data, error } = await supabase
      .from("video_projects")
      .select("id, title, render_status, updated_at, client_id, profile_id")
      .eq("profile_id", agencyOwnerId)
      .in("render_status", ["rendering", "draft"])
      .order("updated_at", { ascending: false })
      .limit(50);
    if (error) throw error;

    const rows: RenderRow[] = [];
    const flat: WhiteboardItem[] = [];
    for (const row of (data || []) as Array<{
      id: string;
      title: string | null;
      render_status: string | null;
      updated_at: string;
      client_id: string | null;
    }>) {
      const clientName = row.client_id ? clientLookup.get(row.client_id) ?? null : null;
      const display = row.title || "Untitled video";
      rows.push({
        id: row.id,
        client_id: row.client_id,
        client_name: clientName,
        title: row.title,
        render_status: row.render_status,
        updated_at: row.updated_at,
      });
      flat.push({
        id: row.id,
        kind: "video_render",
        client_id: row.client_id,
        client_name: clientName,
        title: display,
        status: row.render_status,
        due_at: null,
      });
    }
    return { rows, flat, ok: true };
  } catch (err) {
    logSourceWarn("video_projects", err);
    return { rows: [], flat: [], ok: false };
  }
}

async function fetchScheduledPublishes(
  supabase: SupabaseClient,
  agencyOwnerId: string,
  clientLookup: Map<string, string>,
): Promise<{ rows: ScheduledRow[]; flat: WhiteboardItem[]; ok: boolean }> {
  try {
    // content_calendar is keyed off client_id (no direct profile_id column),
    // so we filter in-memory using the agency's client lookup. That's also
    // why we need the lookup populated before this call.
    const ownerClientIds = Array.from(clientLookup.keys());
    if (ownerClientIds.length === 0) {
      return { rows: [], flat: [], ok: true };
    }
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const horizon = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

    const { data, error } = await supabase
      .from("content_calendar")
      .select("id, title, platform, scheduled_at, status, live_url, client_id")
      .in("client_id", ownerClientIds)
      .gte("scheduled_at", since)
      .lte("scheduled_at", horizon)
      .order("scheduled_at", { ascending: true })
      .limit(100);
    if (error) throw error;

    const rows: ScheduledRow[] = [];
    const flat: WhiteboardItem[] = [];
    for (const row of (data || []) as Array<{
      id: string;
      title: string;
      platform: string | null;
      scheduled_at: string | null;
      status: string | null;
      live_url: string | null;
      client_id: string | null;
    }>) {
      const clientName = row.client_id ? clientLookup.get(row.client_id) ?? null : null;
      rows.push({
        id: row.id,
        client_id: row.client_id,
        client_name: clientName,
        title: row.title,
        platform: row.platform,
        scheduled_at: row.scheduled_at,
        status: row.status,
        live_url: row.live_url,
      });
      flat.push({
        id: row.id,
        kind: "scheduled_publish",
        client_id: row.client_id,
        client_name: clientName,
        title: row.title,
        status: row.status,
        due_at: row.scheduled_at,
        url: row.live_url,
        meta: { platform: row.platform },
      });
    }
    return { rows, flat, ok: true };
  } catch (err) {
    logSourceWarn("content_calendar", err);
    return { rows: [], flat: [], ok: false };
  }
}

async function fetchOpenDeals(
  supabase: SupabaseClient,
  agencyOwnerId: string,
  clientLookup: Map<string, string>,
): Promise<{ rows: DealRow[]; flat: WhiteboardItem[]; ok: boolean }> {
  try {
    const { data, error } = await supabase
      .from("deals")
      .select(
        "id, title, client_name, value, stage, probability, expected_close_date, updated_at, user_id",
      )
      .eq("user_id", agencyOwnerId)
      .not("stage", "in", "(closed_won,closed_lost)")
      .order("expected_close_date", { ascending: true, nullsFirst: false })
      .limit(50);
    if (error) throw error;

    const rows: DealRow[] = [];
    const flat: WhiteboardItem[] = [];
    for (const row of (data || []) as Array<{
      id: string;
      title: string;
      client_name: string;
      value: number;
      stage: string;
      probability: number;
      expected_close_date: string | null;
      updated_at: string;
    }>) {
      // Best-effort match: deals carry a free-text client_name that may or
      // may not align with a real `clients` row. We try to map it back so
      // the lane grouping still works when it does.
      let matchedClientId: string | null = null;
      const lookupEntries = Array.from(clientLookup.entries());
      for (let i = 0; i < lookupEntries.length; i += 1) {
        const [id, name] = lookupEntries[i];
        if (name && row.client_name && name.toLowerCase() === row.client_name.toLowerCase()) {
          matchedClientId = id;
          break;
        }
      }
      rows.push({
        id: row.id,
        title: row.title,
        client_name: row.client_name,
        value: Number(row.value) || 0,
        stage: row.stage,
        probability: row.probability,
        expected_close_date: row.expected_close_date,
        updated_at: row.updated_at,
      });
      flat.push({
        id: row.id,
        kind: "deal",
        client_id: matchedClientId,
        client_name: row.client_name,
        title: row.title,
        status: row.stage,
        due_at: row.expected_close_date,
        meta: { value: Number(row.value) || 0, probability: row.probability },
      });
    }
    return { rows, flat, ok: true };
  } catch (err) {
    logSourceWarn("deals", err);
    return { rows: [], flat: [], ok: false };
  }
}

function buildLanes(items: WhiteboardItem[], clientLookup: Map<string, string>): Record<string, ClientLane> {
  const lanes: Record<string, ClientLane> = {};
  // Seed lanes for every client that has a row in the lookup so the UI shows
  // them even when nothing's currently in flight (lets the team see the full
  // book of business at a glance instead of a partial set).
  const lookupEntries = Array.from(clientLookup.entries());
  for (let i = 0; i < lookupEntries.length; i += 1) {
    const [id, name] = lookupEntries[i];
    lanes[id] = { client_id: id, client_name: name, items: [] };
  }
  // Bucket "no-client" items (deals without a matching client, etc.) under a
  // synthetic key so they're still visible.
  const NO_CLIENT_KEY = "__unassigned__";

  for (const item of items) {
    if (item.client_id && lanes[item.client_id]) {
      lanes[item.client_id].items.push(item);
    } else {
      if (!lanes[NO_CLIENT_KEY]) {
        lanes[NO_CLIENT_KEY] = {
          client_id: NO_CLIENT_KEY,
          client_name: "Unassigned",
          items: [],
        };
      }
      lanes[NO_CLIENT_KEY].items.push(item);
    }
  }
  return lanes;
}

function buildRecentActivity(
  tasks: WhiteboardItem[],
  renders: RenderRow[],
  scheduled: ScheduledRow[],
  deals: DealRow[],
): ActivityEvent[] {
  const events: ActivityEvent[] = [];

  for (const t of tasks) {
    events.push({
      id: `task:${t.id}`,
      kind: "task",
      verb: t.status === "done" ? "completed" : "updated",
      object_title: t.title,
      client_id: t.client_id,
      client_name: t.client_name,
      actor_id: null,
      occurred_at: t.due_at || new Date().toISOString(),
    });
  }
  for (const r of renders) {
    events.push({
      id: `render:${r.id}`,
      kind: "video_render",
      verb: r.render_status === "rendering" ? "rendering" : "queued",
      object_title: r.title || "Untitled video",
      client_id: r.client_id,
      client_name: r.client_name,
      actor_id: null,
      occurred_at: r.updated_at,
    });
  }
  for (const s of scheduled) {
    events.push({
      id: `publish:${s.id}`,
      kind: "scheduled_publish",
      verb: s.status === "posted" ? "published" : "scheduled",
      object_title: s.title,
      client_id: s.client_id,
      client_name: s.client_name,
      actor_id: null,
      occurred_at: s.scheduled_at || new Date().toISOString(),
    });
  }
  for (const d of deals) {
    events.push({
      id: `deal:${d.id}`,
      kind: "deal",
      verb: "updated",
      object_title: `${d.title} (${d.stage})`,
      client_id: null,
      client_name: d.client_name,
      actor_id: null,
      occurred_at: d.updated_at,
    });
  }

  // Sort by occurred_at desc, cap to RECENT_ACTIVITY_LIMIT
  events.sort((a, b) => (a.occurred_at < b.occurred_at ? 1 : -1));
  return events.slice(0, RECENT_ACTIVITY_LIMIT);
}

export async function getWhiteboardSnapshot(
  supabase: SupabaseClient,
  agencyOwnerId: string,
): Promise<WhiteboardSnapshot> {
  // Client lookup runs first because both content_calendar and the lane
  // builder need it.
  const clientLookup = await fetchClientLookup(supabase, agencyOwnerId);

  // The remaining queries are independent — fan them out in parallel.
  const [presence, tasks, renders, scheduled, deals] = await Promise.all([
    fetchActiveUsers(supabase, agencyOwnerId),
    fetchTasksByStatus(supabase, agencyOwnerId, clientLookup),
    fetchActiveRenders(supabase, agencyOwnerId, clientLookup),
    fetchScheduledPublishes(supabase, agencyOwnerId, clientLookup),
    fetchOpenDeals(supabase, agencyOwnerId, clientLookup),
  ]);

  const allItems: WhiteboardItem[] = [
    ...tasks.flat,
    ...renders.flat,
    ...scheduled.flat,
    ...deals.flat,
  ];
  const byClient = buildLanes(allItems, clientLookup);
  const recentActivity = buildRecentActivity(
    tasks.flat,
    renders.rows,
    scheduled.rows,
    deals.rows,
  );

  return {
    active_users: presence.rows,
    tasks_by_status: tasks.tasks,
    active_renders: renders.rows,
    scheduled_publishes: scheduled.rows,
    open_deals: deals.rows,
    by_client: byClient,
    recent_activity: recentActivity,
    generated_at: new Date().toISOString(),
    source_health: {
      clients: clientLookup.size > 0 ? "ok" : "degraded",
      workspace_presence: presence.ok ? "ok" : "degraded",
      workspace_tasks: tasks.ok ? "ok" : "degraded",
      video_projects: renders.ok ? "ok" : "degraded",
      content_calendar: scheduled.ok ? "ok" : "degraded",
      deals: deals.ok ? "ok" : "degraded",
    },
  };
}
