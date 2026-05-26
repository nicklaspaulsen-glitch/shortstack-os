/**
 * POST /api/ads/revealbot/connect
 *
 * Validates a Revealbot API key and stores it in oauth_connections so it can
 * be used for campaign syncs and automation rule management.
 *
 * Body: { api_key: string }
 */
import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase, createServiceClient } from "@/lib/supabase/server";
import { makeRevealbotClient } from "@/lib/ads/revealbot-client";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest): Promise<NextResponse> {
  const supabase = createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: { api_key?: unknown };
  try {
    body = (await request.json()) as { api_key?: unknown };
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const apiKey = typeof body.api_key === "string" ? body.api_key.trim() : "";
  if (!apiKey) {
    return NextResponse.json({ error: "api_key is required" }, { status: 400 });
  }

  // Validate the key against Revealbot before storing
  const client = makeRevealbotClient(apiKey);
  const valid = await client.validateKey();
  if (!valid) {
    return NextResponse.json(
      { error: "Invalid Revealbot API key — could not authenticate with Revealbot." },
      { status: 422 },
    );
  }

  // Fetch accounts so we can store a representative account_id
  let accountId = "";
  try {
    const accounts = await client.listAccounts();
    accountId = accounts[0]?.id ?? "";
  } catch {
    // Non-fatal — we have the key, the account_id is just cosmetic
  }

  const service = createServiceClient();
  const { error } = await service.from("oauth_connections").upsert(
    {
      user_id: user.id,
      platform: "revealbot",
      access_token: apiKey,
      account_id: accountId,
      is_active: true,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id,platform" },
  );

  if (error) {
    console.error("[revealbot/connect] upsert error:", error);
    return NextResponse.json({ error: "Failed to save credentials" }, { status: 500 });
  }

  return NextResponse.json({ success: true, account_id: accountId });
}

/** DELETE — disconnect Revealbot (mark inactive). */
export async function DELETE(): Promise<NextResponse> {
  const supabase = createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const service = createServiceClient();
  await service
    .from("oauth_connections")
    .update({ is_active: false })
    .eq("user_id", user.id)
    .eq("platform", "revealbot");

  return NextResponse.json({ success: true });
}
