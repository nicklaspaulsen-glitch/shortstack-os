/**
 * /__/console — Hidden admin dev-tools page.
 *
 * The double-underscore prefix signals "internal" — this route is not
 * listed in the sidebar. Auth-gated: admin or founder only.
 *
 * Tiles:
 *   1. Env-var presence panel
 *   2. Self-test history (last 5 runs)
 *   3. DB row counts (10 critical tables)
 *   4. Recent error log (trinity_log failures)
 *   5. Webhook dedup health (processed_events)
 *   6. Cron job calendar (vercel.json schedules)
 *
 * This is a server component — env vars are read server-side only and
 * NEVER exposed to the browser. Each tile is wrapped in try/catch so a
 * single DB hiccup cannot crash the whole page.
 */

import { redirect } from "next/navigation";
import { Terminal } from "lucide-react";
import PageHero from "@/components/ui/page-hero";
import { createServerSupabase, createServiceClient } from "@/lib/supabase/server";
import EnvPanel from "@/components/admin/console/EnvPanel";
import SelfTestHistory from "@/components/admin/console/SelfTestHistory";
import DbRowCounts from "@/components/admin/console/DbRowCounts";
import ErrorLog, { type TrinityErrorRow } from "@/components/admin/console/ErrorLog";
import WebhookHealth, { type ProviderDedup } from "@/components/admin/console/WebhookHealth";
import CronCalendar, { type CronEntry } from "@/components/admin/console/CronCalendar";
import vercelConfig from "../../../../vercel.json";

export const dynamic = "force-dynamic";

// ─── Types ────────────────────────────────────────────────────────────────────

interface SelfTestRun {
  run_id: string;
  started_at: string;
  pass: number;
  fail: number;
  total: number;
}

interface TableCount {
  table: string;
  count: number | null;
}

// ─── Env-var presence (server-side, never leaks values) ──────────────────────

const CRITICAL_VARS = [
  "DISCORD_BOT_TOKEN",
  "NOTION_CLIENT_ID",
  "SLACK_BOT_TOKEN",
  "LINKEDIN_CLIENT_ID",
  "TIKTOK_ADS_APP_ID",
  "PANDADOC_API_KEY",
  "OPENAI_API_KEY",
  "ANTHROPIC_API_KEY",
  "STRIPE_SECRET_KEY",
  "RESEND_API_KEY",
  "ELEVENLABS_API_KEY",
  "TELEGRAM_BOT_TOKEN",
  "SUPABASE_SERVICE_ROLE_KEY",
  "NEXT_PUBLIC_APP_URL",
  "CRON_SECRET",
] as const;

function getEnvPresence() {
  return CRITICAL_VARS.map((name) => ({
    name,
    present: Boolean(process.env[name]),
  }));
}

// ─── DB fetchers ──────────────────────────────────────────────────────────────

async function fetchSelfTestHistory(): Promise<SelfTestRun[] | null> {
  try {
    const service = createServiceClient();
    const { data } = await service
      .from("self_test_results")
      .select("run_id, run_started_at, ok")
      .order("run_started_at", { ascending: false })
      .limit(300);

    if (!data) return [];

    const map = new Map<string, { started_at: string; pass: number; fail: number }>();
    for (const row of data) {
      const runId = row.run_id as string;
      const bucket = map.get(runId);
      if (bucket) {
        if (row.ok) bucket.pass++; else bucket.fail++;
      } else {
        map.set(runId, {
          started_at: row.run_started_at as string,
          pass: row.ok ? 1 : 0,
          fail: row.ok ? 0 : 1,
        });
      }
    }

    return Array.from(map.entries())
      .map(([run_id, v]) => ({
        run_id,
        started_at: v.started_at,
        pass: v.pass,
        fail: v.fail,
        total: v.pass + v.fail,
      }))
      .sort((a, b) => b.started_at.localeCompare(a.started_at))
      .slice(0, 5)
      .reverse();
  } catch {
    return null;
  }
}

const MONITORED_TABLES = [
  "clients",
  "profiles",
  "leads",
  "conversations",
  "content_calendar",
  "voice_calls",
  "trinity_log",
  "social_accounts",
  "agency_stripe_accounts",
  "license_activations",
] as const;

async function fetchDbRowCounts(): Promise<TableCount[] | null> {
  try {
    const service = createServiceClient();
    const results = await Promise.all(
      MONITORED_TABLES.map(async (table) => {
        try {
          const { count } = await service
            .from(table)
            .select("*", { count: "exact", head: true });
          return { table, count: count ?? null };
        } catch {
          return { table, count: null };
        }
      })
    );
    return results;
  } catch {
    return null;
  }
}

async function fetchRecentErrors(): Promise<TrinityErrorRow[] | null> {
  try {
    const service = createServiceClient();
    const { data } = await service
      .from("trinity_log")
      .select("id, created_at, action_type, description, user_id, result, metadata")
      .or("status.eq.failed,metadata->>kind.eq.error")
      .order("created_at", { ascending: false })
      .limit(20);

    if (!data) return [];

    return (data as TrinityErrorRow[]);
  } catch {
    return null;
  }
}

