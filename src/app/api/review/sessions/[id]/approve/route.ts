import { NextRequest, NextResponse } from "next/server";
import { resolveReviewSession, enqueueReviewNotification } from "@/lib/review/auth";

// POST /api/review/sessions/[id]/approve
// Body: { approved_by_name?, request_revisions?: bool, revision_notes? }
//
// Approvable from either authenticated agency or anonymous client (magic link).
// When request_revisions=true, flips status to revisions_requested and creates
// a summary comment + notification.
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  const access = await resolveReviewSession(request, params.id);
  if (!access) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: {
    approved_by_name?: unknown;
    request_revisions?: unknown;
    revision_notes?: unknown;
  };
  try {
    body = await request.json();
  } catch {
    body = {};
  }

  const requestRevisions = body.request_revisions === true;
  const approvedByName =
    typeof body.approved_by_name === "string" ? body.approved_by_name.trim() : null;
  const revisionNotes =
    typeof body.revision_notes === "string" ? body.revision_notes.trim() : "";

  if (requestRevisions) {
    const { data, error } = await access.supabase
      .from("review_sessions")
      .update({ status: "revisions_requested" })
      .eq("id", params.id)
      .select()
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    if (revisionNotes) {
      await access.supabase.from("review_comments").insert({
        session_id: params.id,
        version: access.session.version,
        author_id: access.userId,
        author_name: approvedByName || (access.mode === "agency" ? "Agency" : "Client"),
        content: `[Revisions requested]\n${revisionNotes}`,
      });
    }

    await enqueueReviewNotification(access.supabase, {
      to_user_id: access.session.created_by,
      subject: `Revisions requested on "${access.session.title}"`,
      body:
        revisionNotes || `${approvedByName || "Client"} requested revisions.`,
      session_id: access.session.id,
      kind: "revisions_requested",
    });

    return NextResponse.json({ session: data });
  }

  // Approve path
  const { data, error } = await access.supabase
    .from("review_sessions")
    .update({
      status: "approved",
      approved_at: new Date().toISOString(),
      approved_by_name: approvedByName,
    })
    .eq("id", params.id)
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await enqueueReviewNotification(access.supabase, {
    to_user_id: access.session.created_by,
    subject: `"${access.session.title}" was approved`,
    body: `${approvedByName || "Client"} approved version ${access.session.version}.`,
    session_id: access.session.id,
    kind: "approved",
  });

  return NextResponse.json({ session: data });
}
