import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

// Cron: feed-weekly-digest — Fridays 16:00 UTC.
// Vercel Cron: 0 16 * * 5
// Walks opted-in profiles, builds a 7-day feed digest per org, enqueues an
// email via `email_queue` with template "feed_weekly_digest". Skips orgs
// with 0 events (silent weeks) and profiles opted out of the digest.
// Auth: Vercel crons pass `x-vercel-cron: 1`, or a manual trigger can send
// `Authorization: Bearer <CRON_SECRET>`.

export const maxDuration = 60;
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const isVercelCron = request.headers.get("x-vercel-cron") === "1";
  const authHeader = request.headers.get("authorization");
  const bearerOk = authHeader === `Bearer ${process.env.CRON_SECRET}`;
  if (!isVercelCron && !bearerOk) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createServiceClient();
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  // Gather distinct org_ids that had activity this week.
  const { data: events, error: eventsErr } = await supabase
    .from("activity_events")
    .select("org_id, event_type, actor_id, created_at")
    .gte("created_at", since);
  if (eventsErr) {
    return NextResponse.json({ error: eventsErr.message }, { status: 500 });
  }

  const perOrg = new Map<string, { total: number; byType: Record<string, number> }>();
  for (const e of events ?? []) {
    if (!e.org_id) continue;
    const bucket = perOrg.get(e.org_id) ?? { total: 0, byType: {} };
    bucket.total += 1;
    bucket.byType[e.event_type] = (bucket.byType[e.event_type] ?? 0) + 1;
    perOrg.set(e.org_id, bucket);
  }

  let enqueued = 0;
  let skippedSilent = 0;
  let skippedOptedOut = 0;

  for (const [orgId, bucket] of Array.from(perOrg.entries())) {
    if (bucket.total === 0) {
      skippedSilent += 1;
      continue;
    }

    // Owner profile (the org_id IS a user/profile id in ShortStack's model).
    const { data: profile } = await supabase
      .from("profiles")
      .select("id, email, full_name, feed_digest_weekly")
      .eq("id", orgId)
      .maybeSingle();

    if (!profile?.email) continue;
    if (profile.feed_digest_weekly === false) {
      skippedOptedOut += 1;
      continue;
    }

    // Enqueue email row. Soft-fail if `email_queue` table doesn't exist.
    try {
      const { error: qErr } = await supabase.from("email_queue").insert({
        to_email: profile.email,
        template: "feed_weekly_digest",
        template_data: {
          recipient_name: profile.full_name ?? "there",
          since,
          total: bucket.total,
          by_type: bucket.byType,
        },
        status: "queued",
      });
      if (!qErr) enqueued += 1;
    } catch {
      // Table missing — ignore silently.
    }
  }

  return NextResponse.json({
    success: true,
    orgs_seen: perOrg.size,
    enqueued,
    skipped_silent: skippedSilent,
    skipped_opted_out: skippedOptedOut,
  });
}
