import { NextResponse } from "next/server";
import { createServerSupabase, createServiceClient } from "@/lib/supabase/server";

// GET /api/ads/tiktok-ads/accounts — list the user's TikTok advertiser accounts
export async function GET() {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const service = createServiceClient();
  const { data: accounts } = await service
    .from("ad_accounts")
    .select("id, account_id, account_name, currency, timezone, status, is_default, last_synced_at")
    .eq("user_id", user.id)
    .eq("platform", "tiktok_ads")
    .order("is_default", { ascending: false });

  return NextResponse.json({ accounts: accounts || [] });
}
