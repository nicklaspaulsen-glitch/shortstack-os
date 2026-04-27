/**
 * Single webhook subscription operations.
 *
 *   PATCH  /api/api-webhooks/{id} - toggle active / change events
 *   DELETE /api/api-webhooks/{id} - remove subscription entirely
 */
import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { WEBHOOK_EVENTS } from "@/lib/api/webhook-events";

const VALID_EVENTS = new Set<string>(WEBHOOK_EVENTS);

export async function PATCH(
  request: NextRequest,
  ctx: { params: { id: string } },
) {
  const supabase = createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let raw: Record<string, unknown>;
  try {
    raw = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const updates: Record<string, unknown> = {};
  if (typeof raw.active === "boolean") updates.active = raw.active;
  if (Array.isArray(raw.events)) {
    const events = raw.events.filter(
      (e): e is string => typeof e === "string" && VALID_EVENTS.has(e),
    );
    if (events.length === 0) {
      return NextResponse.json(
        { error: "events must contain at least one valid event" },
        { status: 400 },
      );
    }
    updates.events = events;
  }
  if (typeof raw.url === "string" && raw.url.trim()) {
    try {
      new URL(raw.url);
      updates.url = raw.url.trim();
    } catch {
      return NextResponse.json({ error: "url is not a valid URL" }, { status: 400 });
    }
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "No valid updates" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("api_webhooks")
    .update(updates)
    .eq("id", ctx.params.id)
    .eq("user_id", user.id)
    .select("id, url, events, active, secret, created_at")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ webhook: data });
}

export async function DELETE(
  _req: NextRequest,
  ctx: { params: { id: string } },
) {
  const supabase = createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { error } = await supabase
    .from("api_webhooks")
    .delete()
    .eq("id", ctx.params.id)
    .eq("user_id", user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
