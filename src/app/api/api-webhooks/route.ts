/**
 * Internal webhook subscription management — dashboard CRUD.
 *
 *   GET  /api/api-webhooks
 *   POST /api/api-webhooks
 */
import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { createServerSupabase } from "@/lib/supabase/server";
import { WEBHOOK_EVENTS } from "@/lib/api/webhook-events";

const VALID_EVENTS = new Set<string>(WEBHOOK_EVENTS);

interface CreateBody {
  url?: unknown;
  events?: unknown;
  active?: unknown;
}

function asString(v: unknown): string | null {
  return typeof v === "string" && v.trim() ? v.trim() : null;
}

function generateSecret(): string {
  return `whsec_${crypto.randomBytes(24).toString("hex")}`;
}

export async function GET() {
  const supabase = createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data, error } = await supabase
    .from("api_webhooks")
    .select("id, url, events, active, secret, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ webhooks: data ?? [] });
}

export async function POST(request: NextRequest) {
  const supabase = createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: CreateBody;
  try {
    body = (await request.json()) as CreateBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const url = asString(body.url);
  if (!url) {
    return NextResponse.json({ error: "url is required" }, { status: 400 });
  }
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
      return NextResponse.json(
        { error: "url must be http(s)" },
        { status: 400 },
      );
    }
  } catch {
    return NextResponse.json({ error: "url is not a valid URL" }, { status: 400 });
  }

  const eventsRaw = Array.isArray(body.events) ? body.events : [];
  const events = eventsRaw.filter(
    (e): e is string => typeof e === "string" && VALID_EVENTS.has(e),
  );
  if (events.length === 0) {
    return NextResponse.json(
      {
        error: "events must contain at least one valid event",
        valid_events: Array.from(VALID_EVENTS),
      },
      { status: 400 },
    );
  }

  const active = body.active !== false; // default true

  const { data, error } = await supabase
    .from("api_webhooks")
    .insert({
      user_id: user.id,
      url,
      secret: generateSecret(),
      events,
      active,
    })
    .select("id, url, events, active, secret, created_at")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ webhook: data }, { status: 201 });
}
