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

  // Use service client since this is a public endpoint
  const supabase = createServiceClient();

  const { error } = await supabase.from("funnel_analytics").insert({
    funnel_id,
    step_id: step_id ?? null,
    visitor_id: visitor_id ?? null,
    event_type,
    metadata,
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true }, { status: 201 });
}
