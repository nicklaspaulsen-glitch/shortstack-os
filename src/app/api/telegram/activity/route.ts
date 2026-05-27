import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase, createServiceClient } from "@/lib/supabase/server";
import { getEffectiveOwnerId } from "@/lib/security/require-owned-client";

export const dynamic = "force-dynamic";

// GET /api/telegram/activity?routine_type=xxx — recent telegram-related trinity_log
// entries (last 100) for the "Live Activity" tab on the bot control page.
export async function GET(request: NextRequest) {
  const auth = createServerSupabase();
  const {
    data: { user },
  } = await auth.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // SECURITY: Scope to the caller's own agency. Without this filter every
  // authenticated user — including client-portal users from other agencies —
  // received up to 100 rows from the global trinity_log (cross-tenant leak).
  const ownerId = await getEffectiveOwnerId(auth, user.id);
  if (!ownerId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const url = new URL(request.url);
  const routineType = url.searchParams.get("routine_type");

  const service = createServiceClient();
  let query = service
    .from("trinity_log")
    .select("id, action_type, description, status, result, agent, created_at")
    .eq("user_id", ownerId)
    .order("created_at", { ascending: false })
    .limit(100);

  if (routineType) {
    query = query.eq("action_type", `telegram_${routineType}`);
  } else {
    // Match anything starting with telegram_ plus legacy 'telegram' agent rows.
    query = query.or(`action_type.like.telegram_%,agent.eq.telegram`);
  }

  const { data, error } = await query;
  if (error) {
    console.error("[telegram/activity] error:", error);
    return NextResponse.json({ error: "Failed to load activity" }, { status: 500 });
  }

  return NextResponse.json({ entries: data ?? [] });
}
