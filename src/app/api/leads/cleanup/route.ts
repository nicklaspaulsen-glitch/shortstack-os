import { NextResponse } from "next/server";
import { createServerSupabase, createServiceClient } from "@/lib/supabase/server";

const STALE_DAYS = 2;

// GET — preview how many stale leads exist (no deletions)
export async function GET() {
  // Auth check
  const authSupabase = createServerSupabase();
  const { data: { user } } = await authSupabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = createServiceClient();
  const cutoff = new Date(Date.now() - STALE_DAYS * 86400000).toISOString();

  const { count, error } = await supabase
    .from("leads")
    .select("id", { count: "exact", head: true })
    .eq("status", "new")
    .lt("created_at", cutoff);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ stale_leads: count ?? 0 });
}

// POST — delete leads with status 'new' that are older than 2 days
export async function POST() {
  // Auth check — deletions require authentication
  const authSupabase2 = createServerSupabase();
  const { data: { user: user2 } } = await authSupabase2.auth.getUser();
  if (!user2) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = createServiceClient();
  const cutoff = new Date(Date.now() - STALE_DAYS * 86400000).toISOString();

  const { count, error } = await supabase
    .from("leads")
    .delete({ count: "exact" })
    .eq("status", "new")
    .lt("created_at", cutoff);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, deleted: count ?? 0 });
}
