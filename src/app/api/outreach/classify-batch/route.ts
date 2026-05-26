/**
 * POST /api/outreach/classify-batch
 *
 * Worker endpoint that pulls up to N (default 25) `outreach_outcome_cache`
 * rows where outcome='unknown', LLM-classifies each, and writes the result
 * back. Hard-capped to 25 per call so a backlog can't blow the LLM budget.
 *
 * Auth: dual-mode.
 *   - Bearer ${CRON_SECRET}  -> cron / scheduler
 *   - Cookie session         -> manual run from the UI ("Refresh outcomes")
 *
 * The classifier reads the source row (voice_calls/outreach_log/conversation_messages),
 * pulls a 200-token snippet, and asks Claude/Llama for a JSON outcome.
 */
import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase, createServiceClient } from "@/lib/supabase/server";
import { getEffectiveOwnerId } from "@/lib/security/require-owned-client";
import { classifyOutcome } from "@/lib/outreach/classify";
import { reportError } from "@/lib/observability/error-reporter";
import { secureCompare } from "@/lib/security/ssrf-guard";
import type { OutreachChannel, OutreachOutcome } from "@/lib/outreach/types";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

const PER_TICK_LIMIT = 25;

interface CacheRow {
  id: string;
  agency_owner_id: string;
  channel: OutreachChannel;
  source_id: string;
}

interface BodyShape {
  channel: string;
  body: string;
  transcript?: string;
}

async function fetchSourceContent(
  serviceSupabase: ReturnType<typeof createServiceClient>,
  channel: OutreachChannel,
  sourceId: string,
): Promise<BodyShape | null> {
  if (channel === "voice_call") {
    const { data } = await serviceSupabase
      .from("voice_calls")
      .select("transcript, duration_seconds")
      .eq("id", sourceId)
      .single();
    if (!data) return null;
    return {
      channel: "voice_call",
      body: data.transcript ? data.transcript.slice(0, 200) : "Voice call (no transcript)",
      transcript: data.transcript || undefined,
    };
  }
  if (channel === "email" || channel === "sms" || channel === "dm") {
    // Try outreach_log first.
    const { data: log } = await serviceSupabase
      .from("outreach_log")
      .select("message_text, reply_text, status")
      .eq("id", sourceId)
      .single();
    if (log) {
      const body = log.reply_text || log.message_text || "";
      return { channel, body };
    }
    // Fall back to conversation_messages.
    const { data: msg } = await serviceSupabase
      .from("conversation_messages")
      .select("body")
      .eq("id", sourceId)
      .single();
    if (msg) return { channel, body: msg.body || "" };
  }
  return null;
}

interface BatchResult {
  attempted: number;
  classified: number;
  failed: number;
}

async function runBatch(
  serviceSupabase: ReturnType<typeof createServiceClient>,
  ownerScope: string | null,
): Promise<BatchResult> {
  let query = serviceSupabase
    .from("outreach_outcome_cache")
    .select("id, agency_owner_id, channel, source_id")
    .eq("outcome", "unknown")
    .order("computed_at", { ascending: true })
    .limit(PER_TICK_LIMIT);
  if (ownerScope) query = query.eq("agency_owner_id", ownerScope);

  const { data, error } = await query;
  if (error) throw new Error(error.message);

  const rows = (data || []) as CacheRow[];
  let classified = 0;
  let failed = 0;
  for (const row of rows) {
    try {
      const content = await fetchSourceContent(serviceSupabase, row.channel, row.source_id);
      if (!content || (!content.body && !content.transcript)) {
        // Mark as classified-but-empty so we don't loop on it.
        await serviceSupabase
          .from("outreach_outcome_cache")
          .update({ outcome: "unknown" as OutreachOutcome, summary: "", computed_at: new Date().toISOString() })
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
        reportError(updateErr, {
          route: "classify-batch",
          component: "update",
          reason: "supabase",
        });
        continue;
      }
      classified++;
    } catch (err) {
      failed++;
      reportError(err, {
        route: "classify-batch",
        component: "iteration",
        reason: "loop-failure",
      });
    }
  }
  return { attempted: rows.length, classified, failed };
}

export async function POST(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = request.headers.get("authorization");
  const rawToken = authHeader?.replace(/^Bearer\s+/i, "") ?? "";
  const isCron = cronSecret ? secureCompare(rawToken, cronSecret) : false;

  let ownerScope: string | null = null;
  if (!isCron) {
    const supabase = createServerSupabase();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const ownerId = await getEffectiveOwnerId(supabase, user.id);
    if (!ownerId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    ownerScope = ownerId;
  }

  const serviceSupabase = createServiceClient();
  try {
    const result = await runBatch(serviceSupabase, ownerScope);
    return NextResponse.json({ success: true, ...result });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Batch failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
