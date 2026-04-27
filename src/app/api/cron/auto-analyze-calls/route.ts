/**
 * GET /api/cron/auto-analyze-calls
 *
 * Hourly Vercel cron that finds voice_calls + meetings from the last 24h
 * that don't yet have a `coach_analyses` row, runs analysis on the top 20
 * (newest first), and writes the results.
 *
 * Auth: Bearer CRON_SECRET. Same pattern as every other cron in this repo.
 *
 * Token-budget cap: we hard-stop at 20 sources per tick (each call is
 * complex_analysis → Opus, ~$0.10-0.30 per call) so a backlog can't
 * blow the daily AI budget.
 */

import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { analyzeCall } from "@/lib/coach/analyzer";

export const maxDuration = 300;
export const dynamic = "force-dynamic";

const PER_TICK_LIMIT = 20;

interface VoiceCallRow {
  id: string;
  profile_id: string;
  transcript: string | null;
  duration_seconds: number | null;
  from_number: string | null;
  to_number: string | null;
  started_at: string | null;
  created_at: string;
}

interface MeetingRow {
  id: string;
  created_by: string;
  transcript_raw: string | null;
  transcript_speaker_labeled: unknown;
  duration_seconds: number | null;
  participants: unknown;
  scheduled_at: string | null;
  created_at: string;
}

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const service = createServiceClient();
  const dayAgo = new Date(Date.now() - 24 * 3600 * 1000).toISOString();

  // Already-analyzed source ids — pull first so we can skip them client-side.
  const { data: existing } = await service
    .from("coach_analyses")
    .select("source_type, source_id")
    .gte("created_at", dayAgo);

  const analyzedKey = new Set<string>(
    (existing || []).map((r) => `${r.source_type}:${r.source_id}`),
  );

  // Pull recent voice calls with non-trivial transcripts.
  const { data: voiceRows } = await service
    .from("voice_calls")
    .select(
      "id, profile_id, transcript, duration_seconds, from_number, to_number, started_at, created_at",
    )
    .gte("created_at", dayAgo)
    .not("transcript", "is", null)
    .order("created_at", { ascending: false })
    .limit(PER_TICK_LIMIT * 2);

  const voicePending: VoiceCallRow[] = ((voiceRows || []) as VoiceCallRow[]).filter(
    (r) => !analyzedKey.has(`voice_call:${r.id}`) && (r.transcript?.trim().length ?? 0) >= 40,
  );

  // Pull recent meetings.
  const { data: meetingRows } = await service
    .from("meetings")
    .select(
      "id, created_by, transcript_raw, transcript_speaker_labeled, duration_seconds, participants, scheduled_at, created_at",
    )
    .gte("created_at", dayAgo)
    .not("transcript_raw", "is", null)
    .order("created_at", { ascending: false })
    .limit(PER_TICK_LIMIT * 2);

  const meetingPending: MeetingRow[] = ((meetingRows || []) as MeetingRow[]).filter(
    (r) =>
      !analyzedKey.has(`meeting:${r.id}`) &&
      (r.transcript_raw?.trim().length ?? 0) >= 40,
  );

  // Interleave so we don't starve one source type when both have backlog.
  const queue: Array<{ kind: "voice_call" | "meeting"; row: VoiceCallRow | MeetingRow }> = [];
  const maxLen = Math.max(voicePending.length, meetingPending.length);
  for (let i = 0; i < maxLen && queue.length < PER_TICK_LIMIT; i++) {
    if (voicePending[i]) queue.push({ kind: "voice_call", row: voicePending[i] });
    if (queue.length >= PER_TICK_LIMIT) break;
    if (meetingPending[i]) queue.push({ kind: "meeting", row: meetingPending[i] });
  }

  let processed = 0;
  let failed = 0;
  let totalCostUsd = 0;
  const errors: Array<{ kind: string; id: string; error: string }> = [];

  for (const item of queue) {
    try {
      if (item.kind === "voice_call") {
        const r = item.row as VoiceCallRow;
        if (!r.transcript) continue;
        const analysis = await analyzeCall({
          transcript: r.transcript,
          duration_seconds: Number(r.duration_seconds || 0),
          participants: [r.from_number || "caller", r.to_number || "rep"],
          userId: r.profile_id,
          context: "/api/cron/auto-analyze-calls:voice_call",
        });
        const { error: insertErr } = await service.from("coach_analyses").insert({
          user_id: r.profile_id,
          source_type: "voice_call",
          source_id: r.id,
          rep_id: null,
          metrics: analysis.metrics,
          insights: analysis.insights,
          next_actions: analysis.next_actions,
          overall_score: analysis.overall_score,
          cost_usd: analysis.cost_usd,
        });
        if (insertErr) throw insertErr;
        totalCostUsd += analysis.cost_usd;
        processed += 1;
      } else {
        const r = item.row as MeetingRow;
        if (!r.transcript_raw) continue;
        const segments = Array.isArray(r.transcript_speaker_labeled)
          ? (r.transcript_speaker_labeled as Array<{
              start: number;
              end: number;
              speaker?: string;
              text: string;
            }>)
          : undefined;
        const participants = Array.isArray(r.participants)
          ? (r.participants as string[])
          : [];
        const analysis = await analyzeCall({
          transcript: r.transcript_raw,
          duration_seconds: Number(r.duration_seconds || 0),
          segments,
          participants,
          userId: r.created_by,
          context: "/api/cron/auto-analyze-calls:meeting",
        });
        const { error: insertErr } = await service.from("coach_analyses").insert({
          user_id: r.created_by,
          source_type: "meeting",
          source_id: r.id,
          rep_id: r.created_by,
          metrics: analysis.metrics,
          insights: analysis.insights,
          next_actions: analysis.next_actions,
          overall_score: analysis.overall_score,
          cost_usd: analysis.cost_usd,
        });
        if (insertErr) throw insertErr;
        totalCostUsd += analysis.cost_usd;
        processed += 1;
      }
    } catch (err) {
      failed += 1;
      const message = err instanceof Error ? err.message : String(err);
      errors.push({ kind: item.kind, id: item.row.id, error: message.slice(0, 200) });
      console.error("[cron/auto-analyze-calls] item failed", item.kind, item.row.id, err);
    }
  }

  return NextResponse.json({
    ok: true,
    queue_size: queue.length,
    processed,
    failed,
    total_cost_usd: Math.round(totalCostUsd * 10000) / 10000,
    errors,
    timestamp: new Date().toISOString(),
  });
}
