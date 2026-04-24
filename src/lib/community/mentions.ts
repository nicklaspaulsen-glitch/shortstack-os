import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Parse a body of text for @mentions. Matches `@name` where `name` is 2-40
 * characters of letters/digits/._- (i.e. allows `@john.doe` or `@acme_agency`).
 *
 * Returns a de-duplicated list of raw usernames (without the leading "@").
 */
export function extractMentionHandles(text: string): string[] {
  if (!text) return [];
  const matches = text.match(/@([A-Za-z0-9._-]{2,40})/g) || [];
  const set = new Set<string>();
  for (const m of matches) {
    set.add(m.slice(1).toLowerCase());
  }
  return Array.from(set);
}

export interface MentionRecordInput {
  supabase: SupabaseClient;
  authorId: string;
  authorName: string;
  body: string;
  postId?: string | null;
  commentId?: string | null;
  /** Used as the `link` on the inserted notification row. */
  link: string;
  /** Short context for the notification (e.g. post title). */
  context?: string;
}

/**
 * Resolve @mentions in `body`, insert rows into community_mentions, and
 * fan out notifications (best-effort — if notifications table doesn't exist
 * or the insert fails, the mention rows still land).
 *
 * Matching strategy: we try `profiles.nickname` first (case-insensitive) and
 * fall back to the first segment of `profiles.full_name` lowercased. Self-
 * mentions are skipped. Duplicate mentions against the same target are
 * collapsed by the community_mentions unique constraint being absent — we
 * instead dedupe in-memory before insert.
 */
export async function recordMentions({
  supabase,
  authorId,
  authorName,
  body,
  postId = null,
  commentId = null,
  link,
  context,
}: MentionRecordInput): Promise<{ mentioned: string[] }> {
  const handles = extractMentionHandles(body);
  if (handles.length === 0) return { mentioned: [] };

  // Pull a candidate pool of profiles whose nickname OR lowercased full_name
  // starts with one of the handles. Keep the list small — the @-list in the
  // client is usually a handful of names.
  const orClauses: string[] = [];
  for (const h of handles) {
    orClauses.push(`nickname.ilike.${h}`);
    orClauses.push(`full_name.ilike.${h}%`);
  }

  const { data: candidates } = await supabase
    .from("profiles")
    .select("id, nickname, full_name")
    .or(orClauses.join(","))
    .limit(50);

  if (!candidates || candidates.length === 0) return { mentioned: [] };

  const matched = new Map<string, { id: string; handle: string }>();
  for (const h of handles) {
    for (const c of candidates as Array<{
      id: string;
      nickname: string | null;
      full_name: string | null;
    }>) {
      const nick = (c.nickname || "").toLowerCase();
      const firstName = (c.full_name || "").split(" ")[0]?.toLowerCase() || "";
      if (nick === h || firstName === h) {
        if (c.id !== authorId) matched.set(c.id, { id: c.id, handle: h });
        break;
      }
    }
  }

  if (matched.size === 0) return { mentioned: [] };

  const rows = Array.from(matched.values()).map((m) => ({
    post_id: postId,
    comment_id: commentId,
    mentioned_user_id: m.id,
    author_user_id: authorId,
  }));

  await supabase.from("community_mentions").insert(rows);

  // Best-effort notifications fan-out. We use `message` to match the
  // existing notifications table; older schemas with `description` will
  // silently reject the column and the mention record still sticks around.
  const notifRows = rows.map((r) => ({
    user_id: r.mentioned_user_id,
    title: `${authorName} mentioned you`,
    message: context
      ? `In "${trim(context, 60)}"`
      : "You were mentioned in the community",
    type: "info",
    link,
    read: false,
  }));

  await supabase.from("notifications").insert(notifRows);

  return { mentioned: Array.from(matched.values()).map((m) => m.handle) };
}

function trim(s: string, n: number): string {
  if (!s) return "";
  return s.length <= n ? s : s.slice(0, n - 1) + "\u2026";
}
