import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase, createServiceClient } from "@/lib/supabase/server";
import { getRotationStats } from "@/lib/services/sender-rotation";

// GET — Get sender rotation stats
export async function GET(_request: NextRequest) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const serviceSupabase = createServiceClient();
  const stats = await getRotationStats(serviceSupabase);

  return NextResponse.json(stats);
}
