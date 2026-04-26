-- ShortStack Marketing v1 — Klaviyo replacement
-- Phase 1: campaigns + recipients + automations + enrollments
--
-- WHY: ShortStack OS now ships email-marketing capability natively. Users
-- previously relied on Klaviyo ($50–1500/mo) for the same flow: drag-drop
-- campaigns, segment-based audiences, drip automations. Native delivery is
-- via the same Resend pipe that already powers transactional email — so
-- there is no extra infra, no extra IPs, no extra deliverability surface.
--
-- Idempotent. Re-run safe. Already applied to `jkttomvrfhomhthetqhh` via
-- the Supabase MCP `apply_migration` on 2026-04-27.

-- ── email_campaigns ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.email_campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name text NOT NULL,
  subject text NOT NULL,
  preheader text,
  from_name text,
  from_email text,
  audience_type text NOT NULL CHECK (audience_type IN ('segment','tag','csv','all')),
  audience_filter jsonb DEFAULT '{}',
  blocks jsonb NOT NULL DEFAULT '[]',
  rendered_html text,
  status text DEFAULT 'draft' CHECK (status IN ('draft','scheduled','sending','sent','failed','cancelled')),
  scheduled_at timestamptz,
  sent_at timestamptz,
  recipients_count int DEFAULT 0,
  delivered_count int DEFAULT 0,
  opens_count int DEFAULT 0,
  clicks_count int DEFAULT 0,
  bounces_count int DEFAULT 0,
  unsubscribes_count int DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE public.email_campaigns ENABLE ROW LEVEL SECURITY;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'email_campaigns_own' AND polrelid = 'public.email_campaigns'::regclass) THEN
    EXECUTE 'CREATE POLICY "email_campaigns_own" ON public.email_campaigns FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid())';
  END IF;
END$$;
CREATE INDEX IF NOT EXISTS idx_email_campaigns_user_status ON public.email_campaigns(user_id, status);
CREATE INDEX IF NOT EXISTS idx_email_campaigns_scheduled ON public.email_campaigns(scheduled_at) WHERE status = 'scheduled';

-- ── email_campaign_recipients ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.email_campaign_recipients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES public.email_campaigns(id) ON DELETE CASCADE,
  contact_id uuid REFERENCES public.leads(id) ON DELETE SET NULL,
  email text NOT NULL,
  status text DEFAULT 'pending' CHECK (status IN ('pending','sent','delivered','opened','clicked','bounced','unsubscribed','failed')),
  resend_message_id text,
  sent_at timestamptz,
  opened_at timestamptz,
  clicked_at timestamptz,
  metadata jsonb DEFAULT '{}'
);
ALTER TABLE public.email_campaign_recipients ENABLE ROW LEVEL SECURITY;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'email_campaign_recipients_own' AND polrelid = 'public.email_campaign_recipients'::regclass) THEN
    EXECUTE 'CREATE POLICY "email_campaign_recipients_own" ON public.email_campaign_recipients FOR ALL USING (campaign_id IN (SELECT id FROM public.email_campaigns WHERE user_id = auth.uid())) WITH CHECK (campaign_id IN (SELECT id FROM public.email_campaigns WHERE user_id = auth.uid()))';
  END IF;
END$$;
CREATE INDEX IF NOT EXISTS idx_recipients_campaign_status ON public.email_campaign_recipients(campaign_id, status);
CREATE INDEX IF NOT EXISTS idx_recipients_resend_message_id ON public.email_campaign_recipients(resend_message_id) WHERE resend_message_id IS NOT NULL;

-- ── email_automations ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.email_automations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name text NOT NULL,
  trigger_type text NOT NULL CHECK (trigger_type IN ('tag_added','form_submitted','segment_joined','link_clicked','custom_field_changed')),
  trigger_config jsonb DEFAULT '{}',
  steps jsonb NOT NULL DEFAULT '[]',
  status text DEFAULT 'draft' CHECK (status IN ('draft','active','paused')),
  enrolled_count int DEFAULT 0,
  completed_count int DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE public.email_automations ENABLE ROW LEVEL SECURITY;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'email_automations_own' AND polrelid = 'public.email_automations'::regclass) THEN
    EXECUTE 'CREATE POLICY "email_automations_own" ON public.email_automations FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid())';
  END IF;
END$$;
CREATE INDEX IF NOT EXISTS idx_email_automations_user_status ON public.email_automations(user_id, status);

-- ── email_automation_enrollments ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.email_automation_enrollments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  automation_id uuid NOT NULL REFERENCES public.email_automations(id) ON DELETE CASCADE,
  contact_id uuid REFERENCES public.leads(id) ON DELETE CASCADE,
  current_step int DEFAULT 0,
  next_action_at timestamptz,
  status text DEFAULT 'active' CHECK (status IN ('active','paused','completed','exited')),
  enrolled_at timestamptz DEFAULT now(),
  completed_at timestamptz,
  metadata jsonb DEFAULT '{}'
);
ALTER TABLE public.email_automation_enrollments ENABLE ROW LEVEL SECURITY;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'email_automation_enrollments_own' AND polrelid = 'public.email_automation_enrollments'::regclass) THEN
    EXECUTE 'CREATE POLICY "email_automation_enrollments_own" ON public.email_automation_enrollments FOR ALL USING (automation_id IN (SELECT id FROM public.email_automations WHERE user_id = auth.uid())) WITH CHECK (automation_id IN (SELECT id FROM public.email_automations WHERE user_id = auth.uid()))';
  END IF;
END$$;
CREATE INDEX IF NOT EXISTS idx_enrollments_next_action ON public.email_automation_enrollments(next_action_at) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_enrollments_automation_status ON public.email_automation_enrollments(automation_id, status);
