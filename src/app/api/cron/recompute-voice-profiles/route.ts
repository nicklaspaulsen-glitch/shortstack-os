/**
 * GET /api/cron/recompute-voice-profiles
 *
 * Runs every 30 min (see vercel.json). Finds writing-voice subjects with
 * NEW corpus rows since their last profile computation and rebuilds the
 * profile. Hard cap of 50 rebuilds per tick to keep the LLM token spend
 * bounded.
 *
 * Auth: Bearer CRON_SECRET. Returns 503 fail-closed in production when
 * the env var is unset (same pattern as every other cron in this repo).
 */
import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import {
  recomputeVoiceProfileWithClient,
  type VoiceSubjectKind,
} from "@/lib/ai/voice-profile";

export const maxDuration = 300;
export const dynamic = "force-dynamic";

const PER_TICK_LIMIT = 50;

interface CorpusSubjectRow {
  agency_owner_id: string;
  subject_kind: string;
  subject_id: string;
  newest_capture: string;
}

interface ProfileLastRunRow {
  subject_kind: string;
  subject_id: string;
  computed_at: string;
}

export async function GET(request: NextRequest) {
  const expected = process.env.CRON_SECRET;
  if (!expected) {
    if (process.env.NODE_ENV === "development") {
      console.warn(
        "[cron/recompute-voice-profiles] CRON_SECRET missing in dev — allowing.",
      );
    } else {
      console.error(
        "[cron/recompute-voice-profiles] CRON_SECRET missing in production — failing closed.",
      );
      return NextResponse.json(
        { error: "CRON_SECRET not configured" },
        { status: 503 },
      );
    }
  }
  const authHeader = request.headers.get("authorization");
  if (expected && authHeader !== `Bearer ${expected}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createServiceClient();

  // Find every (subject_kind, subject_id) that has corpus rows and pick the
  // newest capture per subject. We do a small server-side aggregation in
  // JS because Supabase JS doesn't have window functions; the index on
  // (subject_kind, subject_id, captured_at DESC) makes the scan cheap.
  const { data: corpusRows, error: corpusErr } = await supabase
    .from("writing_voice_corpus")
    .select("agency_owner_id, subject_kind, subject_id, captured_at")
    .order("captured_at", { ascending: false })
    .limit(2000);

  if (corpusErr) {
    console.error("[cron/recompute-voice-profiles] corpus fetch failed", corpusErr);
    return NextResponse.json({ error: corpusErr.message }, { status: 500 });
  }
  if (!corpusRows || corpusRows.length === 0) {
    return NextResponse.json({ ok: true, recomputed: 0, reason: "empty_corpus" });
  }

  type RawCorpus = {
    agency_owner_id: string;
    subject_kind: string;
    subject_id: string;
    captured_at: string;
  };
  const newestBySubject = new Map<string, CorpusSubjectRow>();
  for (const row of corpusRows as RawCorpus[]) {
    const key = `${row.subject_kind}:${row.subject_id}`;
    if (!newestBySubject.has(key)) {
      newestBySubject.set(key, {
        agency_owner_id: row.agency_owner_id,
        subject_kind: row.subject_kind,
        subject_id: row.subject_id,
        newest_capture: row.captured_at,
      });
    }
  }

  // Pull last-computed timestamps for the same subjects. We don't filter by
  // subject upfront — there are at most a few thousand rows; one query is
  // cheaper than N round-trips.
  const { data: profileRows } = await supabase
    .from("writing_voice_profiles")
    .select("subject_kind, subject_id, computed_at");

  const lastRunBySubject = new Map<string, ProfileLastRunRow>();
  for (const row of (profileRows as ProfileLastRunRow[] | null) ?? []) {
    const key = `${row.subject_kind}:${row.subject_id}`;
    lastRunBySubject.set(key, row);
  }

  // Build the work list — subjects whose newest capture is newer than the
  // last computation, or which have never been computed.
  const work: CorpusSubjectRow[] = [];
  const subjects = Array.from(newestBySubject.values());
  for (const subject of subjects) {
    const key = `${subject.subject_kind}:${subject.subject_id}`;
    const last = lastRunBySubject.get(key);
    if (!last || new Date(subject.newest_capture) > new Date(last.computed_at)) {
      work.push(subject);
    }
    if (work.length >= PER_TICK_LIMIT) break;
  }

  if (work.length === 0) {
    return NextResponse.json({ ok: true, recomputed: 0, reason: "no_new_samples" });
  }

  let recomputed = 0;
  let failed = 0;
  for (const subject of work) {
    try {
      const result = await recomputeVoiceProfileWithClient(supabase, {
        agencyOwnerId: subject.agency_owner_id,
        subjectKind: subject.subject_kind as VoiceSubjectKind,
        subjectId: subject.subject_id,
      });
      if (result.ok) recomputed += 1;
      else failed += 1;
    } catch (err) {
      console.warn("[cron/recompute-voice-profiles] subject failed", err);
      failed += 1;
    }
  }

  return NextResponse.json({
    ok: true,
    recomputed,
    failed,
    pending: Math.max(0, work.length - PER_TICK_LIMIT),
    eligible_total: work.length,
  });
}
