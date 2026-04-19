-- Phase 3 of Content Hub: auto-posting execution
-- Adds approval + publish tracking columns, extends content_status enum,
-- and indexes the cron worker scan.

alter table content_calendar add column if not exists approved_at timestamptz;
alter table content_calendar add column if not exists approved_by uuid references profiles(id);
alter table content_calendar add column if not exists published_error text;
alter table content_calendar add column if not exists published_at timestamptz;
alter table content_calendar add column if not exists live_url text;

-- Enum value additions must commit before they can be referenced, so they
-- live in their own transaction. IF NOT EXISTS keeps the migration idempotent.
alter type content_status add value if not exists 'approved_for_publish';
alter type content_status add value if not exists 'publishing';
alter type content_status add value if not exists 'posted';
alter type content_status add value if not exists 'needs_connection';

create index if not exists idx_content_calendar_pub_worker
  on content_calendar(status, scheduled_at);
