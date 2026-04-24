import { NextRequest, NextResponse } from "next/server";
import { resolveReviewSession, enqueueReviewNotification } from "@/lib/review/auth";

// GET /api/review/sessions/[id]/comments — list comments, optionally scoped by version
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  const access = await resolveReviewSession(request, params.id);
  if (!access) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const version = searchParams.get("version");

  let q = access.supabase
    .from("review_comments")
    .select("*")
    .eq("session_id", params.id)
    .order("created_at", { ascending: true });
  if (version) q = q.eq("version", Number(version));

  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ comments: data ?? [] });
}

// POST /api/review/sessions/[id]/comments — add a comment (agency or anon-via-magic)
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  const access = await resolveReviewSession(request, params.id);
  if (!access) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: {
    content?: unknown;
    version?: unknown;
    author_name?: unknown;
    author_email?: unknown;
    timestamp_seconds?: unknown;
    region?: unknown;
    page_number?: unknown;
    thread_parent_id?: unknown;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const content = typeof body.content === "string" ? body.content.trim() : "";
  if (!content) return NextResponse.json({ error: "content is required" }, { status: 400 });

  const version =
    typeof body.version === "number" ? body.version : access.session.version;
  const authorName =
    typeof body.author_name === "string" && body.author_name.trim()
      ? body.author_name.trim()
      : access.mode === "agency"
        ? "Agency"
        : "";
  if (!authorName)
    return NextResponse.json({ error: "author_name is required" }, { status: 400 });

  const authorEmail =
    typeof body.author_email === "string" ? body.author_email : null;

  const timestampSeconds =
    typeof body.timestamp_seconds === "number" ? body.timestamp_seconds : null;
  const region = body.region && typeof body.region === "object" ? body.region : null;
  const pageNumber =
    typeof body.page_number === "number" ? body.page_number : null;
  const threadParentId =
    typeof body.thread_parent_id === "string" ? body.thread_parent_id : null;

  const insert: Record<string, unknown> = {
    session_id: params.id,
    version,
    author_id: access.userId,
    author_name: authorName,
    author_email: authorEmail,
    content,
    timestamp_seconds: timestampSeconds,
    region,
    page_number: pageNumber,
    thread_parent_id: threadParentId,
  };

  const { data, error } = await access.supabase
    .from("review_comments")
    .insert(insert)
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // If the commenter is anonymous (magic-link), enqueue a notification for
  // the agency owner. Also move the session into in_review if still pending.
  if (access.mode === "magic") {
    await enqueueReviewNotification(access.supabase, {
      to_user_id: access.session.created_by,
      subject: `New review comment on "${access.session.title}"`,
      body: `${authorName} left a comment: ${content}`,
      session_id: access.session.id,
      kind: "new_comment",
    });
    if (access.session.status === "pending") {
      await access.supabase
        .from("review_sessions")
        .update({ status: "in_review" })
        .eq("id", access.session.id);
    }
  }

  return NextResponse.json({ comment: data }, { status: 201 });
}
