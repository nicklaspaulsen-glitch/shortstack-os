-- ============================================================
-- Wave 3: Service Marketplace + Trinity Autonomous Mode
-- ============================================================
-- Two features in one migration because they share the same
-- ownership model and both ride on profiles.id.
--
-- 1) Service Marketplace
--    Sellers (any user) list services.  Buyers (any user) pay
--    via Stripe.  ShortStack takes a configurable fee, the rest
--    is transferred to the seller's connected account.
--
-- 2) Trinity Autonomous Mode
--    Trinity proposes actions per user every hour.  In Shadow
--    mode, the user must approve.  In Autopilot, actions execute
--    after a user-defined veto window.
-- ============================================================

-- -------------- 1. MARKETPLACE -------------------------------

CREATE TABLE IF NOT EXISTS public.marketplace_services (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title           text NOT NULL,
  description     text NOT NULL,
  category        text NOT NULL,
  price_cents     integer NOT NULL CHECK (price_cents >= 100),
  currency        text NOT NULL DEFAULT 'usd',
  delivery_days   integer NOT NULL DEFAULT 7 CHECK (delivery_days > 0),
  status          text NOT NULL DEFAULT 'active'
                    CHECK (status IN ('draft', 'active', 'paused', 'closed')),
  stripe_price_id text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_marketplace_services_user
  ON public.marketplace_services(user_id);
CREATE INDEX IF NOT EXISTS idx_marketplace_services_status
  ON public.marketplace_services(status);
CREATE INDEX IF NOT EXISTS idx_marketplace_services_category
  ON public.marketplace_services(category);

ALTER TABLE public.marketplace_services ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "marketplace_services_read" ON public.marketplace_services;
CREATE POLICY "marketplace_services_read"
  ON public.marketplace_services
  FOR SELECT
  USING (status = 'active');

DROP POLICY IF EXISTS "marketplace_services_own" ON public.marketplace_services;
CREATE POLICY "marketplace_services_own"
  ON public.marketplace_services
  FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE TABLE IF NOT EXISTS public.marketplace_orders (
  id                        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  service_id                uuid NOT NULL
                              REFERENCES public.marketplace_services(id)
                              ON DELETE RESTRICT,
  buyer_user_id             uuid NOT NULL
                              REFERENCES public.profiles(id) ON DELETE CASCADE,
  seller_user_id            uuid NOT NULL
                              REFERENCES public.profiles(id) ON DELETE CASCADE,
  amount_cents              integer NOT NULL,
  shortstack_fee_cents      integer NOT NULL,
  seller_payout_cents       integer NOT NULL,
  currency                  text NOT NULL DEFAULT 'usd',
  status                    text NOT NULL DEFAULT 'pending_payment'
                              CHECK (status IN (
                                'pending_payment', 'paid', 'in_progress',
                                'delivered', 'disputed', 'refunded', 'cancelled'
                              )),
  stripe_checkout_session_id text,
  stripe_payment_intent_id   text,
  stripe_transfer_id         text,
  buyer_notes                text,
  seller_delivery_notes      text,
  delivered_at               timestamptz,
  created_at                 timestamptz NOT NULL DEFAULT now(),
  updated_at                 timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_marketplace_orders_buyer
  ON public.marketplace_orders(buyer_user_id);
CREATE INDEX IF NOT EXISTS idx_marketplace_orders_seller
  ON public.marketplace_orders(seller_user_id);
CREATE INDEX IF NOT EXISTS idx_marketplace_orders_status
  ON public.marketplace_orders(status);

ALTER TABLE public.marketplace_orders ENABLE ROW LEVEL SECURITY;

-- Buyers can read their own orders.
DROP POLICY IF EXISTS "marketplace_orders_buyer" ON public.marketplace_orders;
CREATE POLICY "marketplace_orders_buyer"
  ON public.marketplace_orders
  FOR SELECT
  USING (buyer_user_id = auth.uid());

-- Sellers can read AND mutate their own orders (deliver, etc.).
DROP POLICY IF EXISTS "marketplace_orders_seller" ON public.marketplace_orders;
CREATE POLICY "marketplace_orders_seller"
  ON public.marketplace_orders
  FOR ALL
  USING (seller_user_id = auth.uid())
  WITH CHECK (seller_user_id = auth.uid());

CREATE TABLE IF NOT EXISTS public.marketplace_reviews (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id    uuid NOT NULL UNIQUE
                REFERENCES public.marketplace_orders(id) ON DELETE CASCADE,
  reviewer_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  rating      integer NOT NULL CHECK (rating BETWEEN 1 AND 5),
  text        text,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_marketplace_reviews_reviewer
  ON public.marketplace_reviews(reviewer_id);

ALTER TABLE public.marketplace_reviews ENABLE ROW LEVEL SECURITY;

-- Reviews are public (helps buyers shop), but only the reviewer
-- can edit/delete and only the buyer of a delivered order can write.
DROP POLICY IF EXISTS "marketplace_reviews_read" ON public.marketplace_reviews;
CREATE POLICY "marketplace_reviews_read"
  ON public.marketplace_reviews
  FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "marketplace_reviews_write" ON public.marketplace_reviews;
CREATE POLICY "marketplace_reviews_write"
  ON public.marketplace_reviews
  FOR ALL
  USING (reviewer_id = auth.uid())
  WITH CHECK (reviewer_id = auth.uid());

-- Marketplace fee % — store on the agency owner's white_label_config row.
-- Default 10%.  Range 0-30%.
ALTER TABLE public.white_label_config
  ADD COLUMN IF NOT EXISTS marketplace_fee_pct numeric NOT NULL DEFAULT 10
    CHECK (marketplace_fee_pct >= 0 AND marketplace_fee_pct <= 30);


-- -------------- 2. TRINITY AUTONOMOUS ------------------------

CREATE TABLE IF NOT EXISTS public.trinity_actions (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             uuid NOT NULL REFERENCES public.profiles(id)
                        ON DELETE CASCADE,
  action_type         text NOT NULL,
  context             jsonb,
  proposed_action     jsonb,
  rationale           text,
  status              text NOT NULL DEFAULT 'proposed'
                        CHECK (status IN (
                          'proposed', 'approved', 'executed',
                          'vetoed', 'expired', 'failed'
                        )),
  veto_window_until   timestamptz,
  executed_at         timestamptz,
  result              jsonb,
  cost_usd            numeric NOT NULL DEFAULT 0,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_trinity_actions_user
  ON public.trinity_actions(user_id);
CREATE INDEX IF NOT EXISTS idx_trinity_actions_status
  ON public.trinity_actions(status);
CREATE INDEX IF NOT EXISTS idx_trinity_actions_user_status_created
  ON public.trinity_actions(user_id, status, created_at DESC);

ALTER TABLE public.trinity_actions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "trinity_actions_own" ON public.trinity_actions;
CREATE POLICY "trinity_actions_own"
  ON public.trinity_actions
  FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE TABLE IF NOT EXISTS public.trinity_settings (
  user_id             uuid PRIMARY KEY
                        REFERENCES public.profiles(id) ON DELETE CASCADE,
  mode                text NOT NULL DEFAULT 'shadow'
                        CHECK (mode IN ('off', 'shadow', 'autopilot')),
  enabled_actions     text[] NOT NULL DEFAULT ARRAY[]::text[],
  veto_window_hours   integer NOT NULL DEFAULT 4
                        CHECK (veto_window_hours BETWEEN 0 AND 72),
  daily_brief_email   text,
  updated_at          timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.trinity_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "trinity_settings_own" ON public.trinity_settings;
CREATE POLICY "trinity_settings_own"
  ON public.trinity_settings
  FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
