import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * POST /api/admin/agent-restart
 * Stub — signals a restart for a named agent service.
 * In production this would trigger a Vercel deployment hook or a cron reset.
 */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const { service_name } = body as { service_name?: string };

  if (!service_name) {
    return NextResponse.json({ error: "service_name is required" }, { status: 400 });
  }

  // TODO: wire to actual restart mechanism (e.g. Vercel deploy hook per service)
  return NextResponse.json({ restarted: true, service_name, restarted_at: new Date().toISOString() });
}
