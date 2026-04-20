import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase, createServiceClient } from "@/lib/supabase/server";
import { getEffectiveOwnerId } from "@/lib/security/require-owned-client";
import { logFeedback } from "@/lib/ai-edit-preferences";
import type { Suggestion } from "@/lib/auto-edit-types";

/**
 * POST /api/video/auto-edit/apply
 *
 * Accept a subset of previously-generated Suggestions and write them into the
 * project's timeline JSON. Also logs each acceptance to `ai_edit_feedback` so
 * the preference loop can use the decision on the next suggestion call.
 *
 * Body: { project_id, suggestion_ids: string[], suggestions?: Suggestion[], rejected_suggestions?: Suggestion[] }
 *
 * The `suggestions` and `rejected_suggestions` arrays are optional — when
 * provided they are used to write feedback rows. If the caller only has
 * `suggestion_ids`, we accept the IDs and log them (as accepted) but the
 * feedback rows won't include payload context (still useful for tracking
 * raw accept counts).
 *
 * No Claude call — no token cost. Writes to `video_projects.editor_settings`
 * under the `auto_edit_timeline` key.
 */

export const maxDuration = 30;

interface ApplyInput {
  project_id?: string;
  suggestion_ids?: unknown;
  suggestions?: unknown;
  rejected_suggestions?: unknown;
}

interface TimelineEntry {
  id: string;
  timestamp_sec: number;
  type: string;
  payload: Record<string, unknown>;
  confidence: number;
  reasoning: string;
  scene_index?: number;
  accepted_at: string;
}

function toSuggestion(raw: unknown): Suggestion | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  if (typeof r.id !== "string" || typeof r.type !== "string") return null;
  return {
    id: r.id,
    timestamp_sec: typeof r.timestamp_sec === "number" ? r.timestamp_sec : 0,
    type: r.type as Suggestion["type"],
    payload:
      r.payload && typeof r.payload === "object"
        ? (r.payload as Record<string, unknown>)
        : {},
    confidence:
      typeof r.confidence === "number" ? Math.max(0, Math.min(1, r.confidence)) : 0.5,
    reasoning: typeof r.reasoning === "string" ? r.reasoning : "",
    scene_index:
      typeof r.scene_index === "number" ? Math.floor(r.scene_index) : undefined,
  };
}

