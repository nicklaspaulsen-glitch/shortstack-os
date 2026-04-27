/**
 * POST /api/coach/analyze
 *
 * Body: { source_type: "voice_call" | "meeting" | "email_thread", source_id: uuid, rep_id?: uuid }
 *
 * Loads the source row (voice_calls / meetings / outreach_log), runs the
 * appropriate analyzer, and persists the result to `coach_analyses`. Always
 * scoped to the authenticated user via `getEffectiveOwnerId`.
 *
 * Idempotent in the sense that a fresh analysis always overwrites the most
 * recent row for a given (source_type, source_id) — coaches re-run when the
 * transcript is updated.
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  createServerSupabase,
  createServiceClient,
} from "@/lib/supabase/server";
import { getEffectiveOwnerId } from "@/lib/security/require-owned-client";
import { analyzeCall } from "@/lib/coach/analyzer";
import { analyzeEmailThread, type EmailMessage } from "@/lib/coach/email-analyzer";

export const maxDuration = 120;
export const dynamic = "force-dynamic";

const requestSchema = z.object({
  source_type: z.enum(["voice_call", "meeting", "email_thread"]),
  source_id: z.string().uuid(),
  rep_id: z.string().uuid().optional().nullable(),
});

interface OutreachRow {
  id: string;
  lead_id: string | null;
  business_name: string | null;
  recipient_handle: string | null;
  message_text: string | null;
  reply_text: string | null;
  sent_at: string | null;
  replied_at: string | null;
  created_at: string;
}

export async function POST(request: NextRequest) {
  const supabase = createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const ownerId = await getEffectiveOwnerId(supabase, user.id);
  if (!ownerId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const { source_type, source_id, rep_id } = parsed.data;
  const service = createServiceClient();

  try {
    let analysis;
    let resolvedRepId: string | null = rep_id ?? null;

    if (source_type === "voice_call") {
      const { data, error } = await service
        .from("voice_calls")
        .select(
          "id, profile_id, transcript, duration_seconds, from_number, to_number, started_at",
        )
        .eq("id", source_id)
        .maybeSingle();
      if (error || !data) {
        return NextResponse.json(
          { error: "Source voice_call not found" },
          { status: 404 },
        );
      }
      if (data.profile_id !== ownerId) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
      if (!data.transcript || data.transcript.trim().length < 20) {
        return NextResponse.json(
          { error: "Transcript missing or too short to analyze" },
          { status: 400 },
        );
      }
      analysis = await analyzeCall({
        transcript: data.transcript,
        duration_seconds: Number(data.duration_seconds || 0),
        participants: [data.from_number || "caller", data.to_number || "rep"],
        userId: ownerId,
        context: "/api/coach/analyze:voice_call",
      });
    } else if (source_type === "meeting") {
      const { data, error } = await service
        .from("meetings")
        .select(
          "id, created_by, transcript_raw, transcript_speaker_labeled, duration_seconds, participants",
        )
        .eq("id", source_id)
        .maybeSingle();
      if (error || !data) {
        return NextResponse.json(
          { error: "Source meeting not found" },
          { status: 404 },
        );
      }
      if (data.created_by !== ownerId) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
      if (!data.transcript_raw || data.transcript_raw.trim().length < 20) {
        return NextResponse.json(
          { error: "Transcript missing or too short to analyze" },
          { status: 400 },
        );
      }
      const segments = Array.isArray(data.transcript_speaker_labeled)
        ? (data.transcript_speaker_labeled as Array<{
            start: number;
            end: number;
            speaker?: string;
            text: string;
          }>)
        : undefined;
      const participantList = Array.isArray(data.participants)
        ? (data.participants as string[])
        : [];
      analysis = await analyzeCall({
        transcript: data.transcript_raw,
        duration_seconds: Number(data.duration_seconds || 0),
        segments,
        participants: participantList,
        userId: ownerId,
        context: "/api/coach/analyze:meeting",
      });
      // Default rep_id to meeting owner when not provided.
      if (!resolvedRepId) resolvedRepId = data.created_by;
    } else {
      // email_thread → load every outreach_log row tied to this lead, ordered
      // by created_at. `source_id` is interpreted as a lead_id for threads.
      const { data: rows, error } = await service
        .from("outreach_log")
        .select(
          "id, lead_id, business_name, recipient_handle, message_text, reply_text, sent_at, replied_at, created_at",
        )
        .eq("lead_id", source_id)
        .order("created_at", { ascending: true })
        .limit(50);
      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
      if (!rows || rows.length === 0) {
        return NextResponse.json(
          { error: "No email thread found for source_id" },
          { status: 404 },
        );
      }

      // Verify lead ownership (defense-in-depth — RLS already gates the
      // service client read above, but profile_id ≠ lead.* schema doesn't
      // include profile_id directly so we cross-check via leads).
      const { data: lead } = await service
        .from("leads")
        .select("id, profile_id")
        .eq("id", source_id)
        .maybeSingle();
      if (!lead || lead.profile_id !== ownerId) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }

      const emails: EmailMessage[] = (rows as OutreachRow[]).flatMap((r) => {
        const out: EmailMessage[] = [];
        if (r.message_text) {
          out.push({
            from: "rep",
            direction: "outbound",
            sent_at: r.sent_at || r.created_at,
            body: r.message_text,
          });
        }
        if (r.reply_text && r.replied_at) {
          out.push({
            from: r.recipient_handle || "prospect",
            direction: "inbound",
            sent_at: r.replied_at,
            body: r.reply_text,
          });
        }
        return out;
      });

      analysis = await analyzeEmailThread({
        emails,
        userId: ownerId,
        context: "/api/coach/analyze:email_thread",
      });
    }

    // Upsert: keep one row per (source_type, source_id) per user. Cheap delete
    // + insert is simpler than a unique partial index for this scale.
    await service
      .from("coach_analyses")
      .delete()
      .eq("user_id", ownerId)
      .eq("source_type", source_type)
      .eq("source_id", source_id);

    const { data: inserted, error: insertErr } = await service
      .from("coach_analyses")
      .insert({
        user_id: ownerId,
        source_type,
        source_id,
        rep_id: resolvedRepId,
        metrics: analysis.metrics,
        insights: analysis.insights,
        next_actions: analysis.next_actions,
        overall_score: analysis.overall_score,
        cost_usd: analysis.cost_usd,
      })
      .select()
      .single();

    if (insertErr) {
      console.error("[coach/analyze] insert error", insertErr);
      return NextResponse.json({ error: insertErr.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, analysis: inserted });
  } catch (err) {
    console.error("[coach/analyze] failed", err);
    const message = err instanceof Error ? err.message : "Analysis failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
