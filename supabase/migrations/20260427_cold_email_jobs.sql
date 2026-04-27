-- AI Cold-Email Personalization at Scale
-- Generates 1000s of unique opening lines per day using research + Claude

CREATE TABLE IF NOT EXISTS public.cold_email_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name text NOT NULL,
  recipients_count int NOT NULL DEFAULT 0,
  template_seed text NOT NULL,
  research_depth text NOT NULL DEFAULT 'medium'
    CHECK (research_depth IN ('shallow','medium','deep')),
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','researching','generating','sending','completed','failed')),
  generated_count int NOT NULL DEFAULT 0,
  sent_count int NOT NULL DEFAULT 0,
  failed_count int NOT NULL DEFAULT 0,
  cost_usd numeric NOT NULL DEFAULT 0,
  throttle_per_hour int NOT NULL DEFAULT 100,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.cold_email_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "cold_email_jobs_own"
  ON public.cold_email_jobs
  FOR ALL
  USING (user_id = auth.uid());

CREATE INDEX IF NOT EXISTS idx_cold_email_jobs_user_status
  ON public.cold_email_jobs(user_id, status);

CREATE TABLE IF NOT EXISTS public.cold_email_personalizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL REFERENCES public.cold_email_jobs(id) ON DELETE CASCADE,
  lead_id uuid REFERENCES public.leads(id) ON DELETE SET NULL,
  research_data jsonb,
  generated_subject text,
  generated_opener text,
  generated_body text,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','researched','generated','sent','failed','skipped')),
  resend_message_id text,
  cost_usd numeric NOT NULL DEFAULT 0,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.cold_email_personalizations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "cold_email_personalizations_own"
  ON public.cold_email_personalizations
  FOR ALL
  USING (
    job_id IN (
      SELECT id FROM public.cold_email_jobs WHERE user_id = auth.uid()
    )
  );

CREATE INDEX IF NOT EXISTS idx_cold_email_perso_job_status
  ON public.cold_email_personalizations(job_id, status);
