-- Prevent duplicate Stripe customer IDs being assigned to the same
-- profile or client under concurrent billing requests.
--
-- Partial indexes exclude NULL so users who have never subscribed don't
-- block each other. Any existing duplicates are a pre-existing data
-- problem; this migration intentionally errors rather than silently
-- dropping them so we notice and clean up before applying.

-- Agency owners: profiles.stripe_customer_id
CREATE UNIQUE INDEX IF NOT EXISTS profiles_stripe_customer_id_unique
  ON profiles (stripe_customer_id)
  WHERE stripe_customer_id IS NOT NULL;

-- Agency clients: clients.stripe_customer_id
CREATE UNIQUE INDEX IF NOT EXISTS clients_stripe_customer_id_unique
  ON clients (stripe_customer_id)
  WHERE stripe_customer_id IS NOT NULL;
