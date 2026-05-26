/**
 * GET /api/cron/classify-outreach
 *
 * Cron-driven worker that processes the `outreach_outcome_cache` backlog.
 * Runs every 5 minutes (vercel.json) and classifies up to 25 unknown rows
 * per tick across all agency owners. The work itself is delegated to the
 * batch endpoint — this is just a thin auth wrapper that delegates to
 * runBatch with no owner scope.
 *
 * Auth: Bearer ${CRON_SECRET} only. 401 otherwise. Same pattern as every
 * other cron in this repo.
 */
import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { classifyOutcome } from "@/lib/outreach/classify";
import { reportError } from "@/lib/observability/error-reporter";
import type { OutreachChannel, OutreachOutcome } from "@/lib/outreach/types";
import { secureCompare } from "@/lib/security/ssrf-guard";

export const maxDuration = 120;
export const dynamic = "force-dynamic";

const PER_TICK_LIMIT = 25;

interface CacheRow {
  id: string;
  agency_owner_id: string;
  channel: OutreachChannel;
  source_id: string;
}

async function fetchSourceContent(
  serviceSupabase: ReturnType<typeof createServiceClient>,
  channel: OutreachChannel,
  sourceId: string,
): Promise<{ body: string; transcript?: string } | null> {
  if (channel === "voice_call") {
    const { data } = await serviceSupabase
      .from("voice_calls")
      .select("transcript")
      .eq("id", sourceId)
      .single();
    if (!data) return null;
    return {
      body: data.transcript ? data.transcript.slice(0, 200) : "Voice call (no transcript)",
      transcript: data.transcript || undefined,
    };
  }
  const { data: log } = await serviceSupabase
    .from("outreach_log")
    .select("message_text, reply_text")
    .eq("id", sourceId)
    .single();
  if (log) {
    const body = log.reply_text || log.message_text || "";
    return { body };
  }
  const { data: msg } = await serviceSupabase
    .from("conversation_messages")
    .select("body")
    .eq("id", sourceId)
    .single();
  if (msg) return { body: msg.body || "" };
  return null;
}

export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = request.headers.get("authorization");
  const rawToken = authHeader?.replace(/^Bearer\s+/i, "") ?? "";
  if (!cronSecret || !secureCompare(rawToken, cronSecret)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const serviceSupabase = createServiceClient();
  const { data, error } = await serviceSupabase
    .from("outreach_outcome_cache")
    .select("id, agency_owner_id, channel, source_id")
    .eq("outcome", "unknown")
    .order("computed_at", { ascending: true })
    .limit(PER_TICK_LIMIT);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const rows = (data || []) as CacheRow[];
  let classified = 0;
  let failed = 0;
  for (const row of rows) {
    try {
      const content = await fetchSourceContent(serviceSupabase, row.channel, row.source_id);
      if (!content || (!content.body && !content.transcript)) {
        await serviceSupabase
          .from("outreach_outcome_cache")
          .update({
            outcome: "unknown" as OutreachOutcome,
            summary: "",
            computed_at: new Date().toISOString(),
          })
          .eq("id", row.id);
        continue;
      }
      const result = await classifyOutcome({
        channel: row.channel,
        body: content.body,
        transcript: content.transcript,
        agencyOwnerId: row.agency_owner_id,
      });
      const { error: updateErr } = await serviceSupabase
        .from("outreach_outcome_cache")
        .update({
          outcome: result.outcome,
          summary: result.summary,
          computed_at: new Date().toISOString(),
        })
        .eq("id", row.id);
      if (updateErr) {
        failed++;
        continue;
      }
      classified++;
    } catch (err) {
      failed++;
      reportError(err, {
        route: "cron-classify-outreach",
        component: "iteration",
        reason: "loop-failure",
      });
    }
  }

  return NextResponse.json({ success: true, attempted: rows.length, classified, failed });
}
