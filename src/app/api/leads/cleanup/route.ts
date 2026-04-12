import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

const STALE_DAYS = 2;

// GET — preview how many stale leads exist (no deletions)
export async function GET() {
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
