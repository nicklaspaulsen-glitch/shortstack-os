/**
 * GET /api/ads/revealbot/accounts
 *
 * Returns the ad accounts accessible via the user's stored Revealbot API key.
 */
import { NextResponse } from "next/server";
import { createServerSupabase, createServiceClient } from "@/lib/supabase/server";
import { makeRevealbotClient } from "@/lib/ads/revealbot-client";

export const dynamic = "force-dynamic";

export async function GET(): Promise<NextResponse> {
  const supabase = createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const service = createServiceClient();
  const { data: conn } = await service
    .from("oauth_connections")
    .select("access_token, is_active")
    .eq("user_id", user.id)
    .eq("platform", "revealbot")
    .eq("is_active", true)
    .maybeSingle();

  if (!conn?.access_token) {
    return NextResponse.json(
      { error: "Revealbot not connected. POST /api/ads/revealbot/connect with your API key." },
      { status: 400 },
    );
  }

  try {
    const client = makeRevealbotClient(conn.access_token);
    const accounts = await client.listAccounts();
    return NextResponse.json({ accounts });
  } catch (err) {
    console.error("[revealbot/accounts] error:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
