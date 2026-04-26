import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase, createServiceClient } from "@/lib/supabase/server";
import { getEffectiveOwnerId } from "@/lib/security/require-owned-client";

// Edge runtime: parallel DB-count fanout, no Node-only imports. The
// Promise.all over TRACKED_PATHS is well within Edge subrequest limits.
export const runtime = "edge";
export const maxDuration = 10;

/**
 * Sidebar nav paths we track. The keys here are the canonical nav `href`
 * values used in the sidebar; the values are the resolver IDs we use
 * internally to fetch counts.
 *
 * Adding a new tracked path: extend NAV_RESOLVERS below and add the
 * matching href here.
 */
const TRACKED_PATHS = [
  "/dashboard/inbox",
  "/dashboard/generations",
  "/dashboard/notifications",
  "/dashboard/outreach-logs",
  "/dashboard/crm",
  "/dashboard/content-plan",
  "/dashboard/discord",
  "/dashboard/community",
] as const;

type TrackedPath = (typeof TRACKED_PATHS)[number];

const DEFAULT_LAST_VISITED_DAYS = 7; // window for "new since you joined this nav item"

/**
 * GET /api/user/sidebar-unread
 *
 * Returns: { unread: { "/dashboard/inbox": 3, ... } }
 *
 * For each tracked nav path, looks up the user's last_visited_at from
 * sidebar_unread_tracking (defaulting to 7 days ago), then runs a count
 * against the appropriate feature table.
 */
export async function GET() {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const ownerId = (await getEffectiveOwnerId(supabase, user.id)) || user.id;

  const service = createServiceClient();

  // Pull all existing tracking rows in one shot.
  const { data: trackingRows } = await service
    .from("sidebar_unread_tracking")
    .select("nav_path, last_visited_at")
    .eq("user_id", user.id);

  const lastVisitedMap = new Map<string, string>();
  for (const row of trackingRows || []) {
    if (row?.nav_path && row.last_visited_at) {
      lastVisitedMap.set(row.nav_path as string, row.last_visited_at as string);
    }
  }

  const fallbackSince = new Date(
    Date.now() - DEFAULT_LAST_VISITED_DAYS * 24 * 60 * 60 * 1000,
  ).toISOString();

  const sinceFor = (path: string) => lastVisitedMap.get(path) || fallbackSince;

  // Resolve owner-scoped client/lead ids once for paths that need them.
  const [clientsRes, leadsRes] = await Promise.all([
    service.from("clients").select("id").eq("profile_id", ownerId),
    service.from("leads").select("id").eq("user_id", ownerId),
  ]);
  const ownedClientIds = (clientsRes.data || []).map((r) => r.id as string);
  const ownedLeadIds = (leadsRes.data || []).map((r) => r.id as string);

  // Run all unread queries in parallel. Each returns { path, count }.
  const tasks = TRACKED_PATHS.map(async (path): Promise<{ path: TrackedPath; count: number }> => {
    try {
      const since = sinceFor(path);
      const count = await resolveUnreadCount(
        service,
        path,
        since,
        user.id,
        ownerId,
        ownedClientIds,
        ownedLeadIds,
      );
      return { path, count };
    } catch (err) {
      console.error(`[sidebar-unread] ${path} failed:`, err);
      return { path, count: 0 };
    }
  });

  const results = await Promise.all(tasks);
  const unread: Record<string, number> = {};
  for (const r of results) {
    if (r.count > 0) unread[r.path] = r.count;
  }

  return NextResponse.json({ unread });
}

/**
 * POST /api/user/sidebar-unread
 *
 * Body: { nav_path: string }
 *
 * Marks the given nav path as visited (resets unread to 0, updates
 * last_visited_at to now). Subsequent GETs will only count items newer
 * than this timestamp.
 */
export async function POST(req: NextRequest) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: { nav_path?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const navPath = typeof body.nav_path === "string" ? body.nav_path : null;
  if (!navPath || !TRACKED_PATHS.includes(navPath as TrackedPath)) {
    // Silent success for untracked paths so the client can fire-and-forget on
    // every nav click without worrying about which paths are tracked.
    return NextResponse.json({ success: true, tracked: false });
  }

  const service = createServiceClient();
  const now = new Date().toISOString();

  const { error } = await service
    .from("sidebar_unread_tracking")
    .upsert(
      {
        user_id: user.id,
        nav_path: navPath,
        last_visited_at: now,
        unread_count: 0,
      },
      { onConflict: "user_id,nav_path" },
    );

  if (error) {
    console.error("[sidebar-unread] POST upsert error:", error);
    return NextResponse.json({ error: "Failed to mark visited" }, { status: 500 });
  }

  return NextResponse.json({ success: true, tracked: true });
}

