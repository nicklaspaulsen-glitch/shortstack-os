-- LLM usage events — track per-call AI spend across providers and task types.
-- Powers the smart LLM router cost dashboard and feeds cost-savings analytics.
-- Applied to production via Supabase MCP on 2026-04-27.
-- Kept here so local resets / branch restores stay in sync.

CREATE TABLE IF NOT EXISTS public.llm_usage_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  task_type text NOT NULL,
  provider text NOT NULL,
  model text NOT NULL,
  input_tokens int NOT NULL,
  output_tokens int NOT NULL,
  cost_usd numeric NOT NULL DEFAULT 0,
  duration_ms int,
  context text,
  cache_hit boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.llm_usage_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "llm_usage_events_own" ON public.llm_usage_events;
CREATE POLICY "llm_usage_events_own" ON public.llm_usage_events
  FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE INDEX IF NOT EXISTS idx_llm_usage_user_task
  ON public.llm_usage_events(user_id, task_type, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_llm_usage_provider_created
  ON public.llm_usage_events(provider, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_llm_usage_created
  ON public.llm_usage_events(created_at DESC);
