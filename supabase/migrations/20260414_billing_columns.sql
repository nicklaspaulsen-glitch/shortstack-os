-- Migration: Add missing billing columns referenced by webhook handler
-- Date: 2026-04-14

-- clients table needs stripe_subscription_id (written by webhook on subscription.created)
ALTER TABLE clients ADD COLUMN IF NOT EXISTS stripe_subscription_id TEXT;
CREATE INDEX IF NOT EXISTS idx_clients_stripe_sub ON clients(stripe_subscription_id)
  WHERE stripe_subscription_id IS NOT NULL;

-- invoices table needs stripe_payment_intent (written by webhook on invoice.paid)
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS stripe_payment_intent TEXT;
