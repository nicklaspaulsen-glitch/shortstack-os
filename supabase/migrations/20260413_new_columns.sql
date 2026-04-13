-- Migration: Add new columns for plan tiers, Stripe, Telegram, and Zernio
-- Date: 2026-04-13
-- Run this against your Supabase database via SQL editor or CLI

-- ── Profiles table ──────────────────────────────────────────────────
-- Plan tier for agency owners (Starter, Growth, Enterprise)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS plan_tier text DEFAULT 'Starter';

-- Stripe customer ID for agency subscription billing
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS stripe_customer_id text;

-- Custom label for how clients appear (e.g. "Member", "Partner")
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS client_label text;

-- ── Clients table ───────────────────────────────────────────────────
-- Zernio social media publishing profile
ALTER TABLE clients ADD COLUMN IF NOT EXISTS zernio_profile_id text;

-- Per-client Telegram bot
ALTER TABLE clients ADD COLUMN IF NOT EXISTS telegram_bot_token text;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS telegram_bot_username text;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS telegram_chat_id text;

-- ── Outreach log — add metadata and sent_at if missing ─────────────
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'outreach_log' AND column_name = 'metadata'
  ) THEN
    ALTER TABLE outreach_log ADD COLUMN metadata jsonb DEFAULT '{}';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'outreach_log' AND column_name = 'sent_at'
  ) THEN
    ALTER TABLE outreach_log ADD COLUMN sent_at timestamptz DEFAULT now();
  END IF;
END $$;

-- ── Social accounts — ensure client_id column exists ────────────────
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'social_accounts' AND column_name = 'client_id'
  ) THEN
    ALTER TABLE social_accounts ADD COLUMN client_id uuid REFERENCES clients(id);
  END IF;
END $$;

-- ── Indexes for performance ─────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_profiles_plan_tier ON profiles(plan_tier);
CREATE INDEX IF NOT EXISTS idx_profiles_stripe_customer ON profiles(stripe_customer_id) WHERE stripe_customer_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_clients_telegram_chat ON clients(telegram_chat_id) WHERE telegram_chat_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_outreach_log_status ON outreach_log(status);
CREATE INDEX IF NOT EXISTS idx_outreach_log_platform ON outreach_log(platform);
CREATE INDEX IF NOT EXISTS idx_social_accounts_client ON social_accounts(client_id);

-- ── RLS policies for new columns ────────────────────────────────────
-- Ensure clients can only see their own social accounts
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'social_accounts_client_access'
  ) THEN
    CREATE POLICY social_accounts_client_access ON social_accounts
      FOR SELECT USING (
        client_id IN (
          SELECT id FROM clients WHERE profile_id = auth.uid()
        )
      );
  END IF;
END $$;
