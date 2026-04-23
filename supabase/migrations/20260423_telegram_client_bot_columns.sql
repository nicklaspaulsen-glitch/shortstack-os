-- Migration: ensure per-client Telegram bot columns exist
-- Date: 2026-04-23
--
-- Background: 20260413_new_columns.sql tried to add telegram_bot_token,
-- telegram_bot_username, and telegram_chat_id to the clients table, but they
-- are missing from the live DB (checked via the multi-tenancy audit on
-- 2026-04-23). Without these, /api/telegram/client-bot and
-- /api/telegram/setup-bot fail at runtime — select/update on a missing
-- column raises an error, so every per-client bot registration has silently
-- been broken.
--
-- This migration re-asserts the columns (IF NOT EXISTS so it's a no-op in
-- any env that already has them) and adds complementary indexes.

ALTER TABLE clients ADD COLUMN IF NOT EXISTS telegram_bot_token text;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS telegram_bot_username text;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS telegram_chat_id text;

CREATE INDEX IF NOT EXISTS idx_clients_telegram_chat
  ON clients(telegram_chat_id) WHERE telegram_chat_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_clients_telegram_bot_token
  ON clients(telegram_bot_token) WHERE telegram_bot_token IS NOT NULL;

-- RLS reminder: clients table already has `clients_own` (SELECT where
-- profile_id = auth.uid()) and `clients_admin` (ALL for admin role). The
-- service role used by Telegram webhooks bypasses RLS, which is why
-- ownership checks must be enforced in route handlers. See
-- setup-bot/route.ts — the POST/DELETE methods both verify
-- clients.profile_id === user.id before mutating bot config.