async function fetchWebhookHealth(): Promise<ProviderDedup[] | null> {
  // Codex round-1+2 catch: row-fetch from processed_events was capped by
  // PostgREST's default 1000-row pagination, so once the table grew past
  // that the stuck-claim counts silently under-reported. Now goes
  // through the SECURITY DEFINER `webhook_health_summary()` RPC which
  // does the aggregate server-side in a single query, returning
  // authoritative counts regardless of table size. Stuck detection
  // gates on processed_at < now() - 5min (the field claimEvent
  // refreshes), not created_at.
  try {
    const service = createServiceClient();
    const { data, error } = await service.rpc("webhook_health_summary");
    // Codex round-3 catch: returning [] on RPC failure renders "No
    // processed_events rows found" + "Healthy" — a silent false-green
    // on the exact health panel that's supposed to surface problems.
    // Map error → null so the tile shows "Unavailable" instead.
    if (error) {
      console.error("[__/console] webhook_health_summary RPC failed:", error.message);
      return null;
    }
    if (!data) return [];

    type Row = {
      provider: string;
      done: number | string;
      processing: number | string;
      in_flight: number | string;
      stuck_processing: number | string;
    };
    return (data as Row[]).map((r) => {
      // Postgres bigint comes back as string from PostgREST; coerce.
      const stuck = Number(r.stuck_processing);
      return {
        provider: r.provider,
        done: Number(r.done),
        processing: Number(r.processing),
        in_flight: Number(r.in_flight),
        stuck: stuck > 10,
      };
    });
  } catch {
    return null;
  }
}

// ─── Cron calendar (reads vercel.json; no DB needed) ─────────────────────────

function parseCronSchedule(schedule: string): string {
  // Return a human-readable approximation for common cron expressions.
  const map: Record<string, string> = {
    "0 8 * * *": "Daily 08:00 UTC",
    "0 9 * * 1-5": "Weekdays 09:00 UTC",
    "*/30 * * * *": "Every 30 min",
    "0 5 * * *": "Daily 05:00 UTC",
    "0 7 * * 1": "Mondays 07:00 UTC",
    "0 10 * * *": "Daily 10:00 UTC",
    "0 11 * * *": "Daily 11:00 UTC",
    "0 15 * * 5": "Fridays 15:00 UTC",
    "0 6 * * *": "Daily 06:00 UTC",
    "0 14 * * 1-5": "Weekdays 14:00 UTC",
    "0 4 * * *": "Daily 04:00 UTC",
    "*/15 * * * *": "Every 15 min",
    "0 3 * * *": "Daily 03:00 UTC",
    "0 9 * * 1": "Mondays 09:00 UTC",
    "0 */6 * * *": "Every 6 hours",
    "0 */4 * * *": "Every 4 hours",
    "0 */2 * * *": "Every 2 hours",
    "0 3 * * 0": "Sundays 03:00 UTC",
    "0 2 * * *": "Daily 02:00 UTC",
    "*/5 * * * *": "Every 5 min",
    "15 3 * * *": "Daily 03:15 UTC",
    "0 8 * * 0": "Sundays 08:00 UTC",
    "0 * * * *": "Every hour",
    "0 7 * * *": "Daily 07:00 UTC",
    "0 4 * * 0": "Sundays 04:00 UTC",
  };
  return map[schedule] ?? schedule;
}

function buildCronEntries(): CronEntry[] | null {
  // Codex round-1 catch: this function ran outside any try/catch, so a
  // malformed or missing crons array would throw and crash the whole
  // page (defeating the per-tile failure-isolation contract). Now it
  // returns null on bad input and the tile renders an "Unavailable"
  // placeholder.
  try {
    const raw = (vercelConfig as { crons?: unknown }).crons;
    if (!Array.isArray(raw)) return null;
    return raw
      .filter((c): c is { path: string; schedule: string } =>
        typeof c === "object" && c !== null &&
        typeof (c as { path?: unknown }).path === "string" &&
        typeof (c as { schedule?: unknown }).schedule === "string",
      )
      .map((c) => ({
        path: c.path,
        schedule: c.schedule,
        nextRun: parseCronSchedule(c.schedule),
        lastRun: null, // TODO: populate from cron_runs table if it exists
      }));
  } catch {
    return null;
  }
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function AdminConsolePage() {
  // AUTH GATE — must be first await before any DB call.
  const authClient = createServerSupabase();
  const {
    data: { user },
  } = await authClient.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await authClient
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "admin" && profile?.role !== "founder") {
    redirect("/dashboard");
  }

  // Fetch all tiles in parallel. Individual failures are caught inside each fetcher.
  const [selfTestRuns, dbCounts, errorRows, webhookProviders] = await Promise.all([
    fetchSelfTestHistory(),
    fetchDbRowCounts(),
    fetchRecentErrors(),
    fetchWebhookHealth(),
  ]);

  const envItems = getEnvPresence();
  const cronEntries = buildCronEntries();

  return (
    <div className="fade-in max-w-6xl mx-auto space-y-5">
      <PageHero
        icon={<Terminal size={26} />}
        title="Admin Console"
        subtitle="Internal dev-tools dashboard — env vars, DB health, errors, webhooks, and cron jobs."
        gradient="blue"
        eyebrow="Admin · /__/console"
        sparkles={false}
      />

      {/* Row 1: Env-var presence + Self-test history */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <EnvPanel items={envItems} />
        <SelfTestHistory runs={selfTestRuns} />
      </div>

      {/* Row 2: DB row counts + Webhook dedup health */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <DbRowCounts counts={dbCounts} />
        <WebhookHealth providers={webhookProviders} />
      </div>

      {/* Row 3: Recent error log (full width) */}
      <ErrorLog rows={errorRows} />

      {/* Row 4: Cron calendar (full width) */}
      <CronCalendar entries={cronEntries} />
    </div>
  );
}
