import { NextRequest, NextResponse } from "next/server";
import { resolveReviewSession } from "@/lib/review/auth";

// PATCH /api/review/sessions/[id]/comments/[commentId] — resolve/unresolve, edit
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string; commentId: string } },
) {
  const access = await resolveReviewSession(request, params.id);
  if (!access) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Only agency can resolve comments
  if (access.mode !== "agency")
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  let body: { resolved?: unknown; content?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const patch: Record<string, unknown> = {};
  if (typeof body.resolved === "boolean") {
    patch.resolved = body.resolved;
    patch.resolved_at = body.resolved ? new Date().toISOString() : null;
    patch.resolved_by = body.resolved ? access.userId : null;
  }
  if (typeof body.content === "string" && body.content.trim()) {
    patch.content = body.content.trim();
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
  }

  const { data, error } = await access.supabase
    .from("review_comments")
    .update(patch)
    .eq("id", params.commentId)
    .eq("session_id", params.id)
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({ comment: data });
}

// DELETE /api/review/sessions/[id]/comments/[commentId]
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string; commentId: string } },
) {
  const access = await resolveReviewSession(request, params.id);
  if (!access) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (access.mode !== "agency")
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { error } = await access.supabase
    .from("review_comments")
    .delete()
    .eq("id", params.commentId)
    .eq("session_id", params.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
