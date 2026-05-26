/**
 * GET  /api/ads/revealbot/rules — list all automation rules
 * POST /api/ads/revealbot/rules — create a new automation rule
 */
import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase, createServiceClient } from "@/lib/supabase/server";
import { makeRevealbotClient, type CreateRulePayload } from "@/lib/ads/revealbot-client";

export const dynamic = "force-dynamic";

async function getClient(userId: string): Promise<{
  client: ReturnType<typeof makeRevealbotClient>;
} | { error: NextResponse }> {
  const service = createServiceClient();
  const { data: conn } = await service
    .from("oauth_connections")
    .select("access_token")
    .eq("user_id", userId)
    .eq("platform", "revealbot")
    .eq("is_active", true)
    .maybeSingle();

  if (!conn?.access_token) {
    return {
      error: NextResponse.json(
        { error: "Revealbot not connected." },
        { status: 400 },
      ),
    };
  }

  return { client: makeRevealbotClient(conn.access_token) };
}

export async function GET(): Promise<NextResponse> {
  const supabase = createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const result = await getClient(user.id);
  if ("error" in result) return result.error;

  try {
    const rules = await result.client.listRules();
    return NextResponse.json({ rules });
  } catch (err) {
    console.error("[revealbot/rules] GET error:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const supabase = createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let payload: CreateRulePayload;
  try {
    payload = (await request.json()) as CreateRulePayload;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!payload.name || !payload.entity_type || !payload.ad_account_id) {
    return NextResponse.json(
      { error: "name, entity_type, and ad_account_id are required" },
      { status: 400 },
    );
  }
  if (!Array.isArray(payload.conditions) || payload.conditions.length === 0) {
    return NextResponse.json({ error: "At least one condition is required" }, { status: 400 });
  }
  if (!Array.isArray(payload.actions) || payload.actions.length === 0) {
    return NextResponse.json({ error: "At least one action is required" }, { status: 400 });
  }

  const result = await getClient(user.id);
  if ("error" in result) return result.error;

  try {
    const rule = await result.client.createRule(payload);
    return NextResponse.json({ rule }, { status: 201 });
  } catch (err) {
    console.error("[revealbot/rules] POST error:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
