-- Voicemail templates + drops for the Voicemail Drop dashboard.
--
-- Templates store a name + R2-hosted audio file + duration. The Voicemail
-- Drop UI uploads to /api/voicemail/templates (POST) which writes to R2 and
-- inserts the row.
--
-- Drops are per-call records used when /api/voicemail/drop initiates a
-- Twilio call that plays the chosen template's audio via TwiML <Play>.

CREATE TABLE IF NOT EXISTS public.voicemail_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name text NOT NULL,
  audio_url text NOT NULL,
  duration_seconds int,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS voicemail_templates_user_idx
  ON public.voicemail_templates (user_id, created_at DESC);

ALTER TABLE public.voicemail_templates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "voicemail_templates_own" ON public.voicemail_templates;
CREATE POLICY "voicemail_templates_own" ON public.voicemail_templates FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE TABLE IF NOT EXISTS public.voicemail_drops (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  template_id uuid REFERENCES public.voicemail_templates(id) ON DELETE SET NULL,
  to_number text NOT NULL,
  from_number text,
  twilio_call_sid text,
  status text NOT NULL DEFAULT 'queued',
  error text,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS voicemail_drops_user_idx
  ON public.voicemail_drops (user_id, created_at DESC);

ALTER TABLE public.voicemail_drops ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "voicemail_drops_own" ON public.voicemail_drops;
CREATE POLICY "voicemail_drops_own" ON public.voicemail_drops FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
