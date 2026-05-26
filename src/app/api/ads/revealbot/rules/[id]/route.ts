/**
 * PATCH  /api/ads/revealbot/rules/[id] — enable or disable a rule
 * DELETE /api/ads/revealbot/rules/[id] — permanently delete a rule
 * GET    /api/ads/revealbot/rules/[id] — execution history for a rule
 */
import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase, createServiceClient } from "@/lib/supabase/server";
import { makeRevealbotClient } from "@/lib/ads/revealbot-client";

export const dynamic = "force-dynamic";

async function getApiKey(userId: string): Promise<string | null> {
  const service = createServiceClient();
  const { data: conn } = await service
    .from("oauth_connections")
    .select("access_token")
    .eq("user_id", userId)
    .eq("platform", "revealbot")
    .eq("is_active", true)
    .maybeSingle();
  return conn?.access_token ?? null;
}

type Params = { id: string };

export async function GET(
  _request: NextRequest,
  { params }: { params: Params },
): Promise<NextResponse> {
  const supabase = createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const apiKey = await getApiKey(user.id);
  if (!apiKey) return NextResponse.json({ error: "Revealbot not connected." }, { status: 400 });

  try {
    const client = makeRevealbotClient(apiKey);
    const executions = await client.getRuleExecutions(params.id);
    return NextResponse.json({ executions });
  } catch (err) {
    console.error("[revealbot/rules/id] GET error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Params },
): Promise<NextResponse> {
  const supabase = createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const apiKey = await getApiKey(user.id);
  if (!apiKey) return NextResponse.json({ error: "Revealbot not connected." }, { status: 400 });

  let body: { status?: unknown };
  try {
    body = (await request.json()) as { status?: unknown };
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const status = body.status;
  if (status !== "enabled" && status !== "disabled") {
    return NextResponse.json({ error: "status must be 'enabled' or 'disabled'" }, { status: 400 });
  }

  try {
    const client = makeRevealbotClient(apiKey);
    const rule = await client.toggleRule(params.id, status);
    return NextResponse.json({ rule });
  } catch (err) {
    console.error("[revealbot/rules/id] PATCH error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Params },
): Promise<NextResponse> {
  const supabase = createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const apiKey = await getApiKey(user.id);
  if (!apiKey) return NextResponse.json({ error: "Revealbot not connected." }, { status: 400 });

  try {
    const client = makeRevealbotClient(apiKey);
    await client.deleteRule(params.id);
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[revealbot/rules/id] DELETE error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
