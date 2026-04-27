-- Mem0 + Langfuse — agent memory layer + LLM trace index.
-- Mem0 stores in its own backend (cloud or self-hosted); we keep a local audit
-- table linking memories to subjects so we can show "remembered facts" in the UI.
-- Langfuse stores traces in its own backend; we keep a local index of trace IDs
-- so users can click through from a CRM record to the Langfuse trace dashboard.
-- Applied to production via Supabase MCP on 2026-04-27.
-- Kept here so local resets / branch restores stay in sync.

CREATE TABLE IF NOT EXISTS public.agent_memories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_owner_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  subject_kind text NOT NULL CHECK (subject_kind IN ('lead', 'client', 'user', 'team_member', 'agent')),
  subject_id uuid NOT NULL,
  agent_key text,                              -- 'lyra' | 'sage' | 'aria' | 'onyx' | etc.
  mem0_memory_id text NOT NULL,                -- the ID Mem0 returns
  fact text NOT NULL,                          -- human-readable summary of the memory
  source text NOT NULL,                        -- 'cold_email_draft' | 'sales_call_analysis' | 'trinity_proposal' | etc.
  source_ref_id uuid,                          -- voice_calls.id / coach_analyses.id / etc.
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_agent_memories_subject ON public.agent_memories(subject_kind, subject_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_agent_memories_owner_recent ON public.agent_memories(agency_owner_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.agent_trace_index (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_owner_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  langfuse_trace_id text NOT NULL UNIQUE,
  agent_surface text NOT NULL,                 -- 'cold_email' | 'sales_coach' | 'trinity_autonomous' | etc.
  related_subject_kind text,
  related_subject_id uuid,
  task_type text,                              -- e.g. 'simple_classification'
  total_tokens int,
  total_cost_usd numeric,
  latency_ms int,
  status text CHECK (status IN ('success', 'error', 'fallback')),
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_traces_owner_recent ON public.agent_trace_index(agency_owner_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_traces_subject ON public.agent_trace_index(related_subject_kind, related_subject_id);

ALTER TABLE public.agent_memories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_trace_index ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "memories_owner" ON public.agent_memories;
CREATE POLICY "memories_owner" ON public.agent_memories
  FOR ALL USING (agency_owner_id = auth.uid()) WITH CHECK (agency_owner_id = auth.uid());

DROP POLICY IF EXISTS "traces_owner" ON public.agent_trace_index;
CREATE POLICY "traces_owner" ON public.agent_trace_index
  FOR ALL USING (agency_owner_id = auth.uid()) WITH CHECK (agency_owner_id = auth.uid());
