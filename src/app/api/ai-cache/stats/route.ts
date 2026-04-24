import { NextRequest, NextResponse } from "next/server";

import { createServerSupabase } from "@/lib/supabase/server";
import { getStats } from "@/lib/ai/output-cache";

/*
  GET /api/ai-cache/stats — cache hit rate, row count, estimated $ saved.
  Exposed to any signed-in user; numbers are aggregate (no per-input content).
*/
export async function GET(_req: NextRequest) {
  const authSupabase = createServerSupabase();
  const { data: { user } } = await authSupabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const stats = await getStats();
  return NextResponse.json({ stats });
}
