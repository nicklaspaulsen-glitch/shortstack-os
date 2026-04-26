import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase, createServiceClient } from "@/lib/supabase/server";

/**
 * GET /api/agent-runs
 * Returns a filtered list of agent runs for the supervisor UI.
 * Query params: ?agent=bug-hunt&status=failed&since=2026-04-01&limit=200
 *
 * Security fix (cross-agency audit finding #1): bare `role === 'admin'` check
 * blocked founder and agency users from accessing their own agent-run history.
 * Expanded to allow admin | founder | agency. For non-platform-admin roles the
 * query is still scoped to `user_id = user.id` so no cross-tenant leak is
 * introduced. Admin/founder use the service client to see all runs.
 */

const ALLOWED_ROLES = ["admin", "founder", "agency"] as const;
type AllowedRole = typeof ALLOWED_ROLES[number];

export async function GET(req: NextRequest) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  const role = profile?.role as string | undefined;
  if (!role || !(ALLOWED_ROLES as readonly string[]).includes(role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const isPlatformAdmin = role === "admin" || role === "founder";

  const { searchParams } = new URL(req.url);
  const agent = searchParams.get("agent");
  const status = searchParams.get("status");
  const since = searchParams.get("since");
  const limit = Math.min(parseInt(searchParams.get("limit") || "200", 10) || 200, 1000);

  // Platform admins use service client to see all runs; agency owners are
  // scoped to their own user_id via the auth client (RLS further enforces this).
  const queryClient = isPlatformAdmin ? createServiceClient() : supabase;

  let q = queryClient
    .from("agent_runs")
    .select("*")
    .order("started_at", { ascending: false })
    .limit(limit);

  // Non-platform-admin roles are always scoped to their own rows.
  if (!isPlatformAdmin) {
    q = q.eq("user_id", user.id);
  }

  if (agent) q = q.eq("agent_name", agent);
  if (status) q = q.eq("status", status);
  if (since) q = q.gte("started_at", since);

  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ runs: data || [] });
}
