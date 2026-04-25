import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

export const maxDuration = 30;

/*
  /api/cron/ai-handoff-cleanup
  ────────────────────────────
  Deletes expired ai_output_handoffs rows. Handoffs have a 15-minute TTL so
  the table churns fast — running daily keeps it from ballooning if a user
  rage-clicks "Edit" hundreds of times and never finishes the flow.

  Idempotent.

  ── ORPHAN HANDLER STATUS (Apr 27 audit) ──
  This route is NOT currently scheduled in vercel.json. Either:
    (a) Schedule it (e.g. "0 3 * * *" — daily at 03:00 UTC), OR
    (b) Delete this file if the table truly doesn't grow that fast.
  Until one of those happens, the route is callable but never auto-invoked.
*/
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createServiceClient();
  const { count, error } = await supabase
    .from("ai_output_handoffs")
    .delete({ count: "exact" })
    .lt("expires_at", new Date().toISOString());

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    deleted: count || 0,
    timestamp: new Date().toISOString(),
  });
}
