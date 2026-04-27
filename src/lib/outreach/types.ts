/**
 * Shared types for the Unified Outreach Feed.
 *
 * The aggregator pulls from three existing tables:
 *   - voice_calls       (Twilio + ElevenLabs call records, with transcripts)
 *   - outreach_log      (cold-email/SMS/DM outbound + reply log)
 *   - messages          (conversation_messages for the inbox feature)
 *
 * Everything is normalized into the OutreachEvent + OutreachConversation
 * shapes below so the chat-bubble UI can render any channel uniformly.
 */

export type OutreachChannel = "voice_call" | "email" | "sms" | "dm";
export type OutreachDirection = "in" | "out";
export type ContactKind = "lead" | "client";

export type OutreachOutcome =
  | "interested"
  | "objection"
  | "no_answer"
  | "booked"
  | "replied"
  | "voicemail"
  | "bounced"
  | "unknown";

export interface OutreachConversation {
  /** lead.id when contact_kind === "lead", client.id when "client". */
  contact_id: string;
  contact_kind: ContactKind;
  contact_name: string;
  contact_avatar?: string;
  contact_email?: string;
  contact_phone?: string;
  /** For portal filtering — only set when the contact is associated with a client. */
  client_id: string | null;
  channels_used: OutreachChannel[];
  last_message: {
    channel: OutreachChannel;
    body: string;
    direction: OutreachDirection;
    ts: string;
  };
  last_outcome: OutreachOutcome;
  /** Inbound events since the agency owner's last mark-read. */
  unread_count: number;
  total_interactions: number;
}

export interface OutreachEvent {
  /** UUID. Stable per (source_table, source_id) tuple. */
  id: string;
  channel: OutreachChannel;
  direction: OutreachDirection;
  /** Short body. For calls this is a one-line summary. Full transcript on .transcript. */
  body: string;
  /** Subject line for email events. Empty string otherwise. */
  subject?: string;
  /** Full transcript (voice_call only). Truncated upstream if huge. */
  transcript?: string;
  /** Voice-call-only: duration in seconds. */
  duration_seconds?: number;
  ts: string;
  outcome?: OutreachOutcome;
  outcome_summary?: string;
  source_id: string;
  source_table: "voice_calls" | "outreach_log" | "messages";
  /** Number of attachments (rendered as a small chip; we don't expand them yet). */
  attachment_count?: number;
}

export interface OutreachThreadSummary {
  summary: string;
  suggested_action: string;
  computed_at: string;
}

export interface ListConversationsOpts {
  client_id?: string | null;
  q?: string | null;
  channel?: OutreachChannel | null;
  limit?: number;
  offset?: number;
}
