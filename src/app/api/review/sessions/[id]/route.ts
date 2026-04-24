import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import type { ReviewStatus } from "@/lib/review/types";

const STATUSES: ReviewStatus[] = [
  "pending",
  "in_review",
  "approved",
  "revisions_requested",
  "archived",
];

async function authed(id: string) {
  const supabase = createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Unauthorized", status: 401 as const, supabase, user: null };

  const { data: session } = await supabase
    .from("review_sessions")
    .select("*")
    .eq("id", id)
    .single();
  if (!session) return { error: "Not found", status: 404 as const, supabase, user };
  if (session.created_by !== user.id)
    return { error: "Forbidden", status: 403 as const, supabase, user };

  return { supabase, user, session, status: 200 as const };
}

// GET /api/review/sessions/[id] — full session details + versions + comment counts
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const ctx = await authed(params.id);
  if ("error" in ctx && ctx.error)
    return NextResponse.json({ error: ctx.error }, { status: ctx.status });

  const { supabase, session } = ctx;

  const [versionsRes, commentsRes] = await Promise.all([
    supabase
      .from("review_versions")
      .select("*")
      .eq("session_id", session!.id)
      .order("version", { ascending: false }),
    supabase
      .from("review_comments")
      .select("*")
      .eq("session_id", session!.id)
      .order("created_at", { ascending: true }),
  ]);

  return NextResponse.json({
    session,
    versions: versionsRes.data ?? [],
    comments: commentsRes.data ?? [],
  });
}

// PATCH /api/review/sessions/[id] — update status (approve/revisions/etc) or title
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  const ctx = await authed(params.id);
  if ("error" in ctx && ctx.error)
    return NextResponse.json({ error: ctx.error }, { status: ctx.status });

  const { supabase, session } = ctx;

  let body: { status?: unknown; title?: unknown; approved_by_name?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const patch: Record<string, unknown> = {};
  if (typeof body.status === "string") {
    if (!STATUSES.includes(body.status as ReviewStatus)) {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 });
    }
    patch.status = body.status;
    if (body.status === "approved") {
      patch.approved_at = new Date().toISOString();
      if (typeof body.approved_by_name === "string") {
        patch.approved_by_name = body.approved_by_name;
      }
    }
  }
  if (typeof body.title === "string" && body.title.trim()) {
    patch.title = body.title.trim();
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("review_sessions")
    .update(patch)
    .eq("id", session!.id)
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ session: data });
}

// DELETE /api/review/sessions/[id] — archive (soft delete)
export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  const ctx = await authed(params.id);
  if ("error" in ctx && ctx.error)
    return NextResponse.json({ error: ctx.error }, { status: ctx.status });

  const { supabase, session } = ctx;
  const { error } = await supabase
    .from("review_sessions")
    .update({ status: "archived" })
    .eq("id", session!.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
