/**
 * POST /api/meetings/[id]/sync-to-crm
 *
 * Pushes the meeting summary + action items into the linked lead's CRM
 * record. Two writes:
 *   1. A `lead_notes` row with the summary + decisions block
 *   2. One `lead_follow_ups` row per open action item that has a `due` date
 *
 * Idempotent-ish: subsequent syncs append a new note rather than mutating
 * the existing one. Sets `meetings.synced_to_crm_at` on success so the UI
 * can show "Last synced 5 min ago".
 *
 * Requires the meeting to have a `lead_id` set. Caller picks the lead via
 * the dashboard side-panel before clicking "Sync to CRM".
 */
import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { getEffectiveOwnerId } from "@/lib/security/require-owned-client";

interface ActionItemRow {
  text: string;
  assignee?: string;
  due?: string | null;
  done?: boolean;
}

interface DecisionRow {
  text: string;
  context?: string;
}

export async function POST(
  _request: NextRequest,
  { params }: { params: { id: string } },
) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const ownerId = await getEffectiveOwnerId(supabase, user.id);
  if (!ownerId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { data: meeting, error: fetchErr } = await supabase
    .from("meetings")
    .select(
      "id, title, lead_id, summary, action_items, decisions, created_at, scheduled_at",
    )
    .eq("id", params.id)
    .eq("created_by", user.id)
    .maybeSingle();
  if (fetchErr) {
    return NextResponse.json({ error: fetchErr.message }, { status: 500 });
  }
  if (!meeting) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!meeting.lead_id) {
    return NextResponse.json(
      { error: "Link the meeting to a contact first" },
      { status: 400 },
    );
  }
  if (!meeting.summary) {
    return NextResponse.json(
      { error: "Run analysis to generate a summary before syncing" },
      { status: 400 },
    );
  }

  // Confirm the lead belongs to the agency.
  const { data: lead } = await supabase
    .from("leads")
    .select("id, user_id")
    .eq("id", meeting.lead_id)
    .maybeSingle();
  if (!lead || lead.user_id !== ownerId) {
    return NextResponse.json({ error: "Lead not found in workspace" }, { status: 404 });
  }

  // Build the note body. Keep it compact — the activity feed renders
  // these inline, so multi-paragraph noise is annoying.
  const decisions = Array.isArray(meeting.decisions)
    ? (meeting.decisions as DecisionRow[])
    : [];
  const actionItems = Array.isArray(meeting.action_items)
    ? (meeting.action_items as ActionItemRow[])
    : [];

  const meetingDate = (meeting.scheduled_at || meeting.created_at || "").slice(0, 10);
  const lines = [
    `Meeting: ${meeting.title} (${meetingDate})`,
    "",
    "Summary:",
    meeting.summary,
  ];
  if (decisions.length > 0) {
    lines.push("", "Decisions:");
    decisions.forEach((d) => lines.push(`- ${d.text}`));
  }
  if (actionItems.length > 0) {
    lines.push("", "Action items:");
    actionItems.forEach((a) => {
      const who = a.assignee ? ` (${a.assignee})` : "";
      const when = a.due ? ` — due ${a.due}` : "";
      lines.push(`- ${a.text}${who}${when}`);
    });
  }
  const noteBody = lines.join("\n");

  const { data: note, error: noteErr } = await supabase
    .from("lead_notes")
    .insert({
      profile_id: ownerId,
      lead_id: meeting.lead_id,
      body: noteBody,
    })
    .select()
    .single();
  if (noteErr) {
    console.error("[meetings/sync] note insert error:", noteErr);
    return NextResponse.json({ error: noteErr.message }, { status: 500 });
  }

  // Create one follow-up per open action item with a due date.
  const followUps = actionItems
    .filter((a) => !a.done && a.due)
    .map((a) => ({
      profile_id: ownerId,
      lead_id: meeting.lead_id!,
      // lead_follow_ups expects a timestamp; coerce date → start of day.
      scheduled_for: new Date(`${a.due}T09:00:00.000Z`).toISOString(),
      channel: "manual" as const,
      message: a.text,
      status: "pending" as const,
    }));

  let createdFollowUps = 0;
  if (followUps.length > 0) {
    const { error: followErr } = await supabase
      .from("lead_follow_ups")
      .insert(followUps);
    if (followErr) {
      console.error("[meetings/sync] follow-up insert error:", followErr);
      // Note already saved — don't 500 the whole sync; just report partial.
    } else {
      createdFollowUps = followUps.length;
    }
  }

  await supabase
    .from("meetings")
    .update({ synced_to_crm_at: new Date().toISOString() })
    .eq("id", params.id)
    .eq("created_by", user.id);

  return NextResponse.json({
    success: true,
    note_id: note.id,
    follow_ups_created: createdFollowUps,
    note_body_preview: noteBody.slice(0, 200),
  });
}
