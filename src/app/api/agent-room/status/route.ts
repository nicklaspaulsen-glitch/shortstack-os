import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

// Agent Room status — one-shot endpoint that feeds the Kumospace-style
// live room view. Rolls up three data sources:
//
//   1. /api/integrations/health semantics (env-var presence + last reachability)
//      for infra-style agents (stripe, resend, twilio, etc.)
//   2. trinity_log tail — any agent that emitted a log in the last 5 minutes
//      is considered "live". Longer-ago logs downgrade to "idle".
//   3. A hard-coded roster of the in-app agents (lead-engine, outreach,
//      content, etc.) so the room always shows the full cast even if none
//      have logged anything yet.
//
// Output is keyed by agent id so the client can just merge it onto its
// static AGENT_ROSTER without complicated lookups.

export const runtime = "nodejs";

// Windows for the "when was this agent last seen" rollup.
const LIVE_WINDOW_MS = 5 * 60 * 1000; // 5 min
const RECENT_WINDOW_MS = 60 * 60 * 1000; // 1 hour

type AgentStatus = "live" | "recent" | "idle" | "error" | "disabled";

interface AgentRollup {
  id: string;
  status: AgentStatus;
  last_run_at: string | null;
  last_status: string | null;
  last_description: string | null;
  error_count_1h: number;
  total_runs_1h: number;
}

// Env-var presence check for integration-style agents. Keys that map to
// the same switches used by /api/integrations/health — keeping this here
// duplicated but tiny so the room page can render in a single round-trip
// instead of fan-out calls to every health endpoint.
const INTEGRATION_ENV_GATES: Record<string, string[]> = {
  stripe: ["STRIPE_SECRET_KEY"],
  resend: ["SMTP_PASS"],
  twilio: ["TWILIO_ACCOUNT_SID", "TWILIO_AUTH_TOKEN"],
  elevenlabs: ["ELEVENLABS_API_KEY"],
  supabase: ["NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"],
  anthropic: ["ANTHROPIC_API_KEY"],
  openai: ["OPENAI_API_KEY"],
  runpod: ["RUNPOD_API_KEY"],
  telegram: ["TELEGRAM_BOT_TOKEN"],
  discord: ["DISCORD_WEBHOOK_SECRET"],
  notion: ["NOTION_API_KEY"],
  calendly: ["CALENDLY_API_TOKEN"],
  whatsapp: ["WHATSAPP_ACCESS_TOKEN", "WHATSAPP_PHONE_NUMBER_ID"],
  google_ads: ["GOOGLE_ADS_DEVELOPER_TOKEN"],
  google_business: ["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET"],
};

function integrationEnvStatus(id: string): "ok" | "missing" | null {
  const keys = INTEGRATION_ENV_GATES[id];
  if (!keys) return null;
  const anyMissing = keys.some(k => !process.env[k]);
  return anyMissing ? "missing" : "ok";
}

function deriveStatusFromRuns(
  lastRunAt: string | null,
  errorCount: number,
  totalRuns: number,
): AgentStatus {
  if (!lastRunAt) return "idle";
  const age = Date.now() - new Date(lastRunAt).getTime();
  // High error rate → error no matter how recent.
  if (totalRuns > 0 && errorCount / totalRuns >= 0.5) return "error";
  if (age <= LIVE_WINDOW_MS) return "live";
  if (age <= RECENT_WINDOW_MS) return "recent";
  return "idle";
}

export async function GET(_request: NextRequest) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Pull the last hour of trinity_log for this profile. The sidebar/stats
  // views already hammer this table every 20s; ours runs on room open +
  // whenever the user clicks refresh, so the load is fine.
  const oneHourAgo = new Date(Date.now() - RECENT_WINDOW_MS).toISOString();
  const { data: logs } = await supabase
    .from("trinity_log")
    .select("agent, action_type, description, status, created_at")
    .eq("profile_id", user.id)
    .gte("created_at", oneHourAgo)
    .order("created_at", { ascending: false })
    .limit(500);

  const agentMap: Record<string, AgentRollup> = {};
  for (const row of logs ?? []) {
    const id = (row.agent as string | null) ?? "unknown";
    const entry = (agentMap[id] ??= {
      id,
      status: "idle",
      last_run_at: null,
      last_status: null,
      last_description: null,
      error_count_1h: 0,
      total_runs_1h: 0,
    });
    entry.total_runs_1h += 1;
    if ((row.status as string | null) === "failed") entry.error_count_1h += 1;
    if (!entry.last_run_at) {
      entry.last_run_at = row.created_at as string;
      entry.last_status = (row.status as string | null) ?? null;
      entry.last_description = (row.description as string | null) ?? null;
    }
  }

  for (const entry of Object.values(agentMap)) {
    entry.status = deriveStatusFromRuns(
      entry.last_run_at,
      entry.error_count_1h,
      entry.total_runs_1h,
    );
  }

  // Merge integration env-var gating in as a separate map so the client
  // can light up the integration agents even if they have no logs yet.
  const integrations: Record<string, "ok" | "missing"> = {};
  for (const id of Object.keys(INTEGRATION_ENV_GATES)) {
    const s = integrationEnvStatus(id);
    if (s) integrations[id] = s;
  }

  return NextResponse.json({
    generated_at: new Date().toISOString(),
    agents: agentMap,
    integrations,
  });
}
