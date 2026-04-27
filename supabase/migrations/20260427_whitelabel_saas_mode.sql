-- White-label SaaS Mode: custom domain + branding + subaccounts
ALTER TABLE white_label_config
  ADD COLUMN IF NOT EXISTS brand_name text,
  ADD COLUMN IF NOT EXISTS custom_domain text,
  ADD COLUMN IF NOT EXISTS custom_domain_verified boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS custom_domain_ssl_status text DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS support_email text,
  ADD COLUMN IF NOT EXISTS privacy_url text,
  ADD COLUMN IF NOT EXISTS terms_url text,
  ADD COLUMN IF NOT EXISTS resell_enabled boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS stripe_connect_account_id text,
  ADD COLUMN IF NOT EXISTS markup_percent numeric DEFAULT 0;
ALTER TABLE white_label_config
  DROP CONSTRAINT IF EXISTS white_label_config_ssl_status_check;
ALTER TABLE white_label_config
  ADD CONSTRAINT white_label_config_ssl_status_check
  CHECK (custom_domain_ssl_status IN ('pending','provisioning','active','failed'));
CREATE UNIQUE INDEX IF NOT EXISTS idx_whitelabel_custom_domain
  ON white_label_config(custom_domain) WHERE custom_domain IS NOT NULL;
ALTER TABLE white_label_config ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "white_label_config_owner_all" ON white_label_config;
CREATE POLICY "white_label_config_owner_all"
  ON white_label_config FOR ALL USING (user_id = auth.uid());

CREATE TABLE IF NOT EXISTS public.subaccounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL,
  email text NOT NULL,
  name text NOT NULL,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','active','suspended','cancelled')),
  plan_tier text NOT NULL,
  monthly_amount_cents integer NOT NULL DEFAULT 0,
  stripe_subscription_id text,
  invited_at timestamptz NOT NULL DEFAULT now(),
  activated_at timestamptz,
  cancelled_at timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.subaccounts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "subaccounts_parent_own" ON public.subaccounts;
CREATE POLICY "subaccounts_parent_own"
  ON public.subaccounts FOR ALL USING (parent_user_id = auth.uid());
CREATE INDEX IF NOT EXISTS idx_subaccounts_parent ON public.subaccounts(parent_user_id);
CREATE INDEX IF NOT EXISTS idx_subaccounts_status ON public.subaccounts(parent_user_id, status);
CREATE INDEX IF NOT EXISTS idx_subaccounts_client ON public.subaccounts(client_id) WHERE client_id IS NOT NULL;

CREATE OR REPLACE FUNCTION set_subaccounts_updated_at()
RETURNS trigger AS $func$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$func$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_subaccounts_updated ON public.subaccounts;
CREATE TRIGGER trg_subaccounts_updated
  BEFORE UPDATE ON public.subaccounts
  FOR EACH ROW EXECUTE FUNCTION set_subaccounts_updated_at();
