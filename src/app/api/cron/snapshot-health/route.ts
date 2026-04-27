import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { structuredLog } from "@/lib/observability/structured-log";

/**
 * snapshot-health — every 15 min, write one row per agency owner into
 * `system_health_snapshots` capturing whether the core subsystems were
 * reachable and the last cron heartbeat.
 *
 * Why per-owner: white-label deployments expose `/status/[ownerSlug]` so
 * each owner gets their own private timeline. The current snapshot is
 * agency-global (db/auth/storage/cron all live in the same Supabase
 * project) but we still write one row per owner so the
 * /dashboard/admin/status admin UI and per-owner uptime grids work
 * without a fanout join later.
 *
 * Triggered via Vercel cron at `0,15,30,45 * * * *`. Auth via CRON_SECRET
 * Bearer header (same pattern as the other crons).
 */
export const maxDuration = 60;

interface ProbeResult {
  ok: boolean;
  detail?: string;
  responseTime?: number;
}

async function probeDb(): Promise<ProbeResult> {
  const start = Date.now();
  try {
    const client = createServiceClient();
    const { error } = await client
      .from("profiles")
      .select("id", { head: true, count: "exact" })
      .limit(1);
    return {
      ok: !error,
      detail: error?.message,
      responseTime: Date.now() - start,
    };
  } catch (err) {
    return {
      ok: false,
      detail: err instanceof Error ? err.message : String(err),
      responseTime: Date.now() - start,
    };
  }
}

async function probeAuth(): Promise<ProbeResult> {
  const start = Date.now();
  try {
    // Auth is reachable if listing users via service role works. We don't
    // care about the data — just that the auth endpoint accepts the
    // service-role key.
    const url = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/admin/users?per_page=1`;
    const res = await fetch(url, {
      headers: {
        apikey: process.env.SUPABASE_SERVICE_ROLE_KEY ?? "",
        Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY ?? ""}`,
      },
      signal: AbortSignal.timeout(8000),
    });
    return {
      ok: res.ok,
      detail: res.ok ? undefined : `HTTP ${res.status}`,
      responseTime: Date.now() - start,
    };
  } catch (err) {
    return {
      ok: false,
      detail: err instanceof Error ? err.message : String(err),
      responseTime: Date.now() - start,
    };
  }
}

async function probeStorage(): Promise<ProbeResult> {
  const start = Date.now();
  try {
    const client = createServiceClient();
    // Listing buckets is the cheapest storage round-trip we can make.
    const { data, error } = await client.storage.listBuckets();
    return {
      ok: !error && Array.isArray(data),
      detail: error?.message,
      responseTime: Date.now() - start,
    };
  } catch (err) {
    return {
      ok: false,
      detail: err instanceof Error ? err.message : String(err),
      responseTime: Date.now() - start,
    };
  }
}

async function getLastCronHeartbeat(): Promise<{
  lastAt: string | null;
  ok: boolean;
}> {
  // The health-check cron runs every 30 min and writes a row to
  // system_health_history. If we don't see a heartbeat within ~45 min
  // something is wrong with the cron worker itself.
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("system_health_history")
    .select("checked_at")
    .order("checked_at", { ascending: false })
    .limit(1);
  if (error || !data || data.length === 0) {
    return { lastAt: null, ok: false };
  }
  const lastAt = data[0].checked_at as string;
  const lastMs = new Date(lastAt).getTime();
  const ageMin = (Date.now() - lastMs) / 60_000;
  return { lastAt, ok: ageMin < 45 };
}

async function getVercelDeployStatus(): Promise<string | null> {
  const token = process.env.VERCEL_API_TOKEN;
  const projectId = process.env.VERCEL_PROJECT_ID;
  if (!token || !projectId) return null;
  try {
    const teamQs = process.env.VERCEL_TEAM_ID
      ? `&teamId=${process.env.VERCEL_TEAM_ID}`
      : "";
    const url = `https://api.vercel.com/v6/deployments?projectId=${projectId}&limit=1${teamQs}`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return null;
    const json = (await res.json()) as { deployments?: Array<{ readyState?: string; state?: string }> };
    const d = json.deployments?.[0];
    return d?.readyState ?? d?.state ?? null;
  } catch {
    return null;
  }
}

export async function GET(request: NextRequest) {
  // Standard Vercel cron auth. Same pattern as every other cron in this app.
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createServiceClient();

  // Probe everything once — these are tenant-agnostic so we don't fan out.
  const [db, auth, storage, cronHeartbeat, vercelDeploy] = await Promise.all([
    probeDb(),
    probeAuth(),
    probeStorage(),
    getLastCronHeartbeat(),
    getVercelDeployStatus(),
  ]);

  const raw = {
    db,
    auth,
    storage,
    cron: cronHeartbeat,
    vercel_deploy: vercelDeploy,
  };

  // Fan out: one snapshot row per agency owner. We deliberately scope by
  // role so client/team_member rows don't get redundant snapshots — only
  // owners (admin/founder/agency) have a public status page.
  const { data: owners, error: ownersErr } = await supabase
    .from("profiles")
    .select("id")
    .in("role", ["admin", "founder", "agency"]);

  if (ownersErr || !owners) {
    console.error("[cron/snapshot-health] failed to load owners:", ownersErr);
    return NextResponse.json(
      { error: "Failed to load owners", detail: ownersErr?.message },
      { status: 500 },
    );
  }

  if (owners.length === 0) {
    return NextResponse.json({
      success: true,
      written: 0,
      note: "No agency owners — skipping snapshot",
      timestamp: new Date().toISOString(),
    });
  }

  const snapshotAt = new Date().toISOString();
  const rows = owners.map((o) => ({
    owner_id: o.id,
    snapshot_at: snapshotAt,
    db_ok: db.ok,
    auth_ok: auth.ok,
    storage_ok: storage.ok,
    cron_ok: cronHeartbeat.ok,
    last_cron_at: cronHeartbeat.lastAt,
    vercel_deploy_status: vercelDeploy,
    raw,
  }));

  const { error: insertErr } = await supabase
    .from("system_health_snapshots")
    .insert(rows);

  if (insertErr) {
    structuredLog.error("[cron-snapshot-health]", "insert failed", {
      detail: insertErr.message,
    });
    return NextResponse.json(
      { error: "Insert failed", detail: insertErr.message },
      { status: 500 },
    );
  }

  structuredLog.info("[cron-snapshot-health]", "snapshot written", {
    written: rows.length,
    db_ok: db.ok,
    auth_ok: auth.ok,
    storage_ok: storage.ok,
    cron_ok: cronHeartbeat.ok,
  });

  return NextResponse.json({
    success: true,
    written: rows.length,
    db_ok: db.ok,
    auth_ok: auth.ok,
    storage_ok: storage.ok,
    cron_ok: cronHeartbeat.ok,
    timestamp: snapshotAt,
  });
}
