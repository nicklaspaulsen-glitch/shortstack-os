/**
 * Shared completion helpers for transcription jobs.
 *
 * Used by:
 *   - /api/meetings/[id]/transcribe (sync path) — same shape, no job row
 *     needed when the provider completes inline.
 *   - /api/cron/poll-transcription-jobs (async path) — polls pending RunPod
 *     jobs and writes the finished transcript back to the source table.
 *
 * Source-table contract:
 *   - meetings → transcript_raw + transcript_speaker_labeled (jsonb segments
 *     array). Mirrors the existing Whisper helper output shape so existing
 *     UI code keeps working.
 *   - voice_calls → transcript (text). No speaker labels (Twilio call legs
 *     are single-speaker-side recordings).
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { TranscribeResult } from "./provider";

export type TranscriptionSourceTable = "meetings" | "voice_calls";

/**
 * The legacy meetings.transcript_speaker_labeled jsonb shape. Kept stable so
 * the coach metrics module + meeting transcript view don't need migrating.
 */
export interface MeetingTranscriptSegment {
  id?: number;
  start: number;
  end: number;
  text: string;
  speaker?: string;
  confidence?: number;
}

function toMeetingSegments(result: TranscribeResult): MeetingTranscriptSegment[] {
  return result.segments.map((seg, idx) => ({
    id: idx,
    start: seg.start,
    end: seg.end,
    text: seg.text,
    // For diarized output we keep the SPEAKER_xx label as-is; the coach
    // metrics module already handles the "Speaker 1 / SPEAKER_00" pattern.
    speaker: seg.speaker,
    confidence: seg.confidence,
  }));
}

/**
 * Write a finished TranscribeResult back to the originating source row.
 * Returns true on success, false on db error (caller logs).
 */
export async function writeTranscriptToSource(args: {
  supabase: SupabaseClient;
  sourceTable: TranscriptionSourceTable;
  sourceId: string;
  result: TranscribeResult;
}): Promise<boolean> {
  const { supabase, sourceTable, sourceId, result } = args;

  if (sourceTable === "meetings") {
    const segments = toMeetingSegments(result);
    const { error } = await supabase
      .from("meetings")
      .update({
        transcript_raw: result.text,
        transcript_speaker_labeled: segments,
        duration_seconds: result.duration_seconds || null,
        status: "ready",
        cost_usd: result.cost_usd ?? 0,
      })
      .eq("id", sourceId);
    if (error) {
      console.error("[transcription/completion] meetings update failed", error);
      return false;
    }
    return true;
  }

  if (sourceTable === "voice_calls") {
    // Voice calls are single-speaker-side recordings — store flat text.
    const { error } = await supabase
      .from("voice_calls")
      .update({
        transcript: result.text,
        duration_seconds: result.duration_seconds || null,
      })
      .eq("id", sourceId);
    if (error) {
      console.error("[transcription/completion] voice_calls update failed", error);
      return false;
    }
    return true;
  }

  console.warn("[transcription/completion] unknown source_table", sourceTable);
  return false;
}
