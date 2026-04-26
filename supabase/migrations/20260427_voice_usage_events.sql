-- Voice usage events — track per-call TTS spend across providers.
-- Applied to production via Supabase MCP on 2026-04-27.
-- Kept here so local resets / branch restores stay in sync.

CREATE TABLE IF NOT EXISTS public.voice_usage_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  provider text NOT NULL CHECK (provider IN ('runpod_xtts','elevenlabs','openai_tts')),
  characters_count int NOT NULL,
  duration_seconds numeric,
  cost_usd numeric NOT NULL DEFAULT 0,
  context text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.voice_usage_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "voice_usage_events_own" ON public.voice_usage_events;
CREATE POLICY "voice_usage_events_own" ON public.voice_usage_events
  FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE INDEX IF NOT EXISTS idx_voice_usage_user_created
  ON public.voice_usage_events(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_voice_usage_provider_created
  ON public.voice_usage_events(provider, created_at DESC);
