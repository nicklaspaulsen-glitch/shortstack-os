import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/**
 * POST /api/admin/agent-restart
 *
 * Restart an agent/cron service.
 *
 * Auth: either
 *   - Bearer token === process.env.CRON_SECRET (for scheduler / ops scripts), OR
 *   - Authenticated Supabase session whose profile role is in ('admin','founder')
 *
 * Any other caller gets 401.
 */
export async function POST(req: NextRequest) {
  const bearer = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  const cronSecret = process.env.CRON_SECRET ?? "";
  const secretOk = cronSecret.length > 0 && bearer === cronSecret;

  if (!secretOk) {
    const supabase = createServerSupabase();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();

    if (!profile || !["admin", "founder"].includes(profile.role ?? "")) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }
  }

  const body = await req.json().catch(() => ({} as Record<string, unknown>));
  const { service_name } = body as { service_name?: string };

  if (!service_name) {
    return NextResponse.json({ error: "service_name is required" }, { status: 400 });
  }

  // TODO: wire to actual restart mechanism (e.g. Vercel deploy hook per service)
  return NextResponse.json({
    restarted: true,
    service_name,
    restarted_at: new Date().toISOString(),
  });
}
