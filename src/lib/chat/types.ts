/**
 * Team chat — shared types used by API routes and the chat UI.
 */

export type ChannelType = "public" | "private" | "project" | "dm";

export interface ChatChannel {
  id: string;
  org_id: string;
  name: string;
  description: string | null;
  channel_type: ChannelType;
  project_id: string | null;
  created_by: string;
  created_at: string;
  archived_at: string | null;
}

export interface ChannelMember {
  channel_id: string;
  user_id: string;
  joined_at: string;
  last_read_at: string;
  muted: boolean;
}

export interface ChatAttachment {
  type: "image" | "file" | "link";
  url: string;
  name?: string;
  size?: number;
  mime?: string;
}

export interface ChatMessage {
  id: string;
  channel_id: string;
  sender_id: string;
  content: string;
  thread_parent_id: string | null;
  mentions: string[];
  attachments: ChatAttachment[];
  created_at: string;
  edited_at: string | null;
  deleted_at: string | null;
}

export interface ChatReaction {
  message_id: string;
  user_id: string;
  emoji: string;
  created_at: string;
}

export interface ChannelListItem extends ChatChannel {
  unread_count?: number;
  last_message_at?: string | null;
}

/** Returned from GET /api/chat/mentions */
export interface MentionRow {
  message_id: string;
  channel_id: string;
  channel_name: string;
  sender_id: string;
  content: string;
  created_at: string;
}

/** Default reactions shown in the quick-react bar. */
export const DEFAULT_REACTIONS = ["👍", "❤️", "😂", "🎉", "🔥", "💡"] as const;

/** 5-minute edit/delete window used by both client and RLS. */
export const EDIT_WINDOW_MS = 5 * 60 * 1000;

/** Canonical DM channel name = sorted user ids joined by ':'. */
export function dmChannelName(userIdA: string, userIdB: string): string {
  return [userIdA, userIdB].sort().join(":");
}
