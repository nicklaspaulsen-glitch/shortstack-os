/**
 * Activity Feed — event emitter helper.
 *
 * Writes a row into `activity_events`. Intentionally SOFT-FAILS: if the table
 * does not yet exist (cold-start / migration-not-applied) or any other insert
 * error occurs, the helper swallows it so it never breaks the calling API.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { createServiceClient } from "@/lib/supabase/server";

export type ActivityEventType =
  | "asset_created"
  | "asset_derived"
  | "project_launched"
  | "project_completed"
  | "milestone_hit"
  | "client_approved"
  | "client_requested_revisions"
  | "review_submitted"
  | "review_session_created"
  | "task_completed"
  | "task_assigned"
  | "member_joined"
  | "hire_booked"
  | "post_mortem_published"
  | "scope_flag_raised"
  | "scope_flag_resolved"
  | "weekly_report_sent"
  | "case_study_published";

export type ActivityVisibility = "org" | "project_members" | "public";

export interface EmitEventInput {
  orgId: string;
  actorId?: string | null;
  eventType: ActivityEventType;
  subjectType?: string | null;
  subjectId?: string | null;
  subjectPreview?: Record<string, unknown>;
  projectId?: string | null;
  visibility?: ActivityVisibility;
  supabase?: SupabaseClient;
}

export async function emitEvent(input: EmitEventInput): Promise<string | null> {
  try {
    if (!input.orgId || !input.eventType) return null;
    const supabase = input.supabase ?? createServiceClient();
    const row = {
      org_id: input.orgId,
      actor_id: input.actorId ?? null,
      event_type: input.eventType,
      subject_type: input.subjectType ?? null,
      subject_id: input.subjectId ?? null,
      subject_preview: input.subjectPreview ?? {},
      project_id: input.projectId ?? null,
      visibility: input.visibility ?? "org",
    };
    const { data, error } = await supabase
      .from("activity_events")
      .insert(row)
      .select("id")
      .single();
    if (error) {
      if (process.env.NODE_ENV !== "production") {
        // eslint-disable-next-line no-console
        console.warn("[activity.emit] swallowed error:", error.message);
      }
      return null;
    }
    return data?.id ?? null;
  } catch (err) {
    if (process.env.NODE_ENV !== "production") {
      // eslint-disable-next-line no-console
      console.warn("[activity.emit] swallowed exception:", err);
    }
    return null;
  }
}

export function emitEventAsync(input: EmitEventInput): void {
  // eslint-disable-next-line @typescript-eslint/no-floating-promises
  void emitEvent(input);
}