/* ─── Per-path count resolvers ────────────────────────────────────── */

/**
 * Returns the unread count for a single nav path. Each branch handles
 * gracefully if the underlying table doesn't exist yet (returns 0).
 */
async function resolveUnreadCount(
  service: ReturnType<typeof createServiceClient>,
  path: TrackedPath,
  since: string,
  userId: string,
  ownerId: string,
  ownedClientIds: string[],
  ownedLeadIds: string[],
): Promise<number> {
  const safeCount = async (
    p: PromiseLike<{ count: number | null; error: unknown }>,
  ): Promise<number> => {
    try {
      const { count, error } = await p;
      if (error) return 0;
      return count || 0;
    } catch {
      return 0;
    }
  };

  switch (path) {
    case "/dashboard/inbox": {
      // Inbox aggregates new outreach replies and freshly-generated content scripts.
      const queries: Array<Promise<number>> = [];

      if (ownedLeadIds.length > 0 || ownedClientIds.length > 0) {
        const filters: string[] = [];
        if (ownedLeadIds.length > 0) filters.push(`lead_id.in.(${ownedLeadIds.join(",")})`);
        if (ownedClientIds.length > 0) filters.push(`client_id.in.(${ownedClientIds.join(",")})`);
        queries.push(
          safeCount(
            service
              .from("outreach_log")
              .select("id", { count: "exact", head: true })
              .or(filters.join(","))
              .gte("created_at", since),
          ),
        );
      }

      if (ownedClientIds.length > 0) {
        queries.push(
          safeCount(
            service
              .from("content_scripts")
              .select("id", { count: "exact", head: true })
              .in("client_id", ownedClientIds)
              .gte("created_at", since),
          ),
        );
      }

      const results = await Promise.all(queries);
      return results.reduce((a, b) => a + b, 0);
    }

    case "/dashboard/generations": {
      // Newly logged AI generations (action_type starts with "ai_").
      return safeCount(
        service
          .from("trinity_log")
          .select("id", { count: "exact", head: true })
          .eq("user_id", ownerId)
          .like("action_type", "ai_%")
          .gte("created_at", since),
      );
    }

    case "/dashboard/notifications": {
      // Standard unread = read=false (no time gating).
      return safeCount(
        service
          .from("notifications")
          .select("id", { count: "exact", head: true })
          .eq("user_id", userId)
          .eq("read", false),
      );
    }

    case "/dashboard/outreach-logs": {
      if (ownedLeadIds.length === 0 && ownedClientIds.length === 0) return 0;
      const filters: string[] = [];
      if (ownedLeadIds.length > 0) filters.push(`lead_id.in.(${ownedLeadIds.join(",")})`);
      if (ownedClientIds.length > 0) filters.push(`client_id.in.(${ownedClientIds.join(",")})`);
      return safeCount(
        service
          .from("outreach_log")
          .select("id", { count: "exact", head: true })
          .or(filters.join(","))
          .eq("status", "replied")
          .gte("updated_at", since),
      );
    }

    case "/dashboard/crm": {
      return safeCount(
        service
          .from("leads")
          .select("id", { count: "exact", head: true })
          .eq("user_id", ownerId)
          .gte("created_at", since),
      );
    }

    case "/dashboard/content-plan": {
      if (ownedClientIds.length === 0) return 0;
      return safeCount(
        service
          .from("content_calendar")
          .select("id", { count: "exact", head: true })
          .in("client_id", ownedClientIds)
          .gte("created_at", since),
      );
    }

    case "/dashboard/discord": {
      // Count discord servers added since last visit (best available signal
      // without a per-server activity table on this user).
      return safeCount(
        service
          .from("discord_servers")
          .select("id", { count: "exact", head: true })
          .eq("profile_id", ownerId)
          .gte("created_at", since),
      );
    }

    case "/dashboard/community": {
      return safeCount(
        service
          .from("community_posts")
          .select("id", { count: "exact", head: true })
          .gte("created_at", since),
      );
    }

    default:
      return 0;
  }
}
