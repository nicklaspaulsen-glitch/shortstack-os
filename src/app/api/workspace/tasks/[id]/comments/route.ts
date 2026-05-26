import { NextRequest, NextResponse } from "next/server";
import {
  createServerSupabase,
  createServiceClient,
} from "@/lib/supabase/server";
import {
  createCommentSchema,
  extractMentions,
  type WorkspaceTaskComment,
} from "@/lib/workspace/board";

export const dynamic = "force-dynamic";

/**
 * POST /api/workspace/tasks/[id]/comments
 *
 * Create a comment on a task. Mentions are extracted from the body
 * (`@[Display Name](uuid)` markdown anchors); each unique mentioned profile
 * gets a notifications row inserted via the service client so a team
 * member can ping the agency owner without RLS blocking the insert.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  const supabase = createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = createCommentSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const { body, mentions: explicitMentions } = parsed.data;
  // Prefer explicit mentions when the client passes them; fall back to
  // body parsing. Both pathways converge on the same uuid[] format.
  const mentions = explicitMentions ?? extractMentions(body);

  const { data: comment, error } = await supabase
    .from("workspace_task_comments")
    .insert({
      task_id: params.id,
      author_id: user.id,
      body,
      mentions,
    })
    .select()
    .single();

  if (error) {
    console.error("[workspace-board] comment insert error", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }

  // Fan out @mention notifications. Failure here must NOT block the comment
  // create — we already surfaced 201 to the user via the comment row.
  if (mentions.length > 0) {
    try {
      // Pull task title for richer notification body.
      const { data: task } = await supabase
        .from("workspace_tasks")
        .select("title")
        .eq("id", params.id)
        .maybeSingle();

      const title = (task?.title as string | undefined) ?? "a task";

      // Use service client because the recipients aren't necessarily owned
      // by the calling user (a team_member mentioning the agency owner).
      const service = createServiceClient();
      const rows = mentions
        .filter((m) => m !== user.id) // don't notify yourself
        .map((m) => ({
          user_id: m,
          title: "You were mentioned",
          message: `New comment on "${title}"`,
          type: "mention",
          link: `/dashboard/workspace/board?task=${params.id}`,
          read: false,
        }));
      if (rows.length > 0) {
        await service.from("notifications").insert(rows);
      }
    } catch (err) {
      console.error("[workspace-board] mention fanout failed", err);
    }
  }

  return NextResponse.json(
    { comment: comment as WorkspaceTaskComment },
    { status: 201 },
  );
}
