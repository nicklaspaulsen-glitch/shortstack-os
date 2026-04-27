-- Voice Studio — voice cloning + render cache + preset library.
--
-- Three-table model:
--   voice_clones         — a trained voice (user/team/client clone OR system preset)
--   voice_clone_samples  — raw audio uploads used for training, stored in R2
--   voice_renders        — cached synthesised audio (clone_id + text_hash → R2 url)
--
-- Cross-references:
--   voice_usage_events (existing, 20260427_voice_usage_events.sql) tracks
--   per-synthesis spend. Voice Studio writes through the same router so the
--   same telemetry table covers cloned + non-cloned synthesis.
--
--   voicemail_templates (existing, 20260427_voicemail_templates.sql) keeps
--   the static voicemail-drop catalogue. Voice Studio is the authoring tool
--   that generates voicemail_templates.audio_url via /api/voice/synthesize.

CREATE TABLE IF NOT EXISTS public.voice_clones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_owner_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  -- Owner of the cloned voice. owner_subject_kind='preset' means the clone
  -- is a system-curated preset (still keyed to founder agency_owner_id so
  -- RLS works, but readable by every authenticated user).
  owner_subject_kind text NOT NULL CHECK (
    owner_subject_kind IN ('user', 'team_member', 'client', 'preset')
  ),
  owner_subject_id uuid,
  label text NOT NULL,
  description text,
  provider text NOT NULL CHECK (
    provider IN ('runpod_f5tts', 'runpod_xtts', 'runpod_openvoice', 'elevenlabs', 'preset')
  ),
  -- ElevenLabs voice_id, RunPod fingerprint key, or preset slug.
  provider_voice_id text,
  status text NOT NULL DEFAULT 'training' CHECK (
    status IN ('training', 'ready', 'failed')
  ),
  language text NOT NULL DEFAULT 'en',
  consent_kind text NOT NULL CHECK (
    consent_kind IN ('self', 'client_signed', 'team_member_signed', 'preset')
  ),
  -- IP, ts, signature URL, signed-by name etc. Required when consent_kind
  -- is signed; we enforce via API not DB so we can store partial blobs.
  consent_evidence jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_default_for_user boolean NOT NULL DEFAULT false,
  is_default_for_voicemail boolean NOT NULL DEFAULT false,
  is_default_for_dialer boolean NOT NULL DEFAULT false,
  is_default_for_sms boolean NOT NULL DEFAULT false,
  is_default_for_dm boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  ready_at timestamptz,
  failed_reason text
);

CREATE INDEX IF NOT EXISTS idx_voice_clones_owner
  ON public.voice_clones (agency_owner_id, status);
CREATE INDEX IF NOT EXISTS idx_voice_clones_subject
  ON public.voice_clones (owner_subject_kind, owner_subject_id)
  WHERE status = 'ready';
CREATE INDEX IF NOT EXISTS idx_voice_clones_preset
  ON public.voice_clones (owner_subject_kind)
  WHERE owner_subject_kind = 'preset';

-- Raw training samples. We keep them after training so users can re-run a
-- clone with a different provider without re-uploading.
CREATE TABLE IF NOT EXISTS public.voice_clone_samples (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clone_id uuid NOT NULL REFERENCES public.voice_clones(id) ON DELETE CASCADE,
  agency_owner_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  r2_key text NOT NULL,
  mime_type text NOT NULL,
  duration_seconds numeric,
  word_count int,
  transcript text,
  uploaded_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_voice_samples_clone
  ON public.voice_clone_samples (clone_id);

-- Synthesised audio cache. Hash on (text, speed, format) so identical
-- requests reuse the same R2 object instead of re-billing the provider.
CREATE TABLE IF NOT EXISTS public.voice_renders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_owner_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  clone_id uuid NOT NULL REFERENCES public.voice_clones(id) ON DELETE CASCADE,
  text_hash text NOT NULL,
  text_preview text NOT NULL,
  r2_key text NOT NULL,
  duration_seconds numeric,
  rendered_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz,
  use_count int NOT NULL DEFAULT 0,
  -- Free-text label so reports can group by surface (dialer / voicemail / dm).
  context text,
  UNIQUE (clone_id, text_hash)
);

CREATE INDEX IF NOT EXISTS idx_voice_renders_owner
  ON public.voice_renders (agency_owner_id, rendered_at DESC);
CREATE INDEX IF NOT EXISTS idx_voice_renders_expiry
  ON public.voice_renders (expires_at)
  WHERE expires_at IS NOT NULL;

-- ── RLS ───────────────────────────────────────────────────────────────
ALTER TABLE public.voice_clones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.voice_clone_samples ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.voice_renders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "voice_clones_owner" ON public.voice_clones;
CREATE POLICY "voice_clones_owner" ON public.voice_clones
  FOR ALL
  USING (agency_owner_id = auth.uid())
  WITH CHECK (agency_owner_id = auth.uid());

-- Presets are readable by every authenticated user. Insert/update/delete
-- still requires agency_owner_id = auth.uid() so only the seed-owner can
-- mutate them — same model as workflow_presets.
DROP POLICY IF EXISTS "voice_clones_preset_read" ON public.voice_clones;
CREATE POLICY "voice_clones_preset_read" ON public.voice_clones
  FOR SELECT
  USING (owner_subject_kind = 'preset');

DROP POLICY IF EXISTS "voice_samples_owner" ON public.voice_clone_samples;
CREATE POLICY "voice_samples_owner" ON public.voice_clone_samples
  FOR ALL
  USING (agency_owner_id = auth.uid())
  WITH CHECK (agency_owner_id = auth.uid());

DROP POLICY IF EXISTS "voice_renders_owner" ON public.voice_renders;
CREATE POLICY "voice_renders_owner" ON public.voice_renders
  FOR ALL
  USING (agency_owner_id = auth.uid())
  WITH CHECK (agency_owner_id = auth.uid());
