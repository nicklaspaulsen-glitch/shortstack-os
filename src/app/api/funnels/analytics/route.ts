import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

// Simple in-memory rate limiter: IP -> [timestamps]
const rateLimitMap = new Map<string, number[]>();
const WINDOW_MS = 60_000; // 1 minute
const MAX_REQUESTS = 30;

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const timestamps = (rateLimitMap.get(ip) ?? []).filter((t) => now - t < WINDOW_MS);
  timestamps.push(now);
  rateLimitMap.set(ip, timestamps);
  return timestamps.length > MAX_REQUESTS;
}

// POST /api/funnels/analytics — record a visitor event (no auth required)
export async function POST(req: NextRequest) {
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("x-real-ip") ??
    "unknown";

  if (isRateLimited(ip)) {
    return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
  }

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });

  const { funnel_id, step_id, visitor_id, event_type, metadata = {} } = body;

  if (!funnel_id || !event_type) {
    return NextResponse.json({ error: "funnel_id and event_type are required" }, { status: 400 });
  }

  const validEvents = ["view", "click", "submit", "purchase"];
  if (!validEvents.includes(event_type)) {
    return NextResponse.json({ error: `event_type must be one of: ${validEvents.join(", ")}` }, { status: 400 });
  }

  // Cap metadata payload to prevent storage abuse — anyone can hit this endpoint
  // and dump arbitrary JSON into funnel_analytics.metadata. 4KB serialized is
  // generous for legitimate UTM tags / referrer / device info; pure spam gets cut.
  let metadataString: string;
  try {
    metadataString = JSON.stringify(metadata ?? {});
  } catch {
    return NextResponse.json({ error: "metadata must be JSON-serializable" }, { status: 400 });
  }
  if (metadataString.length > 4096) {
    return NextResponse.json({ error: "metadata payload exceeds 4KB" }, { status: 413 });
  }

  // Use service client since this is a public endpoint
  const supabase = createServiceClient();

  // Verify the funnel actually exists (and is published — drafts shouldn't
  // collect analytics). Without this an attacker can flood funnel_analytics
  // with rows for non-existent or other-tenant funnel UUIDs, polluting
  // dashboards and burning row count.
  const { data: funnel } = await supabase
    .from("funnels")
    .select("id, is_published")
    .eq("id", funnel_id)
    .maybeSingle();
  if (!funnel) {
    return NextResponse.json({ error: "Funnel not found" }, { status: 404 });
  }
  if (funnel.is_published === false) {
    return NextResponse.json({ error: "Funnel not published" }, { status: 404 });
  }

  // Cap visitor_id length defensively (UUIDs are 36 chars; legitimate values
  // are short identifiers, not free-form strings).
  const safeVisitorId = typeof visitor_id === "string" ? visitor_id.slice(0, 128) : null;

  const { error } = await supabase.from("funnel_analytics").insert({
    funnel_id,
    step_id: step_id ?? null,
    visitor_id: safeVisitorId,
    event_type,
    metadata,
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true }, { status: 201 });
}
