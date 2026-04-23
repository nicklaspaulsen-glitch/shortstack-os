/**
 * Admin-only: On-demand trigger of the system_health cron probe sweep.
 *
 * The /api/cron/health-check endpoint runs every 30 minutes via Vercel cron
 * and upserts the system_health table. If an admin wants fresh numbers
 * without waiting for the next cron tick, they hit this endpoint from
 * /dashboard/system-status ("Run All Probes Now" button).
 *
 * We re-authenticate as admin, then call the cron route internally using
 * the server's own CRON_SECRET so the actual probe logic stays in one place.
 */

import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

export const maxDuration = 120;

export async function POST() {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  if (profile?.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return NextResponse.json({
      error: "CRON_SECRET not configured — cannot trigger probe sweep",
    }, { status: 500 });
  }

  // Call our own cron route. Use NEXT_PUBLIC_APP_URL if set, else fall back
  // to the request's origin via the Host header (Next.js doesn't give us the
  // origin directly in route handlers, so we require APP_URL for self-fetch).
  const origin = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "");
  if (!origin) {
    return NextResponse.json({
      error: "NEXT_PUBLIC_APP_URL not set — cannot self-trigger probes",
    }, { status: 500 });
  }

  try {
    const res = await fetch(`${origin}/api/cron/health-check`, {
      method: "GET",
      headers: { Authorization: `Bearer ${cronSecret}` },
      // Don't cache — we want a fresh run every click
      cache: "no-store",
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      return NextResponse.json({
        error: "Probe sweep failed",
        status: res.status,
        detail: body,
      }, { status: 502 });
    }
    return NextResponse.json({
      success: true,
      ...body,
    });
  } catch (err) {
    return NextResponse.json({
      error: "Probe sweep threw",
      detail: String(err),
    }, { status: 500 });
  }
}
