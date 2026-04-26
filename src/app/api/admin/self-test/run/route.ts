import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

/**
 * Admin "Run self-test now" endpoint.
 *
 * The /api/cron/self-test endpoint is the actual harness — it requires a
 * `Bearer ${CRON_SECRET}` header (Vercel adds this automatically for the
 * scheduled invocation). This route lets a signed-in admin trigger a run
 * without leaking CRON_SECRET to the browser: we re-call the cron route
 * server-side with the secret read from process.env.
 *
 * Auth gate: profile.role IN ('admin','founder').
 *
 * The cron sweeps ~40 routes serially with per-route timeouts; the full
 * run can take 30-60s. We extend the function timeout via maxDuration.
 */
export const dynamic = "force-dynamic";
export const maxDuration = 300; // 5 min — matches the cron's own ceiling

export async function POST() {
  try {
    const supabase = createServerSupabase();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();
    if (!profile || (profile.role !== "admin" && profile.role !== "founder")) {
      return NextResponse.json({ error: "Forbidden — admin only" }, { status: 403 });
    }

    const cronSecret = process.env.CRON_SECRET;
    if (!cronSecret) {
      return NextResponse.json(
        { error: "CRON_SECRET not configured on server" },
        { status: 500 },
      );
    }

    // Resolve the canonical app URL — same priority as the cron itself
    // uses, so we don't accidentally hit a deployment-protected URL.
    const origin =
      process.env.NEXT_PUBLIC_APP_URL ||
      process.env.NEXT_PUBLIC_SITE_URL ||
      "https://app.shortstack.work";
    const url = `${origin.replace(/\/$/, "")}/api/cron/self-test`;

    const started = Date.now();
    const res = await fetch(url, {
      method: "GET",
      headers: { authorization: `Bearer ${cronSecret}` },
      // The cron is bounded by its own maxDuration; we don't add another.
      cache: "no-store",
    });
    const ms = Date.now() - started;

    let payload: unknown = null;
    try {
      payload = await res.json();
    } catch {
      payload = { error: "Cron returned non-JSON response" };
    }

    if (!res.ok) {
      return NextResponse.json(
        {
          error: "Self-test cron returned non-2xx",
          status: res.status,
          duration_ms: ms,
          body: payload,
        },
        { status: 502 },
      );
    }

    return NextResponse.json({
      success: true,
      triggered_by: user.id,
      duration_ms: ms,
      result: payload,
    });
  } catch (err) {
    console.error("[/api/admin/self-test/run] error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
