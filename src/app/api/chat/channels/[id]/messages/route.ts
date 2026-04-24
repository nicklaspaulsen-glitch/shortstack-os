import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase, createServiceClient } from "@/lib/supabase/server";
import { parseMentions, resolveOrgId } from "@/lib/chat/server-helpers";

export const maxDuration = 10;

type Ctx = { params: { id: string } };

const PAGE_SIZE = 50;

/**
 * GET /api/chat/channels/:id/messages?before=<iso>&limit=50&thread=<msg_id>
 * Returns messages for a channel. Paginated oldest→newest within a page but
 * anchored on "before" cursor. If `thread` is passed, returns the parent
 * message + all replies.
 */
export async function GET(req: NextRequest, { params }: Ctx) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const channelId = params.id;
  const url = new URL(req.url);
  const before = url.searchParams.get("before");
  const limit = Math.min(parseInt(url.searchParams.get("limit") || "50", 10) || PAGE_SIZE, 200);
  const threadRoot = url.searchParams.get("thread");

  const service = createServiceClient();

  // Ensure caller is a member of the channel
  const { data: membership } = await service
    .from("channel_members")
    .select("user_id")
    .eq("channel_id", channelId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!membership) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (threadRoot) {
    const { data: parent } = await service
      .from("messages")
      .select("*")
      .eq("id", threadRoot)
      .eq("channel_id", channelId)
      .maybeSingle();
    const { data: replies } = await service
      .from("messages")
      .select("*")
      .eq("thread_parent_id", threadRoot)
      .order("created_at", { ascending: true });
    const reactions = await loadReactions(service, [
      ...(parent ? [(parent as { id: string }).id] : []),
      ...((replies || []).map((r) => (r as { id: string }).id)),
    ]);
    return NextResponse.json({ parent, replies: replies || [], reactions });
  }

  let q = service
    .from("messages")
    .select("*")
    .eq("channel_id", channelId)
    .is("thread_parent_id", null)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (before) q = q.lt("created_at", before);
  const { data: rows, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const messages = (rows || []).slice().reverse(); // oldest first for render
  const ids = messages.map((m) => (m as { id: string }).id);

  // Thread reply counts
  const { data: replyRows } = ids.length > 0
    ? await service
        .from("messages")
        .select("thread_parent_id")
        .in("thread_parent_id", ids)
    : { data: [] as Array<{ thread_parent_id: string }> };
  const replyCounts: Record<string, number> = {};
  for (const r of replyRows || []) {
    const k = (r as { thread_parent_id: string }).thread_parent_id;
    replyCounts[k] = (replyCounts[k] || 0) + 1;
  }

  const reactions = await loadReactions(service, ids);

  return NextResponse.json({
    messages,
    reactions,
    reply_counts: replyCounts,
    has_more: (rows?.length || 0) >= limit,
  });
}

/**
 * POST /api/chat/channels/:id/messages
 * Body: { content, thread_parent_id?, attachments? }
 * Parses @mentions, stores ids in mentions[], returns the created row.
 */
export async function POST(req: NextRequest, { params }: Ctx) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const channelId = params.id;
  let body: { content?: unknown; thread_parent_id?: unknown; attachments?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const content = typeof body.content === "string" ? body.content : "";
  const threadParentId = typeof body.thread_parent_id === "string" ? body.thread_parent_id : null;
  const attachments = Array.isArray(body.attachments) ? body.attachments : [];

  if (!content.trim() && attachments.length === 0) {
    return NextResponse.json({ error: "Message is empty" }, { status: 400 });
  }
  if (content.length > 8000) {
    return NextResponse.json({ error: "Message too long" }, { status: 400 });
  }

  const service = createServiceClient();
  // Must be a member
  const { data: membership } = await service
    .from("channel_members")
    .select("user_id")
    .eq("channel_id", channelId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!membership) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const orgId = await resolveOrgId(supabase, user.id);
  const mentions = await parseMentions(supabase, orgId, content);

  const { data: row, error } = await service
    .from("messages")
    .insert({
      channel_id: channelId,
      sender_id: user.id,
      content,
      thread_parent_id: threadParentId,
      mentions,
      attachments,
    })
    .select("*")
    .single();

  if (error || !row) {
    return NextResponse.json({ error: error?.message || "Failed to send" }, { status: 500 });
  }
  return NextResponse.json({ message: row });
}

/* ─── helpers ─────────────────────────────────────────────────── */
async function loadReactions(
  service: ReturnType<typeof createServiceClient>,
  messageIds: string[],
): Promise<Record<string, Array<{ emoji: string; user_ids: string[] }>>> {
  if (messageIds.length === 0) return {};
  const { data } = await service
    .from("message_reactions")
    .select("message_id, user_id, emoji")
    .in("message_id", messageIds);
  const grouped: Record<string, Record<string, Set<string>>> = {};
  for (const r of data || []) {
    const mid = (r as { message_id: string }).message_id;
    const uid = (r as { user_id: string }).user_id;
    const em = (r as { emoji: string }).emoji;
    grouped[mid] = grouped[mid] || {};
    grouped[mid][em] = grouped[mid][em] || new Set();
    grouped[mid][em].add(uid);
  }
  const out: Record<string, Array<{ emoji: string; user_ids: string[] }>> = {};
  for (const [mid, emojis] of Object.entries(grouped)) {
    out[mid] = Object.entries(emojis).map(([emoji, uids]) => ({
      emoji,
      user_ids: Array.from(uids),
    }));
  }
  return out;
}
