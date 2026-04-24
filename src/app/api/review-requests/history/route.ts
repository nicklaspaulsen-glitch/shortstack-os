import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { getEffectiveOwnerId } from "@/lib/security/require-owned-client";

// GET /api/review-requests/history — sent log for the authed profile
export async function GET(request: NextRequest) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const ownerId = await getEffectiveOwnerId(supabase, user.id);
  if (!ownerId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { searchParams } = new URL(request.url);
  const limit = Math.min(Number(searchParams.get("limit") || "50"), 200);

  // Fetch config ids owned by this profile first, then query sent log
  const { data: ownedConfigs } = await supabase
    .from("review_request_configs")
    .select("id")
    .eq("profile_id", ownerId);

  const configIds = (ownedConfigs ?? []).map((c: { id: string }) => c.id);

  if (configIds.length === 0) {
    return NextResponse.json({ history: [] });
  }

  const { data, error } = await supabase
    .from("review_requests_sent")
    .select(
      `id, event_id, client_id, sent_at, channel, status,
       config:config_id (id, platform, review_url, delay_minutes, channel, message_template)`,
    )
    .in("config_id", configIds)
    .order("sent_at", { ascending: false })
    .limit(limit);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ history: data ?? [] });
}
