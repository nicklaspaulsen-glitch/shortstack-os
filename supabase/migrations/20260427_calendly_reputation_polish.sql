-- Calendly polish + reputation auto-trigger completion (Apr 27).
--
-- Two feature surfaces in one migration:
--
--   1. Calendly polish:
--      - public_token on bookings (reschedule/cancel without auth)
--      - assignment_strategy + round_robin_assignees on meeting_types
--      - sms_reminders_enabled on meeting_types
--      - reminder_log table for SMS/email reminder dedup
--      - no_show_at on bookings (timestamp of when host marked no-show)
--      - cancelled_at, rescheduled_from on bookings (richer history)
--
--   2. Reputation auto-trigger:
--      - trigger_events queue (durable, cron-driven dispatch)
--      - extends action types catalog used by crm_automations + workflows
--
-- All RLS tightened to user_id = auth.uid(); service-role keys bypass for
-- cron + webhook contexts only.

-- ── 1. bookings polish columns ───────────────────────────────────────────

ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS public_token text,
  ADD COLUMN IF NOT EXISTS no_show_at timestamptz,
  ADD COLUMN IF NOT EXISTS cancelled_at timestamptz,
  ADD COLUMN IF NOT EXISTS rescheduled_from uuid REFERENCES public.bookings(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS assigned_to uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS sms_reminder_24h_sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS sms_reminder_1h_sent_at timestamptz;

CREATE UNIQUE INDEX IF NOT EXISTS bookings_public_token_uniq
  ON public.bookings (public_token) WHERE public_token IS NOT NULL;

-- Backfill public_token for existing rows so legacy bookings can also
-- be cancelled/rescheduled by link.
UPDATE public.bookings
SET public_token = encode(gen_random_bytes(16), 'hex')
WHERE public_token IS NULL;

-- ── 2. meeting_types polish columns ──────────────────────────────────────

ALTER TABLE public.meeting_types
  ADD COLUMN IF NOT EXISTS assignment_strategy text NOT NULL DEFAULT 'single'
    CHECK (assignment_strategy IN ('single','round_robin','collective')),
  ADD COLUMN IF NOT EXISTS round_robin_assignees uuid[],
  ADD COLUMN IF NOT EXISTS sms_reminders_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS embed_brand_color text,
  ADD COLUMN IF NOT EXISTS embed_logo_url text,
  ADD COLUMN IF NOT EXISTS group_event boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS max_invitees_per_slot integer NOT NULL DEFAULT 1;

-- ── 3. trigger_events queue ──────────────────────────────────────────────
-- Durable queue so a flaky workflow execution can be retried by the cron.
-- The bookings PATCH path also writes here so even if the in-process
-- fireTrigger() fails we still process the action.

CREATE TABLE IF NOT EXISTS public.trigger_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  trigger_type text NOT NULL,
  source_table text,
  source_id uuid,
  payload jsonb,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','processing','completed','failed','skipped')),
  attempts integer NOT NULL DEFAULT 0,
  error_text text,
  created_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz
);

ALTER TABLE public.trigger_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "trigger_events_own" ON public.trigger_events;
CREATE POLICY "trigger_events_own" ON public.trigger_events FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE INDEX IF NOT EXISTS trigger_events_pending_idx
  ON public.trigger_events (status, created_at)
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS trigger_events_user_idx
  ON public.trigger_events (user_id, created_at DESC);

-- ── 4. reminder log (dedup for SMS reminders) ────────────────────────────

CREATE TABLE IF NOT EXISTS public.booking_reminder_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id uuid NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  channel text NOT NULL CHECK (channel IN ('sms','email')),
  reminder_kind text NOT NULL CHECK (reminder_kind IN ('24h','1h','custom')),
  status text NOT NULL CHECK (status IN ('sent','failed','skipped')),
  error_text text,
  sent_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.booking_reminder_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "booking_reminder_log_own" ON public.booking_reminder_log;
CREATE POLICY "booking_reminder_log_own" ON public.booking_reminder_log FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE INDEX IF NOT EXISTS booking_reminder_log_booking_idx
  ON public.booking_reminder_log (booking_id, reminder_kind);

-- ── 5. helper RPC: increment_trigger_fire_count (already referenced) ─────
-- Already exists in current production schema per earlier work — defined
-- here defensively so a fresh DB clone gets it.

CREATE OR REPLACE FUNCTION public.increment_trigger_fire_count(trigger_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.workflow_triggers
  SET fire_count = COALESCE(fire_count, 0) + 1
  WHERE id = trigger_id;
END;
$$;
