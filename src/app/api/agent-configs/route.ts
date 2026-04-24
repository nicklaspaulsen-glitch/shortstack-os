import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

const DEFAULT_AGENTS: Array<{ name: string; schedule_cron: string | null; description: string }> = [
  { name: "bug-hunt", schedule_cron: "0 3 * * *", description: "Nightly scan for broken endpoints, orphaned rows, exposed secrets" },
  { name: "content-quality", schedule_cron: "0 4 * * *", description: "Reviews last 24h of published content for brand/tone compliance" },
  { name: "churn-risk", schedule_cron: "0 5 * * *", description: "Scores every active client for churn likelihood" },
  { name: "deliverability", schedule_cron: "0 */6 * * *", description: "Checks email deliverability + inbox placement per sender" },
  { name: "security", schedule_cron: "0 2 * * *", description: "Scans for suspicious logins, token leaks, auth failures" },
  { name: "lead-enrichment", schedule_cron: "0 */2 * * *", description: "Enriches new leads with social profiles + firmographics" },
  { name: "rag-reindex", schedule_cron: "0 6 * * *", description: "Rebuilds RAG embeddings for Trinity knowledge base" },
];

async function assertAdmin(supabase: ReturnType<typeof createServerSupabase>) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if (profile?.role !== "admin") return null;
  return user;
}

/**
 * GET /api/agent-configs
 * Returns the per-user config rows for every known agent. For agents the
 * user has never toggled, we merge in a default row so the UI always has
 * the full list — the toggle will upsert on first PATCH.
 */
export async function GET() {
  const supabase = createServerSupabase();
  const user = await assertAdmin(supabase);
  if (!user) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { data, error } = await supabase
    .from("agent_configs")
    .select("*")
    .eq("user_id", user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const byName = new Map((data || []).map((r) => [r.agent_name, r]));
  const merged = DEFAULT_AGENTS.map((def) => {
    const existing = byName.get(def.name);
    if (existing) return { ...existing, description: def.description };
    return {
      id: null,
      user_id: user.id,
      agent_name: def.name,
      is_enabled: false,
      schedule_cron: def.schedule_cron,
      config: {},
      last_ran_at: null,
      next_run_at: null,
      description: def.description,
    };
  });

  return NextResponse.json({ agents: merged });
}

/**
 * PATCH /api/agent-configs
 * Body: { agent_name, is_enabled?, schedule_cron?, config? }
 * Upserts the row for (user_id, agent_name). Used when toggling on/off or
 * editing the cron schedule.
 */
export async function PATCH(req: NextRequest) {
  const supabase = createServerSupabase();
  const user = await assertAdmin(supabase);
  if (!user) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const agent_name = typeof body.agent_name === "string" ? body.agent_name : null;
  if (!agent_name) {
    return NextResponse.json({ error: "agent_name required" }, { status: 400 });
  }

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (typeof body.is_enabled === "boolean") patch.is_enabled = body.is_enabled;
  if (typeof body.schedule_cron === "string" || body.schedule_cron === null) {
    patch.schedule_cron = body.schedule_cron;
  }
  if (body.config && typeof body.config === "object") patch.config = body.config;

  const { data: existing } = await supabase
    .from("agent_configs")
    .select("id")
    .eq("user_id", user.id)
    .eq("agent_name", agent_name)
    .maybeSingle();

  if (existing) {
    const { data, error } = await supabase
      .from("agent_configs")
      .update(patch)
      .eq("id", existing.id)
      .select("*")
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ agent: data });
  }

  const { data, error } = await supabase
    .from("agent_configs")
    .insert({
      user_id: user.id,
      agent_name,
      is_enabled: patch.is_enabled ?? false,
      schedule_cron: patch.schedule_cron ?? null,
      config: patch.config ?? {},
    })
    .select("*")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ agent: data });
}