export async function POST(request: NextRequest) {
  const supabase = createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const ownerId = await getEffectiveOwnerId(supabase, user.id);
  if (!ownerId) {
    return NextResponse.json({ ok: false, error: "Profile not found" }, { status: 403 });
  }

  let body: ApplyInput;
  try {
    body = (await request.json()) as ApplyInput;
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON body" }, { status: 400 });
  }

  const projectId =
    typeof body.project_id === "string" && body.project_id.trim()
      ? body.project_id.trim()
      : "";
  if (!projectId) {
    return NextResponse.json(
      { ok: false, error: "project_id is required" },
      { status: 400 },
    );
  }

  const suggestionIds = Array.isArray(body.suggestion_ids)
    ? body.suggestion_ids.filter((v): v is string => typeof v === "string")
    : [];
  if (suggestionIds.length === 0) {
    return NextResponse.json(
      { ok: false, error: "suggestion_ids[] is required" },
      { status: 400 },
    );
  }

  const allSuggestions: Suggestion[] = Array.isArray(body.suggestions)
    ? (body.suggestions as unknown[])
        .map(toSuggestion)
        .filter((s): s is Suggestion => !!s)
    : [];

  const rejectedSuggestions: Suggestion[] = Array.isArray(body.rejected_suggestions)
    ? (body.rejected_suggestions as unknown[])
        .map(toSuggestion)
        .filter((s): s is Suggestion => !!s)
    : [];

  // Enforce ownership on the project.
  const db = createServiceClient();
  const { data: project, error: projErr } = await db
    .from("video_projects")
    .select("id, profile_id, editor_settings")
    .eq("id", projectId)
    .maybeSingle();
  if (projErr || !project) {
    return NextResponse.json(
      { ok: false, error: "Project not found" },
      { status: 404 },
    );
  }
  if ((project as { profile_id: string }).profile_id !== user.id) {
    return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
  }

  // Build accepted timeline entries. If caller provided full suggestions we
  // use those; otherwise we create minimal placeholder entries from IDs.
  const idSet = new Set(suggestionIds);
  const acceptedFull = allSuggestions.filter((s) => idSet.has(s.id));
  const now = new Date().toISOString();
  const newEntries: TimelineEntry[] =
    acceptedFull.length > 0
      ? acceptedFull.map((s) => ({
          id: s.id,
          timestamp_sec: s.timestamp_sec,
          type: s.type,
          payload: s.payload,
          confidence: s.confidence,
          reasoning: s.reasoning,
          scene_index: s.scene_index,
          accepted_at: now,
        }))
      : suggestionIds.map((id) => ({
          id,
          timestamp_sec: 0,
          type: "unknown",
          payload: {},
          confidence: 0,
          reasoning: "Accepted by ID without payload context.",
          accepted_at: now,
        }));

  // Merge into existing editor_settings.auto_edit_timeline, de-duping by id.
  const existingSettings =
    project && typeof (project as { editor_settings?: unknown }).editor_settings === "object"
      ? ((project as { editor_settings: Record<string, unknown> }).editor_settings) || {}
      : {};
  const existingTimeline = Array.isArray(
    (existingSettings as { auto_edit_timeline?: unknown }).auto_edit_timeline,
  )
    ? ((existingSettings as { auto_edit_timeline: TimelineEntry[] }).auto_edit_timeline)
    : [];
  const mergedById = new Map<string, TimelineEntry>();
  for (const e of existingTimeline) {
    if (e && typeof e.id === "string") mergedById.set(e.id, e);
  }
  for (const e of newEntries) mergedById.set(e.id, e);
  const mergedTimeline = Array.from(mergedById.values()).sort(
    (a, b) => a.timestamp_sec - b.timestamp_sec,
  );

  const newSettings = {
    ...existingSettings,
    auto_edit_timeline: mergedTimeline,
    auto_edit_last_applied_at: now,
  };

  const { error: updErr } = await db
    .from("video_projects")
    .update({ editor_settings: newSettings })
    .eq("id", projectId);
  if (updErr) {
    return NextResponse.json(
      { ok: false, error: "Failed to save timeline", detail: updErr.message },
      { status: 500 },
    );
  }

  // Log feedback for every accepted suggestion (and rejected ones too when
  // the caller bothered to send them). Best-effort — never throws.
  const feedbackWrites: Promise<void>[] = [];
  for (const s of acceptedFull) {
    feedbackWrites.push(
      logFeedback({
        user_id: user.id,
        edit_type: s.type,
        input_context: {
          scene_index: s.scene_index,
          project_id: projectId,
        },
        suggested: {
          type: s.type,
          payload: s.payload,
          timestamp_sec: s.timestamp_sec,
          confidence: s.confidence,
        },
        accepted: true,
      }),
    );
  }
  for (const s of rejectedSuggestions) {
    feedbackWrites.push(
      logFeedback({
        user_id: user.id,
        edit_type: s.type,
        input_context: {
          scene_index: s.scene_index,
          project_id: projectId,
        },
        suggested: {
          type: s.type,
          payload: s.payload,
          timestamp_sec: s.timestamp_sec,
          confidence: s.confidence,
        },
        accepted: false,
      }),
    );
  }
  // If caller only sent IDs (no full suggestion data), still log lightweight
  // "accepted" feedback rows so future prompts see accept counts over time.
  if (acceptedFull.length === 0) {
    for (const id of suggestionIds) {
      feedbackWrites.push(
        logFeedback({
          user_id: user.id,
          edit_type: "accepted_by_id",
          input_context: { project_id: projectId, suggestion_id: id },
          suggested: { id },
          accepted: true,
        }),
      );
    }
  }
  await Promise.all(feedbackWrites).catch(() => {
    // swallow — feedback writes are best-effort
  });

  void db.from("trinity_log").insert({
    action_type: "ai_auto_edit_apply",
    description: `Applied ${newEntries.length} auto-edit suggestions to project ${projectId}`,
    profile_id: user.id,
    status: "completed",
    result: {
      project_id: projectId,
      applied_count: newEntries.length,
      rejected_count: rejectedSuggestions.length,
      total_timeline_entries: mergedTimeline.length,
    },
  });

  return NextResponse.json({
    ok: true,
    project_id: projectId,
    applied_count: newEntries.length,
    total_timeline_entries: mergedTimeline.length,
    rejected_logged: rejectedSuggestions.length,
  });
}
